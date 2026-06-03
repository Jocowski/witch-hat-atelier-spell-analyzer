---
name: Makeover Mask Spell
type: vision
origin: wiki
forbidden: false
status: valid
core: vision_sigil
signs: eye ×4, direction ×2 (inward), unknown_07 ×1, unknown (spiral shape) ×1
dyes: none
symmetry: bilateral (top-bottom axis; the two unknown signs differ)
source: telepedia 'Makeover Mask Spell': https://witchhatatelier.telepedia.net/wiki/Makeover_Mask_Spell — manga debut ch. 47 (Olruggio's Makeover Mask, Silver Eve Festival). Created by Olruggio. Per wiki.
image: none yet
json: none yet
---

# Makeover Mask Spell

> A vision spell written on a mask that makes the wearer's face appear clean and at its best — magical cosmetics that show the wearer as their most beautiful self.

## Overview
The Makeover Mask Spell was created by Olruggio and is written on a mask he wears at the Silver Eve Festival (ch. 47). It makes the wearer's face appear as their "best self" — clean, polished, as if wearing ideal makeup. The wiki describes it as "magic makeup." Like Gathering Shadows, its core is a **Vision sigil** with Eye signs; unlike Gathering Shadows, it uses **Region (direction) signs** facing inward and two additional unknown marks. Whether the illusion looks the same to all observers or adapts to each viewer's idea of beauty is explicitly unresolved by the wiki.

## In plain terms (sum up)
Olruggio's mask makes him look his best — it's a magical beauty filter for your face. Written on a physical mask, it shows everyone who looks at you a version of your face that's clean, polished, and at its ideal. Think of it as always wearing perfect makeup without putting any on. Two unknown signs in the recipe mean the exact mechanism isn't fully understood, but the Vision + Eye core (the same as the shadow-concealment Gathering Shadows uses) tells us it's working with light and appearance to change what others perceive.

## Validity
**Valid — partially incomplete.** The spell has a confirmed sigil (vision_sigil) and confirmed signs (eye ×4, direction ×2), plus two unidentified marks. The core vision+eye combination is the same as Gathering Shadows (confirmed functional). The two unknown signs prevent a full engine deduction, but the spell's canon behavior is confirmed.

## Composition
- **Substance (sign-as-sigil):** Vision (`vision_sigil`) — the eight-pointed asterisk at center. The light/perception-manipulation core, same as Gathering Shadows and the Cloak Spell. `canBeCenter`.
- **Form (signs):**
  - **Eye ×4** (non-directional, special) — absorbs light into shadow; with Vision, this is the base of the concealment/illusion trio. Here, rather than full concealment, the Eye signs modulate incoming light to change apparent appearance.
  - **Region (direction) ×2** (`direction`, directional, direction operator) — two inward-facing Region chevrons, described as "inward facing region sigils." In the wiki they are called "region sigils" but from the id map they are Region signs (`direction` id). Two opposed inward-facing Region signs create a **contained channel** — magic manifests inside the ring only, scoped to the wearer's face.
  - **Unknown (equals sign shape) ×1** — described as "resembling an equals sign." This matches the shape description of `unknown_07` (two short horizontal parallel bars, "=" shape), which appears in Phantasmal Fireball. Its role in a vision spell context is unconfirmed.
  - **Unknown (spiral shape) ×1** — described as "a spiral on the top and bottom of the glyph respectively" (placed top and bottom). A spiral shape is not currently matched to any catalogued sign id. It could be an entirely new unknown or relate to the `repetition`/`sign_of_wind` whirl shapes, though neither is a clean match.
- **Ring:** closed (active).
- **Ink / dyes:** plain conjuring ink.
- **Symmetry note:** the two unknown signs are different shapes (equals vs. spiral) placed at top and bottom — this creates bilateral rather than radial symmetry.

## Deduced effect
The vision+eye core, with inward Region signs confining the effect to the ring interior (the wearer's face), produces a **contained appearance-manipulation**: light hitting and leaving the face is modulated by the seal to present an idealized image to observers. Where Gathering Shadows makes the host *disappear* (absorb all light), here Eye signs are presumably tuned differently — not to absorb light completely, but to *filter/redirect* it so observers see the "best version" appearance instead of the literal face.

The two Region signs pointing inward act as a scope operator: the effect is confined to within the ring (the mask's face area). Without them, the illusion might bleed outward or be unfocused.

> **Deduction incomplete due to two unknown signs.** The equals-sign and spiral marks are unidentified; their contributions below are speculative.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Vision sigil | core / substance | Anchors the light-manipulation domain; without it the mask has no substance |
| Eye ×4 | special — light modulation | Modulates the light hitting/leaving the face; the mechanism that produces the "best self" appearance |
| Region (direction) ×2, inward | direction — contained scope | Confines the illusion effect to within the ring (the face area on the mask); prevents bleed-out |
| Unknown equals-sign (unknown_07?) | unknown | Possibly a reinforcement/balance mark or an intensity tuner; unconfirmed |
| Unknown spiral | unknown | Possibly a "persistence" or "continuous cycle" modifier (spiral shapes in WHA often suggest rotation/duration); unconfirmed |

## Element behavior & canon grounding
**Vision** is the same perception/light core used in **Gathering Shadows** and the **Cloak Spell**. It is a `canBeCenter` sign that occupies the origin as the spell's substance, with no classical element behind it — the domain is light and perception directly ([docs/lexicon/signs-non-directional.md](../lexicon/signs-non-directional.md), Vision entry).

**Eye** with Vision creates the concealment/illusion trio (with Bend). Notably, the Makeover Mask Spell uses Eye ×4 **without Bend** — it drops Bend and replaces it with Region signs and the two unknown marks. This is the key difference from Gathering Shadows: Bend *bends light around* the host, producing invisibility. Omitting Bend and adding Region (inward) changes the behavior from "absorb all light = vanish" to "modulate light within a defined area = change how the face looks." The inward Region signs scope the effect *inside* the ring rather than wrapping it around the object.

The wiki's uncertainty about whether the illusion "looks the same for everyone or changes accordingly to the subject's own interpretation of beauty" reflects the ambiguity of the unknown signs. If the spiral is a Vision-family mark that reads the observer's perception, the illusion could adapt to each viewer. If the equals sign is a stability/uniformity mark, the output might be a single fixed idealized image for all observers.

**Closest canon analogues:**
- **Gathering Shadows** — the same vision_sigil + eye ×4 core, but with Bend (invisibility) rather than Region (scoped appearance); the nearest recipe.
- **Mirror Spell** — another appearance-modifying vision spell (borrowing the appearance of observers); different mechanism but same domain.

**Bottom line:** The Makeover Mask Spell is a focused appearance-illusion: vision_sigil + eye ×4 for light manipulation, Region ×2 inward to scope it to the face area, plus two unknown signs whose contributions are unresolved. It is structurally the most similar spell to Gathering Shadows but achieves a softer, scoped appearance-change rather than full concealment, the key difference being Bend (wrap) vs. Region (scope).

## How to draw it
1. Draw the **Vision sigil** (`vision_sigil`) at the center of the mask.
2. Place **Eye signs on 4 of the 8 asterisk points** of the Vision sigil (at 90° intervals — top, right, bottom, left OR at 45° intervals — diagonals).
3. Add **two Region (direction) signs** facing inward, positioned bilaterally (e.g. left and right of the core).
4. Add the **equals-sign unknown mark** at the top and the **spiral unknown mark** at the bottom (or vice versa — the exact placement is inferred from the wiki description).
5. Close the ring.
6. Maintain bilateral symmetry along the vertical axis.
Note: The seal is drawn on a physical mask, not on parchment; the medium is integral to targeting the face area.

## Usage ideas
- **Festival appearance:** the canon use — worn at Silver Eve to appear well-groomed without physical makeup.
- **Social / diplomatic encounters:** presenting one's best face at formal meetings without the labor of grooming.
- **Stage / performance:** actors or performers could wear a Makeover Mask to ensure their appearance reads ideally to the audience.
- **Confidence aid:** the wiki notes the effect may adapt to the wearer's own interpretation of beauty — wearing one might serve as a psychological comfort tool.

## Similar spells
- **Gathering Shadows** — same core (vision_sigil + eye ×4); Gathering Shadows conceals fully (with Bend), Makeover Mask modifies appearance selectively (with Region + unknowns).
- **Mirror Spell** — another appearance-altering vision spell, but one that borrows the viewer's own appearance rather than presenting the wearer's "best self."

## Notes & limitations
- Two signs are unidentified (`unknown_07` / spiral) — the full engine deduction is incomplete. The core behavior is confirmed by canon, but the role of the two unknown marks is speculative.
- The wiki explicitly leaves open whether the illusion adapts to each viewer's idea of beauty or presents a fixed appearance. This is directly tied to what the unknown signs do.
- The spell is drawn on a **mask** — it is a wearable item spell, similar to Sasaran's cloak or the Sylph Shoes. It is tied to the object it's written on.
- Not forbidden: altering apparent appearance is not body-affecting in the forbidden sense (the wearer's actual body is unchanged; only their *apparent* appearance to observers changes). Compare to the forbidden category which bans effects directly on the human body.

## Reproduction
- **Image:** none yet (requested from user).
- **JSON:** Placeholder with the identified signs; the two unknown signs are omitted until their ids are confirmed.

```json
{
  "format": "wha-spell@1",
  "name": "Makeover Mask Spell",
  "ring": { "closed": true },
  "core": { "id": "c1", "type": "vision_sigil", "x": 0, "y": 0, "rotation": 0, "scale": 1 },
  "components": [
    { "id": "s1", "type": "eye", "role": "sign", "x": 0, "y": -80, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "s2", "type": "eye", "role": "sign", "x": 80, "y": 0, "rotation": 270, "scale": 1, "inverted": false },
    { "id": "s3", "type": "eye", "role": "sign", "x": 0, "y": 80, "rotation": 180, "scale": 1, "inverted": false },
    { "id": "s4", "type": "eye", "role": "sign", "x": -80, "y": 0, "rotation": 90, "scale": 1, "inverted": false },
    { "id": "s5", "type": "direction", "role": "sign", "x": 110, "y": 0, "rotation": 270, "scale": 1, "inverted": false },
    { "id": "s6", "type": "direction", "role": "sign", "x": -110, "y": 0, "rotation": 90, "scale": 1, "inverted": false }
  ],
  "dyes": []
}
```
