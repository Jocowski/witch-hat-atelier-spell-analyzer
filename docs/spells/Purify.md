---
name: Purify
type: water
origin: canon
forbidden: false
status: valid
core: water
signs: purify ×10, collection ×2
dyes: none
symmetry: radial
source: Witch Hat Atelier — Coco's debut of the spell at the Silver Eve festival (Silver Eve Procession), drawn on the Portable Waste Purification Pot. Sign refs: docs/signs.md (Purify, Collection); sigil ref: docs/sigils.md (Water).
image: none yet
json: none yet
---

# Purify

> A standing water-treatment seal: it draws in dirty water and strips the impurities out, leaving them heaped near the glyph and the water clean.

## Overview
Purify (unofficial name) is a water-type spell that purifies wastewater. A central **water** sigil is flanked by two **Collection** signs that draw water and material toward the seal, while **Purify** signs surrounding it separate out the contaminants — which then accumulate near the spell. It is a continuous, stationary cleaner rather than a projector or fountain. Coco debuts it at the Silver Eve festival during the Silver Eve Procession, drawn on the **Portable Waste Purification Pot**: she pours wastewater into the pot and shows the crowd it comes out clean.

## Validity
**Valid** (engine). Water core present, radially symmetric, stable. The only flag is the positive `[info] Stable: radial symmetry.` No blocking or warning issues. (Ring open/closed is only the app's "firing" visual and is not part of the analysis.)

## Composition
- **Substance (sigils):** **Water** (family `water`, element `water`) — provides the substance being cleaned. It manipulates/collects existing dirty water rather than creating fresh water.
- **Form (signs):**
  - **Purify ×10** (asymmetric) — separates impurities out of the element; they gather near the spell. Not invertible; rotations are cosmetic.
  - **Collection ×2** (directional) — collect material above/around the seal to feed the spell; open side faces inward (top outward), **not inverted**.
- **Ring:** closed (active) when firing; open while prepared. Activation visual only.
- **Ink / dyes:** plain conjuring ink (no dyes).

## Deduced effect
Engine summary:

> *The water pours and flows outward; it is purified, separating impurities out of the element.*

Plainly: dirty water is drawn in by the Collection signs and cleaned by the surrounding Purify signs — particulates and contaminants are pulled out of the water and pile up beside the seal, leaving the water purified. An undirected, radially balanced, standing filter — exactly the Portable Waste Purification Pot's seal.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water sigil | substance (core) | Defines what's being cleaned. Without it there's no subject to purify. |
| Purify ×10 | special (separate) | The actual cleaning. Without them the water is merely collected/moved, never cleaned — an intake spell, not a purifier. |
| Collection ×2 | support (intake) | Feeds dirty water/material into the seal. Without them it still purifies, but only what already touches it — weaker throughput. |
| Radial layout | symmetry | Stability + even, omnidirectional action. Skew it and the cleaning biases one way and grows less stable. |

## Element behavior & canon grounding
**Why water is the only clean fit for this design.** Purify separates impurities from *whatever the sigil's substance is* (docs/signs.md:319). Water is the canonical and most useful pairing because dirty water is *literally a suspension* — particulates and contaminants dispersed in a fluid medium — so separation is a real physical process (settling/filtering) and the freed contaminants "accumulate near the spell" (docs/signs.md:319) exactly like sediment. The substance's **fluid state is what makes the mechanic work**: a fluid lets impurities migrate out and collect; you couldn't "purify" a rigid block of stone the same way. Pairing Purify with fire ("impurities in flame") is barely meaningful; with air it gives the documented dust-from-air case.

**Create vs. collect is what makes it a purifier, not a fountain.** The water sigil "works to manipulate, collect, and create water… many water spells meant to be used over long periods collect water rather than create it… creating water is more energetically costly than collecting it" (docs/sigils.md:41). Water *could* self-source, but a continuous cleaning rig runs in the cheaper **collect/manipulate** mode — and the two Collection signs make the intent unambiguous: this seal **takes in existing dirty water and cleans it** rather than manufacturing fresh water. That is the difference between this spell and producers like the Water Pen or Watershot Seal. The Collection signs are the "intake pipe"; Purify is the "filter."

**Sign orientation (canon detail).** Both Purify and Collection are drawn **top-outward** (away from center) by default — like Sights Set — so in the app they sit `inverted: false` in their natural orientation. Collection's open side then faces inward toward the seal, matching canon: *"The open side is typically seen facing inwards… has never been seen inverted"* (docs/signs.md:115). Because Purify is **asymmetric**, the engine correctly ignores its per-sign rotation for steering/inversion.

**Closest canon analogue — itself.** This *is* canon Purify, the same seal used on the Portable Waste Purification Pot and the sewer-grate purifier (docs/signs.md:319). Same recipe, same effect. Among other water spells, producers (Water Pen, Watershot, Water Bolt) *create/project* water; Purify instead *receives and cleans* it, which is why it leans on Collection (intake) rather than Column/Bolt (output).

**Bottom line.** A feasible, fully canon standing water-treatment seal. It works *because* water is a fluid suspension (impurities can separate and settle out) and *because* the design collects existing water rather than creating it — a "filter with an intake," not a faucet. Scale and neatness set throughput and longevity (bigger = more water cleaned, neater = more stable and longer-lasting); a power dye like Blood would intensify the separation rather than change its nature.

## How to draw it
1. **Center:** one **Water** sigil at the origin.
2. **Sides:** two **Collection** signs, one on each side (left and right of center), top facing **outward**, open side toward the seal — leave them **un-inverted**.
3. **Above & below:** **Purify** signs surrounding the core. Canon places them top and bottom; a denser, fully radial ring of Purify signs (this build uses 10, evenly spaced) is the same spell in a rounder layout.
4. **Symmetry:** keep it radially balanced so the cleaning is even and the seal stays stable. No tilt/spin is wanted — this is a stationary, undirected effect.
5. **Size:** bigger and neater = more wastewater cleaned, longer-lasting.

## Usage ideas
- **Portable Waste Purification Pot** (the canon use): pour wastewater in, draw out clean water.
- **Sewer / drainage purifier:** a fixed grate-seal that continuously cleans wastewater.
- **Field drinking-water station:** clean a barrel or stream-fed basin; sweep away the impurity pile periodically.
- **Pond / well restoration:** clear algae, silt, and contaminants from a stagnant source.
- **Pre-treatment for other water spells:** clean the feedstock before a Watershot or Water Horse spell so they don't spray grit.
- **Forensic separation:** because impurities accumulate visibly, recover what was suspended in a sample (sediment, dye, debris).

## Similar spells
- **Sewer-grate purifier** (canon) — same Purify mechanic, fixed installation rather than a portable pot.
- **Water producers** (Water Pen, Watershot Seal, Water Bolt) — *create/project* water; Purify instead *receives and cleans* existing water, hence Collection over Column/Bolt.

## Notes & limitations
- **No forbidden-magic flags** — purely environmental, well within bounds.
- Purify is **asymmetric** (docs/signs.md:319); the manga doesn't define what mirroring/inverting it does, so per-sign Purify rotation is treated as cosmetic here.
- The spell is **undirected** by design; it does not project or aim. Its throughput depends on intake (Collection count/size) and seal size.
- Original app export had the two Collection signs as `inverted: true` — an artifact of the app's former inward default. After the `defaultFacing: "outward"` fix they sit `inverted: false` in their natural, canon orientation (the effect is identical either way).

## Reproduction
- **Image:** requested from user (will save to `assets/spells/Purify.png`).
- **JSON:** canon-orientation composition below (Collection un-inverted). The user's app export is authoritative.

```json
{
  "format": "wha-spell@1",
  "version": 1,
  "composition": {
    "name": "Purify",
    "ring": { "closed": true },
    "core": { "id": "c1", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
    "components": [
      { "id": "c2", "type": "purify", "role": "sign", "x": 0, "y": -65, "rotation": 180, "scale": 1, "inverted": false },
      { "id": "c3", "type": "purify", "role": "sign", "x": 56.29, "y": -32.5, "rotation": 240, "scale": 1, "inverted": false },
      { "id": "c4", "type": "purify", "role": "sign", "x": 56.29, "y": 32.5, "rotation": 300, "scale": 1, "inverted": false },
      { "id": "c5", "type": "purify", "role": "sign", "x": 0, "y": 65, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "c6", "type": "purify", "role": "sign", "x": -56.29, "y": 32.5, "rotation": 60, "scale": 1, "inverted": false },
      { "id": "c7", "type": "purify", "role": "sign", "x": -56.29, "y": -32.5, "rotation": 120, "scale": 1, "inverted": false },
      { "id": "c8", "type": "purify", "role": "sign", "x": -33.4, "y": -55.9, "rotation": 150, "scale": 1, "inverted": false },
      { "id": "c9", "type": "purify", "role": "sign", "x": 33.4, "y": -55.9, "rotation": 210, "scale": 1, "inverted": false },
      { "id": "c10", "type": "purify", "role": "sign", "x": 33.4, "y": 55.9, "rotation": 330, "scale": 1, "inverted": false },
      { "id": "c11", "type": "purify", "role": "sign", "x": -33.4, "y": 55.9, "rotation": 30, "scale": 1, "inverted": false },
      { "id": "c12", "type": "collection", "role": "sign", "x": -63, "y": 0, "rotation": 270, "scale": 1, "inverted": false },
      { "id": "c13", "type": "collection", "role": "sign", "x": 63, "y": 0, "rotation": 90, "scale": 1, "inverted": false }
    ],
    "linkCount": 0,
    "dyes": []
  }
}
```
