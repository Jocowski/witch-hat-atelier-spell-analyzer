# SPEC — Orb as a Container (the "fill a sphere" operator)

> Status: **implemented** (L0–L6) · L5 renderer pending manual visual QA (`npm run dev`).
> Precedent: the Column/einlair flow feature
> (`docs/theories/einlair-vector-analisys/`, `computeColumnFlow`).
>
> Goal: model the **Orb** sign as a *container* operator — it creates a spherical space above the
> seal that the substance fills **bottom-to-top** — across every layer the Column feature touched:
> theory → data → geometry → prose → numeric IR → renderer → tests. Canon target spell:
> **Water Orb** (`orb ×4` around + `column ×2` sides — `data/spells.json`).

---

## 0. The model (the thing every layer must agree on)

Column and Orb are two halves of one flow model:

- **Column** opens a directional **output channel**; the einlair model already decomposes the seal's
  signs into radial flow `R`, total inflow `T`, and **upward (out-of-plane) flow `U = T − R`**
  (`computeColumnFlow`). Two opposed inward columns → `R≈0`, so `U≈T`: a fountain straight up.
- **Orb** is a **container `form`** that does *not* aim a jet. It **captures that upward flow `U` into
  a suspended sphere** that fills bottom-to-top. So:
  - **Fill rate ∝ `U`** (the columns are the pump that drives substance up into the vessel).
  - **Capacity / sphere radius ∝ orb count & size** (Water Orb's 4 orbs → a large container).
  - **Gravity drops** (the sphere floats, like levitation) but the substance is *contained*, not a free cloud.
  - **Substance-gated** (CORE §2b): `fluid`/`granular` pool cleanly; `rigid` (rock/wood) jams →
    require a compaction operator (`convergence`) first; `manipulate`-elements (earth) need a **real source**
    (CORE §2a — Water Orb *creates* its water; an Earth Orb is a reservoir that must be fed earth).

Net rule: **Orb consumes the seal's upward/contained flow and turns it into a filling vessel.** It
reuses `U` rather than introducing a new aiming vector — no special case, a clean unification.

### Invariants every layer keeps

1. `geometry.js` and `deduce.js` stay **JSON-free** (pure modules; tests run under `node --test`).
   New pure logic lives there; JSON binding happens in `analyze.js`/`ir.js`/`data.js`.
2. A new grammar flag must not break existing operators — `orb` already exists as `kind:"form"`.
3. The renderer is browser-only (no unit tests); the engine tests cover the analysis that feeds it.
4. Container behavior must be **substance-agnostic in code** but **substance-aware in output**: the
   geometry/IR compute containment for any element; the *notes* (pools/jams/needs-source) come from
   the substance's `state`/`capability`.

---

## Development loop protocol (per function)

For each layer below:

1. **Plan (Opus):** confirm the function signature, data shape, and acceptance tests in this spec.
2. **Develop (subagent):** hand the subagent the layer's **Subagent brief** verbatim + the relevant
   files. Subagent implements + runs the listed tests/commands and reports results.
3. **Review (Opus):** run the **Review checklist**. If any item fails, send the subagent the specific
   defect and loop to step 2. Only advance to the next layer when the checklist is green.
4. **Gate:** `npm test` and `npm run lint` clean before moving on.

Sequence: **L0 → L1 → L2 → L3 → L4 → L6(engine tests) → L5(renderer) → L6(catalog/e2e).** L5 (the
fill animation) is the only browser-only piece and comes after the reasoning layers are green.

---

## L0 — Theory doc

**Objective.** Lock the container model (§0) in a reasoning doc, mirroring the einlair analysis.

**Files.** New: `docs/theories/orb-container-analysis/analysis.md` (+ optional diagrams later).
Cross-link from `docs/CORE.md` §2b (one line) and this spec.

**Content checklist.**
- The capture-`U` model: `fillRate ∝ U`, `capacity ∝ orbCount·size`, fills bottom-to-top.
- Substance gating table (fluid / granular / rigid / manipulate) with the canon cites (CORE §2a/§2b,
  `sigils.md`).
- The orb+column relationship (pump + vessel) worked through Water Orb explicitly.
- Failure modes: rigid jams without `convergence`; earth needs a source; no orb count → no container.

**Subagent brief.** "Write `docs/theories/orb-container-analysis/analysis.md` from the model in
`docs/app/specs/SPEC-orb-container.md` §0. Cite `docs/CORE.md` §2a/§2b and `data/spells.json`
Water Orb. No code. Add one cross-link line to CORE.md §2b pointing at the new doc."

**Review checklist.** Model matches §0 exactly · canon cites present · Water Orb worked example included ·
CORE.md link added · no contradictions with CORE §2.

---

## L1 — Data (`grammar.json`, `signs.json`)

**Objective.** Make `orb` a declared *container* form and add its interactions, so the engine can
branch on data (not hardcoded ids).

**Changes — `data/grammar.json` `operators.orb`:**
```jsonc
"orb": {
  "kind": "form",
  "verb": "gathers into a sphere held above the glyph",
  "container": "sphere",        // NEW — marks this form as a container
  "fillsBottomToTop": true,     // NEW
  "directional": false          // explicit: orb does not aim
}
```

**Changes — `data/grammar.json` `interactions[]` (append):**
```jsonc
{ "id": "orb-column", "type": "synergy",
  "when": { "has": ["orb", "column"] },
  "text": "The columns drive the substance upward to fill the orb's sphere — pump and vessel." },

{ "id": "orb-rigid-earth", "type": "warning",
  "when": { "has": ["orb"], "element": "earth" },
  "text": "Earth is rigid and only manipulable — the orb needs a real earth source, and a Convergence sign to compact the grains, or it jams instead of pooling." }
```
(Keep the `convergence-earth` synergy as-is; the two compose.)

**Changes — `data/grammar.json` `elements[*]` (ADD typed flags — resolved open question #1):**
Each element gets `state` and `capability` (CORE §2; existing `qualities` array stays). Values:
```jsonc
"water":            { …, "state": "fluid",    "capability": "create"     },   // collect is cheaper
"earth":            { …, "state": "granular", "rigidWhenSet": true, "capability": "manipulate" },
"fire":             { …, "state": "energetic","capability": "create"     },
"unburning_flame":  { …, "state": "gaseous",  "capability": "create"     },
"air"/"wind":       { …, "state": "gaseous",  "capability": "manipulate" },   // wind moves, doesn't create
// …fill the rest from CORE §2b state list + sigils.md capability notes; default state "immaterial",
//   capability "create" where unknown, and note it.
```
L3's substance note reads these (not `=== 'earth'`).

**Changes — `data/signs.json` `orb`:** entry is already correct (effectTags `contain`/`sphere`).
No change required; verify only.

**Tests / acceptance.**
- `node --test test/deduce.test.js` still green (operator-coverage test: orb already covered).
- New data-integrity assertion (added in L6) reads `container:"sphere"`.
- `interactionApplies` already supports `has`/`element` — no engine change needed for the rules to fire.

**Subagent brief.** "Edit `data/grammar.json` only: add `container`/`fillsBottomToTop`/`directional`
to `operators.orb` and append the two `interactions` entries exactly as in
`docs/app/specs/SPEC-orb-container.md` §L1. Run `node --test test/deduce.test.js` and
`npm run lint`. Do not touch signs.json beyond confirming the orb entry exists."

**Review checklist.** JSON valid · `orb.container==="sphere"` · both interactions present with correct
`when` · `npm test` green · `deduce` interaction wiring needs no code change (confirm by reading
`interactionApplies`).

---

## L2 — Geometry (pure, tested) — `src/engine/geometry.js`

**Objective.** A pure function that detects the container and quantifies it from the orb signs + the
existing einlair flow. No JSON import.

**New function:**
```js
// Container model (docs/theories/orb-container-analysis). Detects orb-type form signs and quantifies
// the vessel: capacity from orb count·size, fill rate from the seal's upward einlair flow U.
// `isContainer(type)` is injected (analyze.js passes grammar: op.container === 'sphere'), keeping
// this module JSON-free. Returns null when no container sign is present.
//   { contained:true, orbCount, capacity, fillFrac, radiusFrac }
export function computeContainment(components, familyOf = () => null, isContainer = () => false) {
  // orbCount  = number of container signs (inside ring)
  // capacity  = Σ magnitudeOf(orbSign)            // count·size → how big the vessel is
  // flow      = computeColumnFlow(components, familyOf)  // reuse U
  // fillFrac  = flow ? clamp(flow.upFrac) : <default>    // share of inflow that fills (vs. escapes)
  // radiusFrac= clamp(0.25 + 0.12*orbCount + 0.04*(capacity-orbCount))  // normalized sphere radius
}
```
Exact constants are tunable; the **contract** (fields + monotonicity) is what tests pin:
- more orbs ⇒ larger `radiusFrac` and `capacity`;
- balanced/opposed columns (high `U`) ⇒ higher `fillFrac` than a single aimed column;
- no orb sign ⇒ `null`.

Wire it into `computeSignVectors` return as `containment` (alongside `flow`) so callers get it free.

**Tests — `test/geometry.test.js` (add cases):**
- `computeContainment([], …)` → `null`.
- 4 inward orbs + 2 opposed columns → `contained:true`, `orbCount:4`, `fillFrac` high (`> 0.5`).
- 4 orbs vs 2 orbs → larger `radiusFrac`/`capacity` for 4.
- Pass `isContainer` that returns true only for `'orb'`; a non-orb form (e.g. `column` alone) → `null`.

**Subagent brief.** "Add `computeContainment(components, familyOf, isContainer)` to
`src/engine/geometry.js` per `docs/app/specs/SPEC-orb-container.md` §L2 (PURE — no JSON import; reuse
`computeColumnFlow`, `magnitudeOf`, `clamp`, `toPolar`). Add it to `computeSignVectors`'s return as
`containment`. Add the four test cases to `test/geometry.test.js`. Run `node --test
test/geometry.test.js`."

**Review checklist.** No JSON import added to geometry.js · returns `null` with no container ·
monotonic in orbCount (capacity, radiusFrac) and in `U` (fillFrac) · reuses `computeColumnFlow`
(doesn't re-derive flow) · `computeSignVectors.containment` populated · tests pass · `npm run lint` clean.

---

## L3 — Prose (pure) — `src/engine/deduce.js`

**Objective.** When a container `form` is present, emit a *contained-sphere* clause with the
substance-aware note, instead of the generic "above the seal" form clause.

**Changes (deduce.js, the Direction block ~L147–166):**
- Detect container: `const container = byKind.form?.find(f => f.op?.container === 'sphere')`.
- If `container` and no `transmute`/`region`: set the primary/direction clause to
  *"…collects into a floating sphere above the seal, filling bottom-to-top"* (replaces the
  `form.op.directional` "above the seal" branch for this case).
- Substance note appended to `notes` based on the core element's `state`/`capability` (passed via the
  injected element data — `el`): fluid/granular ⇒ "pools cleanly"; rigid ⇒ "jams without Convergence";
  manipulate ⇒ "needs a real <element> source to fill". Keep these **data-driven** (read flags off `el`,
  don't hardcode `=== 'earth'`); the L1 `orb-rigid-earth` interaction already covers earth via grammar,
  so deduce only needs the generic state-based note to avoid duplication.
- `aimLabel` for a container → `'contained sphere'`.

> Constraint: deduce.js takes data **injected** (`deduceWith(grammar, sigilMap, signMap, composition)`).
> The element `state`/`capability` must come from `grammar.elements[el]` (extend the grammar element
> shape in L1 if those flags aren't present yet — add `state` + `capability` to water/earth/etc.).
> **If adding element flags, do it in L1** and note it here. Decide during L1 review.

**Tests — `test/deduce.test.js` (add):**
- Water core + `orb ×4` + `column ×2` → summary contains "sphere" and "filling bottom-to-top"; no
  "above the seal" jet phrasing; `direction === 'contained sphere'`.
- Earth core + `orb` → `warnings` contains the rigid/source note (from the L1 interaction).
- Regression: existing column-only water spell (Watershot) summary unchanged.

**Subagent brief.** "In `src/engine/deduce.js` add a container branch per
`docs/app/specs/SPEC-orb-container.md` §L3 (PURE — data injected). Read `op.container` and the element
`state`/`capability` flags off the injected grammar. Add the three test cases to `test/deduce.test.js`.
Run `node --test test/deduce.test.js`. Do NOT add a JSON import to deduce.js."

**Review checklist.** No JSON import in deduce.js · container clause replaces the jet clause only when
orb present and no transmute/region · substance note is data-driven (no `=== 'earth'` literal) · earth
warning still fires via L1 interaction (no dup) · Watershot regression intact · tests pass.

---

## L4 — Numeric IR — `src/engine/ir.js`

**Objective.** Emit the SpellIR fields the renderer needs for a filling sphere, derived from L2.

**Changes (ir.js):**
- Call `computeContainment(...)` (pass `isContainer` built from `grammarOps[type]?.container === 'sphere'`).
- When contained:
  - `gravity` → low (suspended vessel). Reuse the levitation drop path or set
    `gravity = clamp(min(gravity, cfg.containerGravity ?? 0.15))`.
  - new fields on the returned IR: `contained: true`, `containRadius: radiusFrac`,
    `fillRate: fillFrac`, `capacity`.
  - `direction`: suppress lateral jet — clamp in-plane share, keep a small upward `z` (substance rises
    into the vessel). I.e. don't let an aimed column push the sphere sideways.
- When not contained: fields absent / `contained:false` (no behavior change → all existing specs pass).

**SpellIR doc.** Add `contained`, `containRadius`, `fillRate`, `capacity` to the SpellIR table in
`docs/app/SPELL-EFFECTS.md` §3 (set-by: engine, range notes).

**Tests — `test/` (ir/analyze test, add):**
- Water Orb composition → IR `contained:true`, `gravity < 0.2`, `containRadius` in (0,1], `fillRate > 0`.
- Non-orb spell → `contained` falsy, `gravity`/`direction` unchanged (regression).

**Subagent brief.** "In `src/engine/ir.js` wire `computeContainment` (build `isContainer` from
`grammarOps[type].container==='sphere'`) and emit `contained`/`containRadius`/`fillRate`/`capacity` +
drop gravity + clamp lateral direction when contained, per `docs/app/specs/SPEC-orb-container.md` §L4.
Update the SpellIR table in `docs/app/SPELL-EFFECTS.md` §3. Add the two tests. Run `npm test`."

**Review checklist.** Container fields only when orb present · gravity dropped · lateral jet suppressed ·
non-container regression clean · SPELL-EFFECTS §3 table updated · `npm test` green.

---

## L5 — Visual renderer (browser-only) — `src/studio/render/effects/waterEffect.js` (+ utils)

**Objective.** A **filling-sphere render mode**: particles collect into a bounded sphere above the
portal and fill bottom-to-top over `duration`, with the toon metaball look + a faint spherical
boundary. Gate on `spellIR.contained`.

**Approach.**
- In `waterFlowConfig`, when `spellIR.contained`: compute a **sphere home** (center above the portal at
  `ring.radius * (0.6 + containRadius)`, radius `ring.radius * containRadius`). Add a `container` block
  to the flow config.
- New particle mode `spawnContainedWaterParticle` / `updateContainedWaterParticle`: each particle has a
  home **inside the sphere**, but the **fill line** rises from bottom to top as
  `fill = clamp(age / (duration·60) , 0, 1)` (or driven by `spellIR.fillRate`). Particles below the
  current fill line are active (visible, jostling like liquid); above it are dormant. Net: the sphere
  visibly fills.
- Projection: respect the 2.5D portal plane (reuse `projectWaterParticle`'s frame; the sphere is in
  screen space above the portal center). Add a subtle spherical outline (one stroked ellipse) so the
  vessel reads as a container even before full.
- Toon branch: feed the in-fill particles to `drawToonLiquid` (existing water palette) so it looks like
  the canon anime water orb; draw the boundary as a thin desaturated ring.
- Reuse, don't fork: keep stream/suspended modes intact; `contained` is a third branch in
  `drawWaterEffect`/`spawnWaterParticle`/`updateWaterParticle`.

**Check the sibling first.** `wha-spell-simulator` may already have an orb/contained effect to port
(see the memory note `wha-spell-simulator-reference`). Port its fill logic if present.

**Acceptance (manual — browser).** `npm run dev` → draw a Water sigil + 4 Orb + 2 Column → Analyze →
Spell Trial shows a floating sphere filling bottom-to-top (both glow and toon styles), no sideways jet,
sphere size scales with orb count. No console errors; particle pool stays capped.

**Subagent brief.** "Add a `contained` fill-sphere branch to
`src/studio/render/effects/waterEffect.js` (+ any helper in `effectUtils.js`) per
`docs/app/specs/SPEC-orb-container.md` §L5 — PURE module, no JSON. Gate on `spellIR.contained`; reuse
the portal plane + toonLiquid; keep stream/suspended modes unchanged. First check the
`wha-spell-simulator` sibling for an existing orb effect to port. Verify with `npm run dev` (manual)."

**Review checklist.** Gated on `spellIR.contained` (no effect on other spells) · fills bottom-to-top ·
sphere scales with `containRadius` · no lateral jet · toon + glow both work · particle cap respected ·
no JSON import · stream/suspended modes untouched · manual trial looks right.

---

## L6 — Tests, integrity, catalog

**Objective.** Lock behavior and exercise the substance-gating with a second spell.

**Changes.**
- **Data-integrity test** (`test/data.test.js` or `deduce.test.js`): every operator with
  `container:"sphere"` is `kind:"form"` and `directional:false`; orb's interactions reference valid ids.
- **Catalog:** verify **Water Orb** (`data/spells.json`) analyzes to the contained-sphere effect and
  matches itself. Optionally **add an Earth Orb** catalog entry (`orb ×4` + a `gather`/source sign) to
  demonstrate the "needs a real source / Convergence" path — keep `origin:"fan"`? No: only add if it can
  be sourced; otherwise document it in `docs/spells/` instead of the matcher catalog (per CLAUDE.md
  catalog rules — fan spells stay out of `spells.json`).
- **Skill spot-check:** run the `/spell-analyzer` reasoning over Water Orb and confirm the deduced
  effect, substance note, and closest-canon comparison read correctly.

**Acceptance.** `npm test` green · `npm run lint` clean · Water Orb end-to-end (analyze → IR → trial)
correct · the spec's §0 model reflected in output.

**Subagent brief.** "Add the data-integrity test from §L6, confirm Water Orb analyzes correctly, and
(only if properly sourceable) decide Earth Orb placement per CLAUDE.md catalog rules. Run `npm test`
and `npm run lint`."

**Review checklist.** Integrity test added + passing · Water Orb e2e correct · Earth Orb decision
follows catalog rules · full suite + lint green.

---

## Open questions to resolve at L1 review

1. ~~**Element flags.**~~ **RESOLVED:** `grammar.elements[*]` had only `substance`/`raw`/`qualities`.
   Adding typed `state`/`capability` in L1 (folded into scope above).
2. **Fill driver.** Drive `fillRate` from einlair `U` (physical, ties to columns) vs. a flat duration
   ramp (simpler). Plan picks `U` with a duration fallback; confirm at L4.
3. **Earth Orb catalog.** In or out of `spells.json`? Default: out (document in `docs/spells/`) unless a
   real canon/wiki source exists.
