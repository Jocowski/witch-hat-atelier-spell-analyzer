---
name: Repetition Seal
type: time
origin: wiki
forbidden: false
status: valid
core: repetition_sigil
signs: column ×N, convergence ×N
dyes: none
symmetry: radial
source: telepedia 'Repetition Seal' (Japanese: くり返し / kurikaeshi): https://witchhatatelier.telepedia.net/wiki/Repetition_Seal — manga debut ch. 7 (Serpent's Bed of Sand arc); ch. 8 (Cookpot Lid); ch. 32 (Washing Barrel). Core sigil is Repetition; documented with Column and Convergence from the Cookpot variant.
image: none yet
json: none yet
---

# Repetition Seal

> A time-type seal built around the Repetition sigil that continuously resets whatever it is placed on to its original state — making objects perpetually fresh, clean, undamaged, and elastic.

## Overview
The Repetition Seal family (Japanese: *kurikaeshi* / くり返し) is a broad category of niche-type spells all based on the **Repetition sigil** (`repetition_sigil`). They work by continuously resetting the time-state of whatever the seal touches, returning it to the condition it was in when the spell first took effect. This produces effects like keeping food perpetually fresh (the Magic Cookpot), keeping clothes perpetually clean and new (the Washing Barrels), preventing structural deformation (the Serpent's Bed of Sand outer wrap), and resisting wear or damage. Each variant is different in detail but all share the Repetition sigil as their core. The seal was first seen in chapter 7 as a component of the Serpent's Bed of Sand contraption.

## In plain terms (sum up)
The Repetition Seal is essentially a magical "undo" button that never stops pressing. You place it on an object and it continuously rolls that object back to its original state — so food stays as fresh as the day it was cooked, clothes look brand new after being worn, soft materials spring back to their original shape after being compressed, and a piece of embroidery on a handkerchief will vanish (because the seal reverts the cloth to before the embroidery was added). Unlike Counterclock, which rewinds and then releases, the Repetition Seal keeps running indefinitely as long as the spell holds. The seal is used on objects, not people — it's a preservation and maintenance tool, not a healing spell.

## Validity
**Valid.** A Repetition sigil at the center supplies the time substance (the sigil is `canBeCenter`, so it is a valid core). Column and Convergence signs (inferred from the Cookpot variant and the Serpent's Bed of Sand) shape the field. No blocking issues. The engine will correctly identify the core substance as time.

## Composition
- **Substance (sigils):** Repetition (`repetition_sigil`, element *time*) — "continuously resetting time for the objects it affects to the state they had when the spell first affected them … like a spring, restoring the object to its original state if that object is somehow changed" (sigils.md:99). Acts on time/state; needs a target object, conjures nothing.
- **Form (signs):**
  - **Column ×N** (directional, form) — seen in the Cookpot Lid variant (signs.md; confirmed in Convergence entry). Projects the time-reset effect from the seal. Some variants may not include Column; the simplest Repetition Seal may be the sigil alone or with minimal signs.
  - **Convergence ×N** (semi-directional or special, power/focusing) — confirmed in the Cookpot Lid and Repetition Seal variants (signs.md:109 lists Repetition Seal under Convergence's spells). Focuses and strengthens the time-reset field.
- **Ring:** closed (active); the seal is often inscribed on a lid, barrel, or an object's surface.
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
The spell continuously resets the target to its original (spell-activation-time) state. The practical results confirmed in canon:
- Food placed in a cookpot with the seal on the lid remains indefinitely fresh; even a rotten potato becomes fresh.
- Clothes placed in a Washing Barrel become "brand new" (the reset reverts wear, dirt, and even deliberate embroidery — anything added *after* the activation moment).
- In the Serpent's Bed of Sand outer wrap, the Repetition layer prevents the soft cloud from being deformed by the dragon sitting on it.
- In the Capture Pennant Spell's inner ring, it keeps the pennant from bending, tearing, or warping.

The "like a spring" phrasing in the docs is precise: it resists deformation by continuously pushing back to the original state.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Repetition sigil | sigil / core — time substance | The entire mechanism; without it there is nothing to reset time |
| Column ×N | sign — form (projection) | Focuses the time-reset into a field above/around the seal; a bare sigil might reset only the seal itself |
| Convergence ×N | sign — power/focusing | Strengthens the reset field, giving it the reach and force to affect objects placed near or in the spell |

## Element behavior & canon grounding
The Repetition sigil's substance is **time** (immaterial; acts on the target's history rather than conjuring matter). This means it has none of the sourcing problems of elemental spells — it does not need water, stone, or air. It only needs a *target object to lock onto*. The continuous-reset mechanic means it is always running, continuously resetting the target rather than firing once like a Watershot or a Wall Breaker. This is why it works so well for long-duration preservation: food stays fresh not because the spell fires repeatedly but because it is never not running.

The system documents two distinct time operations in the same family:
- **Repetition** (this sigil) — continuous reset to prior state ("like a spring")
- **Stop** — outright halt of change
- **Counterclock** — a one-time reversal with a finite window

Repetition's continuous nature distinguishes it from Counterclock (temporary, one-time reversal) and from Stop (permanent halt). It is the only one of the three that operates like a standing maintenance process rather than a triggered event.

The wiki notes: "if you were to use the spell on rotten food, it would become fresh … a handkerchief that was embroidered would lose its embroidery" — the reset point is the state at first contact, not the "new" state. This is an important constraint: if you want to lock in embroidery, you must apply the seal *before* embroidering (or not apply it at all).

**Closest canon analogues:**
- **Counterclock** — sister time spell; Counterclock reverses damage to a prior state temporarily, then releases. Repetition continuously holds the reset indefinitely.
- **Capture Pennant Spell** — uses this exact sigil as its inner-ring core; the Capture Pennant adds Sights Set/Entwine/Strengthen signs for active behavior on top.
- **Warmth-Retention Seal** — Stop-based (sister time family), halts rather than resets; one-time set-and-hold rather than continuous cycling.

**Bottom line:** The Repetition Seal is a clean, well-documented preservation spell with a broad family of variants. The core mechanism is the simplest possible time operation: run indefinitely, reset continuously. Every documented variant applies this to a different application domain (food, cloth, structure, pennant resilience). The only limitation is that the reset target is fixed at the activation moment — the spell doesn't know what "ideal" is, only what "original" (spell-start) was.

## How to draw it
1. Place the **Repetition sigil** at the center — the spiral-coil glyph, which `canBeCenter` and serves as both core and substance source.
2. Ring with **Column** signs (facing inward, toward the sigil) to project the time-reset effect above the seal.
3. Add **Convergence** signs to focus and strengthen the field — point their tip inward.
4. Keep the arrangement radially symmetric (equal spacing) for stability; the Repetition sigil is itself radially symmetric.
5. Larger seal = more powerful effect / wider coverage (the cookpot lid is a modest size; the Serpent's Bed of Sand outer wrap is massive).
6. Draw on or directly attached to the object you want to preserve/reset — the seal's field acts on what it touches or what is placed within it.

## Usage ideas
- **Food preservation:** the Magic Cookpot — keeps even extremely old food fresh, reverts rotten ingredients.
- **Laundry:** the Washing Barrel — clothes become "brand new" by reverting wear, dirt, and stains.
- **Structural resilience:** prevents soft or flexible structures from deforming under pressure.
- **Tool maintenance:** inscribe on a blade, container, or woven object to keep it perpetually undamaged.
- **Sealed storage:** apply to a chest or container to prevent contents from aging.
- **Anti-deformation:** anything that would normally be crushed, bent, or worn smooth can be held rigid or original.

## Similar spells
- **Counterclock** — same family; reverses damage temporarily rather than holding continuously.
- **Capture Pennant Spell** — Repetition core with active wrapping/targeting signs added.
- **Warmth-Retention Seal** — Stop-based time spell (halt vs. reset; different mechanism).

## Notes & limitations
- The reset state is **fixed at activation**: whatever the object was when the spell first touched it is the state it will always return to. If the object is already damaged when the spell is applied, it will reset to that damaged state, not to a perfect state.
- Not forbidden: only resets objects to their prior state; does not act on living bodies (acting on a living body with a time spell would be forbidden).
- The wiki confirms "numerous different kinds of repetition seals exist, and each one is different" — this is the family, not a single spell. The sign counts and exact configurations vary per application.
- The sign set (Column + Convergence) is inferred from the Cookpot Lid variant and the signs.md Convergence entry, which explicitly lists "Repetition Seal" as a spell using Convergence; treat counts as medium-confidence.

## Reproduction
- **Image:** requested from user
- **JSON:** importable wha-spell@1 composition below (representative variant; Column + Convergence around a Repetition sigil core)

```json
{
  "format": "wha-spell@1",
  "name": "Repetition Seal",
  "ring": { "closed": true },
  "core": { "id": "c1", "type": "repetition_sigil", "x": 0, "y": 0, "rotation": 0, "scale": 1 },
  "components": [
    { "id": "s1", "type": "column", "role": "sign", "x": 0, "y": -110, "rotation": 180, "scale": 1, "inverted": false },
    { "id": "s2", "type": "convergence", "role": "sign", "x": 78, "y": -78, "rotation": 225, "scale": 1, "inverted": false },
    { "id": "s3", "type": "column", "role": "sign", "x": 110, "y": 0, "rotation": 270, "scale": 1, "inverted": false },
    { "id": "s4", "type": "convergence", "role": "sign", "x": 78, "y": 78, "rotation": 315, "scale": 1, "inverted": false },
    { "id": "s5", "type": "column", "role": "sign", "x": 0, "y": 110, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "s6", "type": "convergence", "role": "sign", "x": -78, "y": 78, "rotation": 45, "scale": 1, "inverted": false },
    { "id": "s7", "type": "column", "role": "sign", "x": -110, "y": 0, "rotation": 90, "scale": 1, "inverted": false },
    { "id": "s8", "type": "convergence", "role": "sign", "x": -78, "y": -78, "rotation": 135, "scale": 1, "inverted": false }
  ],
  "dyes": []
}
```
