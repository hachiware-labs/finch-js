---
name: finch
description: Create or update HTML pages that render Finch.js diagrams from supplied requirements. Use for deployment, sequence, flowchart, state, ER, component, slide, class, use-case, and activity diagrams; keep the Finch.js DSL as a JavaScript string inside HTML unless the user explicitly requests a standalone .finch file.
---

# Finch.js HTML Diagrams

Create usable HTML, not a standalone diagram source. Treat `$finch アクティビティ図を描いて` and similar requests as instructions to add the requested diagram to an HTML page.

## Workflow

1. Identify the target HTML. Edit the user-named page when one is given; otherwise choose a clear `.html` filename in the requested or contextually appropriate directory.
2. Gather the diagram facts from the request and nearby project material. Preserve finalized names, relationships, ordering, guards, cardinalities, and boundaries. Do not invent domain facts merely to make the diagram look fuller.
3. Select the Finch.js diagram directive and read [references/diagram-syntax.md](references/diagram-syntax.md) before composing the source. When this repository's examples are available, use the matching embedded source in `examples/*.html` as the canonical local example if syntax is uncertain.
4. Put the DSL in a clearly named JavaScript template literal inside the HTML. Keep the source declaration next to its render call so the diagram is easy to understand and edit:

```html
<section id="order-activity" class="finch-diagram" aria-label="注文処理のアクティビティ図"></section>

<script src="./dist/finch.global.js"></script>
<script>
  const activitySource = `
@activity
start begin
action receive "注文を受け付ける"
end done
begin -> receive
receive -> done
  `.trim();

  Finch.render(activitySource, {
    target: "#order-activity",
    ariaLabel: "注文処理のアクティビティ図",
  });
</script>
```

5. Load the browser build once and render each source after its target exists. Resolve the script URL relative to the output HTML; for example, a root-level page uses `./dist/finch.global.js`, while a page under `examples/` uses `../dist/finch.global.js`. Give multiple diagrams distinct source variables, targets, and instance variables when the instances are used later.
6. Fit the result into the surrounding page. Reuse existing styles when present. For a new page, give the target a useful minimum height, horizontal overflow, and a restrained neutral background; keep the SVG responsive without changing its semantic layout.
7. Validate the HTML-embedded JavaScript sources with `node .agents/skills/finch/scripts/validate-html.mjs <html-file>` for the repository-scoped installation, or run the equivalent script from the installed skill directory. The validator resolves Finch.js from the current project. In the Finch.js repository, run `npm run build` if `dist/finch.js` is absent or stale; in a consuming project, ensure the `@hachiware-labs/finch-js` dependency is installed. When browser access is available, also serve the project over HTTP and visually inspect the rendered page for clipping, unreadable labels, crossing edges, and poor hierarchy.

## Layout intent

- Treat reading direction as part of the diagram's meaning. Flowcharts normally progress from top to bottom, with only same-rank branches spreading horizontally. In state diagrams, keep fork/join regions vertical: fork above, parallel states across one or more middle rows, join below, then the joined successor.
- Avoid unnecessarily wide output. During visual inspection, consider the SVG's intrinsic width and height as well as its responsive viewport size. Prefer a compact or portrait-oriented result when it preserves hierarchy and readable edge routing.
- For deployment diagrams, use source-level container layout hints when the automatic hierarchy becomes too wide or obscures subsystem structure. Prefer `layout`, `columns`, `order`, `row`, `column`, and `place` over fixed coordinates; read the Deployment section of [references/diagram-syntax.md](references/diagram-syntax.md) for their semantics.
- Keep exact manual coordinates in the layout overlay. Do not encode `x` and `y` into semantic Finch source merely to repair one rendering.

## Edit mode and persistence

- When adding viewport controls, include an `Edit ON/OFF` toggle next to zoom controls. New diagrams start editable. In view mode, leave zoom in, zoom out, and reset available; disable Fit and layout-editing controls.
- Use `instance.setEditable()` and reflect `instance.editable` with `aria-pressed`. Listen for `finch:editchange` when the toolbar must stay synchronized.
- Save and restore edit mode through the layout overlay. `exportLayout()` includes `editable`, and `importLayout()` restores it; an older overlay without the field means edit mode on.
- For pages that persist edits, treat a `finch:layoutchange` with non-empty `changedNodeIds` as dirty. When the user switches from Edit ON to Edit OFF, save `exportLayout()` once if dirty, then clear the dirty state.
- In edit mode, direct node dragging adjusts layout. In view mode, a plain left drag pans within the diagram and must not write node positions to the overlay.
- When a node is dragged beyond a deployment container frame in edit mode, the containing frame and every ancestor frame expand to keep it enclosed. This interaction is grow-only; use automatic layout or reset to compact frames again.

## HTML-first constraints

- Do not deliver only a `.finch` file. Create or update HTML unless the user explicitly asks for standalone DSL.
- Keep the JavaScript source variable, target, runtime loading, and render initialization together in the HTML deliverable. A shared CSS file may still be reused when the surrounding project already has one.
- Prefer a descriptive variable such as `activitySource` or `checkoutSequenceSource`; do not hide the DSL in a textarea, `data-*` attribute, or non-executing script block.
- Avoid JavaScript interpolation inside the DSL. If diagram text contains a backtick or the literal sequence `${`, escape it correctly or use an array of quoted lines joined with `"\n"`.
- Keep node IDs short, unique, stable, and independent from displayed labels so later text edits preserve manual layout overlays.
- Give every diagram target an accurate `aria-label` in the page's language.
- Load `finch.global.js` only once per page, even when the page contains several diagrams.
- Preserve existing page structure, framework conventions, and user-authored styles. Do not replace a page with the standalone scaffold just to add a diagram.
- If the page already has a valid Finch.js integration pattern, extend it consistently rather than introducing a second loader.
- Use a separate `.finch` source only when explicitly requested or when an existing project convention requires it and the user agrees.

## Completion

Return the HTML path and briefly identify the diagram directive used. Mention any missing facts that were intentionally left out; do not claim visual verification unless the page was actually rendered and inspected.
