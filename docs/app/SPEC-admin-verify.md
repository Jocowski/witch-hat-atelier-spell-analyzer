# SPEC — Admin "verify" flag on training samples (A6)

> Status: **proposed** · Scope: **training governance → recognizer weighting → Review UI**
> Branch: `feat/spell-studio`
> Cross-refs: [SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) (item A6 origin, A1 source
> weighting), [IMPROVEMENTS.md](IMPROVEMENTS.md) (§B AI training), CLAUDE.md §recognizer / §data layer.
> Data layer: `src/data-services/samples.js`, `src/admin/ReviewView.jsx`,
> `src/draw/recognizer.js`, `data/rules.json`, `supabase/migrations/`.

This spec expands A6 from SPEC-recognizer-analysis.md into a full build plan. The recognizer already
applies per-source weight (`sampleWeights` in `rules.json`, applied as `adjDist = dist / weight` in
`recognizer.js`). Verification is a second orthogonal trust axis: an admin explicitly vouches that a
specific sample is a good exemplar, regardless of how it was collected.

---

## Background and motivation

The A1 source-weight model (`corrected: 1.5 / drawn: 1.0 / confirmed: 0.6`) captures *how* a sample
arrived. It does not capture whether an admin has *reviewed* it. A user could submit a well-intentioned
but poorly-drawn correction that still outranks a neat drawn sample by source alone. The verify flag
adds a second, orthogonal trust signal:

- **Verified samples** have been inspected by a human admin and declared a good exemplar of the symbol.
  They receive a weight multiplier on top of their source weight, so they rise above unreviewed samples
  of the same source.
- **Bulk exclusion of a bad contributor** is already possible via `softDeleteByUser`; this spec
  formalises the UI flow and adds an audit trail for the combined verify/exclude workflow.

The recognizer (`recognizer.js`) must remain a **pure module** — no JSON imports, no DB calls. Weights
are resolved when building templates (in `activeTemplates()`) and passed in, exactly as the source
weights are today.

---

## 1. Database schema change

### 1.1 New migration

File: `supabase/migrations/20260605000000_verified_samples.sql`

```sql
-- Add admin-verify fields to training_samples (A6).
-- verified      — true once an admin marks the sample as a trusted exemplar.
-- verified_by   — profiles.id of the verifying admin (FK, nullable so existing rows are unaffected).
-- verified_at   — timestamp of the verification action.
-- All three default to their null/false equivalents so the migration is non-breaking and reversible.

alter table public.training_samples
  add column if not exists verified     boolean      not null default false,
  add column if not exists verified_by  uuid         references public.profiles (id),
  add column if not exists verified_at  timestamptz;

-- Partial index: makes "fetch only verified active templates" fast.
create index if not exists samples_verified_active_idx
  on public.training_samples (symbol_id)
  where deleted_at is null and verified = true;

-- ── RLS policy ──
-- The existing policy samples_admin_write already covers UPDATE for admins, so the new columns are
-- automatically protected — only admins can flip verified. No new policy needed.
-- Verify that the existing policy covers the new columns:
--   policy samples_admin_write: FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())
-- This includes UPDATE, so only admins can set verified = true.  No additional policy is required.
```

### 1.2 Down migration / rollback

The migration is reversible. To roll back:

```sql
-- rollback: remove verify columns and index
drop index if exists public.samples_verified_active_idx;
alter table public.training_samples
  drop column if exists verified_at,
  drop column if exists verified_by,
  drop column if exists verified;
```

This is safe to run at any point; no application code depends on these columns being present before
the feature is deployed (the data-service additions below guard with `if (!hasSupabase()) return`).

---

## 2. Weight model change — `data/rules.json`

Add a `verifiedMultiplier` key to the existing `recognition` block:

```jsonc
"recognition": {
  "note": "...(existing)... verifiedMultiplier is applied ON TOP of the source weight when a sample
           has verified=true: effectiveWeight = sourceWeight * verifiedMultiplier. Set to 1.0 to
           disable the bonus without a code change.",
  "sampleWeights":       { "corrected": 1.5, "drawn": 1.0, "confirmed": 0.6 },
  "verifiedMultiplier":  1.3,
  "confidenceMinPct":    30
}
```

**Combined weight formula:**

```
effectiveWeight = sampleWeights[source] * (verified ? verifiedMultiplier : 1.0)
```

Examples with default values:

| source    | verified | effectiveWeight |
|-----------|----------|-----------------|
| corrected | false    | 1.5             |
| corrected | true     | 1.95            |
| drawn     | false    | 1.0             |
| drawn     | true     | 1.3             |
| confirmed | false    | 0.6             |
| confirmed | true     | 0.78            |

A verified-drawn sample (1.3) therefore outranks an unverified corrected sample (1.5) only after
inspection — it is a deliberate choice that the `corrected` source weight is the stronger lever for
automatic pipeline signals, while `verify` is the explicit human override.

Rationale for 1.3: meaningful boost without overwhelming the source-weight spread. Tunable in config
without a code change.

---

## 3. Data-service additions — `src/data-services/samples.js`

### 3.1 `setVerified(id, verified)`

```js
/**
 * Set or clear the verified flag on a training sample (admin only — enforced by RLS).
 * Stamps verified_by = current user and verified_at = now() when setting; clears both when unsetting.
 * @param {string}  id        UUID of the training_samples row.
 * @param {boolean} verified  true to verify, false to unverify.
 * @returns {Promise<object>} The updated row.
 */
export async function setVerified(id, verified) {
  if (!hasSupabase()) return null
  const patch = verified
    ? { verified: true,  verified_by: (await supabase.auth.getUser()).data.user?.id, verified_at: new Date().toISOString() }
    : { verified: false, verified_by: null, verified_at: null }
  const { data, error } = await supabase
    .from('training_samples')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
```

### 3.2 Update `activeTemplates()` to carry `verified` and resolve `weight`

`activeTemplates()` currently selects `role, points, source` and derives the `name` from the joined
symbol. It must also:

1. Select `verified` from the row.
2. Accept the rules config (source weights + verifiedMultiplier) as an **optional argument** so
   callers can inject the current config. Default to the fallback map when absent (keeps the function
   usable in tests without Supabase config).

```js
/**
 * @param {object} [weightCfg]  Optional weight config injected by the caller (from rules.json).
 *   { sampleWeights: { corrected, drawn, confirmed }, verifiedMultiplier }
 *   Defaults to { sampleWeights: { corrected:1.5, drawn:1.0, confirmed:0.6 }, verifiedMultiplier:1.0 }
 *   so the function degrades gracefully when the caller doesn't pass config (no weight bump = neutral).
 *
 * Shape returned per element:
 *   { name, role, points, source, verified, weight }
 */
export async function activeTemplates(weightCfg) {
  if (!hasSupabase()) return []
  const { sampleWeights = { corrected: 1.5, drawn: 1.0, confirmed: 0.6 }, verifiedMultiplier = 1.0 }
    = weightCfg ?? {}
  const { data, error } = await supabase
    .from('training_samples')
    .select('role, points, source, verified, symbols(engine_id, name, kind)')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return data.map((row) => {
    const src    = row.source || 'drawn'
    const srcW   = sampleWeights[src] ?? 1.0
    const weight = row.verified ? srcW * verifiedMultiplier : srcW
    return {
      name:     row.symbols?.engine_id || row.symbols?.name || '',
      role:     row.role || (row.symbols?.kind === 'sigil' ? 'sigil' : 'sign'),
      points:   row.points,
      source:   src,
      verified: row.verified ?? false,
      weight,
    }
  })
}
```

### 3.3 Call site in `StudioPage.jsx` (or wherever `activeTemplates` is called)

Pass the `recognition` block from `rules.json` so the live weight config is always used:

```js
import rules from '../../data/rules.json'
// …
const templates = await activeTemplates(rules.recognition)
```

This keeps `recognizer.js` pure — `makeCloud(name, points, weight)` already accepts a `weight`
parameter (added in A1) and `analyzeStrokes` builds clouds from `t.weight` on each template.

### 3.4 Optional: `verifiedOnlyTemplates()`

For the "verified-only recognizer mode" (lower recall, higher precision — useful when training data is
sparse and polluted):

```js
/**
 * Like activeTemplates() but returns ONLY verified samples.
 * Use as an alternate template store when the admin enables "strict mode".
 */
export async function verifiedOnlyTemplates(weightCfg) {
  if (!hasSupabase()) return []
  // Same as activeTemplates but adds .eq('verified', true)
}
```

Expose as an opt-in toggle in `rules.json`:

```jsonc
"recognition": {
  ...
  "verifiedOnlyMode": false   // flip to true to restrict the recognizer to verified exemplars only
}
```

When `verifiedOnlyMode` is true, the Studio calls `verifiedOnlyTemplates()` instead of
`activeTemplates()`. Rendering a "verified-only mode active" badge in the Studio toolbar is a nice UX
signal (Phase 2).

---

## 4. Review UI changes — `src/admin/ReviewView.jsx`

### 4.1 New column: "Verified" in the samples table

Add a **Verified** column between Source and Status. Display:

- Verified: `<span class="admin-badge admin-badge-verified">verified</span>` (green badge, similar to
  `admin-badge-active`).
- Not verified: `<span class="admin-badge">—</span>` (neutral, no colour).

Update `<thead>`:
```jsx
<th>Verified</th>   {/* after Source, before Status */}
```

Update the row `<td>`:
```jsx
<td>
  {row.verified
    ? <span className="admin-badge admin-badge-verified">verified</span>
    : <span className="admin-badge">—</span>
  }
</td>
```

### 4.2 Per-row Verify / Unverify toggle button

In the Actions column, add a Verify button alongside Restore/Delete. Only active (non-deleted) rows
can be verified; deleted rows show no verify button.

```jsx
{!row.deleted_at && (
  row.verified
    ? <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => handleUnverify(row.id)}>
        Unverify
      </button>
    : <button className="admin-btn admin-btn-sm admin-btn-ok" onClick={() => handleVerify(row.id)}>
        Verify
      </button>
)}
```

Add the handlers (optimistic update + audit log):

```js
async function handleVerify(id) {
  setVerifyErr(null); setVerifyMsg(null)
  try {
    await setVerified(id, true)
    await logAction({ action: 'sample.verify', target: { id } })
    setVerifyMsg(`Sample ${id.slice(0, 8)}… verified.`)
    await loadSamples(); await loadAudit()
  } catch (err) {
    setVerifyErr(err.message || 'Verify failed.')
  }
}

async function handleUnverify(id) {
  setVerifyErr(null); setVerifyMsg(null)
  try {
    await setVerified(id, false)
    await logAction({ action: 'sample.unverify', target: { id } })
    setVerifyMsg(`Sample ${id.slice(0, 8)}… unverified.`)
    await loadSamples(); await loadAudit()
  } catch (err) {
    setVerifyErr(err.message || 'Unverify failed.')
  }
}
```

Add state variables:

```js
const [verifyMsg, setVerifyMsg] = useState(null)
const [verifyErr, setVerifyErr] = useState(null)
```

Render the status messages alongside the other per-row feedback messages (the existing block near the
table already shows `restoreMsg`, `restoreErr`, `deleteRowMsg`, `deleteRowErr` — append here).

### 4.3 Verify-status filter

Add a "Verified" dropdown filter to the filter row so admins can quickly scan unreviewed samples:

```jsx
<label className="admin-hint" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
  Verified
  <select className="admin-input admin-input-sm" value={filterVerified} onChange={(e) => setFilterVerified(e.target.value)}>
    <option value="">All</option>
    <option value="true">Verified only</option>
    <option value="false">Unverified only</option>
  </select>
</label>
```

Update `listSamples()` in `samples.js` to accept `{ ..., verified?: boolean }` and pass
`.eq('verified', verified)` when set.

### 4.4 Bulk "exclude all from user" flow — documenting the existing path

`softDeleteByUser(userId)` already exists and is wired in Review. The verify flag adds context to this
workflow: an admin reviewing a bad contributor can:

1. Filter by user UUID in the samples table → inspect each row (See button → SamplePreview).
2. Identify whether the samples are merely low-quality (soft-delete via "Delete all by user") or
   salvageable (verify the good ones individually first, then delete the rest).
3. "Delete all by user" triggers `softDeleteByUser(userId)` + `logAction({ action: 'samples.delete_by_user', ... })`.

No code change is needed for this flow — it already works. The spec documents it explicitly:

- Verified samples that have been soft-deleted remain in the DB (soft-delete sets `deleted_at`;
  `verified` is unaffected). They are excluded from `activeTemplates()` (which filters `deleted_at IS NULL`).
- A restore (`restore(id)`) will bring them back with `verified` intact — the admin vouching survives a
  delete/restore cycle.
- If an admin wants to strip verification before deleting (e.g. a fraudulent contribution), they should
  `setVerified(id, false)` first, then soft-delete. The UI does not enforce ordering; this is an admin
  convention documented here.

---

## 5. Audit log actions

All verify/unverify actions write to `audit_log` via the existing `logAction()` helper:

| Action                   | target                          | Description                    |
|--------------------------|---------------------------------|--------------------------------|
| `sample.verify`          | `{ id }`                        | Admin marks one sample verified |
| `sample.unverify`        | `{ id }`                        | Admin clears verify flag        |
| `sample.verify_bulk`     | `{ symbol_id, count }`          | Future: bulk verify (Phase 2)   |
| `samples.delete_by_user` | `{ userId }` (already exists)   | Bulk exclude a contributor      |

The existing audit table and RLS (`audit_admin_write`) require no changes.

---

## 6. Phasing and effort

### Phase 1 — Core (Effort: M)
Essential for the weight bump to work end-to-end.

1. Migration `20260605000000_verified_samples.sql` — adds `verified / verified_by / verified_at`, partial
   index. **S**
2. `setVerified()` in `samples.js`. **S**
3. `activeTemplates()` update: select `verified`, accept `weightCfg`, compute `effectiveWeight`. **S**
4. `rules.json` — add `verifiedMultiplier: 1.3`. **XS**
5. Studio call site: pass `rules.recognition` to `activeTemplates()`. **XS**
6. ReviewView: Verified column + per-row Verify/Unverify toggle + feedback messages + audit logging.
   **S–M**

Total Phase 1: **M** (estimate ~1–2 days focused work).

### Phase 2 — Ergonomics and polish (Effort: S each, can be done incrementally)

- Verified filter in the samples table (listSamples `verified` param + UI dropdown). **S**
- `verifiedOnlyTemplates()` + `verifiedOnlyMode` config toggle + Studio toolbar badge. **S**
- Bulk-verify: select multiple rows via checkboxes → "Verify selected" button + `sample.verify_bulk`
  audit entry. **S–M**
- Show `verified` badge / tooltip in the Identified panel when the winning template is from a verified
  sample (requires passing `verified` back through `recognize()` results). **S**

### Phase 3 — Long-horizon (gated on coverage data, A3)

- Verified-sample analytics: dashboard widget showing `verified / total` per symbol, flagging symbols
  where verified coverage is low despite high sample count (a signal that existing samples are low
  quality). **M**

---

## 7. Acceptance criteria

The feature is done when all of the following pass:

1. **Migration reversible:** `apply migration → rollback migration → apply again` leaves the DB in a
   clean state; existing rows are unaffected (all default to `verified = false`).

2. **Admin can verify:** logged-in admin clicks Verify on an active sample → row shows verified badge →
   `audit_log` gains a `sample.verify` entry.

3. **Admin can unverify:** logged-in admin clicks Unverify → badge clears → `audit_log` gains a
   `sample.unverify` entry.

4. **Non-admin cannot verify:** a request to update `verified = true` from a non-admin session is
   rejected by RLS (test via Supabase client with a non-admin JWT).

5. **Weight bump applied:** a verified-drawn sample (effectiveWeight = 1.3) beats an unverified-drawn
   sample (effectiveWeight = 1.0) in a tie — unit test in `test/recognizer.test.js` drives `recognize()`
   with two near-equidistant templates differing only in weight (same pattern as the A1 test).

6. **Verify survives soft-delete/restore:** soft-deleting a verified sample, then restoring it, leaves
   `verified = true` intact (the `restore()` function updates only `deleted_at`, leaving `verified`
   untouched — verified by reading the row after restore).

7. **Config-driven multiplier:** changing `verifiedMultiplier` in `rules.json` from 1.3 to 1.0
   removes the bonus without any code change; the recognizer reflects the new weight on next template
   load.

8. **No regressions:** `npm test` passes (all existing engine/recognizer/data tests green); `npm run
   lint` is clean.

---

## 8. Testing notes

- **Unit test** (`test/recognizer.test.js` or a new `test/verify.test.js`): inject two clouds for the
  same symbol via `makeCloud(name, points, weight)` — one with weight 1.0 (unverified drawn) and one
  with weight 1.3 (verified drawn). Construct a query cloud that is equidistant from both (or
  marginally closer to the unverified one by raw dist). Assert that the verified cloud wins the
  `adjDist` ranking. No Supabase connection needed — this is a pure-function test.

- **Integration test** (`test/` or manual): call `activeTemplates(rules.recognition)` with a Supabase
  connection and a seeded `verified = true` row; assert the returned template has the correct
  `weight` value.

- **RLS test** (manual, Supabase dashboard or curl): attempt `PATCH training_samples SET verified=true`
  with a non-admin anon-key token; confirm 403 / empty result.

- **Migration test** (local Supabase): `npx supabase migration up` with the new file on a clean DB;
  inspect the schema; run rollback SQL; re-apply — no errors.

- **Keep `recognizer.js` pure:** the verify logic lives entirely in `samples.js` (weight computation)
  and `rules.json` (multiplier). `recognizer.js` only sees a numeric `weight` on each template cloud.
  Adding a JSON import to `recognizer.js` would break `node --test` (same constraint as `geometry.js`
  and `deduce.js` — enforced by the architecture).
