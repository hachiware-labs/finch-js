import { decorateText } from "./rich-text.js";
import {requiredInterfacePath} from "./interface-geometry.js";
import {containerOutlinePath} from "./shapes.js";
import {sequenceFragmentSpan} from './sequence-fragments.js';
import type { Geometry, GeometryEdge, GeometryNode, ShapePlugin, Theme } from "./types.js";
import { svgElement } from "./utils.js";
import { nodeTheme } from "./node-style.js";
import { isRenderedEdge, pathWithEdgeJumps } from "./edge-jumps.js";
import { cardinalityPoint, endpointText, estimatedTextWidth, fitVisualBounds, placeEdgeLabels } from "./edge-labels.js";
import type { EdgeLabelPlacement } from "./edge-labels.js";
import { labelLayout, wrapWidth } from "./text-layout.js";

export type ShapeResolver = (name: string) => ShapePlugin;

export class SvgRenderer {
  readonly svg: SVGSVGElement;
  private readonly document: Document;
  private readonly resolveShape: ShapeResolver;
  private theme: Theme;
  private geometry?: Geometry;
  private nodeElements = new Map<string, SVGGElement>();
  private containerHeadingElements = new Map<string, SVGGElement>();
  private edgeElements = new Map<string, SVGPathElement>();
  private edgeLabelElements = new Map<string, SVGTextElement>();
  private labelPlacements = new Map<string, EdgeLabelPlacement>();
  private minimumSize = { width: 320, height: 220 };
  private textWidths = new Map<string, number>();

  constructor(document: Document, theme: Theme, resolveShape: ShapeResolver, ariaLabel: string) {
    this.document = document;
    this.theme = theme;
    this.resolveShape = resolveShape;
    this.svg = svgElement(document, "svg", {
      xmlns: "http://www.w3.org/2000/svg",
      role: "img",
      "aria-label": ariaLabel,
      class: "finch-canvas",
      width: "100%",
      preserveAspectRatio: "xMinYMin meet",
      tabindex: "0",
    });
  }

  draw(geometry: Geometry, theme = this.theme): void {
    this.geometry = geometry;
    this.theme = theme;
    this.minimumSize = { width: geometry.width + (geometry.origin?.x ?? 0), height: geometry.height + (geometry.origin?.y ?? 0) };
    this.textWidths.clear();
    this.prepareGeometry(geometry);
    this.nodeElements.clear();
    this.containerHeadingElements.clear();
    this.edgeElements.clear();
    this.edgeLabelElements.clear();
    this.svg.replaceChildren();
    this.svg.setAttribute("viewBox", `${geometry.origin?.x ?? 0} ${geometry.origin?.y ?? 0} ${geometry.width} ${geometry.height}`);
    this.svg.style.background = theme.canvasColor;
    this.svg.style.aspectRatio = `${geometry.width} / ${geometry.height}`;
    this.svg.append(this.createDefinitions(), this.createStyles());

    this.svg.append(this.createGroups(geometry));

    const containers = svgElement(this.document, "g", { class: "finch-containers" });
    const regularNodes = svgElement(this.document, "g", { class: "finch-nodes" });
    for (const node of geometry.nodes.filter((candidate) => candidate.shape === "container")) this.appendNode(containers, node);
    this.svg.append(containers);

    if (geometry.kind === "sequence") {
      this.svg.append(this.createLifelines(geometry));
      this.svg.append(this.createActivations(geometry));
    }
    if(geometry.kind !== "timing") this.svg.append(this.createEdges(geometry));
    if(geometry.kind === "sequence") this.svg.append(this.createSequenceFragments(geometry));
    for (const node of geometry.nodes.filter((candidate) => candidate.shape !== "container" && !candidate.attributes.branchLifetime)) this.appendNode(regularNodes, node);
    this.svg.append(regularNodes);
    if(geometry.diagramText)this.svg.append(this.createDiagramText(geometry));
    if(geometry.kind === "timing") this.svg.append(this.createEdges(geometry));
    // Keep frame fills behind nodes, but headings above nodes and connections.
    const headings = svgElement(this.document, "g", { class: "finch-container-headings" });
    for (const node of geometry.nodes.filter((candidate) => candidate.shape === "container")) {
      const labels = this.nodeElements.get(node.id)?.querySelectorAll(":scope > text");
      if (!labels?.length) continue;
      const heading = svgElement(this.document, "g", {
        "data-node-id": node.id,
        transform: this.containerHeadingTransform(node, geometry),
      });
      heading.append(...labels);
      headings.append(heading);
      this.containerHeadingElements.set(node.id, heading);
    }
    this.svg.append(headings);
    decorateText(this.svg);
  }

  private createGroups(geometry:Geometry):SVGGElement {
    const theme=this.theme;
    const groupLayer = svgElement(this.document, "g", { class: "finch-groups" });
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
      const titleLayout = labelLayout(title, Math.min(216, group.width - 24), theme.fontSize - 1, theme.fontFamily, 650);
      const tabWidth = Math.min(group.width - 18, Math.max(78, titleLayout.width + 24));
      const tabHeight = Math.max(22, titleLayout.height + 8);
      groupLayer.append(svgElement(this.document, "path", {
        d: `M ${group.x} ${group.y} L ${group.x + tabWidth} ${group.y} L ${group.x + tabWidth + 10} ${group.y + tabHeight} L ${group.x} ${group.y + tabHeight} Z`,
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
      for (const [index, line] of titleLayout.lines.entries()) {
        const span = svgElement(this.document, "tspan", { x: group.x + 10, y: group.y + 15 + index * titleLayout.lineHeight });
        span.textContent = line;
        label.append(span);
      }
      groupLayer.append(label);
      for (const branch of group.branches ?? []) {
        groupLayer.append(svgElement(this.document, "path", { d: `M ${group.x} ${branch.y} H ${group.x + group.width}`, fill: "none", stroke: theme.containerStroke, "stroke-dasharray": "5 4", class: "finch-sequence-divider" }));
        const text = svgElement(this.document, "text", { x: group.x + 10, y: branch.y + 17, fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1 });
        for (const [index, line] of labelLayout(branch.label, 216, theme.fontSize - 1).lines.entries()) {
          const span = svgElement(this.document, "tspan", { x: group.x + 10, dy: index ? 16 : 0 }); span.textContent = line; text.append(span);
        }
        groupLayer.append(text);
      }
    }
    return groupLayer;
  }

  updateGeometry(geometry: Geometry): void {
    this.geometry = geometry;
    if(geometry.kind==='sequence'){this.svg.querySelector('.finch-groups')?.replaceWith(this.createGroups(geometry));this.svg.querySelector('.finch-activations')?.replaceWith(this.createActivations(geometry));}
    if(geometry.kind === "sequence"){this.svg.querySelector(".finch-lifelines")?.remove();this.svg.append(this.createLifelines(geometry));}
    this.svg.querySelector(".finch-sequence-fragments")?.remove();
    if(geometry.kind === "sequence") this.svg.append(this.createSequenceFragments(geometry));
    this.prepareGeometry(geometry);
    this.svg.querySelector(".finch-diagram-text")?.remove();
    if(geometry.diagramText)this.svg.append(this.createDiagramText(geometry));
    this.svg.setAttribute("viewBox", `${geometry.origin?.x ?? 0} ${geometry.origin?.y ?? 0} ${geometry.width} ${geometry.height}`);
    this.svg.style.aspectRatio = `${geometry.width} / ${geometry.height}`;
    for (const node of geometry.nodes) {
      const element = this.nodeElements.get(node.id);
      element?.setAttribute("transform", `translate(${node.x} ${node.y})`);
      if(node.shape === "uml-required-interface") element?.querySelector(".finch-required-interface-arc")?.setAttribute("d", requiredInterfacePath(node));
      this.containerHeadingElements.get(node.id)?.setAttribute("transform", this.containerHeadingTransform(node, geometry));
      if (node.shape === "container") {
        const frame = element?.querySelector<SVGRectElement>(":scope > rect");
        frame?.setAttribute("width", String(node.width));
        frame?.setAttribute("height", String(node.height));
        const outline = element?.querySelector<SVGPathElement>(":scope > path[class$='-outline']");
        outline?.setAttribute("d", containerOutlinePath(node, nodeTheme(node, geometry.nodes, this.theme)));
        element?.querySelector(".finch-component-group-mark")?.setAttribute("transform", node.attributes.componentStyle==="uml1"?"translate(0 0)":`translate(${node.width-30} 10)`);
      }
    }
    for (const [index, edge] of geometry.edges.entries()) {
      this.edgeElements.get(edge.id)?.setAttribute("d", pathWithEdgeJumps(edge, geometry.edges.slice(0, index)));
      const label = this.edgeLabelElements.get(edge.id);
      if (label) {
        this.setEdgeLabel(label, this.labelPlacements.get(edge.id)!);
      }
      for (const endpoint of ["start", "end"] as const) {
        const cardinality = this.svg.querySelector<SVGTextElement>(`.finch-cardinality[data-edge-id="${cssEscape(edge.id)}"][data-endpoint="${endpoint}"]`);
        if (!cardinality) continue;
        const point = cardinalityPoint(edge, endpoint);
        cardinality.setAttribute("x", String(point.x));
        cardinality.setAttribute("y", String(point.y - 6));
      }
    }
    if (geometry.kind === "sequence") {
      for (const node of geometry.nodes) {
        for (const line of this.svg.querySelectorAll<SVGLineElement>(`.finch-lifeline[data-node-id="${cssEscape(node.id)}"]`)) {
          const x=node.x+node.width/2; line.setAttribute("x1",String(x));line.setAttribute("x2",String(x));
        }
        const destructions=this.svg.querySelectorAll<SVGPathElement>(`.finch-destruction[data-node-id="${cssEscape(node.id)}"]`);
        const events=(JSON.parse(node.attributes.sequencePositions ?? "[]") as Array<{kind:string;y:number}>).filter(e=>e.kind === "destroy");
        destructions.forEach((path,index)=>{ const event=events[index]; const x=node.x+node.width/2; if(event) path.setAttribute("d",`M ${x-7} ${event.y-7} l 14 14 M ${x+7} ${event.y-7} l -14 14`); });
        for(const header of this.svg.querySelectorAll<SVGGElement>(`.finch-created-header[data-node-id="${cssEscape(node.id)}"]`)) {
          const y=header.getAttribute("transform")?.match(/translate\([^ ]+ ([^)]+)\)/)?.[1] ?? "0";
          header.setAttribute("transform",`translate(${node.x} ${y})`);
        }
        const activations = this.svg.querySelectorAll<SVGRectElement>(`.finch-activation[data-node-id="${cssEscape(node.id)}"]`);
        for (const activation of activations) {
          const offset = Number(activation.dataset.xOffset ?? -5);
          activation.setAttribute("x", String(node.x + node.width / 2 + offset));
        }
      }
    }
    decorateText(this.svg);
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

  private containerHeadingTransform(node: GeometryNode, geometry: Geometry): string {
    const fontSize = this.theme.fontSize - 1;
    const layout = labelLayout(node.label, Math.min(node.width - 32, wrapWidth(node.attributes, 216)), fontSize, this.theme.fontFamily, 650);
    const left = node.x + 16;
    const top = node.y + 23 - fontSize;
    const obstacles = geometry.nodes.filter((other) => other.shape !== "container"
      && other.y < top + layout.height + 4 && other.y + other.height > top - 4);
    const candidates = [left, ...obstacles.flatMap((other) => [other.x + other.width + 8, other.x - layout.width - 8])]
      .filter((x) => x >= left && x + layout.width <= node.x + node.width - 16)
      .sort((a, b) => a - b);
    const x = candidates.find((candidate) => obstacles.every((other) => candidate + layout.width + 4 <= other.x
      || candidate - 4 >= other.x + other.width)) ?? left;
    return `translate(${node.x + x - left} ${node.y})`;
  }

  private appendNode(layer: SVGGElement, node: GeometryNode): void {
    if(node.attributes.hidden === "true")return;
    const theme = nodeTheme(node, this.geometry?.nodes ?? [], this.theme);
    const element = this.resolveShape(node.shape).render({ node, theme, document: this.document });
    element.classList.add("finch-node");
    layer.append(element);
    this.nodeElements.set(node.id, element);
  }

  private prepareGeometry(geometry: Geometry): void {
    const fontSize = this.theme.fontSize - 1;
    const probe = svgElement(this.document, "svg", { "aria-hidden": "true" });
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden";
    const text = svgElement(this.document, "text", { "font-family": this.theme.fontFamily, "font-size": fontSize });
    probe.append(text);
    this.document.body?.append(probe);
    try {
      const measure = (value: string): number => {
        const cached = this.textWidths.get(value);
        if (cached !== undefined) return cached;
        text.textContent = value;
        const measured = typeof text.getComputedTextLength === "function" ? text.getComputedTextLength() : 0;
        const width = measured > 0 ? measured : estimatedTextWidth(value, fontSize);
        this.textWidths.set(value, width);
        return width;
      };
      const result = placeEdgeLabels(geometry, fontSize, measure);
      this.labelPlacements = result.labels;
      fitVisualBounds(geometry, this.minimumSize, result.bounds);
      if(geometry.kind!=="sequence" && geometry.diagramText){
        geometry.origin!.y-=geometry.diagramText.top;
        geometry.height+=geometry.diagramText.top+geometry.diagramText.bottom;
      }
    } finally {
      probe.remove();
    }
  }

  private setEdgeLabel(text: SVGTextElement, placement: EdgeLabelPlacement): void {
    text.removeAttribute("data-finch-rich");
    text.setAttribute("x", String(placement.point.x));
    text.setAttribute("y", String(placement.point.y));
    text.replaceChildren();
    if (placement.lines.length === 1) text.textContent = placement.lines[0]!;
    else for (const [index, line] of placement.lines.entries()) {
      const span = svgElement(this.document, "tspan", { x: placement.point.x, y: placement.point.y + index * placement.lineHeight });
      span.textContent = line;
      text.append(span);
    }
  }

  private createSequenceFragments(geometry:Geometry): SVGGElement {
    const layer=svgElement(this.document,"g",{class:"finch-sequence-fragments"});
    for(const edge of geometry.edges.filter(e=>["ref","delay","divider","note"].includes(e.attributes?.messageKind ?? ""))) {
      const ids=edge.attributes!.participants!.split(",");
      const nodes=geometry.nodes.filter(n=>ids.includes(n.id)); if(!nodes.length)continue;
      const {x,width}=sequenceFragmentSpan(nodes,edge.attributes?.messageKind);
      const right=x+width,y=edge.points[0]!.y;
      const kind=edge.attributes!.messageKind!;
      const lines=labelLayout(edge.attributes!.fragmentLabel ?? "",Math.max(40,width-52),this.theme.fontSize-1,this.theme.fontFamily).lines;
      const height=Math.max(36,lines.length*16+22);
      const group=svgElement(this.document,"g",{class:`finch-sequence-${kind}`,"data-edge-id":edge.id});
      if(kind === "divider") {
        group.append(svgElement(this.document,"rect",{x,y:y-18,width,height,fill:this.theme.nodeFill}));
        group.append(svgElement(this.document,"path",{d:`M ${x} ${y-18} H ${right} M ${x} ${y-14} H ${right} M ${x} ${y+height-22} H ${right} M ${x} ${y+height-18} H ${right}`,fill:"none",stroke:this.theme.nodeStroke}));
        lines.forEach((line,index)=>{const text=svgElement(this.document,"text",{x:x+width/2,y:y+6+index*16,"text-anchor":"middle",fill:this.theme.labelColor,"font-size":this.theme.fontSize-1,"font-weight":700,"font-family":this.theme.fontFamily});text.textContent=line;group.append(text);});
        layer.append(group);continue;
      }
      const shapedNote=kind==='note' && edge.attributes!.noteShape!=='rnote';
      group.append(svgElement(this.document,"rect",{x,y:y-18,width,height,rx:kind === "ref" || kind === "note" ? 0 : 6,fill:shapedNote?'none':this.theme.nodeFill,stroke:shapedNote?'none':this.theme.nodeStroke,"stroke-dasharray":kind === "delay" ? "3 4" : "none"}));
      if(shapedNote){
        const top=y-18,bottom=top+height;
        const style={fill:this.theme.nodeFill,stroke:this.theme.nodeStroke};
        if(edge.attributes!.noteShape==='hnote')group.append(svgElement(this.document,'polygon',{points:`${x+16},${top} ${right-16},${top} ${right},${top+height/2} ${right-16},${bottom} ${x+16},${bottom} ${x},${top+height/2}`,...style}));
        else{
          group.append(svgElement(this.document,'path',{d:`M ${x} ${top} H ${right-16} L ${right} ${top+16} V ${bottom} H ${x} Z`,...style}));
          group.append(svgElement(this.document,'path',{d:`M ${right-16} ${top} V ${top+16} H ${right}`,fill:'none',stroke:this.theme.nodeStroke}));
        }
      }
      const title=svgElement(this.document,"text",{x:x+6,y:y-4,fill:this.theme.mutedColor,"font-size":10,"font-family":this.theme.fontFamily});title.textContent=kind === "ref" ? "ref" : "…";if(kind!=='note')group.append(title);
      lines.forEach((line,index)=>{const text=svgElement(this.document,"text",{x:x+width/2,y:y+6+index*16,"text-anchor":"middle",fill:this.theme.labelColor,"font-size":this.theme.fontSize-1,"font-family":this.theme.fontFamily});text.textContent=line;group.append(text);});
      layer.append(group);
    }
    let lane=0;
    const right=Math.max(0,...geometry.nodes.map(node=>node.x+node.width),...geometry.groups.map(group=>group.x+group.width));
    for(const start of geometry.edges){
      const durations=JSON.parse(start.attributes?.durations ?? '[]') as Array<{to:string;label:string;fromEndpoint?:string;toEndpoint?:string}>;
      for(const duration of durations){
        const end=geometry.edges.find(edge=>edge.id===duration.to);if(!end)continue;
        const x=right+36+lane++*160,y1=start.points[duration.fromEndpoint==='receive'?start.points.length-1:0]!.y,y2=end.points[duration.toEndpoint==='receive'?end.points.length-1:0]!.y;
        const group=svgElement(this.document,'g',{class:'finch-sequence-duration','data-from':start.id,'data-to':end.id,'data-start-y':y1,'data-end-y':y2});
        group.append(svgElement(this.document,'path',{d:`M ${right+8} ${y1} H ${x} M ${right+8} ${y2} H ${x}`,fill:'none',stroke:this.theme.mutedColor,'stroke-dasharray':'3 4'}));
        group.append(svgElement(this.document,'path',{d:`M ${x} ${y1} V ${y2} M ${x-4} ${y1+6} L ${x} ${y1} L ${x+4} ${y1+6} M ${x-4} ${y2-6} L ${x} ${y2} L ${x+4} ${y2-6}`,fill:'none',stroke:this.theme.edgeColor}));
        const lines=labelLayout(duration.label,112,this.theme.fontSize-1,this.theme.fontFamily).lines;
        lines.forEach((line,index)=>{const text=svgElement(this.document,'text',{x:x+9,y:(y1+y2)/2+(index-(lines.length-1)/2)*16,fill:this.theme.labelColor,'font-size':this.theme.fontSize-1,'font-family':this.theme.fontFamily});text.textContent=line;group.append(text);});
        layer.append(group);
      }
    }
    return layer;
  }

  private createEdges(geometry: Geometry): SVGGElement {
    const layer = svgElement(this.document, "g", { class: "finch-edges" });
    for (const [index, edge] of geometry.edges.entries()) {
      if (!isRenderedEdge(edge)) continue;
      const relation = edge.attributes?.relation;
      const markerEnd = edge.attributes?.toDecoration ? `url(#finch-decoration-${edge.attributes.toDecoration})` : edge.attributes?.nonNavigableEnd === "to" ? "url(#finch-non-navigable)" : edge.attributes?.unknownEndpoint === "lost" ? "url(#finch-message-dot)" : edge.attributes?.annotation ? undefined : ["async", "reply", "create"].includes(edge.attributes?.messageKind ?? "") ? "url(#finch-open-arrow)" : ["inheritance", "realization"].includes(relation ?? "")
        ? "url(#finch-triangle)"
        : (edge.attributes?.navigable === "true" || edge.attributes?.bidirectional === "true") ? "url(#finch-open-arrow)" : ["association", "aggregation", "composition"].includes(relation ?? "")
          ? undefined
          : "url(#finch-arrow)";
      const markerStart = edge.attributes?.fromDecoration ? `url(#finch-decoration-${edge.attributes.fromDecoration})` : edge.attributes?.nonNavigableEnd === "from" ? "url(#finch-non-navigable)" : edge.attributes?.bidirectional === "true" ? "url(#finch-open-arrow)" : edge.attributes?.unknownEndpoint === "found" ? "url(#finch-message-dot)" : relation === "composition"
        ? "url(#finch-diamond-filled)"
        : relation === "aggregation"
          ? "url(#finch-diamond-open)"
          : undefined;
      const lineColor = edge.attributes?.lineColor && /^(?:#[0-9a-f]{3,8}|[a-z]+)$/i.test(edge.attributes.lineColor) ? edge.attributes.lineColor : this.theme.edgeColor;
      const colorMarker = (reference: string | undefined): string | undefined => {
        if (!reference || lineColor === this.theme.edgeColor) return reference;
        const id = reference.slice(5,-1);
        const original = this.svg.querySelector(`[id="${id}"]`);
        if (!original) return reference;
        const coloredId = `${id}-edge-${index}`;
        this.svg.querySelector(`[id="${coloredId}"]`)?.remove();
        const copy = original.cloneNode(true) as SVGElement;
        copy.setAttribute("id",coloredId);
        for (const part of Array.from(copy.querySelectorAll("[stroke], [fill]"))) {
          if (part.getAttribute("stroke") === this.theme.edgeColor) part.setAttribute("stroke",lineColor);
          if (part.getAttribute("fill") === this.theme.edgeColor) part.setAttribute("fill",lineColor);
        }
        this.svg.querySelector("defs")!.append(copy);
        return `url(#${coloredId})`;
      };
      const path = svgElement(this.document, "path", {
        d: pathWithEdgeJumps(edge, geometry.edges.slice(0, index)),
        fill: "none",
        stroke: lineColor,
        "stroke-width": Number.isFinite(Number(edge.attributes?.thickness)) && Number(edge.attributes?.thickness) > 0 ? Number(edge.attributes?.thickness) : this.theme.edgeWidth * (edge.attributes?.lineStyle === "bold" ? 2 : 1),
        "stroke-dasharray": edge.attributes?.lineStyle === "plain" ? undefined
          : edge.attributes?.lineStyle === "dotted" ? "1 5"
          : edge.attributes?.lineStyle === "dashed" || edge.dashed || ["dependency", "realization"].includes(relation ?? "") ? "6 5" : undefined,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        "marker-start": colorMarker(markerStart),
        "marker-end": colorMarker(markerEnd),
        class: "finch-edge",
        "data-edge-id": edge.id,
      });
      layer.append(path);
      this.edgeElements.set(edge.id, path);
      const cardinalities = [
        ["start", endpointText(edge, "start"), cardinalityPoint(edge, "start")],
        ["end", endpointText(edge, "end"), cardinalityPoint(edge, "end")],
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
          class: "finch-cardinality",
          "data-edge-id": edge.id,
          "data-endpoint": endpoint,
        });
        cardinality.textContent = value;
        layer.append(cardinality);
      }
      if (edge.label) {
        const point = this.labelPlacements.get(edge.id)!.point;
        const text = svgElement(this.document, "text", {
          x: point.x,
          y: point.y,
          "text-anchor": "middle",
          fill: this.theme.mutedColor,
          "font-family": this.theme.fontFamily,
          "font-size": this.theme.fontSize - 1,
          class: "finch-edge-label",
          "data-edge-id": edge.id,
        });
        this.setEdgeLabel(text, this.labelPlacements.get(edge.id)!);
        layer.append(text);
        this.edgeLabelElements.set(edge.id, text);
      }
    }
    return layer;
  }

  private createDiagramText(geometry:Geometry):SVGGElement {
    const layer=svgElement(this.document,'g',{class:'finch-diagram-text'});
    for(const block of geometry.diagramText?.blocks ?? []){
      const x=(geometry.origin?.x ?? 0)+geometry.width/2;
      const y=block.y+((block.kind==='footer' || block.kind==='legend') ? (geometry.origin?.y ?? 0)+geometry.height-geometry.diagramText!.bottom-12 : 12+(geometry.kind!=="sequence" ? geometry.origin?.y ?? 0 : 0));
      if(block.kind==='legend')layer.append(svgElement(this.document,'rect',{x:x-144,y:y-block.fontSize-8,width:288,height:block.lines.length*block.lineHeight+20,rx:this.theme.nodeRadius,fill:this.theme.containerFill,stroke:this.theme.containerStroke,class:'finch-diagram-legend-frame'}));
      const text=svgElement(this.document,'text',{x,y,fill:this.theme.labelColor,'font-family':this.theme.fontFamily,'font-size':block.fontSize,'font-weight':block.kind==='title'?700:400,'text-anchor':'middle',class:`finch-diagram-${block.kind}`});
      block.lines.forEach((line,index)=>{const span=svgElement(this.document,'tspan',{x,y:y+index*block.lineHeight});span.textContent=line;text.append(span);});
      layer.append(text);
    }
    return layer;
  }

  private createLifelines(geometry: Geometry): SVGGElement {
    const layer = svgElement(this.document, "g", { class: "finch-lifelines" });
    for (const node of geometry.nodes) {
      if (node.attributes.annotationTarget) continue;
      const x = node.x + node.width / 2;
      const events = JSON.parse(node.attributes.sequencePositions ?? "[]") as Array<{ kind: string; y: number }>;
      let alive = !events.some(e=>e.kind === "create");
      let start = node.y + node.height;
      const frames: Array<{base:boolean;ends:boolean[]}> = [];
      const draw = (end:number) => {
        if (alive && end > start) layer.append(svgElement(this.document,"line", {x1:x,x2:x,y1:start,y2:end,stroke:this.theme.nodeStroke,"stroke-width":1,"stroke-dasharray":"5 5",class:"finch-lifeline","data-node-id":node.id}));
      };
      for (const event of events) {
        if (event.kind === "branch-save") frames.push({base:alive,ends:[]});
        if (event.kind === "branch-reset" || event.kind === "branch-end") {
          const frame=frames[frames.length-1];
          if(frame) { frame.ends.push(alive); draw(event.y); alive=event.kind === "branch-reset" ? frame.base : frame.ends.every(Boolean); start=event.y; if(event.kind === "branch-end") frames.pop(); }
        }
        if (event.kind === "create") {
          alive=true; start=event.y + node.height/2;
          if (node.attributes.branchLifetime) {
            const createdNode={...node,y:event.y-node.height/2};
            const header=this.resolveShape(node.shape).render({node:createdNode,theme:nodeTheme(node,geometry.nodes,this.theme),document:this.document});
            header.classList.add('finch-created-header');header.setAttribute('data-node-id',node.id);
            header.setAttribute('transform',`translate(${node.x} ${createdNode.y})`);
            layer.append(header);
          }
        }
        if(event.kind === "destroy") {
          draw(event.y); alive=false;
          layer.append(svgElement(this.document,"path",{d:`M ${x-7} ${event.y-7} l 14 14 M ${x+7} ${event.y-7} l -14 14`,stroke:this.theme.edgeColor,"stroke-width":2,class:"finch-destruction","data-node-id":node.id}));
        }
      }
      const footY=(geometry.origin?.y ?? 0)+geometry.height-32-(geometry.diagramText?.bottom ?? 0)-Math.max(0,...geometry.nodes.filter(n=>n.attributes.footbox==='true').map(n=>n.height+40));
      draw(footY);
      if(alive && node.attributes.footbox==='true'){
        const footNode={...node,y:footY};
        const foot=this.resolveShape(node.shape).render({node:footNode,theme:nodeTheme(node,geometry.nodes,this.theme),document:this.document});
        foot.classList.add('finch-footbox');foot.setAttribute('data-node-id',node.id);
        foot.setAttribute('transform',`translate(${node.x} ${footY})`);layer.append(foot);
      }
    }
    return layer;
  }

  private createActivations(geometry: Geometry): SVGGElement {
    const layer = svgElement(this.document, "g", { class: "finch-activations" });
    const nodeMap = new Map(geometry.nodes.map((node) => [node.id, node]));
    const intervals: Array<{ nodeId:string; start:number; end:number; depth:number }> = [];
    for (const node of geometry.nodes) {
      const events = JSON.parse(node.attributes.sequencePositions ?? "[]") as Array<{kind:string;y:number;at:number;serial?:number}>;
      const timeline = node.attributes.explicitActivation ? events : [
        ...events.filter(e=>e.kind.startsWith("branch-") || e.kind === "destroy"),
        ...geometry.edges.flatMap((edge,at)=> {
          if (edge.attributes?.annotation || ["async","create","ref","delay","divider","note"].includes(edge.attributes?.messageKind ?? "")) return [];
          const kind = edge.dashed && edge.from === node.id ? "deactivate" : !edge.dashed && edge.to === node.id ? "activate" : undefined;
          return kind ? [{kind,y:edge.points[kind === "activate" ? edge.points.length-1 : 0]?.y ?? 0,at:at+0.5,serial:0}] : [];
        }),
      ].sort((a,b)=>a.at-b.at || (a.serial ?? 0)-(b.serial ?? 0));
      let active: Array<{start:number;depth:number}> = [];
      const frames: Array<{base:number;ends:number[]}> = [];
      const close = (y:number) => { for (const item of active) intervals.push({nodeId:node.id,...item,end:y}); };
      const resume = (depth:number,y:number) => { active = Array.from({length:depth},(_,depth)=>({start:y,depth})); };
      for (const event of timeline) {
        if (event.kind === "branch-save") frames.push({base:active.length,ends:[]});
        if (event.kind === "branch-reset" || event.kind === "branch-end") {
          const frame = frames[frames.length-1];
          if (frame) { frame.ends.push(active.length); close(event.y); resume(event.kind === "branch-reset" ? frame.base : Math.min(...frame.ends),event.y); if (event.kind === "branch-end") frames.pop(); }
        }
        if (event.kind === "activate") {
          const created=events.filter(e=>e.kind === "create" && e.at <= event.at).slice(-1)[0];
          active.push({start:created ? Math.max(event.y,created.y+node.height/2) : event.y,depth:active.length});
        }
        if (event.kind === "deactivate") { const start=active.pop(); if(start) intervals.push({nodeId:node.id,...start,end:event.y}); }
        if (event.kind === "destroy") { close(event.y); active=[]; }
      }
      close(geometry.height-38-(geometry.diagramText?.bottom ?? 0)-Math.max(0,...geometry.nodes.filter(n=>n.attributes.footbox==="true").map(n=>n.height+40)));
    }

    const merged: typeof intervals = [];
    for (const interval of intervals.filter(i=>i.end>i.start).sort((a,b)=>a.nodeId.localeCompare(b.nodeId) || a.depth-b.depth || a.start-b.start)) {
      const previous=merged[merged.length-1];
      if(previous && previous.nodeId === interval.nodeId && previous.depth === interval.depth && previous.end === interval.start) previous.end=interval.end;
      else merged.push({...interval});
    }
    for (const interval of merged) {
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
        class: "finch-activation",
        "data-node-id": interval.nodeId,
        "data-x-offset": offset,
      }));
    }
    return layer;
  }

  private createDefinitions(): SVGDefsElement {
    const defs = svgElement(this.document, "defs");
    const dot=svgElement(this.document,"marker",{id:"finch-message-dot",viewBox:"0 0 10 10",refX:5,refY:5,markerWidth:8,markerHeight:8,orient:"auto"});
    dot.append(svgElement(this.document,"circle",{cx:5,cy:5,r:4,fill:this.theme.edgeColor}));defs.append(dot);
    for (const [name, d] of Object.entries({
      square: "M 1 1 H 9 V 9 H 1 Z",
      crowfoot: "M 9 1 L 1 5 L 9 9 M 1 5 H 9",
      "circle-cross": "M 9 5 A 4 4 0 1 0 1 5 A 4 4 0 1 0 9 5 M 1 5 H 9 M 5 1 V 9",
      triangle: "M 1 1 L 9 5 L 1 9 Z",
    })) {
      const decoration = svgElement(this.document, "marker", { id: `finch-decoration-${name}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, orient: "auto-start-reverse" });
      decoration.append(svgElement(this.document, "path", { d, fill: name === "crowfoot" ? "none" : this.theme.nodeFill, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
      defs.append(decoration);
    }
    const nonNavigable=svgElement(this.document,"marker",{id:"finch-non-navigable",viewBox:"0 0 10 10",refX:9,refY:5,markerWidth:8,markerHeight:8,orient:"auto-start-reverse"});
    nonNavigable.append(svgElement(this.document,"path",{d:"M 2 2 L 8 8 M 8 2 L 2 8",fill:"none",stroke:this.theme.edgeColor,"stroke-width":1.5}));defs.append(nonNavigable);
    const openArrow = svgElement(this.document, "marker", { id: "finch-open-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
    openArrow.append(svgElement(this.document, "path", { d: "M 1 1 L 9 5 L 1 9", fill: "none", stroke: this.theme.edgeColor, "stroke-width": 1.4 })); defs.append(openArrow);
    const marker = svgElement(this.document, "marker", {
      id: "finch-arrow",
      viewBox: "0 0 10 10",
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: "auto-start-reverse",
    });
    marker.append(svgElement(this.document, "path", { d: "M 0 0 L 10 5 L 0 10 z", fill: this.theme.edgeColor }));
    const triangle = svgElement(this.document, "marker", {
      id: "finch-triangle",
      viewBox: "0 0 12 12",
      refX: 11,
      refY: 6,
      markerWidth: 9,
      markerHeight: 9,
      orient: "auto-start-reverse",
    });
    triangle.append(svgElement(this.document, "path", { d: "M 1 1 L 11 6 L 1 11 Z", fill: this.theme.canvasColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
    const openDiamond = svgElement(this.document, "marker", {
      id: "finch-diamond-open",
      viewBox: "0 0 14 10",
      refX: 13,
      refY: 5,
      markerWidth: 11,
      markerHeight: 9,
      orient: "auto-start-reverse",
    });
    openDiamond.append(svgElement(this.document, "path", { d: "M 1 5 L 7 1 L 13 5 L 7 9 Z", fill: this.theme.canvasColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
    const filledDiamond = svgElement(this.document, "marker", {
      id: "finch-diamond-filled",
      viewBox: "0 0 14 10",
      refX: 13,
      refY: 5,
      markerWidth: 11,
      markerHeight: 9,
      orient: "auto-start-reverse",
    });
    filledDiamond.append(svgElement(this.document, "path", { d: "M 1 5 L 7 1 L 13 5 L 7 9 Z", fill: this.theme.edgeColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
    const filter = svgElement(this.document, "filter", { id: "finch-shadow", x: "-20%", y: "-30%", width: "140%", height: "170%" });
    filter.append(svgElement(this.document, "feDropShadow", { dx: 0, dy: 2, stdDeviation: 2.5, "flood-color": "#0f172a", "flood-opacity": 0.10 }));
    defs.append(marker, triangle, openDiamond, filledDiamond, filter);
    return defs;
  }

  private createStyles(): SVGStyleElement {
    const style = svgElement(this.document, "style");
    style.textContent = `
      .finch-node { cursor: grab; outline: none; }
      .finch-node:active { cursor: grabbing; }
      .finch-node > :first-child { transition: stroke 120ms ease, stroke-width 120ms ease; }
      .finch-node.is-selected > :first-child { stroke: ${this.theme.accentColor}; stroke-width: 2.4; }
      .finch-node.is-pinned::after { content: ""; }
      .finch-container-headings { cursor: grab; }
      .finch-container-headings text { paint-order: stroke; stroke: ${this.theme.canvasColor}; stroke-width: 5px; stroke-linejoin: round; }
      .finch-canvas.is-view-only, .finch-canvas.is-view-only .finch-node { cursor: grab; }
      .finch-canvas.is-panning { cursor: grabbing; user-select: none; }
      .finch-canvas.is-panning .finch-node { cursor: grabbing; }
      .finch-edge { pointer-events: none; }
      .finch-activation { pointer-events: none; }
      .finch-edge-label { paint-order: stroke; stroke: ${this.theme.canvasColor}; stroke-width: 5px; stroke-linejoin: round; }
      .finch-cardinality { paint-order: stroke; stroke: ${this.theme.canvasColor}; stroke-width: 5px; stroke-linejoin: round; pointer-events: none; }
      .finch-canvas:focus-visible { outline: 2px solid ${this.theme.accentColor}; outline-offset: 2px; }
    `;
    return style;
  }
}

function cssEscape(value: string): string {
  const css = globalThis.CSS;
  return css?.escape ? css.escape(value) : value.replace(/["\\]/g, "\\$&");
}
