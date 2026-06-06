-- symbol_prototypes — per-symbol ML embedding prototypes (M4b, SPEC-ml-recognizer.md).
-- One prototype vector per symbol per model version, computed client-side in the admin
-- on each training flywheel trigger (no Python retraining required to update a prototype).
-- Embeddings are plain jsonb float arrays (~64 numbers each); NO pgvector (85 symbols ×
-- cosine in JS is trivial — revisit only if a future spec does fuzzy whole-spell vector search).

-- ───────────────────────── symbol_prototypes ─────────────────────────
create table if not exists public.symbol_prototypes (
  -- One prototype per (symbol, model_version) pair.
  symbol_id     uuid        not null references public.symbols (id) on delete cascade,
  model_version text        not null,
  -- The L2-normalized embedding vector (float array, length = embeddingDim from model.meta.json).
  embedding     jsonb       not null,
  -- Provenance / staleness tracking.
  updated_at    timestamptz not null default now(),
  updated_by    uuid        references public.profiles (id),

  -- Unique key: one prototype per symbol per model version, upsertable.
  primary key (symbol_id, model_version)
);

-- Index for the common query: load all prototypes for a given model_version.
create index if not exists prototypes_model_version_idx
  on public.symbol_prototypes (model_version);

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.symbol_prototypes enable row level security;

-- Public read: the Studio loads prototypes at inference time without a login.
-- Mirrors the pattern in init.sql: symbols_read_all + training_samples read_all.
create policy if not exists prototypes_read_all
  on public.symbol_prototypes
  for select
  using (true);

-- Admin write: only admins may insert/update/delete prototypes.
-- The flywheel runs in the admin UI, so this is enforced naturally.
-- Mirrors symbols_admin_write + samples_admin_write from init.sql.
create policy if not exists prototypes_admin_write
  on public.symbol_prototypes
  for all
  using  (public.is_admin())
  with check (public.is_admin());

-- ── Rollback / down migration ──────────────────────────────────────────
-- To reverse this migration run:
--   drop policy if exists prototypes_admin_write on public.symbol_prototypes;
--   drop policy if exists prototypes_read_all    on public.symbol_prototypes;
--   drop index  if exists public.prototypes_model_version_idx;
--   drop table  if exists public.symbol_prototypes;
