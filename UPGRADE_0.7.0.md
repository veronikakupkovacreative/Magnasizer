# Smart Resize Studio 0.7.0

## Scope of this release
This is the first 0.7 implementation pass.
It focuses on:

1. a redesigned demo banner that matches the new visual direction,
2. stronger composition behavior in Smart Resize,
3. the first Brand Kit utility in the properties panel.

---

## Implemented in 0.7.0

### 1) New demo master banner
The bundled FORM demo was rebuilt to better match the supplied reference:
- dark editorial background,
- large two-line headline: `BETTER. / BY`,
- tighter copy sizing,
- light green circular product spotlight,
- product bottle positioned on the right,
- CTA reduced to a cleaner compact pill button,
- smaller edition detail at the bottom.

The demo still stays fully editable layer-by-layer.

### 2) Better Smart Resize composition logic
The resize engine now handles composition with more deliberate rules for:
- landscape formats,
- portrait / stacked formats,
- compact small banners.

Refinements include:
- improved copy/media split by composition mode,
- better product scaling per format,
- improved decoration scaling,
- calmer vertical rhythm for logo, eyebrow, headline, body and CTA,
- more usable CTA sizing in portrait layouts.

### 3) First Brand Kit block
A new `Brand kit` section was added to the properties panel.
It currently provides:
- automatic extraction of project color swatches,
- one-click application of a swatch to the selected text or shape,
- one-click application to artboard background when no layer is selected.

This is the starting point for broader 0.7 brand-system tooling.

### 4) Version bump
UI and package version updated to `0.7.0`.

---

## Notes
- Existing behavior for protected customized resize variants remains preserved.
- The release is intentionally focused and does not yet include the full future Brand Kit roadmap.
