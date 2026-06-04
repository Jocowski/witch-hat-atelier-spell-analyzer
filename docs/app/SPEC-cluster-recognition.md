# SPEC — Training contribution & cluster recognition

> Spec for the "analyzing a spell feeds the training set" feature the user asked for: when a drawn
> spell matches a known recipe (or a cluster of signs with a known effect), let it seed the training
> data so future recognition gets easier. **Phase 1** (per-symbol contribution) is partly implemented
> and needs one DB fix; **Phase 2** (holistic cluster recognition) is the design to build.
> Companion to [SPEC.md](SPEC.md) (this is workstream **WS11**) and [APP-PLAN.md](APP-PLAN.md).

## 0. Why (the flywheel, reframed)

Per-symbol recognition is data-hungry and fragile for dense spells. But the engine **already knows**
what many real spells are (catalog match in `analyze()` → `result.similar.match`). So when the engine
is confident about a spell, the drawing is **trustworthy labeled data** we can harvest for free:

```
draw a known spell → engine matches a recipe → its symbols are confidently labeled
   → save those drawn symbols as training examples → recognition of those symbols improves
   → (Phase 2) save the whole-spell shape as a "cluster" → recognize the spell holistically next time
```

---

## 1. Phase 1 — per-symbol contribution (IMPLEMENTED, with a required fix)

### 1.1 Current behavior
- In [src/studio/StudioPage.jsx](../../src/studio/StudioPage.jsx), after **Analyze**, when the engine
  returns a catalog match (`result.similar.match`) and there are recognized groups, a **"Contribute
  symbols to training"** box appears (`canContribute`).
- `handleContribute()` iterates the recognized groups; for each it resolves the registry symbol via
  `getSymbolByEngineId(label)` ([symbols.js](../../src/data-services/symbols.js)), derives the drawn
  points with `groupToTemplate(group, label, role)` ([recognizer.js](../../src/draw/recognizer.js)), and
  calls `addSample({ symbol_id, points, role, source: 'confirmed', app_version: 'studio' })`
  ([samples.js](../../src/data-services/samples.js)).

### 1.2 ⚠ Required fix (Phase 1 is currently broken at the DB)
The initial migration constrains the column:
```sql
source text not null default 'drawn' check (source in ('drawn', 'corrected'))
```
`source: 'confirmed'` therefore **violates the CHECK** and the insert throws (swallowed by the
`try/catch`, so the UI silently reports "Nothing could be added"). **Fix:** add a migration that
widens the constraint:
```sql
-- supabase/migrations/<ts>_source_confirmed.sql
alter table public.training_samples drop constraint training_samples_source_check;
alter table public.training_samples
  add constraint training_samples_source_check check (source in ('drawn','corrected','confirmed'));
```
Apply with `npx supabase migration up` (or `db reset` locally). Acceptance: contributing on a matched
spell inserts N rows with `source='confirmed'` and they appear in Review.

### 1.3 Acceptance (Phase 1, after the fix)
- Draw/recognize a spell that matches a catalog recipe → "Contribute" saves one `training_sample`
  per recognized symbol with `source='confirmed'`, `symbol_id` resolved from the registry.
- The samples are visible in Admin → Review, count toward `activeTemplates()`, and improve the next
  recognition of those symbols.

### 1.4 Provenance note
Keep `source` meaningful for later curation/weighting: `drawn` (hand-trained), `corrected` (user fixed
a wrong guess — high value), `confirmed` (harvested from a confident catalog match — high volume, but
only as trustworthy as the match). The improvement-loop review packets (WS9) should be able to filter
by `source`.

---

## 2. Phase 2 — holistic cluster recognition (TO BUILD)

### 2.1 Goal
Recognize a **whole spell** from its overall drawn shape, not only symbol-by-symbol — so a known
spell is identified even when individual strokes are shaky, and so a recognized cluster maps straight
to a known effect.

### 2.2 Data model — `cluster_samples`
A new table storing labeled whole-spell drawings:
```sql
create table public.cluster_samples (
  id           uuid primary key default gen_random_uuid(),
  spell_id     text,                  -- spells.json id when matched (nullable for freeform clusters)
  label        text not null,         -- display name of the spell/cluster
  cloud        jsonb not null,        -- normalized whole-drawing point cloud [{X,Y,ID}] (all strokes)
  layout       jsonb,                 -- the composition it represents (core + signs + positions)
  effect       text,                  -- known effect summary (denormalized for quick display)
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index cluster_samples_label_idx on public.cluster_samples (label) where deleted_at is null;
-- RLS: read-all (the matcher needs it), admin-only write (mirror training_samples policies).
```
Data services: `addCluster({spell_id,label,cloud,layout,effect})`, `activeClusters()`,
`softDeleteCluster(id)` in a new `src/data-services/clusters.js`.

### 2.3 Capture
Extend the Phase-1 contribute flow: when a spell matches a recipe (or the user confirms all symbols),
**also** capture the whole-drawing cloud as a cluster example:
- `cloud` = all drawn strokes' points combined, **normalized** (resample + scale-to-unit + translate
  to centroid — reuse the `$P` `makeCloud` normalization in [recognizer.js](../../src/draw/recognizer.js)).
- `label`/`spell_id`/`effect` = from `result.similar.match`; `layout` = the produced `composition`.
- A "Contribute spell shape" action (next to the per-symbol contribute), or fold both into one button.

### 2.4 Cluster matcher (pure, testable)
Add to `recognizer.js` (keep it JSON-free):
- `makeClusterCloud(strokes)` — combine all stroke point arrays → one normalized point cloud.
- `matchCluster(strokes, clusters, { rotationSweep })` — `$P` greedy-cloud-match of the drawing's
  cloud against each stored `cluster.cloud`, with a **coarse rotation sweep** (e.g. every 15°) for
  rotation tolerance; return ranked `[{ label, spell_id, layout, effect, dist, score }]`.
- Threshold + confidence so weak matches are ignored (always defer to per-symbol + user correction).

### 2.5 Integration into the Detect step
Coarse-to-fine in `StudioPage.handleDetect()`:
1. If `activeClusters()` is non-empty, run `matchCluster(drawn, clusters)`.
2. **Confident cluster match** → adopt the cluster's `layout` as the detection (label the whole spell
   "recognized as <Spell>"), seed the overlay boxes from the layout, and surface the known `effect`.
3. **Else** → current per-symbol recognition (`analyzeStrokes`).
4. Either way, the user can correct (corrections still feed Phase-1 training; a correction on a
   cluster-matched spell can also down-weight/flag that cluster example).

### 2.6 Effect shortcut
A matched cluster carries a known `effect` (and `spell_id` → `spells.json`). Show it immediately
(before/independent of the AI report) and use it to corroborate the engine deduction.

### 2.7 Acceptance (Phase 2)
- After a few contributed examples of a spell, drawing that spell's shape (even with rough strokes)
  is recognized **as that spell** via the cluster matcher, with its known effect shown, without
  relying on every individual symbol being recognized.
- Below threshold, behavior is identical to today (per-symbol), with no false "recognized as X".

### 2.8 Risks / decisions
- **Data hunger:** needs several whole-spell examples per spell before cluster match is reliable —
  Phase 1 contribution is the feeder.
- **Rotation/scale:** `$P` is not rotation-invariant; the rotation sweep handles drawn rotation but
  costs compute — cap the sweep and the cluster count, or precompute rotated variants.
- **False positives:** an over-eager cluster match mislabels a novel spell as a known one — keep a
  conservative threshold and always allow override; treat cluster match as a *hint*, the engine +
  user as the authority (consistent with [PLAN.md](../../PLAN.md): AI/engine reasons, recognizer scaffolds).
- **Open:** store `cloud` normalized vs raw (normalized is smaller + match-ready; raw allows re-deriving
  layout) — recommend normalized + keep `layout` for the composition; store a thumbnail later if a
  gallery wants it.

---

## 3. Workstream summary (for SPEC.md)
- **WS11a (Phase 1 fix):** migration to allow `source='confirmed'`; verify contribute end-to-end. *(small)*
- **WS11b (Phase 2):** `cluster_samples` table + RLS + `clusters.js` service; cluster capture in the
  contribute flow; `matchCluster`/`makeClusterCloud` in `recognizer.js` (+ pure tests); coarse-to-fine
  Detect integration; effect shortcut UI. *(medium-large)*
