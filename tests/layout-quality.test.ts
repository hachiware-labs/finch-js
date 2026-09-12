// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { createFinch } from "../src/index";
import { placeEdgeLabels, textBounds, estimatedTextWidth } from "../src/edge-labels";
import { rerouteGeometry } from "../src/layouts";
import { SvgRenderer } from "../src/renderer";
import { defaultTheme } from "../src/theme";
import { builtInShapes } from "../src/shapes";
import type { Bounds, Geometry, GeometryNode } from "../src/types";

const centerX = (node: GeometryNode) => node.x + node.width / 2;
const overlaps = (a: Bounds, b: Bounds) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const source = `@flowchart
start start "Start"
decision check "Continue?"
process review "Manual review"
process execute "Execute"
end done "Done"
start -> check
check -> review: Review
check -> execute: Yes
review -> execute
execute -> done
review -> check: Retry`;

function render(value: string) {
  return createFinch().render(value, { target: "#diagram", editor: false });
}

function expectContained(geometry: Geometry, bounds: Bounds) {
  const origin = geometry.origin ?? { x: 0, y: 0 };
  expect(bounds.x).toBeGreaterThanOrEqual(origin.x);
  expect(bounds.y).toBeGreaterThanOrEqual(origin.y);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(origin.x + geometry.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(origin.y + geometry.height);
}

describe("automatic layout quality", () => {
  beforeEach(() => { document.body.innerHTML = '<div id="diagram"></div>'; });

  it("encloses nested sequence messages and separates frame headers", () => {
    const instance = render(`@sequence
participant a "Client"
participant b "Service"
group Outer
 loop Inner
  a -> b: Request
  b -> b: Self call
 end
 b --> a: Response
end
opt Later
 a -> b: Follow up
end`);
    const [outer, inner, later] = instance.geometry.groups;
    expect(inner!.y).toBeGreaterThan(outer!.y + outer!.headerHeight!);
    expect(inner!.y + inner!.height).toBeLessThan(outer!.y + outer!.height);
    expect(later!.y).toBeGreaterThan(outer!.y + outer!.height);
    for (const edge of instance.geometry.edges.slice(0, 3)) {
      for (const point of edge.points) {
        expect(point.y).toBeGreaterThan(outer!.y + outer!.headerHeight!);
        expect(point.y).toBeLessThan(outer!.y + outer!.height);
      }
    }
  });

  it("centers unequal deployment children and keeps vertical connections straight", () => {
    const instance = render(`@deployment
container platform "Platform" [layout=row] {
 container requests "Requests" [layout=column] {
  node cdn "CDN"
  node gateway "Application gateway"
  node api "API"
 }
}
cdn -> gateway
gateway -> api`);
    const nodes = ["cdn", "gateway", "api"].map(id => instance.geometry.nodes.find(node => node.id === id)!);
    expect(nodes[0]!.width).not.toEqual(nodes[1]!.width);
    for (const node of nodes) expect(centerX(node)).toBeCloseTo(centerX(nodes[0]!));
    for (const edge of instance.geometry.edges) {
      for (const point of edge.points) expect(point.x).toBeCloseTo(centerX(nodes[0]!));
    }
    const before = instance.geometry.nodes.map(({ id, x, y }) => ({ id, x, y }));
    instance.autoLayout();
    expect(instance.geometry.nodes.map(({ id, x, y }) => ({ id, x, y }))).toEqual(before);
  });

  it("keeps an aligned deployment arrival centered alongside another incoming edge", () => {
    const instance = render(`@deployment
container requests "Requests" [layout=column] {
 node first "First"
 node second "Second, wider"
}
node other "Other"
first -> second
other -> second`);
    const first = instance.geometry.nodes.find(node => node.id === "first")!;
    const edge = instance.geometry.edges.find(edge => edge.from === "first")!;
    for (const point of edge.points) expect(point.x).toBeCloseTo(centerX(first));
  });

  it("removes avoidable crossings caused by reversed declarations", () => {
    const instance = render(`@flowchart
process a "A"
process b "B"
process d "D"
process c "C"
a -> c
b -> d`);
    const node = (id: string) => instance.geometry.nodes.find((item) => item.id === id)!;
    expect((centerX(node("a")) - centerX(node("b"))) * (centerX(node("c")) - centerX(node("d")))).toBeGreaterThan(0);
    const before = instance.geometry.nodes.map(({ id, x, y }) => ({ id, x, y }));
    instance.autoLayout();
    expect(instance.geometry.nodes.map(({ id, x, y }) => ({ id, x, y }))).toEqual(before);
  });

  it("respects explicit order even when it prevents crossing reduction", () => {
    const instance = render(`@flowchart
process a "A" [order=1]
process b "B" [order=2]
process d "D" [order=1]
process c "C" [order=2]
a -> c
b -> d`);
    const node = (id: string) => instance.geometry.nodes.find((item) => item.id === id)!;
    expect(centerX(node("a"))).toBeLessThan(centerX(node("b")));
    expect(centerX(node("d"))).toBeLessThan(centerX(node("c")));
  });

  it("keeps the normal path straight and reserves its bypass corridor", () => {
    const instance = render(source);
    const node = (id: string) => instance.geometry.nodes.find((item) => item.id === id)!;
    const axis = centerX(node("start"));
    for (const id of ["check", "execute", "done"]) expect(centerX(node(id))).toBeCloseTo(axis);
    const review = node("review");
    expect(review.x + review.width < axis || review.x > axis).toBe(true);
    const bypass = instance.geometry.edges.find((edge) => edge.from === "check" && edge.to === "execute")!;
    expect(bypass.points.every((point) => Math.abs(point.x - axis) < 0.5)).toBe(true);
    for (const a of instance.geometry.nodes) for (const b of instance.geometry.nodes) {
      if (a.id !== b.id) expect(overlaps(a, b)).toBe(false);
    }
  });

  it("allows main=true to choose a branch instead of a positive guard", () => {
    const instance = render(source.replace('process review "Manual review"', 'process review "Manual review" [main=true]'));
    const node = (id: string) => instance.geometry.nodes.find((item) => item.id === id)!;
    expect(centerX(node("review"))).toBeCloseTo(centerX(node("check")));
  });

  it("preserves negative pinned coordinates across update, layout, and export", () => {
    const instance = createFinch().render(source, {
      target: "#diagram", editor: false,
      overlay: { version: 1, nodes: { review: { x: -190, y: -75, manual: true, pinned: true } } },
    });
    instance.update(source.replace('"Manual review"', '"審査をやり直す"'));
    instance.autoLayout();
    expect(instance.geometry.nodes.find((node) => node.id === "review")).toMatchObject({ x: -190, y: -75 });
    expect(instance.overlay.nodes.review).toMatchObject({ x: -190, y: -75, pinned: true });
    expect(instance.geometry.origin!.x).toBeLessThan(-190);
    expect(instance.geometry.origin!.y).toBeLessThan(-75);
    expect(instance.toSvgString()).toContain(`viewBox="${instance.svg.getAttribute("viewBox")}"`);
    for (const node of instance.geometry.nodes) expectContained(instance.geometry, node);
    for (const edge of instance.geometry.edges) for (const point of edge.points) expectContained(instance.geometry, { ...point, width: 0, height: 0 });
    const restored = createFinch().render(instance.source, { editor: false, overlay: instance.exportLayout() });
    expect(restored.geometry.nodes.find((node) => node.id === "review")).toMatchObject({ x: -190, y: -75 });
  });

  it("positions branch labels near their source without covering nodes or labels", () => {
    const instance = render(source);
    const placements = placeEdgeLabels(instance.geometry, 12).labels;
    for (const [id, label] of placements) {
      expectContained(instance.geometry, label);
      for (const node of instance.geometry.nodes) expect(overlaps(label, node)).toBe(false);
      for (const [otherId, other] of placements) if (id !== otherId) expect(overlaps(label, other)).toBe(false);
    }
    const edge = instance.geometry.edges.find((item) => item.label === "Yes")!;
    const label = placements.get(edge.id)!;
    expect(label.point.y - edge.points[0]!.y).toBeLessThan(70);
  });

  it("contains long Japanese labels on exterior routes", () => {
    const instance = render(source.replace("Retry", "入力内容を確認してから処理を再試行する"));
    for (const label of instance.svg.querySelectorAll<SVGTextElement>(".finch-edge-label")) {
      const point = { x: Number(label.getAttribute("x")), y: Number(label.getAttribute("y")) };
      expectContained(instance.geometry, textBounds(point, estimatedTextWidth(label.textContent!, 12), 12));
    }
  });

  it("reserves horizontal label space inside a container", () => {
    const instance = render(`@graph direction=LR
group store "Storefront" {
  web "Web app"
  gateway "API gateway"
}
web -> gateway: HTTPS authorization`);
    const labels = placeEdgeLabels(instance.geometry, 12).labels;
    for (const label of labels.values()) {
      for (const node of instance.geometry.nodes.filter((item) => item.shape !== "container")) expect(overlaps(label, node)).toBe(false);
    }
  });

  it("recomputes labels and contracts the viewport after a dragged node returns", () => {
    const instance = render(source);
    const geometry = instance.geometry;
    const renderer = new SvgRenderer(document, defaultTheme, (name) => builtInShapes.find((shape) => shape.name === name)!, "test");
    renderer.draw(geometry);
    const node = geometry.nodes.find((item) => item.id === "review")!;
    const before = { x: node.x, y: node.y, width: geometry.width, height: geometry.height };
    node.x = -800;
    rerouteGeometry(geometry);
    renderer.updateGeometry(geometry);
    expect(geometry.width).toBeGreaterThan(before.width);
    node.x = before.x;
    node.y = before.y;
    rerouteGeometry(geometry);
    renderer.updateGeometry(geometry);
    expect(geometry.width).toBeCloseTo(before.width);
    expect(geometry.height).toBeCloseTo(before.height);
  });

  it("does not expand a sequence viewport on repeated reroutes", () => {
    const instance = render('@sequence\nparticipant a "A"\nparticipant b "B"\na -> b: A long message for the other participant');
    const renderer = new SvgRenderer(document, defaultTheme, (name) => builtInShapes.find((shape) => shape.name === name)!, "test");
    renderer.draw(instance.geometry);
    const width = instance.geometry.width;
    const height = instance.geometry.height;
    for (let i = 0; i < 3; i += 1) {
      rerouteGeometry(instance.geometry);
      renderer.updateGeometry(instance.geometry);
    }
    expect(instance.geometry.width).toBe(width);
    expect(instance.geometry.height).toBe(height);
  });
});


it('keeps disconnected class associations in separate compact blocks',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=render('@class\nA -- B\nC -- D\nE -- F\nG -- H');
 const nodes=instance.geometry.nodes;
 const blocks=[];
 for(const [from,to] of [['A','B'],['C','D'],['E','F'],['G','H']]){
  const a=nodes.find(n=>n.id===from)!,b=nodes.find(n=>n.id===to)!;
  expect(centerX(a)).toBeCloseTo(centerX(b));
  expect(b.y-a.y-a.height).toBeLessThanOrEqual(68);
  blocks.push({x:a.x,y:a.y,width:Math.max(a.width,b.width),height:b.y+b.height-a.y});
  const edge=instance.geometry.edges.find(e=>e.from===from && e.to===to)!;
  expect(edge.points.every(p=>Math.abs(p.x-centerX(a))<1)).toBe(true);
 }
 for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++)expect(overlaps(blocks[i]!,blocks[j]!)).toBe(false);
 instance.destroy();
});
