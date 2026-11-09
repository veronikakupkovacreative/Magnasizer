# Verification — Smart Resize Studio 0.7.1

## Checks executed
- TypeScript/TSX syntax parser: 66 source and test files, 0 syntax errors.
- Isolated group command smoke tests (schema parser mocked): group creation, rename, batch movement, undo/redo and ungroup — passed.
- Archive existence and integrity, including npm lockfile and editable source — checked at packaging.

## Not verified here
- Full TypeScript semantic typecheck.
- ESLint, full Vitest suite, Next.js production build and Playwright browser tests.
- Browser-based group transform/persistence requires the local user acceptance test.

The environment could not complete installing the repository's exact npm dependencies. The package lockfile is restored from 0.6.2 with root version updated to 0.7.1. No new dependencies were added.

## Acceptance checklist
1. Open a demo project. Select headline + copy + CTA using Shift/Cmd/Ctrl; click Group.
2. A named folder appears in Layers. Rename it using a double-click and collapse/expand it.
3. Click a grouped object on canvas and drag it: the other members move by the same delta.
4. Zoom to >=40%, scale the group. Objects should remain editable individually.
5. Alt-click a child, edit its typography/content, and verify it stays in the group.
6. Lock/hide the group, then unlock/show it.
7. Duplicate the whole group and confirm independent membership.
8. Undo and redo Group / Ungroup.
9. Save and reopen; groups survive. Export individual or all artboards as before.
