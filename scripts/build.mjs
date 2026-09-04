import { build, context } from "esbuild";
import { rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const common = {
  bundle: true,
  sourcemap: true,
  target: "es2020",
  logLevel: "info",
  loader: { ".png": "dataurl" },
};

const builds = [
  {
    ...common,
    entryPoints: ["src/index.ts"],
    outfile: "dist/finch.js",
    format: "esm",
  },
  {
    ...common,
    entryPoints: ["src/browser.ts"],
    outfile: "dist/finch.global.js",
    format: "iife",
  },
];

await rm("dist", { recursive: true, force: true });

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("Watching Finch.js sources…");
} else {
  await Promise.all(builds.map((options) => build(options)));
}
