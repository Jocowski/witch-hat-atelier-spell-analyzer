-- Wave 3 — web submissions: extend source constraint, add authed insert, tighten reads.
-- See docs/app/specs/SPEC-web-unified-gating.md §4 and docs/app/PLAN-web-publish.md Wave 3.
--
-- Summary of changes:
--   1. Extend training_samples_source_check to include 'web'
--      (invited users submit with source='web', weight 0, unverified until admin promotes).
--   2. Add samples_authed_insert: authenticated users may insert only unverified web rows they own.
--      (samples_admin_write still covers all admin insert/update/delete — authed users get no update/delete.)
--   3. Replace samples_read_all (using true — all roles) with samples_read_scoped
--      (verified=true OR own row OR admin). The new policy carries NO role restriction so the anon
--      role still reads all verified rows — required for the static-seed-less DB overlay path on the web build.

-- ── 1. Extend source check ────────────────────────────────────────────────────────────────────────
alter table public.training_samples drop constraint if exists training_samples_source_check;
alter table public.training_samples
  add constraint training_samples_source_check
    check (source in ('drawn', 'corrected', 'confirmed', 'web'));

-- ── 2. Authenticated insert policy ───────────────────────────────────────────────────────────────
-- Invited users may contribute training, but only as unverified web samples they own.
-- Weight-0 in rules.json + the verified=true filter on the active overlay are two independent
-- guarantees that these rows never influence anyone's recognition until an admin verifies them.
create policy samples_authed_insert on public.training_samples
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and source = 'web'
    and verified = false
  );

-- ── 3. Tighten SELECT (verified-or-owner-or-admin) ───────────────────────────────────────────────
-- Drop the unrestricted read-all policy and replace it with a scoped one.
-- IMPORTANT: no TO clause → applies to all roles (including anon), so anonymous visitors can still
-- read the verified templates they need for the DB overlay. Unverified rows by other users are hidden.
drop policy if exists samples_read_all on public.training_samples;
create policy samples_read_scoped on public.training_samples
  for select using (
    verified = true
    or created_by = auth.uid()
    or public.is_admin()
  );

-- ── Rollback / down migration ─────────────────────────────────────────────────────────────────────
-- To reverse this migration run the following SQL:
--
--   drop policy if exists samples_read_scoped    on public.training_samples;
--   drop policy if exists samples_authed_insert  on public.training_samples;
--
--   create policy samples_read_all on public.training_samples
--     for select using (true);
--
--   alter table public.training_samples drop constraint if exists training_samples_source_check;
--   alter table public.training_samples
--     add constraint training_samples_source_check
--       check (source in ('drawn', 'corrected', 'confirmed'));
