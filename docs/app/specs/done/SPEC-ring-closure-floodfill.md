# SPEC — Flood-fill ring-closure detection & adaptive segmentation

> Status: **done - shipped (2.2, 2.3)** · Scope: **recognizer ring detection + segmentation tuning**
> Branch: `feat/spell-studio`
> Cross-refs: [SPEC-recognizer-analysis.md](../SPEC-recognizer-analysis.md) (A5 adaptive segmentation,
> A2 confidence gate), [SPEC-sign-variants-sizing.md](SPEC-sign-variants-sizing.md) (ring radius as a
> reference denominator), [src/draw/recognizer.js](../../../../src/draw/recognizer.js) (ring detection,
> `analyzeStrokes`, `circleScore`), [src/studio/StudioPage.jsx](../../../../src/studio/StudioPage.jsx)
> (the hardcoded `gap: 45` call site), SPEC-visual-renderer 1.3 (prepared/active ring states — ring
> closure is the exact trigger for "ring just activated").

This spec covers two related improvements to the recognizer's ring-detection and segmentation layers.
They are independent enough to ship separately but are listed together because they share the same
root cause: the current heuristics (`cv < 0.3`, hardcoded 45 px gap) break on drawings that are
either messy, very large, or very small. Both items keep `recognizer.js` (and any new pure module)
**free of JSON imports** — all tunables are passed in from the caller, consistent with the
`geometry.js`/`deduce.js` convention.

---

## Item 2.2 — Flood-fill ring-closure detection

### Problem

`circleScore` ([recognizer.js:93–101](../../../../src/draw/recognizer.js#L93-L101)) detects the activation
ring by two independent checks:

```js
// recognizer.js line 125
if (cs.cv < 0.3 && cs.closed && (!ring || cs.r > ring.r))
```

- **`cv < 0.3`** — the coefficient of variation of radii from the centroid. Measures roundness, not
  whether the shape is topologically closed. A slightly wobbly or gap-split circle often scores
  `cv > 0.3` and is rejected even though a human would recognize it as a closed ring.
- **`cs.closed`** — `startPoint–endPoint distance < 0.4 * r`. Checks only whether the *endpoints* of
  a single stroke are close. Fails on: (a) the user lifts and re-draws the last arc, leaving two
  strokes; (b) the user draws continuously but leaves a visible gap at the join.

Together these checks are **too strict for messy hand-drawn circles** and miss common cases. The fix
is a topology test: rather than measuring geometric regularity, ask "does this shape enclose an area
that the outside cannot reach?" — which is exactly what the flood-fill bucket does.

A secondary risk: a small closed sign (e.g. a circle-based glyph drawn in the center of the canvas)
could pass the topology test and be mistaken for the activation ring. The minimum-enclosed-area guard
prevents this.

### Reference implementation

`wha-spell-simulator/src/parser/topologicalFloodFill.js` contains a proven design. The approach
there:

1. **Rasterize** all strokes as ink disks onto a pixel grid (each point along each stroke stamped as
   a filled circle of radius `STROKE_RADIUS_PX`).
2. **Flood-fill the exterior** with a BFS queue seeded from every cell on the outer border (4-connected
   neighbors; ink blocks propagation). Cells the flood can reach are "wet"; the rest are "dry".
3. **Find dry components** — connected regions the exterior flood could not reach. The largest such
   region's pixel area is the *enclosed area*.
4. **Guard on area** — reject candidates whose enclosed area is below a minimum (`min(MIN_AREA_ABS,
   boundsArea * MIN_AREA_RATIO)`) to avoid mistaking small closed signs for the activation ring.
5. **Score the outer ink edge** — collect the ink cells that touched the flood front (`outsideEdge`),
   fit a circle to their centers, and compute a normalized RMSE (`normalizedRmse`) and a `perfection`
   score. This replicates the old circularity check but on the *topological* boundary, which is more
   robust.
6. **Closure = enclosed area + min radius + min perfection.** All three gates must pass.

`ringDetector.js` then adds: collecting only the ring-relevant strokes from the edge, pruning
redundant short strokes, and a reference-filtered retry (when an open ring is already tracked, re-run
the flood on only strokes near that ring so distant stray marks don't distort the boundary).

### New module: `src/draw/ringClosure.js`

Extract the flood-fill logic as a **pure ES module** — no JSON imports, no DOM, no Konva. All
tunables arrive as a `config` parameter object. The module exports one primary function and a few
helpers:

```js
// src/draw/ringClosure.js

/**
 * Analyze whether a set of strokes topologically encloses a region.
 *
 * @param {Array<Array<{x:number,y:number}>>} strokes
 *   Array of strokes; each stroke is an array of {x,y} canvas-px points.
 * @param {RingClosureConfig} config  — see tunables section below.
 * @returns {RingClosureResult}
 */
export function analyzeRingClosure(strokes, config) { ... }

/** Build bounding box for an array of strokes. Pure helper (no DOM). */
export function strokesBounds(strokes) { ... }

/** Score a set of points as a circle. Returns { cx, cy, r, normalizedRmse, perfection }. */
export function scoreCircleFit(points, config) { ... }
```

**`RingClosureConfig`** (all fields optional; caller supplies or falls back to defaults):

| field | type | suggested default | meaning |
|---|---|---|---|
| `cellSize` | px | `2` | raster cell size (see performance section) |
| `padding` | px | `24` | border padding around stroke bounds |
| `inkRadius` | px | `4` | half-width of the ink disk stamped per sample point |
| `sampleStep` | px | `1.5` | inter-sample step when walking stroke segments |
| `minEnclosedAreaPx` | px² | `2000` | absolute floor — no ring smaller than this |
| `minEnclosedAreaRatio` | 0..1 | `0.06` | area relative to raster bounds (scales with drawing size) |
| `maxNormalizedRmse` | 0..1 | `0.22` | circle-fit error tolerance (higher = accepts messier circles) |
| `minPerfection` | 0..1 | `0.24` | derived from RMSE (`1 - rmse/maxRmse`); lower = more forgiving |
| `minRadius` | px | `40` | absolute minimum ring radius (from caller; comes from `rules.json` or a measured canvas fraction) |

`minRadius` is **not** defaulted inside the module — it must be passed by the caller. The other
defaults live as `const DEFAULT_CONFIG` at the top of `ringClosure.js` so they can be overridden
without modifying the module.

**`RingClosureResult`**:

```js
{
  closed: boolean,           // the definitive answer
  enclosedAreaPx: number,    // largest dry-region pixel area
  minEnclosedAreaPx: number, // threshold that was applied
  cx: number, cy: number,    // circle-fit center of the outside-edge pixels
  r: number,                 // fitted radius
  normalizedRmse: number,    // circle-fit error / radius (lower = rounder)
  perfection: number,        // 1 - normalizedRmse/maxNormalizedRmse, clamped 0..1
  edgePixelCount: number,    // how many ink pixels formed the outside edge
  strokeIds: number[],       // indices (into the input array) of strokes that contributed to the edge
  rasterMeta: { width, height, cellSize, offsetX, offsetY }  // for debugging/visualisation
}
```

#### Performance strategy

The reference uses 1 px cells and performs well for canvases up to ~1000×1000 px (a few hundred
milliseconds at most). For the Spell Studio canvas, which may be larger and is rasterized on every
"Detect" button press (not per-stroke), a **cell size of 2 px** is the right default: halves the grid
in each dimension, giving 4× fewer cells and 4× faster BFS.

Additional guards:

- **Cap the raster dimensions.** If `ceil((bounds + 2*padding) / cellSize)` would exceed
  `MAX_RASTER_DIM = 1024` cells in either axis, increase `cellSize` proportionally to fit within the
  cap. This prevents pathological slowdowns on very high-DPI or zoomed-out drawings.
- **Sample step scales with cell size.** `sampleStep = 0.75 * cellSize` ensures ink disks are never
  under-sampled relative to the grid.
- The BFS allocates `Int32Array(rasterSize)` for the queue — a single allocation, no push/pop
  overhead.
- Rasterization is O(strokes × points × diskArea) and BFS is O(rasterSize). For a 600 × 600 canvas
  at cellSize=2 the grid is 300×300 = 90 000 cells — negligible.

**Detect is the only call site** (called once on button press, not on every stroke commit), so even a
10 ms rasterization is imperceptible.

### Integration into `recognizer.js`

`analyzeStrokes` currently detects the ring in one line (line 125). The integration replaces this
with a **two-tier** check — the fast `circleScore` heuristic runs first as a quick candidate filter;
flood-fill confirms (or overrides) its result:

```
// Step 1: candidate identification (existing heuristic, relaxed)
// For each stroke, run circleScore. Keep any stroke that either:
//   (a) already passes cv < cvThreshold (fast path: clearly round), OR
//   (b) looks like it might be a big circle (r > minRadius AND cv < cvThresholdRelaxed).
// Pick the largest passing candidate as `ringCandidate`.

// Step 2: topological confirmation
// Run analyzeRingClosure([ringCandidate]) to confirm topology.
// If closed=true, use its cx/cy/r as the authoritative ring center/radius.
// If closed=false but the relaxed candidate passed step 1(b), also try
// analyzeRingClosure(allStrokes) — the ring may be multi-stroke.

// Step 3: multi-stroke ring
// If no single-stroke candidate produced closure, run analyzeRingClosure(allStrokes).
// If closed=true and enclosedAreaPx >= minEnclosedAreaPx, accept it as the ring.
// Use strokeIds to identify which strokes belong to the ring and exclude them from
// symbol segmentation (the role of ringIdx today).
```

This is **additive**: the heuristic still runs (its fast-path prevents ever rasterizing an obviously
non-ring single stroke), and flood-fill only fires when the heuristic is ambiguous or passes.

The `ring` object returned by `analyzeStrokes` gains two new optional fields:

```js
ring: {
  cx, cy, r, cv, closed,        // existing fields (cv kept for telemetry)
  // new:
  floodClosed: boolean,         // did flood-fill confirm closure?
  perfection: number,           // flood-fill circle-fit perfection score
  strokeIds: number[],          // indices of strokes that form the ring boundary
}
```

Callers that only check `!!ring` (e.g. `StudioPage.jsx:135`) are **unaffected** — `ring` is still
`null` when no ring is found. The new fields are additive.

The `cv < 0.3` **threshold becomes a tunable** — it moves to `opts.cvThreshold` (default `0.3`) so
callers can tighten or relax it. See Item 2.3 for how the caller supplies it.

#### Connection to prepared/active ring states (SPEC-visual-renderer 1.3)

The activation-ring state machine (prepared = large round open shape visible; active = ring just
closed) depends on detecting the transition from "ring open" to "ring closed". Flood-fill's
`closed: true` result is **exactly this signal**: the frame on which `floodClosed` first becomes
`true` for a previously-open ring candidate is the "ring just activated" moment. The renderer spec
should consume `ring.floodClosed` (or a derived `ring.activationEvent` flag) rather than the raw
`cv`/endpoint heuristic.

#### Minimum-enclosed-area guard (the "small closed sign" problem)

The guard has two parts (mirroring the reference):

1. **Absolute floor** (`minEnclosedAreaPx`): a closed sign that fills, say, 30×30 px of ink encloses
   far less area than the activation ring. Setting the floor to ~2000 px² (≈ 45×45 px) dismisses all
   normal-sized signs on a typical canvas. Tunable — on a very zoomed-out canvas this may need to
   increase; on a tiny canvas it may need to decrease.

2. **Relative floor** (`minEnclosedAreaRatio`): `enclosedAreaPx >= boundsAreaPx * 0.06`. The
   activation ring typically encloses 40–70% of the drawing area; a small closed sign near the
   center encloses a few percent. At 0.06 the guard rejects any enclosed pocket smaller than 6% of
   the total raster bounding box, which is robust to drawings of any size.

Both must pass (the higher of the two thresholds applies). Neither touches the `circleScore`
heuristic so the existing ring test is undisturbed when flood-fill is disabled or inconclusive.

### Multi-ring design note

The current pipeline emits **one ring** (the largest passing candidate). This contract is
**preserved** for now. However, `ringClosure.js` is designed so that `analyzeRingClosure` returns
only topology results for the strokes it is given — it has no opinion about "which" ring this is.
The caller (`analyzeStrokes`) picks the winner by the same "largest radius" rule as today.

To extend to multi-ring later: run `analyzeRingClosure` per connected ink cluster rather than on the
full stroke set, collect multiple `RingClosureResult` objects, and promote them all through the
pipeline. That is a separate spec.

---

## Item 2.3 — Adaptive segmentation gap

### Problem

`analyzeStrokes` merges nearby strokes into symbol groups using a **fixed 45 px gap**
([StudioPage.jsx:133](../../../../src/studio/StudioPage.jsx#L133), `opts.gap ?? 45` in
[recognizer.js:117](../../../../src/draw/recognizer.js#L117)). This is calibrated for a "typical" drawing
but fails at the extremes:

- **Large drawing / zoomed-in canvas:** a 45 px gap is much smaller than the natural inter-stroke
  gap within one symbol, so each sub-stroke is treated as a separate symbol. A two-stroke sign
  fragments into two unknowns.
- **Small drawing / zoomed-out canvas:** a 45 px gap may bridge the space between two *different*
  symbols, merging the core sigil with a nearby border sign into one garbled group.

The same calibration problem applies to the `cv < 0.3` circularity threshold: on a larger canvas the
ring may be drawn more freely (higher `cv`), and on a smaller canvas the threshold may be too tight.

### Adaptive gap formula

After ring detection (which runs first and gives us `ringR`), compute:

```
gap = clamp(gapK * ringR, gapMin, gapMax)
```

- **`gapK`** (default `0.12`) — fraction of ring radius. Rationale: on a canonical-sized drawing
  (`ringR ≈ 200 px`) this yields `0.12 × 200 = 24 px` — a bit tighter than 45, which is appropriate
  since 45 was estimated conservatively. On a large drawing (`ringR = 400 px`) → 48 px; on a small
  drawing (`ringR = 100 px`) → 12 px.
- **`gapMin`** (default `14 px`) — prevents collapsing to zero on tiny drawings.
- **`gapMax`** (default `80 px`) — prevents over-merging on huge drawings.

If ring detection fails (no ring found), the formula has no `ringR`. In that case fall back to the
**median nearest-neighbour stroke distance** as a proxy:

```
// For each stroke s_i, find distance to the nearest other stroke (using the
// minGap(a,b) function already in recognizer.js). Take the median of all N
// nearest-neighbour distances.  Use median * 0.9 as the gap, clamped to [gapMin, gapMax].
```

This gracefully handles drawings where the user forgot the ring or is using the recognizer in
ring-free mode.

#### Where the formula lives

The formula belongs in a **pure helper** `computeAdaptiveGap(ringR, strokes, config)` in
`recognizer.js` (or in `ringClosure.js` if that module is already imported). It takes:

- `ringR` — from the ring detection step; `null` if no ring found.
- `strokes` — the symbol strokes (after removing the ring stroke, as today).
- `config` — `{ gapK, gapMin, gapMax }` from the caller.

The function returns a single number. It is pure, has no side effects, and is independently testable.

### Adaptive `cv` threshold

The `cv < 0.3` threshold moves from a hardcoded literal to `opts.cvThreshold` (default `0.3`). No
formula — it stays a constant tunable. The motivation is operational: field experience will show
whether 0.3 is too strict or too loose for real hand-drawn input, and having it in `rules.json`
(passed through by `StudioPage`) means it can be adjusted without a code change.

### Updated `analyzeStrokes` signature

```js
// opts is unchanged in shape; all new fields are optional with sensible defaults.
analyzeStrokes(strokes, templates, {
  gap,                 // explicit override — used if present, skips auto-compute
  adaptiveGap: true,   // NEW: if true (and gap not overridden), compute gap from ringR
  gapK: 0.12,          // NEW: fraction of ringR
  gapMin: 14,          // NEW
  gapMax: 80,          // NEW
  cvThreshold: 0.3,    // NEW: replaces hardcoded cv < 0.3
  cvThresholdRelaxed: 0.45, // NEW: relaxed threshold for flood-fill confirmation step
  minRingRadius: 40,   // NEW: floor for ring acceptance (passed to ringClosure)
  floodFill: true,     // NEW: enables Item 2.2; set false to keep legacy behavior
  floodFillConfig: {}, // NEW: overrides for RingClosureConfig (cell size, area guards, etc.)
  confidenceMinPct,    // existing
})
```

All new opts are **optional** — existing callers (tests, `StudioPage`) work without change. If
`adaptiveGap` is `false` (or not set) and `gap` is not provided, the existing `opts.gap ?? 45`
default is used. This preserves current behavior exactly.

### `StudioPage.jsx` call site

The single change at `StudioPage.jsx:133`:

```js
// Before
const r = analyzeStrokes(drawn, templates, { gap: 45, confidenceMinPct: CONFIDENCE_MIN_PCT })

// After
const r = analyzeStrokes(drawn, templates, {
  adaptiveGap: true,
  gapK:    rules.recognition?.gapK    ?? 0.12,
  gapMin:  rules.recognition?.gapMin  ?? 14,
  gapMax:  rules.recognition?.gapMax  ?? 80,
  cvThreshold:        rules.recognition?.cvThreshold        ?? 0.3,
  cvThresholdRelaxed: rules.recognition?.cvThresholdRelaxed ?? 0.45,
  minRingRadius:      rules.recognition?.minRingRadius      ?? 40,
  floodFill:          rules.recognition?.floodFill          ?? true,
  confidenceMinPct: CONFIDENCE_MIN_PCT,
})
```

All tunables are read from `rules.recognition` (the same block that already carries `sampleWeights`
and `confidenceMinPct`). They are **not** imported inside `recognizer.js` — they are passed in from
`StudioPage`, honoring the pure-module constraint.

### `rules.json` additions (under `recognition`)

```jsonc
"recognition": {
  "sampleWeights": { ... },      // existing
  "confidenceMinPct": 0,         // existing
  // NEW:
  "cvThreshold": 0.3,
  "cvThresholdRelaxed": 0.45,
  "minRingRadius": 40,
  "floodFill": true,
  "floodFillConfig": {
    "cellSize": 2,
    "padding": 24,
    "inkRadius": 4,
    "sampleStep": 1.5,
    "minEnclosedAreaPx": 2000,
    "minEnclosedAreaRatio": 0.06,
    "maxNormalizedRmse": 0.22,
    "minPerfection": 0.24
  },
  "adaptiveGap": true,
  "gapK": 0.12,
  "gapMin": 14,
  "gapMax": 80
}
```

---

## New module summary

| file | role | exports |
|---|---|---|
| `src/draw/ringClosure.js` | **pure** (no JSON, no DOM) | `analyzeRingClosure`, `strokesBounds`, `scoreCircleFit` |
| `src/draw/recognizer.js` | unchanged shape; ring detection augmented | `computeAdaptiveGap` (new), existing exports |

`recognizer.js` imports `ringClosure.js` (a same-folder `.js` import — pure, no JSON, safe for
`node --test`). The `ringClosure.js` module has zero external dependencies beyond standard JS.

---

## Phasing & effort

### Phase 1 — Adaptive gap only (Item 2.3, no flood-fill) · **S**

Extract `cvThreshold` and `gap` as opts, add `computeAdaptiveGap`, update `StudioPage` and
`rules.json`. No new module. Does not touch rasterization or BFS. Safe to ship any time.

Deliverables: 2 source files changed (`recognizer.js`, `StudioPage.jsx`), 1 data file changed
(`data/rules.json`), 1–2 new unit tests.

### Phase 2 — Flood-fill module, single-stroke ring (Item 2.2, basic) · **M**

Create `src/draw/ringClosure.js` with the full rasterize–BFS–score pipeline. Integrate into
`recognizer.js` (single-stroke candidate confirmation path only). Pass tunables from `StudioPage` +
`rules.json`. Add unit tests for `ringClosure.js` in isolation.

Deliverables: 1 new file, 2 files changed, `rules.json` extended, 4–6 new tests.

### Phase 3 — Multi-stroke ring closure + reference-filtered retry · **M**

Extend the integration to try `analyzeRingClosure(allStrokes)` when no single-stroke candidate
passes, and add the reference-filtered retry (re-run with only strokes near the open-ring candidate).
Also wire the `ring.activationEvent` flag for SPEC-visual-renderer 1.3.

Deliverables: changes to `ringClosure.js` and the integration in `recognizer.js`; no new files.
Total effort across all three phases: **M–L** (the phases can be shipped independently on the same
branch).

---

## Acceptance criteria

### 2.2 — Flood-fill ring closure

| scenario | expected |
|---|---|
| Cleanly drawn circle (single stroke) | `ring.closed = true`, `ring.floodClosed = true` |
| Messy near-closed circle: visible gap ≤ ~15% of circumference, `cv` between 0.3 and 0.5 | `ring.closed = true` (flood-fill passes; old heuristic would have rejected) |
| Two-stroke ring (user lifted pen mid-arc) | `ring.closed = true` via multi-stroke path |
| Small closed sign (e.g. a circular sigil, r ≈ 25 px) drawn alone with no ring | `ring = null` (enclosed area below guard) |
| Symbol placed inside a ring: closed ring with signs inside | `ring.closed = true`; signs are not counted as the ring |
| No closed shape drawn | `ring = null` |
| Ring drawn at 2× normal size (ringR ≈ 400 px) | Accepted; `cellSize` auto-scales if needed to stay within `MAX_RASTER_DIM` |

### 2.3 — Adaptive gap

| scenario | expected |
|---|---|
| Small drawing (`ringR ≈ 80 px`): two-stroke sign drawn close together | Strokes merge into one group (gap ≈ `0.12 × 80 = 10 px`, clamped to `gapMin = 14 px`) |
| Large drawing (`ringR ≈ 450 px`): two distinct signs with natural spacing | Signs remain separate groups (gap ≈ `0.12 × 450 = 54 px`, clamped to `gapMax = 80 px`) |
| No ring detected: gap falls back to median nearest-neighbour heuristic | No crash; segmentation is reasonable |
| Explicit `gap: 45` passed in `opts` | Adaptive formula is bypassed; behavior identical to today |
| Existing unit tests | All pass without modification |

---

## Testing notes

`ringClosure.js` and `computeAdaptiveGap` are **pure functions** — they take plain JS objects (arrays
of `{x,y}` points) and return plain objects. They are directly testable under `node --test` with no
mocking or DOM setup.

### Recommended test file: `test/ringClosure.test.js`

**Synthetic stroke helpers:**

```js
// Generate a circle stroke with N points, center (cx,cy), radius r, optional gap fraction.
function circleStroke(cx, cy, r, n = 64, gapFraction = 0) {
  const pts = []
  const endAngle = 2 * Math.PI * (1 - gapFraction)
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * endAngle
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  return pts
}

// A small closed square (simulating a closed sign, not a ring).
function squareStroke(cx, cy, size) {
  const h = size / 2
  return [
    { x: cx - h, y: cy - h }, { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h }, { x: cx - h, y: cy + h },
    { x: cx - h, y: cy - h }, // close
  ]
}
```

**Test cases:**

```
analyzeRingClosure — closed full circle → closed=true, enclosedAreaPx >> minEnclosedAreaPx
analyzeRingClosure — circle with 10% gap → closed=false (gap too large for default config)
analyzeRingClosure — circle with 5% gap → closed=true (within ink-disk bridge tolerance)
analyzeRingClosure — small square, size 30px → closed=false (area below guard)
analyzeRingClosure — two half-circles as separate strokes forming one ring → closed=true
analyzeRingClosure — empty stroke list → closed=false (graceful no-op)
analyzeRingClosure — circle at 4× scale → closed=true (area guard scales; no MAX_RASTER_DIM overflow)

computeAdaptiveGap — ringR=200 → gap ≈ 24 (within [gapMin, gapMax])
computeAdaptiveGap — ringR=50  → gap = gapMin (floor clamp)
computeAdaptiveGap — ringR=900 → gap = gapMax (ceiling clamp)
computeAdaptiveGap — ringR=null, two strokes 30px apart → gap ≈ 27 (median heuristic)
computeAdaptiveGap — explicit opts.gap provided → returns opts.gap verbatim

analyzeStrokes integration — messy ring + two signs, adaptiveGap:true → ring detected, symbols segmented
analyzeStrokes integration — explicit gap:45 → matches current baseline behavior (regression)
```

Each test is a self-contained call with injected data — no Supabase, no DOM, no JSON imports.

---

## Open questions / future work

1. **Optimal `cellSize`:** the default of 2 px is a pragmatic starting point. Profiling against real
   Spell Studio drawings (exported via "Export JSON") would confirm whether 3 px or 4 px is adequate
   and faster, especially on high-DPI devices.

2. **Wobble-noise ink radius:** `inkRadius` of 4 px assumes a stylus/mouse stroke width. Touch
   devices may need a larger `inkRadius` to bridge thin spots in a wobbly circle. Consider deriving
   `inkRadius` from the average inter-point distance in the stroke (a proxy for drawing speed /
   device pressure).

3. **Reference-filtered retry for multi-stroke rings (Phase 3):** when an open ring is already
   tracked from a previous Detect run, re-running flood-fill with only ring-relevant strokes (as
   `ringDetector.js` does) prevents a distant sign stroke from "plugging" an apparent gap in the
   ring's topology and producing a false positive. Phase 3 is where this lands.

4. **`floodFill: false` escape hatch:** keeping the old `cv < 0.3 && cs.closed` path accessible via
   `opts.floodFill = false` (or `rules.recognition.floodFill = false`) means a rollback requires only
   a config change, not a code change. This should be preserved until Phase 2 has accumulated enough
   real-world evidence.
