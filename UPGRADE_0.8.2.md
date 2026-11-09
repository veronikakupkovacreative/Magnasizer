# MAGNASIZER 0.8.2 — Auto Layout polish + Figma Bridge (first local integration)

Built on Smart Resize Studio 0.8.1. Project file format (`smart-resize-studio`), IndexedDB database and existing project IDs **stay unchanged** to preserve old saved projects.

## Branding
- UI/product title changed to **MAGNASIZER**.
- Brand artwork correction: the compact mark (`public/magnasizer-mark.svg`) and full wordmark (`public/magnasizer-logo.svg`) are the exact original SVGs supplied by the client, without recoloring or re-tracing. The favicon uses the compact mark.
- The application retains its original dark/light UI accent colors. The logo is displayed on a neutral, light backing to preserve the original #07143F fill in either theme.

## Layout engine
- Separate editorial layout for 320×100 and 728×90 strips: logo | headline | CTA | product, safely partitioned.
- Compact cards (300×250, 336×280) use a vertical hierarchy and place the product below the headline.
- Auto mode still compares balanced/product/text candidates using the updated scoring; mandatory items remain visible and customized variants are protected.
- All other presets, flat raster modes and export remain compatible.

## Figma Bridge — local MVP
`figma-plugin/` contains a **Figma development plugin** and detailed setup instructions. It runs without a network request or OAuth.

1. Select one Frame / Component / Instance in Figma.
2. Run MAGNASIZER Bridge → Prepare selected frame → Copy for MAGNASIZER.
3. On MAGNASIZER's start screen, click Paste from Figma. Alternatively paste the generated JSON manually or import the `.magnasizer.json` file.
4. A new local MAGNASIZER project opens using the Figma frame dimensions.

**Supported:** editable single-style text, solid rectangles/circles, project background, group attribution, placement and independent raster layers. Unsupported Figma nodes are exported as PNG layers. Advanced Figma constraints, Auto Layout rules, gradients, masking, effects and component variants are not reconstructed; editability is partial, rather than falsely implied.

A JSON transfer is validated, size-limited and sanitized through the existing image decoder/importer. No executable content is evaluated and no third-party server is used.

## Known limitations
- This Figma plugin is a **development/local plugin**, not yet published in Figma Community. Test it against a real Figma file before public release.
- The fallback JSON export may be needed where clipboard permissions are restricted.
- Font family names are transferred, but if the font is not installed in the browser, text may render with a fallback until the font is imported into the project.
- Source images may lose vector sharpness because complex layers are rasterized.
- Full `npm run build` and Playwright browser coverage are not yet verified in the offline build environment.
