import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");
const common = {
  bundle: true,
  sourcemap: true,
  target: "es2020",
  logLevel: "info",
};

const builds = [
  {
    ...common,
    entryPoints: ["src/index.ts"],
    outfile: "dist/tit.js",
    format: "esm",
  },
  {
    ...common,
    entryPoints: ["src/browser.ts"],
    outfile: "dist/tit.global.js",
    format: "iife",
  },
];

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("Watching Tit.js sources…");
} else {
  await Promise.all(builds.map((options) => build(options)));
}
