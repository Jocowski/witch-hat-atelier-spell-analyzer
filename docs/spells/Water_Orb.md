---
name: Water Orb
type: water
origin: wiki
forbidden: false
status: valid
core: water (inverted)
signs: orb ×4, column ×2
dyes: none
symmetry: radial
source: Witch Hat Atelier — Silver Eve (Qifrey speaking with Agott); listed under "Spells Using Orb"/"Spells Using Water" in the wiki. Unofficial name.
image: assets/images/spells/Water_Orb.png
json: assets/spells/Water_Orb.json
---

# Water Orb

> Gathers water into a free-floating **spherical container** — a held ball of water suspended in mid-air with no physical vessel.

## Overview

A single **water** sigil at the center is enclosed by **four orb signs** (one per corner)
that collect the water into a spherical space, and braced by **two opposed column signs**
(left/right) whose directional pushes cancel. The result is a self-contained sphere of water
held above the glyph. Qifrey casts it casually while talking with Agott during Silver Eve.
The "invisible container" is simply the *absence of a physical vessel* (no flask/bowl) — not
an invisibility-dye effect; the `dyes` list is empty. *Water Orb* is an unofficial name.

The central water sigil is drawn **inverted**, but inversion has **no known effect** on a
water sigil (the engine confirms an identical deduction inverted or not).

## Validity

Engine verdict: **valid · active** (ring closed). Issues raised are informational only:
- **Stable** — radial symmetry.
- **Spin** — the orb signs are tilted (±30°), so the held sphere rotates slightly (more tilt = more spin, less reach).

(As originally exported, the ring was *open* ⇒ prepared/INACTIVE; closing the ring activates the container. The recipe below is the active, working form.)

## Composition

- **Substance (sigils):** **Water** (family water, element water) — the entire payload; manipulates/collects/creates water. Drawn inverted (no effect change).
- **Form (signs):**
  - **Orb ×4** — *non-directional*, **not invertible** (no front to flip). Tags *contain / sphere*; "creates a spherical space above the glyph in which controlled material collects, filling bottom-to-top." The four together define the held sphere. Tilted ±30° ⇒ slight spin.
  - **Column ×2** — *directional*, invertible (beam/projection). Placed **dead-opposite** (left 90° / right 270°), so their directional biases cancel (engine balance = *balanced/centered*); instead of jetting, the pair **braces the sphere along the horizontal axis**.
- **Ring:** closed / active.
- **Ink / dyes:** plain conjuring ink (no dyes).

## Deduced effect

**Engine summary:** *"The water gathers into a sphere held above the glyph."*

In plain terms: the orbs win the primary "form" clause (a contained sphere), the water fills
it, and the opposed columns steady that sphere rather than shooting it anywhere. You get a
ball of water floating above the seal, gently spinning, with no cup or bowl holding it.

### How each part shapes the spell

| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water sigil | substance | The payload. Without it there is no water to hold. |
| Orb ×4 | form (sphere/contain) | The container itself. Remove them and the water is unshaped — the columns would jet it out instead of holding it. |
| Column ×2 (opposed) | form (beam, directional) | Brace the sphere's horizontal axis; their pushes cancel. Remove them and the sphere survives but drifts more freely / less braced. |
| Orb tilt (±30°) | spin | Makes the sphere rotate slightly. Untilt (→0°) for a perfectly still held sphere. |
| Ring closed | activation | Opening it leaves the spell prepared but inactive — no container forms. |
| Core inversion | (none known) | Cosmetic on a water sigil; the deduced effect is unchanged. |

## Element behavior & canon grounding

Water is the element the Orb sign was *shown* working with, so substance and operator fit each other perfectly:

**1. Creation and collection — a self-sufficient spell.**
The water sigil "works to manipulate, collect, **and create** water" ([docs/sigils.md:41](../sigils.md#L41)). The docs note that long-running water spells tend to *collect* rather than *create*, since creation is more energetically costly — but either way, **the spell can supply its own material.** Water Orb needs no external reservoir; Qifrey fills the sphere directly. This is the key contrast with an earth-element version of the same recipe, which cannot create its material and must draw from a real source (see [Earth_Orb.md](Earth_Orb.md)).

**2. Physical state fits the Orb mechanic exactly.**
Orb creates a spherical space in which material collects, filling **bottom-to-top, still affected by gravity** ([docs/signs.md:309](../signs.md#L309)) — a description of *fluid* behavior, exactly matching the canon use where Qifrey pours water into the spherical region. Because water flows and self-levels, it forms a clean, true sphere with no special handling. This is why Water Orb is the canonical demonstration of Orb: the substance behaves precisely the way the sign expects.

**3. The opposed columns are the recipe's geometry, not the element.**
The two Columns sit dead-opposite on the horizontal axis and cancel to "balanced," so they brace the sphere rather than jet it. This is a property of the recipe's geometry; any same-recipe element swap inherits it.

**4. Sigil inversion is unresolved in canon.**
The canon glyph draws the water sigil inverted, but the effect of inverting a *water* sigil is unknown — the engine deduces an identical result either way ([docs/sigils.md:41](../sigils.md#L41) gives no inverted verb). Treated here as cosmetic.

**Bottom line.** Water Orb is the textbook case of substance and sign in harmony: a self-sufficient element that can conjure its own material, paired with a sign whose fluid-filling mechanic water satisfies natively. It produces a **clean floating sphere of water** with no caveats — the baseline against which element swaps (e.g. Earth Orb) are measured.

## How to draw it

1. Draw the **water sigil** at the center (inverted, per the canon glyph — though it changes nothing).
2. Place **four orb signs** at the corners (≈ NE/NW/SE/SW), each ~115–120px from center, symmetric across both axes. Tilt them ±30° for the gentle spin, or keep them upright for a perfectly still sphere.
3. Place **two column signs** opposite each other on the horizontal axis (left and right), ~109px out, rotated to face inward along the same line (90° / 270°). Keeping them an exact opposed pair is what makes the effect *centered* rather than a one-sided jet.
4. **Close the ring** to activate (an intentional gap leaves it prepared/inactive).
5. Bigger ring ⇒ larger volume held; neater drawing ⇒ steadier, longer-lasting container.

## Usage ideas

- A **portable canteen / water-store** with no flask — the casual Silver Eve demonstration use.
- A hands-free **wash-basin** or water supply for mixing conjuring ink.
- **Suspended water for teaching** — display water without spilling.
- Creative: a still-water **scrying globe**; scaled up + tilted, a slowly rotating water sphere.

## Similar spells

- **Earth Orb** (community) — the same recipe with an earth sigil. Differs in two canon-driven ways: earth **cannot create** its material (needs a real source — "a pump that needs a reservoir"), and only granular sand/soil pools cleanly into the sphere, while rigid rock/wood would jam without a compaction sign. See [Earth_Orb.md](Earth_Orb.md).
- **Levitating orb of water** (docs/magic.md): water + *levitation* signs → a floating water orb; uses motion rather than the orb-containment sign.
- **Watershot Seal / Water Bolt:** water + *column* (unopposed) → a projected jet/bolt; Water Orb pairs the columns so they brace instead of shoot.
- **Rising Platform of Water:** directional water shaping, but aimed (asymmetric) rather than contained.

*(Note: these comparisons are drawn from the docs, not engine catalog matches.)*

## Notes & limitations

- No asymmetric signs ⇒ clean, predictable, stable.
- **Not forbidden:** touches no human body, no reality-warp, no mass destruction.
- Canon ambiguity: the *effect of inverting a water sigil* is unknown; treated here as no-change per the engine. Whether the orbs literally "surround" or merely each define part of the sphere is a modeling nuance (the `orb` sign collects material into a spherical space; four reinforce a complete shell).

## Reproduction

- **Image:** [assets/images/spells/Water_Orb.png](../../assets/images/spells/Water_Orb.png) (canon panel).
- **JSON:** below — the active, working form (inverted core, ring closed). Import into the app (`wha-spell@1`).

```json
{
  "format": "wha-spell@1",
  "name": "Water Orb",
  "ring": { "closed": true, "doubled": false, "size": "medium" },
  "core": { "id": "c1", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": true },
  "components": [
    { "id": "c3", "type": "orb", "role": "sign", "x": -62.20735692977905, "y": -97.82608795166016, "rotation": 330, "scale": 1, "inverted": false },
    { "id": "c5", "type": "orb", "role": "sign", "x": 73.71651656131814, "y": -91.0535125732422, "rotation": 30, "scale": 1, "inverted": false },
    { "id": "c7", "type": "orb", "role": "sign", "x": 69.7031498620994, "y": 97.07357788085935, "rotation": 330, "scale": 1, "inverted": false },
    { "id": "c9", "type": "orb", "role": "sign", "x": -74.24749135971068, "y": 100.83612060546875, "rotation": 30, "scale": 1, "inverted": false },
    { "id": "c11", "type": "column", "role": "sign", "x": -108.83357436161106, "y": -3.260871171951223, "rotation": 90, "scale": 1, "inverted": false },
    { "id": "c13", "type": "column", "role": "sign", "x": 108.89217179317404, "y": 0.25083780288689184, "rotation": 270, "scale": 1, "inverted": false }
  ],
  "linkCount": 0,
  "dyes": []
}
```
