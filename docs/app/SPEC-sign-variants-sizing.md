# SPEC — Sign variants & magnitude (size of signs / sigils / circles)

> Status: **proposed (research-leaning)** · Scope: **engine deduction + sign metadata + recognizer metrics**
> Branch: `feat/spell-studio` · Cross-refs: [docs/CORE.md](../CORE.md) (geometry as parameters),
> [ANALYSIS.md](../../ANALYSIS.md) §8 (deduction), [src/engine/geometry.js](../../src/engine/geometry.js),
> [SPEC-symbol-versioning.md](SPEC-symbol-versioning.md) (variants are a kind of revision).

## The problem (the Column "T" example)
A **Column** sign reads like a **T**: a *base* (the cross-bar) and a *line/stem*. Canon behavior the user
described:
- Two Columns **facing each other** (one `T` pointing down, one `⊥` pointing up) → their pushes **cancel**;
  the spell has no net direction.
- But if one Column is **much larger along its stem** (longer line, same base) than the other, the spell
  **goes the way the bigger one points** — magnitude, not just direction, decides the outcome.

So two things matter that the engine doesn't fully model yet:
1. **Magnitude** of a directional sign (how strongly it pushes), and
2. **Variant / internal proportion** (Column's *stem length* specifically — not the uniform glyph size).

## What the engine does today (verified)
The engine already has a **vector model with cancellation**, but it's magnitude-blind in the key place:
- [`computeOrientationAim`](../../src/engine/geometry.js#L184) sums each directional sign's facing as a
  **unit vector** (`vx += sin(f); vy += -cos(f)`), divides by count. **Two opposing facings cancel
  exactly regardless of size** — this is precisely why "bigger Column wins" can't be expressed yet.
- [`computeDirectionalBias`](../../src/engine/geometry.js#L96) (position-based) and
  [`computeRegionCoverage`](../../src/engine/geometry.js#L205) **already weight by `c.scale`** (`w = c.scale`).
- [`computePower`](../../src/engine/geometry.js#L256) uses average `scale`.
- The composition carries a per-component **uniform `scale`** but **no internal-proportion metric** (a T
  with a long stem and a T with a long base have the same `scale`).

## Design — three layers

### Layer 1 — Magnitude-weighted resultants (cheap, high value)
Make the *facing* resultant respect magnitude, mirroring the position-based ones.
- In `computeOrientationAim` (and any facing sum), weight each facing vector by a per-sign magnitude
  `w` instead of 1: `vx += sin(f) * w`. Default `w = c.scale` so **uniform** size differences already
  break the tie (a 2× Column beats a 1× Column → net push its way). Keep the function **pure** (magnitude
  comes in on the component, no JSON import).
- Normalize by `Σw` (not count) so a lone large sign doesn't inflate `magnitude` past 1.
- **This alone solves the user's example when "bigger" means uniformly bigger.** It's a small, testable
  change with a clear unit test: two opposing Columns, `scale` 1 vs 2 → net aim points the 2× way.

### Layer 2 — Variant metrics (the real Column case: stem length)
Uniform `scale` can't tell "long stem" from "long base". Capture the **proportion that matters per sign**.
- **Metadata (data-driven):** add to `signs.json` an optional `params` block declaring measurable axes
  and what effect parameter they drive, e.g.:
  ```jsonc
  // Column
  "params": {
    "thrust": { "measure": "axisLengthAlongFacing", "affects": "directionalMagnitude", "ref": "ringR" }
  }
  ```
  `measure` names a geometric extractor (principal-axis length, length along the facing direction, aspect
  ratio, stroke-count, enclosed area…); `affects` names the deduction parameter; `ref` is what to
  normalize against (ring radius, base length) so it's scale-independent.
- **Extraction:** two sources of the metric:
  - **Drawn symbols:** the recognizer already isolates each group's strokes
    ([recognizer.js](../../src/draw/recognizer.js)). Extend group analysis to compute the declared
    `measure` (e.g. project the group's points onto the facing axis → length; ratio to `ringR`) and
    attach a `metrics` object to the emitted component.
  - **Placed symbols:** derive from the placed glyph's transform (non-uniform scale if we ever allow it,
    else fall back to uniform `scale`). For now placed = uniform.
- **Composition contract:** extend each component with optional `metrics: { [param]: number }` (additive,
  back-compat — absent ⇒ Layer-1 behavior with `w = scale`).
- **Engine consumption:** `deduceWith`/geometry use `metrics.directionalMagnitude ?? scale` as the `w`
  for that sign, and surface the variant in the readout ("Column (long stem) → strong downward thrust").
- **Variants as named presets (optional sugar):** for catalog/teaching, allow discrete variants in data
  (e.g. `column_short`, `column_long` as the *same* engine id with a `variant` tag + default metric), so
  `spells.json` can reference a specific proportion without measuring. This ties into
  [SPEC-symbol-versioning.md](SPEC-symbol-versioning.md): a new canon-clarified variant bumps the sign's
  `lifecycle.rev` and flags dependent spells for review.

### Layer 3 — Sizing of sigils & circles (spell-level magnitude)
Generalize "size matters" beyond signs.
- **Ring radius → power/range baseline.** The recognizer already computes `ringR`
  ([recognizer.js:111](../../src/draw/recognizer.js#L111)); feed it (normalized) into `computePower`/range
  so a bigger circle = a stronger / longer-range spell, per canon intuition. Today `ringR` is computed
  but not used as a power input.
- **Sigil size → substance amount.** A larger core sigil ⇒ more substance/output (scales the effect
  magnitude, not direction). Use core `scale`/measured size as an amount multiplier in the deduction.
- **Relative circle sizes (nested/linked).** When multi-circle lands (see §D in IMPROVEMENTS / nested
  spec), the **relative** radii set relative influence (a large outer ring dominating a small inner one,
  etc.). Defer the cross-circle math to that work; this spec just reserves the hook (per-circle magnitude
  scalar from radius).

## Interactions
- **Dyes-in-deduction** ([IMPROVEMENTS.md](IMPROVEMENTS.md) §C/P1) is the *same shape of change* —
  another magnitude/parameter input feeding power/duration. Build the **magnitude plumbing once** (a
  per-effect `{ direction, magnitude, params }` accumulator in the deduction) and let scale, variant
  metrics, ring size, sigil size, and dyes all contribute through it.
- **Recognizer confidence** ([SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) A2): variant
  measurement is only as good as the segmentation; low-confidence groups should not assert a precise
  magnitude.

## Phasing & effort
1. **Layer 1** — magnitude-weight `computeOrientationAim` (default `w = scale`), normalize by Σw, unit
   test the opposing-Column case. **Effort: S.** Immediately makes "bigger sign wins" true for uniform size.
2. **Layer 2a** — `params`/`metrics` schema + engine consumption (`w = metrics ?? scale`) + readout.
   **Effort: M.**
3. **Layer 2b** — recognizer geometric extractors (axis length along facing, ratios). **Effort: M–L**
   (geometry + tests; keep `recognizer.js` pure).
4. **Layer 3** — ring/sigil size into power/range; reserve per-circle scalar for nested work. **Effort: M.**

## Acceptance
- **L1:** two opposing Columns with `scale` 1 vs 2 → engine reports a net aim toward the larger; equal
  sizes still cancel. Pure-function test in `test/geometry.test.js`.
- **L2:** a drawn Column with a long stem vs a long base (same overall bounding box) yields different
  `directionalMagnitude`; the readout names the variant.
- **L3:** a larger ring yields higher reported power/range than an identical spell in a small ring.
- All existing 133 tests stay green (changes are additive; `metrics` absent ⇒ old behavior).

## Open questions (for the Spell Checkers community)
- Does Column's push scale with **absolute stem length** or **stem-to-base ratio**? (Drives `measure`/`ref`.)
- Do other signs have known variant axes (e.g. arrow length, enclosure size)? Catalog them in `signs.json`
  `params` as findings accrue.
- Is ring size canonically a **power** lever, a **range** lever, or both?
