# Smart Resize Studio 0.8.0 — linked brand styles & better automatic resizing

## Implemented

- Project-local Brand Styles: named colors + text styles, applied by stable IDs.
- Central changes automatically propagate to all linked master/variant layers, without deleting edited copy or geometry.
- Text size changes scale linked resize text proportionally; master uses exact token size.
- Detaching or deleting styles leaves the current appearance unchanged. Style edits are undoable.
- Project and variant schemas remain v2, with optional brand-kit and layer style-link fields.
- Existing manually customized variants are protected against silent regenerations.
- The editable FORM demo includes linked palette and typography tokens.
- Auto layout (new default) evaluates Balanced, Product-led and Copy-led candidates and picks the best score for each preset. The scoring checks safe zones, primary-object collisions and text overflow. Manual layout modes remain accessible.
- Improved landscape/portrait/compact layout spacing; all 11 existing presets are supported.

## How to use

1. Open a project. In the right Properties panel, locate **Brand styles**.
2. Create a named color, select a shape/text layer, then choose that color in the linked color selector. With no selection, you can link the artboard background.
3. With a text layer selected, enter a name and choose **Save selected** to create a text style. Assign it through the linked text style selector.
4. Change a style's color or typography values. All layers linked to the same style update across master and existing variants.
5. Choose **Local style (unlinked)** to detach a layer and keep its current values.
6. Open Resize and select **Auto · Best fit**. Generate several formats and compare with the manual composition modes.

## Known limits

- Brand styles are stored per project, not shared between different projects.
- Styling changes update linked objects in customized variants; these do **not** reset their positions or content.
- Very small GDN format constraints may produce preflight warnings; review before publishing.
- Complete dependency-backed build and browser testing could not be run in the delivery environment because npm dependency packages were unavailable offline. See VERIFICATION_0.8.0.md.
