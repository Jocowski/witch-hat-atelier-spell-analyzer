-- Spell Studio — initial schema (see docs/APP-PLAN.md §5, docs/SPEC.md §6).
-- Tables: profiles · symbols (registry) · training_samples (soft-deletable) · analyses · audit_log.
-- Auth is Supabase Auth (auth.users); profiles mirrors it with an app role.

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- ───────────────────────── symbols (registry) ─────────────────────────
-- The select list for training + the "add new symbol" surface. engine_id ties a symbol to its
-- sigils.json / signs.json id so a produced spell still analyzes; fan symbols carry operator_kind.
create table public.symbols (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('sign', 'sigil')),
  name          text not null unique,
  label         text,
  engine_id     text,
  status        text not null default 'canon' check (status in ('canon', 'fan')),
  operator_kind text,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index symbols_kind_idx on public.symbols (kind);

-- ───────────────────────── training_samples ─────────────────────────
-- One drawn example. Soft-deletable (deleted_at) so rollback-by-date / delete-by-user is reversible.
create table public.training_samples (
  id          uuid primary key default gen_random_uuid(),
  symbol_id   uuid not null references public.symbols (id) on delete cascade,
  points      jsonb not null,                 -- [{X,Y,ID}]
  role        text,
  rotation    real default 0,
  scale       real default 1,
  source      text not null default 'drawn' check (source in ('drawn', 'corrected')),
  app_version text,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index samples_symbol_active_idx on public.training_samples (symbol_id) where deleted_at is null;
create index samples_created_at_idx    on public.training_samples (created_at);
create index samples_created_by_idx    on public.training_samples (created_by);

-- ───────────────────────── analyses (feeds the improvement loop) ─────────────────────────
create table public.analyses (
  id            uuid primary key default gen_random_uuid(),
  composition   jsonb not null,
  engine_result jsonb,
  ai_report     jsonb,
  corrections   jsonb,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

-- ───────────────────────── audit_log (admin actions) ─────────────────────────
create table public.audit_log (
  id     uuid primary key default gen_random_uuid(),
  actor  uuid references public.profiles (id),
  action text not null,
  target jsonb,
  at     timestamptz not null default now()
);

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.is_admin() returns boolean
  language sql security definer stable as $$
    select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  $$;

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer as $$
  begin
    insert into public.profiles (id, username)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'username', new.email));
    return new;
  end;
  $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles         enable row level security;
alter table public.symbols          enable row level security;
alter table public.training_samples enable row level security;
alter table public.analyses         enable row level security;
alter table public.audit_log        enable row level security;

-- profiles: see/update your own; admins see all
create policy profiles_self_read   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid());

-- symbols: anyone may READ the registry (the Studio needs it without login); only admins write
create policy symbols_read_all   on public.symbols for select using (true);
create policy symbols_admin_write on public.symbols for all using (public.is_admin()) with check (public.is_admin());

-- training_samples: anyone may READ (templates feed the recognizer); only admins write/soft-delete
create policy samples_read_all    on public.training_samples for select using (true);
create policy samples_admin_write on public.training_samples for all using (public.is_admin()) with check (public.is_admin());

-- analyses: owner reads own (admins read all); a user inserts rows as themselves
create policy analyses_own_read on public.analyses for select using (created_by = auth.uid() or public.is_admin());
create policy analyses_insert   on public.analyses for insert with check (created_by = auth.uid());

-- audit_log: admins only
create policy audit_admin_read  on public.audit_log for select using (public.is_admin());
create policy audit_admin_write on public.audit_log for insert with check (public.is_admin());
