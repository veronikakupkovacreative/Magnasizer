# MAGNASIZER 0.8.2 — client artwork correction

- Replaced generated red lettermark and text wordmark with the **exact user-supplied SVG assets** (`public/magnasizer-mark.svg` and `public/magnasizer-logo.svg`).
- Mark used in compact editor header and favicon; full wordmark in top bar and home.
- Source logo color #07143F remains untouched. A neutral light surface behind the SVG preserves contrast in dark theme.
- Removed overrides that changed the editor accent to red. Restored original 0.8.1 dark/light accent variables (#A78BFA / #7155D9).
- Included Figma Bridge 0.1.2 with the latest 0.1.1 transfer stability improvements and the exact original wordmark in its UI.
- No editor functional code, persistence, resize engine, layout, or project data was modified.
