# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Spell Analyzer** for the magic system of the manga *Witch Hat Atelier*. The user composes a glyph by dragging sigils/signs onto a circular canvas; the app validates it against the system's rules, recognizes catalogued spells, and **deduces** the effect of any composition (including novel ones) from first principles.

The UI is in **English**. The source material lives in [docs/](docs/) (rules + glyph images as `.webp` — readable directly). The full system analysis and design rationale is in [ANALYSIS.md](ANALYSIS.md) — read it before changing the engine or data model.

## Commands

```bash
npm install
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # production build
npm test         # all engine + data tests (node --test)

# run a single test file (the npm glob form can misbehave on Windows):
node --test test/deduce.test.js
```

There is no linter configured.

## Architecture

### Data-driven: `data/*.json` is the source of truth

The engine has almost no hardcoded domain knowledge — everything lives in JSON:

- `rules.json` — validation rules (blocking/warning/info), advanced mechanics, polar coordinate model, matcher weights/threshold (0.7).
- `sigils.json` — elements (the *substance* of a spell), each with an `svgPath`.
- `signs.json` — keystones (operators on the substance), with `svgPath` + semantics (`effectTags`, `invertible`, `canBeCenter`, `surrounds`).
- `spells.json` — 55 spell "recipes" (`composition: { core, signs[], symmetry }`) the matcher compares against.
- `grammar.json` — the **deduction grammar**: per-element `substance`, per-sign `operator` (`kind` + `verb`/`invertedVerb`), and `interactions` (synergies/warnings). This is what lets the app explain novel combinations.

All SVG paths use `viewBox="-50 -50 100 100"`, `stroke="currentColor"`. Shapes are consistent stylizations, not exact manga copies.

### The composition object (UI ↔ engine contract)

```js
{ ring: { closed }, core: { type, ... } | null,
  components: [ { id, type, role:'sign', x, y, rotation, scale, inverted } ] }
```

Coordinates are **Cartesian px centered at origin** in the UI, converted to **polar** in the engine. Convention: angle 0° = north, clockwise; `toPolar` uses `atan2(x, -y)`. `computeDirectionalBias` must use `atan2(vx, -vy)` to stay consistent (this was a real bug once — directional skew came out reversed).

### Engine pipeline (`src/engine/`)

`analyze(composition)` orchestrates: `validate` → `buildSignature` → `matchSpell` (catalog) → `deduce` (grammar). It returns both a catalog `match`/`nearest` **and** a `deduction`. The UI ([ResultPanel.jsx](src/components/ResultPanel.jsx)) picks which to show by ring state:
- **ring open** → "Analysis" panel (comparison with catalogued spells)
- **ring closed + valid** → "Effect" panel (part-by-part deduction)

Deduction model (see ANALYSIS.md §11): the sigil provides a **substance**; each sign is an **operator** with a `kind` (`form`, `transmute`, `motion`, `direction`, `target`, `power`, `support`, `special`). A pipeline assembles the sentence: substance → primary clause (`transmute` outranks `form`, else raw element) → direction → motion/target/power/special → interaction notes/warnings.

### Critical constraint: pure modules vs. JSON-bound modules

Tests run under plain Node (`node --test`), where **`import x from './x.json'` fails** (`ERR_IMPORT_ATTRIBUTE_MISSING`) — Node needs import attributes, but Vite uses the plain form. To keep the logic testable:

- **`geometry.js` and `deduce.js` are PURE** — they import no JSON. `deduce.js` exports `deduceWith(grammar, sigilMap, signMap, composition)` with data **injected**.
- **`data.js` and `analyze.js` import the JSON** (Vite-style) and bind it (`analyze.js` defines `deduce = (c) => deduceWith(grammar, ...)`).
- **Tests load JSON via `createRequire`** (`require('../data/x.json')` works in Node) and pass it into the pure functions.

**Do not add a JSON import to `geometry.js` or `deduce.js`** — it will break the Node test suite. Keep new pure logic in those modules and do JSON binding in `analyze.js`/`data.js`.

### Adding domain content

Adding a sign/sigil/spell touches multiple JSONs, and the integrity tests enforce it:
- A new **sign** needs an entry in `signs.json` **and** an operator in `grammar.json.operators` (coverage test fails otherwise).
- A new **sigil** needs its `element` to exist in `grammar.json.elements`.
- Any `core`/sign `id` referenced in `spells.json` must exist in `sigils.json`/`signs.json` (data-integrity test).

## Source-material modeling notes

- Some sigils are "sign-as-sigil" (`vision`, `repetition`, `billowing` can occupy the center) — `canBeCore()` in `data.js` encodes this.
- `aeriforms` is modeled as a **sigil**, not a sign; where the source says "signs of aeriforms" (Pegasus Carriage) it's mapped to `unknown_sign` to keep integrity.
- Forbidden/unknown spells have low `confidence`; the matcher down-weights them.
- Inversion negates an invertible operator (Wall Breaker ↔ Integration). Exception: the Scalewolf Curse is *not* reversed by inversion (needs a different spell) — a narrative rule, not a mechanical one.
