import type { IconDefinition, GeometryNode, ShapePlugin, Theme } from "./types.js";
import { svgElement } from "./utils.js";
import { textWidth } from "./text-layout.js";
import { imageUrl } from "./images.js";

let nextImageClip = 0;

// Available to every theme, including themes without a tones palette.
const commonToneStrokes: Readonly<Record<string, string>> = {
  cyan: "#138da5", coral: "#d65372", green: "#23966c",
  amber: "#b88920", violet: "#9271ce",
};

export function inheritedTone(node: GeometryNode, nodes: GeometryNode[]): string | undefined {
  const visited = new Set<string>();
  let current: GeometryNode | undefined = node;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.attributes.tone !== undefined) return current.attributes.tone;
    current = nodes.find(parent => parent.id === current?.parentId);
  }
  return undefined;
}

export function nodeTheme(node: GeometryNode, nodes: GeometryNode[], theme: Theme): Theme {
    const name = inheritedTone(node, nodes);
    if (name !== undefined) {
      const stroke = commonToneStrokes[name];
      const tone = theme.tones?.[name] ?? (stroke ? { fill: node.shape === "container" ? theme.containerFill : theme.nodeFill, stroke } : undefined);
      if (!tone || name === "none") return theme;
      return { ...theme, nodeFill: tone.fill, containerFill: tone.fill,
        nodeStroke: tone.stroke, containerStroke: tone.stroke, accentColor: tone.stroke,
        labelColor: tone.labelColor ?? theme.labelColor,
        mutedColor: node.shape === "container" ? tone.stroke : theme.mutedColor };
    }
  return theme;
}

// Restrict the first icon integration to single-label box shapes.
const supported = new Set(["rectangle", "rounded", "storage", "process", "collections", "stack", "person", "server", "database", "card", "queue", "hexagon", "label", "cloud", "uml-artifact", "uml-file", "uml-node", "uml-device", "uml-execution"]);
export function withNodeIcon(shape: ShapePlugin, resolveIcon: (name: string) => IconDefinition | undefined): ShapePlugin {
  const decoratedLabel = (label: string, attributes: Record<string,string>) => [
    !["uml-class", "uml-state", "uml-instance"].includes(shape.name) && attributes.hideStereotype !== "true" && attributes.stereotype ? `«${attributes.stereotype}»` : "",
    attributes.submachine ? `${label} : ${attributes.submachine}` : label,
    shape.name === "container" && attributes.stateBody ? (JSON.parse(attributes.stateBody) as string[]).join("\n") : "",
  ].filter(Boolean).join("\n");
  const iconFor = (attributes: Record<string, string>) =>
    supported.has(shape.name) ? (attributes.image ? { src: attributes.image } : resolveIcon(attributes.icon ?? "")) : undefined;
  return {
    ...shape,
    measure(context) {
      const size = shape.measure({ ...context, label: decoratedLabel(context.label, context.attributes) });
      return iconFor(context.attributes) ? { ...size, width: size.width + 32, height: Math.max(size.height, 44) } : size;
    },
    render(context) {
      const group = shape.render({ ...context, node: { ...context.node, label: decoratedLabel(context.node.label, context.node.attributes) } });
      const definition = iconFor(context.node.attributes);
      if (!definition) return group;
      const labels = group.querySelectorAll<SVGTextElement>(":scope > text");
      const label = labels[labels.length - 1];
      if (!label) return group;
      const spans = [...label.querySelectorAll("tspan")];
      const lines = spans.length ? spans.map(span => span.textContent ?? "") : [label.textContent ?? ""];
      const width = Math.max(...lines.map(line => textWidth(line, context.theme.fontSize, context.theme.fontFamily)));
      const ys = spans.length ? spans.map(span => Number(span.getAttribute("y"))) : [Number(label.getAttribute("y"))];
      label.setAttribute("transform", "translate(16 0)");
      const icon = svgElement(context.document, "g", {
        class: "finch-node-icon", "aria-hidden": "true", "pointer-events": "none",
        transform: `translate(${context.node.width / 2 - width / 2 - 16} ${(Math.min(...ys) + Math.max(...ys)) / 2 - 11}) scale(${22 / 24})`,
        fill: "none", stroke: context.theme.accentColor, "stroke-width": 2,
        "stroke-linecap": "round", "stroke-linejoin": "round",
      });
      if (!Array.isArray(definition)) {
        const crop = context.node.attributes.imageShape;
        const image = svgElement(context.document, "image", {
          href: imageUrl(definition.src, context.document), width: 24, height: 24,
          preserveAspectRatio: crop === "circle" || crop === "rounded" ? "xMidYMid slice" : "xMidYMid meet",
        });
        if (crop === "circle" || crop === "rounded") {
          const id = `finch-image-clip-${++nextImageClip}`;
          const defs = svgElement(context.document, "defs", {});
          const clip = svgElement(context.document, "clipPath", { id });
          clip.append(crop === "circle" ? svgElement(context.document, "circle", { cx: 12, cy: 12, r: 12 })
            : svgElement(context.document, "rect", { width: 24, height: 24, rx: 5 }));
          defs.append(clip); icon.append(defs);
          image.setAttribute("clip-path", `url(#${id})`);
        }
        icon.append(image); group.append(icon); return group;
      }
      const tags = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
      const attrs = new Set(["d", "x", "y", "width", "height", "rx", "ry", "cx", "cy", "r", "x1", "y1", "x2", "y2", "points"]);
      for (const primitive of definition) {
        if (!tags.has(primitive.tag)) continue;
        icon.append(svgElement(context.document, primitive.tag,
          Object.fromEntries(Object.entries(primitive.attributes).filter(([key]) => attrs.has(key)))));
      }
      group.append(icon);
      return group;
    },
  };
}


