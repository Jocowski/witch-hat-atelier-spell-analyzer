# IMPROVEMENTS.md — backlog & ideas

> Prioritized improvement ideas across **App/UX**, **AI training (recognizer)**, **Spell analysis
> (engine + AI)**, and **Nested & linked spell detection**. P1 = high value / low-ish effort, P2 =
> medium, P3 = larger / research. Cross-refs: [APP-PLAN.md](APP-PLAN.md), [SPEC.md](SPEC.md),
> [SPEC-cluster-recognition.md](specs/SPEC-cluster-recognition.md).
>
> **Spec layout (2026-06-05):** the per-feature specs now live under [specs/](specs/); *active/partial*
> ones at the top level, *shipped/superseded* ones archived under [specs/done/](specs/done/). Each spec
> carries an updated `Status:` header. The shipped-batch ledger below is the change history.
>
> **Active / partial specs (still in [specs/](specs/)):**
> - [SPEC-recognizer-analysis.md](specs/SPEC-recognizer-analysis.md) — training flywheel + analysis surfacing
>   (core flywheel shipped; A7 real-ML + B5 cluster recognition deferred).
> - [SPEC-cluster-recognition.md](specs/SPEC-cluster-recognition.md) — holistic cluster ID
>   (Phase 1 partly implemented; Phase 2+ pending).
>
> **Done / superseded specs (archived in [specs/done/](specs/done/)):**
> - [SPEC-symbol-versioning.md](specs/done/SPEC-symbol-versioning.md) — symbol lifecycle + canon-update flagging (Fase 1/2/3 shipped).
> - [SPEC-sign-variants-sizing.md](specs/done/SPEC-sign-variants-sizing.md) — magnitude/variant model (Layer 1 shipped; superseded/unified by SPEC-magnitude-and-variants.md).
> - [SPEC-spell-ir.md](specs/done/SPEC-spell-ir.md) — numeric SpellIR `{force,spread,focus,range,duration,stability,gravity,direction}` + 3D tilt (1.2, 1.5).
> - [SPEC-visual-renderer.md](specs/done/SPEC-visual-renderer.md) — animated effect canvas + Prepared/Active (off-by-default) + failure visuals (1.1, 1.3, 1.4).
> - [SPEC-ring-closure-floodfill.md](specs/done/SPEC-ring-closure-floodfill.md) — flood-fill ring closure + adaptive segmentation (2.2, 2.3).
> - [SPEC-recognizer-matching.md](specs/done/SPEC-recognizer-matching.md) — rotation-tolerant guess + raster matcher cross-validation (2.4, 2.5).
> - [SPEC-admin-verify.md](specs/done/SPEC-admin-verify.md) — verified-sample flag + weight bump + bulk-exclude (2.6).
> - [SPEC-magnitude-and-variants.md](specs/done/SPEC-magnitude-and-variants.md) — shared magnitude plumbing + dyes-in-deduction + variants L2/L3 (3.1, 3.2, Track 4).
> - [SPEC-ai-report-surfacing.md](specs/done/SPEC-ai-report-surfacing.md) — report cache by hash + calibrated confidence + "disagrees with engine" (3.3, 3.5).
> - [SPEC-nested-linked.md](specs/done/SPEC-nested-linked.md) — multi-ring detection + nest/link relations + wha-spell@2 (Track 5).
> - [SPEC-tuning-tools.md](specs/done/SPEC-tuning-tools.md) — standalone template/detector/effect-lab HTML tools (7.4).
> - [SPEC-stroke-beautify.md](specs/done/SPEC-stroke-beautify.md) · [SPEC-symbol-roles.md](specs/done/SPEC-symbol-roles.md) · [SPEC-studio-ux-cleanup.md](specs/done/SPEC-studio-ux-cleanup.md) · [SPEC-studio-ux-cleanup-2.md](specs/done/SPEC-studio-ux-cleanup-2.md) — Studio drawing/UX polish.
>
> The canvas-UX spec (pan/recenter, undo/redo, shortcuts, pixel-eraser, drawer, text-glyph removal) was
> **fully implemented** and its standalone doc retired — the remaining UX item is autosave (§A below).
>
> **Shipped (2026-06-04):** ESLint + Prettier · dead-CSS prune · lazy Admin route · the whole canvas-UX
> batch · recognizer flywheel A0–A3 · match breakdown (B1) · forbidden-magic (B4) · magnitude Layer 1 ·
> text-glyph removal + symbol-versioning Fase 1.
>
> **Shipped (2026-06-05/06 — the big spec-batch build, all on `feat/spell-studio`, 356 tests green, Vite build OK):**
> - **Conjuration:** numeric SpellIR + 3D tilt (1.2, 1.5) · SpellIR-driven animated effect renderer for
>   fire/water/wind/earth/light + Prepared/Active (off by default) + failure visuals (1.1, 1.3, 1.4).
> - **Recognizer:** flood-fill ring closure + adaptive segmentation (2.2, 2.3) · rotation-tolerant guess +
>   raster matcher module (2.4, 2.5) · multi-ring detection + nest/link relations + wha-spell@2 (Track 5 core).
> - **Analysis:** dyes-in-deduction + shared magnitude plumbing + variants L2/L3 (3.1, 3.2, Track 4) ·
>   AI report cache + calibrated confidence + "disagrees with engine" badge (3.3, 3.5).
> - **Lifecycle/Admin/Tools:** verified-sample flag (2.6) · symbol-versioning Fase 2/3 (Track 6) ·
>   standalone tuning tools (7.4).
> - **Remaining tails (phased sub-items, not core):** raster-veto live wiring (2.5-C reference-ink cache) ·
>   disagreement DB-write (3.5 §6) · cluster contraptions (5.6) · multi-ring authoring UI (5.5B–D) ·
>   remove `spellIRShim` by adding `element` to the SpellIR block · effect-canvas zoom.

## A. App / UX
- ~~**P1 — Canvas pan (right-drag) + Recenter button.**~~ **Done (2026-06-04).** Root cause was
  react-konva not wiring DOM capture handlers; pan now starts from Konva's `mousedown` (+ `Konva.dragButtons`).
- ~~**P1 — Canvas undo/redo** (Ctrl+Z/Y, node-model snapshots).~~ **Done.**
- ~~**P1 — Tool keyboard shortcuts** (B/L/R/G/C/A/V/M/T/E).~~ **Done.**
- **P1 — Autosave the current drawing** to `localStorage` (restore on reload); "New" to clear. *(Open —
  the only remaining UX item; reuse the drawer's localStorage pattern in `StudioPage`.)*
- ~~**P1 — Explicit "ring" affordance.**~~ **Dropped (2026-06-04):** the ring stays *inferred* — the
  validity/failure-mode deduction from an organically drawn seal is a feature, not a chore. Robust ring
  detection is covered instead by *adaptive segmentation* in
  [SPEC-recognizer-analysis.md](specs/SPEC-recognizer-analysis.md) (A5).
- ~~**P2 — Pixel-eraser for placed symbols.**~~ **Done.**
- ~~**P2 — Better placed-symbol rendering for text-glyphs ("G"/"C").**~~ **Done — removed instead:** the
  text-glyph mechanism is gone (the sigils now have real `svgPath`); see
  [SPEC-symbol-versioning.md](specs/done/SPEC-symbol-versioning.md) for the lifecycle pilot.
- ~~**P2 — Prune dead CSS.**~~ **Done (2026-06-04)** — `src/index.css` rewritten to base + ResultPanel
  classes only (verified against the surviving JSX).
- ~~**P2 — Results drawer polish** (resizable height; remember collapsed state).~~ **Done.**
- **P3 — Named spell save/load + gallery** (Supabase `spells` table + Storage thumbnail) — APP-PLAN Phase I.

## B. AI training (the recognizer & flywheel)
*Detailed in [SPEC-recognizer-analysis.md](specs/SPEC-recognizer-analysis.md) Part A (source-weighting,
confidence gate, active-learning + ML-readiness progress, rotation, segmentation, verify flag, ML).*
- **P1 — Seed templates from canon SVGs.** Generate `$P` templates from the 33 sigil + 52 sign
  `svgPath`s so recognition works on day one without manual training (APP-PLAN Phase H / "seed").
- ~~**P1 — Wire `logAnalysis`.**~~ **Done (2026-06-04)** — `StudioPage.handleAnalyze` logs
  composition + engine result + corrections (A0).
- ~~**P1 — Sample weighting by `source`.**~~ **Done** — `recognition.sampleWeights` in `rules.json`,
  applied as `adjDist = dist / weight` in `recognizer.js` (A1).
- ~~**P2 — Active learning.**~~ **Done (2026-06-04)** — Training shows dataset coverage + ML-readiness
  bars and the least-covered symbols to draw next (A3, `sampleCounts()` + `CoveragePanel`).
- **P2 — Confidence gate.** *(Done)* low-confidence detections read "unknown?" and are kept out of the
  engine input (A2, `rules.recognition.confidenceMinPct`).
- **P2 — Rotation tolerance.** `$P` isn't rotation-invariant; the spell pipeline already de-rotates
  per group via a sweep, but Training's single-symbol guess and any cluster match should too.
- **P2 — Adaptive segmentation.** The recognizer `gap` is hard-coded (45px). Make it scale with the
  ring radius / median symbol size; improve ring detection (circle-fit residual threshold).
- **P2 — Admin "verify" flag.** Let Review mark a sample verified; the recognizer can prefer verified
  samples, and bad contributors can be excluded in bulk (data already carries `created_by`/`created_at`).
- **P3 — Real ML model.** When data is sufficient, train a CNN (rasterized glyph) or point-sequence
  model offline; ship via TF.js/ONNX; A/B against `$P` (APP-PLAN Phase 4).
- **P3 — Dedup near-identical samples** to avoid one drawing dominating a template set.

## C. Spell analysis (engine + AI)
*Detailed in [SPEC-recognizer-analysis.md](specs/SPEC-recognizer-analysis.md) Part B (match breakdown, AI
report cache, forbidden-magic, cluster, confidence-vs-engine; topic-selection UI is **already done**).
Magnitude/size effects (incl. dyes) are in [SPEC-sign-variants-sizing.md](specs/done/SPEC-sign-variants-sizing.md).*
- **P1 — Dyes affect the deduction.** Dyes are currently informational; wire them into power/duration/
  behavior per [docs/magical-dye.md](../magical-dye.md) so the analysis reflects the ink. *(Build on the
  magnitude plumbing from [SPEC-sign-variants-sizing.md](specs/done/SPEC-sign-variants-sizing.md).)*
- ~~**P1 — Surface match breakdown.**~~ **Done (2026-06-04)** — "Why this match?" disclosure shows the
  weighted sub-scores (B1, `match.parts`/`weights`).
- **P2 — AI report caching.** Cache the report per composition hash so re-analyzing is instant and
  cheap; show elapsed time / which topics ran.
- ~~**P2 — Topic selection UI.**~~ **Already done** — the per-topic checklist is wired in `AIReportPanel`.
- ~~**P2 — Forbidden-magic surfacing.**~~ **Done (2026-06-04)** — data-driven check (`rules.forbidden`)
  → red callout (B4); tag list still needs community calibration.
- **P2 — Cluster recognition (WS11b).** A matched cluster gives a holistic spell ID + known effect
  immediately, corroborating (or overriding) the per-symbol path — see SPEC-cluster-recognition.md.
- **P3 — Confidence/uncertainty in the AI report** (calibrated, not just prose), and a "disagrees with
  engine" signal that feeds the improvement loop as an engine-gap candidate.

## D. Nested & linked spell detection (the big recognizer gap)
> **Deferred by decision (2026-06-04):** parked until the current UX + recognizer/analysis batches land;
> revisit after. Kept here in full as the next major track.

The **engine already supports multi-circle spells** (`compose.js`: nest/link, `composeWith`,
`reclassifyCorelessCircles`, combined signatures), but the **drawing→recognition path only ever
produces a single circle** (`drawingModel.toComposition` emits one `k0` circle; `recognizer.analyzeStrokes`
finds one ring). Closing this gap unlocks contraptions and nested seals from a drawing:

- **P2 — Multi-ring detection.** Detect *multiple* circular strokes as separate rings; assign each
  symbol to its **enclosing** ring (point-in-circle test). Emit one circle per ring.
- **P2 — Nesting relations.** When one ring is geometrically inside another, emit a
  `{ type:'nest', outer, inner }` relation (the engine's nested-glyph rules then apply).
- **P2 — Link relations.** Detect a line/stroke whose endpoints touch two rings → emit
  `{ type:'link', a, b }`. Several identical linked seals already get the "stack power" treatment in
  `composeWith`.
- **P2 — `drawingModel` → wha-spell@2.** Extend `toComposition` to output `{ circles:[…], relations:[…] }`
  from the detected rings + relations instead of always one circle; the engine consumes it unchanged.
- **P3 — UI for multi-ring authoring.** Let the user clearly draw/place across multiple rings (or an
  "add ring" affordance), so nested/linked spells are easy to compose and round-trip.
- **P3 — Cluster recognition for contraptions.** Extend WS11b cluster templates to whole multi-circle
  devices so a known contraption shape is recognized as a unit.

---

## Code-quality / housekeeping (not functional bugs)
- ~~**Add ESLint + Prettier**~~ — **done (2026-06-04).** ESLint 9 flat config (`eslint.config.js`,
  React + hooks, Prettier-compat) + `.prettierrc.json`; scripts `lint` / `lint:fix` / `format` /
  `format:check`. `npm run lint` is **0 errors** (warnings only). Prettier is configured to the project
  style (no semicolons, single quotes, 2-space, printWidth 100) but **not yet run repo-wide** — a mass
  `prettier --write` would also strip the author's intentional column alignment, so it's left as a
  deliberate, separate opt-in commit.
- ~~De-duplicate the catalog matcher~~ — **done.** Extracted the pure `src/engine/match.js` (data
  injected, like `compose.js`); `analyze.js` and `tools/spell-engine-cli.mjs` both import it, so the
  two copies can no longer drift. `matcher.test.js` (runs the CLI) + the 133 tests guard it.
- ~~**Prune dead `index.css`**~~ — **done (2026-06-04).** Rewritten to base styles + the classes
  `ResultPanel.jsx` actually uses (verified against surviving JSX); all removed-editor rules dropped.
- ~~**Lazy-load the Admin route**~~ — **done (2026-06-04).** `router.jsx` `React.lazy`-loads `AdminPage`
  + `LoginPage` behind `<Suspense>`; build emits separate `AdminPage`/`LoginPage` chunks, out of the
  Studio's initial bundle.
- **Onboarding / empty states** — the recognizer starts empty; a first-run flow (or seed-from-SVG)
  that explains training avoids a confusing "nothing recognized" first impression. *(Still open.)*
- **Confidence gate** — *moved to [SPEC-recognizer-analysis.md](specs/SPEC-recognizer-analysis.md) A2* (a
  recognizer behavior/UX feature, not pure housekeeping): show low-confidence detections as "unknown?"
  and keep them out of the engine input; track per-symbol correction rate to drive active learning.

## Recommended next steps (suggested order, updated 2026-06-04)
The canvas-UX batch, recognizer flywheel (A0–A3), match breakdown (B1), forbidden-magic (B4),
magnitude Layer 1, and symbol-versioning Fase 1 are **shipped**. Next:
1. **Autosave** the drawing to `localStorage` (§A) — the last open canvas-UX item.
2. **Seed templates from canon SVGs** (§B) — so recognition works before any training data exists.
3. **Dyes-in-deduction + magnitude Layer 2** — build the shared magnitude plumbing
   ([SPEC-sign-variants-sizing.md](specs/done/SPEC-sign-variants-sizing.md)) so dyes and variant metrics both feed it.
Then: recognizer robustness (A4 rotation, A5 segmentation, A6 verify flag), AI-report cache (B2) +
confidence-vs-engine (B6), symbol-versioning Fase 2/3, and finally **nested/linked detection (§D)** +
cluster recognition (WS11b) for holistic spell ID.
- ~~`ResultPanel` unused `spell` prop~~ — fixed.
