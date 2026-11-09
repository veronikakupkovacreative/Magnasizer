# Smart Resize Studio 0.5.2 — overview selection fix

## User-reported problem

Version 0.5.1 fixed deletion and font import but the transformation grips still appeared too large around selected layers at ~12% workspace zoom. Merely adjusting Konva `anchorSize` did not fix the user's screen.

## Resolution

At <40% workspace zoom, skip rendering Konva `Transformer` entirely. Display a thin purple selection outline instead; there are no grip rectangles to cover the banner. Selection, layer dragging, smart guides, inspector editing and undo/redo remain available. The outline follows active layer drag movement. At 40% or greater, show the transform handles to permit precise visual resizing.

This changes editor controls only: it does not alter artboard coordinates, document layer geometry, smart resize calculation, saved project data or exported resolutions. There is no schema migration.

## Manual acceptance check

1. Use **Fit** or select **10%** zoom, select a large shape or text layer. The selection is a thin outline only; no large white squares.
2. Drag that selected element while zoomed out. The outline follows and the layer remains in the new position on release.
3. Zoom to **50%**. Normal resize handles appear; resize the layer.
4. Zoom back to **10%**. The large handles are gone again.
5. Save and reopen the project; verify the layer size and position are unchanged unless edited.

If old white handles remain visible, stop the previous dev server (Control+C), start version 0.5.2 in its own directory and hard-reload the browser.
