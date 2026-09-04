# Finch.js tutorial

[日本語](./tutorial_ja.md) · [Back to README](../README.md)

In this tutorial you will render a useful diagram, arrange it by hand, change its source without losing that arrangement, and choose how to save or embed the result.

## 1. Render the first diagram

Save this page as `order-flow.html`, then open it in a browser. It uses a version-pinned CDN build, so it works outside the Finch.js repository without an install step.

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

      const diagram = Finch.render(orderFlowSource, {
        target: "#diagram",
        editor: { storageKey: "order-flow" },
      });
    </script>
  </body>
</html>
```

Expected result: a top-to-bottom order flow and a small Finch button in the diagram's lower-left.

Next, make the generated layout yours.

## 2. Arrange and pin

Open the Finch button. The editor opens below the diagram and enables layout editing.

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

Press **Save** in the Finch editor. The editor stores both the current source and layout in `localStorage` under the configured `storageKey`. Reload the page to verify that both return. Edit ON/OFF changes the interaction mode but never saves implicitly.

Use a distinct `storageKey` for each diagram on the same site.

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

## 6. Work with Codex

The repository contains a Finch skill that creates an HTML page with the source and render call kept together. From this checkout, ask:

```text
$finch Create an activity diagram in HTML for this order-review specification.
Keep the IDs stable and leave the exact layout for me to refine.
```

Review the generated facts, open the page, then drag and pin the few positions that need human judgment. When requirements change, update the text instead of recreating the diagram.

To install the skill elsewhere:

```bash
npx skills add hachiware-labs/finch-js --skill finch
```

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

You now have the complete Finch.js loop: generate from text, apply human layout judgment, evolve the source, and save those two kinds of information separately.

Continue with the [reference](./reference.md), browse the [advanced examples](../examples/README.md), or read [Extending Finch.js](./extensions.md) when you need custom syntax, shapes, layouts, or themes.
