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
- 2026-06-01: **Water Pen (canon, water)** — a water **tool** spell, not a weapon: a water core with
  **Dispersion + 2 horizontal Columns** at the top and two new unknown signs (Unknown 4 = arc, mirrored
  side pair; Unknown 3 = triangle, bottom). KEY pairing: Dispersion ("leaks/meters outward", signs.md:45)
  + balanced Columns ("re-confine into one body", signs.md:34) = a steady metered bleed gathered into a
  single coherent glob — the inked-pen reservoir, opposite of the Watershot jet. Water's create-mode +
  fluidity is load-bearing: conjured in the palm (no reservoir) and soaks up poured conjuring ink to
  become a giant brush. Engine `aim=up`/spin are artifacts (Dispersion+Columns clustered at top, Columns
  rotated horizontal) — canon glob hovers BELOW at an angle. Closest in spirit to Water Horse (held,
  shaped body), not the jets. 3 unknown signs ⇒ "incomplete deduced effect" (shape/hover unresolved).
- 2026-06-01: **Watershot Seal (canon, water)** — Coco's first spell: water core + ring of inward
  Column signs. Balanced ⇒ straight-up jet; enlarge one column and the jet leans toward it
  ("size sets aim" for directional signs, signs.md:11/34) — the misfire that soaked Agott, and the
  principle behind the Skysoaring Seal. ENGINE BLIND SPOT: a single oversized column produces a real
  directional bias (measured 0.18 toward the big column for one 2.35× of 8), but it lands just under
  the 0.25 `biased` threshold, so the engine reports `balanced`/straight-up — override per canon. The
  oversized column was at the **south** (y≈+56 = bottom; GlyphCanvas renders y-down, no negation), so
  the jet leaned south. Equalizing all columns drops the bias to 0.013 (genuinely straight up).
- 2026-06-01: **Water Horse (canon, water)** — a **two-sigil** spell: water core + the **`horse`
  decorative sigil** (element `decorative`), which is the shape-giver and carries real utility
  (*"Manifests magic as a horse; can pull loads"*, sigils.json) — NOT `animal_signs` (a no-effect
  decorative *sign*). Matcher keys only on core + **sign** multiset (extra `role:sigil` sigils are
  ignored by `buildSignature`), so record secondary sigils in the catalog entry's `notes`. Signs:
  Column ×2 (horizontal, flank the horse) + Region ×2 (bottom) + Unknown Sign 1 ×2 + Unknown Sign 2
  ×3. The 5 unknown signs ⇒ engine flags "deduced effect incomplete"; what they encode (cohesion /
  locomotion / steering of the water-body) can't be deduced from one spell — needs a 2nd appearance.
- 2026-06-01: **Water Bolt (canon, water)** — defines the **Bolt** sign (signs.md:255). Water sigil at
  bottom + horizontal row of Bolt (middle) + parallel row of Region = fast horizontal volley of water
  arrows "straight ahead," drawn **big on the ground**. KEY: the engine's directional word (`down`
  here) is an **in-plane axis label, NOT gravity** — a ground-drawn seal fires horizontally; don't
  narrate "down" as a vertical/downward shot. Water's create-mode = self-sufficient ammo (no
  reservoir). Structural twin of Flame Shot (forward-confining Region row), projectile cousin of the
  Watershot jet.
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
