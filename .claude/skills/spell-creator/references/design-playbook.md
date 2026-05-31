# Spell design playbook

How to turn a desired effect into a buildable seal — and how to tell when it *can't*
be built within the rules. Pair this with the shared cheat-sheet
[../../spell-analyzer/references/magic-system.md](../../spell-analyzer/references/magic-system.md)
(core equation, validity rules, full sigil/sign catalogs, operator kinds, inversion,
dyes, JSON contract, engine usage). Read both before designing.

## Design loop

1. **State the target effect** in one sentence. What substance? What form? Aimed where?
2. **Pick the substance (sigil).** Match the element to the goal. Mixed goals ⇒ multiple sigils.
3. **Pick the form (signs).** Choose operators by *kind* (form/transmute/motion/direction/
   target/power/special/support) to assemble the desired manifestation.
4. **Check the hard constraints** (below). If a constraint blocks the idea, stop and
   explain — don't fudge it.
5. **Lay out geometry.** Even ring for stability (radial/bilateral); size/angle one
   part to aim; invert to reverse; tilt for spin.
6. **Validate with the engine** and iterate until the deduced effect matches the intent:
   ```bash
   echo '<composition-json>' | node tools/spell-engine-cli.mjs --text
   ```
   Adjust ids/inversion/placement until `summary`, `notes`, and validity read right and
   there are no `warnings`/`unknownIds` you didn't intend.
7. **Return** the importable `wha-spell@1` JSON + a usage explanation.

## Hard constraints (the "can this exist?" checklist)

These come straight from the docs. If the idea violates one, it's **not buildable as
asked** — say why and offer the nearest legal alternative.

- **Core required.** No sigil (or center-capable sign) ⇒ no spell (just an explosion if
  the ring closes). Center-capable signs: vision, repetition, billowing, weave, rain,
  bird, dancing_puppet, enlarge.
- **Earth cannot *create* matter** — only manipulate existing stone/sand/soil/wood
  (earth lift lesson). "Conjure a boulder from nothing" ⇒ impossible; manipulate
  existing earth instead.
- **Wind moves air, doesn't create it; aeriforms creates air, doesn't move it.** Need
  both behaviors ⇒ combine sigils.
- **Creating water is costly; collecting is cheaper.** Long-duration water spells should
  *collect* (collection/gather) rather than create.
- **Ring activation.** Effects that must toggle need the split-ring mechanic; "always-on
  but switchable" maps to spell-toggling, not a sign.
- **Body magic is forbidden.** Anything drawn on / affecting the human body (incl.
  healing) is forbidden — only Memory Erasure is permitted. Reality-warping and
  mass-destruction are forbidden too. You can still *design* it, but flag it loudly.
- **Inversion only for directional / semi-directional signs.** "Reverse this radial
  sign" ⇒ non-directional signs have no front to flip; pick a different sign.
- **Signs determine form, not new substance.** A sign can't supply an element a sigil
  doesn't (a decorative/animal sign shapes magic; it isn't a fire source).
- **Decorative sigils are mostly aesthetic** — they shape magic into a creature's form;
  rarely do practical work (Horse is the notable exception).

## Effect → recipe starters (grounded in canon)

Use these as starting points, then validate. Read [docs/spells.md](../../../../docs/spells.md)
and the per-sign "Spells Using…" lists for more precedent.

| Want… | Substance | Signs | Canon precedent |
|-------|-----------|-------|-----------------|
| Shoot a jet/beam in a direction | water / light / fire | column (aim by size/angle) | Watershot, Light Beam |
| Spray/leak outward in all directions | any | dispersion (or inverted column) | Water Pen |
| Floating ball/orb of element | fire / water | levitation (lift) or orb (collect into sphere) | Pyreball, Water Orb |
| Pull matching matter in | element of the matter | pull (inward); angle ⇒ vortex | Grasping Wind |
| Push matter away | element | pull inverted | (implied by pull) |
| Pulverize a solid | earth | crush (+ column for reach) | Wall Breaker |
| Reassemble dust into solid | earth | crush inverted | Integration |
| Grow / shrink an object | (self via window / neighbors via diamond) | enlarge (inverted = shrink) | Floating Expansion / Spell of Reduction |
| Make a soft cloud to sit on | (billowing can be the core) | billowing + collection | Billow Cluster |
| Rainfall over an area | water | rain (surrounds center) | Rainbringer |
| Fast projectiles | water/etc. | bolt + region (to aim) | Water Bolt |
| Turn a solid into a flexible ribbon | earth / crystal / light | weave (surrounds center) | Boulder Stretch Rope, Crystal Ribbon |
| Fly / pilot an object by mind | wind | dancing_puppet (puppet) | Flying Puppet, Cloak |
| Move the object the seal is on | wind | levitation (for air sigils) | Skysoaring, Sylph Shoes |
| Keep a thing from changing/rotting | repetition_sigil (time) | (repetition as sigil) | Repetition Seal |
| Halt time for one aspect (e.g. heat) | stop + element sigil | — | Warmth-Retention, Time Stop |
| Conceal an object in shadow | vision_sigil | eye + bend | Gathering Shadows, Cloak |
| Temper an element down (fire→warmth) | fire | radial | Snugstone |
| Focus/harden/compact | any | convergence | Wind Wall, Serpent's Bed of Sand |
| Aim at a chosen target by mind | any | sights_set | Capture Pennant |
| Confine effect to an area / self / neighbors | any | crosshair / window / diamond | Rainflinger / Floating Expansion / Spell of Reduction |
| Strengthen / make durable | any | strengthen | Capture Pennant |
| Wrap around objects | any (ribbon-like) | entwine | Capture Pennant |
| Separate impurities | water / air | purify (asymmetric) | Purify |
| Shape magic into a creature | decorative sigil | + element sigil for substance | Water Horse (horse + water) |

## Tuning levers (after the base recipe works)

- **Aim:** make one directional sign larger (`scale`) or place it off-axis; region signs
  pointing in/out/at-each-other control where the effect lands.
- **Spin:** tilt signs (`rotation`); more tilt = more spin, less reach.
- **Stability:** even ring placement (radial) or a mirror axis (bilateral). Asymmetry ⇒
  unstable; the engine warns.
- **Power:** bigger seal (`scale`), neatness, and `linkCount` (linked copies) raise power;
  convergence focuses it; radial tempers it down. Dyes: Blood (power), Azuremoon (duration).
- **Reverse:** invert an invertible sign for the opposite effect.

## When it's not possible

If a hard constraint blocks the idea, return:
1. **Why** — name the specific constraint/limitation (with the doc reasoning).
2. **Nearest legal spells** — 1–3 existing spells whose effect is closest, and how they
   differ from the ask.
3. **A legal reframing** — the closest buildable version of their intent, if one exists
   (e.g. "can't conjure rock, but here's a seal that lifts and shapes existing rock").
