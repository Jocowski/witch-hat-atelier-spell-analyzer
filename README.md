# Witch Hat Atelier — Spell Studio

A drawing-and-analysis app for the magic system of *Witch Hat Atelier*. You **draw a spell** (or place
known sigils/signs) on a canvas; the app **recognizes** the symbols, **analyzes** the composition with
a deterministic engine, and produces a multi-topic **AI reading**. An admin area lets you **train** the
recognizer and curate the symbol registry.

## What a spell is

A glyph has three layers (see [ANALYSIS.md](ANALYSIS.md) and [docs/CORE.md](docs/CORE.md)):

- **Sigil** (center) — the element / substance (fire, water, earth, wind, light…)
- **Signs** (around it) — operators that shape the effect (column, pull, crush…)
- **Ring** (outer) — activates the spell when closed

## How it works

- **Studio** (`src/studio/`) — a near-fullscreen [react-konva](https://konvajs.org) canvas: paint tools
  (brush, line, rect, triangle, circle, arrow, two erasers, select/move/rotate, area-select, pan, zoom)
  with magical-dye colors, plus a palette to place registered sigils/signs. **Detect** runs a `$P`
  point-cloud recognizer over your strokes (overlay boxes show what each symbol was recognized as, and
  you can correct them); **Analyze** runs the engine and a streaming AI report.
- **Engine** (`src/engine/`) — pure, data-driven: validates, computes symmetry/balance/power, deduces a
  heuristic effect, and matches a catalog of canon spells in [`data/spells.json`](data/spells.json).
- **AI** — a local bridge (`tools/ai-bridge.mjs`) drives `claude -p` (Claude Code, no API token cost) to
  reason the spell from first principles across several topics, streamed into the UI.
- **Admin** (`src/admin/`) — Supabase Auth + role guard: **Training** (draw → save labeled examples),
  **Registry** (manage symbols), **Review** (inspect / rollback / delete training data).

## Run

```bash
npm install
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # production build
npm test         # engine + data tests (node --test)
```

Optional, for the full app (AI report + training/admin):

```bash
npm run ai                  # local AI bridge (needs the `claude` CLI) → http://localhost:8787
npx supabase start          # local database (Docker): DB + Auth + Storage
npx supabase status         # copy the URL + anon key into .env (see .env.example)
node tools/seed-admin.mjs admin@local.dev admin123 admin   # create a local admin (set SUPABASE_SECRET)
```

The Studio works without the bridge/DB (the AI button and training simply stay unavailable).

## Structure

```
data/              # source of truth (rules, sigils, signs, spells, dyes, grammar) — JSON
src/engine/        # pure logic: geometry, deduce, compose, analyze (validate + match + interpret)
src/studio/        # the drawing Studio (DrawingSurface, ToolDock, palette, detect/analyze)
src/admin/         # auth + training + registry + review
src/draw/          # the $P recognizer + template store
src/data-services/ # Supabase client + queries (symbols, samples, analyses, auth, audit)
src/ai/            # streaming AI report client
src/theme/         # 4 CSS-variable themes + switcher
src/components/     # ResultPanel (engine analysis view)
tools/             # CLIs: spell-engine-cli, ai-bridge, render, vectorize, seed-admin, …
supabase/          # local stack config + SQL migrations + seed
docs/              # magic-system source material + CORE/lexicon reasoning
docs/app/          # app dev docs: APP-PLAN, SPEC, TEST-PLAN, IMPROVEMENTS, …
```

> The SVG glyph shapes are consistent stylizations (not exact manga copies), sufficient for rendering
> and recognition. See [docs/app/APP-PLAN.md](docs/app/APP-PLAN.md) for the full architecture and roadmap.

## Disclaimer

This is an unofficial fan-made project for learning, experimentation, and appreciation. It is not
affiliated with, endorsed by, or sponsored by the official creators, publishers, licensors, or
production partners of Witch Hat Atelier.

Witch Hat Atelier and related names, artwork, symbols, and trademarks belong to their respective
rights holders. The sigils, signs, spell terminology, and visual effects in this project are partial
fan references and interactive interpretations, not official assets or canonical rules.

## License

Released under the [MIT License](LICENSE). The MIT License covers the original source code in this
repository only; it does **not** grant any rights to Witch Hat Atelier intellectual property (see the
Disclaimer above).
