# Smart Resize Studio 0.5.1 — verification report

## Static and automated checks

- User-reported baseline: 0.5.0 passed the remainder of the acceptance checklist. This does not guarantee that these new changes have been browser-tested.
- Full-project TS/TSX transpilation check performed with available global TypeScript compiler: **PASS (syntax only)**.
- New Vitest tests added for transformer handle sizing and font header validation; browser tests added for artboard confirmation and invalid font selection. These tests were **not executed here**.
- `npm ci --offline`: **BLOCKED** due to missing npm cache tarball `zod-validation-error@4.0.2`.
- `npm ci` with network: **FAILED** in this environment (`Exit handler never called` after registry fetch); cannot run TypeScript typecheck, lint, Vitest, Next build or Playwright without packages.
- Run all checks locally using Node.js 22.22.2 or newer:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

## Acceptance

- Artboards: Cancel leaves variant intact; Confirm removes correct variant; Undo restores it, the master is protected.
- Font: upload input and button available even without selecting a text layer; invalid file yields clear error; valid licensed font becomes available in font dropdown, saves/reopens, and renders in image export.
- Transformer: selected grips are unobtrusive at zoom <= 15%; no layer position/size or font distortion regression.
