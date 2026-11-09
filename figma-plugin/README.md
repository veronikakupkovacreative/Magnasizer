# MAGNASIZER Bridge 0.1.2 — original artwork + copy fix

A local Figma Design development plugin. It transfers a frame as editable basic layers + PNG layers. It does **not** upload data to a server.

## Updating your existing plugin (recommended)

1. Unzip this archive.
2. Find the **original development plugin folder** already registered in Figma. In it, replace **only `code.js` and `ui.html`** with the new files. Keep its existing `manifest.json` so you do not lose the plugin ID.
3. Close the old plugin panel. In Figma, select a frame, then run MAGNASIZER Bridge from **Plugins → Development** again. You should see **Bridge 0.1.2** at the top.
4. Click **Prepare selected frame**. The panel shows progress and then says **N layers ready**.
5. Click **Copy for MAGNASIZER**. The panel confirms the clipboard copy (or exposes manual copy if blocked).
6. Open `http://localhost:3000` in the running MAGNASIZER app and use **Paste from Figma**.

If you did not save the original plugin folder, import this new plugin through **Plugins → Development → Import plugin from manifest…**. Before importing, replace `REPLACE_WITH_FIGMA_GENERATED_ID` in `manifest.json` with your generated development plugin ID (or copy the `id` from your current manifest).

## If Figma blocks the clipboard

Use **Download .magnasizer.json instead**, then import that file into MAGNASIZER using the regular file Import area. Alternatively, expand **Manual copy**, click **Select entire transfer text**, press **Cmd+C** (Mac) or **Ctrl+C** (Windows), then use MAGNASIZER's **Paste manually**.

## Troubleshooting

- **Only Prepare is visible / nothing happens:** Confirm the plugin header says **Bridge 0.1.2**. The old 0.1 build did not provide adequate progress information.
- **An error about an image being too large:** Try **Flatten entire frame**, prepare again, or reduce the frame's dimensions.
- **No frame selected:** Select exactly one top-level Frame, Component or Instance in Figma Design.
- **Copied but app rejects input:** Use Download `.magnasizer.json` and import the file on the start page to bypass clipboard permissions.

## Limits

- Text/basic rectangles: editable where possible; masks, effects, vectors, image fills: individual PNG layers.
- Max 180 exported layers, 8192 px per side, 8 MB per raster image and 17 MB total raster bytes.
- Clipboard permissions depend on Figma desktop/browser; manual and file options are provided.
- Requires MAGNASIZER 0.8.2+ for `.magnasizer.json` import.


## Brand assets

The monogram and wordmark SVGs are the client-provided originals, included byte-for-byte. No red recoloring or font-generated substitute. Plugin actions follow Figma native UI accent colors.
