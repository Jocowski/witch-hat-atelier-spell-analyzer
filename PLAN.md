# PLAN — Re-architecting toward "AI as the core magic system"

> Status: **draft for review** (2026-06-01). This is a design doc, not yet implemented.
> It captures the project's intended direction and a phased plan to get there.
> Companion to [ANALYSIS.md](ANALYSIS.md) (which describes the system *as built today*).

---

## 1. The north star

**The AI (Claude) is the core magic-reasoning runtime.** It understands the *fundamentals*
of the magic system — what each sign does, how direction/position/quantity/size/inversion
change the effect, what a sigil does under those signs, the limitations, whether a
composition works and what would happen, and what a *different* sign would do — and from
those fundamentals it **generates results**: analyses, new spells, theories, and
contraptions.

**The code engine is a "compiler" + a toolset, not the authority.** Its jobs:
1. **Compile both ways** — translate a drawing into a representation the AI can read (the
   JSON IR), and translate the AI's result back into an image the human can read.
2. **Offer tools** — validation, geometry facts, catalog matching — that the AI *may use*,
   but that do not override the AI's first-principles reasoning.

**The docs are the knowledge base** the user continuously feeds (spells, signs, sigils,
theories canon + fan-made, usages, contraptions, other people's feedback). Each ingestion
should make analyzing *similar* spells and *creating* new ones easier.

### The data-flow we are migrating toward

```
FROM (today):  draw → JSON → engine DEDUCES the effect (authoritative prose) → AI narrates & corrects
TO   (target): draw → JSON → engine PARSES into structured facts → AI REASONS the effect
                                                                  → engine RENDERS the result to an image
```

---

## 2. Why re-architect, not rewrite

The foundations are strong and worth keeping: the canon docs corpus, the `wha-spell` IR,
the SVG renderer + potrace vectorizer, the geometry math, the test harness, the canon
catalog, and three mature skills. What is misplaced is the **center of gravity**, not the
parts.

The strongest evidence that the AI should be the core is already in the repo:
[.claude/skills/spell-analyzer/references/learnings.md](.claude/skills/spell-analyzer/references/learnings.md)
is dominated by "engine blind spot — override these in your reading," "treat those as
artifacts," "the engine reports this invalid (false-negative)." The deterministic
deduction in [data/grammar.json](data/grammar.json) + [src/engine/deduce.js](src/engine/deduce.js)
is routinely corrected by the AI. We are finishing a migration the project has informally
been doing already.

**Decision: re-architect in place.** Move the brain from `deduce.js` to the AI, reposition
the engine as compiler + tools, and build the two missing pillars (a first-principles core
and a drawing lexicon).

---

## 3. Gap analysis (against the three pillars)

| Pillar | Have | Gap to close |
|---|---|---|
| **Feed knowledge (docs)** | Canon docs; 24 archived analyses in `docs/spells/`; unknown-sign pipeline (`npm run unknown:report`). | Knowledge is **flat/chronological** (one growing `learnings.md`), not **concept-indexed**. No **contraptions** (multi-spell device) library. |
| **Process / create (skills)** | `spell-analyzer`, `spell-creator`, `spell-idea` with clean handoffs and a reasoning-first analyzer prompt. | Skills treat the engine's *effect prose* as "base facts" then override it. They lean on a quick cheat-sheet, not a true fundamentals core. |
| **Improve the engine (compiler)** | `wha-spell@1` IR (+ nested `@2` hinted); validation; geometry facts; GUI render + copy-image; vectorizer. | **No headless AI→image render.** Engine emits authoritative *prose* instead of clean *facts*. IR not formally specced. **Drawing primitives not modeled.** |

Two requirements from the brainstorm that the project barely addresses yet:

- **Understand the fundamentals** → there is no consolidated first-principles semantics; it
  is scattered across `magic-system.md`, `grammar.json`, and `ANALYSIS.md` §8.
- **Understand how each symbol is drawn** → missing entirely; the only drawing data is
  opaque potrace `svgPath` blobs that must not be hand-edited.

---

## 4. The phased plan

Each phase is independently useful and shippable. Phase 1 is pure authoring (no code risk)
and delivers the core of the vision; Phase 2 is the highest-value code work.

### Phase 1 — Build **The Core** (the "magic programming language")

**1.1 `docs/CORE.md` — first-principles semantics.** A reasoning model, not a lookup table:
- **Substances as objects with properties:** capability (`create | manipulate | collect`),
  physical state (`fluid | granular | rigid | gaseous | luminous | immaterial`), and the
  external source each needs (e.g. earth manipulates → needs real ground; water can create →
  self-sufficient; water can also collect → cheaper, needs ambient humidity).
- **Signs as typed operators**, each with:
  - *preconditions* — what substance/state it requires to do anything;
  - *parameters* — direction, position, quantity, size, tilt, inversion — and **what each
    parameter does to the output** (this is the "what changes if I move/resize/rotate/invert
    it, and what if I swap in sign Z" machinery, made explicit);
  - *failure modes* — what an ill-posed use produces.
- **Composition rules:** how operators combine and conflict; symmetry → stability;
  size/neatness/links → power & duration; the geometry → effect mappings.
- Supersedes the scattered logic in `magic-system.md`, `grammar.json`, `ANALYSIS.md` §8.

**1.2 `docs/lexicon/` — the symbol drawing lexicon.** One structured entry per sign & sigil:
- **How it is drawn**, in primitives: strokes (`line | arc | dot | circle`), counts,
  symmetry class, and where the "front / business-end" points.
- The **shape → meaning** link (e.g. *Column = a long shaft + a short crossbar; the long end
  is the aimed direction*).
- Gives the AI a vocabulary to reason about construction and to **interpret unknown signs by
  their geometry** (systematizing the `unknown_05` "half-arc, convex toward core" reasoning).

**Acceptance:** an analysis can be produced citing `docs/CORE.md` + `docs/lexicon/` instead
of `grammar.json`, and reach the same or better conclusions than today on 3 sample spells.

### Phase 2 — Turn the engine into a clean **compiler**

**2.1 Engine emits structured facts, not authoritative prose.**
- Keep [src/engine/geometry.js](src/engine/geometry.js) (symmetry/balance/zones/tilt are
  reliable, valuable observations).
- Add a `facts` output to [tools/spell-engine-cli.mjs](tools/spell-engine-cli.mjs): the
  parsed sign multiset, resolved geometry, element constraints, inversion-validity, and
  warnings — the raw observations the AI reasons *from*.
- **Demote `deduce.summary`** to an explicitly-labeled "quick heuristic." Keep it for the
  GUI's live readout; stop treating it as ground truth in the skills.

**2.2 Headless render: JSON → SVG/PNG (`tools/render.mjs`).** So the AI can hand the user an
*image* of a spell it designed, without the GUI. Completes the AI→human compiler direction
and makes `spell-creator` output instantly viewable.

**2.3 Formalize the IR (`docs/IR.md`).** Spec the `wha-spell` format (v1 + nested `@2`), so
the shared language both sides compile to is explicit and versioned.

**Acceptance:** `spell-creator` produces a JSON, `tools/render.mjs` turns it into a PNG, and
`tools/spell-engine-cli.mjs --facts` returns clean structured observations with no prose
effect claim.

### Phase 3 — Restructure the **knowledge base** for a real feedback loop

**3.1 Concept-indexed dossiers.** Migrate the flat `learnings.md` into per-**element** and
per-**sign** dossiers (the `docs/lexicon/` entries accumulate findings), plus a **patterns**
index (recurring recipes) and a **contraptions** library (linked / nested / toggled / glaive
devices). Goal: analyzing one water spell measurably eases the next — which requires
knowledge filed by concept, not by date.

**3.2 Ingestion workflow.** A short, documented path for "when the user feeds a
spell/theory/feedback, here is where it lands" (which dossier; whether it updates the core;
whether canon → catalog). Keep the unknown-sign pipeline; wire its output to the lexicon.

**Acceptance:** a new spell analysis updates exactly one element dossier + the relevant sign
entries, and a follow-up similar spell can cite that accumulated knowledge.

### Phase 4 — Re-point the **skills** at the new core

Update all three skills to (a) read `docs/CORE.md` + the lexicon as their reasoning base,
(b) consume engine **facts** rather than prose, and (c) write findings back into the concept
dossiers. Mostly prompt edits — low risk, high leverage.

**Acceptance:** the skills no longer instruct "trust the engine for the base effect"; they
instruct "reason from the core; use engine facts as observations."

---

## 5. What we keep, change, and retire

| Component | Fate |
|---|---|
| `docs/` canon + `docs/spells/` archive | **Keep & grow** (the knowledge base). |
| `src/engine/geometry.js`, `compose.js`, validation | **Keep** — reliable structured facts. |
| `wha-spell` IR, renderer, vectorizer, GUI | **Keep & extend** (formalize IR; add headless render). |
| `data/spells.json` catalog + matcher | **Keep** — useful "have I seen this before?" tool. |
| `data/grammar.json` + `src/engine/deduce.js` prose | **Reposition** as a labeled heuristic; stop treating as authority. |
| Three skills | **Refactor** to point at the new core. |
| `learnings.md` (flat log) | **Migrate** into concept-indexed dossiers. |
| Symbol drawing primitives | **New** (`docs/lexicon/`). |
| First-principles semantics | **New** (`docs/CORE.md`). |

Nothing is deleted outright; the engine deduction stays available as a fast scaffold.

---

## 6. Risks & open questions

- **Determinism for the GUI.** The live app needs *some* instant readout without an AI call.
  Plan: keep the heuristic `deduce.summary` for the GUI, clearly labeled; the AI's reasoning
  is the authority only in skill-driven analyses. (Confirm this split is acceptable.)
- **Core vs. data duplication.** `docs/CORE.md` and `data/grammar.json` will overlap. Decide
  whether `grammar.json` is eventually *generated from* the core, or frozen as the heuristic's
  private data. (Leaning: freeze it as heuristic data.)
- **Lexicon authoring cost.** ~29 sigils + ~40 signs to describe in primitives. Could seed
  from the existing PNGs/docs and refine over time; doesn't have to be complete to be useful.
- **Scope of "contraptions."** Linked/nested/toggled/glaive devices may need IR additions
  (links, toggles) beyond the nested `@2` already hinted — size this before committing.

---

## 7. Suggested starting point

Recommended first move: **Phase 1** (pure authoring, delivers the vision, no code risk).
A lower-risk alternative is a **vertical slice** — take one element (e.g. water): write its
`CORE.md` section + lexicon entries for its signs + a render demo — to prove the approach
end-to-end before scaling to the whole system.
