# SPEC — Standalone Tuning Tools (7.4)

> Status: **done - shipped (7.4)** · Scope: **developer tooling only** — three standalone HTML pages for iterating
> on templates, recognition, and visual effects without running the full Studio/Admin app.
> Branch: `feat/spell-studio`
> Cross-refs: [SPEC-recognizer-analysis.md](../SPEC-recognizer-analysis.md) (the detector lab exercises
> $P + A1 weighting), [APP-PLAN.md](../../APP-PLAN.md) (rendering + recognizer context),
> [SPEC.md](../../SPEC.md) (WS1 canvas, WS2 recognize).

These tools live in `tools/` as plain HTML+JS pages, opened directly through the Vite dev server
(`http://localhost:5173/tools/<name>.html`). Vite already exposes `tools/*.html` as static assets
via `server.fs.allow: ['..', '.']` in `vite.config.js`. No build step, no React, no bundling —
each page loads in a browser tab with `<script type="module">`, imports the project's **pure
source modules** directly (ESM, fetching the JSON data themselves), and is excluded from the
production bundle automatically because Rollup only processes the entry points declared in
`index.html`.

---

## How they are served

Open any tool by running the normal dev server and navigating to the page:

```bash
npm run dev
# then open:  http://localhost:5173/tools/strokeTemplateMaker.html
#             http://localhost:5173/tools/sigilSignDetectorLab.html
#             http://localhost:5173/tools/spellEffectLab.html
```

No extra commands. Vite's permissive `fs.allow` already lets the browser reach `tools/` and
`src/`. The tools are **not linked** from the Studio UI and do not appear in the nav — they are
dev-only pages found by knowing the URL.

---

## 7.4a — Stroke Template Maker

### Purpose

Author new `$P` point-cloud templates for sigils and signs without going through the Training
admin flow. The maker is the raw, zero-friction starting point: draw a symbol on a blank canvas,
export the normalized `{ name, role, points:[{X,Y,ID}] }` object, and drop it into
`localStorage` (or paste it into the Training UI / a migration seed) for immediate use by the
recognizer.

A companion **viewer** (same section; separate HTML page) accepts a pasted template object and
renders it back as strokes — for auditing what the recognizer actually sees after normalization,
comparing stroke count/point density, and verifying that an imported template round-trips
correctly.

### Files

| File | Notes |
|---|---|
| `tools/strokeTemplateMaker.html` | The authoring page |
| `tools/strokeTemplateMaker.js` | Its `<script type="module">` driver |
| `tools/strokeTemplateViewer.html` | The inspection/audit page |
| `tools/strokeTemplateViewer.js` | Its driver |

### Real modules imported

Both pages import only **pure modules** — no JSON, no React, no Supabase:

```js
// strokeTemplateMaker.js
import { makeCloud, strokesToTemplate } from '../src/draw/recognizer.js'
import { loadTemplates, saveTemplates, addTemplate, exportTemplates } from '../src/draw/templates.js'
```

```js
// strokeTemplateViewer.js
import { makeCloud } from '../src/draw/recognizer.js'
```

`recognizer.js` and `templates.js` are already pure (no JSON imports, no DOM) — they load
directly with no shim. `sigils.json` / `signs.json` are loaded via `fetch('/data/sigils.json')`
so the maker can offer a symbol-select dropdown with the real ids and display the existing
`svgPath` as a reference overlay for tracing. The Vite dev server serves `data/` because of the
`..` in `server.fs.allow`.

### UI

**Maker** (`strokeTemplateMaker.html`):

- A plain `<canvas>` (800×800) with mouse/touch drawing; each pointer-down starts a new stroke
  (incrementing `ID`), giving multi-stroke symbols the right `{X,Y,ID}` shape.
- Center crosshairs (dashed lines) as a drawing guide.
- A **symbol selector** `<select>` populated from `fetch('/data/sigils.json')` +
  `fetch('/data/signs.json')` on load; selecting an entry sets the template `name` and `role`
  (`sigil` / `sign`) automatically and optionally overlays the existing `svgPath` at 50 % opacity
  as a trace reference.
- **Undo**, **Clear**, **Export** (fills the textarea with the normalized JSON), **Copy** (copies
  to clipboard and shows a status pill).
- A `<textarea>` showing the exported template object — ready to paste into the Training UI,
  a seed script, or localStorage.
- A **Save to localStorage** button writes via `addTemplate()` so the recognizer in Studio picks
  it up immediately on the next page load, without any Supabase session.
- The status pill shows: `Ready` / `Drawing captured` / `Exported` / `Copied` / `Saved`.

**Viewer** (`strokeTemplateViewer.html`):

- A `<textarea>` for pasting a raw template object or a full `training_samples` row (the viewer
  accepts either; it extracts `points` and reconstructs strokes by grouping on `ID`).
- A `<canvas>` (800×800) that renders the reconstructed strokes with the same stroke style the
  Studio uses.
- A **metrics block** (`<pre>`) showing: stroke count, point count per stroke, total points,
  centroid after `makeCloud` normalization (should be at/near origin), and the normalized bounding
  box — so you can verify whether the template is centered and well-distributed.
- A dashed bounding-box overlay on the canvas for at-a-glance spatial check.
- **Render** and **Clear** buttons.

### Sync with real code

Both pages call `makeCloud()` from `recognizer.js` to normalize the drawn points — they exercise
the same normalization path the recognizer will use at runtime. Adding a parameter to `makeCloud`
(e.g. changing `NUM_POINTS`) is immediately reflected in the viewer's metrics and the maker's
export, with no copy to update.

### Phasing and effort

**Effort: S.** Both pages are vanilla HTML+JS with no framework dependencies. They are
independent of all other workstreams — they can be built before Supabase is stood up (they use
`localStorage` as the write target) and before the Studio canvas is complete. Build in one
sitting; refine as templates accumulate.

### Acceptance criteria

- Drawing a closed loop (the ring) and exporting yields a JSON object with `name`, `role`, and
  `points` array; `points.length === 32` (the `NUM_POINTS` constant in `recognizer.js`).
- Pasting the exported object into the viewer renders visually recognizable strokes.
- Selecting a known sigil from the dropdown overlays its `svgPath`; the drawn template aligns
  roughly with it.
- Saving to localStorage and then opening the Studio confirms the template appears as an option
  in the Training admin tab's live guess.
- `makeCloud()` is called identically in both pages and in `recognizer.js` — no forked copy.

### Testing notes

The normalization path (`makeCloud`, `strokesToTemplate`) is already covered by
`test/recognizer.test.js` (pure, `node --test`). The tool pages themselves are manual-test only:
draw, export, inspect, repeat. No new unit tests needed — any regression in normalization will
surface in the existing test suite.

---

## 7.4b — Sigil/Sign Detector Lab

### Purpose

A live recognition workbench: draw a single sigil or sign on the canvas, watch the `$P`
recognizer score it against the full template set in real time, and see the ranked match list
with raw `dist`, `adjDist`, `confidencePct`, and the winning de-rotation angle. The goal is to
tune recognition quality — identify which templates are confusable, calibrate the
`confidenceMinPct` gate in `rules.json`, verify that A1 source-weighting actually changes the
ranking in close calls, and check that a freshly saved template beats its nearest rival.

This exercises the **real recognizer pipeline** (`recognize()`, `makeCloud()`,
`confidencePct()`), the **real templates** loaded from localStorage (or a pasted template set),
and the **real weight map** from `rules.json` — not a copy.

### Files

| File | Notes |
|---|---|
| `tools/sigilSignDetectorLab.html` | The lab page |
| `tools/sigilSignDetectorLab.js` | Its driver |

### Real modules imported

```js
import { recognize, makeCloud, confidencePct, analyzeStrokes } from '../src/draw/recognizer.js'
import { loadTemplates } from '../src/draw/templates.js'
```

`rules.json` is loaded via `fetch('/data/rules.json')` to read `recognition.sampleWeights` and
`recognition.confidenceMinPct` — the same values the Studio uses (no copy). `sigils.json` and
`signs.json` are fetched for the reference overlay dropdown, same as in the maker.

### UI

- A `<canvas>` (800×800) with mouse/touch drawing (same capture logic as the maker).
- A **mode selector**: `Sigils + Signs` / `Sigils only` / `Signs only` — filters the active
  template set for the match run.
- A **reference overlay** dropdown: select a known symbol to overlay its `svgPath` as a faint
  trace guide (helps answer "does a perfect tracing of the reference score better than a rough
  drawing?").
- **Undo** and **Clear** buttons; recognition re-runs on every stroke commit and on undo.
- A **Decision panel** (right sidebar, always visible):
  - `Top match`: id + role, displayed in large text
  - `Confidence`: `confidencePct(dist)` as `%`, colored green / amber / red against the
    `confidenceMinPct` threshold
  - `Raw dist`: the raw `$P` cloud distance (for comparing across symbol sets)
  - `Adj dist`: `dist / weight` (shows whether source weighting changed the winner)
  - `De-rotation`: the sweep angle at which the best match was found
  - `Gate`: pass / fail indicator against `confidenceMinPct` — tells you whether this drawing
    would be passed to the engine or shown as "unknown?" in the Studio
- A **Top-N match list** (N = 8): each entry shows the symbol id, its `source` tag (drawn /
  corrected / confirmed), its `weight`, `dist`, `adjDist`, `confidencePct`, and a mini SVG
  preview of the template strokes (reconstructed from `points` via `makeCloud` inverse, scaled to
  a 100×100 SVG). The winning entry is visually distinguished.
- A **Recognition JSON** block: the raw output of `recognize()` (ranked array) for debugging.
- A **Template set info** block: total template count, breakdown by symbol, and the active
  `sampleWeights` and `confidenceMinPct` read from `rules.json`.
- A **Paste templates** button: lets you paste a JSON array of template objects to temporarily
  replace the localStorage set — useful for testing a candidate template set before committing it.

### Sync with real code

`recognize()` and `confidencePct()` are imported directly; any change to the scoring formula or
the normalization constants in `recognizer.js` is immediately visible in the lab without a
rebuild. The weight map comes from `fetch('/data/rules.json')` — editing `rules.json` and
refreshing the page tests the new weights. The confidence gate is the same constant both here and
in `StudioPage.jsx` (`analyzeStrokes` reads `confidenceMinPct` from the opts it receives, which
in Studio comes from the same `rules.json` fetch).

### Phasing and effort

**Effort: M.** The core (draw → `recognize()` → display results) is S-effort; the match-list
with SVG previews, the overlay rendering, and the template-paste flow push it to M. Build after
the maker (7.4a) so the template localStorage is already populated. Independent of Supabase —
reads from localStorage only.

### Acceptance criteria

- Drawing a fire sigil with at least one stored fire template shows `fire` as the top match with
  `confidencePct >= confidenceMinPct` and `gate: pass`.
- Drawing a deliberate scribble with no close template shows a low `confidencePct` and
  `gate: fail`.
- With two templates of the same symbol at different weights (patched manually in localStorage),
  the higher-weight template wins a close-distance tie (visible via `adjDist < adjDist` of the
  rival).
- The `confidenceMinPct` threshold displayed matches `rules.json` exactly.
- Changing `sampleWeights` in `rules.json` and refreshing the page changes the `adjDist` values
  and potentially the winner without any code change.

### Testing notes

`recognize()` with weighted templates is covered by `test/recognizer.test.js` (pure unit test,
already planned in SPEC-recognizer-analysis A1). The lab is the manual companion: it lets you see
a real drawing against a real template set, something a unit test with synthetic points cannot
fully replicate. No new automated tests — the lab surfaces intuition; the unit tests lock the
contract.

---

## 7.4c — Spell Effect Lab

### Purpose

An animation sandbox for tuning the visual renderer that will accompany spell analysis in the
Studio. When the visual renderer is built (see APP-PLAN.md §2 / SPEC.md WS1), its effect modules
will emit particle / glow / portal animations keyed on the engine's deduced `element`, `force`,
`spread`, `direction`, and similar parameters. The effect lab lets you dial those parameters with
live sliders — no round-trip through the draw-recognize-analyze pipeline — and immediately see
what the animation looks like. Changes to a renderer effect module are reflected instantly on
refresh.

The lab mirrors the shape of `spellEffectLab.js` in the sibling project: it builds a synthetic
`SpellIR`-like object from the slider values, passes it to the renderer, and runs a
`requestAnimationFrame` loop.

**Note on timing:** the visual renderer does not exist yet in this project (the sibling has one;
this project's renderer is planned). The lab spec is written against the renderer architecture
described in APP-PLAN.md and the sibling's effect module conventions. Build the lab alongside the
renderer, not before it — the lab's value comes from exercising the real modules, not a stub.

### Files

| File | Notes |
|---|---|
| `tools/spellEffectLab.html` | The lab page |
| `tools/spellEffectLab.js` | Its driver |

### Real modules imported (once the renderer exists)

```js
// These paths are illustrative — match wherever the renderer lands in src/
import { SpellEffectRenderer } from '../src/studio/effects/SpellEffectRenderer.js'
import { buildSpellIR } from '../src/studio/effects/effectUtils.js'
```

`grammar.json` and `sigils.json` are loaded via `fetch` to populate the element dropdown with the
real element list from `grammar.json.elements` (fire, water, earth, air, time, etc.) so the lab
always reflects the current catalog, not a hardcoded list.

If the renderer is built as pure modules (no React, no Konva dependency) the import works
directly. If it is React-Konva-only, the lab will need a minimal shim canvas; design the renderer
to accept a plain `<canvas>` context so the lab can wire it without React.

### UI

- Two stacked `<canvas>` elements (full available height): one for the synthetic glyph underlay
  (a drawn ring + placeholder sigil shape), one for the effect particles/glow on top.
- An **element selector** (`<select>`) — populated from `grammar.json.elements`; changing it
  restarts the effect with the new element's color/particle properties.
- A **Reset** button to re-seed particle state without changing any parameters.
- A **Controls sidebar** with live `<input type="range">` sliders, one per tunable parameter.
  Each slider shows a label, current value, and a one-line description of what it controls.
  Parameters (adapt to the actual renderer's interface when built):
  - `force` (0–1): particle speed and pressure
  - `spread` (0–1): emission cone width
  - `direction` (x/y tilt in degrees): leans the effect; maps to the engine's directional bias
  - `duration` (0.5–10 s): how long the active effect lives
  - `stability` (0–1): reduces jitter and flicker
  - `gravity` (0–1): falling vs. suspended — 0 = levitation-like
  - `convergence` / `convergenceRadius` (0–1 / 0.03–0.35): stream-narrowing behaviour
  - `ringRadius` (0.2–0.46): changes the synthetic ring size and portal scale
  - (Add/remove sliders as the renderer's parameter surface evolves; the slider block is rendered
    programmatically so adding a control is a one-line entry in the controls map.)
- A **Paste wha-spell@1 JSON** textarea + **Apply** button: accepts an engine composition export,
  runs the engine `analyze()` on it client-side (`import { analyze } from '../src/engine/analyze.js'`
  via `fetch` for JSON data), and pre-loads the sliders with the deduced `force`, `spread`,
  `direction`, `element`, etc. — so you can paste any spell from the Studio and see what its
  effect *should* look like, then tweak from there.
- A **Copy current IR** button: serializes the slider state into the engine-compatible parameter
  object and copies it to clipboard, ready to paste into a renderer test or a `spells.json` entry.
- A **Current IR** `<pre>` block showing the live parameter object (updates as sliders move).

### Sync with real code

The lab imports `SpellEffectRenderer` and any effect utility modules directly. When a particle
system or element shader changes, refreshing the lab page shows the result immediately. The lab
also imports `analyze()` from `src/engine/analyze.js` for the "paste spell JSON" path, so the
parameter extraction is the same function the Studio uses — the lab is an integration test for
the renderer + engine pipeline, not a copy.

### Phasing and effort

**Effort: M–L.** The HTML shell and slider wiring is S-effort; the effort scales with the
renderer's complexity. Build this **in parallel with** the visual renderer (SPEC.md WS1 extension
/ a future WS for animation), not before it. The lab is L-effort only if the renderer itself is
L-effort; the lab code per se is M or less.

Independence: building the lab shell and the slider wiring before the renderer is done is low
value — stub it as a placeholder with a bare canvas and wire the real modules as they land. The
HTML + controls skeleton can be committed first.

### Acceptance criteria

- Selecting `fire` and adjusting `force` visually changes particle speed in real time with no
  page reload.
- Pasting a known-valid `wha-spell@1` JSON (e.g. `pyreball.json`) populates the sliders with
  deduced parameters and starts the matching animation.
- Copying the current IR and running it through `npm run facts -- <pasted-ir>` produces a
  consistent parameter readout.
- The `element` dropdown matches `grammar.json.elements` exactly (no hardcoded list).
- Changes to a renderer effect module (e.g. `SpellEffectRenderer.js`) are reflected on page
  refresh with no changes to the lab file itself.

### Testing notes

Effect rendering is inherently visual — automated testing requires pixel comparison or manual
review. The lab is the primary feedback loop. The parameter extraction path (slider state →
`SpellIR` object → renderer call) can be unit-tested if `buildSpellIR` is kept pure; that is a
good constraint to enforce when the renderer is designed. The engine path (`analyze()`) is
already covered by `test/deduce.test.js`.

---

## Cross-cutting: how all three tools stay in sync

| Concern | Approach |
|---|---|
| Pure imports | All three import only pure modules from `src/draw/` or future `src/studio/effects/`; data (JSON) is fetched. Changing a module is reflected on page refresh. |
| No JSON imports in source | `recognizer.js`, `templates.js`, and any future pure renderer modules must stay JSON-free (the existing constraint). The tools load JSON via `fetch`, same as if they were a non-React browser client. |
| Out of the production bundle | Vite bundles only from `index.html`'s entry points. `tools/*.html` are never imported, so they are never bundled. Confirmed by `npm run build` producing no `tools/` output. |
| No extra dev server config | `vite.config.js` already has `server: { fs: { allow: ['..', '.'] } }`, which allows `tools/*.html` to reach `src/` and `data/`. No config change needed. |
| Tests | Underlying pure modules have `node --test` coverage. The tool pages are manual-test only. If a test needs to exercise recognizer normalization end-to-end, write it in `test/` against the pure module — not by automating the browser tool. |

---

## Phasing summary

| Tool | Depends on | Effort | When to build |
|---|---|---|---|
| **7.4a Stroke Template Maker + Viewer** | `recognizer.js`, `templates.js` (both exist) | S | Now — before Supabase; uses localStorage |
| **7.4b Sigil/Sign Detector Lab** | 7.4a (populated templates) + A1 weighting | M | After A1 source-weighting lands (SPEC-recognizer-analysis.md); can stub with equal weights before |
| **7.4c Spell Effect Lab** | Visual renderer (not yet built) | M–L (shell S; full wiring M) | Shell now; full wiring in parallel with the renderer WS |

All three are independent of the Supabase stack, of Admin, and of the AI report. They can be
built and used on the `feat/spell-studio` branch without touching Studio or Admin code.
