# SPEC — Recognizer flywheel + Analysis/AI surfacing

> Status: **partial - core flywheel shipped; A7 ML + B5 cluster deferred** · Scope: **training data → recognizer → analysis → AI report** · Branch: `feat/spell-studio`
> Cross-refs: [IMPROVEMENTS.md](../IMPROVEMENTS.md) (§B AI training, §C Spell analysis), [SPEC.md](../SPEC.md)
> (WS9 improvement loop, WS11b cluster), [SPEC-cluster-recognition.md](SPEC-cluster-recognition.md).
> Data layer: `src/data-services/{samples,analyses,symbols}.js`, `src/draw/recognizer.js`,
> Supabase tables `training_samples` / `analyses` / `symbols` (`supabase/migrations/`).

This groups the recognizer/training and analysis/AI items. It is **independent of** the (now shipped)
canvas-UX batch and the symbol-versioning work ([SPEC-symbol-versioning.md](done/SPEC-symbol-versioning.md)).
**Status:** core flywheel shipped — A0–A6 + B1–B4 + B6 (A4 rotation, A5 segmentation, A6 verify-flag,
B2 report cache, B6 confidence-vs-engine landed in the 2026-06-05/06 batch). **Deferred:** A7 (real ML
model + sample dedup) and B5 (cluster recognition, tracked in [SPEC-cluster-recognition.md](SPEC-cluster-recognition.md)).

---

# Part A — Recognizer & training flywheel

Current data shape (verified): `training_samples` rows carry `{ symbol_id, points (jsonb [{X,Y,ID}]),
role, rotation, scale, source, app_version, created_by, created_at, deleted_at }`
([samples.js](../../../src/data-services/samples.js)). `activeTemplates()` flattens active rows into
`{ name, role, points }` for the `$P` recognizer; `addSample()` defaults `source:'drawn'`. Sources in
use: **`drawn`** (Training tab), **`confirmed`** (harvested from a catalog match,
[StudioPage.jsx:157](../../../src/studio/StudioPage.jsx#L157)), **`corrected`** (user fixed a wrong guess,
[IdentifiedPanel.jsx:47](../../../src/studio/IdentifiedPanel.jsx#L47)). The `$P` matcher and pipeline are
pure in [recognizer.js](../../../src/draw/recognizer.js); `recognize()` already returns per-template
`{ name, dist, score }`.

## A0 — Wire `logAnalysis` (prerequisite for the loop)
**What it is.** `logAnalysis()` ([analyses.js:13](../../../src/data-services/analyses.js#L13)) writes a
snapshot of each analysis to the Supabase `analyses` table: the `composition` (the spell), the
`engine_result` (what the engine deduced), the `ai_report`, and the `corrections` (which labels the user
fixed, from→to). It is implemented but **never called**, so this history doesn't exist yet.

**Why first.** Every data-driven item below needs *what was analyzed and what users corrected*, which
only exists once we record it. The improvement loop (flywheel) it enables:
1. User analyzes a spell → `logAnalysis` records composition + engine result + corrections.
2. Over time the data reveals **which symbols the recognizer most often gets wrong** (high correction
   rate), **which spells get analyzed**, and where the engine diverges from reality.
3. That feeds: **active learning** (A3 — prioritize training the weak symbols), **source weighting**
   (A1 — corrections are the highest-value training data), the **AI report cache** (B2), and the
   **engine-gap queue** (B6 — AI-vs-engine disagreements).

**Do.** It's essentially **one call site**: at the end of `handleAnalyze`
([StudioPage.jsx:111](../../../src/studio/StudioPage.jsx#L111)), call `logAnalysis(...)` with the
`composition`, the engine `result`, and a `corrections` object accumulated from `handleCorrect`
(catalog labels changed, from→to). Fire-and-forget; it already no-ops when Supabase is absent, so it's
safe with or without a backend.

- **Acceptance:** analyzing while logged in inserts an `analyses` row; corrections are captured; no
  error when Supabase is unconfigured.
- **Effort: S.**

## A1 — Sample weighting by `source`
**Goal:** trust `corrected` > `drawn` > `confirmed` when matching. Today every template is equal.
- **Model:** add a `weight` to each template from its `source` (default map
  `{ corrected: 1.5, drawn: 1.0, confirmed: 0.6 }`, tunable in `rules.json` so it's data-driven).
  Carry `source` through `activeTemplates()` (select it) → into `makeCloud`/the cloud list.
- **Matcher:** `recognize()` currently ranks by raw `dist`. Introduce a *weighted* score
  `adjDist = dist / weight` (a more-trusted template wins ties / close calls) and rank by that. Keep raw
  `dist` for display/telemetry. **Keep `recognizer.js` pure** — pass weights in with the templates, do
  not import JSON there (same rule as `geometry.js`/`deduce.js`).
- **Surface:** show the winning template's `source` in the Review packet and optionally in the
  Identified panel tooltip.
- **Acceptance:** with two near-equidistant templates of different sources, the higher-weight source
  wins; a unit test in `test/` drives `recognize()` with weighted templates.
- **Effort: M** · depends on A0 only for telemetry, not for the matcher change.

## A2 — Confidence gate (moved here from "code-quality")
**Why it's here, not housekeeping:** it changes recognizer *behavior/UX*, not just style. Confidence
already exists: `dist → confidencePct` and `conf-high/mid/low` classes
([IdentifiedPanel.jsx:25-55](../../../src/studio/IdentifiedPanel.jsx#L25-L55)).
- **Do:** define a low-confidence threshold (start: `dist`-based, calibrated so ≈ <30% reads "unknown").
  Below it, **don't assert a wrong label** — render the detection as **"unknown?"** (with the top guess
  shown as a *suggestion*, not a committed label), and **exclude it from the composition** fed to the
  engine (or mark it provisional) so a bad guess doesn't poison the deduction/overlays.
- **Track:** per-symbol correction rate (needs A0 data) → feeds A3 active learning.
- **Acceptance:** a deliberately ambiguous scribble shows "unknown?" instead of a confident wrong id;
  the engine analysis doesn't include un-gated symbols; the threshold is one constant/config value.
- **Effort: M.**

## A3 — Active learning + dataset-coverage progress (answers the ML-readiness question)
**Goal:** steer drawing toward the symbols that need it, and show progress toward "enough data".
- **Coverage query:** `count(training_samples WHERE deleted_at IS NULL) GROUP BY symbol_id`. Join with
  the 33 sigils + 52 signs registry to get per-symbol counts (including zeros).
- **Active learning:** in Training, surface the **N least-covered** symbols and nudge the user to draw
  them; sort the Training picker by ascending count.
- **Progress bar (the user's question):** show **dataset readiness** as two bars:
  1. *Coverage*: `% of the 85 symbols that have ≥ T_min samples`.
  2. *Volume*: `total active samples / target`.
  **Concrete targets (rules of thumb, put in config):**
  - `$P` works *now* with **1–5** good samples/symbol — that's the floor for usable recognition.
  - A first **classical ML** pass (small CNN on a rasterized 64×64 glyph, or a light point-sequence
    model) wants **≈ 50–100 samples/symbol** to beat `$P`, i.e. **~4,000–8,500 total** across 85
    symbols, *balanced* (no symbol starving). Below ~30/symbol a CNN typically underperforms `$P`.
  - "Comfortable" ML: **150–300/symbol** (~13k–25k total) with augmentation (rotation/scale/jitter).
  So: **gate the "Train ML" affordance on coverage ≥ T_min (e.g. 50) for ≥ ~90% of symbols**, and let
  the progress bar fill toward that. The exact T_min lives in config so you can move it.
- **Acceptance:** Training shows the least-covered symbols and a readiness bar; numbers come from a
  single grouped query; thresholds are config, not hardcoded in components.
- **Effort: M** (needs a `sampleCounts()` data-service fn + a small Training UI block).

## A4 — Rotation tolerance for single-symbol / cluster guesses
`$P` is not rotation-invariant. The spell pipeline already de-rotates per group via a 24-step sweep
([recognizer.js:136-145](../../../src/draw/recognizer.js#L136)), but Training's **live single-symbol
guess** and any future **cluster** match do not.
- **Do:** factor the sweep in `analyzeStrokes` into a reusable `bestMatchOverRotations(strokes, clouds,
  steps)` and use it for the Training live guess too (signs only; cores stay at 0° like the pipeline).
- **Acceptance:** rotating a drawn sign in Training doesn't tank the guess; pipeline behavior unchanged
  (same function, same result). Pure-module test added.
- **Effort: S–M.**

## A5 — Adaptive segmentation + better ring detection
The stroke-merge `gap` is hardcoded (45px in [StudioPage.jsx:87](../../../src/studio/StudioPage.jsx#L87),
default in `analyzeStrokes`); ring detection uses a fixed `cv < 0.3` circularity
([recognizer.js:109](../../../src/draw/recognizer.js#L109)).
- **Do:** make `gap` scale with the detected ring radius / median symbol size (e.g. `gap = k * ringR`
  or a fraction of median nearest-neighbour stroke distance). Expose the circle-fit residual threshold
  as a tunable. Pass computed `gap` from the caller instead of the literal `45`.
- **Acceptance:** large and small drawings segment correctly without manual tuning; existing recognizer
  tests still pass; add a test with a scaled-up drawing.
- **Effort: M** · interacts with the explicit-ring decision (dropped from UX scope — ring stays
  inferred, so robust ring detection matters more).

## A6 — Admin "verify" flag on samples
**Goal:** prefer trusted samples, bulk-exclude bad contributors.
- **Schema:** add `verified boolean default false` (+ `verified_by uuid`, `verified_at timestamptz`) to
  `training_samples` (new migration). RLS: only admins can set it.
- **Recognizer/weighting:** a verified sample gets a weight bump (ties into A1's weight map, e.g.
  `× 1.3`); optionally a "verified-only" recognizer mode.
- **Review UI:** a Verify toggle per row in [ReviewView.jsx](../../../src/admin/ReviewView.jsx); a bulk
  "exclude all from user X" already exists via `softDeleteByUser`.
- **Acceptance:** admin can mark/unmark verified; verified samples rank higher; migration is reversible.
- **Effort: M.**

## A7 — Real ML model + sample dedup (long horizon)
Gated on A3 coverage. When ready: train **offline** (CNN on rasterized glyph, or a point-sequence
model), export to **TF.js/ONNX**, ship as an alternate recognizer, and **A/B against `$P`** (log both
predictions via A0 to measure win-rate before switching). **Dedup:** before training (and optionally on
insert), drop near-identical samples (e.g. cluster by `$P` distance < ε within a symbol, keep a
representative) so one repeated drawing can't dominate a class. **Effort: L** (research) — keep as a
milestone, not a near-term task.

---

# Part B — Analysis & AI report surfacing

## B1 — Surface the match breakdown + engine `--facts`/caveats
**What it is (the user's question):** when a composition matches a catalog spell, the panel shows only
the name + a single score % ([ResultPanel.jsx:136](../../../src/components/ResultPanel.jsx#L136)). But
`match.js`/`analyze.js` compute that score from **parts** (sigil similarity + sign overlap + symmetry,
weighted per `rules.json`). "Surfacing" = show *why* it matched — a small breakdown like
`sigils 0.9 · signs 0.7 · symmetry 1.0 → 82%` — plus the engine's structured **facts** (the same
observations `npm run facts` prints) and any **auto-caveats** (e.g. "ring open → may not activate",
"low-confidence symbol present"). It's a **new read-only panel section**, opt-in via a "Why this match?"
disclosure so the default view stays clean.
- **Do:** have `match.js` return the component sub-scores (not just the total); render them under the
  similar-spell card. Expose the engine facts (already produced for the CLI) to the browser engine path
  and render them in a collapsible "Evidence" block. Caveats come from existing issues + the A2
  confidence gate.
- **Acceptance:** the match card can expand to show sub-scores + facts; no change to the score itself.
- **Effort: M.**

## B2 — AI report cache by composition hash
The streaming multi-topic report ([AIReportPanel.jsx](../../../src/studio/AIReportPanel.jsx),
[report.js](../../../src/ai/report.js)) re-runs on every analyze.
- **Do:** hash the canonical composition (stable JSON stringify → e.g. FNV/SHA over the wha-spell
  object + selected topics) and cache `{ hash → { topicId → markdown } }`. Tiers: in-memory for the
  session; optionally persist to the `analyses.ai_report` column (A0) so re-opening a known spell is
  instant. Show "cached · {age}" vs "generated in {ms}" and a "Regenerate" button to bypass.
- **Acceptance:** re-analyzing an unchanged spell returns instantly from cache; editing the spell busts
  the hash; Regenerate forces a fresh run.
- **Effort: M.**

## B3 — Topic selection UI — **already done**
The per-topic checklist (toggle + select-all + count) exists at
[AIReportPanel.jsx:153-169](../../../src/studio/AIReportPanel.jsx#L153-L169). No work needed beyond
confirming the selected set is what `streamReport` receives (it is, via `topics: selectedIds`).

## B4 — Forbidden-magic surfacing
Flag compositions that trip forbidden patterns ([docs/forbidden-magic.md](../../forbidden-magic.md)).
- **Do:** encode forbidden patterns as data (extend `rules.json` or a new `forbidden.json`: e.g.
  body-affecting + healing/transmutation-on-living, etc.) and add a pure check in the engine that emits
  a **blocking/danger issue** + a dedicated red callout in `ResultPanel` (the `.spell-card.forbidden`
  styling already exists). Also feed it as an AI-report topic ("Ethical/forbidden review").
- **Acceptance:** a known-forbidden composition shows a clear warning; ordinary spells don't false-trip;
  patterns are data-driven and testable.
- **Effort: M** · needs canon modeling — sync the pattern list with the Spell Checkers community
  ([memory: spell-checkers-community]).

## B5 — Cluster recognition (WS11b)
Recognize the **whole** set of symbols as a spell unit (holistic ID + known effect immediately),
corroborating or overriding the per-symbol path. Full design already in
[SPEC-cluster-recognition.md](SPEC-cluster-recognition.md) — this spec just sequences it **after** A0–A3
(it needs the weighted, gated, well-covered per-symbol layer + logged data to build cluster templates).
- **Effort: L** · cross-ref the dedicated spec.

## B6 — Confidence/uncertainty + "disagrees with engine"
- **Calibrated confidence:** the AI report should emit a structured confidence (not just prose) per
  topic/claim — e.g. ask the bridge to return a `confidence: 0..1` field alongside markdown, rendered as
  a small meter. Calibrate against outcomes over time (A0 data).
- **Disagreement signal:** compare the AI's deduced effect vs the engine's deterministic deduction; when
  they diverge, render a **"AI disagrees with engine"** badge and log it (A0) as an **engine-gap
  candidate** — the queue that drives CORE/lexicon/grammar improvements (the WS9 loop).
- **Acceptance:** divergences are visibly flagged and recorded; confidence is a value, not just adjectives.
- **Effort: M–L** (touches `report.js`, the bridge prompt in `tools/`, and `ResultPanel`).

---

## Schema/data additions summary
- `training_samples.verified` (+ `verified_by`, `verified_at`) — A6 (new migration).
- `sampleCounts()` data-service fn (grouped count) — A3.
- `analyses` rows actually written — A0; reused by B2 cache + B6 disagreement log.
- `rules.json`: source-weight map (A1), confidence threshold (A2), coverage targets (A3), forbidden
  patterns or new `forbidden.json` (B4).

## Suggested order
1. **A0 wire `logAnalysis`** (unblocks everything data-driven).
2. **A1 source weighting** + **A2 confidence gate** (recognizer quality, user-visible).
3. **A3 active learning + coverage progress** (drives data growth toward ML).
4. **B1 match breakdown** + **B4 forbidden** (analysis transparency, mostly engine/data).
5. **A4 rotation / A5 segmentation / A6 verify** (robustness, as needed).
6. **B2 cache**, **B6 confidence/disagreement**.
7. **B5 cluster** (own spec) → **A7 ML** (when coverage gate is green).

## Testing notes
- Keep `recognizer.js` pure (no JSON imports) — weighting/rotation changes get `node --test` coverage
  with injected templates, like the existing recognizer tests.
- Engine changes (B1 facts, B4 forbidden) are unit-testable in `test/`; data-integrity tests already
  guard `spells.json`/`grammar.json` references.
