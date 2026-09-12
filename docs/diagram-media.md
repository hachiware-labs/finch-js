# Documentation diagram freshness

Updated: 2026-09-12. Repository package: 0.6.0. All diagram media directly embedded in README.md, README_ja.md, docs/tutorial.md and docs/tutorial_ja.md were regenerated from the current checkout in this update. This does not claim that the npm-published release has the same code.

| Media | Count | Source |
| --- | --- | --- |
| README architecture, English/Japanese | 2 PNG | examples/readme-hero.html |
| README style comparison, 5 styles × 2 languages | 10 PNG | examples/style-study.html; reports/render-current-styles.mjs |
| Editing demonstration | 1 GIF, 5 frames | examples/readme-demo.html?frame=0…4; reports/capture-current-demo.mjs |
| Tutorial order flow, English/Japanese | 2 PNG | examples/tutorial-order-en.html / tutorial-order-ja.html |

The two bird illustrations are branding assets, not generated diagram screenshots, and were retained.

All 23 directly referenced example pages were opened with the current build: no page errors. 22 pages reference the local runtime; the UML guide is a navigation page. This checks initial rendering, not every selectable state or every link reachable through a gallery. The filenames examples/diagram.html and examples/order-flow.html are instructions for readers to create files, not missing repository examples.

Quick-start and tutorial script tags now use ../dist/finch.global.js from pages saved under examples/. Setup instructions require npm ci, npm run build and a local HTTP server. The old pinned CDN 0.5.1 example is no longer used in these four documents.

Runtime SHA-256: 1a5dbf020ae942d0becab50a2774bea7de9aebccc1ee1aad8d7b4bb25c8c5b97

[Page and asset hashes](../reports/doc-media-audit/manifest.json). Asset hashes describe this generation, not future builds. Rebuilding the library does not automatically refresh PNG/GIF files.

Regeneration from the repository root:

1. npm run build
2. node reports/capture-doc-diagrams.mjs
3. node reports/render-current-styles.mjs
4. node reports/capture-current-demo.mjs
5. python reports/encode-current-demo.py
6. node reports/audit-current-docs.mjs

The style capture explicitly fits the complete SVG into each tile; its previous capture width clipped the right branch. Review screenshots after regeneration. Scripts use the local bundled Playwright path on this workstation.
