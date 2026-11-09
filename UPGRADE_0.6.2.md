# Smart Resize Studio 0.6.2 — Project deletion & stability

This update continues from 0.6.1. It is a maintenance release, not a new resize-engine rewrite.

## Delete a local project

Open the project overview (`/`). Each card in **Recent projects** now has two separate controls: open the project, or delete it (trash icon on the right). Select the trash icon, inspect the project name in the confirmation dialog and choose **Delete permanently**. Cancel leaves everything intact.

Deletion is irreversible and applies to browser-local data, including the project's saved master, generated variants, associated asset records and unshared stored image/font blobs. Download an `.srs.json` backup from the editor before deletion if you might need the work again. Browser projects do not automatically sync to other computers or cloud accounts.

The UI updates only after IndexedDB successfully commits; on error the dialog stays open and displays a recovery message. The deleted project stays absent on page reload. An unrelated project is not touched. Duplicate files/content-addressed binary records shared with surviving projects are preserved until no projects reference them. Early-version, unscoped asset entries are similarly kept while another project references them.

## Composition stability

- Confirmed and expanded regression assertions for preserving customized variants and approved copy during a new generation batch.
- The **Apply to artboard** action is only enabled after choosing a different composition. This avoids accidentally replacing a customized layout by reapplying its currently active mode. When applying a changed mode to a customized artboard, the explicit confirmation still appears.
- Prior 0.6.1 demo and UI remain; existing saved projects are never reset to the example design.
- Updated older browser fixtures to reflect the 0.6.1 demo's new layer name and coordinates.

## Expected QA in browser

1. Create two projects. On Home, click the bin on one of them. Cancel: both remain. Confirm: only the selected project disappears, also after refresh.
2. Open the survivor and verify its layers and images are still intact.
3. If using imported files in both projects, delete one and verify the survivor still displays its own files and uploaded fonts.
4. Create a new demo project, generate Story and PMAX, edit one variant, regenerate and confirm your manual edit survived. Save, refresh and repeat.
5. With the edited variant selected, open Resize. The current composition must not be reapplied without selecting a different mode; changing modes shows a confirmation before replacing a custom layout.
6. Confirm exports still retain exact native dimensions.

## Notes

- Deleting an artboard is a separate, undoable edit. **Deleting an entire project is permanent and cannot be undone.**
- 0.6.2 remains fully local-first; project deletion only affects data for this browser origin.
- As with earlier versions, the final browser smoke tests, Playwright, lint and full production build should be run on a machine with installed npm dependencies.
