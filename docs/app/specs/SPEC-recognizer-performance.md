# SPEC — Recognizer performance (no-freeze Detect)

> Status: **implemented (P0–P4)** · Scope: **make `Detect` / auto-analyze fast and non-blocking** · Branch: `feat/spell-studio-experiments`
> **Outcome:** the four phases shipped together. Tests **485 pass / 0 fail** (+25 over baseline), `npm run lint`
> 0 errors, `npm run build` emits the worker chunk (`dist/assets/recognizerWorker-*.js`). `recognizer.js`
> stays pure (no Worker/DOM). Accuracy unchanged — top-1 equivalence tests (incl. 6 rotations) gate P2/P3.
> **Bench (M=400, 15 iter):** `analyzeStrokes` median ~2476ms (rebuild) → **~208ms** with P1+P2+P3 (≈12× less
> work; P2 ~43% off the full-list path, P3 the big drop via coarse pre-filter to top-K). P4 then moves that
> off the main thread (no UI freeze). Pre-filter K: smallest safe = 13 (sign pool, 36 templates, all
> rotations) → `prefilterK` set to **15** (13 + 2 margin). As the training set grows, the careful sweep stays
> ~constant (always top-K); only the cheap coarse pass scales with template count.
> Cross-refs: [SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) (training flywheel — grows the
> template set this spec must scale with), [IMPROVEMENTS.md](../IMPROVEMENTS.md).
> Touch points: [`src/draw/recognizer.js`](../../../src/draw/recognizer.js) (the `$P` pipeline, **pure**),
> [`src/studio/StudioPage.jsx`](../../../src/studio/StudioPage.jsx) (`runRecognition`/`handleDetect`/auto-analyze),
> [`src/studio/useTemplates.js`](../../../src/studio/useTemplates.js) (template source).

This spec covers four performance items, in the order they should be built:

| Phase | Idea (from the perf review) | What it does | Kind |
|------|------------------------------|--------------|------|
| **P1** | **#2 Cloud caching** | build template clouds once, not every call | pure, testable |
| **P2** | **#3 Role-split clouds** | a core matches only sigils, a sign only signs | pure, testable |
| **P3** | **#4 Cheap pre-filter** | coarse descriptor → full match on top-K only | pure, testable |
| **P4** | **#1 Web Worker** | run recognition off the main thread (kills the freeze) | browser glue |

> **Why this order, not 1→4.** P1–P3 are pure algorithmic changes to `recognizer.js` that *reduce* the
> work and are covered by `node --test`. P4 then moves the now-leaner work off the main thread. Doing the
> worker last means it wraps a smaller, role-split, pre-filtered pipeline — and each earlier phase ships
> value on its own (the freeze shortens at every step before P4 removes it entirely).

---

## 0. The problem (what every phase is measured against)

`handleDetect → runRecognition → analyzeStrokes` runs **synchronously on the main thread**
([StudioPage.jsx:325](../../../src/studio/StudioPage.jsx#L325)), so the UI cannot paint until it returns
— the split-second freeze. Auto-analyze fires the same call on every drawing change.

Cost inside `analyzeStrokes`:
1. **Clouds rebuilt every call** — `clouds = templates.map(makeCloud)` ([recognizer.js:428](../../../src/draw/recognizer.js#L428)).
   `templates` grows with the DB training overlay ([useTemplates.js:32](../../../src/studio/useTemplates.js#L32)).
2. **Rotation sweep × all templates** (dominant) — per drawn group: `rotationSteps` (24) rotations
   ([:421](../../../src/draw/recognizer.js#L421)), each comparing against **every** cloud via `greedyMatch`
   → `cloudDistance` (O(N²), N=`NUM_POINTS`=32). Total ≈ `groups × 24 × templates × N² × starts`.
3. **No role gating** — `recognize` compares every group against every cloud regardless of role
   ([:90](../../../src/draw/recognizer.js#L90)).

### Invariants every phase keeps

1. **`recognizer.js` stays PURE** — no JSON, no DOM, no `Worker` reference. It must keep running under
   `node --test`. The worker (P4) is a thin shell *around* it, in separate files.
2. **Back-compat of `analyzeStrokes(strokes, templates, opts)`** — existing callers and tests keep
   working. New inputs (prebuilt clouds) arrive via `opts`, never by changing the positional signature.
3. **No accuracy regression** — for the seed template set, the **top-1 match** of every drawn sample
   must be **identical** before/after P2 and P3 (pre-filter/role-split are speedups, not re-rankings).
   This is an explicit test, not a hope.
4. **Graceful degradation** — P4 must fall back to the synchronous path when `Worker` is unavailable
   (SSR, old webview, tests), so behavior is identical, just blocking.

---

## Development loop protocol (per phase)

1. **Plan (Opus):** confirm the signature/data-shape/acceptance tests in this spec.
2. **Develop (subagent):** hand the subagent the phase's **Subagent brief** verbatim + the files.
   Implement + run the listed tests/benchmark and report numbers.
3. **Review (Opus):** run the **Review checklist**; loop on any failure.
4. **Gate:** `npm test` + `npm run lint` clean, **and the benchmark shows the expected speedup**, before
   advancing.

Sequence: **P0 (benchmark) → P1 → P2 → P3 → P4.**

---

## P0 — Benchmark harness (prerequisite — you can't tune what you can't measure)

> **Status: ✅ shipped** — `tools/recognizer-bench.mjs` (loads the seed via `createRequire` since
> `seedTemplates.js` imports JSON Vite-style; `recognizer.js` imports purely). Prints median-ms per M.

**Objective.** A repeatable timing harness so every phase reports a real before/after number. There are
no browser unit tests, so this is how we prove the win.

**Files.** New: `tools/recognizer-bench.mjs` (Node, no deps). Optionally a `node --test` perf smoke that
asserts a generous ceiling so CI catches a regression.

**Design.**
- Generate a synthetic template set of size **M** (e.g. 50/150/400) by jittering the seed templates
  (`seedTemplates()`), to simulate a grown training flywheel.
- Build a fixed set of sample drawings (a Water Orb, a Pyreball-like, a single sigil) as raw strokes.
- Time `analyzeStrokes(sample, templates, opts)` over K iterations; print median ms per phase config.
- Print a small table: `M × {baseline, +P1, +P2, +P3}` ms.

**Acceptance.** `node tools/recognizer-bench.mjs` prints a median-ms table for M ∈ {50,150,400}.
**Effort: S.**

---

## P1 — Cloud caching (idea #2)

> **Status: ✅ shipped** — `buildClouds(templates)` added (pure, carries `role`); `analyzeStrokes` honors
> `opts.clouds` with a `buildClouds(templates)` fallback (signature unchanged). `StudioPage` memoizes
> `clouds` on `templates` identity and reuses it in `runRecognition` + `handleMerge`. Equivalence test green.

**Objective.** Build each template's `$P` cloud **once** and reuse it across detect calls, instead of
`templates.map(makeCloud)` on every call. Also the natural home for the descriptors P2/P3 need.

**Files.** `src/draw/recognizer.js` (new `buildClouds`, `analyzeStrokes` accepts `opts.clouds`),
`src/studio/StudioPage.jsx` (`useMemo` the clouds, pass them in).

**Design.**
- New pure export:
  ```js
  // Build the recognizer's cloud objects once. Pure; safe under node --test.
  // Returns: [{ name, role, weight, points:[{X,Y,ID}×NUM_POINTS] }]
  export function buildClouds(templates)
  ```
  (this is exactly today's `templates.map((t) => makeCloud(t.name, t.points, t.weight))`, but it also
  **carries `role`** through — needed by P2 — and later attaches descriptors — needed by P3).
- `makeCloud` keeps its signature; `buildClouds` is the cached, role-aware wrapper.
- `analyzeStrokes(strokes, templates, opts)`:
  - if `opts.clouds` is provided, use it directly (skip the internal `map`);
  - else fall back to `buildClouds(templates)` (back-compat).
- `StudioPage`: `const clouds = useMemo(() => buildClouds(templates), [templates])`; pass `clouds` in the
  `opts` of the `analyzeStrokes` call ([StudioPage.jsx:325](../../../src/studio/StudioPage.jsx#L325)).
  `mergeGroups`/`groupToTemplate` callers that build clouds inline can reuse `buildClouds` too.

**Acceptance / tests** (`test/recognizer*.test.js`):
- `buildClouds(templates)` returns one entry per template with `{name, role, weight, points.length===NUM_POINTS}`.
- `analyzeStrokes(s, templates)` and `analyzeStrokes(s, null, { clouds: buildClouds(templates) })` return
  **identical** groups/matches (back-compat + equivalence).
- Bench: with M=400, `+P1` median ms < baseline (the rebuild is gone from the hot path).

**Subagent brief.** "Add `buildClouds(templates)` to `src/draw/recognizer.js` (pure, carries `role`).
Make `analyzeStrokes` accept `opts.clouds` and skip the internal cloud build when present; keep the
`templates` fallback. Memoize clouds in `StudioPage.runRecognition` via `useMemo([templates])` and pass
them in. Add the equivalence test. Keep `recognizer.js` JSON/DOM-free. Run `node --test` +
`node tools/recognizer-bench.mjs`."

**Review checklist.** Pure module unchanged in purity · positional signature unchanged · equivalence test
green · clouds memoized (not rebuilt per keystroke) · bench shows the rebuild gone. **Effort: S.**

---

## P2 — Role-split clouds (idea #3)

> **Status: ✅ shipped** — `buildClouds` attaches `.sigil` (role `sigil`/`core`) and `.sign` pools once;
> `classifyAndRecognize` matches a core group against the sigil pool and a sign group against the sign pool,
> with empty-pool fallback to the full list. Benefits both single- and multi-ring paths. Top-1 equivalence +
> role-isolation tests green; ~43% faster than the full-list path.

**Objective.** Compare a **core** group only against **sigil** templates and a **sign** group only
against **sign** templates. Roughly halves comparisons *and* removes cross-role false matches.

**Files.** `src/draw/recognizer.js` (`buildClouds` partitions; `classifyAndRecognize` passes the right
subset).

**Design.**
- `buildClouds` returns the flat list **and** a partition, e.g. attach once:
  ```js
  clouds.sigil = clouds.filter((c) => c.role === 'sigil' || c.role === 'core')
  clouds.sign  = clouds.filter((c) => c.role === 'sign')
  ```
  (Computed once per template change, not per group.)
- In `classifyAndRecognize` ([:381](../../../src/draw/recognizer.js#L381)): pick the subset by group role —
  `const pool = g.role === 'core' ? clouds.sigil : clouds.sign` — and pass `pool` to
  `bestMatchOverRotations`.
- **Sign-as-sigil safety** (`vision`/`repetition`/`billowing` can be a core): if the chosen pool is
  **empty**, fall back to the full cloud list, so a missing role bucket never blanks out recognition.
  `recognizer.js` must stay JSON-free, so it relies only on the template `role` field — it does **not**
  import `canBeCore`. (If a sign-as-sigil template is only stored with `role:'sign'`, allowing `core` to
  also see the `sign` pool is a documented option; default is sigil-pool-with-full-fallback.)

**Acceptance / tests:**
- For the seed set, **top-1 match of every sample is unchanged** vs. P1 (the role split must not change
  the winner for in-pool symbols).
- A core group never returns a `role:'sign'`-only template (and vice-versa) unless the fallback fired.
- Bench: `+P2` median ms < `+P1` (fewer comparisons).

**Subagent brief.** "In `src/draw/recognizer.js`, partition `buildClouds` output into `.sigil`/`.sign`
pools (computed once). In `classifyAndRecognize`, match a `core` group against the sigil pool and a
`sign` group against the sign pool, falling back to the full list if the pool is empty. Add tests:
top-1 unchanged vs. full-list matching on the seed set; role isolation. Keep the module pure. Run
`node --test` + bench."

**Review checklist.** Pools computed once (not per group) · empty-pool fallback present · top-1
equivalence test green · bench improves · purity intact. **Effort: S–M.**

---

## P3 — Cheap pre-filter, full match on top-K (idea #4)

> **Status: ✅ shipped** — `buildClouds` precomputes an 8-point `coarse` cloud + `strokeCount` per template;
> pure `prefilter(inputCoarseByAngle, clouds, K)` ranks by coarse `greedyMatch` over 8 coarse angles
> (rotation-tolerant) and returns top-K. The group path pre-filters the role pool to top-K before the full
> 24-rotation sweep, skipping when `pool.length <= K`. `prefilterK`/`prefilterCoarsePoints` live in
> `data/rules.json` (K=15). Equivalence across 6 rotations green; the dominant speedup (≈12× at M=400).

**Objective.** Avoid the full 32-point, 24-rotation match against *every* in-pool template. Rank all
candidates with a **cheap descriptor** first, then run the expensive sweep only on the top-K.

**Files.** `src/draw/recognizer.js` (descriptors in `buildClouds`; a `prefilter` step inside the
group-matching path); `data/rules.json` (`recognition.prefilterK`, `recognition.prefilterCoarsePoints`).

**Design.**
- In `buildClouds`, precompute per cloud (once):
  - `coarse`: an **8-point** cloud (resampled from the same points) for a cheap `greedyMatch`.
  - `strokeCount`: number of distinct IDs (cheap structural hint).
- New pure helper:
  ```js
  // Rank `clouds` by a cheap coarse-cloud distance to `inputCoarse`, return the top-K clouds.
  // Rotation-tolerant: scores the input coarse cloud at a few coarse angles, keeps the best per cloud.
  export function prefilter(inputCoarseByAngle, clouds, K)
  ```
- Group path (in `classifyAndRecognize` / `bestMatchOverRotations`):
  1. Build the input's coarse cloud at a small angle set (e.g. 8 coarse rotations).
  2. `const top = prefilter(inputCoarse, pool, K)` (K from `rules.json`, default ~10).
  3. Run the existing full sweep **only over `top`**.
  - **Guard:** if `pool.length <= K`, skip the pre-filter (run the full sweep over the whole pool) — no
    point paying for it on small sets, and it guarantees no regression there.
- Configurable + safe: `prefilterK` large enough that the true winner is essentially always inside the
  top-K. Validate K against the equivalence test below; raise K if any sample's winner is excluded.

**Acceptance / tests:**
- **Equivalence on the seed set:** for every sample drawing, the top-1 with pre-filter == top-1 without.
  (Pick the smallest K that holds; record it as the default in `rules.json`.)
- `prefilter` returns ≤ K clouds and includes the eventual full-match winner for all seed samples.
- Pre-filter is skipped when `pool.length <= K`.
- Bench: `+P3` is the largest single drop as M grows (cost goes `× pool` → `× K`).

**Subagent brief.** "In `src/draw/recognizer.js`, precompute an 8-point `coarse` cloud + `strokeCount`
per template in `buildClouds`. Add a pure `prefilter(inputCoarse, clouds, K)` that ranks by coarse
`greedyMatch` (rotation-tolerant over a few coarse angles) and returns the top-K. In the group-matching
path, pre-filter the role pool to top-K before the full 24-rotation sweep; skip when `pool.length<=K`.
Add `recognition.prefilterK`/`prefilterCoarsePoints` to `rules.json`. Add the seed equivalence test and
pick the smallest safe K. Keep the module pure. Run `node --test` + bench."

**Review checklist.** Descriptors precomputed once · `prefilter` pure + ≤K + contains winner on seed ·
skip-guard for small pools · K data-driven in `rules.json` · top-1 equivalence green · bench shows the
biggest win at M=400 · purity intact. **Effort: M.**

---

## P4 — Web Worker offload (idea #1 — the actual freeze fix)

> **Status: ✅ shipped** — `src/draw/recognizerWorker.js` (thin shell + pure, unit-tested
> `handleWorkerMessage(state, msg)`; caches clouds by `templatesToken`, evicting old tokens) and
> `src/studio/useRecognizerWorker.js` (`recognizeAsync`, monotonic `reqId` stale-drop, sync fallback when
> `Worker` is absent + on `no-templates` cache-miss). `StudioPage` `runRecognition`/`handleDetect`/auto-analyze
> are async (auto-analyze drops superseded runs via a generation counter); `opts` no longer carries `clouds`,
> so nothing big is structured-cloned per call. `recognizer.js` stays pure; `npm run build` emits the worker
> chunk; protocol test green. Manual no-freeze/spinner/stale-drop/fallback cases added to TEST-PLAN §13.

**Objective.** Run `analyzeStrokes` in a Web Worker so the main thread never blocks. The existing `busy`
state can finally render a spinner (today it's set+cleared in one sync tick and never paints).

**Files.** New: `src/draw/recognizerWorker.js` (worker entry), `src/studio/useRecognizerWorker.js`
(client hook/service). Changed: `src/studio/StudioPage.jsx` (`handleDetect`/auto-analyze become async).
**Unchanged:** `recognizer.js` stays pure — the worker *imports* it.

**Design.**
- **Worker entry** (`recognizerWorker.js`): `import { analyzeStrokes, buildClouds } from './recognizer.js'`.
  Holds a **template/cloud cache** keyed by a `templatesToken` so clouds (incl. P3 descriptors) are built
  **once in the worker**, not shipped or rebuilt per keystroke. Messages:
  - `{type:'setTemplates', token, templates}` → `cache[token] = buildClouds(templates)`; drop old tokens.
  - `{type:'recognize', reqId, token, strokes, opts}` → `postMessage({reqId, result: analyzeStrokes(strokes, null, {...opts, clouds: cache[token]})})`.
- **Client hook** (`useRecognizerWorker`): lazily constructs the worker via Vite's
  `new Worker(new URL('./recognizerWorker.js', import.meta.url), { type: 'module' })`; sends `setTemplates`
  when `templates` identity changes (reusing the `useMemo` token); exposes
  `recognizeAsync(strokes, opts) → Promise<result>`.
  - **Stale-result guard:** monotonically increasing `reqId`; ignore any response older than the latest
    request (a newer Detect supersedes an in-flight one). Drawing fast must not flash old detections.
  - **Fallback:** if `typeof Worker === 'undefined'` or construction throws, `recognizeAsync` calls the
    synchronous path (`analyzeStrokes` directly) — identical behavior, just blocking.
- **StudioPage:** `runRecognition` returns a promise; `handleDetect` becomes `async` and awaits it, so
  `busy` brackets a real async gap (spinner paints). Auto-analyze awaits and drops superseded runs.
- **Cloud transfer note:** prefer the worker-side cache (ship `templates` once on change, then only
  `strokes` per call). Do **not** post the whole cloud set on every keystroke — that re-introduces a
  main-thread cost (structured clone of the big cloud array).

**Acceptance / tests:**
- Unit-testable pieces stay pure: a `test/recognizer-worker-protocol.test.js` can test the **message
  handler logic** if factored into a pure `handleWorkerMessage(state, msg)` (no real `Worker`), incl.
  token caching + stale `reqId` drop.
- Manual: drawing/Detect no longer freezes; the spinner shows; spamming Detect never renders a stale
  result; with `Worker` forced off, behavior is identical (just blocking). Add to
  [TEST-PLAN.md](../TEST-PLAN.md).

**Subagent brief.** "Add `src/draw/recognizerWorker.js` (imports the pure `analyzeStrokes`/`buildClouds`;
caches clouds by `templatesToken`; handles `setTemplates`/`recognize` with a `reqId`). Add
`src/studio/useRecognizerWorker.js` exposing `recognizeAsync` with a stale-`reqId` guard and a sync
fallback when `Worker` is unavailable. Make `StudioPage` `handleDetect`/auto-analyze async via the hook;
keep `recognizer.js` pure. Factor the message handling into a pure `handleWorkerMessage` and unit-test it.
Run `node --test`; manually verify no-freeze + spinner + stale-drop + fallback."

**Review checklist.** `recognizer.js` still pure (no `Worker`/DOM) · clouds built once **in the worker**,
not shipped per call · stale `reqId` results dropped · sync fallback when `Worker` absent ·
`handleDetect`/auto-analyze async, spinner paints · protocol unit test green · TEST-PLAN updated.
**Effort: M–L.**

---

## Risks & notes

- **Accuracy is the guardrail.** P2 and P3 are speedups only — the **top-1 equivalence test on the seed
  set** is the gate. If a phase changes any winner, the phase is wrong (raise K, fix the role fallback),
  not the test.
- **Pre-filter rotation tolerance (P3).** The coarse descriptor must be rotation-tolerant or it will drop
  the true winner for rotated signs. Hence scoring the coarse input at a few angles, and validating K
  against rotated samples in the bench/equivalence set.
- **Worker + Vite build (P4).** Use the `new URL(..., import.meta.url)` worker form so the prod
  build/GitHub-Pages bundling picks it up; verify `npm run build` includes the worker chunk.
- **Multi-ring path.** `classifyAndRecognize` is shared by single- and multi-ring paths
  ([:512](../../../src/draw/recognizer.js#L512), [:575](../../../src/draw/recognizer.js#L575)), so the role
  pool + pre-filter changes benefit both for free — just verify both paths in tests.
- **Cumulative target.** At M=400 templates the combined P1–P3 should cut `analyzeStrokes` median time
  substantially (cost factor goes from `pool` to `K` with role-halving on top); P4 then removes whatever
  remains from the main thread. Record the actual numbers from P0's bench in this spec's Status line when
  each phase lands.
