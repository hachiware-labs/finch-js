import type { Geometry, GeometryEdge, GeometryNode, ShapePlugin, Theme } from "./types";
import { pathFromPoints, svgElement } from "./utils";

export type ShapeResolver = (name: string) => ShapePlugin;

export class SvgRenderer {
  readonly svg: SVGSVGElement;
  private readonly document: Document;
  private readonly resolveShape: ShapeResolver;
  private theme: Theme;
  private geometry?: Geometry;
  private nodeElements = new Map<string, SVGGElement>();
  private edgeElements = new Map<string, SVGPathElement>();
  private edgeLabelElements = new Map<string, SVGTextElement>();

  constructor(document: Document, theme: Theme, resolveShape: ShapeResolver, ariaLabel: string) {
    this.document = document;
    this.theme = theme;
    this.resolveShape = resolveShape;
    this.svg = svgElement(document, "svg", {
      xmlns: "http://www.w3.org/2000/svg",
      role: "img",
      "aria-label": ariaLabel,
      class: "tit-canvas",
      width: "100%",
      preserveAspectRatio: "xMinYMin meet",
      tabindex: "0",
    });
  }

  draw(geometry: Geometry, theme = this.theme): void {
    this.geometry = geometry;
    this.theme = theme;
    this.nodeElements.clear();
    this.edgeElements.clear();
    this.edgeLabelElements.clear();
    this.svg.replaceChildren();
    this.svg.setAttribute("viewBox", `0 0 ${geometry.width} ${geometry.height}`);
    this.svg.style.background = theme.canvasColor;
    this.svg.style.aspectRatio = `${geometry.width} / ${geometry.height}`;
    this.svg.append(this.createDefinitions(), this.createStyles());

    const groupLayer = svgElement(this.document, "g", { class: "tit-groups" });
    for (const group of geometry.groups) {
      groupLayer.append(svgElement(this.document, "rect", {
        x: group.x,
        y: group.y,
        width: group.width,
        height: group.height,
        rx: 8,
        fill: "none",
        stroke: theme.containerStroke,
        "stroke-width": 1,
        "stroke-dasharray": "5 4",
      }));
      const title = group.kind && group.kind !== "group" ? `${group.kind} · ${group.label}` : group.label;
      const tabWidth = Math.min(group.width - 18, Math.max(78, title.length * (theme.fontSize * 0.62) + 24));
      groupLayer.append(svgElement(this.document, "path", {
        d: `M ${group.x} ${group.y} L ${group.x + tabWidth} ${group.y} L ${group.x + tabWidth + 10} ${group.y + 22} L ${group.x} ${group.y + 22} Z`,
        fill: theme.containerFill,
        stroke: theme.containerStroke,
        "stroke-width": 1,
      }));
      const label = svgElement(this.document, "text", {
        x: group.x + 10,
        y: group.y + 15,
        fill: theme.mutedColor,
        "font-family": theme.fontFamily,
        "font-size": theme.fontSize - 1,
        "font-weight": 650,
      });
      label.textContent = title;
      groupLayer.append(label);
    }
    this.svg.append(groupLayer);

    const containers = svgElement(this.document, "g", { class: "tit-containers" });
    const regularNodes = svgElement(this.document, "g", { class: "tit-nodes" });
    for (const node of geometry.nodes.filter((candidate) => candidate.shape === "container")) this.appendNode(containers, node);
    this.svg.append(containers);

    if (geometry.kind === "sequence") {
      this.svg.append(this.createLifelines(geometry));
      this.svg.append(this.createActivations(geometry));
    }
    this.svg.append(this.createEdges(geometry));
    for (const node of geometry.nodes.filter((candidate) => candidate.shape !== "container")) this.appendNode(regularNodes, node);
    this.svg.append(regularNodes);
  }

  updateGeometry(geometry: Geometry): void {
    this.geometry = geometry;
    this.svg.setAttribute("viewBox", `0 0 ${geometry.width} ${geometry.height}`);
    this.svg.style.aspectRatio = `${geometry.width} / ${geometry.height}`;
    for (const node of geometry.nodes) {
      this.nodeElements.get(node.id)?.setAttribute("transform", `translate(${node.x} ${node.y})`);
    }
    for (const edge of geometry.edges) {
      this.edgeElements.get(edge.id)?.setAttribute("d", pathFromPoints(edge.points));
      const label = this.edgeLabelElements.get(edge.id);
      if (label) {
        const point = labelPoint(edge);
        label.setAttribute("x", String(point.x));
        label.setAttribute("y", String(point.y - 8));
      }
      for (const endpoint of ["start", "end"] as const) {
        const cardinality = this.svg.querySelector<SVGTextElement>(`.tit-cardinality[data-edge-id="${cssEscape(edge.id)}"][data-endpoint="${endpoint}"]`);
        if (!cardinality) continue;
        const point = cardinalityPoint(edge, endpoint);
        cardinality.setAttribute("x", String(point.x));
        cardinality.setAttribute("y", String(point.y - 6));
      }
    }
    if (geometry.kind === "sequence") {
      for (const node of geometry.nodes) {
        const line = this.svg.querySelector<SVGLineElement>(`.tit-lifeline[data-node-id="${cssEscape(node.id)}"]`);
        if (line) {
          const x = node.x + node.width / 2;
          line.setAttribute("x1", String(x));
          line.setAttribute("x2", String(x));
        }
        const activations = this.svg.querySelectorAll<SVGRectElement>(`.tit-activation[data-node-id="${cssEscape(node.id)}"]`);
        for (const activation of activations) {
          const offset = Number(activation.dataset.xOffset ?? -5);
          activation.setAttribute("x", String(node.x + node.width / 2 + offset));
        }
      }
    }
  }

  setSelection(ids: ReadonlySet<string>): void {
    for (const [id, element] of this.nodeElements) element.classList.toggle("is-selected", ids.has(id));
  }

  setPinned(id: string, pinned: boolean): void {
    this.nodeElements.get(id)?.classList.toggle("is-pinned", pinned);
  }

  clientPoint(event: PointerEvent): { x: number; y: number } {
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = this.svg.getScreenCTM();
    if (!matrix) return { x: event.clientX, y: event.clientY };
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  nodeIdFromTarget(target: EventTarget | null): string | undefined {
    return target instanceof this.document.defaultView!.Element
      ? target.closest<SVGGElement>("[data-node-id]")?.dataset.nodeId
      : undefined;
  }

  private appendNode(layer: SVGGElement, node: GeometryNode): void {
    const element = this.resolveShape(node.shape).render({ node, theme: this.theme, document: this.document });
    element.classList.add("tit-node");
    layer.append(element);
    this.nodeElements.set(node.id, element);
  }

  private createEdges(geometry: Geometry): SVGGElement {
    const layer = svgElement(this.document, "g", { class: "tit-edges" });
    for (const edge of geometry.edges) {
      const relation = edge.attributes?.relation;
      const markerEnd = ["inheritance", "realization"].includes(relation ?? "")
        ? "url(#tit-triangle)"
        : ["association", "aggregation", "composition"].includes(relation ?? "")
          ? undefined
          : "url(#tit-arrow)";
      const markerStart = relation === "composition"
        ? "url(#tit-diamond-filled)"
        : relation === "aggregation"
          ? "url(#tit-diamond-open)"
          : undefined;
      const path = svgElement(this.document, "path", {
        d: pathFromPoints(edge.points),
        fill: "none",
        stroke: this.theme.edgeColor,
        "stroke-width": this.theme.edgeWidth,
        "stroke-dasharray": edge.dashed || ["dependency", "realization"].includes(relation ?? "") ? "6 5" : undefined,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        "marker-start": markerStart,
        "marker-end": markerEnd,
        class: "tit-edge",
        "data-edge-id": edge.id,
      });
      layer.append(path);
      this.edgeElements.set(edge.id, path);
      const cardinalities = [
        ["start", edge.attributes?.fromCardinality, cardinalityPoint(edge, "start")],
        ["end", edge.attributes?.toCardinality, cardinalityPoint(edge, "end")],
      ] as const;
      for (const [endpoint, value, point] of cardinalities) {
        if (!value) continue;
        const cardinality = svgElement(this.document, "text", {
          x: point.x,
          y: point.y - 6,
          "text-anchor": "middle",
          fill: this.theme.accentColor,
          "font-family": this.theme.fontFamily,
          "font-size": this.theme.fontSize - 1,
          "font-weight": 750,
          class: "tit-cardinality",
          "data-edge-id": edge.id,
          "data-endpoint": endpoint,
        });
        cardinality.textContent = value;
        layer.append(cardinality);
      }
      if (edge.label) {
        const point = labelPoint(edge);
        const text = svgElement(this.document, "text", {
          x: point.x,
          y: point.y - 8,
          "text-anchor": "middle",
          fill: this.theme.mutedColor,
          "font-family": this.theme.fontFamily,
          "font-size": this.theme.fontSize - 1,
          class: "tit-edge-label",
        });
        text.textContent = edge.label;
        layer.append(text);
        this.edgeLabelElements.set(edge.id, text);
      }
    }
    return layer;
  }

  private createLifelines(geometry: Geometry): SVGGElement {
    const layer = svgElement(this.document, "g", { class: "tit-lifelines" });
    for (const node of geometry.nodes) {
      const x = node.x + node.width / 2;
      layer.append(svgElement(this.document, "line", {
        x1: x,
        x2: x,
        y1: node.y + node.height,
        y2: geometry.height - 32,
        stroke: this.theme.nodeStroke,
        "stroke-width": 1,
        "stroke-dasharray": "5 5",
        class: "tit-lifeline",
        "data-node-id": node.id,
      }));
    }
    return layer;
  }

  private createActivations(geometry: Geometry): SVGGElement {
    const layer = svgElement(this.document, "g", { class: "tit-activations" });
    const nodeMap = new Map(geometry.nodes.map((node) => [node.id, node]));
    const stacks = new Map<string, Array<{ start: number; depth: number }>>();
    const intervals: Array<{ nodeId: string; start: number; end: number; depth: number }> = [];

    for (const edge of geometry.edges) {
      if (edge.from === edge.to) continue;
      const y = edge.points[0]?.y ?? 0;
      if (edge.dashed) {
        const stack = stacks.get(edge.from);
        const active = stack?.pop();
        if (active) intervals.push({ nodeId: edge.from, start: active.start, end: Math.max(active.start + 10, y), depth: active.depth });
      } else {
        const stack = stacks.get(edge.to) ?? [];
        stack.push({ start: y, depth: stack.length });
        stacks.set(edge.to, stack);
      }
    }
    for (const [nodeId, stack] of stacks) {
      for (const active of stack) intervals.push({ nodeId, start: active.start, end: geometry.height - 38, depth: active.depth });
    }

    for (const interval of intervals) {
      const node = nodeMap.get(interval.nodeId);
      if (!node) continue;
      const offset = -5 + interval.depth * 3;
      layer.append(svgElement(this.document, "rect", {
        x: node.x + node.width / 2 + offset,
        y: interval.start,
        width: 10,
        height: Math.max(10, interval.end - interval.start),
        rx: 2,
        fill: this.theme.nodeFill,
        stroke: this.theme.accentColor,
        "stroke-width": 1.25,
        class: "tit-activation",
        "data-node-id": interval.nodeId,
        "data-x-offset": offset,
      }));
    }
    return layer;
  }

  private createDefinitions(): SVGDefsElement {
    const defs = svgElement(this.document, "defs");
    const marker = svgElement(this.document, "marker", {
      id: "tit-arrow",
      viewBox: "0 0 10 10",
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: "auto-start-reverse",
    });
    marker.append(svgElement(this.document, "path", { d: "M 0 0 L 10 5 L 0 10 z", fill: this.theme.edgeColor }));
    const triangle = svgElement(this.document, "marker", {
      id: "tit-triangle",
      viewBox: "0 0 12 12",
      refX: 11,
      refY: 6,
      markerWidth: 9,
      markerHeight: 9,
      orient: "auto-start-reverse",
    });
    triangle.append(svgElement(this.document, "path", { d: "M 1 1 L 11 6 L 1 11 Z", fill: this.theme.canvasColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
    const openDiamond = svgElement(this.document, "marker", {
      id: "tit-diamond-open",
      viewBox: "0 0 14 10",
      refX: 2,
      refY: 5,
      markerWidth: 11,
      markerHeight: 9,
      orient: "auto-start-reverse",
    });
    openDiamond.append(svgElement(this.document, "path", { d: "M 1 5 L 7 1 L 13 5 L 7 9 Z", fill: this.theme.canvasColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
    const filledDiamond = svgElement(this.document, "marker", {
      id: "tit-diamond-filled",
      viewBox: "0 0 14 10",
      refX: 2,
      refY: 5,
      markerWidth: 11,
      markerHeight: 9,
      orient: "auto-start-reverse",
    });
    filledDiamond.append(svgElement(this.document, "path", { d: "M 1 5 L 7 1 L 13 5 L 7 9 Z", fill: this.theme.edgeColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
    const filter = svgElement(this.document, "filter", { id: "tit-shadow", x: "-20%", y: "-30%", width: "140%", height: "170%" });
    filter.append(svgElement(this.document, "feDropShadow", { dx: 0, dy: 2, stdDeviation: 2.5, "flood-color": "#0f172a", "flood-opacity": 0.10 }));
    defs.append(marker, triangle, openDiamond, filledDiamond, filter);
    return defs;
  }

  private createStyles(): SVGStyleElement {
    const style = svgElement(this.document, "style");
    style.textContent = `
      .tit-node { cursor: grab; outline: none; }
      .tit-node:active { cursor: grabbing; }
      .tit-node > :first-child { transition: stroke 120ms ease, stroke-width 120ms ease; }
      .tit-node.is-selected > :first-child { stroke: ${this.theme.accentColor}; stroke-width: 2.4; }
      .tit-node.is-pinned::after { content: ""; }
      .tit-canvas.is-panning { cursor: grabbing; user-select: none; }
      .tit-edge { pointer-events: none; }
      .tit-activation { pointer-events: none; }
      .tit-edge-label { paint-order: stroke; stroke: ${this.theme.canvasColor}; stroke-width: 5px; stroke-linejoin: round; }
      .tit-cardinality { paint-order: stroke; stroke: ${this.theme.canvasColor}; stroke-width: 5px; stroke-linejoin: round; pointer-events: none; }
      .tit-canvas:focus-visible { outline: 2px solid ${this.theme.accentColor}; outline-offset: 2px; }
    `;
    return style;
  }
}

function labelPoint(edge: GeometryEdge): { x: number; y: number } {
  if (!edge.points.length) return { x: 0, y: 0 };
  let start = edge.points[0]!;
  let end = edge.points[1] ?? start;
  let longest = -1;
  for (let index = 0; index < edge.points.length - 1; index += 1) {
    const candidateStart = edge.points[index]!;
    const candidateEnd = edge.points[index + 1]!;
    const length = Math.hypot(candidateEnd.x - candidateStart.x, candidateEnd.y - candidateStart.y);
    if (length > longest) {
      start = candidateStart;
      end = candidateEnd;
      longest = length;
    }
  }
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

function cardinalityPoint(edge: GeometryEdge, endpoint: "start" | "end"): { x: number; y: number } {
  const points = endpoint === "start" ? edge.points : [...edge.points].reverse();
  let origin = points[0] ?? { x: 0, y: 0 };
  let remaining = 18;
  for (let index = 1; index < points.length; index += 1) {
    const target = points[index];
    if (!target) continue;
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const length = Math.hypot(dx, dy);
    if (length >= remaining && length > 0) {
      return { x: origin.x + dx * (remaining / length), y: origin.y + dy * (remaining / length) };
    }
    remaining -= length;
    origin = target;
  }
  return origin;
}

function cssEscape(value: string): string {
  const css = globalThis.CSS;
  return css?.escape ? css.escape(value) : value.replace(/["\\]/g, "\\$&");
}
