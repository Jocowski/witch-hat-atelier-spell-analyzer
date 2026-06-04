-- Symbol roles: a sign that can occupy the centre now carries its own substance (roles: sign+sigil),
-- so the duplicate "<x>_sigil" twins are removed. See docs/app/SPEC-symbol-roles.md.
--   billowing_sigil  → folded into the billowing sign (element transmutation)
--   vision_sigil     → folded into the vision sign     (element light)
--   repetition_sigil → folded into the repetition sign (element time)

-- Remove training samples on the *_sigil rows first (they also cascade on the symbol delete).
delete from public.training_samples
 where symbol_id in (
   select id from public.symbols where kind = 'sigil'
     and engine_id in ('billowing_sigil', 'vision_sigil', 'repetition_sigil')
 );

delete from public.symbols
 where kind = 'sigil'
   and engine_id in ('billowing_sigil', 'vision_sigil', 'repetition_sigil');

-- Mark the centre-capable signs as also acting as a sigil/core (so the registry/editor shows "both").
update public.symbols set can_be_center = true, element = 'transmutation' where engine_id = 'billowing';
update public.symbols set can_be_center = true, element = 'light'         where engine_id = 'vision';
update public.symbols set can_be_center = true, element = 'time'          where engine_id = 'repetition';
