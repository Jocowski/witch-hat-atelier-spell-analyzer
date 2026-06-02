---
name: Sylph Shoes Seal
type: wind
origin: wiki
forbidden: false
status: valid
core: wind_underfoot
signs: convergence ×8, levitation ×8 (alternating)
dyes: none
symmetry: radial
source: telepedia "Sylph Shoes Seal": https://witchhatatelier.telepedia.net/wiki/Sylph_Shoes_Seal — manga debut ch. 1; drawn on Sylph Shoes (a contraption). The seal is bisected, one half per sole, and completes when the shoes touch.
image: none yet
json: assets/spells/Sylph_Shoes_Seal.json
---

# Sylph Shoes Seal

> Lets the wearer float above the ground and fly — a bisected seal split across two shoe soles.

## Overview
The Sylph Shoes Seal is a wind-type spell drawn on **Sylph Shoes** (a contraption). It uses a central **Wind Underfoot** sigil (a variant of the Wind sigil) surrounded by an alternating pattern of **Convergence** and **Levitation** signs. The seal is **bisected** — one half on each sole — and only completes/activates when the two shoes are touched together, at which point the wearer can float and fly.

## Validity
**Valid** (engine-confirmed, modelled as the completed/whole seal). Wind Underfoot core + alternating Convergence/Levitation ring. Engine: **stable, radial symmetry**; aim "above the seal."

## Composition
- **Substance (sigil):** Wind Underfoot — a wind variant tuned for lifting the wearer from below.
- **Form (signs):** Convergence ×8 + Levitation ×8, alternating (the wiki shows eight of each). Convergence focuses the lift to a point under the user; Levitation supplies the upward push.
- **Ring:** closed when the two soles meet (the contraption's activation).
- **Ink / dyes:** plain.

## Deduced effect
Engine readout: *"The air stirs into moving wind, centered above the seal; it is lifted and made to levitate. The effect is focused down to a single point."* Personal flight: focused, sustained lift under the wearer. The bisected design is a safety/activation mechanism — the spell is inert until the soles touch and the halves join.

### How each part shapes the spell
| Part | Role | Effect |
|------|------|--------|
| Wind Underfoot sigil | substance | Wind tuned to lift the wearer from below. |
| Levitation ×4 | form | Supplies the upward thrust. |
| Convergence ×4 | form | Focuses the lift to a point (stable, controllable hover/flight). |
| Bisected layout | contraption | Inert until the two soles meet → completes the seal. |

## Element behavior & canon grounding
Wind moves air without creating it ([docs/sigils.md](../sigils.md)); the **Wind Underfoot** variant is the lift-from-below form. Convergence focuses an effect to a point ([docs/signs.md](../signs.md)) — pairing it with Levitation gives controlled, concentrated lift rather than a scattering gust. The bisected, touch-to-activate construction is a contraption feature (the seal is split across both shoes), beyond what the single-seal engine models.

## How to draw it
1. Draw the **Wind Underfoot sigil** at the center.
2. Ring it with **alternating Convergence and Levitation** signs (4 each), inward.
3. To replicate the contraption: split the completed seal across two soles so it only joins when the shoes touch.

## Usage ideas
- **Personal flight / hovering** — float above ground while the shoes are engaged.
- **Safe-activation wearable** — the bisected design prevents accidental triggering.
- **Mobility aid** — light-footed travel or reaching height.

## Similar spells
- **Skysoaring Seal** — wind thrust for flight via a single directional keystone (no convergence focus).
- **Flying Puppet of Diversion** — wind flight of a piloted object rather than the wearer.
- **Cloak Spell** — another wearable contraption seal (complex; see complex list).

## Notes & limitations
- **Convergence orientation (visual fix):** in the first export the Convergence signs pointed toward the outer ring; their correct/neutral orientation points toward the **center** (the engine default already does this — `defaultFacing: "outward"` puts the sign's tip toward center). A rendering/orientation fix, not a structural change.
- **Count (8+8 vs fewer):** matching the wiki's eight-of-each only changes ring density and the matcher count — not the effect or power (engine power = average sign *size*).
- **Contraption / bisected seal** — modelled here as the completed whole; the split-across-soles activation isn't represented by the single-seal engine. confidence: medium.

## Reproduction
- **Image:** none yet
- **JSON:** [assets/spells/Sylph_Shoes_Seal.json](../../assets/spells/Sylph_Shoes_Seal.json)
