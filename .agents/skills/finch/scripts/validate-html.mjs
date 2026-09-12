#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const inputs = process.argv.slice(2);
const packageName = "@hachiware-labs/finch-js";
if (inputs.length === 0) {
  console.error("Usage: node validate-html.mjs <html-file> [...html-files]");
  process.exit(2);
}

async function findRuntime(start) {
  let current = path.resolve(start);
  while (true) {
    const manifest = path.join(current, "package.json");
    try {
      const parsed = JSON.parse(await readFile(manifest, "utf8"));
      const candidates = [];
      if (parsed.name === packageName) candidates.push(path.join(current, "dist", "finch.js"));
      const dependencies = { ...parsed.dependencies, ...parsed.devDependencies };
      if (dependencies[packageName]) candidates.push(path.join(current, "node_modules", ...packageName.split("/"), "dist", "finch.js"));
      for (const candidate of candidates) {
        try {
          await access(candidate);
          return candidate;
        } catch {
          // Try another candidate or continue toward a parent workspace.
        }
      }
    } catch {
      // Continue upward until an installed Finch.js runtime is found.
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not find dist/finch.js or an installed ${packageName} dependency from the current working directory.`);
    }
    current = parent;
  }
}

function attribute(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2];
}

function embeddedSources(html) {
  const sources = [];
  for (const scriptMatch of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attribute(scriptMatch[1] ?? "", "src")) continue;
    const script = scriptMatch[2] ?? "";
    const templatePattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:String\.raw\s*)?`([\s\S]*?)`\s*(?:\.trim\(\))?\s*;/g;
    for (const sourceMatch of script.matchAll(templatePattern)) {
      const source = (sourceMatch[2] ?? "").trim();
      if (!source.startsWith("@")) continue;
      sources.push({ name: sourceMatch[1] ?? `source${sources.length + 1}`, source });
    }
  }
  return sources;
}

const runtimePath = await findRuntime(process.cwd());
const { default: Finch, preprocess } = await import(pathToFileURL(runtimePath).href);

let failed = false;
for (const input of inputs) {
  const filePath = path.resolve(input);
  try {
    const html = await readFile(filePath, "utf8");
    const sources = embeddedSources(html);
    if (sources.length === 0) throw new Error("No JavaScript template literal beginning with a Finch.js @directive was found.");

    for (const entry of sources) {
      try {
        Finch.parse(/^\s*!(?:define|let|if|procedure|include(?:_once)?|foreach|while|assert|function)\b/m.test(entry.source) ? preprocess(entry.source) : entry.source);
      } catch (error) {
        throw new Error(`${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log(`OK ${filePath}: ${sources.length} Finch.js source block(s)`);
  } catch (error) {
    failed = true;
    console.error(`ERROR ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) process.exit(1);
