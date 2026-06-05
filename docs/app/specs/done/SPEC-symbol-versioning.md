# SPEC — Symbol lifecycle & canon-update flagging

> Status: **done - shipped (Fase 1/2/3)** · Scope: **data model for evolving canon** (sigils/signs/spells) · Branch: `feat/spell-studio`
> Cross-refs: [CLAUDE.md](../../../../CLAUDE.md) (data-driven model, `origin`/`source` provenance),
> [docs/INGESTION.md](../../../INGESTION.md), [IMPROVEMENTS.md](../../IMPROVEMENTS.md).
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
- **Palette** ([SymbolPalette.jsx](../../../../src/studio/SymbolPalette.jsx)): hide `deprecated`/`removed`;
  show a small "revised"/"unverified" dot on others (tooltip = reason + date).
- **Analysis** ([ResultPanel.jsx](../../../../src/components/ResultPanel.jsx)): when a matched catalog spell
  is `unverified`/flagged, render a caveat ("⚠ recipe pending re-review after a canon update on <date>")
  — reuse the issues styling. Pairs with B1 caveats in [SPEC-recognizer-analysis.md](../SPEC-recognizer-analysis.md).
- **Admin Registry** ([RegistryView.jsx](../../../../src/admin/RegistryView.jsx)): edit `status`/`rev`, and a
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
3. `guidance` stays the `core` of **Fish Guidance** ([spells.json](../../../../data/spells.json)) — untouched,
   tests green.

> Contrast: if you later **re-function** a sign (say Column's behavior is clarified by canon), you bump
> its `rev` + set `status:revised` → `flag:impact` flags every spell using Column as `unverified` until
> reviewed. That's the case this system is built for, and it connects directly to
> [SPEC-sign-variants-sizing.md](SPEC-sign-variants-sizing.md) (variants are a kind of revision).

## Migration / rollout
- Phase 1 (shipped): add the `lifecycle` schema (optional, defaulted), `flag:impact` (`--check` /
  `--write` modes), text-glyph pilot. No behavior change for unflagged content.
- Phase 2: wire the palette/analysis/Registry badges; add the `removed`-reference test.
- Phase 3: mirror `status`/`rev` onto the DB `symbols` table + a Registry review queue.

## Effort
Schema + `flag:impact` tool + text-glyph pilot: **M** (shipped). Full UI surfacing + DB mirror: **M** more.

## Acceptance
- `flag:impact --check` reports stale spells and is wired into the test/CI path.
- Editing a symbol's `rev`/`status` and running the tool flags exactly the dependent spells, with a
  reason; clearing a flag is a one-field edit.
- Text-glyph pilot: no "G"/"C" anywhere, vector sigils intact, Fish Guidance + all 133 tests green,
  and **no spurious flags** (cosmetic change).

---

## Build plan — Fase 2 & 3

> Fase 1 is fully shipped: the `lifecycle` block schema, `tools/flag-impact.mjs` (`--check`/`--write`),
> the text-glyph pilot, and the `lifecycle.flag` stamp are all live. The sections below turn the
> high-level Fase 2/3 rollout bullets into concrete, buildable steps with component-level detail.

---

### Fase 2 — UI surfacing: palette badges, analysis caveat, Registry review queue

**Effort: M** (4–6 focused sessions; all UI/data, zero engine changes)

#### F2-A  SymbolPalette — hide removed/deprecated, show lifecycle dot

File: `src/studio/SymbolPalette.jsx`

1. **Hide `removed` and `deprecated` from the palette filters.**
   The current filter lines are:
   ```js
   const sigils = SIGILS.filter((s) => s.family && s.family !== 'special')
   const signs  = SIGNS.filter((s)  => s.family && !['other'].includes(s.family))
   ```
   Add a lifecycle guard to each (absent `lifecycle` = `stable`, so nothing changes for existing
   entries without a `lifecycle` block):
   ```js
   const lcHidden = (s) => ['deprecated', 'removed'].includes(s.lifecycle?.status)
   const sigils = SIGILS.filter((s) => s.family && s.family !== 'special' && !lcHidden(s))
   const signs  = SIGNS.filter((s)  => s.family && !['other'].includes(s.family) && !lcHidden(s))
   ```

2. **Add a lifecycle-status dot to `SymbolTile`.**
   The dot sits in the top-right corner of the tile (CSS `position:absolute; top:3px; right:3px`).
   It is rendered only when `lifecycle?.status` is `revised` or `unverified`. The `title` on the
   dot merges `lifecycle.flag?.reason` + `lifecycle.reviewedAt` (falling back to just the status).

   Proposed JSX addition inside `SymbolTile`, after the `<span className="sp-glyph">` block:
   ```jsx
   {['revised', 'unverified'].includes(def?.lifecycle?.status) && (
     <span
       className={`sp-lc-dot sp-lc-dot--${def.lifecycle.status}`}
       title={[
         def.lifecycle.status === 'revised'
           ? `Revised (rev ${def.lifecycle.rev ?? '?'})`
           : 'Unverified — pending re-review',
         def.lifecycle.flag?.reason,
         def.lifecycle.reviewedAt && `Last reviewed: ${def.lifecycle.reviewedAt}`,
       ].filter(Boolean).join(' · ')}
       aria-label={`Symbol status: ${def.lifecycle.status}`}
     />
   )}
   ```

   `def` here is the result of `getComponentDef(sym.id)` which is already called at the top of
   `SymbolTile`. The `lifecycle` field needs to be forwarded from `sigils.json`/`signs.json` through
   `data.js`'s `getComponentDef` — that function builds objects from the raw JSON arrays, so it
   already carries all fields; no engine change needed, just confirm the field passes through.

3. **CSS additions in `symbolpalette.css`:**
   ```css
   .sp-tile { position: relative; }          /* ensure dot can be positioned */

   .sp-lc-dot {
     position: absolute; top: 3px; right: 3px;
     width: 7px; height: 7px;
     border-radius: 50%;
     pointer-events: none;
   }
   .sp-lc-dot--revised    { background: var(--color-warn, #c8972a); }
   .sp-lc-dot--unverified { background: var(--color-danger, #b94040); }
   ```
   Color variables already exist in the theme system (`themes.css`); use them rather than hardcoding.

#### F2-B  ResultPanel — lifecycle caveat on matched catalog spell

File: `src/components/ResultPanel.jsx`

The matched-spell card is rendered inside `SimilarSection` → the `<div className="spell-card ...">`.
The `spell-card.forbidden` class already provides a styled callout pattern (red border, red heading)
that can be reused as a visual precedent.

1. **Pass lifecycle flags down through the engine result.**
   `analyze.js` already populates `similar.match` from `spells.json`. The `similar.match` object needs
   to include `lifecycle` from the matched spell entry. In `src/engine/match.js` (the catalog matcher),
   when building the match result object, spread `matched.lifecycle` so it surfaces in `similar.match`.
   No new computation — just pass the field through.

2. **Render the caveat in `SimilarSection`.**
   After the `<MatchWhy>` component inside the `spell-card` div, add:
   ```jsx
   {(similar.match.lifecycle?.status === 'unverified' ||
     similar.match.lifecycle?.flag) && (
     <div className="spell-card-caveat" role="note">
       Recipe pending re-review after a canon update
       {similar.match.lifecycle.flag?.since
         ? ` (flagged ${similar.match.lifecycle.flag.since})`
         : ''}
       {similar.match.lifecycle.flag?.reason
         ? ` — ${similar.match.lifecycle.flag.reason}`
         : ''}
     </div>
   )}
   ```

3. **CSS — `.spell-card-caveat`** (add to `resultpanel.css` or the main panel stylesheet):
   ```css
   .spell-card-caveat {
     margin-top: 6px;
     padding: 4px 8px;
     border-left: 3px solid var(--color-warn, #c8972a);
     font-size: 0.82em;
     color: var(--color-warn, #c8972a);
     background: color-mix(in srgb, var(--color-warn, #c8972a) 10%, transparent);
   }
   ```
   This deliberately mirrors the `forbidden-callout` yellow-border idiom rather than the red one,
   because this is a data-quality notice (tentative), not a hard prohibition.

#### F2-C  Admin RegistryView — lifecycle columns + Review queue filter

File: `src/admin/RegistryView.jsx`

The current `RegistryView` manages the DB `symbols` table which, after Fase 3, will carry
`lc_status` and `lc_rev` columns. Fase 2 adds the UI scaffolding so it is ready the moment the
migration lands; for now the fields simply won't exist in the rows (graceful degradation).

1. **Add a "Review queue" filter toggle.**
   Next to the existing `Kind:` filter, add a checkbox or button `Show review queue`. When active,
   the `visible` list filters to rows where `sym.lc_status` is `unverified` or `sym.lc_flag` is
   non-null. Implementation:
   ```js
   const [queueOnly, setQueueOnly] = useState(false)

   const visible = symbols
     .filter((s) => !kindFilter || s.kind === kindFilter)
     .filter((s) => !queueOnly || ['unverified', 'revised'].includes(s.lc_status) || s.lc_flag)
   ```

2. **Display `lc_status` and `lc_rev` in the table.**
   Add two columns after the existing `Status` column:
   - `LC Status` — rendered as a colored badge using the same `admin-badge` pattern:
     `<span className={`admin-badge admin-badge-${sym.lc_status || 'stable'}`}>{sym.lc_status || 'stable'}</span>`
   - `LC Rev` — plain numeric cell: `{sym.lc_rev ?? '—'}`

   Update `<thead>` to include these two `<th>` elements.

3. **Make `lc_status` and `lc_rev` editable in `EditRow`.**
   Add to the `EditRow` form state (initialized from `sym`):
   ```js
   const [form, setForm] = useState({ ...sym })
   ```
   (already spreads all fields, so no init change needed).

   Add two new `<td>` cells in `EditRow`'s return:
   ```jsx
   <td>
     <select className="admin-select admin-select-sm" value={form.lc_status ?? 'stable'} onChange={f('lc_status')}>
       {['stable', 'unverified', 'revised', 'deprecated', 'removed'].map((s) => (
         <option key={s} value={s}>{s}</option>
       ))}
     </select>
   </td>
   <td>
     <input
       type="number" min="1" step="1"
       className="admin-input admin-input-sm"
       style={{ width: 52 }}
       value={form.lc_rev ?? 1}
       onChange={f('lc_rev')}
     />
   </td>
   ```

   Extend the `updateSymbol` call in `submit` to include `lc_status` and `lc_rev`:
   ```js
   const row = await updateSymbol(sym.id, {
     // ... existing fields ...
     lc_status: form.lc_status ?? null,
     lc_rev:    form.lc_rev    ? Number(form.lc_rev) : null,
   })
   ```

4. **Audit log** — the `logAction` call after `updateSymbol` already captures the full row, so
   `lc_status`/`lc_rev` changes are automatically recorded. No extra change needed.

#### F2-D  New test: no spell references a `removed` symbol

File: `test/data-integrity.test.js` (or the nearest data-integrity test file; create if absent).

```js
import { createRequire } from 'node:module'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const sigils  = require('../data/sigils.json')
const signs   = require('../data/signs.json')
const spells  = require('../data/spells.json')

const sigilList = Array.isArray(sigils) ? sigils : (sigils.sigils ?? [])
const signList  = Array.isArray(signs)  ? signs  : (signs.signs  ?? [])
const spellList = Array.isArray(spells) ? spells : (spells.spells ?? [])

describe('symbol lifecycle', () => {
  it('no catalog spell references a removed symbol', () => {
    const removedIds = new Set(
      [...sigilList, ...signList]
        .filter((s) => s.lifecycle?.status === 'removed')
        .map((s) => s.id)
    )
    if (removedIds.size === 0) return // nothing to check yet

    for (const spell of spellList) {
      const c = spell.composition || {}
      const deps = [c.core, ...(c.signs ?? []).map((s) => s.id)].filter(Boolean)
      for (const id of deps) {
        assert.ok(
          !removedIds.has(id),
          `Spell "${spell.id || spell.name}" references removed symbol "${id}". ` +
          `Update the spell's composition or mark it archived.`
        )
      }
    }
  })
})
```

This test runs under `npm test` (plain `node --test`) because it uses `createRequire` (no JSON import
attributes needed) and only calls pure assertions — consistent with the existing test patterns in
`test/deduce.test.js` and CLAUDE.md's "pure modules" constraint.

#### Fase 2 acceptance criteria

- `deprecated`/`removed` symbols do not appear in the palette (verified by filtering with and without
  a lifecycle block; unflagged entries are unaffected).
- `revised`/`unverified` symbols show a colored dot; hovering shows a human-readable tooltip that
  includes the reason and date when a `flag` is set.
- When the matched catalog spell has `lifecycle.status = 'unverified'` or `lifecycle.flag` set, the
  caveat renders below the match card in warm yellow. Spells without a flag render identically to
  today.
- RegistryView "Review queue" filter shows only unverified/flagged rows; the LC Status and LC Rev
  columns display and are editable (or show `stable` / `—` gracefully when the DB columns don't
  exist yet).
- `npm test` passes including the new `removed`-reference test.

---

### Fase 3 — DB mirror: `symbols` table lifecycle columns + review-queue query

**Effort: S** (one migration + small data-service patch; the UI is already built in Fase 2)

#### F3-A  Migration: add `lc_status` / `lc_rev` / `lc_flag` to `symbols`

New file: `supabase/migrations/20260605000000_symbols_lifecycle.sql`
(timestamp chosen to sequence after the two existing migrations: `20260603…` init, `20260604…` source_confirmed)

```sql
-- Fase 3 of SPEC-symbol-versioning: mirror lifecycle fields onto the symbols registry table.
-- Adds lc_status / lc_rev / lc_flag (nullable — absent = treated as stable by the app).
-- RLS: reads open (existing policy symbols_read_all covers SELECT); writes admin-only (existing
-- policy symbols_admin_write covers all DML).  No new policies needed.

alter table public.symbols
  add column if not exists lc_status text
    check (lc_status is null or lc_status in ('stable','unverified','revised','deprecated','removed')),
  add column if not exists lc_rev    integer check (lc_rev is null or lc_rev >= 1),
  add column if not exists lc_flag   jsonb;   -- null | { reason, since, by }

comment on column public.symbols.lc_status is
  'Lifecycle status mirrored from sigils/signs.json; null = treated as stable.';
comment on column public.symbols.lc_rev is
  'Lifecycle revision counter; bump on any semantic change to the symbol definition.';
comment on column public.symbols.lc_flag is
  'Set by flag:impact (or admin) when the symbol needs re-review. '
  'Shape: { "reason": "...", "since": "YYYY-MM-DD", "by": "flag:impact|<admin>" }';

-- Partial index for the review-queue query (only rows that actually need attention).
create index if not exists symbols_review_queue_idx
  on public.symbols (lc_status)
  where lc_status in ('unverified', 'revised', 'deprecated');
```

**Reversibility** — the migration only adds nullable columns and an index. To roll back:
```sql
drop index if exists public.symbols_review_queue_idx;
alter table public.symbols
  drop column if exists lc_flag,
  drop column if exists lc_rev,
  drop column if exists lc_status;
```
No existing rows or policies are modified.

#### F3-B  Review-queue query

The Supabase JS client query used by RegistryView (and any future admin dashboard widget):

```js
// Review queue: symbols that need human attention.
const { data, error } = await supabase
  .from('symbols')
  .select('*')
  .or('lc_status.in.(unverified,revised,deprecated),lc_flag.not.is.null')
  .order('lc_status', { ascending: true })
  .order('name',      { ascending: true })
```

This hits the partial index `symbols_review_queue_idx` for the `lc_status` predicate and is fast
even with thousands of symbols. The `lc_flag.not.is.null` arm picks up any rows flagged by
`flag:impact --write` that were subsequently synced to the DB.

Place this as an exported helper in `src/data-services/symbols.js` alongside the existing
`listSymbols` / `addSymbol` / `updateSymbol` / `deleteSymbol`:

```js
// Returns rows with lc_status in (unverified, revised, deprecated) or lc_flag set.
export async function listReviewQueue() {
  const { data, error } = await supabase
    .from('symbols')
    .select('*')
    .or('lc_status.in.(unverified,revised,deprecated),lc_flag.not.is.null')
    .order('lc_status').order('name')
  if (error) throw error
  return data ?? []
}
```

#### F3-C  Sync JSON lifecycle → DB (optional / manual for now)

The JSON files (`sigils.json`, `signs.json`) remain the canonical source; the DB is a queryable
mirror for the admin UI. No automated sync is required for Fase 3. The workflow is:

1. Admin edits `lc_status`/`lc_rev` in the JSON (or via `flag:impact --write`).
2. Admin opens RegistryView, finds the matching DB row by `engine_id`, edits `lc_status`/`lc_rev`
   to match, saves. `logAction` records the change.

A future "sync from JSON" script (e.g. `tools/sync-lifecycle.mjs`) could automate step 2, but it
is explicitly **out of scope for Fase 3** to keep the migration minimal.

#### Fase 3 acceptance criteria

- `npx supabase migration up` applies `20260605000000_symbols_lifecycle.sql` cleanly on a fresh
  local stack; rolling it back leaves the `symbols` table identical to its pre-migration state.
- Existing RLS policies cover the new columns: anonymous/user reads work; non-admin writes are
  rejected by the existing `symbols_admin_write` policy.
- `listReviewQueue()` returns only rows with a non-stable `lc_status` or a non-null `lc_flag`;
  empty result when all rows have null lifecycle fields (the common post-migration state).
- RegistryView "Review queue" filter calls `listReviewQueue()` (or applies the client-side filter
  from F2-C) and lists those rows; editing and saving a row's `lc_status`/`lc_rev` persists
  correctly and appears in the audit log.

---

### Phasing summary

| Step  | File(s)                                      | Change                                           | Effort |
|-------|----------------------------------------------|--------------------------------------------------|--------|
| F2-A  | `src/studio/SymbolPalette.jsx` + `symbolpalette.css` | Hide removed/deprecated; lifecycle dot on tile | S |
| F2-B  | `src/components/ResultPanel.jsx` + CSS       | Caveat on flagged matched spell                  | S      |
| F2-C  | `src/admin/RegistryView.jsx`                 | LC Status/Rev columns + Review queue filter      | S      |
| F2-D  | `test/data-integrity.test.js`                | New `removed`-reference assertion                | S      |
| F3-A  | `supabase/migrations/20260605000000_symbols_lifecycle.sql` | Add lc_* columns + partial index   | S      |
| F3-B  | `src/data-services/symbols.js`               | `listReviewQueue()` helper                       | S      |

All steps are independent and can be shipped in any order within their Fase. Fase 2 UI degrades
gracefully before Fase 3's migration lands (missing DB columns → `lc_status` is `undefined`,
treated as `stable` by every conditional).

### Testing notes

- All Fase 2 UI changes are testable locally without Supabase running: load a spell that matches a
  catalog entry with a manually added `lifecycle.flag` in `data/spells.json`; verify the caveat
  renders. Do the same with a `deprecated` sigil to confirm it vanishes from the palette.
- The `removed`-reference test (F2-D) runs under `npm test` with no extra setup.
- Fase 3 migration is tested with `npx supabase migration up` against the local Docker stack;
  verify with `npx supabase status` + a quick `listSymbols()` call to confirm the new columns
  appear in the returned rows.
- Back-compat regression: after all changes, `npm test` must remain green with zero lifecycle
  blocks in any JSON (the absent-means-stable invariant).
