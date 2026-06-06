# SPEC — Learned (ML) glyph recognizer behind an engine seam

> Status: **proposed** · Scope: **add an optional ML recognizer as a drop-in alternative to `$P`, behind a config flag, without touching structure (ring/segment/nest/link) or the pure-module discipline** · Branch: `feat/spell-studio-experiments`
> **Why now.** Our recognizer is the `$P` Point-Cloud matcher ([recognizer.js](../../../src/draw/recognizer.js)) — a geometric template matcher whose quality knobs are tuned by feel and whose own README-equivalent caveat is "works best on clean, deliberate drawings." A sibling project ([ytnrvdf/wha-spell-simulator#7](https://github.com/ytnrvdf/wha-spell-simulator/pull/7)) demonstrated a **siamese-embedding** recognizer (learn a fingerprint per glyph, match by cosine) that is markedly more tolerant of messy ink and is **few-shot** (one example per symbol is enough — which exactly fits our `training-seed.json`, 1 sample/symbol). This spec adapts that idea to *our* stack: ML labels the **leaves** (symbol identity); geometry keeps building the **tree** (rings, nesting, linking, full-spell). The ML investment therefore serves per-symbol recognition today and nested/linked/full-spell recognition later, because everything downstream of the recognizer reads a `composition`, not pixels.
> **Outcome target.** `recognition.engine` in [rules.json](../../../data/rules.json) selects `"p"` (default, today's `$P`) or `"ml"` (learned). The ML engine runs in-browser via `onnxruntime-web`, loads its prototypes from Supabase (the flywheel updates them on correction — **no retraining to add a symbol**), and is adopted as default **only after** it beats tuned `$P` on [`tools/recognizer-accuracy.mjs`](../../../tools/recognizer-accuracy.mjs). The static GitHub-Pages deploy is preserved; Python is a dev-only one-time bake.
> Cross-refs: [SPEC-recognizer-accuracy.md](SPEC-recognizer-accuracy.md) (**the measurement substrate — done**; this spec is gated on it), [SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) (this is the concrete design of its deferred **A7 ML model**), [SPEC-recognizer-performance.md](done/SPEC-recognizer-performance.md) (the worker layer ML reuses), [SPEC-nested-linked.md](done/SPEC-nested-linked.md) + [SPEC-cluster-recognition.md](SPEC-cluster-recognition.md) (the **structure** layer ML deliberately does *not* touch), [IMPROVEMENTS.md](../IMPROVEMENTS.md).
> Touch points: pure [src/draw/recognizer.js](../../../src/draw/recognizer.js) (`recognize`/`analyzeStrokes`/`buildClouds`/`confidencePct`) read, never made impure; new `src/draw/embed.js` (interface) + `src/draw/mlRecognizer.js` + `src/draw/glyphRasterizer.js` + `src/draw/recognizerEngine.js`; [src/studio/useRecognizerWorker.js](../../../src/studio/useRecognizerWorker.js) + [src/draw/recognizerWorker.js](../../../src/draw/recognizerWorker.js) (routing); [src/admin/TrainingView.jsx](../../../src/admin/TrainingView.jsx) (dual guess); [data/rules.json](../../../data/rules.json) `recognition`; new `supabase/migrations/*_symbol_prototypes.sql` + [src/data-services/samples.js](../../../src/data-services/samples.js); [vite.config.js](../../../vite.config.js) (lazy chunk); new dev-only `ml/` Python folder; [package.json](../../../package.json) scripts. Gated by [`tools/recognizer-accuracy.mjs`](../../../tools/recognizer-accuracy.mjs).

This spec has six phases (M0–M5) mirroring the six-step plan. It follows the **purity discipline** and dev-loop structure of the accuracy/perf specs: the ML modules are *impure* (onnx, async, fetch) and live **outside** the pure recognizer; they plug in only at the `embed()` seam.

| Phase | Step | Idea | What it does | Ships |
|------|------|------|--------------|-------|
| **M0** | 1 | **Tune `$P` from data** | set `confidenceMinPct`/`rotationSteps`/`prefilterK` using the accuracy harness | baseline number + tuned `rules.json` |
| **M1** | 2 | **Engine seam** | `embed()` interface + `recognition.engine` flag + dispatcher; `$P` implements it | reversible plumbing, `$P` still default |
| **M2** | 3 | **Dual live-guess** | admin Training shows `$P` vs ML guesses side by side | the in-app A/B lab |
| **M3** | 5 | **Python encoder bake** | train/fine-tune siamese encoder → commit `model.onnx` | a model file + `ml/` folder |
| **M4** | 4 | **JS ML engine** | rasterizer + onnxruntime-web inference + Supabase prototypes | the working ML recognizer |
| **M5** | 6 | **Gate & adopt** | A/B through the harness; flip default only if ML wins | a decision + (maybe) new default |

> **Why this order.** M0 is free and sets the bar. M1 builds the seam *before* any ML so the change is reversible and `node --test` stays green. M2 builds the comparison UI (its ML side is stubbed until M4). M3 (your "step 5") moves **before** M4 because inference needs an encoder. M4 is the real engine. M5 turns the whole thing into a data-backed yes/no instead of a vibe.

---

## 0. The architecture this spec commits to (read first)

Two layers, permanently separated:

```
strokes
  ├─[GEOMETRY]  ring detect → segment → nest/link assign   → STRUCTURE   (the $P pipeline; unchanged, grows on its own)
  ├─[EMBED]     each candidate stroke-group → vector        → primitive   (engine = "p": geometric · "ml": onnx)
  ├─[IDENTITY]  cosine(vector, prototypes) → symbol id       → leaf labels
  ├─ assemble wha-spell composition (core / components / nested / linked)
  └─[MATCH]     composition vs catalog                       → full-spell  (existing similar-spells matcher, on the composition)
```

**ML goes only at EMBED/IDENTITY.** Nesting, linking, and full-spell recognition are *structure over identity* — relationships between geometric objects, already modeled by the `composition` shape and the catalog matcher. They are **not** image-recognition problems and get **no** ML in this spec. This is what makes the same ML investment future-proof: improve the leaf labeler once, every structural feature downstream benefits.

### Invariants every phase keeps

1. **`recognizer.js`, `geometry.js`, `deduce.js` stay PURE** — no JSON/DOM/onnx/fetch imports (the `ERR_IMPORT_ATTRIBUTE_MISSING` rule). All ML lives in new impure modules behind the dispatcher; the pure recognizer is *read* by the harness, never modified.
2. **One contract.** Both engines satisfy the same `recognizeCandidates`/`analyzeStrokes`-shaped output the worker and `drawingModel.js` already consume. Switching engines never changes a call site.
3. **`$P` is the default forever until M5 proves otherwise.** `recognition.engine` defaults to `"p"`. ML is opt-in until a measured win flips it.
4. **One source of truth for "right."** Adoption is decided by `tools/recognizer-accuracy.mjs` (top-1, using `confidencePct`), not by the model's self-reported synthetic number.
5. **No new backend compute.** Training is dev-only Python, run rarely. Inference is in-browser wasm. Prototypes are computed client-side (admin) and stored as plain vectors. The deploy stays static.
6. **One rasterizer.** The image-maker exists once, in JS. Python training data is produced by running *that* rasterizer in Node — so there is no second implementation to keep in sync (we avoid the sibling PR's bit-for-bit Python↔JS parity tax at its source).

---

## Development loop protocol (per phase)

1. **Plan (Opus):** confirm the phase's contract / data shape / acceptance against this spec.
2. **Develop (subagent):** hand the subagent the phase's **Subagent brief** verbatim + the touch-point files. Implement, run, report real numbers/screens.
3. **Review (Opus):** run the **Review checklist**; loop on any failure.
4. **Gate:** `npm test` + `npm run lint` clean **and** the phase's acceptance demonstrated, before advancing.

Sequence: **M0 → M1 → M2 → M3 → M4 → M5.**

---

## M0 — Tune `$P` from data (Step 1)

**Objective.** Before adding anything, extract the best accuracy the *current* recognizer can give, and record the number ML must beat. Turn the by-feel knobs into data-driven values.

**Files.** No code changes to `recognizer.js`. Possibly edits to [data/rules.json](../../../data/rules.json) `recognition` (the tuned values). Uses the existing [`tools/recognizer-accuracy.mjs`](../../../tools/recognizer-accuracy.mjs) (`npm run bench:accuracy`).

**Design.**
- Run `npm run bench:accuracy` to get the current synthetic top-1/top-3 per role + overall (the B0 number).
- Use the harness's B2 calibration sweep to set `confidenceMinPct` (smallest cutoff at the chosen accuracy bar), and B3 to confirm `prefilterK`. Probe `rotationSteps` (the sign sweep) for a top-1 vs speed trade.
- Record the **frozen baseline** (numbers + the exact `rules.json` values) in the phase report — this is M5's comparison point.

**Acceptance.** A recorded baseline table (top-1/top-3, per role) and any `rules.json` changes justified by a harness delta (not a guess). **Effort: S.**

**Subagent brief.** "Run `npm run bench:accuracy` and its calibration (B2) / prefilter (B3) modes. Report current top-1/top-3 per role + overall. Propose `confidenceMinPct`/`prefilterK`/`rotationSteps` values *only* where the harness shows an accuracy improvement (no regressions); apply them to `data/rules.json`. Do NOT modify `recognizer.js`. Report the before/after table."

**Review checklist.** No `recognizer.js` edits · every `rules.json` change backed by a harness number · baseline recorded for M5 · `npm test`/`npm run lint` clean. **Effort: S.**

---

## M1 — Engine seam: `embed()` interface + `recognition.engine` flag + dispatcher (Step 2)

**Objective.** Build the reversible plumbing that lets the app run `"p"` or `"ml"` behind one config flag, with `$P` implementing the new interface and **no ML present yet**. This is the architectural keystone; everything else plugs in here.

**Files.** New: `src/draw/recognizerEngine.js` (dispatcher), `src/draw/embed.js` (the interface + the `$P` geometric implementation). Modified: [data/rules.json](../../../data/rules.json) (`recognition.engine: "p"`), [src/studio/useRecognizerWorker.js](../../../src/studio/useRecognizerWorker.js) + [src/draw/recognizerWorker.js](../../../src/draw/recognizerWorker.js) (route through the dispatcher).

**Design.**
- **The contract.** Define `embed(strokeGroup, opts) → Float32Array` and `recognizeFromEmbedding(vec, prototypes) → ranked [{name, role, score, confidence}]`. The dispatcher `recognize(candidates, opts)` returns the same shape `analyzeStrokes` already emits per group, so [drawingModel.js:290](../../../src/studio/drawingModel.js#L290) and the worker are untouched.
- **`$P` as an engine.** The `"p"` engine implements `embed()` by returning the normalized $P point-cloud (the existing `makeCloud` output, flattened) and `recognizeFromEmbedding` by delegating to `recognize()` ([recognizer.js:164](../../../src/draw/recognizer.js#L164)). This proves the seam is engine-agnostic *without writing any ML* — the existing behavior is now reachable through the interface.
- **Dispatcher.** `recognizerEngine.js` reads `recognition.engine` (default `"p"`); for `"ml"` it `await import()`s `mlRecognizer.js` (lazy, so the onnx bundle never loads for `"p"` users — added in M4). Async always; the `"p"` path resolves synchronously wrapped in a Promise (mirrors the sibling PR's dispatcher and our worker's existing Promise contract).
- **Purity.** `embed.js`'s `$P` path imports only from the pure `recognizer.js` — it stays pure and Node-testable. The ML path is a separate impure module loaded only on demand.
- **Worker routing.** The worker keeps doing `$P` for `"p"`. The ML engine will run on the **main thread inside an idle callback** or its own worker in M4 (onnxruntime-web manages its own wasm worker); decide and document there. M1 only adds the branch point.

**Acceptance.** With `engine: "p"`, Detect and admin behave **identically** to today (byte-identical compositions on a fixed input). Flipping `engine: "ml"` throws a clear "ml engine not built yet" until M4. `node --test` green (purity intact). **Effort: M.**

**Subagent brief.** "Add `src/draw/recognizerEngine.js` (a dispatcher reading `recognition.engine`, default `'p'`, async, lazy-importing the ml engine) and `src/draw/embed.js` defining `embed(strokeGroup,opts)→Float32Array` + `recognizeFromEmbedding(vec,prototypes)`, with a `'p'` implementation that delegates to the pure `recognize()`/`makeCloud`. Route `useRecognizerWorker.js`/`recognizerWorker.js` through the dispatcher. Add `recognition.engine:'p'` to `rules.json`. Keep `recognizer.js` PURE. With `engine:'p'`, output must be identical to current; `engine:'ml'` may throw 'not built yet'. Run `node --test` and confirm identical compositions on a sample input."

**Review checklist.** `recognizer.js`/`embed.js`(`p` path) stay pure (no JSON/onnx) · `engine:'p'` output byte-identical to pre-change · dispatcher lazy-imports ml · worker/call sites unchanged in shape · `node --test`/`lint` clean. **Effort: M.**

---

## M2 — Dual live-guess in admin Training (Step 3)

**Objective.** A side-by-side `$P` vs ML guess as you draw, in [TrainingView.jsx](src/admin/TrainingView.jsx) — the in-app version of the sibling PR's `siameseRecognizerLab.html`, and the surface where M5's decision is *felt* before it's measured.

**Files.** [src/admin/TrainingView.jsx](../../../src/admin/TrainingView.jsx) (extend the existing live-guess panel), `src/admin/admin.css`.

**Design.**
- The page already computes `liveGuess` via `rankOverRotations` ([TrainingView.jsx:76](../../../src/admin/TrainingView.jsx#L76)) and renders a "Live guess" block ([:320](../../../src/admin/TrainingView.jsx#L320)). Refactor to compute **two** rankings through the dispatcher: one with `engine:'p'`, one with `engine:'ml'`.
- Render two columns ("$P" / "ML") with top-3 each + confidence. The ML column shows a graceful "ML engine not available" placeholder until M4 ships (and whenever onnx fails to load) — never blocks the page.
- ML inference is async + heavier: debounce it (the page redraws constantly) and key it so stale results are dropped, exactly like `useRecognizerWorker`'s `reqId` discipline.

**Acceptance.** Drawing a glyph shows both columns updating; with ML unbuilt/unavailable the ML column degrades cleanly and `$P` is unaffected. **Effort: M.**

**Subagent brief.** "In `src/admin/TrainingView.jsx`, extend the live-guess UI to two columns: `$P` (existing `rankOverRotations`) and `ML` (via the `recognizerEngine` dispatcher with `engine:'ml'`). Debounce the ML call and drop stale results (reqId pattern). The ML column must degrade to a clear placeholder when the engine is unavailable, never breaking the page or the `$P` column. Report a screenshot of both columns."

**Review checklist.** `$P` column unchanged · ML column async, debounced, stale-dropped · graceful placeholder when ML absent · no main-thread jank while drawing. **Effort: M.**

---

## M3 — Python encoder bake (Step 5; prerequisite for M4)

**Objective.** Produce the trained "fingerprint maker" — a siamese encoder exported to `model.onnx` — as a **dev-only, run-rarely** Python step that lives entirely outside the npm build.

**Files.** New `ml/` folder (Python): `train.py`/`finetune.py` (siamese encoder, Omniglot base + our dictionary), `export_onnx.py`, `render_dataset.mjs` (Node, runs the **JS** rasterizer to emit training images — invariant #6), `pyproject.toml`, `README.md`. Output committed: `src/draw/ml-assets/model.onnx` + `model.meta.json` (input size, embedding dim, model version).

**Design.**
- **Dictionary source.** Render our **85 symbols** (33 sigils + 52 signs) from their canonical `svgPath` (the same paths the app draws) plus stroke-style augmentation, *via the JS rasterizer run in Node* (`render_dataset.mjs`). Python trains on those PNGs — one rasterizer, no parity test.
- **Architecture.** Small CNN, metric-trained (contrastive/triplet) on Omniglot (general shape sense), then fine-tuned on our rendered dictionary. (The sibling PR shows base-only ≈63%, fine-tuned ≈99% synthetic — fine-tuning on *our* dictionary is mandatory; their model is unusable for us, different dictionary.)
- **Export + sanity.** `export_onnx.py` verifies torch↔onnx output parity and prints the prototype-vs-prototype cosine separation (a class-confusability sanity check) before committing.
- **Footprint discipline.** `ml/` is never imported by the app, tests, or CI. `npm install`/`npm run build` must succeed with **no Python present**. The committed `.onnx` is a few MB binary (note Git LFS if it grows).

**Acceptance.** `model.onnx` + `model.meta.json` committed; `ml/README.md` documents `render dataset → train → fine-tune → export`; building/running the app needs no Python. The export's cosine-separation report shows distinct per-symbol clusters. **Effort: L (mostly one-time).**

**Subagent brief.** "Create a dev-only `ml/` Python project: a siamese encoder trained on Omniglot then fine-tuned on our 85-symbol dictionary, where the training images are produced by running the JS `glyphRasterizer` in Node (`render_dataset.mjs`) from each symbol's `svgPath` — one rasterizer only. Add `export_onnx.py` (verifies torch↔onnx parity, prints prototype cosine separation) emitting `src/draw/ml-assets/model.onnx` + `model.meta.json`. The app/tests/CI must build with no Python. Document the workflow. Report the export parity + separation numbers." *(Note: glyphRasterizer.js is delivered in M4; M3 and M4's rasterizer must be built together or M4's rasterizer landed first.)*

**Review checklist.** `ml/` never imported by app/tests · `npm run build` works without Python · single rasterizer (JS, run in Node for training) · onnx parity verified · meta records input size + embedding dim + version · model committed (LFS noted if large). **Effort: L.**

---

## M4 — JS ML engine: rasterizer + onnx inference + Supabase prototypes (Step 4)

**Objective.** The working ML recognizer: strokes → image → embedding (onnxruntime-web) → cosine match against **per-symbol prototypes stored in Supabase**, fed by the correction flywheel with **no retraining**.

**Files.** New: `src/draw/glyphRasterizer.js` (pure-ish: strokes → grayscale buffer; no DOM/canvas, deterministic — also used by M3's Node renderer), `src/draw/mlRecognizer.js` (onnx session + cosine + status mapping). Modified: [vite.config.js](../../../vite.config.js) (lazy chunk + asset handling for `model.onnx`), new `supabase/migrations/*_symbol_prototypes.sql`, [src/data-services/samples.js](../../../src/data-services/samples.js) (read/write prototypes). Adds dep `onnxruntime-web`.

**Design.**
- **Rasterizer (one, in JS).** Fit strokes to a unit box → stamp → downsample to the model input size. Pure deterministic integer/float math (no canvas AA), so the M3 Node renderer and the browser produce the same pixels by construction.
- **Inference.** Lazy-load `onnxruntime-web` + `model.onnx` (Vite `?url`, base-path-safe). **`numThreads = 1`** (GitHub Pages sends no COOP/COEP, so multi-thread wasm hangs — the sibling PR's documented trap). Embed each candidate at a rotation set (signs only; sigils upright, mirroring our `$P` role-aware sweep), keep best cosine. Softmax-with-temperature → confidence; ambiguity-gap + `confidenceMinPct` → `valid`/`ambiguous`/`unknown` (reuse the existing gate semantics so UI/engine/harness agree).
- **Prototypes in Supabase (the flywheel).** New `symbol_prototypes` table: `symbol_id`, `embedding` (plain `jsonb`/`float[]`, ~64–128 numbers), `model_version`, `updated_at`. **Computed client-side in admin** (M2 already loads onnx there): on verify/correct of a sample, re-embed → upsert the symbol's prototype. **Do NOT add pgvector** (85 symbols × cosine in JS is trivial; revisit only if M-future does fuzzy whole-spell vector search). Prototypes load via the existing overlay pattern ([symbolStore.js](../../../src/engine/symbolStore.js)/[samples.js](../../../src/data-services/samples.js)); degrade to a bundled `prototypes.json` fallback when Supabase is absent (mirrors `hasSupabase()`).
- **Where it runs.** onnxruntime-web spins its own wasm worker; call it from the dispatcher off the render path (idle callback / await). Keep Detect responsive; if latency is high, move the orchestration into `recognizerWorker.js`. Pre-warm the session while the user draws (the PR's `warmup` trick).
- **Wire M2's ML column** to this engine; wire the Studio Detect path through the dispatcher with `engine:'ml'`.

**Acceptance.** With `engine:'ml'`: Studio Detect and the admin ML column produce real recognitions; first use pays a one-time model load then is responsive; offline (no Supabase) falls back to bundled prototypes; `engine:'p'` users never download onnx (verified in the build chunk graph). **Effort: L.**

**Subagent brief.** "Add `src/draw/glyphRasterizer.js` (deterministic strokes→grayscale, no canvas) and `src/draw/mlRecognizer.js` (lazy onnxruntime-web session from `src/draw/ml-assets/model.onnx` via Vite `?url`, `numThreads=1`, role-aware rotation embed, cosine vs prototypes, softmax+gap+`confidenceMinPct` → status). Add a `symbol_prototypes` Supabase migration (`symbol_id`, `embedding` jsonb, `model_version`) + read/write in `samples.js`; compute/update prototypes client-side in admin on correction; bundled `prototypes.json` fallback when offline; NO pgvector. Lazy-chunk onnx in `vite.config.js` so `engine:'p'` never loads it. Wire M2's ML column + the Studio Detect dispatcher to it. Report: ML recognition working, `engine:'p'` bundle excludes onnx, offline fallback works."

**Review checklist.** Single rasterizer shared with M3 · onnx lazy-loaded, `numThreads=1`, base-path-safe URL · `engine:'p'` build excludes the onnx chunk · prototypes in Supabase, updated by the flywheel, offline fallback present, **no pgvector** · gate semantics reuse `confidencePct`/`confidenceMinPct` · purity of `recognizer.js` intact · Detect stays responsive (pre-warm). **Effort: L.**

---

## M5 — Gate & adopt via the accuracy harness (Step 6)

**Objective.** Decide `"p"` vs `"ml"` on the scoreboard, not on faith. Make the harness engine-aware and compare on *our* data; flip the default only on a real, no-regression win.

**Files.** [`tools/recognizer-accuracy.mjs`](../../../tools/recognizer-accuracy.mjs) (`--engine=p|ml`), optionally `test/recognizer-accuracy.test.js` (floor smoke), [data/rules.json](../../../data/rules.json) (`engine` default — only if ML wins).

**Design.**
- Add `--engine` to the harness so the **same** synthetic dataset + metrics run through either engine (ML path uses `mlRecognizer` + the bundled/exported prototypes; document that ML in Node needs the onnx runtime — gate behind availability, no-op with a message if absent, like the `--source=db` path).
- Compare **tuned `$P` (M0 baseline)** vs **ML** on top-1/top-3 per role, the confusion list, and the confidence-calibration curve. ML wins only if top-1 is **≥** baseline with **no role regressing** and calibration is at least as good.
- **Caveat (loud, in output):** synthetic accuracy over-states real accuracy for *both* engines (test items are perturbed copies of present templates). The honest comparison is **relative**; confirm any flip against real drawings via M2's dual guess before committing. State this in the report.
- If ML wins: flip `recognition.engine` default to `"ml"` and add a floor smoke (`test/recognizer-accuracy.test.js`) so a future regression in *either* engine fails CI. If not: keep `"p"`, leave ML opt-in, record why.

**Acceptance.** `npm run bench:accuracy -- --engine=ml` runs (or no-ops cleanly without the runtime) and prints a `$P`-vs-ML comparison; a documented decision recorded; default flipped **only** on a no-regression win. **Effort: M.**

**Subagent brief.** "Add `--engine=p|ml` to `tools/recognizer-accuracy.mjs`, running the same synthetic dataset/metrics through either engine (ML via `mlRecognizer` + exported prototypes; no-op with a message if the onnx runtime is unavailable in Node). Print a `$P`-vs-ML top-1/top-3 + confusion + calibration comparison, with the synthetic-overstatement caveat. Recommend a default only if ML's top-1 ≥ baseline with no role regressing. Do NOT modify `recognizer.js`. Report the comparison table + recommendation."

**Review checklist.** Same dataset/metrics both engines · ML path graceful when runtime absent · win criterion = no-regression top-1 + calibration · synthetic caveat printed · default flipped only on a real win · floor smoke added if adopted. **Effort: M.**

---

## Infra impact (project structure · processing · storage · deploy)

How each area changes (the four concerns to keep honest while building):

- **Project structure.** *Additive, isolated.* New impure JS modules (`recognizerEngine`/`embed`/`mlRecognizer`/`glyphRasterizer`) + a dev-only `ml/` Python folder + a committed `model.onnx`. **Hard rule:** none of these may be imported by the pure `recognizer.js`/`geometry.js`/`deduce.js`, or `node --test` breaks (same reason JSON imports are banned there). ML reaches the pipeline only through the dispatcher.
- **Processing.** Training = dev-only Python, rare. Prototype-building = client-side in admin, occasional. **Inference = in-browser wasm** on every ML Detect: rasterize → embed at N rotations → cosine. Heavier than `$P`'s point-math but small; keep it off the render path, pre-warm the session, single-thread the wasm. `engine:'p'` users pay **zero** new cost (lazy chunk).
- **Storage (Supabase).** One small vector per symbol (~hundreds of KB total for 85). A `symbol_prototypes` migration with a plain `jsonb`/`float[]` embedding column — **no pgvector**. Slots into the existing overlay + correction flywheel: a fix updates a prototype, no retraining.
- **Deploy / infra.** Static GitHub Pages is preserved (no backend compute). Inherited, well-mapped gotchas: lazy-load the big onnxruntime-web wasm (Vite chunk, CDN); `numThreads=1` (no COOP/COEP on Pages); resolve `model.onnx` through Vite's base-path-aware `?url`; keep Python out of `npm`/CI; watch the committed binary's git weight (LFS if it grows).

---

## Risks & notes

- **ML only labels leaves.** This spec deliberately does **not** ML the structure (rings/nesting/linking/full-spell). If a future goal is fuzzy *whole-spell* similarity, build it as a **v2** on the same primitive — aggregate symbol embeddings + structure features into a spell-level vector — and only *then* consider pgvector. Don't pre-build it here.
- **Their model ≠ our model.** The sibling `model.onnx` was fine-tuned on ~8 symbols; ours covers 85. We reuse the *architecture and method*, not their weights — M3 is mandatory.
- **Synthetic ≠ real (both engines).** The harness over-states accuracy for `$P` and ML alike. M5's number is a *relative* A/B; M2's dual guess on real messy drawings is the human check before any default flip.
- **Train/serve skew is designed out, not patched.** One JS rasterizer, used in Node for training data and in the browser for queries (invariant #6) — we avoid the sibling PR's two-rasterizer parity burden rather than guarding it with a test.
- **Reversibility is the safety net.** Every phase keeps `$P` the default and the change behind a flag; if ML underperforms or the wasm/deploy cost isn't worth it, M5 simply leaves `engine:'p'` and the ML stays an opt-in lab tool. Nothing is one-way until a measured win says so.
- **Purity is the guardrail (again).** As with the accuracy/perf specs, the one hard, non-negotiable rule is that the pure recognizer trio stays JSON/DOM/onnx/Worker-free. All ML weight lives behind the dispatcher.

---

## Phase log

### M0 — done (Step 1) · tuned `$P`, frozen baseline

**Frozen baseline `$P` (the number ML must beat in M5)** — `tools/recognizer-accuracy.mjs`, seed=1, perN=5, with the tuned `rotationSteps=36`:

| role | items | top-1 | top-3 |
|------|------|-------|-------|
| sign | 180 | **97.8%** | 100.0% |
| sigil | 130 | **96.2%** | 99.2% |
| overall | 310 | **97.1%** | 99.7% |

ML adoption criterion (M5): top-1 ≥ these per role, **no role regressing**.

**Knob decisions:**
- `rotationSteps` **24 → 36** (the only change). Harness: sign top-1 96.1%→97.8% (+1.7pp), overall 96.1%→97.1% (+1.0pp), sign top-3→100%; sigils unaffected (no sweep). 48 gives identical numbers, so 36 is the minimum sufficient. **Latency cost measured** (`recognizer-bench.mjs`, P1+P2+P3 hot path): +42% at M=150 (153→218 ms), +32% at M=400 (186→244 ms). Accepted: rotation coverage is a *principled* robustness gain for arbitrarily-angled signs (not a synthetic overfit), the path is in a web worker (non-blocking), and it stays sub-250 ms even at 400 templates. **If the template set grows large enough to make the hot path uncomfortable, `rotationSteps` is the first knob to reconsider.**
- `confidenceMinPct` **left at 30.** B2 recommends 0 because the gate never fires on synthetic data (coverage 100% at every cutoff ≤50). 30 is a live-UX safety net for noisy real strokes; no harness delta justifies changing it.
- `prefilterK` **left at 15.** B3: no K in 5–30 reaches zero drop under perturbation (coarse 8-point pre-filter is the noise bottleneck); the drop is a labelled stress-test artifact, not a prod defect. Changing it needs B4 real-data evidence.

Gates: `npm test` (506, clean) · `npm run lint` (0 errors) · `recognizer.js` untouched · `rules.json` diff = 1 line.

### M1 — done (Step 2) · engine seam + flag + dispatcher

New: `src/draw/recognizerEngine.js` (async dispatcher, `engine` default `"p"`, lazy-imports `mlRecognizer.js` on the `"ml"` branch only — Node-safe), `src/draw/embed.js` (PURE: `embed(group,opts)→Float32Array` + `recognizeFromEmbedding(vec,prototypes)`, `$P` impl over `makeCloud`/`recognize`), `test/embed.test.js` (20 tests; proves the `$P` interface reproduces `recognize()` top-1 on real seed templates + dispatcher routing). Modified: `data/rules.json` (`recognition.engine:"p"`), `src/studio/useRecognizerWorker.js` (+15 lines: guarded `engine !== 'p'` early-return through the dispatcher).

**Design refinement (vs the spec's M1 idea):** our `analyzeStrokes` *fuses* structure+identity+assembly in one sync call, so the seam went at the **hook boundary only** — not inside the pure recognizer, and not in the worker. `engine:"p"` keeps the `$P` worker path 100% unchanged (the new block is skipped by the guard); `engine:"ml"` is handled by the dispatcher *before* the worker is involved, because the ML engine runs its own onnx wasm worker (our `recognizerWorker.js` stays a `$P`-only cloud-cache optimization). Recorded for M4.

Gates: `node --test` **526/526** (506 + 20 new) · `npm run lint` 0 errors · `recognizer.js`/`geometry.js`/`deduce.js` **untouched** (git-verified) · `rules.json` clean targeted edits · `engine:"ml"` → clear `Error('ml recognizer engine not built yet (Phase M4)')`.

### M2 — done (Step 3) · dual live-guess in admin Training

Modified: `src/admin/TrainingView.jsx` (+139/-15: two-column "$P" vs "ML" live-guess panel) + `src/admin/admin.css` (+45: `.admin-ab-*` two-column layout, stacks under 400px). The `$P` column is behaviorally identical (same `rankOverRotations`, now guarded by `if (clouds.length)`). The **ML column** calls `recognizeWithEngine({ strokes, opts:{engine:'ml'}, runP })` on a **200ms debounce** with a **monotonic `mlReqId` stale-drop** (mirrors `useRecognizerWorker`); states `idle | pending | ready | unavailable`. Until M4 it always lands on `unavailable` → calm dim note "ML engine ships in M4" (never a red error, never a thrown render). **M4-readiness contract** documented inline: when `mlRecognizer.js` resolves `[{name, score, confidence?}]` best-first, the `ready` branch renders it with no further UI change.

Gates: `npm test` 526/526 · `npm run lint` 0 errors · pure + seam modules (`recognizer.js`/`recognizerEngine.js`/`embed.js`/`geometry.js`/`deduce.js`) **untouched** (git-verified) · `$P` column output unchanged.

### M3 — done (Step 5) · siamese encoder baked → ONNX

Env: dev-only `ml/` (uv, Python 3.12, torch 2.5.1+cu121, GPU-verified on RTX 2060 SUPER). New: `src/draw/glyphRasterizer.js` (PURE, shared by Node training + M4 browser inference — invariant #6; +9 `node --test`), `src/draw/mlRecognizer.js` (M4 stub: throws the dispatcher's "not built yet" so `npm run build` resolves the M1 dynamic import — **this fixed a build break M1 review missed**), `ml/render_dataset.mjs` (Node, rasterizes seed templates → augmented labeled images), `ml/{model/siam_net.py,train.py,finetune.py,export_onnx.py,build_prototypes.py,README.md}`, `ml/dashboard.py` (live GPU/CPU/log monitor, `py ml/dashboard.py` → :8799). Modified: `.gitignore` + `eslint.config.js` (ignore `ml/` artifacts; Node globals for `ml/*.mjs`). Committed artifacts: `src/draw/ml-assets/{model.onnx (974 KB), model.meta.json, prototypes.json}`.

**Full bake:** 248,864-param encoder, 64-dim embedding, 32×32 input. Omniglot pretrain 5000 steps (loss 0.335→0.140) → dictionary fine-tune 3000 steps (loss 0.217→0.023) → **held-out synthetic top-1 100.0%** (1550 samples). ONNX parity max diff **1.19e-7**. Prototype mean inter-class cosine **0.0355** (smoke was 0.948 — real separation); top confusers stop↔wind_underfoot, eye↔repetition, column↔direction (overlap `$P`'s M0 confusions). Coverage **62/85** symbols (23 get prototypes from real samples via the M4 flywheel).

Caveat: synthetic top-1 overstates real accuracy (held-out augmented renders of present templates) — the real verdict is M5's A/B vs the M0 baseline; M2's dual-guess is the real-drawing feel. Full-bake reproduce commands in `ml/README.md`.

Gates: `npm run build` works **with no Python** · `npm test` 535/535 (526 + 9 rasterizer) · `npm run lint` 0 errors · app/seam modules untouched (git-verified) · `ml/` never imported by app/tests/CI.

### M4a — done (Step 4, part 1) · onnx inference core + real ML guess in admin

Dep: `onnxruntime-web@^1.26.0`. New code in `src/draw/mlRecognizer.js` (replaced the stub): lazy singleton runtime (`numThreads=1` for the GitHub-Pages COOP/COEP trap, CDN wasm paths, `model.onnx?url`, bundled `prototypes.json` — Supabase comes in M4b), exporting `warmupMl`, `embedStrokes`, `rankWithMl` (single-symbol ranker → `[{name,role,score,cosine}]`), `recognizeWithMl({strokes,opts,runP})` (full pipeline: `$P` structure via `runP` → ML relabels leaves → `buildComposition` rebuild for single-ring; multi-ring relabels groups in place + `_mlNote`, full rebuild deferred to M4b). `recognizerEngine.js` now forwards `runP` to the ml branch. `vite.config.js`: `assetsInclude:['**/*.onnx']` + `optimizeDeps.exclude:['onnxruntime-web']`. `src/admin/TrainingView.jsx` ML column now lazy-imports `rankWithMl` for **real predictions** (debounce + `mlReqId` stale-drop kept; graceful `unavailable` on onnx failure).

**Build chunk proof (the key invariant):** entry `index-*.js` contains no `ort`; `onnxruntime-web` (405 kB), `mlRecognizer` (6 kB), `prototypes` (80 kB), `model.onnx` (997 kB) are **separate lazy chunks** — `engine:"p"` users download none. Node smoke: onnx session loads, ranks a seed stroke (→ `diamond`, cosine 0.83) end-to-end.

Gates: `npm test` 535/535 · `npm run lint` 0 errors · `npm run build` succeeds · onnx imported only via `await import()` (never module-eval) · pure modules (`recognizer.js`/`glyphRasterizer.js`/`embed.js`) untouched (git-verified).

### M4b — done (Step 4, part 2) · Supabase prototypes + flywheel + Studio + multi-ring

New: migration `supabase/migrations/20260611000000_symbol_prototypes.sql` (`symbol_prototypes`: PK `(symbol_id, model_version)`, `embedding jsonb`, `updated_at/by`; **public read + admin-write** RLS via `is_admin()`, mirrors init.sql; **no pgvector**; rollback note). `src/data-services/prototypes.js`: `loadPrototypes(modelVersion)`, `upsertPrototype(...)`, `rebuildPrototypeForSymbol(symbol_id, { embedFn, modelVersion, verifiedOnly })` — the **flywheel** (fetch a symbol's samples → injected `embedFn` → mean-pool + L2-norm → upsert; `embedFn` injected to stay onnx-decoupled). `mlRecognizer.js` runtime now loads prototypes **Supabase-first, bundled-`prototypes.json` fallback**, keyed by `model_version` from `model.meta.json`. `TrainingView.jsx`: on `addSample` success, fire-and-forget prototype rebuild for the trained symbol (best-effort, non-blocking, calm status). `StudioPage.jsx`: `warmupMl()` on mount when `recognition.engine==='ml'`. **Multi-ring composition** now fully rebuilt for ML.

**Review fix (Opus):** the subagent had *duplicated* the multi-ring assembler into `mlRecognizer.js` to avoid touching the pure module. Replaced with a purity-safe **`export` of the existing pure `buildMultiRingComposition`** in `recognizer.js` (one-word diff, no behavior change, no new imports) — single source of truth, so ML and `$P` compositions differ only in leaf identity (critical for M5's A/B validity). `recognizer.js` is thus touched once, purely to export.

Graceful degradation: no Supabase → bundled prototypes still rank, flywheel no-ops (`hasSupabase()` pattern throughout). Gates: `npm test` 535/535 · `npm run lint` 0 errors · `npm run build` 5.74s · onnx/Supabase still behind the lazy ML runtime (`engine:"p"` unaffected) · migration not applied to any hosted DB (file only). Not yet tested against a live Supabase stack — verify on next `npx supabase start`.

### M5 — done (Step 6) · A/B gate → `$P` stays default

`tools/recognizer-accuracy.mjs` gains `--engine=p|ml|ab`. **Shared-logic design:** `mlRecognizer.js` refactored to export `rankWithMlRuntime(runtime, strokes, opts)` (the pure scoring core: rasterize→embed→best-cosine-over-rotations→softmax→rank); `rankWithMl` is now a thin wrapper (browser runtime), and the harness builds a **Node runtime** (`readFileSync` model + `file://` wasm) and calls the SAME core — no ranking math duplicated (verified: `rankWithMlRuntime` single source, imported by the harness). New `test/recognizer-accuracy.test.js` floor smoke (factored pure `runSyntheticAccuracy({seed,perN,engine})`; a 4th test proves the floor catches a broken config).

**A/B result (seed=1, perN=5; stable at seeds 42/99):**

| role | items | `$P` top-1 | ML top-1 | Δ |
|------|------|-----------|----------|----|
| sign | 180 | **97.8%** | 77.2% | −20.6pp |
| sigil | 130 | **96.2%** | 90.0% | −6.2pp |
| overall | 310 | **97.1%** | 82.6% | −14.5pp |

Win criterion (ML ≥ M0 baseline, no role regressing): **FAIL on every role.** **Decision: `recognition.engine` stays `"p"`. No flip.** ML remains a working, opt-in engine (real guesses live in the M2 admin dual-guess + Studio when flag-enabled).

**Why ML lost — and why this isn't the final word:** the synthetic protocol *structurally favours `$P`* — a test item is a perturbed copy of a template that is **present** in the `$P` pool (near-trivial nearest-neighbour), whereas ML matches it against an **averaged** prototype embedding (genuine generalization, harder). Per §Risks "synthetic ≠ real / don't overfit to synthetic", this synthetic A/B is a *relative* guard, not a verdict on real drawings. The fair next test is **M2's dual-guess on real messy input**; a re-bake aligned to point-cloud inputs (vs the current augmented renders) is the likely lever. The safe default (`$P`) holds until ML earns the flip on a real-data measure.

Gates: `npm test` 536/536 · `npm run lint` 0 errors · `npm run build` 5.00s (onnx still lazy-chunked) · pure modules untouched apart from the M4b `export` · `engine="p"`.

---

## Outcome (M0–M5 complete)

All six phases shipped behind the `recognition.engine` flag with **`$P` as the default**. Delivered: tuned `$P` + frozen baseline (M0); reversible engine seam + dispatcher (M1); admin dual-guess lab (M2); a baked siamese ONNX encoder + dev-only `ml/` toolchain (M3); real in-browser onnx inference, lazy-chunked, with Supabase prototypes + correction flywheel (M4a/b); and a data-driven A/B gate (M5). **The ML engine works end-to-end but did not beat `$P` on the (P-favouring) synthetic benchmark, so it stays opt-in.** Open follow-ups: validate ML on real drawings via the dual-guess; consider a point-cloud-aligned re-bake; apply the `symbol_prototypes` migration on a live stack; close the 23/85 prototype-coverage gap via the flywheel. Nothing is committed.
