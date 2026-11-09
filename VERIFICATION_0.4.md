# Smart Resize Studio 0.4.0 — verification record

## Implemented

- Shared Konva Stage with master + all saved resize variants simultaneously visible.
- Real pixel-coordinate shelf layout: no overlaps; positions are view-only, not saved to artboard documents.
- Active artboard selection from the canvas background, its label, any layer, or the sidebar Artboards navigator.
- Sidebar focus, double-click-to-focus canvas labels, fit-all, 100% zoom, pan and pointer-anchored zoom.
- Reused existing editable Konva layer nodes, TextEditor overlay, transforms, snapping, safe zones, local saving and customized variant model.
- Updated E2E checks for simultaneous workspace and master/variant isolation, and added layout unit tests.

## Checks performed in the delivery environment

| Check | Result |
| --- | --- |
| Uploaded ZIP extracted and relevant source reviewed | PASS |
| Modified TypeScript and TSX files parsed/transpiled by the installed TypeScript compiler | PASS (syntax only) |
| Artboard layout function executed in Node.js for master plus eight variants | PASS; no artboard overlaps |
| `npm ci` | BLOCKED: npm registry DNS lookup unavailable in this environment; install did not complete |
| Full strict typecheck, ESLint, Vitest, Next build, Playwright browser tests | NOT RUN: required dependencies could not be installed |

This is an **implementation delivery, not a claim of browser-tested release**. Run `npm ci`, `npm run format`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` after extraction on a machine with network access. Correct any environment-specific errors before production use. Existing original verification documents describe past 0.2/0.3 versions, not the new 0.4 code.
