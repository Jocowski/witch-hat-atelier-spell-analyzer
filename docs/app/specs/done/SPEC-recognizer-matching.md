# SPEC — Recognizer matching enhancements

> Status: **done - shipped (2.4, 2.5); tail 2.5-C raster-veto wiring** · Scope: **recognition robustness** · Branch: `feat/spell-studio`
> Cross-refs: [SPEC-recognizer-analysis.md](../SPEC-recognizer-analysis.md) (items A4 refined here, 2.5 is new),
> [IMPROVEMENTS.md](../../IMPROVEMENTS.md), [SPEC.md](../../SPEC.md) (WS9 improvement loop).
> Modules: `src/draw/recognizer.js`, `src/admin/TrainingView.jsx`, proposed `src/draw/rasterMatch.js`.

This spec covers two matching enhancements that are independent of each other and can ship in either
order. Both are listed in the improvement backlog; 2.4 is the cheap win, 2.5 is the medium/large
investment that pays off on messy or overlapping drawings.

---

## 2.4 — Rotation tolerance for the Training live single-symbol guess

### Problem

The spell pipeline in `analyzeStrokes` already de-rotates every symbol group by running a 24-step
rotation sweep (15° increments, lines 150–167 of `recognizer.js`) before calling `recognize()`. The
result is rotation-tolerant: drawing an Arrow tilted 60° still identifies it correctly.

The **Training tab** (`src/admin/TrainingView.jsx`) has a live guess that calls `recognize()` directly
(line 141) on the raw flattened points **without any sweep**. A trainee drawing a sign rotated by even
30° sees a wrong top guess, which is confusing when they are trying to confirm their drawing is
recognizable and deciding whether to save it.

Core signs (`role === 'sigil'`) are drawn at the center of a ring so their orientation is canonical;
the pipeline intentionally keeps them at 0° (the sweep for `role === 'core'` uses `[0]`). The Training
guess should match that asymmetry: apply the sweep for signs, skip it for sigils.

### Design

**Extract a reusable helper: `bestMatchOverRotations`**

Factor the sweep inline in `analyzeStrokes` into a single exported pure function in `recognizer.js`:

```js
/**
 * Run recognize() over a rotation sweep and return the best single match.
 *
 * @param {Array<{x,y}>} rawPoints  flat array of {x,y} (not yet clouded)
 * @param {Array}        clouds     prebuilt makeCloud() objects (same shape as recognize() expects)
 * @param {number[]}     steps      rotation offsets in degrees to try (e.g. [0] or 24-step sweep)
 * @param {{cx?:number, cy?:number}} opts  pivot for rotation (default 0,0 — centroid of points)
 * @returns {{ name, dist, adjDist, rotation } | null}
 */
export function bestMatchOverRotations(rawPoints, clouds, steps, opts = {})
```

Internally it mirrors the existing loop in `analyzeStrokes`:

1. Compute pivot as the centroid of `rawPoints` (or `opts.cx`/`opts.cy` if provided, so the pipeline
   can pass the group centroid as before and get identical behaviour).
2. For each `deg` in `steps`: rotate the raw points around the pivot, build a flat `{X,Y,ID}` array
   (all points get `ID: 0` for a single-stroke merge, or the caller passes pre-segmented points with
   IDs), run `recognize()`, track the best by `adjDist`.
3. Return the winner `{ name, dist, adjDist, rotation }`, or `null` if clouds is empty.

**`analyzeStrokes` change (pipeline purity)**

Replace the inline sweep with a call to `bestMatchOverRotations`, passing `g.strokes` unrolled into
raw points with per-stroke IDs, and `sweep` as `steps`:

```js
// before (inline)
const sweep = g.role === 'core' ? [0] : Array.from({ length: 24 }, (_, k) => k * 15)
let best = null
for (const deg of sweep) { ... }
g.match = best

// after (extracted)
const sweep = g.role === 'core' ? [0] : Array.from({ length: 24 }, (_, k) => k * 15)
const rawPts = g.strokes.flatMap((s, si) => s.map((p) => ({ x: p.x, y: p.y, _id: si })))
g.match = bestMatchOverRotations(rawPts, clouds, sweep, { cx: g.cx, cy: g.cy })
```

The inner logic is identical to today's; `analyzeStrokes` output is byte-for-byte unchanged.

**`TrainingView.jsx` change**

Replace the bare `recognize()` call in `handleChange` with `bestMatchOverRotations`:

```js
// before
const pts = arrays.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id })))
setLiveGuess(recognize(pts, clouds).slice(0, 3))

// after
import { bestMatchOverRotations, recognize, ... } from '../draw/recognizer.js'

const selectedSym = symbols.find(s => s.id === selectedId)
const isSign = !selectedSym || selectedSym.kind !== 'sigil'
const steps = isSign ? Array.from({ length: 24 }, (_, k) => k * 15) : [0]
const pts = arrays.flatMap((s, id) => s.map(p => ({ x: p.x, y: p.y })))
const top = bestMatchOverRotations(pts, clouds, steps)
// also build the ranked list for the detail line (run recognize at the winning rotation)
setLiveGuess(top ? [top, .../* ranked at top.rotation */] : null)
```

The detail line (`r.name (r.dist.toFixed(2))`) can be produced by re-running `recognize()` at the
winning rotation and slicing to 3, so the display format stays the same.

**Steps constant**

The 24-step, 15° sweep is currently a magic number. Pull it into `rules.json` alongside the other
recognition tuning:

```json
"recognition": {
  ...,
  "rotationSteps": 24
}
```

Pass it through to the caller (e.g. `analyzeStrokes(strokes, templates, { ..., rotationSteps })`) so
it is injected, not hardcoded — consistent with the pure-module rule.

### Tunables (all passed in, not JSON-imported in recognizer.js)

| Tunable | Where set | Default | Notes |
|---|---|---|---|
| `rotationSteps` | `rules.json` → caller → `opts.steps` | 24 | 15°/step sweep; 12 (30°/step) is faster but misses more |
| Sigil bypass | logic in caller | `role==='sigil'` → `[0]` | never rotate sigil templates |

### Acceptance criteria

- Drawing a known sign rotated by 45°–90° in the Training tab shows the correct name as the top guess.
- The spell pipeline (Studio `Detect`) produces identical output before and after the refactor
  (regression: run the existing `test/` suite — all pass).
- A pure-function test in `test/` (see Testing notes) passes.
- `recognizer.js` still has no JSON imports.

### Effort: S

One new export (~20 lines), one call-site refactor in `analyzeStrokes` (5 lines diff), one call-site
change in `TrainingView.jsx` (~8 lines diff). No schema change except a new `rotationSteps` key.

---

## 2.5 — Multi-layer raster matcher (complement / cross-validation to $P)

### Motivation

`$P` is a point-cloud matcher: it resamplesstrokes to 32 equidistant points, scales to a unit square,
and finds the minimum weighted nearest-neighbour distance. It is fast and needs very few templates. Its
weaknesses:

- **Rotation sensitivity** — mitigated by the sweep in 2.4 but not eliminated (15° steps miss rotations
  exactly between steps).
- **Ink contamination** — extra stray strokes inside a group inflate the point cloud; a mis-merged
  group (e.g. two signs that merge because they're close) may get a low but non-zero score for a wrong
  symbol.
- **Missing-ink insensitivity** — incomplete drawings can still score respectably because the greedy
  match weights early-index points more heavily; a quarter of the strokes drawn still matches at ~50%.

The raster matcher addresses these blind spots orthogonally: it renders strokes to a small pixel grid,
computes ink overlap scores (Dice on soft masks, explained/unexplained ink ratios, region grid coverage),
and produces a `contaminationRisk` metric. Used as a **gate / veto layer** on top of `$P`, it can
reject false positives without replacing the matcher.

The reference implementation is in
`C:\Users\Pichau\Desktop\Joao\Desenvolvimento\Outros\wha-spell-simulator\src\parser\templateMatcher.js`
(read and adapted, not copied verbatim).

### Architecture: complement, not replacement

`$P` remains the primary matcher and confidence source. The raster matcher is a **post-filter**:

```
draw strokes
  → $P sweep (2.4)
      → candidate: { name, dist, adjDist, rotation }
          → raster veto:  contaminationRisk > threshold?
              yes → downgrade to "unknown?" (suppress from engine)
              no  → pass through; optionally blend raster score for display
```

The raster matcher is **never** used to select a different candidate; it only decides whether to
**trust** the `$P` winner. This keeps the selection logic in one place and avoids a combinatorial
scoring merge.

### New module: `src/draw/rasterMatch.js`

Pure module — no JSON imports, no DOM. Takes normalized strokes and reference ink, returns scores.
All thresholds and grid sizes are **passed in** as a `params` object.

#### Data structures

```js
// A rendered ink object — one per symbol per rotation.
// Uint8Array masks, side × side pixels.
{ core: { mask: Uint8Array, ink: number },   // tight pen trace (radius 1px)
  soft: { mask: Uint8Array, ink: number },   // blurred (radius 2px) — main Dice layer
  loose: { mask: Uint8Array, ink: number } } // very blurred (radius 4px) — for "explained" check
```

```js
// Region grid occupancy — gridSize × gridSize cells, 0/1 per cell.
Uint8Array  // flat row-major
```

#### Exported functions

**`renderInk(strokes, rotationDeg, params)`**

Renders an array of normalized strokes (`[{x,y}]` each, coordinates in `[0,1]`) to a pixel grid.

- `params.inkSize` (default `40`) — grid side length in pixels.
- `params.coreRadius` (default `1`), `params.softRadius` (default `2`), `params.looseRadius`
  (default `4`) — dilation radii in pixels.
- `rotationDeg` — rotate each point around `(0.5, 0.5)` before marking.
- Returns `{ core, soft, loose }` each with a `mask: Uint8Array` and `ink: number` (pixel count).

**`compareInk(candidateInk, referenceInk, params)`**

Score a candidate against a reference at a fixed rotation. Both are the output of `renderInk`.

Computed metrics (mirroring the reference implementation):

| Metric | Formula | Meaning |
|---|---|---|
| `candidateExplainedRatio` | overlap(candidate.core, ref.loose) / candidate.core.ink | What fraction of the candidate's ink falls within the reference's loose mask |
| `templateCoveredRatio` | overlap(ref.core, candidate.loose) / ref.core.ink | What fraction of the reference's ink is covered by the candidate's loose mask |
| `softDiceScore` | 2 × overlap(cand.soft, ref.soft) / (cand.soft.ink + ref.soft.ink) | Dice coefficient on soft masks — the primary shape-agreement score |
| `unexplainedInkRatio` | 1 − candidateExplainedRatio | Ink with no corresponding template ink — stray strokes, contamination |
| `missingInkRatio` | 1 − templateCoveredRatio | Template ink that was not drawn |
| `inkScore` | weighted sum (see below) | Composite shape agreement |
| `contaminationRisk` | weighted sum of unexplained/missing/forbidden thresholds | Likelihood that the match is false due to extra ink |

`inkScore` weights (tunable via `params`; defaults mirror the reference):

```
inkScore = clamp(
  candidateExplainedRatio × 0.32
  + templateCoveredRatio  × 0.32
  + softDiceScore         × 0.14
  + requiredCellCoverage  × 0.16
  + (1 − forbiddenCellInkRatio) × 0.06
)
```

`contaminationRisk` weights (tunable via `params`):

```
contaminationRisk = clamp(
  clamp((unexplainedInkRatio − 0.26) / 0.34) × 0.58
  + clamp((missingInkRatio   − 0.46) / 0.34) × 0.22
  + clamp((forbiddenCellInkRatio − 0.18) / 0.46) × 0.20
)
```

**`cellStats(candidateInk, referenceInk, params)`**

Region grid analysis. `params.gridSize` (default `10`).

- Partition both masks into a `gridSize × gridSize` cell grid.
- `requiredCellCoverage`: fraction of reference core cells that the candidate loose mask covers.
- `forbiddenCellInkRatio`: fraction of candidate core cells that fall outside the reference loose mask
  (ink in a region where the template has none — the strongest contamination signal).
- `regionScore`: `clamp(requiredCellCoverage × 0.68 + (1 − forbiddenCellInkRatio) × 0.32)`.

**`rasterScore(candidateStrokes, referenceStrokes, params)`**

Convenience wrapper: normalizes both stroke arrays, renders with the rotation sweep from
`params.rotationSet` (default `[0, 45, 90, 135, 180, 225, 270, 315]` for signs; `[0]` for sigils),
and returns the best-rotation result:

```js
{
  inkScore,
  softDiceScore,
  contaminationRisk,
  candidateExplainedRatio,
  templateCoveredRatio,
  unexplainedInkRatio,
  missingInkRatio,
  requiredCellCoverage,
  forbiddenCellInkRatio,
  regionScore,
  bestRotationDeg,      // winning rotation in the sweep
  contaminationCap      // the confidence cap this score implies (0.2–1.0)
}
```

`contaminationCap` mirrors the reference: if `unexplainedInkRatio > 0.36` AND
`templateCoveredRatio < 0.82`, cap = `clamp(0.62 − (unexplainedInkRatio − 0.36) × 0.8, 0.2, 1.0)`;
otherwise `1.0`.

#### Stroke normalization

The raster matcher requires strokes in `[0,1]` normalized coordinates (bounding-box fit). Add a pure
helper `normalizeStrokes(strokes)` → `{strokes, width, height}` (fit to `[0,1]²`, preserve aspect
ratio, center in the square). This is the equivalent of the reference's `normalizeStrokesForTemplate`.

#### Reference ink source

The raster matcher needs reference ink for each symbol. Two options:

1. **From $P templates** (the training samples already in the DB): normalize the same point list used
   to build a `makeCloud`, connect consecutive same-ID points as segments, and render with `renderInk`.
   This is the cheapest path — no new data, the same samples used by `$P` feed the raster reference.
   Aggregate multiple training samples per symbol by OR-ing their soft masks (any sample's ink counts
   as "expected").

2. **From canon SVG paths** (APP-PLAN Phase H — `svgPath` per sigil/sign in `sigils.json` /
   `signs.json`): stroke the SVG path onto the raster grid at 0° to produce a single high-quality
   reference. This is cleaner but requires the SVG-path-to-stroke conversion step.

**Recommended approach:** start with option 1 (use existing training samples as the raster reference
— zero new infrastructure, usable as soon as templates exist). When Phase H SVG paths are available,
add them as a supplementary reference and OR the masks. This avoids a new data pipeline blocker.

### Fusion policy: contamination veto

The raster matcher's primary role is the **contamination veto**. The fusion rule is intentionally
simple and one-directional:

```
if rasterResult.contaminationRisk > params.contaminationVetoThreshold:
    mark detection as 'unknown?' (as if it fell below the $P confidence gate)
else:
    use $P result as-is
```

`contaminationVetoThreshold` default: `0.55` (tunable in `rules.json` → injected into the caller).

**Why not a score blend?** A blend requires calibrating two heterogeneous distances onto the same
scale and risks penalizing valid matches with high raster variance (e.g. a loose hand drawing of a
correct symbol). The veto is conservative: it only fires when there is clearly too much unexplained
ink. A blended score can be shown as a **display metric** (the breakdown in A4 match disclosure,
SPEC-recognizer-analysis.md §B1) without it affecting the primary ranking.

**Optional: tie-breaking.** If two `$P` candidates have `adjDist` within `params.tieBandPct`
(e.g. 10%) of each other, use the raster `inkScore` to break the tie. Default: disabled (set
`tieBandPct: 0`). This is a separate, opt-in enhancement over the base veto.

### Integration points

- **`analyzeStrokes` (pipeline):** after the `$P` sweep picks `g.match`, run `rasterScore` on
  `g.strokes` vs the winning template's raw points (retrieved from the clouds array or a parallel
  reference map). If the veto fires, set `g.match = null` and `g.confidence = 0` so the group becomes
  "unknown?". The raster result is stored as `g.rasterResult` for the B1 disclosure panel.
- **Training live guess (`TrainingView.jsx`):** the raster veto is optional here (less critical — the
  trainee knows what they drew). Show `contaminationRisk` as a secondary display metric ("ink purity")
  so trainees understand why the recognizer might reject a drawing in production.
- **`rules.json`** (injected, never imported inside `rasterMatch.js`):

```json
"rasterMatch": {
  "note": "Multi-layer raster matcher params. contaminationVetoThreshold: above this risk the $P winner is suppressed (shown as unknown?). tieBandPct: if >0, raster inkScore breaks $P ties within this relative band. inkSize/gridSize: raster resolution.",
  "contaminationVetoThreshold": 0.55,
  "tieBandPct": 0,
  "inkSize": 40,
  "coreRadius": 1,
  "softRadius": 2,
  "looseRadius": 4,
  "gridSize": 10,
  "rotationSet": [0, 45, 90, 135, 180, 225, 270, 315]
}
```

### Caching

Building reference ink from training samples is done once per session (or per template set change):

- Build a `Map<symbolName, renderedInk>` by normalizing and rendering all templates for each symbol,
  ORing their soft/loose masks. Cache in the caller (e.g. in `StudioPage` state, rebuilt when
  `activeTemplates()` changes).
- The raster rendering for a **candidate** at a given rotation is cheap (40×40 = 1600 pixels); no
  caching needed per call.
- Do **not** cache inside `rasterMatch.js` itself — the module is pure and stateless (consistent with
  the `geometry.js`/`deduce.js` convention; WeakMap caches inside a module would be invisible to
  tests).

### Phasing

| Phase | Deliverable | Effort |
|---|---|---|
| 2.5-A | `normalizeStrokes` + `renderInk` + `compareInk` + `cellStats` in `src/draw/rasterMatch.js`; pure unit tests | S |
| 2.5-B | `rasterScore` (rotation sweep wrapper); integration into `analyzeStrokes` as a veto-only layer; `rules.json` key; basic smoke test on a real drawing | M |
| 2.5-C | Build reference ink from training samples in `StudioPage`; expose `contaminationRisk` in the B1 match disclosure panel; Training tab displays "ink purity" | M |
| 2.5-D (optional) | Tie-breaking mode (`tieBandPct > 0`); SVG-path reference ink once Phase H ships | L |

Total estimated effort: **M** for 2.5-A + 2.5-B (the core veto), **L** for the full phasing including
UI surfacing.

### Acceptance criteria

- Drawing a sign with a large stray scribble inside its group (contamination) produces "unknown?"
  instead of a wrong confident label.
- Drawing a clean version of the same sign (no stray ink) still identifies correctly (veto does not
  fire).
- A contaminated candidate with `contaminationRisk` above the threshold is suppressed, and the
  `analyzeStrokes` result excludes it from the engine input (same as the A2 confidence gate).
- Setting `contaminationVetoThreshold: 1.0` in `rules.json` disables all vetoing (regression path).
- `rasterMatch.js` has zero JSON imports; all params are passed in.
- Pure-function tests (see Testing notes) pass under `node --test` with no DOM or Supabase.

---

## Testing notes

### 2.4 — Rotation tolerance (pure tests in `test/`)

Add `test/recognizer.test.js` (or extend an existing test file):

```js
// Minimal cloud from a horizontal line, then recognize a rotated version.
// The sweep must find the correct match regardless of rotation.
test('bestMatchOverRotations: rotated sign still matches', () => {
  // Build a template cloud from a simple L-shape (horizontal + drop).
  const templateStrokes = [
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
  ]
  // Rotate the same strokes 45° and assert the match is still the same symbol.
  // ...
  assert.equal(match.name, 'test_sign')
  assert.ok(match.dist < someThreshold)
})

test('bestMatchOverRotations: pipeline output unchanged after extraction', () => {
  // Run analyzeStrokes on a fixed stroke set.
  // Assert groups[0].match is the same with and without the refactor (golden output).
})

test('bestMatchOverRotations: core (sigil) never rotated', () => {
  // A group marked role='core' must always report rotation === 0.
})
```

### 2.5 — Raster matcher (pure tests in `test/rasterMatch.test.js`)

```js
test('renderInk: a horizontal line produces ink in the middle row only', () => {
  // Normalize a single horizontal stroke, render at 0°.
  // Assert soft.mask has non-zero pixels in the center row, zero in top/bottom rows.
})

test('compareInk: identical strokes score high (inkScore > 0.8, contaminationRisk < 0.1)', () => {
  const ink = renderInk(strokes, 0, defaultParams)
  const result = compareInk(ink, ink, defaultParams)
  assert.ok(result.inkScore > 0.8)
  assert.ok(result.contaminationRisk < 0.1)
})

test('compareInk: contaminated candidate (double ink) has high contaminationRisk', () => {
  // Candidate = clean sign + an extra overlapping scribble.
  // Reference = clean sign only.
  // Assert contaminationRisk > 0.55 (above veto threshold).
})

test('rasterScore: rotating a sign by 45° and running the rotation sweep still finds inkScore > 0.6', () => {
  // Build reference from canonical strokes.
  // Rotate strokes 45°, assert best rotation's inkScore is still above usable threshold.
})

test('rasterScore: contaminationCap applied when unexplainedInkRatio high', () => {
  // Force high unexplained ink. Assert contaminationCap < 1.0.
})

test('veto integration: analyzeStrokes suppresses contaminated group (match === null)', () => {
  // Pass a heavily contaminated stroke group through a mock analyzeStrokes-style pipeline.
  // Assert the group's match is nulled out when contaminationRisk exceeds the threshold.
})
```

---

## Pure-module constraint checklist

Both new pieces of code must satisfy the existing pure-module rule before landing:

- [ ] `recognizer.js` — no new JSON imports added; `bestMatchOverRotations` added as a named export.
- [ ] `rasterMatch.js` — no JSON imports at all; all params passed in.
- [ ] Both modules run under plain `node --test` with zero Vite/DOM/Supabase dependencies.
- [ ] Thresholds/defaults live in `rules.json` under `recognition.rotationSteps` and `rasterMatch.*`.
- [ ] `TrainingView.jsx` reads thresholds from `rules.json` (already imports it) and passes them in;
  it does NOT do `import ... from '../draw/rasterMatch.js'` directly — the raster veto runs in the
  pipeline (`analyzeStrokes`), not in the Training component.

---

## Summary of changes

| File | Change |
|---|---|
| `src/draw/recognizer.js` | Export `bestMatchOverRotations`; refactor sweep in `analyzeStrokes` to call it |
| `src/draw/rasterMatch.js` | New pure module: `normalizeStrokes`, `renderInk`, `compareInk`, `cellStats`, `rasterScore` |
| `src/admin/TrainingView.jsx` | Use `bestMatchOverRotations` for the live guess; pass role-appropriate steps |
| `src/studio/StudioPage.jsx` | Build reference ink cache; pass raster params into `analyzeStrokes`; store `g.rasterResult` |
| `data/rules.json` | Add `recognition.rotationSteps`; add `rasterMatch` block |
| `test/recognizer.test.js` | Pure tests: rotation sweep extraction, pipeline regression |
| `test/rasterMatch.test.js` | Pure tests: renderInk, compareInk, contamination, rotation sweep |
