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

**You are the reasoner; the engine is a compiler + fact extractor** (see
[docs/PLAN.md](../../../PLAN.md)). Reason the effect from first principles — do not treat the
engine's prose as the answer. Read, in order:
- **[docs/CORE.md](../../../docs/CORE.md)** — the first-principles model you reason WITH
  (substance create/manipulate/collect + state, signs as typed operators, geometry as
  parameters, composition/validity). This is the base.
- **[docs/lexicon/](../../../docs/lexicon/)** — per-symbol detail: how each sigil/sign is
  *drawn*, what it does, and accumulated **Findings**. Pull the specific entries for the parts
  in front of you (this is where per-symbol nuance now lives, not learnings.md).
- [references/magic-system.md](references/magic-system.md) — a fast cheat-sheet for quick
  lookups when you don't need CORE's depth.
- [references/learnings.md](references/learnings.md) — **engine quirks / blind spots** to
  override in your reading (per-symbol nuance moved to the lexicon).

## Workflow

### 1. Identify the input
The user will give one of:
- **An app JSON** — either `{ "format": "wha-spell@1", … , "composition": {…} }` or a
  bare composition object. Save it to a temp file if pasted inline.
- **A description / spell name** — e.g. "the Watershot Seal" or "a seal that shoots a
  spinning jet of fire upward." You'll reconstruct a composition from the docs.
- **A mix** — JSON plus questions, or a description plus a partial recipe.

### 2. Get structured FACTS from the engine (then reason the effect yourself)
For any JSON, run the engine in **facts mode** — it parses the drawing into reliable,
observable facts; it does NOT tell you what the spell does:
```bash
node tools/spell-engine-cli.mjs --facts path/to/spell.json    # structured observations (use this)
node tools/spell-engine-cli.mjs --text  path/to/spell.json    # human-readable heuristic report
```
`--facts` returns: parts present (core/sigils/signs with category + **operatorKind**),
geometry (symmetry/balance/aim/power/spin/zones), dyes, catalog neighbours, and `unknownIds`
(catch typos). **Trust these for structure/geometry.** The `heuristicSummary`/`combined…`
fields are a deterministic scaffold — **not** ground truth; the effect is something *you derive*
from [docs/CORE.md](../../../docs/CORE.md) + the [lexicon](../../../docs/lexicon/) using these
facts. (Honor the learnings.md engine blind spots — facts geometry is element-blind.)

To show the user a picture of the spell, render it:
```bash
node tools/render.mjs path/to/spell.json -o spell.svg          # IR → SVG (AI → human)
```

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
4. **Deduced effect** — *your* reading, reasoned from CORE.md + the lexicon using the engine
   facts (geometry/parts), stated plainly. Do not just echo the `heuristicSummary`.
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
9. **Sum up (plain terms)** — ALWAYS close with this. A short, jargon-free recap for someone
   who skipped the analysis: in everyday language, **what the spell does**, **how it works**
   (a few simple steps — "it makes its own light, then spreads it on all sides…"), and **what
   it's best used for**. No `file:line` cites, no sign/operator vocabulary, no engine terms —
   just the plain picture. One short comparison is fine ("it's the opposite of a Light Beam").
   Keep it tight (a few short paragraphs or a small step list). This is the part most users
   actually read, so make it land on its own.

Ground every claim in the docs/engine. If the source material is uncertain about a
part (many signs are), say so — fidelity to canon's ambiguity matters here. Do **not**
add "Variations" or "Modifications" sections — the value is in canon-grounded reasoning,
not in enumerating swaps.

**When the effect can't be pinned down (unknown core/signs, or ambiguous canon): give
hypotheses, not a shrug.** An unidentified part (element `unknown`, an `unknown_NN` sign,
or a doc-flagged ambiguous sign) means you *cannot state the effect as fact* — but "the
deduction is incomplete" is the **start** of the answer, not the whole of it. After saying
what's unknown, lay out the **plausible interpretations** so the reader still learns something:
- **Reason from what you DO know** — the geometry (engine facts), the identified parts, the
  spell's canon name/purpose, and how similar shapes behave in other spells — to constrain
  what the unknown part is likely doing.
- **Offer 2–4 ranked hypotheses** ("most likely / possible / long-shot"), each with the
  in-world consequence it would produce ("if the core is a repel-field → animals avoid the
  lit zone; if it's a marker → it only tags the spot and the light does the deterring").
- **State what would happen under each**, and what observation/extra symbol would tell them
  apart. Mark all of it clearly as **hypothesis, not canon**, and never upgrade a guess to a
  fact in the doc, the catalog `confidence`, or the lexicon Findings (record it under
  `theories`, not `effect`).

**Distinguish engine facts from your own reasoning.** Validity (structure), geometry, and
catalog `similar` matches are **engine facts** — label them as such. The **deduced effect is
yours** (reasoned from CORE.md + lexicon), as is the canon-physics narrative — the engine's
`heuristicSummary` is only a scaffold, never cite it as authority.
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
the `origin` tier (`canon`/`wiki`/`fan`) + `source` citation, forbidden flag, the recipe (core/signs/dyes/symmetry),
the full analysis, **element behavior & canon grounding**, **how to draw it**, usage,
and a **Reproduction** section with the importable `wha-spell@1` JSON embedded.

Then **ask the user for an image and/or JSON** to drop into `assets/spells/` for easy
reproduction later:
> "I've documented this in `docs/spells/<Name>.md`. To make it easy to reproduce, can
> you share a screenshot/PNG (I'll save it to `assets/spells/`) and/or the app's JSON
> export? I've embedded the JSON I have, but yours from the app is authoritative."

If the user provides them, save to `assets/spells/<Spell_Name>.{png,json}` and update
the doc's frontmatter `image:`/`json:` fields and the Reproduction section.

#### 6a. If the spell is a real canon spell, add it to the engine catalog (`data/spells.json`)
The catalog is what makes the analyzer **cumulative**: the engine matches each new
composition against it and reports "Similar spells." So whenever you archive a doc whose
**`origin` is `canon` or `wiki`** (skip `fan`-invented spells), also append a recipe entry
to `data/spells.json` so future analyses can match against it — carrying its `origin` +
`source`.

- **Canon spells only (`canon`/`wiki`).** `fan`-invented variants don't go in the catalog
  (they'd produce false "canon match" results); they live in docs/spells only. If unsure
  whether the spell is real canon, ask.
- **Don't duplicate.** Check `data/spells.json` for an existing entry with the same `id`
  first; update it instead of adding a second.
- **Use real ids.** Every `composition.core` and `composition.signs[].id` must be an
  actual id from `data/sigils.json`/`data/signs.json` (e.g. Region's id is `direction`,
  not `region`) — the data-integrity test fails otherwise. Verify before writing.
- **Entry shape** (see the file's own `description`/`placementVocab`/`symmetryVocab`):
  ```json
  {
    "id": "<unique_snake_case>", "name": "<Display Name>",
    "category": "<element, e.g. fire|water>", "origin": "wiki",
    "source": "<telepedia URL + manga debut ch.; 'canon' only if lifted straight from the manga/anime>",
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

### 7. Record what you learned (file it by concept — see [docs/INGESTION.md](../../../docs/INGESTION.md))
This system should get smarter over time, so durable knowledge goes to a concept-indexed home:
- A nuance about **a sign/sigil** → that symbol's **Findings** in [docs/lexicon/](../../../docs/lexicon/)
  (dated, newest first). This is where per-symbol learning now lives.
- A reusable **technique/recipe** → [docs/patterns.md](../../../docs/patterns.md) or
  [docs/contraptions.md](../../../docs/contraptions.md).
- A **rule of the world** → [docs/CORE.md](../../../docs/CORE.md).
- An **engine quirk/blind-spot or process note** → [references/learnings.md](references/learnings.md).
Record the durable lesson, not the engine-fix narrative (that lives in git history).

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

## Knowledge homes
Per-symbol findings live in [docs/lexicon/](../../../docs/lexicon/) (each symbol's **Findings**);
per-spell archives in [docs/spells/](../../../docs/spells/); techniques in
[docs/patterns.md](../../../docs/patterns.md) / [docs/contraptions.md](../../../docs/contraptions.md);
world-rules in [docs/CORE.md](../../../docs/CORE.md); engine quirks in
[references/learnings.md](references/learnings.md). The map + workflows are in
[docs/INGESTION.md](../../../docs/INGESTION.md). Skim the relevant lexicon entries before
analyzing; file new lessons by concept.
