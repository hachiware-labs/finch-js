// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { createFinch } from "../src/index";

describe("diagram instance", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="diagram"></div>';
  });

  it("renders an accessible SVG", () => {
    const finch = createFinch();
    const instance = finch.render("@deployment\nnode api \"API\"\nnode db \"DB\"\napi -> db", "#diagram");

    expect(instance.svg.getAttribute("role")).toBe("img");
    expect(instance.svg.querySelectorAll(".finch-node")).toHaveLength(2);
    expect(instance.svg.querySelectorAll(".finch-edge")).toHaveLength(1);
    expect(instance.geometry.width).toBeGreaterThan(300);
  });

  it("wraps long node labels while keeping short labels unchanged", () => {
    const finch = createFinch();
    const instance = finch.render(`
@deployment
node short "API"
node english "A long service label that should wrap at word boundaries inside the node"
node japanese "表示する場所に合わせて読みやすく折り返すための長い日本語のラベル"
short -> english
english -> japanese
`, "#diagram");

    const short = instance.geometry.nodes.find((node) => node.id === "short")!;
    const english = instance.geometry.nodes.find((node) => node.id === "english")!;
    const japanese = instance.geometry.nodes.find((node) => node.id === "japanese")!;
    const shortText = instance.svg.querySelector<SVGTextElement>('.finch-node[data-node-id="short"] text')!;
    const englishText = instance.svg.querySelector<SVGTextElement>('.finch-node[data-node-id="english"] text')!;
    const japaneseText = instance.svg.querySelector<SVGTextElement>('.finch-node[data-node-id="japanese"] text')!;

    expect({ width: short.width, height: short.height }).toEqual({ width: 104, height: 46 });
    expect(shortText.textContent).toBe("API");
    expect(shortText.querySelector("tspan")).toBeNull();
    expect(english.width).toBeLessThanOrEqual(248);
    expect(japanese.width).toBeLessThanOrEqual(248);
    expect(english.height).toBeGreaterThan(short.height);
    expect(japanese.height).toBeGreaterThan(short.height);
    expect(englishText.querySelectorAll("tspan").length).toBeGreaterThan(1);
    expect(japaneseText.querySelectorAll("tspan").length).toBeGreaterThan(1);
    expect(englishText.textContent).toBe("A long service label that should wrap at word boundaries inside the node");
    expect(japaneseText.textContent).toBe("表示する場所に合わせて読みやすく折り返すための長い日本語のラベル");
    expect(englishText.closest("[data-node-id]")?.getAttribute("data-node-id")).toBe("english");
  });

  it("renders automatic sequence activations and typed frames", () => {
    const finch = createFinch();
    const instance = finch.render(`
@sequence
A -> B: Request
opt Database lookup
B -> C: Query
C --> B: Result
end
B --> A: Response
`, "#diagram");

    expect(instance.svg.querySelectorAll(".finch-activation")).toHaveLength(2);
    expect(instance.svg.querySelector(".finch-groups text")?.textContent).toBe("opt · Database lookup");
    const activations = [...instance.svg.querySelectorAll<SVGRectElement>(".finch-activation")];
    expect(activations.every((element) => Number(element.getAttribute("height")) >= 10)).toBe(true);
  });

  it("retains a stable-id position after label and edge changes", () => {
    const finch = createFinch();
    const instance = finch.render("@deployment\nnode api \"API\"\nnode db \"DB\"\napi -> db", "#diagram");
    const api = instance.geometry.nodes.find((node) => node.id === "api")!;
    instance.importLayout({
      version: 1,
      diagram: "deployment",
      nodes: { api: { x: 321, y: 123, manual: true, pinned: true } },
    });

    instance.update("@deployment\nnode api \"Backend API\"\nnode db \"Database\"\nnode cache \"Redis\"\napi -> cache\ncache -> db");

    const updated = instance.geometry.nodes.find((node) => node.id === "api")!;
    expect({ x: updated.x, y: updated.y }).toEqual({ x: 321, y: 123 });
    expect(updated.width).toBeGreaterThanOrEqual(api.width);
    expect(instance.geometry.nodes.find((node) => node.id === "cache")).toBeDefined();
  });

  it("exports only active layout state and supports reset", () => {
    const finch = createFinch();
    const instance = finch.render("@sequence\nA -> B: hello", "#diagram");
    instance.pin("A");
    const exported = JSON.parse(instance.exportLayout()) as { diagram: string; nodes: Record<string, unknown> };

    expect(exported.diagram).toBe("sequence");
    expect(exported.nodes).toHaveProperty("A");
    instance.resetLayout();
    expect(instance.isPinned("A")).toBe(false);
  });

  it("persists edit mode with the layout overlay and defaults old overlays to editable", () => {
    const finch = createFinch();
    const host = document.querySelector<HTMLElement>("#diagram")!;
    const instance = finch.render('@deployment\nnode api "API"', host);
    let changed: boolean | undefined;
    host.addEventListener("finch:editchange", (event) => {
      changed = (event as CustomEvent<{ editable: boolean }>).detail.editable;
    });

    expect(instance.editable).toBe(true);
    instance.pin("api");
    instance.setEditable(false);
    const saved = instance.exportLayout();
    expect(changed).toBe(false);
    expect(JSON.parse(saved).editable).toBe(false);
    expect(instance.svg.classList.contains("is-view-only")).toBe(true);

    document.body.insertAdjacentHTML("beforeend", '<div id="restored"></div><div id="legacy"></div><div id="configured"></div>');
    const restored = finch.render('@deployment\nnode api "API"', { target: "#restored", overlay: saved });
    const legacy = finch.render('@deployment\nnode api "API"', {
      target: "#legacy",
      overlay: { version: 1, diagram: "deployment", nodes: {} },
    });
    const configured = finch.render('@deployment\nnode api "API"', { target: "#configured", editable: false });
    expect(restored.editable).toBe(false);
    expect(restored.isPinned("api")).toBe(true);
    restored.autoLayout({ preservePinned: false });
    expect(restored.isPinned("api")).toBe(true);
    restored.setZoom(1);
    restored.fit("width");
    expect(restored.zoom).toBe(1);
    expect(legacy.editable).toBe(true);
    expect(configured.editable).toBe(false);
  });

  it("uses a plain left drag to pan instead of editing while edit mode is off", () => {
    const host = document.querySelector<HTMLElement>("#diagram")!;
    host.scrollLeft = 80;
    host.scrollTop = 60;
    const instance = createFinch().render('@deployment\nnode api "API"', host);
    instance.setEditable(false);
    const svg = instance.svg;
    Object.defineProperty(svg, "setPointerCapture", { configurable: true, value: () => undefined });
    Object.defineProperty(svg, "hasPointerCapture", { configurable: true, value: () => true });
    Object.defineProperty(svg, "releasePointerCapture", { configurable: true, value: () => undefined });
    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
      Object.defineProperty(event, "pointerId", { value: 1 });
      return event;
    };

    svg.dispatchEvent(pointer("pointerdown", 100, 100));
    svg.dispatchEvent(pointer("pointermove", 70, 75));
    svg.dispatchEvent(pointer("pointerup", 70, 75));

    expect(host.scrollLeft).toBe(110);
    expect(host.scrollTop).toBe(85);
    expect(instance.overlay.nodes.api).toBeUndefined();
  });

  it("packs independent container children into a compact grid", () => {
    const finch = createFinch();
    const instance = finch.render(`
@deployment
container app "Application" {
  server api "API"
  server worker "Worker"
}
container data "Data" {
  database a "Database A"
  database b "Database B"
  database c "Database C"
  database d "Database D"
  database e "Database E"
  database f "Database F"
  database g "Database G"
}
api -> a
api -> b
api -> c
api -> d
api -> e
api -> f
api -> g
g -> worker
`, "#diagram");

    const data = instance.geometry.nodes.find((node) => node.id === "data")!;
    const app = instance.geometry.nodes.find((node) => node.id === "app")!;
    expect(data.height).toBeLessThanOrEqual(320);
    expect(data.width).toBeGreaterThan(300);
    const overlaps = app.x < data.x + data.width
      && app.x + app.width > data.x
      && app.y < data.y + data.height
      && app.y + app.height > data.y;
    expect(overlaps).toBe(false);
  });

  it("separates sibling blocks inside a nested deployment container", () => {
    const finch = createFinch();
    const instance = finch.render(`
@deployment
container platform "Platform" {
  server runtime "Runtime"
  container ingress "Ingress" {
    server cdn "CDN"
  }
  container services "Services" {
    server orders "Orders"
  }
  container data "Data" {
    database users "Users"
  }
}
runtime -> orders
cdn -> orders
orders -> users
`, "#diagram");

    const siblings = instance.geometry.nodes.filter((node) => node.parentId === "platform");
    for (let index = 0; index < siblings.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < siblings.length; otherIndex += 1) {
        const first = siblings[index]!;
        const second = siblings[otherIndex]!;
        const overlaps = first.x < second.x + second.width
          && first.x + first.width > second.x
          && first.y < second.y + second.height
          && first.y + first.height > second.y;
        expect(overlaps, `${first.id} overlaps ${second.id}`).toBe(false);
      }
    }
  });

  it("expands nested deployment frames while a contained node is dragged", () => {
    const host = document.querySelector<HTMLElement>("#diagram")!;
    const source = `
@deployment
container platform "Production Platform" {
  container edge "Edge Tier" {
    device edgebox "Edge Appliance"
  }
}
`;
    const instance = createFinch().render(source, host);
    const svg = instance.svg;
    Object.defineProperty(svg, "createSVGPoint", {
      configurable: true,
      value: () => ({ x: 0, y: 0, matrixTransform() { return this; } }),
    });
    Object.defineProperty(svg, "getScreenCTM", { configurable: true, value: () => null });
    Object.defineProperty(svg, "setPointerCapture", { configurable: true, value: () => undefined });
    Object.defineProperty(svg, "hasPointerCapture", { configurable: true, value: () => true });
    Object.defineProperty(svg, "releasePointerCapture", { configurable: true, value: () => undefined });
    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
      Object.defineProperty(event, "pointerId", { value: 1 });
      return event;
    };
    const node = (id: string) => instance.geometry.nodes.find((candidate) => candidate.id === id)!;
    const edgeWidth = node("edge").width;
    const platformWidth = node("platform").width;
    let changedIds: string[] = [];
    host.addEventListener("finch:layoutchange", (event) => {
      changedIds = (event as CustomEvent<{ changedNodeIds: string[] }>).detail.changedNodeIds;
    });

    instance.svg.querySelector<SVGGElement>('[data-node-id="edgebox"]')!
      .dispatchEvent(pointer("pointerdown", 100, 100));
    svg.dispatchEvent(pointer("pointermove", 520, 340));

    expect(node("edge").width).toBeGreaterThan(edgeWidth);
    expect(node("platform").width).toBeGreaterThan(platformWidth);
    expect(node("edge").x + node("edge").width).toBeGreaterThanOrEqual(node("edgebox").x + node("edgebox").width + 26);
    expect(node("platform").x + node("platform").width).toBeGreaterThanOrEqual(node("edge").x + node("edge").width + 26);
    const edgeFrame = svg.querySelector<SVGRectElement>('.finch-container[data-node-id="edge"] > rect')!;
    expect(Number(edgeFrame.getAttribute("width"))).toBe(node("edge").width);

    svg.dispatchEvent(pointer("pointerup", 520, 340));
    expect(changedIds).toEqual(expect.arrayContaining(["edgebox", "edge", "platform"]));

    document.body.insertAdjacentHTML("beforeend", '<div id="restored"></div>');
    const restored = createFinch().render(source, { target: "#restored", overlay: instance.exportLayout() });
    const restoredNode = (id: string) => restored.geometry.nodes.find((candidate) => candidate.id === id)!;
    expect(restoredNode("edge").x + restoredNode("edge").width)
      .toBeGreaterThanOrEqual(restoredNode("edgebox").x + restoredNode("edgebox").width + 26);
    expect(restoredNode("platform").x + restoredNode("platform").width)
      .toBeGreaterThanOrEqual(restoredNode("edge").x + restoredNode("edge").width + 26);
  });

  it("honors deployment layout hints without requiring manual coordinates", () => {
    const finch = createFinch();
    const instance = finch.render(`
@deployment
container platform "Platform" [layout=grid columns=2] {
  container ingress "Ingress" [layout=column row=1 column=1] {
    server cdn "CDN" [order=2]
    server gateway "Gateway" [order=1]
  }
  container data "Data" [layout=grid columns=2 row=1 column=2] {
    database users "Users"
    database orders "Orders"
    database cache "Cache"
  }
}
container observe "Observability" [layout=column place=below] {
  server metrics "Metrics"
  server logs "Logs"
}
gateway -> users
platform --> observe: telemetry
`, "#diagram");

    const node = (id: string) => instance.geometry.nodes.find((candidate) => candidate.id === id)!;
    expect(node("cdn").x).toBe(node("gateway").x);
    expect(node("gateway").y).toBeLessThan(node("cdn").y);
    expect(new Set([node("users").x, node("orders").x, node("cache").x]).size).toBe(2);
    expect(new Set([node("users").y, node("orders").y, node("cache").y]).size).toBe(2);
    expect(node("platform").x).toBe(node("observe").x);
    expect(node("platform").y).toBeLessThan(node("observe").y);
  });

  it("distributes multiple connections across distinct ports", () => {
    const finch = createFinch();
    const instance = finch.render(`
@deployment
node mobile "Mobile App"
node admin "Admin Console"
node cdn "CDN"
server waf "WAF"
mobile -> waf: API
admin -> waf: Admin API
cdn -> waf
`, "#diagram");

    const target = instance.geometry.nodes.find((node) => node.id === "waf")!;
    const endpoints = instance.geometry.edges.map((edge) => edge.points[edge.points.length - 1]!);
    expect(new Set(endpoints.map((point) => point.y)).size).toBe(3);
    expect(endpoints.every((point) => point.x === target.x)).toBe(true);
    expect(endpoints.every((point) => point.y > target.y && point.y < target.y + target.height)).toBe(true);
  });

  it("bundles fan-out edges into one visible trunk", () => {
    const finch = createFinch();
    const instance = finch.render(`
@deployment
server gateway "API Gateway"
server auth "Auth Service"
server catalog "Catalog Service"
server order "Order Service"
gateway -> auth
gateway -> catalog
gateway -> order
`, "#diagram");

    const starts = instance.geometry.edges.map((edge) => edge.points[0]!);
    const trunks = instance.geometry.edges.map((edge) => edge.points[1]!);
    expect(new Set(starts.map((point) => `${point.x},${point.y}`)).size).toBe(1);
    expect(new Set(trunks.map((point) => point.x)).size).toBe(1);
    expect(trunks[0]!.x).toBeGreaterThan(starts[0]!.x);
  });

  it("renders flowchart decision and input-output shapes", () => {
    const finch = createFinch();
    const instance = finch.render(`
@flowchart
start begin "Start"
input read "Read"
decision valid "Valid?"
end done "Done"
begin -> read
read -> valid
valid -> done: Yes
`, "#diagram");

    expect(instance.svg.querySelector('.finch-node[data-node-id="valid"] polygon')).not.toBeNull();
    expect(instance.svg.querySelector('.finch-node[data-node-id="read"] polygon')).not.toBeNull();
    expect(instance.geometry.edges).toHaveLength(3);
  });

  it("lays out flowcharts from top to bottom and keeps branches on one row", () => {
    const finch = createFinch();
    const instance = finch.render(`
@flowchart
start begin "Start"
process prepare "Prepare"
decision valid "Valid?"
process accept "Accept"
process reject "Reject"
end done "Done"
begin -> prepare
prepare -> valid
valid -> accept: Yes
valid -> reject: No
accept -> done
reject -> done
`, "#diagram");

    const node = (id: string) => instance.geometry.nodes.find((candidate) => candidate.id === id)!;
    const centerX = (id: string) => node(id).x + node(id).width / 2;
    expect(node("begin").y).toBeLessThan(node("prepare").y);
    expect(node("prepare").y).toBeLessThan(node("valid").y);
    expect(node("accept").y).toBe(node("reject").y);
    expect(node("valid").y).toBeLessThan(node("accept").y);
    expect(node("accept").y).toBeLessThan(node("done").y);
    expect(centerX("begin")).toBe(centerX("prepare"));
    expect(instance.geometry.height).toBeGreaterThan(instance.geometry.width);
  });

  it("keeps cyclic state transitions on multiple ranks", () => {
    const finch = createFinch();
    const instance = finch.render(`
@state
initial start
state idle "Idle"
state busy "Busy"
final done
start -> idle
idle -> busy: run
busy -> idle: reset
busy -> done: finish
`, "#diagram");

    expect(instance.svg.querySelectorAll(".finch-node circle").length).toBeGreaterThanOrEqual(3);
    expect(new Set(instance.geometry.nodes.map((node) => node.x)).size).toBeGreaterThan(2);
    expect(instance.geometry.edges).toHaveLength(4);
  });

  it("merges state transitions at one junction port", () => {
    const finch = createFinch();
    const instance = finch.render(`
@state
state completed "Completed"
state failed "Failed"
junction finish
final done
completed -> finish
failed -> finish
finish -> done
`, "#diagram");

    const incoming = instance.geometry.edges.filter((edge) => edge.to === "finish");
    const endpoints = incoming.map((edge) => edge.points[edge.points.length - 1]!);
    expect(incoming).toHaveLength(2);
    expect(new Set(endpoints.map((point) => `${point.x},${point.y}`)).size).toBe(1);
    expect(instance.geometry.edges.filter((edge) => edge.from === "finish")).toHaveLength(1);
  });

  it("stacks state fork and join sections vertically", () => {
    const finch = createFinch();
    const instance = finch.render(`
@state
state ready "Ready"
fork split
state audit "Write audit log"
state archive "Archive outcome"
join merged
final done
ready -> split
split -> audit
split -> archive
audit -> merged
archive -> merged
merged -> done
`, "#diagram");

    const node = (id: string) => instance.geometry.nodes.find((candidate) => candidate.id === id)!;
    const centerX = (id: string) => node(id).x + node(id).width / 2;
    expect(node("split").y).toBeLessThan(node("audit").y);
    expect(node("ready").y).toBeLessThan(node("split").y);
    expect(node("audit").y).toBe(node("archive").y);
    expect(node("audit").y).toBeLessThan(node("merged").y);
    expect(node("merged").y).toBeLessThan(node("done").y);
    expect(centerX("split")).toBe(centerX("merged"));
    expect(centerX("merged")).toBe(centerX("done"));
    expect(centerX("ready")).toBe(centerX("split"));
  });

  it("renders ER entity rows and relationship cardinalities", () => {
    const finch = createFinch();
    const instance = finch.render(`
@er
entity users "Users" {
  id uuid pk
  email varchar unique
}
entity orders "Orders" {
  id uuid pk
  user_id uuid fk
}
users 1 -> many orders: places
`, "#diagram");

    expect(instance.svg.querySelectorAll('.finch-node[data-node-id="users"] text')).toHaveLength(7);
    expect([...instance.svg.querySelectorAll(".finch-cardinality")].map((node) => node.textContent)).toEqual(["1", "N"]);
    expect(instance.svg.querySelector(".finch-edge-label")?.textContent).toBe("places");
  });

  it("renders component and external system shapes", () => {
    const finch = createFinch();
    const instance = finch.render(`
@component
system platform "Platform" {
  component api "Public API"
}
external payments "Payment Provider"
api -> payments: HTTPS
`, "#diagram");

    expect(instance.svg.querySelector('.finch-node[data-node-id="api"] g')).not.toBeNull();
    expect(instance.svg.querySelector('.finch-node[data-node-id="payments"]')?.textContent).toContain("external");
    expect(instance.geometry.nodes.find((node) => node.id === "api")?.parentId).toBe("platform");
  });

  it("renders a presentation slide with compositional layout", () => {
    const finch = createFinch();
    const instance = finch.render(`
@slide
title "From text to presentation"
subtitle "A concise visual story"
row journey {
  card input "Write" [body="Describe the idea" badge=STEP-1]
  arrow
  card layout "Arrange" [body="Compose automatically" tone=accent]
  arrow
  card share "Present" [body="Export an editable SVG"]
}
callout result "One source, one clear story" [body="Keep the structure readable and the details editable."]
`, "#diagram");

    const cards = instance.geometry.nodes.filter((node) => node.shape === "slide-card");
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((node) => node.y)).size).toBe(1);
    expect(instance.geometry.edges).toHaveLength(2);
    expect(instance.svg.querySelectorAll(".finch-shape-slide-card")).toHaveLength(3);
    expect(instance.svg.querySelector(".finch-shape-slide-callout")?.textContent).toContain("One source");
    expect(instance.geometry.width).toBeGreaterThanOrEqual(960);
  });

  it("renders common presentation patterns as native slide elements", () => {
    const finch = createFinch();
    const instance = finch.render(`
@slide
row metrics {
  metric revenue "$2.4M" [label="Annual revenue" delta="+18% YoY" tone=accent]
  metric teams "124" [label="Active teams" delta="+31 this quarter"]
}
column evidence {
  bar adoption "Product adoption" [value=72 max=100 suffix="%"]
  quote customer "The review now takes minutes." [by="A. Sato" role="Design lead"]
}
row roadmap {
  milestone pilot "Pilot" [period="Q1" step=1 body="Validate demand"]
  arrow
  milestone launch "Launch" [period="Q2" step=2 body="Scale adoption"]
}
`, "#diagram");

    expect(instance.svg.querySelectorAll(".finch-shape-slide-metric")).toHaveLength(2);
    expect(instance.svg.querySelector(".finch-shape-slide-bar")?.textContent).toContain("72%");
    expect(instance.svg.querySelector(".finch-shape-slide-quote")?.textContent).toContain("A. Sato · Design lead");
    expect(instance.svg.querySelectorAll(".finch-shape-slide-milestone")).toHaveLength(2);
    expect(instance.geometry.edges).toHaveLength(1);
  });

  it("renders UML class compartments, multiplicities, and relationship markers", () => {
    const finch = createFinch();
    const instance = finch.render(`
@class
interface Repository {
  +save(order: Order): void
}
class Order {
  -id: UUID
  +submit(): void
}
class LineItem {
  -quantity: int
}
Order "1" *-- "1..N" LineItem
Order ..|> Repository
`, "#diagram");
    expect(instance.svg.querySelectorAll(".finch-shape-uml-class")).toHaveLength(3);
    expect([...instance.svg.querySelectorAll(".finch-cardinality")].map((node) => node.textContent)).toEqual(["1", "1..N"]);
    expect(instance.svg.querySelector('[data-edge-id="Order-LineItem-1"]')?.getAttribute("marker-start")).toContain("diamond-filled");
    expect(instance.svg.querySelector('[data-edge-id="Order-Repository-2"]')?.getAttribute("marker-end")).toContain("triangle");
    const repository = instance.geometry.nodes.find((node) => node.id === "Repository")!;
    const order = instance.geometry.nodes.find((node) => node.id === "Order")!;
    const lineItem = instance.geometry.nodes.find((node) => node.id === "LineItem")!;
    expect(repository.y).toBeLessThan(order.y);
    expect(order.y).toBeLessThan(lineItem.y);
    expect(instance.geometry.height).toBeGreaterThan(instance.geometry.width);
  });

  it("renders use cases inside a system boundary", () => {
    const finch = createFinch();
    const instance = finch.render(`
@usecase
actor user "Customer"
system shop "Commerce" {
  usecase browse "Browse catalog"
  usecase checkout "Checkout"
}
include checkout -> browse
user -> checkout
`, "#diagram");
    expect(instance.svg.querySelectorAll(".finch-shape-usecase ellipse")).toHaveLength(2);
    expect(instance.geometry.nodes.find((node) => node.id === "checkout")?.parentId).toBe("shop");
    expect(instance.svg.querySelector(".finch-edge-label")?.textContent).toBe("«include»");
  });

  it("lays out UML activities from top to bottom with parallel branches on one row", () => {
    const finch = createFinch();
    const instance = finch.render(`
@activity
start begin
action validate "Validate"
fork split
action reserve "Reserve inventory"
action score "Fraud check"
join merged
action finish "Complete"
end done
begin -> validate
validate -> split
split -> reserve
split -> score
reserve -> merged
score -> merged
merged -> finish
finish -> done
`, "#diagram");
    const reserve = instance.geometry.nodes.find((node) => node.id === "reserve")!;
    const score = instance.geometry.nodes.find((node) => node.id === "score")!;
    expect(reserve.y).toBe(score.y);
    expect(instance.geometry.height).toBeGreaterThan(instance.geometry.width);
    expect(instance.geometry.edges.every((edge) => edge.points[0]?.y !== undefined && edge.points[edge.points.length - 1]?.y !== undefined)).toBe(true);
  });

  it("keeps viewport zoom separate from geometry and supports fitting", () => {
    const host = document.querySelector<HTMLElement>("#diagram")!;
    Object.defineProperty(host, "clientWidth", { configurable: true, value: 420 });
    Object.defineProperty(host, "clientHeight", { configurable: true, value: 300 });
    const finch = createFinch();
    const instance = finch.render(`
@deployment
node web "Web"
node api "API"
node worker "Worker"
node db "Database"
web -> api
api -> worker
worker -> db
`, host);

    expect(instance.zoom).toBeLessThanOrEqual(1);
    expect(Number.parseFloat(instance.svg.style.width)).toBeCloseTo(instance.geometry.width * instance.zoom);
    const changes: number[] = [];
    host.addEventListener("finch:zoomchange", (event) => changes.push((event as CustomEvent<{ zoom: number }>).detail.zoom));
    instance.setZoom(1.5);
    expect(instance.zoom).toBe(1.5);
    expect(instance.geometry.width).toBeGreaterThan(0);
    instance.zoomIn();
    instance.zoomOut();
    instance.fit("width");
    expect(instance.zoom).toBeCloseTo(420 / instance.geometry.width);
    instance.fit("diagram");
    expect(instance.zoom).toBeCloseTo(Math.min(420 / instance.geometry.width, 300 / instance.geometry.height));
    instance.setZoom(99);
    expect(instance.zoom).toBe(2);
    instance.resetZoom();
    expect(instance.zoom).toBe(1);
    expect(changes.length).toBeGreaterThanOrEqual(6);
  });
});
