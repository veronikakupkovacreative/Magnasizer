# Roadmap and acceptance gates

The release sequence below starts with Phase 0. Product and architecture documents also describe long-term capabilities; only the explicitly completed release scope is implemented.

## 0. Scaffold and vertical slice — completed

Next.js app, strict TypeScript, lint, tests, theme, i18n, accessible shell and example project. One editable master canvas with text, shape and image layers; drag/select/resize, undo/redo and local save/reload. No cloud credentials required.

Gate: builds, tests pass and all visible controls work. Phase 0 was verified on 22 October 2026; its editor, themes, localization and document model form the base of Phase 1.

## 1. Advanced Canvas Editor & Asset Import — completed

Release: **0.2.0**. Verified on **23 October 2026**: strict typecheck, lint, 48 unit tests, production build, 12 browser flows and visual review passed. Actual commands and environment limitations are recorded in `VERIFICATION.md`.

- Direct on-canvas text editing by double-click or Enter, multiline content, typography/zoom alignment, commit/cancel and undo/redo. Typography controls stay in the inspector; primary text-content editing is on the artboard.
- Import PNG, JPG/JPEG, WebP and the supported SVG subset, including drag-and-drop. Preserve immutable original bytes; validate raster signatures/dimensions and sanitize separate SVG render copies. Reject unsupported SVG presentation instead of silently rasterizing it.
- Layer naming, locking, visibility, duplication, copy/paste and stacking order. Multiple selection through modifier clicks, a list range or marquee; shared move and proportional transform commands.
- Nondestructive image crop, editable boundaries, numeric controls and restoration of the full image.
- Smart guides for movement relative to artboard edges/centers and other visible layers, with an Alt bypass.
- Keyboard editing controls that respect text inputs, composition and modal interactions; fit/zoom/pan; existing themes and English/Czech localization.
- Schema version 2 with migration from Phase 0; separate project/asset/blob persistence; complete portable project backups and validation on import.
- Saved per-layer resize metadata for the next phase. The engine itself remains unimplemented.

Gate: reopen projects and imported backups with identical layout and asset references; preserve originals and image proportions; keep undo/redo stable for text, crop, imports and multiple-layer gestures. Run typecheck, lint, unit tests, production build, browser interaction tests and visual checks before closing the phase.

Scope limits: one master, flat image imports, one SVG image layer per file, bundled Inter only, desktop editor, persistent named groups introduced in 0.7.1; nested groups or group-local coordinate systems remain out of scope. Group-like multi-selection in earlier releases did not store a group. See `README.md` for exact import limits, supported SVG features and interaction details.

## 2. Resize engine — in progress

Release **0.3.0** adds the first end-to-end resize workflow: preset selection, generation, artboard switching, safe-zone overlays, warnings, editable variants and preservation of customized variants. The phase remains in progress until the full regression suite and remaining custom-dimension/layout-strategy work are completed.

Preparation baseline: new masters start at **1200 × 1200 px**. Text-box transforms resize and reflow the container without scaling or distorting glyphs; typography size remains an explicit property. Additional font families remain a later typography task and are not claimed as part of this baseline.

Versioned Meta/PMAX/GDN presets, custom dimensions, deterministic strategies, per-layer constraints, variant override model, safe-zone overlays and warnings. Use the saved Phase 1 layer metadata without losing approved copy or image proportions.

Gate: generate at least four ratios from one master; preserve product/logo proportions and custom edits.

## 3. Cloud and export — planned

Supabase Auth with Google/email, row-level security, project and asset storage, deletion policies, export PNG/JPG/WebP/ZIP, filename templates, manifest and server validation.

Gate: separate accounts cannot access each other's projects; exported pixel dimensions are exact.

## 4. Advanced production — planned

Figma import plugin, brand kits, more platforms, SVG export where supported, batch campaigns, AI smart crop/background extension and optional layer recovery.

Gate: document fidelity limits, consent, quality and cost checks. AI recovery of raster layers remains experimental; it must not silently replace originals or approved content.

## Quality bar for each phase

Typecheck, lint, unit tests, end-to-end happy path, keyboard accessibility, light/dark visual QA, mobile shell check and no broken controls. Update documentation and record limitations and actual verification results before marking a phase complete.

## 0.4.0 — Unified multi-artboard workspace (implemented in source)
- Replaced resize tabs with a single Konva Stage rendering master and all generated variants.
- True pixel-proportioned artboards laid out in rows with distinct backgrounds, labels, statuses, and selection outlines.
- Shared zoom/pan (wheel/trackpad and Space-drag), fit all, focus an artboard via the sidebar or double-click its canvas label, and 100% zoom.
- One active artboard at a time; its layers and properties appear in the existing panels. All variants remain editable independently.
- Existing direct text overlay, image crop workflow, smart guides, master/variant history, safe zones, regeneration and persistence retained.
- Introduced unit coverage for artboard layout and updated resize E2E coverage for simultaneous rendering.
- Environment note: full npm/Playwright validation requires dependencies; this delivery environment could not reach the npm registry.

## 0.5.0 — Production workspace (implemented in source)

- Artboard drag by canvas label with edge/center snapping, an Alt bypass, stored workspace coordinates and auto-arrange reset. Original design geometry and per-format exports remain unaffected.
- Create custom artboards, duplicate/rename/delete variants, retain master protection and project history.
- Typography controls with bundled Inter, system font options, validated imported TTF/OTF/WOFF2 and binary persistence in IndexedDB/portable backups.
- Full-resolution PNG/JPG/WebP export with individually selectable artboards, standard multi-file ZIP and per-format filenames.
- Production preflight issues for safe-zone violations, geometry outside artboards, small type, possible text overflow and missing assets, with click-to-focus.
- Unit/browser regression tests added. Delivery environment cannot install npm dependencies, so full typecheck/lint/Vitest/Playwright/build remain **pending local validation**; see `VERIFICATION_0.5.md`.

Next: stronger automatic layout strategies, import fidelity and design-system-aware typography. Cloud storage, Figma integration and AI remain future capabilities.

## 0.5.1 — Workspace usability bug fixes (implemented in source)

- Made variant deletion discoverable on every artboard row, replaced the out-of-viewport inline confirmation with an accessible modal, preserved undo and master protection, and cleaned obsolete stored artboard coordinates.
- Reworked font upload into a persistent Project fonts section usable without layer selection, added quick upload access alongside the font selector, and clarified file format and browser decoding errors.
- Reduced transformer handle sizes for zoomed-out multi-artboard overviews; maintain actual geometry and output resolution.
- Added unit tests for font headers and transform handle sizing and Playwright coverage for deletion confirmation and invalid font errors.
- Remaining release gate: full `npm ci`, typecheck, lint, unit/e2e and production build on a machine with dependencies and compatible Node; see `VERIFICATION_0.5.1.md`.

## 0.5.2 — Overview selection usability patch (implemented in source)

- Removed Konva resize handles entirely from overview zoom below 40%; replaced with thin noninteractive selection outlines. Normal resize handles remain available at >= 40% zoom.
- Preserved selection, drag, editing, undo, snapping, export, variant customization and stored document geometry; an overview selection outline tracks layer drags.
- Added unit tests for overview/precision mode switching and a browser regression test that checks mode changes at 10% and 50% zoom.
- Installation, full build and browser test execution remain a local verification gate; see `VERIFICATION_0.5.2.md`.

## 0.6.0 — Smart compositions and visual refresh (implemented in source)

- Introduced Smart Layout Engine 2.0 with explicit Balanced, Product-led and Copy-led modes, role-aware placement for portrait, square, landscape and compact inventory, constrained text fitting and independent master/variant geometries.
- Replaced aspect-only layout previews with three **actual rendered** composition previews using the same Konva renderer as exported PNGs.
- Added per-artboard composition application with a confirmation dialog protecting manual customizations. Re-generating format batches retains customized artboards, stable variant IDs and workspace positions.
- Preserved original image ratios; enabled nondestructive anchor-biased cropping for images explicitly designated as fill-sized backgrounds. No AI subject segmentation is claimed.
- Reworked the 1200 × 1200 editable FORM demo creative with a more editorial visual hierarchy, deep forest product panel, upgraded type sizes and CTA styling. Existing saved projects remain unchanged.
- Refreshed the welcome page, editor chrome and Resize panel, with dark/light themes and EN/CS labels.
- Added layout, compatibility, source preservation and crop unit tests plus browser flows for composition selection and manual override protection.

Release gate: complete local `npm ci`, typecheck, lint, Vitest, Next.js build and Playwright checks on Node compatible with the repository. Offline npm registry/cache in the build environment prevents this final verification. See `VERIFICATION_0.6.md`.


### 0.6.1 — Editorial demo refresh and composition UX clarity
- [x] Replace starter demo with a more purposeful dark/editorial FORM campaign while retaining ten editable layers and original master dimensions.
- [x] Make welcome-screen preview and new-demo behavior explicit.
- [x] Show how to apply layouts to an existing artboard and count selected protected customized variants.
- [x] Add regression coverage for new demo, all 11 format presets x 3 composition modes, and manual variant preservation.
- [ ] Confirm all browser interactions in a fully provisioned local environment; static validation is not equivalent to Playwright tests.


### 0.6.2 — Project deletion and composition guard (implemented in source)
- [x] Add a dedicated delete button to every recent project card, independent of the open action.
- [x] Require a visible EN/CS permanent-deletion confirmation; keep the dialog open if IndexedDB fails.
- [x] Atomically delete one project and its project-scoped asset metadata, reclaim only binary blobs that are not used by surviving projects, including legacy-store references.
- [x] Refresh project listing immediately after successful deletion; preserve unrelated local projects.
- [x] Disable same-mode recomposition of an already customized artboard, preventing accidental loss of approved manual adjustments.
- [x] Extend storage, composition and Playwright regression coverage; update demo-based test names.
- [ ] Release gate: full build, typecheck, lint, Vitest and browser tests on a compatible Node installation with npm access.

## 0.7.1 — Layer grouping and 0.7 packaging fix

- [x] Add persistent `groupId` and `groupName` metadata to the existing strict layer schema (without changing bundle format).
- [x] Allow creating, renaming and ungrouping selections in one reversible history entry.
- [x] Show collapsible group folders in the Layers panel with group-level visibility and lock controls.
- [x] Select and move/transform the group from canvas interactions; Alt-click individual children.
- [x] Preserve group membership in resized variants and independent group IDs on duplicate.
- [x] Add EN/CS controls and keyboard shortcuts: Cmd/Ctrl+G and Cmd/Ctrl+Shift+G.
- [x] Correct broken newline string literals in the original 0.7.0 demo and reinstate package-lock.json.
- [x] Add grouping behavior regression tests and static syntax check.
- [ ] Full dependency-based typecheck, lint, Vitest, build and browser tests remain to run on a network-enabled Node 22.22.2+ environment.

## 0.7.2 — Group editing and canvas context actions
- Targeted fix for group movement and proportional group transforms.
- Discoverable member editing by double-click and canvas context menu (right-click or macOS Control-click).
- Context menu operations for group selection and common layer actions.
- Named Figma-like global brand style libraries remain deferred.

## 0.8.0 — Linked Brand Styles + Auto Layout
- [x] Named project-level color styles and typography styles, persistent in `.srs.json` and local projects.
- [x] Link colors to text/shape fills and artboard backgrounds, with central recolor across master + every linked resize.
- [x] Link text styles to text layers, with central family/weight/alignment and proportional font-size updates for resize variants.
- [x] Create, rename, edit, detach and delete linked styles through the inspector; retain current visual values on detach/deletion.
- [x] Demo with linked FOREST/CREAM/LIME/SAGE colors and H1/BODY/CTA text styles.
- [x] Add Auto composition mode alongside Balanced/Product-led/Copy-led, using score-based selection of all three plans for each preset.
- [x] Improve format-aware layout areas and preserve exact text, image ratios and custom variants.
- [x] Add regression tests for linked styles, auto composition and legacy project parsing.
- [ ] Full build, lint, Vitest and Playwright release gate on a machine with required npm dependencies.
- [ ] Future: shared brand-library across projects, logo assets in Brand Kit and more advanced typography measurement/subject-aware cropping.

## 0.8.1 — Raster workflow (implemented; local QA required)
- Single PNG/JPG/WebP becomes a native-dimension flat-image master.
- Contain/Cover/Smart Crop, focal point and protected area, actual render previews.
- Selected fit stored separately per generated artboard; customized artboards preserved.
- Existing layered banner, typography, groups, brand styles and export workflow retained.
- No raster layer reconstruction/OCR; remain on later roadmap.
