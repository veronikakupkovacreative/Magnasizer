# Smart Resize Studio 0.8.1 — Raster Master & Smart Crop

## What changed

- Importing exactly one PNG/JPG/WebP from the welcome screen creates a master at its natural pixel dimensions (64–8192 px per axis). Importing one such image into an empty master has the same behavior.
- The image is kept as one editable image layer. Flat artwork is **not** falsely presented as separated text, logos or products.
- The Resize panel detects a flat master and presents three actual export-rendered previews for the target format:
  - **Contain** — full image with letterboxing using the artboard background.
  - **Cover** — fill with non-destructive, focal-point-directed crop.
  - **Smart crop** — try a focal-point-directed crop while keeping the user-configured protected region intact; fall back to Contain when that region would be cut.
- The focal point (horizontal and vertical) and protection-area size can be changed in the Resize panel.
- Each generated variant saves its applied raster settings separately. Editing the settings does not change variants until Generate or Apply to artboard.
- Manually customized variants retain their crops, text, geometry and status on regeneration; explicit Apply requests confirmation before replacing them.
- All exports continue to use the exact pixel dimensions of each artboard, independent of editor zoom.
- Layered documents still use the existing Smart Auto Layout and Brand Styles.

## Deliberate limitations

- There is no OCR, image segmentation, or extraction of embedded logos/text. Smart crop protects only the region the user chooses.
- Flat raster mode applies while the master is a **single** visible, unrotated image. Adding independent layers uses the existing layered composition engine.
- Images with either dimension below 64 px or an extreme aspect ratio outside 1:10–10:1 use the ordinary image-layer import workflow due to minimum layer sizes.

## QA

Run `npm install`, `npm run typecheck`, `npm test`, `npm run build` and browser tests on a machine with npm dependencies available.

Test a real 1200x628 JPG or PNG as the only imported file, then generate Meta Story, PMAX Landscape and GDN 728x90. Try all three fit modes, change focal point and protected region, save/reopen, edit one resize and regenerate, then export ZIP.

## Verification performed in this build environment
- 87 TS/TSX files parsed without syntax errors.
- 99 deterministic flat-layout scenarios across three source ratios, eleven output sizes, and three fit modes passed checks for aspect ratio, bounds, minimum geometry and safe fallback.
- Full `npm ci`, Next.js build and Playwright tests are **not verified** here because the npm cache lacks required packages (`ENOTCACHED`).
