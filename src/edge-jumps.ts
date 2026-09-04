import type { GeometryEdge, Point } from "./types.js";
import { pathFromPoints, round } from "./utils.js";

const INTERSECTION_EPSILON = 0.001;
export const DEFAULT_EDGE_JUMP_RADIUS = 6;

interface SegmentJump {
  distance: number;
  point: Point;
}

export function pathWithEdgeJumps(
  edge: GeometryEdge,
  lowerEdges: readonly GeometryEdge[],
  radius = DEFAULT_EDGE_JUMP_RADIUS,
): string {
  if (radius <= 0 || edge.points.length < 2 || lowerEdges.length === 0) return pathFromPoints(edge.points);

  const points = simplifyPoints(edge.points);
  const lowerPaths = lowerEdges.map((lowerEdge) => simplifyPoints(lowerEdge.points));
  const jumpsBySegment = points.slice(0, -1).map(() => [] as SegmentJump[]);
  let jumpCount = 0;

  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = points[segmentIndex]!;
    const end = points[segmentIndex + 1]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length <= radius * 2) continue;

    for (const lowerPoints of lowerPaths) {
      for (let lowerIndex = 0; lowerIndex < lowerPoints.length - 1; lowerIndex += 1) {
        const intersection = segmentIntersection(start, end, lowerPoints[lowerIndex]!, lowerPoints[lowerIndex + 1]!);
        if (!intersection) continue;
        const distance = intersection.t * length;
        if (distance <= radius || distance >= length - radius) continue;
        const jumps = jumpsBySegment[segmentIndex]!;
        if (jumps.some((jump) => Math.abs(jump.distance - distance) < radius * 2)) continue;
        jumps.push({ distance, point: intersection.point });
        jumpCount += 1;
      }
    }
  }

  if (jumpCount === 0) return pathFromPoints(edge.points);

  const commands = [`M ${coordinate(points[0]!.x)} ${coordinate(points[0]!.y)}`];
  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = points[segmentIndex]!;
    const end = points[segmentIndex + 1]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const unitX = (end.x - start.x) / length;
    const unitY = (end.y - start.y) / length;
    const jumps = jumpsBySegment[segmentIndex]!.sort((a, b) => a.distance - b.distance);
    for (const jump of jumps) {
      const before = { x: jump.point.x - unitX * radius, y: jump.point.y - unitY * radius };
      const after = { x: jump.point.x + unitX * radius, y: jump.point.y + unitY * radius };
      commands.push(`L ${coordinate(before.x)} ${coordinate(before.y)}`);
      commands.push(`A ${coordinate(radius)} ${coordinate(radius)} 0 0 1 ${coordinate(after.x)} ${coordinate(after.y)}`);
    }
    commands.push(`L ${coordinate(end.x)} ${coordinate(end.y)}`);
  }
  return commands.join(" ");
}

function simplifyPoints(points: readonly Point[]): Point[] {
  const simplified: Point[] = [];
  for (const point of points) {
    const last = simplified[simplified.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > INTERSECTION_EPSILON) simplified.push(point);
  }
  let index = 1;
  while (index < simplified.length - 1) {
    const previous = simplified[index - 1]!;
    const current = simplified[index]!;
    const next = simplified[index + 1]!;
    const first = { x: current.x - previous.x, y: current.y - previous.y };
    const second = { x: next.x - current.x, y: next.y - current.y };
    if (Math.abs(cross(first, second)) <= INTERSECTION_EPSILON && first.x * second.x + first.y * second.y >= 0) {
      simplified.splice(index, 1);
    } else {
      index += 1;
    }
  }
  return simplified;
}

function segmentIntersection(
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
): { point: Point; t: number } | undefined {
  const first = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const second = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
  const denominator = cross(first, second);
  if (Math.abs(denominator) <= INTERSECTION_EPSILON) return undefined;
  const offset = { x: secondStart.x - firstStart.x, y: secondStart.y - firstStart.y };
  const t = cross(offset, second) / denominator;
  const u = cross(offset, first) / denominator;
  if (t <= INTERSECTION_EPSILON || t >= 1 - INTERSECTION_EPSILON) return undefined;
  if (u <= INTERSECTION_EPSILON || u >= 1 - INTERSECTION_EPSILON) return undefined;
  return {
    point: { x: firstStart.x + first.x * t, y: firstStart.y + first.y * t },
    t,
  };
}

function cross(first: Point, second: Point): number {
  return first.x * second.y - first.y * second.x;
}

function coordinate(value: number): string {
  return String(round(value));
}
