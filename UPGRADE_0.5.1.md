# Smart Resize Studio 0.5.1 — usability fixes

Based on the user's 0.5.0 QA: all primary features passed except artboard deletion and custom font upload, while transform handles appeared too prominent at low zoom.

## Implemented

1. **Delete artboard:** a trash action is exposed on every resize row. Selecting it opens a visible portal-based confirmation dialog, with Cancel/Delete actions. Only variants can be removed; the master remains protected. Undo restores the removed variant. Saved workspace coordinates for that variant are also removed.
2. **Upload font:** the right inspector now has an always-visible `Project fonts` section with an accessible upload button and an installed-font list. The text typography selector also exposes a quick upload action. TTF/OTF/WOFF2 content is checked against recognized font signatures and passed through browser FontFace loading; errors distinguish wrong format from browser decode failure. Fonts remain saved as project assets, not converted to flattened text. Fonts must be legally licensed by the user. TrueType aliases (`true` / `typ1`) are accepted; font collections (TTC) are not supported.
3. **Transform handles:** controls shrink to a 3px screen-size minimum at low zoom and max 6px while editing. Overview zoom exposes four corner grips instead of eight. Layer geometry, font size and export dimensions are untouched.

## Installation

Stop the old dev server using Ctrl+C. Unzip this release into a new folder and run `npm ci && npm run dev` from the nested `smart-resize-studio` folder. No data migration is required. **Make a `.srs.json` project backup before switching.** Browser projects are associated with the `localhost:3000` origin, not the filesystem folder.

## Follow-up verification

- Delete one resize and cancel the confirmation; verify it remains. Delete again, confirm, and Undo to restore. Save/reload. Confirm the master cannot be removed.
- Open any project with no layer selected; upload a valid licensed TTF/OTF/WOFF2 from Project fonts. Select a text layer, apply it, save/reload, and export PNG to compare typography.
- At 10–15% zoom, select a layer: only four small corner grips should appear. Zoom above 24% to show the normal handles. Verify text wrapping and layer size remain unchanged.
- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` before declaring the release production-tested.
