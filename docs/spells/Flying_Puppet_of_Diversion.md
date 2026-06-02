---
name: Flying Puppet of Diversion
type: wind
origin: wiki
forbidden: false
status: valid
core: wind
signs: dancing_puppet ×1 (large, surrounds the sigil)
dyes: none
symmetry: radial (a single surrounding sign is the whole form)
source: canon (manga) — Tetia diverts the dragon in the Underground Labyrinth by casting it on her cloak and hat
image: assets/images/spells/Flying_Puppet_of_Diversion.png
json: assets/spells/Flying_Puppet_of_Diversion.json
---

# Flying Puppet of Diversion

> A wind spell that makes the object it's drawn on dart and fly erratically through the sky —
> mind-piloted, and strong enough to carry things aloft.

## Overview
Flying Puppet of Diversion is a canon **wind** spell: a wind sigil surrounded by a single large
**Puppet** (dancing puppet) keystone. Drawn on an object, it sends that object darting up into
the sky and flitting about erratically, with enough force to lift it. Tetia used it on her
**cloak and hat** so the empty garment would fly off as a convincing **decoy**, diverting the
dragon that was chasing the apprentices in the Underground Labyrinth.

## Validity
Engine: **valid** (wind core, no unknown ids, no warnings). A single Puppet sign *surrounds* the
sigil and **is the whole form** — so the engine's `symmetry: asymmetric` is the **single-sign
artifact**, not real instability (the stability warning only triggers at ≥2 signs). `power: 3.85`
→ "amplified by large drawing." (Ring closed.)

## Composition
- **Substance (sigil):** **Wind** (`wind`, element `air`) — moves and manipulates air but
  **cannot create** it ([sigils.md:65](../sigils.md)). It pilots the drawn object through the air
  rather than conjuring wind.
- **Form (sign):** **Puppet** (`dancing_puppet`, semi-directional, kind `motion`), drawn large
  and surrounding the sigil. Puppet is the rare **mind-control** sign — it lets a user (the drawer
  or last to touch the seal) steer the **object the spell is drawn on**, and its behavior is
  **sigil-keyed**: with wind it produces **aerial movement** ([signs.md:295](../signs.md)).
- **Ring:** closed.
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
*Reasoned from [docs/CORE.md](../CORE.md) + the lexicon, using the engine facts.* Drawn on an
object, the spell makes that object **fly and dart erratically through the sky, mind-piloted**,
with enough lift to carry it (and what it's attached to) upward. The engine's grammar synergy
confirms the pairing: *"With a wind element, Dancing Puppet sends objects darting through the open
air."* Cast on a cloak and hat, it becomes a self-flying decoy.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Wind | sigil (substance) | The aerial medium/force; manipulate-only, so it animates the drawn object instead of creating wind. |
| Puppet ×1 (large surround) | sign · motion | Supplies the erratic, mind-steered flight; on wind = aerial movement. Its **size** sets the power/lift. |

## Element behavior & canon grounding
**Wind moves but does not create air** ([sigils.md:65](../sigils.md)), so the spell pilots the
object it is inked on — it doesn't summon a gust from nothing. **Puppet's effect is element-keyed**
([signs.md:295](../signs.md)): paired with wind it specifically yields flight; the mind-piloting is
inferred from canon (Sasaran steering his cloak with no visible controls). **Size sets power**: the
large Puppet (engine `power ~3.85`, "amplified") matches Tetia drawing it big enough to be a
noticeable, liftable decoy.

- **Closest kin — the Cloak Spell** ([signs.md:297](../signs.md)): the *same* wind + Puppet
  template — a mind-piloted flying garment. The difference is application: the Cloak is **worn and
  piloted**; the Flying Puppet of Diversion is **cast off as a decoy**. Same recipe, opposite
  intent (keep and wear vs. throw away to mislead).
- **Bottom line:** a textbook wind-puppet flight spell — pilot the object the seal is drawn on
  through the air by mind, deployed here as a self-flying decoy. Faithful and high-confidence.

## How to draw it
1. **Wind** sigil at the center.
2. A single large **Puppet** keystone *surrounding* the sigil (it's a surround sign — one big copy,
   not a ring of several). Draw it large for more lift/power.
3. Close the ring. Draw it on the object you want to fly (e.g. a cloak/hat for a decoy).

## Usage ideas
- A flying **decoy** to draw off a pursuer (canon).
- A remote-piloted **scout/messenger** or self-delivering object.
- Worn flight, like the Cloak Spell, if inked on a garment you keep.

## Similar spells
- **Cloak Spell** — same wind + Puppet mechanic, worn and piloted rather than discarded.
- **Sealchair** — features puppet-like signs on its underside (possible variants); also piloted
  without visible controls.

## Notes & limitations
- **Not forbidden** — it acts on an **object** (cloak/hat), not a human body.
- Puppet *may* be invertible (semi-directional), but canon is unsure ([signs.md:295](../signs.md))
  — don't assume an inverted meaning.
- The engine's single-sign `asymmetric` reading is an artifact; one large surround sign is the
  intended whole form.

## Reproduction
- **Image:** [assets/images/spells/Flying_Puppet_of_Diversion.png](../../assets/images/spells/Flying_Puppet_of_Diversion.png) (canon reference) · engine render: [assets/spells/Flying_Puppet_of_Diversion.svg](../../assets/spells/Flying_Puppet_of_Diversion.svg)
- **JSON:** [assets/spells/Flying_Puppet_of_Diversion.json](../../assets/spells/Flying_Puppet_of_Diversion.json)

```json
{
  "format": "wha-spell@2",
  "name": "Flying Puppet of Diversion",
  "circles": [
    {
      "id": "k8", "name": "Circle 1",
      "center": { "x": 0, "y": 0 }, "radius": 110,
      "ring": { "closed": true },
      "core": { "id": "c50", "type": "wind", "x": 0, "y": 0, "rotation": 0, "scale": 1 },
      "components": [
        { "id": "c51", "type": "dancing_puppet", "role": "sign", "x": 0, "y": 1.87, "rotation": 180, "scale": 3.85 }
      ],
      "dyes": [], "inkColor": null
    }
  ],
  "relations": []
}
```
