# SPEC — Magnitude plumbing, dyes-in-deduction, and sign variants & sizing (unified)

> Status: **proposed** · Scope: **engine deduction + data schemas + recognizer metrics**
> Branch: `feat/spell-studio`
> Cross-refs:
> [SPEC-sign-variants-sizing.md](SPEC-sign-variants-sizing.md) (superseded — Layers 1/2/3
> with the Column "T" canonical example; Layer 1 already shipped),
> [SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) (confidence gate bounds metric
> precision — §A2),
> [SPEC-symbol-versioning.md](SPEC-symbol-versioning.md) (a new variant bumps lifecycle.rev
> and flags dependent spells),
> [docs/CORE.md](../CORE.md) §1 (geometry as parameters), [docs/IR.md](../IR.md) §2 (the
> `wha-spell` circle shape — dyes per-circle, component scale/metrics),
> [docs/magical-dye.md](../magical-dye.md), [data/dyes.json](../../data/dyes.json),
> [data/grammar.json](../../data/grammar.json), [data/rules.json](../../data/rules.json),
> [src/engine/geometry.js](../../src/engine/geometry.js),
> [src/engine/deduce.js](../../src/engine/deduce.js),
> [src/engine/analyze.js](../../src/engine/analyze.js).

---

## Motivation

CORE.md §1 defines the full evaluation model as:

```
effect = SUBSTANCE ▶ OPERATORS ▶ GEOMETRY ▶ ACTIVATION ▶ INK (dyes)
```

The engine implements the first four tiers. **Dyes are still informational** (surfaced as a
display list, never feeding the numeric deduction — CLAUDE.md: "Magical dyes are informational
... they don't yet change the numeric power/duration"). At the same time, SPEC-sign-variants-
sizing.md identified that sign scale (Layer 1, shipped), variant proportions (Layer 2), and
ring/sigil sizing (Layer 3) all need to feed the same numeric output. IMPROVEMENTS.md §C notes
these are "the same shape of change" and calls for building the **magnitude plumbing once**.

This spec unifies all three work items:

| Item | What it unlocks |
|---|---|
| **3.2 — Shared magnitude plumbing** | A `{ direction, magnitude, params }` accumulator that all sources contribute through — the foundation the other two items rest on. |
| **3.1 — Dyes affect the deduction** | Wire `dyes.json` kinds (`power`, `duration`, `visibility`, `durability`, `glow`, `unknown`) into the accumulator so the deduced effect reflects the ink. |
| **Track 4 — Sign variants & sizing (Layers 2/3)** | Layer 2: per-sign `params`/`metrics` capturing internal proportions (e.g. Column stem length); Layer 3: ring radius and sigil scale as spell-level power/range inputs. Layer 1 (magnitude-weighted resultants in `computeOrientationAim`) is already shipped and serves as the blueprint. |

---

## What is already shipped (Layer 1 baseline)

`computeOrientationAim` in `src/engine/geometry.js` already:

- Weights each directional sign's facing vector by `magnitudeOf(c)` (not a unit vector):
  `vx += sin(f) * w`, `vy += -cos(f) * w`.
- Resolves `magnitudeOf(c)` as `c.metrics?.directionalMagnitude ?? c.scale ?? 1` — so a
  future Layer-2 metric drops in without changing the geometry call site.
- Normalises by `Σw` (not count) — a lone large sign does not push `magnitude` past 1.
- `computeDirectionalBias` and `computeRegionCoverage` already weight position vectors by
  `c.scale` (same pattern).

The Column "T" acceptance test for Layer 1 passes: two opposing Columns with `scale` 1 vs 2
produce a net aim toward the larger; equal sizes cancel to magnitude 0.

The new work builds on top of this; no geometry already shipped needs to change.

---

## Design

### 3.2 — Shared magnitude accumulator

#### Shape

The deduction currently threads numeric outputs (`power`, `direction`, `stability`) as loose
scalars. Replace them with a single **magnitude accumulator** that flows through
`deduceWith`/`analyzeCircleWith` and surfaces on the result:

```ts
interface MagnitudeAccumulator {
  // Directional result (already computed by computeOrientationAim / classifyRegion).
  direction: { aimed: boolean; angle: number; magnitude: number }

  // Scalar spell power [0..N, default 1]. Multiplicative contributions stack.
  power: number          // baseline from computePower(components)

  // Scalar effect duration modifier [0..N, default 1]. Additive contributions stack.
  duration: number       // baseline 1 (no modifier)

  // Freeform parameter bag: additional effect properties surfaced in the readout
  // (e.g. "invisible", "glows in dark", "waterproof", variant labels).
  params: Record<string, number | string | boolean>
}
```

A `MagnitudeAccumulator` starts as `{ direction: <from geometry>, power: 1, duration: 1,
params: {} }` and is populated by four contribution passes in order:

1. **Ring size** (Layer 3a) — scales `power` (and optionally `range` in `params`).
2. **Sigil size** (Layer 3b) — scales `power` with the core sigil's `scale`.
3. **Sign variant metrics** (Layer 2) — updates `params.variantLabel` and may shift the
   `direction.magnitude` already computed by Layer 1.
4. **Dyes** (3.1) — apply `kind`-based modifiers to `power`, `duration`, or `params`.

#### Pure-module constraint

`geometry.js` and `deduce.js` **must remain free of JSON imports** (CLAUDE.md: "Do not add a
JSON import to geometry.js or deduce.js — it will break the Node test suite"). The accumulator
is therefore:

- **Defined and assembled in pure code** (`geometry.js` exposes the geometric inputs;
  `deduce.js` returns the raw numeric outputs alongside the text summary).
- **Data injected via `analyze.js`** / `analyzeCircleWith` in `compose.js`, which already
  holds the JSON-bound `deps` object (`grammar`, `RULES`, `DYE_MAP`, `zones`). The dye
  multipliers and ring-size tunables live in `dyes.json` / `rules.json` and reach the
  accumulator only through `analyzeCircleWith`.

Concretely: `deduceWith(grammar, sigilMap, signMap, composition)` stays its current signature.
The accumulator is **assembled by the caller** (`analyzeCircleWith`) from the geometry results
+ dye pass, and attached to the returned section alongside `deduction`.

#### Data-driven tunables in `rules.json`

Add a `magnitude` block (no hardcoded numbers in engine code):

```jsonc
"magnitude": {
  "ringSize": {
    "note": "Normalised ring radius (ringR / CANVAS_RADIUS) → power multiplier. Clamp to [0.5, 3.0].",
    "referenceR": 260,       // CANVAS_RADIUS — same constant as geometry.js
    "minMultiplier": 0.5,
    "maxMultiplier": 3.0
  },
  "sigilSize": {
    "note": "Core sigil scale → substance-amount multiplier.",
    "defaultScale": 1
  },
  "linkBonus": {
    "note": "Already in computePower: power *= 1 + min(linkCount,5)*0.2. This block is the authoritative source.",
    "perLink": 0.2,
    "maxLinks": 5
  }
}
```

Dye multipliers live in `dyes.json` (see §3.1 below). Variant params live in `signs.json`
(see §Track-4 below). No magic numbers in engine source files.

---

### 3.1 — Dyes affect the deduction

#### Current state

`analyzeCircleWith` in `compose.js` surfaces dyes as a display list. `DYE_MAP` is already
injected into `deps`, so the data is in scope; it just is not applied to the accumulator.

#### Dye kinds and how they contribute

The current `dyes.json` entries carry a `kind` field. Mapping of each known kind:

| `kind` | Accumulator target | Contribution | Canon source |
|---|---|---|---|
| `power` | `accumulator.power` | multiplicative (e.g. Blood: × `powerMultiplier`) | magical-dye.md: "greatly increases the power" |
| `duration` | `accumulator.duration` | multiplicative (e.g. Azuremoon Flower: × `durationMultiplier`) | magical-dye.md: "increases the duration" |
| `visibility` | `accumulator.params.sealVisible` | sets to `false` | magical-dye.md: "makes the drawn seal invisible" |
| `durability` | `accumulator.params.waterproof` | sets to `true` | magical-dye.md: "makes the drawn seal waterproof" |
| `glow` | `accumulator.params.glowsInDark` | sets to `true` | magical-dye.md: "makes the ink glow in the dark" |
| `unknown` | no change (warning in readout) | — | Dragon Egg Shells, Dragon Scales, Tranquileaf |

`power` and `duration` multipliers are defined per-dye in `dyes.json` (data-driven, not
hardcoded). Blood is canonically a large multiplier ("a simple light spell causes a giant
flash"; "creates a canyon") — a value in the range 3–5× is a reasonable placeholder,
calibrated later via the Spell Checkers community. Azuremoon Flower is a moderate duration
boost (placeholder: 2×).

#### Schema addition to `dyes.json`

Each dye gains an optional `modifier` block:

```jsonc
{
  "id": "blood",
  "kind": "power",
  "modifier": { "powerMultiplier": 4.0 }
},
{
  "id": "azuremoon_flower",
  "kind": "duration",
  "modifier": { "durationMultiplier": 2.0 }
},
{
  "id": "blushing_bride_scales",
  "kind": "visibility",
  "modifier": { "sealVisible": false }
},
{
  "id": "golden_blaze_wyrm_scales",
  "kind": "glow",
  "modifier": { "glowsInDark": true }
},
{
  "id": "roaming_scallop_shells",
  "kind": "durability",
  "modifier": { "waterproof": true }
}
```

Dyes with `kind: "unknown"` carry no `modifier`; the engine surfaces them as "Effect unknown
— this dye's contribution to the deduction is not yet modelled."

#### Deduction readout

`deduceWith` returns the text summary; `analyzeCircleWith` assembles the accumulator after
calling it. The readout sentence does **not** need to change for `power`/`duration` — those
are surfaced as numeric fields on the accumulator (and rendered in the analysis panel). The
`params` boolean flags (invisible, waterproof, glow) are appended as inline notes in the
displayed analysis: "The seal is **invisible** (Blushing Bride Scales)."

Multiple dyes stack: `power` multipliers multiply together; `duration` multipliers multiply
together; boolean `params` entries OR together. Stacking an unknown dye adds a "contains dyes
with unknown effect" warning.

#### Where in the call chain

```
analyze(input)
  └─ analyzeCircleWith(deps, circle)           ← deps includes DYE_MAP
       ├─ deduceWith(...)                      ← pure; returns summary + stability + powerLabel
       ├─ buildAccumulator(circle, geometry)   ← new pure helper in compose.js (or analyze.js)
       │    ├─ pass 1: ring size  → power *= ringMultiplier(circle.radius)
       │    ├─ pass 2: sigil size → power *= core.scale
       │    ├─ pass 3: variant metrics (already applied inside computeOrientationAim via
       │    │           magnitudeOf(c) — no extra pass needed here; variant label from
       │    │           sign params is surfaced in pass 3 if metrics present)
       │    └─ pass 4: dyes       → apply modifier per DYE_MAP[dyeId]
       └─ return { ..., accumulator }          ← new field on the circle analysis result
```

`buildAccumulator` imports **no JSON** (its data arrives via `deps`), so it can live in
`compose.js` alongside `analyzeCircleWith` without violating the pure-module constraint.

---

### Track 4 — Sign variants & sizing (Layers 2 and 3)

Layer 1 is shipped. Layers 2 and 3 are described here building on the existing design in
SPEC-sign-variants-sizing.md.

#### Layer 2 — Variant metrics (the real Column case: stem length)

**The problem.** Uniform `scale` cannot distinguish a Column with a long stem from one with a
long base — two drawings with the same bounding box but different internal proportions. Canon
demonstrates that stem length specifically determines how strongly a Column pushes.

**Metadata schema — `params` in `signs.json`.**

Each sign that has a meaningful measurable axis gains an optional `params` block:

```jsonc
// Column (id: "column")
"params": {
  "thrust": {
    "measure": "axisLengthAlongFacing",
    "affects": "directionalMagnitude",
    "ref": "ringR",
    "note": "Stem length projected onto the facing direction, normalised by ring radius."
  }
}
```

Fields:

| Field | Meaning |
|---|---|
| `measure` | The geometric extractor to run on the drawn strokes. Named extractor ids defined in the recognizer (see below). |
| `affects` | The `metrics` key written onto the emitted component. `directionalMagnitude` is the key already read by `magnitudeOf(c)` in `geometry.js`. |
| `ref` | Normalisation reference: `ringR` (ring radius, already computed as `composition.ringR` by the recognizer), `baseLength`, `aspect`. |

**Named geometric extractors** (implemented in `src/draw/recognizer.js` or a new
`src/draw/metrics.js` helper; pure functions, no JSON):

| Extractor id | What it computes |
|---|---|
| `axisLengthAlongFacing` | Project the group's bounding strokes onto the sign's facing axis (the direction it would push). Returns the distance, normalised by `ref`. |
| `aspectRatio` | Bounding-box width ÷ height (or height ÷ width, whichever > 1). |
| `strokeCount` | Raw number of strokes in the group (useful for signs where repeat strokes amplify). |
| `enclosedArea` | Approximate enclosed area as fraction of `ringR²` (for loop-shaped signs). |

Only `axisLengthAlongFacing` is needed for Column (Layer 2a). Others are reserved for future
signs as their variant axes are identified by the Spell Checkers community.

**Composition contract extension** (additive, back-compat):

```jsonc
{
  "id": "s0", "type": "column", "role": "sign",
  "x": 0, "y": -150, "rotation": 0, "scale": 1.2, "inverted": false,
  "metrics": { "directionalMagnitude": 1.8 }   // ← new optional field
}
```

Components without `metrics` fall back to `w = scale` (Layer 1 behavior). The `wha-spell@1`
IR format round-trips `metrics` transparently (no version bump needed — it is an additive
optional field).

**Engine consumption.** `magnitudeOf(c)` in `geometry.js` already reads
`c.metrics?.directionalMagnitude ?? c.scale ?? 1`. No engine change is needed for Layer 2a
once the recognizer writes the field.

**Recognizer integration.** After `$P` identifies a group as `column`, check whether the
sign's `params` block declares a `measure`. If so, run the named extractor on the group's
stroke points and write the result to `metrics[affects]`. Low-confidence groups
(below `rules.recognition.confidenceMinPct`) must NOT assert a metric — set `metrics`
to undefined in that case (SPEC-recognizer-analysis.md §A2 constraint).

**Placed (palette-dragged) symbols.** Non-drawn placements have no stroke geometry. They
fall back to `w = scale` (Layer 1). Non-uniform scale (if the UI ever exposes it) would
map naturally to the relevant metric axis; for now placed = uniform = Layer 1.

**Variant named presets (optional sugar).** For catalog/teaching purposes, `spells.json`
may reference `column_long` as a shorthand for `column + metrics.directionalMagnitude = 1.8`.
Implement as a thin lookup in the catalog matcher (not in the engine core). Ties into
SPEC-symbol-versioning.md: a newly identified canon variant bumps `lifecycle.rev` on the sign
and flags dependent catalog spells for review.

#### Layer 3 — Sigil and ring sizing

**Ring radius → power/range baseline (Layer 3a).**

The recognizer already computes `ringR` (the detected ring radius in px) and attaches it to
the composition root. It is passed into `analyzeCircleWith` via the circle's `radius` field
(IR.md §2: `"radius": 170`). Today `computePower` uses average component scale but ignores
`ringR`.

Contribution to the accumulator:

```
ringMultiplier = clamp(circle.radius / rules.magnitude.ringSize.referenceR,
                       rules.magnitude.ringSize.minMultiplier,
                       rules.magnitude.ringSize.maxMultiplier)
accumulator.power *= ringMultiplier
```

When `circle.radius` is null (catalog recipes, which carry no drawn geometry), the multiplier
defaults to 1 (neutral, backward-compatible). The `params` bag may additionally carry
`range: ringMultiplier` to drive a "range" label in the readout ("larger ring: extended range").

**Sigil size → substance amount (Layer 3b).**

A larger core sigil conjures or manipulates proportionally more substance. Contribution:

```
accumulator.power *= (circle.core?.scale ?? 1)
```

This stacks with the ring multiplier. Both are multiplicative so that default `scale = 1` and
default `radius = CANVAS_RADIUS` yield a net multiplier of exactly 1 (no change from current
behavior).

**Relative circle sizes (nested/linked — deferred).**

When multi-circle spells land (IMPROVEMENTS.md §D), the relative radii of outer vs. inner
rings set relative influence. Reserve a per-circle magnitude scalar slot in the accumulator
now; the cross-circle math is deferred to the nested-spell spec.

---

## Phasing and effort

All phases are ordered so the **plumbing lands first** — dyes and variant metrics both arrive
through the accumulator, never around it.

| Phase | What ships | Effort | Constraint |
|---|---|---|---|
| **P0 — Accumulator scaffold** | `buildAccumulator` in `compose.js` (pure, injected data); adds `accumulator` to the `analyzeCircleWith` return; ring + sigil size pass with rules.json tunables; existing tests unchanged. | **S** | Must land before P1/P2. All 133 tests stay green. |
| **P1 — Dyes feed the accumulator** | `modifier` fields in `dyes.json`; accumulator pass 4 applies `power`/`duration` multipliers + boolean `params`; readout surfaces dye effects beyond the display list. | **S** | Depends on P0. Back-compat: no dyes ⇒ no change. |
| **P2a — Layer 2 schema + engine wire-up** | `params` block in `signs.json` for Column (and other signs with identified variant axes); `metrics` field on the composition component; `magnitudeOf` already reads it (no engine change). | **S** | Depends on P0. Recognizer change is P2b. |
| **P2b — Recognizer geometric extractor** | `axisLengthAlongFacing` extractor in recognizer/metrics.js; runs when `$P` identifies a symbol whose `params.measure` matches; writes `metrics[affects]` on the component; gated by confidence threshold. | **M–L** | Depends on P2a. Keep extractor pure (no JSON). |
| **P3 — Variant named presets** | `column_long` / `column_short` shorthand in catalog/tests; lifecycle integration with SPEC-symbol-versioning.md. | **M** | Depends on P2a. |

---

## Acceptance criteria

### P0 — Accumulator scaffold
- `analyzeCircleWith` returns an `accumulator` field for every circle.
- A spell with `circle.radius = CANVAS_RADIUS` and `core.scale = 1` and no dyes yields
  `accumulator.power` equal to what `computePower` returns today (neutral multiplier = 1).
- A spell with `circle.radius = CANVAS_RADIUS * 2` yields `accumulator.power` double that of
  the reference spell, capped at `maxMultiplier` from rules.json.
- All 133 existing tests pass (changes are additive; no existing call site changes).

### P1 — Dyes
- A spell with `dyes: ["blood"]` yields `accumulator.power` scaled by `powerMultiplier` from
  `dyes.json` (e.g. 4×).
- A spell with `dyes: ["azuremoon_flower"]` yields `accumulator.duration` scaled by
  `durationMultiplier` (e.g. 2×).
- A spell with `dyes: ["blushing_bride_scales"]` yields `accumulator.params.sealVisible = false`.
- A spell with `dyes: ["dragon_egg_shells"]` (kind `unknown`) surfaces a warning in
  `deduction.warnings`; power/duration unchanged.
- Multiple dyes stack correctly (blood + azuremoon → power ×4, duration ×2).

### P2a — Layer 2 schema
- `signs.json` Column entry carries a `params` block.
- A component with `metrics: { directionalMagnitude: 1.8 }` causes `computeOrientationAim` to
  weight that sign as 1.8 instead of its `scale`.
- The Column "T" acceptance test from SPEC-sign-variants-sizing.md: two opposing Columns,
  one with `metrics.directionalMagnitude = 1.8` and one with `scale = 1` (no metrics), produce
  a net aim toward the `1.8` sign. (This is the canonical variant test.)
- Components without `metrics` continue to use `w = scale` (Layer 1 fallback).

### P2b — Recognizer extractor
- A drawn Column with a long stem produces `metrics.directionalMagnitude > 1` (normalized by
  ringR); one with a long base produces `metrics.directionalMagnitude < 1` (same scale, same
  bounding box).
- A low-confidence detection (below `confidenceMinPct`) does not write `metrics`.
- The extractor passes unit tests in `test/recognizer.test.js` without importing JSON.

### P3 — Named presets
- `column_long` in `spells.json` resolves to `column` + default `metrics.directionalMagnitude`
  from the preset without breaking existing catalog tests.

---

## Testing notes

- The accumulator is pure (data injected) and therefore fully testable under `node --test`
  using `createRequire` to load JSON (same pattern as existing tests in `test/deduce.test.js`).
- Existing `test/geometry.test.js` already exercises `computeOrientationAim` for the Layer-1
  case; add the Column variant case there (two opposing, one with metrics > the other).
- `test/deduce.test.js` exercises `deduceWith` directly — it does not need to change for the
  accumulator (which lives in `analyzeCircleWith`). Add an integration test in
  `test/analyze.test.js` for dye multipliers and ring-size scaling.
- `test/data.test.js` integrity: once `params` is added to a sign in `signs.json`, confirm the
  referenced `measure` id exists in the recognizer's named-extractor registry.

---

## Open questions (for the Spell Checkers community)

- **Blood multiplier calibration.** Canon shows a simple light spell → giant flash; an earth
  crush → a canyon. Is the power boost uniform across elements, or element-scaled? The
  placeholder 4× is conservative.
- **Azuremoon Flower duration.** Is the boost proportional to the base spell's duration, or
  flat? Does it stack additively with neatness?
- **Column stem vs base ratio.** Does Column's thrust scale with absolute stem length or
  stem-to-base ratio? (Drives `ref` in the `params` block: `ringR` vs `baseLength`.)
- **Other sign variant axes.** Which other signs have known proportion axes? E.g. does Pull
  sign width affect vortex radius? Does Levitation sign size affect lift capacity?
- **Ring size: power vs range.** Is a larger ring canonically a *power* lever, a *range* lever,
  or both independently? Determines whether `ringMultiplier` feeds `power` only or also a
  separate `range` entry in `params`.
- **Dragon Egg Shells, Dragon Scales, Tranquileaf.** Effects not yet identified in canon
  (World Guide 2026 notes them as "highly sought after" without specifying). Leave as
  `kind: "unknown"` until confirmed.
