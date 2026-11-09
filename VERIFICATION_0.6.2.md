# Verification — 0.6.2

## Performed in this environment

- Unpacked the prior 0.6.1 release and kept the existing project architecture.
- Added deterministic unit tests for deletion of a project's metadata, project-specific catalog records, image and font binaries, and for retaining blobs when another project references identical binary contents or legacy assets.
- Added Playwright scenarios to confirm/cancel deletion, refresh persisted results, open the surviving project and check Czech dialog strings.
- Added 0.6.2 composition regression tests ensuring manual edits and composition mode remain protected on batch regeneration, and explicit recomposition affects only its target.
- Checked TypeScript/TSX source and test files with the installed TypeScript transpiler; no parse errors.

## Not executable here

`npm ci --ignore-scripts --no-audit --no-fund --prefer-offline --fetch-retries=0` could not finish because the npm registry was unavailable (`EAI_AGAIN` and `Exit handler never called`); Node in this container is v22.16.0, whereas some pinned transitive packages require 22.22.2+. Therefore a full `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and browser Playwright execution are **not verified** in this environment.

## Local release gate

With Node >=22.22.2 or compatible Node 24+, run:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Check deletion particularly on already-saved projects from 0.5.x and earlier, not just newly created projects.
