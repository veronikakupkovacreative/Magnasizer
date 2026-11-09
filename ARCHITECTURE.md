# Architecture

## Stack
Next.js App Router, React, TypeScript strict, Tailwind, shadcn/ui, Konva/react-konva, PostgreSQL + Supabase Auth/Storage, Vitest, Playwright. Sharp for server-side raster processing in a suitable Node runtime. Keep AI adapters provider-agnostic.

## Boundaries
- app/: routes and server actions/API endpoints
- components/ui/: accessible primitives
- features/projects/: project CRUD and auth-aware views
- features/editor/: layer UI, Konva scene, commands, property panels
- features/formats/: versioned preset catalog
- features/resize/: pure layout calculation, constraints, strategies
- features/validation/: technical and visual-rule checks
- features/export/: renderer and ZIP generation
- features/ai/: opt-in adapters and asynchronous jobs
- lib/db/: persistence and migrations
- lib/i18n/: en/cs messages
- shared/schema/: runtime-validated project and layer types

## Data model
User, Project, ProjectVersion, Asset, BrandKit, MasterDocument, Layer, Variant, VariantOverride, FormatPreset, SafeZoneProfile, ExportJob, AiJob. Projects have ownership and explicit schema version. Use normalized references for assets and versioned JSON snapshots for document state. Avoid saving large binary blobs in project JSON.

## Core invariants
1. Source assets remain unchanged.
2. No silent rasterization, AI rewriting, product alteration or override deletion.
3. Layout algorithm is deterministic and unit-testable without React.
4. Imported data is validated; unsafe SVG markup is sanitized or rasterized in a sandbox.
5. Rendering and editor share geometry/font assumptions.
6. All user-owned database rows and storage objects enforce authorization.
7. Async operations are cancellable where practical, retryable and observable.

## Phasing
Phase 1 runs with a local demo project and persistence adapter interface; cloud persistence and OAuth follow after editor proof of concept. Avoid blocking first-run UX on missing credentials. Phase 2: core layer editor. Phase 3: rule-based variants and validation. Phase 4: cloud/auth and exports. Phase 5: AI/Figma and advanced formats. Do not build pretend AI or mock export presented as real.
