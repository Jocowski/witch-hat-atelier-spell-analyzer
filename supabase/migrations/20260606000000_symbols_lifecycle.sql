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

-- ── Rollback / down migration ──
-- To reverse this migration run:
--   drop index if exists public.symbols_review_queue_idx;
--   alter table public.symbols
--     drop column if exists lc_flag,
--     drop column if exists lc_rev,
--     drop column if exists lc_status;
