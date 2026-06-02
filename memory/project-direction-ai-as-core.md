---
name: project-direction-ai-as-core
description: The user's north-star vision for this project — AI is the core magic-reasoning engine; the code engine is a compiler + tools, not the authority.
metadata:
  type: project
---

On 2026-06-01 the user laid out the project's intended direction (a reframe of the
current architecture):

- **AI (Claude) is the CORE magic system** — the "programming language" runtime. The goal
  is NOT to memorize recipe→spell mappings but to reason from FIRST PRINCIPLES: what a sign
  does, how its direction/position/quantity/size/inversion changes the effect, what a sigil
  does under those signs, limitations, whether it works, what a different sign would do.
  Understand fundamentals → generate results (analysis, creation, theories, contraptions).
- **The code engine is a "compiler" + toolset, NOT the authority.** Its job: translate the
  drawing ↔ a representation both sides understand (JSON IR for the AI, rendered image for
  the human), and offer validation/analysis as *tools the AI may use*. The deterministic
  deduction (`data/grammar.json` + `src/engine/deduce.js`) should be repositioned as a
  heuristic/scaffold; the AI's reasoning is primary. (This already matches reality — the
  skill `learnings.md` is full of "engine blind spot — override in your reading.")
- **The AI should understand how each symbol is DRAWN** (lines, arcs, circles, dots,
  symmetry, where the "front" is) — a structured stroke-level lexicon, not opaque potrace
  SVG blobs — to reason about construction and unknown signs.
- **Feedback loop:** the user keeps feeding spells, signs, sigils, theories (canon + fan),
  usages, contraptions, and other people's feedback. Each ingestion should make analyzing
  *similar* spells and *creating* new ones easier — so knowledge wants to be concept-indexed
  (per element / per sign / per pattern / contraption library), not just a flat dated log.

Three pillars the user named: (1) feed all knowledge = `docs/`; (2) process/analyze/create
= the Claude skills; (3) improve the engine to make processing easier for the AI (internal
logic / structured facts) and for the human (drawings). See [[no-ring-visual-disclaimer]].
