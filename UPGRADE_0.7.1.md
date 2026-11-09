# Smart Resize Studio 0.7.1 — Group layers

## Changes

- Added persistent named groups without flattening editable objects.
- Group multiple selected objects with `Cmd/Ctrl + G`; ungroup with `Cmd/Ctrl + Shift + G`.
- Group folders appear in the layer list. They can be expanded/collapsed, renamed and selected; locking and hiding applies to all group members.
- Clicking an object inside a group selects the group; Alt-click selects an individual child for direct editing.
- Moving a group on canvas moves all selected members. Existing multi-select Konva transform handles support scaling members together at editing zoom levels.
- Duplicating a whole group creates an independent group; duplicating an individual child leaves it ungrouped.
- Groups survive Save/Open, portable JSON backups, undo/redo, variant generation and independent variant edits.
- Fixed malformed starter demo text in the first 0.7.0 archive and restored a complete package-lock.json for npm ci.

## Compatibility

Existing schema version 2 project bundles continue to load. Two optional layer fields are added: `groupId` and `groupName`. Exported banner dimensions and pixels are not affected by the grouping metadata itself. One level of grouping is supported. Groups do not nest.

## Validation

Syntax verification and standalone group-command behavior checks were run. Full build, lint, Vitest and Playwright require installing dependencies, which could not be completed in this environment. See VERIFICATION_0.7.1.md.
