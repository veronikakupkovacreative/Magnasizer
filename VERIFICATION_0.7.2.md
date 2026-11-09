# Smart Resize Studio 0.7.2 — QA

1. Open Demo Project, select two or more layers, and press Cmd+G.
2. Click the group label in Layers; verify all children are selected.
3. Drag the group by a visible layer on the canvas. Verify all members move the same distance.
4. Zoom above 40%, resize the selected group using a corner anchor; ensure children resize together and fonts are not stretched.
5. Undo and redo the entire group resize.
6. Double-click an individual shape within the group; confirm only that layer is selected and its properties are editable.
7. Double-click grouped text; confirm its inline editing overlay opens.
8. Right-click or Control-click a grouped object on macOS; inspect the context menu.
9. Use `Select whole group` and `Edit this layer` from the menu.
10. Ungroup via menu or Cmd+Shift+G; save, reload, export and verify all elements.

Brand style libraries are **not** part of this release.
