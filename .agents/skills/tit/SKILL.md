---
name: tit
description: Create or update HTML pages that render Tit.js diagrams from supplied requirements. Use for deployment, sequence, flowchart, state, ER, component, slide, class, use-case, and activity diagrams; keep the Tit DSL as a JavaScript string inside HTML unless the user explicitly requests a standalone .tit file.
---

# Tit HTML Diagrams

Create usable HTML, not a standalone diagram source. Treat `$tit アクティビティ図を描いて` and similar requests as instructions to add the requested diagram to an HTML page.

## Workflow

1. Identify the target HTML. Edit the user-named page when one is given; otherwise choose a clear `.html` filename in the requested or contextually appropriate directory.
2. Gather the diagram facts from the request and nearby project material. Preserve finalized names, relationships, ordering, guards, cardinalities, and boundaries. Do not invent domain facts merely to make the diagram look fuller.
3. Select the Tit directive and read [references/diagram-syntax.md](references/diagram-syntax.md) before composing the source. When this repository's examples are available, use the matching `examples/*-advanced.tit` file as the canonical local example if syntax is uncertain.
4. Put the DSL in a clearly named JavaScript template literal inside the HTML. Keep the source declaration next to its render call so the diagram is easy to understand and edit:

```html
<section id="order-activity" class="tit-diagram" aria-label="注文処理のアクティビティ図"></section>

<script src="./dist/tit.global.js"></script>
<script>
  const activitySource = `
@activity
start begin
action receive "注文を受け付ける"
end done
begin -> receive
receive -> done
  `.trim();

  Tit.render(activitySource, {
    target: "#order-activity",
    ariaLabel: "注文処理のアクティビティ図",
  });
</script>
```

5. Load the browser build once and render each source after its target exists. Resolve the script URL relative to the output HTML; for example, a root-level page uses `./dist/tit.global.js`, while a page under `examples/` uses `../dist/tit.global.js`. Give multiple diagrams distinct source variables, targets, and instance variables when the instances are used later.
6. Fit the result into the surrounding page. Reuse existing styles when present. For a new page, give the target a useful minimum height, horizontal overflow, and a restrained neutral background; keep the SVG responsive without changing its semantic layout.
7. Validate the HTML-embedded JavaScript sources with `node .agents/skills/tit/scripts/validate-html.mjs <html-file>` for the repository-scoped installation, or run the equivalent script from the installed skill directory. The validator resolves Tit.js from the current project. In the Tit.js repository, run `npm run build` if `dist/tit.js` is absent or stale; in a consuming project, ensure the `tit-js` dependency is installed. When browser access is available, also serve the project over HTTP and visually inspect the rendered page for clipping, unreadable labels, crossing edges, and poor hierarchy.

## HTML-first constraints

- Do not deliver only a `.tit` file. Create or update HTML unless the user explicitly asks for standalone DSL.
- Keep the JavaScript source variable, target, runtime loading, and render initialization together in the HTML deliverable. A shared CSS file may still be reused when the surrounding project already has one.
- Prefer a descriptive variable such as `activitySource` or `checkoutSequenceSource`; do not hide the DSL in a textarea, `data-*` attribute, or non-executing script block.
- Avoid JavaScript interpolation inside the DSL. If diagram text contains a backtick or the literal sequence `${`, escape it correctly or use an array of quoted lines joined with `"\n"`.
- Keep node IDs short, unique, stable, and independent from displayed labels so later text edits preserve manual layout overlays.
- Give every diagram target an accurate `aria-label` in the page's language.
- Load `tit.global.js` only once per page, even when the page contains several diagrams.
- Preserve existing page structure, framework conventions, and user-authored styles. Do not replace a page with the standalone scaffold just to add a diagram.
- If the page already has a valid Tit.js integration pattern, extend it consistently rather than introducing a second loader.
- Use a separate `.tit` source only when explicitly requested or when an existing project convention requires it and the user agrees.

## Completion

Return the HTML path and briefly identify the diagram directive used. Mention any missing facts that were intentionally left out; do not claim visual verification unless the page was actually rendered and inspected.
