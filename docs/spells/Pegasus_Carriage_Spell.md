---
name: Pegasus Carriage Spell
type: wind
origin: wiki
forbidden: false
status: valid
core: wind_underfoot + whorling_wind (subspells)
signs: column ×many, levitation ×many, sign_of_wind ×many, aeriforms_defined ×many (per wiki description)
dyes: none
symmetry: radial (outer rings); bilateral (subspells)
source: telepedia 'Pegasus Carriage Spell': https://witchhatatelier.telepedia.net/wiki/Pegasus_Carriage_Spell — manga debut ch. 1 (per wiki). Multi-ring contraption that keeps the pegasus carriage airborne and stable.
image: none yet
json: none yet
---

# Pegasus Carriage Spell

> A complex multi-ring contraption that keeps a pegasus carriage flying and level — combining
> wind-underfoot lift, whorling-wind rotation, and massed column/levitation signs to generate
> stable flight. The exact recipe is partially documented; the "signs of wind" and stability sign
> have uncertain function.

## Overview
The Pegasus Carriage Spell is the multi-ring flight-and-stability spell inscribed on the pegasus
carriage (ch. 1). It is what allows the carriage to fly and remain upright. Qifrey repaired a
damaged seal, which was observed by Coco — the moment she realized magic is drawn rather than
innate. The wiki describes a two-exterior-ring + four-interior-subspell contraption: the subspells
include **Wind Underfoot + Levitation + Aeriforms Defined** (two of them) and **Whorling Wind +
Column** (the other two), with sign-of-wind and more column signs in the connecting space and
a stability-and-level-planes sign at the center of the inner ring. Many of the signs are
novel or not fully identified; the wiki classifies the spell as **Unknown type**.

## In plain terms (sum up)
A hovering carriage needs two things: something to push it upward, and something to keep it
level when its flying horses change direction. This spell is a layered glyph that supplies both
at once. Two of its four inner sections combine a "wind-platform" sigil (wind underfoot) with
lift signs and an air-shaping modifier, providing stable aerial footing. The other two sections
combine a rotating-wind sigil (whorling wind) with column signs, apparently adding a rotational
or gyroscopic component that stabilizes the carriage. The whole assembly is wrapped in rings of
column and wind signs that coordinate the motion. Because it contains signs not seen elsewhere
(whorling wind, signs of wind), the full mechanics are uncertain — treat this as a best-reconstruction.

## Validity
The spell is **complex and partially documented**. The subspells (wind_underfoot + levitation +
aeriforms_defined; whorling_wind + column) are individually valid as read from known sign ids.
The "signs of wind" (`sign_of_wind`, asymmetric) and the "sign of stability and level planes"
(not identified in the id map — likely an unknown or the stability-specific reading of an existing
sign) make the full deduction incomplete. **No blocking issues on the identified parts.** The
contraption's overall stability is confirmed canonically (the carriage flies and stays upright).

## Composition
- **Substance (sigils):**
  - **Wind Underfoot** (`wind_underfoot`, air) — in two subspells; provides an air platform to
    support suspended objects. Capability uncertain: "somehow supports solid objects when suspended
    within air, similar to an air platform" (sigils.md:79).
  - **Whorling Wind** (`whorling_wind`, air) — in two subspells; manipulates air via rotation.
    Possible heat-coupling (three-sided design, sigils.md:87). Capability: manipulate via rotation.
- **Form (signs):**
  - **Column** (`column`, directional, form) — present in large numbers: in the inner ring's
    outermost section (a dense band), in the connecting space between subspells (all pointing
    clockwise — adding a rotational aspect), and in the whorling-wind subspells. Provides
    directional projection and, when all tilted clockwise, imparts rotation to the overall spell.
  - **Levitation** (`levitation`, directional, motion) — in the wind-underfoot subspells; lifts
    the carriage. On an air/wind substance, levitation is **directional** — the arrow aims the
    thrust, allowing the carriage to be steered (unlike levitation on water/fire/light, which only
    lifts straight up — see [lexicon/signs-directional.md](../lexicon/signs-directional.md),
    Levitation Findings).
  - **Aeriforms Defined** (`aeriforms_defined`, semi-directional, special) — in the wind-underfoot
    subspells alongside levitation; shapes how the air takes form. Exact function unclear; known to
    serve as a modifier to the wind-underfoot sigil (signs.md:189).
  - **Sign of Wind** (`sign_of_wind`, asymmetric, motion) — present in the connecting
    arrangements between subspells. In Spiraling Flame this sign acts as a spin/whirlwind keystone;
    here it may instead act as a plain wind-movement sign. **Function uncertain for this context**
    (signs.md:179).
  - **Stability sign** — described as "a sign of stability and level planes" at the center of the
    inner ring. Identity unknown; keeps the carriage upright. **Not mapped to a known sign id** —
    treat as an unidentified sign that enforces orientation stability.
- **Ring:** The contraption has two exterior rings and four interior subspells arranged within
  the inner ring, each subspell with its own closed ring.
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
The spell produces **powered, stable aerial flight** for a carriage. Reasoning from the identified
components:

1. **Lift:** The two wind-underfoot subspells pair the air-platform sigil with **Levitation** and
   **Aeriforms Defined**. Since wind_underfoot is an air substance, Levitation is **directional on
   air** — it propels in the direction the arrow faces, not merely straight up. Paired with
   aeriforms_defined (an air-shaping modifier), these subspells supply the active upward thrust and
   allow the casters (flying horses) or the spell itself to redirect the carriage.
2. **Gyroscopic stabilization:** The two whorling-wind subspells add rotating air; their column
   signs project the rotating-air column downward or outward, likely creating a gyroscopic
   rotational air-field. The clockwise-tilted columns in the connecting sections reinforce this spin.
   The result is that the spell actively resists tipping — the carriage stays level even when being
   pulled through turns.
3. **Stability lock:** The unidentified stability sign at the inner-ring center enforces the
   orientation constraint (keeps the carriage floor horizontal).
4. **Power and coordination:** The outermost band of column signs (large quantity) provides
   sustained power for the whole assembly.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Wind Underfoot ×2 (sigil) | substance (air platform) | Provides the footing-in-air foundation — an aerial platform supporting the carriage's weight. |
| Levitation (in wind_underfoot subspells) | motion, directional | Generates the upward/directed thrust; directional on air = steerable lift. |
| Aeriforms Defined | special air modifier | Shapes how the wind-underfoot air takes form; specific function unclear, but pairs canonically with wind_underfoot. |
| Whorling Wind ×2 (sigil) | substance (rotating air) | Spins air via rotation; provides the gyroscopic stabilization component. |
| Column (in whorling_wind subspells) | form | Projects the rotating air; adds directional control to each stabilizer sub-seal. |
| Column (connecting band, clockwise-tilted) | form + spin | Tilted clockwise = all columns contribute rotational motion → whole spell spins as a unit (gyroscopic effect). |
| Column (outermost dense band) | form + power | Large quantity of columns = sustained power for the whole contraption. |
| Sign of Wind (connecting sections) | motion (uncertain) | Likely reinforces air movement across the connecting space; in this context may act as plain wind-flow rather than spin-keystone. |
| Stability sign (inner center) | unknown (orientation) | Keeps the carriage upright; exact mechanic unknown. |

## Element behavior & canon grounding
**Wind Underfoot** is an air-family sigil whose capability is "somehow supports solid objects when
suspended within air" (sigils.md:79) — it is the *support* facet of air, providing a platform
rather than propulsion. Paired with **Levitation** on an **air** substance, this is the only
configuration where Levitation becomes **directional** (it can steer; on water/fire/light levitation
only lifts straight up — signs.md:53–57). The anime confirmed that wind-spell levitation motion
follows the arrow direction. This makes the wind-underfoot subspells the **active propulsion
engine** of the carriage, with the arrow direction setting the thrust vector.

**Whorling Wind** manipulates air through rotation (sigils.md:87). Its three-sided design may
indicate a fire-coupling for hot-air lift (like a hot-air balloon), but that is flagged as
speculation. The more straightforward reading: column + rotating-air = a spinning air column that,
when four such units are arranged symmetrically under the carriage, acts like a gyroscope to keep
it level.

**Sign of Wind** in the connecting space: per the lexicon finding (signs-asymmetric.md), in
Spiraling Flame this sign is the "whirlwind keystone" that sets a flame column spinning; in the
Pegasus Carriage Spell it instead reads as "a plain wind sigil." Given the connecting-space context
(between subspells, not inside a fire spell), the plain-wind-movement interpretation is more
plausible. It may simply reinforce the airflow between the four subspells.

**Closest canon analogues:**
- **Sylph Shoes Seal** — also uses wind_underfoot + levitation (and aeriforms_defined), but for
  personal foot-levitation rather than a carriage. The Pegasus Carriage Spell is essentially a
  scaled-up, rotation-stabilized Sylph Shoes.
- **Skysoaring Seal** — wind + levitation for personal flight, without the whorling-wind
  stabilization component.

**Bottom line:** The spell is a multi-ring flight-and-stabilization contraption. The lift engine
(wind_underfoot + levitation + aeriforms_defined) is mechanically well-understood and maps cleanly
to the Sylph Shoes precedent. The gyroscopic/rotational stabilization (whorling wind + clockwise
columns + sign_of_wind) is the novel component that gives the carriage its leveled flight. The
"sign of stability and level planes" at the center enforces the uprightness constraint. Full recipe
reconstruction is not possible from the description alone — key signs remain unidentified.

## How to draw it
(Reconstruction guidance — not a recipe, as the spell has unidentified keystones.)

1. **Two interior subspells (wind-platform):** Wind Underfoot sigil at center; Levitation signs
   facing upward/inward; Aeriforms Defined alongside them. Close each in its own ring.
2. **Two interior subspells (stabilizer):** Whorling Wind sigil at center; Column signs around it.
   Close each in its own ring.
3. **Arrange the four subspells symmetrically** inside an inner ring; put the stability sign at the
   inner ring's center.
4. **Connecting space:** Sign of Wind + Column signs between the subspells, with the column signs
   all tilted clockwise (for the rotational effect).
5. **Outermost band:** Dense ring of Column signs for sustained power.
6. **Two exterior rings** enclosing the whole inner assembly.
7. Symmetry matters: the four subspells must be evenly placed to keep the carriage balanced.

## Usage ideas
- **Carriage flight:** the canonical use — keep a pegasus carriage airborne and level.
- **Any large vehicle levitation:** the four-subspell arrangement with rotational stabilization
  could in principle stabilize any large object that needs to stay level while airborne.
- **Adaptation for smaller vehicles:** a simplified version (fewer columns, two subspells) might
  work for lighter loads, analogous to how Sylph Shoes is the personal-scale Pegasus Carriage.

## Similar spells
- **Sylph Shoes Seal** — the personal version: wind_underfoot + levitation + aeriforms_defined
  for foot-level air-walking.
- **Skysoaring Seal** — simpler wind + levitation for personal flight; no rotational stabilization.
- **Flying Puppet of Diversion** — wind + dancing_puppet for erratic, guided flight of an object.

## Notes & limitations
- **Unknown type (per wiki):** Contains signs not seen elsewhere (sign_of_wind with uncertain
  function in this context; whorling_wind for which the heat-coupling is speculative; a stability
  sign not in the sign id map).
- **Multi-ring contraption:** The app's single-ring canvas cannot fully represent this spell;
  IR format needed (wha-spell@2 with multiple circles and relations).
- **No buildable recipe:** the full keystone list is too incomplete to produce a valid wha-spell
  export with all positions confirmed. Recipe confidence: low.
- Not forbidden; standard flight/stability magic.

## Reproduction
- **Image:** none yet (requested from user)
- **JSON:** not yet reproducible — too many unidentified keystones and unknown placement geometry.
  A partial single-ring approximation of one subspell could be built; see below.

```json
{
  "format": "wha-spell@1",
  "name": "Pegasus Carriage Spell (wind-underfoot subspell only)",
  "ring": { "closed": true },
  "core": { "id": "c1", "type": "wind_underfoot", "x": 0, "y": 0, "rotation": 0, "scale": 1 },
  "components": [
    { "id": "s1", "type": "levitation", "role": "sign", "x": 0, "y": -110, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "s2", "type": "levitation", "role": "sign", "x": 110, "y": 0, "rotation": 270, "scale": 1, "inverted": false },
    { "id": "s3", "type": "levitation", "role": "sign", "x": 0, "y": 110, "rotation": 180, "scale": 1, "inverted": false },
    { "id": "s4", "type": "levitation", "role": "sign", "x": -110, "y": 0, "rotation": 90, "scale": 1, "inverted": false },
    { "id": "s5", "type": "aeriforms_defined", "role": "sign", "x": 77, "y": -77, "rotation": 315, "scale": 1, "inverted": false },
    { "id": "s6", "type": "aeriforms_defined", "role": "sign", "x": 77, "y": 77, "rotation": 45, "scale": 1, "inverted": false },
    { "id": "s7", "type": "aeriforms_defined", "role": "sign", "x": -77, "y": 77, "rotation": 135, "scale": 1, "inverted": false },
    { "id": "s8", "type": "aeriforms_defined", "role": "sign", "x": -77, "y": -77, "rotation": 225, "scale": 1, "inverted": false }
  ],
  "dyes": []
}
```
