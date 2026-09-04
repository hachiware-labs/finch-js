import type { Geometry, GeometryEdge, GeometryGroup, GeometryNode, LayoutContext, LayoutItem, LayoutModel, LayoutPlugin, Point } from "./types.js";
import { center } from "./utils.js";

const CANVAS_PADDING = 28;

function byId<T extends { id: string }>(values: T[]): Map<string, T> {
  return new Map(values.map((value) => [value.id, value]));
}

function applyContinuity(nodes: GeometryNode[], context: LayoutContext): void {
  const previous = byId(context.previous?.nodes ?? []);
  for (const node of nodes) {
    const state = context.overlay.nodes[node.id];
    if (state && (!context.force || (context.preservePinned && state.pinned))) {
      node.x = state.x;
      node.y = state.y;
      if (state.width) node.width = state.width;
      if (state.height) node.height = state.height;
      continue;
    }
    const old = previous.get(node.id);
    if (!context.force && old) {
      node.x = old.x;
      node.y = old.y;
    }
  }
}

function ranks(model: LayoutModel): Map<string, number> {
  const items = model.items.filter((item) => item.shape !== "container");
  const itemIds = new Set(items.map((item) => item.id));
  const result = new Map(items.map((item) => [item.id, 0]));
  const adjacency = new Map(items.map((item) => [item.id, new Set<string>()]));
  const acceptedEdges: LayoutModel["connections"] = [];
  const reaches = (start: string, goal: string): boolean => {
    const pending = [start];
    const visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop();
      if (!current || visited.has(current)) continue;
      if (current === goal) return true;
      visited.add(current);
      pending.push(...(adjacency.get(current) ?? []));
    }
    return false;
  };
  for (const edge of model.connections) {
    if (!itemIds.has(edge.from) || !itemIds.has(edge.to) || edge.from === edge.to) continue;
    // Preserve the first readable direction and treat later cycle-closing edges as back edges.
    if (reaches(edge.to, edge.from)) continue;
    adjacency.get(edge.from)?.add(edge.to);
    acceptedEdges.push(edge);
  }
  for (let iteration = 0; iteration < items.length; iteration += 1) {
    let changed = false;
    for (const edge of acceptedEdges) {
      const next = Math.min(items.length - 1, (result.get(edge.from) ?? 0) + 1);
      if (next > (result.get(edge.to) ?? 0)) {
        result.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return result;
}

function arrangeDeployment(model: LayoutModel): GeometryNode[] {
  const rankById = ranks(model);
  const normal = model.items.filter((item) => item.shape !== "container");
  const itemMap = byId(model.items);
  const columns = new Map<number, LayoutItem[]>();
  for (const item of normal) {
    const rank = rankById.get(item.id) ?? 0;
    const column = columns.get(rank) ?? [];
    column.push(item);
    columns.set(rank, column);
  }

  const columnWidths = new Map<number, number>();
  for (const [rank, items] of columns) columnWidths.set(rank, Math.max(...items.map((item) => item.size.width)));
  const orderedRanks = [...columns.keys()].sort((a, b) => a - b);
  const bandFor = (item: LayoutItem): string => {
    let parentId = item.parentId;
    let topLevel = "__root";
    let guard = 0;
    while (parentId && guard < model.items.length) {
      topLevel = parentId;
      parentId = itemMap.get(parentId)?.parentId;
      guard += 1;
    }
    return topLevel;
  };
  const bandOrder: string[] = [];
  for (const item of normal) {
    const band = bandFor(item);
    if (!bandOrder.includes(band)) bandOrder.push(band);
  }
  const bandTops = new Map<string, number>();
  let nextBandY = CANVAS_PADDING + 28;
  for (const band of bandOrder) {
    let bandHeight = 0;
    for (const items of columns.values()) {
      const members = items.filter((item) => bandFor(item) === band);
      const height = members.reduce((sum, item) => sum + item.size.height, 0)
        + Math.max(0, members.length - 1) * model.minimumGap;
      bandHeight = Math.max(bandHeight, height);
    }
    bandTops.set(band, nextBandY);
    nextBandY += Math.max(46, bandHeight) + (band === "__root" ? 42 : 72);
  }
  let x = CANVAS_PADDING;
  const nodes: GeometryNode[] = [];
  for (const rank of orderedRanks) {
    const items = columns.get(rank) ?? [];
    for (const band of bandOrder) {
      let y = bandTops.get(band) ?? CANVAS_PADDING;
      for (const item of items.filter((candidate) => bandFor(candidate) === band)) {
        nodes.push({
          id: item.id,
          label: item.label,
          shape: item.shape,
          ...(item.parentId ? { parentId: item.parentId } : {}),
          attributes: item.attributes,
          x,
          y,
          ...item.size,
        });
        y += item.size.height + model.minimumGap;
      }
    }
    x += (columnWidths.get(rank) ?? 120) + 72;
  }

  for (const item of model.items.filter((candidate) => candidate.shape === "container")) {
    nodes.push({
      id: item.id,
      label: item.label,
      shape: item.shape,
      ...(item.parentId ? { parentId: item.parentId } : {}),
      attributes: item.attributes,
      x: CANVAS_PADDING,
      y: CANVAS_PADDING,
      ...item.size,
    });
  }
  return nodes;
}

function fitContainers(nodes: GeometryNode[]): void {
  const nodeMap = byId(nodes);
  const containers = nodes.filter((node) => node.shape === "container");
  const depth = (node: GeometryNode): number => {
    let count = 0;
    let parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
    while (parent && count < nodes.length) {
      count += 1;
      parent = parent.parentId ? nodeMap.get(parent.parentId) : undefined;
    }
    return count;
  };
  containers.sort((a, b) => depth(b) - depth(a));
  for (const container of containers) {
    fitContainer(container, nodes);
  }
}

function fitContainer(container: GeometryNode, nodes: GeometryNode[]): void {
  const children = nodes.filter((node) => node.parentId === container.id);
  if (!children.length) return;
  const left = Math.min(...children.map((node) => node.x));
  const top = Math.min(...children.map((node) => node.y));
  const right = Math.max(...children.map((node) => node.x + node.width));
  const bottom = Math.max(...children.map((node) => node.y + node.height));
  container.x = left - 26;
  container.y = top - 42;
  container.width = Math.max(container.width, right - left + 52);
  container.height = Math.max(container.height, bottom - top + 68);
}

type ContainerBounds = Pick<GeometryNode, "x" | "y" | "width" | "height">;

/**
 * Resize every container around moved descendants, using its automatic-layout
 * frame as the minimum bounds. Inner containers are processed first so nested
 * expansion and contraction propagate to every outer frame in the same move.
 */
export function resizeAncestorContainers(
  nodes: GeometryNode[],
  movedIds: Iterable<string>,
  baseBounds: ReadonlyMap<string, ContainerBounds> = new Map(),
): string[] {
  const nodeMap = byId(nodes);
  const ancestors = new Set<string>();
  for (const id of movedIds) {
    let parentId = nodeMap.get(id)?.parentId;
    while (parentId) {
      const parent = nodeMap.get(parentId);
      if (!parent || parent.shape !== "container") break;
      ancestors.add(parent.id);
      parentId = parent.parentId;
    }
  }

  const depth = (node: GeometryNode): number => {
    let value = 0;
    let parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
    while (parent && value < nodes.length) {
      value += 1;
      parent = parent.parentId ? nodeMap.get(parent.parentId) : undefined;
    }
    return value;
  };
  const changed: string[] = [];
  const containers = [...ancestors]
    .map((id) => nodeMap.get(id))
    .filter((node): node is GeometryNode => Boolean(node))
    .sort((left, right) => depth(right) - depth(left));

  for (const container of containers) {
    const children = nodes.filter((node) => node.parentId === container.id);
    if (!children.length) continue;
    const desiredLeft = Math.min(...children.map((node) => node.x)) - 26;
    const desiredTop = Math.min(...children.map((node) => node.y)) - 42;
    const desiredRight = Math.max(...children.map((node) => node.x + node.width)) + 26;
    const desiredBottom = Math.max(...children.map((node) => node.y + node.height)) + 26;
    const base = baseBounds.get(container.id) ?? container;
    const nextLeft = Math.min(base.x, desiredLeft);
    const nextTop = Math.min(base.y, desiredTop);
    const nextRight = Math.max(base.x + base.width, desiredRight);
    const nextBottom = Math.max(base.y + base.height, desiredBottom);
    if (nextLeft === container.x && nextTop === container.y
      && nextRight === container.x + container.width && nextBottom === container.y + container.height) continue;
    container.x = nextLeft;
    container.y = nextTop;
    container.width = nextRight - nextLeft;
    container.height = nextBottom - nextTop;
    changed.push(container.id);
  }
  return changed;
}

/** @deprecated Use resizeAncestorContainers() to support contraction as well. */
export function expandAncestorContainers(nodes: GeometryNode[], movedIds: Iterable<string>): string[] {
  return resizeAncestorContainers(nodes, movedIds);
}

function resetContainerSize(container: GeometryNode, model: LayoutModel): void {
  const measured = model.items.find((item) => item.id === container.id)?.size;
  if (!measured) return;
  container.width = measured.width;
  container.height = measured.height;
}

type ContainerLayout = "row" | "column" | "grid";

function layoutNumber(node: { attributes: Record<string, string> }, name: string, minimum = 1): number | undefined {
  const value = Number(node.attributes[name]);
  return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : undefined;
}

function orderedForLayout(nodes: GeometryNode[]): GeometryNode[] {
  return nodes
    .map((node, index) => ({ node, index, order: layoutNumber(node, "order", 0) }))
    .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
      || left.index - right.index)
    .map(({ node }) => node);
}

function arrangeBlocks(
  children: GeometryNode[],
  layout: ContainerLayout,
  container: GeometryNode,
  gap: number,
  move: (node: GeometryNode, x: number, y: number) => void,
): void {
  const ordered = orderedForLayout(children);
  const originX = Math.min(...children.map((node) => node.x));
  const originY = Math.min(...children.map((node) => node.y));
  if (layout === "column") {
    let y = originY;
    for (const node of ordered) {
      move(node, originX, y);
      y += node.height + gap;
    }
    return;
  }
  if (layout === "row") {
    let x = originX;
    for (const node of ordered) {
      move(node, x, originY);
      x += node.width + gap;
    }
    return;
  }

  const columnCount = Math.min(ordered.length, layoutNumber(container, "columns") ?? Math.ceil(Math.sqrt(ordered.length)));
  const occupied = new Set<string>();
  const cells = ordered.map((node, index) => {
    const preferredRow = layoutNumber(node, "row");
    const preferredColumn = layoutNumber(node, "column");
    let row = preferredRow ? preferredRow - 1 : Math.floor(index / columnCount);
    let column = preferredColumn ? preferredColumn - 1 : index % columnCount;
    while (occupied.has(`${row}:${column}`)) {
      column += 1;
      if (column >= columnCount) {
        column = 0;
        row += 1;
      }
    }
    occupied.add(`${row}:${column}`);
    return { node, row, column };
  });
  const rows = Math.max(...cells.map((cell) => cell.row)) + 1;
  const columns = Math.max(columnCount, ...cells.map((cell) => cell.column + 1));
  const columnWidths = Array.from({ length: columns }, (_, column) =>
    Math.max(0, ...cells.filter((cell) => cell.column === column).map((cell) => cell.node.width)));
  const rowHeights = Array.from({ length: rows }, (_, row) =>
    Math.max(0, ...cells.filter((cell) => cell.row === row).map((cell) => cell.node.height)));
  const columnOffsets = columnWidths.map((_, column) =>
    originX + columnWidths.slice(0, column).reduce((sum, width) => sum + width, 0) + column * gap);
  const rowOffsets = rowHeights.map((_, row) =>
    originY + rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0) + row * gap);
  for (const cell of cells) move(cell.node, columnOffsets[cell.column]!, rowOffsets[cell.row]!);
}

function arrangeContainerContents(nodes: GeometryNode[], model: LayoutModel): void {
  const containers = nodes.filter((node) => node.shape === "container");
  for (const container of containers) {
    const children = nodes.filter((node) => node.parentId === container.id && node.shape !== "container");
    const hasNestedContainer = nodes.some((node) => node.parentId === container.id && node.shape === "container");
    if (children.length < 2 || hasNestedContainer) continue;
    const childIds = new Set(children.map((node) => node.id));
    const internalEdges = model.connections.filter((edge) => childIds.has(edge.from) && childIds.has(edge.to));
    const originX = Math.min(...children.map((node) => node.x));
    const originY = Math.min(...children.map((node) => node.y));

    const requestedLayout = container.attributes.layout;
    if (requestedLayout === "row" || requestedLayout === "column" || requestedLayout === "grid") {
      arrangeBlocks(children, requestedLayout, container, model.minimumGap, (node, x, y) => {
        node.x = x;
        node.y = y;
      });
      continue;
    }

    if (!internalEdges.length) {
      const columns = Math.ceil(Math.sqrt(children.length));
      const cellWidth = Math.max(...children.map((node) => node.width)) + 32;
      const cellHeight = Math.max(...children.map((node) => node.height)) + 28;
      children.forEach((node, index) => {
        node.x = originX + (index % columns) * cellWidth;
        node.y = originY + Math.floor(index / columns) * cellHeight;
      });
      continue;
    }

    const localRanks = new Map(children.map((node) => [node.id, 0]));
    for (let iteration = 0; iteration < children.length; iteration += 1) {
      let changed = false;
      for (const edge of internalEdges) {
        const next = Math.min(children.length - 1, (localRanks.get(edge.from) ?? 0) + 1);
        if (next > (localRanks.get(edge.to) ?? 0)) {
          localRanks.set(edge.to, next);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const rankValues = [...new Set(localRanks.values())].sort((a, b) => a - b);
    let x = originX;
    for (const rank of rankValues) {
      const members = children.filter((node) => localRanks.get(node.id) === rank);
      let y = originY;
      for (const node of members) {
        node.x = x;
        node.y = y;
        y += node.height + model.minimumGap;
      }
      x += Math.max(...members.map((node) => node.width)) + 40;
    }
  }
}

/**
 * Lay out direct children as blocks when a container mixes nested containers
 * with ordinary nodes. Descendants move with their nearest child container so
 * sibling blocks cannot occupy the same space.
 */
function arrangeNestedContainerContents(nodes: GeometryNode[], model: LayoutModel): void {
  const nodeMap = byId(nodes);
  const depth = (node: GeometryNode): number => {
    let count = 0;
    let parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
    while (parent && count < nodes.length) {
      count += 1;
      parent = parent.parentId ? nodeMap.get(parent.parentId) : undefined;
    }
    return count;
  };
  const moveBlock = (rootId: string, dx: number, dy: number): void => {
    for (const node of nodes) {
      let current: GeometryNode | undefined = node;
      let guard = 0;
      while (current && guard < nodes.length) {
        if (current.id === rootId) {
          node.x += dx;
          node.y += dy;
          break;
        }
        current = current.parentId ? nodeMap.get(current.parentId) : undefined;
        guard += 1;
      }
    }
  };

  const containers = nodes
    .filter((node) => node.shape === "container")
    .sort((a, b) => depth(b) - depth(a));
  for (const container of containers) {
    const children = nodes.filter((node) => node.parentId === container.id);
    if (!children.some((node) => node.shape === "container")) continue;

    const requestedLayout = container.attributes.layout;
    if (requestedLayout === "row" || requestedLayout === "column" || requestedLayout === "grid") {
      arrangeBlocks(children, requestedLayout, container, Math.max(48, model.minimumGap), (node, x, y) => {
        moveBlock(node.id, x - node.x, y - node.y);
      });
      resetContainerSize(container, model);
      fitContainer(container, nodes);
      continue;
    }

    const blockForNode = new Map<string, string>();
    for (const node of nodes) {
      let current: GeometryNode | undefined = node;
      let guard = 0;
      while (current?.parentId && current.parentId !== container.id && guard < nodes.length) {
        current = nodeMap.get(current.parentId);
        guard += 1;
      }
      if (current?.parentId === container.id) blockForNode.set(node.id, current.id);
    }

    const childIds = new Set(children.map((node) => node.id));
    const blockRanks = new Map(children.map((node) => [node.id, 0]));
    const adjacency = new Map(children.map((node) => [node.id, new Set<string>()]));
    const acceptedEdges: Array<{ from: string; to: string }> = [];
    const reaches = (start: string, goal: string): boolean => {
      const pending = [start];
      const visited = new Set<string>();
      while (pending.length) {
        const current = pending.pop();
        if (!current || visited.has(current)) continue;
        if (current === goal) return true;
        visited.add(current);
        pending.push(...(adjacency.get(current) ?? []));
      }
      return false;
    };
    for (const edge of model.connections) {
      const from = blockForNode.get(edge.from);
      const to = blockForNode.get(edge.to);
      if (!from || !to || from === to || !childIds.has(from) || !childIds.has(to)) continue;
      if (reaches(to, from)) continue;
      adjacency.get(from)?.add(to);
      acceptedEdges.push({ from, to });
    }
    for (let iteration = 0; iteration < children.length; iteration += 1) {
      let changed = false;
      for (const edge of acceptedEdges) {
        const next = Math.min(children.length - 1, (blockRanks.get(edge.from) ?? 0) + 1);
        if (next > (blockRanks.get(edge.to) ?? 0)) {
          blockRanks.set(edge.to, next);
          changed = true;
        }
      }
      if (!changed) break;
    }

    const rankValues = [...new Set(blockRanks.values())].sort((a, b) => a - b);
    const originX = Math.min(...children.map((node) => node.x));
    const originY = Math.min(...children.map((node) => node.y));
    const columnGap = Math.max(96, model.minimumGap + 64);
    let x = originX;
    for (const rank of rankValues) {
      const members = children.filter((node) => blockRanks.get(node.id) === rank);
      const columnWidth = Math.max(...members.map((node) => node.width));
      let y = originY;
      for (const node of members) {
        moveBlock(node.id, x - node.x, y - node.y);
        y += node.height + model.minimumGap;
      }
      x += columnWidth + columnGap;
    }
    resetContainerSize(container, model);
    fitContainer(container, nodes);
  }
}

/**
 * Treat each top-level container as a macro node. This preserves the readable
 * flow between subsystems without reserving a full-width horizontal band for
 * every container.
 */
function packTopLevelGroups(nodes: GeometryNode[], model: LayoutModel): void {
  const nodeMap = byId(nodes);
  const rootGroup = "__root";
  const groupFor = (node: GeometryNode): string => {
    if (node.shape === "container" && !node.parentId) return node.id;
    let parentId = node.parentId;
    let topLevel: string | undefined;
    let guard = 0;
    while (parentId && guard < nodes.length) {
      topLevel = parentId;
      parentId = nodeMap.get(parentId)?.parentId;
      guard += 1;
    }
    return topLevel ?? rootGroup;
  };

  const groupByNode = new Map(nodes.map((node) => [node.id, groupFor(node)]));
  const groupOrder: string[] = [];
  for (const node of nodes) {
    const group = groupByNode.get(node.id) ?? rootGroup;
    if (!groupOrder.includes(group)) groupOrder.push(group);
  }
  if (groupOrder.length < 2) return;

  const groupRanks = new Map(groupOrder.map((group) => [group, 0]));
  for (let iteration = 0; iteration < groupOrder.length; iteration += 1) {
    let changed = false;
    for (const edge of model.connections) {
      const from = groupByNode.get(edge.from) ?? rootGroup;
      const to = groupByNode.get(edge.to) ?? rootGroup;
      if (from === to) continue;
      const next = Math.min(groupOrder.length - 1, (groupRanks.get(from) ?? 0) + 1);
      if (next > (groupRanks.get(to) ?? 0)) {
        groupRanks.set(to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const group of groupOrder) {
    const groupNode = nodeMap.get(group);
    if (groupNode?.attributes.place !== "below") continue;
    const predecessorRanks = model.connections
      .filter((edge) => (groupByNode.get(edge.to) ?? rootGroup) === group)
      .map((edge) => groupRanks.get(groupByNode.get(edge.from) ?? rootGroup) ?? 0);
    groupRanks.set(group, Math.max(0, ...predecessorRanks));
  }

  const membersByGroup = new Map<string, GeometryNode[]>();
  for (const group of groupOrder) membersByGroup.set(group, []);
  for (const node of nodes) membersByGroup.get(groupByNode.get(node.id) ?? rootGroup)?.push(node);
  const boundsByGroup = new Map<string, BoundsLike>();
  for (const [group, members] of membersByGroup) {
    if (!members.length) continue;
    const left = Math.min(...members.map((node) => node.x));
    const top = Math.min(...members.map((node) => node.y));
    const right = Math.max(...members.map((node) => node.x + node.width));
    const bottom = Math.max(...members.map((node) => node.y + node.height));
    boundsByGroup.set(group, { x: left, y: top, width: right - left, height: bottom - top });
  }

  const ranksInUse = [...new Set(groupRanks.values())].sort((a, b) => a - b);
  let columnX = CANVAS_PADDING;
  for (const rank of ranksInUse) {
    const groups = groupOrder.filter((group) => groupRanks.get(group) === rank && boundsByGroup.has(group));
    const columnWidth = Math.max(...groups.map((group) => boundsByGroup.get(group)?.width ?? 0));
    let rowY = CANVAS_PADDING;
    for (const group of groups) {
      const bounds = boundsByGroup.get(group);
      if (!bounds) continue;
      const dx = columnX - bounds.x;
      const dy = rowY - bounds.y;
      for (const node of membersByGroup.get(group) ?? []) {
        node.x += dx;
        node.y += dy;
      }
      rowY += bounds.height + 48;
    }
    columnX += columnWidth + 72;
  }
}

interface BoundsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

type PortSide = "left" | "right" | "top" | "bottom";

interface DeploymentEdgePlan {
  edge: LayoutModel["connections"][number];
  source: GeometryNode;
  target: GeometryNode;
  sourceSide: PortSide;
  targetSide: PortSide;
}

interface PortRequest {
  plan: DeploymentEdgePlan;
  endpoint: "source" | "target";
  node: GeometryNode;
  side: PortSide;
  sortValue: number;
}

type RouteDirection = "horizontal" | "vertical" | "start";

interface RouteCost {
  crossings: number;
  bends: number;
  length: number;
}

interface RouteObstacle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const ROUTE_CLEARANCE = 24;
const EDGE_CLEARANCE = 12;
const MAX_ROUTE_SEARCH_STATES = 20_000;

function compareRouteCost(left: RouteCost, right: RouteCost): number {
  // Node avoidance is a hard rule: blocked segments never enter the queue.
  // Safe candidates are ordered by crossings, then bends, then path length.
  return left.crossings - right.crossings
    || left.bends - right.bends
    || left.length - right.length;
}

function simplifyRoute(points: Point[]): Point[] {
  const simplified: Point[] = [];
  for (const point of points) {
    const previous = simplified[simplified.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) continue;
    simplified.push(point);
    while (simplified.length >= 3) {
      const before = simplified[simplified.length - 3]!;
      const middle = simplified[simplified.length - 2]!;
      const after = simplified[simplified.length - 1]!;
      const collinear = (before.x === middle.x && middle.x === after.x)
        || (before.y === middle.y && middle.y === after.y);
      if (!collinear) break;
      simplified.splice(simplified.length - 2, 1);
    }
  }
  return simplified;
}

function segmentCrossings(from: Point, to: Point, edges: GeometryEdge[]): number {
  const horizontal = from.y === to.y;
  const vertical = from.x === to.x;
  if (!horizontal && !vertical) return 0;
  let crossings = 0;
  for (const edge of edges) {
    const route = simplifyRoute(edge.points);
    for (let index = 1; index < route.length; index += 1) {
      const otherFrom = route[index - 1]!;
      const otherTo = route[index]!;
      const otherHorizontal = otherFrom.y === otherTo.y;
      const otherVertical = otherFrom.x === otherTo.x;
      if (horizontal && otherVertical) {
        const x = otherFrom.x;
        const y = from.y;
        if (x > Math.min(from.x, to.x) && x < Math.max(from.x, to.x)
          && y > Math.min(otherFrom.y, otherTo.y) && y < Math.max(otherFrom.y, otherTo.y)) crossings += 1;
      } else if (vertical && otherHorizontal) {
        const x = from.x;
        const y = otherFrom.y;
        if (y > Math.min(from.y, to.y) && y < Math.max(from.y, to.y)
          && x > Math.min(otherFrom.x, otherTo.x) && x < Math.max(otherFrom.x, otherTo.x)) crossings += 1;
      }
    }
  }
  return crossings;
}

function routeCost(points: Point[], edges: GeometryEdge[]): RouteCost {
  const route = simplifyRoute(points);
  let crossings = 0;
  let length = 0;
  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1]!;
    const to = route[index]!;
    crossings += segmentCrossings(from, to, edges);
    length += Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  }
  return { crossings, bends: Math.max(0, route.length - 2), length };
}

function routeHeading(from: Point, to: Point): Point {
  return { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
}

function followsHeading(from: Point, to: Point, heading: Point): boolean {
  const candidate = routeHeading(from, to);
  return candidate.x === heading.x && candidate.y === heading.y;
}

function chooseSmartRoute(
  points: Point[],
  source: GeometryNode,
  target: GeometryNode,
  nodes: GeometryNode[],
  previousEdges: GeometryEdge[],
  clearance = ROUTE_CLEARANCE,
  considerEdgeCrossings = true,
): Point[] {
  const comparedEdges = considerEdgeCrossings ? previousEdges : [];
  const obstacles = nodes
    .filter((node) => node.shape !== "container")
    .map<RouteObstacle>((node) => {
      const nodeClearance = node.id === source.id || node.id === target.id ? 0 : clearance;
      return {
        left: node.x - nodeClearance,
        top: node.y - nodeClearance,
        right: node.x + node.width + nodeClearance,
        bottom: node.y + node.height + nodeClearance,
      };
    });
  const finite = points.length >= 2 && points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!finite) return points;
  const initialRoute = simplifyRoute(points);
  if (initialRoute.length < 2) return points;
  const start = initialRoute[0]!;
  const end = initialRoute[initialRoute.length - 1]!;
  const startHeading = routeHeading(start, initialRoute[1]!);
  const endHeading = routeHeading(initialRoute[initialRoute.length - 2]!, end);
  if ((!startHeading.x && !startHeading.y) || (!endHeading.x && !endHeading.y)) return points;

  const segmentBlocked = (from: Point, to: Point): boolean => obstacles.some((obstacle) => {
    if (from.x === to.x) {
      const top = Math.min(from.y, to.y);
      const bottom = Math.max(from.y, to.y);
      return from.x > obstacle.left && from.x < obstacle.right
        && top < obstacle.bottom && bottom > obstacle.top;
    }
    if (from.y === to.y) {
      const left = Math.min(from.x, to.x);
      const right = Math.max(from.x, to.x);
      return from.y > obstacle.top && from.y < obstacle.bottom
        && left < obstacle.right && right > obstacle.left;
    }
    return true;
  });
  const pathBlocked = (path: Point[]): boolean => path
    .slice(1)
    .some((point, index) => segmentBlocked(path[index]!, point));
  const initialCost = routeCost(initialRoute, comparedEdges);
  if (!pathBlocked(initialRoute) && initialCost.crossings === 0) return points;

  const edgeChannels = comparedEdges.flatMap((edge) => edge.points.flatMap((point) => [
    { x: point.x - EDGE_CLEARANCE, y: point.y - EDGE_CLEARANCE },
    { x: point.x + EDGE_CLEARANCE, y: point.y + EDGE_CLEARANCE },
  ]));
  const xs = [...new Set([
    ...initialRoute.map((point) => point.x),
    ...obstacles.flatMap((obstacle) => [obstacle.left, obstacle.right]),
    ...edgeChannels.map((point) => point.x),
  ])].sort((a, b) => a - b);
  const ys = [...new Set([
    ...initialRoute.map((point) => point.y),
    ...obstacles.flatMap((obstacle) => [obstacle.top, obstacle.bottom]),
    ...edgeChannels.map((point) => point.y),
  ])].sort((a, b) => a - b);
  const startX = xs.indexOf(start.x);
  const startY = ys.indexOf(start.y);
  const endX = xs.indexOf(end.x);
  const endY = ys.indexOf(end.y);
  if ([startX, startY, endX, endY].some((index) => index < 0)) return points;
  interface SearchState {
    xIndex: number;
    yIndex: number;
    direction: RouteDirection;
    cost: RouteCost;
    path: Point[];
  }
  const emptyCost = { crossings: 0, bends: 0, length: 0 };
  const queue: SearchState[] = [{
    xIndex: startX,
    yIndex: startY,
    direction: "start",
    cost: emptyCost,
    path: [start],
  }];
  const best = new Map<string, RouteCost>();
  const keyFor = (xIndex: number, yIndex: number, direction: RouteDirection): string => `${xIndex}:${yIndex}:${direction}`;
  best.set(keyFor(startX, startY, "start"), emptyCost);
  const pointBlocked = (point: Point): boolean => obstacles.some((obstacle) => (
    point.x > obstacle.left && point.x < obstacle.right
      && point.y > obstacle.top && point.y < obstacle.bottom
  ));
  let routed: Point[] | undefined;
  let searchedStates = 0;
  while (queue.length && searchedStates < MAX_ROUTE_SEARCH_STATES) {
    searchedStates += 1;
    let bestIndex = 0;
    for (let index = 1; index < queue.length; index += 1) {
      if (compareRouteCost(queue[index]!.cost, queue[bestIndex]!.cost) < 0) bestIndex = index;
    }
    const current = queue.splice(bestIndex, 1)[0]!;
    const stateKey = keyFor(current.xIndex, current.yIndex, current.direction);
    const known = best.get(stateKey);
    if (known && compareRouteCost(current.cost, known) > 0) continue;
    if (current.xIndex === endX && current.yIndex === endY) {
      routed = current.path;
      break;
    }
    const neighbors = [
      { xIndex: current.xIndex - 1, yIndex: current.yIndex, direction: "horizontal" as const },
      { xIndex: current.xIndex + 1, yIndex: current.yIndex, direction: "horizontal" as const },
      { xIndex: current.xIndex, yIndex: current.yIndex - 1, direction: "vertical" as const },
      { xIndex: current.xIndex, yIndex: current.yIndex + 1, direction: "vertical" as const },
    ];
    const from = { x: xs[current.xIndex]!, y: ys[current.yIndex]! };
    for (const neighbor of neighbors) {
      if (neighbor.xIndex < 0 || neighbor.xIndex >= xs.length || neighbor.yIndex < 0 || neighbor.yIndex >= ys.length) continue;
      const to = { x: xs[neighbor.xIndex]!, y: ys[neighbor.yIndex]! };
      if (current.direction === "start" && !followsHeading(from, to, startHeading)) continue;
      if (neighbor.xIndex === endX && neighbor.yIndex === endY && !followsHeading(from, to, endHeading)) continue;
      if (pointBlocked(to) || segmentBlocked(from, to)) continue;
      const cost: RouteCost = {
        crossings: current.cost.crossings + segmentCrossings(from, to, comparedEdges),
        bends: current.cost.bends + (current.direction !== "start" && current.direction !== neighbor.direction ? 1 : 0),
        length: current.cost.length + Math.abs(to.x - from.x) + Math.abs(to.y - from.y),
      };
      const nextKey = keyFor(neighbor.xIndex, neighbor.yIndex, neighbor.direction);
      const previousCost = best.get(nextKey);
      if (previousCost && compareRouteCost(cost, previousCost) >= 0) continue;
      best.set(nextKey, cost);
      queue.push({ ...neighbor, cost, path: [...current.path, to] });
    }
  }

  if (!routed && clearance > 0) {
    // Keep node avoidance as the hard rule when the preferred visual spacing is too tight.
    return chooseSmartRoute(points, source, target, nodes, previousEdges, 0, considerEdgeCrossings);
  }
  if (!routed && considerEdgeCrossings && previousEdges.length > 0) {
    // A smaller graph can still find a node-safe route when edge channels exhaust the search bound.
    return chooseSmartRoute(points, source, target, nodes, [], 0, false);
  }
  // A route must remain visible when even the node-boundary search has no complete answer.
  if (!routed) return points;
  const simplified = simplifyRoute(routed);
  if (!pathBlocked(initialRoute) && compareRouteCost(routeCost(simplified, comparedEdges), initialCost) >= 0) return points;
  return simplified;
}

function routeDeployment(nodes: GeometryNode[], model: LayoutModel): GeometryEdge[] {
  const map = byId(nodes);
  const plans: DeploymentEdgePlan[] = [];
  for (const edge of model.connections) {
    const source = map.get(edge.from);
    const target = map.get(edge.to);
    if (!source || !target) continue;
    const sourceCenter = center(source);
    const targetCenter = center(target);
    const requestedSourceSide = portSide(edge.attributes?.fromPort);
    const requestedTargetSide = portSide(edge.attributes?.toPort);
    const stateBarConnection = model.kind === "state" && (source.shape === "uml-bar" || target.shape === "uml-bar");
    const horizontal = !stateBarConnection && (edge.from === edge.to
      || Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y) * 0.55);
    if (horizontal) {
      const forward = targetCenter.x >= sourceCenter.x;
      plans.push({
        edge,
        source,
        target,
        sourceSide: requestedSourceSide ?? (forward ? "right" : "left"),
        targetSide: requestedTargetSide ?? (forward ? "left" : "right"),
      });
      continue;
    }
    const forward = targetCenter.y >= sourceCenter.y;
    plans.push({
      edge,
      source,
      target,
      sourceSide: requestedSourceSide ?? (forward ? "bottom" : "top"),
      targetSide: requestedTargetSide ?? (forward ? "top" : "bottom"),
    });
  }

  const requestsByPort = new Map<string, PortRequest[]>();
  for (const plan of plans) {
    if (plan.edge.from === plan.edge.to) continue;
    const sourceTargetCenter = center(plan.target);
    const targetSourceCenter = center(plan.source);
    const requests: PortRequest[] = [
      { plan, endpoint: "source", node: plan.source, side: plan.sourceSide, sortValue: horizontalPort(plan.sourceSide) ? sourceTargetCenter.y : sourceTargetCenter.x },
      { plan, endpoint: "target", node: plan.target, side: plan.targetSide, sortValue: horizontalPort(plan.targetSide) ? targetSourceCenter.y : targetSourceCenter.x },
    ];
    for (const request of requests) {
      const key = `${request.node.id}:${request.side}:${request.endpoint}`;
      const group = requestsByPort.get(key) ?? [];
      group.push(request);
      requestsByPort.set(key, group);
    }
  }

  const allocatedPorts = new Map<string, Point>();
  for (const requests of requestsByPort.values()) {
    requests.sort((a, b) => a.sortValue - b.sortValue || a.plan.edge.order - b.plan.edge.order);
    requests.forEach((request, index) => {
      const bundledSource = !["er", "slide"].includes(model.kind) && request.endpoint === "source" && requests.length > 1;
      allocatedPorts.set(
        `${request.plan.edge.id}:${request.endpoint}`,
        bundledSource ? portPoint(request.node, request.side, 0, 1) : portPoint(request.node, request.side, index, requests.length),
      );
    });
  }

  const routedEdges: GeometryEdge[] = [];
  for (const plan of plans) {
    const { edge, source, target } = plan;
    const sourceCenter = center(source);
    let points: Point[];
    if (edge.from === edge.to) {
      points = [
        { x: source.x + source.width, y: sourceCenter.y },
        { x: source.x + source.width + 28, y: sourceCenter.y },
        { x: source.x + source.width + 28, y: source.y - 18 },
        { x: sourceCenter.x, y: source.y - 18 },
        { x: sourceCenter.x, y: source.y },
      ];
    } else if (horizontalPort(plan.sourceSide) && horizontalPort(plan.targetSide)) {
      const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, plan.sourceSide, 0, 1);
      const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, plan.targetSide, 0, 1);
      const sourceBundle = ["er", "slide"].includes(model.kind) ? 0 : requestsByPort.get(`${source.id}:${plan.sourceSide}:source`)?.length ?? 0;
      const middleX = sourceBundle > 1
        ? start.x + (plan.sourceSide === "right" ? 24 : -24)
        : (start.x + end.x) / 2;
      points = [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
    } else if (!horizontalPort(plan.sourceSide) && !horizontalPort(plan.targetSide)) {
      const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, plan.sourceSide, 0, 1);
      const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, plan.targetSide, 0, 1);
      const sourceBundle = ["er", "slide"].includes(model.kind) ? 0 : requestsByPort.get(`${source.id}:${plan.sourceSide}:source`)?.length ?? 0;
      const middleY = sourceBundle > 1
        ? start.y + (plan.sourceSide === "bottom" ? 24 : -24)
        : (start.y + end.y) / 2;
      points = [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end];
    } else {
      const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, plan.sourceSide, 0, 1);
      const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, plan.targetSide, 0, 1);
      const startOutside = offsetPort(start, plan.sourceSide, 24);
      const endOutside = offsetPort(end, plan.targetSide, 24);
      points = horizontalPort(plan.sourceSide)
        ? [start, startOutside, { x: endOutside.x, y: startOutside.y }, endOutside, end]
        : [start, startOutside, { x: startOutside.x, y: endOutside.y }, endOutside, end];
    }
    const routed = { ...edge, points: chooseSmartRoute(points, source, target, nodes, routedEdges) };
    routedEdges.push(routed);
  }
  return routedEdges;
}

function portSide(value: string | undefined): PortSide | undefined {
  const normalized = value?.toLowerCase();
  return normalized === "left" || normalized === "right" || normalized === "top" || normalized === "bottom"
    ? normalized
    : undefined;
}

function horizontalPort(side: PortSide): boolean {
  return side === "left" || side === "right";
}

function offsetPort(point: Point, side: PortSide, distance: number): Point {
  if (side === "left") return { x: point.x - distance, y: point.y };
  if (side === "right") return { x: point.x + distance, y: point.y };
  if (side === "top") return { x: point.x, y: point.y - distance };
  return { x: point.x, y: point.y + distance };
}

function portPoint(node: GeometryNode, side: PortSide, index: number, count: number): Point {
  if (["circle", "initial-state", "final-state", "junction-state"].includes(node.shape)) {
    return {
      x: side === "left" ? node.x : side === "right" ? node.x + node.width : node.x + node.width / 2,
      y: side === "top" ? node.y : side === "bottom" ? node.y + node.height : node.y + node.height / 2,
    };
  }
  if (side === "left" || side === "right") {
    const margin = Math.min(8, node.height * 0.15);
    const usable = Math.max(0, node.height - margin * 2);
    return {
      x: side === "left" ? node.x : node.x + node.width,
      y: node.y + margin + usable * ((index + 1) / (count + 1)),
    };
  }
  const margin = Math.min(10, node.width * 0.12);
  const usable = Math.max(0, node.width - margin * 2);
  return {
    x: node.x + margin + usable * ((index + 1) / (count + 1)),
    y: side === "top" ? node.y : node.y + node.height,
  };
}

function dimensions(nodes: GeometryNode[], groups: GeometryGroup[] = []): { width: number; height: number } {
  const all = [...nodes, ...groups];
  return {
    width: Math.max(320, ...all.map((node) => node.x + node.width + CANVAS_PADDING)),
    height: Math.max(220, ...all.map((node) => node.y + node.height + CANVAS_PADDING)),
  };
}

function arrangeStateJoinSections(nodes: GeometryNode[], model: LayoutModel): void {
  if (model.kind !== "state") return;
  const nodeMap = byId(nodes);
  const outgoing = new Map(nodes.map((node) => [node.id, model.connections.filter((edge) => edge.from === node.id)]));
  const incoming = new Map(nodes.map((node) => [node.id, model.connections.filter((edge) => edge.to === node.id)]));
  const forks = nodes.filter((node) => node.shape === "uml-bar" && (outgoing.get(node.id)?.length ?? 0) > 1);
  const joins = nodes.filter((node) => node.shape === "uml-bar" && (incoming.get(node.id)?.length ?? 0) > 1);

  const reachable = (start: string, goal: string): boolean => {
    const pending = [start];
    const visited = new Set<string>();
    while (pending.length) {
      const current = pending.shift();
      if (!current || visited.has(current)) continue;
      if (current === goal) return true;
      visited.add(current);
      pending.push(...(outgoing.get(current) ?? []).map((edge) => edge.to));
    }
    return false;
  };

  for (const fork of forks) {
    const branchStarts = (outgoing.get(fork.id) ?? []).map((edge) => edge.to);
    const join = joins.find((candidate) => branchStarts.every((start) => reachable(start, candidate.id)));
    if (!join) continue;

    const between = nodes.filter((node) => node.id !== fork.id && node.id !== join.id
      && reachable(fork.id, node.id) && reachable(node.id, join.id));
    const distance = new Map<string, number>([[fork.id, 0]]);
    const pending = [fork.id];
    while (pending.length) {
      const current = pending.shift();
      if (!current) continue;
      const nextDistance = (distance.get(current) ?? 0) + 1;
      for (const edge of outgoing.get(current) ?? []) {
        if (edge.to === join.id || !between.some((node) => node.id === edge.to)) continue;
        if (nextDistance < (distance.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
          distance.set(edge.to, nextDistance);
          pending.push(edge.to);
        }
      }
    }

    const itemGap = Math.max(52, model.minimumGap + 8);
    const rankGap = Math.max(58, model.minimumGap + 14);
    const predecessors = (incoming.get(fork.id) ?? [])
      .map((edge) => nodeMap.get(edge.from))
      .filter((node): node is GeometryNode => Boolean(node));
    const predecessor = predecessors.length === 1 ? predecessors[0] : undefined;
    const centerX = predecessor ? predecessor.x + predecessor.width / 2 : fork.x + fork.width / 2;
    if (predecessor) {
      fork.x = centerX - fork.width / 2;
      fork.y = predecessor.y + predecessor.height + rankGap;
    }
    let y = fork.y + fork.height + rankGap;
    const ranksInSection = [...new Set(between.map((node) => distance.get(node.id) ?? 1))].sort((a, b) => a - b);
    for (const rank of ranksInSection) {
      const row = model.items
        .filter((item) => between.some((node) => node.id === item.id) && (distance.get(item.id) ?? 1) === rank)
        .map((item) => nodeMap.get(item.id))
        .filter((node): node is GeometryNode => Boolean(node));
      const rowWidth = row.reduce((sum, node) => sum + node.width, 0) + Math.max(0, row.length - 1) * itemGap;
      const rowHeight = Math.max(...row.map((node) => node.height));
      let x = centerX - rowWidth / 2;
      for (const node of row) {
        node.x = x;
        node.y = y + (rowHeight - node.height) / 2;
        x += node.width + itemGap;
      }
      y += rowHeight + rankGap;
    }

    join.x = centerX - join.width / 2;
    join.y = y;
    y += join.height + rankGap;
    const successors = (outgoing.get(join.id) ?? [])
      .map((edge) => nodeMap.get(edge.to))
      .filter((node): node is GeometryNode => Boolean(node));
    if (successors.length === 1 && (incoming.get(successors[0]!.id)?.length ?? 0) === 1) {
      const successor = successors[0]!;
      successor.x = centerX - successor.width / 2;
      successor.y = y;
    }
  }
}

export const hierarchicalLayout: LayoutPlugin = {
  name: "hierarchical",
  layout(model, context) {
    const nodes = arrangeDeployment(model);
    arrangeContainerContents(nodes, model);
    fitContainers(nodes);
    arrangeNestedContainerContents(nodes, model);
    packTopLevelGroups(nodes, model);
    arrangeStateJoinSections(nodes, model);
    applyContinuity(nodes, context);
    // Keep automatic containers wrapped around children; manual containers retain their overlay.
    fitContainers(nodes.filter((node) => !context.overlay.nodes[node.id]?.manual || node.shape !== "container"));
    const edges = routeDeployment(nodes, model);
    return { kind: model.kind, nodes, edges, groups: [], ...dimensions(nodes) };
  },
};

export const compactLayout: LayoutPlugin = {
  name: "compact",
  layout(model, context) {
    const normal = model.items.filter((item) => item.shape !== "container");
    const columns = Math.max(1, Math.ceil(Math.sqrt(normal.length)));
    const cellWidth = Math.max(150, ...normal.map((item) => item.size.width)) + 42;
    const cellHeight = Math.max(70, ...normal.map((item) => item.size.height)) + 34;
    const nodes: GeometryNode[] = normal.map((item, index) => ({
      id: item.id,
      label: item.label,
      shape: item.shape,
      ...(item.parentId ? { parentId: item.parentId } : {}),
      attributes: item.attributes,
      x: CANVAS_PADDING + (index % columns) * cellWidth,
      y: CANVAS_PADDING + Math.floor(index / columns) * cellHeight,
      ...item.size,
    }));
    for (const item of model.items.filter((candidate) => candidate.shape === "container")) {
      nodes.push({ id: item.id, label: item.label, shape: item.shape, attributes: item.attributes, ...(item.parentId ? { parentId: item.parentId } : {}), x: CANVAS_PADDING, y: CANVAS_PADDING, ...item.size });
    }
    fitContainers(nodes);
    applyContinuity(nodes, context);
    const edges = routeDeployment(nodes, model);
    return { kind: model.kind, nodes, edges, groups: [], ...dimensions(nodes) };
  },
};

export const sequenceLayout: LayoutPlugin = {
  name: "sequence",
  layout(model, context) {
    const headerY = 26;
    const laneGap = Math.max(154, ...model.items.map((item) => item.size.width + 54));
    const nodes: GeometryNode[] = model.items.map((item, index) => ({
      id: item.id,
      label: item.label,
      shape: item.shape,
      attributes: item.attributes,
      x: CANVAS_PADDING + index * laneGap,
      y: headerY,
      ...item.size,
    }));
    applyContinuity(nodes, context);
    const map = byId(nodes);
    const firstMessageY = Math.max(...nodes.map((node) => node.y + node.height)) + 58;
    const messageGap = 52;
    const edges: GeometryEdge[] = model.connections.flatMap((edge, index) => {
      const source = map.get(edge.from);
      const target = map.get(edge.to);
      if (!source || !target) return [];
      const y = firstMessageY + index * messageGap;
      const fromX = source.x + source.width / 2;
      const toX = target.x + target.width / 2;
      const points = fromX === toX
        ? [{ x: fromX, y }, { x: fromX + 42, y }, { x: fromX + 42, y: y + 28 }, { x: fromX, y: y + 28 }]
        : [{ x: fromX, y }, { x: toX, y }];
      return [{ ...edge, points }];
    });
    const bottom = firstMessageY + Math.max(1, model.connections.length) * messageGap + 30;
    const groups: GeometryGroup[] = model.groups.map((group) => {
      const groupedEdges = edges.filter((edge) => edge.groupId === group.id);
      const top = (groupedEdges[0]?.points[0]?.y ?? firstMessageY) - 28;
      const lastEdge = groupedEdges[groupedEdges.length - 1];
      const lastY = lastEdge?.points[0]?.y ?? top + 36;
      const left = Math.min(...nodes.map((node) => node.x)) - 14;
      const right = Math.max(...nodes.map((node) => node.x + node.width)) + 14;
      return {
        id: group.id,
        label: group.label,
        ...(group.kind ? { kind: group.kind } : {}),
        x: left,
        y: top,
        width: right - left,
        height: lastY - top + 42,
      };
    });
    return {
      kind: model.kind,
      nodes,
      edges,
      groups,
      width: Math.max(320, ...nodes.map((node) => node.x + node.width + CANVAS_PADDING)),
      height: Math.max(240, bottom + CANVAS_PADDING),
    };
  },
};

export const flowchartLayout: LayoutPlugin = {
  name: "flowchart",
  layout(model, context) {
    const rankById = ranks(model);
    const rankValues = [...new Set(rankById.values())].sort((a, b) => a - b);
    const itemGap = Math.max(64, model.minimumGap + 20);
    const rankGap = Math.max(72, model.minimumGap + 28);
    const rows = rankValues.map((rank) => model.items
      .filter((item) => rankById.get(item.id) === rank)
      .map((item, index) => ({ item, index, order: layoutNumber(item, "order", 0) }))
      .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
        || left.index - right.index)
      .map(({ item }) => item));
    const rowWidths = rows.map((items) => items.reduce((sum, item) => sum + item.size.width, 0)
      + Math.max(0, items.length - 1) * itemGap);
    const contentWidth = Math.max(420, ...rowWidths);
    const nodes: GeometryNode[] = [];
    let y = CANVAS_PADDING;
    rows.forEach((items, rowIndex) => {
      const rowHeight = Math.max(...items.map((item) => item.size.height));
      let x = CANVAS_PADDING + (contentWidth - (rowWidths[rowIndex] ?? 0)) / 2;
      for (const item of items) {
        nodes.push({
          id: item.id,
          label: item.label,
          shape: item.shape,
          attributes: item.attributes,
          x,
          y: y + (rowHeight - item.size.height) / 2,
          ...item.size,
        });
        x += item.size.width + itemGap;
      }
      y += rowHeight + rankGap;
    });
    applyContinuity(nodes, context);
    const edges = routeDeployment(nodes, model);
    return {
      kind: model.kind,
      nodes,
      edges,
      groups: [],
      width: contentWidth + CANVAS_PADDING * 2,
      height: Math.max(320, y - rankGap + CANVAS_PADDING),
    };
  },
};

function routeActivity(nodes: GeometryNode[], model: LayoutModel): GeometryEdge[] {
  const map = byId(nodes);
  const routedEdges: GeometryEdge[] = [];
  for (const edge of model.connections) {
    const source = map.get(edge.from);
    const target = map.get(edge.to);
    if (!source || !target) continue;
    const sourceCenter = center(source);
    const targetCenter = center(target);
    const forward = targetCenter.y >= sourceCenter.y;
    const start = { x: sourceCenter.x, y: forward ? source.y + source.height : source.y };
    const end = { x: targetCenter.x, y: forward ? target.y : target.y + target.height };
    const points = Math.abs(start.x - end.x) < 0.5
      ? [start, end]
      : [
        start,
        { x: start.x, y: forward ? Math.min(end.y - 22, start.y + 34) : Math.max(end.y + 22, start.y - 34) },
        { x: end.x, y: forward ? Math.min(end.y - 22, start.y + 34) : Math.max(end.y + 22, start.y - 34) },
        end,
      ];
    const routed = { ...edge, points: chooseSmartRoute(points, source, target, nodes, routedEdges) };
    routedEdges.push(routed);
  }
  return routedEdges;
}

export const activityLayout: LayoutPlugin = {
  name: "activity",
  layout(model, context) {
    const rankById = ranks(model);
    const rankValues = [...new Set(rankById.values())].sort((a, b) => a - b);
    const rows = rankValues.map((rank) => model.items.filter((item) => rankById.get(item.id) === rank));
    const itemGap = 70;
    const rowWidths = rows.map((items) => items.reduce((sum, item) => sum + item.size.width, 0) + Math.max(0, items.length - 1) * itemGap);
    const contentWidth = Math.max(560, ...rowWidths);
    const canvasWidth = contentWidth + CANVAS_PADDING * 2;
    let y = CANVAS_PADDING;
    const nodes: GeometryNode[] = [];
    rows.forEach((items, rowIndex) => {
      const rowHeight = Math.max(...items.map((item) => item.size.height));
      let x = CANVAS_PADDING + (contentWidth - (rowWidths[rowIndex] ?? 0)) / 2;
      for (const item of items) {
        nodes.push({
          id: item.id,
          label: item.label,
          shape: item.shape,
          attributes: item.attributes,
          x,
          y: y + (rowHeight - item.size.height) / 2,
          ...item.size,
        });
        x += item.size.width + itemGap;
      }
      y += rowHeight + 58;
    });
    applyContinuity(nodes, context);
    const edges = routeActivity(nodes, model);
    return { kind: model.kind, nodes, edges, groups: [], width: canvasWidth, height: Math.max(620, y - 30 + CANVAS_PADDING) };
  },
};

export const classLayout: LayoutPlugin = {
  name: "class",
  layout(model, context) {
    const upwardRelations = new Set(["inheritance", "realization", "dependency", "directed-association"]);
    const rankingModel: LayoutModel = {
      ...model,
      connections: model.connections.map((edge) => upwardRelations.has(edge.attributes?.relation ?? "")
        ? { ...edge, from: edge.to, to: edge.from }
        : edge),
    };
    const rankById = ranks(rankingModel);
    const rankValues = [...new Set(rankById.values())].sort((a, b) => a - b);
    const itemGap = 58;
    const maximumColumns = 2;
    const rankRows = rankValues.map((rank) => {
      const items = model.items.filter((item) => rankById.get(item.id) === rank);
      const rows: LayoutItem[][] = [];
      for (let index = 0; index < items.length; index += maximumColumns) rows.push(items.slice(index, index + maximumColumns));
      return rows;
    });
    const rowWidth = (items: LayoutItem[]): number => items.reduce((sum, item) => sum + item.size.width, 0) + Math.max(0, items.length - 1) * itemGap;
    const contentWidth = Math.max(540, ...rankRows.flat().map(rowWidth));
    const canvasWidth = contentWidth + CANVAS_PADDING * 2;
    const nodes: GeometryNode[] = [];
    let y = CANVAS_PADDING;
    rankRows.forEach((rows) => {
      rows.forEach((items, rowIndex) => {
        const height = Math.max(...items.map((item) => item.size.height));
        let x = CANVAS_PADDING + (contentWidth - rowWidth(items)) / 2;
        for (const item of items) {
          nodes.push({
            id: item.id,
            label: item.label,
            shape: item.shape,
            attributes: item.attributes,
            x,
            y: y + (height - item.size.height) / 2,
            ...item.size,
          });
          x += item.size.width + itemGap;
        }
        y += height + (rowIndex === rows.length - 1 ? 68 : 30);
      });
    });
    applyContinuity(nodes, context);
    const edges = routeActivity(nodes, model);
    return { kind: model.kind, nodes, edges, groups: [], width: canvasWidth, height: Math.max(620, y - 36 + CANVAS_PADDING) };
  },
};

interface SlideBundle {
  nodes: GeometryNode[];
  width: number;
  height: number;
}

function slideNumber(item: LayoutItem, name: string, fallback: number, minimum = 1, maximum = 12): number {
  const value = Number(item.attributes[name]);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function translateSlideBundle(bundle: SlideBundle, x: number, y: number): void {
  for (const node of bundle.nodes) {
    node.x += x;
    node.y += y;
  }
}

function arrangeSlideItem(item: LayoutItem, childItems: LayoutItem[], childrenByParent: Map<string, LayoutItem[]>): SlideBundle {
  if (item.shape !== "slide-group") {
    return {
      nodes: [{
        id: item.id,
        label: item.label,
        shape: item.shape,
        ...(item.parentId ? { parentId: item.parentId } : {}),
        attributes: item.attributes,
        x: 0,
        y: 0,
        ...item.size,
      }],
      width: item.size.width,
      height: item.size.height,
    };
  }

  const ordered = [...childItems].sort((a, b) => Number(a.attributes.order ?? 0) - Number(b.attributes.order ?? 0));
  const bundles = ordered.map((child) => arrangeSlideItem(child, childrenByParent.get(child.id) ?? [], childrenByParent));
  const layout = item.attributes.layout ?? "row";
  const gap = slideNumber(item, "gap", layout === "row" ? 62 : 24, 8, 160);
  let width = 1;
  let height = 1;

  if (layout === "column") {
    width = Math.max(1, ...bundles.map((bundle) => bundle.width));
    let y = 0;
    for (const bundle of bundles) {
      translateSlideBundle(bundle, (width - bundle.width) / 2, y);
      y += bundle.height + gap;
    }
    height = Math.max(1, y - (bundles.length ? gap : 0));
  } else if (layout === "grid") {
    const columns = Math.min(bundles.length || 1, Math.round(slideNumber(item, "columns", 2, 1, 6)));
    const rows = Math.ceil(bundles.length / columns);
    const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(1, ...bundles.filter((_, index) => index % columns === column).map((bundle) => bundle.width)));
    const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(1, ...bundles.slice(row * columns, (row + 1) * columns).map((bundle) => bundle.height)));
    const columnX = columnWidths.map((_, index) => columnWidths.slice(0, index).reduce((sum, value) => sum + value, 0) + gap * index);
    const rowY = rowHeights.map((_, index) => rowHeights.slice(0, index).reduce((sum, value) => sum + value, 0) + gap * index);
    bundles.forEach((bundle, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      translateSlideBundle(bundle, (columnX[column] ?? 0) + ((columnWidths[column] ?? bundle.width) - bundle.width) / 2, (rowY[row] ?? 0) + ((rowHeights[row] ?? bundle.height) - bundle.height) / 2);
    });
    width = columnWidths.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, columns - 1);
    height = rowHeights.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, rows - 1);
  } else {
    height = Math.max(1, ...bundles.map((bundle) => bundle.height));
    let x = 0;
    for (const bundle of bundles) {
      translateSlideBundle(bundle, x, (height - bundle.height) / 2);
      x += bundle.width + gap;
    }
    width = Math.max(1, x - (bundles.length ? gap : 0));
  }

  const groupNode: GeometryNode = {
    id: item.id,
    label: item.label,
    shape: item.shape,
    ...(item.parentId ? { parentId: item.parentId } : {}),
    attributes: item.attributes,
    x: 0,
    y: 0,
    width,
    height,
  };
  return { nodes: [groupNode, ...bundles.flatMap((bundle) => bundle.nodes)], width, height };
}

export const slideLayout: LayoutPlugin = {
  name: "slide",
  layout(model, context) {
    const childrenByParent = new Map<string, LayoutItem[]>();
    for (const item of model.items) {
      if (!item.parentId) continue;
      const children = childrenByParent.get(item.parentId) ?? [];
      children.push(item);
      childrenByParent.set(item.parentId, children);
    }
    const roots = model.items
      .filter((item) => !item.parentId)
      .sort((a, b) => Number(a.attributes.order ?? 0) - Number(b.attributes.order ?? 0));
    const bundles = roots.map((item) => ({ item, bundle: arrangeSlideItem(item, childrenByParent.get(item.id) ?? [], childrenByParent) }));
    const contentWidth = Math.max(880, ...bundles.map(({ bundle }) => bundle.width));
    const canvasWidth = Math.max(960, contentWidth + 80);
    let y = 30;
    const nodes: GeometryNode[] = [];
    for (const { item, bundle } of bundles) {
      const isHeading = ["slide-title", "slide-subtitle"].includes(item.shape);
      const x = isHeading ? 40 : (canvasWidth - bundle.width) / 2;
      translateSlideBundle(bundle, x, y);
      nodes.push(...bundle.nodes);
      y += bundle.height + (item.shape === "slide-title" ? 0 : item.shape === "slide-subtitle" ? 28 : 38);
    }
    applyContinuity(nodes, context);
    const edges = routeDeployment(nodes, model);
    const calculated = dimensions(nodes);
    return { kind: model.kind, nodes, edges, groups: [], width: Math.max(canvasWidth, calculated.width), height: Math.max(540, calculated.height) };
  },
};

export const builtInLayouts: LayoutPlugin[] = [hierarchicalLayout, compactLayout, sequenceLayout, flowchartLayout, activityLayout, classLayout, slideLayout];

export function rerouteGeometry(geometry: Geometry): void {
  if (geometry.kind === "sequence") {
    const map = byId(geometry.nodes);
    for (const edge of geometry.edges) {
      const source = map.get(edge.from);
      const target = map.get(edge.to);
      const y = edge.points[0]?.y ?? 0;
      if (source && target) {
        const fromX = source.x + source.width / 2;
        const toX = target.x + target.width / 2;
        edge.points = fromX === toX
          ? [{ x: fromX, y }, { x: fromX + 42, y }, { x: fromX + 42, y: y + 28 }, { x: fromX, y: y + 28 }]
          : [{ x: fromX, y }, { x: toX, y }];
      }
    }
    geometry.width = Math.max(320, ...geometry.nodes.map((node) => node.x + node.width + CANVAS_PADDING));
    geometry.height = Math.max(240, ...geometry.nodes.map((node) => node.y + node.height + CANVAS_PADDING), geometry.height);
    return;
  }
  if (geometry.kind === "activity" || geometry.kind === "class") {
    const model: LayoutModel = {
      kind: geometry.kind,
      items: geometry.nodes.map((node) => ({ ...node, size: { width: node.width, height: node.height } })),
      connections: geometry.edges.map(({ points: _points, ...edge }) => edge),
      groups: [],
      direction: "down",
      minimumGap: 44,
    };
    geometry.edges = routeActivity(geometry.nodes, model);
    const size = dimensions(geometry.nodes);
    geometry.width = size.width;
    geometry.height = size.height;
    return;
  }
  const model: LayoutModel = {
    kind: geometry.kind,
    items: geometry.nodes.map((node) => ({ ...node, size: { width: node.width, height: node.height } })),
    connections: geometry.edges.map(({ points: _points, ...edge }) => edge),
    groups: [],
    direction: "right",
    minimumGap: 44,
  };
  geometry.edges = routeDeployment(geometry.nodes, model);
  const size = dimensions(geometry.nodes, geometry.groups);
  geometry.width = size.width;
  geometry.height = size.height;
}
