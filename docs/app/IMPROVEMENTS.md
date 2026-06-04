# IMPROVEMENTS.md — backlog & ideas

> Prioritized improvement ideas across **App/UX**, **AI training (recognizer)**, **Spell analysis
> (engine + AI)**, and **Nested & linked spell detection**. P1 = high value / low-ish effort, P2 =
> medium, P3 = larger / research. Cross-refs: [APP-PLAN.md](APP-PLAN.md), [SPEC.md](SPEC.md),
> [SPEC-cluster-recognition.md](SPEC-cluster-recognition.md).

## A. App / UX
- **P1 — Canvas undo/redo.** Konva makes this tractable (snapshot the node model on each mutation). The
  hand-rolled history can live in `DrawingSurface` and expose `undo()/redo()` + Ctrl+Z/Y.
- **P1 — Tool keyboard shortcuts** (B brush, L line, R rect, E eraser, V select, Space pan…).
- **P1 — Autosave the current drawing** to `localStorage` (restore on reload); "New" to clear.
- **P1 — Explicit "ring" affordance.** Today the recognizer infers the ring from a circular stroke. A
  dedicated ring (toggle/tool) makes detection reliable and feeds `ring.closed` deterministically.
- **P2 — Pixel-eraser for placed symbols** (currently only stroke-eraser/Delete removes a symbol).
- **P2 — Better placed-symbol rendering** for text-glyph symbols without `svgPath` (Guidance "G",
  Calling "C") — render the glyph text instead of the fallback circle.
- **P2 — Prune dead CSS.** `src/index.css` still carries styles for the removed drag-drop editor
  (`.palette`, `.inspector`, `.spell-tree`, `.circles-panel`…). Audit and drop the unused rules.
- **P2 — Results drawer polish** (resizable height; remember collapsed state).
- **P3 — Named spell save/load + gallery** (Supabase `spells` table + Storage thumbnail) — APP-PLAN Phase I.

## B. AI training (the recognizer & flywheel)
- **P1 — Seed templates from canon SVGs.** Generate `$P` templates from the 33 sigil + 52 sign
  `svgPath`s so recognition works on day one without manual training (APP-PLAN Phase H / "seed").
- **P1 — Wire `logAnalysis`.** `data-services/analyses.js` exists but `StudioPage` never calls it —
  log each analysis (composition + engine result + corrections) so the improvement loop (WS9) has data.
- **P1 — Sample weighting by `source`.** `corrected` (user fixed a wrong guess) is the most valuable;
  `confirmed` (harvested from a catalog match) is high-volume but only as good as the match; `drawn`
  is hand-curated. Let the recognizer/cluster matcher weight accordingly; expose in review packets.
- **P2 — Active learning.** Show which symbols have the fewest active samples and nudge the user to
  draw them; prioritize those in Training.
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
- **P1 — Dyes affect the deduction.** Dyes are currently informational; wire them into power/duration/
  behavior per [docs/magical-dye.md](../magical-dye.md) so the analysis reflects the ink.
- **P1 — Surface match breakdown.** Show *why* a catalog match scored as it did (sigil/sign/symmetry
  parts from `analyze.js`), and the engine `--facts` + auto-caveats, for transparency.
- **P2 — AI report caching.** Cache the report per composition hash so re-analyzing is instant and
  cheap; show elapsed time / which topics ran.
- **P2 — Topic selection UI.** The plan calls for a per-topic checklist (default all on) — verify it's
  wired in `AIReportPanel` and let the user narrow the report.
- **P2 — Forbidden-magic surfacing.** Flag/warn when a composition trips forbidden patterns
  ([docs/forbidden-magic.md](../forbidden-magic.md)).
- **P2 — Cluster recognition (WS11b).** A matched cluster gives a holistic spell ID + known effect
  immediately, corroborating (or overriding) the per-symbol path — see SPEC-cluster-recognition.md.
- **P3 — Confidence/uncertainty in the AI report** (calibrated, not just prose), and a "disagrees with
  engine" signal that feeds the improvement loop as an engine-gap candidate.

## D. Nested & linked spell detection (the big recognizer gap)
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
- **Add ESLint + Prettier** matching the project style (no semicolons, single quotes, 2-space). There
  is no linter, so style drifts (the theme files had to be re-fixed). Prevents future drift.
- **De-duplicate the catalog matcher.** `tools/spell-engine-cli.mjs` re-implements the matcher from
  `src/engine/analyze.js` (with "keep in sync" comments; `test/matcher.test.js` guards the sync by
  running the CLI). Extract a PURE `src/engine/match.js` (data injected, like `compose.js`) and have
  both import it — removes the drift hazard.
- **Prune dead `index.css`** rules from the removed drag-drop editor (`.palette`, `.inspector`,
  `.spell-tree`, `.circles-panel`, `.glyph-svg`, `.cp-*`, …).
- **Lazy-load the Admin route** so the Studio's initial bundle doesn't pull admin-only code.
- ~~`ResultPanel` unused `spell` prop~~ — fixed.
