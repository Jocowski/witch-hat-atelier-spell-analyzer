# DRAWING-APP.md — the unified Spell Studio roadmap

> Vision doc (companion to [PLAN.md](../../PLAN.md)). Where the project is going: from a
> drag-and-drop authoring tool into a **complete Spell Studio** where you *draw* a spell freely,
> the app *recognizes* the symbols, and **two** analyses run side by side — the deterministic
> engine and an AI reasoner. Every drawing the user confirms or corrects becomes training data.

## The one idea that holds it together

There are two ways to *input* a spell, but they produce the **same `composition` object**, which
feeds the **same `analyze()`**:

```
            ┌─ drag ready-made sigils/signs (exists today)
 INPUT  ────┤                                                  ──►  composition  ──►  analyze()
            └─ draw freely → recognizer → composition (new)                 │
                                                                            ├─►  engine analysis (deterministic, instant)
                                                                            └─►  AI analysis (claude -p, first-principles)
```

Drawing is **not a new app** — it is a second input method plugged into the engine that already
exists. Keep that boundary sacred and the whole thing stays small.

## The flywheel (why this is really a data project)

The recognizer is the easy part. The valuable, compounding asset is **labeled drawings**. So every
surface is designed to *emit* a training example:

```
user draws → app guesses → user confirms OR corrects → that stroke set is saved with its label
          → recognizer improves → next guess is better
```

A correction (app guessed wrong, user fixed it) is the most valuable sample of all — capture it.

---

## Recognition is a progression, not one tech choice

| Stage | Technique | Why |
|---|---|---|
| Now | **`$P` point-cloud matcher** (template matching) | Learns from **1 example**, runs in the browser, zero infra. It is also the *data-collection tool*. |
| Transition | `$P` + **confirm/correct UI** | Low-confidence guess → ask the user → the answer becomes a labeled sample. |
| Mature | **Real ML model** (CNN over the rasterized glyph, or a point-sequence model) | Once there are hundreds of samples per symbol it beats `$P`. Train offline (PyTorch), ship via TF.js/ONNX in the browser or an endpoint. |

`$P` is **not throwaway** — it is the long bridge that carries the project until there is enough
data to train a real model.

## The recognition pipeline (multi-symbol spell → identified parts)

Recognizing a whole spell = **segmenting** it into single symbols, then recognizing each. The magic
circle's *structure* does the heavy lifting:

```
raw strokes
   │  1. find the RING            (circle-fit: low radius-variance, closed, large)  → center + radius
   │  2. SEGMENT remaining strokes by proximity                                     → N symbol groups
   │  3. CENTER vs BORDER         (distance to center)                              → core vs signs (+ the count)
   │  4. DE-ROTATE each group     (sweep rotations, keep best $P score)             → canonical orientation (+ rotation field)
   │  5. $P per group                                                               → each symbol's id
   ▼
composition  →  analyze()
```

The hard part is **step 2** (segmentation). Mitigations, in order of reliability: *commit one symbol
at a time* (no ambiguity) → *snap to ring slots* → *automatic clustering with a user-tunable gap*
→ (eventually) a model trained on the full-spell samples collected by the earlier modes.

Now implemented in the app: the `$P` recognizer + pipeline live in [src/draw/recognizer.js](../../src/draw/recognizer.js)
and the Studio's Detect→correct→Analyze flow ([src/studio/](../../src/studio/)). *(The original standalone
`prototypes/shape-recognizer` sandbox was removed once the in-app version superseded it.)*

---

## The two analyses

- **Engine** — `analyze(composition)` / `tools/spell-engine-cli.mjs`. Deterministic, runs in the
  browser, instant. Validity, sigils/signs, deduced effect, catalog match. *Exists today.*
- **AI** — feeds the composition + the engine's `--facts` to Claude, which reasons the effect from
  first principles using [docs/CORE.md](../CORE.md) + [docs/lexicon/](../lexicon/). This is what the
  `/spell-analyzer` skill already does conceptually; the bridge automates it.

### Local AI without paying per-token (the key finding)

The `claude` CLI is installed on the dev machine and runs under the existing Claude Code
subscription. So a tiny **local bridge** can do the AI analysis with **no API token cost**:

```
browser → http://localhost:8787/analyze → spawns: claude -p (reads repo: CORE.md, lexicon, facts) → analysis
```

The app pings `/health`; if the bridge is up → "AI (local) available", else it hides the button or
falls back to the paid API. **Caveat:** this is a *personal/dev* convenience — a public multi-user
app cannot legitimately funnel strangers through one subscription, so production AI = the Anthropic
API (paid) or user-provided keys. See `tools/ai-bridge.mjs` and `npm run ai`.

---

## Storage: only add a database when other people contribute

| Phase | Storage | Need a DB? |
|---|---|---|
| Solo, now | `localStorage` + **Export/Import JSON** | No |
| Versioned with the repo | a `templates.json` checked into git | No |
| **Multiple trusted contributors** | **central backend** (Supabase: Postgres + auth + storage) | **Yes** |

Do **not** build the backend before there are contributors. The path is
`localStorage → JSON in repo → Supabase`. Store **raw stroke points** (not just a raster image) per
sample — the image can always be derived, and points keep both point-based and image-based models
open. Sample record: `{ points[], label, role, rotation, scale, userId, ts, origin: drawn|corrected, canon|fan, appVersion }`.

## Custom (fan-made) signs: the problem is *meaning*, not art

A fan sign needs more than a drawing and a name — for `analyze()` to reason about it, it needs
**semantics**: a `kind`/`verb` operator in `grammar.json`. So "add custom sign" = **draw + name +
define behavior** (which operator kind it is). Reuse the existing `origin: canon | wiki | fan`
distinction to **namespace** fan signs so they never produce a false canon catalog match.

---

## Phased plan (each phase ships something usable)

0. **Drag-drop authoring + `analyze()`** — ✅ exists.
1. **Draw + `$P` recognizer + pipeline + correction loop** — ✅ now in-app (`src/draw/`, `src/studio/`).
2. **Recognizer as a 2nd input mode inside the app** → drawn `composition` flows into the real `analyze()`.  ← *in progress*
3. **Local AI bridge** (`claude -p`) + an "AI analysis" panel.  ← *in progress*
4. **Seed templates from the real SVG paths** (29 sigils + 40 signs) so recognition works out of the box.
5. **Supabase**: accounts, save spells, gallery, central training data.
6. **Train a real ML model** once the data is there; run it alongside `$P` and compare.
7. **Community gallery**: browse spells (composition + image + author + AI analysis); every saved/corrected spell feeds the training set.

## Open risks (be honest)

- **Data volume** — ML wants hundreds per class; with few contributors that's a grind. `$P` bridges it.
- **Segmentation** — the perennially hard part; the structured-canvas UI is the escape hatch.
- **Active learning** — make the app *ask* users to draw the symbols it has the fewest examples of.
- **Sample quality** — track samples per user so a bad contributor's data can be dropped in bulk.
- **Label drift** — recognizer labels must be the **real** sigil/sign ids (from `sigils.json`/`signs.json`), or the produced `composition` won't analyze. The in-app trainer should pick ids from a list, not free text.
