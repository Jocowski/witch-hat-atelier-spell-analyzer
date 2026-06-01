---
name: Water Bolt
type: water
origin: canon
forbidden: false
status: valid
core: water
signs: bolt ×5, direction (Region) ×4
dyes: none
symmetry: bilateral
source: Qifrey vs. the Ancients of Romonon, Serpentback Cave (unofficial spell name; wiki/manga). Drawn with the Water Pen spell.
image: none yet
json: none yet
---

# Water Bolt

> A water-type seal, drawn flat on the ground, that fires a fast horizontal volley of water arrows straight ahead.

## Overview
Water Bolt (unofficial name) is a water-type spell built from a water sigil near the bottom, a
horizontal row of Bolt signs running through the middle (perpendicular to the sigil), and a row of
Region signs running parallel to the Bolt row. The Bolt signs fragment the water into arrow-like
projectiles and the Region signs aim them; the seal shoots **bolts of water straight ahead**. It is
more effective the bigger it is drawn, so it is laid out on the ground for room. Qifrey used it during
his battle with the Ancients of Romonon in the Serpentback Cave, drawing the seal with the Water Pen
spell.

## Validity
**Valid.** Water core with a defined form (Bolt) and a clear aim (Region); none inverted. The engine
reports it **stable** (bilateral symmetry), **balanced**, ordinary power, no blocking or warning
issues — only info notes (aim + a spin note that is an artifact; see below).

## Composition
- **Substance (sigils):** Water — manipulates, collects, and **creates** water ([sigils.md:41](../sigils.md#L41)).
- **Form (signs):**
  - **Bolt ×5** (non-directional) — a horizontal row through the middle; *"causes the magic of its spell to manifest in the form of bolt-like projectiles. When paired with a region sign… the projectiles will be shot with dangerous speed"* ([signs.md:255](../signs.md#L255)). Being non-directional, Bolt has no front, so its rotation/position don't steer ([signs.md:22](../signs.md#L22)); the row simply fragments the water into many darts.
  - **Region ×4** (directional, id `direction`) — a row parallel to the Bolt row; *"if the region signs within a seal all point to the same side of the spell, the magic will shoot in that direction"* ([signs.md:96](../signs.md#L96)). They collimate and aim the volley.
- **Ring:** closed (firing).
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
Engine summary: **"The water fragments into fast-flying bolts, fired [along the seal's aim axis]."**
Canon (authoritative): the seal **shoots bolts of water straight ahead** — a fast, horizontal volley
of water arrows.

> **Engine note (resolved by canon):** the engine labels the aim axis `down` because it reads the
> Region signs' orientation (rotated to face the bottom/water edge) and projects that onto an in-plane
> 2D compass. That label is an **axis within the seal plane, not gravity** — the seal is drawn **flat
> on the ground** ([per the wiki: "needing to be drawn on the ground"]), so the real firing is
> **horizontal, "straight ahead"** along the ground, exiting the bottom (water-sigil) edge. This is the
> documented Region clustered-placement blind spot: the engine reads *where/which way* Region signs sit
> only coarsely, so treat its directional word as the firing **axis**, and read the real-world
> orientation (flat → horizontal) yourself. Everything else (valid, stable, water→Bolt→aimed form) is
> correct.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water | core / substance | Creates the ammunition on demand; without it there is no substance |
| Bolt ×5 | non-directional / form | Splits the water into discrete fast arrows; without them the water would pour or jet (≈ a Watershot stream) instead of firing as darts |
| Region ×4 | directional / direction | Collimate and aim the volley straight ahead; without them the bolts still form but spray undirected — the *"dangerous speed"* requires the Bolt+Region pairing ([signs.md:255](../signs.md#L255)) |

## Element behavior & canon grounding
Water is the one tetrad element that can **create** its own material, not merely manipulate or collect
it ([sigils.md:41](../sigils.md#L41)). That single property is what makes Water Bolt a viable weapon:
its ammunition is conjured from nothing, so it needs **no reservoir or water source** — unlike an earth
projectile (earth *"does not allow for the creation of these solid materials"* [sigils.md:53](../sigils.md#L53))
or a wind one (wind allows *"movement and manipulation, but not the creation, of air"* [sigils.md:65](../sigils.md#L65)),
which would need a real supply to fire. The cost is that this runs in water's expensive **create** mode
rather than its cheap **collect** mode ("creating water is more energetically costly than collecting
it," [sigils.md:41](../sigils.md#L41)) — consistent with it being a high-energy combat burst, drawn
large, rather than a sustained utility seal.

The Bolt pairing is physically clean because water is a **fluid** the sigil produces on demand: Bolt
shatters the manifested magic into projectiles ([signs.md:255](../signs.md#L255)), and a fluid divides
into many coherent darts without any binding or compaction sign. (Contrast a rigid earth substance,
which would struggle to cohere into throwable slugs.) This is exactly why Bolt was first documented *on*
a water spell — it is the natural substrate for fragmentation. Region then does its documented job of
governing *where* the magic manifests relative to the seal ([signs.md:96](../signs.md#L96)); a row of
Region signs all aimed the same way puts the spell into the "all point one side ⇒ shoots that way" case,
collimating the dart-spray into a straight line.

**Closest canon analogues.**
- **Watershot Seal** — same water substance, but a *continuous jet*; Water Bolt swaps the unbroken
  stream for **discrete arrows** via Bolt. A jet is a sustained push; bolts are repeated impacts.
- **Flame Shot Seal** — the structural twin: an element sigil at one end, a directed output, and a row
  of Region signs that **confine the magic ahead so it travels farther** ([learnings: Flame Shot]). Water
  Bolt is the water/fragmented-projectile version of that forward-confined shot.
- **Rising Wave** (the engine's nearest match, 0.644) — also water + Region, but there the Region row is
  a *half-ring* used for diagonal self-propulsion, not a forward-aimed weapon. Same parts, opposite
  purpose.

**Bottom line:** Water Bolt is a self-sufficient water weapon: water's create-mode makes it the rare
element that needs no ammunition source, Bolt fragments that fluid into a fast arrow-volley, and a
parallel row of Region signs collimates the salvo to fire **straight ahead**. Drawn flat on the ground
and drawn **big**, it is essentially a water-dart machine-gun firing horizontally downrange — the
fragmented-projectile cousin of the Watershot jet and the water analogue of the Flame Shot.

## How to draw it
1. **Water sigil** near the **bottom** of the seal (it sits near the muzzle/exit edge).
2. A **horizontal row of ~5 Bolt signs** through the **middle**, perpendicular to the water sigil.
   Rotation/spacing of Bolt signs doesn't matter (non-directional) — more Bolt signs ⇒ a denser volley.
3. A **parallel row of ~4 Region signs** above the Bolt row, all aimed the same way to collimate the
   shot along the firing axis. Keep the layout mirror-symmetric about the vertical for a clean,
   straight volley.
4. Don't invert anything. **Draw it big, on the ground** — the wiki notes it needs room to be
   effective; bigger/neater ⇒ more powerful and steadier.

## Usage ideas
- **Ranged suppression (canon):** Qifrey's use against the Ancients of Romonon — a horizontal hail of
  fast water arrows downrange.
- **Crowd control / knockback:** a wide, low volley to drive back a line of enemies without lethal force.
- **Pressure cutting / cleaning at distance:** the high-speed darts can bore into soft material or wash
  a surface from across a room.
- **Firefighting / dousing burst:** water-on-demand makes it usable where no water source exists.

## Similar spells
- **Watershot Seal** — directed water as an unbroken jet rather than discrete arrows.
- **Flame Shot Seal** — the same forward-confined Region layout, with fire as a column instead of water arrows.
- **Rising Wave** — water + Region for diagonal self-propulsion, not a weapon.
- **Rainflinger / Water Pen** — other water spells in Qifrey's repertoire (Water Pen was used to *draw* this seal).

## Notes & limitations
- The engine's directional label (`down`) is an **in-plane axis**, not gravity: the seal is drawn flat,
  so firing is horizontal "straight ahead." Do not read it as a downward/vertical shot. (Documented
  Region clustered-placement blind spot.)
- The "some signs are tilted → spin" info note is an **artifact**: the Region signs are canted off their
  radial axis only because they all aim one common direction (collimation), not tangentially — the volley
  flies straight, it does not spin.
- Unofficial spell name; the layout and "straight ahead, drawn big on the ground" behavior are from the
  wiki/manga, so treat the exact geometry as a faithful reconstruction rather than a quoted schematic.
- Not forbidden: no body magic, reality-warping, or mass destruction.

## Reproduction
- **Image:** requested from user (no canon screenshot saved yet).
- **JSON:** importable composition below (`wha-spell@1`), from the app export.

```json
{
  "format": "wha-spell@1",
  "version": 1,
  "composition": {
    "name": "Water Bolt",
    "ring": { "closed": true },
    "core": { "id": "c1", "type": "water", "x": -0.70, "y": 55.48, "rotation": 0, "scale": 1, "inverted": false },
    "components": [
      { "id": "c2", "type": "bolt", "role": "sign", "x": -1.40, "y": -2.49, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "c3", "type": "bolt", "role": "sign", "x": 35.92, "y": -0.19, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "c4", "type": "bolt", "role": "sign", "x": 66.83, "y": -0.51, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "c5", "type": "bolt", "role": "sign", "x": -36.52, "y": -1.02, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "c6", "type": "bolt", "role": "sign", "x": -66.12, "y": 0.19, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "c8", "type": "direction", "role": "sign", "x": -56.29, "y": -32.50, "rotation": 180, "scale": 1, "inverted": false },
      { "id": "c9", "type": "direction", "role": "sign", "x": -21.77, "y": -52.36, "rotation": 180, "scale": 1, "inverted": false },
      { "id": "c10", "type": "direction", "role": "sign", "x": 56.29, "y": -32.50, "rotation": 180, "scale": 1, "inverted": false },
      { "id": "c11", "type": "direction", "role": "sign", "x": 23.28, "y": -51.08, "rotation": 180, "scale": 1, "inverted": false }
    ],
    "linkCount": 0,
    "dyes": []
  }
}
```
