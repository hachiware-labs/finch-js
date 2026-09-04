import type { ShapePlugin, ShapeRenderContext, Size } from "./types.js";
import { svgElement } from "./utils.js";

const MAX_NODE_LABEL_WIDTH = 216;

function textUnits(value: string): number {
  return [...value].reduce((total, character) =>
    total + (/[\u3000-\u9fff\uff00-\uffef]/.test(character) ? 1 : 0.56), 0);
}

function textWidth(label: string, fontSize: number): number {
  return Math.ceil(textUnits(label) * fontSize);
}

function wrappedLines(value: string, maximumWidth: number, fontSize: number): string[] {
  const maximumUnits = Math.max(1, maximumWidth / fontSize);
  const lines: string[] = [];
  for (const paragraph of value.replace(/\\n/g, "\n").split("\n")) {
    let remaining = paragraph;
    while (remaining && textUnits(remaining) > maximumUnits) {
      const characters = [...remaining];
      let units = 0;
      let overflowIndex = characters.length;
      let whitespaceIndex = -1;
      for (let index = 0; index < characters.length; index += 1) {
        const character = characters[index] ?? "";
        units += textUnits(character);
        if (/\s/.test(character)) whitespaceIndex = index;
        if (units > maximumUnits) {
          overflowIndex = index;
          break;
        }
      }
      const breakIndex = whitespaceIndex > 0 ? whitespaceIndex + 1 : Math.max(1, overflowIndex);
      lines.push(characters.slice(0, breakIndex).join(""));
      remaining = characters.slice(breakIndex).join("").trimStart();
    }
    lines.push(remaining);
  }
  return lines.length ? lines : [""];
}

function wrappedLabelSize(
  label: string,
  context: { theme: ShapeRenderContext["theme"] },
  options: { minimumWidth?: number; minimumHeight?: number; maximumTextWidth?: number; paddingX?: number; paddingY?: number } = {},
): Size {
  const fontSize = context.theme.fontSize;
  const paddingX = options.paddingX ?? context.theme.nodePaddingX;
  const paddingY = options.paddingY ?? context.theme.nodePaddingY;
  const lineHeight = Math.ceil(fontSize * 1.4);
  const lines = wrappedLines(label, options.maximumTextWidth ?? MAX_NODE_LABEL_WIDTH, fontSize);
  return {
    width: Math.max(options.minimumWidth ?? 104, ...lines.map((line) => textWidth(line, fontSize) + paddingX * 2)),
    height: Math.max(options.minimumHeight ?? 46, lines.length * lineHeight + paddingY * 2),
  };
}

function baseSize(label: string, context: { theme: ShapeRenderContext["theme"] }): Size {
  return wrappedLabelSize(label, context);
}

function addLabel(group: SVGGElement, context: ShapeRenderContext, yOffset = 0, paddingX = context.theme.nodePaddingX): void {
  const { node, theme, document } = context;
  const lines = wrappedLines(node.label, Math.max(theme.fontSize, node.width - paddingX * 2), theme.fontSize);
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
    text.textContent = node.label;
  } else {
    lines.forEach((line, index) => {
      const span = svgElement(document, "tspan", { x: node.width / 2, dy: index === 0 ? 0 : lineHeight });
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

export const rectangleShape: ShapePlugin = {
  name: "rectangle",
  measure: ({ label, theme }) => baseSize(label, { theme }),
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

export const roundedShape: ShapePlugin = {
  ...rectangleShape,
  name: "rounded",
  render(context) {
    const group = groupFor(context);
    group.append(svgElement(context.document, "rect", {
      width: context.node.width,
      height: context.node.height,
      rx: context.node.height / 2,
      fill: context.theme.nodeFill,
      stroke: context.theme.nodeStroke,
      "stroke-width": context.theme.nodeStrokeWidth,
      filter: "url(#finch-shadow)",
    }));
    addLabel(group, context);
    return group;
  },
};

export const databaseShape: ShapePlugin = {
  name: "database",
  measure: ({ label, theme }) => {
    const size = baseSize(label, { theme });
    return { width: Math.max(110, size.width), height: Math.max(60, size.height + 10) };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    const cap = 13;
    const path = [
      `M 0 ${cap}`,
      `C 0 0 ${node.width} 0 ${node.width} ${cap}`,
      `L ${node.width} ${node.height - cap}`,
      `C ${node.width} ${node.height} 0 ${node.height} 0 ${node.height - cap}`,
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
    addLabel(group, context, 5);
    return group;
  },
};

export const actorShape: ShapePlugin = {
  name: "actor",
  measure: ({ label, theme }) => ({
    width: Math.max(84, textWidth(label, theme.fontSize) + 22),
    height: 74,
  }),
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    const cx = node.width / 2;
    const stroke = { fill: "none", stroke: theme.nodeStroke, "stroke-width": 1.7, "stroke-linecap": "round" } as const;
    group.append(svgElement(document, "circle", { cx, cy: 10, r: 8, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": 1.7 }));
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
    label.textContent = node.label;
    group.append(label);
    return group;
  },
};

export const containerShape: ShapePlugin = {
  name: "container",
  measure: ({ label, theme }) => ({ width: Math.max(168, textWidth(label, theme.fontSize) + 42), height: 110 }),
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.classList.add("finch-container");
    group.append(svgElement(document, "rect", {
      width: node.width,
      height: node.height,
      rx: theme.nodeRadius + 2,
      fill: theme.containerFill,
      stroke: theme.containerStroke,
      "stroke-width": theme.nodeStrokeWidth,
      "stroke-dasharray": "5 4",
    }));
    const text = svgElement(document, "text", {
      x: 16,
      y: 23,
      fill: theme.mutedColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize - 1,
      "font-weight": 650,
    });
    text.textContent = node.label;
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
  measure: ({ label, theme }) => wrappedLabelSize(label, { theme }, { minimumWidth: 148, minimumHeight: 86, paddingX: 27, paddingY: 18, maximumTextWidth: 180 }),
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
    addLabel(group, context, 0, 27);
    return group;
  },
};

export const parallelogramShape: ShapePlugin = {
  name: "parallelogram",
  measure: ({ label, theme }) => {
    const size = baseSize(label, { theme });
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
  measure: ({ label, theme }) => {
    const size = wrappedLabelSize(label, { theme }, { minimumWidth: 64, minimumHeight: 64, paddingX: 15, paddingY: 15, maximumTextWidth: 160 });
    const diameter = Math.max(size.width, size.height);
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
    addLabel(group, context, 0, 15);
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
    return {
      width: Math.max(190, textWidth(label, theme.fontSize + 1) + 44, fieldWidth),
      height: 40 + Math.max(1, fields.length) * 25 + 8,
    };
  },
  render(context) {
    const { node, theme, document } = context;
    const fields = entityFields(node.attributes);
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
      d: `M ${theme.nodeRadius} 0 H ${node.width - theme.nodeRadius} Q ${node.width} 0 ${node.width} ${theme.nodeRadius} V 38 H 0 V ${theme.nodeRadius} Q 0 0 ${theme.nodeRadius} 0 Z`,
      fill: theme.containerFill,
      stroke: "none",
    }));
    group.append(svgElement(document, "line", { x1: 0, y1: 38, x2: node.width, y2: 38, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
    const title = svgElement(document, "text", {
      x: 14,
      y: 24,
      fill: theme.labelColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize + 1,
      "font-weight": 700,
    });
    title.textContent = node.label;
    group.append(title);

    fields.forEach((field, index) => {
      const y = 59 + index * 25;
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
  render(context) {
    const { node, theme, document } = context;
    const group = rectangleShape.render(context);
    const icon = svgElement(document, "g", { transform: `translate(${node.width - 31} 10)`, fill: theme.nodeFill, stroke: theme.accentColor, "stroke-width": 1.2 });
    icon.append(svgElement(document, "rect", { x: 6, y: 0, width: 17, height: 17, rx: 2 }));
    icon.append(svgElement(document, "rect", { x: 0, y: 3, width: 10, height: 4, rx: 1 }));
    icon.append(svgElement(document, "rect", { x: 0, y: 10, width: 10, height: 4, rx: 1 }));
    group.append(icon);
    return group;
  },
};

export const externalShape: ShapePlugin = {
  name: "external",
  measure: ({ label, theme }) => {
    const size = baseSize(label, { theme });
    return { width: Math.max(126, size.width), height: 62 };
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
    const label = svgElement(document, "text", { x: node.width / 2, y: 41, "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize, "font-weight": 600 });
    label.textContent = node.label;
    group.append(stereotype, label);
    return group;
  },
};

function numericAttribute(attributes: Record<string, string>, name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(attributes[name]);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function slideLines(value: string, maximumUnits: number, maximumLines = 3): string[] {
  const explicit = value.replace(/\\n/g, "\n").split("\n");
  const lines: string[] = [];
  const unitsFor = (text: string): number => [...text].reduce((total, character) =>
    total + (/[\u3000-\u9fff\uff00-\uffef]/.test(character) ? 1 : 0.56), 0);
  for (const paragraph of explicit) {
    let remaining = paragraph.trim();
    while (remaining && unitsFor(remaining) > maximumUnits) {
      let units = 0;
      let overflowIndex = remaining.length;
      let whitespaceIndex = -1;
      for (let index = 0; index < remaining.length; index += 1) {
        const character = remaining[index] ?? "";
        units += unitsFor(character);
        if (/\s/.test(character)) whitespaceIndex = index;
        if (units > maximumUnits) {
          overflowIndex = index;
          break;
        }
      }
      const breakIndex = whitespaceIndex > 0 ? whitespaceIndex : Math.max(1, overflowIndex);
      lines.push(remaining.slice(0, breakIndex).trim());
      remaining = remaining.slice(breakIndex).trimStart();
    }
    if (remaining || !paragraph) lines.push(remaining);
  }
  if (lines.length <= maximumLines) return lines;
  const result = lines.slice(0, maximumLines);
  result[maximumLines - 1] = `${result[maximumLines - 1]?.replace(/[.…]+$/, "") ?? ""}…`;
  return result;
}

function appendSlideText(
  group: SVGGElement,
  context: ShapeRenderContext,
  value: string,
  options: { x: number; y: number; width: number; fontSize: number; lineHeight: number; weight?: number; color?: string; align?: "start" | "middle"; maximumLines?: number },
): void {
  const lines = slideLines(value, Math.max(4, options.width / options.fontSize), options.maximumLines ?? 3);
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
    const span = svgElement(context.document, "tspan", { x: options.x, dy: index === 0 ? 0 : options.lineHeight });
    span.textContent = line;
    text.append(span);
  });
  group.append(text);
}

export const slideTitleShape: ShapePlugin = {
  name: "slide-title",
  measure: ({ attributes }) => ({ width: numericAttribute(attributes, "width", 880, 320, 1400), height: 58 }),
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
  measure: ({ attributes }) => ({ width: numericAttribute(attributes, "width", 880, 320, 1400), height: 36 }),
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
  measure: ({ attributes }) => ({
    width: numericAttribute(attributes, "width", 224, 150, 440),
    height: numericAttribute(attributes, "height", attributes.body ? 126 : 92, 72, 260),
  }),
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
      const badgeWidth = Math.max(44, textWidth(node.attributes.badge, 10) + 16);
      group.append(svgElement(document, "rect", { x: 18, y: 14, width: badgeWidth, height: 20, rx: 10, fill: theme.containerFill }));
      appendSlideText(group, context, node.attributes.badge.toUpperCase(), { x: 18 + badgeWidth / 2, y: 28, width: badgeWidth - 8, fontSize: 10, lineHeight: 12, weight: 750, color: theme.accentColor, align: "middle" });
    }
    const titleY = node.attributes.badge ? 56 : node.attributes.body ? 36 : node.height / 2 + 6;
    appendSlideText(group, context, node.label, { x: 20, y: titleY, width: node.width - 40, fontSize: 17, lineHeight: 21, weight: 700 });
    if (node.attributes.body) appendSlideText(group, context, node.attributes.body, { x: 20, y: titleY + 30, width: node.width - 40, fontSize: 12, lineHeight: 17, color: theme.mutedColor });
    return group;
  },
};

export const slideNoteShape: ShapePlugin = {
  name: "slide-note",
  measure: ({ attributes }) => ({ width: numericAttribute(attributes, "width", 300, 180, 700), height: numericAttribute(attributes, "height", attributes.body ? 92 : 68, 56, 200) }),
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 10, fill: theme.containerFill, stroke: theme.containerStroke, "stroke-width": 1 }));
    group.append(svgElement(document, "circle", { cx: 18, cy: 22, r: 5, fill: theme.accentColor }));
    appendSlideText(group, context, node.label, { x: 32, y: 27, width: node.width - 48, fontSize: 14, lineHeight: 18, weight: 650 });
    if (node.attributes.body) appendSlideText(group, context, node.attributes.body, { x: 18, y: 54, width: node.width - 36, fontSize: 12, lineHeight: 17, color: theme.mutedColor });
    return group;
  },
};

export const slideCalloutShape: ShapePlugin = {
  name: "slide-callout",
  measure: ({ attributes }) => ({ width: numericAttribute(attributes, "width", 520, 240, 1000), height: numericAttribute(attributes, "height", attributes.body ? 112 : 82, 70, 240) }),
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 16, fill: theme.containerFill, stroke: theme.accentColor, "stroke-width": 2 }));
    appendSlideText(group, context, node.label, { x: 24, y: 36, width: node.width - 48, fontSize: 20, lineHeight: 25, weight: 760, color: theme.accentColor });
    if (node.attributes.body) appendSlideText(group, context, node.attributes.body, { x: 24, y: 68, width: node.width - 48, fontSize: 13, lineHeight: 18, color: theme.mutedColor });
    return group;
  },
};

export const slideBadgeShape: ShapePlugin = {
  name: "slide-badge",
  measure: ({ label, theme }) => ({ width: Math.max(92, textWidth(label, theme.fontSize) + 34), height: 36 }),
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
  measure: ({ attributes }) => ({
    width: numericAttribute(attributes, "width", 224, 160, 440),
    height: numericAttribute(attributes, "height", 132, 104, 240),
  }),
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
      y: 72,
      width: node.width - 40,
      fontSize: 31,
      lineHeight: 34,
      weight: 780,
      color: accent ? theme.accentColor : theme.labelColor,
      maximumLines: 1,
    });
    if (node.attributes.delta) {
      const positive = !/^[-−]/.test(node.attributes.delta.trim());
      const deltaColor = positive ? theme.accentColor : theme.mutedColor;
      group.append(svgElement(document, "rect", { x: 18, y: node.height - 32, width: node.width - 36, height: 20, rx: 10, fill: theme.containerFill }));
      appendSlideText(group, context, node.attributes.delta, {
        x: 28,
        y: node.height - 18,
        width: node.width - 56,
        fontSize: 11,
        lineHeight: 13,
        weight: 680,
        color: deltaColor,
        maximumLines: 1,
      });
    }
    return group;
  },
};

export const slideBarShape: ShapePlugin = {
  name: "slide-bar",
  measure: ({ attributes }) => ({
    width: numericAttribute(attributes, "width", 560, 260, 1000),
    height: numericAttribute(attributes, "height", 68, 58, 120),
  }),
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
    appendSlideText(group, context, node.label, { x: 16, y: 27, width: node.width - 120, fontSize: 14, lineHeight: 17, weight: 650, maximumLines: 1 });
    appendSlideText(group, context, `${value}${suffix}`, { x: node.width - 52, y: 27, width: 80, fontSize: 15, lineHeight: 17, weight: 760, color: theme.accentColor, align: "middle", maximumLines: 1 });
    group.append(svgElement(document, "rect", { x: trackX, y: trackY, width: trackWidth, height: 8, rx: 4, fill: theme.containerFill }));
    group.append(svgElement(document, "rect", { x: trackX, y: trackY, width: ratio === 0 ? 0 : Math.max(8, trackWidth * ratio), height: 8, rx: 4, fill: theme.accentColor }));
    return group;
  },
};

export const slideQuoteShape: ShapePlugin = {
  name: "slide-quote",
  measure: ({ attributes }) => ({
    width: numericAttribute(attributes, "width", 640, 300, 1100),
    height: numericAttribute(attributes, "height", 172, 120, 320),
  }),
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 18, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    group.append(svgElement(document, "rect", { width: 8, height: node.height, rx: 4, fill: theme.accentColor }));
    const mark = svgElement(document, "text", { x: 28, y: 53, fill: theme.accentColor, "font-family": theme.fontFamily, "font-size": 52, "font-weight": 800 });
    mark.textContent = "“";
    group.append(mark);
    appendSlideText(group, context, node.label, { x: 76, y: 43, width: node.width - 104, fontSize: 18, lineHeight: 25, weight: 620, maximumLines: 4 });
    if (node.attributes.by) {
      const attribution = node.attributes.role ? `${node.attributes.by} · ${node.attributes.role}` : node.attributes.by;
      appendSlideText(group, context, attribution, { x: 76, y: node.height - 24, width: node.width - 104, fontSize: 12, lineHeight: 15, weight: 650, color: theme.mutedColor, maximumLines: 1 });
    }
    return group;
  },
};

export const slideMilestoneShape: ShapePlugin = {
  name: "slide-milestone",
  measure: ({ attributes }) => ({
    width: numericAttribute(attributes, "width", 200, 150, 380),
    height: numericAttribute(attributes, "height", attributes.body ? 148 : 116, 100, 260),
  }),
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { x: 14, y: 18, width: node.width - 14, height: node.height - 18, rx: 14, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    group.append(svgElement(document, "circle", { cx: 20, cy: 38, r: 17, fill: theme.accentColor, stroke: theme.nodeFill, "stroke-width": 5 }));
    const dot = svgElement(document, "text", { x: 20, y: 43, "text-anchor": "middle", fill: theme.nodeFill, "font-family": theme.fontFamily, "font-size": 15, "font-weight": 800 });
    dot.textContent = node.attributes.step ?? "•";
    group.append(dot);
    if (node.attributes.period) appendSlideText(group, context, node.attributes.period.toUpperCase(), { x: 50, y: 29, width: node.width - 68, fontSize: 10, lineHeight: 12, weight: 760, color: theme.accentColor, maximumLines: 1 });
    appendSlideText(group, context, node.label, { x: 50, y: node.attributes.period ? 54 : 43, width: node.width - 68, fontSize: 16, lineHeight: 20, weight: 720, maximumLines: 2 });
    if (node.attributes.body) appendSlideText(group, context, node.attributes.body, { x: 32, y: 88, width: node.width - 50, fontSize: 12, lineHeight: 17, color: theme.mutedColor, maximumLines: 3 });
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

interface UmlMemberData {
  text: string;
  kind: "attribute" | "operation" | "literal";
}

function umlMembers(attributes: Record<string, string>): UmlMemberData[] {
  try {
    const value = JSON.parse(attributes.members ?? "[]") as unknown;
    return Array.isArray(value) ? value as UmlMemberData[] : [];
  } catch {
    return [];
  }
}

export const umlClassShape: ShapePlugin = {
  name: "uml-class",
  measure: ({ label, attributes, theme }) => {
    const members = umlMembers(attributes);
    const longest = Math.max(textWidth(label, theme.fontSize + 1), ...members.map((member) => textWidth(member.text, theme.fontSize - 1)));
    const stereotypeHeight = attributes.kind === "class" ? 0 : 18;
    const attributeRows = Math.max(1, members.filter((member) => member.kind !== "operation").length);
    const operationRows = members.filter((member) => member.kind === "operation").length;
    return { width: Math.max(210, longest + 34), height: 46 + stereotypeHeight + attributeRows * 23 + operationRows * 23 + 12 };
  },
  render(context) {
    const { node, theme, document } = context;
    const members = umlMembers(node.attributes);
    const kind = node.attributes.kind ?? "class";
    const stereotypeHeight = kind === "class" ? 0 : 18;
    const headerHeight = 46 + stereotypeHeight;
    const group = groupFor(context);
    group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 4, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    if (kind !== "class") {
      const stereotype = svgElement(document, "text", { x: node.width / 2, y: 17, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 2 });
      stereotype.textContent = `«${kind}»`;
      group.append(stereotype);
    }
    const title = svgElement(document, "text", { x: node.width / 2, y: 30 + stereotypeHeight, "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize + 1, "font-weight": 720, "font-style": kind === "abstract" ? "italic" : undefined });
    title.textContent = node.label;
    group.append(title, svgElement(document, "line", { x1: 0, y1: headerHeight, x2: node.width, y2: headerHeight, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
    const attributes = members.filter((member) => member.kind !== "operation");
    const operations = members.filter((member) => member.kind === "operation");
    let y = headerHeight + 20;
    for (const member of attributes) {
      const text = svgElement(document, "text", { x: 12, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1, "font-style": member.kind === "literal" ? "italic" : undefined });
      text.textContent = member.text;
      group.append(text);
      y += 23;
    }
    if (operations.length) {
      const separatorY = headerHeight + Math.max(1, attributes.length) * 23;
      group.append(svgElement(document, "line", { x1: 0, y1: separatorY, x2: node.width, y2: separatorY, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      y = separatorY + 21;
      for (const member of operations) {
        const text = svgElement(document, "text", { x: 12, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1 });
        text.textContent = member.text;
        group.append(text);
        y += 23;
      }
    }
    return group;
  },
};

export const usecaseShape: ShapePlugin = {
  name: "usecase",
  measure: ({ label, theme }) => wrappedLabelSize(label, { theme }, { minimumWidth: 150, minimumHeight: 72, paddingX: 27, paddingY: 18, maximumTextWidth: 180 }),
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "ellipse", { cx: node.width / 2, cy: node.height / 2, rx: node.width / 2, ry: node.height / 2, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    addLabel(group, context, 0, 27);
    return group;
  },
};

export const umlArtifactShape: ShapePlugin = {
  name: "uml-artifact",
  measure: ({ label, theme }) => {
    const size = wrappedLabelSize(label, { theme }, { minimumWidth: 132, minimumHeight: 46, paddingX: 20 });
    return { width: size.width, height: Math.max(66, size.height + 20) };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    const fold = 16;
    group.append(svgElement(document, "path", { d: `M 0 0 H ${node.width - fold} L ${node.width} ${fold} V ${node.height} H 0 Z`, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    group.append(svgElement(document, "path", { d: `M ${node.width - fold} 0 V ${fold} H ${node.width}`, fill: "none", stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
    const stereotype = svgElement(document, "text", { x: node.width / 2, y: 20, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3 });
    stereotype.textContent = "«artifact»";
    group.append(stereotype);
    addLabel(group, context, 10, 20);
    return group;
  },
};

export const umlDeviceShape: ShapePlugin = {
  name: "uml-device",
  measure: ({ label, theme }) => {
    const size = wrappedLabelSize(label, { theme }, { minimumWidth: 140, minimumHeight: 46, paddingX: 22 });
    return { width: size.width, height: Math.max(76, size.height + 22) };
  },
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "path", { d: `M 0 12 L 12 0 H ${node.width} V ${node.height - 12} L ${node.width - 12} ${node.height} H 0 Z M 0 12 H ${node.width - 12} L ${node.width} 0 M ${node.width - 12} 12 V ${node.height}`, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
    const stereotype = svgElement(document, "text", { x: node.width / 2, y: 25, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3 });
    stereotype.textContent = "«device»";
    group.append(stereotype);
    addLabel(group, context, 11, 22);
    return group;
  },
};

export const umlExecutionShape: ShapePlugin = {
  name: "uml-execution",
  measure: ({ label, theme }) => ({ width: Math.max(146, textWidth(label, theme.fontSize) + 46), height: 68 }),
  render(context) {
    const group = rectangleShape.render(context);
    group.append(svgElement(context.document, "rect", { x: 6, y: 6, width: context.node.width - 12, height: context.node.height - 12, rx: 4, fill: "none", stroke: context.theme.containerStroke, "stroke-width": 1 }));
    return group;
  },
};

export const umlPortShape: ShapePlugin = {
  name: "uml-port",
  measure: () => ({ width: 26, height: 26 }),
  render(context) {
    const group = groupFor(context);
    group.append(svgElement(context.document, "rect", { x: 2, y: 2, width: 22, height: 22, fill: context.theme.nodeFill, stroke: context.theme.accentColor, "stroke-width": 1.7 }));
    return group;
  },
};

export const umlRequiredInterfaceShape: ShapePlugin = {
  name: "uml-required-interface",
  measure: ({ label, theme }) => ({ width: Math.max(76, textWidth(label, theme.fontSize - 1) + 20), height: 52 }),
  render(context) {
    const { node, theme, document } = context;
    const group = groupFor(context);
    group.append(svgElement(document, "path", { d: `M ${node.width / 2 - 18} 4 A 18 18 0 0 1 ${node.width / 2 + 18} 4`, fill: "none", stroke: theme.accentColor, "stroke-width": 2 }));
    const label = svgElement(document, "text", { x: node.width / 2, y: 39, "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1 });
    label.textContent = node.label;
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

export const historyStateShape = historyShape("history-state", false);
export const deepHistoryStateShape = historyShape("deep-history-state", true);

export const umlObjectShape: ShapePlugin = {
  ...rectangleShape,
  name: "uml-object",
  render(context) {
    const group = rectangleShape.render(context);
    group.append(svgElement(context.document, "line", { x1: 18, y1: context.node.height / 2 + 11, x2: context.node.width - 18, y2: context.node.height / 2 + 11, stroke: context.theme.labelColor, "stroke-width": 1 }));
    return group;
  },
};

export const builtInShapes: ShapePlugin[] = [
  rectangleShape,
  roundedShape,
  databaseShape,
  actorShape,
  containerShape,
  serverShape,
  diamondShape,
  parallelogramShape,
  circleShape,
  initialStateShape,
  finalStateShape,
  junctionStateShape,
  entityShape,
  componentShape,
  externalShape,
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
  usecaseShape,
  umlArtifactShape,
  umlDeviceShape,
  umlExecutionShape,
  umlPortShape,
  umlRequiredInterfaceShape,
  umlBarShape,
  choiceStateShape,
  historyStateShape,
  deepHistoryStateShape,
  umlObjectShape,
];
