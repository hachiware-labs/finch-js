# Embedding and saving

[日本語](embedding_ja.md) · [Tutorial](tutorial.md)

This guide targets the current repository build.


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


## Storage

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
