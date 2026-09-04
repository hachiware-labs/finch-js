# Extending Finch.js

[日本語](./extensions_ja.md) · [Back to README](../README.md)

Finch.js exposes four plugin boundaries. A Diagram plugin turns source into meaning, a Shape plugin measures and draws one kind of node, a Layout plugin turns measured items into geometry, and a Theme plugin supplies visual tokens. These boundaries meet at public models, so an extension does not need access to the parser, router, scene, or SVG renderer internals.

The [browser extension example](../examples/extensions.html) combines all four plugins into a small service-map DSL. This guide explains why each part exists and what its contract must preserve.

## Start with an isolated engine

The default `Finch` export has a shared registry. That is convenient for a single application, but an isolated engine prevents tests, embedded widgets, or separate editors from changing one another.

```ts
import {
  createFinch,
  defaultTheme,
  type DiagramPlugin,
  type LayoutPlugin,
  type ShapePlugin,
  type ThemePlugin,
} from "finch-js";

const finch = createFinch();
```

Register every plugin before rendering a source that refers to it. Registry names are normalized to lowercase.

## Create a theme

A theme is a complete set of rendering and spacing tokens. Extend a built-in theme so new fields added by Finch.js receive a sensible default.

```ts
const oceanTheme: ThemePlugin = {
  ...defaultTheme,
  name: "ocean",
  labelColor: "#083344",
  mutedColor: "#0e7490",
  nodeFill: "#ecfeff",
  nodeStroke: "#67e8f9",
  containerFill: "#f0fdfa",
  containerStroke: "#5eead4",
  edgeColor: "#0891b2",
  accentColor: "#0f766e",
  canvasColor: "#f8fafc",
};

finch.registerTheme("ocean", oceanTheme);
```

The registry name passed to `registerTheme()` is the name applications use in `render({ theme: "ocean" })` and `setTheme("ocean")`. Keep the `name` field consistent as well, since consumers may inspect the theme object.

## Create a shape

A Shape plugin has two jobs: return the node size before layout and render an SVG group after layout. Both methods must agree on dimensions.

```ts
const SVG_NS = "http://www.w3.org/2000/svg";

function svg<K extends keyof SVGElementTagNameMap>(
  document: Document,
  tag: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

const serviceCard: ShapePlugin = {
  name: "service-card",

  measure({ label, theme }) {
    return {
      width: Math.max(160, label.length * theme.fontSize * 0.62 + 40),
      height: 68,
    };
  },

  render({ node, theme, document }) {
    const group = svg(document, "g", {
      transform: `translate(${node.x} ${node.y})`,
      "data-node-id": node.id,
    });
    const card = svg(document, "rect", {
      width: node.width,
      height: node.height,
      rx: 12,
      fill: theme.nodeFill,
      stroke: theme.nodeStroke,
      "stroke-width": theme.nodeStrokeWidth,
    });
    const accent = svg(document, "rect", {
      width: 6,
      height: node.height,
      rx: 3,
      fill: theme.accentColor,
    });
    const label = svg(document, "text", {
      x: 20,
      y: 29,
      fill: theme.labelColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize,
      "font-weight": 700,
    });
    label.textContent = node.label;

    const owner = svg(document, "text", {
      x: 20,
      y: 50,
      fill: theme.mutedColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize - 2,
    });
    owner.textContent = node.attributes.owner ?? "Unassigned";

    group.append(card, accent, label, owner);
    return group;
  },
};

finch.registerShape("service-card", serviceCard);
```

Set `data-node-id` on the returned group. Finch.js uses that attribute to connect pointer and keyboard interaction to the semantic node. Use `textContent` for labels and attribute values so user-provided text is not interpreted as SVG markup.

A shape can also behave like a custom icon. This example uses a hexagonal tile and a branching gateway glyph, but the same `render()` method can compose any SVG paths and primitives:

```ts
const gatewayIcon: ShapePlugin = {
  name: "gateway-icon",

  measure({ label, theme }) {
    return {
      width: Math.max(124, label.length * theme.fontSize * 0.66 + 28),
      height: 112,
    };
  },

  render({ node, theme, document }) {
    const centerX = node.width / 2;
    const group = svg(document, "g", {
      transform: `translate(${node.x} ${node.y})`,
      "data-node-id": node.id,
    });
    const tile = svg(document, "path", {
      d: `M ${centerX} 4 L ${centerX + 38} 24 L ${centerX + 38} 66 `
        + `L ${centerX} 86 L ${centerX - 38} 66 L ${centerX - 38} 24 Z`,
      fill: theme.nodeFill,
      stroke: theme.accentColor,
      "stroke-width": 2,
    });
    const glyph = svg(document, "path", {
      d: `M ${centerX} 28 V 43 M ${centerX} 43 L ${centerX - 20} 58 `
        + `M ${centerX} 43 L ${centerX + 20} 58`,
      fill: "none",
      stroke: theme.accentColor,
      "stroke-width": 3,
      "stroke-linecap": "round",
    });
    const label = svg(document, "text", {
      x: centerX,
      y: 105,
      "text-anchor": "middle",
      fill: theme.labelColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize,
    });
    label.textContent = node.label;
    group.append(tile, glyph, label);
    return group;
  },
};

finch.registerShape("gateway-icon", gatewayIcon);
```

Select it per node through the ordinary shape attribute: `service gateway "API Gateway" [shape=gateway-icon]`. The complete browser example adds endpoint circles to the glyph and lets the custom theme recolor the whole icon.

Custom shapes do not need a surrounding rectangle. The same example registers `star-icon` by calculating ten alternating outer and inner points, then passing them to an SVG polygon:

```js
const points = Array.from({ length: 10 }, (_, index) => {
  const radius = index % 2 === 0 ? 39 : 17;
  const angle = -Math.PI / 2 + index * Math.PI / 5;
  return `${centerX + Math.cos(angle) * radius},${44 + Math.sin(angle) * radius}`;
}).join(" ");

const star = svg(document, "polygon", {
  points,
  fill: theme.nodeFill,
  stroke: theme.accentColor,
  "stroke-width": 2.5,
  "stroke-linejoin": "round",
});
```

The inline script in `examples/extensions.html` also includes browser-window, shield, and document-stack shapes, alongside the built-in database cylinder. This makes the example a small shape gallery rather than a set of rectangle variations.

If a parser requests an unregistered shape, Finch.js currently falls back to the built-in rectangle. Registering explicit names is still preferable because it makes a missing extension visible in tests and documentation.

## Create a layout

A Layout plugin receives measured items, semantic connections, and the current layout context. It returns complete node, edge, group, and canvas geometry.

```ts
const serviceLanes: LayoutPlugin = {
  name: "service-lanes",

  layout(model, context) {
    // Calculate a default point for every measured item.
    // Then apply context.overlay, context.previous, force, and preservePinned.
    // Finally route every connection and calculate the canvas dimensions.
    return {
      kind: model.kind,
      nodes,
      edges,
      groups: [],
      width,
      height,
    };
  },
};

finch.registerLayout("service-lanes", serviceLanes);
```

The abbreviated body is intentional: the full, working implementation is embedded in [`examples/extensions.html`](../examples/extensions.html). A useful layout must make several decisions together, and copying only its coordinate loop would hide important responsibilities.

A layout should preserve these behaviors:

- Copy `id`, `label`, `shape`, `parentId`, and `attributes` from each `LayoutItem` into its `GeometryNode`.
- Return one `GeometryEdge` for each connection it can route, preserving connection metadata.
- Use `context.previous` during non-forced source updates when stable nodes should keep continuity.
- Apply manual overlay coordinates during normal rendering and preserve pinned overlays during forced auto-layout when `context.preservePinned` is true.
- Ignore unpinned manual coordinates during a forced auto-layout.
- Include enough canvas width and height for every node and group.

Finch.js reroutes edges after an interactive drag, but the plugin remains responsible for the initial routes. Edge point arrays should contain at least a start and an end point.

## Create a diagram type

A Diagram plugin separates syntax from presentation. `parse()` produces a `SemanticModel`; `toLayoutModel()` measures its nodes and prepares the chosen layout.

This example creates `@services` by translating its small syntax into the built-in deployment parser, then replacing the node shape:

```ts
const base = createFinch();

const servicesDiagram: DiagramPlugin = {
  name: "services",
  defaultLayout: "service-lanes",

  parse(source) {
    const translated = source
      .replace(/^\s*@services\b/im, "@deployment")
      .replace(/^\s*service\b/gim, "node");
    const model = base.parse(translated);

    return {
      ...model,
      kind: "services",
      source,
      nodes: model.nodes.map((node) => ({
        ...node,
        shape: node.shape === "rectangle" ? "service-card" : node.shape,
      })),
    };
  },

  toLayoutModel(model, context) {
    return {
      kind: model.kind,
      items: model.nodes.map((node) => ({
        ...node,
        size: context.measure(node.shape, node.label, node.attributes),
      })),
      connections: model.connections,
      groups: model.groups,
      direction: "right",
      minimumGap: context.theme.gapY,
    };
  },
};

finch.registerDiagram("services", servicesDiagram);
```

Using a separate `base` engine avoids calling the new `@services` plugin recursively. For a genuinely different grammar, implement `parse()` directly and return stable node and connection IDs. Parser errors should identify the input line and the invalid text when possible.

`context.measure()` is the boundary between a Diagram plugin and registered Shape plugins. Do not duplicate a shape's size calculation inside the diagram parser.

## Compose the plugins

After registration, applications use the extension through the ordinary render API:

```ts
const source = `@services
service gateway "API Gateway" [shape=gateway-icon tier=edge owner=Platform]
service orders "Order Service" [tier=application owner=Commerce]
service database "Order Database" [tier=data owner=Commerce]

gateway -> orders: HTTPS
orders -> database: SQL`;

const diagram = finch.render(source, {
  target: "#diagram",
  theme: "ocean",
});
```

The diagram chooses `service-lanes` as its default layout, and every parsed service requests `service-card`. Consumers can still call `setTheme()`, `setLayout()`, `update()`, and the persistence methods on the returned instance.

## Test extension contracts

Test each boundary at the smallest useful level:

1. Parse a representative source and assert stable IDs, attributes, connections, and useful error messages.
2. Measure and render the custom shape in a DOM test, checking its dimensions and `data-node-id`.
3. Run the layout with an empty overlay, a manual overlay, and a forced layout with pinned nodes.
4. Render the composed extension and verify that dragging, source updates, and overlay import still work.

Run Finch.js's own checks after changing a plugin example:

```bash
npm run check
```

The core contract is simple: parsers own meaning, shapes own node geometry, layouts own placement and routes, and themes own visual tokens. Keeping those responsibilities separate makes extensions compatible with the same editing and persistence loop as the built-in diagrams.
