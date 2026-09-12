# Finch.js tutorial

[日本語](./tutorial_ja.md) · [Back to README](../README.md)

In this tutorial you will render a useful diagram, arrange it by hand, change its source without losing that arrangement, and choose how to save or embed the result.

## 1. Render the first diagram

From the repository root, run `npm ci` and `npm run build`. Save this page as `examples/order-flow.html`, run `python -m http.server 8000`, and open `http://127.0.0.1:8000/examples/order-flow.html`. The examples and images use the current checkout.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Order flow</title>
    <style>
      body { margin: 0; background: #f8fafc; }
      #diagram { min-height: 100vh; overflow: auto; padding: 24px; }
    </style>
  </head>
  <body>
    <main id="diagram" aria-label="Order fulfillment flowchart"></main>

    <script src="../dist/finch.global.js"></script>
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

      const diagram = Finch.render(orderFlowSource, { target: "#diagram" });
    </script>
  </body>
</html>
```

Expected result: a top-to-bottom order flow and a small pink bird icon in the diagram's lower-left.

Next, make the generated layout yours.

[![Order flow with a separate out-of-stock branch](./assets/tutorial-order-en.png)](../examples/tutorial-order-en.html)

The image and editable page use the same repository build as the example above. Stop when the normal path and its exception are easy to follow. Symmetry and zero crossings are not requirements.

## 2. Arrange and pin

Press the pink bird icon. The editor opens below the diagram and enables layout editing.

Try these actions in order:

1. Drag `Await restock` farther from the successful path.
2. Double-click it to pin the position. A pin marker appears.
3. Drag another node but leave it unpinned.
4. Press **Auto layout**.

The pinned node stays where you put it. Unpinned nodes are free to move when Finch.js recalculates the layout. **Undo** returns to the previous layout, while **Reset** discards all manual positions and pins.

Next, change the meaning without starting the layout over.

## 3. Change the source and keep the layout

In the editor's Source field, change this line:

```text
process validate "Check inventory and allocation"
```

The diagram updates after a short pause. The text changes, but `validate` stays in the same hand-tuned position because its ID did not change.

Now add a new side effect. Add this declaration after `reserve`:

```text
process audit "Record allocation"
```

Add this edge after `reserve -> confirmed`:

```text
reserve --> audit: Async
```

The new `audit` node enters automatic layout while existing manual positions remain associated with their IDs. If the new meaning needs more room, drag the new node or run **Auto layout** to integrate it. This is why IDs should describe stable identity and labels should carry wording that may change.

Next, decide where the layout should live.

## 4. Save the source and layout

### Built-in Save

Press **Save** to save an HTML page containing the source and all node positions. The first save suggests the current HTML filename and asks for a destination; subsequent saves reuse the file handle for this page session. Use **名前を付けて保存** (Save As) to choose another file. Browsers without the picker API download the HTML. Open the saved HTML to restore it. Edit ON/OFF never saves implicitly. See [saving and callbacks](./saving_ja.md).

To store editor state in a host application, replace the storage adapter. Both functions may be synchronous or asynchronous:

```js
Finch.render(source, {
  target: "#diagram",
  editor: {
    storage: {
      load: (key) => workspace.readDiagramState(key),
      save: (key, value) => workspace.writeDiagramState(key, value),
    },
  },
});
```

### A custom save button

If your application owns the UI, store the layout explicitly:

```js
saveButton.addEventListener("click", () => {
  localStorage.setItem("order-flow-layout", diagram.exportLayout());
});

const saved = localStorage.getItem("order-flow-layout");
if (saved) diagram.importLayout(saved);
```

Treat a `finch:layoutchange` event with a non-empty `changedNodeIds` array as an unsaved layout change. Persist only when the user chooses Save.

### Embed a layout in static HTML

Add a JSON script beside the diagram:

```html
<script type="application/json" id="order-layout" data-finch-layout>
  {"version":1,"diagram":"flowchart","editable":false,"nodes":{}}
</script>
```

Pass its contents when rendering:

```js
const overlay = document.querySelector("#order-layout").textContent;
const diagram = Finch.render(orderFlowSource, {
  target: "#diagram",
  overlay,
  editor: false,
});
```

While preparing the page, `diagram.saveLayout("#order-layout")` writes the current overlay into that script element. Copy the resulting JSON into the checked-in HTML. This keeps semantic source and human-adjusted coordinates separate even in a static document.

Next, choose a diagram from the question you need to answer.

## 5. Choose the diagram type

| If the reader needs to understand… | Start with | Example |
| --- | --- | --- |
| where software runs | `@deployment` | [Production services](../examples/deployment.html) |
| how otherwise untyped things relate | `@graph` | [Commerce system map](../examples/graph.html) |
| what happens in time order | `@sequence` | [Checkout calls](../examples/sequence.html) |
| how a process branches | `@flowchart` | [Review flow](../examples/flowchart.html) |
| how something changes state | `@state` | [Job lifecycle](../examples/state.html) |
| how data relates | `@er` | [Order data](../examples/er.html) |
| where software responsibilities end | `@component` | [Application boundaries](../examples/component.html) |
| how classes relate | `@class` | [Order domain](../examples/class.html) |
| what users want from a system | `@usecase` | [System goals](../examples/usecase.html) |
| how UML actions coordinate | `@activity` | [Order activity](../examples/activity.html) |
| one presentation takeaway | `@slide` | [KPI summary](../examples/slide-patterns.html) |

Open a nearby example and edit its source instead of learning the entire vocabulary first. The [reference](./reference.md) lists the common declarations and links to every complete example.

Next, generate the first draft from the information you already have.

## 6. Work with a coding agent

The repository contains a portable Finch skill that creates an HTML page with the source and render call kept together. Ask your coding agent:

```text
Use the Finch skill to create an activity diagram in HTML for this order-review specification.
Keep the IDs stable and leave the exact layout for me to refine.
```

Review the generated facts, open the page, then drag and pin the few positions that need human judgment. When requirements change, update the text instead of recreating the diagram.

Codex discovers the repository-local skill automatically and accepts `$finch` as an explicit invocation. To install the skill elsewhere or for another supported agent:

```bash
npx skills add hachiware-labs/finch-js --skill finch
```

Choose the target agent in the installer, or pass it directly—for example, `--agent claude-code cursor`. Invocation conventions differ by agent, but the skill instructions and generated Finch.js HTML are shared.

Next, connect Finch.js to a host application when the built-in editor is not the right UI.

## 7. Embed Finch.js in an application

Disable the standard editor for a bare diagram. Start in view mode when your application decides when editing is allowed:

```js
const host = document.querySelector("#diagram");
const diagram = Finch.render(source, {
  target: host,
  editor: false,
  editable: false,
});

editButton.addEventListener("click", () => {
  diagram.setEditable(!diagram.editable);
});

host.addEventListener("finch:layoutchange", (event) => {
  const { overlay, changedNodeIds } = event.detail;
  if (changedNodeIds.length) markUnsaved(overlay);
});

sourceEditor.addEventListener("input", () => {
  diagram.update(sourceEditor.value);
});
```

Use `finch:editchange` to synchronize a custom edit toggle and `finch:zoomchange` to synchronize zoom controls. Call `downloadSvg()` or `downloadPng()` for explicit exports.

## 8. Add icons, role colors, and images

This section uses the current checkout. From the repository root, run `npm ci`, `npm run build`, and `python -m http.server 8000`. Save this example under `examples/` and open it over HTTP; `image-avatar.svg` is already in that directory. Adjust the script and image paths when using another directory.

```html
<!doctype html>
<meta charset="UTF-8" />
<div id="diagram"></div>
<script src="../dist/finch.global.js"></script>
<script src="../icon-packs/aws.js"></script>
<script src="../icon-packs/simple.js"></script>
<script>
const source = `
@deployment
container services "Services" [tone=green] {
  node api "API" [icon=server]
  node auth "Auth" [icon=shield-check tone=coral]
}
node scale "Auto Scaling" [icon=aws:application-auto-scaling]
node repo "GitHub" [icon=simple:github]
node owner "Owner" [image="./image-avatar.svg" imageShape=circle]
api -> scale
owner -> repo
`.trim();
const diagram = Finch.render(source, { target: '#diagram', theme: 'prism' });
</script>
```

### Theme-independent attributes

- `icon=server` selects a built-in Lucide icon. Icon definitions live in the Finch engine, not in the theme.
- `tone` inherits from the nearest ancestor that specifies it. A child tone overrides it; `tone=none` resets that subtree to the theme's base colors.
- Common tones are `cyan`, `coral`, `green`, `amber`, and `violet`. A theme can override their palette; missing entries use shared role strokes and the theme's base fill.
- Change `theme` to `default`, `midnight`, or a custom theme object without rewriting the attributes. Business, Precision, and Editorial are custom examples, not built-in theme names.

### Load the packs you need

| Pack file under `icon-packs/` | Example attribute |
| --- | --- |
| `aws.js` | `icon=aws:application-auto-scaling` |
| `azure.js` | `icon=azure:virtual-machine` |
| `gcp.js` | `icon=gcp:compute-engine` |
| `k8s.js` | `icon=k8s:pod` |
| `simple.js` | `icon=simple:github` |

Load each script after `finch.global.js`. Packs contain embedded images and need no runtime fetches; they remain separate from the core bundle. See [the catalog](../icon-packs/catalog.json) for names and aliases and [the notices](../icon-packs/NOTICE.md) for sources. Cloud packs use a fixed third-party collection rather than a guarantee of the latest vendor artwork. Brand images preserve their colors; Lucide strokes follow the resolved tone.

For ES modules, import `aws` from `@hachiware-labs/finch-js/icon-packs/aws` and call `Finch.registerIconPack('aws', aws)` using a package built from this checkout. Register a custom image with `Finch.registerIcon('company:logo', { src: './logo.svg' })`.

### Use your own image

`image="./photo.png"` resolves relative to the HTML page. Direct HTTP(S) image URLs and image data URLs also work. PNG, JPEG, GIF, WebP, and SVG are supported. `image` takes precedence over `icon`.

Without `imageShape`, the image fits its box with its aspect ratio preserved. `circle` and `rounded` crop to a circular or rounded square. Use square avatar artwork for predictable results, especially with SVG assets that have their own internal margins or aspect-ratio rules.

Icons and images currently support rectangle, rounded, server, database, uml-artifact, uml-device, and uml-execution shapes. They do not add an image to containers or multi-compartment class/entity shapes. Unknown icon names leave the node without an icon.

### Export with images

```js
try {
  await diagram.downloadSvg('services.svg');
  // Or: await diagram.downloadPng('services.png');
} catch (error) {
  console.error('Image export failed:', error);
}
```

SVG and PNG downloads fetch and embed referenced images. Remote hosts must allow CORS; local files should be served over HTTP because file:// fetches may be blocked. Export rejects on failure instead of silently dropping the image. `toSvgString()` retains references; `await toEmbeddedSvgString()` produces an embedded SVG string.

Saving editable HTML preserves the original image references, so distribute referenced images, pack files, and the runtime with the HTML. It is not an automatic single-file image bundle.

Try the [complete icon-pack example](../examples/icon-packs.html).

You now have the complete Finch.js loop: generate from text, apply human layout judgment, evolve the source, and save those two kinds of information separately.

Continue with the [reference](./reference.md), browse the [advanced examples](../examples/README.md), or read [Extending Finch.js](./extensions.md) when you need custom syntax, shapes, layouts, or themes.


## Concise UML extensions

Use `note Order "Explanation"` or `constraint Item "quantity > 0"` for annotations, and `note api->stock "Idempotent"` for the first matching connection. Sequence frames accept `else condition` inside `alt` and `and description` inside `par`.

Use `state id { ... }` for composite states, `region id { ... }` for parallel regions, `lane id { ... }` for activity ownership, and `package id { ... }` for class packages. IDs remain unique across the diagram. State diagrams now flow downward by default; flat state diagrams accept `@state direction=LR`.

These features require the current repository build. See the [editable example](../examples/uml-concise.html) and [syntax and limitations (Japanese)](../docs/uml-concise_ja.md). Constraints are displayed, not executed. Class/object namespaces are supported; nested swimlanes are not. Nested state layouts remain vertical.


## Practical UML notation

Sequence diagrams distinguish synchronous `->`, asynchronous `->>`, and reply `-->` messages. Use `activate` / `deactivate` for explicit execution intervals, and `create` / `destroy` for lifetimes. State bodies accept `entry`, `exit`, `do`, and `internal`. Add roles with `stereotype id "service"`; class members accept `static` and `abstract` prefixes.

Activity diagrams accept `while id "condition" { ... }` and `repeat id "condition" { ... }`, with sequential action bodies and nested loops. Use `id.done` as the exit. Class relations accept `[fromRole=owner toRole=items]`, and `association Link A->B` attaches a declared association class to the uniquely matching relationship (use [id=name] and association Link name to disambiguate).

See the [editable example](../examples/uml-practical.html) and [detailed syntax and limitations (Japanese)](../docs/uml-practical_ja.md). These features require the current repository build. They describe behavior and perform structural checks; they do not execute it. Explicit activations replace inference for the controlled participant. Branch-dependent lifetimes, if/else and break/continue inside loops, explicit loop edges, and direct association-class relations are supported.

State extensions: after()/at()/when() events, defer/invariant commands, @state protocol with [pre=... post=...], machine Derived extends Base with stable node/edge IDs for redefinition, and comma-separated connection-point ref values. See the [editable examples](../examples/uml-complete.html) and [syntax and validation](uml-complete_ja.md).


Timing diagrams support discrete states, concise intervals, binary signals, analog values and clocks on a shared time axis. See the [editable timing example](../examples/timing.html).


[Reusable source: includes, loops, functions and validation](preprocessing.md)

[Notes and sequence pages](annotations.md)


## Explore the UML examples

The [UML example guide](../examples/uml-guide.html) pairs basic diagrams with deeper examples: branch-dependent lifetimes, state history and parallel regions, inheritance, loop interruption, association classes and templates. Use the editor button within each diagram to change its source. Structural checks do not execute behavior.
