---
name: spell-analyzer
description: >-
  Analyze a Witch Hat Atelier spell from the Spell Analyzer app. Use this whenever
  the user pastes or points to a spell JSON (the wha-spell@1 export, or a bare
  composition with core/components/ring/dyes), OR asks to analyze, explain, validate,
  break down, or describe a spell — whether a canon spell by name (Watershot Seal,
  Pyreball, Wall Breaker, etc.) or a custom seal they composed. Triggers on phrases
  like "analyze this spell", "is this seal valid", "what does this glyph do", "explain
  this composition", "break down this spell JSON", or dropping a .json export. Produces
  a full structured analysis (validity, how each sigil/sign shapes the effect, deduced
  effect, canon-grounded element-physics reasoning, comparison to the closest canon
  spell, usage ideas) grounded in the real engine, then — after the user reviews and
  approves — writes a doc to docs/spells/ and asks for an image/JSON for reproduction.
---

# Spell Analyzer

Analyze a *Witch Hat Atelier* spell end-to-end: validate it, deduce its effect from
first principles, explain how every part contributes, reason about how the substance's
physical nature interacts with each sign, compare it to the closest canon spell, and
suggest uses — then archive it in `docs/spells/`. Always reason from the **real engine**
and the **source docs** — never invent ids, effects, or validity.

**First, read [references/magic-system.md](references/magic-system.md)** — the distilled
ruleset (the core equation, validity rules, sigil/sign catalogs, operator kinds,
inversion, dyes, the composition JSON contract, and how to run the engine). It points
to the canonical `docs/` and `data/` files for anything you need in depth. Also skim
[references/learnings.md](references/learnings.md) for accumulated corrections — engine
blind spots and per-element limits you must override in your reading.

## Workflow

### 1. Identify the input
The user will give one of:
- **An app JSON** — either `{ "format": "wha-spell@1", … , "composition": {…} }` or a
  bare composition object. Save it to a temp file if pasted inline.
- **A description / spell name** — e.g. "the Watershot Seal" or "a seal that shoots a
  spinning jet of fire upward." You'll reconstruct a composition from the docs.
- **A mix** — JSON plus questions, or a description plus a partial recipe.

### 2. Get ground truth from the engine
For any JSON, run the real engine — do not eyeball validity or the effect:
```bash
node tools/spell-engine-cli.mjs --text path/to/spell.json     # human-readable
node tools/spell-engine-cli.mjs path/to/spell.json            # full JSON
```
It returns validity/issues, the deduced effect (`summary` + per-part `breakdown` +
`notes`/`warnings`), geometry (symmetry/balance/power/spin), dyes, and `unknownIds`
(catch typos). Trust it for the **base facts**; your job is to layer narrative,
canon-grounded element-physics reasoning, and usage on top.

If the user gave only a **description or name**:
1. Reconstruct the recipe from [docs/spells.md](../../../docs/spells.md),
   [docs/sigils.md](../../../docs/sigils.md), [docs/signs.md](../../../docs/signs.md)
   (and the matching `data/*.json` for exact ids). For canon spells, use the
   newest/official form (per spells.md).
2. Build a composition JSON (see the cheat-sheet's even-placement helper for angles).
3. **Confirm the reconstruction with the user** before treating it as authoritative,
   then run it through the engine.

### 3. Ask when it matters
If the input is ambiguous — unclear intent, missing ids, a part that could be sigil
or sign, an effect the docs don't pin down — **ask the user** rather than guessing.
Good questions: "Is the column meant to point inward or be inverted?", "Should this be
canon-accurate or your own variant?", "Do you want dyes factored in?"

### 4. Present the analysis
Deliver a complete, readable analysis in the conversation covering, in order:
1. **Verdict** — valid / invalid, in one line, with the key reason. (Ring open/closed is
   only the app's activation *visual* — do **not** report active/inactive in the analysis;
   the engine no longer emits it.)
2. **Substance (sigils)** — each sigil's element and what it brings. Pull the canon
   constraint from [docs/sigils.md](../../../docs/sigils.md) and **cite it** (`file:line`):
   whether the element can *create* vs. only *manipulate*/*collect* its material is
   decisive — an element that "cannot create" behaves very differently from one that can.
3. **Form (signs)** — each sign: category, what it does *here*, whether inverted/tilted
   matters. Pull the canon mechanic from [docs/signs.md](../../../docs/signs.md), cite it,
   and honor any uncertainty the docs flag.
4. **Deduced effect** — the engine summary, restated plainly.
5. **How each part shapes it** — a small table; for each part, what would change without it.
6. **Element-physics & canon grounding** — **THE CORE OF THE ANALYSIS.** Reason from
   first principles about how the substance's *physical nature* interacts with each
   sign's mechanic, and compare the spell to its closest canon analogue:
   - Does the element's create/manipulate/collect constraint change what's possible?
     (e.g. an earth spell can't conjure its material, so it needs a real source nearby —
     "a pump that needs a reservoir," vs. a self-sufficient water spell.)
   - Does the substance's physical state fit the sign's mechanic? (e.g. Orb fills a
     sphere bottom-to-top under gravity like a fluid — water and loose sand pool cleanly,
     but rigid rock/wood would stack and jam, so you'd need a compaction sign.)
   - Compare to the closest canon spell: state plainly what is the **same**, what
     **differs**, and **why** — grounded in the sigil/sign docs, cited by `file:line`.
   - End with a one-paragraph **bottom line** synthesizing feasibility + the key
     difference (e.g. "a floating *sand* reservoir where Water Orb is a *water* one").
   Mark engine facts vs. your own reading throughout.
7. **Usage ideas** — concrete in-world applications (practical and creative).
8. **Other info** — stability/balance/power/spin, forbidden-magic flags, decorative notes.

Ground every claim in the docs/engine. If the source material is uncertain about a
part (many signs are), say so — fidelity to canon's ambiguity matters here. Do **not**
add "Variations" or "Modifications" sections — the value is in canon-grounded reasoning,
not in enumerating swaps.

**Distinguish engine output from your own narrative.** Validity, the deduced effect,
geometry, and any catalog `similar` matches come from the engine — label them as such.
Anything you add from the docs (e.g. related/comparable canon spells beyond what the
catalog returns) is *your reading*; mark it clearly (e.g. "Related spells (from the
docs)") so it's never mistaken for an engine catalog match. The catalog
(`data/spells.json`) is **populated with the canon spells** (each archived canon doc is
added to it — see step 6a), so the CLI now reports a "Similar spells" section with a
**Match** or **Nearest** list. A spell will usually match **itself** once archived; that's
expected. If `catalogEmpty` is ever true again, the catalog was reset — fall back to docs.

### 5. Get the user's approval before archiving
**Do NOT write the `.md` file yet.** After presenting the analysis (step 4), explicitly
invite the user to review and discuss it: confirm the verdict, the effect reading, the
recipe (inversion/ring/dyes), and the narrative sections. Adjust the analysis based on
their feedback and re-present if needed. Only proceed to step 6 once the user **explicitly
approves** writing the doc (e.g. "looks good", "go ahead", "save it"). If the user never
approves, do not create the file.

### 6. Archive the spell in docs/spells/ (only after approval)
Once approved, write `docs/spells/<Spell_Name>.md` using
[references/spell-doc-template.md](references/spell-doc-template.md). It records: type,
**canon vs community** origin, forbidden flag, the recipe (core/signs/dyes/symmetry),
the full analysis, **element behavior & canon grounding**, **how to draw it**, usage,
and a **Reproduction** section with the importable `wha-spell@1` JSON embedded.

Then **ask the user for an image and/or JSON** to drop into `assets/spells/` for easy
reproduction later:
> "I've documented this in `docs/spells/<Name>.md`. To make it easy to reproduce, can
> you share a screenshot/PNG (I'll save it to `assets/spells/`) and/or the app's JSON
> export? I've embedded the JSON I have, but yours from the app is authoritative."

If the user provides them, save to `assets/spells/<Spell_Name>.{png,json}` and update
the doc's frontmatter `image:`/`json:` fields and the Reproduction section.

#### 6a. If the spell is CANON, add it to the engine catalog (`data/spells.json`)
The catalog is what makes the analyzer **cumulative**: the engine matches each new
composition against it and reports "Similar spells." So whenever you archive a doc whose
**`origin` is `canon`** (skip `community`/fan-made spells), also append a recipe entry to
`data/spells.json` so future analyses can match against it.

- **Only canon spells.** Community variants don't go in the catalog (they'd produce false
  "canon match" results). If unsure whether it's canon, ask.
- **Don't duplicate.** Check `data/spells.json` for an existing entry with the same `id`
  first; update it instead of adding a second.
- **Use real ids.** Every `composition.core` and `composition.signs[].id` must be an
  actual id from `data/sigils.json`/`data/signs.json` (e.g. Region's id is `direction`,
  not `region`) — the data-integrity test fails otherwise. Verify before writing.
- **Entry shape** (see the file's own `description`/`placementVocab`/`symmetryVocab`):
  ```json
  {
    "id": "<unique_snake_case>", "name": "<Display Name>",
    "category": "<element, e.g. fire|water>", "origin": "canon",
    "confidence": "high|medium|low|theoretical|unknown",
    "effect": "<one-line effect>",
    "composition": {
      "core": "<sigil/sign id>",
      "signs": [ { "id": "<sign id>", "count": N, "placement": "<vocab>", "orientation": "inward|outward|front|...", "inverted": false } ],
      "symmetry": "radial|bilateral|asymmetric"
    }
  }
  ```
  `confidence` lowers the match score for less-certain spells (e.g. one leaning on an
  ambiguous sign like `sign_of_wind` → `medium`). The matcher reads `core`, the sign
  multiset (`id`+`count`+`inverted`), `symmetry`, and `confidence`; `placement`/
  `orientation` are informational. Required by tests: unique `id`, `effect`, `category`.
- **Verify after writing:** run `node --test test/data-integrity.test.js` (id integrity)
  and re-run the CLI on the spell — it should now report a "Similar spells" **Match** to
  itself near the top of the ranking.

### 7. Record what you learned
This skill should get smarter over time. When the user corrects you, or you discover a
nuance about how a part behaves or a class of magic (e.g. a limitation of time sigils,
how a specific interaction resolves, a canon detail), append a **dated one-liner** to
[references/learnings.md](references/learnings.md) so future analyses benefit. Record the
durable lesson, not the engine-fix narrative (that lives in git history).

## Output principles
- **Engine first, narrative second.** Validity and the base effect come from
  `spell-engine-cli.mjs`; you add interpretation, not contradiction.
- **Reason from canon physics — this is the point.** The heart of an analysis is
  reasoning about how the substance's physical nature (create/manipulate/collect;
  fluid/granular/rigid) interacts with each sign's documented mechanic, and how the
  spell compares to its closest canon analogue. Cite the sigil/sign docs (`file:line`)
  for every such claim. Don't pad with variation/modification lists.
- **No invented ids or effects.** If a part isn't in `data/`, flag it (the CLI lists
  `unknownIds`) and ask.
- **Honor canon's ambiguity.** Where the manga/wiki is unsure (asymmetric signs, eye,
  bend, link, etc.), present it as uncertain rather than inventing certainty.
- **Flag forbidden magic.** Body magic, reality-warping, or mass destruction ⇒ mark it
  forbidden (still analyze it). See the cheat-sheet §8.

## Learnings log
Accumulated corrections live in [references/learnings.md](references/learnings.md) —
engine blind spots, per-element limits, and canon nuances. Skim it before analyzing and
append new dated one-liners there (keep this skill lean).
