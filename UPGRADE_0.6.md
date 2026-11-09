# Smart Resize Studio 0.6.0 — Release notes

The application continues from the existing 0.5.2 architecture, multi-artboard workspace, editing and local persistence. No user project migration is required: `Variant.composition` is an optional schema v2 property, with older projects implicitly displaying `Balanced`.

## Using the new Smart Compose UI

1. Open an existing project or use **Open Demo Project** for the redesigned, fully editable FORM 1200 x 1200 master. Existing projects are intentionally not replaced by the new template.
2. Click **Resize**. Choose any of three downscaled real render previews: **Balanced**, **Product-led**, or **Copy-led**. These thumbnails use the same Konva rendering implementation as PNG exports, with a capped preview resolution; exports remain full resolution.
3. Select Meta, Performance Max, or GDN formats and click **Generate selected**.
4. Select a generated artboard, open **Resize** and choose a different composition to compare. Click **Apply to artboard** for that artboard alone.
5. If the artboard was manually customized, a confirmation dialog must be accepted before its layout is replaced. Cancel keeps the customized variant intact; Undo can revert the explicit replacement.

## Image and typography guarantees

- Original copy strings and stable layer source IDs are not rewritten.
- Product and logo images retain source aspect ratio. Photos marked `Fill area (crop)` and assigned the `background` role can be cropped nondestructively with anchor bias; this does not rewrite image bytes.
- Text-box dimensions and font sizes are calculated per composition; glyphs are never geometrically stretched.
- Extremely compact formats may hide low-priority non-mandatory copy/decorations. Required elements remain visible. Warning/preflight tools still report issues that need a designer's attention.
- Layout output is deterministic for a given master + preset + composition (apart from generated document/variant UUIDs). No network or AI service is involved.

## UI changes

- Updated dark/light design tokens and cleaner editor toolbar, plus a larger three-preview Resize panel.
- Stronger welcome-page hierarchy, updated editable FORM campaign hero and matched preview styling.
- Custom font support, repositionable artboards, safe zones, exports, undo/redo and local project backups from 0.5.2 remain.

## Known limits

- Competing headline/product/CTA requirements may be physically impossible to fit in small GDN formats. The engine is deterministic, not a trained visual perception or semantic subject-aware model; use the existing warnings and adjust manually.
- The active variant can be previewed in all compositions before applying, but selecting a generation batch applies one chosen style to that batch. Each artboard can subsequently choose its own style.
- The new demo is only used when opening a **new demo project**. Your saved older demo remains unmodified.
- Final production build and end-to-end validation require local dependencies and browser. This environment cannot obtain all npm packages offline.
