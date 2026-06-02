---
name: Bird of Light Beacon
type: light
origin: wiki
forbidden: false
status: valid
core: light
signs: dispersion ×1 (+ Bird A decorative sigil as the shape-giver)
dyes: none
symmetry: asymmetric
source: telepedia "Bird of Light Beacon": https://witchhatatelier.telepedia.net/wiki/Bird_of_Light_Beacon — manga debut ch. 11; Agott used it at the river rescue to distract an outsider and call for help.
image: none yet
json: assets/spells/Bird_of_Light_Beacon.json
---

# Bird of Light Beacon

> Forms a bird made of light that flies around for a while — to entertain, signal, or distract.

## Overview
Bird of Light Beacon is a light-type spell built from a **Light** sigil (the substance), a **Bird A** decorative **sigil** (the shape-giver that turns the light into the form of a bird), and a single **Dispersion** sign (which releases/spreads the light so it fills that form). It produces a bird of light that flies about for some time — to entertain, call for help, or distract. Agott used it during the river rescue.

> **Correction:** an earlier draft modelled this as a Light sigil + a "Bird" *sign* ×3. That was wrong — the bird is the **`bird_a` decorative sigil** (a shape-giver, like the Horse in Water Horse), and there is a single **Dispersion sign**, not three bird signs.

## Validity
**Valid** (engine-confirmed). Light core + bird_a sigil + Dispersion. Engine: combined readout *"The light … leaks out and spreads on every side, spreading outward."* The off-centre dispersion + the large bird_a sigil make the layout **asymmetric** (intended — the bird has a front/shape, it isn't a balanced ring).

## Composition
- **Substance (sigils):** Light (core) + **Bird A** decorative sigil (`bird_a`, role:sigil) — the bird-shaped body the light fills.
- **Form (signs):** Dispersion ×1 — releases/spreads the light into that shape (not a tight beam).
- **Ring:** closed (active).
- **Ink / dyes:** plain.

## Deduced effect
Engine readout: *"The light … leaks out and spreads on every side, spreading outward."* The Dispersion releases the light freely; the Bird A sigil gives it the body and flight of a bird — a roaming, glowing beacon that can be aimed at a target (distraction) or sent aloft (signal).

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Light sigil (core) | substance | The luminous material. |
| Bird A sigil (`bird_a`) | shape (decorative sigil) | Gives the light the body/flight of a bird. |
| Dispersion ×1 | form (sign) | Releases/spreads the light to fill the bird form (not a tight beam). |

## Element behavior & canon grounding
Decorative **sigils** are shape-givers: they lend a conjured substance a body, the way the Horse sigil does in Water Horse and the Dragon sigil in Qifrey's Water Dragon. Here `bird_a` shapes light into a bird. **Dispersion** "makes the magic 'leak'/disperse out on all sides… essentially a column that leaks instead of firing" ([docs/signs.md](../signs.md)) — the opposite of Light Beam's tight Column — so the light fills the bird shape and glows in all directions rather than firing as a beam.

## How to draw it
1. Draw the **Light sigil** as the core.
2. Add the **Bird A** decorative sigil (large) as the shape-giver.
3. Add a single **Dispersion** sign to release/spread the light into the form.
4. Aim the bird (distraction) or send it aloft (signal/beacon).

## Usage ideas
- **Signal / beacon** — a glowing bird sent up to call for help.
- **Distraction** — draw an enemy's eye while you act unseen (canon).
- **Light companion / entertainment** — a friendly glow that flits around.

## Similar spells
- **Light Beam** — light as a fixed *beam* (Column) rather than a dispersed, shaped form.
- **Floatglow Lamp Seal** — floating ball of light (no animal shape sigil).
- **Water Horse / Qifrey's Water Dragon** — same "decorative shape **sigil** gives the substance a body" pattern, on water.

## Notes & limitations
- **Structural correction** from the first draft: it is **Light sigil + `bird_a` sigil + 1 Dispersion sign**, not bird signs ×3. The catalog records `bird_a` in `notes` (the matcher keys on core + sign multiset, so `signs` lists only Dispersion ×1). confidence: medium.

## Reproduction
- **Image:** none yet
- **JSON:** [assets/spells/Bird_of_Light_Beacon.json](../../assets/spells/Bird_of_Light_Beacon.json)
