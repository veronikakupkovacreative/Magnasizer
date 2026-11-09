# MAGNASIZER — Smart Creative Resizing (0.8.2)

**The UI brand is MAGNASIZER.** The internal package name, IndexedDB key and `.srs.json` format identifier retain `smart-resize-studio` for full backward compatibility with previously saved projects.

**What is new:** improved compact GDN compositions (320×100, 728×90, 300×250 and 336×280), the client-provided MAGNASIZER SVG identity (original navy artwork, no global UI recolor), and **MAGNASIZER Bridge** — a local Figma development plugin. Select a Figma frame, copy using the plugin, and paste or import a `.magnasizer.json` transfer on the app's welcome screen. Supported text and basic shapes remain editable; complex nodes are rasterized separately. See [UPGRADE_0.8.2.md](UPGRADE_0.8.2.md), [BRAND_CORRECTION_0.8.2.md](BRAND_CORRECTION_0.8.2.md), [QA_0.8.2.md](QA_0.8.2.md), and [figma-plugin/README.md](figma-plugin/README.md).

Run with a supported Node.js 22.22.2+ or current 24.x release:

```bash
npm ci
npm run dev
```

Existing single-image PNG/JPG/WebP masters continue to use Contain / Cover / Smart Crop. Imported Figma frames that are deliberately flattened to one image also enter that raster workflow. Existing editable projects, brand styles, group editing and ZIP export remain intact.

---

## Previous release documentation

> **0.6.2:** Project deletion on the Home screen, persistent IndexedDB cleanup without removing shared assets, and safer per-artboard composition controls. See [UPGRADE_0.6.2.md](UPGRADE_0.6.2.md) and [VERIFICATION_0.6.2.md](VERIFICATION_0.6.2.md). Existing projects remain unchanged until you explicitly delete one.

> **0.6.1:** Revised editable demo campaign + clearer composition workflow. See [UPGRADE_0.6.1.md](UPGRADE_0.6.1.md). Existing saved projects do not change.

# Smart Resize Studio — Local-first multi-artboard editor (0.8.0)

Version **0.8.0** extends the Figma-style workspace showing the 1200 × 1200 master and every generated resize artboard together, built on the completed Phase 1 editor and existing Phase 2 resize engine. It uses Next.js App Router, React, strict TypeScript, Tailwind CSS, Konva/react-konva and Zod. Projects and image assets stay in the current browser; no service credentials are required.

The master remains **1200 × 1200 px**. You can select Meta, Performance Max and GDN presets, generate editable variants, see all formats side by side, select any artboard for independent editing, review safe-zone warnings and keep manual per-variant changes.

## New in 0.8.0 — Linked Brand Styles and smarter Auto Layout

- **Brand Styles:** in Properties, create named color and text styles. Link a color to the selected text/shape or an artboard background; link a text style to any text layer. Editing the shared definition updates all linked objects on the master and every resize artboard while preserving the other layer geometry, content and manually customized layouts.
- **Detach** a style with the `Local style (unlinked)` option. Deleting a style removes its links but keeps the current visual appearance. Changes support Undo/Redo, local save and project JSON backups. Custom fonts remain supported by the existing project font importer.
- **Demo style tokens:** Forest / Base, Warm White, Lime / Accent, Sage / Copy, with H1 / Display, Body / Regular and CTA / Label.
- **Auto Layout:** a fourth option in Resize alongside Balanced, Product-led and Copy-led. It composes all three layouts and selects the highest-rated candidate based on safe zones, text-fitting and overlap checks for each format. Layout is deterministic and preserves exact text and image proportions. It does not claim to be AI-powered. Very small GDN sizes can still require manual corrections.
- **Existing data:** schema remains v2 with optional style metadata; previously saved 0.7.2 and earlier projects load without a forced migration. Demo changes do not overwrite older projects.
- **Not yet included:** reusable brand-library shared between separate projects, logo style components and advanced subject-aware image segmentation.

## Fixed in 0.7.2 — group interaction and context menu

- Select a group in Layers, then drag a grouped object: all its layers now move from one shared geometry snapshot. At 40%+ zoom, the selection Transformer also changes every member's dimensions together. Text glyphs are resized uniformly, not stretched.
- Double-click an object within a group to select the individual member; double-click a grouped text to edit its content directly. No hidden Alt-click gesture is required.
- Right-click (or macOS Control-click) an object on the artboard to open a context menu with **Edit this layer**, **Select whole group**, **Ungroup**, **Group selected**, **Duplicate** and **Delete** as applicable.
- Selecting all members of a group at overview zoom displays one group outline, with a visible hint describing group interactions.
- The original 0.7.2 did not contain linked styles; they are added in 0.8.0.

## New in 0.7.1 — editable layer groups

- Select two or more unlocked layers with Shift/Cmd/Ctrl click or a marquee, then choose **Group** (or press **Cmd/Ctrl + G**). The Layers panel shows a named, collapsible folder.
- Click a grouped object on the canvas or its folder in Layers to select the entire group. Drag or resize to transform the selection together. Use **Alt-click** on a child to work with that individual layer without breaking its group.
- Double-click a group folder name to rename it; the folder also offers lock and visibility controls for the whole group. **Ungroup** uses **Cmd/Ctrl + Shift + G**.
- Group membership is stored as optional `groupId` and `groupName` metadata on each layer. Existing `.srs.json` project files remain compatible; group creation, rename and ungroup can be undone/redone. The underlying objects stay independent and exports are not flattened.
- Duplicating a complete group creates a new independent group ID. Duplicating an individual child creates an independent ungrouped layer.
- This release supports one level of groups (no nested groups or persistent parent transforms).
- Fixes a starter-demo TS string literal issue present in the first 0.7.0 source package, and includes the complete pinned npm lockfile.

## Run locally

Use Node.js **22.22.2+** (or Node 24.15+) and npm. Dependencies are pinned in `package-lock.json`.

```bash
cd smart-resize-studio
npm ci
npm run dev
```

Open **http://localhost:3000** and choose **Open Demo Project**. Double-click the headline on the artboard to edit its text.

For a production build:

```bash
npm run build
npm run start
```

There are **no required environment variables**, `.env` files, Supabase keys, accounts, APIs or external image/font requests. Inter is bundled through Fontsource. The demo product illustration is a local SVG at `public/assets/form-bottle.svg`.

## Fixed in 0.5.2 — selection handles at overview zoom

- When zoom is below **40%**, a selected layer now shows a thin, one-pixel purple outline **without any resize handles**. The entire Konva Transformer is deliberately omitted in overview mode, so huge corner squares cannot cover the banner even when the Konva renderer handles inverse scaling differently.
- Single and multi-selection, dragging selected elements, the properties inspector and safe-zone overlays still work in overview mode; the selection outline follows drag gestures.
- Zoom to **40% or more** (or focus an artboard from the navigator) to reveal normal resize handles and precisely resize objects. The stored layer geometry and exported images are unchanged.
- Regression coverage includes overview/precision-mode transitions. This delivery environment cannot complete npm installation; see `VERIFICATION_0.5.2.md` for the exact QA status.

## Fixed in 0.5.1

- Artboard deletion now uses a visible confirmation dialog instead of a confirmation rendered below a scroll-limited sidebar list. A delete button is available next to every resize variant; the master cannot be deleted. The operation can be undone. Unused stored artboard positions are cleaned up.
- Imported fonts can be added even when no text layer is selected. The inspector includes a persistent Project fonts section, and the font selector has an adjacent upload button. Valid TTF/OTF/WOFF2 headers are checked before browser loading, with specific error messages; a newly imported font is applied automatically when an unlocked text layer is selected.
- The initial 0.5.1 handle-size adjustment was insufficient at 12% zoom. This is superseded by 0.5.2, which hides the Transformer entirely below 40% zoom and displays only the selection outline.

See `UPGRADE_0.5.1.md` and `VERIFICATION_0.5.1.md` for testing details.

## New in 0.5.0

- **Move artboards freely:** drag their canvas labels. Artboards snap to neighboring frames (hold Alt to bypass), remember their workspace positions in local projects and portable `.srs.json` files, and can be returned to their automatic grid with **Auto-arrange artboards**. Layout-only positions are never written into layer geometry or raster exports.
- **Manage resize variants:** rename, duplicate or delete an existing variant, or add a custom 64–8192 px artboard (including formats such as 1080 × 1440). The master artboard remains protected from deletion. New custom variants use the current master as an editable source.
- **Fonts:** choose from Inter, common system fonts or imported TTF/OTF/WOFF2 font files. Custom files are validated, stored in IndexedDB separately from project JSON, reloaded via FontFace, and bundled in portable project backups. Browser availability governs system fonts; import a licensed font when exact reproduction is required.
- **Bulk export:** select some/all artboards, choose PNG/JPG/WebP and export every artboard at its original pixel dimensions. One selected artboard downloads as an image; multiple artboards download as a standard ZIP. Safe-zone outlines and selection handles are never baked into exports.
- **Pre-export inspection:** review safe-zone, out-of-bounds, small-type, possible text overflow and missing-image warnings; click any issue to focus its editable layer. Warnings do not silently modify artboards and do not block export.

**Limitations:** ZIP uses stored (uncompressed) entries to preserve exact image bytes, so packages can be larger. Text-overflow inspection is advisory; inspect the creative visually, especially with custom typography. This remains local-first; Figma import and AI composition are future phases.

## Implemented

- Welcome page with a blank project, a ten-layer editable demo, recent local projects, image import and `.srs.json` project import.
- Direct text editing on the canvas, including multiline text, current typography, rotation and zoom. The inspector retains typography controls and an **Edit text on canvas** action; it has no primary text-content field.
- PNG, JPG/JPEG, WebP and supported, sanitized SVG import through a file picker or drag-and-drop. Imported files become image layers with protected proportions.
- Select, rename, lock, hide, duplicate, copy/paste, delete and reorder layers. Select multiple layers with modifier clicks, a list range or a canvas marquee; move and proportionally scale the selection together.
- Nondestructive image crop with draggable boundaries, percentage fields, keyboard crop movement and restoration of the full source image.
- Smart guides that snap movement to the artboard edges and centers and other visible layers. Hold **Alt** during a drag to bypass snapping.
- Position, size and rotation controls; text color, size, weight and alignment; shape fill and corner radius; image opacity; artboard background color.
- Immutable undo/redo with no-op filtering, redo-branch invalidation and a 100-command history. A committed text edit, image import batch, crop or multi-layer gesture is one history step.
- Version 2 project schema, migration of Phase 0 projects and transactional IndexedDB saving. Portable project backups include the imported image bytes needed to reopen in another browser.
- Resize metadata per layer: role, priority, anchor, sizing rule, safe padding and mandatory/optional status. The resize engine now uses these values to create deterministic variants.
- Resize panel with Meta, Performance Max and GDN presets, a unified multi-artboard workspace, safe-zone overlays and validation warnings.
- Per-variant editing. Once a generated variant is manually changed, it becomes **Customized** and regeneration does not overwrite it automatically.
- Dark/light themes and English/Czech UI; persisted language, theme, zoom and panel layout; independently collapsible and resizable panels.
- Loading, empty, recoverable error, disabled, unsaved and saved states; keyboard focus styles; reduced-motion support; confirmation dialogs for deletion and leaving with unsaved work.

## Multi-artboard workspace — new in 0.4.0

The master and **all generated variants render simultaneously inside a single Konva Stage**. Artboard labels and a compact navigator above the Layers panel let you select a format without changing the others. The navigator click also focuses its artboard. Each artboard uses its actual pixel dimensions and stores no workspace positioning in its design document. A variant's text, images, safe zones and customized state remain independent.

- Pan: Space + drag, or trackpad scroll.
- Zoom: Cmd/Ctrl + wheel, the bottom zoom controls, or 100%.
- Fit: displays every artboard at once.
- Focus: click an item in the left Artboards list or double-click the artboard label on the canvas.
- Editing: select a layer inside any artboard; that artboard becomes active and its layers/properties appear in the side panels.

See `UPGRADE_0.4.md` and `VERIFICATION_0.4.md` for details.

## Editing workflow

1. Open the demo or create a blank **1200 × 1200 px** master. Alternatively, drop supported images on the welcome page to create a project, or import them into an open editor.
2. Select a layer on the artboard or in the layer list. **Ctrl/Cmd-click** toggles layers in the list; **Shift-click** selects a list range. On the canvas, modifier-click toggles selection and dragging over empty space creates a marquee. Hidden and locked layers are excluded from canvas selection.
3. Double-click a text layer on the canvas, press **Enter** with a text layer selected, or use **Edit text on canvas** in the inspector. **Enter** inserts a newline. **Ctrl/Cmd+Enter** or clicking outside commits the text; **Escape** cancels that editing session. Typography remains in the right panel.
4. Move the selected layer or selection by dragging or using arrow keys. Use corner handles to scale images and multiple selections proportionally. Resizing a single text layer changes its box and wrapping; scaling a multiple selection also scales its text sizes within the supported limits.
5. To crop an image, select it and choose **Crop image**. Drag an edge/corner or enter percentages, then choose **Apply crop**. **Full image** restores the complete source window. **Cancel** or **Escape** leaves the current crop unchanged.
6. Choose **Save locally** or press **Ctrl/Cmd+S**. Saving is manual; the saved status appears only after the transaction succeeds. Saving from an active text field first commits the field.
7. Use **Download project JSON** for a portable `.srs.json` backup. Open that file through the welcome page; importing creates a new project without overwriting an existing one.

Crop adjustments change the visible source window and the corresponding layer bounds while retaining the original image scale and proportions. They are not a fixed-size frame-fill tool. Cropping or resizing never changes the stored original image bytes.

## Import support and limits

### Raster images

PNG, JPG/JPEG and WebP are **flat image layers**. Their embedded copy, logos and other artwork are not reconstructed as separate editable objects. Import checks the extension against the file signature, validates dimensions, and asks the browser to decode the image before adding it. A failed batch leaves the document unchanged.

### SVG

SVG import supports self-contained paths and basic shapes, groups, transforms, gradients and clip paths using SVG presentation attributes. The SVG remains one image layer; individual paths are not editable in this release.

Scripts, event handlers and unsafe attributes are removed from a separate rendering copy, with a visible notice when content was removed. Original source bytes are retained separately. Rendering never uses the unsanitized original.

The supported subset excludes live SVG text, CSS/style attributes, filters, masks, embedded images, external dependencies and animation. Unsupported presentation features produce an actionable error; unsafe references and attributes are removed with a notice. Export text as outlines and use a self-contained SVG with supported attributes. Unsupported effects are **not automatically rasterized**.

| Limit                   | Value                                               |
| ----------------------- | --------------------------------------------------- |
| Images per import batch | 20                                                  |
| Layers per project      | 200                                                 |
| Individual image file   | 10 MiB                                              |
| SVG source              | 2,097,152 characters and at most 5,000 SVG elements |
| Image dimensions        | 1–8192 px per side, up to 40 megapixels             |
| Layer dimensions        | 8–8192 px per side, subject to layer minimums       |
| Imported asset payload  | 32 MiB total of distinct original/rendering blobs   |
| Portable project file   | 64 MiB                                              |
| Text layer content      | 4,000 characters                                    |

Some extremely narrow or tall images cannot be placed while meeting both layer minimum and maximum dimensions. They produce an import error instead of being distorted. Browser storage availability may impose a lower effective project limit.

## Keyboard and pointer controls

Shortcuts below apply to the editor outside text inputs, except where a text-editing action is explicitly listed.

| Control                                           | Action                                              |
| ------------------------------------------------- | --------------------------------------------------- |
| Double-click canvas text / Enter on selected text | Start canvas text editing                           |
| Enter while editing text                          | Insert a newline                                    |
| Ctrl/Cmd + Enter while editing text               | Commit text editing                                 |
| Escape while editing text                         | Discard the current text edit                       |
| Ctrl/Cmd + S                                      | Commit the focused field and save locally           |
| Ctrl/Cmd + Z                                      | Undo                                                |
| Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y              | Redo                                                |
| Ctrl/Cmd + A                                      | Select visible, unlocked layers                     |
| Ctrl/Cmd + D                                      | Duplicate selected unlocked layers                  |
| Ctrl/Cmd + C / V                                  | Copy/paste layers within the editor session         |
| Ctrl/Cmd + Shift + L                              | Lock/unlock the selection                           |
| Ctrl/Cmd + Shift + H                              | Hide/show the selection                             |
| `[` / `]`                                         | Move selected unlocked layers backward/forward      |
| Shift + `[` / `]`                                 | Send selected unlocked layers to back/front         |
| F2 or double-click a name in the layer list       | Rename a layer                                      |
| Delete / Backspace                                | Confirm deletion of selected unlocked layers        |
| Arrow keys / Shift + arrows                       | Move selected visible, unlocked layers 1 px / 10 px |
| + / − / 0                                         | Zoom in / out / fit and recenter                    |
| Ctrl/Cmd + wheel                                  | Zoom                                                |
| Wheel / Space + drag                              | Pan                                                 |
| Alt while dragging a layer                        | Temporarily bypass smart guides                     |
| Escape                                            | Deselect or cancel an active field/dialog           |
| Focused panel divider + Left/Right, Home/End      | Resize the panel                                    |
| Focused crop window + arrows / Shift + arrows     | Move the crop by 1 / 10 source pixels               |

Native typing, selection, copy/paste and undo remain native inside inputs and the canvas textarea. Global editing shortcuts are suspended during IME composition and modal crop/confirmation interactions. Unlock layers before changing their content or geometry; visibility can be changed independently of the lock.

## Saving, backups and migration

Local projects belong to the **current browser profile and origin**. They are not synchronized across devices. Clearing site data removes them; keep a downloaded backup. Switching between `localhost` and `127.0.0.1` also changes the storage origin.

The in-memory document contains structured layer data and asset references, not base64 images. IndexedDB stores the project, project-specific asset catalog and binary image data separately. Image blobs use SHA-256 content keys so identical data can be shared without rewriting originals. Saved projects retain crops, layer visibility, layer order, stable IDs and resize metadata.

Portable `.srs.json` files deliberately bundle referenced image bytes alongside the project. Import verifies schema, blob checksums, type/dimensions and SVG rendering derivatives before saving. Missing or unexpected asset payloads, invalid geometry, duplicate IDs and unknown schema versions are rejected.

Phase 0 version 1 JSON and saved IndexedDB projects migrate to version 2 on load. Migration preserves existing geometry, text, IDs and asset references, and supplies visible layers, full-image crops and default resize metadata. Saving writes the current version. Keep an older backup if you need to reopen the project with the Phase 0 application; backward export to version 1 is not provided.

## Architecture

| Location                          | Responsibility                                                              |
| --------------------------------- | --------------------------------------------------------------------------- |
| `src/app/`                        | App Router pages, loading/error boundaries and token-based styles           |
| `src/components/ui/`              | Accessible button and confirmation-dialog primitives                        |
| `src/components/preferences.tsx`  | Validated, hydration-safe preferences                                       |
| `src/shared/schema/project.ts`    | Version 2 schemas, migration and serialization                              |
| `src/shared/schema/project-v1.ts` | Strict legacy schemas used by migration                                     |
| `src/features/projects/`          | Demo, project creation and welcome/import flow                              |
| `src/features/assets/`            | Raster validation, SVG sanitization, import, blob URLs and portable backups |
| `src/features/editor/model/`      | Pure geometry, crop, snapping and immutable commands/history                |
| `src/features/editor/`            | Canvas adapter, text overlay, crop dialog, layers, inspector and save state |
| `src/lib/db/projects.ts`          | Repository interface and transactional IndexedDB implementation             |
| `src/lib/i18n/messages.ts`        | Matching typed English/Czech dictionaries                                   |
| `e2e/`                            | Browser interaction and persistence regression tests                        |

Canonical project JSON remains the source of truth. Konva nodes never enter saved state. Gesture transforms are converted back to native layer geometry; viewport zoom and pan do not change document pixel dimensions. Image rendering, crop math and aspect protection share the same layer/asset model.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Playwright starts the **production server**, so build first. On Linux CI, install required OS browser dependencies with `npx playwright install --with-deps chromium` when needed. An already installed compatible Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium`.

The suites exercise schema migration and round trips, asset and SVG validation, geometry/aspect constraints, crop reversibility, snapping, locks, multi-layer history and ordering, text editing, canvas gestures, save/reopen and portable backups. **`VERIFICATION.md` records the commands actually run and their results.** It also identifies the browser and verification limitations; the command list above alone is not a test result.

## Known limitations and next phases

- One master artboard; no automatic resize engine, platform presets, generated variants, safe-zone validation or per-variant overrides yet. Saved resize metadata is preparation for Phase 2.
- Multi-selection is temporary; persistent groups, nested layers and components are not implemented. Layer ordering uses controls/shortcuts, not drag-and-drop in the layer list. Rotation is available numerically for individual layers, not with a rotation handle or group rotation.
- Only the bundled Inter family is available, with weights 400, 600 and 700. Text has a fixed line-height of 1.1; no rich text, letter-spacing or custom font import. The textarea and canvas share font settings, but full cross-browser text-metric equivalence is not certified. Text editing can grow a text box; there is no comprehensive text-overflow validation.
- Editor use requires a viewport at least 1024 px wide. Smaller widths show an explicit desktop-required message; the welcome page remains responsive. Accessible DOM controls accompany the canvas, but a full assistive-technology/WCAG certification is outside this phase.
- History and the layer clipboard are session-only. Layouts and preferences persist; pan offset does not. Saves are manual. Browser-managed navigation is not an autosave mechanism.
- Multiple tabs use last-successful-save behavior. Conflict resolution, project deletion, asset garbage collection and cloud quotas are future work; unused image blobs can remain in local storage.
- No authentication, cloud synchronization, raster image export, batch export ZIP, Figma import or AI image/layer reconstruction. The download action produces a **project backup**, not production ad assets. There is no server/client export-pixel parity claim yet.

Phase numbering follows `ROADMAP.md`: Phase 2 adds deterministic composition and validation; Phase 3 adds cloud/auth and production exports; Phase 4 covers Figma workflows, brand kits, advanced formats and consent-based AI adapters.

## Smart compositions — 0.6.0

The Resize panel now offers three real-rendered composition previews (Balanced, Product-led, Copy-led) and a role-aware layout engine. Choosing a composition when generating formats never overwrites customized variants. Applying a different composition to an already-customized artboard requires explicit confirmation and supports Undo. The default FORM demo creative and workspace UI have been visually refreshed; existing saved projects remain untouched. See `UPGRADE_0.6.md` and `VERIFICATION_0.6.md` for details and testing limits.

## 0.8.1 — JPG/PNG master resizing

A single PNG/JPG/WebP imported from the welcome screen (or into an empty master) becomes a native-size flat-image master. The Resize panel then offers **Contain**, **Cover** and **Smart Crop** modes with selectable focal point and protected area. Smart Crop uses Contain when it cannot preserve the selected protected area. Variants remain individually editable, exportable and protected against silent regeneration. See `UPGRADE_0.8.1.md` for limitations and QA steps.
