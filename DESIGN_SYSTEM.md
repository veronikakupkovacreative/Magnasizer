# Design system

Product: Smart Resize Studio. Visual direction: precise creative desktop tool; Figma-level density with Canva-level discoverability. No generic analytics-dashboard aesthetic.

## Tokens
Dark: canvas #101114; panel #191B20; elevated #22252B; border #32353D; primary text #F5F5F5; secondary #A7ABB5; accent #A78BFA; success #39C98A; warning #F4B860; danger #F07178.
Light: canvas #F4F5F7; panel #FFFFFF; elevated #F8F9FA; border #D8DBE1; primary text #17191E; secondary #555B66; accent #7155D9. Check actual contrast of interactive states.
Typography: Geist or Inter, 12/14/16/20/28 scale. Spacing: 4px grid. Radius: 6–10px for controls, 12px for dialogs. Crisp 1px borders, restrained shadows. Iconography: Lucide.

## App shell
Top toolbar 56px; left assets/layers rail approximately 256px; central zoomable workspace; right properties panel approximately 320px. Panels collapsible and resizable. Artboards show format, dimensions, validation status and customization state. Two modes: overview grid and focused edit. Persist zoom, panel layout and theme.

## Screens
1. Welcome/import: oversized dropzone, create project, recent projects, example project, privacy note.
2. Authentication: Google, email/password, recovery, verification.
3. Projects: cards/list, search, sorting, create/rename/archive/delete.
4. Editor: master and variant tabs, layer tree, canvas, property inspector, generate action, safe-zone overlays, warnings.
5. Format picker: platform groups, presets, custom dimensions, saved preset groups.
6. Generation review: layout suggestions, per-artboard status, preserve existing overrides.
7. Export center: choose formats, filename convention, warnings, progress and ZIP.
8. Settings: language, theme, account, privacy, storage and brand kits.

## States and interactions
For every major screen: empty, loading, success, recoverable error, disabled, hover, focus and keyboard navigation. No fake actions or dead buttons. Show meaningful progress for uploads/generation/exports. Confirm destructive operations. Support Escape, arrows, delete, copy/paste, undo/redo where appropriate. Avoid destructive auto-fixes.
