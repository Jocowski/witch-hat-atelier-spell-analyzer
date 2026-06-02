# INGESTION.md — how knowledge enters and improves the system

> The user continuously feeds this project new material: spells, signs, sigils, theories
> (canon and fan-made), usages, contraptions, and other people's feedback. The whole point is
> that **each ingestion makes the next analysis/creation easier.** That only works if new
> knowledge lands in a *concept-indexed* place, not a flat log. This file says where each kind
> of knowledge goes.

## The knowledge map

| Knowledge type | Canonical home | Indexed by |
|---|---|---|
| What a **sign/sigil is and does** + how it's drawn + nuances | [lexicon/](lexicon/) (its entry's **Findings**) | the symbol |
| A **specific spell** (full analysis) | [spells/](spells/) `<Name>.md` | the spell |
| A **canon spell recipe** (`origin` ∈ {canon, wiki}, for the matcher) | [../data/spells.json](../data/spells.json) | the spell (catalog) |
| A recurring **effect→recipe pattern** | [patterns.md](patterns.md) | the effect |
| A **multi-spell device** (linked/nested/toggled) | [contraptions.md](contraptions.md) | the device class |
| First-principles **rules of the system** | [CORE.md](CORE.md) | the concept |
| **Engine quirks / blind spots, process notes** | the skills' `references/learnings.md` | chronological |
| The **IR / drawing format** | [IR.md](IR.md) | — |

**Rule of thumb:** durable knowledge *about a symbol* → the lexicon. Durable knowledge *about a
spell* → docs/spells + (if it's a real canon spell) the catalog. A reusable *technique* →
patterns/contraptions. A *rule of the world* → CORE.md. A correction to the *engine's* reading
→ learnings.md.

### Provenance: always record where knowledge came from
Every spell/sign/sigil should carry its provenance so a fan reconstruction can never be mistaken
for canon fact. Two independent fields:
- **`origin`** — *where the data came from*: `canon` (taken directly from the manga/anime), `wiki`
  (obtained from the fan wiki at `witchhatatelier.telepedia.net`, fan-curated from canon), or
  `fan` (a purely fan-invented spell — reference only). **Default to `wiki`** for spells documented
  on telepedia: in practice essentially all current catalog recipes came from there, even when the
  spell itself is canon. Use `canon` only when the recipe was lifted straight from the manga/anime.
- **`source`** — a *free-text citation*: the telepedia URL + manga debut chapter, character/arc,
  or who built it.

`origin` is provenance, **independent of `confidence`** (how *complete/certain* the recipe is) — a
wiki-sourced recipe can still be high-confidence; record recipe uncertainty in `confidence`, never
by downgrading `origin`. Only `canon` and `wiki` spells go in `data/spells.json` (the matcher
catalog); **`fan` spells stay in docs/spells only** so they can't yield a false "canon match."
(Spell-doc frontmatter historically used `origin: community`; treat that as the `fan` tier.)

## Workflows

### Ingesting a new **spell** (analyze or create)
1. Run it through the engine (`--facts`) for observations; reason the effect from CORE.md + lexicon.
2. Archive the analysis to [spells/](spells/) (after the user approves — see the spell-analyzer skill).
3. If it's a real canon spell (`origin` `canon` or `wiki`), add a recipe to [../data/spells.json](../data/spells.json) so the matcher learns it — with its `origin` + `source`. (`fan`-invented spells stay in docs/spells only.)
4. Fold any *durable per-symbol* lesson into that symbol's lexicon **Findings** (dated, newest first).
5. If it reveals a reusable technique, note it in [patterns.md](patterns.md) or [contraptions.md](contraptions.md).

### Ingesting a new **sign** (newly identified)
1. Add it to `data/signs.json` (family + flags) and an operator to `data/grammar.json` (the
   coverage test enforces both). Vectorize its art (`npm run vectorize:signs`).
2. Add a lexicon entry in the right category file (drawing + acts-as + parameters).

### Ingesting an **unknown sign** (seen but unidentified)
1. Drop `Unknown_NN.png` into `assets/images/signs/unknown/`, run `npm run vectorize:signs`.
2. Add `unknown_NN` to `data/signs.json` (family `unknown`) + an `unknown` operator to grammar.
3. Add a **shape-forward** entry to [lexicon/signs-asymmetric.md](lexicon/signs-asymmetric.md)
   ("Catalogued but unidentified") — geometry first, then theories with confidence.
4. Run `npm run unknown:report` to cross-reference where it appears; refine theories as it recurs.

### Ingesting a **theory** (canon or fan-made)
- A theory *about a symbol* → that symbol's lexicon **Findings**, clearly marked as theory + confidence.
- A theory *about the system's rules* → CORE.md (if it rises to a principle) or a spell doc.
- Keep canon vs. fan-made distinct; never let a fan theory masquerade as engine/canon fact.

### Ingesting **feedback** (from the user or other people)
- Feedback that changes *how you should work* → the skill's `learnings.md` (or user/feedback memory).
- Feedback that corrects a *symbol/spell fact* → the lexicon/spell doc, with attribution if useful.

## Why this beats a flat log
Filing by concept means the entry for, say, `convergence` accumulates every role it has played
(earth compactor, water intake, …), so the next spell that uses it is read faster and better.
The lexicon **Findings** sections are the per-symbol dossiers; this file is how you keep them fed.
