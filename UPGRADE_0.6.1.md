# Smart Resize Studio 0.6.1 — demo direction + workflow clarity

## Design revision

The beige/dark-green split FORM demo from 0.6.0 has been replaced for **new** demo projects with an art-directed high-contrast evergreen campaign: an expressive editable headline, clearer typography hierarchy, one bright acid-green product spotlight, and a focused CTA. All ten elements remain independently editable on the 1200 × 1200 master.

The welcome-screen thumbnail now matches the revised creative and explicitly explains that opening the demo creates a **new project**. The user's existing locally saved projects are not overwritten. To see the redesign, go Home → Open Demo Project; do **not** reopen an older saved FORM project.

## Interaction clarity

- Resize panel explicitly explains how to select one artboard for composition replacement.
- It displays a count of selected existing customized variants that will be protected on re-generation.
- The three real previews, safe zones, composition selection, explicit replacement confirmation, Undo, export and workspace are unchanged.

## Regression guidance

For customized-variant preservation: generate a Meta Story, select it, change a layer's X coordinate, and click Generate / update selected again with that preset checked. Confirm that X is unchanged and status remains customized. To explicitly replace a layout, select a different composition for that **active** artboard and click Apply to artboard; confirm replacement in the dialog (or cancel).

Full runtime/e2e verification requires installing project dependencies and launching a browser. Do not describe syntax checks as browser validation.
