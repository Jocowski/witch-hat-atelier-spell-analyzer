---
name: Rising Wave
type: water
origin: canon
forbidden: false
status: valid
core: water
signs: column ×8, direction (Region) ×4
dyes: none
symmetry: bilateral
source: Qifrey vs. Sasaran, Serpentback Cave arc (unofficial spell name; wiki/manga)
image: assets/spells/Rising_Wave.png
json: none yet
---

# Rising Wave

> A water-propulsion spell: a surge of water that travels up diagonally, launching the caster into the air.

## Overview
Rising Wave (unofficial name) is a water-type spell with a central water sigil ringed by Column
signs, with Region signs filling **one half** of the ring between the columns. The full column ring
drives an upward surge of water; the one-sided Region placement angles that surge **diagonally**, so
the caster can ride it up into the air. Qifrey uses it during his battle with Sasaran in the
Serpentback Cave.

## Validity
**Valid.** Water core, 8 Column + 4 Region signs, none inverted. The engine reports it stable
(bilateral symmetry), ordinary power, no blocking or warning issues — only info notes.

## Composition
- **Substance (sigils):** Water — manipulates, collects, and **creates** water ([sigils.md:41](../sigils.md#L41)).
- **Form (signs):**
  - **Column ×8** (directional) — a full, upright ring; makes the magic surge as a column/beam above the seal ([signs.md:34](../signs.md#L34)).
  - **Region ×4** (directional, id `direction`) — interspersed with the columns on **one half** of the ring; each faces inward, but their semicircle placement biases *where* the magic manifests ([signs.md:96](../signs.md#L96)), producing the diagonal launch.
- **Ring:** closed (firing).
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
Canon (authoritative): **a surge of water that travels up diagonally, strong enough to propel the
caster up into the air.** The water sigil supplies the substance, the column ring drives it upward,
and the half-ring of Region signs angles the surge off-vertical into a rideable diagonal jet.

> **Engine note (resolved):** the engine now reads *"the water is projected as a tight column or
> beam, **surging up** (the region signs ring only one side of the seal),"* with
> `aim = surging up (uneven region ring)`. Earlier it wrongly said "contained within the ring,"
> because `classifyRegion` inspected only Region *orientation* (all four face inward ⇒ "contained")
> and ignored that the Regions cover only a **half-ring**. It now also reads their **positional
> coverage** (`computeRegionCoverage`): a one-sided inward cluster biases the surge toward that side.
> Because these Regions sit symmetrically about the vertical, the bias is straight **up** (the
> propulsion axis); tilting the cluster off-vertical yields the canonical **diagonal** surge. The
> rest of the engine output (valid, stable, water→column form) was always correct.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water | core / substance | Creates the water (burst mode for volume); without it there is no substance |
| Column ×8 | directional / form | Drives the water up as a strong column/surge; without them water wells up formlessly |
| Region ×4 (one half) | directional / direction | Bias the surge **diagonally** → directional propulsion; symmetric placement would give a vertical fountain, none at all would give an undirected upwelling |

The defining design choice is the **half-ring of Region signs**: it converts a vertical water column
into a *rideable diagonal launch*.

## Element behavior & canon grounding
Water is the one tetrad element that can **create** its own material, not merely manipulate or
collect it ([sigils.md:41](../sigils.md#L41)) — and "creating water is more energetically costly than
collecting it." A propulsion spell needs a large volume of water *now*, so Rising Wave leans on the
costlier **create/burst** mode rather than the cheap sustained **collect** mode. The payoff is that
the spell is **self-sufficient**: Qifrey can launch off it on dry ground with no reservoir, where an
Earth equivalent (which cannot create its material) would need real water or loose ground to push
against.

Physically the pairing is clean. Water is a fluid, so Column's "column/beam above the seal"
([signs.md:34](../signs.md#L34)) reads as a fast jet a body can ride; canting it with the Region bias
is just an angled water-thrust — like leaping off a sideways geyser. Region governs *where* magic
manifests in relation to the seal ([signs.md:96](../signs.md#L96)); the canon-documented configs are
"all one side ⇒ fires that way / all inward ⇒ contained / all outward ⇒ outside the ring / opposed ⇒
on the ring." Rising Wave uses a **fifth, in-between case** — inward-facing Regions covering only a
half-ring — which the docs don't enumerate explicitly but which behaves as a *partial* directional
bias: emission concentrated toward, and angled by, the populated half.

**Closest canon analogue: Rising Platform of Water.** Both are water + a Column ring used to get
airborne. The Platform adds **Levitation**, which for water/fire/light spells only *lifts* — it
raises the object the seal is drawn on **straight up** gently ([signs.md:55](../signs.md#L55)). Rising
Wave instead adds **Region** asymmetry to **fling** the caster **diagonally** with raw water thrust.
Same goal (get into the air), opposite mechanism: a gentle vertical elevator vs. a diagonal launch
ramp.

**Bottom line:** a self-sufficient water-propulsion spell — a full column ring drives a surge and a
half-ring of Region signs angles it diagonally so the caster rockets up and away. It is the
aggressive, mobile cousin of the Rising Platform: where the Platform floats you up, Rising Wave
launches you.

## How to draw it
1. **Water sigil** at the center.
2. **8 Column signs** in an even ring around it (every 45°), upright — longer line toward the center.
   Keep them evenly spaced so the underlying surge is strong and clean.
3. **4 Region signs** placed *between* the columns but only across **one half** of the ring (e.g. the
   top semicircle), each facing inward. This half-only placement is what angles the surge — keep the
   other half columns-only.
4. Don't invert anything. Bigger, neater seals ⇒ more powerful, steadier launch. The diagonal points
   away from the Region-populated half.

## Usage ideas
- **Combat mobility (canon):** Qifrey launches off it diagonally to reposition against Sasaran in the Serpentback Cave.
- **Vertical / gap traversal:** a one-shot water jump up cliffs or across chasms in caves.
- **Knockback:** aimed at an opponent, the diagonal surge shoves rather than drowns.
- **Dramatic entrance/exit** off any dry surface, since the water is created on the spot.

## Similar spells
- **Rising Platform of Water** — water + Column ring for vertical travel, but lifts *straight up* via Levitation rather than launching diagonally.
- **Watershot Seal** — a directed water jet, but aimed as a weapon rather than as self-propulsion.
- **Water Orb** — pools water into a floating sphere instead of driving it upward.

## Notes & limitations
- The surge direction now comes from the **half-ring Region placement**, read by
  `computeRegionCoverage` + the `biased` branch of `classifyRegion`. With the Regions symmetric about
  the vertical, the engine reads the surge as straight **up**; an off-vertical cluster produces the
  canonical **diagonal**. (Earlier the engine mislabeled this "contained" — see the engine note.)
- Region behavior for a *partial* ring is a principled extrapolation from the documented full-ring
  configs ([signs.md:96](../signs.md#L96)): magic emits *from where the regions are*. Canon shows the
  *result* (a diagonal propulsion surge) but not a formal rule for half-coverage, so treat the exact
  angle as a model output rather than quoted lore.
- The classification is element-agnostic; canon only demonstrates this surge for **water**.
- Not forbidden: no body magic, reality-warping, or mass destruction.

## Reproduction
- **Image:** assets/spells/Rising_Wave.png (from the docs); app JSON export requested from user.
- **JSON:** importable composition below (`wha-spell@1`).

```json
{
  "format": "wha-spell@1",
  "version": 1,
  "composition": {
    "name": "Rising Wave",
    "ring": { "closed": true },
    "core": { "id": "c1", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
    "components": [
      { "id": "c2", "type": "column", "role": "sign", "x": 0, "y": -65, "rotation": 180, "scale": 1, "inverted": false },
      { "id": "c3", "type": "column", "role": "sign", "x": 48.57, "y": -45.14, "rotation": 227.09, "scale": 1, "inverted": false },
      { "id": "c4", "type": "column", "role": "sign", "x": 42.24, "y": 50.76, "rotation": 320.23, "scale": 1, "inverted": false },
      { "id": "c5", "type": "column", "role": "sign", "x": 0.70, "y": 66.40, "rotation": 0, "scale": 1, "inverted": false },
      { "id": "c6", "type": "column", "role": "sign", "x": -45.05, "y": 50.06, "rotation": 41.99, "scale": 1, "inverted": false },
      { "id": "c7", "type": "column", "role": "sign", "x": -69.64, "y": 1.91, "rotation": 88.42, "scale": 1, "inverted": false },
      { "id": "c8", "type": "column", "role": "sign", "x": -51.97, "y": -43.23, "rotation": 129.75, "scale": 1, "inverted": false },
      { "id": "c9", "type": "column", "role": "sign", "x": 62.61, "y": 0.51, "rotation": 270.47, "scale": 1, "inverted": false },
      { "id": "c10", "type": "direction", "role": "sign", "x": 61.21, "y": -28.60, "rotation": 245.16, "scale": 1, "inverted": false },
      { "id": "c11", "type": "direction", "role": "sign", "x": 27.39, "y": -60.02, "rotation": 203.69, "scale": 1, "inverted": false },
      { "id": "c12", "type": "direction", "role": "sign", "x": -28.20, "y": -60.91, "rotation": 155.16, "scale": 1, "inverted": false },
      { "id": "c13", "type": "direction", "role": "sign", "x": -64.72, "y": -22.67, "rotation": 109.30, "scale": 1, "inverted": false }
    ],
    "linkCount": 0,
    "dyes": []
  }
}
```
