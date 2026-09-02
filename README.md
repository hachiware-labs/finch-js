# Tit.js <img src="./docs/assets/shijukara-silhouette-upright-pink.png" alt="Upright pink bird" width="56" />

[日本語](./README_ja.md)

🐦 **Generate fast. Fine-tune freely.** Tit.js turns concise text into polished SVG diagrams in moments. Drag and pin nodes to refine the layout by hand without rewriting the source.

[![Custom service map showing browser, gateway, card, shield, star, database, and document shapes](./docs/assets/custom-service-map.png)](./examples/extensions.html)

## Representative examples

| UML class diagram | KPI summary slide |
| --- | --- |
| [![Order-domain UML class diagram with interfaces, inheritance, composition, dependencies, and multiplicities](./docs/assets/uml-class-diagram.png)](./examples/class.html) | [![KPI summary slide with three headline metrics and one decision callout](./docs/assets/slide-pattern-kpi.png)](./examples/slide-patterns.html) |
| Model structure and relationships with `@class` | Headline metrics and one decision with `@slide` |

## Quick start: two steps

### 1. Put this in an HTML file

Create `quickstart.html` in the repository root and paste in the following:

```html
<!doctype html>
<meta charset="UTF-8" />
<style>
  body { display: grid; grid-template-columns: 320px 1fr; min-height: 100vh; margin: 0; }
  textarea { padding: 16px; font: 14px/1.6 monospace; }
  #diagram { padding: 24px; }
</style>

<textarea id="source">@deployment
node browser "Web Browser" [shape=rounded]
server api "API Server"
database db "PostgreSQL"
browser -> api: HTTPS
api -> db: SQL</textarea>
<div id="diagram"></div>

<script src="./dist/tit.global.js"></script>
<script>
  const source = document.querySelector("#source");
  const host = document.querySelector("#diagram");
  const layoutKey = "tit-layout";
  const diagram = Tit.render(source.value, "#diagram");

  const saved = localStorage.getItem(layoutKey);
  if (saved) diagram.importLayout(saved);

  source.addEventListener("input", () => diagram.update(source.value));
  host.addEventListener("tit:layoutchange", ({ detail }) => {
    localStorage.setItem(layoutKey, JSON.stringify(detail.overlay));
  });
</script>
```

Open `quickstart.html` in a browser to turn the text into a diagram.

### 2. Drag and save

Drag nodes to refine the layout. Tit.js saves the layout in the browser automatically and restores it after a reload. Edit the text on the left to redraw the diagram while retaining positions for stable node IDs.

See the [two-step tutorial](./docs/tutorial.md) for details or browse the [advanced examples](./examples/README.md) for complete diagrams.

## Environment setup

Install Tit.js from npm:

```bash
npm install tit-js
```

Then import the default instance or create an isolated one:

```js
import Tit, { createTit } from "tit-js";
```

For a browser-global build, use a version-pinned CDN URL:

```html
<script src="https://cdn.jsdelivr.net/npm/tit-js@0.1.0/dist/tit.global.js"></script>
```

When developing Tit.js itself, install the repository dependencies and build it:

```bash
npm ci
npm run build
```

To serve the repository over HTTP, start a local server:

```bash
python -m http.server 8000
```

Open `http://127.0.0.1:8000/quickstart.html` in a browser.

## Codex skill

This repository includes the [`$tit` Codex skill](./.agents/skills/tit/SKILL.md) for creating or updating HTML pages that render Tit.js diagrams. It keeps the diagram source in a JavaScript string inside the HTML rather than delivering a standalone `.tit` file.

### Use it in this repository

No separate installation command is needed. Start Codex from this repository or one of its subdirectories; Codex discovers `.agents/skills/tit` automatically. Invoke it explicitly with a prompt such as:

```text
$tit Draw an activity diagram in HTML.
```

If the skill does not appear after cloning or updating the repository, restart Codex.

### Install it with the Skills CLI

The [`skills` CLI](https://github.com/vercel-labs/skills) can discover and install the skill. From a local Tit.js checkout, run:

```bash
npx skills add . --skill tit
```

After the repository is available on GitHub, install it directly with the repository name:

```bash
npx skills add <owner>/<repository> --skill tit
```

Add `--global` to make `$tit` available across all of your repositories:

```bash
npx skills add <owner>/<repository> --skill tit --global
```

To inspect the available skills without installing them, use `npx skills add <owner>/<repository> --list`. Codex detects newly installed skills automatically; restart Codex if `$tit` is not listed. See the [official OpenAI skill documentation](https://learn.chatgpt.com/docs/build-skills) for Codex skill scopes and discovery locations.

## Diagram types

Ten diagram types cover architecture, interactions, processes, state transitions, data models, component structures, presentation visuals, and core UML views.

| Directive | Use it for | Main declarations |
| --- | --- | --- |
| [`@deployment`](./examples/deployment.html) | Systems and infrastructure | `node`, `device`, `execution`, `artifact`, `server`, `database`, `container` |
| [`@sequence`](./examples/sequence.html) | Ordered interactions | `participant`, `actor`, messages, `group`, `alt`, `opt`, `loop`, `par`, `critical`, `break` |
| [`@flowchart`](./examples/flowchart.html) | Processes and decisions | `start`, `process`, `decision`, `input`, `output`, `end` |
| [`@state`](./examples/state.html) | State machines | `initial`, `state`, `choice`, `fork`, `join`, `history`, `deep-history`, `final` |
| [`@er`](./examples/er.html) | Entities and relationships | `entity`, fields, `pk`, `fk`, `unique`, cardinalities |
| [`@component`](./examples/component.html) | Software components and boundaries | `system`, `component`, `port`, `provided`, `required`, `artifact`, `external` |
| [`@slide`](./examples/slide.html) | Presentation diagrams | `title`, `subtitle`, layouts, `card`, `metric`, `bar`, `quote`, `milestone`, `callout`, `arrow` |
| [`@class`](./examples/class.html) | UML class diagrams | `class`, `abstract`, `interface`, `enum`, members, UML relationships, multiplicities |
| [`@usecase`](./examples/usecase.html) | UML use case diagrams | `actor`, `system`, `usecase`, `include`, `extend`, `generalize` |
| [`@activity`](./examples/activity.html) | UML activity diagrams | `action`, `decision`, `merge`, `fork`, `join`, `object`, guards |

For reusable KPI, data-story, roadmap, comparison, and customer-evidence recipes, open the [slide pattern guide](./docs/slide-patterns.md) or the [live pattern gallery](./examples/slide-patterns.html).

Solid arrows use `->`; dashed arrows use `-->`. Add a label after a colon:

```text
api -> worker: Dispatch job
worker --> api: Accepted
```

Node IDs and labels are separate. Keep the ID stable when changing the visible label so manual positions survive source updates:

```text
server billing-api "Billing API"
```

Comments can use a leading apostrophe on a full line, or `#` and `//` after whitespace.

## Editing and persistence

The default SVG is interactive:

- Drag a node to give it a manual position.
- Ctrl/⌘/Shift-click to select multiple nodes, then drag them together.
- Double-click a node to toggle its pinned state.
- Press `P` to pin selected nodes or `Escape` to clear the selection.
- Use Ctrl/⌘ + wheel to zoom, and Space/Alt + drag to pan a scrollable diagram.
- Call `autoLayout()` to arrange unpinned nodes again.
- Call `resetLayout()` to discard every manual position and pin.

The semantic source and manual layout are intentionally stored separately:

```js
const json = diagram.exportLayout();
localStorage.setItem("diagram-layout", json);

diagram.importLayout(localStorage.getItem("diagram-layout"));
```

When a drag, pin, or layout command changes the overlay, the SVG emits a bubbling `tit:layoutchange` event. Its `detail` contains `{ overlay, changedNodeIds }`.

```js
diagram.svg.addEventListener("tit:layoutchange", ({ detail }) => {
  localStorage.setItem("diagram-layout", JSON.stringify(detail.overlay));
});
```

Use `diagram.update(nextSource)` for live editors. Nodes with the same stable ID retain their existing layout. Use `diagram.toSvgString()` when you need the generated SVG markup.

Viewport zoom is separate from semantic geometry and the saved layout overlay. Automatic zoom only shrinks diagrams that are wider than their host; it never enlarges a small diagram beyond 100%.

```js
diagram.zoomIn();
diagram.zoomOut();
diagram.setZoom(1.25);
diagram.fit("diagram");
diagram.fit("width");
diagram.resetZoom();
```

Zoom is clamped to 25–200% by default. Override that range with `minZoom` and `maxZoom` in `Tit.render()`. A bubbling `tit:zoomchange` event exposes `{ zoom, mode }` for toolbar synchronization.

## Themes and extensions

Choose a built-in theme when rendering, or switch later:

```js
const diagram = Tit.render(source, {
  target: "#diagram",
  theme: "midnight",
});

diagram.setTheme("default");
diagram.setLayout("compact");
```

Create an isolated engine when extensions should not modify the shared default registry:

```js
import { createTit } from "tit-js";

const tit = createTit();
tit.registerDiagram("custom", diagramPlugin);
tit.registerShape("custom-shape", shapePlugin);
tit.registerLayout("custom-layout", layoutPlugin);
tit.registerTheme("brand", themePlugin);
```

See [Extending Tit.js](./docs/extensions.md) for complete plugin contracts and the [browser extension example](./examples/extensions.html) for a working custom diagram, card and icon shapes, layout, and theme.

## API at a glance

`Tit.render()` returns a `DiagramInstance` with these main operations:

| Operation | Purpose |
| --- | --- |
| `update(source)` | Reparse and redraw while preserving stable-node layout |
| `setTheme(theme)` / `setLayout(name)` | Change presentation |
| `select(ids)` / `clearSelection()` | Manage selection from code |
| `pin(ids)` / `unpin(ids)` | Protect or release manual positions |
| `autoLayout()` / `resetLayout()` | Recalculate or clear layout state |
| `setZoom(value)` / `zoomIn()` / `zoomOut()` | Control viewport magnification |
| `fit("diagram")` / `fit("width")` / `resetZoom()` | Fit or reset the viewport |
| `exportLayout()` / `importLayout(value)` | Persist the layout overlay |
| `saveLayout(target?)` | Write the overlay into a JSON script element |
| `toSvgString()` | Serialize the current SVG |
| `destroy()` | Remove the SVG and disable the instance |

The package includes TypeScript declarations for the public API and plugin interfaces.

## Development

```bash
npm run typecheck
npm test
npm run build
npm run check
```

`npm run check` runs type checking, tests, and a production build. Tit.js is licensed under the [MIT License](./LICENSE).

<p align="right">
  <img src="./docs/assets/shijukara-silhouette-flying-pink.png" alt="Pink bird flying out of Tit.js" width="180" />
</p>
