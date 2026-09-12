# Notes and sequence pages

Use `note target "Text"` to annotate a node or message. Give repeated messages an explicit ID, such as `client -> api: Request [id=req]`, then use `note req "Text"`. Ambiguous `note client->api` references are errors. Keep node and message IDs distinct; nodes take precedence when both share an ID.

Use `rnote` for a rectangular note, `hnote` for a hexagonal note, or `constraint` for brace-delimited constraint text. Multiline blocks end with the matching `end note`, `end rnote`, `end hnote`, or `end constraint`. Blank lines, quotes and literal backslashes are retained; each line is trimmed.

Add `left of`, `right of`, `top of`, or `bottom of` before the target to select an outer diagram margin. Drag notes in the editor to refine their placement. Class members use `Worker::start(int timeout)`; ambiguous overloaded names are rejected.

```javascript
const source = `@sequence
footer "%page% / %lastpage%"
client -> api: Request [id=req]
newpage "Details"
hnote req
Retain the request audit trail.
end hnote`;
const diagram = Finch.render(source, { target: '#diagram' });
const svgPages = diagram.toSvgPages();
const pngPages = await diagram.toPngPages({ scale: 2 });
```

The editor's **Pages** panel previews and exports individual pages. Notes remain on their declared page, including pages containing only notes. Cross-page message references display the source page and message. References to participants absent from the page header identify them without reviving their lifetime.

Page exports substitute `%page%` and `%lastpage%` in headings. Add `ignore newpage` to combine the diagram without removing its page markers. Saved HTML retains source, layout and theme. PNG buttons export the clicked preview snapshot.

Multiline notes work in diagram kinds that already support notes. `note over a,b: Text` adds an unnumbered folded note row spanning the named participants. Multiline `note over a,b` / `end note` blocks are also supported. Use `rnote over` for rectangular notes or `hnote over` for hexagonal notes, with the matching block terminator. Use `note across: Text` or a `note across` / `end note` block to span all participants, including those declared later. Sequence page exports reposition notes; preserving top/bottom placement relative to the original diagram remains unverified. This is Finch syntax, not direct PlantUML source import.

[Japanese guide with more examples](annotations_ja.md) · [Tutorial](tutorial.md)
