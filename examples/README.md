# Advanced examples

These examples intentionally combine several supported DSL features while remaining small enough to study and modify.

## Software (UML / ER)

| File | Concepts |
| --- | --- |
| `deployment-advanced.tit` | Nested containers, stable IDs, Shape overrides, attributes, subsystem telemetry |
| `sequence-advanced.tit` | Explicit participants, nested frames, loop, opt, self message, call/return activations |
| `flowchart-advanced.tit` | Multiple decisions, labeled branches, exceptional dashed path, retry cycles |
| `state-advanced.tit` | Cyclic transitions, cancellation, semantic junction, shared archival path |
| `er-advanced.tit` | Entity fields, PK/FK/unique flags, one-to-many and optional cardinalities |
| `component-advanced.tit` | Nested systems, components, interfaces, databases, external dependencies |
| `class-advanced.tit` | UML classifiers, members, visibility, relationships, multiplicities |
| `usecase-advanced.tit` | Actors, system boundary, include, extend, generalization |
| `activity-advanced.tit` | Actions, guards, fork/join bars, decisions, merge points, object nodes |

## Slides

| File | Concepts |
| --- | --- |
| `slide-advanced.tit` | Presentation titles, row and grid composition, automatic arrows, notes, callouts, badges |
| `slide-story.tit` | A presentation-ready before/after story with one focused takeaway |
| `slide-kpi.tit` | KPI summary with headline metrics, deltas, and a decision callout |
| `slide-data.tit` | Ranked horizontal bars with one evidence-backed takeaway |
| `slide-roadmap.tit` | Roadmap milestones connected as an evidence-gated sequence |
| `slide-quote.tit` | Customer quotation paired with two supporting metrics |

## Plugin composition

| File | Concepts |
| --- | --- |
| `services-extension.tit` | Custom `@services` syntax with card, browser, gateway, shield, star, document, and database shapes |

Each source has a separate standalone page:

- `deployment.html`
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

`extensions.html` is a composed plugin example. Its `extensions.js` registers a custom diagram, card and icon shapes, a layout, and a theme before rendering `services-extension.tit`. The implementation uses only public plugin contracts described in [Extending Tit.js](../docs/extensions.md).

`index.html` is a lightweight entry page linking to all examples; it does not render all diagrams at once.

To view all examples, build Tit.js and serve the repository over HTTP:

```bash
npm run build
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/examples/` and choose one diagram page.

The leading apostrophe used in `.tit` files introduces a full-line comment. Inline `#` and `//` comments are also accepted when preceded by whitespace.
