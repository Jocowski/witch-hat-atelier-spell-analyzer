# SPEC — Recognizer accuracy benchmark (correctness, not speed)

> Status: **B0–B5 shipped (all phases)** · Scope: **measure how OFTEN the recognizer is right, on a fixed labeled dataset** · Branch: `feat/spell-studio-experiments`
> **Outcome.** `tools/recognizer-accuracy.mjs` ships with `npm run bench:accuracy`. Synthetic seed baseline
> (perN=5, seed=1): **overall top-1 96.1% / top-3 98.7%** (sign 96.1%, sigil 96.2%). Tests **506 pass / 0
> fail** (+3 over baseline via the B5 floor smoke, ~13s). `recognizer.js` stays pure — the only change is
> adding `export` to two existing pure helpers (`makeCloudN`, `rotateCloudPoints`) for B3. `npm run lint`
> 0 errors. **Key findings:** (1) **rotation must be role-aware** — perturbing sigils with a full spin
> measures the deliberate no-core-sweep design, not robustness, and craters the metric (33%→96% once fixed);
> (2) **B2 confidence calibration** shows `confidenceMinPct=0` already clears 95% on synthetic data, so the
> current `30` is conservative (set the real threshold from B4 held-out data, not synthetic); (3) **B3
> prefilter-K** is *equivalent at every K on clean glyphs* (reproduces the perf-spec equivalence: 0.0pp drop)
> but the coarse 8-point pre-filter is the **noise-robustness bottleneck** — drop at K=15 grows with input
> noise (0pp clean → 4.5pp mild → 6.5pp heavy), a candidate to confirm on real data before retuning;
> (4) **held-out (B4)** needs multi-sample symbols the seed lacks (1/symbol), so it reports coverage honestly
> and degrades gracefully. Deviation from plan: B4 does **not** import `src/data-services/samples.js`
> (its `import.meta.env` top-level read crashes under plain Node) — the `--source=db` path uses a dynamic
> `@supabase/supabase-js` client from `process.env` instead, and `--source=fixture` is the offline/CI path.
> **Why now.** [SPEC-recognizer-performance.md](done/SPEC-recognizer-performance.md) made Detect *fast* and
> measures *speed* ([`tools/recognizer-bench.mjs`](../../../tools/recognizer-bench.mjs) → median ms). It
> deliberately ignores correctness ("samples don't need to recognise as specific symbols"). So every
> quality knob in [`data/rules.json` `recognition`](../../../data/rules.json) — `confidenceMinPct` (30),
> `prefilterK` (15), `sampleWeights`, `verifiedMultiplier`, `rotationSteps` — is currently tuned **by feel**,
> and "I improved recognition" is an *unmeasured* claim. This spec adds the **accuracy** axis: an answer-key
> harness that turns those knobs into data-driven decisions and gates recognizer changes on a real number.
> **Outcome target.** `node tools/recognizer-accuracy.mjs` prints top-1/top-3 accuracy (per role), a
> confusion matrix / top-confusions list, a confidence-calibration curve, and a prefilter-K safety report —
> on a synthetic dataset today, and on held-out real samples once they exist.
> Cross-refs: [SPEC-recognizer-performance.md](done/SPEC-recognizer-performance.md) (the speed sibling; this
> turns its §3 "no accuracy regression" invariant into a *measured* gate),
> [SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) (the training flywheel — A3 active-learning and
> the deferred **A7 ML model** both need this eval substrate), [IMPROVEMENTS.md](../IMPROVEMENTS.md).
> Touch points: new [`tools/recognizer-accuracy.mjs`](../../../tools/recognizer-accuracy.mjs); reads the pure
> [`src/draw/recognizer.js`](../../../src/draw/recognizer.js) (`recognize`/`buildClouds`/`analyzeStrokes`),
> [`data/training-seed.json`](../../../data/training-seed.json), [`data/rules.json`](../../../data/rules.json);
> optional [`src/data-services/samples.js`](../../../src/data-services/samples.js) for the real-data mode and a
> `node --test` floor smoke.

This spec covers five accuracy items plus an optional CI gate, in the order they should be built. It
mirrors the structure and **purity discipline** of the performance spec: the harness reads the pure
recognizer and never makes it impure.

| Phase | Idea | What it does | Dataset |
|------|------|--------------|---------|
| **B0** | **Harness + synthetic dataset** | top-1/top-3 accuracy, per role | synthetic (seed) |
| **B1** | **Confusion matrix** | which symbols get mistaken for which | synthetic |
| **B2** | **Confidence calibration** | accuracy-vs-`confidenceMinPct` → set the threshold from data | synthetic |
| **B3** | **Prefilter-K safety** | smallest K with zero accuracy loss (automates the K=15 hand-probe) | synthetic |
| **B4** | **Held-out (k-fold) mode** | true generalization over real multi-sample data | real (DB) |
| **B5** | *(optional)* **Floor smoke** | `node --test` asserts an accuracy floor — CI regression gate | synthetic |

> **Why this order.** B0 establishes the dataset + metric machinery everything else reuses. B1 is a pure
> add-on report over the same runs. B2/B3 are *sweeps* over a knob using B0's accuracy function. B4 swaps the
> dataset source (synthetic → real held-out) once multi-sample data exists; it's last because it depends on
> data the flywheel must first produce. B5 freezes the win as a regression gate.

---

## 0. The problem (what every phase is measured against)

`recognize(points, clouds)` ([recognizer.js:164](../../../src/draw/recognizer.js#L164)) returns a ranked
list `[{ name, dist, adjDist, score }]`; `analyzeStrokes` wraps it with rotation sweep, role-split, and the
coarse pre-filter. **We have no measurement of how often `name[0]` is the correct label.** Consequences:

- `confidenceMinPct: 30` ([rules.json:154](../../../data/rules.json#L154)) — chosen by feel. We don't know
  the accuracy of *accepted* detections at 30 vs 25 vs 45.
- `prefilterK: 15` ([rules.json:171](../../../data/rules.json#L171)) — set by a one-off manual probe
  ("smallest safe = 13, +2 margin", perf spec P3). The pre-filter *can* drop the true winner outside top-K;
  nothing continuously verifies it doesn't as the template set grows.
- `sampleWeights` / `verifiedMultiplier` / `rotationSteps` — all quality levers tuned blind.

### The dataset constraint (verified, drives the whole design)

`data/training-seed.json` holds **62 templates across 62 distinct symbols — exactly 1 sample each**
(`min/median/max samples per symbol = 1/1/1`). **Leave-one-out CV is impossible on the seed**: holding out a
symbol's only example removes it from the template pool, so it can never be matched. Therefore the harness
needs **two dataset modes**:

1. **Synthetic** (works on the seed *today*) — derive labeled *test drawings* by **perturbing** each
   template (rotation sweep, scale variation, point jitter), then classify against the **unmodified** cloud
   set (the true class's template is present, exactly as in production). This measures the property that
   actually regresses — **rotation/scale/noise robustness** — without needing more data.
2. **Held-out** (real data, grows with the flywheel) — **k-fold / leave-one-out** over symbols with **≥2**
   samples (the `verified` Supabase rows). The true generalization number. Degrades gracefully: skip
   singletons, report **coverage** (how many symbols/samples were evaluable).

### Invariants every phase keeps

1. **`recognizer.js` stays PURE** — the harness *reads* it; it never adds JSON/DOM/Worker to it. Load JSON in
   the tool via `createRequire` (the perf bench's pattern, [recognizer-bench.mjs:15](../../../tools/recognizer-bench.mjs#L15)).
2. **One source of truth for "right".** A prediction is correct iff the ranked top-1 `name` equals the test
   item's true label. "Confidence" uses the existing `confidencePct(dist)`
   ([recognizer.js:138](../../../src/draw/recognizer.js#L138)) — the harness must not invent a second
   definition; UI, gate, and benchmark agree on one.
3. **Config from `rules.json`.** The harness reads the same `recognition.*` block the app uses (via
   `createRequire`), so it benchmarks the *real* pipeline, not a divergent copy. CLI flags only *override*
   for sweeps.
4. **Determinism.** Perturbations use a **seeded PRNG** (CLI `--seed`, default fixed) so runs are
   reproducible and before/after diffs are real, not noise.
5. **No backend required.** Synthetic mode runs offline on the seed. Real mode is opt-in (`--source=db`) and
   no-ops with a clear message when Supabase is absent (mirrors `hasSupabase()` graceful degradation).

---

## Development loop protocol (per phase)

1. **Plan (Opus):** confirm the metric definitions / dataset shape / acceptance in this spec.
2. **Develop (subagent):** hand the subagent the phase's **Subagent brief** verbatim + the files. Implement,
   run the harness, report the actual numbers.
3. **Review (Opus):** run the **Review checklist**; loop on any failure.
4. **Gate:** `npm test` + `npm run lint` clean, **and the harness prints the expected report**, before
   advancing.

Sequence: **B0 → B1 → B2 → B3 → B4 → (B5).**

---

## B0 — Harness skeleton + synthetic dataset (top-1/top-3 accuracy)

**Objective.** A repeatable harness that builds a labeled synthetic test set from the seed, classifies each
item through the real pipeline, and prints **top-1** and **top-3** accuracy, broken down **per role**
(sign vs sigil) and overall.

**Files.** New: `tools/recognizer-accuracy.mjs` (Node, no deps, mirrors `recognizer-bench.mjs`). Add an
`npm run bench:accuracy` script in `package.json`.

**Design.**
- **Load** (via `createRequire`, like the perf bench): `training-seed.json`, `rules.json`. Build the
  `recognition` opts object exactly as [recognizer-bench.mjs:66-85](../../../tools/recognizer-bench.mjs#L66)
  does (reuse that shape).
- **Build clouds once** from the unperturbed seed: `buildClouds(seedTemplates)`.
- **Seeded PRNG** (`--seed`, default `1`) — a tiny mulberry32/xorshift; all perturbation randomness goes
  through it (invariant #4).
- **Synthetic test items.** For each seed template, generate `--perN` (default 5) perturbed copies:
  - **rotation**: sampled from a configurable set/range (e.g. uniform in `[0,360)`), so we measure the
    rotation-invariance the sweep is supposed to provide;
  - **scale**: `× uniform(--scaleLo, --scaleHi)` (default 0.8–1.25);
  - **jitter**: each point `± uniform(--jitter)` px (default 2).
  Each item carries its true `{ name, role }`. (Perturb the raw `points`, not the cloud.)
- **Classify.** Two paths, both valid; B0 uses the **direct** one for clarity and speed:
  - *Direct:* `recognize(item.points, role === 'sigil' ? clouds.sigil : clouds.sign)` over a rotation sweep
    via `bestMatchOverRotations` — i.e. replicate what `classifyAndRecognize` does for one group, without
    re-running ring detection. (Document the choice; it isolates the classifier from segmentation.)
  - *(B4 may also offer a full-`analyzeStrokes` path for end-to-end numbers.)*
- **Score.** top-1 = `ranked[0].name === item.name`; top-3 = item.name ∈ first 3 names. Aggregate counts →
  percentages, split by role and overall. Print a compact table.

**Acceptance.** `node tools/recognizer-accuracy.mjs` prints, e.g.:
```
$P recognizer accuracy — synthetic (seed, perN=5, seed=1)
  role     items   top-1     top-3
  sign       NNN   XX.X%     YY.Y%
  sigil      NNN   XX.X%     YY.Y%
  overall    NNN   XX.X%     YY.Y%
```
Re-running with the same `--seed` yields identical numbers. **Effort: S–M.**

**Subagent brief.** "Create `tools/recognizer-accuracy.mjs` (Node, no deps), mirroring
`tools/recognizer-bench.mjs`'s loading (`createRequire` for `training-seed.json` + `rules.json`) and opts
shape. Build clouds once via `buildClouds`. With a seeded PRNG (`--seed`, default 1), generate `--perN`
(default 5) perturbed test items per seed template (rotation, scale 0.8–1.25, jitter ±2px), each labeled
with its true name/role. Classify each via `bestMatchOverRotations` against the role-matched cloud pool;
score top-1 and top-3. Print accuracy per role + overall. Add `npm run bench:accuracy`. Do NOT modify
`recognizer.js`. Run `node tools/recognizer-accuracy.mjs` and report the table."

**Review checklist.** No edits to `recognizer.js` (purity intact) · uses `confidencePct`/`recognize` as-is ·
opts read from `rules.json` · PRNG seeded + reproducible · per-role + overall numbers print · `npm run
bench:accuracy` works offline. **Effort: S–M.**

---

## B1 — Confusion matrix + top-confusions list

**Objective.** Report **which** symbols get mistaken for which — the report that directly tells the flywheel
*what to collect more of* (ties to SPEC-recognizer-analysis.md A3 active-learning).

**Files.** `tools/recognizer-accuracy.mjs` (extend B0's run loop; no new files).

**Design.**
- While scoring B0's items, accumulate `confusion[trueName][predName]++` for every top-1 miss.
- A full 62×62 grid is unreadable; **default output = a "top confusions" list**: the N (default 15) most
  frequent `(true → predicted : count)` off-diagonal pairs, plus **per-symbol recall** sorted ascending
  (worst-recognized symbols first — the active-learning worklist).
- `--matrix` flag optionally dumps the full grid as CSV (`--out confusion.csv`) for offline inspection.

**Acceptance.** Default run appends a "Top confusions" block and a "Weakest symbols (lowest recall)" list;
`--matrix --out x.csv` writes a parseable CSV. **Effort: S.**

**Subagent brief.** "Extend `tools/recognizer-accuracy.mjs`: accumulate a confusion map over top-1 misses.
Print the top-15 `(true → predicted : count)` pairs and a per-symbol recall list sorted ascending. Add
`--matrix --out <file>` to dump the full grid as CSV. No `recognizer.js` changes. Report the top confusions."

**Review checklist.** Confusion accumulated from the same runs (no extra classification pass) · top-confusions
+ weakest-symbols lists print · `--matrix` CSV parses · purity intact. **Effort: S.**

---

## B2 — Confidence calibration (set `confidenceMinPct` from data)

**Objective.** Replace the hand-picked `confidenceMinPct: 30` with a **data-driven** choice. Produce the
curve of *coverage* (fraction of detections accepted) and *accuracy-on-accepted* across candidate cutoffs,
so the threshold is chosen at a stated quality bar (e.g. "smallest cutoff where accepted detections are
≥95% top-1 correct").

**Files.** `tools/recognizer-accuracy.mjs` (a sweep over the existing per-item results).

**Design.**
- B0 already computes, per item, the top-1 `name` and the winning `dist` → `confidencePct(dist)`. Reuse
  those; **no re-classification**.
- For each cutoff `c ∈ {0,5,10,…,90}`: among items with `confidence ≥ c`, report **coverage** =
  `accepted / total` and **accuracy** = `top-1 correct among accepted / accepted`.
- Print the table and **flag the recommended cutoff** = the smallest `c` whose accuracy ≥ `--targetAcc`
  (default 0.95) — mirroring how `confidenceMinPct` gates "unknown?" in the live pipeline.
- This is exactly the trade the gate makes: raising the cutoff trades coverage for precision; the curve makes
  that trade explicit instead of guessed.

**Acceptance.** Run prints a coverage/accuracy-vs-cutoff table and a recommended `confidenceMinPct`. Changing
`--targetAcc` moves the recommendation sensibly. **Effort: M.**

**Subagent brief.** "Extend `tools/recognizer-accuracy.mjs`: from the per-item top-1 results, compute for
cutoffs 0..90 step 5 the coverage (accepted/total) and accuracy-on-accepted using `confidencePct(dist)`.
Print the table and recommend the smallest cutoff with accuracy ≥ `--targetAcc` (default 0.95). No
re-classification, no `recognizer.js` changes. Report the curve + recommendation."

**Review checklist.** Reuses B0 results (single classification pass) · uses `confidencePct` (invariant #2) ·
coverage + accuracy both reported · recommendation respects `--targetAcc` · purity intact. **Effort: M.**

---

## B3 — Prefilter-K safety report

**Objective.** Automate the manual probe that set `prefilterK: 15`. Report the **smallest K** for which the
coarse pre-filter loses **no** top-1 accuracy vs. the no-prefilter baseline — and warn if the current K=15 is
ever unsafe as the template set grows.

**Files.** `tools/recognizer-accuracy.mjs` (sweep K).

**Design.**
- Baseline = accuracy with the pre-filter effectively disabled (`prefilterK` huge, the bench's `9999`
  convention, [recognizer-bench.mjs:198](../../../tools/recognizer-bench.mjs#L198)).
- For `K ∈ {5,8,10,13,15,20,30}` (configurable), recompute top-1 accuracy and the **drop vs baseline**.
- Report the **smallest K with zero drop** and whether the configured `rules.json` K clears it. This is the
  accuracy counterpart to the perf spec's P3 — perf said "13 is the smallest safe K"; this *proves and
  re-proves* it automatically.
- (Use the full pipeline path here, or `prefilter` directly, so the coarse-descriptor behavior is the real
  one. Document which.)

**Acceptance.** Run prints a `K → accuracy / drop` table and the recommended K; flags if configured K is
below the safe floor. **Effort: S–M.**

**Subagent brief.** "Extend `tools/recognizer-accuracy.mjs`: sweep `prefilterK ∈ {5,8,10,13,15,20,30}`,
compute top-1 accuracy vs. a no-prefilter baseline (K=9999), print K→accuracy/drop, recommend the smallest
K with zero drop, and warn if `rules.json` K is below it. No `recognizer.js` changes. Report the table."

**Review checklist.** Baseline = prefilter disabled · drop computed per K · recommendation = smallest
zero-drop K · warns when configured K unsafe · purity intact. **Effort: S–M.**

---

## B4 — Held-out (k-fold) mode over real samples + `npm` wiring

**Objective.** The **true** generalization benchmark Einlar described ("algo A = 80% on this dataset"):
leave-one-out / k-fold over **real, multi-sample** labeled data, not synthetic perturbations.

**Files.** `tools/recognizer-accuracy.mjs` (`--source=db|seed`, `--folds`, `--verified-only`); reads
`src/data-services/samples.js` `activeTemplates({ verifiedOnly })` for the real set.

**Design.**
- `--source=seed` (default) keeps B0–B3 behavior. `--source=db` pulls real templates via `activeTemplates`
  (respecting `--verified-only`, the gold set — [samples.js:32](../../../src/data-services/samples.js#L32)).
  No-op with a clear message when `hasSupabase()` is false (invariant #5).
- **k-fold:** group samples by label; **only symbols with ≥2 samples are evaluable**. For each fold, hold out
  a subset as test items, build clouds from the rest, classify, score. **Report coverage**: how many
  symbols/samples were evaluable vs. skipped as singletons (this is the honest caveat — until the flywheel
  produces multi-sample symbols, coverage is partial).
- Reuse B0–B3's metric/printers verbatim (accuracy, confusion, calibration) — only the *dataset source and
  the split* change. This is why B4 is last: it's a data-source swap over machinery already proven on
  synthetic data.
- Optionally support a checked-in **fixture** (`--source=fixture --file fixtures/accuracy-set.json`) so a
  stable real-ish dataset can live in the repo / CI without a live DB.

**Acceptance.** `npm run bench:accuracy -- --source=db --verified-only` prints held-out accuracy + coverage,
or a clean "no Supabase / not enough multi-sample symbols (coverage 0)" message. `--source=seed` unchanged.
**Effort: M.**

**Subagent brief.** "Extend `tools/recognizer-accuracy.mjs` with `--source=seed|db|fixture`, `--folds`
(default LOO), `--verified-only`. For `db`, load templates via `activeTemplates({ verifiedOnly })`; no-op
gracefully when Supabase is absent. Implement k-fold grouped by label, evaluating only symbols with ≥2
samples and reporting coverage (evaluable vs skipped). Reuse the B0–B3 metric printers. Keep `recognizer.js`
pure. Report held-out accuracy + coverage on whatever data is available."

**Review checklist.** `seed` path unchanged · `db` path graceful when offline · k-fold groups by label,
skips singletons, reports coverage · reuses existing metric code (no fork) · `--verified-only` hits the gold
set · purity intact. **Effort: M.**

---

## B5 — *(optional)* Accuracy-floor smoke (CI regression gate)

**Objective.** Freeze the win: a `node --test` that asserts synthetic top-1 accuracy stays above a generous
floor, so a future recognizer change that silently *lowers* accuracy fails CI — the correctness counterpart
to the perf spec's suggested ceiling smoke.

**Files.** New: `test/recognizer-accuracy.test.js`. Factor B0's scoring into a small **pure exported
function** in the tool (or a shared `src/draw/`-adjacent helper) so the test imports it without spawning a
process.

**Design.**
- Export `runSyntheticAccuracy({ seed, perN }) → { overall, byRole }` from the harness (pure; no `console`).
- The test builds the synthetic set with a **fixed seed** and asserts `overall.top1 >= FLOOR` (set the floor
  comfortably below the observed number from B0 so normal noise never flakes it; document the headroom).
- Keep it fast (small `perN`) so it fits the existing `node --test` suite.

**Acceptance.** `node --test test/recognizer-accuracy.test.js` passes; lowering accuracy (e.g. forcing
`rotationSteps: 1`) makes it fail. **Effort: S.**

**Subagent brief.** "Factor `tools/recognizer-accuracy.mjs`'s synthetic scoring into a pure exported
`runSyntheticAccuracy({seed,perN})` (no console). Add `test/recognizer-accuracy.test.js` that runs it with a
fixed seed and asserts overall top-1 ≥ a documented floor (well below observed). Keep it fast. Run
`node --test`."

**Review checklist.** Scoring factored out pure (no I/O) · fixed seed · floor has headroom (won't flake) ·
fails on a deliberately broken config · fast enough for the suite. **Effort: S.**

---

## Risks & notes

- **Synthetic ≠ real.** Perturbed templates over-state accuracy (the test item *is* a jittered copy of a
  present template). Synthetic mode is a **rotation/scale/noise regression guard and a relative A/B tool**,
  not an absolute "real-world accuracy" claim. The absolute number comes from **B4 held-out on real data** —
  state this caveat in the harness output so nobody quotes the synthetic number as ground truth.
- **Coverage honesty (B4).** Until the flywheel yields symbols with ≥2 samples, held-out coverage is
  partial. Always print evaluable-vs-skipped counts; a "92% accuracy" over 4 evaluable symbols is not a
  headline. This is the same provenance/trust discipline as `sampleWeights`.
- **Classifier vs. pipeline scope.** B0's direct path scores the *classifier* (given a clean segmented
  group). Real misses also come from **segmentation** (ring detection, adaptive gap) and the **raster
  contamination veto**. Note the scope; an optional full-`analyzeStrokes` path (B4) gives the end-to-end
  number and isolates where errors originate.
- **Don't let the benchmark drive overfitting.** Tuning `confidenceMinPct`/`prefilterK`/weights to maximize a
  *synthetic* score can hurt real accuracy. Treat synthetic as the fast inner loop; confirm any knob change
  against B4 held-out before committing it to `rules.json`.
- **Purity is the guardrail (again).** Like the perf spec, the one hard rule is `recognizer.js` stays
  JSON/DOM/Worker-free. The harness lives entirely in `tools/` + an optional pure-function test; it reads the
  recognizer, never mutates its contract.
- **Shareable.** This is the "common dataset → measurable accuracy" benchmark from the wha-spell-simulator
  discussion; the synthetic mode needs no labeled corpus to start, which directly answers "how do I benchmark
  before I have lots of labels."
