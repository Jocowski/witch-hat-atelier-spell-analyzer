-- Dynamic symbols: let the Admin registry drive what shows in the drawing app.
-- The Studio palette + engine read a JSON baseline (data/sigils.json, data/signs.json,
-- data/grammar.json) ⊕ a runtime overlay of these DB columns (see src/engine/symbolMerge.js).
-- All columns are nullable — absent = "use the JSON baseline value", so existing rows/code are
-- unaffected.  RLS: reads open (symbols_read_all), writes admin-only (symbols_admin_write) — both
-- pre-existing, no new policies needed.

alter table public.symbols
  -- ── presentation (palette tile + canvas glyph) ──
  add column if not exists svg_path text,                       -- centered "-50 -50 100 100" path 'd'
  add column if not exists render   text
    check (render is null or render in ('fill', 'stroke')),     -- defaults to 'fill' in the merge layer
  add column if not exists family   text,                       -- palette grouping (fire/.../directional)

  -- ── sign semantics ──
  add column if not exists effect_tags    text[],
  add column if not exists invertible     boolean,
  add column if not exists can_be_center  boolean,
  add column if not exists surrounds      boolean,

  -- ── sign grammar operator (drives deduction) ──
  add column if not exists op_kind            text,             -- form/transmute/motion/direction/target/power/support/special
  add column if not exists op_verb            text,
  add column if not exists op_inverted_verb   text,
  add column if not exists op_directional     boolean,
  add column if not exists op_default_direction text,

  -- ── sigil semantics (drives the grammar element/substance) ──
  add column if not exists element             text,
  add column if not exists substance           text,
  add column if not exists substance_raw       text,
  add column if not exists substance_qualities text[];

comment on column public.symbols.svg_path is
  'Overlay for sigils/signs.json svgPath — centered on the engine "-50 -50 100 100" viewBox.';
comment on column public.symbols.op_kind is
  'Grammar operator kind for a sign; without op_kind+op_verb a DB sign renders but deduces generically.';
comment on column public.symbols.element is
  'Sigil element id; with substance* fields it overlays grammar.elements for first-principles deduction.';

-- ── Rollback / down migration ──
-- alter table public.symbols
--   drop column if exists svg_path, drop column if exists render, drop column if exists family,
--   drop column if exists effect_tags, drop column if exists invertible,
--   drop column if exists can_be_center, drop column if exists surrounds,
--   drop column if exists op_kind, drop column if exists op_verb, drop column if exists op_inverted_verb,
--   drop column if exists op_directional, drop column if exists op_default_direction,
--   drop column if exists element, drop column if exists substance,
--   drop column if exists substance_raw, drop column if exists substance_qualities;
