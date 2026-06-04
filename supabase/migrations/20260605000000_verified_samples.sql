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

-- ── Rollback / down migration ──
-- To reverse this migration run:
--   drop index if exists public.samples_verified_active_idx;
--   alter table public.training_samples
--     drop column if exists verified_at,
--     drop column if exists verified_by,
--     drop column if exists verified;
