---
name: Rainflinger
type: water
origin: wiki
forbidden: false
status: valid
core: water
signs: crosshair ×2 (+ Fire sigil ×2 as substance, top & bottom)
dyes: none
symmetry: radial (engine reading; bilateral by element-type — Fire on the vertical axis, Crosshair on the horizontal)
source: telepedia "Rainflinger" (水飛ばし mizutobashi): https://witchhatatelier.telepedia.net/wiki/Rainflinger — manga debut ch. 8 (old versions: Repelling & Drying), retconned ch. 28 p. 10 (new/current version). Used by Qifrey & the atelier girls for a rainy-day picnic and to intimidate Olruggio; the drying variant dried off Brushbuddy via Olruggio's link rings.
image: assets/images/spells/Rainflinger_Normal.png
json: assets/spells/Rainflinger.json
---

# Rainflinger

> Creates a water-repellent "bubble" around the seal — keeps its radius dry by repelling and/or drying off the water.

## Overview
Rainflinger is a **mixed water/fire** spell (older versions are **air/fire**) that holds a dry zone within its radius even in the rain. The series has **three documented constructions** — the wiki notes one or both old versions were retconned, so it is "unclear which spell is the current one":

1. **Old · Repelling** (ch. 8) — a central **Air**-sigil *variant*, modified **Fire** signs on the sides, and **Crosshair** signs above and below. Carves out a bubble devoid of water. Also drawn on Olruggio's link rings.
2. **Old · Drying** (ch. 8) — almost identical to Repelling, but the Fire sigil-variants are **inverted** and the line through the triangle of the sigil **does not connect**. Dries things off and warms them.
3. **New / current** (ch. 28) — a central **Water** sigil with a **Fire** sigil above and below it, and a **Crosshair** sign on each side. Same water-repellent bubble; canon does not say whether the water is repelled or dried.

**This document models the new (current) version** — it is the most recent retcon and the only one whose pieces map to clean sigil/sign ids. The old versions are described above and under *Similar / version history* but are not given an engine recipe (their "modified / variant" Air and Fire sigils don't correspond to catalogued ids).

## Validity
**Valid** (engine-confirmed) — `npm run facts -- assets/spells/Rainflinger.json`. Two substances (Water core + two Fire sigils) supply material, and the two Crosshair signs supply a defined form (area-of-effect confinement), so there are no blocking issues. The engine reports **stable, radial symmetry**. Combined heuristic readout: *"The water and flame pours and flows outward. It is confined within an area of effect."* — a scaffold; the canon effect is the dry bubble below.

## Composition (new version)
- **Substance (sigils):** **Water** core at center + **Fire** sigil above and below. Mixed-element: water is the medium being managed; fire is the agent that drives it off.
- **Form (signs):** **Crosshair** ×2, one on each side (left/right). Crosshair is non-directional and *confines the manifestation to an area of effect* / makes same-aspect matter behave within that zone ([docs/signs.md:239](../signs.md#L239)).
- **Ring:** closed (active) as exported.
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
A standing **dry pocket**: within the seal's radius, rain and ambient water are kept out — the area stays dry while it pours outside. Two readings of the mechanism, both canon-plausible and unresolved:

- **Repel** — the Crosshair confines an anti-water field to the zone, pushing droplets out of the bubble (the "Repelling" lineage).
- **Dry** — the paired Fire substance evaporates/warms the water away as it enters (the "Drying" lineage; the old Drying variant explicitly *warms* as well).

The current build sits between the two: Fire + Water under a Crosshair confinement, so it plausibly does both — evaporating intruding water and bounding the effect to a local bubble.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water sigil (core) | sigil (substance) | The medium being managed — the water that is kept out / driven off. |
| Fire sigil ×2 (top & bottom) | sigil (substance) | Supplies heat; the likely agent that dries/evaporates intruding water and adds warmth. |
| Crosshair ×2 (sides) | sign (form) | Confines the effect to a bounded **area of effect** — the dry "bubble" — rather than letting it disperse. |
| Symmetry (bilateral) | layout | Fire on the vertical axis, Crosshair on the horizontal axis: balanced, so the bubble is even all around. |

## Element behavior & canon grounding
**Fire + Water as a drying pair.** Fire "creates and manipulates flame and heat" ([docs/sigils.md](../sigils.md)); Water "manipulates, collects, and creates water" ([docs/sigils.md:41](../sigils.md#L41)). Pairing them lets the seal act *on* water with heat — evaporating or warding it — which is exactly a "stay dry in the rain" utility. Note the new version makes **water the core** (the thing being controlled) and fire the modifier, whereas the old versions made **air** the core (an air bubble that simply excludes water). The retcon shifts the spell from "an air pocket that water can't enter" to "a water-managing seal that drives water off."

**Crosshair is the canon-uncertain piece.** Crosshair is "a component of the rainflinger seal… non-directional… likely it functions to cause magic to only target and/or manifest in objects with a corresponding magic aspect" ([docs/signs.md:239](../signs.md#L239)) — i.e. confine-to-area / act-on-same-aspect. It is only firmly seen in Rainflinger and the Fish Guiding Seal, so its precise meaning is a leading theory, not confirmed. That uncertainty (plus the unresolved repel-vs-dry mechanism) is why this entry is **confidence: medium**.

**Bottom line.** A feasible mixed water/fire utility seal: Fire drives water off, Crosshair bounds the result to a local dry bubble, Water is the medium. The exact mechanism (repel vs. evaporate) and the precise role of Crosshair remain canon-unconfirmed.

## How to draw it (new version)
1. Draw the **Water sigil** at the center.
2. Place a **Fire sigil** directly **above** and another directly **below** it (vertical axis).
3. Place a **Crosshair** sign on each **side** — left and right (horizontal axis).
4. Keep the two pairs balanced on their perpendicular axes for an even, all-around bubble.
5. Leave everything upright (the **Drying** lineage is the variant that *inverts* the fire sigils — invert only if you specifically want the warming/drying-forward behavior).

## Usage ideas
- **Stay-dry field** — a picnic, a campsite, or a workspace that stays dry while it rains around it (canon: Qifrey's rainy-day picnic).
- **Quick-dry** — dry off a soaked object, animal, or person (canon: drying Brushbuddy via link rings).
- **Rescue / travel kit** — paired into link rings or a "Raincleaver" tool to keep gear and people dry on the move.
- **Counter to water attacks** — a bounded zone that wards or boils off incoming water.

## Similar spells & version history
- **Old Repelling vs. Old Drying** — both use an **Air**-sigil-variant core with modified Fire sigils on the sides and Crosshair top/bottom. Drying differs only by **inverting** the fire sigils and a disconnected triangle line, and additionally **warms**. These were drawn on Olruggio's link rings.
- **Rainbringer Seal** — the near-namesake but *opposite* effect: Water + **Rain** to *produce* a localized downpour. Rainflinger keeps an area **dry**; Rainbringer makes it **rain**. (See [Rainbringer_Seal.md](Rainbringer_Seal.md).)
- **Vapor Bubble Spell** — also manages atmospheric water with a Water core, but to *collect* condensate rather than to repel it.
- **Snugstone / Warmth-Retention Seal** — fire-based warmth without the water-warding, sharing Rainflinger's "gentle heat" facet.

## Notes & limitations
- **Three versions exist; one or both old ones were retconned** — the wiki itself says it is unclear which is current. This entry models the ch. 28 version and documents the others.
- **Mechanism unconfirmed** — canon does not state whether the bubble *repels* or *dries/evaporates* the water; likely both.
- **Crosshair is canon-uncertain** — only firmly seen here and in the Fish Guiding Seal; the "confine-to-area / same-aspect" reading is the leading theory (hence confidence: medium).
- The matcher records the two Fire sigils in the catalog `notes` (it keys on core + sign multiset), so the recipe's `signs` list shows only Crosshair ×2.

## Reproduction
- **Image:** [assets/images/spells/Rainflinger_Normal.png](../../assets/images/spells/Rainflinger_Normal.png) (Drying variant art: `Rainflinger_Drying.png`)
- **JSON:** [assets/spells/Rainflinger.json](../../assets/spells/Rainflinger.json) (importable; new version)

```json
{
  "format": "wha-spell@1",
  "name": "Rainflinger",
  "ring": { "closed": true, "doubled": false, "size": "medium" },
  "core": { "id": "c1", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
  "components": [
    { "id": "c2", "type": "fire", "role": "sigil", "x": 0, "y": -90, "rotation": 180, "scale": 0.8, "inverted": false },
    { "id": "c3", "type": "fire", "role": "sigil", "x": 0, "y": 90, "rotation": 0, "scale": 0.8, "inverted": false },
    { "id": "c4", "type": "crosshair", "role": "sign", "x": -90, "y": 0, "rotation": 90, "scale": 1, "inverted": false },
    { "id": "c5", "type": "crosshair", "role": "sign", "x": 90, "y": 0, "rotation": 270, "scale": 1, "inverted": false }
  ],
  "linkCount": 0,
  "dyes": []
}
```
