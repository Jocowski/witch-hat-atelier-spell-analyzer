---
name: Flame Shot Seal
type: fire
origin: canon
forbidden: false
status: valid
core: fire
signs: column ×1, region ×10
dyes: none
symmetry: bilateral
source: canon (Coco's spell against the valance leech; wiki lists it under Fire, Column, and Region). Recipe composed in the app.
image: assets/spells/Flame_Shot_Seal.png
json: assets/spells/Flame_Shot_Seal.json
---

# Flame Shot Seal

> A self-fueling flamethrower: a fire sigil at the bottom of the seal throws a column of flame forward, with two walls of Region signs confining it to the space ahead so it reaches farther.

## Overview
The Flame Shot Seal shoots a directed jet of fire. A **fire sigil sits at the bottom** of the seal with a large **Column** sign extending up from it to the far side; this makes a column of flame shoot **forward**, in the direction of the column's point. Five **Region** signs on each side impart additional directionality and **confine the magic to the space in front of it**, helping the flame extend farther. It is a canon spell — Coco used it against the valance leech.

## Validity
**Valid and active** (engine). The fire sigil sits at center-bottom as a proper core, eleven signs surround it, the ring is closed, and every part id resolves (no `unknownIds`). The engine raises only two **info**-level notes:
- *Stable: bilateral symmetry.*
- *Aim: the effect is directed up (from the orientation of the directional signs).*

The engine now reads aim from the signs' **orientation** (all Region chevrons point north ⇒ the flame fires forward/up), and reports it separately from positional **balance** (here: balanced). No blocking or warning issues; nothing forbidden.

## Composition
- **Substance (sigils):** **Fire** (family *fire*, element *fire*) — *"works to create and manipulate flames or heat depending on the spell"* ([docs/sigils.md:13](../sigils.md#L13)). Drawn ×1.45 at the bottom of the seal.
- **Form (signs):**
  - **Column ×1** (directional, invertible) — scale ×2.5, rising from the fire sigil to the far side, upright (not inverted): concentrates the flame into one forward beam.
  - **Region ×10** (directional, invertible) — two vertical walls of five (left @ x≈−67, right @ x≈+55), pointing **forward**: confine the magic to the space ahead.
- **Ring:** closed → active.
- **Ink / dyes:** plain conjuring ink (no dyes).

## Deduced effect
**Engine summary:** *"The flame is projected as a tight column or beam, fired up."*

Restated against canon: a concentrated, sustained **column of flame fired forward** (in the direction of the column's point, away from the fire sigil at the bottom). The Column gives the beam its shape; the Region walls box the flame into the space ahead so it travels farther rather than spreading. Ordinary intensity (power 1.14), no spin (no tilted signs).

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Fire | sigil (substance) | Self-creating flame. Remove it → no core → empty closed ring → raw discharge/explosion. |
| Column ×2.5 | sign / form (directional) | Concentrates the flame into one forward beam; its point sets the firing direction. Without it → directionless flare. |
| Region ×10 | sign / direction (directional) | Confine the magic to the space ahead so it reaches farther. Without them → flame spreads, shorter range. |
| Fire-at-bottom + column-to-top | geometry | Establishes the forward (bottom→top) firing axis. |
| Ring (closed) | activation | Closed = active. Open → prepared but inactive. |

## Element behavior & canon grounding
**Fire is the ideal substance for a column-plus-region jet, for a reason the other elements can't match.** Because fire can **create** its own material ([docs/sigils.md:13](../sigils.md#L13)), the Flame Shot is self-fueling — it needs no fuel source nearby. The same glyph on a **water** core is the canon **Watershot Seal** (water + column, [docs/sigils.md:43](../sigils.md#L43)); it also shoots a jet, but a sustained water version must **collect** water rather than create it (*"creating water is more energetically costly than collecting it,"* [docs/sigils.md:41](../sigils.md#L41)). On an **earth** core it fails outright: earth *"does not allow for the creation of these solid materials"* ([docs/sigils.md:53](../sigils.md#L53)). **Fire is what makes this seal "fire and forget."**

Physically, fire is buoyant and expansive — left alone it billows up and out, the opposite of a tight beam. So the **signs do real work against the substance's nature**: the Column forces the divergent flame into a single channel ([docs/signs.md:34](../signs.md#L34)), and the Region walls — pointing forward — *"confine the area of the magic to the space in front of it,"* which is the canon use of region signs aimed in one direction (*"if the region signs within a seal all point to the same side of the spell, the magic will shoot in that direction,"* [docs/signs.md:96](../signs.md#L96)). The result is a beam that holds together and reaches farther instead of blooming into a fireball.

**Aim vs. balance (engine).** The engine reads the firing direction from the **orientation** of the directional signs: all the Region chevrons point north (`rotation: 0`), so their resultant is forward/up and the engine reports *"fired up."* That is separate from positional **balance** (whether bigger/more *column* signs sit to one side and tug the beam) — here the single centered Column is balanced. In canon the flame shoots **forward** (the direction of the column's point, away from the fire at the bottom) and the forward-pointing Region walls extend its reach, which is exactly what the engine now deduces. *(Earlier engine versions inferred direction from the center-of-mass of all signs, which mislabeled this bottom-mounted seal as "skewed down"; that was fixed by separating orientation-based aim from positional balance.)*

**Closest canon analogue — the Watershot Seal.**
- **Same:** both are column-driven directional jets fired from a closed elemental seal ([docs/signs.md:34](../signs.md#L34)).
- **Differs:** Watershot relies on Column alone; Flame Shot adds the forward-pointing Region walls to confine and extend the beam. That confinement matters *because fire wants to spread and water doesn't* — a cohesive water jet holds together on its own; a flame needs the walls to stay a beam and carry distance.
- **Why:** the substance's physical tendency (cohesive liquid vs. expansive flame) dictates how much "form" scaffolding the seal needs — same skeleton, more bracing (and reach-extension) for the wilder element.

**Bottom line.** Flame Shot is the Watershot Seal's fire twin — a *self-fueling* directed jet where Watershot is a (reservoir-dependent) water one. The fire core supplies endless flame; the Column aims it forward and the forward-pointing Region walls keep it from billowing so it carries farther. Mechanically sound and canon-faithful, and the engine now deduces the forward aim directly from the signs' orientation.

## How to draw it
1. Draw a closed ring.
2. Place the **Fire sigil** at the **bottom** of the seal (×1.45 for a stronger flame).
3. Draw a large **Column** sign rising from the fire sigil up to the far side (×2.5), upright (not inverted); its point marks the firing direction (forward).
4. Place **five Region signs down each side** (left and right), pointing **forward** so they confine the magic to the space ahead and extend its reach ([docs/signs.md:96](../signs.md#L96)).
5. Keep the two walls mirror-symmetric left-to-right (bilateral) for stability.

## Usage ideas
- **Combat** — a forward flame jet; Coco used it to shoot the valance leech.
- **Heat decoy** — because some creatures (the valance leech) hunt by heat, a forward flame draws them onto the flame instead of nearby people. *(In canon Coco didn't know the leech tracked heat; that was discovered later — the decoy effect was incidental.)*
- **Industrial heat** — directed flame for a forge, kiln, or cutting/melting where the heat must be aimed.
- **Controlled burning** — clear a confined line ahead without starting a spreading fire.
- **With dyes** — **Blood** turns the jet into a roaring blast; **Azuremoon Flower** extends the burn for sustained work.

## Similar spells
- **Watershot Seal** (canon) — water + column, the direct analogue; a directional jet without the Region cage. *(Comparison drawn from the docs; the Watershot Seal isn't in the engine catalog yet, so this isn't an engine catalog match.)*
- **Water Bolt** (canon) — region + bolt; same "region aims/confines the output" idea, but fires discrete projectiles rather than a continuous beam.
- **Spiraling Flame** (canon) — fire + column + Sights Set + Sign of Wind; the same fire+column basis put to a guided, spinning use.

## Notes & limitations
- The engine derives **aim** from the directional signs' orientation and **balance** from the positional skew of column signs, reporting them separately; here aim=up, balance=balanced. (Region intent depends on real per-sign `rotation` in the export — all-north here = fired up.)
- Power is ordinary (1.14): no Blood dye, no links, small ring. Scale up the ring or add Blood for a heavier blast.
- Not forbidden, not decorative.

## Reproduction
- **Image:** [assets/spells/Flame_Shot_Seal.png](../../assets/spells/Flame_Shot_Seal.png) — app render (place the PNG at this path).
- **JSON:** [assets/spells/Flame_Shot_Seal.json](../../assets/spells/Flame_Shot_Seal.json) (also embedded below).

```json
{
  "format": "wha-spell@1",
  "name": "Flame Shot Seal",
  "ring": { "closed": true, "doubled": false, "size": "small" },
  "core": { "id": "c9", "type": "fire", "x": 0, "y": 48.16053295135498, "rotation": 0, "scale": 1.4499999999999997, "inverted": false },
  "components": [
    { "id": "c11", "type": "column", "role": "sign", "x": 0, "y": 0.5016736984252361, "rotation": 0, "scale": 2.5, "inverted": false },
    { "id": "c13", "type": "direction", "role": "sign", "x": 52.646291799355254, "y": -36.87291336059572, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c15", "type": "direction", "role": "sign", "x": 58.666345662880644, "y": 62.9598693847656, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c17", "type": "direction", "role": "sign", "x": 56.18729090690615, "y": 35.61872863769531, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c19", "type": "direction", "role": "sign", "x": -67.6964512537009, "y": 32.85953140258796, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c21", "type": "direction", "role": "sign", "x": -66.693105764199, "y": 12.290966987609849, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c23", "type": "direction", "role": "sign", "x": -65.2173923254013, "y": -11.538460731506348, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c25", "type": "direction", "role": "sign", "x": -70.76508133907248, "y": -33.86287689208986, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c27", "type": "direction", "role": "sign", "x": 52.64627654056619, "y": -11.287621498107939, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c29", "type": "direction", "role": "sign", "x": 54.1806026697159, "y": 14.548492431640625, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c31", "type": "direction", "role": "sign", "x": -66.69310576419895, "y": 55.93645477294929, "rotation": 0, "scale": 1, "inverted": false }
  ],
  "linkCount": 0,
  "dyes": []
}
```
