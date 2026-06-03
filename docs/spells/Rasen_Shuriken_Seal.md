---
name: Rasen Shuriken Seal
type: wind
origin: fan
forbidden: false
status: valid
core: wind
signs: convergence ×4, pull ×4, levitation ×4, direction (Region) ×4
dyes: none
symmetry: bilateral
source: designed via /spell-creator (a Witch Hat Atelier rendering of Naruto's Wind Release: Rasenshuriken); spin/structure refined on feedback from the Spell Checkers community
image: none yet
json: none yet
---

# Rasen Shuriken Seal

> Works the surrounding air into a dense, fast-spinning vortex, then blasts it forward in one direction — a *Witch Hat Atelier* take on Naruto's Wind Release: Rasenshuriken.

## Overview
A `fan`-designed offensive wind seal. It gathers ambient air, packs it tight at the core, spins it into a vortex, and launches that spinning mass forward as a directed air blast. Built entirely from multi-spell-attested parts (Wind Wall, Grasping Wind, Skysoaring) so no mechanism rests on a thinly-documented symbol. The spin specifically comes from **angled pull** (the Grasping Wind vortex), **not** from tilted convergence — a correction supplied by the Spell Checkers community.

## In plain terms (sum up)
This seal grabs the air around you, squeezes it into a tight, fast-spinning ball — a little wind-tornado — and then throws it forward as a hard blast. It works in four beats: the wind mark gathers the air; the "converge" marks by the center pack it dense; angled "pull" marks twist it into a spinning vortex; and the forward-pointing "lift" and "aim" marks fling the whole thing in one direction. It's best as a **ranged air-blast attack** — or, shrunk down, a controllable spinning gust for pushing or knocking things over. Think "a thrown, spinning version of the air a Wind Wall is made of."

## Validity
**Valid** (engine fact). One wind core + sixteen signs, no unknown ids, bilateral symmetry → stable, balanced. Info-level notes only (aim, spin). It will run.

## Composition
- **Substance (sigil):** Wind `wind` — element air. Moves/manipulates the ambient air (cannot create it).
- **Form (signs):**
  - **Convergence ×4** — semi-directional `power`. Placed by the core (INNER), pointing inward — compresses the air into a dense, concentrated mass. *Not* the spin source.
  - **Pull ×4** — directional `direction`. On the diagonals, canted tangentially — the angled-pull twist = the spinning vortex (Grasping Wind mechanism).
  - **Levitation ×4** — directional `motion`. Cardinals, all facing forward — on air, propels the construct the way it points (the thrust).
  - **Region ×4** — directional `direction`. On the rim, all forward — aims the blast in one direction.
- **Ring:** closed.
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
*Engine facts:* valid; `spin: true`; aim forward (engine "up" = the out-of-plane default for an aligned directional set, not compass north); bilateral/stable/balanced; power "concentrated to a point (Convergence)"; nearest catalog neighbours **Floating Drops (0.60), Wind Wall (0.55), Grasping Wind (0.55)**.

*Deduced (my reading, from CORE + lexicon):* the seal manipulates ambient air, convergence packs it into a dense core, the tangential pull ring twists that core into a **spinning vortex**, and the forward levitation + region signs **propel and aim it as a single directed air blast**. Net: a concentrated, spinning blast of wind fired in one direction — a drilling air projectile.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Wind core | substance (air) | Remove it → no substance, nothing to spin or throw. |
| Convergence ×4 (by core) | `power` — densify | Remove → a loose, diffuse gust instead of a concentrated blast. (It does **not** contribute spin.) |
| Pull ×4 (angled) | `direction` — twist/vortex | Remove → no spin; a straight blast with no drilling vortex. |
| Levitation ×4 (forward) | `motion` — thrust | Remove → the vortex forms but doesn't travel. |
| Region ×4 (forward) | `direction` — aim | Remove → propulsion with a fuzzier heading. |

## Element behavior & canon grounding
**Capability constraint.** Wind "allows for the movement and manipulation, but not the creation, of air" ([sigils.md:65](../sigils.md#L65)). So this is a *manipulator* working the **ambient air** around the caster, not a self-sufficient conjuration — trivially fed outdoors, but inert in a vacuum. It is *"a fan that needs air in the room."*

**State vs. mechanic.** Air is gaseous — diffuse and compressible. Convergence's headline use is on loose grains (sand → rigid, Serpent's Bed of Sand), but Wind Wall shows it also **densifies a gas** into a pressurized body ([signs.md:107](../signs.md#L107); lexicon: "the firmness trick extends to gases"). That underwrites the dense core here. The **spin** is the load-bearing correction: tilting convergence does **not** rotate a spell — convergence is a `power` sign that focuses to a point and has no output channel to spin ([lexicon, Convergence 2026-06-03]). The canon spin-for-wind is Grasping Wind's **pull**: "pointed inwards at an angle… both a pulling and twisting effect, and… rotated a full 90 degrees… will just twist without pulling" ([signs.md:65](../signs.md#L65)) — a tangential pull ring = pure twist = vortex. The **launch** is Skysoaring's mechanism: for air, levitation "will cause the object… to move through the air… in the direction of the arrow" ([signs.md:55–57](../signs.md#L55)); region "all point to the same side → the magic will shoot in that direction" ([signs.md:96](../signs.md#L96)).

**Closest canon analogues.** *Grasping Wind* — same wind + same angled-pull vortex; differs in that Grasping Wind pulls matter *inward* to grab, whereas here the pull is tangential (twist only) and the construct is thrust *outward*. *Wind Wall* — same wind + same convergence-densified air; differs in being a static inward barrier rather than a spun, launched projectile. *Skysoaring* — same wind + levitation propulsion; differs in moving the *rider* rather than a free air-construct.

**Bottom line.** Every mechanism is canon-grounded: wind manipulates ambient air, convergence densifies it (Wind Wall), angled pull twists it into a vortex (Grasping Wind), levitation + region launch and aim it (Skysoaring/Floating Drops). It is essentially **a Wind Wall's packed air, spun by a Grasping-Wind vortex and thrown** — a mobile offensive recombination of defensive/utility canon. The single inference beyond canon is that a dense spinning air mass *cuts/drills* rather than merely blocks; canon shows compressed air resisting force, not slicing, so treat the "shred" as well-motivated theory while the spin/launch/compression are solid.

## How to draw it
1. **Wind sigil** at the center.
2. **4 convergence (▽)** close to the core (inner ring), each pointing **inward** — they pack the air dense.
3. **4 pull** on the diagonals, **canted tangentially** (rotated ~90° off radial, all the same hand) — these spin the air into a vortex. More cant = more spin, less reach.
4. **4 levitation (↑)** on the cardinals, **all pointing the same way (forward)** — the thrust.
5. **4 region (∧)** on the rim, **all pointing the same forward way** — the aim.
   Keep the 4-fold layout even for stability; tilt only the pull signs.

## Usage ideas
- Ranged air-blast attack — a drilling, spinning gust fired down a line.
- Shrunk down: a controllable spinning gust to shove, unbalance, or knock over.
- Breach/sweep: launch it across an opening to push back loose projectiles or a swarm.
- Utility wind-drill for clearing debris or boring through a weak, non-rigid barrier.

## Similar spells
- **Grasping Wind** — the vortex source (angled pull); inward-grabbing rather than outward-thrown.
- **Wind Wall** — the densified-air source (convergence); static barrier rather than projectile.
- **Skysoaring Seal** — the propulsion source (wind + levitation); moves the rider, not a construct.
- **Floating Drops** — shares the region-driven directional geometry.

## Notes & limitations
- **Not forbidden**, but offensive: it isn't drawn on a body, doesn't warp reality, and at medium scale isn't mass destruction (comparable to canon Wall Breaker). ⚠️ A giant version would approach the "excessive environmental destruction" line (CORE §7) — keep it medium.
- **Needs ambient air** — inert in a vacuum.
- **The "division sign" question:** the Spell Checkers exchange named a "division sign" for the spin; there is no sign literally so-named in canon. Implemented as **Pull** (the sign Grasping Wind uses for its twist). Left unconfirmed by the crew; recorded here as the working interpretation, not fact.
- **The cut is theory.** Dense spinning air is canon for *blocking* (Wind Wall); that it *cuts* is an extrapolation.

## Reproduction
- **Image:** requested from user
- **JSON:** paste below (importable wha-spell@1)

```json
{
  "format": "wha-spell@1",
  "version": 1,
  "composition": {
    "name": "Rasen Shuriken Seal",
    "ring": { "closed": true, "size": "medium" },
    "core": { "id": "rasenc", "type": "wind", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
    "components": [
      { "id": "rasens0", "type": "convergence", "role": "sign", "x": 0, "y": -76.5, "rotation": 180, "scale": 1, "inverted": false },
      { "id": "rasens1", "type": "convergence", "role": "sign", "x": 76.5, "y": 0, "rotation": 270, "scale": 1, "inverted": false },
      { "id": "rasens2", "type": "convergence", "role": "sign", "x": 0, "y": 76.5, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "rasens3", "type": "convergence", "role": "sign", "x": -76.5, "y": 0, "rotation": 90, "scale": 1, "inverted": false },
      { "id": "rasens4", "type": "pull", "role": "sign", "x": 84.1457, "y": -84.1457, "rotation": 135, "scale": 1, "inverted": false },
      { "id": "rasens5", "type": "pull", "role": "sign", "x": 84.1457, "y": 84.1457, "rotation": 225, "scale": 1, "inverted": false },
      { "id": "rasens6", "type": "pull", "role": "sign", "x": -84.1457, "y": 84.1457, "rotation": 315, "scale": 1, "inverted": false },
      { "id": "rasens7", "type": "pull", "role": "sign", "x": -84.1457, "y": -84.1457, "rotation": 45, "scale": 1, "inverted": false },
      { "id": "rasens8", "type": "levitation", "role": "sign", "x": 0, "y": -119, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "rasens9", "type": "levitation", "role": "sign", "x": 119, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "rasens10", "type": "levitation", "role": "sign", "x": 0, "y": 119, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "rasens11", "type": "levitation", "role": "sign", "x": -119, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "rasens12", "type": "direction", "role": "sign", "x": 0, "y": -156.4, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "rasens13", "type": "direction", "role": "sign", "x": 156.4, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "rasens14", "type": "direction", "role": "sign", "x": 0, "y": 156.4, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "rasens15", "type": "direction", "role": "sign", "x": -156.4, "y": 0, "rotation": 0, "scale": 1, "inverted": false }
    ],
    "linkCount": 0,
    "dyes": []
  }
}
```
