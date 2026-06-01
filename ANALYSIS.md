# Witch Hat Atelier — Magic System Analysis for the Simulator

> Source document for the simulator's logic. It consolidates the rules from [docs/](docs/) and translates them into a data model (`data/*.json`) that the app consumes to **render**, **validate**, **deduce**, and **analyze** spells.

---

## 1. Overview

Magic in *Witch Hat Atelier* is **drawn**, not spoken. A spell (seal/glyph) is composed of layers:

| Layer | Role | Where it sits |
|--------|-------|-----------|
| **Sigil** | Defines the **substance/element** (fire, water, earth, wind, light, time, decorative…) | Center. *Mixed* spells can have **more than one sigil**. |
| **Signs (keystones)** | Define the **form** in which the element manifests | Rings around the center |
| **Ring** | **Activates** the spell when closed | Outer circle |
| **Conjuring ink (+ dyes)** | The ink everything is drawn with; **magical dyes** mixed in modify the spell | Global property of the drawing |

**Principle:** `effect = substance(sigils) × form(signs) × activation(ring) × ink(dyes)`.

The same combination of signs changes behavior depending on the sigil (e.g. *column* + water = jet; *column* + light = beam of light). It's this multiplication that the simulator models.

### Source docs (in [docs/](docs/))

- [magic.md](docs/magic.md) — seals, sigils, signs, ring; balance, rotation, inversion; advanced concepts.
- [sigils.md](docs/sigils.md) — sigils by family (Fire, Water, Earth, Air, Time, Decorative, Misc).
- [signs.md](docs/signs.md) — signs and the **4 categories** (directional / semi-directional / non-directional / asymmetric).
- [magical-dye.md](docs/magical-dye.md) — dyes mixed into the ink.
- [forbidden-magic.md](docs/forbidden-magic.md) — forbidden magic.
- [spells.md](docs/spells.md) — catalog of spells by category (visual reference).

---

## 2. Validation rules → [`data/rules.json`](data/rules.json) + `analyze()`

| Severity | Rule | When it fires |
|-----------|-------|----------------|
| **blocking** | core present | no sigil/central sign → **invalid** |
| **inactive** | ring closed | ring open → prepared, but **inactive** |
| warning | empty ring = explosion | ring closed with nothing inside → raw discharge |
| warning | ≥ 1 sign | sigil without signs → undefined form |
| warning | stability | ≥2 asymmetric signs → unstable (at least bilateral symmetry is recommended) |
| info | balance/direction | unbalanced signs skew the effect toward the side with the larger/more numerous signs |
| info | rotation/spin | tilted signs make the spell spin (more tilt = more spin, less range) |

### Mechanics (from the docs)

- **Inversion** — flipping a sign produces the opposite effect (Wall Breaker ↔ Integration; Floating Expansion ↔ Spell of Reduction). Two identical spells with inverted signs cancel each other out. Only **invertible** signs (directional / semi-directional) can be inverted; **non-directional** ones have no "front" to flip; **asymmetric** ones are unpredictable.
- **Size & neatness** — larger seals = more powerful; well-drawn ones = more stable and longer-lasting.
- **Linked / nested spells / ring toggle / double ring** — advanced mechanics (documented; not yet fully modeled in the engine).

---

## 3. Sigils → [`data/sigils.json`](data/sigils.json)

29 sigils, grouped by **family** (the `family` field, used by the palette and the analysis):

| Family | Sigils |
|---------|--------|
| **fire** | Fire, Unburning Flames, Light |
| **water** | Water |
| **earth** | Earth |
| **air** | Wind, Aeriforms, Wind Underfoot, Whorling Winds |
| **time** | Repetition, Stop |
| **decorative** | Bird A/B, Dragon, Flower, Horse, Owlcat, Owlcat Head, Scalewolf, Torchstag, Liongoat, Valance Leech |
| **misc** | Crystal, Smoke, **Guidance** (glyph "G"), **Calling** (glyph "C") |
| **special** (hidden from the palette) | `vision_sigil`, `billowing_sigil`, `unknown_sigil` — kept in data, out of the palette |

- **Multi-sigil:** the 1st sigil is the `core`; extra sigils go in as `components` with `role:"sigil"`. The deduction cites the substance of all of them.
- **Sign-as-sigil:** *vision*, *billowing*, *repetition* can occupy the center.
- **Guidance/Calling** have no artwork → rendered as **text** ("G"/"C") via the `text` field.

---

## 4. Signs → [`data/signs.json`](data/signs.json)

38 signs. The 35 documented ones are classified into 4 categories (the `family` field); 3 are hidden (`bird`, `animal_signs`, `unknown_sign`).

| Category | Behavior (signs.md) | Examples |
|-----------|--------------------------|----------|
| **directional** (8) | manifest the effect in a direction; bilateral symmetry, no radial; angle/size control the direction | column, dispersion, levitation, pull, **region** (formerly "direction"), collection, sights_set, gather |
| **semi-directional** (13) | invertible, no direction of their own; size = strength | crush, convergence, weave, enlarge, radial, rain, **puppet**, strengthen, entwine, aeriforms_defined, glaives, bind, link |
| **non-directional** (12) | radial symmetry, no front → **not invertible** | float, **billow**, repetition, diamond, window, crosshair, bolt, eye, vision, bend, cool, orb |
| **asymmetric** (2) | no symmetry, unpredictable | sign_of_wind, purify |

> Renames to match the docs: `direction`→**Region**, `billowing`→**Billow**, `dancing_puppet`→**Puppet** (ids preserved).

Each sign has: `svgPath`, `effect`, `effectTags`, `invertible`, `canBeCenter`, `surrounds`, and a corresponding **operator** in `grammar.json` (the deduction depends on this — coverage test).

---

## 5. Magical dyes → [`data/dyes.json`](data/dyes.json)

Substances mixed into the *conjuring ink*. The composition carries `dyes: [id]`, and the analysis lists their effects:

| Dye | Effect |
|-----|--------|
| Azuremoon Flower | increases **duration** |
| Blood | greatly increases **power** |
| Blushing Bride Scales | makes the seal **invisible** |
| Golden Blaze Wyrm Scales | makes the ink **glow in the dark** |
| Roaming Scallop Shells | makes the seal **waterproof** |

---

## 6. Data model and artwork

```
data/
├── rules.json    → validation rules, mechanics, polar model, matcher weights (threshold 0.7)
├── sigils.json   → 29 sigils (family, element, svgPath/text, render)
├── signs.json    → 38 signs (family/category, semantics, svgPath, render)
├── dyes.json     → magical dyes (kind, color, effect)
├── grammar.json  → deduction grammar (elements, operators, interactions, stability, power)
└── spells.json   → catalog (recipes) — populated with the canon spells (origin:canon)
```

### Vectorized artwork (SVG)

Sigils and signs are **auto-vectorized** from the images in `assets/images/{sigils,signs}/` via **potrace**:

- `npm run vectorize:sigils` → [tools/vectorize-sigils.cjs](tools/vectorize-sigils.cjs)
- `npm run vectorize:signs` → [tools/vectorize-signs.cjs](tools/vectorize-signs.cjs)

The paths are centered (translate `-50` + bounding-box recenter where needed) in the viewBox `-50 -50 100 100` and marked `render:"fill"` (drawn filled, `fill-rule:evenodd`, tinted via `currentColor`). Sigils without artwork use stroke or `text`. `assets/` also holds the images used by the docs.

### Composition object (UI ↔ engine contract)

```json
{
  "name": "Watershot Seal",
  "ring": { "closed": true, "doubled": false },
  "core": { "id": "c1", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
  "components": [
    { "id": "c2", "type": "column", "role": "sign",  "x": 0, "y": -150, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c3", "type": "fire",   "role": "sigil", "x": 80, "y": 0,   "rotation": 0, "scale": 1, "inverted": false }
  ],
  "linkCount": 0,
  "dyes": ["blood"]
}
```

Coordinates: **Cartesian px centered at the origin** in the UI; the engine converts to **polar** (`toPolar(x,y) = atan2(x,-y)`, 0° = north, clockwise). `computeDirectionalBias` uses the same form `atan2(vx,-vy)` (otherwise the skew comes out mirrored — this was a real bug). The same format is used by **Export/Import (JSON)**.

---

## 7. Analysis pipeline → `analyze(composition)`

`analyze()` returns **structured sections** (consumed by [ResultPanel.jsx](src/components/ResultPanel.jsx), which shows everything in a single panel):

```
INPUT: composition

1. VALIDITY        blocking/inactive/warning/info rules (section 2)
2. GEOMETRY        computeSymmetry · computeDirectionalBias · computePower · tilt
3. SIGILS          lists each sigil (name, family, element, description, core/extra)
4. SIGNS           groups by type+inversion (name, category, effect, count, invertible)
5. EFFECT          deduceWith(grammar, …) → sentence + breakdown + notes/warnings
6. SIMILAR SPELLS  buildSignature → matchSpell(spells.json) → match/nearest
                   (empty catalog ⇒ "nothing to compare"; today populated with the canon spells)
7. DYES            resolves composition.dyes → name + effect
8. OTHER           stability, symmetry, balance, power(+label), flags
                   (inverted, tilted→spin, decorative), counts, ring
```

The result has the shape `{ name, valid, active, status, issues[], sigils[], signs[], deduction, similar, dyes[], analysis }`.

---

## 8. Compositional grammar (deduction) → [`data/grammar.json`](data/grammar.json)

Beyond recognizing catalog spells, the app **deduces** the effect of any composition — including novel ones.

```
effect = substance(sigil)
         transformed by operators(signs)
         directed by orientation/balance
         scoped by target · scaled by power
         stabilized by symmetry · negated by inversion
```

Each sign is an **operator** with a `kind`:

| kind | role | examples |
|------|-------|----------|
| `form` | shapes the output channel | column→beam, dispersion→leaks out, bolt→projectiles, rain→rainfall, orb→sphere |
| `transmute` | changes the substance's state | weave→ribbon, billowing→cloud, crush→dust, enlarge→grows/shrinks |
| `motion` | adds movement | levitation, float, dancing_puppet |
| `direction` | aims/attracts | region, pull (inverted=pushes; angled=vortex) |
| `target` | scope | window=itself, diamond=neighbors, crosshair=area, sights_set=target |
| `power` | intensity | convergence=focuses/hardens, radial=tempers |
| `support` | enables another operator | collection/gather feeds billowing |
| `special` | composite effects | vision+eye+bend=concealment; repetition; purify; link; bind; cool; glaives |

**Pipeline:** substance (all sigils) → primary clause (`transmute` > `form` > raw) → direction (balance or `defaultDirection`) → motion/target/power/special → interactions (notes/warnings) → stability/power.

`deduceWith(grammar, sigilMap, signMap, composition)` is **pure** (data injected) and tested in isolation.

---

## 9. App features

- **Compose by drag/click:** palette of sigils (by family) and signs (by category), with **search by name** and **collapsible sections**.
- **Multiple sigils** in the same seal; "↦ to center" promotes a sigil/central sign to core.
- **Conjuring ink:** panel for mixing dyes.
- **Spell name:** goes into the exported JSON and onto a banner at the top of the copied image.
- **Export (JSON)** / **Import (JSON)** (format `wha-spell@1`) and **Copy image** (SVG→PNG to clipboard).

---

## 10. Architecture and the pure vs. JSON constraint

```
src/
├── engine/
│   ├── data.js       → imports the JSON (Vite) and indexes it (SIGILS, SIGNS, DYES, maps)
│   ├── geometry.js   → polar/symmetry/balance/power  (PURE, no JSON)
│   ├── deduce.js     → deduceWith(...)                (PURE, no JSON)
│   └── analyze.js    → binds the JSON and orchestrates the analysis sections
├── components/       → Palette · GlyphCanvas · InkPanel · ResultPanel
└── App.jsx           → composition state + toolbar (ring, export/import, copy image, clear)
```

> **Critical constraint:** tests run under plain Node, where `import x from './x.json'` fails. That's why `geometry.js` and `deduce.js` **do not import JSON** — they receive data by parameter. `data.js`/`analyze.js` do the binding (Vite-style). Do **not** add a JSON import to `geometry.js`/`deduce.js`.

### Tests (`npm test`, 43)

geometry · data integrity (non-empty svgPath, valid spell refs) · deduction, including **coverage**: every sign has an operator in `grammar.json`, every sigil element has an entry in `grammar.json`.

---

## 11. State and limitations

- **`spells.json` is populated with the canon spells** documented so far (`origin:canon` only; community variants are left out so they can't produce false "canon match" results). If the catalog is emptied, the "Similar spells" section reports that there's nothing to compare and the per-part deduction keeps responding.
- SVG shapes come from the (fan-wiki) images, not the official manga; they're faithful enough for rendering/analysis.
- **Spin** detection is qualitative (presence of tilted signs), not a fine-grained direction calculation.
- Matching uses the **primary** sigil; multi-sigil spells don't yet add to the score (the deduction, however, does account for all of them).

---

*Sources: [docs/magic.md](docs/magic.md), [docs/sigils.md](docs/sigils.md), [docs/signs.md](docs/signs.md), [docs/magical-dye.md](docs/magical-dye.md), [docs/forbidden-magic.md](docs/forbidden-magic.md), [docs/spells.md](docs/spells.md), and the images in `assets/images/`.*
