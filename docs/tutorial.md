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
      body { min-height: 100vh; margin: 0; }
      #diagram { min-height: 100vh; overflow: auto; padding: 24px; }
    </style>
  </head>
  <body>
    <div id="diagram" aria-label="Deployment diagram"></div>

    <script src="./dist/finch.global.js"></script>
    <script>
      const deploymentSource = `
@deployment
node browser "Web Browser" [shape=rounded]
server api "API Server"
database db "PostgreSQL"

browser -> api: HTTPS
api -> db: SQL
      `.trim();

      Finch.render(deploymentSource, {
        target: "#diagram",
        editor: { storageKey: "finch-tutorial" },
      });
    </script>
  </body>
</html>
```

Open `tutorial.html` in a browser. Finch.js draws the diagram and adds a Finch button inside its lower-left; the button reveals the editor below the diagram. The diagram stays in view mode while the editor is closed.

When using the tutorial outside this repository, replace the local runtime script with the published, version-pinned package URL:

```html
<script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.1/dist/finch.global.js"></script>
```

## 2. Arrange and save the layout

Drag nodes to arrange them. Double-click a node to pin its position. Open the Finch menu to edit the source or undo a layout change. Press Save explicitly to persist the source and layout; Edit ON/OFF does not save them. SVG and PNG export only the diagram image, without the Finch editor icon.

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
