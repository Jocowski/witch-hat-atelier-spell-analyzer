-- Align the symbols registry with the app's JSON baseline (data/signs.json).
--   • bend was merged into envelopment ("Envelop") — same artwork, see SPEC/signs.md.
--   • bird, animal_signs, the generic unknown_sign, and every numbered unknown_NN sign were removed.
-- Kept on purpose: the bird_a / bird_b SIGILS and the unknown_sigil core placeholder (these are
-- sigils, not the removed signs).

-- Remove any training samples attached to the deprecated SIGN rows first (FK safety).
delete from public.training_samples
 where symbol_id in (
   select id from public.symbols
    where kind = 'sign'
      and engine_id in (
        'bend', 'bird', 'animal_signs', 'unknown_sign',
        'unknown_01', 'unknown_02', 'unknown_03', 'unknown_04', 'unknown_05', 'unknown_06',
        'unknown_07', 'unknown_08', 'unknown_09', 'unknown_10', 'unknown_11', 'unknown_12'
      )
 );

delete from public.symbols
 where kind = 'sign'
   and engine_id in (
     'bend', 'bird', 'animal_signs', 'unknown_sign',
     'unknown_01', 'unknown_02', 'unknown_03', 'unknown_04', 'unknown_05', 'unknown_06',
     'unknown_07', 'unknown_08', 'unknown_09', 'unknown_10', 'unknown_11', 'unknown_12'
   );

-- bend's recipe role moved to envelopment; reflect the display rename.
update public.symbols set label = 'Envelop' where engine_id = 'envelopment';
