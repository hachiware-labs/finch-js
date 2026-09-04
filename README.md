# Finch.js <img src="./docs/assets/green-warbler-finch-silhouette-profile-pink.png" alt="Pink silhouette of a Green Warbler-Finch in profile" width="56" align="middle" />

[日本語](./README_ja.md)

🐦 **Generate fast. Fine-tune freely.** Turn concise text into polished SVG diagrams, then drag and pin nodes until the layout feels right. Stable node IDs keep those decisions when the text changes.

[![Finch.js keeps a hand-tuned layout while the diagram source changes](./docs/assets/finch-editing-demo.gif)](./examples/readme-demo.html)

[Tutorial](./docs/tutorial.md) · [Example gallery](./examples/README.md) · [npm package](https://www.npmjs.com/package/@hachiware-labs/finch-js)

## Quick start

Save the following as `diagram.html` and open it in a browser. The example uses the version-pinned browser build, so no installation or build step is required.

```html
<!doctype html>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { margin: 0; }
  #diagram { min-height: 100vh; overflow: auto; padding: 24px; }
</style>

<main id="diagram" aria-label="Order fulfillment flowchart"></main>

<script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.1/dist/finch.global.js"></script>
<script>
  const orderFlowSource = `
@flowchart
start received "Order received"
process validate "Check inventory"
decision available "In stock?"
process reserve "Reserve items"
end confirmed "Order confirmed"
end backorder "Await restock"

received -> validate
validate -> available
available -> reserve: Yes
available -> backorder: No
reserve -> confirmed
  `.trim();

  Finch.render(orderFlowSource, {
    target: "#diagram",
    editor: { storageKey: "order-flow" },
  });
</script>
```

Open the Finch button in the lower-left, drag a node, then double-click it to pin the position. Change a visible label in the source and watch the diagram update without losing the hand-tuned layout. Nothing is persisted until you press Save.

IDs and labels are separate. Keep `validate` stable while changing `"Check inventory"`; the saved position belongs to the ID.

## Install

```bash
npm install @hachiware-labs/finch-js
```

```js
import Finch, { createFinch } from "@hachiware-labs/finch-js";
```

Use the browser-global build from a CDN when a script tag is more convenient:

```html
<script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.1/dist/finch.global.js"></script>
```

## Diagram types

| Directive | Use it for | Example |
| --- | --- | --- |
| `@deployment` | Systems and infrastructure | [Deployment](./examples/deployment.html) |
| `@sequence` | Ordered interactions | [Sequence](./examples/sequence.html) |
| `@flowchart` | Processes and decisions | [Flowchart](./examples/flowchart.html) |
| `@state` | Lifecycles and transitions | [State](./examples/state.html) |
| `@er` | Entities and relationships | [ER](./examples/er.html) |
| `@component` | Software boundaries and interfaces | [Component](./examples/component.html) |
| `@slide` | Presentation visuals | [Slide](./examples/slide.html) |
| `@class` | Classes and UML relationships | [Class](./examples/class.html) |
| `@usecase` | Actors and system goals | [Use case](./examples/usecase.html) |
| `@activity` | Actions and control flow | [Activity](./examples/activity.html) |

## Create diagrams with Codex

This repository includes the [`$finch` skill](./.agents/skills/finch/SKILL.md). From this checkout, ask Codex:

```text
$finch Draw an activity diagram for the order review flow in HTML.
```

To install the skill in another workspace:

```bash
npx skills add hachiware-labs/finch-js --skill finch
```

Add `--global` to make it available across repositories. Restart Codex if a newly installed skill is not listed.

## Learn more

- [Tutorial](./docs/tutorial.md): render, arrange, update, save, and embed a diagram.
- [Reference](./docs/reference.md): syntax, editing controls, persistence, events, export, and the instance API.
- [Advanced examples](./examples/README.md): complete, editable diagrams for every supported type.
- [Extending Finch.js](./docs/extensions.md): custom diagrams, shapes, layouts, and themes.
- [Slide patterns](./docs/slide-patterns.md): reusable KPI, data-story, roadmap, comparison, and customer-evidence recipes.

## Development

```bash
npm ci
npm run check
```

To browse the examples locally, run `python -m http.server 8000` and open `http://127.0.0.1:8000/examples/`.

Finch.js is licensed under the [MIT License](./LICENSE).

<details>
<summary>Artwork credits</summary>

- Header silhouette adapted from a [Green Warbler-Finch photograph](https://www.inaturalist.org/observations/9398069) by Julien Renoult, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Footer silhouette adapted from [<i>Green warbler-finch on Santa Cruz Island</i>](https://commons.wikimedia.org/wiki/File:Green_warbler-finch_on_Santa_Cruz_Island.jpg) by Andrew Katsis, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Both images were simplified, recolored, and repositioned as silhouettes.
</details>

<p align="right">
  <img src="./docs/assets/green-warbler-finch-silhouette-foraging-pink.png" alt="Pink silhouette of a foraging Green Warbler-Finch" width="180" />
</p>
