---
name: Floating Drops
type: water
origin: wiki
forbidden: false
status: valid
core: wind
signs: column ×2, direction ×16 (8 opposed normal/inverted pairs) (+ Water sigil ×2 at sides)
dyes: none
symmetry: bilateral
source: telepedia "Floating Drops" (mixed water/air): https://witchhatatelier.telepedia.net/wiki/Floating_Drops — manga debut ch. 16.
image: none yet
json: assets/spells/Floating_Drops.json
---

# Floating Drops

> Creates water droplets that hover in the air, forming along the seal's outer ring.

## Overview
Floating Drops is a **mixed water/air** spell: a central **Air (Wind)** sigil with two **Water** sigils to the sides, a **Column** pointing inward at each Water sigil, and **Region (direction)** signs around the outer edge arranged in **eight opposed pairs** — each pair one normal + one inverted sign pointing toward one another. The opposed pairs cancel out net direction, so the conjured droplets bead up and float **along the seal's perimeter** rather than falling or flying off.

> **Correction:** an earlier draft was missing the two Columns (which point at the Water sigils) and used only four Region signs all pointing inward. The canon shows **eight opposed pairs** (normal + inverted facing each other) plus the Columns — corrected here.

## Validity
**Valid** (engine-confirmed). Air core + Water substance + Columns + balanced opposed Region pairs. Engine: **stable, bilateral symmetry**; readout *"the air and water is projected … emerging only along the ring."*

## Composition
- **Substance (sigils):** Air (Wind) core + Water ×2 (sides). Air suspends; water is the droplet material.
- **Form (signs):**
  - **Column ×2** — on the east-west axis, each pointing **inward** at a Water sigil (drives/places the water).
  - **Region (direction) ×16** — eight **opposed pairs** around the outer ring (each pair: one normal + one inverted, pointing at each other). Their pushes cancel, pinning the effect to the ring.
- **Ring:** closed (active).
- **Ink / dyes:** plain.

## Deduced effect
Engine readout: *"The air and water is projected as a tight column or beam, emerging only along the ring."* Beads of water that hang in mid-air around the rim of the seal — suspended by the air substance, fed/placed by the Columns at the Water sigils, and **pinned along the ring** by the eight counteracting Region pairs (neither pushed in nor out).

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Air (Wind) core | substance | Suspends the droplets in air. |
| Water ×2 (sides) | substance | Supplies the water that beads into drops. |
| Column ×2 (toward the Water sigils) | form | Drives/places the water at each Water sigil. |
| Region ×16 (8 opposed pairs) | form | Net direction cancels → drops pinned along the outer ring. |

## Element behavior & canon grounding
A genuinely mixed-substance seal: Wind (moves air) + Water (collects/creates water) ([docs/sigils.md:41](../sigils.md#L41)). Placing Region signs as **opposed normal + inverted pairs** is the canonical way to *null out* net direction (inverting a Region flips its facing 180°, so a normal+inverted pair point at one another and cancel) — the same balancing trick seen in the Sand Cage. The cancellation localizes the drops to the ring instead of letting them drip or scatter; the Columns meter the water out at the two Water sigils.

## How to draw it
1. Draw the **Air (Wind) sigil** at the center.
2. Add a **Water sigil** on each side (east/west).
3. Place a **Column** just outside each Water sigil, pointing **inward** at it.
4. Around the outer ring, place **eight opposed Region pairs** — for each pair, one upright and one inverted sign pointing at each other — balanced all the way around.

## Usage ideas
- **Ambient humidity / decoration** — a floating ring of glistening drops.
- **Water reservoir** — hold small amounts of water aloft without a vessel.
- **Demonstration of opposed Region pairs** — a clean example of directional cancellation.

## Similar spells
- **Water Orb** — water gathered into a floating *sphere* rather than ringed droplets.
- **Vapor Bubble Spell** — mixed air/water that *collects* condensate into one body.
- **Sand Cage** — uses the same opposed normal/inverted pairing to balance forces.

## Notes & limitations
- The two Water sigils are role:sigil components; the catalog records them in `notes` (the matcher keys on core + sign multiset), so the recipe's `signs` list shows Column ×2 + Region ×8 (normal) + Region ×8 (inverted).
- The importable JSON regularizes the wiki's "eight pairs" into clean opposed pairs; exact on-page positions vary.

## Reproduction
- **Image:** none yet
- **JSON:** [assets/spells/Floating_Drops.json](../../assets/spells/Floating_Drops.json)
