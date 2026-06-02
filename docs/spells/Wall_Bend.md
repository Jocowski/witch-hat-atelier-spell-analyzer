---
name: Wall Bend
type: earth
origin: community
forbidden: false
status: valid
core: earth
signs: pull ×2, bend ×2, weave ×1, bind ×1, unknown_02 ×1, unknown_05 ×1
dyes: none
symmetry: bilateral
source: community reconstruction (user), built from the appearance of the canon Wall Bend spell; not canon-confirmed
image: assets/spells/Wall_Bend.svg
json: assets/spells/Wall_Bend.json
---

# Wall Bend

> An earth spell that makes an existing stone wall pliable and **bends/reshapes it in place**.
> **This entry is a community reconstruction** of the canon Wall Bend from its drawn appearance;
> the keystone identities are best-guess (though the core five match the canon docs closely).

## Overview
Wall Bend is a canon **earth** spell whose documented signs are Pull, Bend, Weave, and Bind
([signs.md:67,279,303](../signs.md); [sigils.md:55](../sigils.md)). It softens a real wall and
curves/reshapes it rather than breaking it. This document records a **reconstruction** built in
the app and analyzed through the real engine; the two `unknown_*` marks are treated as shape
placeholders.

## Validity
Engine: **valid** (earth core, no unknown ids). Geometry: **bilateral symmetry → stable**.
The engine also reports `aim: up` and `spin: true` — both are **artifacts** of how it reads the
Pull signs' facing (Pull is positioned to draw stone *inward*, not to aim an upward beam). No
blocking/warning issues.

## Composition
- **Substance (sigil):** **Earth** (`earth`) — manipulates stone/sand/soil/wood but **cannot
  create** them ([sigils.md:53](../sigils.md)). The spell therefore needs a **real wall present**.
- **Form (signs):**
  - **Pull ×2** (directional) — point inward; draw the wall's stone toward the seal to curve it
    ([signs.md:65](../signs.md)).
  - **Bend ×2** (non-directional, special) — alter/bend the physical object; the "extra legs" of
    the central glyph. Canon flags Bend as *possibly paired with Weave to form a compound sign*
    making walls pliable ([signs.md:279](../signs.md)).
  - **Weave ×1** (semi-directional, transmute) — turns rigid stone flexible; `rotation:180` so its
    open side faces the core (orientation only — **not** inverted, which would reverse the effect).
  - **Bind ×1** (semi-directional, special) — glues the spell to the wall surface it touches; the
    dominant canon theory ([signs.md:303](../signs.md)). Bind appears *only* in Wall Bend.
  - **unknown_02 ×1** — a line/bar mark. **Unidentified** (likely structural, not a keystone).
  - **unknown_05 ×1** — the large bottom arc (a shape placeholder; rotated 180 to orient it).
    **Unidentified** — its Sand-Cage "closing-hoop" theory does **not** necessarily apply here.
- **Ring:** closed.
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
*Reasoned from [docs/CORE.md](../CORE.md) + the lexicon, using the engine facts.* An earth spell
that **bends an existing wall**: Weave + Bend make the rigid stone temporarily **pliable**, the
two **Pull** signs draw the stone to **curve** it toward the seal, and **Bind** anchors the spell
to the wall's surface so it grips and acts on that wall. The wall is reshaped in place — not built
(earth can't create) and not shattered (that's Wall Breaker).

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Earth | sigil (substance) | Supplies the stone to manipulate; needs a real wall (can't conjure one). |
| Pull ×2 | sign · direction | Draw the wall's stone inward to curve it; remove them and nothing bends. |
| Weave ×1 | sign · transmute | Makes the rigid wall flexible enough to bend. |
| Bend ×2 | sign · special | Alters/bends the physical object (the Weave+Bend pliability pairing). |
| Bind ×1 | sign · special | Anchors the spell to the wall's surface so it acts on that wall. |
| unknown_02 / unknown_05 | unknown | Line + bottom arc; shape placeholders, effect unconfirmed. |

## Element behavior & canon grounding
**Earth is manipulate-only** ([sigils.md:53](../sigils.md)), so Wall Bend is fundamentally a
*reshaper of existing stone* — it cannot make a wall, only bend one already there. The pliability
comes from the **Weave + Bend** pairing that canon explicitly theorizes for this spell
([signs.md:279](../signs.md)): Weave transmutes rigid → flexible, Bend alters the physical object.
**Pull** ([signs.md:65](../signs.md)) then curves the softened stone toward the seal, and **Bind**
([signs.md:303](../signs.md)) glues the spell to the wall so it stays attached while it works.

- **Closest kin — Boulder Stretch Rope** (earth + a single Weave → stone into a flexible *rope*):
  same "make rigid stone flexible" Weave core, but Wall Bend keeps the wall a wall (Bend = pliable,
  not full ribbon) and adds Pull (curve) + Bind (anchor).
- **Foil — Wall Breaker** (earth + Crush → pulverize): reshape-intact vs. destroy.

**Bottom line:** a coherent earth "reshape a real wall" spell — make it pliable (Weave+Bend),
curve it (Pull), anchor the spell to it (Bind). The substance and the four named signs match canon
Wall Bend's documented part list; only the two `unknown_*` marks and exact placements are open.

## How to draw it
1. **Earth** sigil at the center.
2. Two **Pull** arrowheads at the upper sides, pointing **inward** (down toward center).
3. The central **Weave** below the sigil, open side toward the core (orient by rotation, not
   inversion), with a **Bend** "leg" on each side (the Weave+Bend compound).
4. **Bind** at the top.
5. The line / bottom-arc marks to match the drawn seal. Keep bilateral symmetry for stability.

## Usage ideas
- Open a doorway/passage by curving a stone wall aside, then (optionally) set it back.
- Reshape a rock face or barrier without shattering it (quieter, reversible vs. Wall Breaker).
- Mold standing stone into a curve, ramp, or bowl in place.

## Similar spells
- **Boulder Stretch Rope** — Weave on earth → flexible rope (free, not in-place).
- **Wall Breaker** — earth + Crush → destroy a wall (the destructive counterpart).
- **Sand Bridge / Serpent's Bed of Sand** — other earth-manipulation structures.

## Notes & limitations
- **Community reconstruction, not canon-confirmed.** The core five (Earth, Pull, Bend, Weave,
  Bind) match the canon docs; `unknown_02`/`unknown_05` are placeholders and may be structural
  strokes rather than distinct signs.
- **Weave orientation vs. inversion:** the open side is aimed inward via `rotation:180`; it is
  **not** `inverted` (inverting Weave would imply the reverse, un-weave/re-rigidify, effect).
- `aim: up` / `spin: true` from the engine are artifacts of Pull's facing computation — the real
  action is Pull drawing stone inward.
- To settle the unknowns, read the canon Wall Bend page from the local `manga/` mirror.

## Reproduction
- **Image:** [assets/spells/Wall_Bend.svg](../../assets/spells/Wall_Bend.svg) (engine render; a PNG from the app can replace it)
- **JSON:** [assets/spells/Wall_Bend.json](../../assets/spells/Wall_Bend.json)

```json
{
  "format": "wha-spell@2",
  "name": "Wall Bend (reconstruction)",
  "circles": [
    {
      "id": "k4", "name": "Circle 1",
      "center": { "x": 0, "y": 0 }, "radius": 98,
      "ring": { "closed": true },
      "core": { "id": "c27", "type": "earth", "x": 0, "y": 0, "rotation": 0, "scale": 1 },
      "components": [
        { "id": "c28", "type": "unknown_02", "role": "sign", "x": 0, "y": 15.52, "rotation": 85, "scale": 1 },
        { "id": "c29", "type": "pull", "role": "sign", "x": -37.55, "y": -23.14, "rotation": 0, "scale": 1 },
        { "id": "c30", "type": "pull", "role": "sign", "x": 43.52, "y": -24.21, "rotation": 0, "scale": 1 },
        { "id": "c31", "type": "weave", "role": "sign", "x": -0.8, "y": 34.25, "rotation": 180, "scale": 1.6, "inverted": false },
        { "id": "c32", "type": "bend", "role": "sign", "x": -34.69, "y": 14.31, "rotation": 187, "scale": 1 },
        { "id": "c33", "type": "bend", "role": "sign", "x": 31.93, "y": 15.39, "rotation": 0, "scale": 1, "mirrored": true },
        { "id": "c34", "type": "bind", "role": "sign", "x": 0.8, "y": -38.26, "rotation": 180, "scale": 1 },
        { "id": "c35", "type": "unknown_05", "role": "sign", "x": -0.63, "y": 64.35, "rotation": 180, "scale": 3.25 }
      ],
      "dyes": [], "inkColor": null
    }
  ],
  "relations": []
}
```
