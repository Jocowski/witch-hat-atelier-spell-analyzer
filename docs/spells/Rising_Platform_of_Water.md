---
name: Rising Platform of Water
type: water
origin: wiki
forbidden: false
status: valid
core: water
signs: column ×4, levitation ×4
dyes: none
symmetry: radial
source: Witch Hat Atelier — Second Pentagram Test arc (the spell Richeh's old master and apprentices used to traverse the floating mountains of the Dadah Range for the Consent of the Crown; later shown in a collage of spells the girls already knew). docs/sigils.md:41, docs/signs.md:34, docs/signs.md:55
image: assets/spells/Rising_Platform_of_Water.png
json: assets/spells/Rising_Platform_of_Water.json
---

# Rising Platform of Water

> A water-type spell that creates an upward surge of water, lifting the object the seal is drawn on straight up into the air.

## Overview
Rising Platform of Water is a canon water spell built from a central water sigil ringed by alternating Column and Levitation signs. Drawn on an object, it generates a column of water that lifts that object vertically — an elevator made of water. In the manga it is the spell Richeh's old master and his apprentices used to traverse the floating mountains of the Dadah Range in order to pass the Consent of the Crown; the design later appears in a collage of spells the girls already knew while strategizing to help Euini during the Second Pentagram Test arc.

## Validity
**Valid** (engine). Water core with 8 directional signs (4 Column + 4 Levitation), radially symmetric and balanced. No blocking or warning issues — only informational notes (stable / radial; aim above the seal). The ring is shown open in the app, which is the activation visual only and does not affect the analysis.

## Composition
- **Substance (sigils):** Water — element `water`. The body of the platform; sets how powerful the floating magic is (sigil size = lift power).
- **Form (signs):**
  - **Column ×4** (directional) — gathers the water into a standing column/beam above the seal. Drawn in the normal canon orientation: the **longer line faces inward** (the short "⊤" cap faces outward), as the mural shows ([signs.md:34](../signs.md#L34), [signs.json:25](../../data/signs.json#L25)). Not inverted — inverting a column instead makes it emit in all directions like dispersion.
  - **Levitation ×4** (directional) — suspends the water (and anything held over the seal) in the air. Drawn **horizontally** (facing sideways/tangential to the ring). For water spells the arrow's *direction does not steer* the effect; it only lifts.
- **Ring:** open in the reference export (prepared, not firing) — activation visual only.
- **Ink / dyes:** plain conjuring ink, no dyes.

## Deduced effect
Engine summary (canon-faithful orientation): *"The water is projected as a tight column or beam, centered above the seal; it is lifted and made to levitate."*

In plain terms: a **column of water rises straight up above the seal and is held aloft**, carrying its own surface and any load (including the object the seal is drawn on) up with it — a load-bearing, self-leveling platform of floating water.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water sigil | substance | the material the platform is made of; its size sets lift power. Without it there is nothing to lift. |
| Column ×4 | form (directional) | shapes the water into a standing column/beam above the seal — the platform's body. Without it the water has no defined form (undirected discharge). |
| Levitation ×4 | motion (directional) | suspends the column and its load in midair; sign size sets the weight capacity. Without it the water rises and falls back instead of staying aloft. |

## Element behavior & canon grounding
**The substance — water can be self-sufficient.** The water sigil "works to manipulate, collect, and create water… many water spells meant to be used over long periods collect water rather than create it" ([sigils.md:41](../sigils.md#L41)). A platform that holds a load aloft for any length of time is a sustained effect, so in practice it leans on the cheaper **collect** mode (drawing in ambient water) rather than continuously conjuring. Crucially, water *can* create at all — so even with no nearby source the platform can exist, unlike an earth platform, which can only **manipulate** stone/sand it doesn't create and would need a real reservoir of material under it.

**Physical state fits the form.** Water is a fluid: a Column of it forms a broad-topped standing pillar, and a fluid surface self-levels into exactly the flat top you want for a *platform*. Column "causes a spell to manifest in a column or beam above the seal" ([signs.md:34](../signs.md#L34)); on water that beam is a literal water pillar. Levitation then acts on "the spell's effect, as well as objects held overtop the seal" ([signs.md:55](../signs.md#L55)) — so the platform is load-bearing, not just floating water. Canon ties the numbers to draw size: **levitation sign size = weight capacity**, **sigil size = lift power** ([signs.md:55](../signs.md#L55)). How high and how heavy is a draw-size question, not a recipe change.

**Why the levitation orientation is free here (an important canon nuance).** Levitation is element-dependent: "For **water, fire, and light** spells, levitation causes the spell's effect… to **levitate in the air**. … For **air and wind** spells, levitation will cause the object… to **move through the air. The direction of this movement depends on which way the signs point**" ([signs.md:55](../signs.md#L55)). So on a **water** spell the levitation arrows' direction *does not steer the effect* — they simply lift. This is why the canon mural can draw them "horizontally" and why a hand-drawn seal with non-uniform levitation angles still lifts straight up: the orientation is cosmetically free. (The engine treats every directional sign as steering regardless of element, so non-uniform water-levitation angles make it report a spurious lateral "aim"/"spin"; that's an engine artifact, not a defect in the spell.)

**Why the geometry is radial.** Four Column + four Levitation spaced evenly means the lateral pulls of the Column signs cancel and the net Column manifestation is **straight up** — the platform rises vertically, which is what "rising" demands. The source cites this very spell as an example of using directional signs' angle/size to steer a result ([signs.md:11](../signs.md#L11)); here they are balanced so the steering nets to vertical.

**Closest canon analogues.** The engine catalog's nearest matches are **Water Orb**, Purify, and Rainbringer — all share the water core. **Water Orb** is the closest "shaped body of water" spell, but it *contains* water in a sphere (held at rest), whereas Rising Platform *lifts* a sheet of water; same substance, opposite relationship to gravity. **Pyreball Seal** (my reading, from the docs) uses Levitation in exactly the same lifting role ([signs.md:55](../signs.md#L55)) but floats *fire* into a ball rather than lifting a water platform; the difference is the element and the added Column that gives this spell a flat platform body. **Rising Wave** ([spells.md:25](../spells.md#L25)) is the nearest thematic water sibling — the other "rising" water spell, also using Column.

**Bottom line:** This is the textbook Column + Levitation pairing on a fluid — Column erects a standing water pillar, Levitation suspends it and its load, giving a load-bearing platform of floating water that rises straight up. Water is the ideal substance because a fluid self-levels into a flat top and the sigil can collect rather than conjure for sustained use; reach and capacity scale with seal/sign size, exactly as canon states. Uniquely among directional spells, the Levitation orientation is *functionally free* here because water-levitation lifts without steering — so varied or "horizontal" arrows are all valid drawings of the same effect.

## How to draw it
1. Draw the **water sigil** at the center.
2. Place **8 signs evenly around the ring** (45° apart), **alternating Column and Levitation** — Columns on the diagonals, Levitations on the cardinals (or vice-versa); keep the spacing even for radial symmetry.
3. Orient the **Column signs in the normal way** — longer line pointing **inward** toward the sigil (short cap facing out), all matched, so the balanced ring nets to a vertical column. Do **not** invert them (an inverted column sprays in all directions like dispersion).
4. Draw the **Levitation signs horizontally** (lying sideways/tangential). Their exact direction does not change the effect on a water spell, but keeping them uniform looks neater and avoids confusing readers (and analyzers) into thinking the spell leans or spins.
5. **Size** sets the spell: a bigger seal lifts more powerfully; bigger Levitation signs carry heavier loads. Keep the drawing neat for stability and duration.

## Usage ideas
- **Elevator / lift** — raise a person or cargo straight up (the canonical traversal use across the Dadah Range's floating mountains); scale signs for heavier loads.
- **Improvised bridge or scaffold** — hold a flat water surface at height to cross a gap or reach a ledge.
- **Stage / display riser** — lift an object into view; add an Azuremoon Flower dye for longer duration if it must hold.
- **Rescue** — lift someone out of a pit or flood onto a stable, self-leveling surface.

## Similar spells
- **Water Orb** (canon, engine nearest) — also a shaped body of water, but contained in a static sphere rather than lifted.
- **Rising Wave** (canon) — the other "rising" water spell; nearest thematic sibling, also uses Column.
- **Pyreball Seal** (canon) — uses Levitation the same way to float a spell's effect aloft, but on fire (a floating fireball) rather than a water platform.

## Notes & limitations
- The original export's Levitation signs are non-uniform in angle; for a **water** spell this does not change the effect (levitation only steers for air/wind — [signs.md:55](../signs.md#L55)). The engine's "down-right aim / spin" readout on that version is an artifact of the engine applying directional steering to levitation regardless of element. The cleaned version below (Columns inward / normal orientation, Levitations uniformly horizontal) reads cleanly as **aim = above the seal**.
- Column orientation (longer line inward vs. outward) is **cosmetic in the engine** — a radially symmetric column ring fires straight up either way, and the deduced effect is identical. What actually matters is the `inverted` flag: an *inverted* column "is driven inward and erupts… similar to dispersion" ([signs.md:34](../signs.md#L34)), which would break the platform. None of the column signs here are inverted.
- **What inverting the columns would do (canon):** instead of focusing the water into a coherent pillar ("a column or beam above the seal" — [signs.md:34](../signs.md#L34)), inverted columns "emit out in all directions, similar to dispersion" — and dispersion is "a column that **leaks** its magic outwards rather than shooting or beaming it" ([signs.md:45](../signs.md#L45)). For this spell that means the water would **spill/spray outward all around the seal instead of rising as a structured pillar**, so there'd be no coherent surface for Levitation to lift — it stops being a load-bearing platform and becomes an outward gush (fountain-like). The Snugstone Spell uses inverted columns *deliberately* for exactly this omnidirectional emission; here it's the opposite of what's wanted. Canon flags genuine uncertainty over what (if anything) distinguishes an inverted column from a true dispersion sign ([signs.md:45](../signs.md#L45)).
- A uniformly-tangential Levitation ring will still trip the engine's "spin" note (tangential cant), which is likewise spurious for water-levitation — the lift is vertical, not rotational.
- Not forbidden magic.

## Reproduction
- **Image:** assets/spells/Rising_Platform_of_Water.png (canon mural redraw — to be confirmed/supplied by user)
- **JSON:** assets/spells/Rising_Platform_of_Water.json (canon-faithful version below)

Canon-faithful composition (`wha-spell@2`; Columns in normal orientation — longer line inward; Levitations horizontal):

```json
{
  "format": "wha-spell@2",
  "name": "Rising Platform of Water",
  "circles": [
    {
      "id": "k2",
      "name": "Circle 1",
      "center": { "x": 0, "y": 0 },
      "radius": 100,
      "ring": { "closed": false },
      "core": { "id": "c1", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
      "components": [
        { "id": "c2", "type": "column", "role": "sign", "x": 49.86622139811516, "y": -45.334449768066406, "rotation": 227.73, "scale": 1, "inverted": false },
        { "id": "c3", "type": "levitation", "role": "sign", "x": 66.82676553431858, "y": -0.19230866432190652, "rotation": 179.84, "scale": 1, "inverted": false },
        { "id": "c4", "type": "column", "role": "sign", "x": 49.26824044886938, "y": 38.821071624755845, "rotation": 308.24, "scale": 1, "inverted": false },
        { "id": "c5", "type": "levitation", "role": "sign", "x": 7.960204194457796e-15, "y": 65, "rotation": 270, "scale": 1, "inverted": false },
        { "id": "c6", "type": "column", "role": "sign", "x": -48.56589746180881, "y": 46.546825408935575, "rotation": 46.22, "scale": 1, "inverted": false },
        { "id": "c7", "type": "levitation", "role": "sign", "x": -64.71974801722874, "y": -7.918059051036785, "rotation": 6.98, "scale": 1, "inverted": false },
        { "id": "c8", "type": "column", "role": "sign", "x": -41.4381285905838, "y": -48.84614944458008, "rotation": 139.69, "scale": 1, "inverted": false },
        { "id": "c9", "type": "levitation", "role": "sign", "x": -0.5979806214202412, "y": -55.6772575378418, "rotation": 89.38, "scale": 1, "inverted": false }
      ],
      "dyes": [],
      "inkColor": null
    }
  ],
  "relations": []
}
```
