# SPEC — Symbol lifecycle & canon-update flagging

> Status: **proposed** · Scope: **data model for evolving canon** (sigils/signs/spells) · Branch: `feat/spell-studio`
> Cross-refs: [CLAUDE.md](../../CLAUDE.md) (data-driven model, `origin`/`source` provenance),
> [docs/INGESTION.md](../INGESTION.md), [IMPROVEMENTS.md](IMPROVEMENTS.md).
> Related memory: World Guide 2026 drop, Wiki 2026 expansion, Spell Checkers community.

## Motivation
*Witch Hat Atelier* is ongoing. Signs/sigils get **renamed**, **re-functioned**, **split/merged**,
**confirmed**, or **retconned**; new ones appear (the 2026 World Guide + wiki expansion are exactly this).
Today the data (`sigils.json`, `signs.json`, `grammar.json`, `spells.json`, `docs/spells/`) records
provenance (`origin` = canon/wiki/fan, `source` = citation) but has **no lifecycle state** and **no way
to mark a spell as "stale, needs re-review"** when a symbol it depends on changes. We need a *practical,
data-driven* way to (a) make such edits and (b) automatically **flag every dependent spell until a human
re-reviews it** — instead of silently shipping a now-wrong recipe.

The **text-glyph removal** ("G"/"C") is the first concrete instance and the test case for this system.

## Design overview
Two new ideas, both data-only (engine stays a compiler):

### 1. A `lifecycle` block on every symbol and spell
Add an optional `lifecycle` object to each entry in `sigils.json`, `signs.json`, and `spells.json`
(and mirror the key fields on the DB `symbols` table). Absent = treat as `stable` (back-compat).

```jsonc
"lifecycle": {
  "status": "stable",        // stable | unverified | revised | deprecated | removed
  "rev": 2,                   // bump on any semantic change (function/shape/name)
  "reviewedAt": "2026-06-04", // ISO date of last human review against canon
  "reviewedBy": "spell-checkers", // who/what verified it (community, World Guide, manga ch.)
  "flag": null                // null, or { reason, since, by } when needs attention
}
```

- **status** drives UI: `unverified`/`revised` → a **badge** ("needs review", "revised vNN");
  `deprecated` → hidden from the palette but still analyzable (for old saved spells);
  `removed` → not loaded into the palette/matcher, kept only as a tombstone with `replacedBy`.
- **rev** is the version counter used by the impact tool (below) to detect "a dependency changed since
  this spell was last reviewed".
- This **subsumes provenance**: `origin`/`source` stay as-is (where it came from); `lifecycle` is the
  *current trust/state*. A wiki-origin symbol can be `status:stable` once reviewed.

### 2. An impact/flagging tool — `npm run flag:impact`
A new script (`tools/flag-impact.mjs`, sibling to `unknown-report.cjs`) that builds the **dependency
graph** and flags stale spells. It is pure data analysis over the JSON + `docs/spells/`:
1. Build a map `symbolId → { rev, status }` from sigils/signs.
2. For each catalog spell in `spells.json` (and each `docs/spells/*.md` front-matter / IR), collect the
   symbol ids it references (`core`, `components[].type`, signs).
3. A spell is **stale** if any referenced symbol's `rev` is newer than the spell's
   `lifecycle.reviewedAt`/recorded dep-revs, or any dep is `revised/deprecated/removed`.
4. **Action:** set `lifecycle.flag = { reason:"dep <id> changed", since:<date>, by:"flag:impact" }` and
   `status:"unverified"` on stale spells (write-back mode), and print a report. A `--check` mode just
   reports (for CI / pre-commit) and exits non-zero if anything is unexpectedly stale.

This means the workflow for **any canon change** becomes:
1. Edit the symbol in `signs.json`/`sigils.json` (+ `grammar.json` operator if behavior changed); bump
   its `lifecycle.rev`, set `status` (e.g. `revised`), update `source`.
2. Run `npm run flag:impact` → every dependent spell is auto-flagged `unverified` with a reason.
3. The app shows flagged spells with a badge; a reviewer re-checks each against canon, then clears the
   flag (sets `status:stable`, `reviewedAt:<today>`). The existing data-integrity test stays green
   throughout (ids still resolve); a new test asserts "no spell references a `removed` symbol".

## UI surfacing
- **Palette** ([SymbolPalette.jsx](../../src/studio/SymbolPalette.jsx)): hide `deprecated`/`removed`;
  show a small "revised"/"unverified" dot on others (tooltip = reason + date).
- **Analysis** ([ResultPanel.jsx](../../src/components/ResultPanel.jsx)): when a matched catalog spell
  is `unverified`/flagged, render a caveat ("⚠ recipe pending re-review after a canon update on <date>")
  — reuse the issues styling. Pairs with B1 caveats in [SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md).
- **Admin Registry** ([RegistryView.jsx](../../src/admin/RegistryView.jsx)): edit `status`/`rev`, and a
  "Review queue" filter listing all `unverified`/flagged entries.

## Applying it to the text-glyph removal (worked example)
The decision (from the UX batch spec, Item 5) is **remove the text-glyph mechanism, keep the vector
sigils**. Under this system:
1. In `sigils.json`, drop the `"text"` field from `guidance` + `calling`; bump their `lifecycle.rev`
   and set `source` note ("text glyph retired; vector svgPath is canonical art"). Since their *function*
   is unchanged, `status` can stay `stable` (cosmetic-only change) — so **no spell gets flagged**. This
   is the nice property: the tool only flags when something *semantic* changed.
2. Remove the dead `def?.text` branches in `SymbolPalette.jsx` + the fallback comment in
   `DrawingSurface.jsx`; drop `.sp-glyph-text` CSS.
3. `guidance` stays the `core` of **Fish Guidance** ([spells.json](../../data/spells.json)) — untouched,
   tests green.

> Contrast: if you later **re-function** a sign (say Column's behavior is clarified by canon), you bump
> its `rev` + set `status:revised` → `flag:impact` flags every spell using Column as `unverified` until
> reviewed. That's the case this system is built for, and it connects directly to
> [SPEC-sign-variants-sizing.md](SPEC-sign-variants-sizing.md) (variants are a kind of revision).

## Migration / rollout
- Phase 1 (now): add the `lifecycle` schema (optional, defaulted), write `flag:impact` in `--check`
  mode, do the text-glyph removal as the pilot. No behavior change for unflagged content.
- Phase 2: wire the palette/analysis/Registry badges; add the `removed`-reference test.
- Phase 3: mirror `status`/`rev` onto the DB `symbols` table + a Registry review queue.

## Effort
Schema + `flag:impact` tool + text-glyph pilot: **M**. Full UI surfacing + DB mirror: **M** more.

## Acceptance
- `flag:impact --check` reports stale spells and is wired into the test/CI path.
- Editing a symbol's `rev`/`status` and running the tool flags exactly the dependent spells, with a
  reason; clearing a flag is a one-field edit.
- Text-glyph pilot: no "G"/"C" anywhere, vector sigils intact, Fish Guidance + all 133 tests green,
  and **no spurious flags** (cosmetic change).
