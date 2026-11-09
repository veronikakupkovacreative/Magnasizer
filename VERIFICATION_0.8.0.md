# Smart Resize Studio 0.8.0 — verification

## Verified in the build environment
- TypeScript/TSX syntax transpilation: 83 source + test files checked, 0 syntax errors.
- Pure runtime composition smoke: all 11 format presets in Auto + three manual modes, deterministic best-score selection; product aspect ratio retained.
- Linked style smoke: central color propagation across master and customized variants, text-style propagation without approved-copy loss, style detaching, legacy project without a Brand Kit.
- Complete ZIP structure: verified with `unzip -t` before delivery.

## Not verified here
- `npm ci` offline: fails because `class-variance-authority` and other package metadata are unavailable in the local npm cache.
- As a consequence: complete TypeScript semantic typecheck, lint, Vitest, production Next.js build and Playwright browser tests are **not** confirmed.

## Local validation (Node.js 22.22.2+ or 24.15+)

```
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run dev
```

## Acceptance test on Mac
- Open Demo Project; inspect linked brand colors and H1/Body/CTA styles.
- Change Lime / Accent to a red swatch: the product spotlight and CTA fill change on master and generated variants, without moving their layers.
- Link a newly created color to a shape, edit the token, and use Undo/Redo.
- Link a typography token to a text layer; change font family and weight, then detach and verify the current look remains.
- Generate Meta Story, PMAX Landscape, PMAX Portrait and GDN 320 × 100 using Auto; compare to manual plans and inspect warnings.
- Customize a generated variant and regenerate; ensure approved adjustments remain.
- Save and reload the project; verify style links and variant settings persist.
