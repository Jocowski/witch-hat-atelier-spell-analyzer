---
name: Snugstone Spell
type: fire
origin: wiki
forbidden: false
status: valid
core: fire
signs: column ×4 (inverted), radial ×4
dyes: none
symmetry: radial
source: Witch Hat Atelier — invented by Olruggio; drawn on the snugstones given to Qifrey and his apprentices; later misused at Serpentback Cave (Arcane Lens of Amplification incident). Sign references: docs/signs.md (Radial, Column).
image: none yet
json: none yet
---

# Snugstone Spell

> A fire seal that radiates gentle, flameless warmth evenly in all directions — the magic behind the *snugstone*, a sleep-warming stone.

## Overview
The Snugstone Spell, invented by **Olruggio**, is a fire-type spell that radiates warmth outward without producing any flame. It is drawn on the **snugstone**, an item used to keep you warm while you sleep. The spell is precisely balanced to the **size of the seal** so the stone is warm to the touch but never hot enough to burn — a calibration that becomes critical when the spell is amplified (see Notes).

## Validity
**Valid** (engine: `valid=true`). Radial symmetry → **stable**; balance **balanced**; no warnings. A fire core ringed by 8 evenly-spaced signs is a textbook clean seal. Issues are info-only: *"Stable: radial symmetry"* and *"Aim: the effect manifests above the seal (from the directional signs)."* (The ring is open in the source JSON, but that is only the app's activation visual and does not affect validity.)

## Composition
- **Substance (sigils):** **Fire** (element=fire) — the base fire sigil, which "works to create and manipulate flames or **heat** depending on the spell" ([sigils.md:13](../sigils.md#L13)).
- **Form (signs):**
  - **Radial ×4** (semi-directional) — tempers the fire down into heat; "likely serves to decrease the power... such as converting fire into heat" ([signs.md:245](../signs.md#L245)). Not inverted (canon-correct: Radial "has never been seen inverted").
  - **Column ×4, inverted** (directional) — instead of beaming the magic upward, the inverted/backwards column makes it "emit out in all directions, similar to dispersion," explicitly "as seen in the snugstone seal" ([signs.md:34](../signs.md#L34)).
- **Ring:** open in the source JSON (prepared). Activation is an app-only visual.
- **Ink / dyes:** plain conjuring ink (no dyes).

## Deduced effect
Engine summary:
> *"The flame is driven inward and erupts rather than projecting out, above the seal. The effect is tempered to a gentler intensity."*
> Note: *"Radial tempers the flame into gentle, flameless warmth."*

In plain terms: **a stone that radiates gentle, flameless heat evenly in every direction.** The fire never becomes open flame — the four Radials downshift it to warmth (`power=1`, "weakened on purpose") and the four inverted Columns spread that warmth omnidirectionally rather than firing it as a beam. The result is a warm-to-the-touch heat source: the snugstone.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Fire sigil | sigil / substance | The substance — flame/heat. Remove it and there's no element and no core → invalid. |
| Radial ×4 | sign / power | Tempers fire → gentle flameless heat. Remove them and you'd get **actual flame** — a hazard, not a warmer. |
| Column (inverted) ×4 | sign / form | Radiates the heat outward in all directions. Un-invert them and the heat beams straight up (useless for warming); remove them and it pools unshaped. |
| Even 8-fold placement | geometry | Radial symmetry → stable, balanced, even warmth. Uneven placement risks instability and hot spots. |
| Seal **size** | calibration | Tunes the *amount* of warmth (bigger seal = more power). Sized so the stone is warm, not burning. **This is the safety margin** — see Notes. |

## Element behavior & canon grounding

**Why fire is the right element — and why this spell is almost trivial for it.** Fire's defining canon property is that it natively occupies the **flame ↔ heat** continuum ([sigils.md:7,13](../sigils.md#L7)). Most "tame the element" spells fight the substance's nature; this one rides it. Radial doesn't *transmute* fire into something alien — it slides it down its own spectrum from "combustion" to "warmth." Try the same trick with water (you can chill it but it stays water) or earth (no temperature axis at all) and it doesn't work. Fire is the one element where "make it gentle and warm" is a **dimmer switch**, not a transmutation.

**Self-sufficiency.** Because fire *creates* its material ([sigils.md:13](../sigils.md#L13)), the snugstone needs no fuel source nearby — unlike an earth spell ("a pump that needs a reservoir"). Draw it on a pebble and the pebble is warm; it conjures its own heat. That is exactly why it works as a portable sleep-warmer with no kindling.

**The geometry fits the goal.** A sleep-stone wants heat going *outward in every direction*, not a focused jet. A normal Column would give a heat-*beam* shooting up — useless for warming a bed. The **inversion** is the whole design: it converts the beam into omnidirectional radiation ([signs.md:34](../signs.md#L34)), which is physically what you want from a glowing-warm stone. Heat radiates isotropically in the real world, so inverted-Column matches the substance's natural behavior here — no fight against physics.

**Calibration, not just tempering.** The Radials set the *kind* of output (warmth, not flame), but canon stresses that the spell is "precisely balanced to the **size of the seal** so that it is warm to the touch but not hot enough to burn." This is the cheat-sheet's "bigger seals = more powerful" rule in action: the *amount* of warmth scales with seal size, and Olruggio tuned that size to land in the safe band. The recipe makes it warmth; the **size** makes it *safe* warmth.

**Closest canon analogue — the Warmth-Retention Seal.** Both are gentle fire-family heat spells (the Warmth-Retention Seal also uses a fire sigil, [sigils.md:15](../sigils.md#L15)). The difference, from the names and uses: the **Snugstone *generates and radiates*** warmth (an active heat source: Radial-tempered fire + omnidirectional dispersal), while a **Warmth-Retention** seal *insulates / holds existing heat in*. Same element, opposite strategy — produce vs. preserve. (Comparison drawn from the docs; the Warmth-Retention Seal isn't in the engine catalog, so this isn't an engine catalog match.)

**Bottom line.** The Snugstone is the cleanest possible expression of fire's flame↔heat spectrum: Radial dials the flame down to safe warmth, inverted Column radiates it evenly outward, and fire's self-creating nature makes the stone its own furnace. Where the Flame Shot Seal weaponizes fire's *combustion* and aims it, the Snugstone domesticates fire's *heat* and spreads it — same sigil, opposite end of its own range, no transmutation required. Crucially, its safety is a **calibrated balance of power to seal-size**, not an inherent ceiling — which is precisely why amplifying it is catastrophic (below).

## How to draw it
1. **Fire sigil** at the center.
2. **8 signs** in an evenly-spaced ring around it (radius ~150 in the app; one sign every 45°), alternating:
   - **4 Radial** signs (semi-directional, upright — never inverted).
   - **4 Column** signs, **inverted/backwards** (the longer line facing *outward*), so they disperse rather than beam.
3. Keep the placement symmetric → radial symmetry → stable, even warmth.
4. **Size the seal deliberately:** the warmth scales with seal size. Draw it to the size calibrated for "warm to the touch, not burning." Larger = hotter.
5. Neatness matters for stability and duration; close the ring to activate.

## Usage ideas
- **Sleep-warming stone (canon):** the snugstone itself — tuck it in bed to sleep warm. This is Olruggio's intended use.
- **Boot / pocket warmer:** carry it in cold weather.
- **Gentle food/drink warmer:** keep a kettle or plate warm without scorching.
- **Seedling / livestock warmth:** keep a nest, hatchery, or cold frame above freezing.
- **Snow/ice melt:** set on a frozen lock or path to thaw it slowly.
- *(Speculative — not shown in canon: flameless safe-warmth could plausibly serve as frostbite/hypothermia first aid, but the manga only shows comfort/sleep use.)*

## Similar spells
- **Warmth-Retention Seal** (fire) — preserves/insulates heat rather than generating it. Opposite strategy, same element.
- **Pyreball Seal / Flame Shot Seal** (fire) — the *combustion* end of fire's spectrum (a floating flame ball; an aimed flame jet). The Snugstone is the *heat* end of the same spectrum, tempered by Radial.

## Notes & limitations
- **The Arcane Lens of Amplification incident (canon):** at Serpentback Cave, Coco gave her snugstone to the leader of the Ancients of Romonon, who placed it inside an **Arcane Lens of Amplification**. The amplification **unbalanced the spell** — the warmth, which is safe only because it's calibrated to the seal's size, scaled past its threshold and the heat grew so great it **melted the golden Ancients of Romonon**. This is the clearest canon evidence that the snugstone's safety is a power-calibration, not an inherent limit: amplify it (or, narratively, mix in a power dye like **Blood**) and the gentle warmer becomes a furnace.
- **Inversion correctness:** the Columns are inverted (canon: "backwards column"); the Radials are upright (canon: Radial "has never been seen inverted"). The engine reports no spin (`tilted=false`) — the per-sign rotations are radial/inward facings, not a tangential cant.
- **Forbidden flags:** none. Nothing touches the body, warps reality, or is destructive *as designed* (the melting incident required external amplification).
- **Canon ambiguity:** the docs admit the difference between *inverted column* and *dispersion* is unknown ([signs.md:34,45](../signs.md#L34)); treat "inverted column = radiate outward in all directions" as the working reading.

## Reproduction
- **Image:** requested from user (save to `assets/spells/Snugstone_Spell.png`).
- **JSON:** requested from user (the app export is authoritative). Importable composition embedded below (`wha-spell@2`, single circle):

```json
{
  "format": "wha-spell@2",
  "name": "Snugstone Spell",
  "circles": [
    {
      "id": "k10",
      "name": "Circle 1",
      "center": { "x": 0, "y": 0 },
      "radius": 100,
      "ring": { "closed": false },
      "core": { "id": "c6", "type": "fire", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
      "components": [
        { "id": "c14", "type": "radial", "role": "sign", "x": 0, "y": -65, "rotation": 180, "scale": 1, "inverted": false },
        { "id": "c17", "type": "column", "role": "sign", "x": 47.161215302384996, "y": -48.65384674072266, "rotation": 224.10750394777483, "scale": 1, "inverted": true },
        { "id": "c18", "type": "radial", "role": "sign", "x": 64.71974420253149, "y": 0.19230800867079267, "rotation": 274.4758286197665, "scale": 1, "inverted": false },
        { "id": "c19", "type": "column", "role": "sign", "x": 45.65217316150666, "y": 52.35785675048828, "rotation": 318.91398254317653, "scale": 1, "inverted": true },
        { "id": "c20", "type": "radial", "role": "sign", "x": 1.3003211050857217, "y": 71.1287651062012, "rotation": 358.95267950764367, "scale": 1, "inverted": false },
        { "id": "c21", "type": "column", "role": "sign", "x": -49.26824044886937, "y": -43.03511810302735, "rotation": 131.1367578025944, "scale": 1, "inverted": true },
        { "id": "c22", "type": "column", "role": "sign", "x": -44.94983193278313, "y": 55.10033416748047, "rotation": 39.92416615420359, "scale": 1, "inverted": true },
        { "id": "c23", "type": "radial", "role": "sign", "x": -64.51102590855251, "y": 1.9147150516509939, "rotation": 88.29993566515986, "scale": 1, "inverted": false }
      ],
      "dyes": [],
      "inkColor": null
    }
  ],
  "relations": []
}
```
