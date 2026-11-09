# MAGNASIZER 0.8.2 — Manual QA

1. Open the application and confirm **MAGNASIZER** wordmark and M icon in both themes.
2. Open a pre-0.8.2 `.srs.json` backup; verify its saved projects and generated artboards remain unchanged.
3. Generate 320×100, 728×90, 300×250, 336×280, Meta Story and PMAX Landscape from the editable FORM demo; check that the logo, headline, CTA and product are visible and do not collide.
4. Customize one variant, regenerate; verify manual changes are preserved.
5. Use the Figma Bridge development plugin with one frame containing a headline, logo, colored shapes and product photo.
6. Copy from Figma and choose Paste from Figma in MAGNASIZER. Verify native text/shape layers and separate PNG layers.
7. If clipboard access is blocked, download `.magnasizer.json` in the plugin and import it on the MAGNASIZER home screen.
8. Edit imported text, generate Meta and PMAX sizes, export ZIP; verify exact dimensions.
9. Save and reopen the Figma-imported project; verify image assets are still available.
10. Try an invalid transfer payload; verify rejection without overwriting any projects.


## Branding correction smoke test

1. Home and full top bar show the supplied `MAGNASIZER_vector (1).svg` unchanged.
2. Editor compact top bar and favicon show the supplied `Doplňkové assety - písmeno M.svg` unchanged.
3. Original UI accents (dark #A78BFA / light #7155D9) remain as in 0.8.1; no red global overrides.
4. Figma Bridge 0.1.2 uses the supplied SVG wordmark and preserves clipboard and download behavior from Bridge 0.1.1.
