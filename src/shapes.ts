import {requiredInterfacePath} from "./interface-geometry.js";
import type { ShapeMeasureContext, ShapePlugin, ShapeRenderContext, Size } from "./types.js";
import { svgElement } from "./utils.js";
import { labelLayout, nodeLabelLayout, textWidth, wrapWidth } from "./text-layout.js";

const MAX_NODE_LABEL_WIDTH = 216;
const DATABASE_CAP = 10;
const COMPACT_LABEL_WIDTH = 120;

function wrappedLabelSize(
  label: string,
  context: { theme: ShapeRenderContext["theme"]; attributes?: Record<string, string> },
  options: { minimumWidth?: number; minimumHeight?: number; maximumTextWidth?: number; paddingX?: number; paddingY?: number } = {},
): Size {
  const fontSize = context.theme.fontSize;
  const paddingX = options.paddingX ?? context.theme.nodePaddingX;
  const paddingY = options.paddingY ?? context.theme.nodePaddingY;
  const lineHeight = Math.ceil(fontSize * 1.4);
  const lines = nodeLabelLayout(label, context.attributes, context.theme, options.maximumTextWidth ?? MAX_NODE_LABEL_WIDTH).lines;
  return {
    width: Math.max(options.minimumWidth ?? 104, ...lines.map((line) => textWidth(line, fontSize, context.theme.fontFamily) + paddingX * 2)),
    height: Math.max(options.minimumHeight ?? 46, lines.length * lineHeight + paddingY * 2),
  };
}

function baseSize(label: string, context: { theme: ShapeRenderContext["theme"]; attributes?: Record<string, string> }): Size {
  return wrappedLabelSize(label, context);
}

function addLabel(group: SVGGElement, context: ShapeRenderContext, yOffset = 0, paddingX = context.theme.nodePaddingX, maximum = MAX_NODE_LABEL_WIDTH): void {
  const { node, theme, document } = context;
  const lines = labelLayout(node.label, Math.min(wrapWidth(node.attributes, maximum), Math.max(theme.fontSize, node.width - paddingX * 2)), theme.fontSize, theme.fontFamily).lines;
  const lineHeight = Math.ceil(theme.fontSize * 1.4);
  const text = svgElement(document, "text", {
    x: node.width / 2,
    y: node.height / 2 + yOffset - (lines.length - 1) * lineHeight / 2,
    "text-anchor": "middle",
    "dominant-baseline": "middle",
    fill: theme.labelColor,
    "font-family": theme.fontFamily,
    "font-size": theme.fontSize,
    "font-weight": 560,
  });
  if (lines.length === 1) {
    text.textContent = lines[0]!;
  } else {
    lines.forEach((line, index) => {
      const span = svgElement(document, "tspan", { x: node.width / 2, y: node.height / 2 + yOffset - (lines.length - 1) * lineHeight / 2 + index * lineHeight });
      span.textContent = line;
      text.append(span);
    });
  }
  group.append(text);
}

function groupFor(context: ShapeRenderContext): SVGGElement {
  return svgElement(context.document, "g", {
    class: `finch-shape finch-shape-${context.node.shape}`,
    "data-node-id": context.node.id,
    transform: `translate(${context.node.x} ${context.node.y})`,
  });
}

function setTextLines(text: SVGTextElement, value: string, width: number, fontSize: number, family: string, weight = 560): number {
  const layout = labelLayout(value, width, fontSize, family, weight);
  if (layout.lines.length === 1) text.textContent = layout.lines[0]!;
  else for (const [index, line] of layout.lines.entries()) {
    const span = svgElement(text.ownerDocument, "tspan", { x: text.getAttribute("x") ?? "0", y: Number(text.getAttribute("y")) + index * layout.lineHeight });
    span.textContent = line;
    text.append(span);
  }
  return layout.height;
}

export const rectangleShape: ShapePlugin = {
  name: "rectangle",
  measure: ({ label, theme, attributes }) => baseSize(label, { theme, attributes }),
  render(context) {
    const group = groupFor(context);
    group.append(svgElement(context.document, "rect", {
      width: context.node.width,
      height: context.node.height,
      rx: context.theme.nodeRadius,
      fill: context.theme.nodeFill,
      stroke: context.theme.nodeStroke,
      "stroke-width": context.theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    addLabel(group, context);
    return group;
  },
};

export const collectionsShape: ShapePlugin = {
  name: "collections",
  measure: ({label, theme, attributes}) => wrappedLabelSize(label, {theme, attributes}, {
    minimumWidth: 120, minimumHeight: 64, paddingX: 28, paddingY: 20,
  }),
  render(context) {
    const {node, theme, document} = context;
    const group=groupFor(context);
    for(const offset of [8,4,0])group.append(svgElement(document,"rect",{
      x:offset,y:8-offset,width:node.width-8,height:node.height-8,
      fill:theme.nodeFill,stroke:theme.nodeStroke,"stroke-width":theme.nodeStrokeWidth,
    }));
    addLabel(group,context,4,28);
    return group;
  },
};

export const stackShape: ShapePlugin = {...collectionsShape, name: "stack"};

export const labelShape: ShapePlugin = {
  name: "label",
  measure: ({label, theme, attributes}) => wrappedLabelSize(label, {theme, attributes}, {
    minimumWidth: 24, minimumHeight: 24, paddingX: 8, paddingY: 6,
  }),
  render(context) {
    const group = groupFor(context);
    // A transparent hit area keeps multiline labels easy to drag.
    group.append(svgElement(context.document, "rect", {
      width: context.node.width, height: context.node.height,
      fill: "transparent", stroke: "none",
    }));
    addLabel(group, context, 0, 8);
    return group;
  },
};

export const roundedShape: ShapePlugin = {
  ...rectangleShape,
  name: "rounded",
  render(context) {
    const group = groupFor(context);
    group.append(svgElement(context.document, "rect", {
      width: context.node.width,
      height: context.node.height,
      rx: Math.min(context.node.height / 2, 24),
      fill: context.theme.nodeFill,
      stroke: context.theme.nodeStroke,
      "stroke-width": context.theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    addLabel(group, context);
    return group;
  },
};

export const processShape: ShapePlugin = {
  name: "process",
  measure: ({label, theme, attributes}) => wrappedLabelSize(label, {theme, attributes}, {minimumWidth: 120, minimumHeight: 52, paddingX: 32}),
  render(context) {
    const {node, theme, document} = context;
    const group = groupFor(context);
    group.append(svgElement(document, "path", {d: containerOutlinePath({...node, attributes: {...node.attributes, containerStyle: "process"}}, theme), fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth}));
    addLabel(group, context, 0, 32);
    return group;
  },
};

export const storageShape: ShapePlugin = {
  ...roundedShape,
  name: "storage",
  render(context) {
    const group = roundedShape.render(context);
    group.querySelector("rect")?.setAttribute("rx", String(Math.min(35, context.node.width / 2, context.node.height / 2)));
    return group;
  },
};

export const databaseShape: ShapePlugin = {
  name: "database",
  measure: ({ label, theme, attributes }) => {
    const size = baseSize(label, { theme, attributes });
    return { width: Math.max(110, size.width), height: Math.max(60, nodeLabelLayout(label, attributes, theme).height + theme.nodePaddingY * 2 + DATABASE_CAP * 3) };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    const cap = DATABASE_CAP;
    const path = [
      `M 0 ${cap}`,
      `A ${node.width / 2} ${cap} 0 0 1 ${node.width} ${cap}`,
      `L ${node.width} ${node.height - cap}`,
      `A ${node.width / 2} ${cap} 0 0 1 0 ${node.height - cap}`,
      "Z",
    ].join(" ");
    group.append(svgElement(document, "path", {
      d: path,
      fill: theme.nodeFill,
      stroke: theme.nodeStroke,
      "stroke-width": theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    group.append(svgElement(document, "ellipse", {
      cx: node.width / 2,
      cy: cap,
      rx: node.width / 2,
      ry: cap,
      fill: theme.nodeFill,
      stroke: theme.nodeStroke,
      "stroke-width": theme.nodeStrokeWidth,
    }));
    // Center the label between the bottom of the lid and the bottom cap.
    addLabel(group, context, cap / 2);
    return group;
  },
};

export const hexagonShape: ShapePlugin = {
  name: "hexagon",
  measure: ({label, theme, attributes}) => wrappedLabelSize(label, {theme, attributes}, {paddingX: 32, minimumHeight: 56}),
  render(context) {
    const {node, theme, document} = context;
    const group = groupFor(context);
    group.append(svgElement(document, "path", {
      d: `M20 0 H${node.width-20} L${node.width} ${node.height/2} L${node.width-20} ${node.height} H20 L0 ${node.height/2} Z`,
      fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    addLabel(group, context, 0, 32);
    return group;
  },
};

export const cardShape: ShapePlugin = {
  name: "card",
  measure: ({label, theme, attributes}) => wrappedLabelSize(label, {theme, attributes}, {paddingX: 24, minimumHeight: 56}),
  render(context) {
    const {node, theme, document} = context;
    const group = groupFor(context);
    group.append(svgElement(document, "path", {
      d: `M16 0 H${node.width} V${node.height} H0 V16 Z`,
      fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    addLabel(group, context, 0, 24);
    return group;
  },
};

export const queueShape: ShapePlugin = {
  name: "queue",
  measure: ({label, theme, attributes}) => wrappedLabelSize(label, {theme, attributes}, {
    minimumWidth: 120, minimumHeight: 52, paddingX: theme.nodePaddingX + 20,
  }),
  render(context) {
    const {node, theme, document} = context;
    const group = groupFor(context);
    const cap = Math.min(10, node.width / 4);
    group.append(svgElement(document, "path", {
      d: `M ${cap} 0 H ${node.width-cap} A ${cap} ${node.height/2} 0 0 1 ${node.width-cap} ${node.height} H ${cap} A ${cap} ${node.height/2} 0 0 1 ${cap} 0 Z`,
      fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    group.append(svgElement(document, "ellipse", {
      cx: node.width-cap, cy: node.height/2, rx: cap, ry: node.height/2,
      fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth,
    }));
    addLabel(group, context, 0, theme.nodePaddingX + 20);
    return group;
  },
};

export const personShape: ShapePlugin = {
  name: "person",
  measure: ({label, theme, attributes}) => {
    const body = wrappedLabelSize(label, {theme, attributes}, {minimumWidth: 100, minimumHeight: 48, paddingX: 28, paddingY: 20});
    return {...body, height: body.height + 32};
  },
  render(context) {
    const {node, theme, document} = context;
    const group = groupFor(context);
    const style = {fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth};
    group.append(svgElement(document, "circle", {cx: node.width / 2, cy: 16, r: 16, ...style}));
    group.append(svgElement(document, "rect", {x: 0, y: 32, width: node.width, height: node.height - 32, rx: 16, ...style}));
    addLabel(group, context, 16, 28);
    return group;
  },
};

export const actorShape: ShapePlugin = {
  name: "actor",
  measure: ({ label, theme, attributes }) => {
    const text = nodeLabelLayout(label, attributes, theme);
    return { width: Math.max(84, text.width + 22), height: 62 + text.height };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    // Include the empty space between limbs in the actor's drag target.
    group.append(svgElement(document, "rect", {
      x: 0, y: 0, width: node.width, height: node.height,
      fill: "transparent", "pointer-events": "all", class: "finch-actor-hit-area",
    }));
    const cx = node.width / 2;
    const stroke = { fill: "none", stroke: theme.edgeColor, "stroke-width": 1.7, "stroke-linecap": "round" } as const;
    group.append(svgElement(document, "circle", { cx, cy: 10, r: 8, fill: theme.nodeFill, stroke: theme.edgeColor, "stroke-width": 1.7 }));
    if(node.attributes.business === "true")group.append(svgElement(document,"line",{
      x1:cx-2,y1:10+Math.sqrt(60),x2:cx+Math.sqrt(60),y2:8,
      stroke:theme.edgeColor,"stroke-width":1.7,class:"finch-business-mark",
    }));
    group.append(svgElement(document, "path", { d: `M ${cx} 18 L ${cx} 42 M ${cx - 16} 28 L ${cx + 16} 28 M ${cx} 42 L ${cx - 12} 56 M ${cx} 42 L ${cx + 12} 56`, ...stroke }));
    const label = svgElement(document, "text", {
      x: cx,
      y: 72,
      "text-anchor": "middle",
      fill: theme.labelColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize,
      "font-weight": 560,
    });
    setTextLines(label, node.label, Math.min(node.width - 22, wrapWidth(node.attributes, 216)), theme.fontSize, theme.fontFamily);
    group.append(label);
    return group;
  },
};

export const sequenceRoleShapes: ShapePlugin[] = ['boundary','control','entity','collections','queue'].map(role=>({
  ...actorShape,
  name:`sequence-${role}`,
  render(context) {
    const group=actorShape.render(context);
    for(const child of [...group.children])if(child.tagName!=='text')child.remove();
    const {node,theme,document}=context,cx=node.width/2;
    const symbol=svgElement(document,'g',{class:`finch-sequence-${role}`,fill:'none',stroke:theme.edgeColor,'stroke-width':1.7,'stroke-linecap':'round'});
    if(role==='collections') {
      symbol.append(svgElement(document,'rect',{x:cx-18,y:10,width:40,height:36,fill:theme.nodeFill}));
      symbol.append(svgElement(document,'rect',{x:cx-24,y:16,width:40,height:36,fill:theme.nodeFill}));
      group.prepend(symbol);return group;
    }
    if(role==='queue') {
      symbol.append(svgElement(document,'path',{d:`M${cx-24} 12 H${cx+20} C${cx+32} 12 ${cx+32} 48 ${cx+20} 48 H${cx-24} C${cx-36} 48 ${cx-36} 12 ${cx-24} 12 Z`,fill:theme.nodeFill}));
      symbol.append(svgElement(document,'ellipse',{cx:cx-24,cy:30,rx:8,ry:18,fill:theme.nodeFill}));
      group.prepend(symbol);return group;
    }
    symbol.append(svgElement(document,'circle',{cx,cy:30,r:18,fill:theme.nodeFill}));
    const d=role==='boundary' ? `M${cx-30} 12 V48 M${cx-30} 30 H${cx-18}` : role==='control' ? `M${cx} 12 l-7 -6 M${cx} 12 l-7 6` : `M${cx-23} 52 H${cx+23}`;
    symbol.append(svgElement(document,'path',{d}));group.prepend(symbol);return group;
  },
}));

export function containerOutlinePath(node: ShapeRenderContext["node"], theme: ShapeRenderContext["theme"]): string {
      const tab=Math.min(node.width-24,Math.max(64,labelLayout(node.label,wrapWidth(node.attributes,216),theme.fontSize-1,theme.fontFamily,650).width+32));
      const header=node.headerHeight ?? 42;
      const radius=node.attributes.containerStyle === "storage" ? Math.min(35,node.width/2,node.height/2) : 12;
      return node.attributes.containerStyle === "process"
        ? `M0 0 H${node.width-12} L${node.width} ${node.height/2} L${node.width-12} ${node.height} H0 L12 ${node.height/2} Z`
        : ["action","storage"].includes(node.attributes.containerStyle ?? "")
        ? `M${radius} 0 H${node.width-radius} Q${node.width} 0 ${node.width} ${radius} V${node.height-radius} Q${node.width} ${node.height} ${node.width-radius} ${node.height} H${radius} Q0 ${node.height} 0 ${node.height-radius} V${radius} Q0 0 ${radius} 0 Z`
        : ["file","artifact"].includes(node.attributes.containerStyle ?? "")
        ? `M0 0 H${node.width-16} L${node.width} 16 V${node.height} H0 Z M${node.width-16} 0 V16 H${node.width}`
        : node.attributes.containerStyle === "stack"
        ? `M8 0 H${node.width} V${node.height-8} H${node.width-4} M4 4 H${node.width-4} V${node.height-4} H${node.width-8} M0 8 H${node.width-8} V${node.height} H0 Z`
        : node.attributes.containerStyle === "hexagon"
        ? `M20 0 H${node.width-20} L${node.width} ${node.height/2} L${node.width-20} ${node.height} H20 L0 ${node.height/2} Z`
        : node.attributes.containerStyle === "card"
        ? `M16 0 H${node.width} V${node.height} H0 V16 Z`
        : node.attributes.containerStyle === "queue"
        ? `M10 0 H${node.width-10} A10 ${node.height/2} 0 0 1 ${node.width-10} ${node.height} H10 A10 ${node.height/2} 0 0 1 10 0 Z M${node.width-10} 0 A10 ${node.height/2} 0 0 0 ${node.width-10} ${node.height}`
        : node.attributes.containerStyle === "cloud"
        ? `M20 20 C0 20 0 50 12 56 V${node.height-50} C0 ${node.height-30} 12 ${node.height} 40 ${node.height-12} H${node.width-40} C${node.width-10} ${node.height} ${node.width} ${node.height-20} ${node.width-12} ${node.height-44} V50 C${node.width} 30 ${node.width-8} 12 ${node.width-30} 18 C${node.width-35} 0 ${node.width-70} 0 ${node.width-82} 14 H80 C65 0 30 0 20 20 Z`
        : node.attributes.containerStyle === "database"
        ? `M0 10 C0 -3 ${node.width} -3 ${node.width} 10 V${node.height-10} C${node.width} ${node.height+3} 0 ${node.height+3} 0 ${node.height-10} Z M0 10 C0 23 ${node.width} 23 ${node.width} 10`
        : node.attributes.containerStyle === "node"
        ? `M0 10 L10 0 H${node.width} V${node.height-10} L${node.width-10} ${node.height} H0 Z M0 10 H${node.width-10} L${node.width} 0 M${node.width-10} 10 V${node.height}`
        : node.attributes.containerStyle === "folder"
        ? `M0 0 H${tab} L${tab+12} 12 H${node.width} V${node.height} H0 Z`
        : `M0 0 H${node.width} V${node.height} H0 Z M0 ${header-10} H${tab} L${tab+10} ${header-20} V0`;
}

export const containerShape: ShapePlugin = {
  name: "container",
  measure: ({ label, theme, attributes }) => {
    const text = labelLayout(label, wrapWidth(attributes, 216), theme.fontSize - 1, theme.fontFamily, 650);
    const headerHeight = (attributes.containerStyle === "cloud" ? 62 : attributes.containerStyle === "database" ? 56 : 42) + (text.lines.length - 1) * text.lineHeight;
    return { width: Math.max(168, text.width + (attributes.containerStyle === "component" ? 72 : ["queue","hexagon"].includes(attributes.containerStyle ?? "") ? 60 : 42)), height: Math.max(110, headerHeight + 26), headerHeight };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.classList.add("finch-container");
    group.append(svgElement(document, "rect", {
      width: node.width,
      height: node.height,
      rx: theme.nodeRadius + 2,
      fill: node.attributes.stateKind === "region" ? "transparent" : theme.containerFill,
      stroke: node.attributes.stateKind === "region" ? "none" : theme.containerStroke,
      "stroke-width": theme.nodeStrokeWidth,
      "stroke-dasharray": node.attributes.stateKind === "state" || node.attributes.containerStyle === "component" ? "none" : "5 4",
    }));
    if(node.attributes.containerStyle === "component" && node.attributes.componentStyle !== "rectangle"){
      const mark=svgElement(document,"g",{class:"finch-component-group-mark",transform:node.attributes.componentStyle==="uml1"?"translate(0 0)":`translate(${node.width-30} 10)`,fill:theme.containerFill,stroke:theme.containerStroke,"stroke-width":theme.nodeStrokeWidth});
      if(node.attributes.componentStyle==="uml1")mark.append(svgElement(document,"rect",{x:-6,y:10,width:12,height:7}),svgElement(document,"rect",{x:-6,y:24,width:12,height:7}));
      else mark.append(svgElement(document,"rect",{x:5,y:0,width:14,height:18}),svgElement(document,"rect",{x:0,y:3,width:9,height:4}),svgElement(document,"rect",{x:0,y:11,width:9,height:4}));
      group.append(mark);
    }
    if (["folder","frame","node","database","cloud","queue","file","artifact","card","hexagon","stack","action","storage","process"].includes(node.attributes.containerStyle ?? "")) {
      group.querySelector("rect")?.remove();
      const d=containerOutlinePath(node, theme);
      group.append(svgElement(document,"path",{d,fill:theme.containerFill,stroke:theme.containerStroke,"stroke-width":theme.nodeStrokeWidth,class:`finch-${node.attributes.containerStyle}-outline`}));
    }
    if (node.attributes.stateKind === "region" && node.attributes.regionDivider === "true") group.append(svgElement(document, "path", { d: node.attributes.regionDirection === "rows" ? `M-28 -16 H${node.width + 28}` : `M-16 -28 V${node.height + 28}`, stroke: theme.containerStroke, "stroke-dasharray":"5 4", fill:"none", class:"finch-region-divider" }));
    const text = svgElement(document, "text", {
      x: ["queue","hexagon"].includes(node.attributes.containerStyle ?? "") ? 26 : 16,
      y: node.attributes.containerStyle === "cloud" ? 43 : node.attributes.containerStyle === "database" ? 37 : 23,
      fill: theme.mutedColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize - 1,
      "font-weight": 650,
    });
    setTextLines(text, node.label, Math.min(node.width - (node.attributes.containerStyle === "component" ? 56 : ["queue","hexagon"].includes(node.attributes.containerStyle ?? "") ? 52 : 32), wrapWidth(node.attributes, 216)), theme.fontSize - 1, theme.fontFamily, 650);
    group.append(text);
    return group;
  },
};

export const serverShape: ShapePlugin = {
  ...rectangleShape,
  name: "server",
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", {
      width: node.width,
      height: node.height,
      rx: theme.nodeRadius,
      fill: theme.nodeFill,
      stroke: theme.nodeStroke,
      "stroke-width": theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    group.append(svgElement(document, "line", { x1: 13, y1: 18, x2: 13, y2: node.height - 18, stroke: theme.accentColor, "stroke-width": 3, "stroke-linecap": "round" }));
    addLabel(group, context);
    return group;
  },
};

export const diamondShape: ShapePlugin = {
  name: "diamond",
  measure: ({ label, theme, attributes }) => {
    const text = nodeLabelLayout(label, attributes, theme, COMPACT_LABEL_WIDTH);
    return { width: Math.max(148, (text.width + 16) * 2), height: Math.max(86, (text.height + 12) * 2) };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "polygon", {
      points: `${node.width / 2},0 ${node.width},${node.height / 2} ${node.width / 2},${node.height} 0,${node.height / 2}`,
      fill: theme.nodeFill,
      stroke: theme.nodeStroke,
      "stroke-width": theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    addLabel(group, context, 0, 27, COMPACT_LABEL_WIDTH);
    return group;
  },
};

export const parallelogramShape: ShapePlugin = {
  name: "parallelogram",
  measure: ({ label, theme, attributes }) => {
    const size = baseSize(label, { theme, attributes });
    return { width: Math.max(124, size.width + 22), height: size.height };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    const slant = 16;
    group.append(svgElement(document, "polygon", {
      points: `${slant},0 ${node.width},0 ${node.width - slant},${node.height} 0,${node.height}`,
      fill: theme.nodeFill,
      stroke: theme.nodeStroke,
      "stroke-width": theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    addLabel(group, context, 0, context.theme.nodePaddingX + 11);
    return group;
  },
};

export const circleShape: ShapePlugin = {
  name: "circle",
  measure: ({ label, theme, attributes }) => {
    const size = wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 64, minimumHeight: 64, paddingX: 15, paddingY: 15, maximumTextWidth: COMPACT_LABEL_WIDTH });
    const diameter = Math.ceil(Math.hypot(size.width, size.height));
    return { width: diameter, height: diameter };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "circle", {
      cx: node.width / 2,
      cy: node.height / 2,
      r: Math.min(node.width, node.height) / 2,
      fill: theme.nodeFill,
      stroke: theme.nodeStroke,
      "stroke-width": theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    addLabel(group, context, 0, 15, COMPACT_LABEL_WIDTH);
    return group;
  },
};

export const initialStateShape: ShapePlugin = {
  name: "initial-state",
  measure: () => ({ width: 24, height: 24 }),
  render(context) {
    const group = groupFor(context);
    group.append(svgElement(context.document, "circle", {
      cx: 12,
      cy: 12,
      r: 11,
      fill: context.theme.labelColor,
      stroke: context.theme.labelColor,
      "stroke-width": 1,
    }));
    return group;
  },
};

export const terminateStateShape: ShapePlugin = {
  name: "terminate-state",
  measure: () => ({ width: 28, height: 28 }),
  render(context) {
    const group = groupFor(context);
    group.append(svgElement(context.document, "path", { d: "M3 3 L25 25 M25 3 L3 25", fill: "none", stroke: context.theme.labelColor, "stroke-width": 2.5 }));
    return group;
  },
};

export const finalStateShape: ShapePlugin = {
  name: "final-state",
  measure: () => ({ width: 28, height: 28 }),
  render(context) {
    const group = groupFor(context);
    group.append(svgElement(context.document, "circle", {
      cx: 14,
      cy: 14,
      r: 13,
      fill: context.theme.nodeFill,
      stroke: context.theme.labelColor,
      "stroke-width": 1.8,
    }));
    group.append(svgElement(context.document, "circle", {
      cx: 14,
      cy: 14,
      r: 6,
      fill: context.theme.labelColor,
    }));
    return group;
  },
};

export const junctionStateShape: ShapePlugin = {
  name: "junction-state",
  measure: () => ({ width: 16, height: 16 }),
  render(context) {
    const group = groupFor(context);
    group.append(svgElement(context.document, "circle", {
      cx: 8,
      cy: 8,
      r: 7.5,
      fill: context.theme.labelColor,
    }));
    return group;
  },
};

interface EntityFieldData {
  name: string;
  type: string;
  flags: string[];
}

function entityFields(attributes: Record<string, string>): EntityFieldData[] {
  try {
    const value = JSON.parse(attributes.fields ?? "[]") as unknown;
    return Array.isArray(value) ? value as EntityFieldData[] : [];
  } catch {
    return [];
  }
}

export const entityShape: ShapePlugin = {
  name: "entity",
  measure: ({ label, attributes, theme }) => {
    const fields = entityFields(attributes);
    const fieldWidth = Math.max(0, ...fields.map((field) =>
      textWidth(field.name, theme.fontSize - 1) + textWidth(field.type, theme.fontSize - 2) + 76));
    const title = labelLayout(label, wrapWidth(attributes, 216), theme.fontSize + 1, theme.fontFamily, 700);
    return {
      width: Math.max(190, title.width + 44, fieldWidth),
      height: 40 + (title.lines.length - 1) * title.lineHeight + Math.max(1, fields.length) * 25 + 8,
    };
  },
  render(context) {
    const { node, theme, document } = context;
    const fields = entityFields(node.attributes);
    const titleLayout = labelLayout(node.label, Math.min(node.width - 28, wrapWidth(node.attributes, 216)), theme.fontSize + 1, theme.fontFamily, 700);
    const headerHeight = 38 + (titleLayout.lines.length - 1) * titleLayout.lineHeight;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", {
      width: node.width,
      height: node.height,
      rx: theme.nodeRadius,
      fill: theme.nodeFill,
      stroke: theme.nodeStroke,
      "stroke-width": theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    group.append(svgElement(document, "path", {
      d: `M ${theme.nodeRadius} 0 H ${node.width - theme.nodeRadius} Q ${node.width} 0 ${node.width} ${theme.nodeRadius} V ${headerHeight} H 0 V ${theme.nodeRadius} Q 0 0 ${theme.nodeRadius} 0 Z`,
      fill: theme.containerFill,
      stroke: "none",
    }));
    group.append(svgElement(document, "line", { x1: 0, y1: headerHeight, x2: node.width, y2: headerHeight, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
    const title = svgElement(document, "text", {
      x: 14,
      y: 24,
      fill: theme.labelColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize + 1,
      "font-weight": 700,
    });
    setTextLines(title, node.label, Math.min(node.width - 28, wrapWidth(node.attributes, 216)), theme.fontSize + 1, theme.fontFamily, 700);
    group.append(title);

    fields.forEach((field, index) => {
      const y = headerHeight + 21 + index * 25;
      if (index > 0) group.append(svgElement(document, "line", { x1: 10, y1: y - 16, x2: node.width - 10, y2: y - 16, stroke: theme.nodeStroke, "stroke-width": 0.5, opacity: 0.55 }));
      const keyFlags = field.flags.filter((flag) => ["pk", "fk", "unique"].includes(flag));
      const badge = svgElement(document, "text", {
        x: 12,
        y,
        fill: keyFlags.includes("pk") ? theme.accentColor : theme.mutedColor,
        "font-family": theme.fontFamily,
        "font-size": theme.fontSize - 3,
        "font-weight": 750,
      });
      badge.textContent = keyFlags.map((flag) => flag === "unique" ? "UQ" : flag.toUpperCase()).join("/");
      const name = svgElement(document, "text", { x: 46, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1, "font-weight": keyFlags.includes("pk") ? 650 : 500 });
      name.textContent = field.name;
      const type = svgElement(document, "text", { x: node.width - 12, y, "text-anchor": "end", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 2 });
      type.textContent = field.type;
      group.append(badge, name, type);
    });
    return group;
  },
};

export const componentShape: ShapePlugin = {
  ...rectangleShape,
  name: "component",
  measure: ({ label, theme, attributes }) => {
    const style=attributes.componentStyle;
    const size = style === "uml1" ? wrappedLabelSize(label,{theme,attributes},{paddingX:28}) : baseSize(label, { theme, attributes });
    return { width: Math.max(126, size.width), height: size.height + (style === "uml1" || style === "rectangle" ? 0 : 26) };
  },
  render(context) {
    const { node, theme, document } = context;
    if(node.attributes.componentStyle === "rectangle")return rectangleShape.render(context);
    if(node.attributes.componentStyle === "uml1"){
      const group=groupFor(context);
      group.append(svgElement(document,"rect",{x:12,y:0,width:node.width-12,height:node.height,fill:theme.nodeFill,stroke:theme.nodeStroke,"stroke-width":theme.nodeStrokeWidth}));
      for(const y of [node.height/3-5,node.height*2/3-5])group.append(svgElement(document,"rect",{x:0,y,width:24,height:10,fill:theme.nodeFill,stroke:theme.nodeStroke,"stroke-width":theme.nodeStrokeWidth,class:"finch-component-tab"}));
      addLabel(group,context,0,28);return group;
    }
    const group = rectangleShape.render(context);
    group.querySelector("text")?.remove();
    addLabel(group, context, 13);
    const icon = svgElement(document, "g", { transform: `translate(${node.width - 31} 10)`, fill: theme.nodeFill, stroke: theme.accentColor, "stroke-width": 1.2 });
    icon.append(svgElement(document, "rect", { x: 6, y: 0, width: 17, height: 17, rx: 2 }));
    icon.append(svgElement(document, "rect", { x: 0, y: 3, width: 10, height: 4, rx: 1 }));
    icon.append(svgElement(document, "rect", { x: 0, y: 10, width: 10, height: 4, rx: 1 }));
    group.append(icon);
    return group;
  },
};

export const cloudShape: ShapePlugin = {
  name: "cloud",
  measure: ({label, theme, attributes}) => wrappedLabelSize(label, {theme, attributes}, {
    minimumWidth: 168, minimumHeight: 110, paddingX: 36, paddingY: 30,
  }),
  render(context) {
    const {node, theme, document} = context;
    const group = groupFor(context);
    group.append(svgElement(document, "path", {
      d: containerOutlinePath({...node, attributes:{...node.attributes, containerStyle:"cloud"}}, theme),
      fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    addLabel(group, context, 0, 36);
    return group;
  },
};

export const externalShape: ShapePlugin = {
  name: "external",
  measure: ({ label, theme, attributes }) => {
    const size = baseSize(label, { theme, attributes });
    return { width: Math.max(126, size.width), height: Math.max(62, size.height + 20) };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", {
      width: node.width,
      height: node.height,
      rx: theme.nodeRadius + 5,
      fill: theme.nodeFill,
      stroke: theme.containerStroke,
      "stroke-width": theme.nodeStrokeWidth,
      "stroke-dasharray": "5 4",
      filter: "url(#finch-shadow)",
    }));
    const stereotype = svgElement(document, "text", { x: node.width / 2, y: 19, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3, "font-weight": 650 });
    stereotype.textContent = "«external»";
    group.append(stereotype);
    addLabel(group, context, 10);
    return group;
  },
};

function numericAttribute(attributes: Record<string, string>, name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(attributes[name]);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function appendSlideText(
  group: SVGGElement,
  context: ShapeRenderContext,
  value: string,
  options: { x: number; y: number; width: number; fontSize: number; lineHeight: number; weight?: number; color?: string; align?: "start" | "middle" },
): void {
  const lines = labelLayout(value, Math.min(options.width, wrapWidth(context.node.attributes, options.width)), options.fontSize, context.theme.fontFamily, options.weight ?? 500).lines;
  const text = svgElement(context.document, "text", {
    x: options.x,
    y: options.y,
    fill: options.color ?? context.theme.labelColor,
    "font-family": context.theme.fontFamily,
    "font-size": options.fontSize,
    "font-weight": options.weight ?? 500,
    "text-anchor": options.align ?? "start",
  });
  lines.forEach((line, index) => {
    const span = svgElement(context.document, "tspan", { x: options.x, y: options.y + index * options.lineHeight });
    span.textContent = line;
    text.append(span);
  });
  group.append(text);
}

function slideExtra(context: ShapeRenderContext, value: string, width: number, fontSize: number, lineHeight: number, weight = 750): number {
  return (labelLayout(value, Math.min(width, wrapWidth(context.node.attributes, width)), fontSize, context.theme.fontFamily, weight).lines.length - 1) * lineHeight;
}

function growSlideSize(name: string, context: ShapeMeasureContext, size: Size): Size {
  const { label, attributes, theme } = context;
  const extra = (value: string | undefined, width: number, fontSize: number, lineHeight: number, weight = 750) => value
    ? (labelLayout(value, Math.min(width, wrapWidth(attributes, width)), fontSize, theme.fontFamily, weight).lines.length - 1) * lineHeight : 0;
  const w = size.width;
  const minimum = name === "slide-card" && attributes.badge ? (attributes.body ? 110 : 76)
    : name === "slide-card" && attributes.body ? 90
    : name === "slide-note" && attributes.body ? 72
    : name === "slide-callout" && attributes.body ? 90
    : name === "slide-milestone" && attributes.body && attributes.period ? 118 : 0;
  let growth = 0;
  switch (name) {
    case "slide-title": growth = extra(label, w, 30, 36, 760); break;
    case "slide-subtitle": growth = extra(label, w, 16, 22, 500); break;
    case "slide-card": growth = extra(label, w - 40, 17, 21, 700) + extra(attributes.body, w - 40, 12, 17, 500) + extra(attributes.badge?.toUpperCase(), w - 44, 10, 12); break;
    case "slide-note": growth = extra(label, w - 48, 14, 18, 650) + extra(attributes.body, w - 36, 12, 17, 500); break;
    case "slide-callout": growth = extra(label, w - 48, 20, 25, 760) + extra(attributes.body, w - 48, 13, 18, 500); break;
    case "slide-badge": growth = extra(label, w - 20, 12, 14, 720); break;
    case "slide-metric": growth = extra(attributes.label, w - 40, 11, 14, 740) + extra(label, w - 40, 31, 34, 780) + extra(attributes.delta, w - 56, 11, 13, 680); break;
    case "slide-bar": growth = Math.max(extra(label, w - 120, 14, 17, 650), extra(`${attributes.value ?? 0}${attributes.suffix ?? ""}`, 80, 15, 17, 760)); break;
    case "slide-quote": growth = extra(label, w - 104, 18, 25, 620) + extra(attributes.role ? `${attributes.by} · ${attributes.role}` : attributes.by, w - 104, 12, 15, 650); break;
    case "slide-milestone": growth = extra(attributes.period?.toUpperCase(), w - 68, 10, 12, 760) + extra(label, w - 68, 16, 20, 720) + extra(attributes.body, w - 50, 12, 17, 500); break;
  }
  return { ...size, height: Math.max(size.height, minimum) + growth };
}

export const slideTitleShape: ShapePlugin = {
  name: "slide-title",
  measure: (context) => {
    const { attributes } = context;
    return growSlideSize("slide-title", context, { width: numericAttribute(attributes, "width", 880, 320, 1400), height: 58 });
  },
  render(context) {
    const group = groupFor(context);
    const centered = context.node.attributes.align === "center";
    appendSlideText(group, context, context.node.label, {
      x: centered ? context.node.width / 2 : 0,
      y: 36,
      width: context.node.width,
      fontSize: 30,
      lineHeight: 36,
      weight: 760,
      align: centered ? "middle" : "start",
    });
    return group;
  },
};

export const slideSubtitleShape: ShapePlugin = {
  name: "slide-subtitle",
  measure: (context) => {
    const { attributes } = context;
    return growSlideSize("slide-subtitle", context, { width: numericAttribute(attributes, "width", 880, 320, 1400), height: 36 });
  },
  render(context) {
    const group = groupFor(context);
    const centered = context.node.attributes.align === "center";
    appendSlideText(group, context, context.node.label, {
      x: centered ? context.node.width / 2 : 0,
      y: 23,
      width: context.node.width,
      fontSize: 16,
      lineHeight: 22,
      color: context.theme.mutedColor,
      align: centered ? "middle" : "start",
    });
    return group;
  },
};

export const slideCardShape: ShapePlugin = {
  name: "slide-card",
  measure: (context) => {
    const { attributes } = context;
    return growSlideSize("slide-card", context, {
    width: numericAttribute(attributes, "width", 224, 150, 440),
    height: numericAttribute(attributes, "height", attributes.body ? 126 : 92, 72, 260),
  });
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    const accent = node.attributes.tone === "accent";
    group.append(svgElement(document, "rect", {
      width: node.width,
      height: node.height,
      rx: 14,
      fill: accent ? theme.containerFill : theme.nodeFill,
      stroke: accent ? theme.accentColor : theme.nodeStroke,
      "stroke-width": accent ? 2 : theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    group.append(svgElement(document, "rect", { x: 0, y: 0, width: 7, height: node.height, rx: 4, fill: theme.accentColor }));
    if (node.attributes.badge) {
      const badgeWidth = Math.min(node.width - 36, Math.max(44, textWidth(node.attributes.badge.toUpperCase(), 10, theme.fontFamily, 750) + 16));
      const badgeExtra = slideExtra(context, node.attributes.badge.toUpperCase(), badgeWidth - 8, 10, 12);
      group.append(svgElement(document, "rect", { x: 18, y: 14, width: badgeWidth, height: 20 + badgeExtra, rx: 10, fill: theme.containerFill }));
      appendSlideText(group, context, node.attributes.badge.toUpperCase(), { x: 18 + badgeWidth / 2, y: 28, width: badgeWidth - 8, fontSize: 10, lineHeight: 12, weight: 750, color: theme.accentColor, align: "middle" });
    }
    const titleExtra = slideExtra(context, node.label, node.width - 40, 17, 21, 700);
    const titleY = node.attributes.badge ? 56 + slideExtra(context, node.attributes.badge.toUpperCase(), node.width - 44, 10, 12) : node.attributes.body ? 36 : node.height / 2 + 6 - titleExtra / 2;
    appendSlideText(group, context, node.label, { x: 20, y: titleY, width: node.width - 40, fontSize: 17, lineHeight: 21, weight: 700 });
    if (node.attributes.body) appendSlideText(group, context, node.attributes.body, { x: 20, y: titleY + 30 + titleExtra, width: node.width - 40, fontSize: 12, lineHeight: 17, color: theme.mutedColor });
    return group;
  },
};

export const slideNoteShape: ShapePlugin = {
  name: "slide-note",
  measure: (context) => {
    const { attributes } = context;
    return growSlideSize("slide-note", context, { width: numericAttribute(attributes, "width", 300, 180, 700), height: numericAttribute(attributes, "height", attributes.body ? 92 : 68, 56, 200) });
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 10, fill: theme.containerFill, stroke: theme.containerStroke, "stroke-width": 1 }));
    group.append(svgElement(document, "circle", { cx: 18, cy: 22, r: 5, fill: theme.accentColor }));
    appendSlideText(group, context, node.label, { x: 32, y: 27, width: node.width - 48, fontSize: 14, lineHeight: 18, weight: 650 });
    if (node.attributes.body) appendSlideText(group, context, node.attributes.body, { x: 18, y: 54 + slideExtra(context, node.label, node.width - 48, 14, 18, 650), width: node.width - 36, fontSize: 12, lineHeight: 17, color: theme.mutedColor });
    return group;
  },
};

export const slideCalloutShape: ShapePlugin = {
  name: "slide-callout",
  measure: (context) => {
    const { attributes } = context;
    return growSlideSize("slide-callout", context, { width: numericAttribute(attributes, "width", 520, 240, 1000), height: numericAttribute(attributes, "height", attributes.body ? 112 : 82, 70, 240) });
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 16, fill: theme.containerFill, stroke: theme.accentColor, "stroke-width": 2 }));
    appendSlideText(group, context, node.label, { x: 24, y: 36, width: node.width - 48, fontSize: 20, lineHeight: 25, weight: 760, color: theme.accentColor });
    if (node.attributes.body) appendSlideText(group, context, node.attributes.body, { x: 24, y: 68 + slideExtra(context, node.label, node.width - 48, 20, 25, 760), width: node.width - 48, fontSize: 13, lineHeight: 18, color: theme.mutedColor });
    return group;
  },
};

export const slideBadgeShape: ShapePlugin = {
  name: "slide-badge",
  measure: (context) => {
    const { label, theme, attributes } = context;
    return growSlideSize("slide-badge", context, { width: Math.max(92, labelLayout(label, wrapWidth(attributes, 216), 12, theme.fontFamily, 720).width + 34), height: 36 });
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 18, fill: theme.containerFill, stroke: theme.accentColor, "stroke-width": 1.4 }));
    appendSlideText(group, context, node.label, { x: node.width / 2, y: 23, width: node.width - 20, fontSize: 12, lineHeight: 14, weight: 720, color: theme.accentColor, align: "middle" });
    return group;
  },
};

export const slideMetricShape: ShapePlugin = {
  name: "slide-metric",
  measure: (context) => {
    const { attributes } = context;
    return growSlideSize("slide-metric", context, {
    width: numericAttribute(attributes, "width", 224, 160, 440),
    height: numericAttribute(attributes, "height", 132, 104, 240),
  });
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    const accent = node.attributes.tone === "accent";
    group.append(svgElement(document, "rect", {
      width: node.width,
      height: node.height,
      rx: 16,
      fill: accent ? theme.containerFill : theme.nodeFill,
      stroke: accent ? theme.accentColor : theme.nodeStroke,
      "stroke-width": accent ? 2 : theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    appendSlideText(group, context, node.attributes.label ?? "METRIC", {
      x: 20,
      y: 27,
      width: node.width - 40,
      fontSize: 11,
      lineHeight: 14,
      weight: 740,
      color: theme.mutedColor,
    });
    appendSlideText(group, context, node.label, {
      x: 20,
      y: 72 + slideExtra(context, node.attributes.label ?? "METRIC", node.width - 40, 11, 14, 740),
      width: node.width - 40,
      fontSize: 31,
      lineHeight: 34,
      weight: 780,
      color: accent ? theme.accentColor : theme.labelColor,
    });
    if (node.attributes.delta) {
      const positive = !/^[-−]/.test(node.attributes.delta.trim());
      const deltaColor = positive ? theme.accentColor : theme.mutedColor;
      const deltaExtra = slideExtra(context, node.attributes.delta, node.width - 56, 11, 13, 680);
      group.append(svgElement(document, "rect", { x: 18, y: node.height - 32 - deltaExtra, width: node.width - 36, height: 20 + deltaExtra, rx: 10, fill: theme.containerFill }));
      appendSlideText(group, context, node.attributes.delta, {
        x: 28,
        y: node.height - 18 - deltaExtra,
        width: node.width - 56,
        fontSize: 11,
        lineHeight: 13,
        weight: 680,
        color: deltaColor,
      });
    }
    return group;
  },
};

export const slideBarShape: ShapePlugin = {
  name: "slide-bar",
  measure: (context) => {
    const { attributes } = context;
    return growSlideSize("slide-bar", context, {
    width: numericAttribute(attributes, "width", 560, 260, 1000),
    height: numericAttribute(attributes, "height", 68, 58, 120),
  });
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    const maximum = numericAttribute(node.attributes, "max", 100, 0.0001, Number.MAX_SAFE_INTEGER);
    const value = numericAttribute(node.attributes, "value", 0, 0, maximum);
    const ratio = maximum > 0 ? value / maximum : 0;
    const suffix = node.attributes.suffix ?? "";
    const trackX = 16;
    const trackY = node.height - 20;
    const trackWidth = node.width - 32;
    group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 12, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
    appendSlideText(group, context, node.label, { x: 16, y: 27, width: node.width - 120, fontSize: 14, lineHeight: 17, weight: 650 });
    appendSlideText(group, context, `${value}${suffix}`, { x: node.width - 52, y: 27, width: 80, fontSize: 15, lineHeight: 17, weight: 760, color: theme.accentColor, align: "middle" });
    group.append(svgElement(document, "rect", { x: trackX, y: trackY, width: trackWidth, height: 8, rx: 4, fill: theme.containerFill }));
    group.append(svgElement(document, "rect", { x: trackX, y: trackY, width: ratio === 0 ? 0 : Math.max(8, trackWidth * ratio), height: 8, rx: 4, fill: theme.accentColor }));
    return group;
  },
};

export const slideQuoteShape: ShapePlugin = {
  name: "slide-quote",
  measure: (context) => {
    const { attributes } = context;
    return growSlideSize("slide-quote", context, {
    width: numericAttribute(attributes, "width", 640, 300, 1100),
    height: numericAttribute(attributes, "height", 172, 120, 320),
  });
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 18, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    group.append(svgElement(document, "rect", { width: 8, height: node.height, rx: 4, fill: theme.accentColor }));
    const mark = svgElement(document, "text", { x: 28, y: 60, fill: theme.accentColor, "font-family": theme.fontFamily, "font-size": 52, "font-weight": 800 });
    mark.textContent = "“";
    group.append(mark);
    appendSlideText(group, context, node.label, { x: 76, y: 43, width: node.width - 104, fontSize: 18, lineHeight: 25, weight: 620 });
    if (node.attributes.by) {
      const attribution = node.attributes.role ? `${node.attributes.by} · ${node.attributes.role}` : node.attributes.by;
      appendSlideText(group, context, attribution, { x: 76, y: node.height - 24 - slideExtra(context, attribution, node.width - 104, 12, 15, 650), width: node.width - 104, fontSize: 12, lineHeight: 15, weight: 650, color: theme.mutedColor });
    }
    return group;
  },
};

export const slideMilestoneShape: ShapePlugin = {
  name: "slide-milestone",
  measure: (context) => {
    const { attributes } = context;
    return growSlideSize("slide-milestone", context, {
    width: numericAttribute(attributes, "width", 200, 150, 380),
    height: numericAttribute(attributes, "height", attributes.body ? 148 : 116, 100, 260),
  });
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { x: 14, y: 18, width: node.width - 14, height: node.height - 18, rx: 14, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    group.append(svgElement(document, "circle", { cx: 20, cy: 38, r: 17, fill: theme.accentColor, stroke: theme.nodeFill, "stroke-width": 5 }));
    const dot = svgElement(document, "text", { x: 20, y: 43, "text-anchor": "middle", fill: theme.nodeFill, "font-family": theme.fontFamily, "font-size": 15, "font-weight": 800 });
    dot.textContent = node.attributes.step ?? "•";
    group.append(dot);
    if (node.attributes.period) appendSlideText(group, context, node.attributes.period.toUpperCase(), { x: 50, y: 36, width: node.width - 68, fontSize: 10, lineHeight: 12, weight: 760, color: theme.accentColor });
    const periodExtra = slideExtra(context, node.attributes.period?.toUpperCase() ?? "", node.width - 68, 10, 12, 760);
    appendSlideText(group, context, node.label, { x: 50, y: (node.attributes.period ? 61 : 43) + periodExtra, width: node.width - 68, fontSize: 16, lineHeight: 20, weight: 720 });
    if (node.attributes.body) appendSlideText(group, context, node.attributes.body, { x: 32, y: (node.attributes.period ? 95 : 88) + periodExtra + slideExtra(context, node.label, node.width - 68, 16, 20, 720), width: node.width - 50, fontSize: 12, lineHeight: 17, color: theme.mutedColor });
    return group;
  },
};

export const slideGroupShape: ShapePlugin = {
  name: "slide-group",
  measure: () => ({ width: 1, height: 1 }),
  render(context) {
    return groupFor(context);
  },
};

function memberVisibility(group:SVGGElement,text:SVGTextElement,member:{text:string;kind:string;visibilityEscaped?:boolean},context:ShapeRenderContext):void {
 const size=Number(context.node.attributes.visibilityIconSize);
 if(!size || member.visibilityEscaped || member.kind==="separator")return;
 const match=member.text.match(/^([+#~\-])\s*(.*)$/);
 if(!match)return;
 const symbol=match[1]!,name=({"+":"public","-":"private","#":"protected","~":"package"} as Record<string,string>)[symbol]!;
 const x=Number(text.getAttribute("x"))+size/2,y=Number(text.getAttribute("y"))-size/2;
 const icon=svgElement(context.document,"g",{class:"finch-visibility-icon","data-visibility":name,"aria-label":name});
 const filled=member.kind==="operation";
 const attrs={fill:filled?context.theme.labelColor:"none",stroke:context.theme.labelColor,"stroke-width":1.2};
 if(symbol==="+")icon.append(svgElement(context.document,"circle",{cx:x,cy:y,r:size/2,...attrs}));
 else if(symbol==="-")icon.append(svgElement(context.document,"rect",{x:x-size/2,y:y-size/2,width:size,height:size,...attrs}));
 else icon.append(svgElement(context.document,"path",{d:symbol==="#"?`M${x} ${y-size/2} L${x+size/2} ${y} L${x} ${y+size/2} L${x-size/2} ${y} Z`:`M${x} ${y-size/2} L${x+size/2} ${y+size/2} H${x-size/2} Z`,...attrs}));
 text.setAttribute("x",String(Number(text.getAttribute("x"))+size+6));
 text.textContent=match[2]!;
 group.append(icon);
}

interface UmlMemberData {
  text: string;
  kind: "attribute" | "operation" | "literal" | "separator";
  separator?: string;
  static?: boolean;
  abstract?: boolean;
}

function umlMembers(attributes: Record<string, string>): UmlMemberData[] {
  try {
    const value = JSON.parse(attributes.members ?? "[]") as unknown;
    const hidden = JSON.parse(attributes.hiddenMembers ?? "[]") as number[];
    return Array.isArray(value) ? (value as UmlMemberData[]).filter((_,index)=>!hidden.includes(index)) : [];
  } catch {
    return [];
  }
}

export const umlClassShape: ShapePlugin = {
  name: "uml-class",
  measure: ({ label, attributes, theme }) => {
    const members = umlMembers(attributes);
    const title = labelLayout((attributes.visibility ?? "")+label, wrapWidth(attributes, 216), theme.fontSize + 1, theme.fontFamily, 720);
    const longest = Math.max(title.width, attributes.templateParameters ? textWidth(attributes.templateParameters, theme.fontSize - 2) + 20 : 0, ...members.map((member) => textWidth(member.text, theme.fontSize - 1)));
    const stereotypeHeight = (attributes.hideStereotype === "true" || attributes.kind === "class" && !attributes.stereotype ? 0 : 18) + (attributes.templateParameters ? 26 : 0);
    const attributeRows = Math.max((attributes.hideEmptyFields ?? attributes.hideEmptyMembers) === "true" ? 0 : 1, members.filter((member) => member.kind !== "operation").length);
    const operationRows = Math.max((attributes.hideEmptyOperations ?? attributes.hideEmptyMembers ?? "true") === "true" ? 0 : 1,members.filter((member) => member.kind === "operation").length);
    if(attributes.customCompartments === "true")return {width:Math.max(210,longest+34),height:46+stereotypeHeight+(title.lines.length-1)*title.lineHeight+members.length*23+12};
    return { width: Math.max(210, longest + 34), height: 46 + stereotypeHeight + (title.lines.length - 1) * title.lineHeight + attributeRows * 23 + operationRows * 23 + 12 };
  },
  render(context) {
    const { node, theme, document } = context;
    const members = umlMembers(node.attributes);
    const kind = node.attributes.kind ?? "class";
    const stereotypeHeight = (node.attributes.hideStereotype === "true" || kind === "class" && !node.attributes.stereotype ? 0 : 18) + (node.attributes.templateParameters ? 26 : 0);
    const titleLayout = labelLayout((node.attributes.visibility ?? "")+node.label, Math.min(node.width - 34, wrapWidth(node.attributes, 216)), theme.fontSize + 1, theme.fontFamily, 720);
    const headerHeight = 46 + stereotypeHeight + (titleLayout.lines.length - 1) * titleLayout.lineHeight;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 4, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    if (node.attributes.hideStereotype !== "true" && (kind !== "class" || node.attributes.stereotype)) {
      const stereotype = svgElement(document, "text", { x: node.width / 2, y: node.attributes.templateParameters ? 43 : 17, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 2 });
      const spot=node.attributes.stereotype?.match(/^\(\s*([^,()])\s*,\s*(#[\da-fA-F]{3,8}|[A-Za-z]+)\s*\)\s*(.*)$/);
      stereotype.textContent = `«${[kind !== "class" ? kind : "", spot ? spot[3] : node.attributes.stereotype].filter(Boolean).join(", ")}»`;
      if(spot){
        const y=node.attributes.templateParameters ? 39 : 13;
        const badge=svgElement(document,"g",{class:"finch-stereotype-spot"});
        badge.append(svgElement(document,"circle",{cx:17,cy:y,r:10,fill:spot[2],stroke:theme.nodeStroke}));
        const letter=svgElement(document,"text",{x:17,y:y+4,"text-anchor":"middle","font-family":theme.fontFamily,"font-size":12,"font-weight":700,fill:"#111827"});
        letter.textContent=spot[1]!;
        badge.append(letter);group.append(badge);
      }
      group.append(stereotype);
    }
    if(node.attributes.templateParameters) {
      const width=textWidth(node.attributes.templateParameters,theme.fontSize-2)+16;
      group.append(svgElement(document,"rect",{x:node.width-width-4,y:4,width,height:22,fill:theme.nodeFill,stroke:theme.nodeStroke,"stroke-dasharray":"4 3",class:"finch-template-parameters"}));
      const template=svgElement(document,"text",{x:node.width-width/2-4,y:19,"text-anchor":"middle",fill:theme.labelColor,"font-family":theme.fontFamily,"font-size":theme.fontSize-2});template.textContent=node.attributes.templateParameters;group.append(template);
    }
    const title = svgElement(document, "text", { x: node.width / 2, y: 30 + stereotypeHeight, "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize + 1, "font-weight": 720, "font-style": kind === "abstract" ? "italic" : undefined });
    setTextLines(title, (node.attributes.visibility ?? "")+node.label, Math.min(node.width - 34, wrapWidth(node.attributes, 216)), theme.fontSize + 1, theme.fontFamily, 720);
    group.append(title, svgElement(document, "line", { x1: 0, y1: headerHeight, x2: node.width, y2: headerHeight, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
    if(node.attributes.customCompartments === "true"){
      members.forEach((member,index)=>{
        const y=headerHeight+20+index*23;
        if(member.kind === "separator"){
          const width=member.text ? textWidth(member.text,theme.fontSize-1,theme.fontFamily)+16 : 0;
          for(const [x1,x2] of [[0,(node.width-width)/2],[(node.width+width)/2,node.width]])group.append(svgElement(document,"line",{x1,x2,y1:y-5,y2:y-5,stroke:theme.nodeStroke,"stroke-width":member.separator === "==" ? 2 : theme.nodeStrokeWidth,"stroke-dasharray":member.separator === ".." ? "3 3" : undefined,class:"finch-compartment-separator"}));
        }
        const text=svgElement(document,"text",{x:member.kind === "separator" ? node.width/2 : 12,y,"text-anchor":member.kind === "separator" ? "middle" : "start",fill:theme.labelColor,"font-family":theme.fontFamily,"font-size":theme.fontSize-1,"font-style":member.abstract ? "italic" : undefined,"text-decoration":member.static ? "underline" : undefined});
        text.textContent=member.text;memberVisibility(group,text,member,context);group.append(text);
      });
      return group;
    }
    const attributes = members.filter((member) => member.kind !== "operation");
    const operations = members.filter((member) => member.kind === "operation");
    let y = headerHeight + 20;
    for (const member of attributes) {
      const text = svgElement(document, "text", { x: 12, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1, "font-style": member.kind === "literal" ? "italic" : undefined });
      text.textContent = member.text;
      memberVisibility(group,text,member,context);
      if (member.static) text.setAttribute("text-decoration", "underline");
      if (member.abstract) text.setAttribute("font-style", "italic");
      group.append(text);
      y += 23;
    }
    if (operations.length || (node.attributes.hideEmptyOperations ?? node.attributes.hideEmptyMembers ?? "true") === "false") {
      const separatorY = headerHeight + Math.max((node.attributes.hideEmptyFields ?? node.attributes.hideEmptyMembers) === "true" ? 0 : 1, attributes.length) * 23;
      group.append(svgElement(document, "line", { x1: 0, y1: separatorY, x2: node.width, y2: separatorY, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      y = separatorY + 21;
      for (const member of operations) {
        const text = svgElement(document, "text", { x: 12, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1 });
        text.textContent = member.text;
      memberVisibility(group,text,member,context);
        if (member.static) text.setAttribute("text-decoration", "underline");
        if (member.abstract) text.setAttribute("font-style", "italic");
        group.append(text);
        y += 23;
      }
    }
    return group;
  },
};

export const umlMapShape: ShapePlugin = {
 name:"uml-map",
 measure({label,theme,attributes}) {
  const entries=JSON.parse(attributes.mapEntries ?? '[]') as Array<{key:string;value:string}>;
  const width=(values:string[])=>Math.max(50,...values.map(value=>textWidth(value,theme.fontSize,theme.fontFamily)+24));
  return {width:Math.max(160,textWidth(label,theme.fontSize,theme.fontFamily)+32,width(entries.map(e=>e.key))+width(entries.map(e=>e.value))),height:42+Math.max(1,entries.length)*28};
 },
 render(context){
  const {node,theme,document}=context;
  const entries=JSON.parse(node.attributes.mapEntries ?? '[]') as Array<{key:string;value:string}>;
  const group=groupFor(context);
  const divider=Math.max(50,...entries.map(e=>textWidth(e.key,theme.fontSize,theme.fontFamily)+24));
  group.append(svgElement(document,'rect',{width:node.width,height:node.height,fill:theme.nodeFill,stroke:theme.nodeStroke,'stroke-width':theme.nodeStrokeWidth}));
  const text=(value:string,x:number,y:number,header=false)=>{
   const label=svgElement(document,'text',{x,y,fill:theme.labelColor,'font-family':theme.fontFamily,'font-size':theme.fontSize,'text-anchor':header?'middle':'start','font-weight':header?720:400});
   label.textContent=value;group.append(label);
  };
  const line=(x1:number,y1:number,x2:number,y2:number)=>group.append(svgElement(document,'line',{x1,y1,x2,y2,stroke:theme.nodeStroke,'stroke-width':theme.nodeStrokeWidth}));
  text(node.label,node.width/2,27,true);line(0,42,node.width,42);line(divider,42,divider,node.height);
  entries.forEach((entry,i)=>{text(entry.key,12,62+i*28);text(entry.value,divider+12,62+i*28);if(i)line(0,42+i*28,node.width,42+i*28);});
  return group;
 }
};

export const umlInstanceShape: ShapePlugin = {
  ...umlClassShape,
  name:"uml-instance",
  render(context) {
    const group=umlClassShape.render(context);
    group.querySelector('text[font-weight="720"]')?.setAttribute("text-decoration","underline");
    return group;
  },
};

export const umlStateShape: ShapePlugin = {
  ...umlClassShape,
  name: "uml-state",
  render(context) {
    const group = umlClassShape.render(context);
    group.querySelector("rect")?.setAttribute("rx", "12");
    return group;
  },
};

export const usecaseShape: ShapePlugin = {
  name: "usecase",
  measure: ({ label, theme, attributes }) => {
    const text = nodeLabelLayout(label, attributes, theme, 180);
    return { width: Math.max(150, Math.ceil((text.width + (attributes.business === "true" ? 60 : 36)) * Math.SQRT2)), height: Math.max(72, Math.ceil((text.height + 24) * Math.SQRT2)) };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "ellipse", { cx: node.width / 2, cy: node.height / 2, rx: node.width / 2, ry: node.height / 2, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    if(node.attributes.business === "true"){
      const point=(angle:number)=>({x:node.width/2*(1+Math.cos(angle)),y:node.height/2*(1+Math.sin(angle))});
      const a=point(-Math.PI/3),b=point(-Math.PI/18);
      group.append(svgElement(document,"line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:theme.nodeStroke,"stroke-width":theme.nodeStrokeWidth,class:"finch-business-mark"}));
    }
    addLabel(group, context, 0, 27, 180);
    return group;
  },
};

export const umlArtifactShape: ShapePlugin = {
  name: "uml-artifact",
  measure: ({ label, theme, attributes }) => {
    const size = wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 132, minimumHeight: 46, paddingX: 20 });
    return { width: size.width+(attributes?.noteShape==='hnote'?32:0), height: Math.max(66, size.height + 20) };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    if(node.attributes.noteShape==='rnote' || node.attributes.noteShape==='hnote'){
      const style={fill:theme.nodeFill,stroke:theme.nodeStroke,'stroke-width':theme.nodeStrokeWidth,filter:'url(#finch-shadow)'};
      if(node.attributes.noteShape==='rnote')group.append(svgElement(document,'rect',{width:node.width,height:node.height,...style}));
      else group.append(svgElement(document,'polygon',{points:`16,0 ${node.width-16},0 ${node.width},${node.height/2} ${node.width-16},${node.height} 16,${node.height} 0,${node.height/2}`,...style}));
      addLabel(group,context);return group;
    }
    const fold = 16;
    group.append(svgElement(document, "path", { d: `M 0 0 H ${node.width - fold} L ${node.width} ${fold} V ${node.height} H 0 Z`, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    group.append(svgElement(document, "path", { d: `M ${node.width - fold} 0 V ${fold} H ${node.width}`, fill: "none", stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
    const stereotype = svgElement(document, "text", { x: node.width / 2, y: 20, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3 });
    stereotype.textContent = "«artifact»";
    const plain = node.attributes.annotationTarget || node.attributes.standaloneNote || node.shape === "uml-file";
    const defaultStereotype = !plain && !node.attributes.stereotype && node.attributes.hideStereotype !== "true";
    if (defaultStereotype) group.append(stereotype);
    addLabel(group, context, defaultStereotype ? 10 : 0, node.shape === "uml-file" ? 20 : plain ? 0 : 20);
    return group;
  },
};

export const umlFileShape: ShapePlugin = {
  ...umlArtifactShape,
  name: "uml-file",
};

export const umlNodeShape: ShapePlugin = {
  name: "uml-node",
  measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 140, minimumHeight: 76, paddingX: 32, paddingY: 24 }),
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "path", {
      d: containerOutlinePath({...node, attributes: {...node.attributes, containerStyle: "node"}}, theme),
      fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth,
    }));
    addLabel(group, context, 6, 32);
    return group;
  },
};

export const umlDeviceShape: ShapePlugin = {
  name: "uml-device",
  measure: ({ label, theme, attributes }) => {
    const size = wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 140, minimumHeight: 46, paddingX: 22 });
    return { width: size.width, height: Math.max(76, size.height + 22) };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "path", { d: `M 0 12 L 12 0 H ${node.width} V ${node.height - 12} L ${node.width - 12} ${node.height} H 0 Z M 0 12 H ${node.width - 12} L ${node.width} 0 M ${node.width - 12} 12 V ${node.height}`, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    const defaultStereotype = !node.attributes.stereotype && node.attributes.hideStereotype !== "true";
    if (defaultStereotype) {
      const stereotype = svgElement(document, "text", { x: node.width / 2, y: 25, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3 });
      stereotype.textContent = "«device»";
      group.append(stereotype);
    }
    addLabel(group, context, defaultStereotype ? 11 : 6, 22);
    return group;
  },
};

export const umlExecutionShape: ShapePlugin = {
  name: "uml-execution",
  measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 146, minimumHeight: 68, paddingX: 23, paddingY: 16 }),
  render(context) {
    const group = rectangleShape.render(context);
    group.append(svgElement(context.document, "rect", { x: 6, y: 6, width: context.node.width - 12, height: context.node.height - 12, rx: 4, fill: "none", stroke: context.theme.containerStroke, "stroke-width": 1 }));
    return group;
  },
};

export const umlPortShape: ShapePlugin = {
  name: "uml-port",
  measure: ({label,theme,attributes}) => {
    const text=labelLayout(label,wrapWidth(attributes,140),theme.fontSize-2,theme.fontFamily);
    return {width:Math.max(26,attributes.portLabelSide==="left"?2*(text.width+18):text.width+12),height:34+text.height};
  },
  render(context) {
    const {node,theme,document}=context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { x: node.width/2-11, y: 2, width: 22, height: 22, fill: theme.nodeFill, stroke: theme.accentColor, "stroke-width": 1.7 }));
    const label=svgElement(document,"text",{x:node.attributes.portLabelSide==="left"?node.width/2-18:node.width/2,y:36,"text-anchor":node.attributes.portLabelSide==="left"?"end":"middle",fill:theme.labelColor,"font-family":theme.fontFamily,"font-size":theme.fontSize-2,class:"finch-port-label"});
    setTextLines(label,node.label,Math.min(node.width-12,wrapWidth(node.attributes,140)),theme.fontSize-2,theme.fontFamily);
    group.append(label);
    return group;
  },
};

export const umlProvidedInterfaceShape: ShapePlugin = {
  name: "uml-provided-interface",
  measure: ({label, theme, attributes}) => {
    const text = labelLayout(label, wrapWidth(attributes, 216), theme.fontSize - 1, theme.fontFamily);
    return {width: Math.max(40, text.width + 20), height: 38 + text.height};
  },
  render(context) {
    const {node,theme,document}=context;
    const group=groupFor(context);
    group.append(svgElement(document,"circle",{cx:node.width/2,cy:14,r:10,fill:theme.nodeFill,stroke:theme.nodeStroke,"stroke-width":theme.nodeStrokeWidth}));
    const label=svgElement(document,"text",{x:node.width/2,y:38,"text-anchor":"middle",fill:theme.labelColor,"font-family":theme.fontFamily,"font-size":theme.fontSize-1});
    setTextLines(label,node.label,Math.min(node.width-20,wrapWidth(node.attributes,216)),theme.fontSize-1,theme.fontFamily);
    group.append(label);return group;
  },
};

export const umlRequiredInterfaceShape: ShapePlugin = {
  name: "uml-required-interface",
  measure: ({ label, theme, attributes }) => {
    const text = labelLayout(label, wrapWidth(attributes, 216), theme.fontSize - 1, theme.fontFamily);
    const labelY = Math.max(57, 44 + theme.fontSize - 1);
    return { width: Math.max(76, text.width + 20), height: labelY - 1 + text.height };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "path", { class: "finch-required-interface-arc", d: requiredInterfacePath(node), fill: "none", stroke: theme.accentColor, "stroke-width": 2 }));
    const label = svgElement(document, "text", { x: node.width / 2, y: Math.max(57, 44 + theme.fontSize - 1), "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1 });
    setTextLines(label, node.label, Math.min(node.width - 20, wrapWidth(node.attributes, 216)), theme.fontSize - 1, theme.fontFamily);
    group.append(label);
    return group;
  },
};

export const umlBarShape: ShapePlugin = {
  name: "uml-bar",
  measure: () => ({ width: 96, height: 14 }),
  render(context) {
    const group = groupFor(context);
    group.append(svgElement(context.document, "rect", { y: 3, width: context.node.width, height: 8, rx: 3, fill: context.theme.labelColor }));
    return group;
  },
};

export const choiceStateShape: ShapePlugin = {
  name: "choice-state",
  measure: () => ({ width: 32, height: 32 }),
  render(context) {
    const group = groupFor(context);
    group.append(svgElement(context.document, "polygon", { points: "16,1 31,16 16,31 1,16", fill: context.theme.nodeFill, stroke: context.theme.labelColor, "stroke-width": 1.5 }));
    return group;
  },
};

function historyShape(name: string, deep: boolean): ShapePlugin {
  return {
    name,
    measure: () => ({ width: 36, height: 36 }),
    render(context) {
      const group = groupFor(context);
      group.append(svgElement(context.document, "circle", { cx: 18, cy: 18, r: 16, fill: context.theme.nodeFill, stroke: context.theme.labelColor, "stroke-width": 1.5 }));
      const text = svgElement(context.document, "text", { x: 18, y: 23, "text-anchor": "middle", fill: context.theme.labelColor, "font-family": context.theme.fontFamily, "font-size": 13, "font-weight": 700 });
      text.textContent = deep ? "H*" : "H";
      group.append(text);
      return group;
    },
  };
}

function connectionPointShape(name: string, exit: boolean): ShapePlugin {
  return {
    name, measure: () => ({ width: 24, height: 24 }),
    render(context) {
      const group = groupFor(context);
      group.append(svgElement(context.document, "circle", { cx:12, cy:12, r:10, fill:context.theme.nodeFill, stroke:context.theme.labelColor, "stroke-width":1.5 }));
      if (exit) group.append(svgElement(context.document, "path", { d:"M5 5 L19 19 M19 5 L5 19", stroke:context.theme.labelColor, "stroke-width":1.5 }));
      const title = svgElement(context.document, "title", {}); title.textContent = context.node.attributes.ref ? `${context.node.label}: ${context.node.attributes.ref}` : context.node.label; group.append(title);
      return group;
    },
  };
}
const signalShapes:ShapePlugin[]=['signal-send','signal-receive'].map(name=>({
 name,
 measure:({label,theme,attributes})=>wrappedLabelSize(label,{theme,attributes},{paddingX:30}),
 render(context){
  const {node,theme,document}=context;const group=groupFor(context);
  const points=name==='signal-send' ? `0,0 ${node.width-20},0 ${node.width},${node.height/2} ${node.width-20},${node.height} 0,${node.height}` : `0,0 ${node.width},0 ${node.width},${node.height} 0,${node.height} 20,${node.height/2}`;
  group.append(svgElement(document,'polygon',{points,...(node.attributes.facing==='left'?{transform:`translate(${node.width} 0) scale(-1 1)`}:{}),fill:theme.nodeFill,stroke:theme.nodeStroke,'stroke-width':theme.nodeStrokeWidth}));
  addLabel(group,context,0,30);return group;
 }
}));

const statePinShapes:ShapePlugin[]=['state-input-pin','state-output-pin'].map(name=>({
 name,measure:()=>({width:20,height:20}),
 render(context){
  const group=groupFor(context);
  group.append(svgElement(context.document,'rect',{x:2,y:2,width:16,height:16,fill:context.theme.nodeFill,stroke:context.theme.labelColor,'stroke-width':1.5,class:'finch-state-pin'}));
  const title=svgElement(context.document,'title',{});title.textContent=context.node.label;group.append(title);return group;
 }
}));

export const entryPointShape = connectionPointShape("entry-point", false);
export const exitPointShape = connectionPointShape("exit-point", true);

export const historyStateShape = historyShape("history-state", false);
export const deepHistoryStateShape = historyShape("deep-history-state", true);

export const umlObjectShape: ShapePlugin = {
  ...rectangleShape,
  name: "uml-object",
  render(context) {
    const group = rectangleShape.render(context);
    group.querySelector("text")!.setAttribute("text-decoration", "underline");
    return group;
  },
};

export const builtInShapes: ShapePlugin[] = [
  rectangleShape,
  labelShape,
  collectionsShape,
  stackShape,
  roundedShape,
  storageShape,
  processShape,
  databaseShape,
  queueShape,
  cardShape,
  hexagonShape,
  actorShape,
  personShape,
  ...sequenceRoleShapes,
  containerShape,
  serverShape,
  diamondShape,
  parallelogramShape,
  circleShape,
  initialStateShape,
  entryPointShape,
  ...statePinShapes,
  ...signalShapes,
  exitPointShape,
  finalStateShape,
  terminateStateShape,
  junctionStateShape,
  entityShape,
  componentShape,
  externalShape,
  cloudShape,
  slideTitleShape,
  slideSubtitleShape,
  slideCardShape,
  slideNoteShape,
  slideCalloutShape,
  slideBadgeShape,
  slideMetricShape,
  slideBarShape,
  slideQuoteShape,
  slideMilestoneShape,
  slideGroupShape,
  umlClassShape,
  umlInstanceShape,
  umlMapShape,
  umlStateShape,
  usecaseShape,
  umlArtifactShape,
  umlFileShape,
  umlNodeShape,
  umlDeviceShape,
  umlExecutionShape,
  umlPortShape,
  umlRequiredInterfaceShape,
  umlProvidedInterfaceShape,
  umlBarShape,
  choiceStateShape,
  historyStateShape,
  deepHistoryStateShape,
  umlObjectShape,
];
