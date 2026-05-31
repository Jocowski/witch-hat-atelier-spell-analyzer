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
origin: [canon | community]          # canon = appears in the manga/anime/wiki; community = fan-made / designed here
forbidden: [true | false]
status: [valid | invalid | inactive] # from the engine
core: [sigil id(s), e.g. water  OR  water + fire]
signs: [comma-separated sign ids with counts, e.g. column ×5, levitation ×3]
dyes: [comma-separated dye ids, or none]
symmetry: [radial | bilateral | asymmetric]
source: [chapter/episode/wiki reference if canon; "designed via /spell-creator" or user, if community]
image: [assets/spells/<file>.png if provided, else "none yet"]
json: [assets/spells/<file>.json if provided, else "none yet"]
---

# [Spell Name]

> One-line summary of what the spell does.

## Overview
[2–4 sentences: what it produces, what it's for, where it comes from.]

## Validity
[Engine verdict: valid/active/inactive/invalid and why. List any blocking/warning/info issues.]

## Composition
- **Substance (sigils):** [each sigil — name, element, what it contributes]
- **Form (signs):** [each sign — name, category, what it does here, inverted?]
- **Ring:** [closed/active | open/prepared]
- **Ink / dyes:** [dyes and their effect, or "plain conjuring ink"]

## Deduced effect
[The engine's deduced summary, then a plain-language explanation in your own words.]

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
