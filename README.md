# Witch Hat Atelier — Spell Analyzer

An analyzer for the magic system of *Witch Hat Atelier*. You **compose a glyph** by dragging sigils and signs onto a circular canvas; the app **validates** the spell against the system's rules and **recognizes/interprets** its effect.

## How it works

A glyph has three layers (see [ANALYSIS.md](ANALYSIS.md)):

- **Sigil** (center) — defines the element (fire, water, earth, wind, light…)
- **Signs** (around it) — define the form of the effect (column, dispersion, bolt…)
- **Ring** (outer) — activates the spell when closed

The engine (`src/engine/`) validates, computes symmetry/balance/power, builds a "signature", and compares it against the catalog of 55 spells in [`data/spells.json`](data/spells.json). Match ≥ 70% → recognized spell; otherwise the effect is **derived** from the element × signs combination.

## Run

```bash
npm install
npm run dev      # development server (Vite)
npm run build    # production build
npm test         # engine + data-integrity tests
```

Open the address Vite prints (usually http://localhost:5173).

## Usage

1. Click/drag a **sigil** from the palette → it goes to the center.
2. Click/drag **signs** → they snap into a ring; drag to reposition.
3. Select a component to **rotate / resize / invert / delete** or promote it to the center.
4. **Close/open the ring** to activate or deactivate the spell.
5. The right panel shows validity, the recognized spell, and its effect.

### Try it
- `water` + 4× `column` in a cross → **Watershot Seal**. Enlarge one column (− / +) to see the stream skew.
- `earth` + 2× `column` (sides) + 2× `crush` (top/bottom) → **Wall Breaker Seal**. Invert the crush signs → **Integration**.
- `wind` + 6× `pull` pointing inward → **Grasping Wind**.

## Structure

```
data/            # source of truth (rules, sigils, signs, spells) — JSON
src/engine/      # pure logic: data, geometry, analyze (validate + match + interpret)
src/components/  # Palette, GlyphCanvas (SVG + drag), ResultPanel
ANALYSIS.md      # full analysis of the system and the data model
docs/            # source material (rules and glyph images)
```

> The SVG shapes are consistent stylizations of the glyphs (not exact manga copies), sufficient for rendering and recognition.
