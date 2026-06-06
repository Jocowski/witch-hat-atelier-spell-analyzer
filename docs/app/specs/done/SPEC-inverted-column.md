# SPEC — Inverted Column render (the "spread around the seal" operator)

> Status: **implemented & shipped** (L0–L5) · Branch: `feat/spell-studio-experiments`.
> **Outcome:** the engine flags inverted seals (`flow.inverted`, Φ<0) and emits a `radialSpread` block;
> a shared `radialSpread.js` fountain renderer (dispatched once in `SpellEffectRenderer`) spreads the
> substance outward around the seal — even when balanced, biased when not. A follow-up **canon pressure
> curve** (`pressureLateralShare`, §Pressure curve below) makes a ~2× column steer hard, matching the
> manga. Tests **503 pass / 0 fail**, `npm run lint` 0 errors, `npm run build` clean. Verified live in
> `npm run dev` (balanced → even dome; oversized column → strong sideways bias; nothing behind the ring).
> Precedent / sibling: the Column / einlair flow feature
> (`docs/theories/einlair-vector-analisys/`, `computeColumnFlow`) and **SPEC-orb-container** (same
> layered shape: theory → data → geometry → IR → renderer → tests).
>
> Goal: make the **inverted (outward-facing) Column** render correctly at cast time. The engine already
> *computes* the inverted-flow facts; the renderer ignores them and wrongly shoots the spell straight
> up. This spec routes those facts into a new **radial-spread ("fountain") render mode**: the substance
> floods outward around the seal instead of jetting up — evenly when balanced, lopsided (or swirling)
> when not.

---

## 0. The model (the thing every layer must agree on)

A Column is a flow vector `cᵢ = magnitude · facing`. The einlair model (already in
`computeColumnFlow`) splits the seal's total inflow `T = Σ|cᵢ|` into a coherent radial residual
`R = |Σcᵢ|` (pointing at `netAngle`) and out-of-plane flow `U = T − R`, gated by the signed flux
`Φ = Σaᵢ` (radial-inward component). **Inward** (`Φ>0`) opens the `U` budget; **outward / inverted**
(`Φ<0`) closes it (`U=0`) — everything must leave radially.

That gives a 2×2 of column behaviors. The **left column is already handled** by the existing
direction pipeline (`aim` → `direction.z`); **this spec implements the right column.**

| | **Balanced** (`R≈0`) | **Not balanced** (`R>0`) |
|---|---|---|
| **Inward** (`Φ>0`, U open) | erupts straight **UP** *(done — `z≈1`)* | **leaning jet** toward `netAngle` *(done — `aim`)* |
| **Outward** (`Φ<0`, U closed) | **even radial spread** — ward/wall *(THIS SPEC)* | **biased / swirling spread** *(THIS SPEC)* |

**Plain-language behavior (what the render must read as):**
- **Outward + Balanced** — substance presses out against the rim and spreads **evenly in every
  direction**; no upward shoot. A ward / wall / cage around the seal.
- **Outward + Not balanced** — same outward spread, **no rise**, but **thicker and farther on the
  dominant column's side** (`netAngle`), thinner opposite. If the residual is *tangential* (columns
  swept sideways), the spread comes out as a **slow swirl** instead of a one-sided bulge.

**Vertical profile (reconciles the team's trampoline / curl / down-arc debate):** the spread is a
**low radial fountain in front of the seal** — substance lips up a little at the rim (the
"trampoline" bounce / wave curl), crests, then arcs back down as it travels outward. Hard rule from
canon: **magic never flows behind the ring** (the portal plane). The arc lives entirely in front of
the portal; nothing goes to negative depth.

### Canon oracle (correctness targets)

All five canon inverted-column spells are **balanced** → the **Outward+Balanced** cell is the
verified one and the primary acceptance target. The **Outward+Not-balanced** cell is a
first-principles extrapolation (no manga panel) — ship it as the engine's reasoned guess, not as
canon.

| Spell | Element | Columns | Must render as |
|---|---|---|---|
| **Snugstone Spell** | fire | 4 balanced | even warmth ring, no upward jet |
| **Beast Warding** | light | 4 balanced | even light ward on every side |
| **Wind Wall** | air | 6 balanced | even circular wall |
| **Sand Cage** | earth | 2 balanced | even cage around |
| **Crystal Shard** | earth | 4 balanced | outward eruption of shards |

### Invariants every layer keeps

1. `geometry.js` / `deduce.js` stay **JSON-free** (pure; `node --test`). New pure logic lives there;
   JSON binding happens in `analyze.js` / `ir.js`.
2. **Trigger off `flow.inverted` (`Φ<0`), never off the `orientation` field** — `orientation` is
   cosmetic (Rising Platform finding, `docs/lexicon/signs-directional.md`); Crystal Shard / Wind Wall
   store `orientation:"inward"` yet `inverted:true`.
3. The renderer is browser-only (no unit tests); engine tests cover the facts that feed it.
4. The radial-spread mode is **element-agnostic in code** — one shared helper, dispatched by all five
   element effects (water/fire/earth/light/wind) — but **element-aware in look** (each effect supplies
   its own particle draw + palette).
5. Left-column behavior (inward up-eruption / leaning jet) is **untouched**. The new branch only fires
   when `spellIR.radialSpread` is present.

---

## Development loop protocol (per layer)

Same as SPEC-orb-container: **Plan (Opus) → Develop (subagent) → Review (Opus) → Gate
(`npm test` + `npm run lint` clean)**. Advance only when the layer's review checklist is green.

**Sequence: L0 → L1 → L2 → L3(engine tests) → L4(renderer) → L5(catalog/e2e).** L4 (the fountain
animation) is the only browser-only piece and comes after the reasoning layers are green.

---

## L0 — Theory (extend the einlair analysis)

**Objective.** Lock the 2×2 model + the fountain vertical profile in the reasoning doc. **Extend the
existing** `docs/theories/einlair-vector-analisys/analysis.md` (the inverted/asymmetric cases already
start there) — do **not** start a new folder.

**Content checklist.**
- The 2×2 table from §0, with which cell each existing pipeline path covers.
- The "U budget closed when `Φ<0`" argument: why outward imbalance is spent on **angular density**
  (and tangential residual on **swirl**), not on upward tilt.
- The fountain vertical profile (rim-lip → crest → forward down-arc) and the **never-behind-the-ring**
  rule, tying the trampoline / curl / down-arc discussion to one shape.
- The 5-spell canon oracle table; explicit note that Outward+Not-balanced is extrapolation.

**Review checklist.** Matches §0 · canon oracle present · no contradiction with the existing einlair
math · names which cell is new vs already handled.

---

## L1 — Data (`grammar.json`)

**Objective.** Make the inverted-column verb/disambiguation explicit (no engine hardcoding).

**Changes — `data/grammar.json`:**
- `operators.column` already carries `invertedVerb: "is driven inward and erupts rather than
  projecting out"` — keep. Optionally sharpen to mention the **outward spread** so `deduce.js` prose
  matches the render (e.g. append `"… spreading around the seal"`).
- Append an `interactions[]` note for the **Dispersion vs inverted-Column** ambiguity
  (`docs/lexicon/signs-directional.md`): both spread outward; record that **inverted Column keeps a
  directional bias (`netFrac`) while Dispersion is uniform** — the chosen disambiguation (see §Open
  questions). This is documentation only; the trigger stays `flow.inverted`.

**Review checklist.** No existing operator broken · `deduce.test.js` coverage still green · the
inverted verb prose agrees with the render description.

---

## L2 — Numeric IR (`src/engine/ir.js`) — the bridge that's missing today

**Objective.** Consume `computeColumnFlow` and emit a `radialSpread` block when the flow is inverted,
**suppressing the spurious upward direction** the renderer currently derives from a cancelled `aim`.

`computeColumnFlow` already returns everything needed: `{ inverted, T, R, netAngle, netFrac, parts }`
where each `part` has radial `a` and tangential `b`. **No geometry math change is required** — only
consumption. (If the tangential/swirl share is wanted, sum `b` over parts → `Σb`; `swirl = Σb / T`.)

**Changes — `assembleSpellIR(facts, cfg)`** (add `flow` to `facts`, computed alongside `aim`):
```jsonc
// after the existing direction derivation, before the final return:
if (flow?.inverted) {
  const swirl = flow.T > 0 ? clamp((sumTangential(flow.parts) / flow.T), -1, 1) : 0
  // Outward spread is in-plane: kill the upward jet the cancelled aim would otherwise imply.
  direction = { x: 0, y: 0, z: 0, xTiltDeg: 0, yTiltDeg: 0, tiltFromZDeg: 90 }
  return {
    force, spread, focus, range, duration, stability, gravity, dirCoherence, direction,
    radialSpread: {
      intensity:   clamp(flow.T / (cfg.radialIntensityDivisor ?? 4)), // → particle count / reach
      biasAngle:   flow.netAngle,        // 0 = north, clockwise (engine convention)
      biasStrength: flow.netFrac,        // 0 = uniform ring, 1 = one-sided
      swirl,                             // signed tangential share (−1..1)
      archHeight:  clamp((cfg.radialArchBase ?? 0.12) + force * (cfg.radialArchForce ?? 0.18)),
    },
  }
}
```
Tunables (`radialIntensityDivisor`, `radialArchBase`, `radialArchForce`) live in
`rules.json.irTuning` (consistent with every other IR knob). Container takes precedence over radial
spread if both somehow apply (orb branch returns first).

**Acceptance tests (`test/ir.test.js` or new `test/inverted-column.test.js`):**
- Two opposed equal **inverted** columns → `radialSpread` present, `biasStrength ≈ 0`, `direction.z === 0`.
- One long + opposing short inverted columns → `biasStrength > 0`, `biasAngle` ≈ the long column's
  outward side.
- Tangentially-swept inverted columns → `|swirl| > 0`.
- **Non-inverted** columns (inward) → **no** `radialSpread` block (left column untouched).

**Review checklist.** Block only emitted when `flow.inverted` · `z` forced to 0 · balanced→`netFrac≈0`
· inward path unchanged · all tunables from `rules.json`.

---

## L3 — Engine tests (canon oracle + extrapolation)

**Objective.** Pin the inverted-flow behavior end-to-end (real component geometry → `computeColumnFlow`
→ `assembleSpellIR`) so the balanced cell can't regress and the biased cell is exercised.

> **Reality check (resolved during L3 planning).** The original plan to "load the five oracle spells
> from `data/spells.json`" does **not** work: `data/spells.json` is the *matcher/recipe* format
> (`composition.signs` = `{id,count,placement}`, no `x/y`), which `analyze()` cannot consume; and
> `analyze()` itself imports JSON Vite-style so it **cannot run under `node --test`**. Tests must use
> the **pure** `computeColumnFlow` + `assembleSpellIR` with `createRequire`-loaded data. Also, the
> catalog "inverted column count" is **not** the seal's aggregate flux: **Sand_Cage**'s real asset is
> net-**inward** (`inverted:false` — only 2 of its 8 columns are inverted), so it is *not* a valid
> oracle. **Snugstone** and **Wind_Wall** have no analyzable `assets/spells/*.json`. The usable real
> oracle is therefore **Beast_Warding** and **Crystal_Shard** (both confirmed `inverted:true`,
> `netFrac` ≈ 0.03 / 0); the rest of the matrix is covered synthetically.

**Changes — extend `test/inverted-column.test.js`** (the file created in L2). Use `createRequire` for
`data/signs.json` (build `familyOf = (t) => signMap[t]?.family`), `data/rules.json` (`cfg`), and the two
asset files. Pure pipeline only (no `analyze()`). Cases:

1. **Beast_Warding** (`assets/spells/Beast_Warding.json`, `circles[0].components`) → `computeColumnFlow`
   gives `inverted:true`, `netFrac < 0.1`; `assembleSpellIR` (facts with that real `flow`) → `radialSpread`
   present, `biasStrength < 0.1`, `direction.z === 0`.
2. **Crystal_Shard** (same shape) → `inverted:true`, `netFrac < 0.05`, `radialSpread` present,
   `biasStrength ≈ 0`, `direction.z === 0`.
3. **Synthetic balanced** — 4 cardinal inverted columns (verified recipe in this spec's L3 planning:
   `mk(0,-90,180,1), mk(90,0,270,1), mk(0,90,0,1), mk(-90,0,90,1)`, all `inverted:true`) →
   `inverted:true`, `netFrac < 0.01`, `radialSpread.biasStrength ≈ 0`.
4. **Synthetic unbalanced** — same four but the north column `scale:2.5` → `inverted:true`,
   `netFrac > 0.2`, `radialSpread.biasStrength > 0.2`, `biasAngle` near `0`° (north — the oversized
   column's outward side). (Verified: `netFrac ≈ 0.27`, `netAngle ≈ 0`.)

**Review checklist.** 2 real assets + 2 synthetic cases covered · balanced→`biasStrength≈0` · biased
case asserts both magnitude and `biasAngle` · pure functions only (no `analyze()`) · `npm test` green.

---

## L4 — Renderer (the radial fountain) — browser-only

**Objective.** One shared radial-spread effect, dispatched by every element effect, gated on
`spellIR.radialSpread`.

**New file — `src/studio/render/effects/radialSpread.js`** — a **self-contained** module with its own
per-element palette (so it needs no per-effect refactor):
- `radialSpreadFlow(spellIR, ring, portal, frame)` → spawn/physics config from the `radialSpread`
  block (count ∝ `intensity`, reach ∝ `intensity`, arc ∝ `archHeight`).
- `spawnRadialParticle(flow)` — pick a rim angle `θ` (engine 0=N CW) by rejection-sampling the density
  `∝ 1 + biasStrength·cos(θ − biasAngle)`; place the particle at the rim (`r ≈ 1.0`) and give it an
  **outward** radial speed and a `maxReach`, both scaled by the local density so the biased side
  reaches farther; a small `+vHeight` bounce (`archHeight·ring.radius`); and a tangential angular drift
  `∝ swirl` for the swirl case.
- `updateRadialParticle` — integrate: `r` grows outward; `vHeight` gets gravity → ballistic arc;
  `θ += swirl·rate·dt`; **height clamped ≥ 0 (the arc never dips below the seal plane = never behind
  the ring)**; particle dies when `r > maxReach` or it lands (`height ≤ 0` after cresting).
- `projectRadialParticle(p, portal)` — **the coordinate bridge.** With `u = facingUnit(θ) = { x: sin, y: −cos }`:
  `x = portal.center.x + u.x · portal.radiusX · r`, `y = portal.center.y + u.y · portal.radiusY · r − height`.
  The `radiusX/radiusY` split applies the portal's `PORTAL_SCALE_Y` foreshortening so the rim reads as
  the seal's ellipse (consistent with `portalOutDirection` / `FlowPanel`).
- `drawRadialSpreadEffect(ctx, state, spellIR, ring, dt, config)` — generic spawn/update/project loop.
  Look comes from a per-element palette keyed on `spellIR.element` (water/fire/earth/light/wind/air):
  `glow` → additive radial-gradient blobs (mirror `drawWaterMass`/`Core` but palette-tinted);
  `toon` → collect `{x,y,r,hl}` blobs → `drawToonLiquid` with palette-tinted options. **Default style is
  `glow`** (`renderConfig` → primary QA path).

**Dispatch — ONE edit in `SpellEffectRenderer.render()`** (not per-effect — DRY). At the active-cast
dispatch (where it currently calls `drawEffect(...)`), branch first:
```js
if (renderSpellIR.radialSpread) {
  drawRadialSpreadEffect(ctx, this.state, renderSpellIR, ring, dt, this.config)
} else {
  drawEffect(ctx, this.state, renderSpellIR, ring, dt, this.config)
}
```
This is gated purely on `radialSpread`; every non-inverted spell takes the unchanged `drawEffect`
path. (Improves on the spec's original per-effect plan: one insertion point, element-agnostic by
construction, the five effect files stay untouched.)

**Manual QA (`npm run dev`).** Snugstone & Beast Warding → even ring, **no upward jet**. One oversized
inverted column → visibly lopsided toward the big column. Swept columns → swirl. Crystal Shard → fast
outward burst. Nothing renders behind the seal at any tilt.

**Review checklist.** Single shared module + one dispatch edit in `SpellEffectRenderer` · gated on
`radialSpread` only · non-inverted spells take the unchanged `drawEffect` path · the five effect files
untouched · height clamped ≥ 0 (never behind the ring) · particles emit from the rim and reach OUTWARD
past it (verify via a headless probe) · both `toon` and `glow` styles handled · `npm run build` clean.

---

## L5 — Catalog / e2e + docs ✅

**Objective.** Tie off and document. **Done:**

- ✅ `FlowPanel` `verdict()` rewritten to use the pressure curve — reads "rises straight UP" /
  "spurts {dir}" / "spreads radially outward, biased {dir}" so the readout matches the cast.
- ✅ Cross-linked from `docs/CORE.md` (Column section) and the einlair theory doc
  (`docs/theories/einlair-vector-analisys/analysis.md`).
- ✅ Example seal added: `assets/spells/Inverted_Column_Ward.json` (4 balanced inverted columns + water
  core) so the spread is reproducible.
- ✅ Status flipped to **implemented & shipped** (header) with the test count.

---

## Pressure curve (follow-up — canon size→steering sensitivity)

**Why.** Canon (Rising Platform of Water, manga ch.) is explicit: *"This one sign is longer than the
rest. It's applying too much pressure, causing the water to spurt out to the side."* A ~**2×** column
already throws the spell nearly horizontal. The raw model was **linear** in `netFrac = R/T`, which
divides one column's excess by the total of all columns — so a 2× column among many barely leaned (you
had to draw a giant ~5–6× one). Conversely, hand-drawn columns vary ~±15% (measured 0.07/0.08/0.09 for
"equal" ones), so naively cranking sensitivity would make balanced seals lean from wobble.

**The curve.** `pressureLateralShare(netFrac, cfg)` (pure, in `geometry.js`): a **deadzone** below
`columnBalanceFloor` (wobble → stays balanced, no lean) then a **smoothstep ramp** that **saturates**
at `columnSaturateKnee` (one clearly-longer column → mostly/fully sideways). Defaults
`floor = 0.12`, `knee = 0.34` (in `rules.json.irTuning`, live-tunable).

| `netFrac` | meaning | `lateralShare` |
|---|---|---|
| 0.03 | balanced / wobble | 0 → rises straight up |
| 0.22 | mild | 0.43 |
| 0.40 | ~2× column (4-col seal) | 1.0 → nearly horizontal |
| 0.57 | giant column | 1.0 |

**Applied at all three consumers** (so the model stays coherent): the inward lean
(`StudioPage.einlairDirection` → `z = 1 − lateral`), the inverted `biasStrength` (`ir.js`), and the
`FlowPanel` verdict. Keeps the balanced canon spells balanced (deadzone). Tests in
`test/pressure-curve.test.js`. **Tuning knobs:** raise `columnBalanceFloor` if balanced seals still
lean; lower `columnSaturateKnee` if a modest column should already go horizontal.

---

## Open questions / decisions

1. **Inverted Column vs. Dispersion (canon-ambiguous, `signs-directional.md`).** *Decision:* same
   fountain render mode, but inverted Column keeps `biasStrength` (`netFrac`) while a Dispersion-driven
   spread is forced uniform. Gives the two a defensible visual difference. Dispersion alone is
   **non-directional** and does **not** set `flow.inverted` today, so a Dispersion-only trigger is
   **out of scope** here (future: a separate `flow.disperse` path) — this spec triggers on
   `flow.inverted` only.
2. **Swirl fidelity.** Ship the single net `swirl` scalar (Level 1). The full per-direction emission
   field `E(θ) = Σ mᵢ·kernel(θ − φᵢ)` (Level 2, the literal "vector field") is deferred until a 3+
   asymmetric-column spell needs it.
3. **Arch tuning.** `archHeight` defaults are guesses; tune against the canon oracle in L4 manual QA so
   balanced wards read as low even domes, not tall spouts.
