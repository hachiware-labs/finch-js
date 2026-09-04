// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { pathWithEdgeJumps } from "../src/edge-jumps";
import { SvgRenderer } from "../src/renderer";
import { defaultTheme } from "../src/theme";
import type { Geometry, GeometryEdge, Point } from "../src/types";
import { pathFromPoints } from "../src/utils";

function edge(id: string, points: Point[]): GeometryEdge {
  return { id, from: `${id}-from`, to: `${id}-to`, dashed: false, order: 0, points };
}

describe("edge jumps", () => {
  it("keeps the existing path when no lines cross", () => {
    const upper = edge("upper", [{ x: 10, y: 20 }, { x: 90, y: 20 }]);
    const lower = edge("lower", [{ x: 10, y: 60 }, { x: 90, y: 60 }]);

    expect(pathWithEdgeJumps(upper, [lower])).toBe(pathFromPoints(upper.points));
  });

  it("adds a short arc to the upper line at a crossing", () => {
    const lower = edge("lower", [{ x: 10, y: 50 }, { x: 90, y: 50 }]);
    const upper = edge("upper", [{ x: 50, y: 10 }, { x: 50, y: 90 }]);

    expect(pathWithEdgeJumps(lower, [])).toBe("M 10 50 L 90 50");
    expect(pathWithEdgeJumps(upper, [lower])).toBe("M 50 10 L 50 44 A 6 6 0 0 1 50 56 L 50 90");
  });

  it("ignores shared ends and parallel overlap", () => {
    const upper = edge("upper", [{ x: 10, y: 10 }, { x: 90, y: 10 }]);
    const sharedEnd = edge("shared", [{ x: 50, y: 60 }, { x: 50, y: 10 }]);
    const overlap = edge("overlap", [{ x: 30, y: 10 }, { x: 70, y: 10 }]);

    expect(pathWithEdgeJumps(upper, [sharedEnd, overlap])).toBe(pathFromPoints(upper.points));
  });

  it("finds a crossing through duplicate collinear route points", () => {
    const lower = edge("lower", [
      { x: 10, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 50 },
      { x: 90, y: 50 },
    ]);
    const upper = edge("upper", [
      { x: 50, y: 10 },
      { x: 50, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 90 },
    ]);

    expect(pathWithEdgeJumps(upper, [lower])).toContain("A 6 6 0 0 1");
  });

  it("recalculates jumps when edited routes move", () => {
    const lower = edge("lower", [{ x: 10, y: 50 }, { x: 90, y: 50 }]);
    const upper = edge("upper", [{ x: 50, y: 10 }, { x: 50, y: 90 }]);
    const geometry: Geometry = {
      kind: "deployment",
      nodes: [],
      groups: [],
      edges: [lower, upper],
      width: 100,
      height: 100,
    };
    const renderer = new SvgRenderer(document, defaultTheme, () => {
      throw new Error("No shapes are used in this test.");
    }, "Edge jump test");

    renderer.draw(geometry);
    expect(renderer.svg.querySelector('[data-edge-id="lower"]')?.getAttribute("d")).not.toContain(" A ");
    expect(renderer.svg.querySelector('[data-edge-id="upper"]')?.getAttribute("d")).toContain(" A ");

    lower.points = [{ x: 10, y: 5 }, { x: 90, y: 5 }];
    renderer.updateGeometry(geometry);
    expect(renderer.svg.querySelector('[data-edge-id="upper"]')?.getAttribute("d")).toBe(pathFromPoints(upper.points));
  });
});
