# Finch.js 0.7.0

This release brings the current diagram editor, layout work, and documentation examples together.

- Arrange meaningful groups before refining internal order, routes, and whitespace. Difficult vertical graphs use a small set of operation-based ordering candidates instead of exhaustive permutations; retry branches can sit beside their return path.
- Improve routing channels, edge labels, hierarchy, nested containers, and preservation of manual or pinned layouts.
- Expand UML, activity, state, timing, sequence, class, and object notation, with structural validation and editable examples.
- Add icon packs, role colors, images, richer text, and updated documentation for extensions and preprocessing.
- Improve editing, explicit HTML/Markdown saving, layout restoration, and SVG/PNG export.
- Regenerate all 15 diagram media embedded in the English/Japanese READMEs and tutorials from the current checkout. Quick-start pages now use the local build, with setup instructions.

## Compatibility and scope

The package exports and basic render API are retained. Automatic placement can change; preserve saved overlays where exact positions matter. Difficult-case ordering currently applies to the supported vertical graph path, not every diagram type. Structural validation does not execute the modeled system.

The npm registry previously contained 0.5.1; 0.6.0 was the local working version. This release packages the intervening repository work as 0.7.0.

## Validation

Type checking, all 731 tests, and production builds passed. The packed tarball was installed into a clean directory and its import/parser smoke test passed. The README/tutorial media audit covers 23 directly linked pages and records the runtime hash in docs/diagram-media.md.
