---
name: Watershot Seal
type: water
origin: wiki
forbidden: false
status: valid
core: water
signs: column ×8 (one oversized)
dyes: none
symmetry: radial (deliberately unbalanced)
source: Witch Hat Atelier ch. 2 (Coco's first spell at Qifrey's Atelier; unofficial spell name). The misfire that soaked Agott.
image: none yet (requested from user)
json: assets/spells/Watershot_Seal.json
---

# Watershot Seal

> A water sigil ringed by Column signs that projects a jet of water out of the seal — straight up when balanced, off to the side when one column is drawn longer.

## Overview
The Watershot Seal (unofficial name) is the first spell Coco learns at Qifrey's Atelier: a central
water sigil surrounded by Column signs. With all columns of equal length it shoots water straight up;
if one column is drawn longer, the jet leans toward that column. This documented build is the
**unbalanced** version — the south column is enlarged on purpose (scale 2.35), reproducing Coco's
misfire that "shot off to the side rather than straight up" and soaked Agott. Coco later applied the
same principle deliberately to build the Skysoaring Seal.

## Validity
**Valid.** A water sigil occupies the center (the one blocking rule — a core must be present — is
satisfied), ringed by eight Column signs. The engine reports it **stable** (radial symmetry),
ordinary power (1.17), no blocking or warning issues — only info notes (a balance/aim read; see the
engine note below). The open ring is the app's activation visual only.

## Composition
- **Substance (sigils):** Water — *"works to manipulate, collect, and create water… creating water is
  more energetically costly than collecting it"* ([sigils.md:41](../sigils.md#L41)). For a short jet it
  runs in the costlier **create** mode, so it is self-sufficient — no reservoir needed.
- **Form (signs):**
  - **Column ×8** (directional, invertible) — *"causes a spell to manifest in a column or beam above the
    seal. If the signs aren't balanced, the spell will manifest in the direction with the most or the
    largest signs. The longer line typically faces inwards, as seen in the watershot seal"*
    ([signs.md:34](../signs.md#L34)). All eight face **inward** here, channeling the water into one tight
    jet; **one (south) is scaled 2.35×** to deliberately bias the output.
- **Ring:** open (the app's activation visual; not reported in the effect).
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
Engine summary: **"The water is projected as a tight column or beam, above the seal."**

In plain terms: a focused jet of water shoots out of the seal. Because one column is enlarged, the jet
does not go perfectly straight — it **leans toward the oversized south column**, exactly the
side-misfire Coco produced.

> **Engine note (overridden by canon):** the engine's geometry *is* scale-weighted, but the lean from
> the one oversized column comes out at directional-bias **magnitude 0.180, angle 178°** — pointing
> almost due south, straight at the big column (c5). That sits just **under** the engine's 0.25 "biased"
> threshold, so it rounds the read to `balanced` / `aim = above the seal`. Override that: per
> [signs.md:34](../signs.md#L34) an unbalanced ring manifests toward the **largest** sign, and canon is
> explicit ("This keystone mark is longer than the rest. That's what caused the water to shoot out from
> this side"). With all columns equal, the measured bias drops to **0.013** — genuinely straight up.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water | core / substance | Conjures the water on demand (create-mode); without it there is no substance — a different element would give a beam of *that* |
| Column ×8 (inward) | directional / form | Confine and project the water into one tight jet "above the seal"; invert them and the spell "emit[s] out in all directions, similar to dispersion" ([signs.md:34](../signs.md#L34)) |
| The **oversized south column** | the imbalance | Steers the jet toward itself (measured 0.18 @ 178°); equalize it and the jet goes straight up (0.013) — this single sign *is* the Watershot lesson |

## Element behavior & canon grounding
Water is the one tetrad element that can **create** its own material, not merely manipulate or collect it
([sigils.md:41](../sigils.md#L41)). That is why the Watershot is the standard *first* spell: a column-shaped
water jet needs no water source — it conjures its own stream — and a misfire is therefore messy but
harmless (a faceful of water, not a hazard). The cost is that a one-shot jet runs in water's expensive
**create** mode rather than its cheap **collect** mode, consistent with a brief discharge rather than a
sustained fountain.

The pairing is the cleanest possible element/sign match because water is a **fluid the sigil produces on
demand**: Column projects the manifested magic "in a column or beam above the seal" ([signs.md:34](../signs.md#L34)),
and a fluid needs no binding or compaction to flow up that channel — it simply pours along the direction the
columns confine it. There is nothing for the form to fight, unlike a rigid earth substance that would have to
be compacted to behave like a beam.

The whole spell turns on **balance**. Column is directional, and directional signs steer "by changing the
angle, or, in some cases, **size**" ([signs.md:11](../signs.md#L11), [signs.md:34](../signs.md#L34)). A perfectly
even ring of equal columns is radially symmetric, so the lateral pushes cancel and the jet exits straight up.
Enlarge one column and you break that symmetry: the magic "manifest[s] in the direction with the most or the
largest signs." This build enlarges the **south** column, so the resultant points south — the jet leans that
way. This is precisely Agott's diagnosis of Coco's seal, and it is the same directional-by-size principle Coco
later exploits **on purpose** in the **Skysoaring Seal** to aim her own launch.

**Closest canon analogues.**
- **Skysoaring Seal** — the mastered, deliberate version of this exact mechanic: a lengthened column aims the
  effect intentionally (the direction-by-size example, [signs.md:11](../signs.md#L11)). Same grammar, controlled
  instead of accidental.
- **Wall Breaker Seal** — the other canonical "longer line faces inward" Column spell ([signs.md:34](../signs.md#L34)):
  inward columns projecting force, here water instead of a battering effect.
- **Rising Wave** (the engine's nearest catalog match before this entry, 0.717) — also water + directional signs
  driving the output off-axis, but via a half-ring of Region for a deliberate diagonal launch, not a column
  imbalance.

**Bottom line:** The Watershot is a self-sufficient water jet whose direction is governed entirely by the balance
of its Column ring. Balanced, it fires straight up; with the south column enlarged (as drawn here) it leans south —
the measured 0.18 bias the engine narrowly files as "balanced," but which canon names outright as the cause of
Coco's side-misfire. It is the textbook demonstration that for directional signs, **size sets aim** — the lesson
that becomes the Skysoaring Seal.

## How to draw it
1. **Water sigil** at the **center** of the seal.
2. **Eight Column signs** evenly spaced around the ring (≈ every 45°), each with its **longer line facing
   inward** (toward the center) — the canon default for Column.
3. For the **balanced** Watershot (straight-up jet): keep all eight the **same size**. Neater + bigger ⇒ steadier
   and stronger.
4. For this **unbalanced** build (aimed jet): draw **one column noticeably longer** (here the south one, ≈ 2.35×).
   The jet will lean toward that longer column. Move the long column to choose the direction; lengthen it more to
   skew harder.
5. Do **not** invert the columns — inverted Column sprays in all directions like dispersion ([signs.md:34](../signs.md#L34)).

## Usage ideas
- **Training spell / teaching imbalance (canon):** demonstrate how an uneven column skews the output — Coco's
  very first lesson.
- **Aimed water cannon:** treat the imbalance as a feature — size the long column toward a target to hose it
  down (douse a fire, knock something over, soak a page).
- **Stepping stone to the Skysoaring Seal:** scale and orient the long column to launch the caster, the mastered
  application Coco built from this.
- **Quick rinse / fill (balanced version):** a straight, controllable jet for filling a basin or washing.

## Similar spells
- **Skysoaring Seal** — the same direction-by-size mechanic used deliberately to aim a launch.
- **Wall Breaker Seal** — inward Column projecting force rather than a water jet.
- **Rising Wave / Rising Platform of Water** — other water spells that push the output off the vertical (via
  Region asymmetry / Levitation), for movement rather than a jet.

## Notes & limitations
- **Engine balance blind spot:** the lean from a single oversized column (0.18) falls just under the engine's
  0.25 bias threshold, so it reports `balanced` / straight-up. The real, canon-confirmed behavior is an off-axis
  jet toward the largest column — override the engine here.
- The enlarged column is **south** in this export (y ≈ +56, which renders at the bottom of the canvas, since the
  app's y grows downward), so the jet leans south/down. Move the oversized column to aim elsewhere.
- Unofficial spell name; the recipe (water + ring of inward Columns, one enlarged) is faithful to the manga, but
  the exact geometry is a reconstruction.
- Not forbidden: ordinary elemental projection, nothing body-bound or reality-warping.

## Reproduction
- **Image:** none yet (requested from user).
- **JSON:** importable composition below (`wha-spell@1`); the oversized south column is `c5` (scale 2.35).

```json
{
  "format": "wha-spell@1",
  "version": 1,
  "composition": {
    "name": "Watershot Seal",
    "ring": { "closed": false },
    "core": { "id": "c1", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
    "components": [
      { "id": "c2", "type": "column", "role": "sign", "x": 0, "y": -65, "rotation": 180, "scale": 1, "inverted": false },
      { "id": "c3", "type": "column", "role": "sign", "x": 47.86, "y": -46.55, "rotation": 225.8, "scale": 1, "inverted": false },
      { "id": "c4", "type": "column", "role": "sign", "x": 51.38, "y": 43.74, "rotation": 310.41, "scale": 1, "inverted": false },
      { "id": "c5", "type": "column", "role": "sign", "x": -0.70, "y": 55.87, "rotation": 0, "scale": 2.35, "inverted": false },
      { "id": "c6", "type": "column", "role": "sign", "x": -43.65, "y": 50.76, "rotation": 40.69, "scale": 1, "inverted": false },
      { "id": "c7", "type": "column", "role": "sign", "x": -49.97, "y": -43.04, "rotation": 130.74, "scale": 1, "inverted": false },
      { "id": "c8", "type": "column", "role": "sign", "x": -68.13, "y": 1.02, "rotation": 89.2, "scale": 1, "inverted": false },
      { "id": "c9", "type": "column", "role": "sign", "x": 64.02, "y": 1.21, "rotation": 271.1, "scale": 1, "inverted": false }
    ],
    "linkCount": 0,
    "dyes": []
  }
}
```
