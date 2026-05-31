# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Spell Analyzer** for the magic system of the manga *Witch Hat Atelier*. The user composes a glyph by dragging sigils/signs onto a circular canvas, mixes magical **dyes** into the ink, and the app **validates** it against the system's rules, **deduces** the effect of any composition (including novel ones) from first principles, and surfaces a full structured **analysis**.

The UI is in **English**. The source material lives in [docs/](docs/) as markdown (`magic.md`, `sigils.md`, `signs.md`, `magical-dye.md`, `forbidden-magic.md`, `spells.md`), with images under [assets/images/](assets/images/). The full system analysis and design rationale is in [ANALYSIS.md](ANALYSIS.md) — read it before changing the engine or data model.

## Commands

```bash
npm install
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # production build
npm test         # all engine + data tests (node --test)

# run a single test file (the npm glob form can misbehave on Windows):
node --test test/deduce.test.js

# regenerate sigil/sign SVG paths from the source PNGs (potrace):
npm run vectorize:sigils
npm run vectorize:signs
```

There is no linter configured.

## Architecture

### Data-driven: `data/*.json` is the source of truth

The engine has almost no hardcoded domain knowledge — everything lives in JSON:

- `rules.json` — validation rules (blocking/inactive/warning/info), advanced mechanics, polar coordinate model, matcher weights/threshold (0.7).
- `sigils.json` — 29 sigils (the *substance*). Each has a `family` (fire/water/earth/air/time/decorative/misc/special), an `element`, and either an `svgPath` or a `text` glyph (Guidance "G", Calling "C").
- `signs.json` — 38 signs (operators on the substance). Each documented sign has a `family` = one of the 4 doc categories (directional/semi-directional/non-directional/asymmetric); 3 (`bird`, `animal_signs`, `unknown_sign`) are kept but hidden. Carries `effectTags`, `invertible`, `canBeCenter`, `surrounds`.
- `dyes.json` — magical dyes mixed into the conjuring ink (kind/color/effect).
- `grammar.json` — the **deduction grammar**: per-element `substance`, per-sign `operator` (`kind` + `verb`/`invertedVerb`), and `interactions` (synergies/warnings). This is what lets the app explain novel combinations.
- `spells.json` — catalog of "recipes" for the matcher. **Currently empty** (to be repopulated with valid spells); the engine handles an empty catalog gracefully.

### Sigil/sign artwork is auto-vectorized

SVG paths come from the PNGs in `assets/images/{sigils,signs}/`, traced with **potrace** via `tools/vectorize-{sigils,signs}.cjs` (`npm run vectorize:*`). Traced entries are marked `render:"fill"` (drawn filled with `fill-rule:evenodd`, tinted via `currentColor`). Paths use `viewBox="-50 -50 100 100"`, centered on the origin (translate `-50`, plus bbox-recenter where the source art is off-center). Re-run the vectorizer when the source PNGs change; don't hand-edit the long `svgPath` strings.

### The composition object (UI ↔ engine contract)

```js
{ name, ring: { closed }, core: { id, type, x, y, rotation, scale, inverted } | null,
  components: [ { id, type, role: 'sign' | 'sigil', x, y, rotation, scale, inverted } ],
  linkCount, dyes: [dyeId] }
```

- **Multiple sigils:** the first sigil is `core`; additional sigils are `components` with `role:'sigil'`. The engine treats `core` as primary; geometry filters `role==='sign'`.
- Coordinates are **Cartesian px centered at origin** in the UI, converted to **polar** in the engine. Convention: angle 0° = north, clockwise; `toPolar` uses `atan2(x, -y)`. `computeDirectionalBias` must use `atan2(vx, -vy)` to stay consistent (this was a real bug once — directional skew came out reversed).
- This same shape is what **Export/Import (JSON)** round-trips (format `wha-spell@1`).

### Engine pipeline (`src/engine/`)

`analyze(composition)` orchestrates everything and returns **structured sections** consumed by [ResultPanel.jsx](src/components/ResultPanel.jsx), which renders them all in one panel:

`{ name, valid, active, status, issues[], sigils[], signs[], deduction, similar, dyes[], analysis }`

— i.e. validity (rules) · sigils · signs · deduced **effect** · **similar spells** (catalog match/nearest) · **dye effects** · **other info** (symmetry/stability, balance/direction, power, spin, inversion, counts, ring).

Deduction model (see ANALYSIS.md §8): each sigil provides a **substance**; each sign is an **operator** with a `kind` (`form`, `transmute`, `motion`, `direction`, `target`, `power`, `support`, `special`). A pipeline assembles the sentence: substance(s) → primary clause (`transmute` outranks `form`, else raw element) → direction → motion/target/power/special → interaction notes/warnings. With multiple sigils the substances are combined.

### Critical constraint: pure modules vs. JSON-bound modules

Tests run under plain Node (`node --test`), where **`import x from './x.json'` fails** (`ERR_IMPORT_ATTRIBUTE_MISSING`) — Node needs import attributes, but Vite uses the plain form. To keep the logic testable:

- **`geometry.js` and `deduce.js` are PURE** — they import no JSON. `deduce.js` exports `deduceWith(grammar, sigilMap, signMap, composition)` with data **injected**.
- **`data.js` and `analyze.js` import the JSON** (Vite-style) and bind it (`analyze.js` defines `deduce = (c) => deduceWith(grammar, ...)`).
- **Tests load JSON via `createRequire`** (`require('../data/x.json')` works in Node) and pass it into the pure functions.

**Do not add a JSON import to `geometry.js` or `deduce.js`** — it will break the Node test suite. Keep new pure logic in those modules and do JSON binding in `analyze.js`/`data.js`.

### Adding domain content

Adding a sign/sigil/spell touches multiple JSONs, and tests enforce it:
- A new **sign** needs an entry in `signs.json` **and** an operator in `grammar.json.operators` (coverage test in `deduce.test.js` fails otherwise).
- A new **sigil** needs its `element` to exist in `grammar.json.elements` (coverage test).
- Any `core`/sign `id` referenced in `spells.json` must exist in `sigils.json`/`signs.json` (data-integrity test).
- A sigil/sign shown in the palette needs a `family`; ids without a doc family stay hidden (see `Palette.jsx`).

## Source-material modeling notes

- Some sigils are "sign-as-sigil" (`vision`, `repetition`, `billowing` can occupy the center) — `canBeCore()` in `data.js` encodes this. They live in both `sigils.json` (as `*_sigil`, family `special`, hidden from the palette) and `signs.json`.
- A few signs were renamed to match the docs while keeping their ids: `direction`→**Region**, `billowing`→**Billow**, `dancing_puppet`→**Puppet**.
- Inversion negates an invertible operator (Wall Breaker ↔ Integration). Only directional/semi-directional signs are invertible; non-directional have no front to flip. Narrative exception: the Scalewolf Curse is *not* reversed by inversion (needs a different spell).
- Magical dyes are informational (shown in the analysis); they don't yet change the numeric power/duration of the deduction.
