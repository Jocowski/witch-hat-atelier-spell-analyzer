# Analyzer learnings

Accumulated corrections from real analyses — engine quirks, per-element limits, canon
nuances. Skim before analyzing; append new **dated one-liners** here (not in SKILL.md).
Engine-fix narratives belong in git history — record only the durable lesson.

## Engine capabilities (recently added — no longer blind spots)
- **Multi-circle spells now match the catalog** (as of the 2026-06-01 engine work): `analyze()`
  builds a COMBINED signature (union of every circle's signs + the set of all cores; symmetry
  from the form circle) so a nested spell like the Vapor Bubble self-matches. It no longer
  returns an empty `similar` for >1 circle. `perCircle` also carries each circle's own match.
- **Component zones** (`inside | ring | outside`) are tagged from distance-to-center vs ring
  radius (rules.json `zones`). Outside signs are external marks: excluded from aim/symmetry/
  balance AND from the deduction's primary clause (narrated as "external marks that frame the
  seal"). Sign multiset keys gain `@out` for outside signs / `placement:"outside"` recipes.
- **Ring-anchored components** carry `anchor:{ring,angle,offset}`, resolved to x,y in
  compose.normalizeCircle (pure `anchorToXY`/`xyToAnchor` in geometry.js). Pinned signs track
  the ring on resize. Use this to attribute ring-hugging signs to the correct circle.

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
  `defaultFacing:"outward"` flag (purify, collection, sights_set, **convergence** are drawn
  top-outward, i.e. the business-end/point is at the BOTTOM of the art) — check before
  reporting it as a deliberate inversion. (Purify; convergence facing fix 2026-06-01.)
- The **CLI (`tools/spell-engine-cli.mjs`) carries its own ported copy** of `analyze()` +
  `buildSignature`/`matchSpell`/`computeSimilar` — keep it in sync with `src/engine/`.

## Canon & mechanics log (newest first)
- 2026-06-01: **Crush facing — default orientation = Wall Breaker (outward), NOT Integration.** Canon:
  non-inverted Crush = Wall Breaker (peaks point **outward**, destroys → dust); inverted Crush =
  **Integration** (peaks point **inward**, reassembles powder to its source shape *temporarily* —
  Tartah ID'd powdered herbs by their original form). The engine verbs are canon-correct
  (`verb`=pulverize, `invertedVerb`=reassemble) — do NOT swap them or Wall Breaker breaks. The real
  bug was the app drawing Crush **inward by default** (`inwardRotation`, "top faces center") so a
  fresh non-inverted Crush *looked* like Integration but deduced destroy. Fix: gave Crush
  `defaultFacing:"outward"` (signs.json) so default render = peaks-outward = Wall Breaker = matches
  `inverted:false`; inverting then flips both art (inward) and effect (reassemble) together. Integration
  also works on ANY powder (herbs), not just earth's stone/sand — "manipulate not create" = it only
  rearranges existing particles, never conjures matter.
- 2026-06-01: **Boulder Stretch Rope (canon, earth)** — Richeh's spell: Earth core + a SINGLE large
  Weave keystone *wrapped around* it (not a ring of several — Weave "is supposed to surround the central
  sigil", signs.md:139). Transmutes rigid stone into a long flexible ribbon/rope. Runs in earth's
  MANIPULATE mode (sigils.md:53) — needs a real boulder/rock present, cannot conjure stone ("a loom that
  needs raw stone fed in"). The drama is overriding rock's defining rigidity. Same Weave sign as Crystal
  Ribbon & Light Tracer on softer/self-creating substances. Canon uses: Richeh bridged the gap in the
  serpent-back cave; Agott/Coco/Tetia bound Wolf Euini. Engine "asymmetric/unstable" = single-sign
  artifact. Now in the catalog (self-matches ~0.85).
- 2026-06-01: **Qifrey's Water Dragon (canon, water)** — Qifrey's signature spell (subdues the dragon
  attacking Coco in the Illusory Labyrinth). Dragon decorative sigil (shape-giver; the ONLY canon spell
  using it, sigils.md:135) + Water ×4 sigils + modified Water Flower (`flower_water`) sigil + Enlarge ×1
  + Convergence ×4 + Column ×8, Azuremoon dye. KEY canon corrections to override the engine/first-guess:
  (1) runs in water's **COLLECT** mode — *"uses water from nearby clouds (and likely bodies of water)"* —
  NOT create; it NEEDS an environmental water source (atmosphere/lake), closer to "a pump that needs a
  reservoir." (2) **Convergence here is the INTAKE**, not the rigidity trick: it converges nearby
  cloud-water to a point so the Water sigils can incorporate it (rigidity/compaction is a documented
  secondary capability, but not its role here). (3) **Water Flower = end-state shaper**: when the dragon
  dissipates, it settles the spent water into a **water lily**. Enlarge = size, Columns = direction.
  Closest kin: Water Horse (same template: water + decorative-creature sigil), but by *source* it's
  Vapor Bubble / Rainbringer (environmental collection). Lesson: a decorative-creature sigil over water
  = a controllable water creature; SCALE comes from Enlarge, AIM from balanced Columns.
- 2026-06-01: **Convergence can act as a collection/intake sign**, not only a focus/compactor: in
  Qifrey's Water Dragon it converges water held in nearby clouds to a point so the water sigils draw it
  in. Don't assume Convergence on water = "compact into a dense body" (the Serpent's Bed of Sand
  rigidity reading) — check whether canon assigns it the gathering role instead.

- 2026-06-01: **Vapor Bubble Spell (canon, water; vol.12 bonus)** — a **nested two-circle**
  dew-still and the debut of the **Cool** (signs.md:147, "to help it condense from the air")
  and **Gather** (signs.md:197, "actively draw material in") signs. Inner closed circle =
  bare Water core acting as a *collection basin* (the engine's "no signs around core" warning
  is intended here, not a defect). Outer open circle = Wind ×2 sigils + 2 Gather + 4 balanced
  Column + 4 Cool = an air-conditioning plant (circulate → draw vapor in → channel → chill
  past dew point). Runs in water's CHEAP collect mode (sigils.md:41): harvests atmospheric
  humidity rather than creating water — a true air/water hybrid. Engine artifacts: balanced
  Columns read as "beam above seal" (they actually just confine airflow); multi-circle spells
  skip the catalog matcher (analyze.js:120 returns empty `similar`), so it won't self-match
  until the multi-circle matching fix lands. Closest canon kin: Purify (air-sourced cousin),
  Rainbringer (keeps the water instead of dropping it as rain).
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
