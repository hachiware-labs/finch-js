# Icons, role colors, and images

[日本語](icons_ja.md) · [Tutorial](tutorial.md)

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
