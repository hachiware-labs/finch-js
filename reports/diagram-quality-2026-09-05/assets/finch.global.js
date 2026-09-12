"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/utils.ts
  var SVG_NS = "http://www.w3.org/2000/svg";
  function svgElement(document, name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== void 0) element.setAttribute(key, String(value));
    }
    return element;
  }
  function center(bounds) {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }
  function createOverlay(editable = true) {
    return { version: 1, editable, nodes: {} };
  }
  function parseOverlay(value) {
    if (!value) return createOverlay();
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      throw new Error("Unsupported Finch.js layout overlay.");
    }
    const overlay = parsed;
    return {
      version: 1,
      ...overlay.diagram ? { diagram: overlay.diagram } : {},
      ...typeof overlay.editable === "boolean" ? { editable: overlay.editable } : {},
      nodes: Object.fromEntries(Object.entries(overlay.nodes ?? {}).map(([id, node]) => [id, { ...node }]))
    };
  }
  function cloneOverlay(overlay) {
    return parseOverlay(overlay);
  }
  function pathFromPoints(points) {
    if (points.length === 0) return "";
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`).join(" ");
  }
  function round(value) {
    return Math.round(value * 10) / 10;
  }
  function uniqueId(prefix, index) {
    return `${prefix}-${index + 1}`;
  }

  // src/directed-layout.ts
  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function orderedLayers(model, ranks2) {
    const layers = [...new Set(ranks2.values())].sort((a, b) => a - b).map((rank) => model.items.filter((item) => item.shape !== "container" && ranks2.get(item.id) === rank).sort((a, b) => Number(a.attributes.order ?? Number.MAX_SAFE_INTEGER) - Number(b.attributes.order ?? Number.MAX_SAFE_INTEGER))).filter((layer) => layer.length);
    const edges = model.connections.filter((edge) => (ranks2.get(edge.from) ?? Infinity) < (ranks2.get(edge.to) ?? -Infinity));
    const positions = () => new Map(layers.flatMap((layer) => layer.map((item, index) => [item.id, index])));
    const score = () => {
      const index = positions();
      let crossings = 0;
      for (let i = 0; i < edges.length; i += 1) {
        const first = edges[i];
        for (const second of edges.slice(i + 1)) {
          if (ranks2.get(first.from) !== ranks2.get(second.from) || ranks2.get(first.to) !== ranks2.get(second.to)) continue;
          if ((index.get(first.from) - index.get(second.from)) * (index.get(first.to) - index.get(second.to)) < 0) crossings += 1;
        }
      }
      return crossings;
    };
    for (let sweep = 0; sweep < 4; sweep += 1) {
      const forward = sweep % 2 === 0;
      for (const layer of forward ? layers : [...layers].reverse()) {
        if (layer.length < 2 || layer.some((item) => item.attributes.order !== void 0)) continue;
        const index = positions();
        const before = [...layer];
        const beforeScore = score();
        for (const parent of new Set(layer.map((item) => item.parentId))) {
          const slots = layer.flatMap((item, i) => item.parentId === parent ? [i] : []);
          const values = new Map(slots.map((i) => {
            const item = layer[i];
            const neighbors = edges.filter((edge) => forward ? edge.to === item.id : edge.from === item.id).map((edge) => index.get(forward ? edge.from : edge.to)).filter((value) => value !== void 0);
            return [item.id, neighbors.length ? median(neighbors) : index.get(item.id)];
          }));
          const sorted = slots.map((i) => layer[i]).sort((a, b) => values.get(a.id) - values.get(b.id));
          slots.forEach((slot, i) => {
            layer[slot] = sorted[i];
          });
        }
        if (score() > beforeScore) layer.splice(0, layer.length, ...before);
      }
    }
    return layers;
  }
  function mainPath(model, ranks2) {
    if (model.kind !== "flowchart" && model.kind !== "activity") return /* @__PURE__ */ new Set();
    const forward = model.connections.filter((edge) => (ranks2.get(edge.from) ?? Infinity) < (ranks2.get(edge.to) ?? -Infinity));
    const items = new Map(model.items.map((item) => [item.id, item]));
    const remaining = /* @__PURE__ */ new Map();
    for (const item of [...model.items].sort((a, b) => (ranks2.get(b.id) ?? 0) - (ranks2.get(a.id) ?? 0))) {
      remaining.set(item.id, 1 + Math.max(0, ...forward.filter((edge) => edge.from === item.id).map((edge) => remaining.get(edge.to) ?? 0)));
    }
    const roots = model.items.filter((item) => ranks2.get(item.id) === 0);
    let current = roots.find((item) => item.attributes.main === "true") ?? [...roots].sort((a, b) => remaining.get(b.id) - remaining.get(a.id))[0];
    const path = /* @__PURE__ */ new Set();
    while (current && !path.has(current.id)) {
      path.add(current.id);
      const outgoing = forward.filter((edge) => edge.from === current.id);
      const preference = (edge) => (items.get(edge.to)?.attributes.main === "true" ? 1e3 : 0) + (/^(yes|true|ok|success|low risk|はい|成功|正常)$/i.test(edge.label?.trim() ?? "") ? 100 : 0) + (edge.dashed ? 0 : 10);
      outgoing.sort((a, b) => preference(b) - preference(a) || (remaining.get(b.to) ?? 0) - (remaining.get(a.to) ?? 0) || a.order - b.order);
      current = items.get(outgoing[0]?.to ?? "");
    }
    return path;
  }
  function alignLayers(nodes, layers, model, gap, horizontal = false) {
    const map = new Map(nodes.map((node) => [node.id, node]));
    const rank = new Map(layers.flatMap((layer, i) => layer.map((item) => [item.id, i])));
    const spine = mainPath(model, rank);
    const coordinate2 = (node) => horizontal ? node.y + node.height / 2 : node.x + node.width / 2;
    const size = (node) => horizontal ? node.height : node.width;
    const axis = Math.max(28, ...nodes.filter((node) => spine.has(node.id)).map(coordinate2));
    for (let sweep = 0; sweep < 4; sweep += 1) {
      for (const items of sweep % 2 ? [...layers].reverse() : layers) {
        const layer = items.map((item) => map.get(item.id)).filter((node) => Boolean(node));
        if (!layer.length) continue;
        const offsets = [];
        layer.forEach((node, i) => {
          offsets[i] = i ? offsets[i - 1] + size(layer[i - 1]) / 2 + gap + size(node) / 2 : 0;
        });
        const desired = layer.map((node, i) => {
          const neighbors = model.connections.flatMap((edge) => {
            if ((rank.get(edge.from) ?? Infinity) >= (rank.get(edge.to) ?? -Infinity)) return [];
            const id = edge.from === node.id ? edge.to : edge.to === node.id ? edge.from : void 0;
            const neighbor = id ? map.get(id) : void 0;
            return neighbor ? [coordinate2(neighbor)] : [];
          });
          return (neighbors.length ? median(neighbors) : coordinate2(node)) - offsets[i];
        });
        const blocks = [];
        desired.forEach((value, i) => {
          blocks.push({ start: i, end: i, sum: value, count: 1 });
          while (blocks.length > 1) {
            const right = blocks[blocks.length - 1];
            const left = blocks[blocks.length - 2];
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
            const node = layer[i];
            const position = value + offsets[i] - size(node) / 2;
            if (horizontal) node.y = position;
            else node.x = position;
          }
        }
        if (spine.size > 1 && anchor < 0 && !horizontal) {
          const spineRanks = [...spine].map((id) => rank.get(id));
          const layerRank = rank.get(layer[0].id);
          if (layerRank > Math.min(...spineRanks) && layerRank < Math.max(...spineRanks)) {
            const split = layer.filter((node) => coordinate2(node) <= axis).length;
            let boundary = axis - gap / 2;
            for (let i = split - 1; i >= 0; i -= 1) {
              const node = layer[i];
              node.x = Math.min(node.x, boundary - node.width);
              boundary = node.x - gap;
            }
            boundary = axis + gap / 2;
            for (let i = split; i < layer.length; i += 1) {
              const node = layer[i];
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

  // src/edge-labels.ts
  function estimatedTextWidth(text, fontSize) {
    return [...text].reduce((width, character) => width + fontSize * (/[^\u0000-\u00ff]/.test(character) ? 1 : 0.62), 0);
  }
  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }
  function labelSegments(points) {
    const result = [];
    for (const point of points) {
      const previous = result[result.length - 1];
      if (previous?.x === point.x && previous.y === point.y) continue;
      const before = result[result.length - 2];
      if (before && previous && (before.x === previous.x && previous.x === point.x && (previous.y - before.y) * (point.y - previous.y) >= 0 || before.y === previous.y && previous.y === point.y && (previous.x - before.x) * (point.x - previous.x) >= 0)) result.pop();
      result.push(point);
    }
    return result;
  }
  function segmentHits(from, to, box) {
    if (from.x === to.x) return from.x > box.x && from.x < box.x + box.width && Math.max(from.y, to.y) > box.y && Math.min(from.y, to.y) < box.y + box.height;
    if (from.y === to.y) return from.y > box.y && from.y < box.y + box.height && Math.max(from.x, to.x) > box.x && Math.min(from.x, to.x) < box.x + box.width;
    return overlaps({ x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(from.x - to.x), height: Math.abs(from.y - to.y) }, box);
  }
  function cardinalityPoint(edge, endpoint) {
    const points = endpoint === "start" ? edge.points : [...edge.points].reverse();
    let origin = points[0] ?? { x: 0, y: 0 };
    let remaining = 18;
    for (const target of points.slice(1)) {
      const dx = target.x - origin.x;
      const dy = target.y - origin.y;
      const length = Math.hypot(dx, dy);
      if (length >= remaining && length > 0) return { x: origin.x + dx * remaining / length, y: origin.y + dy * remaining / length };
      remaining -= length;
      origin = target;
    }
    return origin;
  }
  function textBounds(point, width, fontSize) {
    return { x: point.x - width / 2 - 4, y: point.y - fontSize - 4, width: width + 8, height: fontSize * 1.3 + 8 };
  }
  function placeEdgeLabels(geometry, fontSize, measure = (text) => estimatedTextWidth(text, fontSize)) {
    const labels = /* @__PURE__ */ new Map();
    const reserved = [];
    for (const edge of geometry.edges) for (const endpoint of ["start", "end"]) {
      const text = edge.attributes?.[endpoint === "start" ? "fromCardinality" : "toCardinality"];
      if (!text) continue;
      const point = cardinalityPoint(edge, endpoint);
      reserved.push(textBounds({ x: point.x, y: point.y - 6 }, measure(text), fontSize));
    }
    const obstacles = geometry.nodes.map((node) => node.shape === "container" ? { x: node.x, y: node.y, width: node.width, height: 32 } : { x: node.x - 6, y: node.y - 6, width: node.width + 12, height: node.height + 12 });
    for (const group of geometry.groups) obstacles.push({ x: group.x, y: group.y, width: group.width, height: 24 });
    const outgoing = /* @__PURE__ */ new Map();
    for (const edge of geometry.edges) outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
    for (const edge of geometry.edges) {
      if (!edge.label || !edge.points.length) continue;
      const width = measure(edge.label);
      const route = labelSegments(edge.points);
      const branch = ["flowchart", "activity"].includes(geometry.kind) && (outgoing.get(edge.from) ?? 0) > 1;
      const candidates = [];
      let traveled = 0;
      for (let i = 1; i < route.length; i += 1) {
        const from = route[i - 1];
        const to = route[i];
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        if (!length) continue;
        const horizontal = from.y === to.y;
        const needed = horizontal ? width + 16 : fontSize * 1.3 + 16;
        const near = Math.min(0.5, (needed / 2 + 8) / length);
        for (const fraction of branch ? [near, 0.5, 1 - near] : [0.5, near, 1 - near]) {
          const x = from.x + (to.x - from.x) * fraction;
          const y = from.y + (to.y - from.y) * fraction;
          for (const side of [-1, 1]) {
            const point = horizontal ? { x, y: y + (side < 0 ? -8 : fontSize + 8) } : { x: x + side * (width / 2 + 10), y: y + fontSize * 0.35 };
            candidates.push({
              placement: { ...textBounds(point, width, fontSize), point },
              preference: Math.max(0, needed - length) * 4 + (branch ? (traveled + length * fraction) * 0.15 : horizontal ? 0 : 30) + Math.abs(fraction - 0.5) * (branch ? 0 : 10) + (side > 0 ? 1 : 0)
            });
          }
        }
        traveled += length;
      }
      const score = ({ placement: placement2, preference }) => {
        let value = preference;
        for (const box of [...obstacles, ...reserved]) if (overlaps(placement2, box)) value += 1e5;
        for (const other of geometry.edges) for (let i = 1; i < other.points.length; i += 1) {
          if (segmentHits(other.points[i - 1], other.points[i], placement2)) value += 1e3;
        }
        return value;
      };
      const ranked = candidates.map((candidate) => ({ ...candidate, score: score(candidate) })).sort((a, b) => a.score - b.score);
      const fallback = { x: edge.points[0].x, y: edge.points[0].y - 8 };
      const placement = ranked[0]?.placement ?? { ...textBounds(fallback, width, fontSize), point: fallback };
      labels.set(edge.id, placement);
      reserved.push(placement);
    }
    return { labels, bounds: reserved };
  }
  function fitVisualBounds(geometry, minimum, labels, padding = 28) {
    const boxes = [...geometry.nodes, ...geometry.groups, ...labels];
    for (const edge of geometry.edges) for (const point of edge.points) boxes.push({ ...point, width: 0, height: 0 });
    const left = Math.min(0, ...boxes.map((box) => box.x - padding));
    const top = Math.min(0, ...boxes.map((box) => box.y - padding));
    const right = Math.max(minimum.width, ...boxes.map((box) => box.x + box.width + padding));
    const bottom = Math.max(minimum.height, ...boxes.map((box) => box.y + box.height + padding));
    geometry.origin = { x: left, y: top };
    geometry.width = right - left;
    geometry.height = bottom - top;
  }

  // src/layouts.ts
  var CANVAS_PADDING = 28;
  function connectionGap(model, sourceIds, minimum) {
    return Math.max(minimum, ...model.connections.filter((edge) => sourceIds.has(edge.from) && !sourceIds.has(edge.to) && edge.label).map((edge) => estimatedTextWidth(edge.label, model.labelFontSize ?? 12) + 32));
  }
  function byId(values) {
    return new Map(values.map((value) => [value.id, value]));
  }
  function applyContinuity(nodes, context) {
    const previous = byId(context.previous?.nodes ?? []);
    for (const node of nodes) {
      const state = context.overlay.nodes[node.id];
      if (state && (!context.force || context.preservePinned && state.pinned)) {
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
  function ranks(model) {
    const items = model.items.filter((item) => item.shape !== "container");
    const itemIds = new Set(items.map((item) => item.id));
    const result = new Map(items.map((item) => [item.id, 0]));
    const adjacency = new Map(items.map((item) => [item.id, /* @__PURE__ */ new Set()]));
    const acceptedEdges = [];
    const reaches = (start, goal) => {
      const pending = [start];
      const visited = /* @__PURE__ */ new Set();
      while (pending.length) {
        const current = pending.pop();
        if (!current || visited.has(current)) continue;
        if (current === goal) return true;
        visited.add(current);
        pending.push(...adjacency.get(current) ?? []);
      }
      return false;
    };
    for (const edge of model.connections) {
      if (!itemIds.has(edge.from) || !itemIds.has(edge.to) || edge.from === edge.to) continue;
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
  function arrangeDeployment(model) {
    const rankById = ranks(model);
    const normal = model.items.filter((item) => item.shape !== "container");
    const itemMap = byId(model.items);
    const columns = /* @__PURE__ */ new Map();
    const layers = orderedLayers(model, rankById);
    for (const item of layers.flat()) {
      const rank = rankById.get(item.id) ?? 0;
      const column = columns.get(rank) ?? [];
      column.push(item);
      columns.set(rank, column);
    }
    const columnWidths = /* @__PURE__ */ new Map();
    for (const [rank, items] of columns) columnWidths.set(rank, Math.max(...items.map((item) => item.size.width)));
    const orderedRanks = [...columns.keys()].sort((a, b) => a - b);
    const bandFor = (item) => {
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
    const bandOrder = [];
    for (const item of normal) {
      const band = bandFor(item);
      if (!bandOrder.includes(band)) bandOrder.push(band);
    }
    const bandTops = /* @__PURE__ */ new Map();
    let nextBandY = CANVAS_PADDING + 28;
    for (const band of bandOrder) {
      let bandHeight = 0;
      for (const items of columns.values()) {
        const members = items.filter((item) => bandFor(item) === band);
        const height = members.reduce((sum, item) => sum + item.size.height, 0) + Math.max(0, members.length - 1) * model.minimumGap;
        bandHeight = Math.max(bandHeight, height);
      }
      bandTops.set(band, nextBandY);
      nextBandY += Math.max(46, bandHeight) + (band === "__root" ? 42 : 72);
    }
    let x = CANVAS_PADDING;
    const nodes = [];
    for (const rank of orderedRanks) {
      const items = columns.get(rank) ?? [];
      for (const band of bandOrder) {
        let y = bandTops.get(band) ?? CANVAS_PADDING;
        for (const item of items.filter((candidate) => bandFor(candidate) === band)) {
          nodes.push({
            id: item.id,
            label: item.label,
            shape: item.shape,
            ...item.parentId ? { parentId: item.parentId } : {},
            attributes: item.attributes,
            x,
            y,
            ...item.size
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
        ...item.parentId ? { parentId: item.parentId } : {},
        attributes: item.attributes,
        x: CANVAS_PADDING,
        y: CANVAS_PADDING,
        ...item.size
      });
    }
    return nodes;
  }
  function fitContainers(nodes) {
    const nodeMap = byId(nodes);
    const containers = nodes.filter((node) => node.shape === "container");
    const depth = (node) => {
      let count = 0;
      let parent = node.parentId ? nodeMap.get(node.parentId) : void 0;
      while (parent && count < nodes.length) {
        count += 1;
        parent = parent.parentId ? nodeMap.get(parent.parentId) : void 0;
      }
      return count;
    };
    containers.sort((a, b) => depth(b) - depth(a));
    for (const container of containers) {
      fitContainer(container, nodes);
    }
  }
  function fitContainer(container, nodes) {
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
  function resizeAncestorContainers(nodes, movedIds, minimumSizes = /* @__PURE__ */ new Map()) {
    const nodeMap = byId(nodes);
    const ancestors = /* @__PURE__ */ new Set();
    for (const id of movedIds) {
      let parentId = nodeMap.get(id)?.parentId;
      while (parentId) {
        const parent = nodeMap.get(parentId);
        if (!parent || parent.shape !== "container") break;
        ancestors.add(parent.id);
        parentId = parent.parentId;
      }
    }
    const depth = (node) => {
      let value = 0;
      let parent = node.parentId ? nodeMap.get(node.parentId) : void 0;
      while (parent && value < nodes.length) {
        value += 1;
        parent = parent.parentId ? nodeMap.get(parent.parentId) : void 0;
      }
      return value;
    };
    const changed = [];
    const containers = [...ancestors].map((id) => nodeMap.get(id)).filter((node) => Boolean(node)).sort((left, right) => depth(right) - depth(left));
    for (const container of containers) {
      const children = nodes.filter((node) => node.parentId === container.id);
      if (!children.length) continue;
      const desiredLeft = Math.min(...children.map((node) => node.x)) - 26;
      const desiredTop = Math.min(...children.map((node) => node.y)) - 42;
      const desiredRight = Math.max(...children.map((node) => node.x + node.width)) + 26;
      const desiredBottom = Math.max(...children.map((node) => node.y + node.height)) + 26;
      const minimum = minimumSizes.get(container.id) ?? container;
      const nextLeft = desiredLeft;
      const nextTop = desiredTop;
      const nextRight = nextLeft + Math.max(minimum.width, desiredRight - desiredLeft);
      const nextBottom = nextTop + Math.max(minimum.height, desiredBottom - desiredTop);
      if (nextLeft === container.x && nextTop === container.y && nextRight === container.x + container.width && nextBottom === container.y + container.height) continue;
      container.x = nextLeft;
      container.y = nextTop;
      container.width = nextRight - nextLeft;
      container.height = nextBottom - nextTop;
      changed.push(container.id);
    }
    return changed;
  }
  function resetContainerSize(container, model) {
    const measured = model.items.find((item) => item.id === container.id)?.size;
    if (!measured) return;
    container.width = measured.width;
    container.height = measured.height;
  }
  function layoutNumber(node, name, minimum = 1) {
    const value = Number(node.attributes[name]);
    return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : void 0;
  }
  function orderedForLayout(nodes) {
    return nodes.map((node, index) => ({ node, index, order: layoutNumber(node, "order", 0) })).sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || left.index - right.index).map(({ node }) => node);
  }
  function arrangeBlocks(children, layout, container, gap, move) {
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
    const occupied = /* @__PURE__ */ new Set();
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
    const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(0, ...cells.filter((cell) => cell.column === column).map((cell) => cell.node.width)));
    const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(0, ...cells.filter((cell) => cell.row === row).map((cell) => cell.node.height)));
    const columnOffsets = columnWidths.map((_, column) => originX + columnWidths.slice(0, column).reduce((sum, width) => sum + width, 0) + column * gap);
    const rowOffsets = rowHeights.map((_, row) => originY + rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0) + row * gap);
    for (const cell of cells) move(cell.node, columnOffsets[cell.column], rowOffsets[cell.row]);
  }
  function arrangeContainerContents(nodes, model) {
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
        arrangeBlocks(children, requestedLayout, container, model.minimumGap, (node, x2, y) => {
          node.x = x2;
          node.y = y;
        });
        continue;
      }
      if (!internalEdges.length) {
        const columns = Math.ceil(Math.sqrt(children.length));
        const cellWidth = Math.max(...children.map((node) => node.width)) + 32;
        const cellHeight = Math.max(...children.map((node) => node.height)) + 28;
        children.forEach((node, index) => {
          node.x = originX + index % columns * cellWidth;
          node.y = originY + Math.floor(index / columns) * cellHeight;
        });
        continue;
      }
      const localModel = { ...model, items: model.items.filter((item) => childIds.has(item.id)), connections: internalEdges };
      const localLayers = orderedLayers(localModel, ranks(localModel));
      let x = originX;
      for (const layer of localLayers) {
        const members = layer.map((item) => children.find((node) => node.id === item.id));
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
  function arrangeNestedContainerContents(nodes, model) {
    const nodeMap = byId(nodes);
    const depth = (node) => {
      let count = 0;
      let parent = node.parentId ? nodeMap.get(node.parentId) : void 0;
      while (parent && count < nodes.length) {
        count += 1;
        parent = parent.parentId ? nodeMap.get(parent.parentId) : void 0;
      }
      return count;
    };
    const moveBlock = (rootId, dx, dy) => {
      for (const node of nodes) {
        let current = node;
        let guard = 0;
        while (current && guard < nodes.length) {
          if (current.id === rootId) {
            node.x += dx;
            node.y += dy;
            break;
          }
          current = current.parentId ? nodeMap.get(current.parentId) : void 0;
          guard += 1;
        }
      }
    };
    const containers = nodes.filter((node) => node.shape === "container").sort((a, b) => depth(b) - depth(a));
    for (const container of containers) {
      const children = nodes.filter((node) => node.parentId === container.id);
      if (!children.some((node) => node.shape === "container")) continue;
      const requestedLayout = container.attributes.layout;
      if (requestedLayout === "row" || requestedLayout === "column" || requestedLayout === "grid") {
        arrangeBlocks(children, requestedLayout, container, Math.max(48, model.minimumGap), (node, x2, y) => {
          moveBlock(node.id, x2 - node.x, y - node.y);
        });
        resetContainerSize(container, model);
        fitContainer(container, nodes);
        continue;
      }
      const blockForNode = /* @__PURE__ */ new Map();
      for (const node of nodes) {
        let current = node;
        let guard = 0;
        while (current?.parentId && current.parentId !== container.id && guard < nodes.length) {
          current = nodeMap.get(current.parentId);
          guard += 1;
        }
        if (current?.parentId === container.id) blockForNode.set(node.id, current.id);
      }
      const childIds = new Set(children.map((node) => node.id));
      const blockRanks = new Map(children.map((node) => [node.id, 0]));
      const adjacency = new Map(children.map((node) => [node.id, /* @__PURE__ */ new Set()]));
      const acceptedEdges = [];
      const reaches = (start, goal) => {
        const pending = [start];
        const visited = /* @__PURE__ */ new Set();
        while (pending.length) {
          const current = pending.pop();
          if (!current || visited.has(current)) continue;
          if (current === goal) return true;
          visited.add(current);
          pending.push(...adjacency.get(current) ?? []);
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
  function packTopLevelGroups(nodes, model) {
    const nodeMap = byId(nodes);
    const rootGroup = "__root";
    const groupFor2 = (node) => {
      if (node.shape === "container" && !node.parentId) return node.id;
      let parentId = node.parentId;
      let topLevel;
      let guard = 0;
      while (parentId && guard < nodes.length) {
        topLevel = parentId;
        parentId = nodeMap.get(parentId)?.parentId;
        guard += 1;
      }
      return topLevel ?? rootGroup;
    };
    const groupByNode = new Map(nodes.map((node) => [node.id, groupFor2(node)]));
    const groupOrder = [];
    for (const node of nodes) {
      const group = groupByNode.get(node.id) ?? rootGroup;
      if (!groupOrder.includes(group)) groupOrder.push(group);
    }
    if (groupOrder.length < 2) return;
    const groupRanks = new Map(groupOrder.map((group) => [group, 0]));
    const groupAdjacency = new Map(groupOrder.map((group) => [group, /* @__PURE__ */ new Set()]));
    const acceptedGroupEdges = [];
    const reachesGroup = (start, goal) => {
      const pending = [start];
      const visited = /* @__PURE__ */ new Set();
      while (pending.length) {
        const current = pending.pop();
        if (!current || visited.has(current)) continue;
        if (current === goal) return true;
        visited.add(current);
        pending.push(...groupAdjacency.get(current) ?? []);
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
      const predecessorRanks = model.connections.filter((edge) => (groupByNode.get(edge.to) ?? rootGroup) === group).map((edge) => groupRanks.get(groupByNode.get(edge.from) ?? rootGroup) ?? 0);
      groupRanks.set(group, Math.max(0, ...predecessorRanks));
    }
    const membersByGroup = /* @__PURE__ */ new Map();
    for (const group of groupOrder) membersByGroup.set(group, []);
    for (const node of nodes) membersByGroup.get(groupByNode.get(node.id) ?? rootGroup)?.push(node);
    const boundsByGroup = /* @__PURE__ */ new Map();
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
  var ROUTE_CLEARANCE = 24;
  var EDGE_CLEARANCE = 12;
  var MAX_ROUTE_SEARCH_STATES = 2e4;
  function compareRouteCost(left, right) {
    return left.crossings - right.crossings || left.bends + left.congestion / EDGE_CLEARANCE - (right.bends + right.congestion / EDGE_CLEARANCE) || left.length - right.length;
  }
  function segmentCongestion(from, to, edges) {
    const horizontal = from.y === to.y;
    let congestion = 0;
    for (const edge of edges) for (let i = 1; i < edge.points.length; i += 1) {
      const a = edge.points[i - 1];
      const b = edge.points[i];
      if (horizontal ? a.y !== b.y : a.x !== b.x) continue;
      const distance = horizontal ? Math.abs(from.y - a.y) : Math.abs(from.x - a.x);
      if (distance >= EDGE_CLEARANCE) continue;
      const overlap = horizontal ? Math.min(Math.max(from.x, to.x), Math.max(a.x, b.x)) - Math.max(Math.min(from.x, to.x), Math.min(a.x, b.x)) : Math.min(Math.max(from.y, to.y), Math.max(a.y, b.y)) - Math.max(Math.min(from.y, to.y), Math.min(a.y, b.y));
      congestion += Math.max(0, overlap) * (1 - distance / EDGE_CLEARANCE);
    }
    return congestion;
  }
  function simplifyRoute(points) {
    const simplified = [];
    for (const point of points) {
      const previous = simplified[simplified.length - 1];
      if (previous && previous.x === point.x && previous.y === point.y) continue;
      simplified.push(point);
      while (simplified.length >= 3) {
        const before = simplified[simplified.length - 3];
        const middle = simplified[simplified.length - 2];
        const after = simplified[simplified.length - 1];
        const collinear = before.x === middle.x && middle.x === after.x || before.y === middle.y && middle.y === after.y;
        if (!collinear) break;
        simplified.splice(simplified.length - 2, 1);
      }
    }
    return simplified;
  }
  function segmentCrossings(from, to, edges) {
    const horizontal = from.y === to.y;
    const vertical = from.x === to.x;
    if (!horizontal && !vertical) return 0;
    let crossings = 0;
    for (const edge of edges) {
      const route = simplifyRoute(edge.points);
      for (let index = 1; index < route.length; index += 1) {
        const otherFrom = route[index - 1];
        const otherTo = route[index];
        const otherHorizontal = otherFrom.y === otherTo.y;
        const otherVertical = otherFrom.x === otherTo.x;
        if (horizontal && otherVertical) {
          const x = otherFrom.x;
          const y = from.y;
          if (x > Math.min(from.x, to.x) && x < Math.max(from.x, to.x) && y > Math.min(otherFrom.y, otherTo.y) && y < Math.max(otherFrom.y, otherTo.y)) crossings += 1;
        } else if (vertical && otherHorizontal) {
          const x = from.x;
          const y = otherFrom.y;
          if (y > Math.min(from.y, to.y) && y < Math.max(from.y, to.y) && x > Math.min(otherFrom.x, otherTo.x) && x < Math.max(otherFrom.x, otherTo.x)) crossings += 1;
        }
      }
    }
    return crossings;
  }
  function routeCost(points, edges, independentEdges) {
    const route = simplifyRoute(points);
    let crossings = 0;
    let length = 0;
    let congestion = 0;
    for (let index = 1; index < route.length; index += 1) {
      const from = route[index - 1];
      const to = route[index];
      crossings += segmentCrossings(from, to, edges);
      congestion += segmentCongestion(from, to, independentEdges);
      length += Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    }
    return { crossings, bends: Math.max(0, route.length - 2), length, congestion };
  }
  function routeHeading(from, to) {
    return { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
  }
  function followsHeading(from, to, heading) {
    const candidate = routeHeading(from, to);
    return candidate.x === heading.x && candidate.y === heading.y;
  }
  function chooseSmartRoute(points, source, target, nodes, previousEdges, clearance = ROUTE_CLEARANCE, considerEdgeCrossings = true) {
    const comparedEdges = considerEdgeCrossings ? previousEdges : [];
    const independentEdges = comparedEdges.filter((edge) => edge.from !== source.id && edge.to !== target.id);
    const obstacles = nodes.filter((node) => node.shape !== "container").map((node) => {
      const nodeClearance = node.id === source.id || node.id === target.id ? 0 : clearance;
      return {
        left: node.x - nodeClearance,
        top: node.y - nodeClearance,
        right: node.x + node.width + nodeClearance,
        bottom: node.y + node.height + nodeClearance
      };
    });
    const finite = points.length >= 2 && points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!finite) return points;
    const initialRoute = simplifyRoute(points);
    if (initialRoute.length < 2) return points;
    const start = initialRoute[0];
    const end = initialRoute[initialRoute.length - 1];
    const startHeading = routeHeading(start, initialRoute[1]);
    const endHeading = routeHeading(initialRoute[initialRoute.length - 2], end);
    if (!startHeading.x && !startHeading.y || !endHeading.x && !endHeading.y) return points;
    const segmentBlocked = (from, to) => obstacles.some((obstacle) => {
      if (from.x === to.x) {
        const top = Math.min(from.y, to.y);
        const bottom = Math.max(from.y, to.y);
        return from.x > obstacle.left && from.x < obstacle.right && top < obstacle.bottom && bottom > obstacle.top;
      }
      if (from.y === to.y) {
        const left = Math.min(from.x, to.x);
        const right = Math.max(from.x, to.x);
        return from.y > obstacle.top && from.y < obstacle.bottom && left < obstacle.right && right > obstacle.left;
      }
      return true;
    });
    const pathBlocked = (path) => path.slice(1).some((point, index) => segmentBlocked(path[index], point));
    const initialCost = routeCost(initialRoute, comparedEdges, independentEdges);
    if (!pathBlocked(initialRoute) && initialCost.crossings === 0 && initialCost.congestion === 0) return points;
    const edgeChannels = comparedEdges.flatMap((edge) => edge.points.flatMap((point) => [
      { x: point.x - EDGE_CLEARANCE, y: point.y - EDGE_CLEARANCE },
      { x: point.x + EDGE_CLEARANCE, y: point.y + EDGE_CLEARANCE }
    ]));
    const xs = [.../* @__PURE__ */ new Set([
      ...initialRoute.map((point) => point.x),
      ...obstacles.flatMap((obstacle) => [obstacle.left, obstacle.right]),
      ...edgeChannels.map((point) => point.x)
    ])].sort((a, b) => a - b);
    const ys = [.../* @__PURE__ */ new Set([
      ...initialRoute.map((point) => point.y),
      ...obstacles.flatMap((obstacle) => [obstacle.top, obstacle.bottom]),
      ...edgeChannels.map((point) => point.y)
    ])].sort((a, b) => a - b);
    const startX = xs.indexOf(start.x);
    const startY = ys.indexOf(start.y);
    const endX = xs.indexOf(end.x);
    const endY = ys.indexOf(end.y);
    if ([startX, startY, endX, endY].some((index) => index < 0)) return points;
    const emptyCost = { crossings: 0, bends: 0, length: 0, congestion: 0 };
    const queue = [{
      xIndex: startX,
      yIndex: startY,
      direction: "start",
      cost: emptyCost,
      path: [start]
    }];
    const best = /* @__PURE__ */ new Map();
    const keyFor = (xIndex, yIndex, direction) => `${xIndex}:${yIndex}:${direction}`;
    best.set(keyFor(startX, startY, "start"), emptyCost);
    const pointBlocked = (point) => obstacles.some((obstacle) => point.x > obstacle.left && point.x < obstacle.right && point.y > obstacle.top && point.y < obstacle.bottom);
    let routed;
    let searchedStates = 0;
    while (queue.length && searchedStates < MAX_ROUTE_SEARCH_STATES) {
      searchedStates += 1;
      let bestIndex = 0;
      for (let index = 1; index < queue.length; index += 1) {
        if (compareRouteCost(queue[index].cost, queue[bestIndex].cost) < 0) bestIndex = index;
      }
      const current = queue.splice(bestIndex, 1)[0];
      const stateKey = keyFor(current.xIndex, current.yIndex, current.direction);
      const known = best.get(stateKey);
      if (known && compareRouteCost(current.cost, known) > 0) continue;
      if (current.xIndex === endX && current.yIndex === endY) {
        routed = current.path;
        break;
      }
      const neighbors = [
        { xIndex: current.xIndex - 1, yIndex: current.yIndex, direction: "horizontal" },
        { xIndex: current.xIndex + 1, yIndex: current.yIndex, direction: "horizontal" },
        { xIndex: current.xIndex, yIndex: current.yIndex - 1, direction: "vertical" },
        { xIndex: current.xIndex, yIndex: current.yIndex + 1, direction: "vertical" }
      ];
      const from = { x: xs[current.xIndex], y: ys[current.yIndex] };
      for (const neighbor of neighbors) {
        if (neighbor.xIndex < 0 || neighbor.xIndex >= xs.length || neighbor.yIndex < 0 || neighbor.yIndex >= ys.length) continue;
        const to = { x: xs[neighbor.xIndex], y: ys[neighbor.yIndex] };
        if (current.direction === "start" && !followsHeading(from, to, startHeading)) continue;
        if (neighbor.xIndex === endX && neighbor.yIndex === endY && !followsHeading(from, to, endHeading)) continue;
        if (pointBlocked(to) || segmentBlocked(from, to)) continue;
        const cost = {
          crossings: current.cost.crossings + segmentCrossings(from, to, comparedEdges),
          bends: current.cost.bends + (current.direction !== "start" && current.direction !== neighbor.direction ? 1 : 0),
          length: current.cost.length + Math.abs(to.x - from.x) + Math.abs(to.y - from.y),
          congestion: current.cost.congestion + segmentCongestion(from, to, independentEdges)
        };
        const nextKey = keyFor(neighbor.xIndex, neighbor.yIndex, neighbor.direction);
        const previousCost = best.get(nextKey);
        if (previousCost && compareRouteCost(cost, previousCost) >= 0) continue;
        best.set(nextKey, cost);
        queue.push({ ...neighbor, cost, path: [...current.path, to] });
      }
    }
    if (!routed && clearance > 0) {
      return chooseSmartRoute(points, source, target, nodes, previousEdges, 0, considerEdgeCrossings);
    }
    if (!routed && considerEdgeCrossings && previousEdges.length > 0) {
      return chooseSmartRoute(points, source, target, nodes, [], 0, false);
    }
    if (!routed) return points;
    const simplified = simplifyRoute(routed);
    if (!pathBlocked(initialRoute) && compareRouteCost(routeCost(simplified, comparedEdges, independentEdges), initialCost) >= 0) return points;
    return simplified;
  }
  function routeDeployment(nodes, model) {
    const map = byId(nodes);
    const plans = [];
    for (const edge of model.connections) {
      const source = map.get(edge.from);
      const target = map.get(edge.to);
      if (!source || !target) continue;
      const sourceCenter = center(source);
      const targetCenter = center(target);
      const requestedSourceSide = portSide(edge.attributes?.fromPort);
      const requestedTargetSide = portSide(edge.attributes?.toPort);
      const stateBarConnection = model.kind === "state" && (source.shape === "uml-bar" || target.shape === "uml-bar");
      const horizontal = !stateBarConnection && (edge.from === edge.to || Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y) * 0.55);
      if (horizontal) {
        const forward2 = targetCenter.x >= sourceCenter.x;
        plans.push({
          edge,
          source,
          target,
          sourceSide: requestedSourceSide ?? (forward2 ? "right" : "left"),
          targetSide: requestedTargetSide ?? (forward2 ? "left" : "right")
        });
        continue;
      }
      const forward = targetCenter.y >= sourceCenter.y;
      plans.push({
        edge,
        source,
        target,
        sourceSide: requestedSourceSide ?? (forward ? "bottom" : "top"),
        targetSide: requestedTargetSide ?? (forward ? "top" : "bottom")
      });
    }
    const requestsByPort = /* @__PURE__ */ new Map();
    for (const plan of plans) {
      if (plan.edge.from === plan.edge.to) continue;
      const sourceTargetCenter = center(plan.target);
      const targetSourceCenter = center(plan.source);
      const requests = [
        { plan, endpoint: "source", node: plan.source, side: plan.sourceSide, sortValue: horizontalPort(plan.sourceSide) ? sourceTargetCenter.y : sourceTargetCenter.x },
        { plan, endpoint: "target", node: plan.target, side: plan.targetSide, sortValue: horizontalPort(plan.targetSide) ? targetSourceCenter.y : targetSourceCenter.x }
      ];
      for (const request of requests) {
        const key = `${request.node.id}:${request.side}:${request.endpoint}`;
        const group = requestsByPort.get(key) ?? [];
        group.push(request);
        requestsByPort.set(key, group);
      }
    }
    const allocatedPorts = /* @__PURE__ */ new Map();
    for (const requests of requestsByPort.values()) {
      requests.sort((a, b) => a.sortValue - b.sortValue || a.plan.edge.order - b.plan.edge.order);
      const centeredTargets = new Set(requests.filter((request) => ["flowchart", "activity", "graph"].includes(model.kind) && request.endpoint === "target" && Math.abs(request.sortValue - (horizontalPort(request.side) ? center(request.node).y : center(request.node).x)) < 0.5));
      requests.forEach((request, index) => {
        const bundledSource = !["er", "slide"].includes(model.kind) && request.endpoint === "source" && requests.length > 1;
        const count = requests.length + (centeredTargets.size && requests.length % 2 ? 1 : 0);
        allocatedPorts.set(
          `${request.plan.edge.id}:${request.endpoint}`,
          bundledSource || centeredTargets.has(request) ? portPoint(request.node, request.side, 0, 1) : portPoint(request.node, request.side, index, count)
        );
      });
    }
    const routedEdges = [];
    for (const plan of plans) {
      const { edge, source, target } = plan;
      const sourceCenter = center(source);
      let points;
      if (edge.from === edge.to) {
        points = [
          { x: source.x + source.width, y: sourceCenter.y },
          { x: source.x + source.width + 28, y: sourceCenter.y },
          { x: source.x + source.width + 28, y: source.y - 18 },
          { x: sourceCenter.x, y: source.y - 18 },
          { x: sourceCenter.x, y: source.y }
        ];
      } else if (horizontalPort(plan.sourceSide) && horizontalPort(plan.targetSide)) {
        const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, plan.sourceSide, 0, 1);
        const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, plan.targetSide, 0, 1);
        const sourceBundle = ["er", "slide"].includes(model.kind) ? 0 : requestsByPort.get(`${source.id}:${plan.sourceSide}:source`)?.length ?? 0;
        const middleX = sourceBundle > 1 ? start.x + (plan.sourceSide === "right" ? 24 : -24) : (start.x + end.x) / 2;
        points = [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
      } else if (!horizontalPort(plan.sourceSide) && !horizontalPort(plan.targetSide)) {
        const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, plan.sourceSide, 0, 1);
        const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, plan.targetSide, 0, 1);
        const sourceBundle = ["er", "slide"].includes(model.kind) ? 0 : requestsByPort.get(`${source.id}:${plan.sourceSide}:source`)?.length ?? 0;
        const middleY = sourceBundle > 1 ? start.y + (plan.sourceSide === "bottom" ? 24 : -24) : (start.y + end.y) / 2;
        points = [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end];
      } else {
        const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, plan.sourceSide, 0, 1);
        const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, plan.targetSide, 0, 1);
        const startOutside = offsetPort(start, plan.sourceSide, 24);
        const endOutside = offsetPort(end, plan.targetSide, 24);
        points = horizontalPort(plan.sourceSide) ? [start, startOutside, { x: endOutside.x, y: startOutside.y }, endOutside, end] : [start, startOutside, { x: startOutside.x, y: endOutside.y }, endOutside, end];
      }
      const routed = { ...edge, points: chooseSmartRoute(points, source, target, nodes, routedEdges) };
      routedEdges.push(routed);
    }
    return routedEdges;
  }
  function portSide(value) {
    const normalized = value?.toLowerCase();
    return normalized === "left" || normalized === "right" || normalized === "top" || normalized === "bottom" ? normalized : void 0;
  }
  function horizontalPort(side) {
    return side === "left" || side === "right";
  }
  function offsetPort(point, side, distance) {
    if (side === "left") return { x: point.x - distance, y: point.y };
    if (side === "right") return { x: point.x + distance, y: point.y };
    if (side === "top") return { x: point.x, y: point.y - distance };
    return { x: point.x, y: point.y + distance };
  }
  function portPoint(node, side, index, count) {
    if (["circle", "initial-state", "final-state", "junction-state"].includes(node.shape)) {
      return {
        x: side === "left" ? node.x : side === "right" ? node.x + node.width : node.x + node.width / 2,
        y: side === "top" ? node.y : side === "bottom" ? node.y + node.height : node.y + node.height / 2
      };
    }
    if (side === "left" || side === "right") {
      const margin2 = Math.min(8, node.height * 0.15);
      const usable2 = Math.max(0, node.height - margin2 * 2);
      return {
        x: side === "left" ? node.x : node.x + node.width,
        y: node.y + margin2 + usable2 * ((index + 1) / (count + 1))
      };
    }
    const margin = Math.min(10, node.width * 0.12);
    const usable = Math.max(0, node.width - margin * 2);
    return {
      x: node.x + margin + usable * ((index + 1) / (count + 1)),
      y: side === "top" ? node.y : node.y + node.height
    };
  }
  function dimensions(nodes, groups = []) {
    const all = [...nodes, ...groups];
    return {
      width: Math.max(320, ...all.map((node) => node.x + node.width + CANVAS_PADDING)),
      height: Math.max(220, ...all.map((node) => node.y + node.height + CANVAS_PADDING))
    };
  }
  function arrangeStateJoinSections(nodes, model) {
    if (model.kind !== "state") return;
    const nodeMap = byId(nodes);
    const outgoing = new Map(nodes.map((node) => [node.id, model.connections.filter((edge) => edge.from === node.id)]));
    const incoming = new Map(nodes.map((node) => [node.id, model.connections.filter((edge) => edge.to === node.id)]));
    const forks = nodes.filter((node) => node.shape === "uml-bar" && (outgoing.get(node.id)?.length ?? 0) > 1);
    const joins = nodes.filter((node) => node.shape === "uml-bar" && (incoming.get(node.id)?.length ?? 0) > 1);
    const reachable = (start, goal) => {
      const pending = [start];
      const visited = /* @__PURE__ */ new Set();
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
      const between = nodes.filter((node) => node.id !== fork.id && node.id !== join.id && reachable(fork.id, node.id) && reachable(node.id, join.id));
      const distance = /* @__PURE__ */ new Map([[fork.id, 0]]);
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
      const predecessors = (incoming.get(fork.id) ?? []).map((edge) => nodeMap.get(edge.from)).filter((node) => Boolean(node));
      const predecessor = predecessors.length === 1 ? predecessors[0] : void 0;
      const centerX = predecessor ? predecessor.x + predecessor.width / 2 : fork.x + fork.width / 2;
      if (predecessor) {
        fork.x = centerX - fork.width / 2;
        fork.y = predecessor.y + predecessor.height + rankGap;
      }
      let y = fork.y + fork.height + rankGap;
      const ranksInSection = [...new Set(between.map((node) => distance.get(node.id) ?? 1))].sort((a, b) => a - b);
      for (const rank of ranksInSection) {
        const row = model.items.filter((item) => between.some((node) => node.id === item.id) && (distance.get(item.id) ?? 1) === rank).map((item) => nodeMap.get(item.id)).filter((node) => Boolean(node));
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
      const successors = (outgoing.get(join.id) ?? []).map((edge) => nodeMap.get(edge.to)).filter((node) => Boolean(node));
      if (successors.length === 1 && (incoming.get(successors[0].id)?.length ?? 0) === 1) {
        const successor = successors[0];
        successor.x = centerX - successor.width / 2;
        successor.y = y;
      }
    }
  }
  var hierarchicalLayout = {
    name: "hierarchical",
    layout(model, context) {
      const nodes = arrangeDeployment(model);
      arrangeContainerContents(nodes, model);
      fitContainers(nodes);
      arrangeNestedContainerContents(nodes, model);
      packTopLevelGroups(nodes, model);
      arrangeStateJoinSections(nodes, model);
      applyContinuity(nodes, context);
      fitContainers(nodes.filter((node) => !context.overlay.nodes[node.id]?.manual || node.shape !== "container"));
      const edges = routeDeployment(nodes, model);
      return { kind: model.kind, nodes, edges, groups: [], ...dimensions(nodes) };
    }
  };
  var compactLayout = {
    name: "compact",
    layout(model, context) {
      const normal = model.items.filter((item) => item.shape !== "container");
      const columns = Math.max(1, Math.ceil(Math.sqrt(normal.length)));
      const cellWidth = Math.max(150, ...normal.map((item) => item.size.width)) + 42;
      const cellHeight = Math.max(70, ...normal.map((item) => item.size.height)) + 34;
      const nodes = normal.map((item, index) => ({
        id: item.id,
        label: item.label,
        shape: item.shape,
        ...item.parentId ? { parentId: item.parentId } : {},
        attributes: item.attributes,
        x: CANVAS_PADDING + index % columns * cellWidth,
        y: CANVAS_PADDING + Math.floor(index / columns) * cellHeight,
        ...item.size
      }));
      for (const item of model.items.filter((candidate) => candidate.shape === "container")) {
        nodes.push({ id: item.id, label: item.label, shape: item.shape, attributes: item.attributes, ...item.parentId ? { parentId: item.parentId } : {}, x: CANVAS_PADDING, y: CANVAS_PADDING, ...item.size });
      }
      fitContainers(nodes);
      applyContinuity(nodes, context);
      const edges = routeDeployment(nodes, model);
      return { kind: model.kind, nodes, edges, groups: [], ...dimensions(nodes) };
    }
  };
  var sequenceLayout = {
    name: "sequence",
    layout(model, context) {
      const headerY = 26;
      const laneGap = Math.max(154, ...model.items.map((item) => item.size.width + 54));
      const nodes = model.items.map((item, index) => ({
        id: item.id,
        label: item.label,
        shape: item.shape,
        attributes: item.attributes,
        x: CANVAS_PADDING + index * laneGap,
        y: headerY,
        ...item.size
      }));
      applyContinuity(nodes, context);
      const map = byId(nodes);
      const firstMessageY = Math.max(...nodes.map((node) => node.y + node.height)) + 58;
      const messageGap = 52;
      const edges = model.connections.flatMap((edge, index) => {
        const source = map.get(edge.from);
        const target = map.get(edge.to);
        if (!source || !target) return [];
        const y = firstMessageY + index * messageGap;
        const fromX = source.x + source.width / 2;
        const toX = target.x + target.width / 2;
        const points = fromX === toX ? [{ x: fromX, y }, { x: fromX + 42, y }, { x: fromX + 42, y: y + 28 }, { x: fromX, y: y + 28 }] : [{ x: fromX, y }, { x: toX, y }];
        return [{ ...edge, points }];
      });
      const bottom = firstMessageY + Math.max(1, model.connections.length) * messageGap + 30;
      const groups = model.groups.map((group) => {
        const groupedEdges = edges.filter((edge) => edge.groupId === group.id);
        const top = (groupedEdges[0]?.points[0]?.y ?? firstMessageY) - 28;
        const lastEdge = groupedEdges[groupedEdges.length - 1];
        const lastY = lastEdge?.points[0]?.y ?? top + 36;
        const left = Math.min(...nodes.map((node) => node.x)) - 14;
        const right = Math.max(...nodes.map((node) => node.x + node.width)) + 14;
        return {
          id: group.id,
          label: group.label,
          ...group.kind ? { kind: group.kind } : {},
          x: left,
          y: top,
          width: right - left,
          height: lastY - top + 42
        };
      });
      return {
        kind: model.kind,
        nodes,
        edges,
        groups,
        width: Math.max(320, ...nodes.map((node) => node.x + node.width + CANVAS_PADDING)),
        height: Math.max(240, bottom + CANVAS_PADDING)
      };
    }
  };
  function layoutVerticalDirected(model, context, includeContainers = false) {
    const rankById = ranks(model);
    const itemGap = Math.max(64, model.minimumGap + 20);
    const rankGap = Math.max(72, model.minimumGap + 28);
    const rows = orderedLayers(model, rankById);
    const rowWidths = rows.map((items) => items.reduce((sum, item) => sum + item.size.width, 0) + Math.max(0, items.length - 1) * itemGap);
    const contentWidth = Math.max(420, ...rowWidths, 0);
    const nodes = [];
    let y = CANVAS_PADDING;
    rows.forEach((items, rowIndex) => {
      const rowHeight = Math.max(...items.map((item) => item.size.height));
      let x = CANVAS_PADDING + (contentWidth - (rowWidths[rowIndex] ?? 0)) / 2;
      for (const item of items) {
        nodes.push({
          id: item.id,
          label: item.label,
          shape: item.shape,
          ...item.parentId ? { parentId: item.parentId } : {},
          attributes: item.attributes,
          x,
          y: y + (rowHeight - item.size.height) / 2,
          ...item.size
        });
        x += item.size.width + itemGap;
      }
      const outgoing = model.connections.filter((edge) => items.some((item) => item.id === edge.from));
      const crowded = outgoing.length > items.length || outgoing.some((edge) => edge.label);
      y += rowHeight + (crowded ? rankGap + 16 : Math.max(44, model.minimumGap + 12));
    });
    alignLayers(nodes, rows, model, itemGap);
    if (includeContainers) {
      for (const item of model.items.filter((candidate) => candidate.shape === "container")) {
        nodes.push({
          id: item.id,
          label: item.label,
          shape: item.shape,
          ...item.parentId ? { parentId: item.parentId } : {},
          attributes: item.attributes,
          x: CANVAS_PADDING,
          y: CANVAS_PADDING,
          ...item.size
        });
      }
      fitContainers(nodes);
    }
    applyContinuity(nodes, context);
    if (includeContainers) {
      fitContainers(nodes.filter((node) => !context.overlay.nodes[node.id]?.manual || node.shape !== "container"));
    }
    const edges = routeDeployment(nodes, model);
    const size = dimensions(nodes);
    return {
      kind: model.kind,
      nodes,
      edges,
      groups: [],
      width: Math.max(contentWidth + CANVAS_PADDING * 2, size.width),
      height: Math.max(320, y - rankGap + CANVAS_PADDING, size.height)
    };
  }
  var flowchartLayout = {
    name: "flowchart",
    layout(model, context) {
      return layoutVerticalDirected(model, context);
    }
  };
  var graphLayout = {
    name: "graph",
    layout(model, context) {
      if (model.direction === "right") return hierarchicalLayout.layout(model, context);
      return layoutVerticalDirected(model, context, true);
    }
  };
  function routeActivity(nodes, model) {
    const map = byId(nodes);
    const routedEdges = [];
    for (const edge of model.connections) {
      const source = map.get(edge.from);
      const target = map.get(edge.to);
      if (!source || !target) continue;
      const sourceCenter = center(source);
      const targetCenter = center(target);
      const forward = targetCenter.y >= sourceCenter.y;
      const start = { x: sourceCenter.x, y: forward ? source.y + source.height : source.y };
      const end = { x: targetCenter.x, y: forward ? target.y : target.y + target.height };
      const points = Math.abs(start.x - end.x) < 0.5 ? [start, end] : [
        start,
        { x: start.x, y: forward ? Math.min(end.y - 22, start.y + 34) : Math.max(end.y + 22, start.y - 34) },
        { x: end.x, y: forward ? Math.min(end.y - 22, start.y + 34) : Math.max(end.y + 22, start.y - 34) },
        end
      ];
      const routed = { ...edge, points: chooseSmartRoute(points, source, target, nodes, routedEdges) };
      routedEdges.push(routed);
    }
    return routedEdges;
  }
  var activityLayout = {
    name: "activity",
    layout(model, context) {
      const rankById = ranks(model);
      const rows = orderedLayers(model, rankById);
      const itemGap = 70;
      const rowWidths = rows.map((items) => items.reduce((sum, item) => sum + item.size.width, 0) + Math.max(0, items.length - 1) * itemGap);
      const contentWidth = Math.max(560, ...rowWidths);
      const canvasWidth = contentWidth + CANVAS_PADDING * 2;
      let y = CANVAS_PADDING;
      const nodes = [];
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
            ...item.size
          });
          x += item.size.width + itemGap;
        }
        y += rowHeight + 58;
      });
      alignLayers(nodes, rows, model, itemGap);
      applyContinuity(nodes, context);
      const edges = routeActivity(nodes, model);
      return { kind: model.kind, nodes, edges, groups: [], width: canvasWidth, height: Math.max(620, y - 30 + CANVAS_PADDING) };
    }
  };
  var classLayout = {
    name: "class",
    layout(model, context) {
      const upwardRelations = /* @__PURE__ */ new Set(["inheritance", "realization", "dependency", "directed-association"]);
      const rankingModel = {
        ...model,
        connections: model.connections.map((edge) => upwardRelations.has(edge.attributes?.relation ?? "") ? { ...edge, from: edge.to, to: edge.from } : edge)
      };
      const rankById = ranks(rankingModel);
      const rankValues = [...new Set(rankById.values())].sort((a, b) => a - b);
      const itemGap = 58;
      const maximumColumns = 2;
      const rankRows = rankValues.map((rank) => {
        const items = model.items.filter((item) => rankById.get(item.id) === rank);
        const rows = [];
        for (let index = 0; index < items.length; index += maximumColumns) rows.push(items.slice(index, index + maximumColumns));
        return rows;
      });
      const rowWidth = (items) => items.reduce((sum, item) => sum + item.size.width, 0) + Math.max(0, items.length - 1) * itemGap;
      const contentWidth = Math.max(540, ...rankRows.flat().map(rowWidth));
      const canvasWidth = contentWidth + CANVAS_PADDING * 2;
      const nodes = [];
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
              ...item.size
            });
            x += item.size.width + itemGap;
          }
          y += height + (rowIndex === rows.length - 1 ? 68 : 30);
        });
      });
      applyContinuity(nodes, context);
      const edges = routeActivity(nodes, model);
      return { kind: model.kind, nodes, edges, groups: [], width: canvasWidth, height: Math.max(620, y - 36 + CANVAS_PADDING) };
    }
  };
  function slideNumber(item, name, fallback, minimum = 1, maximum = 12) {
    const value = Number(item.attributes[name]);
    return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
  }
  function translateSlideBundle(bundle, x, y) {
    for (const node of bundle.nodes) {
      node.x += x;
      node.y += y;
    }
  }
  function arrangeSlideItem(item, childItems, childrenByParent) {
    if (item.shape !== "slide-group") {
      return {
        nodes: [{
          id: item.id,
          label: item.label,
          shape: item.shape,
          ...item.parentId ? { parentId: item.parentId } : {},
          attributes: item.attributes,
          x: 0,
          y: 0,
          ...item.size
        }],
        width: item.size.width,
        height: item.size.height
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
      const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(1, ...bundles.filter((_2, index) => index % columns === column).map((bundle) => bundle.width)));
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
    const groupNode = {
      id: item.id,
      label: item.label,
      shape: item.shape,
      ...item.parentId ? { parentId: item.parentId } : {},
      attributes: item.attributes,
      x: 0,
      y: 0,
      width,
      height
    };
    return { nodes: [groupNode, ...bundles.flatMap((bundle) => bundle.nodes)], width, height };
  }
  var slideLayout = {
    name: "slide",
    layout(model, context) {
      const childrenByParent = /* @__PURE__ */ new Map();
      for (const item of model.items) {
        if (!item.parentId) continue;
        const children = childrenByParent.get(item.parentId) ?? [];
        children.push(item);
        childrenByParent.set(item.parentId, children);
      }
      const roots = model.items.filter((item) => !item.parentId).sort((a, b) => Number(a.attributes.order ?? 0) - Number(b.attributes.order ?? 0));
      const bundles = roots.map((item) => ({ item, bundle: arrangeSlideItem(item, childrenByParent.get(item.id) ?? [], childrenByParent) }));
      const contentWidth = Math.max(880, ...bundles.map(({ bundle }) => bundle.width));
      const canvasWidth = Math.max(960, contentWidth + 80);
      let y = 30;
      const nodes = [];
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
    }
  };
  var builtInLayouts = [hierarchicalLayout, compactLayout, sequenceLayout, flowchartLayout, graphLayout, activityLayout, classLayout, slideLayout];
  function rerouteGeometry(geometry) {
    if (geometry.kind === "sequence") {
      const map = byId(geometry.nodes);
      for (const edge of geometry.edges) {
        const source = map.get(edge.from);
        const target = map.get(edge.to);
        const y = edge.points[0]?.y ?? 0;
        if (source && target) {
          const fromX = source.x + source.width / 2;
          const toX = target.x + target.width / 2;
          edge.points = fromX === toX ? [{ x: fromX, y }, { x: fromX + 42, y }, { x: fromX + 42, y: y + 28 }, { x: fromX, y: y + 28 }] : [{ x: fromX, y }, { x: toX, y }];
        }
      }
      geometry.width = Math.max(320, ...geometry.nodes.map((node) => node.x + node.width + CANVAS_PADDING));
      geometry.height = Math.max(240, ...geometry.nodes.map((node) => node.y + node.height + CANVAS_PADDING), geometry.height);
      return;
    }
    if (geometry.kind === "activity" || geometry.kind === "class") {
      const model2 = {
        kind: geometry.kind,
        items: geometry.nodes.map((node) => ({ ...node, size: { width: node.width, height: node.height } })),
        connections: geometry.edges.map(({ points: _points, ...edge }) => edge),
        groups: [],
        direction: "down",
        minimumGap: 44
      };
      geometry.edges = routeActivity(geometry.nodes, model2);
      const size2 = dimensions(geometry.nodes);
      geometry.width = size2.width;
      geometry.height = size2.height;
      return;
    }
    const model = {
      kind: geometry.kind,
      items: geometry.nodes.map((node) => ({ ...node, size: { width: node.width, height: node.height } })),
      connections: geometry.edges.map(({ points: _points, ...edge }) => edge),
      groups: [],
      direction: "right",
      minimumGap: 44
    };
    geometry.edges = routeDeployment(geometry.nodes, model);
    const size = dimensions(geometry.nodes, geometry.groups);
    geometry.width = size.width;
    geometry.height = size.height;
  }

  // src/edge-jumps.ts
  var INTERSECTION_EPSILON = 1e-3;
  var DEFAULT_EDGE_JUMP_RADIUS = 6;
  function pathWithEdgeJumps(edge, lowerEdges, radius = DEFAULT_EDGE_JUMP_RADIUS) {
    if (radius <= 0 || edge.points.length < 2 || lowerEdges.length === 0) return pathFromPoints(edge.points);
    const points = simplifyPoints(edge.points);
    const lowerPaths = lowerEdges.map((lowerEdge) => simplifyPoints(lowerEdge.points));
    const jumpsBySegment = points.slice(0, -1).map(() => []);
    let jumpCount = 0;
    for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
      const start = points[segmentIndex];
      const end = points[segmentIndex + 1];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (length <= radius * 2) continue;
      for (const lowerPoints of lowerPaths) {
        for (let lowerIndex = 0; lowerIndex < lowerPoints.length - 1; lowerIndex += 1) {
          const intersection = segmentIntersection(start, end, lowerPoints[lowerIndex], lowerPoints[lowerIndex + 1]);
          if (!intersection) continue;
          const distance = intersection.t * length;
          if (distance <= radius || distance >= length - radius) continue;
          const jumps = jumpsBySegment[segmentIndex];
          if (jumps.some((jump) => Math.abs(jump.distance - distance) < radius * 2)) continue;
          jumps.push({ distance, point: intersection.point });
          jumpCount += 1;
        }
      }
    }
    if (jumpCount === 0) return pathFromPoints(edge.points);
    const commands = [`M ${coordinate(points[0].x)} ${coordinate(points[0].y)}`];
    for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
      const start = points[segmentIndex];
      const end = points[segmentIndex + 1];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const unitX = (end.x - start.x) / length;
      const unitY = (end.y - start.y) / length;
      const jumps = jumpsBySegment[segmentIndex].sort((a, b) => a.distance - b.distance);
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
  function simplifyPoints(points) {
    const simplified = [];
    for (const point of points) {
      const last = simplified[simplified.length - 1];
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) > INTERSECTION_EPSILON) simplified.push(point);
    }
    let index = 1;
    while (index < simplified.length - 1) {
      const previous = simplified[index - 1];
      const current = simplified[index];
      const next = simplified[index + 1];
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
  function segmentIntersection(firstStart, firstEnd, secondStart, secondEnd) {
    const first = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
    const second = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
    const denominator = cross(first, second);
    if (Math.abs(denominator) <= INTERSECTION_EPSILON) return void 0;
    const offset = { x: secondStart.x - firstStart.x, y: secondStart.y - firstStart.y };
    const t = cross(offset, second) / denominator;
    const u = cross(offset, first) / denominator;
    if (t <= INTERSECTION_EPSILON || t >= 1 - INTERSECTION_EPSILON) return void 0;
    if (u <= INTERSECTION_EPSILON || u >= 1 - INTERSECTION_EPSILON) return void 0;
    return {
      point: { x: firstStart.x + first.x * t, y: firstStart.y + first.y * t },
      t
    };
  }
  function cross(first, second) {
    return first.x * second.y - first.y * second.x;
  }
  function coordinate(value) {
    return String(round(value));
  }

  // src/renderer.ts
  var SvgRenderer = class {
    constructor(document, theme, resolveShape, ariaLabel) {
      __publicField(this, "svg");
      __publicField(this, "document");
      __publicField(this, "resolveShape");
      __publicField(this, "theme");
      __publicField(this, "geometry");
      __publicField(this, "nodeElements", /* @__PURE__ */ new Map());
      __publicField(this, "edgeElements", /* @__PURE__ */ new Map());
      __publicField(this, "edgeLabelElements", /* @__PURE__ */ new Map());
      __publicField(this, "labelPlacements", /* @__PURE__ */ new Map());
      __publicField(this, "minimumSize", { width: 320, height: 220 });
      __publicField(this, "textWidths", /* @__PURE__ */ new Map());
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
        tabindex: "0"
      });
    }
    draw(geometry, theme = this.theme) {
      this.geometry = geometry;
      this.theme = theme;
      this.minimumSize = { width: geometry.width + (geometry.origin?.x ?? 0), height: geometry.height + (geometry.origin?.y ?? 0) };
      this.textWidths.clear();
      this.prepareGeometry(geometry);
      this.nodeElements.clear();
      this.edgeElements.clear();
      this.edgeLabelElements.clear();
      this.svg.replaceChildren();
      this.svg.setAttribute("viewBox", `${geometry.origin?.x ?? 0} ${geometry.origin?.y ?? 0} ${geometry.width} ${geometry.height}`);
      this.svg.style.background = theme.canvasColor;
      this.svg.style.aspectRatio = `${geometry.width} / ${geometry.height}`;
      this.svg.append(this.createDefinitions(), this.createStyles());
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
          "stroke-dasharray": "5 4"
        }));
        const title = group.kind && group.kind !== "group" ? `${group.kind} \xB7 ${group.label}` : group.label;
        const tabWidth = Math.min(group.width - 18, Math.max(78, title.length * (theme.fontSize * 0.62) + 24));
        groupLayer.append(svgElement(this.document, "path", {
          d: `M ${group.x} ${group.y} L ${group.x + tabWidth} ${group.y} L ${group.x + tabWidth + 10} ${group.y + 22} L ${group.x} ${group.y + 22} Z`,
          fill: theme.containerFill,
          stroke: theme.containerStroke,
          "stroke-width": 1
        }));
        const label = svgElement(this.document, "text", {
          x: group.x + 10,
          y: group.y + 15,
          fill: theme.mutedColor,
          "font-family": theme.fontFamily,
          "font-size": theme.fontSize - 1,
          "font-weight": 650
        });
        label.textContent = title;
        groupLayer.append(label);
      }
      this.svg.append(groupLayer);
      const containers = svgElement(this.document, "g", { class: "finch-containers" });
      const regularNodes = svgElement(this.document, "g", { class: "finch-nodes" });
      for (const node of geometry.nodes.filter((candidate) => candidate.shape === "container")) this.appendNode(containers, node);
      this.svg.append(containers);
      if (geometry.kind === "sequence") {
        this.svg.append(this.createLifelines(geometry));
        this.svg.append(this.createActivations(geometry));
      }
      this.svg.append(this.createEdges(geometry));
      for (const node of geometry.nodes.filter((candidate) => candidate.shape !== "container")) this.appendNode(regularNodes, node);
      this.svg.append(regularNodes);
    }
    updateGeometry(geometry) {
      this.geometry = geometry;
      this.prepareGeometry(geometry);
      this.svg.setAttribute("viewBox", `${geometry.origin?.x ?? 0} ${geometry.origin?.y ?? 0} ${geometry.width} ${geometry.height}`);
      this.svg.style.aspectRatio = `${geometry.width} / ${geometry.height}`;
      for (const node of geometry.nodes) {
        const element = this.nodeElements.get(node.id);
        element?.setAttribute("transform", `translate(${node.x} ${node.y})`);
        if (node.shape === "container") {
          const frame = element?.querySelector(":scope > rect");
          frame?.setAttribute("width", String(node.width));
          frame?.setAttribute("height", String(node.height));
        }
      }
      for (const [index, edge] of geometry.edges.entries()) {
        this.edgeElements.get(edge.id)?.setAttribute("d", pathWithEdgeJumps(edge, geometry.edges.slice(0, index)));
        const label = this.edgeLabelElements.get(edge.id);
        if (label) {
          const point = this.labelPlacements.get(edge.id).point;
          label.setAttribute("x", String(point.x));
          label.setAttribute("y", String(point.y));
        }
        for (const endpoint of ["start", "end"]) {
          const cardinality = this.svg.querySelector(`.finch-cardinality[data-edge-id="${cssEscape(edge.id)}"][data-endpoint="${endpoint}"]`);
          if (!cardinality) continue;
          const point = cardinalityPoint(edge, endpoint);
          cardinality.setAttribute("x", String(point.x));
          cardinality.setAttribute("y", String(point.y - 6));
        }
      }
      if (geometry.kind === "sequence") {
        for (const node of geometry.nodes) {
          const line = this.svg.querySelector(`.finch-lifeline[data-node-id="${cssEscape(node.id)}"]`);
          if (line) {
            const x = node.x + node.width / 2;
            line.setAttribute("x1", String(x));
            line.setAttribute("x2", String(x));
          }
          const activations = this.svg.querySelectorAll(`.finch-activation[data-node-id="${cssEscape(node.id)}"]`);
          for (const activation of activations) {
            const offset = Number(activation.dataset.xOffset ?? -5);
            activation.setAttribute("x", String(node.x + node.width / 2 + offset));
          }
        }
      }
    }
    setSelection(ids) {
      for (const [id, element] of this.nodeElements) element.classList.toggle("is-selected", ids.has(id));
    }
    setPinned(id, pinned) {
      this.nodeElements.get(id)?.classList.toggle("is-pinned", pinned);
    }
    clientPoint(event) {
      const point = this.svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = this.svg.getScreenCTM();
      if (!matrix) return { x: event.clientX, y: event.clientY };
      const transformed = point.matrixTransform(matrix.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    nodeIdFromTarget(target) {
      return target instanceof this.document.defaultView.Element ? target.closest("[data-node-id]")?.dataset.nodeId : void 0;
    }
    appendNode(layer, node) {
      const element = this.resolveShape(node.shape).render({ node, theme: this.theme, document: this.document });
      element.classList.add("finch-node");
      layer.append(element);
      this.nodeElements.set(node.id, element);
    }
    prepareGeometry(geometry) {
      const fontSize = this.theme.fontSize - 1;
      const probe = svgElement(this.document, "svg", { "aria-hidden": "true" });
      probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden";
      const text = svgElement(this.document, "text", { "font-family": this.theme.fontFamily, "font-size": fontSize });
      probe.append(text);
      this.document.body?.append(probe);
      try {
        const measure = (value) => {
          const cached = this.textWidths.get(value);
          if (cached !== void 0) return cached;
          text.textContent = value;
          const measured = typeof text.getComputedTextLength === "function" ? text.getComputedTextLength() : 0;
          const width = measured > 0 ? measured : estimatedTextWidth(value, fontSize);
          this.textWidths.set(value, width);
          return width;
        };
        const result = placeEdgeLabels(geometry, fontSize, measure);
        this.labelPlacements = result.labels;
        fitVisualBounds(geometry, this.minimumSize, result.bounds);
      } finally {
        probe.remove();
      }
    }
    createEdges(geometry) {
      const layer = svgElement(this.document, "g", { class: "finch-edges" });
      for (const [index, edge] of geometry.edges.entries()) {
        const relation = edge.attributes?.relation;
        const markerEnd = ["inheritance", "realization"].includes(relation ?? "") ? "url(#finch-triangle)" : ["association", "aggregation", "composition"].includes(relation ?? "") ? void 0 : "url(#finch-arrow)";
        const markerStart = relation === "composition" ? "url(#finch-diamond-filled)" : relation === "aggregation" ? "url(#finch-diamond-open)" : void 0;
        const path = svgElement(this.document, "path", {
          d: pathWithEdgeJumps(edge, geometry.edges.slice(0, index)),
          fill: "none",
          stroke: this.theme.edgeColor,
          "stroke-width": this.theme.edgeWidth,
          "stroke-dasharray": edge.dashed || ["dependency", "realization"].includes(relation ?? "") ? "6 5" : void 0,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
          "marker-start": markerStart,
          "marker-end": markerEnd,
          class: "finch-edge",
          "data-edge-id": edge.id
        });
        layer.append(path);
        this.edgeElements.set(edge.id, path);
        const cardinalities = [
          ["start", edge.attributes?.fromCardinality, cardinalityPoint(edge, "start")],
          ["end", edge.attributes?.toCardinality, cardinalityPoint(edge, "end")]
        ];
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
            "data-endpoint": endpoint
          });
          cardinality.textContent = value;
          layer.append(cardinality);
        }
        if (edge.label) {
          const point = this.labelPlacements.get(edge.id).point;
          const text = svgElement(this.document, "text", {
            x: point.x,
            y: point.y,
            "text-anchor": "middle",
            fill: this.theme.mutedColor,
            "font-family": this.theme.fontFamily,
            "font-size": this.theme.fontSize - 1,
            class: "finch-edge-label"
          });
          text.textContent = edge.label;
          layer.append(text);
          this.edgeLabelElements.set(edge.id, text);
        }
      }
      return layer;
    }
    createLifelines(geometry) {
      const layer = svgElement(this.document, "g", { class: "finch-lifelines" });
      for (const node of geometry.nodes) {
        const x = node.x + node.width / 2;
        layer.append(svgElement(this.document, "line", {
          x1: x,
          x2: x,
          y1: node.y + node.height,
          y2: (geometry.origin?.y ?? 0) + geometry.height - 32,
          stroke: this.theme.nodeStroke,
          "stroke-width": 1,
          "stroke-dasharray": "5 5",
          class: "finch-lifeline",
          "data-node-id": node.id
        }));
      }
      return layer;
    }
    createActivations(geometry) {
      const layer = svgElement(this.document, "g", { class: "finch-activations" });
      const nodeMap = new Map(geometry.nodes.map((node) => [node.id, node]));
      const stacks = /* @__PURE__ */ new Map();
      const intervals = [];
      for (const edge of geometry.edges) {
        if (edge.from === edge.to) continue;
        const y = edge.points[0]?.y ?? 0;
        if (edge.dashed) {
          const stack = stacks.get(edge.from);
          const active = stack?.pop();
          if (active) intervals.push({ nodeId: edge.from, start: active.start, end: Math.max(active.start + 10, y), depth: active.depth });
        } else {
          const stack = stacks.get(edge.to) ?? [];
          stack.push({ start: y, depth: stack.length });
          stacks.set(edge.to, stack);
        }
      }
      for (const [nodeId, stack] of stacks) {
        for (const active of stack) intervals.push({ nodeId, start: active.start, end: geometry.height - 38, depth: active.depth });
      }
      for (const interval of intervals) {
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
          "data-x-offset": offset
        }));
      }
      return layer;
    }
    createDefinitions() {
      const defs = svgElement(this.document, "defs");
      const marker = svgElement(this.document, "marker", {
        id: "finch-arrow",
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: "auto-start-reverse"
      });
      marker.append(svgElement(this.document, "path", { d: "M 0 0 L 10 5 L 0 10 z", fill: this.theme.edgeColor }));
      const triangle = svgElement(this.document, "marker", {
        id: "finch-triangle",
        viewBox: "0 0 12 12",
        refX: 11,
        refY: 6,
        markerWidth: 9,
        markerHeight: 9,
        orient: "auto-start-reverse"
      });
      triangle.append(svgElement(this.document, "path", { d: "M 1 1 L 11 6 L 1 11 Z", fill: this.theme.canvasColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
      const openDiamond = svgElement(this.document, "marker", {
        id: "finch-diamond-open",
        viewBox: "0 0 14 10",
        refX: 2,
        refY: 5,
        markerWidth: 11,
        markerHeight: 9,
        orient: "auto-start-reverse"
      });
      openDiamond.append(svgElement(this.document, "path", { d: "M 1 5 L 7 1 L 13 5 L 7 9 Z", fill: this.theme.canvasColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
      const filledDiamond = svgElement(this.document, "marker", {
        id: "finch-diamond-filled",
        viewBox: "0 0 14 10",
        refX: 2,
        refY: 5,
        markerWidth: 11,
        markerHeight: 9,
        orient: "auto-start-reverse"
      });
      filledDiamond.append(svgElement(this.document, "path", { d: "M 1 5 L 7 1 L 13 5 L 7 9 Z", fill: this.theme.edgeColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
      const filter = svgElement(this.document, "filter", { id: "finch-shadow", x: "-20%", y: "-30%", width: "140%", height: "170%" });
      filter.append(svgElement(this.document, "feDropShadow", { dx: 0, dy: 2, stdDeviation: 2.5, "flood-color": "#0f172a", "flood-opacity": 0.1 }));
      defs.append(marker, triangle, openDiamond, filledDiamond, filter);
      return defs;
    }
    createStyles() {
      const style = svgElement(this.document, "style");
      style.textContent = `
      .finch-node { cursor: grab; outline: none; }
      .finch-node:active { cursor: grabbing; }
      .finch-node > :first-child { transition: stroke 120ms ease, stroke-width 120ms ease; }
      .finch-node.is-selected > :first-child { stroke: ${this.theme.accentColor}; stroke-width: 2.4; }
      .finch-node.is-pinned::after { content: ""; }
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
  };
  function cssEscape(value) {
    const css = globalThis.CSS;
    return css?.escape ? css.escape(value) : value.replace(/["\\]/g, "\\$&");
  }

  // src/parser.ts
  function meaningfulLines(source) {
    return source.split(/\r?\n/).map((line, index) => ({
      text: line.replace(/\s+(?:#|\/\/).*$/, "").trim(),
      number: index + 1
    })).filter((line) => line.text && !line.text.startsWith("'"));
  }
  function header(source) {
    const first = meaningfulLines(source)[0]?.text;
    if (!first?.startsWith("@")) throw new Error("Finch.js source must begin with a diagram directive such as @deployment or @sequence.");
    return first.slice(1).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  }
  function unquote(value, fallback) {
    if (!value) return fallback;
    return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1).replace(/\\"/g, '"') : value;
  }
  function attributesFrom(value) {
    if (!value) return {};
    const attributes = {};
    for (const match of value.matchAll(/([\w-]+)\s*=\s*("(?:\\.|[^"])*"|[^\s\]]+)/g)) {
      const key = match[1];
      if (key) attributes[key] = unquote(match[2], "");
    }
    return attributes;
  }
  function assertUnique(nodes, node, line) {
    if (nodes.some((existing) => existing.id === node.id)) throw new Error(`Line ${line}: duplicate node id "${node.id}".`);
  }
  function connectionId(from, to, index) {
    return `${from}-${to}-${index + 1}`;
  }
  function getDiagramKind(source) {
    return header(source);
  }
  function parseDeployment(source) {
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    const containerStack = [];
    for (const line of lines.slice(1)) {
      if (line.text === "}") {
        if (!containerStack.pop()) throw new Error(`Line ${line.number}: unexpected closing brace.`);
        continue;
      }
      const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|\.\.>)\s+([\w.-]+)(?:\s*:\s*(.+))?$/);
      if (relation) {
        const from = relation[1] ?? "";
        const arrow = relation[2] ?? "->";
        const to = relation[3] ?? "";
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...relation[4]?.trim() ? { label: unquote(relation[4].trim(), "") } : {},
          dashed: arrow.includes("--") || arrow.includes(".."),
          order: connections.length
        });
        continue;
      }
      const containment = line.text.match(/^([\w.-]+)\s+(?:in|inside)\s+([\w.-]+)$/);
      if (containment) {
        const node = nodes.find((candidate) => candidate.id === containment[1]);
        if (!node) throw new Error(`Line ${line.number}: unknown node "${containment[1]}".`);
        node.parentId = containment[2] ?? "";
        continue;
      }
      const contains = line.text.match(/^([\w.-]+)\s+contains\s+(.+)$/);
      if (contains) {
        for (const id of (contains[2] ?? "").split(/[\s,]+/).filter(Boolean)) {
          const node = nodes.find((candidate) => candidate.id === id);
          if (!node) throw new Error(`Line ${line.number}: unknown node "${id}".`);
          node.parentId = contains[1] ?? "";
        }
        continue;
      }
      const declaration = line.text.match(/^(node|server|database|container|actor|rounded|system|component|external|interface|usecase|device|execution|artifact|package|port|provided|required|queue|cloud)\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s\[\{]+))?(?:\s*\[([^\]]+)\])?\s*(\{)?$/);
      if (declaration) {
        const keyword = declaration[1] ?? "node";
        const id = declaration[2] ?? "";
        const attributes = attributesFrom(declaration[4]);
        const defaultShape = {
          node: "rectangle",
          system: "container",
          component: "component",
          external: "external",
          interface: "circle",
          usecase: "usecase",
          device: "uml-device",
          execution: "uml-execution",
          artifact: "uml-artifact",
          package: "container",
          port: "uml-port",
          provided: "circle",
          required: "uml-required-interface",
          queue: "database",
          cloud: "external"
        };
        const shape = attributes.shape ?? defaultShape[keyword] ?? keyword;
        delete attributes.shape;
        const activeContainer = containerStack[containerStack.length - 1];
        const node = {
          id,
          label: unquote(declaration[3], id),
          shape,
          ...activeContainer ? { parentId: activeContainer } : {},
          attributes
        };
        assertUnique(nodes, node, line.number);
        nodes.push(node);
        if (declaration[5]) {
          if (shape !== "container") throw new Error(`Line ${line.number}: only containers can open a block.`);
          containerStack.push(id);
        }
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (containerStack.length) throw new Error(`Container "${containerStack[containerStack.length - 1]}" is missing a closing brace.`);
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of connections) {
      if (!ids.has(edge.from)) throw new Error(`Connection references unknown node "${edge.from}".`);
      if (!ids.has(edge.to)) throw new Error(`Connection references unknown node "${edge.to}".`);
    }
    for (const node of nodes) if (node.parentId && !ids.has(node.parentId)) throw new Error(`Node "${node.id}" references unknown container "${node.parentId}".`);
    return { kind: "deployment", nodes, connections, groups: [], source };
  }
  function parseSequence(source) {
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    const groups = [];
    const openGroups = [];
    const ensureParticipant = (id, label = id, shape = "rectangle", line = 0) => {
      const existing = nodes.find((node2) => node2.id === id);
      if (existing) return existing;
      const node = { id, label, shape, attributes: {} };
      assertUnique(nodes, node, line);
      nodes.push(node);
      return node;
    };
    for (const line of lines.slice(1)) {
      const participant = line.text.match(/^(participant|actor)\s+([\w.-]+)(?:\s+(?:as\s+)?("(?:\\.|[^"])*"|.+))?$/i);
      if (participant) {
        ensureParticipant(participant[2] ?? "", unquote(participant[3]?.trim(), participant[2] ?? ""), participant[1]?.toLowerCase() === "actor" ? "actor" : "rectangle", line.number);
        continue;
      }
      const groupStart = line.text.match(/^(group|alt|opt|loop|par|break|critical)\s+(.+)$/i);
      if (groupStart) {
        const group = {
          id: uniqueId("group", groups.length),
          label: groupStart[2]?.trim() ?? "Group",
          kind: groupStart[1]?.toLowerCase() ?? "group",
          start: connections.length,
          end: connections.length
        };
        groups.push(group);
        openGroups.push(group);
        continue;
      }
      if (/^end$/i.test(line.text)) {
        const group = openGroups.pop();
        if (!group) throw new Error(`Line ${line.number}: unexpected end.`);
        group.end = Math.max(group.start, connections.length - 1);
        continue;
      }
      const message = line.text.match(/^([\w.-]+)\s*(-{1,2}>>?|-->>?)\s*([\w.-]+)\s*(?::\s*(.*))?$/);
      if (message) {
        const from = message[1] ?? "";
        const arrow = message[2] ?? "->";
        const to = message[3] ?? "";
        ensureParticipant(from, from, "rectangle", line.number);
        ensureParticipant(to, to, "rectangle", line.number);
        const activeGroup = openGroups[openGroups.length - 1];
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...message[4]?.trim() ? { label: message[4].trim() } : {},
          dashed: arrow.includes("--"),
          order: connections.length,
          ...activeGroup ? { groupId: activeGroup.id } : {}
        });
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (openGroups.length) throw new Error(`Group "${openGroups[openGroups.length - 1]?.label}" is missing end.`);
    return { kind: "sequence", nodes, connections, groups, source };
  }
  function parseSimpleDirectedGraph(source, kind, declarationShapes, defaultLabels = {}) {
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    const keywords = Object.keys(declarationShapes).join("|");
    const declarationPattern = new RegExp(`^(${keywords})\\s+([\\w.-]+)(?:\\s+("(?:\\\\.|[^"])*"|[^\\s\\[]+))?(?:\\s*\\[([^\\]]+)\\])?$`, "i");
    for (const line of lines.slice(1)) {
      const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|\.\.>)\s+([\w.-]+)(?:(?:\s*:\s*(.+))|(?:\s+(\[[^\]]+\](?:\s*\/\s*.+)?)))?$/);
      if (relation) {
        const from = relation[1] ?? "";
        const to = relation[3] ?? "";
        const rawLabel = (relation[4] ?? relation[5])?.trim();
        let label = rawLabel;
        let attributes;
        const portBlock = rawLabel?.match(/^(.*?)(?:\s*)\[([^\]]*(?:fromPort|from-port|toPort|to-port)\s*=.+)\]$/i);
        if (portBlock) {
          const parsed = attributesFrom(portBlock[2]);
          const fromPort = parsed.fromPort ?? parsed["from-port"];
          const toPort = parsed.toPort ?? parsed["to-port"];
          const validPorts = /* @__PURE__ */ new Set(["top", "right", "bottom", "left"]);
          if (fromPort && !validPorts.has(fromPort.toLowerCase())) throw new Error(`Line ${line.number}: invalid fromPort "${fromPort}".`);
          if (toPort && !validPorts.has(toPort.toLowerCase())) throw new Error(`Line ${line.number}: invalid toPort "${toPort}".`);
          attributes = {
            ...fromPort ? { fromPort: fromPort.toLowerCase() } : {},
            ...toPort ? { toPort: toPort.toLowerCase() } : {}
          };
          label = portBlock[1]?.trim() || void 0;
        }
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...label ? { label: unquote(label, "") } : {},
          dashed: (relation[2] ?? "").includes("--") || (relation[2] ?? "").includes(".."),
          order: connections.length,
          ...attributes ? { attributes } : {}
        });
        continue;
      }
      const declaration = line.text.match(declarationPattern);
      if (declaration) {
        const keyword = declaration[1]?.toLowerCase() ?? "";
        const id = declaration[2] ?? "";
        const attributes = attributesFrom(declaration[4]);
        const shape = attributes.shape ?? declarationShapes[keyword] ?? "rectangle";
        delete attributes.shape;
        const node = {
          id,
          label: unquote(declaration[3], defaultLabels[keyword] ?? id),
          shape,
          attributes
        };
        assertUnique(nodes, node, line.number);
        nodes.push(node);
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of connections) {
      if (!ids.has(edge.from)) throw new Error(`Connection references unknown node "${edge.from}".`);
      if (!ids.has(edge.to)) throw new Error(`Connection references unknown node "${edge.to}".`);
    }
    return { kind, nodes, connections, groups: [], source };
  }
  function parseFlowchart(source) {
    return parseSimpleDirectedGraph(source, "flowchart", {
      start: "rounded",
      end: "rounded",
      step: "rectangle",
      process: "rectangle",
      decision: "diamond",
      input: "parallelogram",
      output: "parallelogram",
      node: "rectangle"
    }, { start: "Start", end: "End" });
  }
  function parseGraph(source) {
    const lines = meaningfulLines(source);
    const directive = lines[0]?.text ?? "";
    const rawOptions = directive.replace(/^@graph\b/i, "").trim();
    let direction = "down";
    if (rawOptions) {
      const normalized = rawOptions.replace(/^\[|\]$/g, "").trim();
      const option = normalized.match(/^direction\s*=\s*(LR|TB|TD)$/i);
      if (!option) throw new Error(`Line ${lines[0]?.number ?? 1}: unsupported @graph option "${rawOptions}".`);
      direction = option[1]?.toUpperCase() === "LR" ? "right" : "down";
    }
    const nodes = [];
    const connections = [];
    const groupStack = [];
    const implicitIds = /* @__PURE__ */ new Set();
    const nodeById = () => new Map(nodes.map((node) => [node.id, node]));
    const activeGroup = () => groupStack[groupStack.length - 1];
    const ensureNode = (id) => {
      const existing = nodes.find((node2) => node2.id === id);
      if (existing) return existing;
      const parentId = activeGroup();
      const node = {
        id,
        label: id,
        shape: "rectangle",
        ...parentId ? { parentId } : {},
        attributes: {}
      };
      nodes.push(node);
      implicitIds.add(id);
      return node;
    };
    const declareNode = (node, line) => {
      const existing = nodes.find((candidate) => candidate.id === node.id);
      if (!existing) {
        nodes.push(node);
        return;
      }
      if (!implicitIds.has(node.id)) throw new Error(`Line ${line}: duplicate node id "${node.id}".`);
      existing.label = node.label;
      existing.shape = node.shape;
      existing.attributes = node.attributes;
      if (node.parentId) existing.parentId = node.parentId;
      else delete existing.parentId;
      implicitIds.delete(node.id);
    };
    for (const line of lines.slice(1)) {
      if (line.text === "}") {
        if (!groupStack.pop()) throw new Error(`Line ${line.number}: unexpected closing brace.`);
        continue;
      }
      const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|\.\.>)\s+([\w.-]+)(?:\s*:\s*(.+))?$/);
      if (relation) {
        const from = relation[1] ?? "";
        const arrow = relation[2] ?? "->";
        const to = relation[3] ?? "";
        ensureNode(from);
        ensureNode(to);
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...relation[4]?.trim() ? { label: unquote(relation[4].trim(), "") } : {},
          dashed: arrow.includes("--") || arrow.includes(".."),
          order: connections.length
        });
        continue;
      }
      const group = line.text.match(/^group\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"))?(?:\s*\[([^\]]+)\])?\s*\{$/i);
      if (group) {
        const id = group[1] ?? "";
        const attributes = attributesFrom(group[3]);
        const parentId = activeGroup();
        declareNode({
          id,
          label: unquote(group[2], id),
          shape: "container",
          ...parentId ? { parentId } : {},
          attributes
        }, line.number);
        groupStack.push(id);
        continue;
      }
      const declaration = line.text.match(/^(?:node\s+)?([\w.-]+)(?:\s+("(?:\\.|[^"])*"))?(?:\s*\[([^\]]+)\])?$/i);
      if (declaration) {
        const id = declaration[1] ?? "";
        const attributes = attributesFrom(declaration[3]);
        const shape = attributes.shape ?? "rectangle";
        delete attributes.shape;
        const parentId = activeGroup();
        declareNode({
          id,
          label: unquote(declaration[2], id),
          shape,
          ...parentId ? { parentId } : {},
          attributes
        }, line.number);
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (groupStack.length) throw new Error(`Group "${groupStack[groupStack.length - 1]}" is missing a closing brace.`);
    const ids = nodeById();
    for (const node of nodes) {
      if (node.parentId && !ids.has(node.parentId)) throw new Error(`Node "${node.id}" references unknown group "${node.parentId}".`);
    }
    return { kind: "graph", nodes, connections, groups: [], direction, source };
  }
  function parseState(source) {
    return parseSimpleDirectedGraph(source, "state", {
      initial: "initial-state",
      junction: "junction-state",
      choice: "choice-state",
      fork: "uml-bar",
      join: "uml-bar",
      history: "history-state",
      "deep-history": "deep-history-state",
      final: "final-state",
      terminate: "final-state",
      state: "rounded"
    }, { initial: "", junction: "", choice: "", fork: "", join: "", history: "H", "deep-history": "H*", final: "", terminate: "" });
  }
  function parseActivity(source) {
    return parseSimpleDirectedGraph(source, "activity", {
      start: "initial-state",
      action: "rounded",
      activity: "rounded",
      decision: "diamond",
      merge: "diamond",
      fork: "uml-bar",
      join: "uml-bar",
      object: "uml-object",
      end: "final-state"
    }, { start: "", fork: "", join: "", end: "" });
  }
  function normalizeCardinality(value) {
    const normalized = value.toLowerCase();
    return {
      one: "1",
      "zero-one": "0..1",
      many: "N",
      n: "N",
      "zero-many": "0..N"
    }[normalized] ?? value.toUpperCase();
  }
  function parseEr(source) {
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    let active;
    for (const line of lines.slice(1)) {
      if (active) {
        if (line.text === "}") {
          active.node.attributes.fields = JSON.stringify(active.fields);
          nodes.push(active.node);
          active = void 0;
          continue;
        }
        const field = line.text.match(/^([\w.-]+)\s+([^\s]+)(?:\s+(.+))?$/);
        if (!field) throw new Error(`Line ${line.number}: invalid entity field "${line.text}".`);
        const flags = (field[3] ?? "").split(/\s+/).filter(Boolean).map((flag) => {
          const normalized = flag.toLowerCase();
          if (["primary", "primary-key"].includes(normalized)) return "pk";
          if (["foreign", "foreign-key"].includes(normalized)) return "fk";
          return normalized;
        });
        active.fields.push({ name: field[1] ?? "", type: field[2] ?? "", flags });
        continue;
      }
      const entity = line.text.match(/^entity\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s\{]+))?\s*\{$/i);
      if (entity) {
        const id = entity[1] ?? "";
        const node = { id, label: unquote(entity[2], id), shape: "entity", attributes: {} };
        assertUnique(nodes, node, line.number);
        active = { node, fields: [], line: line.number };
        continue;
      }
      const relation = line.text.match(/^([\w.-]+)\s+(1|one|0\.\.1|zero-one|N|many|0\.\.N|zero-many)\s+(-{1,2}>|-->)\s+(1|one|0\.\.1|zero-one|N|many|0\.\.N|zero-many)\s+([\w.-]+)(?:\s*:\s*(.+))?$/i);
      if (relation) {
        const from = relation[1] ?? "";
        const to = relation[5] ?? "";
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...relation[6]?.trim() ? { label: relation[6].trim() } : {},
          dashed: (relation[3] ?? "").includes("--"),
          order: connections.length,
          attributes: {
            fromCardinality: normalizeCardinality(relation[2] ?? "1"),
            toCardinality: normalizeCardinality(relation[4] ?? "N")
          }
        });
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (active) throw new Error(`Entity "${active.node.id}" opened on line ${active.line} is missing a closing brace.`);
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of connections) {
      if (!ids.has(edge.from)) throw new Error(`Relation references unknown entity "${edge.from}".`);
      if (!ids.has(edge.to)) throw new Error(`Relation references unknown entity "${edge.to}".`);
    }
    return { kind: "er", nodes, connections, groups: [], source };
  }
  function parseComponent(source) {
    const model = parseDeployment(source);
    return { ...model, kind: "component" };
  }
  function parseClass(source) {
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    let active;
    for (const line of lines.slice(1)) {
      if (active) {
        if (line.text === "}") {
          active.node.attributes.members = JSON.stringify(active.members);
          nodes.push(active.node);
          active = void 0;
          continue;
        }
        const kind = active.node.attributes.kind === "enum" ? "literal" : line.text.includes("(") ? "operation" : "attribute";
        active.members.push({ text: line.text, kind });
        continue;
      }
      const declaration = line.text.match(/^(class|abstract|interface|enum)\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s\{]+))?\s*\{$/i);
      if (declaration) {
        const kind = declaration[1]?.toLowerCase() ?? "class";
        const id = declaration[2] ?? "";
        const node = {
          id,
          label: unquote(declaration[3], id),
          shape: "uml-class",
          attributes: { kind }
        };
        assertUnique(nodes, node, line.number);
        active = { node, members: [], line: line.number };
        continue;
      }
      const relation = line.text.match(/^([\w.-]+)(?:\s+"([^"]+)")?\s+(<\|--|<\|\.\.|\.\.\|>|--\|>|\*--|o--|\.\.>|-->|--)(?:\s+"([^"]+)")?\s+([\w.-]+)(?:\s*:\s*(.+))?$/);
      if (relation) {
        const left = relation[1] ?? "";
        const leftCardinality = relation[2];
        const operator = relation[3] ?? "--";
        const rightCardinality = relation[4];
        const right = relation[5] ?? "";
        const reversed = operator === "<|--" || operator === "<|..";
        const relationKind = {
          "<|--": "inheritance",
          "<|..": "realization",
          "..|>": "realization",
          "--|>": "inheritance",
          "*--": "composition",
          "o--": "aggregation",
          "..>": "dependency",
          "-->": "directed-association",
          "--": "association"
        }[operator] ?? "association";
        const from = reversed ? right : left;
        const to = reversed ? left : right;
        const fromCardinality = reversed ? rightCardinality : leftCardinality;
        const toCardinality = reversed ? leftCardinality : rightCardinality;
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...relation[6]?.trim() ? { label: relation[6].trim() } : {},
          dashed: ["realization", "dependency"].includes(relationKind),
          order: connections.length,
          attributes: {
            relation: relationKind,
            ...fromCardinality ? { fromCardinality } : {},
            ...toCardinality ? { toCardinality } : {}
          }
        });
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (active) throw new Error(`${active.node.attributes.kind} "${active.node.id}" opened on line ${active.line} is missing a closing brace.`);
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of connections) {
      if (!ids.has(edge.from)) throw new Error(`Relation references unknown classifier "${edge.from}".`);
      if (!ids.has(edge.to)) throw new Error(`Relation references unknown classifier "${edge.to}".`);
    }
    return { kind: "class", nodes, connections, groups: [], source };
  }
  function parseUsecase(source) {
    const transformed = source.split(/\r?\n/).map((line) => {
      const include = line.trim().match(/^include\s+([\w.-]+)\s+->\s+([\w.-]+)$/i);
      if (include) return `${include[1]} ..> ${include[2]}: \xABinclude\xBB`;
      const extend = line.trim().match(/^extend\s+([\w.-]+)\s+->\s+([\w.-]+)$/i);
      if (extend) return `${extend[1]} ..> ${extend[2]}: \xABextend\xBB`;
      const generalize = line.trim().match(/^generalize\s+([\w.-]+)\s+->\s+([\w.-]+)$/i);
      if (generalize) return `${generalize[1]} -> ${generalize[2]}: \xABgeneralize\xBB`;
      return line;
    }).join("\n");
    const parsed = parseDeployment(transformed);
    const connections = parsed.connections.map((edge) => {
      if (edge.label === "\xABgeneralize\xBB") {
        const { label: _label, ...withoutLabel } = edge;
        return { ...withoutLabel, dashed: false, attributes: { relation: "inheritance" } };
      }
      return edge.label === "\xABinclude\xBB" || edge.label === "\xABextend\xBB" ? { ...edge, attributes: { relation: "dependency" } } : edge;
    });
    return { ...parsed, kind: "usecase", connections, source };
  }
  function parseSlide(source) {
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    const contexts = [{}];
    let order = 0;
    const activeContext = () => contexts[contexts.length - 1] ?? contexts[0];
    const addNode = (node, line, connectable = true) => {
      assertUnique(nodes, node, line);
      node.attributes.order = String(order++);
      nodes.push(node);
      if (!connectable) return;
      const context = activeContext();
      if (context.pendingArrow !== void 0 && context.lastItemId) {
        connections.push({
          id: connectionId(context.lastItemId, node.id, connections.length),
          from: context.lastItemId,
          to: node.id,
          ...context.pendingArrow ? { label: context.pendingArrow } : {},
          dashed: false,
          order: connections.length
        });
        delete context.pendingArrow;
      }
      context.lastItemId = node.id;
    };
    for (const line of lines.slice(1)) {
      if (line.text === "}") {
        if (contexts.length === 1) throw new Error(`Line ${line.number}: unexpected closing brace.`);
        const closed = contexts.pop();
        if (closed?.pendingArrow !== void 0) throw new Error(`Line ${line.number}: arrow must be followed by another slide item.`);
        continue;
      }
      const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|-->)\s+([\w.-]+)(?:\s*:\s*(.+))?$/);
      if (relation) {
        const from = relation[1] ?? "";
        const to = relation[3] ?? "";
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...relation[4]?.trim() ? { label: unquote(relation[4].trim(), "") } : {},
          dashed: (relation[2] ?? "").includes("--"),
          order: connections.length
        });
        continue;
      }
      const layout = line.text.match(/^(row|column|grid)(?:\s+([\w.-]+))?(?:\s*\[([^\]]+)\])?\s*\{$/i);
      if (layout) {
        const kind = layout[1]?.toLowerCase() ?? "row";
        const id = layout[2] ?? uniqueId(kind, nodes.filter((node) => node.shape === "slide-group").length);
        const attributes = { ...attributesFrom(layout[3]), layout: kind };
        const parentId = activeContext().id;
        addNode({ id, label: attributes.label ?? "", shape: "slide-group", ...parentId ? { parentId } : {}, attributes }, line.number, false);
        contexts.push({ id });
        continue;
      }
      const heading = line.text.match(/^(title|subtitle)\s+("(?:\\.|[^"])*")(?:\s*\[([^\]]+)\])?$/i);
      if (heading) {
        const kind = heading[1]?.toLowerCase() ?? "title";
        const id = uniqueId(kind, nodes.filter((node) => node.shape === `slide-${kind}`).length);
        const parentId = activeContext().id;
        addNode({ id, label: unquote(heading[2], id), shape: `slide-${kind}`, ...parentId ? { parentId } : {}, attributes: attributesFrom(heading[3]) }, line.number, false);
        continue;
      }
      const item = line.text.match(/^(card|note|callout|badge|metric|bar|quote|milestone)\s+([\w.-]+)\s+("(?:\\.|[^"])*"|[^\s\[]+)(?:\s*\[([^\]]+)\])?$/i);
      if (item) {
        const kind = item[1]?.toLowerCase() ?? "card";
        const id = item[2] ?? "";
        const parentId = activeContext().id;
        addNode({ id, label: unquote(item[3], id), shape: `slide-${kind}`, ...parentId ? { parentId } : {}, attributes: attributesFrom(item[4]) }, line.number);
        continue;
      }
      const arrow = line.text.match(/^arrow(?:\s*:\s*(.+))?$/i);
      if (arrow) {
        const context = activeContext();
        if (!context.lastItemId) throw new Error(`Line ${line.number}: arrow must follow a slide item.`);
        if (context.pendingArrow !== void 0) throw new Error(`Line ${line.number}: consecutive arrows are not allowed.`);
        context.pendingArrow = arrow[1] ? unquote(arrow[1].trim(), "") : "";
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (contexts.length > 1) throw new Error(`Slide layout "${contexts[contexts.length - 1]?.id}" is missing a closing brace.`);
    if (contexts[0]?.pendingArrow !== void 0) throw new Error("Arrow must be followed by another slide item.");
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of connections) {
      if (!ids.has(edge.from)) throw new Error(`Connection references unknown slide item "${edge.from}".`);
      if (!ids.has(edge.to)) throw new Error(`Connection references unknown slide item "${edge.to}".`);
    }
    return { kind: "slide", nodes, connections, groups: [], source };
  }
  function createDirectedGraphDiagram(name, parse, defaultLayout = "hierarchical", direction = "right") {
    return {
      name,
      defaultLayout,
      parse,
      toLayoutModel(model, context) {
        return {
          kind: model.kind,
          items: model.nodes.map((node) => ({ ...node, size: context.measure(node.shape, node.label, node.attributes) })),
          connections: model.connections,
          groups: [],
          direction,
          minimumGap: context.theme.gapY,
          labelFontSize: context.theme.fontSize - 1
        };
      }
    };
  }
  function createFlowchartDiagram() {
    return createDirectedGraphDiagram("flowchart", parseFlowchart, "flowchart", "down");
  }
  function createGraphDiagram() {
    return {
      ...createDirectedGraphDiagram("graph", parseGraph, "graph", "down"),
      toLayoutModel(model, context) {
        return {
          kind: model.kind,
          items: model.nodes.map((node) => ({ ...node, size: context.measure(node.shape, node.label, node.attributes) })),
          connections: model.connections,
          groups: [],
          direction: model.direction ?? "down",
          minimumGap: context.theme.gapY,
          labelFontSize: context.theme.fontSize - 1
        };
      }
    };
  }
  function createActivityDiagram() {
    return createDirectedGraphDiagram("activity", parseActivity, "activity");
  }
  function createStateDiagram() {
    return createDirectedGraphDiagram("state", parseState);
  }
  function createErDiagram() {
    return createDirectedGraphDiagram("er", parseEr);
  }
  function createClassDiagram() {
    return createDirectedGraphDiagram("class", parseClass, "class");
  }
  function createSlideDiagram() {
    return createDirectedGraphDiagram("slide", parseSlide, "slide");
  }
  function createDeploymentDiagram() {
    return {
      name: "deployment",
      defaultLayout: "hierarchical",
      parse: parseDeployment,
      toLayoutModel(model, context) {
        return {
          kind: model.kind,
          items: model.nodes.map((node) => ({
            ...node,
            size: context.measure(node.shape, node.label, node.attributes)
          })),
          connections: model.connections,
          groups: model.groups,
          direction: "right",
          minimumGap: context.theme.gapY,
          labelFontSize: context.theme.fontSize - 1
        };
      }
    };
  }
  function createComponentDiagram() {
    return {
      ...createDeploymentDiagram(),
      name: "component",
      parse: parseComponent
    };
  }
  function createUsecaseDiagram() {
    return {
      ...createDeploymentDiagram(),
      name: "usecase",
      parse: parseUsecase
    };
  }
  function createSequenceDiagram() {
    return {
      name: "sequence",
      defaultLayout: "sequence",
      parse: parseSequence,
      toLayoutModel(model, context) {
        return {
          kind: model.kind,
          items: model.nodes.map((node) => ({ ...node, size: context.measure(node.shape, node.label, node.attributes) })),
          connections: model.connections,
          groups: model.groups,
          direction: "down",
          minimumGap: 54,
          labelFontSize: context.theme.fontSize - 1
        };
      }
    };
  }

  // src/png.ts
  async function svgToPngBlob(svg, size, defaultBackground, options = {}) {
    const scale = options.scale ?? 1;
    if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("PNG scale must be a positive number.");
    const width = Math.max(1, Math.round(size.width));
    const height = Math.max(1, Math.round(size.height));
    const clone = svg.cloneNode(true);
    const background = options.background === void 0 ? defaultBackground : options.background;
    clone.removeAttribute("xmlns");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.removeAttribute("tabindex");
    clone.removeAttribute("data-zoom");
    clone.classList.remove("is-panning");
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.minWidth = "0";
    clone.style.maxWidth = "none";
    clone.style.background = background ?? "transparent";
    for (const node of clone.querySelectorAll(".finch-node")) node.classList.remove("is-selected");
    for (const control of clone.querySelectorAll("[data-finch-editor-trigger]")) control.remove();
    const markup = new XMLSerializer().serializeToString(clone);
    const source = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const sourceUrl = URL.createObjectURL(source);
    try {
      const image = await loadImage(sourceUrl);
      const canvas = svg.ownerDocument.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Finch.js could not create a canvas for PNG export.");
      context.setTransform(scale, 0, 0, scale, 0, 0);
      if (background) {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(image, 0, 0, width, height);
      return await canvasToBlob(canvas);
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Finch.js could not render the SVG for PNG export."));
      image.src = url;
    });
  }
  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Finch.js could not encode the diagram as PNG."));
      }, "image/png");
    });
  }

  // src/instance.ts
  var DiagramInstance = class {
    constructor(source, options, registry) {
      __publicField(this, "host");
      __publicField(this, "sourceValue");
      __publicField(this, "registry");
      __publicField(this, "options");
      __publicField(this, "modelValue");
      __publicField(this, "geometryValue");
      __publicField(this, "overlayValue");
      __publicField(this, "editableValue", true);
      __publicField(this, "rendererValue");
      __publicField(this, "themeValue");
      __publicField(this, "layoutName", "");
      __publicField(this, "selectedIds", /* @__PURE__ */ new Set());
      __publicField(this, "layoutHistory", []);
      __publicField(this, "drag");
      __publicField(this, "pan");
      __publicField(this, "spacePressed", false);
      __publicField(this, "zoomValue", 1);
      __publicField(this, "zoomMode", "auto");
      __publicField(this, "resizeObserver");
      __publicField(this, "containerMinimumSizes", /* @__PURE__ */ new Map());
      __publicField(this, "destroyed", false);
      this.registry = registry;
      this.sourceValue = source;
      this.options = options;
      this.host = resolveTarget(options.target);
      this.overlayValue = parseOverlay(options.overlay);
      this.editableValue = options.overlay === void 0 ? options.editable ?? true : this.overlayValue.editable ?? options.editable ?? true;
      this.overlayValue.editable = this.editableValue;
      if (typeof options.zoom === "number") {
        this.zoomValue = options.zoom;
        this.zoomMode = "manual";
      } else if (options.zoom === "fit") this.zoomMode = "diagram";
      else if (options.zoom === "width") this.zoomMode = "width";
      this.rebuild({ force: false, preservePinned: true });
    }
    get svg() {
      return this.rendererValue.svg;
    }
    get source() {
      return this.sourceValue;
    }
    get model() {
      return this.modelValue;
    }
    get geometry() {
      return this.geometryValue;
    }
    get overlay() {
      return cloneOverlay(this.overlayValue);
    }
    get selection() {
      return [...this.selectedIds];
    }
    get zoom() {
      return this.zoomValue;
    }
    get editable() {
      return this.editableValue;
    }
    get canUndo() {
      return this.layoutHistory.length > 0;
    }
    get viewportMode() {
      return this.zoomMode;
    }
    setZoom(zoom) {
      this.assertActive();
      this.zoomMode = "manual";
      this.applyZoom(zoom, true);
      return this;
    }
    zoomIn(factor = 1.1) {
      return this.setZoom(this.zoomValue * Math.max(1.01, factor));
    }
    zoomOut(factor = 1.1) {
      return this.setZoom(this.zoomValue / Math.max(1.01, factor));
    }
    resetZoom() {
      return this.setZoom(1);
    }
    fit(mode = "diagram") {
      this.assertActive();
      if (!this.editableValue) return this;
      this.zoomMode = mode;
      this.applyViewport(true);
      const host = this.scrollHost();
      if (host) {
        host.scrollLeft = 0;
        host.scrollTop = 0;
      }
      return this;
    }
    update(source) {
      this.assertActive();
      const previousKind = this.modelValue.kind;
      this.sourceValue = source;
      const nextKind = getDiagramKind(source);
      if (previousKind !== nextKind) {
        this.overlayValue.diagram = nextKind;
        this.layoutHistory = [];
        this.selectedIds.clear();
      }
      this.rebuild({ force: false, preservePinned: true });
      return this;
    }
    setTheme(theme) {
      this.assertActive();
      this.options = { ...this.options, theme };
      this.rebuild({ force: false, preservePinned: true });
      return this;
    }
    setLayout(layout) {
      this.assertActive();
      if (!this.editableValue) return this;
      this.options = { ...this.options, layout };
      this.rebuild({ force: true, preservePinned: true });
      return this;
    }
    select(ids, additive = false) {
      if (!this.editableValue) return this;
      const values = typeof ids === "string" ? [ids] : ids;
      if (!additive) this.selectedIds.clear();
      const valid = new Set(this.geometryValue.nodes.map((node) => node.id));
      for (const id of values) if (valid.has(id)) this.selectedIds.add(id);
      this.rendererValue.setSelection(this.selectedIds);
      return this;
    }
    clearSelection() {
      this.selectedIds.clear();
      this.rendererValue.setSelection(this.selectedIds);
      return this;
    }
    pin(ids = this.selection) {
      if (!this.editableValue) return this;
      return this.setPin(ids, true);
    }
    unpin(ids = this.selection) {
      if (!this.editableValue) return this;
      return this.setPin(ids, false);
    }
    isPinned(id) {
      return this.overlayValue.nodes[id]?.pinned ?? false;
    }
    autoLayout(options = {}) {
      this.assertActive();
      if (!this.editableValue) return this;
      this.rememberLayout();
      const preservePinned = options.preservePinned ?? true;
      for (const [id, state] of Object.entries(this.overlayValue.nodes)) {
        if (!preservePinned || !state.pinned) delete this.overlayValue.nodes[id];
      }
      this.rebuild({ force: true, preservePinned });
      this.emitLayoutChange(this.geometryValue.nodes.map((node) => node.id));
      return this;
    }
    resetLayout() {
      if (!this.editableValue) return this;
      this.rememberLayout();
      this.overlayValue = createOverlay(this.editableValue);
      this.rebuild({ force: true, preservePinned: false });
      this.emitLayoutChange(this.geometryValue.nodes.map((node) => node.id));
      return this;
    }
    exportLayout(space = 2) {
      const activeIds = new Set(this.geometryValue.nodes.map((node) => node.id));
      const nodes = Object.fromEntries(Object.entries(this.overlayValue.nodes).filter(([id]) => activeIds.has(id)));
      return JSON.stringify({ version: 1, diagram: this.modelValue.kind, editable: this.editableValue, nodes }, null, space);
    }
    importLayout(layout) {
      const overlay = parseOverlay(layout);
      overlay.diagram = this.modelValue.kind;
      this.editableValue = overlay.editable ?? true;
      overlay.editable = this.editableValue;
      this.overlayValue = overlay;
      this.layoutHistory = [];
      this.rebuild({ force: false, preservePinned: true });
      return this;
    }
    undoLayout() {
      this.assertActive();
      if (!this.editableValue || !this.layoutHistory.length) return this;
      const current = this.overlayValue;
      const previous = this.layoutHistory.pop();
      previous.editable = this.editableValue;
      this.overlayValue = previous;
      this.rebuild({ force: false, preservePinned: true });
      const changedNodeIds = [.../* @__PURE__ */ new Set([...Object.keys(current.nodes), ...Object.keys(previous.nodes)])].filter((id) => JSON.stringify(current.nodes[id]) !== JSON.stringify(previous.nodes[id]));
      this.emitLayoutChange(changedNodeIds);
      return this;
    }
    setEditable(editable) {
      this.assertActive();
      if (this.editableValue === editable) return this;
      this.editableValue = editable;
      this.overlayValue.editable = editable;
      this.drag = void 0;
      this.pan = void 0;
      this.spacePressed = false;
      if (!editable) this.clearSelection();
      this.applyEditState();
      const detail = { editable, overlay: this.overlay };
      this.rendererValue.svg.dispatchEvent(new CustomEvent("finch:editchange", { detail, bubbles: true }));
      this.emitLayoutChange([]);
      return this;
    }
    saveLayout(target) {
      const json = this.exportLayout();
      let element = null;
      if (typeof target === "string") element = this.svg.ownerDocument.querySelector(target);
      else if (target) element = target;
      else if (this.host) element = this.host.parentElement?.querySelector("script[type='application/json'][data-finch-layout]") ?? null;
      if (element) {
        element.type = "application/json";
        element.dataset.finchLayout = "";
        element.textContent = json;
      }
      return json;
    }
    toSvgString() {
      const clone = this.svg.cloneNode(true);
      for (const control of clone.querySelectorAll("[data-finch-editor-trigger]")) control.remove();
      return new XMLSerializer().serializeToString(clone);
    }
    downloadSvg(filename = `${this.modelValue.kind}.svg`) {
      this.assertActive();
      const blob = new Blob([this.toSvgString()], { type: "image/svg+xml;charset=utf-8" });
      this.downloadBlob(blob, filename);
    }
    toPngBlob(options = {}) {
      this.assertActive();
      return svgToPngBlob(this.svg, this.geometryValue, this.themeValue.canvasColor, options);
    }
    async downloadPng(filename = `${this.modelValue.kind}.png`, options = {}) {
      const blob = await this.toPngBlob(options);
      this.downloadBlob(blob, filename);
    }
    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = this.svg.ownerDocument.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      this.svg.ownerDocument.body?.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        const view = this.svg.ownerDocument.defaultView;
        (view?.setTimeout ?? setTimeout)(() => URL.revokeObjectURL(url), 0);
      }
    }
    destroy() {
      if (this.destroyed) return;
      this.rendererValue.svg.dispatchEvent(new CustomEvent("finch:destroy", { bubbles: true }));
      this.rendererValue.svg.remove();
      this.resizeObserver?.disconnect();
      this.selectedIds.clear();
      this.destroyed = true;
    }
    rebuild(layoutOptions) {
      this.assertNotDestroyed();
      const kind = getDiagramKind(this.sourceValue);
      const diagram = this.registry.diagram(kind);
      this.themeValue = typeof this.options.theme === "object" ? this.options.theme : this.registry.theme(this.options.theme ?? "default");
      this.modelValue = diagram.parse(this.sourceValue);
      const layoutModel = diagram.toLayoutModel(this.modelValue, {
        theme: this.themeValue,
        measure: (shape, label, attributes) => this.registry.shape(shape).measure({ label, attributes, theme: this.themeValue })
      });
      this.layoutName = this.options.layout ?? diagram.defaultLayout;
      const previous = this.geometryValue?.kind === kind ? this.geometryValue : void 0;
      const layout = this.registry.layout(this.layoutName);
      this.containerMinimumSizes = new Map(layoutModel.items.filter((item) => item.shape === "container").map((item) => [item.id, { width: item.size.width, height: item.size.height }]));
      this.geometryValue = layout.layout(layoutModel, {
        overlay: this.overlayValue,
        ...previous ? { previous } : {},
        force: layoutOptions.force,
        preservePinned: layoutOptions.preservePinned
      });
      this.overlayValue.diagram = kind;
      this.overlayValue.editable = this.editableValue;
      const document = this.host?.ownerDocument ?? globalThis.document;
      if (!document) throw new Error("Finch.render() requires a browser Document or a target Element.");
      const nextRenderer = new SvgRenderer(document, this.themeValue, (name) => this.registry.shape(name), this.options.ariaLabel ?? `${kind} diagram`);
      nextRenderer.draw(this.geometryValue);
      const oldSvg = this.rendererValue?.svg;
      this.rendererValue = nextRenderer;
      if (this.host) {
        if (oldSvg?.parentElement === this.host) oldSvg.replaceWith(nextRenderer.svg);
        else this.host.replaceChildren(nextRenderer.svg);
      }
      this.bindInteractions();
      const active = new Set(this.geometryValue.nodes.map((node) => node.id));
      this.selectedIds = new Set([...this.selectedIds].filter((id) => active.has(id)));
      this.rendererValue.setSelection(this.selectedIds);
      for (const [id, state] of Object.entries(this.overlayValue.nodes)) this.rendererValue.setPinned(id, state.pinned);
      this.applyViewport(false);
      this.observeHost();
      this.rendererValue.svg.dispatchEvent(new CustomEvent("finch:render", { bubbles: true }));
    }
    bindInteractions() {
      this.applyEditState();
      if (this.options.interactive === false) return;
      const svg = this.rendererValue.svg;
      svg.addEventListener("pointerdown", (event) => this.onPointerDown(event));
      svg.addEventListener("pointermove", (event) => this.onPointerMove(event));
      svg.addEventListener("pointerup", (event) => this.onPointerUp(event));
      svg.addEventListener("pointercancel", (event) => this.onPointerUp(event));
      svg.addEventListener("wheel", (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        this.zoomMode = "manual";
        this.applyZoom(this.zoomValue * (event.deltaY < 0 ? 1.1 : 1 / 1.1), true, { clientX: event.clientX, clientY: event.clientY });
      }, { passive: false });
      svg.addEventListener("dblclick", (event) => {
        if (!this.editableValue) return;
        const id = this.rendererValue.nodeIdFromTarget(event.target);
        if (id) this.setPin(id, !this.isPinned(id));
      });
      svg.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this.clearSelection();
        if (this.editableValue && event.key.toLowerCase() === "p" && this.selectedIds.size) this.pin();
        if (event.key === " ") {
          this.spacePressed = true;
          event.preventDefault();
        }
        if (event.key === "+" || event.key === "=") this.zoomIn();
        if (event.key === "-") this.zoomOut();
        if (event.key === "0") this.resetZoom();
        if (event.key.toLowerCase() === "f") this.fit("diagram");
      });
      svg.addEventListener("keyup", (event) => {
        if (event.key === " ") this.spacePressed = false;
      });
      svg.addEventListener("blur", () => {
        this.spacePressed = false;
      });
    }
    onPointerDown(event) {
      const scrollHost = this.scrollHost();
      if (scrollHost && (event.button === 1 || event.button === 0 && (!this.editableValue || this.spacePressed || event.altKey))) {
        this.pan = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          scrollLeft: scrollHost.scrollLeft,
          scrollTop: scrollHost.scrollTop
        };
        this.rendererValue.svg.classList.add("is-panning");
        this.rendererValue.svg.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (!this.editableValue) return;
      if (event.button !== 0) return;
      const id = this.rendererValue.nodeIdFromTarget(event.target);
      if (!id) {
        if (!event.ctrlKey && !event.metaKey) this.clearSelection();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        if (this.selectedIds.has(id)) this.selectedIds.delete(id);
        else this.selectedIds.add(id);
      } else if (!this.selectedIds.has(id)) {
        this.selectedIds = /* @__PURE__ */ new Set([id]);
      }
      this.rendererValue.setSelection(this.selectedIds);
      const movingIds = this.withContainerDescendants(this.selectedIds);
      const origins = /* @__PURE__ */ new Map();
      for (const node of this.geometryValue.nodes) if (movingIds.has(node.id)) origins.set(node.id, { x: node.x, y: node.y });
      this.drag = {
        pointerId: event.pointerId,
        start: this.rendererValue.clientPoint(event),
        origins,
        resizedContainerIds: /* @__PURE__ */ new Set(),
        moved: false
      };
      this.rendererValue.svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
    onPointerMove(event) {
      if (this.pan && this.pan.pointerId === event.pointerId) {
        const host = this.scrollHost();
        if (host) {
          host.scrollLeft = this.pan.scrollLeft - (event.clientX - this.pan.clientX);
          host.scrollTop = this.pan.scrollTop - (event.clientY - this.pan.clientY);
        }
        return;
      }
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      const point = this.rendererValue.clientPoint(event);
      const dx = point.x - this.drag.start.x;
      const dy = point.y - this.drag.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) this.drag.moved = true;
      const map = new Map(this.geometryValue.nodes.map((node) => [node.id, node]));
      for (const [id, origin] of this.drag.origins) {
        const node = map.get(id);
        if (!node) continue;
        node.x = Math.max(8, origin.x + dx);
        node.y = Math.max(8, origin.y + dy);
      }
      for (const id of resizeAncestorContainers(
        this.geometryValue.nodes,
        this.drag.origins.keys(),
        this.containerMinimumSizes
      )) {
        this.drag.resizedContainerIds.add(id);
      }
      rerouteGeometry(this.geometryValue);
      this.rendererValue.updateGeometry(this.geometryValue);
    }
    onPointerUp(event) {
      if (this.pan && this.pan.pointerId === event.pointerId) {
        this.pan = void 0;
        this.rendererValue.svg.classList.remove("is-panning");
        if (this.rendererValue.svg.hasPointerCapture(event.pointerId)) this.rendererValue.svg.releasePointerCapture(event.pointerId);
        return;
      }
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      const drag = this.drag;
      this.drag = void 0;
      if (this.rendererValue.svg.hasPointerCapture(event.pointerId)) this.rendererValue.svg.releasePointerCapture(event.pointerId);
      if (!drag.moved) return;
      this.rememberLayout();
      const map = new Map(this.geometryValue.nodes.map((node) => [node.id, node]));
      for (const id of drag.origins.keys()) {
        const node = map.get(id);
        if (!node) continue;
        const previous = this.overlayValue.nodes[id];
        this.overlayValue.nodes[id] = {
          x: node.x,
          y: node.y,
          manual: true,
          pinned: previous?.pinned ?? false,
          ...previous?.width ? { width: previous.width } : {},
          ...previous?.height ? { height: previous.height } : {}
        };
      }
      for (const id of drag.resizedContainerIds) {
        if (drag.origins.has(id)) continue;
        const node = map.get(id);
        if (!node) continue;
        const previous = this.overlayValue.nodes[id];
        this.overlayValue.nodes[id] = {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          manual: true,
          pinned: previous?.pinned ?? false
        };
      }
      this.emitLayoutChange([.../* @__PURE__ */ new Set([...drag.origins.keys(), ...drag.resizedContainerIds])]);
    }
    setPin(ids, pinned) {
      if (!this.editableValue) return this;
      const values = typeof ids === "string" ? [ids] : ids;
      const map = new Map(this.geometryValue.nodes.map((node) => [node.id, node]));
      const changed = values.filter((id) => map.has(id) && this.isPinned(id) !== pinned);
      if (!changed.length) return this;
      this.rememberLayout();
      for (const id of changed) {
        const node = map.get(id);
        if (!node) continue;
        const existing = this.overlayValue.nodes[id];
        this.overlayValue.nodes[id] = {
          x: existing?.x ?? node.x,
          y: existing?.y ?? node.y,
          manual: existing?.manual ?? false,
          pinned,
          ...existing?.width ? { width: existing.width } : {},
          ...existing?.height ? { height: existing.height } : {}
        };
        this.rendererValue.setPinned(id, pinned);
      }
      this.emitLayoutChange(changed);
      return this;
    }
    rememberLayout() {
      this.layoutHistory.push(cloneOverlay(this.overlayValue));
    }
    withContainerDescendants(ids) {
      const result = new Set(ids);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of this.geometryValue.nodes) {
          if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
            result.add(node.id);
            changed = true;
          }
        }
      }
      return result;
    }
    emitLayoutChange(changedNodeIds) {
      const detail = { overlay: this.overlay, changedNodeIds };
      this.rendererValue.svg.dispatchEvent(new CustomEvent("finch:layoutchange", { detail, bubbles: true }));
    }
    applyEditState() {
      const svg = this.rendererValue?.svg;
      if (!svg) return;
      svg.dataset.editable = String(this.editableValue);
      svg.classList.toggle("is-view-only", !this.editableValue);
    }
    applyViewport(emit) {
      const host = this.scrollHost();
      const style = host ? this.rendererValue.svg.ownerDocument.defaultView?.getComputedStyle(host) : void 0;
      const horizontalPadding = (Number.parseFloat(style?.paddingLeft ?? "0") || 0) + (Number.parseFloat(style?.paddingRight ?? "0") || 0);
      const verticalPadding = (Number.parseFloat(style?.paddingTop ?? "0") || 0) + (Number.parseFloat(style?.paddingBottom ?? "0") || 0);
      const availableWidth = Math.max(1, (host?.clientWidth ?? this.geometryValue.width) - horizontalPadding);
      const availableHeight = Math.max(1, (host?.clientHeight ?? this.geometryValue.height) - verticalPadding);
      let zoom = this.zoomValue;
      if (this.zoomMode === "auto") zoom = Math.min(1, availableWidth / this.geometryValue.width);
      if (this.zoomMode === "width") zoom = availableWidth / this.geometryValue.width;
      if (this.zoomMode === "diagram") zoom = Math.min(availableWidth / this.geometryValue.width, availableHeight / this.geometryValue.height);
      this.applyZoom(zoom, emit);
    }
    applyZoom(zoom, emit, anchor) {
      const minimum = Math.max(0.05, this.options.minZoom ?? 0.25);
      const maximum = Math.max(minimum, this.options.maxZoom ?? 2);
      const next = Math.max(minimum, Math.min(maximum, Number.isFinite(zoom) ? zoom : 1));
      const host = this.scrollHost();
      const hostRect = host?.getBoundingClientRect();
      const viewportX = anchor && hostRect ? anchor.clientX - hostRect.left : (host?.clientWidth ?? 0) / 2;
      const viewportY = anchor && hostRect ? anchor.clientY - hostRect.top : (host?.clientHeight ?? 0) / 2;
      const contentX = host ? (host.scrollLeft + viewportX) / this.zoomValue : 0;
      const contentY = host ? (host.scrollTop + viewportY) / this.zoomValue : 0;
      this.zoomValue = next;
      const svg = this.rendererValue.svg;
      svg.style.width = `${this.geometryValue.width * next}px`;
      svg.style.height = `${this.geometryValue.height * next}px`;
      svg.style.minWidth = "0";
      svg.style.maxWidth = "none";
      svg.dataset.zoom = String(next);
      if (host && anchor) {
        host.scrollLeft = Math.max(0, contentX * next - viewportX);
        host.scrollTop = Math.max(0, contentY * next - viewportY);
      }
      if (emit) {
        const detail = { zoom: next, mode: this.zoomMode };
        svg.dispatchEvent(new CustomEvent("finch:zoomchange", { detail, bubbles: true }));
      }
    }
    observeHost() {
      this.resizeObserver?.disconnect();
      const host = this.scrollHost();
      const ResizeObserverConstructor = this.rendererValue.svg.ownerDocument.defaultView?.ResizeObserver;
      if (!host || !ResizeObserverConstructor) return;
      this.resizeObserver = new ResizeObserverConstructor(() => {
        if (this.zoomMode !== "manual") this.applyViewport(true);
      });
      this.resizeObserver.observe(host);
    }
    scrollHost() {
      const view = this.rendererValue?.svg.ownerDocument.defaultView;
      return view && this.host instanceof view.HTMLElement ? this.host : void 0;
    }
    assertActive() {
      this.assertNotDestroyed();
    }
    assertNotDestroyed() {
      if (this.destroyed) throw new Error("This Finch.js diagram has been destroyed.");
    }
  };
  function resolveTarget(target) {
    if (!target) return void 0;
    if (typeof target !== "string") return target;
    const element = globalThis.document?.querySelector(target);
    if (!element) throw new Error(`Finch.js target "${target}" was not found.`);
    return element;
  }

  // src/registry.ts
  var Registry = class {
    constructor() {
      __publicField(this, "diagrams", /* @__PURE__ */ new Map());
      __publicField(this, "shapes", /* @__PURE__ */ new Map());
      __publicField(this, "layouts", /* @__PURE__ */ new Map());
      __publicField(this, "themes", /* @__PURE__ */ new Map());
    }
    registerDiagram(name, plugin) {
      this.diagrams.set(normalize(name), { ...plugin, name: normalize(name) });
    }
    registerShape(name, plugin) {
      this.shapes.set(normalize(name), { ...plugin, name: normalize(name) });
    }
    registerLayout(name, plugin) {
      this.layouts.set(normalize(name), { ...plugin, name: normalize(name) });
    }
    registerTheme(name, theme) {
      this.themes.set(normalize(name), { ...theme, name: normalize(name) });
    }
    diagram(name) {
      const plugin = this.diagrams.get(normalize(name));
      if (!plugin) throw new Error(`Unknown diagram "${name}". Register it with Finch.registerDiagram().`);
      return plugin;
    }
    shape(name) {
      return this.shapes.get(normalize(name)) ?? this.shapes.get("rectangle") ?? missing("shape", name);
    }
    layout(name) {
      const plugin = this.layouts.get(normalize(name));
      if (!plugin) throw new Error(`Unknown layout "${name}". Register it with Finch.registerLayout().`);
      return plugin;
    }
    theme(name) {
      const theme = this.themes.get(normalize(name));
      if (!theme) throw new Error(`Unknown theme "${name}". Register it with Finch.registerTheme().`);
      return theme;
    }
  };
  function normalize(name) {
    return name.trim().toLowerCase();
  }
  function missing(kind, name) {
    throw new Error(`Unknown ${kind} "${name}".`);
  }

  // src/shapes.ts
  var MAX_NODE_LABEL_WIDTH = 216;
  function textUnits(value) {
    return [...value].reduce((total, character) => total + (/[\u3000-\u9fff\uff00-\uffef]/.test(character) ? 1 : 0.56), 0);
  }
  function textWidth(label, fontSize) {
    return Math.ceil(textUnits(label) * fontSize);
  }
  function wrappedLines(value, maximumWidth, fontSize) {
    const maximumUnits = Math.max(1, maximumWidth / fontSize);
    const lines = [];
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
  function wrappedLabelSize(label, context, options = {}) {
    const fontSize = context.theme.fontSize;
    const paddingX = options.paddingX ?? context.theme.nodePaddingX;
    const paddingY = options.paddingY ?? context.theme.nodePaddingY;
    const lineHeight = Math.ceil(fontSize * 1.4);
    const lines = wrappedLines(label, options.maximumTextWidth ?? MAX_NODE_LABEL_WIDTH, fontSize);
    return {
      width: Math.max(options.minimumWidth ?? 104, ...lines.map((line) => textWidth(line, fontSize) + paddingX * 2)),
      height: Math.max(options.minimumHeight ?? 46, lines.length * lineHeight + paddingY * 2)
    };
  }
  function baseSize(label, context) {
    return wrappedLabelSize(label, context);
  }
  function addLabel(group, context, yOffset = 0, paddingX = context.theme.nodePaddingX) {
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
      "font-weight": 560
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
  function groupFor(context) {
    return svgElement(context.document, "g", {
      class: `finch-shape finch-shape-${context.node.shape}`,
      "data-node-id": context.node.id,
      transform: `translate(${context.node.x} ${context.node.y})`
    });
  }
  var rectangleShape = {
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
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context);
      return group;
    }
  };
  var roundedShape = {
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
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context);
      return group;
    }
  };
  var databaseShape = {
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
        "Z"
      ].join(" ");
      group.append(svgElement(document, "path", {
        d: path,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      group.append(svgElement(document, "ellipse", {
        cx: node.width / 2,
        cy: cap,
        rx: node.width / 2,
        ry: cap,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth
      }));
      addLabel(group, context, 5);
      return group;
    }
  };
  var actorShape = {
    name: "actor",
    measure: ({ label, theme }) => ({
      width: Math.max(84, textWidth(label, theme.fontSize) + 22),
      height: 74
    }),
    render(context) {
      const { node, theme, document } = context;
      const group = groupFor(context);
      const cx = node.width / 2;
      const stroke = { fill: "none", stroke: theme.nodeStroke, "stroke-width": 1.7, "stroke-linecap": "round" };
      group.append(svgElement(document, "circle", { cx, cy: 10, r: 8, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": 1.7 }));
      group.append(svgElement(document, "path", { d: `M ${cx} 18 L ${cx} 42 M ${cx - 16} 28 L ${cx + 16} 28 M ${cx} 42 L ${cx - 12} 56 M ${cx} 42 L ${cx + 12} 56`, ...stroke }));
      const label = svgElement(document, "text", {
        x: cx,
        y: 72,
        "text-anchor": "middle",
        fill: theme.labelColor,
        "font-family": theme.fontFamily,
        "font-size": theme.fontSize,
        "font-weight": 560
      });
      label.textContent = node.label;
      group.append(label);
      return group;
    }
  };
  var containerShape = {
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
        "stroke-dasharray": "5 4"
      }));
      const text = svgElement(document, "text", {
        x: 16,
        y: 23,
        fill: theme.mutedColor,
        "font-family": theme.fontFamily,
        "font-size": theme.fontSize - 1,
        "font-weight": 650
      });
      text.textContent = node.label;
      group.append(text);
      return group;
    }
  };
  var serverShape = {
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
        filter: "url(#finch-shadow)"
      }));
      group.append(svgElement(document, "line", { x1: 13, y1: 18, x2: 13, y2: node.height - 18, stroke: theme.accentColor, "stroke-width": 3, "stroke-linecap": "round" }));
      addLabel(group, context);
      return group;
    }
  };
  var diamondShape = {
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
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context, 0, 27);
      return group;
    }
  };
  var parallelogramShape = {
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
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context, 0, context.theme.nodePaddingX + 11);
      return group;
    }
  };
  var circleShape = {
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
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context, 0, 15);
      return group;
    }
  };
  var initialStateShape = {
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
        "stroke-width": 1
      }));
      return group;
    }
  };
  var finalStateShape = {
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
        "stroke-width": 1.8
      }));
      group.append(svgElement(context.document, "circle", {
        cx: 14,
        cy: 14,
        r: 6,
        fill: context.theme.labelColor
      }));
      return group;
    }
  };
  var junctionStateShape = {
    name: "junction-state",
    measure: () => ({ width: 16, height: 16 }),
    render(context) {
      const group = groupFor(context);
      group.append(svgElement(context.document, "circle", {
        cx: 8,
        cy: 8,
        r: 7.5,
        fill: context.theme.labelColor
      }));
      return group;
    }
  };
  function entityFields(attributes) {
    try {
      const value = JSON.parse(attributes.fields ?? "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
  var entityShape = {
    name: "entity",
    measure: ({ label, attributes, theme }) => {
      const fields = entityFields(attributes);
      const fieldWidth = Math.max(0, ...fields.map((field) => textWidth(field.name, theme.fontSize - 1) + textWidth(field.type, theme.fontSize - 2) + 76));
      return {
        width: Math.max(190, textWidth(label, theme.fontSize + 1) + 44, fieldWidth),
        height: 40 + Math.max(1, fields.length) * 25 + 8
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
        filter: "url(#finch-shadow)"
      }));
      group.append(svgElement(document, "path", {
        d: `M ${theme.nodeRadius} 0 H ${node.width - theme.nodeRadius} Q ${node.width} 0 ${node.width} ${theme.nodeRadius} V 38 H 0 V ${theme.nodeRadius} Q 0 0 ${theme.nodeRadius} 0 Z`,
        fill: theme.containerFill,
        stroke: "none"
      }));
      group.append(svgElement(document, "line", { x1: 0, y1: 38, x2: node.width, y2: 38, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      const title = svgElement(document, "text", {
        x: 14,
        y: 24,
        fill: theme.labelColor,
        "font-family": theme.fontFamily,
        "font-size": theme.fontSize + 1,
        "font-weight": 700
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
          "font-weight": 750
        });
        badge.textContent = keyFlags.map((flag) => flag === "unique" ? "UQ" : flag.toUpperCase()).join("/");
        const name = svgElement(document, "text", { x: 46, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1, "font-weight": keyFlags.includes("pk") ? 650 : 500 });
        name.textContent = field.name;
        const type = svgElement(document, "text", { x: node.width - 12, y, "text-anchor": "end", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 2 });
        type.textContent = field.type;
        group.append(badge, name, type);
      });
      return group;
    }
  };
  var componentShape = {
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
    }
  };
  var externalShape = {
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
        filter: "url(#finch-shadow)"
      }));
      const stereotype = svgElement(document, "text", { x: node.width / 2, y: 19, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3, "font-weight": 650 });
      stereotype.textContent = "\xABexternal\xBB";
      const label = svgElement(document, "text", { x: node.width / 2, y: 41, "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize, "font-weight": 600 });
      label.textContent = node.label;
      group.append(stereotype, label);
      return group;
    }
  };
  function numericAttribute(attributes, name, fallback, minimum, maximum) {
    const value = Number(attributes[name]);
    return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
  }
  function slideLines(value, maximumUnits, maximumLines = 3) {
    const explicit = value.replace(/\\n/g, "\n").split("\n");
    const lines = [];
    const unitsFor = (text) => [...text].reduce((total, character) => total + (/[\u3000-\u9fff\uff00-\uffef]/.test(character) ? 1 : 0.56), 0);
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
    result[maximumLines - 1] = `${result[maximumLines - 1]?.replace(/[.…]+$/, "") ?? ""}\u2026`;
    return result;
  }
  function appendSlideText(group, context, value, options) {
    const lines = slideLines(value, Math.max(4, options.width / options.fontSize), options.maximumLines ?? 3);
    const text = svgElement(context.document, "text", {
      x: options.x,
      y: options.y,
      fill: options.color ?? context.theme.labelColor,
      "font-family": context.theme.fontFamily,
      "font-size": options.fontSize,
      "font-weight": options.weight ?? 500,
      "text-anchor": options.align ?? "start"
    });
    lines.forEach((line, index) => {
      const span = svgElement(context.document, "tspan", { x: options.x, dy: index === 0 ? 0 : options.lineHeight });
      span.textContent = line;
      text.append(span);
    });
    group.append(text);
  }
  var slideTitleShape = {
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
        align: centered ? "middle" : "start"
      });
      return group;
    }
  };
  var slideSubtitleShape = {
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
        align: centered ? "middle" : "start"
      });
      return group;
    }
  };
  var slideCardShape = {
    name: "slide-card",
    measure: ({ attributes }) => ({
      width: numericAttribute(attributes, "width", 224, 150, 440),
      height: numericAttribute(attributes, "height", attributes.body ? 126 : 92, 72, 260)
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
        filter: "url(#finch-shadow)"
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
    }
  };
  var slideNoteShape = {
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
    }
  };
  var slideCalloutShape = {
    name: "slide-callout",
    measure: ({ attributes }) => ({ width: numericAttribute(attributes, "width", 520, 240, 1e3), height: numericAttribute(attributes, "height", attributes.body ? 112 : 82, 70, 240) }),
    render(context) {
      const { node, theme, document } = context;
      const group = groupFor(context);
      group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 16, fill: theme.containerFill, stroke: theme.accentColor, "stroke-width": 2 }));
      appendSlideText(group, context, node.label, { x: 24, y: 36, width: node.width - 48, fontSize: 20, lineHeight: 25, weight: 760, color: theme.accentColor });
      if (node.attributes.body) appendSlideText(group, context, node.attributes.body, { x: 24, y: 68, width: node.width - 48, fontSize: 13, lineHeight: 18, color: theme.mutedColor });
      return group;
    }
  };
  var slideBadgeShape = {
    name: "slide-badge",
    measure: ({ label, theme }) => ({ width: Math.max(92, textWidth(label, theme.fontSize) + 34), height: 36 }),
    render(context) {
      const { node, theme, document } = context;
      const group = groupFor(context);
      group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 18, fill: theme.containerFill, stroke: theme.accentColor, "stroke-width": 1.4 }));
      appendSlideText(group, context, node.label, { x: node.width / 2, y: 23, width: node.width - 20, fontSize: 12, lineHeight: 14, weight: 720, color: theme.accentColor, align: "middle" });
      return group;
    }
  };
  var slideMetricShape = {
    name: "slide-metric",
    measure: ({ attributes }) => ({
      width: numericAttribute(attributes, "width", 224, 160, 440),
      height: numericAttribute(attributes, "height", 132, 104, 240)
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
        filter: "url(#finch-shadow)"
      }));
      appendSlideText(group, context, node.attributes.label ?? "METRIC", {
        x: 20,
        y: 27,
        width: node.width - 40,
        fontSize: 11,
        lineHeight: 14,
        weight: 740,
        color: theme.mutedColor
      });
      appendSlideText(group, context, node.label, {
        x: 20,
        y: 72,
        width: node.width - 40,
        fontSize: 31,
        lineHeight: 34,
        weight: 780,
        color: accent ? theme.accentColor : theme.labelColor,
        maximumLines: 1
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
          maximumLines: 1
        });
      }
      return group;
    }
  };
  var slideBarShape = {
    name: "slide-bar",
    measure: ({ attributes }) => ({
      width: numericAttribute(attributes, "width", 560, 260, 1e3),
      height: numericAttribute(attributes, "height", 68, 58, 120)
    }),
    render(context) {
      const { node, theme, document } = context;
      const group = groupFor(context);
      const maximum = numericAttribute(node.attributes, "max", 100, 1e-4, Number.MAX_SAFE_INTEGER);
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
    }
  };
  var slideQuoteShape = {
    name: "slide-quote",
    measure: ({ attributes }) => ({
      width: numericAttribute(attributes, "width", 640, 300, 1100),
      height: numericAttribute(attributes, "height", 172, 120, 320)
    }),
    render(context) {
      const { node, theme, document } = context;
      const group = groupFor(context);
      group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 18, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
      group.append(svgElement(document, "rect", { width: 8, height: node.height, rx: 4, fill: theme.accentColor }));
      const mark = svgElement(document, "text", { x: 28, y: 53, fill: theme.accentColor, "font-family": theme.fontFamily, "font-size": 52, "font-weight": 800 });
      mark.textContent = "\u201C";
      group.append(mark);
      appendSlideText(group, context, node.label, { x: 76, y: 43, width: node.width - 104, fontSize: 18, lineHeight: 25, weight: 620, maximumLines: 4 });
      if (node.attributes.by) {
        const attribution = node.attributes.role ? `${node.attributes.by} \xB7 ${node.attributes.role}` : node.attributes.by;
        appendSlideText(group, context, attribution, { x: 76, y: node.height - 24, width: node.width - 104, fontSize: 12, lineHeight: 15, weight: 650, color: theme.mutedColor, maximumLines: 1 });
      }
      return group;
    }
  };
  var slideMilestoneShape = {
    name: "slide-milestone",
    measure: ({ attributes }) => ({
      width: numericAttribute(attributes, "width", 200, 150, 380),
      height: numericAttribute(attributes, "height", attributes.body ? 148 : 116, 100, 260)
    }),
    render(context) {
      const { node, theme, document } = context;
      const group = groupFor(context);
      group.append(svgElement(document, "rect", { x: 14, y: 18, width: node.width - 14, height: node.height - 18, rx: 14, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
      group.append(svgElement(document, "circle", { cx: 20, cy: 38, r: 17, fill: theme.accentColor, stroke: theme.nodeFill, "stroke-width": 5 }));
      const dot = svgElement(document, "text", { x: 20, y: 43, "text-anchor": "middle", fill: theme.nodeFill, "font-family": theme.fontFamily, "font-size": 15, "font-weight": 800 });
      dot.textContent = node.attributes.step ?? "\u2022";
      group.append(dot);
      if (node.attributes.period) appendSlideText(group, context, node.attributes.period.toUpperCase(), { x: 50, y: 29, width: node.width - 68, fontSize: 10, lineHeight: 12, weight: 760, color: theme.accentColor, maximumLines: 1 });
      appendSlideText(group, context, node.label, { x: 50, y: node.attributes.period ? 54 : 43, width: node.width - 68, fontSize: 16, lineHeight: 20, weight: 720, maximumLines: 2 });
      if (node.attributes.body) appendSlideText(group, context, node.attributes.body, { x: 32, y: 88, width: node.width - 50, fontSize: 12, lineHeight: 17, color: theme.mutedColor, maximumLines: 3 });
      return group;
    }
  };
  var slideGroupShape = {
    name: "slide-group",
    measure: () => ({ width: 1, height: 1 }),
    render(context) {
      return groupFor(context);
    }
  };
  function umlMembers(attributes) {
    try {
      const value = JSON.parse(attributes.members ?? "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
  var umlClassShape = {
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
        stereotype.textContent = `\xAB${kind}\xBB`;
        group.append(stereotype);
      }
      const title = svgElement(document, "text", { x: node.width / 2, y: 30 + stereotypeHeight, "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize + 1, "font-weight": 720, "font-style": kind === "abstract" ? "italic" : void 0 });
      title.textContent = node.label;
      group.append(title, svgElement(document, "line", { x1: 0, y1: headerHeight, x2: node.width, y2: headerHeight, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      const attributes = members.filter((member) => member.kind !== "operation");
      const operations = members.filter((member) => member.kind === "operation");
      let y = headerHeight + 20;
      for (const member of attributes) {
        const text = svgElement(document, "text", { x: 12, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1, "font-style": member.kind === "literal" ? "italic" : void 0 });
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
    }
  };
  var usecaseShape = {
    name: "usecase",
    measure: ({ label, theme }) => wrappedLabelSize(label, { theme }, { minimumWidth: 150, minimumHeight: 72, paddingX: 27, paddingY: 18, maximumTextWidth: 180 }),
    render(context) {
      const { node, theme, document } = context;
      const group = groupFor(context);
      group.append(svgElement(document, "ellipse", { cx: node.width / 2, cy: node.height / 2, rx: node.width / 2, ry: node.height / 2, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
      addLabel(group, context, 0, 27);
      return group;
    }
  };
  var umlArtifactShape = {
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
      stereotype.textContent = "\xABartifact\xBB";
      group.append(stereotype);
      addLabel(group, context, 10, 20);
      return group;
    }
  };
  var umlDeviceShape = {
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
      stereotype.textContent = "\xABdevice\xBB";
      group.append(stereotype);
      addLabel(group, context, 11, 22);
      return group;
    }
  };
  var umlExecutionShape = {
    name: "uml-execution",
    measure: ({ label, theme }) => ({ width: Math.max(146, textWidth(label, theme.fontSize) + 46), height: 68 }),
    render(context) {
      const group = rectangleShape.render(context);
      group.append(svgElement(context.document, "rect", { x: 6, y: 6, width: context.node.width - 12, height: context.node.height - 12, rx: 4, fill: "none", stroke: context.theme.containerStroke, "stroke-width": 1 }));
      return group;
    }
  };
  var umlPortShape = {
    name: "uml-port",
    measure: () => ({ width: 26, height: 26 }),
    render(context) {
      const group = groupFor(context);
      group.append(svgElement(context.document, "rect", { x: 2, y: 2, width: 22, height: 22, fill: context.theme.nodeFill, stroke: context.theme.accentColor, "stroke-width": 1.7 }));
      return group;
    }
  };
  var umlRequiredInterfaceShape = {
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
    }
  };
  var umlBarShape = {
    name: "uml-bar",
    measure: () => ({ width: 96, height: 14 }),
    render(context) {
      const group = groupFor(context);
      group.append(svgElement(context.document, "rect", { y: 3, width: context.node.width, height: 8, rx: 3, fill: context.theme.labelColor }));
      return group;
    }
  };
  var choiceStateShape = {
    name: "choice-state",
    measure: () => ({ width: 32, height: 32 }),
    render(context) {
      const group = groupFor(context);
      group.append(svgElement(context.document, "polygon", { points: "16,1 31,16 16,31 1,16", fill: context.theme.nodeFill, stroke: context.theme.labelColor, "stroke-width": 1.5 }));
      return group;
    }
  };
  function historyShape(name, deep) {
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
      }
    };
  }
  var historyStateShape = historyShape("history-state", false);
  var deepHistoryStateShape = historyShape("deep-history-state", true);
  var umlObjectShape = {
    ...rectangleShape,
    name: "uml-object",
    render(context) {
      const group = rectangleShape.render(context);
      group.append(svgElement(context.document, "line", { x1: 18, y1: context.node.height / 2 + 11, x2: context.node.width - 18, y2: context.node.height / 2 + 11, stroke: context.theme.labelColor, "stroke-width": 1 }));
      return group;
    }
  };
  var builtInShapes = [
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
    umlObjectShape
  ];

  // src/theme.ts
  var defaultTheme = {
    name: "default",
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 13,
    labelColor: "#172033",
    mutedColor: "#64748b",
    nodeFill: "#ffffff",
    nodeStroke: "#cbd5e1",
    nodeStrokeWidth: 1.25,
    nodeRadius: 8,
    nodePaddingX: 16,
    nodePaddingY: 10,
    containerFill: "#f8fafc",
    containerStroke: "#94a3b8",
    edgeColor: "#64748b",
    edgeWidth: 1.5,
    accentColor: "#4f46e5",
    canvasColor: "#ffffff",
    shadow: "0 2px 8px rgba(15, 23, 42, 0.10)",
    gapX: 72,
    gapY: 32
  };
  var midnightTheme = {
    ...defaultTheme,
    name: "midnight",
    labelColor: "#e2e8f0",
    mutedColor: "#94a3b8",
    nodeFill: "#172033",
    nodeStroke: "#475569",
    containerFill: "#101827",
    containerStroke: "#475569",
    edgeColor: "#94a3b8",
    accentColor: "#818cf8",
    canvasColor: "#0b1120",
    shadow: "0 2px 10px rgba(0, 0, 0, 0.28)"
  };

  // docs/assets/green-warbler-finch-icon-128.png
  var green_warbler_finch_icon_128_default = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABgCAYAAADVenpJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAgYSURBVHhe7dx/iBxXHQDwTS2tNnf7/b69XG21WPyBYrH4CxtbNVohaFp/tNYgRGN6O+/Nm73LmcRqikJJabVIoKLpP6KggooQpbSFQv+QFEWtqSISgk0qaWh+3O3szOzOzu7dpXe9e/KdzYbjJWoutzO7sd8PfOFub/beg+/MvB/z5hUKjDHGGGOMMcYYY4wxxhhjjDHGGGOMMfaa1x4dv65ZUuubQm2KivJTNeHcEaDzlRbq7XPgfXLphl1vsL/D/g9EQt/RRu/xBrittqiYV8SEOSPGzSti3CyK7caIr6W/J+gdT1DvbYP6gP0/2GVoSoxtmsPKn2fFuFkSk6aJ2tTRNRGqcxGeDfp5RlSMEZNmVlTo2P1hyXm3/T/ZZaKK6uYmuk26uinp3URfTDTQTU+EEFQSgdodC/dLzWG1vr1OXW8Ke66wy2IDxhQKa3yQv6bkBxdI8MUEfY/uGHTnoGaihZ6JQLXr6L7UQv1MA5Q0N257vV02GwDTa71r6+jWKGl2YlcadCJQk0AnE90V6G6SoPdiA9QP46JTsstmA8BH59HVXP3Loy08ahKONkB9tym8TTMjE2+yy2MDJAR57wx6i9SO28lcSXSbgAUxYXyhbrPLYQMoBLmTEpagt+qrn5JPowIfnN12OWwABaB2d4d6q00+tfN066+BfMQuhw2gGPWjlPwY9XnJvJSgzl4AzoN2OWzAhEV9Sxu9Z7u9czuRKw26c9CQr47uc0uFyavt8tiAeBkqIkHvgQS9eUqYnchLDRo2ttCLTg2X32WXyQZEHdXWNnonaJjXi/a+GzQVTON9H+QX7TLZANhTKFxRR/dnr4rtZk6M9yzx3ZgXEyYA9Ue7XDYATpbkDS2h/9Cd1+918unqpxOghmqvXTbrM7/ovCMBfciIHeclrpdBd5YA5Zft8lkfVUX5VuqULXSSc17SehV0B6AJpKCotth1YH0SCana6J3Jor2349wJgOpzdj1YH8So91J7T8OyrJNPQc8NmqjnfdTvtevCcnRMbH1LE/WBXk3sXGykw0mQrWTIXWfXieVkamjspjZWTqYrcS6QpCwjbWZAHjKFza+z68VycAq2va+F3olOT/z8BGUdVG4IzhN2vVgOpkpjN3V6+tQJy66n/9+i8/BHPmbXjeWgBvJJGuP348rvxmK6AFTebdeNZSwS5fe00Fta7eqd1US6eARk3FrrXWvXj2UsQLl/qYdP81YadNdJ1w6C/I5dN5axENX3qN1f/nJG3kELSBLUC3QnsuvHMuQX5f3U7vfz1t+5+ncaH50f2/VjGfKF8xF6N48mX+yk5BltrJgY3ZfqWL7RriPLyIuFyavrqF6gE6BfvX4ql279prTTTKP8jF1HlqEaOPt69cLGpQYlP0a9FIL6Ja/7y1Ed3Q105fez3acOZzrnAOphu34sYzWUv6Ol2/28+jtDPrVvP8/552t6WK2n17XyfMK3PDo9/vQJ4/PPFj5+pV0/liFTMGtqIP/Srwc9VCbtBJKgnp7iHn/+AnQ+249HvBSUfNodpIXe3Ckov9+uG8tBAPL3NONnJyfr6CS/YmaxMl9F+Xm7XiwHAciHevnmzsUGJZ82fWqhN1vD8ga7XiwH1aKj6daf97CPkk/9jRlRiaeKzqfterEc+EX19gT1Yi+2aFlJ0Difhppt9P55Esd4gWe/1FH9Js8xP5VDzxbojhOj+9vDo5uH7DqxnETg/pwmXOwkZRHUvCSo09e6YtSv0pZuPMnTRwHKn1Dys3zGT5NJ1MHrPFOQCyHKegu9F3wo32PXh+WoCs59/2tTRtp2JR2aicqKOod0bDfptG9PhOqvMbrfpnV8NSzf+TJsEXZ9WI4ioW6jsf6Ftmihtpn2501fv0Z1LER5IAD1XACyTTN01FGkdXnRshOC2nRKOn2H+hINdBciVAdnhPdIA/Qn7PJZH5nC5qtCVH8/+27duSTS1U4JpN01I1RH6+j+yb9m/DozOj5UQ3dDAPIHIapnQlS1EFWD7go0Z3B2n176H6dDUL+KhPTOrJt4p10uGxA+qq3dTh+dAHQ1pw9ewD0dgdpXR/kx2pJ9GuRbl38vLE0WA1C3h0VnY1h0bkl/RueBFuoj9P0E9VKC+qc0pFz+PTZATGHPlRGqY3OikiafrvgW6lYD9MPVtc4bu8f9p4UXtELI/uxwYfNVtDlzgvpvpnRfejIloJ+Ki3qjfSzrs84KHxrvy06iUB+owtjb7OMuVQL67gS9g+mJUNpJTcOBGL0txwu8SXPfTWP5TuqZU6//7Dj86HHYhvZxvdAAdU8T3H90T4QE9b8S4d6fDI2N2seyHFC73EIv7bjRREwbK/M5TL2uSUA7CeqqKe3qDAmxEjRBP0hNkX0wy8jp691rQlRHuh0/uvVXi9Kzj8vKqeGtI5T0BPUslW1K36T3+g7x1u058bH8fVP6Oq2tOxmiWqiB/IV9TNaqxXs3zojKYozukRDUE/OdR87b7ONYj01D+fal0g7q6U8HoL4RoDzoj47n+uAlBLXLjHyLhptPd/scNOoIeYPHbFE720Tv8GJph6lBuRygejwuqg/Zx2UpEu6tIcrnZ7Hyo27yg5HycDgsP0xrD+3jWQ9F4D5Gna+aGNtUF+5HactW+5isBaAeCsH9gv05y1gM8oMJar8KYy79TtO/9jF5CEC6Abh32Z+zjEWobj5R+uqb7c/z1hyeGAlBOjSNbP+NvUbQtDINRe3PGWOMMcYYY4wxxhhjjDHGGGOMMcYYY+zy9G94ssRUzRj3BgAAAABJRU5ErkJggg==";

  // src/editor.ts
  var STYLE_ID = "finch-editor-styles";
  var editorCount = 0;
  var occurrenceByDocument = /* @__PURE__ */ new WeakMap();
  function attachEditor(instance, options = {}) {
    const host = instance.host;
    if (!host) throw new Error("Finch.attachEditor() requires an instance rendered into a target element.");
    const document = host.ownerDocument;
    installStyles(document);
    host.classList.add("finch-editor-host");
    const root = document.createElement("div");
    root.className = "finch-editor";
    root.innerHTML = `
    <section class="finch-editor__panel" id="finch-editor-panel" aria-label="Finch edit menu" hidden>
      <div class="finch-editor__header">
        <strong>Finch editor</strong>
        <span class="finch-editor__status" data-status>Saved</span>
      </div>
      <div class="finch-editor__tools" role="toolbar" aria-label="Diagram editing tools">
        <button type="button" data-action="zoom-out" aria-label="Zoom out">\u2212</button>
        <button type="button" data-action="zoom-reset" class="finch-editor__zoom" aria-label="Reset zoom to 100%">100%</button>
        <button type="button" data-action="zoom-in" aria-label="Zoom in">\uFF0B</button>
        <span class="finch-editor__separator" aria-hidden="true"></span>
        <button type="button" data-action="edit" aria-pressed="true">Edit ON</button>
        <button type="button" data-action="undo" aria-label="Undo layout change">Undo</button>
        <button type="button" data-action="pin">Pin / Unpin</button>
        <button type="button" data-action="layout">Auto layout</button>
        <button type="button" data-action="reset">Reset</button>
        <button type="button" data-action="fit">Fit</button>
        <button type="button" data-action="width">Width</button>
      </div>
      <div class="finch-editor__exports" role="group" aria-label="Save and export">
        <button type="button" data-action="save" class="finch-editor__save">Save</button>
        <button type="button" data-action="svg">SVG</button>
        <button type="button" data-action="png">PNG</button>
      </div>
      <label class="finch-editor__source">
        <span>Source</span>
        <textarea data-source spellcheck="false" aria-label="Finch diagram source"></textarea>
      </label>
      <p class="finch-editor__error" data-error role="alert" hidden></p>
    </section>
  `;
    host.after(root);
    const panel = required(root, ".finch-editor__panel");
    const panelId = `finch-editor-panel-${++editorCount}`;
    panel.id = panelId;
    const source = required(root, "[data-source]");
    const status = required(root, "[data-status]");
    const error = required(root, "[data-error]");
    const storageKey = options.storageKey ?? defaultStorageKey(instance);
    const storage = options.storage ?? localStorageAdapter(document);
    let timer;
    let dirty = false;
    let destroyed = false;
    let svgTrigger;
    let svgIcon;
    let svgBadge;
    let editableWhenOpen = instance.editable;
    function syncSvgTrigger(open) {
      svgTrigger?.setAttribute("aria-expanded", String(open));
      if (svgBadge) {
        svgBadge.setAttribute("fill", open ? "#e91e63" : "#fff");
        svgBadge.setAttribute("stroke", open ? "#e91e63" : "#fbcfe8");
      }
      if (svgIcon) svgIcon.style.filter = open ? "brightness(0) invert(1)" : "";
    }
    function installSvgTrigger() {
      const svg = instance.svg;
      const existing = svg.querySelector("[data-finch-editor-trigger]");
      if (existing) {
        svgTrigger = existing;
        svgIcon = existing.querySelector("image") ?? void 0;
        svgBadge = existing.querySelector("circle") ?? void 0;
        syncSvgTrigger(!panel.hidden);
        return;
      }
      const namespace = "http://www.w3.org/2000/svg";
      const group = document.createElementNS(namespace, "g");
      group.classList.add("finch-editor-trigger");
      group.dataset.finchEditorTrigger = "";
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.setAttribute("aria-label", "Toggle Finch edit menu");
      group.setAttribute("aria-controls", panelId);
      group.setAttribute("aria-expanded", "false");
      const origin = instance.geometry.origin ?? { x: 0, y: 0 };
      group.setAttribute("transform", `translate(${origin.x + 18} ${origin.y + Math.max(18, instance.geometry.height - 74)}) scale(.75)`);
      group.setAttribute("style", "cursor:pointer;outline:none");
      group.innerHTML = `
      <title>Finch editor</title>
      <circle cx="38" cy="38" r="36" fill="#fff" stroke="#fbcfe8" stroke-width="1.5"/>
      <image href="${green_warbler_finch_icon_128_default}" x="5" y="5" width="66" height="66" preserveAspectRatio="xMidYMid meet"/>
    `;
      const focusRing = group.querySelector("circle");
      group.addEventListener("focus", () => {
        focusRing.setAttribute("stroke", "#4f46e5");
        focusRing.setAttribute("stroke-width", "3");
      });
      group.addEventListener("blur", () => {
        focusRing.setAttribute("stroke", panel.hidden ? "#fbcfe8" : "#e91e63");
        focusRing.setAttribute("stroke-width", "1.5");
      });
      group.addEventListener("pointerdown", (event) => event.stopPropagation());
      group.addEventListener("click", (event) => {
        event.stopPropagation();
        setOpen(panel.hidden);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(panel.hidden);
      });
      svg.append(group);
      svgTrigger = group;
      svgIcon = group.querySelector("image") ?? void 0;
      svgBadge = focusRing;
      syncSvgTrigger(!panel.hidden);
    }
    source.value = instance.source;
    if (options.sourcePane === false) required(root, ".finch-editor__source").hidden = true;
    function setOpen(open) {
      const wasOpen = !panel.hidden;
      if (!open && (wasOpen || instance.editable)) editableWhenOpen = instance.editable;
      panel.hidden = !open;
      host.classList.toggle("finch-editor-open", open);
      if (open && !wasOpen) instance.setEditable(editableWhenOpen);
      if (!open && instance.editable) instance.setEditable(false);
      syncSvgTrigger(open);
    }
    function setDirty(next) {
      dirty = next;
      status.textContent = dirty ? "Unsaved" : "Saved";
      status.classList.toggle("is-dirty", dirty);
    }
    function showError(cause) {
      error.hidden = cause === void 0;
      error.textContent = cause === void 0 ? "" : cause instanceof Error ? cause.message : String(cause);
    }
    function updateControls() {
      const editable = instance.editable;
      const edit = required(root, "[data-action='edit']");
      edit.textContent = editable ? "Edit ON" : "Edit OFF";
      edit.setAttribute("aria-pressed", String(editable));
      required(root, "[data-action='undo']").disabled = !editable || !instance.canUndo;
      required(root, "[data-action='pin']").disabled = !editable || !instance.selection.length;
      for (const action of ["layout", "reset", "fit", "width"]) {
        required(root, `[data-action='${action}']`).disabled = !editable;
      }
      required(root, ".finch-editor__zoom").textContent = `${Math.round(instance.zoom * 100)}%`;
    }
    function save() {
      const value = {
        source: source.value,
        layout: JSON.parse(instance.exportLayout())
      };
      const saved = storage.save(storageKey, value);
      if (isPromiseLike(saved)) {
        return Promise.resolve(saved).then(() => {
          setDirty(false);
          showError();
        });
      }
      setDirty(false);
      showError();
    }
    function applyStoredState(value) {
      if (!value) return;
      if (typeof value.source === "string") {
        source.value = value.source;
        instance.update(value.source);
      }
      if (value.layout) instance.importLayout(value.layout);
      editableWhenOpen = instance.editable;
      setDirty(false);
      showError();
      updateControls();
    }
    function restore() {
      if (options.restore === false) return;
      try {
        const loaded = storage.load(storageKey);
        if (isPromiseLike(loaded)) {
          void Promise.resolve(loaded).then(applyStoredState).catch(showError);
        } else {
          applyStoredState(loaded);
        }
      } catch (cause) {
        showError(cause);
      }
    }
    function setSource(value) {
      source.value = value;
      instance.update(value);
      setDirty(true);
      updateControls();
    }
    function onPanelClick(event) {
      const button = event.target.closest("button[data-action]");
      const action = button?.dataset.action;
      if (!action) return;
      try {
        showError();
        if (action === "zoom-out") instance.zoomOut();
        if (action === "zoom-reset") instance.resetZoom();
        if (action === "zoom-in") instance.zoomIn();
        if (action === "edit") instance.setEditable(!instance.editable);
        if (action === "undo") instance.undoLayout();
        if (action === "pin") {
          for (const id of instance.selection) instance.isPinned(id) ? instance.unpin(id) : instance.pin(id);
        }
        if (action === "layout") instance.autoLayout();
        if (action === "reset") instance.resetLayout();
        if (action === "fit") instance.fit("diagram");
        if (action === "width") instance.fit("width");
        if (action === "save") {
          const saved = save();
          if (isPromiseLike(saved)) void Promise.resolve(saved).catch(showError);
        }
        if (action === "svg") instance.downloadSvg(options.svgFilename);
        if (action === "png") void instance.downloadPng(options.pngFilename).catch(showError);
        updateControls();
      } catch (cause) {
        showError(cause);
      }
    }
    function onSourceInput() {
      setDirty(true);
      if (timer !== void 0) document.defaultView?.clearTimeout(timer);
      timer = document.defaultView?.setTimeout(() => {
        try {
          instance.update(source.value);
          installSvgTrigger();
          showError();
          updateControls();
        } catch (cause) {
          showError(cause);
        }
      }, options.updateDelay ?? 180);
    }
    function onLayoutChange(event) {
      const detail = event.detail;
      if (detail?.changedNodeIds?.length) setDirty(true);
      installSvgTrigger();
      updateControls();
    }
    function onRender() {
      source.value = instance.source;
      setDirty(true);
      installSvgTrigger();
      updateControls();
    }
    function onKeydown(event) {
      if (event.key === "Escape" && !panel.hidden) setOpen(false);
    }
    panel.addEventListener("click", onPanelClick);
    source.addEventListener("input", onSourceInput);
    host.addEventListener("finch:layoutchange", onLayoutChange);
    host.addEventListener("finch:editchange", updateControls);
    host.addEventListener("finch:zoomchange", updateControls);
    host.addEventListener("finch:render", onRender);
    host.addEventListener("finch:destroy", destroyEditor);
    host.addEventListener("pointerup", updateControls);
    document.addEventListener("keydown", onKeydown);
    restore();
    editableWhenOpen = instance.editable;
    installSvgTrigger();
    setOpen(options.initiallyOpen ?? false);
    setDirty(false);
    updateControls();
    function destroyEditor() {
      if (destroyed) return;
      destroyed = true;
      if (timer !== void 0) document.defaultView?.clearTimeout(timer);
      host.removeEventListener("finch:layoutchange", onLayoutChange);
      host.removeEventListener("finch:editchange", updateControls);
      host.removeEventListener("finch:zoomchange", updateControls);
      host.removeEventListener("finch:render", onRender);
      host.removeEventListener("finch:destroy", destroyEditor);
      host.removeEventListener("pointerup", updateControls);
      document.removeEventListener("keydown", onKeydown);
      svgTrigger?.remove();
      svgIcon = void 0;
      svgBadge = void 0;
      host.classList.remove("finch-editor-host", "finch-editor-open");
      root.remove();
    }
    return {
      element: root,
      get dirty() {
        return dirty;
      },
      open: () => setOpen(true),
      close: () => setOpen(false),
      save,
      setSource,
      destroy: destroyEditor
    };
  }
  function defaultStorageKey(instance) {
    const document = instance.svg.ownerDocument;
    const pathname = document.defaultView?.location.pathname ?? "document";
    if (instance.host?.id) return `finch-editor:${pathname}:${instance.host.id}`;
    let state = occurrenceByDocument.get(document);
    if (!state) {
      state = { next: 1, byHost: /* @__PURE__ */ new WeakMap() };
      occurrenceByDocument.set(document, state);
    }
    const host = instance.host;
    let occurrence = host ? state.byHost.get(host) : void 0;
    if (occurrence === void 0) {
      occurrence = state.next++;
      if (host) state.byHost.set(host, occurrence);
    }
    return `finch-editor:${pathname}:${occurrence}`;
  }
  function localStorageAdapter(document) {
    return {
      load(key) {
        const saved = document.defaultView?.localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
      },
      save(key, value) {
        document.defaultView?.localStorage.setItem(key, JSON.stringify(value));
      }
    };
  }
  function isPromiseLike(value) {
    return value !== null && value !== void 0 && typeof value.then === "function";
  }
  function required(root, selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing Finch editor element: ${selector}`);
    return element;
  }
  function installStyles(document) {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    .finch-editor { position: relative; z-index: 1; color: #172033; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    .finch-editor *, .finch-editor *::before, .finch-editor *::after { box-sizing: border-box; }
    .finch-editor-host.finch-editor-open { border-bottom-right-radius: 0 !important; border-bottom-left-radius: 0 !important; }
    .finch-editor__panel { width: 100%; max-height: 720px; margin-top: -1px; overflow: auto; background: #fff; border: 1px solid #dbe3ee; border-top: 1px solid #e5eaf1; border-radius: 0 0 16px 16px; box-shadow: 0 14px 34px rgb(15 23 42 / 10%); }
    .finch-editor__panel[hidden] { display: none; }
    .finch-editor__header, .finch-editor__exports { display: flex; align-items: center; gap: 8px; padding: 11px 12px; }
    .finch-editor__header { justify-content: space-between; border-bottom: 1px solid #e5eaf1; }
    .finch-editor__header strong { font-size: 13px; letter-spacing: -0.01em; }
    .finch-editor__status { color: #64748b; font-size: 11px; }
    .finch-editor__status.is-dirty { color: #b45309; }
    .finch-editor__tools { display: flex; flex-wrap: wrap; gap: 7px; padding: 12px; border-bottom: 1px solid #e5eaf1; }
    .finch-editor button { min-height: 32px; padding: 6px 10px; color: #334155; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; font: 650 12px/1.4 inherit; cursor: pointer; }
    .finch-editor button:hover { color: #4338ca; border-color: #818cf8; }
    .finch-editor button:disabled { cursor: not-allowed; opacity: .45; }
    .finch-editor button[aria-pressed="true"] { color: #fff; background: #4f46e5; border-color: #4f46e5; }
    .finch-editor__zoom { min-width: 58px; font-variant-numeric: tabular-nums; }
    .finch-editor__separator { width: 1px; margin: 2px 2px; background: #e2e8f0; }
    .finch-editor__exports { justify-content: flex-end; border-bottom: 1px solid #e5eaf1; }
    .finch-editor .finch-editor__save { color: #fff; background: #172033; border-color: #172033; }
    .finch-editor__source { display: grid; gap: 7px; padding: 12px; }
    .finch-editor__source[hidden] { display: none; }
    .finch-editor__source > span { color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .finch-editor__source textarea { width: 100%; min-height: 220px; resize: vertical; padding: 13px 14px; color: #dbeafe; background: #111827; border: 0; border-radius: 10px; outline: 0; font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; tab-size: 2; }
    .finch-editor__source textarea:focus { box-shadow: 0 0 0 3px rgb(129 140 248 / 35%); }
    .finch-editor__error { margin: 0 12px 12px; padding: 9px 11px; color: #b91c1c; background: #fef2f2; border-radius: 8px; font-size: 12px; }
    .finch-editor__error[hidden] { display: none; }
    @media (max-width: 640px) { .finch-editor__panel { max-height: calc(100vh - 82px); } .finch-editor__source textarea { min-height: 170px; } }
  `;
    document.head.append(style);
  }

  // src/index.ts
  var FinchEngine = class {
    constructor() {
      __publicField(this, "registry", new Registry());
      this.registerDiagram("deployment", createDeploymentDiagram());
      this.registerDiagram("graph", createGraphDiagram());
      this.registerDiagram("sequence", createSequenceDiagram());
      this.registerDiagram("flowchart", createFlowchartDiagram());
      this.registerDiagram("state", createStateDiagram());
      this.registerDiagram("er", createErDiagram());
      this.registerDiagram("component", createComponentDiagram());
      this.registerDiagram("slide", createSlideDiagram());
      this.registerDiagram("class", createClassDiagram());
      this.registerDiagram("usecase", createUsecaseDiagram());
      this.registerDiagram("activity", createActivityDiagram());
      for (const shape of builtInShapes) this.registerShape(shape.name, shape);
      for (const layout of builtInLayouts) this.registerLayout(layout.name, layout);
      this.registerTheme("default", defaultTheme);
      this.registerTheme("midnight", midnightTheme);
    }
    render(source, options = {}) {
      const normalized = typeof options === "string" || isElement(options) ? { target: options } : options;
      const instance = new DiagramInstance(source, normalized, this.registry);
      if (instance.host && normalized.editor !== false) {
        attachEditor(instance, typeof normalized.editor === "object" ? normalized.editor : {});
      }
      return instance;
    }
    attachEditor(instance, options = {}) {
      return attachEditor(instance, options);
    }
    parse(source) {
      return this.registry.diagram(getDiagramKind(source)).parse(source);
    }
    registerDiagram(name, plugin) {
      this.registry.registerDiagram(name, plugin);
    }
    registerShape(name, plugin) {
      this.registry.registerShape(name, plugin);
    }
    registerLayout(name, plugin) {
      this.registry.registerLayout(name, plugin);
    }
    registerTheme(name, theme) {
      this.registry.registerTheme(name, theme);
    }
    createLayoutOverlay() {
      return createOverlay();
    }
  };
  function isElement(value) {
    return typeof Element !== "undefined" && value instanceof Element;
  }
  function createFinch() {
    return new FinchEngine();
  }
  var Finch = createFinch();
  var index_default = Finch;

  // src/browser.ts
  var browserFinch = Object.assign(index_default, { createFinch, defaultTheme, midnightTheme });
  globalThis.Finch = browserFinch;
})();
