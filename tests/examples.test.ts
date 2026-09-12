import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFinch } from "../src/index";

const examples = [
  { file: "deployment.html", sourceName: "deploymentSource", kind: "deployment", minimumNodes: 15, minimumEdges: 10 },
  { file: "graph.html", sourceName: "graphSource", kind: "graph", minimumNodes: 12, minimumEdges: 7 },
  { file: "sequence.html", sourceName: "sequenceSource", kind: "sequence", minimumNodes: 8, minimumEdges: 14 },
  { file: "flowchart.html", sourceName: "flowchartSource", kind: "flowchart", minimumNodes: 12, minimumEdges: 15 },
  { file: "state.html", sourceName: "stateSource", kind: "state", minimumNodes: 9, minimumEdges: 12 },
  { file: "er.html", sourceName: "erSource", kind: "er", minimumNodes: 7, minimumEdges: 7 },
  { file: "component.html", sourceName: "componentSource", kind: "component", minimumNodes: 16, minimumEdges: 14 },
  { file: "slide.html", sourceName: "slideSource", kind: "slide", minimumNodes: 12, minimumEdges: 2 },
  { file: "slide-story.html", sourceName: "slideStorySource", kind: "slide", minimumNodes: 12, minimumEdges: 2 },
  { file: "slide-patterns.html", sourceName: "kpiSlideSource", kind: "slide", minimumNodes: 7, minimumEdges: 0 },
  { file: "slide-patterns.html", sourceName: "dataSlideSource", kind: "slide", minimumNodes: 7, minimumEdges: 0 },
  { file: "slide-patterns.html", sourceName: "roadmapSlideSource", kind: "slide", minimumNodes: 8, minimumEdges: 3 },
  { file: "slide-patterns.html", sourceName: "quoteSlideSource", kind: "slide", minimumNodes: 8, minimumEdges: 0 },
  { file: "class.html", sourceName: "classSource", kind: "class", minimumNodes: 8, minimumEdges: 8 },
  { file: "usecase.html", sourceName: "useCaseSource", kind: "usecase", minimumNodes: 11, minimumEdges: 10 },
  { file: "activity.html", sourceName: "activitySource", kind: "activity", minimumNodes: 15, minimumEdges: 17 },
];

function readEmbeddedSource(file: string, sourceName: string) {
  const path = fileURLToPath(new URL(`../examples/${file}`, import.meta.url));
  const html = readFileSync(path, "utf8");
  const pattern = new RegExp("const\\s+" + sourceName + "\\s*=\\s*(?:String\\.raw\\s*)?`([\\s\\S]*?)`\\.trim\\(\\);");
  const match = html.match(pattern);
  if (!match) throw new Error(`Could not find ${sourceName} in ${file}`);
  return match[1]!.trim();
}

describe("advanced examples", () => {
  for (const example of examples) {
    it(`parses ${example.sourceName} from ${example.file}`, () => {
      const source = readEmbeddedSource(example.file, example.sourceName);
      const model = createFinch().parse(source);

      expect(model.kind).toBe(example.kind);
      expect(model.nodes.length).toBeGreaterThanOrEqual(example.minimumNodes);
      expect(model.connections.length).toBeGreaterThanOrEqual(example.minimumEdges);
      expect(new Set(model.nodes.map((node) => node.id)).size).toBe(model.nodes.length);
    });
  }
});
