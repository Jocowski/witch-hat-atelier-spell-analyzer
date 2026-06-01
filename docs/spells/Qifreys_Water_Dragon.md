---
name: Qifrey's Water Dragon
type: water
origin: canon
forbidden: false
status: valid
core: dragon (decorative shape-giver) + water ×4 (+ flower_water decorative sigil)
signs: enlarge ×1, convergence ×4, column ×8
dyes: azuremoon (Azuremoon Flower — duration)
symmetry: bilateral
source: Witch Hat Atelier — Qifrey subdues the dragon attacking Coco in the Illusory Labyrinth (wiki/manga).
image: none yet
json: assets/spells/Qifreys_Water_Dragon.json (app export, embedded below)
---

# Qifrey's Water Dragon

> A water spell that gathers water from nearby clouds (and likely bodies of water) to
> form a giant dragon of water, which collapses into a water lily before the spell ends.

## Overview
Qifrey's Water Dragon is a **water** spell that draws water out of nearby clouds — and
likely nearby bodies of water — and shapes it into an enormous dragon. A central **Dragon
decorative sigil** gives the construct its serpentine form; a ring of four **Water sigils**
and four **Convergence** signs collects the source water and feeds it into the seal; an
**Enlarge** sign blows the dragon up to its giant size; and eight balanced **Column** signs
dictate the direction it manifests in. When the spell ends, a **modified Water Flower
sigil** lets the gathered water settle into the shape of a **water lily** before it stops.
Qifrey uses it to subdue the dragon that was attacking Coco in the Illusory Labyrinth.

## Validity
**Valid.** Engine: `valid=true`, bilateral symmetry → **stable**, balanced, no spin, no
unknown ids, no warnings. A complete seal: substance (water, shaped by the Dragon sigil)
plus a full operator stack (collection → grow → project).

## Composition
- **Substance (sigils):**
  - **Dragon (core, decorative)** — the **shape-giver**: *"Causes magic to manifest in the
    shape of a dragon"* ([sigils.md:133](../sigils.md#L133)). Decorative sigils carry no
    element of their own; they mould the present substance into a creature's form.
  - **Water ×4 (`element:water`)** — the **substance**, ringed at N/E/S/W. Water *"works to
    manipulate, collect, and create water… many water spells meant to be used over long
    periods collect water rather than create it"* ([sigils.md:41](../sigils.md#L41)). This
    spell runs in that **collect** mode — it pulls water from the environment, it does not
    conjure it from nothing.
  - **Water Flower (`flower_water`, decorative)** — the **end-state shaper**: a flower seal
    *"whose petal-arches are swapped for water droplets — shapes gathered water into a lily
    as it settles"* ([sigils.json:279](../../data/sigils.json#L279)). It frames the dragon
    at the center and, when the dragon dissipates, settles the gathered water into a water
    lily.
- **Form (signs):**
  - **Convergence ×4** (semi-directional, [signs.md:107](../signs.md#L107)) — small,
    balanced, points-inward at the center. Here they are the **intake**: they *"converge"*
    the water in nearby clouds to a point so the Water sigils can incorporate it into the
    spell.
  - **Enlarge ×1** (semi-directional, center, scale 4, [signs.md:231](../signs.md#L231)) —
    corners-out (not inverted) ⇒ **grow**. Blows the dragon up to its giant size.
  - **Column ×8** (directional, four balanced tilted pairs, [signs.md:34](../signs.md#L34))
    — **dictate the dragon's direction** of manifestation. Balanced ⇒ coherent projection,
    not a one-sided lean.
- **Ring:** closed.
- **Ink / dyes:** **Azuremoon Flower** — increases **duration** ([dyes.json](../../data/dyes.json)),
  fitting a sustained construct.

## Deduced effect
Engine summary: *"The spell's magic and water grows far beyond its normal size. The effect
is focused down to a single point… projected as a tight column/beam."* Power **0.73**
(*"concentrated to a point (Convergence) — narrower but more intense"*); aim reads **above
the seal** (balanced Columns).

In plain language (and corrected against canon): the seal **converges and draws in water
from nearby clouds/water bodies, shapes it into a colossal dragon, and projects it in a
chosen direction** — then lets it settle into a water lily as it dissipates. The engine's
"focused to a single point" reflects Convergence; canon tells us that point-convergence is
acting on the *source* water (gathering it), not just on the output.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Water ×4 | substance | Provides/holds the water body; in collect mode, the medium that pulls in cloud-water |
| Dragon | decorative sigil / shape | Forces the gathered water into a **dragon** form |
| Convergence ×4 | semi-directional / collect | **Intake** — converges nearby cloud-water to a point so it can be incorporated |
| Enlarge | semi-directional / transmute | Grows the dragon to **giant** size (remove → a normal-sized water dragon) |
| Column ×8 | directional / form | **Direct** the dragon's manifestation; balanced ⇒ coherent, no lean |
| Water Flower | decorative sigil / shape | **End state** — settles the spent water into a **water lily** |
| Azuremoon | dye | Lengthens the duration |

## Element behavior & canon grounding
The decisive constraint is **create vs. collect**. Water can do both, but *"creating water
is more energetically costly than collecting it"* and long-running spells collect
([sigils.md:41](../sigils.md#L41)). Canon confirms this dragon **collects**: it *"uses water
from nearby clouds (and likely bodies of water)."* So — unlike a dragon conjured from
nothing — it **needs a water source in the environment**: humid air, cloud cover, a lake.
It is closer to *"a pump that needs a reservoir"* than to a self-sufficient construct; the
reservoir here is the **atmosphere and surrounding water**.

That reframes **Convergence**. Convergence *"causes the magic of its spell to converge,
centering down to a single point,"* and it can also *"make loose particles pack tightly
together and become somewhat rigid"* (the trick the disciples used for the Serpent's Bed of
Sand) ([signs.md:107](../signs.md#L107)). It would be tempting to read the four Convergence
signs as *compacting* the water into a dense, battering body — but canon assigns them the
**collection** job: they converge the water held in nearby clouds to a point so the Water
sigils can pull it in. The rigidity reading is a documented secondary capability of the
sign, not its role here.

**Enlarge** then does what it says — grows the construct ([signs.md:231](../signs.md#L231))
— and the **eight balanced Columns** set the direction it manifests in
([signs.md:34](../signs.md#L34)); balanced placement keeps the projection coherent rather
than leaning to one side. The **Water Flower** is the elegant closer: because water is a
fluid with no shape of its own, when the dragon's animating form lets go the mass would just
collapse — the modified flower sigil catches that collapse and shapes it into a lily
([sigils.json:279](../../data/sigils.json#L279)).

**Closest canon analogues.** By *template* it is **Water Horse**: water + a decorative
**creature** sigil = a water body in that creature's shape (Horse there, Dragon here). The
difference is scale and intent — the horse is a modest, steerable draught animal; the dragon
is supersized by Enlarge and aimed by a full ring of Columns. By *water source* its kin are
**Vapor Bubble** and **Rainbringer** — water spells that **harvest water from the
environment** rather than create it, running in the cheaper collect mode.

**Bottom line.** Qifrey's Water Dragon is *Water Horse's template scaled to a kaiju, fed by
the sky*. It does not conjure water from nothing: the four Convergence + four Water sigils
drain water from nearby clouds and water bodies, the Dragon sigil moulds it into a giant
serpent, Enlarge sets the size, the balanced Columns set the heading, and — when the magic
lets go — the modified Water Flower settles the spent water into a lily. Self-sufficiency is
the one thing it lacks and the one thing the elegant ending makes a virtue of.

## How to draw it
1. **Center:** the **Dragon** sigil as the core, wrapped by the **Water Flower** sigil
   (slightly larger) framing it.
2. **Inner ring (small, ~r16):** four **Convergence** triangles at N/E/S/W, each point
   facing **inward**, upright (not inverted). Keep them balanced — they are the intake.
3. **At center:** one large **Enlarge** sign, corners pointing **outward** (grow, not
   shrink).
4. **Mid ring (~r120):** four **Water** sigils at N/E/S/W — the substance.
5. **Outer ring (~r120, in the corners):** eight **Column** signs in four balanced pairs,
   tilted symmetrically so no single side dominates (keeps the projection coherent).
6. **Symmetry:** maintain **bilateral** balance throughout for stability. Bigger, neater
   seal ⇒ a bigger, more stable, longer-lasting dragon.
7. **Ink:** mix in **Azuremoon Flower** dye to extend the duration.

## Usage ideas
- **Subdue large threats (canon):** Qifrey uses it to overpower the dragon attacking Coco in
  the Illusory Labyrinth — a towering water construct that pins without being inherently lethal.
- **Coastal / weather-fed defense:** most effective near clouds, rain, or open water, where
  the source is plentiful — a firefighting or flood-pushing giant.
- **Crowd / beast control:** the dragon's bulk shoves and overwhelms rather than cuts.
- **Spectacle that disperses cleanly:** the water-lily collapse makes it a dramatic showpiece
  with a graceful, non-destructive ending.

## Similar spells
- **Water Horse** — same template (water + decorative creature sigil); a small steerable
  draught horse vs. this giant aimed dragon.
- **Vapor Bubble Spell / Rainbringer Seal** — water spells that **collect** environmental
  water rather than create it; closest by source mechanism.
- **Watershot Seal** — the Column-projection lineage, but a plain directed jet rather than a
  shaped body.

## Notes & limitations
- **Needs a water source.** Runs in water's collect mode — most reliable near clouds, rain,
  or bodies of water; far from any source it has little to draw on.
- **Engine artifacts to override:** the doubled *"the the … magic and water"* is a string-join
  glitch; *"aim above the seal"* is the balanced-Column reading; *"focused to a single point"*
  is Convergence, which canon clarifies is collecting the *source* water, not only the output.
- **Not forbidden:** a water construct — no body magic, reality-warping, or mass destruction
  ([forbidden-magic.md](../forbidden-magic.md)). (Drawn within the Illusory Labyrinth, itself a
  forbidden spell, but the Water Dragon is not.)

## Reproduction
- **Image:** requested from user (canon reference at
  `assets/images/spells/Qifreys_Water_Dragon.png`).
- **JSON:** [`assets/spells/Qifreys_Water_Dragon.json`](../../assets/spells/Qifreys_Water_Dragon.json)
  — authoritative app export (`wha-spell@2`), reproduced below:

```json
{
  "format": "wha-spell@2",
  "name": "",
  "circles": [
    {
      "id": "k4", "name": "", "center": { "x": 0, "y": 0 }, "radius": null,
      "ring": { "closed": true },
      "core": { "id": "c21", "type": "dragon", "x": 0, "y": 0, "rotation": 0, "scale": 0.5, "inverted": false },
      "components": [
        { "id": "c22", "type": "flower_water", "role": "sigil", "x": 0, "y": 0, "rotation": 0, "scale": 1.3, "inverted": false },
        { "id": "c23", "type": "enlarge", "role": "sign", "x": 0.6251230239868164, "y": 1.8753809928894043, "rotation": 0, "scale": 4, "inverted": false },
        { "id": "c24", "type": "convergence", "role": "sign", "x": 1.2502487897872925, "y": -16.864425659179688, "rotation": 0, "scale": 0.3, "inverted": false },
        { "id": "c25", "type": "convergence", "role": "sign", "x": 16.864431381225586, "y": -0.6251243352890015, "rotation": 90, "scale": 0.3, "inverted": false },
        { "id": "c26", "type": "convergence", "role": "sign", "x": 1.250248908996582, "y": 16.239301681518555, "rotation": 180, "scale": 0.3, "inverted": false },
        { "id": "c27", "type": "convergence", "role": "sign", "x": -16.239303588867188, "y": -1.2502487301826477, "rotation": 270, "scale": 0.3, "inverted": false },
        { "id": "c28", "type": "water", "role": "sigil", "x": 127.25359497070312, "y": 1.5074566841125545, "rotation": 270.6786988298785, "scale": 0.45, "inverted": false },
        { "id": "c29", "type": "water", "role": "sigil", "x": -1.421393587812787, "y": 116.72711334228515, "rotation": 0, "scale": 0.45, "inverted": false },
        { "id": "c30", "type": "water", "role": "sigil", "x": -120.47786865234374, "y": -2.046516680717474, "rotation": 90.94379351890132, "scale": 0.45, "inverted": false },
        { "id": "c31", "type": "water", "role": "sigil", "x": 0.1711403965950069, "y": -121.72810516357421, "rotation": 0, "scale": 0.45, "inverted": false },
        { "id": "c32", "type": "column", "role": "sign", "x": 31.5271011352539, "y": -118.80114288330077, "rotation": 194.8624129343209, "scale": 0.6, "inverted": false },
        { "id": "c33", "type": "column", "role": "sign", "x": 123.39975280761718, "y": 29.34690132141114, "rotation": 283.3775606193242, "scale": 0.6, "inverted": false },
        { "id": "c34", "type": "column", "role": "sign", "x": 121.59872741699218, "y": -23.565349960327154, "rotation": 260.64387364800155, "scale": 0.6, "inverted": false },
        { "id": "c35", "type": "column", "role": "sign", "x": 27.762042617797846, "y": 120.02261657714843, "rotation": 337, "scale": 0.6, "inverted": false },
        { "id": "c36", "type": "column", "role": "sign", "x": -24.11908111572265, "y": 119.69208831787108, "rotation": 23, "scale": 0.6, "inverted": false },
        { "id": "c37", "type": "column", "role": "sign", "x": -118.54963989257811, "y": 25.893823242187494, "rotation": 77.67886084350806, "scale": 0.6, "inverted": false },
        { "id": "c38", "type": "column", "role": "sign", "x": -116.52338714599608, "y": -34.35813674926757, "rotation": 113, "scale": 0.6, "inverted": false },
        { "id": "c39", "type": "column", "role": "sign", "x": -27.22310600280761, "y": -118.39876098632811, "rotation": 157, "scale": 0.6, "inverted": false }
      ],
      "dyes": ["azuremoon"], "inkColor": null
    }
  ],
  "relations": []
}
```
