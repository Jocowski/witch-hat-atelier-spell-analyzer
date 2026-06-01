# Analyzer learnings

Accumulated corrections from real analyses — engine quirks, per-element limits, canon
nuances. Skim before analyzing; append new **dated one-liners** here (not in SKILL.md).
Engine-fix narratives belong in git history — record only the durable lesson.

## Engine blind spots — override these in your reading
- **Clustered / partial-ring region signs:** the engine reads WHERE region signs sit only
  coarsely. A one-sided inward cluster now reads `biased` (surging toward the cluster), but
  it still won't catch an **off-vertical tilt** — when region/direction signs cover only part
  of the ring, read the positional distribution yourself; don't trust `aim` blindly. (Rising Wave.)
- **Levitation on water/fire/light lifts WITHOUT steering** — only air/wind levitation is
  directional (signs.md:55). The engine routes every directional sign through aim/spin math
  element-agnostically, so non-uniform water/fire/light levitation produces a **spurious
  lateral aim and/or spin** — treat those as artifacts, the lift is vertical. (Rising Platform.)
- **Single-sign "asymmetric → unstable" flag** is usually a geometry artifact (one sign read
  slightly off origin), not a real defect. (Rainbringer.)
- **`inverted:true` on a directional sign in an export** may just mean the sign lacks a
  `defaultFacing:"outward"` flag (purify, collection, sights_set are drawn top-outward) — check
  before reporting it as a deliberate inversion. (Purify.)
- The **CLI (`tools/spell-engine-cli.mjs`) carries its own ported copy** of `analyze()` +
  `buildSignature`/`matchSpell`/`computeSimilar` — keep it in sync with `src/engine/`.

## Canon & mechanics log (newest first)
- 2026-06-01: **Rising Wave (canon, water)** — half-ring Region placement = diagonal propulsion
  (launches the caster up). Closest analogue: Rising Platform (lifts straight up via Levitation) —
  same goal, opposite mechanism (Region asymmetry vs. Levitation).
- 2026-06-01: **Rising Platform of Water (canon)** — column orientation (inward vs outward) is
  cosmetic on a radial ring; what actually changes a column is the **`inverted` flag**
  (driven inward / erupts ≈ dispersion, signs.md:34). Don't conflate "rotated outward" with "inverted."
- 2026-06-01: **Rainbringer Seal (canon, water)** — one large **Rain** sign IS the whole form;
  Rain is the surround (signs.md:287), don't ring multiples. Semi-directional/invertible:
  upright = rainfall, inverted ≈ draw-in/drying. Cleanest water sigil/sign pairing.
- 2026-06-01: **Purify (canon, water)** — Purify (asymmetric, separates impurities that pile up
  near the seal) + Collection (intake) = standing wastewater purifier. Pairs with water because
  dirty water is a fluid suspension; runs in water's cheaper collect/manipulate mode (sigils.md:41).
- 2026-06-01: **Spiraling Flame (canon, fire)** — **Sign of Wind = "whirlwind keystone"** here:
  it twists the flame column into a spiral (kind `motion`). Hedge: in the Pegasus Carriage Spell
  the same sign is a plain wind sigil, so spin may not generalize. Engine can't measure the spin.
- 2026-06-01: **Snugstone (canon, fire)** — Radial sets the *kind* of output (flameless warmth);
  seal *size* sets the safe *amount*. Safety is a calibration that amplification/power-dyes break,
  not an inherent ceiling (Arcane Lens unbalanced it → melted the Ancients of Romonon).
- 2026-05-31: **Flame Shot (canon, fire)** — fire sigil at the bottom, a large Column extending to
  the far side → flame shoots forward toward the column's point; flanking Region signs face forward
  (not inward-opposed) to confine the magic ahead so it travels farther.
- 2026-05-31: **Earth Orb vs Water Orb** is the model case — water can *create* its material
  (self-sufficient), earth only *manipulates* (needs a real source, "a pump that needs a reservoir").
  Orb fills bottom-to-top like a fluid, so sand/soil pool cleanly but rigid rock/wood jam without a
  compaction sign (e.g. convergence).
- 2026-05-31: Inverting a **water sigil** has no known effect (engine deduces the same result either
  way). Treat sigil-core inversion as cosmetic unless the element defines an `invertedVerb`.

## Process
- Analyses center on **element-physics & canon grounding** (create/manipulate/collect constraint +
  physical state vs. each sign's mechanic, compare to the closest canon spell, cite docs by `file:line`,
  end with a bottom-line synthesis). No "Variations/Modifications" sections.
- **Get an explicit "yes" before writing the `docs/spells/` doc.** "Continue" / vague nudges are NOT
  approval (burned this on Flame Shot — wrote the doc on a bare "Continue"). Ask plainly.
- The user does not want the "ring open/closed is just a visual" disclaimer repeated — omit
  active/inactive silently (see memory: `no-ring-visual-disclaimer`).
