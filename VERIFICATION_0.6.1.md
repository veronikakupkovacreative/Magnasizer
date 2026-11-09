# Verification — 0.6.1

Performed in the available container environment:

- TypeScript/TSX transpilation syntax checked for all application, test and E2E sources; no syntax errors.
- Executed dependency-free pure-model regression via global TypeScript: 11 preset formats x 3 compositions, exact dimensions, product aspect ratio, immutable customized variant regeneration, explicit recomposition preserving ID and changing mode.
- Visually inspected an offline rendered approximation of the newly editable demo at 1200 x 1200; typography, contrast and clipping reviewed.
- `npm ci --offline` **failed** (`ENOTCACHED`: zod-validation-error-4.0.2.tgz); the full production build and browser/Playwright suite could not be executed in this container.

Before release on the user's Mac, run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`.

Browser smoke test:
1. From Home, create a **new** Demo Project (opening an existing stored demo does not rewrite it).
2. Confirm new branded master and all editable layers.
3. Generate Meta Story and PMAX Landscape with each composition, inspect both artboards at 100%; check safety/legibility.
4. Customize a Meta layer position, generate selected again, verify custom status and exact position retained.
5. With customized Meta artboard active, select a new composition and apply; cancellation should keep position, confirmation should explicitly replace composition and remain undoable.
6. Export variants at native size.

Limitations: the deterministic resize engine does not guarantee perfect small-format typography. Verify GDN banners visually.
