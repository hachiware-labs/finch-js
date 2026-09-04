import { describe, expect, it } from "vitest";
import { parseActivity, parseClass, parseComponent, parseDeployment, parseEr, parseFlowchart, parseSequence, parseSlide, parseState, parseUsecase } from "../src/index";

describe("deployment DSL", () => {
  it("parses nodes, containers, attributes, and relations", () => {
    const model = parseDeployment(`
@deployment
container cloud "Production" {
  server api "API Server"
  database db "PostgreSQL" [tier=data]
}
api -> db: SQL
`);

    expect(model.nodes).toHaveLength(3);
    expect(model.nodes.find((node) => node.id === "api")).toMatchObject({
      label: "API Server",
      shape: "server",
      parentId: "cloud",
    });
    expect(model.nodes.find((node) => node.id === "db")?.attributes).toEqual({ tier: "data" });
    expect(model.connections[0]).toMatchObject({ from: "api", to: "db", label: "SQL", dashed: false });
  });

  it("rejects connections to missing nodes", () => {
    expect(() => parseDeployment("@deployment\nnode api\napi -> missing")).toThrow(/unknown node "missing"/);
  });
});

describe("sequence DSL", () => {
  it("creates implicit participants and preserves message order", () => {
    const model = parseSequence(`
@sequence
User -> API: Request
group Database access
API -> DB: Query
DB --> API: Result
end
API --> User: Response
`);

    expect(model.nodes.map((node) => node.id)).toEqual(["User", "API", "DB"]);
    expect(model.connections.map((edge) => edge.label)).toEqual(["Request", "Query", "Result", "Response"]);
    expect(model.connections[2]?.dashed).toBe(true);
    expect(model.groups[0]).toMatchObject({ kind: "group", label: "Database access", start: 1, end: 2 });
  });

  it("preserves sequence frame kinds", () => {
    const model = parseSequence(`
@sequence
alt Authorized
A -> B: Continue
end
opt Notify
B -> C: Event
end
loop Retry
C -> A: Poll
end
`);

    expect(model.groups.map((group) => group.kind)).toEqual(["alt", "opt", "loop"]);
  });

  it("supports parallel, critical, and break frames", () => {
    const model = parseSequence(`
@sequence
par Notify subscribers
A -> B: Event
end
critical Commit transaction
B -> C: Commit
end
break Authentication failed
C --> A: Reject
end
`);
    expect(model.groups.map((group) => group.kind)).toEqual(["par", "critical", "break"]);
  });
});

describe("flowchart DSL", () => {
  it("maps semantic declarations to flowchart shapes", () => {
    const model = parseFlowchart(`
@flowchart
start begin "Begin"
input request "Read input"
decision valid "Valid?"
process save "Save"
end done "Done"
begin -> request
request -> valid
valid -> save: Yes
save -> done
`);

    expect(model.nodes.map((node) => node.shape)).toEqual(["rounded", "parallelogram", "diamond", "rectangle", "rounded"]);
    expect(model.connections[2]).toMatchObject({ from: "valid", to: "save", label: "Yes" });
  });
});

describe("state DSL", () => {
  it("parses initial, named, and final states with cyclic transitions", () => {
    const model = parseState(`
@state
initial start
state idle "Idle"
state busy "Busy"
final done
start -> idle
idle -> busy: run
busy -> idle: reset
busy -> done: finish
`);

    expect(model.nodes.map((node) => node.shape)).toEqual(["initial-state", "rounded", "rounded", "final-state"]);
    expect(model.nodes[0]?.label).toBe("");
    expect(model.connections).toHaveLength(4);
  });

  it("supports UML choice, fork, join, and history pseudostates", () => {
    const model = parseState(`
@state
state ready "Ready"
choice route
fork split
join merge
history previous
deep-history deep
ready -> route [valid] / dispatch
route -> split
split -> merge
merge -> previous
previous -> deep
`);
    expect(model.nodes.map((node) => node.shape)).toEqual(["rounded", "choice-state", "uml-bar", "uml-bar", "history-state", "deep-history-state"]);
    expect(model.connections[0]?.label).toBe("[valid] / dispatch");
  });

  it("supports junction pseudostates for explicit merges", () => {
    const model = parseState(`
@state
state completed "Completed"
state failed "Failed"
junction finish
final done
completed -> finish
failed -> finish
finish -> done
`);

    expect(model.nodes.find((node) => node.id === "finish")).toMatchObject({ label: "", shape: "junction-state" });
  });

  it("parses explicit transition ports without turning them into labels", () => {
    const model = parseState(`
@state
state idle "Idle"
state busy "Busy"
idle -> busy: run [fromPort=bottom toPort=top]
busy -> idle [from-port=left to-port=right]
`);

    expect(model.connections[0]).toMatchObject({
      label: "run",
      attributes: { fromPort: "bottom", toPort: "top" },
    });
    expect(model.connections[1]).toMatchObject({
      attributes: { fromPort: "left", toPort: "right" },
    });
    expect(model.connections[1]?.label).toBeUndefined();
  });
});

describe("ER DSL", () => {
  it("parses fields, key flags, and relationship cardinalities", () => {
    const model = parseEr(`
@er
entity users "Users" {
  id uuid pk
  email varchar(255) unique
}
entity orders "Orders" {
  id uuid pk
  user_id uuid fk
}
users 1 -> many orders: places
`);

    const fields = JSON.parse(model.nodes[0]?.attributes.fields ?? "[]") as Array<{ name: string; flags: string[] }>;
    expect(fields[0]).toMatchObject({ name: "id", flags: ["pk"] });
    expect(fields[1]).toMatchObject({ name: "email", flags: ["unique"] });
    expect(model.connections[0]?.attributes).toEqual({ fromCardinality: "1", toCardinality: "N" });
  });
});

describe("component DSL", () => {
  it("parses systems, components, externals, and interfaces", () => {
    const model = parseComponent(`
@component
system shop "Shop" {
  component api "API"
  interface events "Events"
}
external stripe "Stripe"
api -> events
api -> stripe
`);

    expect(model.kind).toBe("component");
    expect(model.nodes.map((node) => node.shape)).toEqual(["container", "component", "circle", "external"]);
    expect(model.nodes.find((node) => node.id === "api")?.parentId).toBe("shop");
  });
});

describe("slide DSL", () => {
  it("parses presentation items, layout blocks, and automatic arrows", () => {
    const model = parseSlide(`
@slide
title "Finch.js の価値"
subtitle "テキストから、そのまま使える図へ"
row journey [gap=72] {
  card input "簡単な記法" [badge=INPUT body="短いDSL"]
  arrow: transforms
  card render "自動レイアウト" [tone=accent]
  arrow
  card output "高品質な図"
}
note benefit "必要な箇所だけ調整"
`);

    expect(model.kind).toBe("slide");
    expect(model.nodes.find((node) => node.id === "journey")).toMatchObject({ shape: "slide-group", attributes: expect.objectContaining({ layout: "row", gap: "72" }) });
    expect(model.nodes.find((node) => node.id === "input")).toMatchObject({ parentId: "journey", shape: "slide-card" });
    expect(model.connections.map((edge) => [edge.from, edge.to, edge.label])).toEqual([
      ["input", "render", "transforms"],
      ["render", "output", undefined],
    ]);
  });

  it("parses KPI, data, quotation, and roadmap slide elements", () => {
    const model = parseSlide(`
@slide
metric revenue "$2.4M" [label="Annual revenue" delta="+18% YoY" tone=accent]
bar adoption "Product adoption" [value=72 max=100 suffix="%"]
quote customer "The review now takes minutes." [by="A. Sato" role="Design lead"]
milestone launch "General availability" [period="Q3" step=3 body="Launch and learn"]
`);

    expect(model.nodes.map((node) => node.shape)).toEqual([
      "slide-metric",
      "slide-bar",
      "slide-quote",
      "slide-milestone",
    ]);
    expect(model.nodes[0]?.attributes).toMatchObject({ label: "Annual revenue", delta: "+18% YoY", tone: "accent" });
    expect(model.nodes[1]?.attributes).toMatchObject({ value: "72", max: "100", suffix: "%" });
    expect(model.nodes[2]?.attributes).toMatchObject({ by: "A. Sato", role: "Design lead" });
    expect(model.nodes[3]?.attributes).toMatchObject({ period: "Q3", step: "3" });
  });
});

describe("class DSL", () => {
  it("parses classifiers, members, UML relationships, and multiplicities", () => {
    const model = parseClass(`
@class
interface Payable {
  +authorize(amount: Money): Result
}
class Order {
  -id: UUID
  +submit(): void
}
class Payment {
  -amount: Money
}
Order "1" *-- "1..N" Payment: payments
Payment ..|> Payable
`);
    const members = JSON.parse(model.nodes.find((node) => node.id === "Order")?.attributes.members ?? "[]");
    expect(members).toHaveLength(2);
    expect(model.connections[0]?.attributes).toMatchObject({ relation: "composition", fromCardinality: "1", toCardinality: "1..N" });
    expect(model.connections[1]?.attributes?.relation).toBe("realization");
  });
});

describe("usecase DSL", () => {
  it("parses system boundaries and include, extend, and generalization relations", () => {
    const model = parseUsecase(`
@usecase
actor customer "Customer"
actor admin "Administrator"
system shop "Commerce" {
  usecase checkout "Checkout"
  usecase login "Authenticate"
  usecase coupon "Apply coupon"
}
include checkout -> login
extend coupon -> checkout
generalize admin -> customer
`);
    expect(model.nodes.filter((node) => node.shape === "usecase")).toHaveLength(3);
    expect(model.connections.map((edge) => edge.attributes?.relation)).toEqual(["dependency", "dependency", "inheritance"]);
  });
});

describe("activity DSL", () => {
  it("parses UML actions, fork/join bars, object nodes, and guards", () => {
    const model = parseActivity(`
@activity
start begin
action validate "Validate order"
fork split
object order "Order"
join joined
end done
begin -> validate
validate -> split [valid] / reserve
split -> order
order -> joined
joined -> done
`);
    expect(model.nodes.map((node) => node.shape)).toEqual(["initial-state", "rounded", "uml-bar", "uml-object", "uml-bar", "final-state"]);
    expect(model.connections[1]?.label).toBe("[valid] / reserve");
  });
});
