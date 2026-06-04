-- Allow training_samples.source = 'confirmed' (symbols harvested from a confident catalog match via
-- the Studio "Contribute symbols to training" flow). The initial constraint only allowed
-- 'drawn'/'corrected', so confirmed inserts were silently rejected. See docs/SPEC-cluster-recognition.md (WS11a).
alter table public.training_samples drop constraint if exists training_samples_source_check;
alter table public.training_samples
  add constraint training_samples_source_check check (source in ('drawn', 'corrected', 'confirmed'));
