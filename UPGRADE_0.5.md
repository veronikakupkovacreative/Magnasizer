# Smart Resize Studio 0.5.0 — Production tools

The 0.4 shared-canvas architecture remains in place. This release adds manual artboard positioning, artboard management, custom fonts, bulk creative export and preflight checks. No existing master/variant document is flattened or modified as part of workspace arrangement.

## Quick guide

1. **Move artboards:** drag the name above a frame; release to persist the location (unsaved marker appears). Magnet snapping uses a 9-pixel threshold; hold Alt to temporarily bypass. Click the grid icon in **Artboards** to reset automatic placement.
2. **Manage artboards:** select a generated variant in the left panel; use pencil/copy/trash icons. Click `+` in Artboards to add a custom dimension. The 1200×1200 master cannot be deleted.
3. **Use your fonts:** select a text layer; choose a system font or upload a licensed `.ttf`, `.otf`, or `.woff2` file under Typography. Saving your project stores the font alongside assets. Portable `.srs.json` backups include font bytes.
4. **Export:** press **Export creatives** on the top toolbar; select format (PNG/JPG/WebP) and artboards. One format downloads directly as an image, multiple formats as a ZIP. Exact document dimensions are retained.
5. **Preflight:** open the second tab of the Export dialog, click an issue to focus its layer, correct as needed, then export. Warnings are advisory and do not alter designs.

## Technical notes

- `Project.workspacePositions` is an optional map keyed by master/variant IDs. Projects from 0.4 load without migration; legacy formats still migrate using the existing logic. Artboard position is absent from exported image data.
- `Asset.kind='imported-font'` stores a unique hash-keyed binary. The 0.5 asset type is compatible with the existing version-2 project bundle. Project backups validate font hashes, MIME types and byte counts.
- ZIP export is client-side; stored entries are intentionally uncompressed to preserve output. It does not require additional npm packages, cloud APIs or credentials.
- Preflight checks use browser font metrics and estimate text wrapping. Verify important copy in the editor before delivery.

## Mac terminal

```sh
cd ~/Downloads/smart-resize-studio-0.5/smart-resize-studio
npm ci
npm run dev
```

If your extracted folder has a different nesting, use `cd` to enter the directory containing `package.json` instead. Stop an older running `npm run dev` server first with Ctrl+C.
