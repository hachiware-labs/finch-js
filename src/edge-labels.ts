import { richRuns } from "./rich-text.js";
import {sequenceFragmentSpan} from './sequence-fragments.js';
import type { Bounds, Geometry, GeometryEdge, Point, Size } from "./types.js";
import { wrappedLines, wrapWidth } from "./text-layout.js";

export interface EdgeLabelPlacement extends Bounds {
  point: Point;
  lines: string[];
  lineHeight: number;
}

/** Reading direction is separate from endpoint navigability. */
export function relationLabel(edge:GeometryEdge,from?:Point,to?:Point):string {
 const label=edge.label ?? '',direction=edge.attributes?.labelDirection;
 if(!direction || edge.points.length<2)return label;
 const first=from ?? edge.points[0]!,last=to ?? edge.points[edge.points.length-1]!,sign=direction==='forward'?1:-1;
 const dx=(last.x-first.x)*sign,dy=(last.y-first.y)*sign;
 const arrow=Math.abs(dx)>=Math.abs(dy) ? (dx>=0?'▶':'◀') : (dy>=0?'▼':'▲');
 return `${label} ${arrow}`;
}

export function estimatedTextWidth(text: string, fontSize: number): number {
  const plain=richRuns(text).map(run=>run.text).join("");
  return [...plain].reduce((width, character) => width + fontSize * (/[^\u0000-\u00ff]/.test(character) ? 1 : 0.62), 0);
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function labelSegments(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous?.x === point.x && previous.y === point.y) continue;
    const before = result[result.length - 2];
    if (before && previous && ((before.x === previous.x && previous.x === point.x && (previous.y - before.y) * (point.y - previous.y) >= 0)
      || (before.y === previous.y && previous.y === point.y && (previous.x - before.x) * (point.x - previous.x) >= 0))) result.pop();
    result.push(point);
  }
  return result;
}

function segmentHits(from: Point, to: Point, box: Bounds): boolean {
  if (from.x === to.x) return from.x > box.x && from.x < box.x + box.width
    && Math.max(from.y, to.y) > box.y && Math.min(from.y, to.y) < box.y + box.height;
  if (from.y === to.y) return from.y > box.y && from.y < box.y + box.height
    && Math.max(from.x, to.x) > box.x && Math.min(from.x, to.x) < box.x + box.width;
  return overlaps({ x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(from.x - to.x), height: Math.abs(from.y - to.y) }, box);
}

export function cardinalityPoint(edge: GeometryEdge, endpoint: "start" | "end"): Point {
  const points = endpoint === "start" ? edge.points : [...edge.points].reverse();
  let origin = points[0] ?? { x: 0, y: 0 };
  let remaining = 18;
  for (const target of points.slice(1)) {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const length = Math.hypot(dx, dy);
    if (length >= remaining && length > 0) {
      const point = { x: origin.x + dx * remaining / length, y: origin.y + dy * remaining / length };
      // Vertical endpoint labels must sit beside the line, not paint over its
      // diamond/arrow marker with their opaque text outline.
      if (Math.abs(dy) > Math.abs(dx)) point.x += estimatedTextWidth(endpointText(edge, endpoint) ?? "", 14) / 2 + 14;
      return point;
    }
    remaining -= length;
    origin = target;
  }
  return origin;
}

export function textBounds(point: Point, width: number, fontSize: number, extraHeight = 0): Bounds {
  // Include text ascenders, descenders, and the label's background stroke.
  return { x: point.x - width / 2 - 4, y: point.y - fontSize - 4, width: width + 8, height: fontSize * 1.3 + 8 + extraHeight };
}

/** Choose collision-aware labels; branch guards stay close to their decision. */
export function endpointText(edge: GeometryEdge, endpoint: "start" | "end"): string | undefined {
  const role = edge.attributes?.[endpoint === "start" ? "fromRole" : "toRole"];
  const count = edge.attributes?.[endpoint === "start" ? "fromCardinality" : "toCardinality"];
  return role && count ? `${role} [${count}]` : role ?? count;
}

/** Choose collision-aware labels; branch guards stay close to their decision. */
export function placeEdgeLabels(
  geometry: Geometry,
  fontSize: number,
  measure: (text: string) => number = (text) => estimatedTextWidth(text, fontSize),
): { labels: Map<string, EdgeLabelPlacement>; bounds: Bounds[] } {
  const labels = new Map<string, EdgeLabelPlacement>();
  const reserved: Bounds[] = [];
  for (const edge of geometry.edges) for (const endpoint of ["start", "end"] as const) {
    const text = endpointText(edge, endpoint);
    if (!text) continue;
    const point = cardinalityPoint(edge, endpoint);
    reserved.push(textBounds({ x: point.x, y: point.y - 6 }, measure(text), fontSize));
  }
  const obstacles: Bounds[] = geometry.nodes.map((node) => node.shape === "container"
    ? { x: node.x, y: node.y, width: node.width, height: (node.headerHeight ?? 42) - 10 }
    : { x: node.x - 6, y: node.y - 6, width: node.width + 12, height: node.height + 12 });
  for (const group of geometry.groups) obstacles.push({ x: group.x, y: group.y, width: group.width, height: group.headerHeight ?? 24 });
  const outgoing = new Map<string, number>();
  for (const edge of geometry.edges) outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
  for (const edge of geometry.edges) {
    if (!edge.label || !edge.points.length) continue;
    const maximumWidth = wrapWidth(edge.attributes, 180);
    const lineHeight = Math.ceil(fontSize * 1.4);
    const route = labelSegments(edge.points);
    const branch = ["flowchart", "activity"].includes(geometry.kind) && (outgoing.get(edge.from) ?? 0) > 1;
    const candidates: Array<{ placement: EdgeLabelPlacement; preference: number }> = [];
    let traveled = 0;
    for (let i = 1; i < route.length; i += 1) {
      const from = route[i - 1]!;
      const to = route[i]!;
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      if (!length) continue;
      const horizontal = from.y === to.y;
      const label = relationLabel(edge,from,to);
      // A short route segment must not split a word or a UML stereotype.
      // Explicit wrapWidth remains the upper bound requested by the caller.
      const tokenWidth = Math.max(48, ...label.split(/\s+/).map(measure));
      const lines = wrappedLines(label, horizontal ? Math.min(maximumWidth, Math.max(tokenWidth, length - 24)) : maximumWidth, measure);
      const width = Math.max(0, ...lines.map(measure));
      const extraHeight = (lines.length - 1) * lineHeight;
      const needed = horizontal ? width + 16 : fontSize * 1.3 + extraHeight + 16;
      const near = Math.min(0.5, (needed / 2 + 8) / length);
      for (const fraction of branch ? [near, 0.5, 1 - near] : [0.5, near, 1 - near]) {
        const x = from.x + (to.x - from.x) * fraction;
        const y = from.y + (to.y - from.y) * fraction;
        for (const offset of [0, 12, 24]) for (const side of [-1, 1]) {
          const point = horizontal
            ? { x, y: y + (side < 0 ? -8 - extraHeight - offset : fontSize + 8 + offset) }
            : { x: x + side * (width / 2 + 10 + offset), y: y + fontSize * 0.35 - extraHeight / 2 };
          candidates.push({
            placement: { ...textBounds(point, width, fontSize, extraHeight), point, lines, lineHeight },
            preference: Math.max(0, needed - length) * 4 + (branch ? (traveled + length * fraction) * 0.15 : horizontal ? 0 : 30)
              + Math.abs(fraction - 0.5) * (branch ? 0 : 10) + (side > 0 ? 1 : 0) + lines.length * 2 + offset * 2,
          });
        }
      }
      traveled += length;
    }
    const score = ({ placement, preference }: typeof candidates[number]): number => {
      let value = preference;
      for (const box of [...obstacles, ...reserved]) if (overlaps(placement, box)) value += 100_000;
      for (const other of geometry.edges) for (let i = 1; i < other.points.length; i += 1) {
        if (segmentHits(other.points[i - 1]!, other.points[i]!, placement)) value += 1000;
      }
      return value;
    };
    const ranked = candidates.map((candidate) => ({ ...candidate, score: score(candidate) })).sort((a, b) => a.score - b.score);
    const fallback = { x: edge.points[0]!.x, y: edge.points[0]!.y - 8 };
    const lines = wrappedLines(relationLabel(edge), maximumWidth, measure);
    const placement = ranked[0]?.placement ?? {
      ...textBounds(fallback, Math.max(0, ...lines.map(measure)), fontSize, (lines.length - 1) * lineHeight), point: fallback, lines, lineHeight,
    };
    labels.set(edge.id, placement);
    reserved.push(placement);
  }
  return { labels, bounds: reserved };
}

/** Expand all four viewport sides without translating nodes or saved coordinates. */
export function fitVisualBounds(geometry: Geometry, minimum: Size, labels: Bounds[], padding = 28): void {
  const boxes: Bounds[] = [...geometry.nodes, ...geometry.groups, ...labels];
  if(geometry.kind==='sequence')for(const edge of geometry.edges.filter(edge=>edge.attributes?.messageKind==='note')){
    const ids=edge.attributes!.participants!.split(',');
    boxes.push({...sequenceFragmentSpan(geometry.nodes.filter(node=>ids.includes(node.id)),'note'),y:edge.points[0]!.y,height:0});
  }
  for (const edge of geometry.edges) for (const point of edge.points) boxes.push({ ...point, width: 0, height: 0 });
  const left = Math.min(0, ...boxes.map((box) => box.x - padding));
  const top = Math.min(0, ...boxes.map((box) => box.y - padding));
  const right = Math.max(minimum.width, ...boxes.map((box) => box.x + box.width + padding));
  const bottom = Math.max(minimum.height, ...boxes.map((box) => box.y + box.height + padding));
  geometry.origin = { x: left, y: top };
  geometry.width = right - left;
  geometry.height = bottom - top;
}
