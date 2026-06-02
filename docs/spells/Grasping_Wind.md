---
name: Grasping Wind
type: wind
origin: wiki
forbidden: false
status: valid
core: wind
signs: pull ×4
dyes: none
symmetry: radial
source: telepedia "Grasping Wind": https://witchhatatelier.telepedia.net/wiki/Grasping_Wind — manga debut ch. 14; first used by Coco.
image: none yet
json: assets/spells/Grasping_Wind.json
---

# Grasping Wind

> Pulls a strong wind current in toward the glyph, dragging lighter objects with it.

## Overview
Grasping Wind is a wind-type spell: a **Wind** sigil ringed by inward-facing **Pull** signs. When completed it generates an air current flowing *toward* the seal, strong enough to drag lighter objects in. If the Pull signs are **slanted**, the inflow twists into a **vortex** that spins objects as it draws them in. First used by Coco.

## Validity
**Valid** (engine-confirmed). Wind core supplies the substance, the Pull ring supplies a defined inward form. Engine: **stable, radial symmetry**; aim "contained within the ring."

## Composition
- **Substance (sigil):** Wind — moves and manipulates air (does not create it).
- **Form (signs):** Pull ×4 (cardinals; the wiki shows four), inward-facing, **not inverted**. Pull draws the substance toward the keystone; pointed inward, the whole air mass converges on the seal. (Inverting Pull would flip it to *push away* — the opposite spell.)
- **Ring:** closed (active).
- **Ink / dyes:** plain.

## Deduced effect
Engine readout: *"The air stirs into moving wind, contained within the ring."* A converging gust — an inward suction that pulls loose, light objects toward the glyph. Slanting the Pull signs adds rotational bias, turning the suction into a twisting vortex (a controllable "tractor wind").

### How each part shapes the spell
| Part | Role | Effect |
|------|------|--------|
| Wind sigil | substance | The air being moved; without it Pull has nothing to act on. |
| Pull ×4 (inward, non-inverted) | form | Drives the air current toward the seal — the suction. |
| Slanting the Pull signs | drawing | Adds spin → a pulling vortex instead of straight suction. |
| Count (4 vs more) | quantity | Only changes ring evenness + matcher count, **not** the effect or power (engine power = average sign *size*). |

## Element behavior & canon grounding
Wind "moves and manipulates (not creates) air" ([docs/sigils.md](../sigils.md)) — so Grasping Wind doesn't conjure new air, it **redirects** ambient air into an inward flow. Pull is the directional draw-toward sign; a balanced inward ring makes a symmetric suction, and rotating each Pull off-radial is exactly how you'd convert linear draw into angular (vortex) motion. The "vortex when slanted" detail is the canonical knob.

## How to draw it
1. Draw the **Wind sigil** at the center.
2. Ring it with **Pull** signs, all pointed **inward** (toward the sigil).
3. Keep them even for a straight inward gust.
4. **Slant** each Pull the same rotational direction to make the inflow spin into a vortex.
5. Scale up for a stronger pull / wider reach.

## Usage ideas
- **Retrieve / gather** — pull a dropped or distant light object to hand.
- **Crowd/critter control** — drag small creatures or debris toward a point.
- **Vortex trap** — slanted, to spin and disorient whatever is drawn in.

## Similar spells
- **Wall of Wind** — the *containment* wind spell (a wall of air) rather than a suction.
- **Skysoaring / Sylph Shoes** — wind used for *thrust/lift* outward rather than pulling inward.
- **Convergence-based seals** (e.g. Vapor Bubble's intake) — converge a substance to a point, conceptually similar but via the Convergence sign.

## Notes & limitations
- **Pull art orientation (engine fix):** Pull's traced `svgPath` was vertically flipped (its arrow tip sat at the bottom), so a non-inverted, inward-facing Pull *rendered* pointing outward. The path has been corrected so non-inverted Pull now renders pointing toward the center — keeping its true "pull inward" meaning. Do **not** invert Pull to make it point inward (inversion = push/repel).
- **Count** is cosmetic to the engine: it affects ring evenness and the matcher multiset, not the effect or power.

## Reproduction
- **Image:** none yet
- **JSON:** [assets/spells/Grasping_Wind.json](../../assets/spells/Grasping_Wind.json)
