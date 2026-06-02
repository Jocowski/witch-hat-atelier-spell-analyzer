# Spell documentation template

Use this exact structure when writing `docs/spells/<Spell_Name>.md`. Replace the
bracketed parts. Keep the YAML frontmatter — it makes the catalog queryable and is
the canonical record of the recipe. File name: the spell's name in
`Title_Case_With_Underscores.md` (match the convention of `assets/images/spells/`).
The heart of the doc is **Element behavior & canon grounding** — keep that section
substantial. Do not add a "Variations & modifications" section.

```markdown
---
name: [Spell Name]
type: [fire | water | earth | wind | light | crystal | time | vision | decorative | mixed | niche | forbidden | contraption]
origin: [canon | wiki | fan]          # where the data came from: canon = taken straight from manga/anime; wiki = obtained from telepedia (the usual case); fan = fan-made / designed here (formerly "community"). Independent of confidence.
forbidden: [true | false]
status: [valid | invalid | inactive] # from the engine
core: [sigil id(s), e.g. water  OR  water + fire]
signs: [comma-separated sign ids with counts, e.g. column ×5, levitation ×3]
dyes: [comma-separated dye ids, or none]
symmetry: [radial | bilateral | asymmetric]
source: [free-text citation: chapter/episode/character if canon; telepedia page if wiki; "designed via /spell-creator" or user, if fan]
image: [assets/spells/<file>.png if provided, else "none yet"]
json: [assets/spells/<file>.json if provided, else "none yet"]
---

# [Spell Name]

> One-line summary of what the spell does.

## Overview
[2–4 sentences: what it produces, what it's for, where it comes from.]

## In plain terms (sum up)
[Jargon-free recap for someone who won't read the rest: what it does, how it works in
a few simple steps, and what it's best used for. No `file:line` cites, no sign/operator
vocabulary, no engine terms. One short comparison is fine. This is the most-read section —
make it stand on its own.]

## Validity
[Engine verdict: valid/active/inactive/invalid and why. List any blocking/warning/info issues.]

## Composition
- **Substance (sigils):** [each sigil — name, element, what it contributes]
- **Form (signs):** [each sign — name, category, what it does here, inverted?]
- **Ring:** [closed/active | open/prepared]
- **Ink / dyes:** [dyes and their effect, or "plain conjuring ink"]

## Deduced effect
[The engine's deduced summary, then a plain-language explanation in your own words.
If a core sigil or sign is unidentified (element `unknown`, an `unknown_NN` sign, or a
doc-flagged ambiguous sign), DO NOT stop at "incomplete." Reason from what IS known
(geometry, the identified parts, the spell's canon name/purpose) and lay out **2–4 ranked
hypotheses** — most likely / possible / long-shot — each with the in-world consequence it
would produce and what observation or extra symbol would confirm it. Mark every hypothesis
as speculation, never as fact.]

### How each part shapes the spell
| Part | Role | Effect on this spell |
|------|------|----------------------|
| [name] | [sigil/sign + kind] | [what changes if it weren't there] |

## Element behavior & canon grounding
[The core reasoning. How the substance's physical nature interacts with each sign's
documented mechanic:
- create vs. manipulate vs. collect constraint (cite docs/sigils.md by `file:line`) —
  does the spell need a real source of material, or is it self-sufficient?
- physical state (fluid / granular / rigid) vs. the sign's mechanic (cite docs/signs.md
  by `file:line`) — does the substance actually behave the way the sign expects?
Then compare to the closest canon spell: what's the **same**, what **differs**, and
**why**. End with a one-paragraph **bottom line** on feasibility and the key difference.]

## How to draw it
[Step-by-step: the sigil at center; how many signs of each type, at what angles/sizes;
symmetry to maintain; what to invert/tilt. Note size/neatness implications.]

## Usage ideas
- [practical use 1]
- [practical use 2]

## Similar spells
[Canon spells with related effects, and how this differs.]

## Notes & limitations
[Edge cases, instability risks, forbidden-magic flags, uncertainty in the source material.]

## Reproduction
- **Image:** [path under assets/spells/, or "requested from user"]
- **JSON:** [path under assets/spells/, or paste the importable composition below]

\`\`\`json
[the importable wha-spell@1 composition JSON, so the app can re-load it]
\`\`\`
```
