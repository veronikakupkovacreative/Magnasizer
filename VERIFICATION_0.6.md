# Verification — 0.6.0

## Performed in the delivery environment

- Parsed the TypeScript/TSX source and E2E files with the globally installed TypeScript transpiler (73 files at time of first pass); no syntax diagnostics.
- Executed a pure-engine runtime harness for three composition modes across eight representative formats (square, vertical, landscape, Meta, and four GDN ratios). No image aspect distortion, invalid geometry dimensions or content boundary violations were observed in the tested demo fixture. Some compact formats still have production safe-zone/legibility warnings, as expected.
- Visually inspected representative master, landscape (all three strategies), Meta Story and compact GDN compositions using a rasterized geometry/text/bundled-SVG approximation. This is *not* a browser/production export screenshot. Fixed a compact GDN panel overlap found during this review.
- Confirmed preview thumbnails use the production Konva render path with a 440px maximum edge (native exports unchanged).
- Confirmed the new `composition` property remains optional in the unchanged version-2 project schema; existing variant documents are not migrated or rewritten.
- Verified generation protects customized variants by design, with manual confirmation for explicit recomposition and unchanged stable IDs for regenerated synced variants.

## Environment blocker

`npm ci --offline --ignore-scripts --no-audit --no-fund` failed with `ENOTCACHED` while fetching `zod-validation-error-4.0.2.tgz`. The local Node version (22.16.0) is also below the declared minimum for some development packages. Consequently, **typecheck, ESLint, Vitest, Next.js production build and Playwright are NOT claimed to have passed** in this environment.

## Required local validation

Run in a normal connected development environment with a compatible Node 22.22.2+ (or compatible newer Node):

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run dev
```

Verify with an editable demo project:

1. Open Resize. The three thumbnails should be genuine renderings and show different product/headline placement.
2. Generate Meta Story, PMAX Landscape, Square and Portrait. Confirm all appear together on the workspace.
3. Inspect the source master — it must remain unmodified and editable.
4. Select Story; manually move headline and confirm it becomes customized. Generate again and confirm its geometry is preserved.
5. With Story active, choose a different composition and click Apply. Cancel the confirmation; the manual edit must remain. Confirm on a second try; the variant updates and Undo restores the manual version.
6. Check extreme GDN sizes for preserved product ratio, no forced deformation, visibility of required roles and transparent warnings.
7. Save/reload, import font, export PNG/JPG/WebP/ZIP and confirm each artboard retains exact dimensions.
8. Compare new demo appearance with the welcome preview; old saved project designs should remain unchanged.
