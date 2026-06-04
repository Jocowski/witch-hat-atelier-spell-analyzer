-- Remove four sigils from the registry to match the JSON baseline (data/sigils.json):
--   calling, guidance, sword, unknown_sigil ("Unknown / Forbidden Sigil").
-- The catalog spells that used unknown_sigil / guidance as a core (windowway_spell, lockwax,
-- fish_guidance) were dropped from spells.json accordingly.

delete from public.training_samples
 where symbol_id in (
   select id from public.symbols where kind = 'sigil'
     and engine_id in ('calling', 'guidance', 'sword', 'unknown_sigil')
 );

delete from public.symbols
 where kind = 'sigil'
   and engine_id in ('calling', 'guidance', 'sword', 'unknown_sigil');
