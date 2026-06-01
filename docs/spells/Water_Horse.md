---
name: Water Horse
type: water
origin: canon
forbidden: false
status: valid (effect partly unknown)
core: water (+ Horse decorative sigil)
signs: column ×2, direction (Region) ×2, unknown_01 (Unknown Sign 1) ×2, unknown_02 (Unknown Sign 2, line-shaped) ×3
dyes: none
symmetry: bilateral
source: Witch Hat Atelier — Qifrey's water horse carriage to the Silver Eve festival (wiki/manga; unofficial spell name).
image: none yet
json: assets/spells/Water_Horse.json (app export, embedded below)
---

# Water Horse

> A water spell that shapes water into a steerable horse — via a Horse decorative sigil over a
> water core — which can pull a vehicle such as the water horse carriage.

## Overview
The Water Horse is a **two-sigil** water spell: a central **water sigil** plus a **Horse
decorative sigil** above it, flanked by an **unidentified sign on the left and right** (a mirrored
pair — **Unknown Sign 1**), two **Column** signs near the top, and a **bottom row of Region
chevrons interleaved with an unidentified line-shaped sign** (**Unknown Sign 2**). The seal
conjures a **horse made of water** that can pull a load. Qifrey used it to draw the water horse
carriage that he and his apprentices rode to the Silver Eve festival, steering the horse with a
long pole that held an open scroll (possibly carrying a second, unknown spell) over the horse's
face; lowering that scroll to the ground ended the spell.

## Validity
**Valid, but its effect cannot be fully deduced.** Two sigils (water + Horse) with a defined form;
bilateral symmetry → **stable**. The seal contains **five unidentified signs (two Unknown Sign 1 +
three Unknown Sign 2)**, so the engine raises a warning that the **deduced effect is incomplete** —
see below.

## Composition
- **Substance (sigils):**
  - **Water (core)** — manipulates, collects, and **creates** water ([sigils.md:41](../sigils.md#L41)).
  - **Horse (decorative sigil)** — the real shape-giver: *"Manifests magic as a horse; can pull
    loads (practical use)"* ([sigils.json:272](../../data/sigils.json#L272)). Decorative sigils make
    magic take the depicted creature's shape; the Horse is the one with documented real utility.
- **Signs:**
  - **Column ×2** (directional, [signs.md:34](../signs.md#L34)) — drawn **horizontal**, flanking the
    Horse near the top. Balanced left/right, they channel the projection toward the body rather than
    firing a clean beam.
  - **Region ×2** (directional, id `direction`, [signs.md:96](../signs.md#L96)) — bottom of the seal,
    slightly tilted; place **where** the manifestation appears relative to the seal.
  - **Unknown Sign 1 ×2** (left & right, a mirrored pair) — **unidentified** ([signs.md, Unknown Signs](../signs.md)).
    Likely central to why this water spell forms and **holds** a controllable horse rather than an
    ordinary jet or pool.
  - **Unknown Sign 2 ×3** (bottom, line-shaped, interleaved with the Region chevrons) — **unidentified**.
- **Ink / dyes:** plain conjuring ink.

> **Mapping note.** Recipe taken from the app's JSON export (below). The Horse sigil and the two
> Column / two Region signs are certain; the two unknown sign *types* are catalogued but their
> functions are not known.

## Deduced effect
Engine summary (substance + known operators only): *"The water and the spell's magic is projected
as a tight column or beam, surging down (the region signs ring only one side of the seal),"* **plus
a warning**: *"Contains 5 unidentified signs — the deduced effect is incomplete and may be inaccurate."*

Two engine readings to override (per [learnings](../../.claude/skills/spell-analyzer/references/learnings.md)):
- **"surging down"** is an **in-plane axis label, not gravity** — the two Region signs are clustered
  at the bottom and tilted, and the engine reads clustered/partial-ring Region placement only coarsely.
- **"tilted → spin"** is an artifact of the off-axis Region/Column rotations, not an intended spin.

Canon (authoritative): the seal **forms a horse of water** (from the Horse sigil) that can be
controlled and used to **pull a vehicle**. The mechanism that holds the water in a coherent,
steerable horse shape is tied to the **unidentified signs (Unknown Sign 1 and 2)**, whose functions
are not yet known — which is why the engine honestly stops short.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water | core / substance | Conjures the water body on demand (no reservoir needed) |
| Horse | decorative sigil / shape | Forces the magic into a **horse** form and grants the canon "can pull loads" utility |
| Column ×2 | directional / form | Horizontal, balanced — channel the projection toward the body rather than a beam |
| Region ×2 | directional / aim | Place where the water-horse manifests relative to the seal |
| Unknown Sign 1 ×2 | **unknown** | Mirrored side pair — **unidentified**; likely tied to holding/steering the shape |
| Unknown Sign 2 ×3 | **unknown** | Line-shaped bottom row — **unidentified** |

## Element behavior & canon grounding
Water + a decorative **animal** sigil is a natural, self-sufficient pairing. Because water can
**create** its own material rather than only manipulate or collect it ([sigils.md:41](../sigils.md#L41)),
the horse's body is conjured from nothing and needs no pond or tank — unlike an earth construct,
which can only *manipulate* and would need a real source nearby ([sigils.md:53](../sigils.md#L53)).
The Horse sigil supplies the **template** (the living shape) and the canon **load-pulling** utility;
water supplies a fluid, continuously-renewable body that can flow and reform as the horse moves —
exactly the substrate a moving animal-shape needs (a rigid earth horse would fracture at every stride).

**Closest canon analogue: Qifrey's Water Dragon** — also water given a large animal form. Same
principle (water + creature-shape), different creature and purpose: the dragon is a combat/utility
serpent, the horse is a **draught animal** built to pull the water-horse carriage. What separates
the Water Horse from a plain Watershot jet is the decorative sigil plus the five unknown signs: the
jet just pushes water in a direction, while this spell holds it as a *standing, steerable body*.

**Bottom line:** a self-sufficient conjured-water **draught horse** — water's create-mode needs no
source, the Horse sigil gives both the shape and the load-pulling job, and (on the known parts)
Columns + Region channel and place the body. The part the engine can't yet resolve — how the horse
stays coherent and is controlled (the rein-pole over its face, in canon) — is exactly what the five
unidentified signs encode.

## Usage (canon & ideas)
- **Draft/transport (canon):** Qifrey conjured the horse to **pull the water horse carriage** to the
  Silver Eve festival; steered with a pole holding an open scroll over the horse's face — lowering it
  to the ground ended the spell.
- **Amphibious haulage:** a mount/hauler that can ford or cross water, partly reabsorbing and reforming.
- **Reusable labor:** needs no water source, so a field/worksite hauler raised anywhere; add Azuremoon
  Flower dye for longer duration.
- **Parade piece:** the decorative lineage makes it a showpiece that also does real work.

## Similar spells
- **Qifrey's Water Dragon** — another water spell that gives water a large animal form.
- **Watershot Seal / Water Bolt** — water shaped into directed jets/projectiles instead of a body.

## Notes & limitations
- **Effect is only partly deducible:** five unidentified signs (Unknown Sign 1 ×2 + Unknown Sign 2
  ×3) drive the engine's *"incomplete deduced effect"* warning. This is expected and correct, not a bug.
- Unofficial spell name; recipe is from the app JSON export, the canon behavior from wiki/manga.
- Not forbidden: no body magic, reality-warping, or mass destruction.

## Reproduction
- **Image:** the full seal redrawing (user-provided); the isolated unknown marks are saved at
  `assets/images/signs/unknown/Unknown_01.png` and `Unknown_02.png`.
- **JSON (`wha-spell@2`, from the app export):**

```json
{
  "format": "wha-spell@2",
  "name": "Water Horse Spell",
  "circles": [
    {
      "id": "k2", "name": "Circle 1", "center": { "x": 0, "y": 0 }, "radius": 120,
      "ring": { "closed": false },
      "core": { "id": "c4", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
      "components": [
        { "id": "c5", "type": "horse", "role": "sigil", "x": 0, "y": -60, "rotation": 0, "scale": 1, "inverted": false },
        { "id": "c6", "type": "unknown_01", "role": "sign", "x": 65.117, "y": -2.339, "rotation": 0, "scale": 1, "inverted": false, "mirrored": true },
        { "id": "c7", "type": "unknown_02", "role": "sign", "x": 63.589, "y": 56.322, "rotation": 317.470, "scale": 1, "inverted": false },
        { "id": "c8", "type": "unknown_01", "role": "sign", "x": -64.037, "y": -0.937, "rotation": 0, "scale": 1, "inverted": false },
        { "id": "c9", "type": "unknown_02", "role": "sign", "x": 2.408, "y": 71.169, "rotation": 0, "scale": 1, "inverted": false },
        { "id": "c10", "type": "unknown_02", "role": "sign", "x": -54.759, "y": 56.855, "rotation": 41.645, "scale": 1, "inverted": false },
        { "id": "c11", "type": "direction", "role": "sign", "x": -27.468, "y": 70.770, "rotation": 19.022, "scale": 1, "inverted": false },
        { "id": "c12", "type": "direction", "role": "sign", "x": 38.528, "y": 66.089, "rotation": 337.560, "scale": 1, "inverted": false },
        { "id": "c13", "type": "column", "role": "sign", "x": 45.930, "y": -48.829, "rotation": 270, "scale": 1, "inverted": false },
        { "id": "c14", "type": "column", "role": "sign", "x": -35.943, "y": -50.703, "rotation": 90, "scale": 1, "inverted": false }
      ],
      "dyes": [], "inkColor": null
    }
  ],
  "relations": []
}
```
