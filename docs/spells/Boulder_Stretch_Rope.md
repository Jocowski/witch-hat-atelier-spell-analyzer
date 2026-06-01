---
name: Boulder Stretch Rope
type: earth
origin: canon
forbidden: false
status: valid
core: earth
signs: weave ×1
dyes: none
symmetry: radial
source: canon (Witch Hat Atelier — Richeh's spell; used to cross the gap in the serpent-back cave, and by Agott, Coco & Tetia to capture Wolf Euini)
image: none yet
json: none yet
---

# Boulder Stretch Rope

> Shapes a piece of existing stone into a long, flexible ribbon — a rope of rock.

## Overview
Boulder Stretch Rope is a canon earth-type spell invented by Richeh. A central earth
sigil with a single Weave keystone wrapped around it turns rigid stone into a long,
flexible ribbon that can be used for many purposes — spanning a gap or binding a target.
Richeh used it to cross a gap in the road of the serpent-back cave; Agott, Coco and
Tetia later used it to capture Wolf Euini.

## Validity
**Valid** (engine). The blocking "core present" rule is satisfied by the Earth sigil,
which carries one sign (Weave), giving it a defined form. The engine flags the geometry
`asymmetric / potentially unstable`, but that is the usual single-sign artifact (one sign
read fractionally off origin) — canon draws the Weave cleanly wrapped around the sigil,
which is symmetric. No blocking or warning issues otherwise.

## Composition
- **Substance (sigils):** Earth — element `earth`; provides "earth, stone, and sand."
  The sigil of might; manipulates wood/stone/sand/soil but cannot create them.
- **Form (signs):** Weave (semi-directional) ×1, drawn large (scale ≈2.35) and wrapped
  around the core. Turns solid objects into long, flexible ribbons on contact. Not inverted.
- **Ring:** open (prepared).
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
Engine summary: **"The earth, stone, and sand is woven into a long, flexible ribbon."**

In plain terms: grip a rigid piece of stone or rock and transmute it into a long, supple
ribbon or rope — a boulder drawn out into a flexible cord that can bridge a gap or bind.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Earth | sigil (substance) | Names the substance and binds the spell to *existing* solid stone; without it there is nothing to weave |
| Weave | sign (transmute) | The whole transformation: rigid stone → long flexible ribbon; without it, just undirected earth manipulation |
| Scale ≈2.35 | size | Bigger seal ⇒ more power/reach (engine `power=2.35`), letting it handle a real boulder |

## Element behavior & canon grounding
This is a **transmute** spell, and the substance's physical nature is the whole point.
Weave's job is to make a **rigid solid behave like a textile** — flexible, stretchable,
rope-like ([signs.md:139](../signs.md)). Earth's material (stone, rock) is the *hardest,
least pliable* substance in the tetrad, which is exactly why the pairing is dramatic: it
overrides rock's defining property — rigidity — and gives it cloth-like compliance.

Crucially, the earth sigil *"allows for the manipulation of numerous solid substances…
However, it does not allow for the creation of these solid materials"*
([sigils.md:53](../sigils.md)). So this is **not** a "summon a rope" spell — it is a
*reshaping* spell that needs a real boulder or rock to bite on. That matches canon
exactly: Richeh casts it on stone already present in the cave to bridge the gap, and the
trio cast it on stone to bind Euini. It is "a loom that needs raw stone fed in," not a
self-sufficient source.

Compared to its sibling Weave spells: **Crystal Ribbon** and Richeh's **Light Tracer**
use the *same* Weave sign on *different* substances (crystal, light) — same operator,
different material, the core multiplication of the system. Crystal Ribbon is the closest
structural twin (crystal may even be an earth variant — [spells.md:55](../spells.md)),
but crystal/light spells can *create* their material and so are self-sufficient; this
earth version still needs a real rock. Against the other earth spells —
**Wall Breaker / Integration** smash or fuse stone, **Sand Cage / Serpent's Bed of Sand**
shape loose granular sand — Boulder Stretch Rope is the odd one that makes *hard* stone
*soft and flexible*, the most counter-intuitive thing you can ask of rock.

**Bottom line:** Feasible and canon-faithful — a transmuter that grips an existing
boulder and draws it out into a long flexible rope of stone. It is not self-sufficient
(earth cannot conjure rock), so it needs raw stone on hand; its appeal is purely that it
forces the system's most rigid material to behave like ribbon — the same trick Richeh's
Crystal Ribbon and Light Tracer pull on softer media.

## How to draw it
Place the **Earth** sigil at the center. Wrap a **single large Weave** sign around it (it
is "supposed to surround the central sigil," [signs.md:139](../signs.md)) — one keystone,
not a ring of several. Keep the Weave centered and even around the core for stability; the
bigger and neater the seal, the longer and more controllable the resulting ribbon. Do not
invert it (an inverted Weave has never been observed in canon). Close the ring to fire.

## Usage ideas
- **Bridge a gap** — stretch a roadside boulder into a spanning rope of stone (Richeh's
  use in the serpent-back cave).
- **Restrain a target** — wrap the flexible stone ribbon around a person to capture them
  (Agott, Coco & Tetia's use on Wolf Euini).
- **Improvised cordage** — turn a nearby rock into climbing/hauling rope without carrying
  any.
- **Crafting** — draw stone into long flexible strips for construction or decorative work.

## Similar spells
- **Crystal Ribbon** — the same Weave sign on crystal (closest structural twin; crystal
  self-creates, so no source rock needed).
- **Light Tracer** — Richeh's Weave-on-light spell.
- **Wall Breaker / Integration, Sand Cage, Serpent's Bed of Sand** — the other canon earth
  spells, which break/fuse/cage rather than make stone flexible.

## Notes & limitations
- Engine "asymmetric / potentially unstable" is a single-sign geometry artifact; canon's
  centered wrap is stable.
- Weave is *most likely* semi-directional but **has never been seen inverted**, so the
  effect of inverting it is unknown — leave it upright.
- Not forbidden: earth-on-stone, nothing drawn on a body or warping reality.

## Reproduction
- **Image:** requested from user (Stone Weave Skein.png)
- **JSON:** pasted below (importable composition)

```json
{
  "format": "wha-spell@1",
  "version": 1,
  "composition": {
    "name": "Boulder Stretch Rope",
    "ring": { "closed": false },
    "core": { "id": "c1", "type": "earth", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false },
    "components": [
      { "id": "c2", "type": "weave", "role": "sign", "x": 0, "y": 0.2692289352416992, "rotation": 180, "scale": 2.349999999999999, "inverted": false, "mirrored": false }
    ],
    "linkCount": 0,
    "dyes": []
  }
}
```
