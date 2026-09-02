// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { createTit } from "../src/index";

describe("diagram instance", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="diagram"></div>';
  });

  it("renders an accessible SVG", () => {
    const tit = createTit();
    const instance = tit.render("@deployment\nnode api \"API\"\nnode db \"DB\"\napi -> db", "#diagram");

    expect(instance.svg.getAttribute("role")).toBe("img");
    expect(instance.svg.querySelectorAll(".tit-node")).toHaveLength(2);
    expect(instance.svg.querySelectorAll(".tit-edge")).toHaveLength(1);
    expect(instance.geometry.width).toBeGreaterThan(300);
  });

  it("renders automatic sequence activations and typed frames", () => {
    const tit = createTit();
    const instance = tit.render(`
@sequence
A -> B: Request
opt Database lookup
B -> C: Query
C --> B: Result
end
B --> A: Response
`, "#diagram");

    expect(instance.svg.querySelectorAll(".tit-activation")).toHaveLength(2);
    expect(instance.svg.querySelector(".tit-groups text")?.textContent).toBe("opt · Database lookup");
    const activations = [...instance.svg.querySelectorAll<SVGRectElement>(".tit-activation")];
    expect(activations.every((element) => Number(element.getAttribute("height")) >= 10)).toBe(true);
  });

  it("retains a stable-id position after label and edge changes", () => {
    const tit = createTit();
    const instance = tit.render("@deployment\nnode api \"API\"\nnode db \"DB\"\napi -> db", "#diagram");
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
    const tit = createTit();
    const instance = tit.render("@sequence\nA -> B: hello", "#diagram");
    instance.pin("A");
    const exported = JSON.parse(instance.exportLayout()) as { diagram: string; nodes: Record<string, unknown> };

    expect(exported.diagram).toBe("sequence");
    expect(exported.nodes).toHaveProperty("A");
    instance.resetLayout();
    expect(instance.isPinned("A")).toBe(false);
  });

  it("packs independent container children into a compact grid", () => {
    const tit = createTit();
    const instance = tit.render(`
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
    const tit = createTit();
    const instance = tit.render(`
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

  it("distributes multiple connections across distinct ports", () => {
    const tit = createTit();
    const instance = tit.render(`
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
    const tit = createTit();
    const instance = tit.render(`
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
    const tit = createTit();
    const instance = tit.render(`
@flowchart
start begin "Start"
input read "Read"
decision valid "Valid?"
end done "Done"
begin -> read
read -> valid
valid -> done: Yes
`, "#diagram");

    expect(instance.svg.querySelector('.tit-node[data-node-id="valid"] polygon')).not.toBeNull();
    expect(instance.svg.querySelector('.tit-node[data-node-id="read"] polygon')).not.toBeNull();
    expect(instance.geometry.edges).toHaveLength(3);
  });

  it("keeps cyclic state transitions on multiple ranks", () => {
    const tit = createTit();
    const instance = tit.render(`
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

    expect(instance.svg.querySelectorAll(".tit-node circle").length).toBeGreaterThanOrEqual(3);
    expect(new Set(instance.geometry.nodes.map((node) => node.x)).size).toBeGreaterThan(2);
    expect(instance.geometry.edges).toHaveLength(4);
  });

  it("merges state transitions at one junction port", () => {
    const tit = createTit();
    const instance = tit.render(`
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

  it("renders ER entity rows and relationship cardinalities", () => {
    const tit = createTit();
    const instance = tit.render(`
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

    expect(instance.svg.querySelectorAll('.tit-node[data-node-id="users"] text')).toHaveLength(7);
    expect([...instance.svg.querySelectorAll(".tit-cardinality")].map((node) => node.textContent)).toEqual(["1", "N"]);
    expect(instance.svg.querySelector(".tit-edge-label")?.textContent).toBe("places");
  });

  it("renders component and external system shapes", () => {
    const tit = createTit();
    const instance = tit.render(`
@component
system platform "Platform" {
  component api "Public API"
}
external payments "Payment Provider"
api -> payments: HTTPS
`, "#diagram");

    expect(instance.svg.querySelector('.tit-node[data-node-id="api"] g')).not.toBeNull();
    expect(instance.svg.querySelector('.tit-node[data-node-id="payments"]')?.textContent).toContain("external");
    expect(instance.geometry.nodes.find((node) => node.id === "api")?.parentId).toBe("platform");
  });

  it("renders a presentation slide with compositional layout", () => {
    const tit = createTit();
    const instance = tit.render(`
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
    expect(instance.svg.querySelectorAll(".tit-shape-slide-card")).toHaveLength(3);
    expect(instance.svg.querySelector(".tit-shape-slide-callout")?.textContent).toContain("One source");
    expect(instance.geometry.width).toBeGreaterThanOrEqual(960);
  });

  it("renders common presentation patterns as native slide elements", () => {
    const tit = createTit();
    const instance = tit.render(`
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

    expect(instance.svg.querySelectorAll(".tit-shape-slide-metric")).toHaveLength(2);
    expect(instance.svg.querySelector(".tit-shape-slide-bar")?.textContent).toContain("72%");
    expect(instance.svg.querySelector(".tit-shape-slide-quote")?.textContent).toContain("A. Sato · Design lead");
    expect(instance.svg.querySelectorAll(".tit-shape-slide-milestone")).toHaveLength(2);
    expect(instance.geometry.edges).toHaveLength(1);
  });

  it("renders UML class compartments, multiplicities, and relationship markers", () => {
    const tit = createTit();
    const instance = tit.render(`
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
    expect(instance.svg.querySelectorAll(".tit-shape-uml-class")).toHaveLength(3);
    expect([...instance.svg.querySelectorAll(".tit-cardinality")].map((node) => node.textContent)).toEqual(["1", "1..N"]);
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
    const tit = createTit();
    const instance = tit.render(`
@usecase
actor user "Customer"
system shop "Commerce" {
  usecase browse "Browse catalog"
  usecase checkout "Checkout"
}
include checkout -> browse
user -> checkout
`, "#diagram");
    expect(instance.svg.querySelectorAll(".tit-shape-usecase ellipse")).toHaveLength(2);
    expect(instance.geometry.nodes.find((node) => node.id === "checkout")?.parentId).toBe("shop");
    expect(instance.svg.querySelector(".tit-edge-label")?.textContent).toBe("«include»");
  });

  it("lays out UML activities from top to bottom with parallel branches on one row", () => {
    const tit = createTit();
    const instance = tit.render(`
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
    const tit = createTit();
    const instance = tit.render(`
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
    host.addEventListener("tit:zoomchange", (event) => changes.push((event as CustomEvent<{ zoom: number }>).detail.zoom));
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
