# Smart Resize Studio 0.5 — verification

This is a source implementation, not a claim that all browser and build checks passed in the delivery environment.

## Checks performed

| Check | Result |
| --- | --- |
| 0.4 source code available and 0.5 source changes applied | PASS |
| TypeScript/TSX syntactic transpilation across the source tree | PASS (syntax only) |
| ZIP CRC-32 and headers generated using the release ZIP writer | PASS |
| ZIP archive readable by Python's standard `zipfile` with no CRC errors and correct Unicode filenames | PASS |
| Artboard snapping pure function executed with enabled/disabled test cases | PASS |
| New Vitest and Playwright regression tests written | PASS (source created; tests not executed) |
| `npm ci` online | BLOCKED: package installation stalled without registry access |
| `npm ci --offline` | BLOCKED: missing cached package `zod-validation-error@4.0.2` |
| `npm run typecheck` | NOT COMPLETED: npm `@types` packages absent/incomplete |
| `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` | NOT COMPLETED: dependencies unavailable |

## Local verification commands

```sh
npm ci
npm run format
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run dev
```

After starting the browser, verify these interactions:

1. Generate multiple Meta/PMAX/GDN variants, drag an artboard label, save and reload; positions should persist. Reset with Auto-arrange.
2. Confirm the selected variant's layers still drag independently, and text double-click editing aligns after moving its artboard.
3. Create a custom 1080×1440 artboard, rename it, duplicate it, then undo/redo.
4. Upload a legally licensed TTF/OTF/WOFF2 font on a text layer and save/reload. Export a portable `.srs.json` and reopen it separately; the font should remain available.
5. Open Export creatives. Export one PNG and verify its exact dimensions. Export 3+ formats to a ZIP, unpack it and check dimensions and imagery. Repeat with JPG and WebP.
6. Trigger a preflight warning by moving a headline outside the safe zone. Click the issue to focus the correct layer. Ensure no safe-zone overlays appear in exported images.
7. Confirm existing 0.3/0.4 image crop, multilayer editing, snapshots, localization, dark mode, and per-variant adjustments still work.

If a browser test or TypeScript error appears, resolve it before using this update for client production work.
