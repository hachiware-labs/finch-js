import type { GeometryNode, LayoutItem, LayoutModel } from "./types.js";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Stable crossing reduction. Explicit order and parent boundaries take precedence. */
export function orderedLayers(model: LayoutModel, ranks: Map<string, number>): LayoutItem[][] {
  const layers = [...new Set(ranks.values())].sort((a, b) => a - b).map((rank) => model.items
    .filter((item) => item.shape !== "container" && ranks.get(item.id) === rank)
    .sort((a, b) => Number(a.attributes.order ?? Number.MAX_SAFE_INTEGER) - Number(b.attributes.order ?? Number.MAX_SAFE_INTEGER)))
    .filter((layer) => layer.length);
  const edges = model.connections.filter((edge) => (ranks.get(edge.from) ?? Infinity) < (ranks.get(edge.to) ?? -Infinity));
  const positions = () => new Map(layers.flatMap((layer) => layer.map((item, index) => [item.id, index] as const)));
  const score = (): number => {
    const index = positions();
    let crossings = 0;
    for (let i = 0; i < edges.length; i += 1) {
      const first = edges[i]!;
      for (const second of edges.slice(i + 1)) {
        if (ranks.get(first.from) !== ranks.get(second.from) || ranks.get(first.to) !== ranks.get(second.to)) continue;
        if ((index.get(first.from)! - index.get(second.from)!) * (index.get(first.to)! - index.get(second.to)!) < 0) crossings += 1;
      }
    }
    return crossings;
  };
  for (let sweep = 0; sweep < 4; sweep += 1) {
    const forward = sweep % 2 === 0;
    for (const layer of forward ? layers : [...layers].reverse()) {
      if (layer.length < 2 || layer.some((item) => item.attributes.order !== undefined)) continue;
      const index = positions();
      const before = [...layer];
      const beforeScore = score();
      // Keep each parent's slots together, even when links span containers.
      for (const parent of new Set(layer.map((item) => item.parentId))) {
        const slots = layer.flatMap((item, i) => item.parentId === parent ? [i] : []);
        const values = new Map(slots.map((i) => {
          const item = layer[i]!;
          const neighbors = edges.filter((edge) => forward ? edge.to === item.id : edge.from === item.id)
            .map((edge) => index.get(forward ? edge.from : edge.to)).filter((value): value is number => value !== undefined);
          return [item.id, neighbors.length ? median(neighbors) : index.get(item.id)!] as const;
        }));
        const sorted = slots.map((i) => layer[i]!).sort((a, b) => values.get(a.id)! - values.get(b.id)!);
        slots.forEach((slot, i) => { layer[slot] = sorted[i]!; });
      }
      if (score() > beforeScore) layer.splice(0, layer.length, ...before);
    }
  }
  return layers;
}

/** Infer a readable forward spine without interpreting arbitrary node names. */
export function mainPath(model: LayoutModel, ranks: Map<string, number>): Set<string> {
  if (model.kind !== "flowchart" && model.kind !== "activity") return new Set();
  const forward = model.connections.filter((edge) => (ranks.get(edge.from) ?? Infinity) < (ranks.get(edge.to) ?? -Infinity));
  const items = new Map(model.items.map((item) => [item.id, item]));
  const remaining = new Map<string, number>();
  for (const item of [...model.items].sort((a, b) => (ranks.get(b.id) ?? 0) - (ranks.get(a.id) ?? 0))) {
    remaining.set(item.id, 1 + Math.max(0, ...forward.filter((edge) => edge.from === item.id).map((edge) => remaining.get(edge.to) ?? 0)));
  }
  const roots = model.items.filter((item) => ranks.get(item.id) === 0);
  let current = roots.find((item) => item.attributes.main === "true")
    ?? [...roots].sort((a, b) => remaining.get(b.id)! - remaining.get(a.id)!)[0];
  const path = new Set<string>();
  while (current && !path.has(current.id)) {
    path.add(current.id);
    const outgoing = forward.filter((edge) => edge.from === current!.id);
    const preference = (edge: typeof forward[number]): number =>
      (items.get(edge.to)?.attributes.main === "true" ? 1000 : 0)
      + (/^(yes|true|ok|success|low risk|はい|成功|正常)$/i.test(edge.label?.trim() ?? "") ? 100 : 0)
      + (edge.dashed ? 0 : 10);
    outgoing.sort((a, b) => preference(b) - preference(a)
      || (remaining.get(b.to) ?? 0) - (remaining.get(a.to) ?? 0) || a.order - b.order);
    current = items.get(outgoing[0]?.to ?? "");
  }
  return path;
}

/** Align related centers while projecting every layer onto non-overlapping positions. */
export function alignLayers(nodes: GeometryNode[], layers: LayoutItem[][], model: LayoutModel, gap: number, horizontal = false): void {
  const map = new Map(nodes.map((node) => [node.id, node]));
  const rank = new Map(layers.flatMap((layer, i) => layer.map((item) => [item.id, i] as const)));
  const spine = mainPath(model, rank);
  const coordinate = (node: GeometryNode) => horizontal ? node.y + node.height / 2 : node.x + node.width / 2;
  const size = (node: GeometryNode) => horizontal ? node.height : node.width;
  const axis = Math.max(28, ...nodes.filter((node) => spine.has(node.id)).map(coordinate));
  for (let sweep = 0; sweep < 4; sweep += 1) {
    for (const items of sweep % 2 ? [...layers].reverse() : layers) {
      const layer = items.map((item) => map.get(item.id)).filter((node): node is GeometryNode => Boolean(node));
      if (!layer.length) continue;
      const offsets: number[] = [];
      layer.forEach((node, i) => { offsets[i] = i ? offsets[i - 1]! + size(layer[i - 1]!) / 2 + gap + size(node) / 2 : 0; });
      const desired = layer.map((node, i) => {
        const neighbors = model.connections.flatMap((edge) => {
          if ((rank.get(edge.from) ?? Infinity) >= (rank.get(edge.to) ?? -Infinity)) return [];
          const id = edge.from === node.id ? edge.to : edge.to === node.id ? edge.from : undefined;
          const neighbor = id ? map.get(id) : undefined;
          return neighbor ? [coordinate(neighbor)] : [];
        });
        return (neighbors.length ? median(neighbors) : coordinate(node)) - offsets[i]!;
      });
      // Isotonic regression gives the nearest ordered, spaced centers.
      const blocks: Array<{ start: number; end: number; sum: number; count: number }> = [];
      desired.forEach((value, i) => {
        blocks.push({ start: i, end: i, sum: value, count: 1 });
        while (blocks.length > 1) {
          const right = blocks[blocks.length - 1]!;
          const left = blocks[blocks.length - 2]!;
          if (left.sum / left.count <= right.sum / right.count) break;
          blocks.splice(-2, 2, { start: left.start, end: right.end, sum: left.sum + right.sum, count: left.count + right.count });
        }
      });
      const anchor = layer.findIndex((node) => spine.has(node.id));
      const anchorValue = axis - (offsets[anchor] ?? 0);
      for (const block of blocks) {
        for (let i = block.start; i <= block.end; i += 1) {
          let value = block.sum / block.count;
          if (anchor >= 0) value = i < anchor ? Math.min(value, anchorValue) : i > anchor ? Math.max(value, anchorValue) : anchorValue;
          const node = layer[i]!;
          const position = value + offsets[i]! - size(node) / 2;
          if (horizontal) node.y = position;
          else node.x = position;
        }
      }
      // A path can skip ranks (e.g. bypassing manual review). Keep its corridor
      // open on those ranks so side branches cannot block the straight spine.
      if (spine.size > 1 && anchor < 0 && !horizontal) {
        const spineRanks = [...spine].map((id) => rank.get(id)!);
        const layerRank = rank.get(layer[0]!.id)!;
        if (layerRank > Math.min(...spineRanks) && layerRank < Math.max(...spineRanks)) {
          const split = layer.filter((node) => coordinate(node) <= axis).length;
          let boundary = axis - gap / 2;
          for (let i = split - 1; i >= 0; i -= 1) {
            const node = layer[i]!;
            node.x = Math.min(node.x, boundary - node.width);
            boundary = node.x - gap;
          }
          boundary = axis + gap / 2;
          for (let i = split; i < layer.length; i += 1) {
            const node = layer[i]!;
            node.x = Math.max(node.x, boundary);
            boundary = node.x + node.width + gap;
          }
        }
      }
    }
  }
  const minimum = Math.min(...nodes.filter((node) => node.shape !== "container").map((node) => horizontal ? node.y : node.x));
  if (minimum < 28) for (const node of nodes) {
    if (horizontal) node.y += 28 - minimum;
    else node.x += 28 - minimum;
  }
}

/** Place a simple retry branch beside its return interval before routing/label spacing.
 * Only an unambiguous decision -> action -> earlier spine node is moved.
 */
export function arrangeRetryBlocks(nodes: GeometryNode[], model: LayoutModel, ranks: Map<string, number>): void {
  if (model.kind !== 'flowchart' || model.direction !== 'down' || nodes.some(n => n.parentId)) return;
  if (nodes.some(n => ['order', 'row', 'column', 'place', 'layout'].some(k => n.attributes[k] !== undefined))) return;
  if (model.connections.some(e => e.attributes?.fromPort || e.attributes?.toPort || e.attributes?.layoutDirection)) return;
  const spine = mainPath(model, ranks);
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const node of nodes) {
    if (spine.has(node.id)) continue;
    const incoming = model.connections.filter(e => e.to === node.id);
    const outgoing = model.connections.filter(e => e.from === node.id);
    if (incoming.length !== 1 || outgoing.length !== 1) continue;
    const decision = byId.get(incoming[0]!.from), target = byId.get(outgoing[0]!.to);
    if (!decision || !target || decision.shape !== 'diamond' || !spine.has(decision.id) || !spine.has(target.id)) continue;
    if ((ranks.get(target.id) ?? Infinity) >= (ranks.get(decision.id) ?? -Infinity)) continue;
    const top = target.y + target.height / 2;
    const bottom = decision.y + decision.height / 2;
    const gap = Math.max(16, model.minimumGap);
    // Keep the spine fixed; do not squeeze a retry into an interval that cannot hold it.
    if (bottom - top < node.height + gap) continue;
    const y = (top + bottom - node.height) / 2;
    const left = node.x + node.width / 2 < decision.x + decision.width / 2;
    const x = left ? Math.min(node.x, decision.x - gap - node.width, target.x - gap - node.width)
      : Math.max(node.x, decision.x + decision.width + gap, target.x + target.width + gap);
    const collision = nodes.some(other => other !== node && x < other.x + other.width + gap && x + node.width + gap > other.x && y < other.y + other.height + gap && y + node.height + gap > other.y);
    if (!collision) { node.x = x; node.y = y; }
  }
}
