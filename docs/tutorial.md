# Finch.js tutorial

[日本語](./tutorial_ja.md) · [Back to README](../README.md)

Write a diagram as text, arrange it by dragging, and save the layout. It takes two steps.

## 1. Put this in an HTML file

Create `tutorial.html` in the repository root and paste in the following. The page loads `dist/finch.global.js` from the same repository.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Finch.js</title>
    <style>
      body { display: grid; grid-template-columns: 320px 1fr; min-height: 100vh; margin: 0; }
      textarea { padding: 16px; font: 14px/1.6 monospace; }
      #diagram { overflow: auto; padding: 24px; }
    </style>
  </head>
  <body>
    <textarea id="source" spellcheck="false">@deployment
node browser "Web Browser" [shape=rounded]
server api "API Server"
database db "PostgreSQL"

browser -> api: HTTPS
api -> db: SQL</textarea>
    <div id="diagram"></div>

    <script src="./dist/finch.global.js"></script>
    <script>
      const source = document.querySelector("#source");
      const host = document.querySelector("#diagram");
      const layoutKey = "finch-tutorial-layout";
      const diagram = Finch.render(source.value, "#diagram");

      const savedLayout = localStorage.getItem(layoutKey);
      if (savedLayout) diagram.importLayout(savedLayout);

      source.addEventListener("input", () => {
        diagram.update(source.value);
      });

      host.addEventListener("finch:layoutchange", ({ detail }) => {
        localStorage.setItem(layoutKey, JSON.stringify(detail.overlay));
      });
    </script>
  </body>
</html>
```

Open `tutorial.html` in a browser. Finch.js turns the text on the left into a diagram on the right and redraws it as you edit.

When using the tutorial outside this repository, replace the local runtime script with the published, version-pinned package URL:

```html
<script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.0/dist/finch.global.js"></script>
```

## 2. Arrange and save the layout

Drag nodes on the right to arrange them. Double-click a node to pin its position. Finch.js saves layout changes in the browser automatically and restores them after a reload.

In the source, `api` is the node ID and `"API Server"` is its visible label. Keep the ID stable when changing the label so the node retains its position.

The diagram content now stays as readable text while the human-adjusted positions are stored separately.

## Set up the development environment later

If `dist/finch.global.js` is not present yet, or you want to serve the page over HTTP, install the dependencies and build Finch.js from the repository root:

```bash
npm install
npm run build
```

Then start a local server:

```bash
python -m http.server 8000
```

Open `http://127.0.0.1:8000/tutorial.html` in a browser.

To try other diagrams, continue with [Diagram types](../README.md#diagram-types) or the [advanced examples](../examples/README.md). To add themes or custom layouts, see [Extending Finch.js](./extensions.md).
