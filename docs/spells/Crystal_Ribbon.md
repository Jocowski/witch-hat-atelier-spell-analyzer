---
name: Crystal Ribbon
type: crystal
origin: wiki
forbidden: false
status: valid
core: crystal
signs: weave ×1 (large, surrounding)
dyes: none
symmetry: asymmetric
source: telepedia "Crystal Ribbon" — a crystal-type shaping spell by Richeh (the Weave sign is her invention). The seal is never shown in canon; recipe reconstructed from the Crystal sigil + Weave sign (docs/sigils.md, docs/signs.md).
image: none yet
json: assets/spells/Crystal_Ribbon.json
---

# Crystal Ribbon

> Conjures hard crystal and weaves it into a long, flexible ribbon — a rigid material made supple.

## Overview
Crystal Ribbon is a crystal-type **shaping** spell: a **Crystal** sigil wrapped by a single large
**Weave** sign. It turns conjured crystal into a long, flexible crystalline ribbon/band that bends
like a strap despite being solid crystal. It's the gentle, utility face of the Crystal sigil — and
the flexible counterpart to Crystal Shard's brittle eruption. Both the Crystal sigil and the Weave
sign are associated with Richeh, the only canon crystal user; the seal itself is never shown.

## In plain terms (sum up)
This spell makes **a long, bendy ribbon out of solid crystal.** The crystal sigil in the middle
conjures hard crystal, and the big looping "Weave" sign drawn around it does the trick: it turns
that hard, brittle crystal into something **flexible — like turning glass into a ribbon of cloth.**
Draw the Weave bigger and you get a longer ribbon. It's a making/shaping spell, not a weapon —
think crystal rope, straps, or bindings that are tough but can bend. It's the calm, crafty sibling
of **Crystal Shard** (which instead bursts the crystal out as sharp spikes), and it's basically the
crystal version of the earth "Boulder Stretch Rope" — except this one makes its own material
instead of needing a rock to start with.

## Validity
**Valid** (engine fact). Crystal core + a single Weave keystone; no issues. The engine flags
"asymmetric / potentially unstable" — **that is an artifact**: Weave is meant to be one large sign
wrapping the core, so a lone Weave reading as asymmetric is a known false flag
(signs-semi-directional.md:140-142). The exported ring was open (prepared); this doc documents the
activated (closed) form.

## Composition
- **Substance (sigil):** Crystal — **create + manipulate**, self-sufficient (conjures its own
  crystal, no source needed), natural state rigid/solid (substances.md:290-292; sigils.md:197).
- **Form (sign):** Weave ×1, large (2.35×), surrounding the core — a `transmute` operator that
  "turns solid objects into long, flexible ribbons" (signs-semi-directional.md:131-134). Its size
  sets the ribbon's **length/reach**, not its force.
- **Ring:** closed/active (canonical form; the export was open/prepared).
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
Engine scaffold: *"The crystal is woven into a long, flexible ribbon."*

**Reading (mine):** the Crystal sigil conjures hard crystal, and the large Weave wrapped around it
transmutes it into a long, flexible ribbon — a continuous crystalline band that bends like a strap
despite being solid crystal. The whole feat is **overriding crystal's natural rigidity**, making a
hard, brittle material supple. At 2.35× the Weave is large, so the ribbon is **long**. A
shaping/utility spell — no aim, no projectile, no burst.

**Canon nuance (not a flaw — the seal is never shown, so flagged):** Weave is a transmute that acts
"on contact" with a solid, and the lexicon notes that on a manipulate-substance it "needs a real
solid present" (signs-semi-directional.md:133-134). But Crystal also *creates*. Two compatible
readings:
- **Most natural — self-supplying:** the sigil conjures fresh crystal and the Weave shapes it into
  the ribbon in one motion (no external material). This is what its create-capability buys, and the
  cleanest differentiator from the earth Boulder Stretch Rope.
- **Alternative — reshaping:** it transmutes an *existing* crystalline object into a flexible
  ribbon.
Both hold; I lean self-supplying but the seal is unshown, so the ambiguity stands.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Crystal sigil | Substance (self-creating, rigid) | No material → no ribbon; an earth core instead would need a real solid fed in |
| Weave ×1 | Transmutes solid → flexible ribbon | The defining operator; without it you'd get raw rigid crystal, not a ribbon |
| Scale 2.35× | Sets ribbon **length** | Smaller Weave → a shorter ribbon (not a weaker one — size ≠ force here) |

## Element behavior & canon grounding
- **Self-sufficiency:** because crystal **creates**, this is self-contained — unlike its earth
  cousin **Boulder Stretch Rope**, which runs in earth's *manipulate-only* mode and needs a real
  boulder fed in ("a loom that needs raw stone," signs-semi-directional.md:143-145). Crystal Ribbon
  is essentially a self-supplying Boulder Stretch Rope, in crystal.
- **The drama is overriding rigidity:** crystal is naturally hard and brittle; Weave forces it into
  a *flexible* ribbon — the same feat Weave performs on rock in Boulder Stretch Rope.
- **Closest canon analogues:**
  - **Crystal Shard** (sibling — same Crystal core, but inverted Columns): erupts **rigid shards**
    as a burst/attack. Same substance, opposite character — Shard keeps crystal's brittle rigidity
    and weaponizes it; Ribbon overrides the rigidity for a flexible strand. Shaping vs. shattering.
  - **Light Tracer** (light + Weave): a ribbon of *light*. Crystal Ribbon is its tangible, material
    counterpart — a physical crystalline ribbon instead of an intangible light one.

**Bottom line:** a self-supplying shaping spell that conjures crystal and weaves it into a long,
flexible ribbon, its whole feat being to make a rigid material supple. The gentle, utility face of
the Crystal sigil — the flexible counterpart to Crystal Shard's brittle eruption, and the
self-sufficient (crystal) version of Boulder Stretch Rope.

## How to draw it
1. Draw the **Crystal sigil** at the center.
2. Wrap a single **Weave** sign around it (the large looping glyph that *surrounds* the core — not
   a ring of several).
3. Scale the Weave up for a **longer** ribbon (size = length, not force).
4. Keep it the lone keystone; the "asymmetric" look is expected for a single wrapping Weave.

## Usage ideas
- **Restraints / binding** — wrap and hold something in a crystal ribbon (flexible to apply, hard
  to break).
- **Cordage & climbing** — a long crystalline strap/rope where you need rigidity *and* give:
  lashings, a handrail, a tether.
- **Craft / decorative** — sashes, bands, or woven crystal structures (Richeh's signature artistry).
- **Repair / splint** — a flexible-then-set crystal band wrapped around a broken object.

## Similar spells
- **Crystal Shard** — same Crystal core with inverted Columns; erupts rigid shards. The brittle,
  offensive counterpart to this flexible, utility spell.
- **Boulder Stretch Rope** — same Weave sign on earth (manipulate-only); needs a real boulder fed
  in. Crystal Ribbon is the self-supplying crystal version.
- **Light Tracer** — same Weave sign on light; an intangible ribbon of light.

## Notes & limitations
- **Engine artifacts:** the "asymmetric / potentially unstable" flag is a single-Weave artifact
  (Weave is one surrounding keystone), and "power 2.35" should be read as ribbon **length**, not
  blast strength.
- **Canon nuance:** self-supplying vs. reshaping an existing crystal (see Deduced effect) — the
  seal is never shown in canon, so the recipe is a reconstruction.
- **Not forbidden** — a benign shaping/utility spell.

## Reproduction
- **Image:** requested from user (none yet).
- **JSON:** [assets/spells/Crystal_Ribbon.json](../../assets/spells/Crystal_Ribbon.json)

```json
{
  "format": "wha-spell@2",
  "name": "Crystal Ribbon",
  "circles": [
    {
      "id": "k1",
      "name": "Circle 1",
      "center": { "x": 0, "y": 0 },
      "radius": 170,
      "ring": { "closed": true },
      "core": { "id": "c1", "type": "crystal", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false },
      "components": [
        { "id": "c2", "type": "weave", "role": "sign", "x": 0, "y": 0, "rotation": 180, "scale": 2.35, "inverted": false, "mirrored": false }
      ],
      "dyes": [],
      "inkColor": null
    }
  ],
  "relations": []
}
```
