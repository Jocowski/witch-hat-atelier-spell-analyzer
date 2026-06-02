---
name: Wall Breaker Seal
type: earth
origin: wiki
forbidden: false
status: valid
core: earth
signs: column ×2, crush ×2
dyes: none
symmetry: radial
source: canon (manga) — Agott breaks a wall escaping the Illusory Labyrinth dragon; later Coco frees Custas from a boulder
image: assets/images/spells/Wall_Breaker_Seal.png
json: assets/spells/Wall_Breaker_Seal.json
---

# Wall Breaker Seal

> An earth seal drawn on a solid object that breaks through it and reduces the material to dust.

## Overview
Wall Breaker is the canon earth-type **destruction** spell: an earth sigil with two Column
keystones flanking it and two Crush keystones set 90° from the Columns. Drawn on a wall or
boulder, it pulverizes the material to dust and punches through. It first appears when Agott
breaks a wall to escape the dragon in the Illusory Labyrinth's artificial city, and is later used
by Coco to free Custas from under a boulder; it also helped inspire the Serpent's Bed of Sand.

## Validity
Engine: **valid** (earth core, no unknown ids). Geometry: **radial symmetry → stable**. `aim:
above the seal` is an artifact — the Columns drive force *into* the material, not upward. No
blocking/warning issues. (Ring `closed:false` in the export is only the app's activation visual.)

## Composition
- **Substance (sigil):** **Earth** (`earth`) — manipulates stone/sand/soil/wood but **cannot
  create** them ([sigils.md:53](../sigils.md)). The seal is drawn **on** the solid it destroys.
- **Form (signs):**
  - **Crush ×2 (non-inverted)** — pulverize the solid to dust ([signs.md:73](../signs.md)). The
    destructive heart of the spell. (Inverting these flips it to **Integration** — reassemble
    dust — the canonical invertible pair.)
  - **Column ×2 (flanking, inward)** — drive the crushing force *through* the material so it
    breaks all the way ([signs.md:34](../signs.md)); without them Crush only crumbles on contact.
- **Ring:** closed when active (open in this export — activation visual only).
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
*Reasoned from [docs/CORE.md](../CORE.md) + the lexicon, using the engine facts.* Drawn on a wall
or boulder, the two **Crush** signs disintegrate the solid into dust while the two **Columns**
drive the force deep so the break penetrates all the way through — leaving a hole where the
material was. Because earth only manipulates, it works on the object it is drawn on rather than
conjuring anything.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Earth | sigil (substance) | Supplies the manipulation of the solid; needs a real object (can't create one). |
| Crush ×2 | sign · transmute | Pulverize the material to dust; remove them and nothing breaks. |
| Column ×2 | sign · form | Drive the crush force through for reach/penetration; without them the break has little depth. |

## Element behavior & canon grounding
**Earth is manipulate-only** ([sigils.md:53](../sigils.md)), so Wall Breaker dismantles an
existing solid — it doesn't build or conjure. The decisive mechanic is the **Crush + Column
synergy**: Crush pulverizes on contact but has little reach, so a Column is added to drive the
break through ([signs.md:34,73](../signs.md)). Non-inverted Crush is what makes this *destruction*
rather than *Integration*; the two spells are the same glyph with Crush flipped.

- **Foil — Wall Bend** (earth + Pull/Bend/Weave/Bind → reshape a wall intact): same element,
  opposite intent. Wall Breaker destroys; Wall Bend reshapes.
- **Sibling — Integration** (inverted Crush → reassemble dust to its prior shape, temporarily).
- **Descendant — Serpent's Bed of Sand**, whose four satellites are essentially small Wall
  Breakers that mill real stone into sand to feed the central Billow cluster.

**Bottom line:** the textbook earth-destruction seal — radial and stable, with Crush doing the
pulverizing and the Columns supplying penetration. High confidence; well attested in the manga.

## How to draw it
1. **Earth** sigil at the center.
2. Two **Column** keystones flanking it (east/west), pointing inward toward the sigil.
3. Two **Crush** keystones at 90° from the Columns (north/south), non-inverted (peaks outward).
4. Keep the four signs evenly placed (radial symmetry = stable). Bigger/neater = stronger.

## Usage ideas
- Break through a wall or barrier to make a passage.
- Free someone or something pinned under stone/rubble (as Coco did for Custas).
- Demolish or quarry stone by reducing it to dust.

## Similar spells
- **Integration** — the inverted-Crush counterpart (reassembles dust).
- **Wall Bend** — earth that reshapes a wall instead of destroying it.
- **Serpent's Bed of Sand** — uses Wall-Breaker-style milling as a sub-component.

## Notes & limitations
- Crush must be **non-inverted** here; inverting it yields Integration.
- Needs a real solid to act on (earth can't create material).
- The engine's `aim: above the seal` is an artifact of Column's facing computation.

## Reproduction
- **Image:** [assets/images/spells/Wall_Breaker_Seal.png](../../assets/images/spells/Wall_Breaker_Seal.png) (canon reference) · engine render: [assets/spells/Wall_Breaker_Seal.svg](../../assets/spells/Wall_Breaker_Seal.svg)
- **JSON:** [assets/spells/Wall_Breaker_Seal.json](../../assets/spells/Wall_Breaker_Seal.json)

```json
{
  "format": "wha-spell@2",
  "name": "Wall Breaker Seal",
  "circles": [
    {
      "id": "k7", "name": "Circle 1",
      "center": { "x": 0, "y": 0 }, "radius": 92,
      "ring": { "closed": false },
      "core": { "id": "c45", "type": "earth", "x": 0, "y": 0, "rotation": 0, "scale": 1 },
      "components": [
        { "id": "c46", "type": "column", "role": "sign", "x": -65.02, "y": -0.53, "rotation": 90.47, "scale": 1 },
        { "id": "c47", "type": "column", "role": "sign", "x": 61.98, "y": 1.74, "rotation": 271.61, "scale": 1 },
        { "id": "c48", "type": "crush", "role": "sign", "x": -0.63, "y": -63.55, "rotation": 359.44, "scale": 1 },
        { "id": "c49", "type": "crush", "role": "sign", "x": 0, "y": 60.73, "rotation": 180, "scale": 1 }
      ],
      "dyes": [], "inkColor": null
    }
  ],
  "relations": []
}
```
