# Smart Resize Studio 0.7.2 — Group editing hotfix

This is a targeted bug-fix release built on 0.7.1. It does **not** add persistent brand style libraries. Those remain planned separately.

## Changes

- Group dragging uses the original member positions as a shared snapshot. A single committed history operation translates all selected group members by the same delta, without drifting apart.
- Group transforms commit real dimensions and positions for each member. Text font size is scaled uniformly when resizing a group, rather than leaving distorted Konva scales behind. Single text-box resizing retains the existing text-wrap behavior.
- When all members of a group are selected at overview zoom, one thin group bounding box is drawn, rather than individual outlines for every child.
- Double-clicking any grouped child selects it individually. Double-clicking grouped text also opens direct on-canvas text editing.
- Right-click / macOS Control-click on a canvas object opens a context menu: edit individual layer, select whole group, ungroup, group selected, duplicate, delete.
- The context menu closes on Escape or outside click.
- A concise group editing hint appears while a complete group is selected.
- Brand style management in the Figma sense (named shared colors/fonts/effects linked across layers) remains a future release.

## Compatibility

- Existing `.srs.json` projects remain compatible and their group metadata is unchanged.
- No document schema migration was required.
- The existing command history and protections for customized resize variants are retained.

## Tests

- TS/TSX syntax check of source files.
- Node smoke test of translation, proportional text resizing and group bounds.
- Added Vitest regression cases in `src/features/editor/model/group-transform.test.ts`.
- Full Next.js/Vitest/Playwright verification requires a successful local `npm ci`; not confirmed in this environment.
