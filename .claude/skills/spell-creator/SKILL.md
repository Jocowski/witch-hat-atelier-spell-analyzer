---
name: spell-creator
description: >-
  Design a new Witch Hat Atelier spell from an idea or desired effect. Use this whenever
  the user describes a spell they want to create, invent, or build — e.g. "make a seal
  that shoots a spinning jet of fire", "I want a spell that freezes water mid-air", "design
  a glyph that pulls metal toward it", "is it possible to create a spell that heals wounds",
  "what signs would I need for a floating lantern" — or asks whether some effect is
  achievable within the magic system. Assesses feasibility against the system's rules,
  explains challenges, and either returns a buildable recipe with an importable wha-spell@1
  JSON (validated through the real engine) and usage notes, or — if it can't be built —
  explains why and offers the closest possible spells with similar effects. Distinct from
  spell-analyzer (which explains an EXISTING spell); use this one to CREATE.
---

# Spell Creator

Turn a desired effect into a buildable seal — or prove it can't be built and offer the
closest legal alternative. Always design within the documented rules and **validate the
result through the real engine** so the recipe genuinely produces the intended effect.

**Read both references first:**
- [references/design-playbook.md](references/design-playbook.md) — the design loop, the
  hard-constraint checklist ("can this exist?"), an effect→recipe table, and tuning levers.
- [../spell-analyzer/references/magic-system.md](../spell-analyzer/references/magic-system.md)
  — the shared cheat-sheet (core equation, validity rules, full sigil/sign catalogs,
  operator kinds, inversion, dyes, the composition JSON contract, engine usage).

These point to the canonical `docs/` and `data/` files. Never invent ids — read
`data/sigils.json` / `data/signs.json` for exact ids and effects.

## Workflow

### 1. Restate the goal
Pin the desired effect to one sentence: what substance, what form, aimed where, for what
use. If the request is vague or could mean several things, **ask the user** before designing.

### 2. Feasibility check
Walk the **hard-constraint checklist** in the playbook. Decide one of:
- **Buildable** — existing sigils + signs can express it.
- **Buildable with a flag** — works, but it's forbidden magic (body/reality/mass-destruction)
  or relies on an ambiguous sign. Proceed, but flag clearly.
- **Not buildable** — a constraint blocks it (e.g. "conjure rock from nothing" — earth can't
  *create* matter).

### 3a. If NOT buildable
Return:
1. **Why** — the specific constraint or limitation, with the doc reasoning (not a vague "no").
2. **Closest existing spells** — 1–3 canon spells with similar effects (from
   [docs/spells.md](../../../docs/spells.md) and the per-sign "Spells Using…" lists), and how
   they differ from the ask.
3. **A legal reframing** — the nearest buildable version of the intent, if one exists, and a
   recipe for it.

### 3b. If buildable
1. **Pick substance + signs** using the effect→recipe starters, then refine.
2. **Build the composition JSON** (`wha-spell@1` shape; see the cheat-sheet's even-placement
   helper for sign angles). Choose symmetry, inversion, tilt, scale deliberately.
3. **Validate through the engine** and iterate until the deduced effect matches the goal:
   ```bash
   echo '<composition-json>' | node tools/spell-engine-cli.mjs --text
   ```
   Fix any `unknownIds`, unwanted `warnings`, wrong direction, or instability. Re-run until
   `summary` reads like the intended effect and validity is clean (or intentionally inactive).
4. **Explain the design challenges** — balance/stability, ambiguous signs, anything the
   source material leaves uncertain, forbidden flags.
5. **Explain how to use it** — practical and creative applications, and how to draw it.
6. **Return the importable JSON** in a fenced block so the user can paste it into the app's
   Import (JSON). Include `name`, `ring`, `core`, `components`, `linkCount`, `dyes`.

### 4. Offer to document it
A freshly designed spell is a `community` spell. Offer to run **/spell-analyzer** on the JSON
to produce the full `docs/spells/<Name>.md` entry (origin: community) and to request an
image/JSON for `assets/spells/`. Don't duplicate that doc-writing here — hand off to the
analyzer so there's one archival path.

### 5. Record what you learned
When the user corrects a design, or you discover a constraint/technique worth reusing (a
limitation of a magic type, a reliable recipe for some effect, an engine quirk), append it to
the **Learnings log** below. Keep entries short and dated.

## Design principles
- **Constraints are the point.** The magic system's limits (earth can't create, body magic
  forbidden, inversion only for invertible signs) are what make designs feel authentic.
  Respect them; when one blocks the ask, say so plainly.
- **Validate, don't assert.** A recipe isn't done until the engine deduces the intended
  effect. The CLI is the arbiter of validity and effect, not your intuition.
- **Prefer canon precedent.** Start from how existing spells achieve similar things; novelty
  comes from recombination, not from inventing new parts.
- **Stability by default.** Use even/symmetric layouts unless the user wants a deliberately
  skewed or spinning effect.
- **Flag forbidden magic** rather than refusing outright in this fictional design context —
  but make the forbidden status unmistakable.

## Learnings log
Append dated, one-line insights from real design sessions (constraints discovered, recipes
that worked, engine quirks, user preferences). Newest at the top.

<!-- e.g. - 2026-05-31: "Freeze water" → water sigil + cool sign works; cool is non-directional so it can't be aimed — pair with region to localize. -->
