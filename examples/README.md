# Advanced examples

These examples intentionally combine several supported DSL features while remaining small enough to study and modify. Each page keeps its Finch source and rendering code together in one HTML file.

Every rendered diagram uses the standard Finch editor: the compact icon in the SVG's lower-left opens the connected editor below the image. A closed editor keeps the diagram in view mode. Save is explicit, and SVG/PNG exports omit the editor icon.

The looping [`readme-demo.html`](./readme-demo.html) page is the source for the README animation. Add `?frame=0` through `?frame=4` to hold a specific stage for screenshots or visual review.

[`label-wrapping.html`](./label-wrapping.html) demonstrates explicit line breaks, automatic Japanese and English wrapping, shape containment, multiline messages, and complete slide text.

[UML example guide](./uml-guide.html) — basic and advanced examples grouped by diagram type, with a suggested review order.

## Software (UML / ER)

| File | Concepts |
| --- | --- |
| `deployment.html` | Nested containers, stable IDs, Shape overrides, container layout hints, subsystem telemetry |
| `graph.html` | Typeless and implicit nodes, grouped boundaries, shape overrides, left-to-right layout |
| `sequence.html` | Explicit participants, nested frames, loop, opt, self message, call/return activations |
| `flowchart.html` | Vertical reading flow, multiple decisions, labeled branches, exceptional dashed path, retry cycles |
| `state.html` | Cyclic transitions, cancellation, semantic junction, vertical fork/join path |
| `er.html` | Entity fields, PK/FK/unique flags, one-to-many and optional cardinalities |
| `component.html` | Nested systems, components, interfaces, databases, external dependencies |
| `class.html` | UML classifiers, members, visibility, relationships, multiplicities |
| `usecase.html` | Actors, system boundary, include, extend, generalization |
| `activity.html` | Actions, guards, fork/join bars, decisions, merge points, object nodes |
| [timing.html](./timing.html) | Signals, clocks, time anchors, uncertain ranges and hidden intervals. |
| [class-views.html](./class-views.html) | Visibility filters and notes attached to attribute or operation rows. |
| [class-namespaces.html](./class-namespaces.html) | Local names, qualified references and isolated classifiers. |
| [template-binding.html](./template-binding.html) | Formal-to-actual template argument substitutions. |
| [sequence-external.html](./sequence-external.html) | Boundary messages, found sources and lost destinations. |
| [sequence-roles.html](./sequence-roles.html) | Boundary, control, entity, database, collections and queue symbols. |
| [activity-split.html](./activity-split.html) | Split processing with terminated paths excluded from the merge. |
| [objects-templates.html](./objects-templates.html) | Instance slots and generic parameter compartments. |
| [uml-complete.html](./uml-complete.html) | State-machine and sequence lifetime examples. |
| [state-advanced.html](./state-advanced.html) | History and composite-state boundary connection points. |

## Slides

| File | Concepts |
| --- | --- |
| `slide.html` | Presentation titles, row and grid composition, automatic arrows, notes, callouts, badges |
| `slide-story.html` | A presentation-ready before/after story with one focused takeaway |
| `slide-patterns.html` | KPI summary, data story, roadmap, and customer quotation patterns |

## Plugin composition

| File | Concepts |
| --- | --- |
| `extensions.html` | Custom `@services` syntax with card, browser, gateway, shield, star, document, and database shapes |

The standalone pages are:

- `readme-demo.html`
- `deployment.html`
- `graph.html`
- `sequence.html`
- `flowchart.html`
- `state.html`
- `er.html`
- `component.html`
- `slide.html`
- `slide-story.html`
- `slide-patterns.html` (switches between four typical presentation patterns)
- `class.html`
- `usecase.html`
- `activity.html`

`extensions.html` is a composed plugin example. Its inline script registers a custom diagram, card and icon shapes, a layout, and a theme before rendering the embedded source. The implementation uses only public plugin contracts described in [Extending Finch.js](../docs/extensions.md).

`index.html` is a lightweight entry page linking to all examples; it does not render all diagrams at once.

To view all examples, build Finch.js and serve the repository over HTTP:

```bash
npm run build
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/examples/` and choose one diagram page.

The example pages intentionally load `../dist/finch.global.js` so they work from a source checkout and from the published package contents. When copying an example into another project, either install `@hachiware-labs/finch-js` or replace that local script URL with the version-pinned CDN URL:

```html
<script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.1/dist/finch.global.js"></script>
```

The leading apostrophe used in an embedded Finch source introduces a full-line comment. Inline `#` and `//` comments are also accepted when preceded by whitespace.
