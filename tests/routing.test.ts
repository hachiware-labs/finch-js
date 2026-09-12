// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createFinch } from "../src/index";
import { rerouteGeometry } from "../src/layouts";
import type { Geometry, GeometryEdge, GeometryNode, Point } from "../src/types";

function node(id: string, x: number, y: number, width = 40, height = 40): GeometryNode {
  return { id, label: id, shape: "rect", attributes: {}, x, y, width, height };
}

function edge(id: string, from: string, to: string, order: number): GeometryEdge {
  return { id, from, to, dashed: false, order, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] };
}

function geometry(nodes: GeometryNode[], edges: GeometryEdge[]): Geometry {
  return { kind: "deployment", nodes, edges, groups: [], width: 500, height: 400 };
}

it("leaves a straight approach before an arrow beside a node boundary", () => {
  const source = node("api", 220, 220, 100, 50);
  const target = node("identity", 40, 40, 100, 50);
  const result = geometry([source, target], [edge("verify", "api", "identity", 0)]);
  rerouteGeometry(result);
  const points = simplified(result.edges[0]!.points);
  const end = points[points.length - 1]!;
  const before = points[points.length - 2]!;
  expect(before.y).toBe(end.y);
  expect(before.x - end.x).toBeGreaterThanOrEqual(16);
  expect(crossesNode(points, target)).toBe(false);
});

it("separates container entry and exit while using the same horizontal routing level", () => {
  const docker = node("docker", 100, 20, 80, 40);
  const metrics = node("metrics", 300, 20, 80, 40);
  const cloud = { ...node("cloud", 40, 160, 420, 200), shape: "container" };
  const result = geometry([docker, metrics, cloud], [edge("deploy", "docker", "cloud", 0), edge("logs", "cloud", "metrics", 1)]);
  rerouteGeometry(result);
  const deploy = simplified(result.edges[0]!.points);
  const logs = simplified(result.edges[1]!.points);
  expect(deploy[deploy.length - 1]!.x).not.toBe(logs[0]!.x);
  expect(deploy[1]!.y).toBe(logs[1]!.y);
});

function simplified(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) continue;
    result.push(point);
    while (result.length >= 3) {
      const before = result[result.length - 3]!;
      const middle = result[result.length - 2]!;
      const after = result[result.length - 1]!;
      if (!((before.x === middle.x && middle.x === after.x)
        || (before.y === middle.y && middle.y === after.y))) break;
      result.splice(result.length - 2, 1);
    }
  }
  return result;
}

function crossesNode(points: Point[], obstacle: GeometryNode): boolean {
  return points.slice(1).some((to, index) => {
    const from = points[index]!;
    if (from.x === to.x) {
      return from.x > obstacle.x && from.x < obstacle.x + obstacle.width
        && Math.min(from.y, to.y) < obstacle.y + obstacle.height
        && Math.max(from.y, to.y) > obstacle.y;
    }
    return from.y > obstacle.y && from.y < obstacle.y + obstacle.height
      && Math.min(from.x, to.x) < obstacle.x + obstacle.width
      && Math.max(from.x, to.x) > obstacle.x;
  });
}

function crossingCount(first: Point[], second: Point[]): number {
  let count = 0;
  for (let firstIndex = 1; firstIndex < first.length; firstIndex += 1) {
    const firstFrom = first[firstIndex - 1]!;
    const firstTo = first[firstIndex]!;
    for (let secondIndex = 1; secondIndex < second.length; secondIndex += 1) {
      const secondFrom = second[secondIndex - 1]!;
      const secondTo = second[secondIndex]!;
      if (firstFrom.y === firstTo.y && secondFrom.x === secondTo.x
        && secondFrom.x > Math.min(firstFrom.x, firstTo.x) && secondFrom.x < Math.max(firstFrom.x, firstTo.x)
        && firstFrom.y > Math.min(secondFrom.y, secondTo.y) && firstFrom.y < Math.max(secondFrom.y, secondTo.y)) count += 1;
      if (firstFrom.x === firstTo.x && secondFrom.y === secondTo.y
        && secondFrom.y > Math.min(firstFrom.y, firstTo.y) && secondFrom.y < Math.max(firstFrom.y, firstTo.y)
        && firstFrom.x > Math.min(secondFrom.x, secondTo.x) && firstFrom.x < Math.max(secondFrom.x, secondTo.x)) count += 1;
    }
  }
  return count;
}

describe("smart edge routing", () => {
  it("separates overlapping trunks belonging to unrelated connections", () => {
    const result = geometry([
      node("a", 0, 0), node("b", 300, 200),
      node("c", 0, 100), node("d", 300, 300),
    ], [edge("ab", "a", "b", 0), edge("cd", "c", "d", 1)]);
    rerouteGeometry(result);
    const first = simplified(result.edges[0]!.points);
    const second = simplified(result.edges[1]!.points);
    expect(crossingCount(first, second)).toBe(0);
    for (let i = 1; i < first.length; i += 1) for (let j = 1; j < second.length; j += 1) {
      const a = first[i - 1]!;
      const b = first[i]!;
      const c = second[j - 1]!;
      const d = second[j]!;
      if (a.x === b.x && c.x === d.x && a.x === c.x) {
        expect(Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))).toBeLessThanOrEqual(0);
      }
      if (a.y === b.y && c.y === d.y && a.y === c.y) {
        expect(Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))).toBeLessThanOrEqual(0);
      }
    }
  });

  it("avoids a node and uses the fewest bends among safe routes", () => {
    const source = node("source", 0, 40);
    const obstacle = node("obstacle", 150, 100);
    const target = node("target", 300, 190);
    const result = geometry([source, obstacle, target], [edge("route", "source", "target", 0)]);

    rerouteGeometry(result);

    const route = simplified(result.edges[0]!.points);
    expect(crossesNode(route, obstacle)).toBe(false);
    expect(route.length - 2).toBe(2);
    expect(route[1]!.x).toBeGreaterThan(route[0]!.x);
    expect(route[route.length - 1]!.x).toBeGreaterThan(route[route.length - 2]!.x);
  });

  it("routes a later edge around an earlier edge while preserving arrow headings", () => {
    const result = geometry([
      node("left", 0, 120),
      node("right", 320, 120),
      node("top", 150, 0),
      node("bottom", 150, 260),
    ], [
      edge("horizontal", "left", "right", 0),
      { ...edge("vertical", "top", "bottom", 1), attributes: { routing: "avoid-crossings" } },
    ]);

    rerouteGeometry(result);

    const horizontal = simplified(result.edges[0]!.points);
    const vertical = simplified(result.edges[1]!.points);
    expect(crossingCount(horizontal, vertical)).toBe(0);
    expect(vertical.length - 2).toBe(4);
    expect(vertical[1]!.y).toBeGreaterThan(vertical[0]!.y);
    expect(vertical[vertical.length - 1]!.y).toBeGreaterThan(vertical[vertical.length - 2]!.y);
  });

  it("prefers the shorter route when crossings and bend counts are equal", () => {
    const source = node("source", 0, 40);
    const obstacle = node("obstacle", 150, 55);
    const target = node("target", 300, 40);
    const result = geometry([source, obstacle, target], [edge("route", "source", "target", 0)]);

    rerouteGeometry(result);

    const route = simplified(result.edges[0]!.points);
    expect(crossesNode(route, obstacle)).toBe(false);
    expect(Math.min(...route.map((point) => point.y))).toBeLessThan(obstacle.y);
    expect(Math.max(...route.map((point) => point.y))).toBeLessThan(obstacle.y + obstacle.height);
  });

  it("recalculates the route after a node moves", () => {
    const source = node("source", 0, 40);
    const obstacle = node("obstacle", 150, 240);
    const target = node("target", 300, 40);
    const result = geometry([source, obstacle, target], [edge("route", "source", "target", 0)]);
    rerouteGeometry(result);
    const before = result.edges[0]!.points.map((point) => ({ ...point }));

    obstacle.y = 40;
    rerouteGeometry(result);

    expect(result.edges[0]!.points).not.toEqual(before);
    expect(crossesNode(result.edges[0]!.points, obstacle)).toBe(false);
  });

  it("relaxes preferred spacing when a nearby node leaves only a narrow safe route", () => {
    const source = node("source", 0, 40);
    const nearby = node("nearby", 50, 40);
    const target = node("target", 240, 40);
    const result = geometry([source, nearby, target], [edge("route", "source", "target", 0)]);

    rerouteGeometry(result);

    expect(crossesNode(result.edges[0]!.points, nearby)).toBe(false);
  });

  it("keeps a complete basic route when no safe candidate can leave the source", () => {
    const source = node("source", 0, 40);
    const coveringNode = node("covering", 0, 40);
    const target = node("target", 240, 40);
    const result = geometry([source, coveringNode, target], [edge("route", "source", "target", 0)]);

    rerouteGeometry(result);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.points.length).toBeGreaterThanOrEqual(2);
    expect(result.edges[0]!.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });

  it("uses safe routes on first render, update, and layout import without changing arrow markers", () => {
    document.body.innerHTML = '<div id="diagram"></div>';
    const source = `
@deployment
server source "Source"
server obstacle "Obstacle"
server target "Target"
source -> target
`;
    const overlay = {
      version: 1 as const,
      diagram: "deployment" as const,
      nodes: {
        source: { x: 40, y: 100, manual: true, pinned: false },
        obstacle: { x: 230, y: 100, manual: true, pinned: false },
        target: { x: 420, y: 100, manual: true, pinned: false },
      },
    };
    const instance = createFinch().render(source, { target: "#diagram", overlay });
    const route = () => instance.geometry.edges[0]!.points;
    const obstacle = () => instance.geometry.nodes.find((candidate) => candidate.id === "obstacle")!;
    const assertSafeOrthogonalRoute = () => {
      const points = route();
      const target = instance.geometry.nodes.find((candidate) => candidate.id === "target")!;
      expect(crossesNode(route(), obstacle())).toBe(false);
      expect(points.slice(1).every((point, index) => {
        const previous = points[index]!;
        return previous.x === point.x || previous.y === point.y;
      })).toBe(true);
      expect(points[points.length - 1]!.x).toBe(target.x);
      expect(points[points.length - 2]!.x).toBeLessThan(target.x);
      expect(instance.svg.querySelector('[data-edge-id="source-target-1"]')?.getAttribute("marker-end")).toContain("finch-arrow");
    };

    assertSafeOrthogonalRoute();
    instance.update(source.replace('"Obstacle"', '"Blocking node"'));
    assertSafeOrthogonalRoute();
    const beforeImport = route().map((point) => ({ ...point }));
    instance.importLayout({
      ...overlay,
      nodes: {
        ...overlay.nodes,
        obstacle: { x: 230, y: 260, manual: true, pinned: false },
      },
    });
    expect(route()).not.toEqual(beforeImport);
    assertSafeOrthogonalRoute();
  });
});
