import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createTit } from "../src/index";

const examples = [
  { file: "deployment-advanced.tit", kind: "deployment", minimumNodes: 15, minimumEdges: 10 },
  { file: "sequence-advanced.tit", kind: "sequence", minimumNodes: 8, minimumEdges: 14 },
  { file: "flowchart-advanced.tit", kind: "flowchart", minimumNodes: 12, minimumEdges: 15 },
  { file: "state-advanced.tit", kind: "state", minimumNodes: 9, minimumEdges: 12 },
  { file: "er-advanced.tit", kind: "er", minimumNodes: 7, minimumEdges: 7 },
  { file: "component-advanced.tit", kind: "component", minimumNodes: 16, minimumEdges: 14 },
  { file: "slide-advanced.tit", kind: "slide", minimumNodes: 12, minimumEdges: 2 },
  { file: "slide-story.tit", kind: "slide", minimumNodes: 12, minimumEdges: 2 },
  { file: "slide-kpi.tit", kind: "slide", minimumNodes: 7, minimumEdges: 0 },
  { file: "slide-data.tit", kind: "slide", minimumNodes: 7, minimumEdges: 0 },
  { file: "slide-roadmap.tit", kind: "slide", minimumNodes: 8, minimumEdges: 3 },
  { file: "slide-quote.tit", kind: "slide", minimumNodes: 8, minimumEdges: 0 },
  { file: "class-advanced.tit", kind: "class", minimumNodes: 8, minimumEdges: 8 },
  { file: "usecase-advanced.tit", kind: "usecase", minimumNodes: 11, minimumEdges: 10 },
  { file: "activity-advanced.tit", kind: "activity", minimumNodes: 15, minimumEdges: 17 },
];

describe("advanced examples", () => {
  for (const example of examples) {
    it(`parses ${example.file}`, () => {
      const path = fileURLToPath(new URL(`../examples/${example.file}`, import.meta.url));
      const source = readFileSync(path, "utf8");
      const model = createTit().parse(source);

      expect(model.kind).toBe(example.kind);
      expect(model.nodes.length).toBeGreaterThanOrEqual(example.minimumNodes);
      expect(model.connections.length).toBeGreaterThanOrEqual(example.minimumEdges);
      expect(new Set(model.nodes.map((node) => node.id)).size).toBe(model.nodes.length);
    });
  }
});
