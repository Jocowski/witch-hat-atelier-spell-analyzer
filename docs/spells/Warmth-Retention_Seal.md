---
name: Warmth-Retention Seal
type: time
origin: wiki
forbidden: false
status: valid
core: stop + fire
signs: none
dyes: none
symmetry: radial
source: telepedia 'Warmth-Retention Seal': https://witchhatatelier.telepedia.net/wiki/Warmth-Retention_Seal — recipe is the canonical example named in the Stop sigil description (sigils.md:107): "stop time for specific aspects of an object, such as changes in heat if paired with a fire sigil."
image: none yet
json: none yet
---

# Warmth-Retention Seal

> Locks an object's temperature in place by halting only the *heat* aspect of its timeline — a magical thermos rather than a heater.

## Overview
A time-type seal that pairs the **Stop** sigil (which halts time for whatever it affects) with a **Fire** sigil that *scopes* the halt to the object's thermal state. The result is not stasis and not a flame: the target's temperature simply stops changing — heat can neither leak away nor build up. It is the textbook illustration of Stop's "pair with a second sigil to halt one aspect" mechanic, named directly in the source material.

## Validity
**Valid** (engine). Two sigils (Stop core + Fire), no signs, open ring. The engine emits a single *warning* — "No signs around the core: the element has no defined form (raw, undirected discharge)" — which is a **false positive** here: the spell is deliberately sign-free because it suppresses a change rather than projecting a substance. No blocking or info issues.

## Composition
- **Substance (sigils):**
  - **Stop** (`stop`, element *time*) — the core. "Outright halts time for the objects it affects" (sigils.md:107). Acts on time/state, not matter; needs a target but conjures nothing.
  - **Fire** (`fire`, element *fire* = flame/heat/light) — the paired sigil. Normally "create and manipulate flames or heat" (sigils.md:13), but here it contributes its *domain* (heat) to select which property Stop freezes.
- **Form (signs):** none — correct for a passive state-lock.
- **Ring:** open (app activation visual only; not part of the effect).
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
The engine's heuristic scaffold reads "The flow of time and flame reverts what it touches to an earlier state" — that's the generic time+fire scaffold and is **not** the real effect.

Reasoned from CORE + lexicon: Stop alone would freeze the target's *entire* timeline (total stasis — the Time Stop / Petrification use). The Fire sigil narrows that halt to fire's domain — **heat**. So the spell **locks the object's temperature**: a hot thing stays hot, a cold thing stays cold, indefinitely, without continuing to burn fuel or radiate. Hence "Warmth-Retention."

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| **Stop** | sigil / core — halt time-state | The verb itself; remove it and there is no spell |
| **Fire** | sigil — aspect selector (heat) | Scopes the halt; without it Stop's freeze goes **total** → full stasis / Petrification, not warmth retention |
| **(no signs)** | passive state-lock | Correct; a form sign would try to *project* heat, defeating "retain" |
| **scale ~2.05× on Stop** | dominant central glyph | Cosmetic emphasis; no mechanical change |

## Element behavior & canon grounding
This is the cleanest possible demonstration of the Stop sigil's scoping rule.

- **Stop acts on time/state, not matter.** Its substance is immaterial (substances.md:262): it needs a *target* but conjures nothing, so it never has the "where does the material come from?" sourcing problem that earth/water spells face. It only needs something to lock onto.
- **Fire here is a selector, not a material.** The base fire sigil "works to create and manipulate flames or heat depending on the spell" (sigils.md:13). With **no form sign** to channel it, it is not emitting flame — it lends its domain (heat) to tell Stop which property to freeze. This is exactly the documented "pair … to stop time for specific aspects of an object, such as changes in heat if paired with a fire sigil" (sigils.md:107).
- **Why zero signs is right.** Signs are operators that shape/aim a *conjured* substance. Nothing is conjured or aimed here — the spell *suppresses* a change. The grammar of "lock property X of object Y" needs precisely a halt-substance (Stop) + an aspect-selector (Fire); a directional sign would contradict the intent and is correctly absent.

**Closest canon analogues:**
- **Time Stop / Petrification** — same Stop core *without* the scoping sigil, so the halt is total (full stasis). Warmth-Retention is the *narrowed* sibling: same verb, one property instead of all.
- **Snugstone Spell** (catalog) — also about warmth, but the **opposite mechanism**: Fire + Radial + Column that *generates* gentle flameless heat outward. Snugstone is a **heater**; Warmth-Retention is a **thermos** — it produces nothing and merely refuses to let warmth leave (or enter).

**Bottom line:** A faithful, well-formed canon spell — arguably the purest demonstration of Stop's "scope the halt with a second sigil" rule, lifted straight from sigils.md:107. The "timestop sigil" reading is correct; the Fire sigil narrows the timestop to heat, turning total stasis into a temperature lock. Works in both directions (keeps cold cold as readily as hot hot), since it freezes the heat-*state*, not "warmth" specifically.

## How to draw it
1. Place the **Stop** sigil at the center, drawn large (the clockface: outer circle, central hub, radial spoke marks). It is the dominant glyph (~2× scale).
2. Add the **Fire** sigil (upward flame triangle with stem) as a second sigil near the center — it is a *partner substance*, not a peripheral sign, so keep it close to the core rather than out on the ring.
3. Draw **no signs** — the spell is a passive lock; resist the urge to add a form/direction sign.
4. Symmetry is effectively radial about the Stop dial; neatness of the clockface matters more than placement of the small Fire glyph.

## Usage ideas
- Keep a meal, kettle, or bath hot for hours with no fire and no fuel (the likely in-world origin of the name).
- Cold chain: lock ice or a chilled potion at temperature so it never melts or warms — works both directions.
- Forge/glasswork: hold molten metal or glass at working temperature without continuous flame.
- Survival: a warmth-locked stone as a long-lasting hand-warmer; lock campfire coals from cooling overnight.
- Protect a thermosensitive item (reagent, lens) at a fixed temperature regardless of surroundings.

## Similar spells
- **Time Stop / Petrification** — same core, unscoped (total stasis).
- **Snugstone Spell** — generates flameless warmth outward (a heater, opposite mechanism).

## Notes & limitations
- The engine's "no signs → raw discharge" **warning is a false positive** for this spell class (a passive state-lock legitimately has no signs).
- The engine's `heuristicSummary` ("reverts … to an earlier state") is the generic time+fire scaffold and does not describe the real effect.
- Not forbidden magic.
- The seal needs a *target* to lock; like all Stop spells it does not create anything on its own.

## Reproduction
- **Image:** requested from user
- **JSON:** paste the importable composition below

```json
{
  "format": "wha-spell@2",
  "name": "Warmth-Retention Seal",
  "circles": [
    {
      "id": "k1",
      "name": "Circle 1",
      "center": { "x": 0, "y": 0 },
      "radius": 170,
      "ring": { "closed": false },
      "core": {
        "id": "c1", "type": "stop", "x": 0, "y": 0,
        "rotation": 0, "scale": 2.05, "inverted": false, "mirrored": false
      },
      "components": [
        {
          "id": "c2", "type": "fire", "role": "sigil",
          "x": 0.8, "y": -1.4, "rotation": 0, "scale": 1,
          "inverted": false, "mirrored": false
        }
      ],
      "dyes": [],
      "inkColor": null
    }
  ],
  "relations": []
}
```
