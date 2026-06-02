---
name: Sand Bridge
type: earth
origin: wiki
forbidden: false
status: valid (partly unidentified)
core: sand_bridge (unidentified central sigil; inner circle)
signs: column ×6, unknown_05 ×4, unknown_09 ×4, unknown_11 ×2, radial ×2 (inverted), strengthen ×4, unknown_10 ×4, unknown_06 ×2
dyes: none
symmetry: bilateral (outer ring) / radial (inner)
source: telepedia "Sand Bridge": https://witchhatatelier.telepedia.net/wiki/Sand_Bridge — manga debut ch. 12, anime ep. 8. Niche spell; the central sigil and five sign types are unidentified.
image: assets/spells/Sand_Bridge.png
json: assets/spells/Sand_Bridge.json
---

# Sand Bridge

> Shapes existing sand into a temporary, reinforced bridge, raised one pillar/section at a time to span a gap.

## Overview
Sand Bridge is a **niche** earth/sand spell drawn as a **two-circle nested seal**:
- **Inner circle** — the **`sand_bridge`** central sigil (unidentified; functions as the earth/sand substance) flanked by a Region-like **`unknown_06`** pair.
- **Outer circle** — a **coreless modifier ring** (engine `contextRole: modifier`) that shapes the inner seal: large **Columns**, **Strengthen**, **inverted Radial**, the **`unknown_11`** "bridge" glyph, and three unidentified marks.

The firmly-known signs are **Column** and **Strengthen**; the central sigil and `unknown_05/06/09/10/11` are catalogued from the seal art (user-supplied; matches the canon/anime seal).

## Validity
**Valid** (engine) — two circles, properly **nested** (`k3` inside `k2`); the outer is a legal **modifier ring** and the inner carries the substance. Both circles are **stable** (outer bilateral, inner radial) and **balanced**. The engine flags **`hasUnknownSigns: true`** on both circles — six unidentified glyph types — so the effect reading is partial by construction. **Confidence: low.**

## Composition
**Inner circle (substance):**
- **`sand_bridge` sigil** (element **earth**) — the sand/earth being shaped.
- **`unknown_06` ×2** — Region-like chevron-with-dot, flanking the core; *unidentified* (theory: steers where the sand goes).

**Outer modifier ring (form):**
- **Column ×6** — 2 large on the N/S axis (scale 2.2) + 4 smaller at the intercardinals. Raise the sand into upright pillars; the oversized N/S pair biases the span along that axis.
- **Strengthen ×4** (scale 1.6, diagonals) — reinforce the pillars to bear weight.
- **Radial ×2, inverted** (E/W, outermost) — power-tuner; see the theory note below.
- **`unknown_11` ×2** (E/W, scale 1.6) — the "bridge" pictograph; likely the arch/deck shape-giver.
- **`unknown_05` ×4** (half-circle arcs, near the N/S Columns), **`unknown_09` ×4** (dumbbells), **`unknown_10` ×4** (parallel-line marks, diagonals) — *unidentified*.

## Deduced effect
A **two-stage sand-shaping device.** The inner ring raises existing sand (the `sand_bridge` earth core, steered by the `unknown_06` pair) — the engine's inner readout is *"the earth, stone and sand rises up as rock and sand."* The outer modifier ring then **forms that risen sand into a reinforced bridge**: the large N/S Columns project it into **pillars/sections** along the span, **Strengthen** makes them solid enough to bear weight, the **bridge glyph** imposes the arch/deck form, and the **inverted Radial** tunes the structural intensity. Per canon the result is **temporary** and built **one pillar at a time**.

### How each part shapes it
| Part | Role | Without it |
|------|------|-----------|
| `sand_bridge` core (earth) | substance | No sand to shape |
| `unknown_06` ×2 | steer (theory) | Sand rises undirected, not aimed across the gap |
| Column ×6 (2 large N/S) | raise into pillars, set span axis | No pillars; no directional span |
| Strengthen ×4 | reinforce / bear load | Bridge too weak to walk on |
| Radial ×2 (inverted) | tune power (un-temper — theory) | Output mis-tuned (too soft, per normal Radial) |
| `unknown_11` ×2 | bridge/arch form (theory) | Loses the bridge shape |
| `unknown_05/09/10` | unidentified | Unknown — likely binding/structure |

## Element behavior & canon grounding
**Earth can't create — so this is a shaper, not a fountain.** The earth sigil *"allows for the manipulation of … wood, stone, sand, and soil. **However, it does not allow for the creation** of these solid materials"* ([sigils.md:53](../sigils.md#L53)). Sand Bridge therefore needs a **real sand/soil source** under or around the seal and **rearranges** it into a span — a "pump that needs a reservoir," the same constraint behind **Boulder Stretch Rope**, **Sand Cage**, and **Serpent's Bed of Sand**. The engine's nearest catalog neighbours are exactly **Serpent's Bed of Sand** and **Sand Cage**.

**Granular sand fits the Column "raise" mechanic.** Column *"causes a spell to manifest in a column or beam… if the signs aren't balanced, the spell will manifest in the direction with the most or largest signs"* ([signs.md:34](../signs.md#L34)). Loose sand flows and packs, so the oversized N/S Columns lift it into pillars and **Strengthen** fuses the grains into a load-bearing solid — the same "make loose grains cohere" logic that makes Sand Cage rigid.

**Inverted Radial — a deduction, not canon (THEORY).** Radial normally *attenuates* power (fire → flameless warmth), and *"has never been seen inverted"* ([signs.md:247](../signs.md#L247)). Here it **is** inverted, and since inverting a semi-directional sign *"reverses its effect"* ([signs.md:18](../signs.md#L18)), the most sensible reading is that it **un-tempers / firms up** — cancelling Radial's softening so the structure sets firm enough to bear weight (a power-*reducer* would be the wrong tool for a load-bearing bridge). **This is a first-principles inference, not a canon-stated effect** (recorded as a theory in the Radial lexicon Findings). *Engine blind spot:* the engine is inversion-blind for Radial and still labels it "weakened on purpose" — don't trust its power label here.

**vs. Serpent's Bed of Sand (closest analogue).** *Same:* both are multi-circle earth/sand devices that raise/mill existing sand via a modifier ring + reinforcement. *Different:* Serpent's Bed makes the sand **soft and self-restoring**; Sand Bridge makes it **rise into rigid, reinforced pillars** that span a gap. *Why:* Columns (raise into pillars) + the bridge glyph (arch/deck) + un-tempered power, vs. Billow/Repetition for fluffiness.

**Bottom line.** A feasible earth construction spell — a modifier ring that forges a reservoir of loose sand into a temporary, reinforced, span-shaped bridge — with the inverted Radial as the clever twist (firming where Radial normally softens). Confidence **low**: the central sigil and five sign types are unidentified, so the exact sequencing ("one pillar at a time") is reasoned, not decoded.

## How to draw it
1. **Inner circle:** the `sand_bridge` sigil at center, flanked by the `unknown_06` pair (pointing inward).
2. **Outer circle (modifier ring):** two large **Columns** at north and south (+ 4 smaller at the intercardinals); **Strengthen** at the four diagonals; **inverted Radial** at east and west (outermost); the **`unknown_11` bridge glyph** at east and west.
3. Add the unidentified `unknown_05` (arcs, near the N/S Columns), `unknown_09` (dumbbells), and `unknown_10` (parallel-line marks, at the diagonals).
4. Nest the inner circle inside the outer ring.
5. Use over real sand/earth — earth magic shapes existing material, it doesn't create it.

## Usage ideas
- **Cross a chasm / ravine** over sandy or soily ground (the canon use).
- **Temporary causeway** over mud, a stream bank, or broken terrain.
- **Emergency pillar / brace** — raise a single reinforced sand column as a step or support.

## Similar spells
- **Serpent's Bed of Sand** — multi-circle sand device, but soft/self-restoring instead of rigid pillars.
- **Sand Cage** — rigid sand construction (a cage); shares the "make loose sand cohere" basis.
- **Boulder Stretch Rope** — Richeh-style earth spell that *shapes* existing stone into a ribbon.

## Notes & limitations
- **Two-circle nested seal**; the outer ring is coreless (a modifier ring) and the inner ring carries the `sand_bridge` substance.
- **Six unidentified glyph types** (the `sand_bridge` sigil + `unknown_05/06/09/10/11`) — confidence **low**; run `npm run unknown:report` as these marks recur elsewhere.
- **Inverted Radial effect is a theory** (un-temper/firm), not canon — see [docs/lexicon/signs-semi-directional.md](../lexicon/signs-semi-directional.md) Radial Findings.
- Engine "aim: above the seal" is Column's out-of-plane default; physically the bridge extends across, not literally up.
- The `sand_bridge` sigil's element is treated as **earth**; it lives in the palette under **Misc**.

## Reproduction
- **Image:** the user-supplied seal (matches the canon/anime seal); symbol crops vectorized into `assets/images/signs/unknown/` (Unknown_05/06/09/10/11) and `assets/images/sigils/Sand_Bridge.png`.
- **JSON:** [assets/spells/Sand_Bridge.json](../../assets/spells/Sand_Bridge.json) (the authoritative two-circle `wha-spell@2` export).
