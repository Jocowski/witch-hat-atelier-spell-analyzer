# SPEC — Numeric SpellIR + 3D Direction with Tilt

> Status: **proposed** · Scope: **engine numeric IR + 3D direction model**
> Branch: `feat/spell-studio`
> Cross-refs:
> - [SPEC-visual-renderer.md](SPEC-visual-renderer.md) (primary consumer of the SpellIR block)
> - [SPEC-sign-variants-sizing.md](SPEC-sign-variants-sizing.md) (Layer 1–3 magnitude → `force`/`power`)
> - [SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) (A2 confidence gate — low-confidence
>   symbols excluded from engine input, which affects all IR fields)
> - [docs/CORE.md](../CORE.md) (first-principles semantics that ground the field derivations)
> - [docs/IR.md](../IR.md) (the `wha-spell` JSON format; SpellIR is a new section of `analyze()` output,
>   not a replacement for it)
> - Sibling reference: `wha-spell-simulator/docs/spell-ir.md` + `src/compiler/spellBuilder.js`
>   (the proven design this spec adapts)

Items covered:

- **1.2 — Numeric SpellIR** derived from `analyze()`: a quantitative IR
  `{ force, spread, focus, range, duration, stability, gravity, direction }` emitted as a new
  section of the engine's `analyze()` output. Additive — does **not** replace any existing section.
- **1.5 — 3D direction with tilt** (`tiltFromZDeg`): extend the direction field so a stronger
  spell tilts the effect toward the paper plane; `direction` becomes
  `{ x, y, z, xTiltDeg, yTiltDeg, tiltFromZDeg }`.

---

## Background and motivation

The engine already produces a rich qualitative analysis: a deduced effect summary, symmetry/stability
labels, a power scalar, a directional aim string, spin detection, and a catalog match score. All of
this is human-readable prose or symbolic labels. **Nothing in the current output is wired to drive a
visual renderer** — the planned SPEC-visual-renderer needs numeric parameters it can plug directly
into particle systems, shaders, and effect controllers.

The SpellIR block bridges the qualitative analysis → a quantitative contract for visual and
diagnostic consumers. It is assembled from signals that the engine already computes; no new magic
knowledge is introduced here, only encoding.

The design is adapted from the sibling project's proven `SpellIR` contract
(`wha-spell-simulator/docs/spell-ir.md`). The adaptation:
- Maps the *existing* engine signals (geometry, deduction, analysis section) into the same field set
  instead of computing from a GlyphAST.
- Substitutes WHA-engine field names for the sibling's `glyphAST`-level inputs.
- Keeps the pure-module constraint: a new `assembleSpellIR(facts, cfg)` function in `src/engine/`
  takes already-computed facts (no JSON imports in the function itself); `analyze.js` binds the
  tuning config and calls it.
- Uses the **repo's existing angle convention** (0° = north, clockwise; `atan2(x, -y)`) throughout,
  and reconciles with the sibling's paper-plane x/y/z model explicitly (see §Direction convention).

---

## 1.2 — Numeric SpellIR block

### Fields

| Field | Type | Range | Meaning |
|---|---|---|---|
| `force` | number | 0..1 | Overall intensity/push of the effect. |
| `spread` | number | 0..1 | Lateral width or dispersion of the effect. |
| `focus` | number | 0..1 | Concentration / tightness (tends to be 1 - spread). |
| `range` | number | 0..1 | Travel distance or reach. |
| `duration` | number | seconds, ≥ 0 | Active lifetime of a valid spell; 0 for invalid. |
| `stability` | number | 0..1 | Resistance to failure; derived from symmetry. |
| `gravity` | number | 0..1 | Physics hint. 0 = fully suspended/floating; 1 = element falls normally. |
| `direction` | object | see §1.5 | 3D paper-plane direction vector + tilt angles. |

All 0..1 fields are clamped after derivation. `duration` is additionally clamped to the
`[irTuning.durationMinSec, irTuning.durationMaxSec]` window from `rules.json`.

### Field derivations

Every derivation below reads from the values that `analyzeCircleWith` + `deduceWith` already
compute. No new analysis pass is needed — the SpellIR assembly is a pure mapping step.

#### `force` — overall intensity

```
signPowerContrib = (number of inside-ring signs) × irTuning.forceSignPower
scaleContrib     = analysis.power × irTuning.forcePowerScale
force = clamp(irTuning.forceBase + signPowerContrib + scaleContrib)
```

- `analysis.power` is `computePower(components, { linkCount })` — already the geometric average of
  component scales plus a link bonus.
- `irTuning.forceBase`, `forceSignPower`, `forcePowerScale` live in `rules.json` under `irTuning`
  (see §Tuning constants).
- When SPEC-sign-variants-sizing.md Layer 1–3 lands, `analysis.power` will already incorporate ring
  radius and sigil size; force picks those up for free.

#### `spread` — lateral width

```
# Spread is wide when signs are radially balanced (no strong lateral aim) and tight when the aim
# is highly coherent (all signs agree on one direction).
dirCoherence = aim.magnitude from computeOrientationAim(signs)   // 0 = cancel, 1 = all aligned
spread = clamp(irTuning.spreadBase + (1 - dirCoherence) × irTuning.spreadInverseCoherence)
```

- `dirCoherence` = `aim.magnitude` from `computeOrientationAim` (already computed in `compose.js`,
  exposed as `region` / `lift` modes).
- Low coherence (signs point many ways, or cancel) → high spread (radial aura / burst).
- High coherence (all signs aligned) → low spread (tight beam or jet).

#### `focus` — concentration

```
focus = clamp(irTuning.focusBase + dirCoherence × irTuning.focusCoherence)
```

Focus moves inversely to spread. A composition with a Convergence sign should receive an extra
bonus: when `types.has('convergence')`, add `irTuning.focusConvergenceBonus`.

#### `range` — reach

```
signCountContrib = analysis.signCount × irTuning.rangeSignPower
ringContrib      = (circle.radius / CANVAS_RADIUS) × irTuning.rangeRingScale   // 0 when radius unknown
range = clamp(irTuning.rangeBase + signCountContrib + ringContrib)
```

- Ring radius feeds range per the SPEC-sign-variants-sizing.md Layer 3 model: a bigger ring = longer
  reach. `CANVAS_RADIUS` (260 px) is the reference, imported from `geometry.js` (already public).
- `circle.radius` is available on the circle object passed to `analyzeCircleWith`; it may be `null`
  for catalog-sourced spells — treat as 0 contribution when absent.

#### `duration` — active lifetime in seconds

```
qualityScore = clamp(
  symmetryScore × irTuning.durationSymmetryWeight +
  powerScore    × irTuning.durationPowerWeight
)
duration = clamp(
  irTuning.durationMinSec +
  Math.pow(qualityScore, irTuning.durationCurve) × irTuning.durationSecondsScale,
  irTuning.durationMinSec,
  irTuning.durationMaxSec
)
```

Where:
- `symmetryScore`: `radial` → 1.0, `bilateral` → 0.7, `asymmetric` → 0.3, `none` → 0.0.
- `powerScore`: `analysis.power` clamped to 0..1 (power > 1 already encodes link/scale bonuses).
- Duration is 0 when the spell is invalid (no core / no ring). Clamped between
  `irTuning.durationMinSec` (default 0.65 s) and `irTuning.durationMaxSec` (default 8.5 s).

#### `stability` — resistance to failure

```
stability = irTuning.stabilityMap[analysis.symmetry]
```

Stability is a direct encoding of the symmetry label the engine already produces:

| `analysis.symmetry` | `stability` |
|---|---|
| `radial` | 1.0 |
| `bilateral` | 0.7 |
| `asymmetric` | 0.3 |
| `none` (no signs) | 0.5 (neutral — substance only) |

Values stored in `irTuning.stabilityMap` in `rules.json`; no hardcoding in source.

#### `gravity` — suspension hint

```
hasLevitation = any sign with op.kind === 'motion' and canSteer(family) is present
liftStrength  = (count of such signs) / irTuning.gravityLevitationDivisor
gravity = clamp(1 - liftStrength × irTuning.gravityLevitationScale)
```

- When no levitation signs exist, `gravity` = 1.0 (element obeys its natural physics — fire rises,
  water falls, earth drops).
- When levitation signs are present, each reduces gravity proportionally; a sufficiently strong
  levitation set → `gravity` → 0 (fully suspended).
- `irTuning.gravityLevitationScale` (default 0.42, matching the sibling) and
  `irTuning.gravityLevitationDivisor` (default 3) live in config.

### Assembly function

```js
// src/engine/ir.js  — PURE, no JSON imports
export function assembleSpellIR(facts, cfg) { ... }
```

`facts` shape:
```js
{
  valid,           // boolean
  analysis,        // { symmetry, power, signCount, linkCount, tilted, aim, powerLabel }
  deduction,       // { ok, direction: aimLabel, stability, power }
  circle,          // the raw circle object (for radius, linkCount, ring.closed, dyes)
  signComps,       // components with role 'sign' that are inside the ring
  types,           // Set<string> of sign type ids present
  aim,             // result of computeOrientationAim (for dirCoherence / direction vector)
  region,          // result of classifyRegion (for direction mode)
}
```

`cfg` shape (bound in `analyze.js` from `rules.json → irTuning`):
```js
{
  forceBase, forceSignPower, forcePowerScale,
  spreadBase, spreadInverseCoherence,
  focusBase, focusCoherence, focusConvergenceBonus,
  rangeBase, rangeSignPower, rangeRingScale,
  durationMinSec, durationMaxSec, durationSecondsScale, durationCurve,
  durationSymmetryWeight, durationPowerWeight,
  stabilityMap,           // { radial, bilateral, asymmetric, none }
  gravityLevitationScale, gravityLevitationDivisor,
  forceTiltMaxDeg,        // for 1.5 direction tilt
  minSurfaceDirectionMagnitude,
}
```

`analyze.js` binds this once at module load (same pattern as the existing `deps` const):
```js
import { assembleSpellIR } from './ir.js'
// ...
const irCfg = RULES.irTuning   // RULES is already imported via data.js
```

And calls `assembleSpellIR(facts, irCfg)` after `analyzeCircleWith` + `deduceWith` have run,
appending the result as `spellIR` on the returned analysis object — a new key, not a replacement.

### Back-compat contract

The new `spellIR` key is **additive**. The existing output shape is unchanged:
`{ valid, active, status, issues, sigils, signs, deduction, similar, forbidden, dyes, analysis, circles, relations, combined }`.

The `spellIR` key is added alongside those fields. Any consumer that destructures only known keys
sees no change. `ResultPanel.jsx` and all existing tests remain unmodified.

---

## 1.5 — 3D direction with tilt

### Motivation

The current engine reports a directional label (`"up"`, `"contained"`, `"above the seal"`, etc.) and
a 2D `aim.angle` (compass degrees). A visual renderer needs a 3D normalized vector in the paper's
local coordinate frame so it can tilt the particle stream or effect cone correctly.

The sibling project's `directionFromSurfaceVector(surfaceDirection, force)` in
`src/compiler/spellDirection.js` provides the proven tilt math: a stronger spell tilts the effect
closer to the paper plane (z decreases, xy increases). This spec adapts that math for the repo's
angle convention.

### Convention — paper-plane coordinate frame

The repo uses **canvas coordinates** (x right, y down in SVG; Cartesian centered at origin) for
component positions, and polar with `atan2(x, -y)` for angle measurement (0° = north = up in the
UI, clockwise). The SpellIR direction vector uses a separate **paper-plane frame**:

| Axis | Direction | Neutral |
|---|---|---|
| `x` | Rightward along the paper surface | 0 |
| `y` | Downward along the paper surface (matches SVG y) | 0 |
| `z` | Out of the paper toward the viewer | 1 |

This matches the sibling's frame. The key mapping from the repo's angle convention:

```
angle (0=north, CW) → surface vector
  vx_surface =  sin(angle_rad)   // east component
  vy_surface = -cos(angle_rad)   // south component (y down = positive south = negative north)
```

This is identical to the `atan2(x, -y)` convention already used in `computeOrientationAim`:
`vx += sin(f); vy += -cos(f)` — so the surface vector from `computeOrientationAim.{ vx, vy }`
(pre-normalization) is already in this frame. **No coordinate rotation is needed.**

### 3D direction derivation

Identical to the sibling's `directionFromSurfaceVector` logic (reproduced here for completeness):

```
surfaceVector = { x: aim.vx/wsum, y: aim.vy/wsum }   // from computeOrientationAim internals,
                                                        // or computed from aim.angle + aim.magnitude
surfaceMagnitude = hypot(surfaceVector.x, surfaceVector.y)

if surfaceMagnitude < cfg.minSurfaceDirectionMagnitude:
  // No lateral aim: effect goes straight out of the paper.
  direction = { x:0, y:0, z:1, xTiltDeg:0, yTiltDeg:0, tiltFromZDeg:0 }
else:
  tiltFromZDeg = clamp(force, 0, 1) × cfg.forceTiltMaxDeg        // e.g. 76°
  tiltRadians  = tiltFromZDeg × π/180
  surfaceScale = sin(tiltRadians) / surfaceMagnitude
  x = surfaceVector.x × surfaceScale
  y = surfaceVector.y × surfaceScale
  z = cos(tiltRadians)
  xTiltDeg = degrees(atan2(x, z))
  yTiltDeg = degrees(atan2(y, z))
  tiltFromZDeg = degrees(acos(z))
  direction = { x, y, z, xTiltDeg, yTiltDeg, tiltFromZDeg }
```

Key behaviors:
- `force = 0` → `tiltFromZDeg = 0` → effect goes straight out of the paper (`z = 1`), no lean.
- `force = 1` → `tiltFromZDeg = forceTiltMaxDeg` (76° by default) → nearly in the paper plane.
- `surfaceMagnitude = 0` (balanced/opposed signs) → neutral vertical regardless of force.
- `dirCoherence = aim.magnitude` is the companion field that tells a renderer how aligned the signs
  actually are, independent of the tilt angle.

### direction field shape

```js
direction: {
  x,            // paper-surface rightward component (-1..1)
  y,            // paper-surface downward component (-1..1)
  z,            // out-of-paper component (0..1; 1 = straight up from paper)
  xTiltDeg,    // degrees tilted toward x from z axis (-82..82)
  yTiltDeg,    // degrees tilted toward y from z axis (-82..82)
  tiltFromZDeg  // total tilt from paper normal (0 = straight out, ~76 = nearly in-plane)
}
```

### dirCoherence companion field

Alongside `direction`, the IR carries a top-level `dirCoherence` (0..1) = `aim.magnitude` from
`computeOrientationAim`. A renderer uses this to distinguish:
- `direction { x:0, y:0, z:1 }` + `dirCoherence 1` → all signs aimed inward/outward, effect is
  contained or straight up.
- `direction { x:0, y:0, z:1 }` + `dirCoherence 0` → signs cancel (perfectly balanced), effect is
  a balanced radial aura.

### Neutral defaults for invalid spells

When `valid = false` (no core, or blocking issue):
```js
direction = { x:0, y:0, z:1, xTiltDeg:0, yTiltDeg:0, tiltFromZDeg:0 }
dirCoherence = 0
gravity = 1
```
All numeric fields zero except `gravity` (1 = gravity applies normally).

---

## Tuning constants (`data/rules.json → irTuning`)

All constants live in `rules.json` under a new top-level `irTuning` key so they are
**data-driven and tunable without code changes**, consistent with the repo's existing practice
(matching thresholds, zone fractions, recognition weights, etc.).

```json
"irTuning": {
  "_note": "SpellIR numeric assembly — SPEC-spell-ir.md §1.2+1.5. All 0..1 fields clamped after formula. Tuning mirrors wha-spell-simulator/src/compiler/spellBuilder.js where applicable.",

  "forceBase":         0.34,
  "forceSignPower":    0.08,
  "forcePowerScale":   0.24,

  "spreadBase":        0.32,
  "spreadInverseCoherence": 0.28,

  "focusBase":         0.46,
  "focusCoherence":    0.20,
  "focusConvergenceBonus": 0.15,

  "rangeBase":         0.42,
  "rangeSignPower":    0.05,
  "rangeRingScale":    0.20,

  "durationMinSec":    0.65,
  "durationMaxSec":    8.5,
  "durationSecondsScale": 6.4,
  "durationCurve":     1.45,
  "durationSymmetryWeight": 0.55,
  "durationPowerWeight":    0.45,

  "stabilityMap": {
    "radial":     1.0,
    "bilateral":  0.7,
    "asymmetric": 0.3,
    "none":       0.5
  },

  "gravityLevitationScale":    0.42,
  "gravityLevitationDivisor":  3,

  "forceTiltMaxDeg":   76,
  "minSurfaceDirectionMagnitude": 0.001
}
```

Starting values are adapted from the sibling compiler's `SPELL_PARAMETER_TUNING` and
`PHYSICS_TUNING` objects — verified to produce sensible output on the sibling's test spells.
Adjust after calibrating against WHA canon benchmarks (see §Acceptance).

---

## Concrete JSON example

A single-circle Watershot Seal variant (Water sigil + two Region signs facing east, radial symmetry,
large ring) would produce a `spellIR` block approximately like:

```json
"spellIR": {
  "force":    0.71,
  "spread":   0.18,
  "focus":    0.79,
  "range":    0.63,
  "duration": 4.9,
  "stability": 0.70,
  "gravity":  1.0,
  "dirCoherence": 0.88,
  "direction": {
    "x":         0.51,
    "y":         0.0,
    "z":         0.86,
    "xTiltDeg":  30.5,
    "yTiltDeg":  0.0,
    "tiltFromZDeg": 30.5
  }
}
```

A balanced Pyreball Seal (Fire sigil + inward-facing Region signs, full radial symmetry) would give:

```json
"spellIR": {
  "force":    0.58,
  "spread":   0.46,
  "focus":    0.54,
  "range":    0.52,
  "duration": 5.3,
  "stability": 1.0,
  "gravity":  1.0,
  "dirCoherence": 0.0,
  "direction": {
    "x": 0, "y": 0, "z": 1,
    "xTiltDeg": 0, "yTiltDeg": 0, "tiltFromZDeg": 0
  }
}
```

A Levitation Seal variant (Air sigil + levitation signs) would give `gravity ≈ 0.4` (partially
suspended) and `direction.z ≈ 1` (mostly out of paper, straight up from the seal surface).

---

## Module structure (pure-module constraint)

The "Critical constraint" from CLAUDE.md applies: `geometry.js` and `deduce.js` must remain free of
JSON imports so plain Node can run tests. The same rule extends to `ir.js`.

```
src/engine/
  geometry.js   — PURE, no JSON  (unchanged)
  deduce.js     — PURE, no JSON  (unchanged)
  ir.js         — PURE, no JSON  ← NEW; exports assembleSpellIR(facts, cfg)
  compose.js    — PURE, imports geometry + deduce  (unchanged)
  data.js       — imports JSON (sigils, signs, dyes, grammar)
  analyze.js    — imports JSON (rules); binds ir.js; calls assembleSpellIR
```

`ir.js` receives `facts` (already-computed objects) and `cfg` (the `irTuning` block from
`rules.json`, already loaded in `analyze.js`). It imports only `geometry.js` for the `clamp`-style
math helpers (or inline them — no new JSON deps).

The `clamp` helper does not yet exist in `geometry.js` but is a one-liner addition there
(or inline in `ir.js`):
```js
export function clamp(v, lo = 0, hi = 1) { return Math.min(Math.max(v, lo), hi) }
```

---

## Phasing & effort

### Phase 1 — Core SpellIR without direction tilt (item 1.2 only) — Effort: **S–M**

1. Add `irTuning` block to `rules.json` with the default values above.
2. Create `src/engine/ir.js` (pure): `assembleSpellIR(facts, cfg)` computing
   `force / spread / focus / range / duration / stability / gravity` + the flat
   direction stub `{ x:0, y:0, z:1, xTiltDeg:0, yTiltDeg:0, tiltFromZDeg:0 }` (placeholder
   until Phase 2). Add `dirCoherence`.
3. Wire `analyze.js`: after `analyzeCircleWith` resolves, assemble `facts`, call
   `assembleSpellIR(facts, RULES.irTuning)`, attach as `spellIR` on the return object.
   For multi-circle spells, emit `spellIR` on each per-circle result and optionally a combined
   `spellIR` on the top-level result (combined `force` = max of per-circle, `stability` = min).
4. Write `test/ir.test.js` — pure-function tests (see §Testing notes).
5. Run `npm test` — all existing tests must stay green; new tests pass.

### Phase 2 — 3D direction tilt (item 1.5) — Effort: **S**

1. Extract `surfaceVector` from `computeOrientationAim` (expose `{ vx, vy, wsum }` or recompute
   from `aim.angle + aim.magnitude`).
2. Implement `directionFromSurfaceVector(surfaceVector, force, cfg)` in `ir.js` (adapted from the
   sibling's `spellDirection.js`; pure math, no imports).
3. Replace the direction stub in `assembleSpellIR` with a call to the new function.
4. Add direction-tilt unit tests to `test/ir.test.js`.
5. Update `analyze.js` to pass the richer surface vector through `facts`.

### Phase 3 — Consumer hookup (Effort: **S**, gated on SPEC-visual-renderer)

Wire `spellIR` into `ResultPanel.jsx` (a small numeric summary row, opt-in collapsed by default)
and expose it to the AI bridge (`tools/ai-bridge.mjs`) so the report topics can reference force,
range, etc. instead of deducing them from prose.

---

## Acceptance criteria

- **Back-compat:** `npm test` passes with zero test regressions before and after Phase 1 + 2.
- **Additive:** the existing `analyze()` return shape is unchanged; `spellIR` is a new top-level key.
- **Invalid spell defaults:** when `valid = false`, all numeric fields are 0 (except
  `gravity = 1`, `direction = { x:0, y:0, z:1, ... }`).
- **Tuning in config:** no numeric constant from `irTuning` appears in the source code; each is
  read from `RULES.irTuning`.
- **Symmetry → stability mapping:** radial → 1.0, bilateral → 0.7, asymmetric → 0.3; from config.
- **Pyreball baseline:** a balanced radial Pyreball Seal yields
  `direction = { x:0, y:0, z:1 }`, `dirCoherence ≈ 0`, `stability = 1.0`,
  `spread > focus` (radial aura), `gravity = 1`.
- **Directed spell:** a Water sigil + two east-facing Region signs yields `direction.x > 0`,
  `direction.z < 1` (tilted toward east), `dirCoherence > 0.5`, `spread < 0.4`.
- **Levitation spell:** an Air sigil + levitation sign yields `gravity < 0.7`.
- **Force-tilt coupling:** doubling `force` (by increasing component scales) tilts the
  `tiltFromZDeg` proportionally toward `forceTiltMaxDeg`.
- **Neutral when signs cancel:** two opposing equal-scale Column signs produce
  `direction = { x:0, y:0, z:1 }`, `dirCoherence ≈ 0`.
- **Ring radius → range:** same spell in a larger ring (`circle.radius` = 2×) yields higher `range`.

---

## Testing notes

All tests for `ir.js` and the direction tilt live in `test/ir.test.js`, plain `node --test`
(no Vite, no JSON import attributes). JSON config is loaded via `createRequire` and injected into
`assembleSpellIR` as `cfg`, keeping `ir.js` pure.

Suggested test cases (not exhaustive):

```js
// 1. Invalid spell → all zeros (gravity=1, neutral direction)
// 2. Radial symmetry → stability 1.0, duration in [durationMinSec, durationMaxSec]
// 3. Asymmetric → stability 0.3, lower duration than bilateral
// 4. Convergence sign present → focus bonus applied
// 5. Levitation sign present → gravity < 1
// 6. Multiple levitation signs → gravity lower than single
// 7. directionFromSurfaceVector({ x:0, y:0 }, 0.8) → z=1, tiltFromZDeg=0 (no surface lean)
// 8. directionFromSurfaceVector({ x:1, y:0 }, 0.5) → x>0, tiltFromZDeg ≈ 0.5×76=38
// 9. directionFromSurfaceVector({ x:1, y:0 }, 1.0) → tiltFromZDeg ≈ 76 (max tilt)
// 10. Vector is normalized: hypot(x,y,z) ≈ 1 for all valid inputs
// 11. Larger ring radius → higher range than same spell in smaller ring
// 12. force clamp: adding signs beyond ceiling → force stays ≤ 1
```

Tests for the pure direction function should import `ir.js` directly (or the extracted helper):

```js
import { directionFromSurfaceVector } from '../src/engine/ir.js'
// ... drive with surface vectors and force values, assert x/y/z/tiltFromZDeg
```

The geometry test file (`test/geometry.test.js`) already tests `computeOrientationAim` and the
polar convention. The IR tests extend that coverage without duplicating it.

---

## Open questions

- **Multi-circle spellIR:** for linked/nested spells the most natural contract is per-circle
  `spellIR` entries (each circle gets its own block) plus an optional combined summary
  (max-force, min-stability). Pin this in Phase 3 when the renderer spec clarifies what it needs.
- **Dyes contribution:** dyes currently appear in the analysis as informational text. If a dye is
  documented to extend duration (e.g. a time-infused ink), it should add a `lifetimeBias` delta to
  the duration formula. Defer until the dye semantics in `dyes.json` are enriched with numeric
  parameters; add a `dyeLifetimeBias` accumulator hook in the formula now so it's trivial to wire
  in later.
- **`quality` / `neatness`:** the sibling heavily weights neatness into duration and force. This
  repo has no global neatness metric yet (the recognizer produces per-symbol confidence but not a
  spell-level neatness score). For Phase 1, treat neatness as 1.0; reserve a `facts.neatness`
  slot that `assembleSpellIR` will use once the recognizer exposes it (SPEC-recognizer-analysis
  A2/A4 landing zone).
- **`forceTiltMaxDeg` calibration:** the sibling uses 76° based on visual testing with their
  renderer. Calibrate against the WHA visual renderer once SPEC-visual-renderer is implemented;
  the constant lives in config so no code change is needed.
