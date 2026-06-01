---
name: Earth Orb
type: earth
origin: community
forbidden: false
status: valid
core: earth
signs: orb ×4, column ×2
dyes: none
symmetry: radial
source: community variant of the canon Water Orb (user-composed in the app)
image: assets/images/spells/Earth_Orb.png
json: assets/spells/Earth_Orb.json
---

# Earth Orb

> A floating sphere of gathered earth, stone, and sand held above the seal — the earth-element counterpart to the canon Water Orb.

## Overview
A community-made variant that takes the canon **Water Orb** recipe (four Orb signs + a balanced pair of Columns) and swaps the water sigil for an **earth** sigil. The engine validates it exactly like the water version: it gathers the controlled material into a spherical space held above the glyph. In practice it behaves as a *floating earth reservoir* — but because of how the earth sigil works in canon, it differs from Water Orb in two important ways (see **Element behavior & canon grounding**).

## Validity
**Valid and active** (engine). The ring is closed, the Earth sigil sits at center as a proper core, and every part id resolves (no `unknownIds`). The engine raises only two **info**-level notes:
- *Stable: radial symmetry.*
- *Some signs are tilted — tilting signs makes the spell spin (more tilt = more spin, but less reach).*

No blocking or warning issues; nothing forbidden.

## Composition
- **Substance (sigils):** **Earth** (family *earth*, element *earth*) — manipulates wood, stone, sand, and soil; the "sigil of might."
- **Form (signs):**
  - **Orb ×4** (non-directional, not invertible) — creates the spherical containment space above the glyph.
  - **Column ×2** (directional, invertible) — placed left/right (rotation 90°/270°) and balanced against each other, so they cancel to no net aim.
- **Ring:** closed → active.
- **Ink / dyes:** plain conjuring ink (no dyes).

## Deduced effect
**Engine summary:** *"The earth, stone, and sand gathers into a sphere held above the glyph."*

In plain terms: a hovering ball of earth/sand assembled above the seal. Four Orb signs define the containment sphere; the two balanced Columns act as the feed/projection channels. Ordinary intensity (power 1), stable, with a slight spin contributed by the ±30°/90° tilts.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Earth | sigil (substance) | Defines the material: stone/sand/soil, **gathered not created**. Remove it → no core → invalid. |
| Orb ×4 | sign / form | The spherical containment field; without it the earth has no shape (raw, undirected). |
| Column ×2 | sign / form (directional) | Beam/feed channels; balanced = symmetric, no skew. Without them the sphere loses its directed feed/projection. |
| Ring (closed) | activation | Closed = active. Open → prepared but inactive. |
| Tilt (±30°/90°) | geometry | Adds minor spin; untilted → no spin, more reach/hold. |

## Element behavior & canon grounding
This is where Earth Orb genuinely diverges from Water Orb. Mechanically the engine treats the two as identical — same validity, same radial symmetry, same "gathers into a sphere" deduction, with only the substance noun changed. The real differences are canon-driven, from the **sigil** and the **Orb sign**:

**1. Creation vs. collection — the decisive constraint.**
The water sigil "works to manipulate, collect, **and create** water" ([docs/sigils.md:41](../sigils.md#L41)); the canon Water Orb literally fills its sphere with conjured/poured water, so it can supply its own material. The earth sigil "allows for the manipulation of numerous solid substances… **however, it does not allow for the creation** of these solid materials" ([docs/sigils.md:53](../sigils.md#L53)). So **Earth Orb cannot fill itself.** It needs a real source nearby — a sand pile, gravel, loose soil — and the spell lifts/gathers *that* into the sphere. Water Orb is self-sufficient; **Earth Orb is a pump that needs a reservoir.**

**2. Physical state vs. the Orb mechanic.**
Orb creates a spherical space in which material collects, filling **bottom-to-top, still affected by gravity** ([docs/signs.md:309](../signs.md#L309)) — a description of *fluid* behavior. Water flows and self-levels, so it forms a clean sphere (exactly the canon use). Earth behaves that way **only if it's sand or loose soil** — granular material flows and pools like a liquid, so a hovering ball/heap of sand is very plausible. But **rock, wood, and boulders are rigid** — they won't fill bottom-to-top, they'll just stack and jam. So Earth Orb realistically produces a **suspended sphere of sand/soil, not a packed stone ball** — unless you add a compaction/binding sign (e.g. `convergence`) to bind it into solid rock.

**3. The column orientation (same caveat in both versions).**
The two Columns sit left/right (horizontal) and cancel to "balanced," so they channel material sideways rather than feeding it straight up into the orb. This is identical in the canon-style Water Orb built from the same recipe, so it isn't an Earth-specific issue.

**Bottom line.** An Earth Orb is **possible and valid**. Versus Water Orb it differs in two canon-driven ways: it **can't conjure its own material** (it needs a sand/soil source to draw from), and it **works cleanly only with granular earth** (sand/soil behaves like the fluid Orb expects; rigid stone/wood won't pool into a sphere without a compaction sign). Functionally it's a **floating sand reservoir where Water Orb is a floating water reservoir.**

## How to draw it
1. Draw a closed ring (medium size).
2. Place the **Earth sigil** at the center.
3. Place **four Orb signs** evenly around the ring (here at roughly the four diagonal positions), keeping radial symmetry for stability.
4. Place **two Column signs** opposite each other on the left and right (rotation 90° / 270°), matched in size so they stay balanced (no directional skew).
5. The signs carry a slight tilt (±30°), which gives the spell a minor spin — leave it flat if you want maximum hold/reach instead.
6. Bigger seal → larger, heavier sphere; neater lines → more stable and longer-lasting.

## Usage ideas
- A **floating ammunition reservoir** — hold a sphere of stones/sand above you, then release or launch it.
- A **suspended grinding ball** (using the spin from the tilt) to mill grain or pulverize ore.
- **Construction** — pre-mass a measured sphere of sand/soil to deposit precisely.
- **Defense** — a hovering mass of earth as a movable shield or counterweight.

## Similar spells
- **Water Orb** (canon) — the direct analogue; same recipe with a water sigil. Self-sufficient (creates its own water) and forms a clean fluid sphere. *(Note: this comparison is drawn from the docs, not an engine catalog match — Earth Orb is a community spell and isn't in the engine catalog.)*
- **Sand Bridge / Sand Cage / Serpent's Bed of Sand** (canon earth spells) — share the "manipulate loose sand" basis, illustrating that granular earth is the most fluid-like, controllable form of the element.

## Notes & limitations
- The earth sigil **cannot create matter** — without a nearby source of stone/sand/soil the spell has nothing to gather.
- The clean spherical result depends on **granular** material; rigid rock/wood needs a compaction sign to hold a sphere.
- The tilt introduces spin at the cost of reach — intentional here, but worth noting.
- Not forbidden, not decorative.

## Reproduction
- **Image:** [assets/images/spells/Earth_Orb.png](../../assets/images/spells/Earth_Orb.png) (app render).
- **JSON:** [assets/spells/Earth_Orb.json](../../assets/spells/Earth_Orb.json) (also embedded below).

```json
{
  "format": "wha-spell@1",
  "name": "Earth Orb",
  "ring": { "closed": true, "doubled": false, "size": "medium" },
  "core": { "id": "c8", "type": "earth", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
  "components": [
    { "id": "c2", "type": "orb", "role": "sign", "x": -62.20735692977905, "y": -97.82608795166016, "rotation": 330, "scale": 1, "inverted": false },
    { "id": "c3", "type": "orb", "role": "sign", "x": 73.71651656131814, "y": -91.0535125732422, "rotation": 30, "scale": 1, "inverted": false },
    { "id": "c4", "type": "orb", "role": "sign", "x": 69.7031498620994, "y": 97.07357788085935, "rotation": 330, "scale": 1, "inverted": false },
    { "id": "c5", "type": "orb", "role": "sign", "x": -74.24749135971068, "y": 100.83612060546875, "rotation": 30, "scale": 1, "inverted": false },
    { "id": "c6", "type": "column", "role": "sign", "x": -108.83357436161106, "y": -3.260871171951223, "rotation": 90, "scale": 1, "inverted": false },
    { "id": "c7", "type": "column", "role": "sign", "x": 108.89217179317404, "y": 0.25083780288689184, "rotation": 270, "scale": 1, "inverted": false }
  ],
  "linkCount": 0,
  "dyes": []
}
```
