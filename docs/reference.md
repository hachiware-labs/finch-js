# Finch.js reference

[日本語](./reference_ja.md) · [Back to README](../README.md)

This page collects the details needed after the first tutorial: shared syntax, editor behavior, persistence, events, export, layout controls, and the public instance API. For a working source of every diagram type, use the [advanced examples](../examples/README.md).

## Shared syntax

The first meaningful line selects the diagram type. Declare nodes before connecting them, and keep machine-facing IDs separate from visible labels:

```text
@deployment
server billing-api "Billing API"
database ledger "Ledger"
billing-api -> ledger: SQL
```

- IDs may contain letters, digits, `_`, `-`, and `.`. Keep them stable so layout overlays survive label edits.
- Use `->` for a solid edge and `-->` for a dashed edge. Add a label after `:`.
- Put attributes in brackets: `[shape=rounded fromPort=right toPort=left]`.
- Use a leading apostrophe for a full-line comment. `#` and `//` also start comments when preceded by whitespace.

## Diagram declarations

| Directive | Common declarations | Complete example |
| --- | --- | --- |
| `@deployment` | `node`, `device`, `execution`, `artifact`, `server`, `database`, `container` | [deployment.html](../examples/deployment.html) |
| `@sequence` | `participant`, `actor`, messages, `group`, `alt`, `opt`, `loop`, `par`, `critical`, `break` | [sequence.html](../examples/sequence.html) |
| `@flowchart` | `start`, `process`, `decision`, `input`, `output`, `end` | [flowchart.html](../examples/flowchart.html) |
| `@state` | `initial`, `state`, `choice`, `fork`, `join`, `history`, `deep-history`, `final` | [state.html](../examples/state.html) |
| `@er` | `entity`, fields, `pk`, `fk`, `unique`, cardinalities | [er.html](../examples/er.html) |
| `@component` | `system`, `component`, `port`, `provided`, `required`, `artifact`, `external` | [component.html](../examples/component.html) |
| `@slide` | `title`, `subtitle`, layout blocks, `card`, `metric`, `bar`, `quote`, `milestone`, `callout`, `arrow` | [slide.html](../examples/slide.html) |
| `@class` | `class`, `abstract`, `interface`, `enum`, members, UML relations and multiplicities | [class.html](../examples/class.html) |
| `@usecase` | `actor`, `system`, `usecase`, `include`, `extend`, `generalize` | [usecase.html](../examples/usecase.html) |
| `@activity` | `action`, `decision`, `merge`, `fork`, `join`, `object`, guards | [activity.html](../examples/activity.html) |

## Standard editor

`Finch.render()` adds the standard editor unless `editor: false` is passed. A Finch button in the SVG's lower-left opens the HTML panel below the diagram. While the panel is closed, the diagram is in view mode; opening it restores the editing state from that session.

```js
const diagram = Finch.render(source, {
  target: "#diagram",
  editor: { storageKey: "system-map" },
});
```

The panel provides zoom, Edit ON/OFF, Undo, Pin/Unpin, Auto layout, Reset, Fit, Width, Save, SVG, PNG, and a live source field. Save is explicit. Switching Edit ON/OFF never persists source or layout.

In edit mode:

- Drag a node to add a manual position.
- Double-click a node to toggle its pin.
- Ctrl/⌘/Shift-click to select multiple nodes, then drag them together.
- Press `P` to pin selected nodes and `Escape` to clear the selection.
- Use Ctrl/⌘ + wheel to zoom and Space/Alt + drag to pan.
- `autoLayout()` recalculates unpinned nodes.
- `resetLayout()` discards every manual position and pin.

In view mode, a plain left drag pans instead of moving nodes. Zoom operations remain available; layout editing, selection, pinning, and Fit are disabled.

## Source updates and stable IDs

```js
diagram.update(nextSource);
```

`update()` reparses and redraws the diagram. Existing nodes with the same IDs retain their layout state, while new nodes enter automatic layout. Generated SVG markup is available through `toSvgString()`.

Long visible labels wrap at word boundaries when possible, or between characters when necessary. Node height expands so all lines remain readable.

## Persistence

The semantic source and manual layout overlay are separate. The overlay contains node positions, sizes where needed, pins, and the edit-mode state.

```js
const json = diagram.exportLayout();
localStorage.setItem("diagram-layout", json);

diagram.importLayout(localStorage.getItem("diagram-layout"));
```

`saveLayout(target?)` returns the same JSON and can also write it into a `script[type="application/json"][data-finch-layout]` element. An overlay without an `editable` field is restored in edit mode for backward compatibility.

## Events

Events bubble from the rendered SVG, so a listener on the host element can receive them.

| Event | `detail` | Use |
| --- | --- | --- |
| `finch:layoutchange` | `{ overlay, changedNodeIds }` | Mark a custom editing session dirty when `changedNodeIds` is non-empty |
| `finch:editchange` | `{ editable, overlay }` | Synchronize a custom Edit control |
| `finch:zoomchange` | `{ zoom, mode }` | Synchronize zoom controls |

Persist only in response to an explicit Save action. An edit-mode change produces an empty `changedNodeIds` array and should not save by itself.

## Layout behavior

Flowcharts progress from top to bottom by default, with branches at the same rank spreading horizontally. State fork/join regions also read vertically: fork above, parallel states in the middle, join below, then the successor.

Deployment containers accept `layout=row`, `layout=column`, or `layout=grid`. A grid may set `columns`; direct children may set `order`, `row`, and `column`. A top-level container with `place=below` stays below its predecessor instead of opening another horizontal band. These are automatic-layout hints; exact manual coordinates remain in the overlay.

Transitions connected to a state fork or join automatically use vertical ports. Override an endpoint with `fromPort` or `toPort`; accepted values are `top`, `right`, `bottom`, and `left`.

Built-in routing prefers, in order: avoiding nodes, reducing edge crossings, reducing right-angle bends, and shorter routes. If overlapping nodes leave no safe route, Finch.js keeps the established basic route rather than dropping the edge.

## Zoom and export

```js
diagram.zoomIn();
diagram.zoomOut();
diagram.setZoom(1.25);
diagram.fit("diagram");
diagram.fit("width");
diagram.resetZoom();
```

Zoom is clamped to 25–200% by default; use `minZoom` and `maxZoom` in `Finch.render()` to change the range. Viewport zoom does not change semantic geometry or the saved overlay.

```js
diagram.downloadSvg("system-map.svg");
await diagram.downloadPng("system-map.png", { scale: 2 });
const transparentPng = await diagram.toPngBlob({ background: null });
```

SVG and PNG exports include the current manual positions and omit the editor button.

## Themes and extensions

```js
const diagram = Finch.render(source, {
  target: "#diagram",
  theme: "midnight",
});

diagram.setTheme("default");
diagram.setLayout("compact");
```

Use `createFinch()` to create an isolated registry before registering custom diagrams, shapes, layouts, or themes. See [Extending Finch.js](./extensions.md) for the plugin contracts and [extensions.html](../examples/extensions.html) for a complete composition.

## Instance API

| Operation | Purpose |
| --- | --- |
| `update(source)` | Reparse and redraw while preserving stable-node layout |
| `setTheme(theme)` / `setLayout(name)` | Change presentation |
| `select(ids)` / `clearSelection()` | Manage selection from code |
| `pin(ids)` / `unpin(ids)` | Protect or release manual positions |
| `autoLayout()` / `resetLayout()` / `undoLayout()` | Recalculate, clear, or undo layout state |
| `setZoom(value)` / `zoomIn()` / `zoomOut()` | Control viewport magnification |
| `setEditable(value)` / `editable` / `canUndo` | Change edit mode and inspect Undo availability |
| `fit("diagram")` / `fit("width")` / `resetZoom()` | Fit or reset the viewport |
| `exportLayout()` / `importLayout(value)` | Persist the layout overlay |
| `saveLayout(target?)` | Return overlay JSON and optionally write it to a JSON script element |
| `toSvgString()` | Serialize the current SVG |
| `downloadSvg(filename?)` | Download the current diagram as SVG |
| `toPngBlob(options?)` | Create a PNG `Blob` |
| `downloadPng(filename?, options?)` | Download the current diagram as PNG |
| `Finch.attachEditor(instance, options?)` | Add the standard editor later |
| `destroy()` | Remove the SVG and disable the instance |

The package includes TypeScript declarations for the public API and plugin interfaces.
