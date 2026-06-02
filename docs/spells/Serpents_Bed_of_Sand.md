---
name: Serpent's Bed of Sand
type: mixed
origin: canon
forbidden: false
status: valid
core: earth ×4 (satellites) + billowing-as-center (Billow Cluster) + repetition (outer seal)
signs: billowing ×1, collection ×4, crush ×4, column ×16, convergence ×4, repetition ×4
dyes: none
symmetry: radial (4-fold overall)
source: Witch Hat Atelier — created by the four apprentices of Qifrey's Atelier (Tetia, Richeh, Coco, Agott); used to make the dragon guarding the Illusory Labyrinth fall asleep; later a bed for Olruggio (ch. 81; WHA Kitchen ch. 53). Wiki "Serpent's Bed of Sand."
image: requested from user
json: assets/spells/Serpents_Bed_of_Sand.json
---

# Serpent's Bed of Sand

> A multi-circle earth/time spell that mills real stone into fine sand, billows it into a huge fluffy cloud, and continually resets the cloud so it stays soft yet strong enough to hold a dragon.

## Overview
The Serpent's Bed of Sand is a canon **mixed earth–time** spell, an amalgamation of several smaller seals invented jointly by the four apprentices of Qifrey's Atelier. At its center is a **Billow Cluster** (a central Billow sign ringed by Collection signs) that gathers loose material and converts it into a cloud. Around it sit several small **Wall Breaker** seals (Earth + Crush + Column) that crush the ground into fine soft sand and feed it inward. The whole thing is wrapped in a **repetition seal** (Repetition + Convergence + Column) so that, no matter what disturbs the cloud, it always returns to its original consistency. The result is a large, fluffy sand-cloud soft enough to nap on yet firm enough to hold up a dragon, springing back to shape once weight is removed.

## Validity
**Valid** (engine, with relation-aware validity). Earlier the analyzer reported this as *invalid* because it
graded each circle in isolation; it now reads the relations graph and correctly classifies the three coreless
structures this spell is built on:

| Circle | Structural role | How the engine now reads it |
|---|---|---|
| **Center circle** | **Billow Cluster** — a Billow sign at center, ringed by Collection | Billow can take a sigil's place ([signs.md:123](../signs.md#L123)); the engine now promotes a `canBeCenter` sign at the origin to be the circle's substance, so it deduces a cloud instead of flagging "no core." |
| **Mid ring** | **Boundary ring** — the empty enclosing ring of the nested stack (a chamber wall) | Recognized as the `outer` of a nest relation, so the "explosion" warning is suppressed. |
| **Outer ring** | **Modifier ring** — the repetition seal wrapping everything | A coreless ring that encloses/links the cored seals; demoted from blocking to an info note. (Post–Vol. 12 canon those marks are repetition **sigils**, [signs.md:131](../signs.md#L131); the app still exports them as signs.) |

Each of the four **Wall Breaker** satellites is individually **valid** and **stable (bilateral symmetry)**. The overall layout is 4-fold radial — very neat ⇒ stable and long-lasting; and large ⇒ powerful.

## Composition
- **Substance (sigils):**
  - **Earth ×4** (one per Wall Breaker satellite) — governs stone, sand, soil, wood; *manipulates but does not create* them ([sigils.md:53](../sigils.md#L53)). Supplies nothing on its own — it mills material that is physically present.
  - **Billow at center** (Billow Cluster) — the cloud-former; canon-allowed to occupy the center in place of a sigil ([signs.md:123](../signs.md#L123)).
  - **Repetition** (outer seal) — time element; continually resets the cloud to its prior state ([signs.md:131](../signs.md#L131)). Retconned from sign to sigil in the Vol. 12 bonus.
- **Form (signs):**
  - **Collection ×4** (center ring) — gathers the milled sand inward so Billow can convert it ([signs.md:115](../signs.md#L115)).
  - **Crush ×4** (one per satellite, **non-inverted = Wall Breaker**) — pulverize stone into a sand-like/powdered state ([signs.md:73](../signs.md#L73)).
  - **Column ×16** — 2 per satellite (confine each mill's output into a stream) + 8 in the outer ring (wall/channel the assembled cloud) ([signs.md:34](../signs.md#L34)).
  - **Convergence ×4** (outer ring) — pack the loose cloud tightly so it becomes firm enough to bear weight ([signs.md:107](../signs.md#L107)).
- **Ring:** all rings closed (active). Nested-glyph rule: inner seals fire because the enclosing rings are closed.
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
> **Engine summary (per circle):** each Earth satellite reads *"The earth, stone, and sand is pulverized into dust"*; the coreless circles read *"(no defined effect)"*. The engine cannot see the cross-circle pipeline.

In plain terms: the four satellites **mill real stone/sand into fine dust**, the center **Collection** pulls that dust in and **Billow** whips it into a **huge fluffy cloud**, and the outer ring **packs it firm (Convergence)**, **walls it (Columns)**, and **continually resets it (Repetition)** so the cloud stays soft yet self-restoring. The product is a sand-cloud strong enough to hold a dragon and to regain its shape once the weight is lifted.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Earth ×4 + Crush ×4 | substance + transmute | The mills. Remove them and the cloud has no raw material. |
| Column ×2 / satellite | form | Stream the pulverized sand toward the center instead of spraying it loose. |
| Collection ×4 | support | Gather the sand so Billow has something to convert ([signs.md:123](../signs.md#L123)). |
| Billow (center) | transmute | Turns gathered sand into the fluffy cloud — the heart of the spell. |
| Convergence ×4 | power | Packs the cloud firm enough to bear weight; without it, too loose to hold a dragon. |
| Column ×8 (outer) | form | Wall and channel the assembled cloud so it keeps a defined body. |
| Repetition ×4 | special (time) | Resets the cloud to shape under load and over time; without it the cloud settles and collapses. |
| Mid empty ring | structure | The chamber wall enclosing the cluster + satellites. |

## Element behavior & canon grounding
**Manipulate-not-create makes this a mill, not a conjurer.** Earth cannot create matter ([sigils.md:53](../sigils.md#L53)); it only rearranges what is already present. So the whole engine is **a quarry-and-mill that needs raw rock fed in** — it must be cast on or beside real ground/stone. Contrast the water-side cousin, the **Vapor Bubble**, which self-sources by collecting atmospheric humidity (water collects cheaply, [sigils.md:41](../sigils.md#L41)). This spell has no such luxury: no ground, no cloud.

**The Wall Breakers exist to make Billow *possible*.** Billow warns that *"some materials cannot be converted"* into clouds ([signs.md:123](../signs.md#L123)). Solid rock almost certainly can't be billowed; **fine sand** can. So the four Crush satellites first reduce stone to the **sand-like/powdered state** ([signs.md:73](../signs.md#L73)) that Billow can work with. The pulverizing isn't incidental — it's the prerequisite that turns un-billowable rock into billowable sand. This matches the spell's own development history: the apprentices deliberated over which material would be soft-yet-tactile and chose fine sand, which is what made Richeh's small Wall Breaker seals the right tool.

**Convergence + Billow + Repetition = a soft-yet-firm, self-healing bed.** This is the Serpent's Bed of Sand duality, and its rigid sibling the **Sand Cage** frames it exactly: *"if sand can be made soft as a bed, it can also be made rigid as a cage."* Billow gives the soft top; Convergence packs it firm enough to take weight ([signs.md:107](../signs.md#L107)); Repetition fights gravity and compression by **continually resetting the sand to its billowed state** ([signs.md:131](../signs.md#L131)) — so when a dragon lies on it the cloud springs back, and it doesn't slowly settle into a dead pile. Per the spell's history, binding the cloud so it wouldn't fall apart in use was the final hurdle, which Agott solved with the repetition sigils.

**Closest canon analogue — the Sand Cage.** They are two faces of the same control over loose sand. *Same:* Earth core(s), loose-sand substance, the manipulate-only constraint, Crush-based reworking of the grains, a structure built in place around/under a subject. *Differs:* the Bed makes the sand **soft** via Billow + the self-restoring Repetition wrap; the Cage makes it **rigid** via **inverted** Crush. The Bed is also far larger and **modular** — four dedicated milling satellites feeding a central Billow Cluster inside a stabilizing shell — where the Cage is one integrated seal.

**Bottom line:** The Serpent's Bed of Sand is the **soft, self-restoring sibling of the Sand Cage** and the most elaborate canon earth construction documented — a small factory that mills real stone into sand, billows it into a giant cloud, and uses time-magic (Repetition) to keep that cloud soft yet firm enough to hold a dragon. It is feasible only where there is real sand/earth to draw on ([sigils.md:53](../sigils.md#L53)); its persistence comes entirely from the Repetition wrap, not from the sand itself.

## How to draw it
1. **Center — Billow Cluster:** draw a small ring with a **Billow** sign at its center and **4 Collection** signs around it, open sides facing inward.
2. **Satellites — 4 Wall Breakers:** at the four cardinal points around the center, draw four small seals, each an **Earth** core with **1 Crush** (non-inverted) and **2 Column** signs; orient the columns to stream the milled sand toward the center. **Link** each satellite to the central cluster.
3. **Mid ring:** enclose the cluster + satellites in a larger **closed boundary ring** (the chamber wall).
4. **Outer — repetition seal:** wrap everything in the largest ring carrying **4 Repetition**, **4 Convergence**, and **8 Column** signs (Repetition on the diagonals, Convergence on the cardinals, Columns spread around). **Link** the satellites to this ring too.
5. Keep the layout 4-fold symmetric for stability; bigger + neater ⇒ stronger and longer-lasting. Cast it where there is **real stone/sand** to mill. Close every ring to activate.

## Usage ideas
- **A cloud to nap on** (the original dream, and the canon use on the dragon — make a target so comfortable it falls asleep).
- **A temporary bed/cushion in the field** on rocky terrain — mill the ground into a soft, self-restoring mattress (the Olruggio uses).
- **A soft-landing pad / crash cushion** — firm enough to catch a fall (Convergence), soft enough not to break the lander (Billow).
- **Large soft platform** to support heavy weight without a rigid structure.

## Similar spells
- **Sand Cage** (canon, earth) — the rigid sibling; same loose-sand control, opposite result (inverted Crush instead of Billow + Repetition).
- **Billow Cluster** (canon) — the central sub-spell on its own (Billow + Collection).
- **Wall Breaker Seal** (canon, earth) — the satellite sub-spell on its own (Earth + Crush + Column).
- **Integration** (canon, earth) — inverted-Crush reassembly; the reform face of Crush.
- **Vapor Bubble** (canon, water) — the water-side analogue of "collect a diffuse material and assemble it" (collects humidity rather than milling stone).

## Notes & limitations
- **Needs a real sand/earth source** — Earth manipulates, does not create ([sigils.md:53](../sigils.md#L53)).
- **Persistence is entirely from Repetition** — remove or lapse the repetition wrap and the cloud settles and collapses ([signs.md:131](../signs.md#L131)). Whether it retains the original "warmth" of Tetia's earlier version is unconfirmed in canon.
- **Engine validity** — now reads **valid** thanks to relation-aware validity (Billow-as-center promotion + boundary/modifier-ring classification). Before that fix it was a false-negative; see Validity. Self-matches the catalog at ~0.95.
- **Not forbidden** — manipulating inanimate sand is unrestricted.

## Reproduction
- **Image:** requested from user
- **JSON:** [assets/spells/Serpents_Bed_of_Sand.json](../../assets/spells/Serpents_Bed_of_Sand.json)

```json
{
  "format": "wha-spell@2",
  "name": "Serpent's Bed of Sand",
  "circles": [
    { "id": "k1", "name": "Circle 1", "center": { "x": 6.28, "y": 1.25 }, "radius": 254, "ring": { "closed": true }, "core": null, "components": [], "dyes": [], "inkColor": null },
    { "id": "k2", "name": "Circle 2", "center": { "x": 0, "y": 0 }, "radius": 94, "ring": { "closed": true }, "core": null, "components": [
      { "id": "c5", "type": "billowing", "role": "sign", "x": 0, "y": 0.51, "rotation": 180, "scale": 1.45, "inverted": false, "mirrored": false },
      { "id": "c6", "type": "collection", "role": "sign", "x": 0.09, "y": -58.21, "rotation": 0.09, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c7", "type": "collection", "role": "sign", "x": 60.45, "y": 0.36, "rotation": 87.96, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c8", "type": "collection", "role": "sign", "x": 0, "y": 61.1, "rotation": 180, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c9", "type": "collection", "role": "sign", "x": -64.23, "y": -2.14, "rotation": 271.91, "scale": 1, "inverted": false, "mirrored": false }
    ], "dyes": [], "inkColor": null },
    { "id": "k4", "name": "Circle 3", "center": { "x": 0, "y": -1.25 }, "radius": 326, "ring": { "closed": true }, "core": null, "components": [
      { "id": "c22", "type": "convergence", "role": "sign", "x": -280, "y": 0, "rotation": 270, "scale": 1.45, "inverted": false, "mirrored": false },
      { "id": "c23", "type": "convergence", "role": "sign", "x": 0, "y": -280, "rotation": 0, "scale": 1.45, "inverted": false, "mirrored": false },
      { "id": "c24", "type": "convergence", "role": "sign", "x": 291.91, "y": 1.32, "rotation": 90, "scale": 1.45, "inverted": false, "mirrored": false },
      { "id": "c25", "type": "convergence", "role": "sign", "x": -3.77, "y": 279.96, "rotation": 180, "scale": 1.6, "inverted": false, "mirrored": false },
      { "id": "c26", "type": "column", "role": "sign", "x": -255, "y": 99.45, "rotation": 60, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c27", "type": "column", "role": "sign", "x": -255, "y": -99.45, "rotation": 120, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c28", "type": "column", "role": "sign", "x": 54.38, "y": -280.96, "rotation": 193.26, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c29", "type": "column", "role": "sign", "x": 288.65, "y": -58, "rotation": 240, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c30", "type": "column", "role": "sign", "x": 283.50, "y": 88.59, "rotation": 300, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c31", "type": "column", "role": "sign", "x": 65.05, "y": 276.79, "rotation": 346.77, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c32", "type": "column", "role": "sign", "x": -61.06, "y": 279.57, "rotation": 12.32, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c33", "type": "column", "role": "sign", "x": -53.12, "y": -279.57, "rotation": 169.24, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c34", "type": "repetition", "role": "sign", "x": 201.42, "y": -208.04, "rotation": 224.07, "scale": 1.6, "inverted": false, "mirrored": false },
      { "id": "c35", "type": "repetition", "role": "sign", "x": 191.39, "y": 222.50, "rotation": 319.29, "scale": 1.6, "inverted": false, "mirrored": false },
      { "id": "c36", "type": "repetition", "role": "sign", "x": -199.30, "y": 203.95, "rotation": 44.33, "scale": 1.6, "inverted": false, "mirrored": false },
      { "id": "c37", "type": "repetition", "role": "sign", "x": -192.19, "y": -206.55, "rotation": 135.35, "scale": 1.6, "inverted": false, "mirrored": false }
    ], "dyes": [], "inkColor": null },
    { "id": "k5", "name": "Circle 4", "center": { "x": 171.33, "y": 2.42 }, "radius": 50, "ring": { "closed": true }, "core": { "id": "c14", "type": "earth", "x": 0, "y": 0, "rotation": 90, "scale": 1, "inverted": false, "mirrored": false }, "components": [
      { "id": "c15", "type": "column", "role": "sign", "x": 0, "y": -32.5, "rotation": 180, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c16", "type": "column", "role": "sign", "x": -0.77, "y": 36.56, "rotation": 1.21, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c17", "type": "crush", "role": "sign", "x": 30.66, "y": 2.41, "rotation": 94.50, "scale": 1, "inverted": false, "mirrored": false }
    ], "dyes": [], "inkColor": null },
    { "id": "k6", "name": "Circle 5", "center": { "x": 1.88, "y": 173.12 }, "radius": 50, "ring": { "closed": true }, "core": { "id": "c10", "type": "earth", "x": 0, "y": 0, "rotation": 180, "scale": 1, "inverted": false, "mirrored": false }, "components": [
      { "id": "c11", "type": "column", "role": "sign", "x": -35.21, "y": 1.45, "rotation": 87.63, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c12", "type": "column", "role": "sign", "x": 33.17, "y": 2.61, "rotation": 270.17, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c13", "type": "crush", "role": "sign", "x": -2.03, "y": 32.59, "rotation": 179.12, "scale": 1, "inverted": false, "mirrored": false }
    ], "dyes": [], "inkColor": null },
    { "id": "k7", "name": "Circle 6", "center": { "x": -174.54, "y": -1.66 }, "radius": 50, "ring": { "closed": true }, "core": { "id": "c1", "type": "earth", "x": 0, "y": 0, "rotation": 270, "scale": 1, "inverted": false, "mirrored": false }, "components": [
      { "id": "c2", "type": "crush", "role": "sign", "x": -31.43, "y": -1.06, "rotation": 271.93, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c3", "type": "column", "role": "sign", "x": -2.03, "y": -33.85, "rotation": 176.56, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c4", "type": "column", "role": "sign", "x": -2.03, "y": 35.11, "rotation": 3.31, "scale": 1, "inverted": false, "mirrored": false }
    ], "dyes": [], "inkColor": null },
    { "id": "k8", "name": "Circle 7", "center": { "x": 0, "y": -170.17 }, "radius": 50, "ring": { "closed": true }, "core": { "id": "c18", "type": "earth", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false }, "components": [
      { "id": "c19", "type": "crush", "role": "sign", "x": 0, "y": -32.5, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c20", "type": "column", "role": "sign", "x": 34.43, "y": -2.41, "rotation": 265.98, "scale": 1, "inverted": false, "mirrored": false },
      { "id": "c21", "type": "column", "role": "sign", "x": -37.24, "y": -5.12, "rotation": 97.83, "scale": 1, "inverted": false, "mirrored": false }
    ], "dyes": [], "inkColor": null }
  ],
  "relations": [
    { "type": "nest", "outer": "k1", "inner": "k2" },
    { "type": "nest", "outer": "k4", "inner": "k1" },
    { "type": "nest", "outer": "k1", "inner": "k5" },
    { "type": "nest", "outer": "k1", "inner": "k6" },
    { "type": "nest", "outer": "k1", "inner": "k7" },
    { "type": "nest", "outer": "k1", "inner": "k8" },
    { "type": "link", "a": "k7", "b": "k2" },
    { "type": "link", "a": "k6", "b": "k2" },
    { "type": "link", "a": "k5", "b": "k2" },
    { "type": "link", "a": "k8", "b": "k2" },
    { "type": "link", "a": "k8", "b": "k1" },
    { "type": "link", "a": "k5", "b": "k1" },
    { "type": "link", "a": "k6", "b": "k1" },
    { "type": "link", "a": "k7", "b": "k1" }
  ]
}
```
