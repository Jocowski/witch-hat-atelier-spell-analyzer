---
name: Water Pen
type: water
origin: wiki
forbidden: false
status: valid (effect partly unknown)
core: water
signs: dispersion ×1, column ×2, unknown_04 (Unknown Sign 4, arc) ×2, unknown_03 (Unknown Sign 3, triangle) ×1
dyes: none
symmetry: bilateral
source: Witch Hat Atelier — Qifrey's battle with the gilded people of Romonon in Serpentback Cave (wiki/manga; unofficial spell name).
image: assets/images/spells/Water_Pen.png
json: assets/spells/Water_Pen.json (app export, embedded below)
---

# Water Pen

> A water spell that conjures a hand-held, dagger / pen-nib-shaped glob of water — pour
> conjuring ink into it and it becomes a giant brush for drawing very large seals on any surface.

## Overview
Water Pen (unofficial name) is a **water-type tool spell**. A central **water sigil** is
metered out at the top by a **Dispersion** sign flanked by **two Column** signs, enclosed on
each side by an **arc-shaped unidentified sign** (**Unknown Sign 4**, a mirrored pair) and
pointed below by a **triangle-like unidentified sign** (**Unknown Sign 3**). It produces a
dagger / pen-nib-shaped glob of water that **hovers below the seal at an angle**. Conjuring ink
poured into the dagger saturates the water with ink, turning it into a brush large enough to
**draw very large seals on practically any surface**. It is best controlled by drawing the seal
in a palm quire held in the hand. Qifrey used it during his battle with the gilded people of
Romonon in Serpentback Cave, drawing one unidentified spell and one Water Bolt with it.

## Validity
**Valid, but its effect cannot be fully deduced.** A water core with a defined ring of signs;
**bilateral symmetry → stable**. The seal contains **three unidentified signs (Unknown Sign 4 ×2
+ Unknown Sign 3 ×1)**, so the engine raises a warning that the **deduced effect is incomplete**.
The ring is drawn **open** — consistent with a prepared, hand-held tool seal rather than a fired one
(ring open/closed is an app activation visual only).

## Composition
- **Substance (sigil):**
  - **Water (core)** — *"manipulate, collect, and create water… creating water is more
    energetically costly than collecting it"* ([sigils.md:41](../sigils.md#L41)). For a small,
    held tool-glob this runs in water's **create** mode: conjured on demand in the hand, no
    reservoir needed.
- **Signs:**
  - **Dispersion ×1** (top, rotated 180° so the hood faces up) — *"causes the magic of its seal
    to pour or 'disperse' outwards… a column that leaks its magic outwards rather than shooting
    or beaming it"* ([signs.md:45](../signs.md#L45)). Here it **meters water out** of the seal
    as a steady bleed rather than firing a jet.
  - **Column ×2** (top, horizontal, flanking the Dispersion) — *"manifest in a column or beam"*
    ([signs.md:34](../signs.md#L34)). Balanced left/right, they **re-confine** the dispersed
    outflow into one coherent body instead of a spray.
  - **Unknown Sign 4 ×2** (arc, a mirrored left/right pair hugging the core) — **unidentified**
    ([signs.md, Unknown Signs](../signs.md)). Likely forms the two curved flanks of the nib's body
    (unconfirmed).
  - **Unknown Sign 3 ×1** (triangle, alone at the bottom) — **unidentified**. Likely forms the
    downward point/tip of the dagger (unconfirmed).
- **Ink / dyes:** plain conjuring ink (the spell's whole point is that *more* ink is poured into
  the finished glob).

> **Mapping note.** Recipe is from the app's JSON export (below). The water core, Dispersion, two
> Columns, and the placements are certain; the two unknown sign *types* are catalogued but their
> functions are not known.

## Deduced effect
Engine summary (substance + known operators only): *"The water is projected as a tight column or
beam, skewed toward up (unbalanced signs),"* with the Dispersion breakdown *"the water leaks out
and spreads on every side,"* **plus a warning**: *"Contains 3 unidentified signs — the deduced
effect is incomplete and may be inaccurate."*

Two engine readings to override (per [learnings](../../.claude/skills/spell-analyzer/references/learnings.md)):
- **`aim=up` / `balance=skewed up`** is an **artifact** — Dispersion and both Columns are clustered
  at the **top** of the seal, so the engine reads the projection skewing up. The directional word is
  an **in-plane axis label, not gravity** (the Water Bolt lesson); in canon the water glob **hovers
  below the seal at an angle**, not upward.
- **`spin`** is an artifact of the two Columns being rotated to lie horizontal — there is no intended spin.

**Restated plainly:** the known parts describe water being **metered out of the seal (Dispersion)
and gathered into one coherent body (Columns)** — i.e. the "inked-pen reservoir" behavior. What the
engine cannot see is the **dagger / pen-nib shape and its angled hover**, which are encoded in the
three unidentified signs.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water | core / substance | Conjures the glob on demand in the hand (no reservoir); fluid, so it soaks up poured ink |
| Dispersion ×1 | directional / form | Meters the water out as a steady bleed rather than a fired jet |
| Column ×2 | directional / form | Horizontal, balanced — re-confine the bleed into one coherent body |
| Unknown Sign 4 ×2 | **unknown** | Arc pair hugging the core — **unidentified**; likely the nib's curved flanks |
| Unknown Sign 3 ×1 | **unknown** | Triangle below — **unidentified**; likely the nib's downward point |

## Element behavior & canon grounding
Water's **create** mode is what makes a *held tool* possible at all: the nib-glob is conjured from
nothing in the palm, so there is no tank to carry — unlike an earth tool, which can only *manipulate*
and would need a real source nearby ([sigils.md:41](../sigils.md#L41)). And because water is a
**fluid**, it can perform the spell's signature trick: **conjuring ink is poured into the glob and
the water saturates with it**, turning the dagger into a giant brush. A rigid element could not absorb
ink this way — fluidity is load-bearing here.

The sign choice fits a **tool**, not a weapon. The form sign is **Dispersion**, not a bare Column,
because the pen wants a **steady metered bleed** of inked water onto a surface rather than a fired
jet ([signs.md:45](../signs.md#L45) — dispersion "leaks outward" vs. column "shoots/beams"). The two
flanking **Columns** then re-confine that bleed into one body instead of a spray — the docs describe
column and dispersion as near-opposites, so pairing them is a deliberate "leak, but keep it gathered"
combination ([signs.md:34](../signs.md#L34), [45](../signs.md#L45)). My reading of the unknowns
(unconfirmed): the **arc pair (Unknown 4)** forms the two curved flanks of the nib's body and the
**triangle (Unknown 3)** forms its downward point — together the dagger / pen-nib silhouette and its
angled, hovering, hand-controllable hold.

**Closest canon analogue: the Watershot family** (Watershot / Water Bolt) — the same lineage of a
water core shaped by directional signs; the engine catalog returns no canon *match*, only nearest
neighbours (Rising Wave 0.6, Water Bolt 0.55, Water Horse 0.55). The decisive **difference** is
direction of intent: Watershot and Water Bolt **expel** water outward as a jet or volley, whereas
Water Pen does the opposite — it **holds** a small, persistent, shaped body you grip and steer. In
that respect it is far closer in spirit to **Water Horse** (a standing, controllable water body) than
to any jet.

**Bottom line:** a self-sufficient, hand-held **water-and-ink stylus** — water's create-mode means
no reservoir, its fluidity lets it soak up poured conjuring ink, Dispersion + Columns meter and gather
the outflow into one body, and the three unidentified signs are what turn that body into an angled,
hovering dagger/nib you can draw giant seals with. The engine resolves the "how the water comes out and
stays gathered" half; the "what shape and where it hangs" half lives in the unknown signs — which is
exactly why it stops short.

## How to draw it
1. **Water sigil** at the centre.
2. At the **top**, a **Dispersion** sign with its hood facing up (rotated 180°), with a **Column**
   protruding **horizontally** from each side (left rotated 90°, right rotated 270°) — balanced, so
   the outflow stays gathered rather than skewing.
3. On the **left and right of the core**, an **Unknown Sign 4** arc as a **mirrored pair** (place the
   right copy with the editor's **mirror** control), close in to enclose the water sigil.
4. **Below** the core, a single **Unknown Sign 3** triangle, centred.
5. Keep it **bilaterally symmetric** for stability. The ring is left **open** — it is a prepared,
   hand-held tool, drawn small in a palm quire to control by hand. Bigger/neater ⇒ stronger/steadier.

## Usage (canon & ideas)
- **Drawing tool (canon):** Qifrey used it in Serpentback Cave (vs. the gilded people of Romonon) to
  **draw very large seals on any surface** — one unidentified spell and a Water Bolt — controlling it
  via a seal drawn in a palm quire held in the hand.
- **Field calligraphy:** a brush for murals or large-scale seals where no physical brush is big enough.
- **Glowing ink:** pour a dye into the glob — Golden Blaze Wyrm scales for ink that **glows in the
  dark**, or Blushing Bride scales to draw **invisible** seals.
- **Precision applicator:** a controllable water tip for wetting, cleaning, or measured application.

## Similar spells
- **Watershot Seal / Water Bolt** — same water-core-shaped-by-directional-signs lineage, but they
  *expel* water (jet / volley) where Water Pen *holds and shapes* it as a tool.
- **Water Horse** — the nearest in spirit: a standing, controllable water body rather than a fired one.

## Notes & limitations
- **Effect is only partly deducible:** three unidentified signs (Unknown Sign 4 ×2 + Unknown Sign 3 ×1)
  drive the engine's *"incomplete deduced effect"* warning. Expected and correct, not a bug.
- The `aim=up` / spin readings are geometry artifacts (signs clustered at the top, Columns rotated
  horizontal) — the canon glob hovers **below** the seal at an angle.
- Unofficial spell name; recipe is from the app JSON export, the canon behaviour from wiki/manga.
- Not forbidden: no body magic, reality-warping, or mass destruction.

## Reproduction
- **Image:** the canonical seal redrawing is at `assets/images/spells/Water_Pen.png`; the isolated
  unknown marks are saved at `assets/images/signs/unknown/Unknown_03.png` (triangle) and
  `Unknown_04.png` (arc).
- **JSON (`wha-spell@2`, from the app export):** `assets/spells/Water_Pen.json`

```json
{
  "format": "wha-spell@2",
  "name": "Water Pen",
  "circles": [
    {
      "id": "k2", "name": "Circle 1", "center": { "x": 0, "y": 0 }, "radius": 170,
      "ring": { "closed": false },
      "core": { "id": "c1", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false },
      "components": [
        { "id": "c2", "type": "unknown_04", "role": "sign", "x": -32.107, "y": 1.875, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false },
        { "id": "c3", "type": "unknown_04", "role": "sign", "x": 32.284, "y": 0.937, "rotation": 0, "scale": 1, "inverted": false, "mirrored": true },
        { "id": "c4", "type": "unknown_03", "role": "sign", "x": 0.980, "y": 53.645, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false },
        { "id": "c6", "type": "column", "role": "sign", "x": -17.836, "y": -41.071, "rotation": 90, "scale": 1, "inverted": false, "mirrored": false },
        { "id": "c7", "type": "column", "role": "sign", "x": 19.087, "y": -40.802, "rotation": 270, "scale": 1, "inverted": false, "mirrored": false },
        { "id": "c8", "type": "dispersion", "role": "sign", "x": 0, "y": -46.286, "rotation": 180, "scale": 1, "inverted": false, "mirrored": false }
      ],
      "dyes": [], "inkColor": null
    }
  ],
  "relations": []
}
```
