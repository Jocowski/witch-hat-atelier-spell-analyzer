---
name: Pyreball Seal
type: fire
origin: canon
forbidden: false
status: valid
core: fire
signs: levitation ×4
dyes: none
symmetry: radial
source: Witch Hat Atelier ch. 8 — cast by Coco under Qifrey's instruction to cook carapace yams
image: none yet
json: none yet
---

# Pyreball Seal

> A self-fueling ball of flame that hovers above the glyph and lifts light objects set over it — a floating stove.

## Overview
The Pyreball Seal places a fire sigil at the center of a ring of four Levitation signs. Fire conjures its own flame; the Levitation signs lift that flame — and any not-too-heavy object held above the seal — into the air, producing a hovering ball of fire centered over the glyph. In canon it's a cooking spell: Coco used it under Qifrey's instruction to cook carapace yams on a picnic (ch. 8).

## Validity
**Valid** (engine). No blocking or warning issues. Info notes only:
- Stable: radial symmetry.
- Aim: the effect manifests **above the seal** (from the directional signs).

The four signs' rotations only orient each arrow **inward** (the canon "tip faces inward"), so the spell does **not** spin — the engine's spin check reads the cant relative to each sign's radial axis and correctly reports no spin here.

## Composition
- **Substance (sigils):** Fire (core, family `fire`, element `fire`) — creates and manipulates flame and heat.
- **Form (signs):** Levitation ×4 (directional, invertible), evenly spaced and oriented inward. In its fire/water/light mode, Levitation lifts the spell's effect (and objects over the seal) into the air.
- **Ring:** closed (active).
- **Ink / dyes:** plain conjuring ink — no dyes.

## Deduced effect
> *"The flame burns, giving off heat and light, centered above the seal; it is lifted and made to levitate."* (engine)

In plain terms: a hovering ball of fire suspended directly over the glyph. Because Levitation's fire-mode lifts both the effect and light loads placed over the seal, an object set above the flame (a pot, a yam) floats with it rather than dropping into the fire — making the spell usable as a flame-cooker.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Fire sigil | sigil / substance | Supplies the flame and heat. Without it there's nothing to lift — an empty levitation frame. |
| Levitation ×4 | sign / motion (directional) | Lifts the flame (and light loads) above the seal. Without it the fire still burns but sits on the glyph — no hovering ball, no lift. |
| Even, inward placement | geometry | Keeps the lift centered and stable (radial symmetry). Bias to one side would skew the flame off-center; fewer/smaller signs hold less weight. |

## Element behavior & canon grounding
**Why fire is the ideal substance here.** Levitation's fire/water/light mode lifts *"the spell's effect, as well as objects held overtop the seal"* ([docs/signs.md:55](../signs.md#L55)) — so the substance only has to *exist* over the seal, not be channeled or aimed. The base fire sigil *"works to create and manipulate flames or heat"* ([docs/sigils.md:13](../sigils.md#L13)), i.e. it **creates its own material**: the instant the ring closes there is flame to levitate — no reservoir, no fuel, no collection sign. Contrast an earth spell, which *cannot create* and only manipulates: an "earth-ball" version would need a real pile of sand or stone beneath it to lift. Fire pays that cost for free.

**Physical state fits the mechanic.** A flame is buoyant, near-massless gas-and-light — it *wants* to rise. Levitation isn't fighting gravity against a dense mass (as it would lifting rock); it holds a naturally-rising thing in a fixed pocket of air above the glyph. That's why four ordinary-scale signs suffice to pin a whole fireball: per canon, *"the size of the levitation signs dictates the weight of the objects which can be held aloft, while the size of the seal's sigil determines how powerful the floating magic generated will be"* ([docs/signs.md:55](../signs.md#L55)) — and a flame weighs almost nothing, so the lift budget is free to carry the *object* (the yams) set above it.

**Closest canon analogue — Wall-Anchored Floatglow Lamp.** Both pair a **fire-family** sigil with Levitation in its lift mode ([docs/signs.md:59](../signs.md#L59)).
- **Same:** sigil-creates-its-own-substance + Levitation → the effect hovers above the seal.
- **Differs:** the Floatglow Lamp uses the **light** sigil for cool, steady illumination; Pyreball uses **fire**, so it radiates **heat** — which is the whole point. The lamp lights a room; Pyreball *cooks*.
- **Rising Platform of Water** ([docs/signs.md:59](../signs.md#L59)) is the water-sigil version of the same lift mode — a hovering water surface instead of a flame.

**Bottom line.** Pyreball is Levitation's lift mode applied to the one element that supplies its own payload *and* radiates usable heat: a self-fueling, hovering burner. It's the Floatglow Lamp with heat instead of light — a floating stove rather than a floating lantern — and it works with only four modest signs precisely because flame is buoyant and weightless, leaving the lift capacity free to hold a pot.

## How to draw it
1. Draw the **fire sigil** at the center of the circle.
2. Place **four Levitation signs** evenly around it (≈90° apart), each oriented so its arrow tip faces **inward** toward the center — this keeps the lift centered above the seal.
3. Keep the four signs the **same size** for radial symmetry (stable, steady hover). Scale all four **larger** to hold heavier objects; scale the **fire sigil** larger for a hotter, more powerful flame.
4. Close the ring to activate. A neat, even draw makes the hover steadier and longer-lasting.

## Usage ideas
- **Field cooking / portable stove** — its canon use: set a pot or food directly above the glyph.
- **Heat source for a shelter or workshop** — a hovering hearth that won't scorch the surface it's drawn on.
- **Signal / beacon fire** — a self-suspending flame visible at distance, no pyre needed.
- **Drying / boiling** — hold a kettle or wet cloth in the lift zone above the flame.

## Similar spells
- **Wall-Anchored Floatglow Lamp** — light sigil + Levitation; hovering illumination instead of heat.
- **Rising Platform of Water** — water sigil + Levitation; a hovering water surface.
- **Floatglow Lamp Seal**, **Pegasus Carriage Spell**, **Sylph Shoes Seal** — other Levitation-based spells ([docs/signs.md:59](../signs.md#L59)).

## Notes & limitations
- Lift capacity is bounded by the size of the Levitation signs; too-heavy an object won't rise ("any object that isn't too heavy").
- The rotations are orientation (arrows inward), **not** spin — the spell does not rotate.
- Not forbidden; not decorative. No dyes applied.

## Reproduction
- **Image:** requested from user (`Pyreball Seal Redraw.png`).
- **JSON:** requested from user (app export). Importable `wha-spell@1` composition below:

```json
{
  "format": "wha-spell@1",
  "version": 1,
  "composition": {
    "name": "Pyreball Seal",
    "ring": { "closed": true },
    "core": { "id": "c1", "type": "fire", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
    "components": [
      { "id": "c2", "type": "levitation", "role": "sign", "x": -33.010035544633865, "y": -25.84782314300537, "rotation": 130, "scale": 1, "inverted": false },
      { "id": "c3", "type": "levitation", "role": "sign", "x": 33.12483019505025, "y": -29.42893028259278, "rotation": 225, "scale": 1, "inverted": false },
      { "id": "c4", "type": "levitation", "role": "sign", "x": 29.61311907444479, "y": 28.0242462158203, "rotation": 315, "scale": 1, "inverted": false },
      { "id": "c5", "type": "levitation", "role": "sign", "x": -29.49832606315612, "y": 33.573577880859375, "rotation": 45, "scale": 1, "inverted": false }
    ],
    "linkCount": 0,
    "dyes": []
  }
}
```
