# Witch Hat Atelier — Magic System Cheat-Sheet

Distilled rules for analyzing and designing spells. This is a fast reference; the
**source of truth** is the repo:

- Lore: [docs/magic.md](../../../../docs/magic.md), [docs/sigils.md](../../../../docs/sigils.md), [docs/signs.md](../../../../docs/signs.md), [docs/magical-dye.md](../../../../docs/magical-dye.md), [docs/forbidden-magic.md](../../../../docs/forbidden-magic.md), [docs/spells.md](../../../../docs/spells.md)
- Engine data: [data/grammar.json](../../../../data/grammar.json) (deduction grammar — operators + interactions), [data/sigils.json](../../../../data/sigils.json), [data/signs.json](../../../../data/signs.json), [data/dyes.json](../../../../data/dyes.json), [data/rules.json](../../../../data/rules.json)
- Design rationale: [ANALYSIS.md](../../../../ANALYSIS.md)

When you need the exact id / element / effect text of a part, read the JSON — do
not invent ids. Run the engine (`tools/spell-engine-cli.mjs`) rather than guessing
validity or the deduced effect.

---

## 1. The core equation

```
effect = substance(sigils) × form(signs) × activation(ring) × ink(dyes)
```

- **Sigil** = the *substance/element* (center of the seal). Most spells have ≥1; mixed spells have several.
- **Signs (keystones)** = *operators* that shape how the element manifests (rings around the center).
- **Ring** = activation. A spell only fires when the ring is **closed**. An intentional gap = prepared but inactive.
- **Conjuring ink + magical dyes** = global ink properties (duration, power, invisibility, etc.).

The same signs behave differently per sigil: `column + water` = jet of water; `column + light` = beam of light. This multiplication is the whole game.

## 2. Validity rules (what makes a spell work)

| Severity | Rule | Meaning |
|----------|------|---------|
| **blocking** | core present | Needs a sigil **or** a sign that can sit at center (`vision`, `repetition`, `billowing`, `weave`, `rain`, `bird`, `dancing_puppet`, `enlarge`). No core ⇒ **invalid**. |
| **inactive** | ring closed | Ring open ⇒ prepared but **inactive**. |
| warning | ring empty | Closed ring with nothing inside ⇒ raw discharge = **explosion**. |
| warning | ≥1 sign | Sigil with no signs ⇒ no defined form (raw, undirected). |
| warning | stability | ≥2 asymmetric signs ⇒ may be unstable. Aim for at least **bilateral symmetry**. |
| info | balance | Bigger/more signs on one side skews the effect that way (the Watershot lesson). |
| info | spin | Tilted (rotated) signs make the spell spin: more tilt = more spin, less reach. |

Also: **bigger seals = more powerful**; **neater seals = more stable & longer-lasting**.

## 3. Sigils (substance) — families & elements

Read [data/sigils.json](../../../../data/sigils.json) for the full list of 29. Quick map:

- **fire** family: `fire` (flame/heat), `unburning_flame` (heatless flame), `light` (light; a fire variant)
- **water** family: `water` (manipulate/collect/create water — collecting is cheaper than creating)
- **earth** family: `earth` (stone/sand/soil/wood — manipulate, **cannot create**)
- **air** family: `wind` (move air, not create), `aeriforms` (create air, not move), `wind_underfoot` (air platform / support suspended solids), `whorling_wind` (rotate air)
- **time** family: `repetition_sigil` (rewind/reset an object to a prior state — anti-rot, elasticity), `stop` (halt time; pair with an element to stop just that aspect, e.g. heat)
- **misc**: `crystal` (create/manipulate crystal), `smoke` (create smoke), `guidance` (attract matching objects), `calling` (echo a recorded phrase)
- **decorative**: `bird_a`, `bird_b`, `dragon`, `flower`, `horse`, `owlcat`, `owlcat_head`, `scalewolf`, `torchstag`, `liongoat`, `valance_leech` — make magic manifest in that creature's shape; can affect that creature; mostly hobbyist (Horse/Water Horse shows real utility).
- **special / sign-as-sigil** (hidden in palette): `vision_sigil`, `billowing_sigil`, `repetition_sigil` can occupy the center.

> **Center substance gotcha:** `vision`, `billowing`, `repetition` exist both as *signs*
> (in signs.json, `canBeCenter:true`) and as *sigils* (`*_sigil`, with a real `element`).
> If you want one as the spell's **substance at the center**, use the `*_sigil` variant —
> the engine reads the element from it. A bare *sign* placed at center is still a valid
> core, but it has no element, so the deduction falls back to "an unknown force." Match the
> intent: substance ⇒ `*_sigil`; modifier-at-center ⇒ the sign.

## 4. Signs (operators) — 4 categories

Read [data/signs.json](../../../../data/signs.json) (38 entries; `family` = category). Inversion rules hinge on category:

- **directional** — manifest in a direction; bilateral, not radial; angle/size set the direction. **Invertible.** (column, dispersion, levitation, pull, region[`direction`], collection, sights_set, gather)
- **semi-directional** — invertible, no intrinsic direction; size = strength. **Invertible** (inversion = opposite effect; radial-symmetric ones flip inside-out). (crush, convergence, weave, enlarge, radial, rain, puppet[`dancing_puppet`], strengthen, entwine, aeriforms_defined, glaives, bind, link)
- **non-directional** — radial symmetry, no front ⇒ **NOT invertible**. (float, billow[`billowing`], repetition, diamond, window, crosshair, bolt, eye, vision, bend, cool, orb)
- **asymmetric** — no symmetry, unpredictable; effect of inverting/mirroring unknown. (sign_of_wind, purify)

### Operator kinds (deduction grammar — [data/grammar.json](../../../../data/grammar.json))

Each sign maps to an operator with a `kind`. The deduction pipeline orders them: **transmute → form → motion → direction → target → power → special → support**.

| kind | role | examples |
|------|------|----------|
| `form` | shapes the output channel | column→beam, dispersion→leak, bolt→projectiles, rain→rainfall, orb→sphere, bird |
| `transmute` | changes the substance's state | weave→ribbon, billowing→cloud, crush→dust, enlarge→grow/shrink |
| `motion` | adds movement | levitation, float, dancing_puppet |
| `direction` | aims/attracts | region(`direction`), pull (inverted=push; angled=vortex) |
| `target` | scopes the effect | window=self, diamond=neighbors, crosshair=area, sights_set=chosen target |
| `power` | intensity | convergence=focus/harden, radial=temper down |
| `support` | feeds another operator | collection, gather (feed billowing) |
| `special` | compound/unique | vision, eye, bend (concealment); repetition; purify; link; bind; cool; glaives; strengthen; entwine |

**transmute outranks form** for the primary clause. If neither present, the raw element is used.

## 5. Inversion (flipping a sign)

- Flipping an **invertible** sign produces the **opposite** effect: crush↔reassemble, enlarge↔shrink, pull↔push, floating-expansion↔spell-of-reduction, wall-breaker↔integration.
- Two otherwise-identical spells, one inverted, **cancel** each other out.
- Only **directional / semi-directional** signs are invertible. **Non-directional** have no front to flip. **Asymmetric** are unpredictable.
- Narrative exception: the **Scalewolf Curse** is NOT undone by inversion (needs a different spell). Forbidden spells may resist inversion.

## 6. Magical dyes (mixed into the ink) — [data/dyes.json](../../../../data/dyes.json)

Informational in the engine (don't change numeric power yet), but real in-world:

| Dye | Effect |
|-----|--------|
| Azuremoon Flower | increases **duration** |
| Blood | greatly increases **power** (a small light spell → giant flash; earth crush → carves a canyon) |
| Blushing Bride Scales | makes the seal **invisible** |
| Golden Blaze Wyrm Scales | ink **glows in the dark** |
| Roaming Scallop Shells | makes the seal **waterproof** |

## 7. Advanced mechanics (documented; only partly modeled)

- **Linked spells** — seals joined by a line combine; many small identical seals linked can exceed one large seal (Raincleaver). `linkCount` in the composition models this loosely (power bonus).
- **Nested glyphs** — a seal inside another; inner activates only if the outer ring is closed (Serpent's Bed of Sand, Cloak Spell).
- **Spell toggling** — split the ring across two objects; touching closes the ring (Glowstone Path, Sylph Shoes).
- **Second ring / inter-ring spell** — a spell drawn between two concentric rings.
- **Glaives** — claw protrusions (not signs/sigils) setting how deeply magic embeds into flesh (memory erasure, slime rendering). Body magic ⇒ forbidden.

## 8. Forbidden magic — [docs/forbidden-magic.md](../../../../docs/forbidden-magic.md)

Banned since the Day of the Pact: anything **drawn on / affecting the human body** (incl. healing), reality-warping, or excessively destructive/environment-altering. Only permitted body spell: **Memory Erasure**. Known forbidden: Scalewolf Curse, Anti Scalewolf Curse, Illusory Labyrinth, Petrification, Twin Bottle's Spell, Slime Transformation, Counterclock (on body), Truth Spell (on body). Flag any designed spell that crosses these lines as **forbidden** — still describable, but mark it clearly.

## 9. The composition object (UI ↔ engine ↔ JSON export contract)

The app's Export/Import format is `wha-spell@1`. The engine reads the inner `composition`:

```json
{
  "name": "Watershot Seal",
  "ring": { "closed": true },
  "core": { "id": "c0", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
  "components": [
    { "id": "s1", "type": "column", "role": "sign",  "x": 0, "y": -150, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "s2", "type": "fire",   "role": "sigil", "x": 80, "y": 0,    "rotation": 0, "scale": 1, "inverted": false }
  ],
  "linkCount": 0,
  "dyes": ["blood"]
}
```

- **Coordinates**: Cartesian **px centered at origin**; y is **down** (SVG). Ring radius ≈ 260px, so signs typically sit at radius 120–200. Angle 0° = north, clockwise.
- **First sigil = `core`**; extra sigils are `components` with `role:"sigil"`; signs are `role:"sign"`.
- `inverted` flips an invertible operator. `rotation` (deg) tilts a sign → spin. `scale` sizes a part (bigger = stronger / pulls balance its way).
- A full app export wraps this: `{ "format": "wha-spell@1", "version": 1, "composition": { ... } }`. The CLI accepts either the wrapper or a bare composition.

### Placing signs evenly (helper)

For N signs in a balanced ring at radius `r`, place sign `i` at angle `θ = i·360/N` (degrees, 0=north CW):
`x = r·sin(θ°)`, `y = -r·cos(θ°)`. Use `r ≈ 150`. Even spacing ⇒ radial symmetry ⇒ stable & straight-up. Make one sign larger (`scale`) or off-axis to deliberately aim the effect.

## 10. Running the engine (ground truth)

```bash
# JSON report (full structured analysis):
node tools/spell-engine-cli.mjs path/to/spell.json
echo '<composition-or-wrapper-json>' | node tools/spell-engine-cli.mjs

# Human-readable summary:
node tools/spell-engine-cli.mjs --text path/to/spell.json
```

Output includes: `valid`, `active`, `status`, `issues[]` (validity), `sigils[]`, `signs[]`,
`deduction` (`summary` + per-part `breakdown` + `notes`/`warnings`), `dyes[]`, `analysis`
(symmetry/stability/balance/power/spin/counts/ring), and `unknownIds` if any part id is unrecognized
(catch typos here). Trust this for validity and the base deduced effect; add narrative/usage/variation
reasoning on top of it.
