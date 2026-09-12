# Finch.js reference

Built-in layouts and themes provide default presentation behavior. Implement alternative placement or appearance through [layout and theme extensions](extensions.md). Built-in placement behavior does not prescribe the design choices of custom plugins.

[Plugin development guide (Japanese)](./plugin-development_ja.md)

[日本語](./reference_ja.md) · [Back to README](../README.md)

This page collects the details needed after the first tutorial: shared syntax, editor behavior, persistence, events, export, layout controls, and the public instance API. For a working source of every diagram type, use the [advanced examples](../examples/README.md).

## Shared syntax

For Markdown documents, use `Finch.parseMarkdown(markdown)` or `Finch.renderMarkdown(markdown, options?)`. Call `instance.exportMarkdown()` to save the source and all node positions in one code fence. See the [Markdown guide (Japanese)](./markdown_ja.md) for the format and options.

The first meaningful line selects the diagram type. Declare nodes before connecting them, and keep machine-facing IDs separate from visible labels:

```text
@deployment
server billing-api "Billing API"
database ledger "Ledger"
billing-api -> ledger: SQL
```

- IDs may contain letters, digits, `_`, `-`, and `.`. Keep them stable so layout overlays survive label edits.
- Use `->` for a solid edge and `-->` for a dashed edge. Add a label after `:`.
- Put attributes in brackets: `[shape=rounded fromPort=right toPort=left]`.
- Use a leading apostrophe for a full-line comment. `#` and `//` also start comments when preceded by whitespace.

## Diagram declarations

| Directive | Common declarations | Complete example |
| --- | --- | --- |
| `@deployment` | `node`, `device`, `execution`, `artifact`, `server`, `database`, `container` | [deployment.html](../examples/deployment.html) |
| `@graph` | typeless nodes, implicit edge endpoints, `group`, `direction=LR` | [graph.html](../examples/graph.html) |
| `@sequence` | `participant`, `actor`, messages, `group`, `alt`, `opt`, `loop`, `par`, `critical`, `break` | [sequence.html](../examples/sequence.html) |
| `@flowchart` | `start`, `process`, `decision`, `input`, `output`, `end` | [flowchart.html](../examples/flowchart.html) |
| `@state` | `initial`, `state`, `choice`, `fork`, `join`, `history`, `deep-history`, `final` | [state.html](../examples/state.html) |
| `@er` | `entity`, fields, `pk`, `fk`, `unique`, cardinalities | [er.html](../examples/er.html) |
| `@component` | `system`, `component`, `port`, `provided`, `required`, `artifact`, `external` | [component.html](../examples/component.html) |
| `@slide` | `title`, `subtitle`, layout blocks, `card`, `metric`, `bar`, `quote`, `milestone`, `callout`, `arrow` | [slide.html](../examples/slide.html) |
| `@class` | `class`, `abstract`, `interface`, `enum`, members, UML relations and multiplicities | [class.html](../examples/class.html) |
| `@usecase` | `actor`, `system`, `usecase`, `include`, `extend`, `generalize` | [usecase.html](../examples/usecase.html) |
| `@activity` | `action`, `decision`, `merge`, `fork`, `join`, `object`, guards | [activity.html](../examples/activity.html) |

## Standard editor

`Finch.render()` adds the standard editor unless `editor: false` is passed. A Finch button in the SVG's lower-left opens the HTML panel below the diagram. While the panel is closed, the diagram is in view mode; opening it restores the editing state from that session.

```js
const diagram = Finch.render(source, { target: "#diagram" });
```

The panel provides zoom, Edit ON/OFF, Undo, Pin/Unpin, Auto layout, Reset, Fit, Width, Save, SVG, PNG, and a live source field. Save is explicit. Switching Edit ON/OFF never persists source or layout.

In edit mode:

- Drag a node to add a manual position.
- Double-click a node to toggle its pin.
- Ctrl/⌘/Shift-click to select multiple nodes, then drag them together.
- Press `P` to pin selected nodes and `Escape` to clear the selection.
- Use Ctrl/⌘ + wheel to zoom and Space/Alt + drag to pan.
- `autoLayout()` recalculates unpinned nodes.
- `resetLayout()` discards every manual position and pin.

In view mode, a plain left drag pans instead of moving nodes. Zoom operations remain available; layout editing, selection, pinning, and Fit are disabled.

## Source updates and stable IDs

```js
diagram.update(nextSource);
```

`update()` reparses and redraws the diagram. Existing nodes with the same IDs retain their layout state—even when the directive changes, such as `@graph` becoming `@flowchart`—while new nodes enter automatic layout. Generated SVG markup is available through `toSvgString()`.

Node names and connection labels preserve explicit `\n` breaks. Long lines also wrap automatically, preferably between words; long identifiers and Japanese text wrap between graphemes without splitting joined emoji. All lines remain visible. Built-in shapes grow to fit the text, including the usable interior of diamonds and ellipses. Container headings reserve space above children, sequence messages reserve vertical space, and slide text grows its element instead of adding an ellipsis.

Japanese wrapping prefers word boundaries where available, keeps numbers with common units such as `10万円` when they fit, avoids starting a line with closing punctuation, and rebalances a very short final line. Explicit line breaks take precedence.

Node declarations that accept attributes can use `[wrapWidth=160]` to set a preferred text width in SVG units (minimum 24). Padding and shape boundaries are additional, so the element itself may be wider. Without this hint, each shape uses its normal wrapping width. Connection labels wrap automatically within their available route segment, with a default maximum text width of 180.

Use `String.raw` in HTML to keep the backslash in the diagram source, or write `\\n` in an ordinary JavaScript string:

```js
const source = String.raw`
@flowchart
process review "Read the request\nCheck the attachments" [wrapWidth=160]
process done "Send the result"
review -> done: Review complete\nNotify the applicant
`;
```

Saved node positions and pins remain unchanged. A saved width or height smaller than the current label requires is expanded. For working examples, see [label-wrapping.html](../examples/label-wrapping.html).

## Freeze a diagram

Open the edit menu with the bird icon and press **フリーズ** (Freeze). This saves the current source, including pending input, and layout to the same storage used by Save. The diagram enters view mode. The edit menu and bird icon disappear and stay hidden after loading. Zoom and scrolling remain available. There is no menu action to unfreeze a diagram.

If saving fails, the edit menu returns with an error so you can retry. Ordinary Edit ON/OFF and opening or closing the menu still do not save.

The optional `LayoutOverlay.frozen` field stores this state. `frozen: true` takes precedence over `editable: true`. Older data without `frozen` keeps its existing behavior. JSON export and import, `saveLayout()`, Markdown export and rendering, and editor storage all preserve the field.

```js
diagram.freeze();
console.log(diagram.frozen); // true
const json = diagram.exportLayout();
```

`freeze()` returns the same instance. Calling it through the API does not save; the caller must store the exported data. `setEditable(true)` and `EditorController.open()` cannot reopen editing, and `EditorController.setSource()` does nothing while frozen. A `finch:layoutchange` event carries an empty `changedNodeIds` array and an overlay with `frozen: true`.

The public `update()` and `setTheme()` methods still let the host update a diagram while keeping it frozen. `importLayout()` replaces the layout state: importing data with `frozen: false` or without `frozen` unfreezes it. Freeze controls editing through the UI; it does not restrict a caller's access to the data.

## Persistence

The semantic source and manual layout overlay are separate. The overlay contains node positions, sizes where needed, pins, and the edit-mode state.

Save embeds diagram sources and all node positions in an HTML page. The first save opens a file picker; subsequent saves reuse the handle in the same page session. Browsers without the API download HTML. Provide `onSave` to delegate saving to a host and `onChange` to receive committed source/layout edits. Precedence is `onSave`, explicit `editor.storage`, then HTML saving. `storageKey` applies to storage adapters. See [saving and callbacks](./saving_ja.md).

```js
const json = diagram.exportLayout();
localStorage.setItem("diagram-layout", json);

diagram.importLayout(localStorage.getItem("diagram-layout"));
```

`saveLayout(target?)` returns the same JSON and can also write it into a `script[type="application/json"][data-finch-layout]` element. An overlay without an `editable` field is restored in edit mode for backward compatibility.

## Events

Events bubble from the rendered SVG, so a listener on the host element can receive them.

| Event | `detail` | Use |
| --- | --- | --- |
| `finch:layoutchange` | `{ overlay, changedNodeIds }` | Mark a custom editing session dirty when `changedNodeIds` is non-empty |
| `finch:editchange` | `{ editable, overlay }` | Synchronize a custom Edit control |
| `finch:zoomchange` | `{ zoom, mode }` | Synchronize zoom controls |

The standard editor saves when Save or Freeze is pressed. An edit-mode change produces an empty `changedNodeIds` array and does not save by itself.

## Layout behavior

Flowcharts progress from top to bottom by default, with branches at the same rank spreading horizontally. State fork/join regions also read vertically: fork above, parallel states in the middle, join below, then the successor.

Graphs also progress top to bottom by default. Use `@graph direction=LR` for a left-to-right graph. Graph nodes need no type keyword, edge endpoints may introduce nodes implicitly, and `group id "Label" { ... }` draws a frame around related nodes.

Deployment containers accept `layout=row`, `layout=column`, or `layout=grid`. A grid may set `columns`; direct children may set `order`, `row`, and `column`. A top-level container with `place=below` stays below its predecessor instead of opening another horizontal band. These are automatic-layout hints; exact manual coordinates remain in the overlay.

Transitions connected to a state fork or join automatically use vertical ports. Override an endpoint with `fromPort` or `toPort`; accepted values are `top`, `right`, `bottom`, and `left`.

Built-in directed layouts use explicit `order` values and parent membership. In flowcharts and activity diagrams, set `[main=true]` on a branch destination to select the main path. This affects placement, not connection semantics. Without it, selection is automatic.

Automatic placement accounts for label and node dimensions. Explicit grids and manual positions can still leave overlapping labels.

Graph frames adapt to their contents. Updates retain saved positions, and `autoLayout()` preserves pinned positions by default.

Built-in routing respects node boundaries and explicit `fromPort` / `toPort` settings, and evaluates crossings, overlap, bends and distance. Normal-state transitions remain independent. Edges are retained when no safe route is available; zero crossings or overlap are not guaranteed. See the [layout and routing settings](reference_ja.md#配置とルーティングの設定) for available controls.

The SVG viewport includes exterior routes, labels, and negative coordinates with padding. `instance.geometry.origin` gives its top-left coordinate; `width` and `height` describe the full viewport. Node coordinates and saved overlays are not translated. Source updates preserve existing positions, and `autoLayout()` preserves pinned nodes by default.

## Zoom and export

```js
diagram.zoomIn();
diagram.zoomOut();
diagram.setZoom(1.25);
diagram.fit("diagram");
diagram.fit("width");
diagram.resetZoom();
```

Zoom is clamped to 25–200% by default; use `minZoom` and `maxZoom` in `Finch.render()` to change the range. Viewport zoom does not change semantic geometry or the saved overlay.

```js
diagram.downloadSvg("system-map.svg");
await diagram.downloadPng("system-map.png", { scale: 2 });
const transparentPng = await diagram.toPngBlob({ background: null });
```

SVG and PNG exports include the current manual positions and omit the editor button.

## Themes and extensions

```js
const diagram = Finch.render(source, {
  target: "#diagram",
  theme: "midnight",
});

diagram.setTheme("default");
diagram.setLayout("compact");
```

Use `createFinch()` to create an isolated registry before registering custom diagrams, shapes, layouts, or themes. See [Extending Finch.js](./extensions.md) for the plugin contracts and [extensions.html](../examples/extensions.html) for a complete composition.

## Instance API

| Operation | Purpose |
| --- | --- |
| `update(source)` | Reparse and redraw while preserving stable-node layout |
| `setTheme(theme)` / `setLayout(name)` | Change presentation |
| `select(ids)` / `clearSelection()` | Manage selection from code |
| `pin(ids)` / `unpin(ids)` | Protect or release manual positions |
| `autoLayout()` / `resetLayout()` / `undoLayout()` | Recalculate, clear, or undo layout state |
| `setZoom(value)` / `zoomIn()` / `zoomOut()` | Control viewport magnification |
| `setEditable(value)` / `editable` / `canUndo` | Change edit mode and inspect Undo availability |
| `fit("diagram")` / `fit("width")` / `resetZoom()` | Fit or reset the viewport |
| `exportLayout()` / `importLayout(value)` | Persist the layout overlay |
| `saveLayout(target?)` | Return overlay JSON and optionally write it to a JSON script element |
| `toSvgString()` | Serialize the current SVG |
| `downloadSvg(filename?)` | Download the current diagram as SVG |
| `toPngBlob(options?)` | Create a PNG `Blob` |
| `downloadPng(filename?, options?)` | Download the current diagram as PNG |
| `Finch.attachEditor(instance, options?)` | Add the standard editor later |
| `destroy()` | Remove the SVG and disable the instance |

The package includes TypeScript declarations for the public API and plugin interfaces.


[Reusable source: includes, loops, functions and validation](preprocessing.md)


## Class and object relations

Use `--` for association, `-->` for directed association, `..>` for dependency, `*--` for composition, `o--` for aggregation, `--|>` for generalization, and `..|>` for realization. Reverse forms are `<--`, `<..`, `--*`, `--o`, `<|--`, and `<|..`. Dotted association, composition, and aggregation use `..`, `*..`, and `o..`; the latter two also support `..*` and `..o`.

```text
@object
object part
object whole
part "many" --* "1" whole: owned by
```

Quoted endpoint values specify multiplicities. Local names resolve within namespaces. Use `diamond membership` for an n-ary association diamond and `map kickoff {}` for an empty map.

Use `*-->` or `o-->` to add navigability to composition or aggregation. Reverse forms are `<--*` and `<--o`; dotted forms are `*..>`, `o..>`, `<..*`, and `<..o`. These render a diamond and an open arrow at opposite ends.

Use `a <--> b` for a bidirectional association and `a <..> b` for bidirectional dependencies. Both render one edge with open arrows at both ends; multiplicities stay attached to the written endpoints.

Class members also accept trailing modifiers, such as `+count: int {static}` and `+run() {abstract}`. `{classifier}` is an alias for `{static}` and works at either end.

Class bodies accept `--`, `..`, `==`, and `__` separators, optionally with a heading such as `.. API ..`. Classes with explicit compartments preserve member order instead of regrouping fields and operations.

Modifiers also work between the type and member name, for example `+void {abstract} start()`. Quoted values such as `"{static}"` remain literal text.

Classifier declarations also accept `annotation`, `record`, `dataclass`, `struct`, `protocol`, `exception`, `metaclass`, `stereotype`, and `entity`. They retain their kind and support members, namespaces, notes, and display rules. Use braces for a labeled stereotype declaration: `stereotype S "Label" {}`. Without braces, `stereotype S "text"` remains the existing stereotype assignment command.

In class and object diagrams, declare a standalone note with `note "Shared explanation" as N`, then connect multiple elements using `A .. N` and `B .. N`. `rnote` and `hnote` are also available.

Named notes also accept blocks: start with `note as N`, write the body on following lines, and close with `end note`. Use `rnote as N` / `end rnote` or `hnote as N` / `end hnote` for alternative shapes.

Use `note right: Explanation` to annotate the preceding classifier without repeating its name. All four sides and note/rnote/hnote are supported. A preceding element declaration is required.

In class and object diagrams, shorthand notes also support blocks from `note right` to `end note`. Side names are reserved in this form; to target an element named `right`, use an explicit target such as `note right of right`.

Use `note on link: Explanation` to annotate the preceding relation, or `note left on link` followed by a block ending in `end note`. It selects the preceding edge even when several edges share the same endpoints.

Both `abstract Base` and `abstract class Base` declare an abstract classifier, with the same support for template parameters and member bodies.

Classifiers accept `class "Order service" as OrderService` and `class OrderService as "Order service"`. Use the ID in relations and external member declarations. The existing `class OrderService "Order service"` form remains supported.

Aliases also work for objects and maps, such as `object "Alice : User" as alice` or a `map "User index" as users` declaration with a body. Mixed diagrams retain the same IDs for relations.

Use `class Service <<application>>` for an inline stereotype. Quoted display names, template parameters, and namespaces are supported, including selectors such as `hide <<application>> methods`.

Aliases and stereotypes can be combined: `class "Order service" as S <<application>>`. Abstract classifiers and template parameters are also supported.

Escape a member prefix with a backslash, for example `\~Resource()`, to treat it as part of the name rather than visibility. It renders as `~Resource()` and remains visible under visibility filters. Use `Client --> Resource::~Resource()` to link to the destructor.

Classifier visibility uses `+class A` (public), `-class A` (private), `#class A` (protected), or `~class A` (package). The symbol prefixes the displayed name without changing the ID.

A class diagram can start with just `Client --> Service`. Undeclared endpoints become empty classes; explicit declarations take precedence. Short names inside a namespace are inferred in that scope. Members are not inferred. `@class` also infers classes when objects or JSON are present. `@object` continues to reject unresolved references.

Pure class diagrams also infer classifiers from external members such as `Service : +run()`. Multiple additions are collected within their namespace and package. Existing explicit declarations receive the members instead.

Use `A x-- B` or `A --x B` to mark an association end as non-navigable. The selected end receives a cross. Dotted forms are `x..` and `..x`.

`A x--> B` combines a cross at A with a navigation arrow at B. Use `A <--x B` for the reverse, or `x..>` / `<..x` for dotted lines.

Use `A -- B: owns >` or `A -- B: < owned by` to show the reading direction of a relation label. Its triangle is independent of endpoint arrows and follows the direction of the segment carrying the label.

### Special class relation ends

`A #-- B`, `A }-- B`, `A +-- B`, and `A ^-- B` draw a square, crowfoot, circled cross, and hollow triangle at A. To place them at B, use `--#`, `--{`, `--+`, or `--^`. Replace `--` with `..` for dashed lines. These decorations preserve ordinary association semantics; use inheritance syntax for generalization. Append `>` for navigation (`A #--> B`); reverse notation is also supported (`A <--# B`). Multiplicities and member targets remain attached to their written endpoints.

`<> link` is shorthand for `diamond link` in class and object diagrams. It accepts a quoted label and works inside namespaces.

Class diagrams accept `circle API`, `() API`, and `() "Public API" as API`. The interface renders as a small circle with its label underneath. Connections attach to the circle; downward connections use side ports to avoid the label.

`provided` in component and deployment diagrams uses the same small interface circle and external label as `circle` in class diagrams.

Component/deployment edges accept `[fromPort=bottom toPort=left]` after an optional label. Explicit ports take precedence over provided-interface label avoidance; choose ports that keep the label clear.

Class/object relations also accept `[fromPort=left toPort=right]`, together with roles and multiplicities. Like `fromRole`/`toRole`, ports refer to the semantic source/target after arrow direction is resolved. Member or map-row attachments retain their own row-based routing.

Port values are `left`, `right`, `top`, or `bottom`. Invalid values produce a parsing error instead of silently reverting to automatic attachment.

Component/deployment links support solid undirected `-`/`--`, dashed undirected `..`, and reverse arrows `<-`, `<--`, `<..`. Existing Finch `-->`/`<--` remain dashed arrows; this differs from PlantUML, where dash count affects direction/length rather than line style.

Component/deployment declarations accept `component "Order service" as orders` and `component orders as "Order service"`. Aliases preserve trailing style attributes and container braces; links use the ID.

Use `[Order service] as orders`, `component [Billing] as billing`, or `[Worker]` for compact component declarations, and `() "Public API" as api` for a provided interface. Bracketed names may omit an alias, including names with spaces. `[Order service] --> [Billing service]` creates missing components automatically; later explicit declarations reuse those nodes.

Component/deployment notes can target bracketed names: `note right of [Order service]: Accepts orders`. Multiline blocks ending in `end note` are also supported.

In component diagrams, an undeclared bare relation endpoint such as `HTTP` is inferred as a provided interface: `[Order service] ..> HTTP`. Explicit declarations take precedence, and bracketed endpoints identify components. Deployment diagrams retain strict checking for undeclared bare IDs.

Declarations may omit the ID when the name is quoted: `() "Public API"` or `component "Order service"`. Reference those declared names in links as `"Order service" -- "Public API"`. If a declaration uses `as`, continue to reference its alias.

Notes may also reference declared quoted names: `note right of "Public API": Contract`. The multiline form ending with `end note` works as well.

Component/deployment diagrams support standalone notes: `note "Shared contract" as contract`, linked with `A .. contract`. A `note as contract` block ending with `end note` is also supported. Multiple elements can share the same note.

A multiline component description can be written between `component orders [` and a closing `]` on its own line. Description lines are literal, including words such as `title` and `note`.

Use `componentStyle uml1`, `componentStyle uml2` (default), or `componentStyle rectangle` in component/deployment diagrams. `skinparam componentStyle ...` is accepted too. Per-node `[componentStyle=rectangle]` overrides the global setting.

Use `folder services "Services" { ... }` or `frame processing "Processing" { ... }` to group components with folder or frame outlines. Quoted-name aliases and nested groups are supported.

`node host "Host" { ... }` creates a deployment-node group with a three-dimensional outline. Groups may nest and contain components. A standalone `node host` retains its existing rectangular rendering.

`database storage "Storage" { ... }` groups elements inside a cylindrical database outline. The header reserves space below the top ellipse.

Empty groups can use `{}` on one line, including quoted aliases: `node "Host" as host {}`. Package, folder, frame, node, and database groups retain their identity when expanded later.

`cloud environment "Cloud" { ... }` groups elements inside a cloud outline. It supports nested groups, aliases, and the empty `{}` form.

Component/deployment diagrams accept `top to bottom direction` and `left to right direction` (default). Hierarchical layout applies the chosen direction to both flat diagrams and nested groups.

Required interfaces automatically turn their socket away from the connected component. Set `required api "API" [opening=left]` to fix the opening (`left`, `right`, `top`, or `bottom`). With multiple connections the first non-self connection determines the automatic orientation.

Component/deployment display rules: `hide A` reserves layout space, `remove A` excludes it from layout, and `show A` / `restore A` make it visible again. Select an ID, a bracket name, a declaration kind, `*`, or `unlinked`. Group visibility applies to descendants; edges and attached notes follow their targets. Rules apply in source order after declarations are resolved.

Component/deployment tags use `tag A internal worker`. Display rules can select `$internal` or `<<public>>` (matching `[stereotype=public]`). Tags resolve after declarations, so both tag assignments and display rules may precede their targets. An unmatched tag/stereotype selector is a no-op; assigning tags to an unknown node is an error.

Component/deployment declarations also accept inline metadata: `[Order service] as orders <<public>> $api $production`. Tags and stereotypes can appear alongside attributes and before a group opening brace. Quoted labels and bracketed names preserve these characters literally.

Repeated component/deployment stereotypes such as `component A <<service>> <<public>>` are retained and can each be selected. `hide stereotype` hides stereotype labels only; `show A stereotype` or `show <<public>> stereotype` restores them. The component and its connections remain visible.

Changing the component/deployment direction retains manual/pinned positions. Call `autoLayout()` to apply it while preserving pins, or `autoLayout({preservePinned:false})` / `resetLayout()` to recompute all positions. Save both the source and exported layout to restore direction together with manual positions.

Component/deployment notes accept `note right of orders: Public API`, including ID aliases and implicitly declared targets. The same target syntax applies to `rnote`, `hnote`, and `constraint`.

After a component/deployment declaration, `note right: Detail` attaches to that element without repeating its ID. `rnote` and `hnote` use the same shorthand, including aliased declarations inside groups.

In component/deployment diagrams, `note on link: Detail` attaches to the preceding relation. `rnote` and `hnote` are also accepted. Directional arrows and explicit endpoint ports retain the same relation identity.

In `@component`, `[Service] -- "Public API"` implicitly creates a provided interface named Public API. Repeated references share its identity; an explicit declaration may follow. `@deployment` continues to require declarations for these endpoints.

Groups may omit their name: `cloud { ... }`, `package { ... }`, or `folder {}`. Attributes are allowed before the opening brace. Anonymous groups receive internal IDs in declaration order; use explicit names when preserving identity across insertion/reordering is important.

In component/deployment diagrams, `rectangle gateway "Gateway"` is a rectangle node, while `rectangle "Platform" as platform { ... }` is a group. Aliases, inline tags/stereotypes, and anonymous `rectangle {}` groups are supported.

Components may contain elements: `component platform { ... }`. The boundary carries a component symbol; `componentStyle rectangle` suppresses it. Nesting and aliases are supported. 

Inside a component/group, `portin input` and `portout output` attach to its boundary. Horizontal layouts use left/right; vertical layouts use top/bottom.  Ports follow the owner when rerouted. Automatic neutral-port side selection and label placement remain incomplete.

A neutral `port` chooses its side from the first connection to an element outside its owner: external-to-port uses the input side, port-to-external the output side. Without an external connection it defaults to input. `portin` and `portout` remain explicit choices.

Display rules accept both `@unlinked` (PlantUML spelling) and `unlinked` in class, component, and deployment diagrams. They select elements with no relation endpoints referencing them.

Component/deployment arrows can omit surrounding spaces: `[A]->[B]`, `order-api->billing-api`, or `A-left->B`. For a single undirected dash between bare IDs, retain spaces (`A - B`) to distinguish the dash from a hyphen in an ID.

Directional dashed relations are supported: `A.right.>B`, `A<.left.B`, or `A .down. B`. They retain dashed styling while applying the direction hint to layout.

### Queue groups

In component and deployment diagrams, queue uses a horizontal cylinder. Use queue "Display name" as ID { ... } to contain elements. Anonymous queue { ... } groups and nested queues are supported, as is the standalone queue ID "Display name" form.

### Files

In component and deployment diagrams, use file "Display name" as ID or file ID "Display name". Add { ... } to contain elements. Anonymous file { ... } groups and nesting are also supported.

Use artifact "Display name" as ID { ... } to group files or other artifacts. Anonymous artifact { ... } groups are supported. The group defaults to the artifact stereotype; hide artifact stereotype hides that label.

Deployment and component declarations accept unquoted display names, for example node Production as host. In this form, the left side is the display name and the right side is the ID used by relations and notes.

### Borderless labels

Use label "Description" as ID in component or deployment diagrams for a borderless text element. Labels support relations, notes, icon/image attributes, and hide/remove label selectors.

Connect to a JSON row by key with App -> config::host. The row is resolved again when fields are reordered. Quote keys containing spaces or punctuation, for example config::"Connection URL". fromMapRow/toMapRow indices are also available.

### Additional deployment elements

These declarations work in `@deployment` and `@component`. Use `kind "Display name" as ID` for aliases and `ID -> Other` for connections.

| Declaration | Appearance | Contains elements with `{ ... }` |
|---|---|---|
| `node` | Three-dimensional node | Yes |
| `action` | Rounded action | Yes |
| `storage` | Storage with large rounded corners | Yes |
| `process` | Right-pointing shape with a recessed left edge | Yes |
| `stack` | Stacked rectangles | Yes |
| `collections` | Collection represented by overlapping rectangles | No |
| `agent` | Rectangle | No |
| `person` | Head and body containing the label | No |
| `boundary` / `control` / `entity` | Boundary, control and data role symbols | No |

Select declaration kinds with `hide person` or `remove agent`. An `agent` remains distinct from a `rectangle` for selection. Use `rectangle` or `[shape=rectangle]` when a rectangular node is intended. The default stereotypes of `device` and `artifact` respect `hide stereotype`; an explicit `<<classification>>` replaces the default.

### Multiline deployment descriptions

```text
@deployment
node Worker [
Order processing service
Reads requests from the queue
] [tone=green icon=server]
component API
API -> Worker
```

The body becomes the label. Words such as `hide` and `title` inside it are literal text. Supported declarations are `component/node/folder/database/usecase/card/artifact/file/queue/cloud/rectangle/hexagon/stack/action/storage/process`. Put the closing `]` on a separate line; attributes may follow it. HTML and Creole formatting are not interpreted.

### UML relations and business symbols

These forms work in deployment, component and usecase diagrams.

| Source | Meaning |
|---|---|
| `Child --\|> Parent` | Generalization: solid line, hollow triangle at the parent |
| `Implementation ..\|> Contract` | Realization: dashed line, hollow triangle at the contract |
| `Owner o-- Part` | Aggregation: hollow diamond at the owner |
| `Owner *-- Part` | Composition: filled diamond at the owner |
| `Owner *--> Part` | Composition with a navigation arrow; `o-->` also works |
| `A <-> B` | Bidirectional solid line |
| `A <--> B` | Bidirectional dashed line under Finch's line rules |

Reversed notation preserves ownership and inheritance: `Parent <|-- Child`, `Contract <|.. Implementation`, `Part --o Owner`, and `Part <--* Owner`. Put spaces around aggregation and composition operators. Finch's ordinary `-->` is dashed, unlike the same PlantUML source spelling.

Use `actor/ Customer` and `usecase/ Order` for business symbols, or set `[business=true]` on an ordinary actor or usecase declaration.

In `@usecase`, concise relations are `include A -> B`, `extend A -> B`, and `generalize Child -> Parent`. Append `[fromPort=right toPort=top]` to control attachment sides. A following `note on link: Details` attaches to that relation.

`:Customer: -> (Order)` infers an actor and a usecase. Repeated names reuse the same element. Declare distinct IDs explicitly if endpoint kinds conflict.

Collections, stack and person shapes also support the shared `icon` and `image` attributes, independently of the theme.

Trailing relation attributes in component, deployment and usecase diagrams do not require fromPort/toPort. For example: A -> B [bidirectional=true]. Place the attribute block after the complete connection.

An explicit relation attribute determines the default line style: realization/dependency are dashed; inheritance/aggregation/composition/association are solid. Dedicated UML relation operators take precedence over the relation attribute.

Dotted ownership relations are also supported: Owner o.. Part, Owner *..> Part, and their reverse forms Part ..o Owner / Part <..* Owner. Spaces around these operators are required.

Multiline descriptions using Kind ID [ on its own opening line are also available for agent, person, collections, actor, actor/, boundary, control, entity and label. Close the body with ] on a separate line; style attributes may follow it.

Bold component/deployment/usecase links use ==, ==>, <== or <==>. They use twice the theme edge width; [lineStyle=bold] also applies the same width to other relation operators.

Bracketed component/deployment/usecase arrow styles are supported: A -[bold]-> B, A -[dashed]-> B, A -[dotted]-> B and A -[plain]-> B, including reversed arrows. Alternatively, trailing [lineStyle=plain], [lineStyle=dashed] or [lineStyle=dotted] overrides the pattern while retaining relation markers.

Set arrow width with A -[thickness=4]-> B or combine it with a pattern: A -[dotted,thickness=2.5]-> B. Thickness must be a positive finite number and overrides the theme width, including bold.

[継承ソース・個別の線色・文字修飾の指定方法](uml-three-features_ja.md)

[UML追加6項目の記法・検証範囲](reference_ja.md)

[Layout and routing settings (Japanese)](reference_ja.md#配置とルーティングの設定)
