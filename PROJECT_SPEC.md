# Smart Resize Studio — Product specification

## Product promise
Turn one master advertising creative into platform-ready, editable variants while preserving hierarchy, logos, products, and approved copy. Professional designers retain final control.

## Audience and rollout
Designers, freelancers, agencies, and marketing teams. Private beta first, public later. Monetization undecided.

## Primary journey
Create project → import master (Figma or file) → inspect layers → select platforms/presets → generate multiple compositions → refine per artboard → validate → export ZIP.

## Languages and accounts
English default; Czech translation. Google OAuth and email/password. Cloud projects. Users can delete uploaded originals; clearly explain consequences for linked designs and exports.

## Platform presets
Start with Meta, Google Performance Max and GDN; expand to LinkedIn, TikTok, Pinterest, YouTube and custom sets. Presets must be versioned, with platform, placement, ratio, pixel dimensions, accepted formats, file limits, and safe-zone profiles. Do not hardcode mutable platform policies. Verify official specifications before release. A preset is a production aid, not a guarantee of ad approval.

## Editing contract
Structured project JSON is the source of truth. Every layer has stable ID, type, geometry, z-index, style, role, priority, anchor, constraints, and lock state. Master and variants share stable source references. Variant overrides are preserved during master updates. Support synced, customized, and detached variants. Undo/redo and project schema migrations are required.

## Imports
Phase 1: PNG/JPG/WebP as flat-image layers; SVG with explicit supported-feature mapping, rasterizing unsupported effects only with notice. Phase 2: Figma plugin imports supported frames/layers with mapping diagnostics. PSD and PDF later. Never claim a raster image is automatically fully editable. AI layer recovery is experimental and must show confidence and original-image comparison; never silently replace brand assets or product details.

## Resize engine
Use deterministic constraint-based layout first: preserve mandatory elements, aspect ratio, minimum typography, padding, hierarchy and platform safe zones. For incompatible ratios, choose layout strategies (horizontal, stacked, compact), produce 2–3 suggestions, and expose warnings. Optional elements may be hidden according to explicit priorities. Never rewrite approved copy without consent. Never distort logos or products. Generation must be reproducible with fixed input and engine version.

## AI
Optional modular adapters: segmentation, focal-point detection, smart crop, background extension, composition suggestions, visual QA, OCR and tentative layer reconstruction. Keep original assets immutable. Require user approval for generated changes. Gracefully degrade when AI is unavailable. Track costs and avoid sending assets to external providers without user disclosure and consent.

## Export
PNG/JPEG/WebP initially; SVG only when vector features are supported. Batch ZIP with naming templates, manifest, dimensions and validation warnings. Figma editable export is a later milestone, not part of first release. Server rendering must match editor text metrics and geometry; regression-test exported pixels.

## Nonfunctional requirements
Accessible keyboard operations, WCAG-informed contrast, visible focus, reduced motion, localized strings, responsive shell (desktop editing first), signed asset URLs, user-scoped row-level security, storage quotas, rate limiting, privacy controls, secure file validation, backups, and auditability.

## Success criteria
A designer can import a layered demo design, generate square, portrait, story and landscape variants, fix a warning, customize one variant without losing edits, save/reopen and export correctly sized assets. Measure time saved and proportion of variants needing manual corrections.

## Explicit non-goals for MVP
Full Photoshop replacement, universal perfect PSD fidelity, automatic flawless PNG layer recovery, direct ad publishing, collaborative realtime editing, guaranteed platform approval.
