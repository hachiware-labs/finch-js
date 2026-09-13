# Finch.js <img src="./docs/assets/green-warbler-finch-silhouette-profile-pink.png" alt="Pink silhouette of a Green Warbler-Finch in profile" width="56" align="middle" />

[日本語](./README_ja.md)

**Draw diagrams from text, then keep your hand-tuned layout as the text changes.** Finch.js renders editable SVG diagrams and preserves positions through stable node IDs.

[![Editable application architecture with AWS, PostgreSQL, and Lucide icons](./docs/assets/finch-architecture-hero-en.png)](./examples/readme-hero.html)

Images and linked examples use the repository build. [Sources and freshness record](./docs/diagram-media.md).

## Quick start

Save this as `diagram.html` in UTF-8 and open it in your browser. It uses published version 0.5.1; no installation or build is needed. An internet connection is required.

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

  Finch.render(orderFlowSource, { target: "#diagram" });
</script>
```

Press the pink bird icon in the diagram's lower-left to open Edit mode. Drag a node, then double-click it to pin the position. Change a visible label in the source and watch the diagram update without losing the hand-tuned layout. Nothing is persisted until you press Save.

IDs and labels are separate. Keep `validate` stable while changing `"Check inventory"`; the saved position belongs to the ID.

This entry point pins published **0.5.1**. Save uses browser storage. HTML saving, Markdown, timing, and additional UML syntax use the repository build. Try the [15-minute tutorial](./docs/tutorial.md).

## Fine-tune your diagram

[![Finch.js keeps a hand-tuned layout while the diagram source changes](./docs/assets/finch-editing-demo.gif)](./examples/readme-demo.html)

[Tutorial](./docs/tutorial.md) · [Example gallery](./examples/README.md) · [npm package](https://www.npmjs.com/package/@hachiware-labs/finch-js)

## Diagram types

| Directive | Use it for | Example |
| --- | --- | --- |
| `@deployment` | Systems and infrastructure | [Deployment](./examples/deployment.html) |
| `@graph` | General relationships and grouped systems | [Graph](./examples/graph.html) |
| `@sequence` | Ordered interactions | [Sequence](./examples/sequence.html) |
| `@flowchart` | Processes and decisions | [Flowchart](./examples/flowchart.html) |
| `@state` | Lifecycles and transitions | [State](./examples/state.html) |
| `@er` | Entities and relationships | [ER](./examples/er.html) |
| `@component` | Software boundaries and interfaces | [Component](./examples/component.html) |
| `@slide` | Presentation visuals | [Slide](./examples/slide.html) |
| `@class` | Classes and UML relationships | [Class](./examples/class.html) |
| `@usecase` | Actors and system goals | [Use case](./examples/usecase.html) |
| `@activity` | Actions and control flow | [Activity](./examples/activity.html) |
| `@timing` | Signals and states over time | [Timing](./examples/timing.html) |

## Install

```bash
npm install @hachiware-labs/finch-js
```

```js
import Finch, { createFinch } from "@hachiware-labs/finch-js";
```

For standalone HTML, load the published browser bundle:

```html
<script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.1/dist/finch.global.js"></script>
```

## Styles

The same flowchart, rendered in different styles.

<table>
<tr><td align="center"><strong>Default</strong><br><img src="./docs/assets/finch-style-default-en.png" alt="Default: order fulfillment flowchart" width="380"></td><td align="center"><strong>Precision</strong><br><img src="./docs/assets/finch-style-precision-en.png" alt="Precision: order fulfillment flowchart" width="380"></td></tr>
<tr><td align="center"><strong>Business</strong><br><img src="./docs/assets/finch-style-business-en.png" alt="Business: order fulfillment flowchart" width="380"></td><td align="center"><strong>Editorial</strong><br><img src="./docs/assets/finch-style-editorial-en.png" alt="Editorial: order fulfillment flowchart" width="380"></td></tr>
</table>

[Compare styles](./examples/style-study.html), toggle shadows, and export SVGs. Business, Precision, and Editorial are custom theme examples defined in that page; Business-shadow is the shadow-enabled Business variant.

## Icons, role colors, and your images

Use `icon` and `tone` across all themes, including custom themes. Containers pass their tone to descendants; a child can override it or use `tone=none` to reset. Icon artwork is selected per node and is not inherited.

```text
@deployment
container services "Services" [tone=green] {
  node api "API" [icon=server]
  node auth "Auth" [icon=shield-check tone=coral]
}
```

Lucide is the default. Optional AWS, Azure, Google Cloud, Kubernetes, and Simple Icons packs use names such as `icon=aws:application-auto-scaling` and `icon=simple:github`. Load the required pack after Finch. Use `image="./photo.png"` for your own image, optionally with `imageShape=circle` or `imageShape=rounded`.

These features use the current repository build. Run `npm ci` and `npm run build`, then open the [icon and image example](./examples/icon-packs.html). See [the icon guide](./docs/icons.md) for a complete HTML example and export requirements, and [pack sources](./icon-packs/NOTICE.md) for asset versions and terms.

## Create diagrams with your coding agent

This repository includes a portable [`finch` skill](./.agents/skills/finch/SKILL.md) for coding agents. Ask your agent:

```text
Create an activity diagram for the order review flow in HTML with the Finch skill.
```

Codex discovers the skill automatically from this checkout; use `$finch` when you want to invoke it explicitly. To install the skill in another workspace or for another supported agent:

```bash
npx skills add hachiware-labs/finch-js --skill finch
```

The installer lets you select the target agent. You can also specify agents directly, for example with `--agent claude-code cursor`. Add `--global` to make the skill available across repositories, and restart an agent if a newly installed skill is not listed.

## Save diagrams in Markdown

Use `exportMarkdown()` and `Finch.renderMarkdown()` to save and restore a diagram and its node positions in one code fence. See the [Markdown guide (Japanese)](./docs/markdown_ja.md).

## Learn more

- [Tutorial](./docs/tutorial.md): draw, arrange, edit, save, and choose a type in about 15 minutes.
- [Reference](./docs/reference.md): syntax, editing controls, persistence, events, export, and the instance API.
- [Advanced examples](./examples/README.md): complete, editable diagrams for every supported type.
- [Extending Finch.js](./docs/extensions.md): custom diagrams, shapes, layouts, and themes.
- [Slide patterns](./docs/slide-patterns.md): reusable KPI, data-story, roadmap, comparison, and customer-evidence recipes.

- [Embedding and saving](./docs/embedding.md)
- [Generate a diagram from a prompt](./docs/generating.md)
- [UML examples and extensions](./examples/uml-guide.html)
- [Includes, loops, and functions](./docs/preprocessing.md)
- [Notes and sequence pages](./docs/annotations.md)
- [Plugin development guide (Japanese)](./docs/plugin-development_ja.md)

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
