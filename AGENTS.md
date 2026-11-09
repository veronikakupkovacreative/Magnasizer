# Codex project instructions

Read PROJECT_SPEC.md, ARCHITECTURE.md, DESIGN_SYSTEM.md and ROADMAP.md before making changes. Implement the current phase only; never claim future capabilities are working. Prioritize a usable vertical slice over decorative mockups.

Use Next.js App Router, TypeScript strict, Tailwind and accessible React components. Keep canvas model, layout engine, and rendering separate from UI. Prefer pure functions and runtime schema validation. Use real implementations for displayed actions; otherwise visibly mark them as unavailable. No fabricated API keys or service connections.

Maintain professional designer-grade visual quality and consistent design tokens. English is default; Czech translation keys should be supported. Desktop-first editing, responsive shell. Add tests for geometry, serialization, undo/redo, and output dimensions. Run available typecheck, lint and tests and report actual results, not assumptions.

Never mutate uploaded original images. Never distort logos or products. Never silently replace approved text or discard per-variant overrides. For raster imports, be explicit that the initial import is flat. Treat AI layer extraction as future experimental functionality.

Work in small, reviewable increments. Before significant architectural changes, describe the tradeoff. Do not overwrite unrelated work. Keep README with local setup, environment variables, known limitations and completed functionality.
