import type { Bounds, LayoutOverlay, Point } from "./types.js";

export const SVG_NS = "http://www.w3.org/2000/svg";

export function routeMidpoint(points: Point[]): Point {
  const lengths = points.slice(1).map((point,index) => Math.hypot(point.x-points[index]!.x,point.y-points[index]!.y));
  let remaining = lengths.reduce((a,b)=>a+b,0)/2;
  for(let i=0;i<lengths.length;i++) {
    const length=lengths[i]!;
    if(remaining <= length && length) { const a=points[i]!,b=points[i+1]!; return {x:a.x+(b.x-a.x)*remaining/length,y:a.y+(b.y-a.y)*remaining/length}; }
    remaining-=length;
  }
  return points[0] ?? {x:0,y:0};
}

export function svgElement<K extends keyof SVGElementTagNameMap>(
  document: Document,
  name: K,
  attributes: Record<string, string | number | undefined> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) element.setAttribute(key, String(value));
  }
  return element;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

export function center(bounds: Bounds): Point {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function createOverlay(editable = true): LayoutOverlay {
  return { version: 1, editable, nodes: {} };
}

export function parseOverlay(value?: LayoutOverlay | string): LayoutOverlay {
  if (!value) return createOverlay();
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object" || (parsed as LayoutOverlay).version !== 1) {
    throw new Error("Unsupported Finch.js layout overlay.");
  }
  const overlay = parsed as LayoutOverlay;
  return {
    version: 1,
    ...(overlay.diagram ? { diagram: overlay.diagram } : {}),
    ...(typeof overlay.editable === "boolean" ? { editable: overlay.editable } : {}),
    ...(typeof overlay.frozen === "boolean" ? { frozen: overlay.frozen } : {}),
    nodes: Object.fromEntries(Object.entries(overlay.nodes ?? {}).map(([id, node]) => [id, { ...node }])),
  };
}

export function cloneOverlay(overlay: LayoutOverlay): LayoutOverlay {
  return parseOverlay(overlay);
}

export function pathFromPoints(points: Point[]): string {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`).join(" ");
}

export function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function uniqueId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}
