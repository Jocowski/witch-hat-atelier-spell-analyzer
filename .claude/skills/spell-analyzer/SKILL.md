---
name: spell-analyzer
description: >-
  Analyze a Witch Hat Atelier spell from the Spell Analyzer app. Use this whenever
  the user pastes or points to a spell JSON (the wha-spell@1 export, or a bare
  composition with core/components/ring/dyes), OR asks to analyze, explain, validate,
  break down, or describe a spell — whether a canon spell by name (Watershot Seal,
  Pyreball, Wall Breaker, etc.) or a custom seal they composed. Triggers on phrases
  like "analyze this spell", "is this seal valid", "what does this glyph do", "explain
  this composition", "break down this spell JSON", or dropping a .json export. Produces
  a full structured analysis (validity, how each sigil/sign shapes the effect, deduced
  effect, canon-grounded element-physics reasoning, comparison to the closest canon
  spell, usage ideas) grounded in the real engine, then — after the user reviews and
  approves — writes a doc to docs/spells/ and asks for an image/JSON for reproduction.
---

# Spell Analyzer

Analyze a *Witch Hat Atelier* spell end-to-end: validate it, deduce its effect from
first principles, explain how every part contributes, reason about how the substance's
physical nature interacts with each sign, compare it to the closest canon spell, and
suggest uses — then archive it in `docs/spells/`. Always reason from the **real engine**
and the **source docs** — never invent ids, effects, or validity.

**First, read [references/magic-system.md](references/magic-system.md)** — the distilled
ruleset (the core equation, validity rules, sigil/sign catalogs, operator kinds,
inversion, dyes, the composition JSON contract, and how to run the engine). It points
to the canonical `docs/` and `data/` files for anything you need in depth.

## Workflow

### 1. Identify the input
The user will give one of:
- **An app JSON** — either `{ "format": "wha-spell@1", … , "composition": {…} }` or a
  bare composition object. Save it to a temp file if pasted inline.
- **A description / spell name** — e.g. "the Watershot Seal" or "a seal that shoots a
  spinning jet of fire upward." You'll reconstruct a composition from the docs.
- **A mix** — JSON plus questions, or a description plus a partial recipe.

### 2. Get ground truth from the engine
For any JSON, run the real engine — do not eyeball validity or the effect:
```bash
node tools/spell-engine-cli.mjs --text path/to/spell.json     # human-readable
node tools/spell-engine-cli.mjs path/to/spell.json            # full JSON
```
It returns validity/issues, the deduced effect (`summary` + per-part `breakdown` +
`notes`/`warnings`), geometry (symmetry/balance/power/spin), dyes, and `unknownIds`
(catch typos). Trust it for the **base facts**; your job is to layer narrative,
canon-grounded element-physics reasoning, and usage on top.

If the user gave only a **description or name**:
1. Reconstruct the recipe from [docs/spells.md](../../../docs/spells.md),
   [docs/sigils.md](../../../docs/sigils.md), [docs/signs.md](../../../docs/signs.md)
   (and the matching `data/*.json` for exact ids). For canon spells, use the
   newest/official form (per spells.md).
2. Build a composition JSON (see the cheat-sheet's even-placement helper for angles).
3. **Confirm the reconstruction with the user** before treating it as authoritative,
   then run it through the engine.

### 3. Ask when it matters
If the input is ambiguous — unclear intent, missing ids, a part that could be sigil
or sign, an effect the docs don't pin down — **ask the user** rather than guessing.
Good questions: "Is the column meant to point inward or be inverted?", "Should this be
canon-accurate or your own variant?", "Do you want dyes factored in?"

### 4. Present the analysis
Deliver a complete, readable analysis in the conversation covering, in order:
1. **Verdict** — valid / invalid, in one line, with the key reason. (Ring open/closed is
   only the app's activation *visual* — do **not** report active/inactive in the analysis;
   the engine no longer emits it.)
2. **Substance (sigils)** — each sigil's element and what it brings. Pull the canon
   constraint from [docs/sigils.md](../../../docs/sigils.md) and **cite it** (`file:line`):
   whether the element can *create* vs. only *manipulate*/*collect* its material is
   decisive — an element that "cannot create" behaves very differently from one that can.
3. **Form (signs)** — each sign: category, what it does *here*, whether inverted/tilted
   matters. Pull the canon mechanic from [docs/signs.md](../../../docs/signs.md), cite it,
   and honor any uncertainty the docs flag.
4. **Deduced effect** — the engine summary, restated plainly.
5. **How each part shapes it** — a small table; for each part, what would change without it.
6. **Element-physics & canon grounding** — **THE CORE OF THE ANALYSIS.** Reason from
   first principles about how the substance's *physical nature* interacts with each
   sign's mechanic, and compare the spell to its closest canon analogue:
   - Does the element's create/manipulate/collect constraint change what's possible?
     (e.g. an earth spell can't conjure its material, so it needs a real source nearby —
     "a pump that needs a reservoir," vs. a self-sufficient water spell.)
   - Does the substance's physical state fit the sign's mechanic? (e.g. Orb fills a
     sphere bottom-to-top under gravity like a fluid — water and loose sand pool cleanly,
     but rigid rock/wood would stack and jam, so you'd need a compaction sign.)
   - Compare to the closest canon spell: state plainly what is the **same**, what
     **differs**, and **why** — grounded in the sigil/sign docs, cited by `file:line`.
   - End with a one-paragraph **bottom line** synthesizing feasibility + the key
     difference (e.g. "a floating *sand* reservoir where Water Orb is a *water* one").
   Mark engine facts vs. your own reading throughout.
7. **Usage ideas** — concrete in-world applications (practical and creative).
8. **Other info** — stability/balance/power/spin, forbidden-magic flags, decorative notes.

Ground every claim in the docs/engine. If the source material is uncertain about a
part (many signs are), say so — fidelity to canon's ambiguity matters here. Do **not**
add "Variations" or "Modifications" sections — the value is in canon-grounded reasoning,
not in enumerating swaps.

**Distinguish engine output from your own narrative.** Validity, the deduced effect,
geometry, and any catalog `similar` matches come from the engine — label them as such.
Anything you add from the docs (e.g. related/comparable canon spells when the catalog is
empty) is *your reading*; mark it clearly (e.g. "Related spells (from the docs)") so it's
never mistaken for an engine catalog match. The catalog (`data/spells.json`) is currently
empty, so the engine returns **no** `similar` matches and reports `catalogEmpty: true`.

### 5. Get the user's approval before archiving
**Do NOT write the `.md` file yet.** After presenting the analysis (step 4), explicitly
invite the user to review and discuss it: confirm the verdict, the effect reading, the
recipe (inversion/ring/dyes), and the narrative sections. Adjust the analysis based on
their feedback and re-present if needed. Only proceed to step 6 once the user **explicitly
approves** writing the doc (e.g. "looks good", "go ahead", "save it"). If the user never
approves, do not create the file.

### 6. Archive the spell in docs/spells/ (only after approval)
Once approved, write `docs/spells/<Spell_Name>.md` using
[references/spell-doc-template.md](references/spell-doc-template.md). It records: type,
**canon vs community** origin, forbidden flag, the recipe (core/signs/dyes/symmetry),
the full analysis, **element behavior & canon grounding**, **how to draw it**, usage,
and a **Reproduction** section with the importable `wha-spell@1` JSON embedded.

Then **ask the user for an image and/or JSON** to drop into `assets/spells/` for easy
reproduction later:
> "I've documented this in `docs/spells/<Name>.md`. To make it easy to reproduce, can
> you share a screenshot/PNG (I'll save it to `assets/spells/`) and/or the app's JSON
> export? I've embedded the JSON I have, but yours from the app is authoritative."

If the user provides them, save to `assets/spells/<Spell_Name>.{png,json}` and update
the doc's frontmatter `image:`/`json:` fields and the Reproduction section.

### 7. Record what you learned
This skill should get smarter over time. When the user corrects you, or you discover a
nuance about how a part behaves or a class of magic (e.g. a limitation of time sigils,
how a specific interaction resolves, a canon detail), append it to the **Learnings log**
below so future analyses benefit. Keep entries short and dated.

## Output principles
- **Engine first, narrative second.** Validity and the base effect come from
  `spell-engine-cli.mjs`; you add interpretation, not contradiction.
- **Reason from canon physics — this is the point.** The heart of an analysis is
  reasoning about how the substance's physical nature (create/manipulate/collect;
  fluid/granular/rigid) interacts with each sign's documented mechanic, and how the
  spell compares to its closest canon analogue. Cite the sigil/sign docs (`file:line`)
  for every such claim. Don't pad with variation/modification lists.
- **No invented ids or effects.** If a part isn't in `data/`, flag it (the CLI lists
  `unknownIds`) and ask.
- **Honor canon's ambiguity.** Where the manga/wiki is unsure (asymmetric signs, eye,
  bend, link, etc.), present it as uncertain rather than inventing certainty.
- **Flag forbidden magic.** Body magic, reality-warping, or mass destruction ⇒ mark it
  forbidden (still analyze it). See the cheat-sheet §8.

## Learnings log
Append dated, one-line insights from real analyses (corrections, clarified mechanics,
limitations of certain magic types). Newest at the top.

<!-- e.g. - 2026-05-31: Inverted column ≈ dispersion per docs; treat the difference as unresolved in canon. -->
- 2026-05-31: **Engine: "spin" now means tangential cant, not any non-zero rotation.** The old `tilted` flag fired on *any* sign with rotation≠0, so a normal inward-facing ring (Pyreball) wrongly read "tilted → spin." Fixed: `computeSpin` (geometry.js) measures each directional sign's facing deviation from its **radial axis** (inward AND outward both = aligned/oriented); only a tangential cant > ~15° counts as spin. Non-directional signs (no front) never count. Wired into compose.js (`const tilted = computeSpin(...).spinning`); the CLI imports `analyzeCircleWith` from compose.js, so the one change fixes both app + CLI. Also added `inwardRotation(x,y)` (rotation that points a sign's top at center): the app now uses it as the default/reset rotation for newly-added signs, and the selected-part toolbar replaced the ±30/±5 buttons with a number input + a "reset" button.
- 2026-05-31: **Engine: inversion is now category-driven (signs.md's 4 categories), not an ad-hoc flag.** `canSteer(family)`/`canInvert(family)` live in geometry.js. *Directional* signs steer (rotation = facing; inverting flips the front 180°). *Semi-directional* invert to the OPPOSITE effect but don't steer. *Non-directional* have no front → rotation AND inversion are ignored (an `inverted:true` on float/repetition/bolt/etc. is dropped). *Asymmetric* = unknown. signs.json `invertible` was corrected to match family (radial/weave/rain/dancing_puppet/sights_set/gather → true; repetition → false). Don't report a non-directional sign as "inverted."
- 2026-05-31: **Engine: aim no longer hard-codes "up".** "Up"/"above the seal" is the *out-of-plane* default for a column beam or levitation lift — NOT compass north. Directional **motion** signs (levitation) now run through `classifyRegion` too: inward/balanced ⇒ "above the seal" (centered lift, e.g. Pyreball), all aligned one way ⇒ carried that compass way (air/wind case). Column/form default relabeled "up" → "above the seal"; only a genuine lateral bias (aligned region, or positional skew) gets a compass label. `analysis.aim` reads "above the seal" / "contained within the ring" / a compass dir / "outside the ring" / "along the ring".
- 2026-05-31: **Engine: active/inactive removed from the analysis.** Ring open/closed is only the app's activation visual (App.jsx toggle + status chip); the CLI/analysis no longer emits an `inactive` issue, `active`, `status: inactive`, or `analysis.ring`. Report only valid/invalid. (analyze.js keeps `status`/`active` solely to drive the app chip — the CLI, which is what this skill reads, does not.)
- 2026-05-31: "Continue" / vague nudges are NOT approval to archive. Get an *explicit* yes to writing the docs/spells/ md (step 5). Burned this on the Flame Shot Seal — wrote the doc on a bare "Continue." Ask plainly: "Ready for me to write the doc?"
- 2026-05-31: **FIXED in engine.** Direction now has two separate concepts: **aim** (from the *orientation* of directional signs — `computeOrientationAim` + `classifyRegion` in geometry.js) and **balance** (positional skew of *column/projection* signs only, `computeDirectionalBias` over form-directional signs). Region/pull signs are classified into the 4 canon configs (aligned→fired <dir> / inward→contained / outward→outside ring / opposed→along ring). Engine output now exposes `analysis.aim` + `analysis.balance` separately; the deduction summary says e.g. "fired up". Flame Shot Seal now correctly reads aim=up (was the bogus "skewed down"). The CLI (`tools/spell-engine-cli.mjs`) has its own copy of `analyze()` — keep it in sync with `src/engine/analyze.js`. Note: region signs need real per-sign `rotation` in the JSON for `classifyRegion` to read intent; the app should persist it (Flame Shot's export has all `rotation:0` = all point north = "fired up", which is correct for that seal).
- 2026-05-31: Flame Shot Seal (CANON) — fire sigil at the **bottom**, a large Column extending up to the far side → flame shoots **forward** in the direction of the column's point. Five Region signs on each side point **forward** (not inward-opposed) to confine the magic to the space ahead so it travels farther. Usage: Coco fired it at the heat-seeking valance leech (carried by Qifrey) as a heat decoy — the leech tracks heat, learned only later.
- 2026-05-31: Analyses should center on **element-physics & canon grounding** — reason from the substance's create/manipulate/collect constraint and physical state (fluid/granular/rigid) vs. each sign's documented mechanic, compare to the closest canon spell, cite docs by `file:line`, and end with a bottom-line synthesis. Dropped the "Variations & modifications" sections from both the analysis and the doc template.
- 2026-05-31: Earth Orb vs Water Orb is the model case: water can *create* its material (self-sufficient), earth only *manipulates* (needs a real source — "a pump that needs a reservoir"); Orb fills bottom-to-top like a fluid, so sand/soil pool cleanly but rigid rock/wood jam without a compaction sign (e.g. convergence).
- 2026-05-31: Always present the full analysis and get explicit user approval BEFORE writing the docs/spells/ md — the user wants to discuss and adjust first (see step 5).
- 2026-05-31: The spell catalog (data/spells.json) is empty, so the engine never returns `similar` matches (reports `catalogEmpty: true`). Any "similar/related spells" must be drawn from the docs and labeled as narrative, not presented as an engine catalog match.
- 2026-05-31: Inverting a **water sigil** has no known effect — engine deduces the identical result inverted or not (Water Orb). Treat sigil-core inversion as cosmetic unless an element defines an `invertedVerb`.
