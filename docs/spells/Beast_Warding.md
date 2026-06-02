---
name: Beast Warding
type: mixed
origin: wiki
forbidden: false
status: valid
core: warding_pillar (+ light ×2)
signs: unknown_12 ×2, column ×4 (inverted)
dyes: none
symmetry: bilateral
source: telepedia "Beast Repellent" (also called Beast Warding) — https://witchhatatelier.telepedia.net/wiki/Beast_Repellent. A common utility seal that keeps wild animals away; listed among Mixed Spells (spells.md) and Light spells (sigils.md:31).
image: none yet
json: assets/spells/Beast_Warding.json
---

# Beast Warding

> A stationary, self-lit ward that glows evenly on all sides and keeps wild animals out of the lit zone.

## Overview
Beast Warding (canon **Beast Repellent**) is a common utility seal. Set down, it conjures its
own light and spreads it omnidirectionally around the seal, marking out a glowing area that
wild animals avoid. It doesn't move, fire, or project in any direction — it's an area ward, not
a weapon. The central sigil that carries the actual beast-repelling effect is **unidentified** in
the source material, so *why* animals avoid it can't be derived from first principles — only that
the surrounding light + sign apparatus broadcasts it evenly outward.

## In plain terms (sum up)
You set it down and it lights up, glowing softly in every direction — and animals won't come
near it. Think of it as a **magic lantern that also keeps beasts away.**

1. **It makes its own light.** The two Light sigils on the left and right conjure light out of
   nothing — no candle or fire needed. It just glows, anywhere you put it.
2. **It spreads that light all around, not in a beam.** The four "Column" signs are flipped
   (inverted), which pushes the light *outward on every side* instead of firing it forward — an
   even glow filling the space, like a campfire lighting a clearing.
3. **The center does the "scare off beasts" part.** The staff sigil in the middle (and the two
   ✕ ward-marks above and below it) make animals avoid the spot. The honest catch: **we don't
   actually know how that part works** — its symbol has never been identified. We only know
   *that* it repels beasts, not the mechanism.

**Result:** a stationary glowing ward — stays put, shines evenly all around, and creates a
circle of space wild animals won't enter. Gentle and not dangerous. **Best for:** a campsite at
night (light + protection in one), a safe marker on a wild trail, or guarding a livestock pen.
**Simplest comparison:** it's the exact opposite of a *Light Beam* — same conjured light, but
spread into a soft protective halo instead of focused into a beam.

## Validity
**Valid** (engine fact). The seal has a core substance and well-formed signs; `valid: true`, no
unknown ids, stable (bilateral symmetry). The exported ring is open (a "prepared" seal); closing
it activates the spell — this doc documents the activated form. Ring open/closed is only the
app's activation visual and isn't part of the effect.

## Composition
- **Substance (sigils):**
  - **Warding Pillar** (core, element **unknown**) — the unidentified Beast Repellent center
    sigil; the actual warding agent. Substance and capability cannot be derived (CORE.md §6).
  - **Light ×2** (E/W, element **light**) — a fire variant, **create-capable/self-sufficient**,
    "shines outward" (sigils.md:29; substances.md:64-66). Makes the seal self-lit.
- **Form (signs):**
  - **Unknown Sign 12 ×2** (N/S poles) — the warding cross; operator unidentified, read only
    contextually as the repelling keystone.
  - **Column ×4, inverted** (diagonals) — `form` operator; inverted, the magic is "driven inward
    and erupts rather than projecting out, emitting on all sides" ≈ Dispersion
    (signs-directional.md:18-22). Four balanced copies → even all-around spread.
- **Ring:** closed/active (canonical form; the export was open/prepared).
- **Ink / dyes:** plain conjuring ink.

## Deduced effect
Engine scaffold (not authoritative): *"An unknown force and light is driven inward and erupts
rather than projecting out, above the seal."*

**Reading (mine):** a stationary, all-around **ward-lantern**. The Light sigils conjure light;
the four inverted Columns push it outward on every side instead of focusing it — a steady, even
radiance filling the space around the seal. The N/S ward-crosses and the unidentified core carry
the *"beasts keep away"* function. No motion, no spin, ordinary intensity → an area ward, not a
projectile.

> **Override the engine:** facts report aim *"above the seal."* That's an artifact — 4 balanced
> Columns produce a false "beam above" label (signs-directional.md:36-37), and lateral aim the
> engine reports on light is also an artifact (substances.md:73). **Real aim: omnidirectional.**

**Hypotheses for the unidentified core** (speculation, not canon — the central sigil's element is
unknown, so *why* it repels beasts can't be derived):
- **Most likely — a repel/aversion field.** The core projects an instinctive "danger"/aversion
  influence; the light just makes the warded zone visible. *Consequence:* animals avoid the lit
  circle, humans unaffected. *Confirms it:* it still works in daylight (light isn't the deterrent).
- **Possible — the light *is* the deterrent, core only shapes it.** The core tunes the glow into a
  flicker/intensity animals dislike (like fire holding predators back). *Consequence:* only works
  while lit; weak in bright daylight. *Confirms it:* removing the Light sigils kills the warding,
  not just the glow.
- **Long-shot — a territorial marker.** The core "tags" the spot (a scent-mark analog) rather than
  emitting a field; deterrence builds as animals learn to avoid it. *Consequence:* weak at first,
  stronger once established; ineffective on a fresh animal. *Confirms it:* delayed onset, lingers
  after the spell ends.

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| Warding Pillar (core) | Unidentified beast-repel substance | No substance → no spell; this *is* the warding agent |
| Light ×2 | Self-made light to broadcast | Goes dark — loses its lantern / visible-deterrent aspect |
| Column ×4 (inverted) | Spreads emission on all sides | Light loses its enforced shape; **upright** Columns would fire a beam (→ Light Beam, not a ward) |
| Unknown Sign 12 ×2 (N/S) | Warding keystone (unidentified) | Likely loses the specific "repel" tuning; becomes a plain glow |

## Element behavior & canon grounding
- **Self-sufficiency:** because Light **can be created** (substances.md:66), this is a
  self-contained device — unlike an earth/water ward that needs a real reservoir nearby, it needs
  no fuel and works anywhere. A genuine set-and-forget beacon.
- **Inverted Column ≈ Dispersion:** canon cannot distinguish the two, so the light "leaks out on
  all sides like an overflowing bucket" rather than firing (signs-directional.md:65-68). Four
  balanced copies = even perimeter spread. The Column/Dispersion ambiguity is flagged, not papered
  over.
- **Closest canon analogue:** **Light Beam** = Light + *upright* Column → a focused beam. Beast
  Warding is its inverse: Light + *inverted* Columns → an undirected all-around glow. Same
  substance, flipped operator → beam becomes ward-field. It belongs to the "light as steady
  emission" family with **Floatglow Lamp** and **Bird of Light Beacon**, not the "light as weapon"
  family. (The engine's catalog `nearest` — Crystal Shard, Wind Wall, Snugstone — are weak
  coincidental shape-matches, not real analogues.)
- **Honest limit:** the central sigil's element is unidentified, so *why* beasts avoid it can't be
  derived — only that the light + Column apparatus broadcasts whatever the core does, evenly, in
  all directions (CORE.md §6).

**Bottom line:** a stationary, self-lit, omnidirectional ward — light radiated evenly on every
side (inverted Columns ≈ Dispersion over a create-capable Light substance) around an unidentified
beast-repelling core. Mechanically the opposite of Light Beam: the same light, spread as a
deterrent field instead of focused into a beam. The actual repulsion lives in the unknown core and
cannot be fully reasoned out.

## How to draw it
1. **Center:** the Warding Pillar sigil — a vertical staff capped by an upward arrowhead, with
   bracket arms near top and bottom.
2. **North & South poles:** one Unknown Sign 12 ward-cross each, on the vertical axis.
3. **East & West:** one Light sigil each (the windowed/cruciform square), flanking the core.
4. **Four diagonals (NE/NW/SE/SW):** one Column sign each, all **inverted**.
5. Keep the placement balanced (mirror the diagonals and the E/W and N/S pairs) so the spread
   stays omnidirectional and stable — uneven Columns would skew the emission to one side.

## Usage ideas
- **Campsite perimeter** at night — keeps wild animals off while doubling as a lantern.
- **Trail / safe-zone beacon** for travelers crossing beast country.
- **Livestock pen** protection; mount on a post since it's stationary and self-lit.

## Similar spells
- **Light Beam** — same Light substance with *upright* Columns; fires a focused beam. Beast Warding
  is its omnidirectional inverse.
- **Floatglow Lamp Seal / Bird of Light Beacon** — the "light as steady emission" family; Beast
  Warding adds the unidentified repelling core and N/S ward-crosses that make it a *deterrent*, not
  just a lamp.

## Notes & limitations
- **Unidentified core + 2 unknown signs:** the deduction is necessarily incomplete — the effect
  above is a reasoned reading, and the repel mechanism is hypothesis (see Deduced effect). Recorded
  at `confidence: low`.
- **Engine artifacts:** "aim above the seal" (inverted Columns confine/spread, don't beam) and any
  lateral aim/spin on light are artifacts — real aim is omnidirectional.
- **Catalog caveat:** the recipe schema has no extra-sigil field, so the two essential Light sigils
  are recorded in the catalog `notes`, not in `composition`.
- **Not forbidden** — a common, gentle utility spell.

## Reproduction
- **Image:** requested from user (none yet).
- **JSON:** [assets/spells/Beast_Warding.json](../../assets/spells/Beast_Warding.json)

```json
{
  "format": "wha-spell@2",
  "name": "Beast Warding",
  "circles": [
    {
      "id": "k2",
      "name": "Circle 1",
      "center": { "x": 0, "y": 0 },
      "radius": 170,
      "ring": { "closed": true },
      "core": { "id": "c1", "type": "warding_pillar", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false },
      "components": [
        { "id": "c2", "type": "unknown_12", "role": "sign", "x": -1.61, "y": -47.89, "rotation": 180, "scale": 1, "inverted": false, "mirrored": false },
        { "id": "c3", "type": "unknown_12", "role": "sign", "x": -0.63, "y": 47.49, "rotation": 358.66, "scale": 1, "inverted": false, "mirrored": false },
        { "id": "c4", "type": "light", "role": "sigil", "x": -62.61, "y": -0.60, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false },
        { "id": "c5", "type": "light", "role": "sigil", "x": 57.06, "y": 2.33, "rotation": 0, "scale": 1, "inverted": false, "mirrored": false },
        { "id": "c6", "type": "column", "role": "sign", "x": 33.09, "y": -40.27, "rotation": 219.41, "scale": 1, "inverted": true, "mirrored": false },
        { "id": "c7", "type": "column", "role": "sign", "x": -36.12, "y": 37.46, "rotation": 43.96, "scale": 1, "inverted": true, "mirrored": false },
        { "id": "c8", "type": "column", "role": "sign", "x": 45.58, "y": 39.20, "rotation": 310.70, "scale": 1, "inverted": true, "mirrored": false },
        { "id": "c9", "type": "column", "role": "sign", "x": -36.30, "y": -37.59, "rotation": 136.00, "scale": 1, "inverted": true, "mirrored": false }
      ],
      "dyes": [],
      "inkColor": null
    }
  ],
  "relations": []
}
```
