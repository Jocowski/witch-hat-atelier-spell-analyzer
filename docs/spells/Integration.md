---
name: Integration
type: earth
origin: canon
forbidden: false
status: valid
core: earth
signs: crush ×6 (inverted)
dyes: none
symmetry: radial
source: Witch Hat Atelier — created by Tartah & Coco to identify powdered herbs; wiki "Integration" (unofficial name)
image: none yet
json: assets/spells/Integration.json
---

# Integration

> Temporarily pulls a powdered or smashed substance back into the shape of the object it originally came from — a way to identify an unknown powder.

## Overview
Integration is the **mirror image of the Wall Breaker Seal**: the same Earth core ringed by Crush keystones, but with every Crush **inverted** so the operation runs in reverse. Where Wall Breaker grinds matter *into* dust, Integration coaxes loose particles *back together* into their source object's form. The reconstruction is **temporary** — it holds only while the spell is active, then slumps back to a pile of powder. Tartah and Coco devised it to identify unlabeled vials of powdered medicinal herbs by their reconstructed shape.

## Validity
**Valid** (engine). Earth core + six signs, perfect radial symmetry → the engine flags it **stable**. No blocking or warning issues.

## Composition
- **Substance (sigil):** Earth — governs stone, sand, soil and wood; *manipulates but does not create* them ([sigils.md:53](../sigils.md#L53)).
- **Form (signs):** Crush ×6, semi-directional, **inverted**. Upright, Crush disintegrates; inverted, it *reassembles* powder into its original shape ([signs.md:73](../signs.md#L73)). Six evenly-spaced signs in a ring → radial symmetry, omnidirectional, no aim.
- **Ring:** closed (active).
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
> **Engine summary:** *"The earth, stone, and sand is reassembled from dust."*

In plain terms: a stationary, omnidirectional **re-integration field**. Any loose particles within the seal are gathered and rearranged to mimic the form of the object they came from, held that way for as long as the spell runs. It does not move or throw anything (no Column, no Region) — it reconstructs in place. Six redundant inverted-Crush operators make the reassembly thorough and even rather than directed.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Earth core | sigil / substance | Supplies the material domain (solids/powder). Remove it and the Crush signs have nothing to rearrange. |
| Crush ×6 (inverted) | transmute (inverse) | Drives the reassembly. Upright instead → it would *pulverize* (Wall Breaker). Fewer signs → weaker/patchier reconstruction. |
| Radial layout | symmetry | Even, all-around effect; keeps it **stable**. Cluster them one side → biased toward that side. |
| (no Column / Region) | — | Nothing aims or projects the result; it reconstructs in place. A Column would instead give the *upright* version reach. |

## Element behavior & canon grounding
**Manipulate-not-create is what makes this spell possible at all.** Earth *cannot conjure* matter ([sigils.md:53](../sigils.md#L53)) — and Integration never needs to. It only **rearranges particles that already exist**, which is exactly why it can reconstruct a pile of powder: the matter is all present, just disordered. This is the same constraint that limits the destructive Wall Breaker (it needs a real target to grind), turned to advantage — here the "reservoir" is the powder itself.

**Why inversion flips destruction into reconstruction.** Crush is semi-directional and **invertible**, and its documented inverse is explicit: *"If the sign is inverted and the spell is used on a powdered substance, the powder will reform into its original shape. However, as soon as the spell wears off… the powder will return to simply being a pile of dust"* ([signs.md:73](../signs.md#L73)). So the **temporariness is canon**, not a side effect — Integration is a momentary scaffold, not a permanent repair. The radial ring of six just makes the reverse-operator strong and even, the same way Wall Breaker's ring makes the forward operator strong and even.

**Not limited to stone and sand.** Although Earth's domain is nominally stone/sand/soil/wood, Integration in canon reassembled **powdered medicinal herbs** — an organic substance well outside that list. This is consistent with the create/manipulate rule: the spell isn't *making* earthen material, it's *rearranging existing particles* of whatever was crushed, so the substance's original identity is irrelevant to the mechanic. (Compare the anime note that Wall Breaker was even seen "crushing water into mist," [signs.md:75](../signs.md#L75) — Crush's reach beyond pure earth is canon on both sides of the inversion.)

**Closest canon analogue — the Wall Breaker Seal.** They are the same recipe with the Crush flag flipped ([signs.md:77](../signs.md#L77)):
- **Same:** Earth core, a ring of Crush, the manipulate-only constraint, the on-contact (short-reach) mechanic, radial symmetry.
- **Differs:** the Crush signs are **inverted**, so the transmutation runs backwards — *dust → object* instead of *object → dust*. Visually, the Crush keystones point **inward** (toward the core) rather than outward.

**Bottom line:** Integration is Wall Breaker run in reverse — a stable, symmetric field that **reassembles** loose powder into its source shape instead of pulverizing solids into powder. It is feasible precisely because Earth only ever rearranges existing matter, so reconstructing a powder needs no conjuring; the catch is that the reconstruction is **temporary** (canon), making it an identification/inspection tool rather than a repair spell.

## How to draw it
1. Place the **Earth** sigil at the center.
2. Ring it with **six Crush** keystones, evenly spaced 60° apart (radius ≈ the user's 76px ring), for radial symmetry and stability.
3. **Invert every Crush** — this both flips the art to point inward and switches the effect from *pulverize* to *reassemble*. (With Crush's `defaultFacing: outward`, a freshly-placed Crush points outward = Wall Breaker; inverting flips it inward = Integration.)
4. Keep all six the same size and evenly spaced — even spacing keeps the effect undirected and the seal stable. A bigger, neater seal reconstructs more, and holds longer.
5. Close the ring to activate.

## Usage ideas
- **Identify an unknown powder** (the canon use): reconstruct a crushed/ground sample to recognise it by shape — herbs, minerals, pigments.
- **Forensic/inspection work:** temporarily rebuild a shattered or powdered object to see what it was.
- **Pair with Wall Breaker** as a matched set: crush a sample to powder, then Integration it back to confirm its original form.

## Similar spells
- **Wall Breaker Seal** (canon, earth) — the exact inverse: upright Crush, *pulverizes* instead of reassembling.
- **Sand Cage** (canon, earth) — also built on inverted Crush ([signs.md:77](../signs.md#L77)); reintegrates loose sand into a confining form.
- **Serpent's Bed of Sand** (canon, earth) — crushes *then* compacts (with Convergence) into a rigid shape; a "destroy-then-rebuild" cousin.

## Notes & limitations
- **Reassembly is temporary** ([signs.md:73](../signs.md#L73)) — the form collapses back to powder when the spell ends. It identifies/inspects; it does not permanently repair.
- **Not forbidden** — manipulating inanimate powder is unrestricted.
- The engine's note *"without a Column to drive it the break has little reach"* is written for the destructive sense; for the inverted spell read it as "short range / acts on powder already inside the seal."
- **Engine ↔ catalog:** added to `data/spells.json` as `integration` (origin canon); the analyzer now matches this recipe.

## Reproduction
- **Image:** requested from user
- **JSON:** [assets/spells/Integration.json](../../assets/spells/Integration.json)

```json
{
  "format": "wha-spell@2",
  "name": "Integration",
  "circles": [
    {
      "id": "k2",
      "name": "Circle 1",
      "center": { "x": 0, "y": 0 },
      "radius": 76,
      "ring": { "closed": true },
      "core": { "id": "c1", "type": "earth", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false },
      "components": [
        { "id": "c3", "type": "crush", "role": "sign", "x": 0, "y": -49.4, "rotation": 0, "scale": 1, "inverted": true, "mirrored": false },
        { "id": "c4", "type": "crush", "role": "sign", "x": 42.781654946951264, "y": -24.700000000000006, "rotation": 60, "scale": 1, "inverted": true, "mirrored": false },
        { "id": "c5", "type": "crush", "role": "sign", "x": 42.78165494695127, "y": 24.69999999999999, "rotation": 120, "scale": 1, "inverted": true, "mirrored": false },
        { "id": "c6", "type": "crush", "role": "sign", "x": 6.049755187787924e-15, "y": 49.4, "rotation": 180, "scale": 1, "inverted": true, "mirrored": false },
        { "id": "c7", "type": "crush", "role": "sign", "x": -42.78165494695126, "y": 24.70000000000002, "rotation": 240, "scale": 1, "inverted": true, "mirrored": false },
        { "id": "c8", "type": "crush", "role": "sign", "x": -42.781654946951264, "y": -24.700000000000006, "rotation": 300, "scale": 1, "inverted": true, "mirrored": false }
      ],
      "dyes": [],
      "inkColor": null
    }
  ],
  "relations": []
}
```
