# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Spell Analyzer** for the magic system of the manga *Witch Hat Atelier*. The user composes a glyph by dragging sigils/signs onto a circular canvas, mixes magical **dyes** into the ink, and the app **validates** it against the system's rules, **deduces** the effect of any composition (including novel ones) from first principles, and surfaces a full structured **analysis**.

The UI is in **English**. The source material lives in [docs/](docs/) as markdown (`magic.md`, `sigils.md`, `signs.md`, `magical-dye.md`, `forbidden-magic.md`, `spells.md`), with images under [assets/images/](assets/images/). The full system analysis and design rationale is in [ANALYSIS.md](ANALYSIS.md) — read it before changing the engine or data model.

### Architecture direction: AI is the core reasoner (see [PLAN.md](PLAN.md))

The project is re-architected so the **AI reasons the magic from first principles** and the **code engine is a compiler + fact extractor**, not the authority on what a spell does. The key docs:
- **[docs/CORE.md](docs/CORE.md)** — the first-principles semantics (substances as typed operands with create/manipulate/collect + state; signs as typed operators with preconditions/failure-modes; geometry as parameters). The reasoning base.
- **[docs/lexicon/](docs/lexicon/)** — per-symbol *drawing* (geometric primitives) + behavior + accumulated **Findings** (the per-symbol dossiers).
- **[docs/IR.md](docs/IR.md)** — the `wha-spell` JSON format (the shared human↔AI language); **[docs/patterns.md](docs/patterns.md)** (effect→recipe), **[docs/contraptions.md](docs/contraptions.md)** (multi-spell devices), **[docs/INGESTION.md](docs/INGESTION.md)** (how new knowledge is filed by concept).

Consequence: `grammar.json` + `deduce.js` produce a **heuristic** effect string — a scaffold, not ground truth. Prefer `--facts` (structured observations) + CORE/lexicon reasoning. The deterministic deduction is kept for the GUI's live readout.

### The app today: Spell Studio (draw → recognize → analyze, + Admin)

The app evolved from the drag-drop editor into **Spell Studio** (entry: `src/main.jsx` → `src/router.jsx`). Routes: `/` Studio · `/login` · `/admin/*` (admin-gated). **The legacy drag-drop editor (`App.jsx` + `components/{GlyphCanvas,Inspector,SpellTree,InkPanel,Palette}`, `DrawModal`) was removed** — only `components/ResultPanel.jsx` remains from the old UI.

- **Studio** (`src/studio/`): a near-fullscreen **react-konva** canvas (`DrawingSurface.jsx`) with paint tools (brush/line/rect/triangle/circle/arrow, stroke + pixel erasers, select/move/rotate, area-select), **right-drag/space pan + Recenter**, Shift+wheel zoom, **undo/redo (Ctrl+Z/Y)**, and **tool keyboard shortcuts** (B/L/R/G/C/A/V/M/T/E) + dye colors; place registered sigils/signs from `SymbolPalette.jsx`. **Detect** runs the `$P` recognizer (`src/draw/recognizer.js`) over the drawn strokes (+ placed symbols) → a `composition`; detections are weighted by training `source` and gated by a **confidence threshold** (low-confidence reads "unknown?" and is kept out of the engine input), shown as correctable overlay boxes. **Analyze** runs the engine + a streaming multi-topic **AI report** (`src/ai/report.js`), and logs the analysis + corrections via `data-services/analyses.js` (the improvement loop). Copy-image + JSON export/import via the `DrawingSurface` ref. The resizable, state-persisting results drawer holds it all. Corrections and confident catalog matches feed the training set.
- **Admin** (`src/admin/`): Supabase Auth login + role guard; **Training** (`TrainingView`: draw → save a labeled `training_sample`), **Registry** (`RegistryView` + `SymbolEditor`: CRUD the `symbols` registry — incl. `svg_path`/`family`/grammar fields that **overlay the JSON baseline live in the drawing app**, see "Data-driven" below), **Trace** (`TraceView`: upload/draw an image → traced `svgPath` via `imagetracerjs`, normalised to the engine viewBox — the browser twin of `npm run vectorize:*`), **Review** (`ReviewView`: filter/rollback/delete/see a sample's replay).
- **Themes** (`src/theme/`): 4 CSS-variable themes (brown default / dark / light / arcane) + themed scrollbars (in `themes.css`).
- **Data** (`src/data-services/` → Supabase): tables `profiles`, `symbols`, `training_samples` (the recognizer templates), `analyses`, `audit_log`. Schema in `supabase/migrations/`; local stack via the `supabase` CLI; the browser client (`supabase.js`) reads `.env` (`VITE_SUPABASE_*`) and degrades gracefully when absent.
- **AI**: the local **bridge** (`tools/ai-bridge.mjs`, `npm run ai`) runs `claude -p` (Claude Code, **no API token cost**) — routes `/health`, `/analyze`, `/report/stream` (SSE, parallel topics from `tools/report-topics.json`). The browser gates the AI UI on `/health`. Prod AI = your local bridge via a tunnel, or BYO API key (see APP-PLAN).

Plans/specs live in **[docs/app/](docs/app/)**: [APP-PLAN.md](docs/app/APP-PLAN.md) (master), [SPEC.md](docs/app/SPEC.md) (workstreams WS0–WS11), [DRAWING-APP.md](docs/app/DRAWING-APP.md), [SPEC-cluster-recognition.md](docs/app/SPEC-cluster-recognition.md). Active feature specs: [SPEC-recognizer-analysis.md](docs/app/SPEC-recognizer-analysis.md) (training flywheel + analysis surfacing), [SPEC-symbol-versioning.md](docs/app/SPEC-symbol-versioning.md) (symbol lifecycle + canon-update flagging), [SPEC-sign-variants-sizing.md](docs/app/SPEC-sign-variants-sizing.md) (magnitude/variant model). Manual test plan: [TEST-PLAN.md](docs/app/TEST-PLAN.md). Improvement backlog: [IMPROVEMENTS.md](docs/app/IMPROVEMENTS.md). (The magic-system source + reasoning docs stay in `docs/`.)

## Commands

```bash
npm install
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # production build
npm test         # all engine + data tests (node --test)
npm run lint     # ESLint (flat config); npm run lint:fix to autofix
npm run format   # Prettier --write (format:check to verify)

# run a single test file (the npm glob form can misbehave on Windows):
node --test test/deduce.test.js

# regenerate sigil/sign SVG paths from the source PNGs (potrace):
npm run vectorize:sigils
npm run vectorize:signs

# symbol lifecycle: flag catalog spells whose symbols changed (SPEC-symbol-versioning.md):
npm run flag:impact          # report stale spells; --write stamps lifecycle.flag

# reason about / render a spell (the engine as compiler + fact extractor):
npm run facts -- path/to/spell.json     # structured observations (tools/spell-engine-cli.mjs --facts)
node tools/spell-engine-cli.mjs --text path/to/spell.json   # heuristic readout (scaffold, not truth)
npm run render -- path/to/spell.json -o spell.svg           # IR → SVG picture (tools/render.mjs)

# --- Spell Studio app (Studio + Admin) ---
npm run ai                  # local AI bridge (claude -p): /health · /analyze · /report/stream (http://localhost:8787)
npx supabase start          # local Supabase stack (Docker): DB + Auth + Storage
npx supabase status         # local URLs + keys → fill .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
npx supabase migration up   # apply pending migrations (schema in supabase/migrations/)
node tools/seed-admin.mjs <email> <pass> [user]   # create/promote a local admin (SUPABASE_SECRET env)
```

Linting/formatting: **ESLint 9** (flat config `eslint.config.js`, React + hooks, Prettier-compat) + **Prettier** (`.prettierrc.json`: no semicolons, single quotes, 2-space, printWidth 100). `npm run lint` is clean (0 errors). Prettier is configured but not yet run repo-wide (a mass reformat would strip the intentional column alignment) — format new/changed files as you go.

## Architecture

### Data-driven: `data/*.json` is the source of truth (⊕ a runtime DB overlay for symbols)

The engine has almost no hardcoded domain knowledge — everything lives in JSON. **Sigils/signs/grammar are now JSON baseline ⊕ DB overlay**: the app reads them through `src/engine/symbolStore.js`, which merges the `symbols` registry rows (their `svg_path`/`family`/operator/element columns) over the JSON baseline via the pure `src/engine/symbolMerge.js` (`mergeSymbols(baseline, dbRows)`, tested in `test/symbol-merge.test.js`). So an admin can add/edit/delete a sign/sigil and update its SVG in the **Registry** and it goes live in the drawing app — palette tiles, canvas glyphs, and engine deduction — without a rebuild. The JSON stays the version-controlled canon; the DB only overlays. `symbolLoader.loadDbSymbols()` (called at boot in `router.jsx`, no-op without Supabase) applies the overlay; `data.js` exports are **live bindings** re-pointed on overlay change; `analyze.js` builds its deps from the current snapshot per call; React views subscribe via `useSymbolData()`. A brand-new sign needs `op_kind`+`op_verb` (and a sigil its `element`+`substance*`) to deduce a real effect — without them it renders but deduces generically (`deduce.js` skips operator-less signs). The JSON files below remain the baseline:

- `rules.json` — validation rules (blocking/inactive/warning/info), advanced mechanics, polar coordinate model, matcher weights/threshold (0.7). Also: `recognition` (per-`source` sample weights + `confidenceMinPct` gate), `mlReadiness` (coverage targets for the Training bars), `forbidden` (tags/categories for the forbidden-magic check).
- `sigils.json` — 33 sigils (the *substance*). Each has a `family` (fire/water/earth/air/time/decorative/misc/special), an `element`, and an `svgPath`. An optional `lifecycle` block (`status`/`rev`/…) tracks canon revisions (see SPEC-symbol-versioning.md).
- `signs.json` — 52 signs (operators on the substance). Each documented sign has a `family` = one of the 4 doc categories (directional/semi-directional/non-directional/asymmetric); 3 (`bird`, `animal_signs`, `unknown_sign`) keep family `other` and stay hidden. A 5th palette family, `unknown`, holds **catalogued-but-unidentified** signs (`unknown_NN`, e.g. `unknown_01` from Water Horse) — these are visible. Carries `effectTags`, `invertible`, `canBeCenter`, `surrounds`.
- `dyes.json` — magical dyes mixed into the conjuring ink (kind/color/effect).
- `grammar.json` — the **deduction grammar**: per-element `substance`, per-sign `operator` (`kind` + `verb`/`invertedVerb`), and `interactions` (synergies/warnings). This is what lets the app explain novel combinations.
- `spells.json` — catalog of "recipes" for the matcher. **Populated with canon spells** documented so far. Each record carries a provenance pair: **`origin`** (where the recipe *came from* — `canon` = taken directly from the manga/anime; `wiki` = obtained from the fan wiki at `witchhatatelier.telepedia.net`, fan-curated from canon; `fan` = purely fan-invented) and **`source`** (a free-text citation — telepedia URL + manga debut chapter, character/arc, or who reconstructed it). `origin` is **provenance, independent of `confidence`** (recipe certainty): a wiki-sourced recipe can still be high-confidence, so record recipe uncertainty in `confidence`, never by downgrading `origin`. **All 21 current catalog spells are `wiki`** — every one has a dedicated telepedia page that was the actual source (the manga's existence of the spell is real, but the *recipe data* came from the wiki). `canon` is reserved for recipes lifted straight from the manga/anime; `fan`-invented spells are **excluded** from the catalog (they'd produce false "canon match" results) and live only in `docs/spells/`. The engine doesn't branch on `origin` (curation metadata); it still handles an empty catalog gracefully (`catalogEmpty`).

### Sigil/sign artwork is auto-vectorized

SVG paths come from the PNGs in `assets/images/{sigils,signs}/`, traced with **potrace** via `tools/vectorize-{sigils,signs}.cjs` (`npm run vectorize:*`). Traced entries are marked `render:"fill"` (drawn filled with `fill-rule:evenodd`, tinted via `currentColor`). Paths use `viewBox="-50 -50 100 100"`, centered on the origin (translate `-50`, plus bbox-recenter where the source art is off-center). Re-run the vectorizer when the source PNGs change; don't hand-edit the long `svgPath` strings.

**Unknown signs** are auto-discovered: drop `Unknown_NN.png` into `assets/images/signs/unknown/` and `vectorize:signs` traces it to id `unknown_NN` (no MAP edit needed). Unlike the fixed-size known-sign PNGs, these crops are also **scaled to fit** the viewBox (`recenterAndFit`, ≤ ±42). Then add the `unknown_NN` entry to `signs.json` (family `unknown`) + an operator to `grammar.json`, and run `npm run unknown:report` to cross-reference its appearances for theorizing.

### The composition object (UI ↔ engine contract)

```js
{ name, ring: { closed }, core: { id, type, x, y, rotation, scale, inverted, mirrored } | null,
  components: [ { id, type, role: 'sign' | 'sigil', x, y, rotation, scale, inverted, mirrored } ],
  linkCount, dyes: [dyeId] }
```

- **Multiple sigils:** the first sigil is `core`; additional sigils are `components` with `role:'sigil'`. The engine treats `core` as primary; geometry filters `role==='sign'`.
- Coordinates are **Cartesian px centered at origin** in the UI, converted to **polar** in the engine. Convention: angle 0° = north, clockwise; `toPolar` uses `atan2(x, -y)`. `computeDirectionalBias` must use `atan2(vx, -vy)` to stay consistent (this was a real bug once — directional skew came out reversed).
- `inverted` flips the glyph top↔bottom (negate Y) and, for invertible signs, negates the operator's effect; `mirrored` flips it left↔right (negate X) and is **visual-only** (ignored by the engine) — both are rendered in [GlyphCanvas.jsx](src/components/GlyphCanvas.jsx) and toggled from the selection toolbar in [App.jsx](src/App.jsx).
- This same shape is what **Export/Import (JSON)** round-trips (format `wha-spell@1`).

### Engine pipeline (`src/engine/`)

`analyze(composition)` orchestrates everything and returns **structured sections** consumed by [ResultPanel.jsx](src/components/ResultPanel.jsx), which renders them all in one panel:

`{ name, valid, active, status, issues[], sigils[], signs[], deduction, similar, forbidden, dyes[], analysis }`

— i.e. validity (rules) · sigils · signs · deduced **effect** · **similar spells** (catalog match/nearest, with a `parts` breakdown of why it matched) · **forbidden-magic** flag (`{ forbidden, reasons }`, surfaced as a red callout) · **dye effects** · **other info** (symmetry/stability, balance/direction, power, spin, inversion, counts, ring).

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
- A sigil/sign shown in the palette needs a `family`; ids without a doc family stay hidden (see `SymbolPalette.jsx`).

Two ways to add a symbol: **(a) JSON (canon, permanent)** — the steps above; baked into the build. **(b) Admin Registry (live, DB overlay)** — fill the `SymbolEditor` (kind/name + `family` + `svg_path` via the inline *Trace image* or the **Trace** tab + operator/element fields) and it overlays the baseline at runtime for everyone (the columns map to the JSON fields in `symbolMerge.js`). Use (b) for fast iteration / fan symbols; promote a keeper into the JSON for canon + git history. The `symbols` table columns mirror the JSON: `svg_path`→`svgPath`, `op_kind`/`op_verb`/`op_inverted_verb`→`grammar.operators[id]`, `element`+`substance*`→`grammar.elements[element]`.

## Source-material modeling notes

- Some sigils are "sign-as-sigil" (`vision`, `repetition`, `billowing` can occupy the center) — `canBeCore()` in `data.js` encodes this. They live in both `sigils.json` (as `*_sigil`, family `special`, hidden from the palette) and `signs.json`.
- A few signs were renamed to match the docs while keeping their ids: `direction`→**Region**, `billowing`→**Billow**, `dancing_puppet`→**Puppet**.
- Inversion negates an invertible operator (Wall Breaker ↔ Integration). Only directional/semi-directional signs are invertible; non-directional have no front to flip. Narrative exception: the Scalewolf Curse is *not* reversed by inversion (needs a different spell).
- **Sign size affects direction** (Layer 1 of SPEC-sign-variants-sizing.md): `computeOrientationAim` weights each directional sign's facing by its `scale` (or `metrics.directionalMagnitude`) — equal opposing signs cancel, a larger one wins (the Column-"T" lesson). Variant *metrics* (e.g. stem length) and ring/sigil sizing are later layers.
- Magical dyes are informational (shown in the analysis); they don't yet change the numeric power/duration of the deduction.
