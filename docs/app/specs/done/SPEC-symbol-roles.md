# SPEC — Symbol roles (sign / sigil / both); drop the duplicate `*_sigil` entries

> Status: **done - shipped** · Scope: **data model + engine + admin + DB** ·
> Branch: `feat/spell-studio-experiments` · Cross-refs:
> [data/signs.json](../../../../data/signs.json), [data/sigils.json](../../../../data/sigils.json),
> [src/engine/data.js](../../../../src/engine/data.js), [src/engine/deduce.js](../../../../src/engine/deduce.js),
> [src/admin/SymbolEditor.jsx](../../../../src/admin/SymbolEditor.jsx), `supabase/`.

## Problem
A "sign-as-sigil" (a sign that can occupy the centre — **billowing**, **vision**, **repetition**) is
modelled as **two** entries: the sign in `signs.json` *and* a `*_sigil` twin in `sigils.json`
(`billowing_sigil`, `vision_sigil`, `repetition_sigil`, family `special`, hidden). That duplication is
what surfaces in the palette as "Billowing (as sigil)". We want a single symbol that declares it plays
**sign**, **sigil**, or **both** — and to delete the redundant `*_sigil` rows.

## Key facts that make this clean
- `deduce.js` resolves the core's substance via `sigilMap[core.type] || signMap[core.type]` then
  `coreDef.element` — so a **sign** can be a valid core simply by carrying an `element`.
- The DB `symbols` table already has `can_be_center` (boolean) and `element` columns, and
  `symbolMerge.js` already overlays both — so "a sign that's also a core" is already representable; the
  `*_sigil` rows are pure redundancy. The Admin `SymbolEditor` already exposes kind + can_be_center +
  element.

## Design — a `roles` field, anchored on the existing mechanism
A symbol's **roles** = which parts it can play: `["sign"]`, `["sigil"]`, or `["sign","sigil"]`.
- **Representation:** an optional explicit `roles` array on the JSON entry. When absent it is **derived**:
  a `sigils.json` entry ⇒ `["sigil"]`; a `signs.json` entry ⇒ `["sign"]` plus `"sigil"` when
  `canBeCenter` is true. So `roles` is a clarifying label over the existing kind + canBeCenter machinery,
  not a new engine input.
- `data.js` gains `symbolRoles(type) → string[]`; `canBeCore`/`signCanBeCenter` respect roles (a symbol
  whose roles include `sigil` is core-capable) while staying backward-compatible with `canBeCenter`.

## Consolidation (billowing, vision, repetition)
1. **signs.json:** each of the three gains `roles: ["sign","sigil"]` and an `element`
   (`billowing → transmutation`, `vision → light`, `repetition → time`) — the substance previously held
   by its `*_sigil`. `canBeCenter` stays true.
2. **sigils.json:** delete `billowing_sigil`, `vision_sigil`, `repetition_sigil`.
3. **spells.json:** every `"core": "<x>_sigil"` → `"core": "<x>"` (billowing/vision/repetition).
4. **wha-lang.mjs:** drop the `CORE_SIGIL_OF` remaps for the three — a centre-capable sign now emits its
   own id as the core (matching the new spells convention). `unknown_sigil` stays a real sigil.
5. **tools/vectorize-sigils.cjs:** remove the three `*_sigil` MAP entries (the sign artwork already
   covers them).

## Database
- **seed.sql:** remove the three `*_sigil` sigil rows; set `can_be_center = true` + the `element` on the
  billowing/vision/repetition sign rows (so the registry/editor reflects "both").
- **migration** `…_consolidate_sign_sigils.sql`: delete the three `*_sigil` symbol rows from existing
  DBs (their training samples cascade) and stamp can_be_center/element on the three sign rows.

## Admin
`SymbolEditor` already has kind + "Can be center?" + element. Add a short hint that, for a sign,
"Can be center = yes" means it **also acts as a sigil/core** (roles: sign + sigil) — no structural UI
change needed.

## Testing
- `deduce.test.js`, `drawingModel.test.js`, `wha-lang.test.js`: replace `*_sigil` core refs with the
  sign id; add a check that `D('billowing', …)`/`vision`/`repetition` as a core resolves the right
  element. Coverage/integrity tests must stay green (every spell core id still exists).
- `npm test` green, lint clean, build OK; `supabase db reset` applies and the `*_sigil` rows are gone.
