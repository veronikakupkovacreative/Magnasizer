# Smart Resize Studio 0.4.0 — Workspace update

All generated Meta, Performance Max and Google Display creative formats now appear together with the 1200 × 1200 master on one workspace (no variant tabs). Each artboard preserves its own editable document. Click an artboard or choose it from **Artboards** in the sidebar to see its layers and properties.

## Controls

- **Fit**: fit all artboards.
- **Sidebar artboard click**: activate and zoom to that artboard.
- **Artboard label single click**: activate without changing the view.
- **Artboard label double click**: activate and focus.
- **Space + drag**: pan the workspace.
- **Trackpad scroll**: pan; **Cmd/Ctrl + wheel**: zoom around cursor.
- **100%**: display exact 1:1 artboard scale.
- **Double-click text**: edit directly on its artboard.
- **Resize**: add or regenerate formats; all appear automatically on the same workspace.

## Setup on macOS

Use the terminal in the extracted `smart-resize-studio` directory:

```sh
npm ci
npm run dev
```

Then visit http://localhost:3000. Node.js 22+ is required; use a current maintenance release of Node 22 or newer.

## Verification

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Workspace positions and zoom are view settings. Original design coordinates, original artboard dimensions, variants and asset data remain unchanged. A generated variant still has its own independent edits; changing the selected variant marks it customized in the original project model.
