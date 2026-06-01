---
name: Rainbringer Seal
type: water
origin: canon
forbidden: false
status: valid
core: water
signs: rain ×1
dyes: none
symmetry: radial
source: Witch Hat Atelier — one of the spells Qifrey's apprentices had committed to memory; shown on the mural of their arsenal while discussing how to cure Euini of the scalewolf curse (Serpentback Cave arc). Wiki: "Rainmaker's Glyph."
image: none yet
json: none yet
---

# Rainbringer Seal

> Generates a localized shower of rain over the area around the seal.

## Overview
The Rainbringer Seal is a water-type spell consisting of a central **Water** sigil with a single **Rain** sign surrounding it. When drawn, it produces a shower of rainfall down into its immediate area. It is the only documented canon spell built on the Rain sign. The spell was never seen actively cast — it appears on a mural of the spells Qifrey's apprentices had memorized, referenced while they searched for a way to turn Euini back into a human after the scalewolf curse.

## Validity
**Valid** (engine-confirmed). Water core supplies a substance and Rain supplies a defined form, so no blocking issues. The engine raises a soft **stability** flag ("potentially unstable — asymmetric"), which is a geometry artifact of a single sign read slightly off the exact origin rather than a real defect — Rain is *meant* to be the lone surround, so a cleanly centered ring resolves it.

## Composition
- **Substance (sigils):** Water sigil — manipulates, collects, and creates water; supplies the actual droplets.
- **Form (signs):** Rain (semi-directional) — wraps the central sigil and shapes its output into rainfall over the surrounding area. Upright (not inverted), so it drops rain rather than reversing to draw moisture in.
- **Ring:** as exported, open (prepared). Ring open/closed is only the app's activation visual; closing it fires the shower.
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
Engine summary: **"The water falls as rain across the surrounding area."**

A steady, localized downpour in the zone immediately around the seal. The effect is undirected — it rains *down* over the area; it does not aim or fling water anywhere. Drawn large (this export sits at scale 2.5), the rainfall is correspondingly heavier and covers a wider patch (engine power = 2.5).

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water sigil | sigil (substance) | Supplies the water. Without it, Rain has nothing to drop. |
| Rain sign | sign (form) | Shapes the water into falling rainfall over the immediate area. Without it, the water is raw and undirected (no defined form). |
| Scale 2.5 | drawing size | Amplifies output to power 2.5 — a heavier, wider downpour. Smaller would be a light drizzle. |

## Element behavior & canon grounding
**Create vs. collect constraint.** The Water sigil "works to manipulate, collect, and create water… many water spells meant to be used over long periods collect water rather than create it. This suggests that creating water is more energetically costly than collecting it" ([docs/sigils.md:41](../sigils.md#L41)). This makes the Rainbringer self-sufficient in a way no other element could match — water can conjure its own falling material, so the seal needs no reservoir for a short burst. But for *sustained* rainfall the cheaper, canon-favored mode is **collection**: the seal is best understood as a condenser gathering ambient humidity and dropping it, rather than a bottomless faucet pulling water from nowhere.

**Physical state vs. the sign's mechanic.** Rain "causes its spell to produce an effect very similar to rainfall down into its immediate area… meant to surround the central sigil, which is placed in the empty space at its center. As rain can be turned inside out to reverse its effect, it is considered semi-directional" ([docs/signs.md:287](../signs.md#L287)). Rain's mechanic is gravity-driven droplets dispersed over a zone — and water is a fluid that naturally breaks into droplets and falls. The substance behaves exactly as the sign expects; this is the cleanest possible sigil/sign pairing. It is precisely why the docs name water as Rain's reliable sigil while only tentatively speculating that fire or light *might* yield "firework-like effects." With water there is no ambiguity.

**Closest canon analogue.** This spell *is* the canonical use of Rain — the sign's only documented appearance is the Rainbringer Seal ([docs/signs.md:289](../signs.md#L289)). The nearest *variant* is the **Rainflinger**, a mixed spell that pairs Rain-type water output with **Crosshair** so the rain seeks a target, and which has a "Drying" mode ([docs/spells.md:81](../spells.md#L81)) corresponding to the inverted-Rain direction. The Rainbringer has neither a targeting sign nor inversion, so it is the plain "rain falls here" form: same substance and form, but undirected and additive rather than seeking or drying.

**Bottom line.** A textbook, fully feasible water spell and the single best-matched sigil/sign pairing in the water repertoire. Water supplies the droplets, Rain disperses them as a localized downpour, and water's ability to either *create* (burst) or *collect* (sustained) makes it self-sufficient where any other element would need a real water source. The large draw simply makes it rain harder.

## How to draw it
1. Draw the **Water sigil** at the center.
2. Surround it with a single **Rain** sign — Rain is the surround, so the sigil sits in the empty space at its center. Do **not** ring multiple Rain signs; one clean, centered surround is the canon form.
3. Keep the surround neat and concentric — neater seals are more stable and longer-lasting, and a cleanly centered Rain clears the engine's asymmetry flag.
4. Leave Rain upright (not inverted) for rainfall. Inverting it reverses the effect toward drawing moisture in / drying.
5. Scale the whole seal up for a heavier, wider downpour (bigger seals = more powerful).

## Usage ideas
- **Irrigation / firefighting** — drop a sustained, area-wide downpour over a field or spreading fire without aiming a hose.
- **Wash-down / cleaning** — rinse a courtyard, a flock, or a workshop floor.
- **Cover & concealment** — a localized rainstorm to obscure sightlines or muffle sound.
- **Water-gathering in the field** — run it in collect-mode under humid conditions to fill a cistern.

## Similar spells
- **Rainflinger (Normal / Drying)** — Rain output + Crosshair to make the rain seek a target; the "Drying" mode is the inverted-Rain direction. The Rainbringer lacks targeting and inversion.
- **Watershot Seal / Water Bolt** — directed water that is *aimed* (column/bolt forms) rather than dropped over an area.
- **Water Orb** — water gathered and held in a floating sphere rather than dispersed as rainfall.

## Notes & limitations
- The engine's "potentially unstable (asymmetric)" flag is a single-sign geometry artifact, not a real instability; centering the Rain surround precisely resolves it.
- Sustained casting should be read as **collection** (condensing ambient moisture), since continuous *creation* of water is energetically costly per the source material.
- Inverting Rain reverses the effect (toward drawing in / drying); this export is upright.
- Never seen cast on-page — behavior is inferred from the sign/sigil docs and the spell's stated description.

## Reproduction
- **Image:** requested from user
- **JSON:** requested from user (importable composition below)

```json
{
  "format": "wha-spell@2",
  "name": "Rainbringer Seal",
  "circles": [
    {
      "id": "k2",
      "name": "Circle 1",
      "center": { "x": 0, "y": 0 },
      "radius": 60,
      "ring": { "closed": false },
      "core": {
        "id": "c1",
        "type": "water",
        "x": 0,
        "y": 0,
        "rotation": 0,
        "scale": 0.7,
        "inverted": false
      },
      "components": [
        {
          "id": "c2",
          "type": "rain",
          "role": "sign",
          "x": 0.7023422718048096,
          "y": -0.3846139907836914,
          "rotation": 180,
          "scale": 2.5,
          "inverted": false
        }
      ],
      "dyes": [],
      "inkColor": null
    }
  ],
  "relations": []
}
```
