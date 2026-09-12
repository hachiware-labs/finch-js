import { orderConnectedBlocks } from "./paired-block-order.js";
import { arrangeArchitecture } from "./architecture-layout.js";
import { arrangeBipartiteBlocks, arrangeStateAxis, arrangeStateCycles, arrangeThreeBlocks, arrangeSharedBlocks } from "./semantic-arrangement.js";
import { crossingRisk, existingCrossings } from "./crossing-quality.js";
import { compareRoutingCost, routingPolicy } from "./routing-policy.js";
import {requiredInterfacePort} from "./interface-geometry.js";
import {sequenceFragmentSpan} from './sequence-fragments.js';
import {measureDiagramText} from './diagram-text.js';
import { annotationAnchor } from "./member-annotations.js";
import { rerouteTiming } from "./timing.js";
import type { Geometry, GeometryEdge, GeometryGroup, GeometryNode, LayoutContext, LayoutItem, LayoutModel, LayoutPlugin, Point } from "./types.js";
import { center, routeMidpoint } from "./utils.js";
import { alignLayers, orderedLayers, arrangeRetryBlocks } from "./directed-layout.js";
import { labelLayout, wrapWidth } from "./text-layout.js";

function sequenceDurationWidth(edges: GeometryEdge[]):number {
 return edges.reduce((sum,edge)=>sum+(JSON.parse(edge.attributes?.durations ?? '[]') as unknown[]).length*160,0);
}

const CANVAS_PADDING = 28;

function connectionGap(model: LayoutModel, sourceIds: Set<string>, minimum: number): number {
  return Math.max(minimum, ...model.connections
    .filter((edge) => sourceIds.has(edge.from) && !sourceIds.has(edge.to) && edge.label)
    .map((edge) => labelLayout(edge.label!, wrapWidth(edge.attributes, 180), model.labelFontSize ?? 12).width + 32));
}

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
      if (state.width) node.width = Math.max(state.width, node.width);
      if (state.height) node.height = Math.max(state.height, node.height);
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
  const layers = orderedLayers(model, rankById);
  for (const item of layers.flat()) {
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
    x += (columnWidths.get(rank) ?? 120) + connectionGap(model, new Set(items.map((item) => item.id)), 72);
  }

  if (!model.items.some((item) => item.shape === "container")) alignLayers(nodes, layers, model, model.minimumGap, true);
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

function memberContainerInset(children: GeometryNode[]): number {
  // A member port needs a horizontal escape (24–28px) plus visible frame clearance.
  return children.some(node => ['uml-class', 'uml-instance', 'uml-map'].includes(node.shape)) ? 52 : 26;
}

/** Frame-attached endpoints follow their owner; they must never size it.
 * This rule is shared by initial fitting, drag resizing and growth propagation.
 */
function contributesToContainerSize(node: GeometryNode): boolean {
  return node.attributes.boundaryPort !== "true" && !node.attributes.connectionPoint;
}

function fitContainer(container: GeometryNode, nodes: GeometryNode[]): void {
  const children = nodes.filter((node) => node.parentId === container.id && contributesToContainerSize(node));
  if (!children.length) return;
  const left = Math.min(...children.map((node) => node.x));
  const top = Math.min(...children.map((node) => node.y));
  const right = Math.max(...children.map((node) => node.x + node.width));
  const bottom = Math.max(...children.map((node) => node.y + node.height));
  const inset = Math.max(memberContainerInset(children),...nodes.filter(node=>node.parentId===container.id && node.attributes.boundaryPort === "true").map(node=>node.width/2+16));
  container.x = left - inset;
  container.y = top - (container.headerHeight ?? 42);
  container.width = Math.max(container.width, right - left + inset * 2);
  container.height = Math.max(container.height, bottom - top + (container.headerHeight ?? 42) + 26);
}

/** Separate sibling frames as whole blocks, including their descendants. */
function separateSiblingBlocks(nodes: GeometryNode[], model: LayoutModel, context: LayoutContext): void {
  const map = byId(nodes);
  const descendants = (root: GeometryNode): GeometryNode[] => nodes.filter((node) => {
    let current: GeometryNode | undefined = node;
    for (let i = 0; current && i < nodes.length; i += 1) {
      if (current.id === root.id) return true;
      current = current.parentId ? map.get(current.parentId) : undefined;
    }
    return false;
  });
  const fixed = (node: GeometryNode): boolean => {
    const state = context.overlay.nodes[node.id];
    return Boolean(state && (!context.force || (context.preservePinned && state.pinned)));
  };
  const parents = nodes.filter((node) => node.shape === "container");
  // Inner groups must reach their final bounds before packing an outer group.
  parents.sort((a, b) => descendants(a).length - descendants(b).length);
  const gap = Math.max(32, model.minimumGap);
  for (const parent of [...parents, undefined]) {
    const siblings = nodes.filter((node) => node.parentId === parent?.id);
    if (!siblings.some((node) => node.shape === "container")) continue;
    const blocks = siblings.map((node) => ({ node, members: descendants(node) }));
    const anchored = blocks.filter((block) => block.members.some(fixed));
    const free = blocks.filter((block) => !block.members.some(fixed)).sort((a, b) => a.node.x - b.node.x);
    const placed = anchored.map((block) => block.node);
    for (const { node, members } of free) {
      let x = node.x;
      // Each move passes at least one occupied interval, so this terminates.
      for (let i = 0; i <= placed.length; i += 1) {
        const conflicts = placed.filter((other) => node.y < other.y + other.height + gap
          && node.y + node.height + gap > other.y
          && x < other.x + other.width + gap && x + node.width + gap > other.x);
        if (!conflicts.length) break;
        x = Math.max(...conflicts.map((other) => other.x + other.width + gap));
      }
      const dx = x - node.x;
      for (const member of members) member.x += dx;
      placed.push(node);
    }
    if (parent && !fixed(parent)) {
      if(!nodes.some(node=>node.parentId===parent.id && node.attributes.boundaryPort === "true"))resetContainerSize(parent, model);
      fitContainer(parent, nodes);
    }
  }
}

type ContainerMinimumSize = Pick<GeometryNode, "width" | "height">;

/**
 * Resize every container tightly around moved descendants while preserving the
 * shape's measured minimum size. Inner containers are processed first so all
 * four sides of every outer frame follow their current contents in one move.
 */
export function resizeAncestorContainers(
  nodes: GeometryNode[],
  movedIds: Iterable<string>,
  minimumSizes: ReadonlyMap<string, ContainerMinimumSize> = new Map(),
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
    const children = nodes.filter((node) => node.parentId === container.id && contributesToContainerSize(node));
    if (!children.length) continue;
    const inset = Math.max(memberContainerInset(children),...nodes.filter(node=>node.parentId===container.id && node.attributes.boundaryPort === "true").map(node=>node.width/2+16));
    const desiredLeft = Math.min(...children.map((node) => node.x)) - inset;
    const desiredTop = Math.min(...children.map((node) => node.y)) - (container.headerHeight ?? 42);
    const desiredRight = Math.max(...children.map((node) => node.x + node.width)) + inset;
    const desiredBottom = Math.max(...children.map((node) => node.y + node.height)) + 26;
    const minimum = minimumSizes.get(container.id) ?? container;
    const nextLeft = desiredLeft;
    const nextTop = desiredTop;
    const nextRight = nextLeft + Math.max(minimum.width, desiredRight - desiredLeft);
    const nextBottom = nextTop + Math.max(minimum.height, desiredBottom - desiredTop);
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
    const width = Math.max(...children.map((node) => node.width));
    let y = originY;
    for (const node of ordered) {
      move(node, originX + (width - node.width) / 2, y);
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
    const children = nodes.filter((node) => node.parentId === container.id && node.shape !== "container" && contributesToContainerSize(node));
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

    const localModel = { ...model, items: model.items.filter((item) => childIds.has(item.id)), connections: internalEdges };
    const localLayers = orderedLayers(localModel, ranks(localModel));
    let x = originX;
    for (const layer of localLayers) {
      const members = layer.map((item) => children.find((node) => node.id === item.id)!);
      let y = originY;
      for (const node of members) {
        node.x = x;
        node.y = y;
        y += node.height + model.minimumGap;
      }
      x += Math.max(...members.map((node) => node.width)) + connectionGap(localModel, new Set(members.map((node) => node.id)), 40);
    }
    alignLayers(children, localLayers, localModel, model.minimumGap, true);
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
    const children = nodes.filter((node) => node.parentId === container.id && contributesToContainerSize(node));
    if (!children.some((node) => node.shape === "container")) continue;

    const requestedLayout = container.attributes.layout;
    if (model.kind === "deployment" && requestedLayout === "architecture" && arrangeArchitecture(children,nodes,model,(id,x,y)=>{
      const n=nodeMap.get(id)!;moveBlock(id,x-n.x,y-n.y);
    })) {
      resetContainerSize(container,model);fitContainer(container,nodes);continue;
    }

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
  const groupAdjacency = new Map(groupOrder.map((group) => [group, new Set<string>()]));
  const acceptedGroupEdges: Array<{ from: string; to: string }> = [];
  const reachesGroup = (start: string, goal: string): boolean => {
    const pending = [start];
    const visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop();
      if (!current || visited.has(current)) continue;
      if (current === goal) return true;
      visited.add(current);
      pending.push(...(groupAdjacency.get(current) ?? []));
    }
    return false;
  };
  for (const edge of model.connections) {
    const from = groupByNode.get(edge.from) ?? rootGroup;
    const to = groupByNode.get(edge.to) ?? rootGroup;
    if (from === to || reachesGroup(to, from)) continue;
    groupAdjacency.get(from)?.add(to);
    acceptedGroupEdges.push({ from, to });
  }
  for (let iteration = 0; iteration < groupOrder.length; iteration += 1) {
    let changed = false;
    for (const { from, to } of acceptedGroupEdges) {
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
    const sourceIds = new Set(groups.flatMap((group) => (membersByGroup.get(group) ?? []).map((node) => node.id)));
    columnX += columnWidth + connectionGap(model, sourceIds, 72);
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
  crossingRisk: number;
  crossings: number;
  branchCongestion: number;
  bends: number;
  length: number;
  congestion: number;
}

interface RouteObstacle {
  left: number;
  top: number;
  right: number;
  bottom: number;
  endpoint?: boolean;
}

const ROUTE_CLEARANCE = 24;
const EDGE_CLEARANCE = 12;
const MAX_ROUTE_SEARCH_STATES = 20_000;


function segmentCongestion(from: Point, to: Point, edges: GeometryEdge[]): number {
  const horizontal = from.y === to.y;
  let congestion = 0;
  for (const edge of edges) for (let i = 1; i < edge.points.length; i += 1) {
    const a = edge.points[i - 1]!;
    const b = edge.points[i]!;
    if (horizontal ? a.y !== b.y : a.x !== b.x) continue;
    const distance = horizontal ? Math.abs(from.y - a.y) : Math.abs(from.x - a.x);
    if (distance >= EDGE_CLEARANCE) continue;
    const overlap = horizontal
      ? Math.min(Math.max(from.x, to.x), Math.max(a.x, b.x)) - Math.max(Math.min(from.x, to.x), Math.min(a.x, b.x))
      : Math.min(Math.max(from.y, to.y), Math.max(a.y, b.y)) - Math.max(Math.min(from.y, to.y), Math.min(a.y, b.y));
    congestion += Math.max(0, overlap) * (1 - distance / EDGE_CLEARANCE);
  }
  return congestion;
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
      const collinear = (before.x === middle.x && middle.x === after.x && (middle.y - before.y) * (after.y - middle.y) >= 0)
        || (before.y === middle.y && middle.y === after.y && (middle.x - before.x) * (after.x - middle.x) >= 0);
      if (!collinear) break;
      simplified.splice(simplified.length - 2, 1);
    }
  }
  return simplified;
}

function segmentCrossings(from: Point, to: Point, routes: Point[][]): number {
  const horizontal = from.y === to.y;
  const vertical = from.x === to.x;
  if (!horizontal && !vertical) return 0;
  let crossings = 0;
  for (const route of routes) {
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

function routeCost(points: Point[], crossingRoutes: Point[][], independentEdges: GeometryEdge[], branchEdges: GeometryEdge[], risk: (a:Point,b:Point)=>number): RouteCost {
  const route = simplifyRoute(points);
  let crossings = 0;
  let length = 0;
  let congestion = 0;
  let branchCongestion = 0;
  let crossingRisk = 0;
  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1]!;
    const to = route[index]!;
    crossings += segmentCrossings(from, to, crossingRoutes);
    crossingRisk += risk(from,to);
    congestion += segmentCongestion(from, to, independentEdges);
    branchCongestion += segmentCongestion(from, to, branchEdges);
    length += Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  }
  return { crossingRisk, crossings, branchCongestion, bends: Math.max(0, route.length - 2), length, congestion };
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
  attributes?: Record<string, string>,
  kind?: string,
): Point[] {
  const policy = routingPolicy(attributes);
  const compareRouteCost = (a: RouteCost, b: RouteCost) => compareRoutingCost(a, b, policy);
  const comparedEdges = considerEdgeCrossings ? previousEdges : [];
  // Crossings use maximal straight segments; prepare these once per search.
  // Congestion still uses the original segments so its overlap weights are unchanged.
  const crossingRoutes = comparedEdges.map(edge => simplifyRoute(edge.points));
  const occupiedCrossings = existingCrossings(crossingRoutes);
  const risk = (a:Point,b:Point) => crossingRisk(a,b,crossingRoutes,occupiedCrossings,[points[0]!,points[points.length-1]!],policy.crossingClearance);
  const independentEdges = comparedEdges.filter((edge) => kind === "class" || (kind === "state" && source.shape !== "uml-bar" && target.shape !== "uml-bar") || (edge.from !== source.id && edge.to !== target.id));
  // A frame is traversable. Penalize parallel runs beside its perimeter,
  // rather than making the whole container an obstacle.
  const frameEdges: GeometryEdge[] = kind === "deployment" ? nodes.filter(n=>n.shape === "container").flatMap(n=>[
    [{x:n.x,y:n.y},{x:n.x+n.width,y:n.y}],
    [{x:n.x,y:n.y+n.height},{x:n.x+n.width,y:n.y+n.height}],
    [{x:n.x,y:n.y},{x:n.x,y:n.y+n.height}],
    [{x:n.x+n.width,y:n.y},{x:n.x+n.width,y:n.y+n.height}],
  ].map((points,i)=>({id:`frame-${n.id}-${i}`,from:n.id,to:n.id,order:0,dashed:false,points}))) : [];
  independentEdges.push(...frameEdges);
  const branchEdges = source.shape === "diamond" ? comparedEdges.filter((edge) => edge.from === source.id && edge.to !== target.id) : [];
  const boundaryOwners = new Set<string>();
  for (const [point, other] of [[source, target], [target, source]]) {
    if (!point?.attributes.connectionPoint || !point.parentId || !other) continue;
    let parent: string | undefined = other.id;
    const seen = new Set<string>();
    while (parent && parent !== point.parentId && !seen.has(parent)) {
      seen.add(parent); parent = nodes.find(node => node.id === parent)?.parentId;
    }
    if (parent !== point.parentId) boundaryOwners.add(point.parentId);
  }
  const obstacles = nodes
    .filter((node) => {
      if(node.shape!=="container" || boundaryOwners.has(node.id))return true;
      if(kind!=="state")return false;
      // Only an endpoint's enclosing state is traversable by that transition.
      const contains=(endpoint:GeometryNode)=>{
        let id:string|undefined=endpoint.id;const seen=new Set<string>();
        while(id&&!seen.has(id)){if(id===node.id)return true;seen.add(id);id=nodes.find(n=>n.id===id)?.parentId;}
        return false;
      };
      return !contains(source)&&!contains(target);
    })
    .map<RouteObstacle>((node) => {
      // Keep the perimeter clear without enclosing the boundary point's port.
      const nodeClearance = node.id === source.id || node.id === target.id ? 0 : boundaryOwners.has(node.id) ? Math.min(8, clearance) : clearance;
      const roleEndpoint=["sequence-boundary","sequence-control","sequence-entity"].includes(node.shape) && (node.id===source.id || node.id===target.id);
      const actorEndpoint=node.shape==="actor" && (node.id===source.id || node.id===target.id);
      const portEndpoint=node.shape==="uml-port" && (node.id===source.id || node.id===target.id);
      return {
        left: node.x + (actorEndpoint?node.width/2-16:portEndpoint?node.width/2-11:roleEndpoint?node.width/2-(node.shape==="sequence-boundary"?30:18):0) - nodeClearance,
        top: node.y + (actorEndpoint?2:portEndpoint?2:roleEndpoint?(node.shape==="sequence-control"?30-Math.sqrt(224):12):0) - nodeClearance,
        right: node.x + (actorEndpoint?node.width/2+16:portEndpoint?node.width/2+11:roleEndpoint?node.width/2+18:node.width) + nodeClearance,
        bottom: node.y + (actorEndpoint?56:portEndpoint?24:roleEndpoint?(node.shape==="sequence-entity"?52:48):node.height) + nodeClearance,
        endpoint: node.id === source.id || node.id === target.id,
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

  // Reserve a short straight approach so bends cannot touch an arrowhead.
  const forwardGap=startHeading.x===endHeading.x && startHeading.y===endHeading.y
    ? (end.x-start.x)*startHeading.x+(end.y-start.y)*startHeading.y : Infinity;
  const approach = Math.min(clearance > 0 ? 16 : 0, (Math.abs(end.x - start.x) + Math.abs(end.y - start.y)) / 2, forwardGap>0 ? forwardGap/2 : Infinity);
  const nearEndpointTurn = (from: Point, to: Point): boolean => [
    { point: start, heading: startHeading }, { point: end, heading: endHeading },
  ].some(({ point, heading }) => heading.x
    ? from.x === to.x && Math.abs(from.x - point.x) < approach && Math.min(from.y, to.y) <= point.y && Math.max(from.y, to.y) >= point.y
    : from.y === to.y && Math.abs(from.y - point.y) < approach && Math.min(from.x, to.x) <= point.x && Math.max(from.x, to.x) >= point.x);
  const segmentBlocked = (from: Point, to: Point): boolean => nearEndpointTurn(from, to) || obstacles.some((obstacle) => {
    if (from.x === to.x) {
      const top = Math.min(from.y, to.y);
      const bottom = Math.max(from.y, to.y);
      return (obstacle.endpoint ? from.x >= obstacle.left && from.x <= obstacle.right : from.x > obstacle.left && from.x < obstacle.right)
        && top < obstacle.bottom && bottom > obstacle.top;
    }
    if (from.y === to.y) {
      const left = Math.min(from.x, to.x);
      const right = Math.max(from.x, to.x);
      return (obstacle.endpoint ? from.y >= obstacle.top && from.y <= obstacle.bottom : from.y > obstacle.top && from.y < obstacle.bottom)
        && left < obstacle.right && right > obstacle.left;
    }
    return true;
  });
  const pathBlocked = (path: Point[]): boolean => path
    .slice(1)
    .some((point, index) => segmentBlocked(path[index]!, point));
  const initialCost = routeCost(initialRoute, crossingRoutes, independentEdges, branchEdges, risk);
  if (!pathBlocked(initialRoute) && initialCost.crossingRisk === 0 && initialCost.crossings === 0 && initialCost.congestion === 0 && initialCost.branchCongestion === 0) return points;

  const edgeChannels = [...comparedEdges, ...frameEdges].flatMap((edge) => edge.points.flatMap((point) => [
    { x: point.x - EDGE_CLEARANCE, y: point.y - EDGE_CLEARANCE },
    { x: point.x + EDGE_CLEARANCE, y: point.y + EDGE_CLEARANCE },
  ]));
  const xs = [...new Set([
    start.x + startHeading.x * approach, end.x - endHeading.x * approach,
    ...initialRoute.map((point) => point.x),
    ...obstacles.flatMap((obstacle) => [obstacle.left, obstacle.right]),
    ...obstacles.filter((obstacle) => obstacle.endpoint).flatMap((obstacle) => [obstacle.left - EDGE_CLEARANCE, obstacle.right + EDGE_CLEARANCE]),
    ...edgeChannels.map((point) => point.x),
  ])].sort((a, b) => a - b);
  const ys = [...new Set([
    start.y + startHeading.y * approach, end.y - endHeading.y * approach,
    ...initialRoute.map((point) => point.y),
    ...obstacles.flatMap((obstacle) => [obstacle.top, obstacle.bottom]),
    ...obstacles.filter((obstacle) => obstacle.endpoint).flatMap((obstacle) => [obstacle.top - EDGE_CLEARANCE, obstacle.bottom + EDGE_CLEARANCE]),
    ...edgeChannels.map((point) => point.y),
  ])].sort((a, b) => a - b);
  const startX = xs.indexOf(start.x);
  const startY = ys.indexOf(start.y);
  const endX = xs.indexOf(end.x);
  const endY = ys.indexOf(end.y);
  if ([startX, startY, endX, endY].some((index) => index < 0)) return points;
  interface SearchState {
    order: number;
    xIndex: number;
    yIndex: number;
    direction: RouteDirection;
    cost: RouteCost;
    path: Point[];
  }
  const emptyCost = { crossingRisk: 0, crossings: 0, branchCongestion: 0, bends: 0, length: 0, congestion: 0 };
  const queue: SearchState[] = [{
    order: 0,
    xIndex: startX,
    yIndex: startY,
    direction: "start",
    cost: emptyCost,
    path: [start],
  }];
  let nextOrder=1;
  const compareState=(a:SearchState,b:SearchState)=>compareRouteCost(a.cost,b.cost)||a.order-b.order;
  const enqueue=(state:SearchState)=>{
    queue.push(state);let index=queue.length-1;
    while(index>0){const parent=(index-1)>>1;if(compareState(queue[parent]!,state)<=0)break;queue[index]=queue[parent]!;index=parent;}
    queue[index]=state;
  };
  const dequeue=():SearchState=>{
    const result=queue[0]!,last=queue.pop()!;
    if(queue.length){
      let index=0;
      while(index*2+1<queue.length){
        let child=index*2+1;
        if(child+1<queue.length && compareState(queue[child+1]!,queue[child]!)<0)child++;
        if(compareState(last,queue[child]!)<=0)break;
        queue[index]=queue[child]!;index=child;
      }
      queue[index]=last;
    }
    return result;
  };
  const best = new Map<string, RouteCost>();
  const keyFor = (xIndex: number, yIndex: number, direction: RouteDirection): string => `${xIndex}:${yIndex}:${direction}`;
  best.set(keyFor(startX, startY, "start"), emptyCost);
  const pointBlocked = (point: Point): boolean => obstacles.some((obstacle) => (
    point.x > obstacle.left && point.x < obstacle.right
      && point.y > obstacle.top && point.y < obstacle.bottom
  ));
  // These values depend on the grid segment, not the incoming search direction.
  // Keep caches local: each clearance retry has different obstacles and channels.
  const blockedPoints = new Map<number, boolean>();
  const segmentCosts = new Map<string, Omit<RouteCost, "bends"> | null>();
  let routed: Point[] | undefined;
  let searchedStates = 0;
  while (queue.length && searchedStates < MAX_ROUTE_SEARCH_STATES) {
    searchedStates += 1;
    const current = dequeue();
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
      const fromIndex = current.yIndex * xs.length + current.xIndex;
      const toIndex = neighbor.yIndex * xs.length + neighbor.xIndex;
      let blocked = blockedPoints.get(toIndex);
      if (blocked === undefined) {
        blocked = pointBlocked(to);
        blockedPoints.set(toIndex, blocked);
      }
      if (blocked) continue;
      const segmentKey = `${Math.min(fromIndex, toIndex)}:${Math.max(fromIndex, toIndex)}`;
      let segment = segmentCosts.get(segmentKey);
      if (segment === undefined) {
        segment = segmentBlocked(from, to) ? null : {
          crossingRisk: risk(from,to),
          crossings: segmentCrossings(from, to, crossingRoutes),
          branchCongestion: segmentCongestion(from, to, branchEdges),
          length: Math.abs(to.x - from.x) + Math.abs(to.y - from.y),
          congestion: segmentCongestion(from, to, independentEdges),
        };
        segmentCosts.set(segmentKey, segment);
      }
      if (segment === null) continue;
      const cost: RouteCost = {
        crossingRisk: current.cost.crossingRisk + segment.crossingRisk,
        crossings: current.cost.crossings + segment.crossings,
        branchCongestion: current.cost.branchCongestion + segment.branchCongestion,
        bends: current.cost.bends + (current.direction !== "start" && current.direction !== neighbor.direction ? 1 : 0),
        length: current.cost.length + segment.length,
        congestion: current.cost.congestion + segment.congestion,
      };
      const nextKey = keyFor(neighbor.xIndex, neighbor.yIndex, neighbor.direction);
      const previousCost = best.get(nextKey);
      if (previousCost && compareRouteCost(cost, previousCost) >= 0) continue;
      best.set(nextKey, cost);
      enqueue({ ...neighbor, order:nextOrder++, cost, path: [...current.path, to] });
    }
  }

  if (!routed && clearance > 0) {
    // Keep node avoidance as the hard rule when the preferred visual spacing is too tight.
    return chooseSmartRoute(points, source, target, nodes, previousEdges, clearance > 12 ? 12 : clearance > 6 ? 6 : 0, considerEdgeCrossings, attributes, kind);
  }
  if (!routed && considerEdgeCrossings && previousEdges.length > 0) {
    // A smaller graph can still find a node-safe route when edge channels exhaust the search bound.
    return chooseSmartRoute(points, source, target, nodes, [], 0, false, attributes, kind);
  }
  // A route must remain visible when even the node-boundary search has no complete answer.
  if (!routed) return points;
  const simplified = simplifyRoute(routed);
  if (!pathBlocked(initialRoute) && compareRouteCost(routeCost(simplified, crossingRoutes, independentEdges, branchEdges, risk), initialCost) >= 0) return points;
  return simplified;
}

function routeDeployment(nodes: GeometryNode[], model: LayoutModel): GeometryEdge[] {
  for(const port of nodes.filter(node=>node.attributes.boundaryPort === "true" && node.attributes.portDirection === "auto")){
    const external=(id:string)=>{
      let node=nodes.find(node=>node.id===id);const seen=new Set<string>();
      while(node&&!seen.has(node.id)){if(node.id===port.parentId)return false;seen.add(node.id);node=nodes.find(parent=>parent.id===node!.parentId);}
      return true;
    };
    const edge=model.connections.find(edge=>(edge.from===port.id && external(edge.to)) || (edge.to===port.id && external(edge.from)));
    port.attributes={...port.attributes,resolvedPortDirection:edge?.from===port.id?"out":"in"};
  }
  const portOwners=new Set(nodes.filter(node=>node.attributes.boundaryPort === "true").map(node=>node.parentId));
  for(const owner of nodes.filter(node=>portOwners.has(node.id))){
    for(const outgoing of [false,true]){
      const ports=nodes.filter(node=>node.parentId===owner.id && node.attributes.boundaryPort === "true" && ((node.attributes.resolvedPortDirection ?? node.attributes.portDirection) === "out")===outgoing);
      if(!ports.length)continue;
      if(model.direction==="down")owner.width=Math.max(owner.width,(ports.length+1)*(Math.max(...ports.map(port=>port.width))+12));
      else owner.height=Math.max(owner.height,(owner.headerHeight ?? 42)+(ports.length+1)*(Math.max(...ports.map(port=>port.height))+12));
    }
  }
  // Propagate growth to enclosing frames without shifting edited coordinates.
  if(portOwners.size)for(let pass=0;pass<nodes.length;pass++){
    let changed=false;
    for(const child of nodes){
      if(!child.parentId || !contributesToContainerSize(child))continue;
      const parent=nodes.find(node=>node.id===child.parentId);if(!parent)continue;
      const width=Math.max(parent.width,child.x+child.width-parent.x+26),height=Math.max(parent.height,child.y+child.height-parent.y+26);
      if(width!==parent.width || height!==parent.height){parent.width=width;parent.height=height;changed=true;}
    }
    if(!changed)break;
  }
  for(const port of nodes.filter(node=>node.attributes.boundaryPort === "true" && node.parentId)){
    const owner=nodes.find(node=>node.id===port.parentId);if(!owner)continue;
    const outgoing=(port.attributes.resolvedPortDirection ?? port.attributes.portDirection) === "out",vertical=model.direction === "down";
    const peers=nodes.filter(node=>node.parentId===owner.id && node.attributes.boundaryPort === "true" && ((node.attributes.resolvedPortDirection ?? node.attributes.portDirection) === "out")===outgoing);
    const fraction=(peers.indexOf(port)+1)/(peers.length+1);
    port.x=vertical ? owner.x+owner.width*fraction-port.width/2 : owner.x+(outgoing?owner.width:0)-port.width/2;
    const header=owner.headerHeight ?? 42;
    port.y=vertical ? owner.y+(outgoing?owner.height:0)-13 : owner.y+header+(owner.height-header)*fraction-13;
  }
  if (model.kind === "state") {
    for (const point of nodes.filter(n => n.attributes.connectionPoint && n.parentId)) {
      const owner = nodes.find(n => n.id === point.parentId);
      if (!owner) continue;
      const side = ["entrypoint","inputpin"].includes(point.attributes.stateKind ?? "") ? "top" : "bottom";
      const peers = nodes.filter(n => n.parentId === owner.id && n.attributes.connectionPoint && ["entrypoint","inputpin"].includes(n.attributes.stateKind ?? "") === (side === "top"));
      point.x = owner.x + owner.width * (peers.indexOf(point) + 1) / (peers.length + 1) - point.width / 2;
      if(peers.length===1 && ['inputpin','outputpin'].includes(point.attributes.stateKind ?? '')){
        const internal=model.connections.filter(edge=>side==='top' ? edge.from===point.id : edge.to===point.id)
          .map(edge=>nodes.find(node=>node.id===(side==='top'?edge.to:edge.from))).filter((node):node is GeometryNode=>Boolean(node && node.parentId===owner.id));
        if(internal.length===1)point.x=Math.max(owner.x+20,Math.min(owner.x+owner.width-20,internal[0]!.x+internal[0]!.width/2))-point.width/2;
      }
      point.y = owner.y + (side === "bottom" ? owner.height : 0) - point.height / 2;
    }
  }
  const map = byId(nodes);
  const plans: DeploymentEdgePlan[] = [];
  for (const edge of model.connections) {
    const source = map.get(edge.from);
    const target = map.get(edge.to);
    if (!source || !target) continue;
    const sourceCenter = center(source);
    const targetCenter = center(target);
    const requestedSourceSide = (edge.attributes?.fromMapRow ?? edge.attributes?.fromMemberIndex) !== undefined ? (targetCenter.x >= sourceCenter.x ? "right" : "left") : portSide(edge.attributes?.fromPort);
    const requestedTargetSide = (edge.attributes?.toMapRow ?? edge.attributes?.toMemberIndex) !== undefined ? (edge.from === edge.to || sourceCenter.x > targetCenter.x ? "right" : "left") : portSide(edge.attributes?.toPort);
    const stateBarConnection = ["state", "activity"].includes(model.kind) && (source.shape === "uml-bar" || target.shape === "uml-bar");
    // Vertically separated activity actions retain downward entry and exit
    // across lane switches. Explicit ports still take precedence.
    const verticalActivity = (model.kind === "activity" || model.kind === "class") && edge.from !== edge.to
      && (target.y >= source.y + source.height || source.y >= target.y + target.height);
    const facingContainers = model.kind === "deployment" && source.shape === "container" && target.shape === "container"
      && Math.min(source.x + source.width, target.x + target.width) - Math.max(source.x, target.x) > 36
      && (target.y >= source.y + source.height || source.y >= target.y + target.height);
    const horizontal = !facingContainers && !stateBarConnection && !verticalActivity && (edge.from === edge.to
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

  if (model.kind === "class") for (const plan of plans) {
    if(plan.edge.attributes?.relation!=="dependency" || plan.source.parentId!==plan.target.parentId)continue;
    const right=plan.target.x-(plan.source.x+plan.source.width)>=80;
    const left=plan.source.x-(plan.target.x+plan.target.width)>=80;
    if(!right&&!left)continue;
    if(!plan.edge.attributes?.fromPort && plan.edge.attributes?.fromMemberIndex===undefined)plan.sourceSide=right?"right":"left";
    if(!plan.edge.attributes?.toPort && plan.edge.attributes?.toMemberIndex===undefined)plan.targetSide=right?"left":"right";
  }

  // Long dependencies can leave through the outside edge instead of crossing
  // the short downward relationships immediately below their source.
  if (model.kind === "class") for (const plan of plans) {
    if (plan.edge.attributes?.relation !== "dependency" || plan.source.parentId !== plan.target.parentId
      || plan.edge.attributes?.fromPort || plan.edge.attributes?.fromMemberIndex !== undefined) continue;
    if (plan.target.y - (plan.source.y + plan.source.height) < 240) continue;
    const blocked = nodes.some(node => node !== plan.source && node !== plan.target && node.shape !== "container"
      && node.y > plan.source.y + plan.source.height && node.y + node.height < plan.target.y
      && node.x < center(plan.source).x && node.x + node.width > center(plan.source).x);
    if (blocked) plan.sourceSide = center(plan.source).x >= center(plan.target).x ? "right" : "left";
  }

  if (model.kind === "class") for (const plan of plans) {
    if (plan.edge.attributes?.relation !== "dependency" || !plan.source.parentId || !plan.target.parentId
      || plan.source.parentId === plan.target.parentId) continue;
    const sourceOwner = map.get(plan.source.parentId), targetOwner = map.get(plan.target.parentId);
    if (!sourceOwner || !targetOwner || sourceOwner.parentId !== targetOwner.parentId) continue;
    const right = targetOwner.x >= sourceOwner.x + sourceOwner.width;
    const left = sourceOwner.x >= targetOwner.x + targetOwner.width;
    if (!right && !left) continue;
    if (!portSide(plan.edge.attributes?.fromPort)) plan.sourceSide = right ? "right" : "left";
    if (!portSide(plan.edge.attributes?.toPort)) plan.targetSide = center(plan.source).y < plan.target.y ? "top" : right ? "left" : "right";
  }

  const componentPortSide=(port:GeometryNode,other:GeometryNode):PortSide|undefined=>{
    if(port.attributes.boundaryPort!=="true" || !port.parentId)return undefined;
    let parent=other.parentId,inside=false;const seen=new Set<string>();
    while(parent&&!seen.has(parent)){if(parent===port.parentId){inside=true;break;}seen.add(parent);parent=map.get(parent)?.parentId;}
    const outgoing=(port.attributes.resolvedPortDirection ?? port.attributes.portDirection)==="out";
    return model.direction==="down" ? (inside!==outgoing?"bottom":"top") : (inside!==outgoing?"right":"left");
  };
  for(const plan of plans){
    if(!portSide(plan.edge.attributes?.fromPort))plan.sourceSide=componentPortSide(plan.source,plan.target) ?? plan.sourceSide;
    if(!portSide(plan.edge.attributes?.toPort))plan.targetSide=componentPortSide(plan.target,plan.source) ?? plan.targetSide;
  }

  // Boundary points must be approached perpendicular to their owner's border.
  if (model.kind === "state") {
    const inside = (node: GeometryNode, owner: string): boolean => {
      const seen = new Set<string>();
      let parent = node.parentId;
      while (parent && !seen.has(parent)) {
        if (parent === owner) return true;
        seen.add(parent); parent = map.get(parent)?.parentId;
      }
      return false;
    };
    const boundarySide = (point: GeometryNode, other: GeometryNode): PortSide | undefined => {
      if (!point.attributes.connectionPoint || !point.parentId) return undefined;
      const internal = inside(other, point.parentId);
      return ["entrypoint","inputpin"].includes(point.attributes.stateKind ?? "")
        ? (internal ? "bottom" : "top") : (internal ? "top" : "bottom");
    };
    for (const plan of plans) {
      if (!portSide(plan.edge.attributes?.fromPort)) plan.sourceSide = boundarySide(plan.source, plan.target) ?? plan.sourceSide;
      if (!portSide(plan.edge.attributes?.toPort)) plan.targetSide = boundarySide(plan.target, plan.source) ?? plan.targetSide;
    }
  }

  // A decision's alternatives are not a shared bus. Give the forward path
  if (model.kind === "state" && model.direction === "down") {
    for (const plan of plans) {
      if (plan.target.shape === "junction-state" && !portSide(plan.edge.attributes?.toPort)) plan.targetSide = "top";
    }
  }
  // A decision's alternatives are not a shared bus. Give the forward path
  // the forward exit and send bypasses from separate side vertices.
  if (["flowchart", "activity", "graph"].includes(model.kind)) {
    for (const source of nodes.filter((node) => node.shape === "diamond")) {
      const outgoing = plans.filter((plan) => plan.source.id === source.id && plan.target.id !== source.id);
      if (outgoing.length < 2) continue;
      const origin = center(source);
      const vertical = model.kind !== "graph" || model.direction !== "right";
      const forward = [...outgoing].sort((a, b) => {
        const score = (plan: DeploymentEdgePlan) => {
          const target = center(plan.target);
          const along = vertical ? target.y - origin.y : target.x - origin.x;
          const across = vertical ? Math.abs(target.x - origin.x) : Math.abs(target.y - origin.y);
          return (along <= 0 ? 1e6 : 0) + across * 100 + Math.abs(along);
        };
        return score(a) - score(b) || a.edge.order - b.edge.order;
      })[0]!;
      const used = new Set<PortSide>();
      for (const plan of [forward, ...outgoing.filter((plan) => plan !== forward)]) {
        const requested = portSide(plan.edge.attributes?.fromPort);
        const target = center(plan.target);
        let side: PortSide = plan === forward ? (vertical ? "bottom" : "right")
          : vertical ? (target.x < origin.x ? "left" : "right") : (target.y < origin.y ? "top" : "bottom");
        if (plan !== forward && used.has(side)) {
          const alternative: PortSide = vertical ? (side === "left" ? "right" : "left") : (side === "top" ? "bottom" : "top");
          if (!used.has(alternative)) side = alternative;
        }
        plan.sourceSide = requested ?? side;
        used.add(plan.sourceSide);
        if (!portSide(plan.edge.attributes?.toPort) && plan !== forward
          && (vertical ? Math.abs(target.x - origin.x) < 0.5 : Math.abs(target.y - origin.y) < 0.5)) {
          plan.targetSide = plan.sourceSide;
        }
      }
    }
  }

  // Entry and exit points belong to one composite state but are distinct
  // endpoints. Keep its return transition off the external state's resume port.
  if (model.kind === "state") for (const plan of plans) {
    if (plan.source.attributes.stateKind !== "exitpoint" || !plan.source.parentId
      || plan.edge.attributes?.toPort) continue;
    const resume = plans.find(other => other.source.id === plan.target.id
      && other.target.attributes.stateKind === "entrypoint"
      && other.target.parentId === plan.source.parentId);
    if (!resume || plan.targetSide !== resume.sourceSide) continue;
    const owner = map.get(plan.source.parentId);
    if (!owner) continue;
    plan.targetSide = center(plan.target).x <= center(owner).x ? "left" : "right";
  }

  // Labels sit below the provided-interface circle; use a side port instead
  // of crossing that label when the other endpoint is below it.
  for (const plan of plans) {
    if (["actor", "uml-provided-interface", "uml-required-interface", "sequence-boundary", "sequence-control", "sequence-entity"].includes(plan.source.shape) && plan.sourceSide === "bottom" && !portSide(plan.edge.attributes?.fromPort)) {
      plan.sourceSide = "right";
      if (!portSide(plan.edge.attributes?.toPort)) plan.targetSide = "right";
    }
    if (["actor", "uml-provided-interface", "uml-required-interface", "sequence-boundary", "sequence-control", "sequence-entity"].includes(plan.target.shape) && plan.targetSide === "bottom" && !portSide(plan.edge.attributes?.toPort)) {
      plan.targetSide = "right";
      if (!portSide(plan.edge.attributes?.fromPort)) plan.sourceSide = "right";
    }
  }

  for (const node of nodes.filter(node=>node.shape === "uml-required-interface")) {
    const plan=plans.find(plan=>plan.source.id!==plan.target.id && (plan.source===node || plan.target===node));
    const side=plan ? (plan.source===node ? plan.sourceSide : plan.targetSide) : "top";
    const opposite={left:"right",right:"left",top:"bottom",bottom:"top"};
    node.attributes={...node.attributes,interfaceOpening:opposite[side]};
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
      const key = `${request.node.id}:${request.side}:${request.node.shape === "container" ? "both" : request.endpoint}`;
      const group = requestsByPort.get(key) ?? [];
      group.push(request);
      requestsByPort.set(key, group);
    }
  }

  const allocatedPorts = new Map<string, Point>();
  for (const requests of requestsByPort.values()) {
    requests.sort((a, b) => a.sortValue - b.sortValue || a.plan.edge.order - b.plan.edge.order);
    const centeredTargets = new Set(requests.filter((request) => (["flowchart", "activity", "graph"].includes(model.kind)
      || (model.kind === "deployment" && !horizontalPort(request.side)))
      && request.endpoint === "target"
      && Math.abs(request.sortValue - (horizontalPort(request.side) ? center(request.node).y : center(request.node).x)) < 0.5));
    requests.forEach((request, index) => {
      const bundledSource = !["er", "slide", "class"].includes(model.kind)
        && (model.kind !== "state" || request.node.shape === "uml-bar" || Boolean(request.node.attributes.connectionPoint))
        && request.endpoint === "source" && requests.length > 1;
      const count = requests.length + (centeredTargets.size && requests.length % 2 ? 1 : 0);
      allocatedPorts.set(
        `${request.plan.edge.id}:${request.endpoint}`,
        bundledSource || centeredTargets.has(request) ? portPoint(request.node, request.side, 0, 1) : portPoint(request.node, request.side, index, count),
      );
    });
  }

  // Isolated links between facing deployment frames share an attachment axis.
  if (model.kind === "deployment") for (const plan of plans) {
    const {source, target, sourceSide, targetSide} = plan;
    if (source.shape !== "container" || target.shape !== "container") continue;
    if (!((sourceSide === "bottom" && targetSide === "top" && source.y + source.height <= target.y)
      || (sourceSide === "top" && targetSide === "bottom" && target.y + target.height <= source.y))) continue;
    const occupiedSide = (node: GeometryNode, side: PortSide) => plans.filter(p =>
      (p.source.id === node.id && p.sourceSide === side) || (p.target.id === node.id && p.targetSide === side)).length;
    if (occupiedSide(source, sourceSide) !== 1 || occupiedSide(target, targetSide) !== 1) continue;
    const left = Math.max(source.x, target.x) + 18;
    const right = Math.min(source.x + source.width, target.x + target.width) - 18;
    if (left > right) continue;
    const x = (left + right) / 2;
    allocatedPorts.set(`${plan.edge.id}:source`, {x, y:source.y + (sourceSide === "bottom" ? source.height : 0)});
    allocatedPorts.set(`${plan.edge.id}:target`, {x, y:target.y + (targetSide === "bottom" ? target.height : 0)});
  }

  // Opposite state transitions remain separate, with matching offset ports.
  if(model.kind === "state") for(const plan of plans){
    const reverse=plans.find(p=>p.edge.from===plan.edge.to&&p.edge.to===plan.edge.from);
    if(!reverse||plan.source===plan.target||plan.edge.attributes?.fromPort||plan.edge.attributes?.toPort||reverse.edge.attributes?.fromPort||reverse.edge.attributes?.toPort)continue;
    if(!["top","bottom"].includes(plan.sourceSide)||!["top","bottom"].includes(plan.targetSide))continue;
    if(Math.abs(center(plan.source).x-center(plan.target).x)>0.5)continue;
    if(plans.filter(p=>(p.source===plan.source&&p.target===plan.target)||(p.source===plan.target&&p.target===plan.source)).length!==2)continue;
    if(!["rounded","uml-state"].includes(plan.source.shape)||!["rounded","uml-state"].includes(plan.target.shape))continue;
    const offset=plan.edge.order<reverse.edge.order?-8:8;
    for(const endpoint of ["source","target"] as const){
      const n=plan[endpoint],side=endpoint==='source'?plan.sourceSide:plan.targetSide;
      if(n.shape==='container'||n.attributes.connectionPoint)continue;
      const point=portPoint(n,side,0,1);point.x+=offset;
      allocatedPorts.set(`${plan.edge.id}:${endpoint}`,point);
    }
  }

  for(const plan of plans) {
    for(const endpoint of ['source','target'] as const){
      const member=plan.edge.attributes?.[endpoint==='source'?'fromMemberIndex':'toMemberIndex'];
      const row=plan.edge.attributes?.[endpoint==='source'?'fromMapRow':'toMapRow'] ?? member;
      if(row===undefined)continue;
      const node=endpoint==='source'?plan.source:plan.target;
      const side=endpoint==='source'?plan.sourceSide:plan.targetSide;
      allocatedPorts.set(`${plan.edge.id}:${endpoint}`,{x:node.x+(side==='right'?node.width:0),y:member===undefined ? node.y+56+Number(row)*28 : annotationAnchor(node,member).y});
    }
  }

  const routedEdges: GeometryEdge[] = [];
  for (const plan of plans) {
    const { edge, source, target } = plan;
    const sourceCenter = center(source);
    let points: Point[];
    if (edge.from === edge.to && ((edge.attributes?.fromMapRow ?? edge.attributes?.fromMemberIndex) !== undefined || (edge.attributes?.toMapRow ?? edge.attributes?.toMemberIndex) !== undefined)) {
      const start=allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source,'right',0,1);
      const end=allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target,'right',0,1);
      points=[start,{x:source.x+source.width+28,y:start.y},{x:source.x+source.width+28,y:end.y},end];
    } else if (edge.from === edge.to && (portSide(edge.attributes?.fromPort) || portSide(edge.attributes?.toPort))) {
      const from = portSide(edge.attributes?.fromPort) ?? "right";
      const to = portSide(edge.attributes?.toPort) ?? "top";
      const start = portPoint(source, from, 0, from === to ? 2 : 1);
      const end = portPoint(source, to, from === to ? 1 : 0, from === to ? 2 : 1);
      const sides: PortSide[] = ["top", "right", "bottom", "left"];
      const left = source.x - 28, right = source.x + source.width + 28;
      const top = source.y - 28, bottom = source.y + source.height + 28;
      const project = (point: Point, side: PortSide): Point => side === "left" ? {x:left,y:point.y}
        : side === "right" ? {x:right,y:point.y}
        : side === "top" ? {x:point.x,y:top} : {x:point.x,y:bottom};
      const corners = [{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom},{x:left,y:top}];
      const a = sides.indexOf(from), b = sides.indexOf(to);
      const clockwise = (b-a+4)%4;
      const perimeter: Point[] = [project(start,from)];
      if(clockwise <= 2) {
        for(let step=0;step<clockwise;step++) perimeter.push(corners[(a+step)%4]!);
      } else {
        for(let step=0;step<4-clockwise;step++) perimeter.push(corners[(a-step+3)%4]!);
      }
      perimeter.push(project(end,to));
      points = [start,...perimeter,end];
    } else if (edge.from === edge.to && ["person", "actor", "uml-provided-interface", "uml-required-interface", "sequence-boundary", "sequence-control", "sequence-entity"].includes(source.shape)) {
      const start = portPoint(source, "right", 0, 1);
      const end = portPoint(source, "top", 0, 1);
      const outside = source.x + source.width + 28;
      points = [start, {x:outside,y:start.y}, {x:outside,y:source.y-18}, {x:end.x,y:source.y-18}, end];
    } else if (edge.from === edge.to) {
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
      const middleX = plan.sourceSide === plan.targetSide
        ? plan.sourceSide === "right" ? Math.max(start.x, end.x) + 24 : Math.min(start.x, end.x) - 24
        : sourceBundle > 1 && model.kind !== "deployment"
        ? start.x + (plan.sourceSide === "right" ? 24 : -24)
        : (start.x + end.x) / 2;
      points = [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
      if(((edge.attributes?.fromMapRow ?? edge.attributes?.fromMemberIndex)!==undefined || (edge.attributes?.toMapRow ?? edge.attributes?.toMemberIndex)!==undefined) && plan.sourceSide!==plan.targetSide && (plan.sourceSide==='left' ? end.x>start.x : end.x<start.x)){
        const a=offsetPort(start,plan.sourceSide,24),b=offsetPort(end,plan.targetSide,24);
        const midY=source.y<target.y ? (source.y+source.height+target.y)/2 : (target.y+target.height+source.y)/2;
        points=[start,a,{x:a.x,y:midY},{x:b.x,y:midY},b,end];
      }
    } else if (!horizontalPort(plan.sourceSide) && !horizontalPort(plan.targetSide)) {
      const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, plan.sourceSide, 0, 1);
      const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, plan.targetSide, 0, 1);
      const sourceBundle = ["er", "slide"].includes(model.kind) ? 0 : requestsByPort.get(`${source.id}:${plan.sourceSide}:source`)?.length ?? 0;
      const middleY = plan.sourceSide === plan.targetSide
        ? plan.sourceSide === "bottom" ? Math.max(start.y, end.y) + 24 : Math.min(start.y, end.y) - 24
        : sourceBundle > 1 && model.kind !== "deployment"
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
      const corner=horizontalPort(plan.sourceSide)?{x:end.x,y:start.y}:{x:start.x,y:end.y};
      if(followsHeading(start,corner,routeHeading(start,startOutside)) && followsHeading(corner,end,routeHeading(endOutside,end)))points=[start,corner,end];
    }
    const routed = { ...edge, points: chooseSmartRoute(points, source, target, nodes, routedEdges, ROUTE_CLEARANCE, true, edge.attributes, model.kind) };
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
  if(node.shape === "usecase") {
    const offset=(index+1)/(count+1)*2-1;
    const radius=Math.sqrt(Math.max(0,1-offset*offset));
    return side === "left" || side === "right"
      ? {x:node.x+node.width/2*(1+(side==='left'?-radius:radius)),y:node.y+node.height/2*(1+offset)}
      : {x:node.x+node.width/2*(1+offset),y:node.y+node.height/2*(1+(side==='top'?-radius:radius))};
  }
  if(node.shape === "actor") return {
    x:node.x+node.width/2+(side === "left"?-16:side === "right"?16:side === "bottom"?12:0),
    y:node.y+(side === "top"?2:side === "bottom"?56:40),
  };
  if (node.shape === "person") {
    const fraction = (index + 1) / (count + 1);
    const headOffset = 16 * (2 * fraction - 1);
    return {
      x: node.x + (side === "left" ? 0 : side === "right" ? node.width : side === "bottom" ? 16 + (node.width - 32) * fraction : node.width / 2 + headOffset),
      y: node.y + (side === "top" ? 16 - Math.sqrt(256 - headOffset * headOffset) : side === "bottom" ? node.height : 48 + (node.height - 64) * fraction),
    };
  }
  if (node.shape === "process" || node.shape === "container" && node.attributes.containerStyle === "process") {
    const fraction = (index + 1) / (count + 1);
    if (side === "top" || side === "bottom") return {x: node.x + (node.width - 12) * fraction, y: node.y + (side === "bottom" ? node.height : 0)};
    const y = node.height * fraction;
    const inset = 12 * (1 - Math.abs(2 * fraction - 1));
    return {x: node.x + (side === "left" ? inset : node.width - 12 + inset), y: node.y + y};
  }
  if (node.shape === "uml-node" || node.shape === "uml-device" || node.shape === "container" && node.attributes.containerStyle === "node") {
    const depth = node.shape === "uml-device" ? 12 : 10;
    const fraction = (index + 1) / (count + 1);
    // Distribute ports along the outer straight edges, excluding the two bevels.
    if (side === "left" || side === "right") return {
      x: node.x + (side === "right" ? node.width : 0),
      y: node.y + depth + (node.height - depth * 2) * fraction,
    };
    return {
      x: node.x + depth + (node.width - depth * 2) * fraction,
      y: node.y + (side === "bottom" ? node.height : 0),
    };
  }
  if(node.shape === "uml-port")return {x:node.x+node.width/2+(side==="left"?-11:side==="right"?11:0),y:node.y+(side==="top"?2:side==="bottom"?24:13)};
  if (node.shape === "uml-required-interface") return requiredInterfacePort(node, side);
  if (["sequence-boundary", "sequence-control", "sequence-entity"].includes(node.shape)) return {
    x: node.x + node.width/2 + (side === "left" ? (node.shape === "sequence-boundary" ? -30 : -18) : side === "right" ? 18 : side === "top" && node.shape === "sequence-control" ? 10 : 0),
    y: node.y + (side === "top" ? (node.shape === "sequence-control" ? 30-Math.sqrt(224) : 12) : side === "bottom" ? (node.shape === "sequence-entity" ? 52 : 48) : 30),
  };
  if(node.shape === "uml-provided-interface") return {
    x: node.x + node.width/2 + (side === "left" ? -10 : side === "right" ? 10 : 0),
    y: node.y + 14 + (side === "top" ? -10 : side === "bottom" ? 10 : 0),
  };
  if(node.shape==='signal-send' || node.shape==='signal-receive'){
    if(side==='top'||side==='bottom')return {x:node.x+node.width/2,y:node.y+(side==='bottom'?node.height:0)};
    const y=node.height*(index+1)/(count+1);
    const notch=20*(1-Math.abs(2*y/node.height-1));
    const mirrored=node.attributes.facing==='left';
    const localSide=mirrored ? (side==='left'?'right':'left') : side;
    const x=localSide==='left' ? (node.shape==='signal-receive'?notch:0) : node.width-(node.shape==='signal-send'?20-notch:0);
    return {x:node.x+(mirrored?node.width-x:x),y:node.y+y};
  }
  if (["diamond", "circle", "initial-state", "final-state", "junction-state"].includes(node.shape)) {
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

const baseHierarchicalLayout: LayoutPlugin = {
  name: "hierarchical",
  layout(model, context) {
    if (["component","deployment"].includes(model.kind) && model.direction === "down") {
      return model.items.some(item=>item.shape==="container") ? layoutUmlHierarchy(model,context) : layoutVerticalDirected(model,context);
    }
    const nodes = arrangeDeployment(model);
    arrangeContainerContents(nodes, model);
    fitContainers(nodes);
    arrangeNestedContainerContents(nodes, model);
    packTopLevelGroups(nodes, model);
    if(model.kind==='deployment'){
      const roots=nodes.filter(n=>!n.parentId);
      if(roots.every(n=>n.shape==='container'))arrangeSharedBlocks(roots,model,id=>{
        let n=nodes.find(n=>n.id===id);while(n?.parentId)n=nodes.find(p=>p.id===n!.parentId);return n?.id;
      },(id,x,y)=>{
        const root=nodes.find(n=>n.id===id)!,dx=x-root.x,dy=y-root.y;
        for(const n of nodes){let p:GeometryNode|undefined=n;while(p&&p.id!==id)p=nodes.find(a=>a.id===p!.parentId);if(p){n.x+=dx;n.y+=dy;}}
      },(id,direction)=>{
        const root=nodes.find(n=>n.id===id)!,children=nodes.filter(n=>n.parentId===id);
        if(children.some(n=>n.shape==='container'||n.attributes.order||n.attributes.row||n.attributes.column||n.attributes.place))return;
        let x=root.x+28,y=root.y+(root.headerHeight??32)+28;
        for(const n of [...children].sort((a,b)=>a.x-b.x||a.y-b.y)){n.x=x;n.y=y;if(direction==='row')x+=n.width+80;else y+=n.height+80;}
        resetContainerSize(root,model);fitContainer(root,nodes);
      });
      const arrange=()=>arrangeThreeBlocks(roots,model,id=>{
        let n=nodes.find(n=>n.id===id);while(n?.parentId)n=nodes.find(p=>p.id===n!.parentId);return n?.id;
      },(id,x,y)=>{
        const root=nodes.find(n=>n.id===id)!,dx=x-root.x,dy=y-root.y;
        for(const n of nodes){let p:GeometryNode|undefined=n;while(p&&p.id!==id)p=nodes.find(a=>a.id===p!.parentId);if(p){n.x+=dx;n.y+=dy;}}
      });
      if(roots.every(n=>n.shape==='container')&&arrange()){
        const receiver=[...roots].sort((a,b)=>b.x-a.x)[0]!;
        const children=nodes.filter(n=>n.parentId===receiver.id);
        if(children.length>1&&children.every(n=>n.shape!=='container'&&!n.attributes.order&&!n.attributes.row&&!n.attributes.column&&!n.attributes.place)){
          const x=receiver.x+28;let y=receiver.y+(receiver.headerHeight??32)+28;
          for(const n of [...children].sort((a,b)=>a.x-b.x||a.y-b.y)){n.x=x;n.y=y;y+=n.height+80;}
          resetContainerSize(receiver,model);fitContainer(receiver,nodes);arrange();
        }
      }
    }
    if (!context.overlay.frozen && !Object.keys(context.overlay.nodes).length) arrangeBipartiteBlocks(nodes, model);
    arrangeStateJoinSections(nodes, model);
    if (model.kind === "usecase") {
      for (const edge of model.connections.filter(edge => edge.attributes?.relation === "inheritance")) {
        const child = nodes.find(node => node.id === edge.from && node.shape === "actor");
        const parent = nodes.find(node => node.id === edge.to && node.shape === "actor");
        if (!child || !parent) continue;
        // A parent in the next column must not sit on an unrelated actor's
        // outgoing line either (for example a payment provider beside Customer).
        if (nodes.some(node => node !== parent && node.shape === "actor"
          && Math.abs(node.y - parent.y) < 24 && node.x < parent.x)) {
          const y = parent.y + 48;
          if (!nodes.some(node => node !== parent && node.shape !== "container"
            && node.parentId === parent.parentId && parent.x < node.x + node.width + 16
            && parent.x + parent.width + 16 > node.x && y < node.y + node.height + 24
            && y + parent.height + 24 > node.y)) parent.y = y;
        }
        if (Math.abs(child.y - parent.y) >= 48) continue;
        let y = parent.y + 48;
        // Retain the column while making room for the entire actor and label.
        for (let attempt = 0; attempt < nodes.length; attempt++) {
          const obstacle = nodes.find(node => node !== child && node.shape !== "container"
            && node.parentId === child.parentId && child.x < node.x + node.width + 16
            && child.x + child.width + 16 > node.x && y < node.y + node.height + 24
            && y + child.height + 24 > node.y);
          if (!obstacle) break;
          y = obstacle.y + obstacle.height + 24;
        }
        child.y = y;
      }
    }

    applyContinuity(nodes, context);
    // Keep automatic containers wrapped around children; manual containers retain their overlay.
    fitContainers(nodes.filter((node) => !context.overlay.nodes[node.id]?.manual || node.shape !== "container"));
    const edges = routeDeployment(nodes, model);
    return { kind: model.kind, direction: model.direction, nodes, edges, groups: [], ...dimensions(nodes) };
  },
};

export const hierarchicalLayout: LayoutPlugin = {
  ...baseHierarchicalLayout,
  layout(model,context){
    const ports=model.items.filter(item=>item.attributes.boundaryPort === "true" && item.parentId);
    const owners=new Map(ports.map(port=>[port.id,port.parentId!]));
    const layoutModel=ports.length ? {...model,items:model.items.filter(item=>!owners.has(item.id)).map(item=>{
      const incoming=ports.filter(port=>port.parentId===item.id && port.attributes.portDirection!=="out");
      if(model.direction!=="down" || !incoming.length)return item;
      const headerHeight=Math.max(item.size.headerHeight ?? 42,...incoming.map(port=>port.size.height+3));
      return {...item,size:{...item.size,headerHeight,height:Math.max(item.size.height,headerHeight+26)}};
    }),connections:model.connections.map(edge=>({...edge,from:owners.get(edge.from) ?? edge.from,to:owners.get(edge.to) ?? edge.to}))} : model;
    const geometry=baseHierarchicalLayout.layout(layoutModel,context);
    if(ports.length){
      for(const {size,...port} of ports)geometry.nodes.push({...port,...size,x:0,y:0});
      geometry.edges=routeDeployment(geometry.nodes,model);
      separateSiblingBlocks(geometry.nodes,model,context);
      geometry.edges=routeDeployment(geometry.nodes,model);
      Object.assign(geometry,dimensions(geometry.nodes));
    }
    if(!model.connections.some(edge=>edge.attributes?.layoutDirection))return geometry;
    const nodes=geometry.nodes, map=byId(nodes);
    const locked=(node:GeometryNode)=>Boolean(context.overlay.nodes[node.id] && (!context.force || context.preservePinned && context.overlay.nodes[node.id]!.pinned));
    const ancestry=(node:GeometryNode):GeometryNode[]=>{
      const path=[node],seen=new Set([node.id]);
      while(path[0]!.parentId){const parent=map.get(path[0]!.parentId!);if(!parent||seen.has(parent.id))break;path.unshift(parent);seen.add(parent.id);}
      return path;
    };
    const subtree=(root:GeometryNode)=>nodes.filter(node=>ancestry(node).some(parent=>parent.id===root.id));
    for(const axis of ["x","y"] as const){
      const constraints:Array<{before:GeometryNode;after:GeometryNode}>=[];
      for(const edge of model.connections){
        const direction=edge.attributes?.layoutDirection;
        if(!direction || (axis==="x")!==["left","right"].includes(direction))continue;
        const from=map.get(edge.attributes!.layoutFrom!),to=map.get(edge.attributes!.layoutTo!);
        if(!from || !to || from.id===to.id)continue;
        const fromPath=ancestry(from),toPath=ancestry(to);
        let common=0;while(common<fromPath.length&&common<toPath.length&&fromPath[common]!.id===toPath[common]!.id)common++;
        // Ancestor/descendant separation would tear containment apart.
        if(common===fromPath.length||common===toPath.length)continue;
        const source=fromPath[common]!,target=toPath[common]!;
        const constraint=["left","up"].includes(direction)?{before:target,after:source}:{before:source,after:target};
        const pending=[constraint.after.id],seen=new Set<string>();
        while(pending.length){const id=pending.pop()!;if(seen.has(id))continue;seen.add(id);pending.push(...constraints.filter(c=>c.before.id===id).map(c=>c.after.id));}
        if(!seen.has(constraint.before.id))constraints.push(constraint);
      }
      for(let pass=0;pass<nodes.length;pass++){
        let changed=false;
        for(const {before,after} of constraints){
          const moving=subtree(after);
          if(moving.some(locked))continue;
          const minimum=before[axis]+(axis==="x"?before.width:before.height)+Math.max(36,model.minimumGap ?? 36);
          if(after[axis]<minimum){
            const delta=minimum-after[axis];changed=true;
            for(const node of moving)node[axis]+=delta;
          }
        }
        if(!changed)break;
      }
    }
    fitContainers(nodes);
    if(nodes.length && !nodes.some(locked)){
      const dx=Math.min(...nodes.map(node=>node.x))-CANVAS_PADDING;
      const dy=Math.min(...nodes.map(node=>node.y))-CANVAS_PADDING;
      for(const node of nodes){node.x-=dx;node.y-=dy;}
    }
    geometry.edges=routeDeployment(nodes,model);
    return {...geometry,...dimensions(nodes)};
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
    const diagramText=measureDiagramText(model.diagramText,model.labelFontSize,model.labelFontFamily);
    const headerY = 26+diagramText.top;
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
    if(diagramText.top)for(const node of nodes)node.y=Math.max(headerY,node.y);
    const map = byId(nodes);
    const messageLabelHeight = (edge: LayoutModel["connections"][number]) => {
      const source = map.get(edge.from) ?? (edge.attributes?.external === "incoming" ? map.get(edge.to) : undefined);
      const target = map.get(edge.to) ?? (edge.attributes?.external === "outgoing" ? map.get(edge.from) : undefined);
      const fromX=edge.attributes?.external==='incoming' ? (edge.attributes.externalSide === "right" ? Math.max(...nodes.map(n=>n.x+n.width))+24 : Math.min(...nodes.map(n=>n.x))-24) : source ? center(source).x : 0;
      const toX=edge.attributes?.external==='outgoing' ? (edge.attributes.externalSide === "left" ? Math.min(...nodes.map(n=>n.x))-24 : Math.max(...nodes.map(n=>n.x+n.width))+24) : target ? center(target).x : 0;
      const available = source && target ? Math.max(48, Math.abs(fromX-toX) - 24) : 180;
      return labelLayout(edge.label ?? "", Math.min(wrapWidth(edge.attributes, 180), available), model.labelFontSize ?? 12).height;
    };
    const groupHeaderHeight = (group: LayoutModel["groups"][number]) => labelLayout(group.kind && group.kind !== "group" ? `${group.kind} · ${group.label}` : group.label, 216, model.labelFontSize ?? 12).height + 16;
    const firstMessageY = Math.max(...nodes.map((node) => node.y + node.height)) + Math.max(58, (model.connections[0] ? messageLabelHeight(model.connections[0]) : 0) + 30) + Math.max(0, ...model.groups.map(groupHeaderHeight));
    const messageGap = 52;
    let messageY = firstMessageY;
    const frameTops = new Map<string, number>();
    const frameBottoms = new Map<string, number>();
    const branchPositions = new Map<string, Array<{ y: number; label: string }>>();
    const edges: GeometryEdge[] = model.connections.flatMap((edge, index) => {
      const source = map.get(edge.from) ?? (edge.attributes?.external === "incoming" ? map.get(edge.to) : undefined);
      const target = map.get(edge.to) ?? (edge.attributes?.external === "outgoing" ? map.get(edge.from) : undefined);
      if (!source || !target) return [];
      for (const group of model.groups) {
        const branch = group.branches?.find(branch => branch.start === index);
        if (!branch) continue;
        const positions = branchPositions.get(group.id) ?? [];
        positions.push({ y: messageY, label: branch.label });
        branchPositions.set(group.id, positions);
        messageY += labelLayout(branch.label, 216, model.labelFontSize ?? 12).height + 36;
      }
      for (const group of model.groups.filter(group => group.start === index)) {
        frameTops.set(group.id, messageY);
        messageY += groupHeaderHeight(group) + 12;
      }
      messageY += model.groups.some(group => group.start === index) ? messageLabelHeight(edge) + 12 : 0;
      const fragment = ["ref","delay","divider","note"].includes(edge.attributes?.messageKind ?? "");
      const fragmentNodes=nodes.filter(n=>(edge.attributes?.participants ?? "").split(",").includes(n.id));
      const fragmentWidth=sequenceFragmentSpan(fragmentNodes,edge.attributes?.messageKind).width;
      const fragmentHeight=fragment ? Math.max(36,labelLayout(edge.attributes?.fragmentLabel ?? "",Math.max(40,fragmentWidth-52),model.labelFontSize ?? 12,model.labelFontFamily).lines.length*16+22) : 0;
      const y = messageY;
      const nextMessage = model.connections[index + 1];
      const fromX = edge.attributes?.external === "incoming" ? (edge.attributes.externalSide === "right" ? Math.max(...nodes.map(n=>n.x+n.width))+24 : Math.min(...nodes.map(n=>n.x))-24) : source.x + source.width / 2;
      const toX = edge.attributes?.external === "outgoing" ? (edge.attributes.externalSide === "left" ? Math.min(...nodes.map(n=>n.x))-24 : Math.max(...nodes.map(n=>n.x+n.width))+24) : target.x + target.width / 2;
      const receiveOffset=Number(edge.attributes?.receiveOffset ?? 0);
      messageY += receiveOffset + Math.max(messageGap, (nextMessage ? messageLabelHeight(nextMessage) : 0) + 24 + (fromX === toX ? 28 : 0));
      const points = fromX === toX
        ? [{ x: fromX, y }, { x: fromX + 42, y }, { x: fromX + 42, y: y + 28 + receiveOffset }, { x: fromX, y: y + 28 + receiveOffset }]
        : [{ x: fromX, y }, { x: toX, y:y+receiveOffset }];
      messageY=Math.max(messageY,y+fragmentHeight+24);
      let frameBottom = y + receiveOffset + Math.max(fragmentHeight,fromX === toX ? 28 : 0) + 18;
      for (const group of [...model.groups].reverse().filter(group => group.end === index)) {
        frameBottoms.set(group.id, frameBottom);
        frameBottom += 12;
      }
      messageY = Math.max(messageY, frameBottom + 16);
      return [{ ...edge, ...(fragment?{attributes:{...edge.attributes,fragmentHeight:String(fragmentHeight),fragmentFontSize:String(model.labelFontSize ?? 12),fragmentFontFamily:model.labelFontFamily ?? ''}}:{}), points }];
    });
    const bottom = messageY + 30;
    for (const node of nodes) {
      const events = JSON.parse(node.attributes.sequenceEvents ?? "[]") as Array<{ kind: string; at: number }>;
      const positioned = events.map(event => ({ ...event, y: event.kind === "create" ? (edges[event.at]?.points.slice(-1)[0]?.y ?? bottom - 24) : Math.max(firstMessageY - 24, ...(edges[event.at - 1]?.points.map(point => point.y) ?? [firstMessageY - 24])) }));
      node.attributes.sequencePositions = JSON.stringify(positioned);
      if (node.attributes.branchLifetime) for (const event of positioned.filter(e=>e.kind === "create")) {
        const arrival = edges[event.at];
        if (arrival?.to === node.id) { arrival.points[arrival.points.length-1]!.x = arrival.points[0]!.x < node.x ? node.x : node.x + node.width; arrival.attributes = {...arrival.attributes,messageKind:"create"}; }
      }
      const created = positioned.find(event => event.kind === "create");
      if (created && !node.attributes.branchLifetime) {
        node.y = created.y - node.height / 2;
        const arrival = edges[created.at];
        if (arrival?.to === node.id) {
          const end = arrival.points[arrival.points.length - 1]!;
          end.x = arrival.points[0]!.x < node.x ? node.x : node.x + node.width;
          arrival.attributes = { ...arrival.attributes, messageKind: "create" };
        }
      }
    }
    const noteSpans=edges.filter(edge=>edge.attributes?.messageKind==='note').map(edge=>sequenceFragmentSpan(nodes.filter(node=>(edge.attributes!.participants ?? '').split(',').includes(node.id)),'note'));
    const frameDepth=(group:typeof model.groups[number])=>model.groups.filter(other=>other!==group && other.start<=group.start && other.end>=group.end && model.groups.indexOf(other)<model.groups.indexOf(group)).length;
    const framePadding=14+Math.max(0,...model.groups.map(frameDepth))*6;
    const groups: GeometryGroup[] = model.groups.map((group) => {
      const headerHeight = groupHeaderHeight(group);
      const top = frameTops.get(group.id) ?? firstMessageY;
      const depth = frameDepth(group);
      const left = Math.min(...nodes.map((node) => node.x),...noteSpans.map(span=>span.x)) - framePadding + depth * 6;
      const right = Math.max(...nodes.map((node) => node.x + node.width),...noteSpans.map(span=>span.x+span.width)) + framePadding - depth * 6;
      return {
        id: group.id,
        label: group.label,
        ...(group.kind ? { kind: group.kind } : {}),
        headerHeight,
        ...(branchPositions.has(group.id) ? { branches: branchPositions.get(group.id)! } : {}),
        x: left,
        y: top,
        width: right - left,
        height: (frameBottoms.get(group.id) ?? top + headerHeight + 24) - top,
      };
    });
    return {
      kind: model.kind,
      nodes,
      edges,
      groups,
      width: Math.max(320, ...nodes.map((node) => node.x + node.width + CANVAS_PADDING), ...groups.map(group=>group.x+group.width+CANVAS_PADDING)) + sequenceDurationWidth(edges),
      ...(diagramText.blocks.length ? {diagramText} : {}),
      ...(model.pageBreaks ? {pageBreaks:model.pageBreaks} : {}),
      height: Math.max(240, bottom + CANVAS_PADDING) + diagramText.bottom + Math.max(0,...nodes.filter(node=>node.attributes.footbox==="true").map(node=>node.height+40)),
    };
  },
};

function layoutVerticalDirected(model: LayoutModel, context: LayoutContext, includeContainers = false): Geometry {
    const rankById = ranks(model);
    const itemGap = Math.max(64, model.minimumGap + 20);
    const rankGap = Math.max(72, model.minimumGap + 28);
    const rows = orderedLayers(model, rankById);
    const rowWidths = rows.map((items) => items.reduce((sum, item) => sum + item.size.width, 0)
      + Math.max(0, items.length - 1) * itemGap);
    const contentWidth = Math.max(420, ...rowWidths, 0);
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
          ...(item.parentId ? { parentId: item.parentId } : {}),
          attributes: item.attributes,
          x,
          y: y + (rowHeight - item.size.height) / 2,
          ...item.size,
        });
        x += item.size.width + itemGap;
      }
      const outgoing = model.connections.filter((edge) => items.some((item) => item.id === edge.from));
      const crowded = outgoing.length > items.length || outgoing.some((edge) => edge.label);
      const labelHeight = Math.max(0, ...outgoing.map((edge) => labelLayout(edge.label ?? "", wrapWidth(edge.attributes, 180), model.labelFontSize ?? 12).height));
      y += rowHeight + (crowded ? Math.max(rankGap + 16, labelHeight + 32) : Math.max(44, model.minimumGap + 12));
    });
    alignLayers(nodes, rows, model, itemGap);
    // Semantic retry blocks precede routing and label-space refinement.
    if (!context.overlay.frozen && !Object.keys(context.overlay.nodes).length) arrangeRetryBlocks(nodes, model, rankById);
    arrangeStateAxis(nodes,model);
    arrangeStateCycles(nodes,model);
    let orderedModel: LayoutModel | undefined;
    if (!context.overlay.frozen && !Object.keys(context.overlay.nodes).length) {
      arrangeBipartiteBlocks(nodes, model);
      orderedModel = orderConnectedBlocks(nodes, model, candidate => routeDeployment(nodes, candidate ?? model));
    }

    if (includeContainers) {
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
      fitContainers(nodes);
    }
    applyContinuity(nodes, context);
    if (includeContainers) {
      fitContainers(nodes.filter((node) => !context.overlay.nodes[node.id]?.manual || node.shape !== "container"));
      separateSiblingBlocks(nodes, model, context);
    }
    const edges = routeDeployment(nodes, orderedModel ?? model);
    const size = dimensions(nodes);
    return {
      kind: model.kind,
      direction: model.direction,
      nodes,
      edges,
      groups: [],
      width: Math.max(contentWidth + CANVAS_PADDING * 2, size.width),
      height: Math.max(320, y - rankGap + CANVAS_PADDING, size.height),
    };
}

export const flowchartLayout: LayoutPlugin = {
  name: "flowchart",
  layout(model, context) {
    return layoutVerticalDirected(model, context);
  },
};

export const graphLayout: LayoutPlugin = {
  name: "graph",
  layout(model, context) {
    if (model.kind === "state" && model.items.some(item => item.shape === "container" || item.attributes.connectionPoint && item.parentId)) return layoutUmlHierarchy(model, context);
    if (model.direction === "right") return hierarchicalLayout.layout(model, context);
    return layoutVerticalDirected(model, context, true);
  },
};

function routeActivity(nodes: GeometryNode[], model: LayoutModel): GeometryEdge[] {
  if (nodes.some(node => ["uml-provided-interface", "sequence-boundary", "sequence-control", "sequence-entity"].includes(node.shape)) || model.kind === "activity" || model.kind === "object" || model.kind === "class" || model.connections.some(edge=>edge.attributes?.fromPort !== undefined || edge.attributes?.toPort !== undefined || (edge.attributes?.fromMapRow ?? edge.attributes?.fromMemberIndex)!==undefined || (edge.attributes?.toMapRow ?? edge.attributes?.toMemberIndex)!==undefined)) return routeDeployment(nodes, model);
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
    const routed = { ...edge, points: chooseSmartRoute(points, source, target, nodes, routedEdges, ROUTE_CLEARANCE, true, edge.attributes, model.kind) };
    routedEdges.push(routed);
  }
  return routedEdges;
}

export const activityLayout: LayoutPlugin = {
  name: "activity",
  layout(model, context) {
    if (model.items.some(item => item.attributes.umlBlock === "lane")) return layoutSwimlanes(model, context);
    const rankById = ranks(model);
    const rows = orderedLayers(model, rankById);
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
    alignLayers(nodes, rows, model, itemGap);
    applyContinuity(nodes, context);
    const edges = routeActivity(nodes, model);
    return { kind: model.kind, nodes, edges, groups: [], width: canvasWidth, height: Math.max(620, y - 30 + CANVAS_PADDING) };
  },
};

// Orient only the ranking graph; preserve the original UML endpoints and markers.
function structuralRankingModel(model: LayoutModel): LayoutModel {
  if (model.kind !== "class" && model.kind !== "object") return model;
  const priority = (relation?: string): number =>
    relation === "inheritance" || relation === "realization" ? 2 :
    relation === "composition" || relation === "aggregation" ? 1 : 0;
  return {
    ...model,
    connections: [...model.connections]
      // Strong semantic constraints must precede associations when breaking cycles.
      .sort((a, b) => priority(b.attributes?.relation) - priority(a.attributes?.relation))
      .map(edge => priority(edge.attributes?.relation) === 2
        ? { ...edge, from: edge.to, to: edge.from }
        : edge),
  };
}

export const classLayout: LayoutPlugin = {
  name: "class",
  layout(model, context) {
    if (model.items.some(item => item.shape === "container")) return layoutUmlHierarchy(model, context);
    // Pack disconnected components independently so rank wrapping cannot insert
    // an unrelated classifier between the endpoints of a short association.
    const remaining = new Set(model.items.map(item => item.id));
    const components: Set<string>[] = [];
    while (remaining.size) {
      const component = new Set<string>();
      const pending = [remaining.values().next().value!];
      while (pending.length) {
        const id = pending.pop()!;
        if (!remaining.delete(id)) continue;
        component.add(id);
        for (const edge of model.connections) {
          if (edge.from === id && remaining.has(edge.to)) pending.push(edge.to);
          if (edge.to === id && remaining.has(edge.from)) pending.push(edge.from);
        }
      }
      components.push(component);
    }
    if (components.length > 1 && model.connections.length) {
      const automatic: LayoutContext = { overlay: { ...context.overlay, nodes: {} }, force: true, preservePinned: false };
      const nodes: GeometryNode[] = [];
      let x = CANVAS_PADDING, y = CANVAS_PADDING, rowHeight = 0;
      components.forEach((ids, index) => {
        const local = classLayout.layout({ ...model, items: model.items.filter(item => ids.has(item.id)), connections: model.connections.filter(edge => ids.has(edge.from) && ids.has(edge.to)), groups: [] }, automatic);
        const left = Math.min(...local.nodes.map(node => node.x));
        const top = Math.min(...local.nodes.map(node => node.y));
        const width = Math.max(...local.nodes.map(node => node.x + node.width)) - left;
        const height = Math.max(...local.nodes.map(node => node.y + node.height)) - top;
        if (index && index % 2 === 0) { x = CANVAS_PADDING; y += rowHeight + 68; rowHeight = 0; }
        nodes.push(...local.nodes.map(node => ({ ...node, x: node.x - left + x, y: node.y - top + y })));
        x += width + 68;
        rowHeight = Math.max(rowHeight, height);
      });
      applyContinuity(nodes, context);
      return { kind: model.kind, nodes, edges: routeActivity(nodes, model), groups: [], ...dimensions(nodes) };
    }
    // Independent structural families form vertical columns; dependencies link
    // those columns without adding ranks to their inheritance/ownership chains.
    if (model.kind === "class") {
      const strong = new Set(["inheritance", "realization", "composition", "aggregation"]);
      const structural = new Set(model.connections.filter(e=>strong.has(e.attributes?.relation ?? "")).flatMap(e=>[e.from,e.to]));
      const parents = new Map(model.items.map(item=>[item.id,item.id]));
      const root = (id:string):string => { let current=id; while(parents.get(current)!==current) current=parents.get(current)!; return current; };
      for(const edge of model.connections) {
        if(!parents.has(edge.from)||!parents.has(edge.to))continue;
        if(edge.attributes?.relation!=="dependency" || (!structural.has(edge.from)&&!structural.has(edge.to))) parents.set(root(edge.to),root(edge.from));
      }
      const families = new Map<string,Set<string>>();
      for(const item of model.items){const key=root(item.id);const group=families.get(key)??new Set<string>();group.add(item.id);families.set(key,group);}
      const groups=[...families.values()];
      const strongGroups=groups.filter(ids=>model.connections.some(e=>ids.has(e.from)&&ids.has(e.to)&&strong.has(e.attributes?.relation??"")));
      // Wrap whole families rather than splitting their structural chains.
      const maximumFamilyColumns = 4;
      const familyColumnGap = 100;
      if(strongGroups.length>=2) {
        const largest=[...strongGroups].sort((a,b)=>b.size-a.size)[0]!;
        const consumers=groups.filter(ids=>ids.size===1 && !strongGroups.includes(ids)
          && !model.connections.some(e=>ids.has(e.to)&&!ids.has(e.from))
          && strongGroups.filter(g=>model.connections.some(e=>ids.has(e.from)&&g.has(e.to))).length>=2);
        let ordered=groups.length>maximumFamilyColumns ? groups : [...strongGroups.filter(g=>g!==largest),largest,...groups.filter(g=>!strongGroups.includes(g))];
        // Small family graphs can be ordered exhaustively without involving the router.
        if(consumers.length && strongGroups.length<=maximumFamilyColumns){
          const distanceCost=(order:Set<string>[])=>model.connections.reduce((cost,e)=>{
            const from=order.findIndex(g=>g.has(e.from)),to=order.findIndex(g=>g.has(e.to));
            return cost+(from>=0&&to>=0?Math.abs(from-to):0);
          },0);
          let best=[...strongGroups],bestCost=distanceCost(best);
          const visit=(prefix:Set<string>[],remaining:Set<string>[])=>{
            if(!remaining.length){const cost=distanceCost(prefix);if(cost<bestCost){best=[...prefix];bestCost=cost;}return;}
            for(const group of remaining)visit([...prefix,group],remaining.filter(g=>g!==group));
          };
          visit([],strongGroups);
          ordered=[...best,...groups.filter(g=>!strongGroups.includes(g)&&!consumers.includes(g))];
        }
        const below=consumers.filter(g=>!ordered.includes(g));
        const automatic:LayoutContext={overlay:{...context.overlay,nodes:{}},force:true,preservePinned:false};
        const nodes:GeometryNode[]=[];
        let x=CANVAS_PADDING, y=CANVAS_PADDING, rowHeight=0;
        for(const [index,ids] of ordered.entries()){
          const local=classLayout.layout({...model,items:model.items.filter(n=>ids.has(n.id)),connections:model.connections.filter(e=>ids.has(e.from)&&ids.has(e.to)),groups:[]},automatic);
          const left=Math.min(...local.nodes.map(n=>n.x)),top=Math.min(...local.nodes.map(n=>n.y));
          const width=Math.max(...local.nodes.map(n=>n.x+n.width))-left;
          const height=Math.max(...local.nodes.map(n=>n.y+n.height))-top;
          if(index && index%maximumFamilyColumns===0){x=CANVAS_PADDING;y+=rowHeight+100;rowHeight=0;}
          nodes.push(...local.nodes.map(n=>({...n,x:n.x-left+x,y:n.y-top+y})));
          x+=width+familyColumnGap;
          rowHeight=Math.max(rowHeight,height);
        }
        if(ordered.length>maximumFamilyColumns && ordered.length%maximumFamilyColumns){
          const lastIds=new Set(ordered.slice(ordered.length-ordered.length%maximumFamilyColumns).flatMap(ids=>[...ids]));
          const last=nodes.filter(n=>lastIds.has(n.id)),other=nodes.filter(n=>!lastIds.has(n.id));
          const right=(list:GeometryNode[])=>Math.max(...list.map(n=>n.x+n.width));
          const dx=(right(other)-right(last))/2;
          for(const n of last)n.x+=dx;
        }
        for(const ids of below){
          const item=model.items.find(n=>ids.has(n.id))!;
          const targets=nodes.filter(n=>model.connections.some(e=>ids.has(e.from)&&e.to===n.id));
          // Upper receiving nodes define the shared service area; deeper links can enter from the side.
          const top=Math.min(...targets.map(n=>n.y));
          const anchors=targets.filter(n=>n.y<=top+Math.max(...targets.map(n=>n.height)));
          const centerX=anchors.reduce((sum,n)=>sum+n.x+n.width/2,0)/anchors.length;
          const x=Math.max(CANVAS_PADDING,centerX-item.size.width/2);
          const overlaps=nodes.filter(n=>n.x<x+item.size.width+32&&n.x+n.width>x-32);
          const y=Math.max(CANVAS_PADDING,...overlaps.map(n=>n.y+n.height))+68;
          nodes.push({...item,...item.size,x,y});
        }
        if(below.length>1 && strongGroups.length<=4 && !model.connections.some(e=>e.attributes?.layoutDirection)){
          const chain=nodes.filter(n=>largest.has(n.id)).sort((a,b)=>a.y-b.y||a.x-b.x);
          const chainEdges=model.connections.filter(e=>largest.has(e.from)&&largest.has(e.to));
          const ranking=structuralRankingModel({...model,connections:chainEdges}).connections;
          if(chainEdges.length===chain.length-1 && chain.every(n=>ranking.filter(e=>e.from===n.id).length<=1&&ranking.filter(e=>e.to===n.id).length<=1)){
            const candidates=[false,true].map(horizontal=>{
              const candidate=nodes.map(n=>({...n}));let x=CANVAS_PADDING;
              for(const original of chain){const n=candidate.find(n=>n.id===original.id)!;if(horizontal){n.x=x;n.y=CANVAS_PADDING;x+=n.width+72;}}
              const topNodes=candidate.filter(n=>largest.has(n.id));
              const topBottom=Math.max(...topNodes.map(n=>n.y+n.height));
              x=CANVAS_PADDING;
              for(const ids of ordered.filter(g=>g!==largest)){
                const members=candidate.filter(n=>ids.has(n.id));
                const left=Math.min(...members.map(n=>n.x)),top=Math.min(...members.map(n=>n.y));
                for(const n of members){n.x+=x-left;n.y+=topBottom+90-top;}
                x=Math.max(...members.map(n=>n.x+n.width))+100;
              }
              const consumerIds=new Set(below.flatMap(g=>[...g]));
              const bottom=Math.max(...candidate.filter(n=>!consumerIds.has(n.id)).map(n=>n.y+n.height))+90;
              x=CANVAS_PADDING;
              for(const ids of below){const n=candidate.find(n=>ids.has(n.id))!;n.x=x;n.y=bottom;x+=n.width+100;}
              return candidate;
            });
            const supports=ordered.filter(g=>g!==largest);
            if(supports.length===2&&below.length===2&&supports.every(g=>g.size===2)){
              const outward=supports.filter(g=>model.connections.some(e=>g.has(e.from)&&largest.has(e.to)));
              if(outward.length===1){
                const candidate=nodes.map(n=>({...n})),leftGroup=outward[0]!,bottomGroup=supports.find(g=>g!==leftGroup)!;
                let x=CANVAS_PADDING;
                for(const original of chain){const n=candidate.find(n=>n.id===original.id)!;n.x=x;n.y=CANVAS_PADDING;x+=n.width+72;}
                const topBottom=Math.max(...candidate.filter(n=>largest.has(n.id)).map(n=>n.y+n.height));
                const left=candidate.filter(n=>leftGroup.has(n.id)).sort((a,b)=>Number(model.connections.some(e=>e.from===b.id&&largest.has(e.to)))-Number(model.connections.some(e=>e.from===a.id&&largest.has(e.to))));
                let y=topBottom+90;for(const n of left){n.x=CANVAS_PADDING;n.y=y;y+=n.height+80;}
                const innerX=CANVAS_PADDING+Math.max(...left.map(n=>n.width))+140;
                const inner=candidate.find(n=>below[1]!.has(n.id))!;inner.x=innerX;inner.y=left[1]!.y;
                const lowerY=Math.max(y,inner.y+inner.height+90);
                const lower=candidate.find(n=>below[0]!.has(n.id))!;lower.x=CANVAS_PADDING;lower.y=lowerY;
                const bottom=candidate.filter(n=>bottomGroup.has(n.id)).sort((a,b)=>model.connections.filter(e=>e.to===b.id&&!bottomGroup.has(e.from)).length-model.connections.filter(e=>e.to===a.id&&!bottomGroup.has(e.from)).length);
                x=innerX;for(const n of bottom){n.x=x;n.y=lowerY;x+=n.width+90;}
                candidates.push(candidate);
              }
            }
            const cost=(candidate:GeometryNode[])=>model.connections.reduce((sum,e)=>{
              const a=candidate.find(n=>n.id===e.from)!,b=candidate.find(n=>n.id===e.to)!;
              return sum+Math.abs(a.x+a.width/2-b.x-b.width/2)+Math.abs(a.y+a.height/2-b.y-b.height/2);
            },0);
            const best=candidates.sort((a,b)=>cost(a)-cost(b))[0]!;
            for(const n of nodes){const chosen=best.find(c=>c.id===n.id)!;n.x=chosen.x;n.y=chosen.y;}
          }
        }
        applyContinuity(nodes,context);
        return {kind:model.kind,nodes,edges:routeActivity(nodes,model),groups:[],...dimensions(nodes)};
      }
      const fan = model.items.map(parent => ({parent, edges:model.connections.filter(e=>e.to===parent.id && ["inheritance","realization"].includes(e.attributes?.relation??""))}))
        .find(({edges})=>new Set(edges.map(e=>e.from)).size>=3);
      if(fan){
        const children=model.items.filter(n=>fan.edges.some(e=>e.from===n.id));
        const ids=new Set([fan.parent.id,...children.map(n=>n.id)]);
        const clients=model.items.filter(n=>!ids.has(n.id));
        // Only a simple fan plus consumers; complex chains keep the general layout.
        if(model.connections.every(e=>fan.edges.includes(e) || clients.some(n=>n.id===e.from)&&children.some(n=>n.id===e.to)&&e.attributes?.relation==="dependency")){
          const rows=[ [fan.parent], children, clients ].filter(row=>row.length);
          const nodes:GeometryNode[]=[];
          let y=CANVAS_PADDING;
          for(const row of rows){
            for(let offset=0;offset<row.length;offset+=6){
              const slice=row.slice(offset,offset+6);let x=CANVAS_PADDING;
              for(const item of slice){nodes.push({...item,...item.size,x,y});x+=item.size.width+58;}
              y+=Math.max(...slice.map(n=>n.size.height))+110;
            }
          }
          applyContinuity(nodes,context);
          return {kind:model.kind,nodes,edges:routeActivity(nodes,model),groups:[],...dimensions(nodes)};
        }
      }
    }
    const rankingModel = structuralRankingModel(model);
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

function layoutUmlHierarchy(model: LayoutModel, context: LayoutContext): Geometry {
  const itemMap = byId(model.items);
  const automatic: LayoutContext = { overlay: { ...context.overlay, nodes: {} }, force: true, preservePinned: false };
  const build = (parent?: string): GeometryNode[] => {
    const children = model.items.filter(item => item.parentId === parent && !(item.attributes.connectionPoint && item.parentId));
    const subtrees = new Map<string, GeometryNode[]>();
    const blocks = children.map(item => {
      if (item.shape !== "container") return item;
      const descendants = build(item.id);
      const memberInset = memberContainerInset(descendants.filter(node => node.parentId === item.id));
      const extra = memberInset > 26 ? 24 : 0;
      for (const node of descendants) node.x += extra;
      subtrees.set(item.id, descendants);
      const size = { width: Math.max(0, ...descendants.map(node => node.x + node.width)) + 28 + extra, height: Math.max(0, ...descendants.map(node => node.y + node.height)) + 28 };
      const header = item.size.headerHeight ?? 32;
      return { ...item, shape: "rectangle", size: { width: Math.max(item.size.width, size.width), height: Math.max(item.size.height, size.height + header), headerHeight: header } };
    });
    const branch = (id: string): string | undefined => {
      let item = itemMap.get(id);
      while (item && item.parentId !== parent) item = item.parentId ? itemMap.get(item.parentId) : undefined;
      return item?.id;
    };
    const connections = model.connections.flatMap(edge => {
      const from = branch(edge.from), to = branch(edge.to);
      return from && to && from !== to ? [{ ...edge, from, to }] : [];
    });
    const local = { ...model, items: blocks, connections, groups: [] };
    const regions = parent && children.length > 0 && children.every(item => item.attributes.umlBlock === "region");
    const regionRows = regions && itemMap.get(parent!)?.attributes.regions === 'rows';
    const placed: GeometryNode[] = regions ? blocks.map((item, index) => ({
      ...item, ...item.size,
      ...(regionRows ? {width:Math.max(...blocks.map(b=>b.size.width))} : {height:Math.max(...blocks.map(b=>b.size.height))}),
      attributes: {...item.attributes,regionDivider:index ? 'true' : 'false',regionDirection:regionRows ? 'rows' : 'columns'},
      x:28+(regionRows ? 0 : blocks.slice(0,index).reduce((x,b)=>x+b.size.width+32,0)),
      y:28+(regionRows ? blocks.slice(0,index).reduce((y,b)=>y+b.size.height+32,0) : 0),
    })) : layoutVerticalDirected(structuralRankingModel(local), automatic).nodes;
    // Two namespaces with a one-way dependency read as adjacent vertical
    // columns. Align the receiving classifier below the sender's side port.
    if(model.kind==='class' && children.every(item=>item.shape==='container')){
      const move=(id:string,x:number,y:number)=>{const n=placed.find(n=>n.id===id)!;n.x=x;n.y=y;};
      arrangeSharedBlocks(placed,model,branch,move,(id,direction)=>{
        const members=subtrees.get(id)??[],block=placed.find(n=>n.id===id)!;
        if(members.some(n=>n.shape==='container'||n.attributes.order||n.attributes.row||n.attributes.column||n.attributes.place))return;
        let x=28,y=28;
        const incomingHeight=(n:GeometryNode)=>{
          const sources=model.connections.filter(e=>e.to===n.id&&branch(e.from)!==id).flatMap(e=>{
            const owner=placed.find(p=>p.id===branch(e.from));
            const source=owner&&subtrees.get(owner.id)?.find(p=>p.id===e.from);
            return source&&owner?[owner.y+source.y]:[];
          });
          return sources.length?sources.reduce((a,b)=>a+b,0)/sources.length:Infinity;
        };
        const sorted=direction==='row'?[...members].sort((a,b)=>incomingHeight(a)-incomingHeight(b)):members;
        for(const n of sorted){n.x=x;n.y=y;if(direction==='row')x+=n.width+64;else y+=n.height+64;}
        const minimum=itemMap.get(id)!.size;
        block.width=Math.max(minimum.width,...members.map(n=>n.x+n.width+28));
        block.height=Math.max(minimum.height,...members.map(n=>n.y+n.height+28+(block.headerHeight??32)));
      });
      arrangeThreeBlocks(placed,model,branch,move);
    }
    if (model.kind === "class" && children.length === 2 && children.every(item => item.shape === "container")
      && connections.length > 0 && connections.every(edge => edge.attributes?.relation === "dependency")
      && connections.every(edge => edge.from === connections[0]!.from && edge.to === connections[0]!.to)) {
      const edge = model.connections.find(edge => branch(edge.from) === connections[0]!.from && branch(edge.to) === connections[0]!.to)!;
      const sourceBlock = placed.find(node => node.id === branch(edge.from))!;
      const targetBlock = placed.find(node => node.id === branch(edge.to))!;
      const source = subtrees.get(sourceBlock.id)?.find(node => node.id === edge.from);
      const target = subtrees.get(targetBlock.id)?.find(node => node.id === edge.to);
      if (source && target) {
        sourceBlock.x = 28; sourceBlock.y = 28;
        targetBlock.x = sourceBlock.x + sourceBlock.width + 64;
        targetBlock.y = sourceBlock.y + (sourceBlock.headerHeight ?? 32) + source.y + source.height / 2
          + 32 - (targetBlock.headerHeight ?? 32) - target.y;
        if (targetBlock.y < 28) { sourceBlock.y += 28 - targetBlock.y; targetBlock.y = 28; }
      }
    }
    const result: GeometryNode[] = [];
    if(model.kind==='state'&&!regions&&!connections.some(e=>e.attributes?.layoutDirection)){
      for(const owner of placed.filter(n=>itemMap.get(n.id)?.shape==='container')){
        const returns=placed.filter(n=>n.id!==owner.id&&['rounded','uml-state'].includes(n.shape)
          &&connections.some(e=>e.from===n.id&&e.to===owner.id)&&connections.some(e=>e.to===n.id&&e.from===owner.id));
        let y=owner.y+Math.min(140,owner.height/3);
        for(const n of returns){n.x=Math.max(...placed.filter(p=>!returns.includes(p)).map(p=>p.x+p.width))+120;n.y=y;y+=n.height+90;}
      }
    }
    for (const node of placed) {
      const original = itemMap.get(node.id)!;
      result.push({ ...node, shape: original.shape });
      for (const child of subtrees.get(node.id) ?? []) result.push({ ...child, x: child.x + node.x, y: child.y + node.y + (node.headerHeight ?? 32) });
    }
    return result;
  };
  const nodes = build();
  for (const point of model.items.filter(item => item.attributes.connectionPoint && item.parentId)) nodes.push({ ...point, ...point.size, x:0, y:0 });
  applyContinuity(nodes, context);
  return { kind: model.kind, direction: "down", nodes, edges: routeDeployment(nodes, model), groups: [], ...dimensions(nodes) };
}

function layoutSwimlanes(model: LayoutModel, context: LayoutContext): Geometry {
  const lanes = model.items.filter(item => item.attributes.umlBlock === "lane");
  const rank = ranks(model);
  const normal = model.items.filter(item => item.shape !== "container");
  const laneIds: Array<string | undefined> = [...(normal.some(item => !item.parentId) ? [undefined] : []), ...lanes.map(item => item.id)];
  const heights = new Map<number, number>();
  for (const item of normal) heights.set(rank.get(item.id) ?? 0, Math.max(heights.get(rank.get(item.id) ?? 0) ?? 0, item.size.height));
  const ranksInUse = [...heights.keys()].sort((a,b) => a-b);
  const top = (r: number) => 80 + ranksInUse.filter(value => value < r).reduce((y,value) => y + heights.get(value)! + 72,0);
  const bottom = 108 + ranksInUse.reduce((y,value) => y + heights.get(value)! + 72,0);
  const nodes: GeometryNode[] = [];
  let x = 28;
  for (const id of laneIds) {
    const members = normal.filter(item => item.parentId === id);
    const width = Math.max(180, ...ranksInUse.map(r => members.filter(item => rank.get(item.id) === r).reduce((w,item) => w + item.size.width + 36, 28)));
    if (id) { const lane = lanes.find(item => item.id === id)!; nodes.push({ ...lane, x, y: 28, width, height: bottom - 28 }); }
    for (const r of ranksInUse) {
      const row = members.filter(item => rank.get(item.id) === r);
      let left = x + (width - row.reduce((w,item) => w + item.size.width,0) - Math.max(0,row.length-1)*36)/2;
      for (const item of row) { nodes.push({ ...item, ...item.size, x: left, y: top(r) }); left += item.size.width + 36; }
    }
    x += width + 24;
  }
  applyContinuity(nodes, context);
  return { kind: model.kind, direction: "down", nodes, edges: routeDeployment(nodes, model), groups: [], ...dimensions(nodes) };
}

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

export const builtInLayouts: LayoutPlugin[] = [hierarchicalLayout, compactLayout, sequenceLayout, flowchartLayout, graphLayout, activityLayout, classLayout, slideLayout];

export function rerouteGeometry(geometry: Geometry): void {
  if(geometry.kind === "timing") {rerouteTiming(geometry);return;}
  const notes = geometry.nodes.filter(node => node.attributes.annotationTarget);
  if (notes.length) {
    const links = geometry.edges.filter(edge => edge.attributes?.annotation);
    geometry.nodes = geometry.nodes.filter(node => !node.attributes.annotationTarget || node.attributes.associationClass);
    geometry.edges = geometry.edges.filter(edge => !edge.attributes?.annotation);
    for (const note of notes) if (note.attributes.associationClass) delete note.attributes.annotationTarget;
    rerouteGeometry(geometry);
    for (const note of notes) if (note.attributes.associationClass) note.attributes.annotationTarget = note.attributes.associationEdge!;
    for (const note of notes) {
      const targetNode = geometry.nodes.find(node => node.id === note.attributes.annotationTarget);
      const targetEdge = geometry.edges.find(edge => edge.id === note.attributes.annotationTarget);
      const link = links.find(edge => edge.to === note.id);
      if (link) {
        const anchor = targetNode ? annotationAnchor(targetNode, note.attributes.annotationMember) : (targetEdge ? routeMidpoint(targetEdge.points) : link.points[0]!);
        const side=note.attributes.annotationSide;
        const left=side==='left',vertical=side==='top'||side==='bottom';
        if(left && targetNode)anchor.x=targetNode.x;
        if(vertical && targetNode){anchor.x=targetNode.x+targetNode.width/2;anchor.y=targetNode.y+(side==='bottom'?targetNode.height:0);}
        link.points = [anchor, { x: note.x+(vertical?note.width/2:left?note.width:0), y: note.y+(side==='top'?note.height:side==='bottom'?0:note.height/2) }];
      }
    }
    geometry.nodes.push(...notes.filter(note => !geometry.nodes.some(n => n.id === note.id))); geometry.edges.push(...links);
    const size = dimensions(geometry.nodes, geometry.groups);
    geometry.width = Math.max(geometry.width, size.width); geometry.height = Math.max(geometry.height, size.height);
    return;
  }
  if (geometry.kind === "sequence") {
    for(const [index,edge] of geometry.edges.entries()){
      if(!edge.attributes?.fragmentHeight)continue;
      const ids=(edge.attributes.participants ?? '').split(',');
      const span=sequenceFragmentSpan(geometry.nodes.filter(node=>ids.includes(node.id)),edge.attributes.messageKind);
      const height=Math.max(36,labelLayout(edge.attributes.fragmentLabel ?? '',Math.max(40,span.width-52),Number(edge.attributes.fragmentFontSize ?? 12),edge.attributes.fragmentFontFamily || undefined).lines.length*16+22);
      const growth=height-Number(edge.attributes.fragmentHeight);
      if(growth===0)continue;
      edge.attributes.fragmentHeight=String(height);
      const y=edge.points[0]!.y;
      for(const later of geometry.edges.slice(index+1))for(const point of later.points)point.y+=growth;
      for(const group of geometry.groups){
        if(group.y>y)group.y+=growth;else if(group.y+group.height>y)group.height+=growth;
        for(const branch of group.branches ?? [])if(branch.y>y)branch.y+=growth;
      }
      for(const node of geometry.nodes){
        const events=JSON.parse(node.attributes.sequencePositions ?? '[]') as Array<{kind:string;y:number}>;
        for(const event of events)if(event.y>y)event.y+=growth;
        if(events.length)node.attributes.sequencePositions=JSON.stringify(events);
        const created=events.find(event=>event.kind==='create');
        if(created && !node.attributes.branchLifetime)node.y=created.y-node.height/2;
      }
      geometry.height+=growth;
    }
    const map = byId(geometry.nodes);
    for (const edge of geometry.edges) {
      const source = map.get(edge.from) ?? (edge.attributes?.external === "incoming" ? map.get(edge.to) : undefined);
      const target = map.get(edge.to) ?? (edge.attributes?.external === "outgoing" ? map.get(edge.from) : undefined);
      const y = edge.points[0]?.y ?? 0;
      if (source && target) {
        const fromX = edge.attributes?.external === "incoming" ? (edge.attributes.externalSide === "right" ? Math.max(...geometry.nodes.map(n=>n.x+n.width))+24 : Math.min(...geometry.nodes.map(n=>n.x))-24) : source.x + source.width / 2;
        const toX = edge.attributes?.external === "outgoing" ? (edge.attributes.externalSide === "left" ? Math.min(...geometry.nodes.map(n=>n.x))-24 : Math.max(...geometry.nodes.map(n=>n.x+n.width))+24) : target.x + target.width / 2;
        const receiveOffset=Number(edge.attributes?.receiveOffset ?? 0);
        edge.points = fromX === toX
          ? [{ x: fromX, y }, { x: fromX + 42, y }, { x: fromX + 42, y: y + 28 + receiveOffset }, { x: fromX, y: y + 28 + receiveOffset }]
          : [{ x: fromX, y }, { x: toX, y:y+receiveOffset }];
        if (edge.attributes?.messageKind === "create") edge.points[edge.points.length-1]!.x = fromX < target.x ? target.x : target.x + target.width;
      }
    }
    const spans=geometry.edges.filter(edge=>edge.attributes?.messageKind==='note').map(edge=>sequenceFragmentSpan(geometry.nodes.filter(node=>(edge.attributes!.participants ?? '').split(',').includes(node.id)),'note'));
    const depths=geometry.groups.map(group=>geometry.groups.filter(other=>other!==group && other.y<group.y && other.y+other.height>=group.y+group.height).length);
    const padding=14+Math.max(0,...depths)*6;
    const minX=Math.min(...geometry.nodes.map(node=>node.x),...spans.map(span=>span.x));
    const maxX=Math.max(...geometry.nodes.map(node=>node.x+node.width),...spans.map(span=>span.x+span.width));
    geometry.groups.forEach((group,index)=>{group.x=minX-padding+depths[index]!*6;group.width=maxX+padding-depths[index]!*6-group.x;});
    geometry.width = Math.max(320, ...geometry.nodes.map((node) => node.x + node.width + CANVAS_PADDING), ...geometry.groups.map(group=>group.x+group.width+CANVAS_PADDING)) + sequenceDurationWidth(geometry.edges);
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
    direction: geometry.direction ?? (geometry.kind === "flowchart" ? "down" : "right"),
    minimumGap: 44,
  };
  geometry.edges = routeDeployment(geometry.nodes, model);
  const size = dimensions(geometry.nodes, geometry.groups);
  geometry.width = size.width;
  geometry.height = size.height;
}

