import type { DiagramPlugin, SemanticConnection, SemanticGroup, SemanticModel, SemanticNode } from "./types.js";
import { uniqueId } from "./utils.js";

function meaningfulLines(source: string): Array<{ text: string; number: number }> {
  return source.split(/\r?\n/).map((line, index) => ({
    text: line.replace(/\s+(?:#|\/\/).*$/, "").trim(),
    number: index + 1,
  })).filter((line) => line.text && !line.text.startsWith("'"));
}

function header(source: string): string {
  const first = meaningfulLines(source)[0]?.text;
  if (!first?.startsWith("@")) throw new Error("Tit.js source must begin with a diagram directive such as @deployment or @sequence.");
  return first.slice(1).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function unquote(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1).replace(/\\"/g, '"') : value;
}

function attributesFrom(value: string | undefined): Record<string, string> {
  if (!value) return {};
  const attributes: Record<string, string> = {};
  for (const match of value.matchAll(/([\w-]+)\s*=\s*("(?:\\.|[^"])*"|[^\s\]]+)/g)) {
    const key = match[1];
    if (key) attributes[key] = unquote(match[2], "");
  }
  return attributes;
}

function assertUnique(nodes: SemanticNode[], node: SemanticNode, line: number): void {
  if (nodes.some((existing) => existing.id === node.id)) throw new Error(`Line ${line}: duplicate node id "${node.id}".`);
}

function connectionId(from: string, to: string, index: number): string {
  return `${from}-${to}-${index + 1}`;
}

export function getDiagramKind(source: string): string {
  return header(source);
}

export function parseDeployment(source: string): SemanticModel {
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  const containerStack: string[] = [];

  for (const line of lines.slice(1)) {
    if (line.text === "}") {
      if (!containerStack.pop()) throw new Error(`Line ${line.number}: unexpected closing brace.`);
      continue;
    }

    const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|\.\.>)\s+([\w.-]+)(?:\s*:\s*(.+))?$/);
    if (relation) {
      const from = relation[1] ?? "";
      const arrow = relation[2] ?? "->";
      const to = relation[3] ?? "";
      connections.push({
        id: connectionId(from, to, connections.length),
        from,
        to,
        ...(relation[4]?.trim() ? { label: unquote(relation[4].trim(), "") } : {}),
        dashed: arrow.includes("--") || arrow.includes(".."),
        order: connections.length,
      });
      continue;
    }

    const containment = line.text.match(/^([\w.-]+)\s+(?:in|inside)\s+([\w.-]+)$/);
    if (containment) {
      const node = nodes.find((candidate) => candidate.id === containment[1]);
      if (!node) throw new Error(`Line ${line.number}: unknown node "${containment[1]}".`);
      node.parentId = containment[2] ?? "";
      continue;
    }

    const contains = line.text.match(/^([\w.-]+)\s+contains\s+(.+)$/);
    if (contains) {
      for (const id of (contains[2] ?? "").split(/[\s,]+/).filter(Boolean)) {
        const node = nodes.find((candidate) => candidate.id === id);
        if (!node) throw new Error(`Line ${line.number}: unknown node "${id}".`);
        node.parentId = contains[1] ?? "";
      }
      continue;
    }

    const declaration = line.text.match(/^(node|server|database|container|actor|rounded|system|component|external|interface|usecase|device|execution|artifact|package|port|provided|required|queue|cloud)\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s\[\{]+))?(?:\s*\[([^\]]+)\])?\s*(\{)?$/);
    if (declaration) {
      const keyword = declaration[1] ?? "node";
      const id = declaration[2] ?? "";
      const attributes = attributesFrom(declaration[4]);
      const defaultShape: Record<string, string> = {
        node: "rectangle",
        system: "container",
        component: "component",
        external: "external",
        interface: "circle",
        usecase: "usecase",
        device: "uml-device",
        execution: "uml-execution",
        artifact: "uml-artifact",
        package: "container",
        port: "uml-port",
        provided: "circle",
        required: "uml-required-interface",
        queue: "database",
        cloud: "external",
      };
      const shape = attributes.shape ?? defaultShape[keyword] ?? keyword;
      delete attributes.shape;
      const activeContainer = containerStack[containerStack.length - 1];
      const node: SemanticNode = {
        id,
        label: unquote(declaration[3], id),
        shape,
        ...(activeContainer ? { parentId: activeContainer } : {}),
        attributes,
      };
      assertUnique(nodes, node, line.number);
      nodes.push(node);
      if (declaration[5]) {
        if (shape !== "container") throw new Error(`Line ${line.number}: only containers can open a block.`);
        containerStack.push(id);
      }
      continue;
    }

    throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
  }

  if (containerStack.length) throw new Error(`Container "${containerStack[containerStack.length - 1]}" is missing a closing brace.`);
  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of connections) {
    if (!ids.has(edge.from)) throw new Error(`Connection references unknown node "${edge.from}".`);
    if (!ids.has(edge.to)) throw new Error(`Connection references unknown node "${edge.to}".`);
  }
  for (const node of nodes) if (node.parentId && !ids.has(node.parentId)) throw new Error(`Node "${node.id}" references unknown container "${node.parentId}".`);

  return { kind: "deployment", nodes, connections, groups: [], source };
}

export function parseSequence(source: string): SemanticModel {
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  const groups: SemanticGroup[] = [];
  const openGroups: SemanticGroup[] = [];

  const ensureParticipant = (id: string, label = id, shape = "rectangle", line = 0): SemanticNode => {
    const existing = nodes.find((node) => node.id === id);
    if (existing) return existing;
    const node: SemanticNode = { id, label, shape, attributes: {} };
    assertUnique(nodes, node, line);
    nodes.push(node);
    return node;
  };

  for (const line of lines.slice(1)) {
    const participant = line.text.match(/^(participant|actor)\s+([\w.-]+)(?:\s+(?:as\s+)?("(?:\\.|[^"])*"|.+))?$/i);
    if (participant) {
      ensureParticipant(participant[2] ?? "", unquote(participant[3]?.trim(), participant[2] ?? ""), participant[1]?.toLowerCase() === "actor" ? "actor" : "rectangle", line.number);
      continue;
    }

    const groupStart = line.text.match(/^(group|alt|opt|loop|par|break|critical)\s+(.+)$/i);
    if (groupStart) {
      const group: SemanticGroup = {
        id: uniqueId("group", groups.length),
        label: groupStart[2]?.trim() ?? "Group",
        kind: (groupStart[1]?.toLowerCase() ?? "group") as NonNullable<SemanticGroup["kind"]>,
        start: connections.length,
        end: connections.length,
      };
      groups.push(group);
      openGroups.push(group);
      continue;
    }
    if (/^end$/i.test(line.text)) {
      const group = openGroups.pop();
      if (!group) throw new Error(`Line ${line.number}: unexpected end.`);
      group.end = Math.max(group.start, connections.length - 1);
      continue;
    }

    const message = line.text.match(/^([\w.-]+)\s*(-{1,2}>>?|-->>?)\s*([\w.-]+)\s*(?::\s*(.*))?$/);
    if (message) {
      const from = message[1] ?? "";
      const arrow = message[2] ?? "->";
      const to = message[3] ?? "";
      ensureParticipant(from, from, "rectangle", line.number);
      ensureParticipant(to, to, "rectangle", line.number);
      const activeGroup = openGroups[openGroups.length - 1];
      connections.push({
        id: connectionId(from, to, connections.length),
        from,
        to,
        ...(message[4]?.trim() ? { label: message[4].trim() } : {}),
        dashed: arrow.includes("--"),
        order: connections.length,
        ...(activeGroup ? { groupId: activeGroup.id } : {}),
      });
      continue;
    }
    throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
  }

  if (openGroups.length) throw new Error(`Group "${openGroups[openGroups.length - 1]?.label}" is missing end.`);
  return { kind: "sequence", nodes, connections, groups, source };
}

function parseSimpleDirectedGraph(
  source: string,
  kind: string,
  declarationShapes: Record<string, string>,
  defaultLabels: Record<string, string> = {},
): SemanticModel {
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  const keywords = Object.keys(declarationShapes).join("|");
  const declarationPattern = new RegExp(`^(${keywords})\\s+([\\w.-]+)(?:\\s+(\"(?:\\\\.|[^\"])*\"|[^\\s\\[]+))?(?:\\s*\\[([^\\]]+)\\])?$`, "i");

  for (const line of lines.slice(1)) {
    const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|\.\.>)\s+([\w.-]+)(?:(?:\s*:\s*(.+))|(?:\s+(\[[^\]]+\](?:\s*\/\s*.+)?)))?$/);
    if (relation) {
      const from = relation[1] ?? "";
      const to = relation[3] ?? "";
      connections.push({
        id: connectionId(from, to, connections.length),
        from,
        to,
        ...((relation[4] ?? relation[5])?.trim() ? { label: unquote((relation[4] ?? relation[5])?.trim(), "") } : {}),
        dashed: (relation[2] ?? "").includes("--") || (relation[2] ?? "").includes(".."),
        order: connections.length,
      });
      continue;
    }

    const declaration = line.text.match(declarationPattern);
    if (declaration) {
      const keyword = declaration[1]?.toLowerCase() ?? "";
      const id = declaration[2] ?? "";
      const attributes = attributesFrom(declaration[4]);
      const shape = attributes.shape ?? declarationShapes[keyword] ?? "rectangle";
      delete attributes.shape;
      const node: SemanticNode = {
        id,
        label: unquote(declaration[3], defaultLabels[keyword] ?? id),
        shape,
        attributes,
      };
      assertUnique(nodes, node, line.number);
      nodes.push(node);
      continue;
    }
    throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
  }

  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of connections) {
    if (!ids.has(edge.from)) throw new Error(`Connection references unknown node "${edge.from}".`);
    if (!ids.has(edge.to)) throw new Error(`Connection references unknown node "${edge.to}".`);
  }
  return { kind, nodes, connections, groups: [], source };
}

export function parseFlowchart(source: string): SemanticModel {
  return parseSimpleDirectedGraph(source, "flowchart", {
    start: "rounded",
    end: "rounded",
    step: "rectangle",
    process: "rectangle",
    decision: "diamond",
    input: "parallelogram",
    output: "parallelogram",
    node: "rectangle",
  }, { start: "Start", end: "End" });
}

export function parseState(source: string): SemanticModel {
  return parseSimpleDirectedGraph(source, "state", {
    initial: "initial-state",
    junction: "junction-state",
    choice: "choice-state",
    fork: "uml-bar",
    join: "uml-bar",
    history: "history-state",
    "deep-history": "deep-history-state",
    final: "final-state",
    terminate: "final-state",
    state: "rounded",
  }, { initial: "", junction: "", choice: "", fork: "", join: "", history: "H", "deep-history": "H*", final: "", terminate: "" });
}

export function parseActivity(source: string): SemanticModel {
  return parseSimpleDirectedGraph(source, "activity", {
    start: "initial-state",
    action: "rounded",
    activity: "rounded",
    decision: "diamond",
    merge: "diamond",
    fork: "uml-bar",
    join: "uml-bar",
    object: "uml-object",
    end: "final-state",
  }, { start: "", fork: "", join: "", end: "" });
}

interface EntityField {
  name: string;
  type: string;
  flags: string[];
}

function normalizeCardinality(value: string): string {
  const normalized = value.toLowerCase();
  return ({
    one: "1",
    "zero-one": "0..1",
    many: "N",
    n: "N",
    "zero-many": "0..N",
  } as Record<string, string>)[normalized] ?? value.toUpperCase();
}

export function parseEr(source: string): SemanticModel {
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  let active: { node: SemanticNode; fields: EntityField[]; line: number } | undefined;

  for (const line of lines.slice(1)) {
    if (active) {
      if (line.text === "}") {
        active.node.attributes.fields = JSON.stringify(active.fields);
        nodes.push(active.node);
        active = undefined;
        continue;
      }
      const field = line.text.match(/^([\w.-]+)\s+([^\s]+)(?:\s+(.+))?$/);
      if (!field) throw new Error(`Line ${line.number}: invalid entity field "${line.text}".`);
      const flags = (field[3] ?? "").split(/\s+/).filter(Boolean).map((flag) => {
        const normalized = flag.toLowerCase();
        if (["primary", "primary-key"].includes(normalized)) return "pk";
        if (["foreign", "foreign-key"].includes(normalized)) return "fk";
        return normalized;
      });
      active.fields.push({ name: field[1] ?? "", type: field[2] ?? "", flags });
      continue;
    }

    const entity = line.text.match(/^entity\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s\{]+))?\s*\{$/i);
    if (entity) {
      const id = entity[1] ?? "";
      const node: SemanticNode = { id, label: unquote(entity[2], id), shape: "entity", attributes: {} };
      assertUnique(nodes, node, line.number);
      active = { node, fields: [], line: line.number };
      continue;
    }

    const relation = line.text.match(/^([\w.-]+)\s+(1|one|0\.\.1|zero-one|N|many|0\.\.N|zero-many)\s+(-{1,2}>|-->)\s+(1|one|0\.\.1|zero-one|N|many|0\.\.N|zero-many)\s+([\w.-]+)(?:\s*:\s*(.+))?$/i);
    if (relation) {
      const from = relation[1] ?? "";
      const to = relation[5] ?? "";
      connections.push({
        id: connectionId(from, to, connections.length),
        from,
        to,
        ...(relation[6]?.trim() ? { label: relation[6].trim() } : {}),
        dashed: (relation[3] ?? "").includes("--"),
        order: connections.length,
        attributes: {
          fromCardinality: normalizeCardinality(relation[2] ?? "1"),
          toCardinality: normalizeCardinality(relation[4] ?? "N"),
        },
      });
      continue;
    }
    throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
  }

  if (active) throw new Error(`Entity "${active.node.id}" opened on line ${active.line} is missing a closing brace.`);
  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of connections) {
    if (!ids.has(edge.from)) throw new Error(`Relation references unknown entity "${edge.from}".`);
    if (!ids.has(edge.to)) throw new Error(`Relation references unknown entity "${edge.to}".`);
  }
  return { kind: "er", nodes, connections, groups: [], source };
}

export function parseComponent(source: string): SemanticModel {
  const model = parseDeployment(source);
  return { ...model, kind: "component" };
}

interface UmlMember {
  text: string;
  kind: "attribute" | "operation" | "literal";
}

export function parseClass(source: string): SemanticModel {
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  let active: { node: SemanticNode; members: UmlMember[]; line: number } | undefined;

  for (const line of lines.slice(1)) {
    if (active) {
      if (line.text === "}") {
        active.node.attributes.members = JSON.stringify(active.members);
        nodes.push(active.node);
        active = undefined;
        continue;
      }
      const kind = active.node.attributes.kind === "enum"
        ? "literal"
        : line.text.includes("(")
          ? "operation"
          : "attribute";
      active.members.push({ text: line.text, kind });
      continue;
    }

    const declaration = line.text.match(/^(class|abstract|interface|enum)\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s\{]+))?\s*\{$/i);
    if (declaration) {
      const kind = declaration[1]?.toLowerCase() ?? "class";
      const id = declaration[2] ?? "";
      const node: SemanticNode = {
        id,
        label: unquote(declaration[3], id),
        shape: "uml-class",
        attributes: { kind },
      };
      assertUnique(nodes, node, line.number);
      active = { node, members: [], line: line.number };
      continue;
    }

    const relation = line.text.match(/^([\w.-]+)(?:\s+"([^"]+)")?\s+(<\|--|<\|\.\.|\.\.\|>|--\|>|\*--|o--|\.\.>|-->|--)(?:\s+"([^"]+)")?\s+([\w.-]+)(?:\s*:\s*(.+))?$/);
    if (relation) {
      const left = relation[1] ?? "";
      const leftCardinality = relation[2];
      const operator = relation[3] ?? "--";
      const rightCardinality = relation[4];
      const right = relation[5] ?? "";
      const reversed = operator === "<|--" || operator === "<|..";
      const relationKind = ({
        "<|--": "inheritance",
        "<|..": "realization",
        "..|>": "realization",
        "--|>": "inheritance",
        "*--": "composition",
        "o--": "aggregation",
        "..>": "dependency",
        "-->": "directed-association",
        "--": "association",
      } as Record<string, string>)[operator] ?? "association";
      const from = reversed ? right : left;
      const to = reversed ? left : right;
      const fromCardinality = reversed ? rightCardinality : leftCardinality;
      const toCardinality = reversed ? leftCardinality : rightCardinality;
      connections.push({
        id: connectionId(from, to, connections.length),
        from,
        to,
        ...(relation[6]?.trim() ? { label: relation[6].trim() } : {}),
        dashed: ["realization", "dependency"].includes(relationKind),
        order: connections.length,
        attributes: {
          relation: relationKind,
          ...(fromCardinality ? { fromCardinality } : {}),
          ...(toCardinality ? { toCardinality } : {}),
        },
      });
      continue;
    }
    throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
  }

  if (active) throw new Error(`${active.node.attributes.kind} "${active.node.id}" opened on line ${active.line} is missing a closing brace.`);
  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of connections) {
    if (!ids.has(edge.from)) throw new Error(`Relation references unknown classifier "${edge.from}".`);
    if (!ids.has(edge.to)) throw new Error(`Relation references unknown classifier "${edge.to}".`);
  }
  return { kind: "class", nodes, connections, groups: [], source };
}

export function parseUsecase(source: string): SemanticModel {
  const transformed = source.split(/\r?\n/).map((line) => {
    const include = line.trim().match(/^include\s+([\w.-]+)\s+->\s+([\w.-]+)$/i);
    if (include) return `${include[1]} ..> ${include[2]}: «include»`;
    const extend = line.trim().match(/^extend\s+([\w.-]+)\s+->\s+([\w.-]+)$/i);
    if (extend) return `${extend[1]} ..> ${extend[2]}: «extend»`;
    const generalize = line.trim().match(/^generalize\s+([\w.-]+)\s+->\s+([\w.-]+)$/i);
    if (generalize) return `${generalize[1]} -> ${generalize[2]}: «generalize»`;
    return line;
  }).join("\n");
  const parsed = parseDeployment(transformed);
  const connections = parsed.connections.map((edge) => {
    if (edge.label === "«generalize»") {
      const { label: _label, ...withoutLabel } = edge;
      return { ...withoutLabel, dashed: false, attributes: { relation: "inheritance" } };
    }
    return edge.label === "«include»" || edge.label === "«extend»"
      ? { ...edge, attributes: { relation: "dependency" } }
      : edge;
  });
  return { ...parsed, kind: "usecase", connections, source };
}

interface SlideContext {
  id?: string;
  lastItemId?: string;
  pendingArrow?: string;
}

export function parseSlide(source: string): SemanticModel {
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  const contexts: SlideContext[] = [{}];
  let order = 0;

  const activeContext = (): SlideContext => contexts[contexts.length - 1] ?? contexts[0]!;
  const addNode = (node: SemanticNode, line: number, connectable = true): void => {
    assertUnique(nodes, node, line);
    node.attributes.order = String(order++);
    nodes.push(node);
    if (!connectable) return;
    const context = activeContext();
    if (context.pendingArrow !== undefined && context.lastItemId) {
      connections.push({
        id: connectionId(context.lastItemId, node.id, connections.length),
        from: context.lastItemId,
        to: node.id,
        ...(context.pendingArrow ? { label: context.pendingArrow } : {}),
        dashed: false,
        order: connections.length,
      });
      delete context.pendingArrow;
    }
    context.lastItemId = node.id;
  };

  for (const line of lines.slice(1)) {
    if (line.text === "}") {
      if (contexts.length === 1) throw new Error(`Line ${line.number}: unexpected closing brace.`);
      const closed = contexts.pop();
      if (closed?.pendingArrow !== undefined) throw new Error(`Line ${line.number}: arrow must be followed by another slide item.`);
      continue;
    }

    const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|-->)\s+([\w.-]+)(?:\s*:\s*(.+))?$/);
    if (relation) {
      const from = relation[1] ?? "";
      const to = relation[3] ?? "";
      connections.push({
        id: connectionId(from, to, connections.length),
        from,
        to,
        ...(relation[4]?.trim() ? { label: unquote(relation[4].trim(), "") } : {}),
        dashed: (relation[2] ?? "").includes("--"),
        order: connections.length,
      });
      continue;
    }

    const layout = line.text.match(/^(row|column|grid)(?:\s+([\w.-]+))?(?:\s*\[([^\]]+)\])?\s*\{$/i);
    if (layout) {
      const kind = layout[1]?.toLowerCase() ?? "row";
      const id = layout[2] ?? uniqueId(kind, nodes.filter((node) => node.shape === "slide-group").length);
      const attributes: Record<string, string> = { ...attributesFrom(layout[3]), layout: kind };
      const parentId = activeContext().id;
      addNode({ id, label: attributes.label ?? "", shape: "slide-group", ...(parentId ? { parentId } : {}), attributes }, line.number, false);
      contexts.push({ id });
      continue;
    }

    const heading = line.text.match(/^(title|subtitle)\s+("(?:\\.|[^"])*")(?:\s*\[([^\]]+)\])?$/i);
    if (heading) {
      const kind = heading[1]?.toLowerCase() ?? "title";
      const id = uniqueId(kind, nodes.filter((node) => node.shape === `slide-${kind}`).length);
      const parentId = activeContext().id;
      addNode({ id, label: unquote(heading[2], id), shape: `slide-${kind}`, ...(parentId ? { parentId } : {}), attributes: attributesFrom(heading[3]) }, line.number, false);
      continue;
    }

    const item = line.text.match(/^(card|note|callout|badge|metric|bar|quote|milestone)\s+([\w.-]+)\s+("(?:\\.|[^"])*"|[^\s\[]+)(?:\s*\[([^\]]+)\])?$/i);
    if (item) {
      const kind = item[1]?.toLowerCase() ?? "card";
      const id = item[2] ?? "";
      const parentId = activeContext().id;
      addNode({ id, label: unquote(item[3], id), shape: `slide-${kind}`, ...(parentId ? { parentId } : {}), attributes: attributesFrom(item[4]) }, line.number);
      continue;
    }

    const arrow = line.text.match(/^arrow(?:\s*:\s*(.+))?$/i);
    if (arrow) {
      const context = activeContext();
      if (!context.lastItemId) throw new Error(`Line ${line.number}: arrow must follow a slide item.`);
      if (context.pendingArrow !== undefined) throw new Error(`Line ${line.number}: consecutive arrows are not allowed.`);
      context.pendingArrow = arrow[1] ? unquote(arrow[1].trim(), "") : "";
      continue;
    }

    throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
  }

  if (contexts.length > 1) throw new Error(`Slide layout "${contexts[contexts.length - 1]?.id}" is missing a closing brace.`);
  if (contexts[0]?.pendingArrow !== undefined) throw new Error("Arrow must be followed by another slide item.");
  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of connections) {
    if (!ids.has(edge.from)) throw new Error(`Connection references unknown slide item "${edge.from}".`);
    if (!ids.has(edge.to)) throw new Error(`Connection references unknown slide item "${edge.to}".`);
  }
  return { kind: "slide", nodes, connections, groups: [], source };
}

function createDirectedGraphDiagram(name: string, parse: (source: string) => SemanticModel, defaultLayout = "hierarchical"): DiagramPlugin {
  return {
    name,
    defaultLayout,
    parse,
    toLayoutModel(model, context) {
      return {
        kind: model.kind,
        items: model.nodes.map((node) => ({ ...node, size: context.measure(node.shape, node.label, node.attributes) })),
        connections: model.connections,
        groups: [],
        direction: "right",
        minimumGap: context.theme.gapY,
      };
    },
  };
}

export function createFlowchartDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("flowchart", parseFlowchart, "flowchart");
}

export function createActivityDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("activity", parseActivity, "activity");
}

export function createStateDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("state", parseState);
}

export function createErDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("er", parseEr);
}

export function createClassDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("class", parseClass, "class");
}

export function createSlideDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("slide", parseSlide, "slide");
}

export function createDeploymentDiagram(): DiagramPlugin {
  return {
    name: "deployment",
    defaultLayout: "hierarchical",
    parse: parseDeployment,
    toLayoutModel(model, context) {
      return {
        kind: model.kind,
        items: model.nodes.map((node) => ({
          ...node,
          size: context.measure(node.shape, node.label, node.attributes),
        })),
        connections: model.connections,
        groups: model.groups,
        direction: "right",
        minimumGap: context.theme.gapY,
      };
    },
  };
}

export function createComponentDiagram(): DiagramPlugin {
  return {
    ...createDeploymentDiagram(),
    name: "component",
    parse: parseComponent,
  };
}

export function createUsecaseDiagram(): DiagramPlugin {
  return {
    ...createDeploymentDiagram(),
    name: "usecase",
    parse: parseUsecase,
  };
}

export function createSequenceDiagram(): DiagramPlugin {
  return {
    name: "sequence",
    defaultLayout: "sequence",
    parse: parseSequence,
    toLayoutModel(model, context) {
      return {
        kind: model.kind,
        items: model.nodes.map((node) => ({ ...node, size: context.measure(node.shape, node.label, node.attributes) })),
        connections: model.connections,
        groups: model.groups,
        direction: "down",
        minimumGap: 54,
      };
    },
  };
}
