# World Guide 2026 — canon ingest (official guidebook preview + Masterdoc + Spell Checkers)

> Source-of-record for the 2026 data drop. **Tiered by reliability** — apply to CORE/data only
> per tier. Three sources:
> 1. **Official World Guide preview** (MAGs `mag-s.jp/pages/witch-hat-atelier`; sample page p.147,
>    "Capture Pennant of the Knights Moralis" + "The Raincleaver"). **Names + JP readings = CANON.**
> 2. **Magic System Masterdoc** (Nazberry, Tumblr WIP) — fan catalog curated from canon ⇒ **wiki-tier**.
> 3. **Spell Checkers Discord** (the [[spell-checkers-community]] answer-key group) — *translations
>    reliable; live theories = THEORY*, do not canonize.

---

## TIER 1 — CANON (official guidebook): names & Japanese semantics

The guidebook gives official English names with JP "vector" readings. Mapping to our ids:

| Official name (EN) | JP reading / meaning | Our id | Action |
|---|---|---|---|
| **Sign of Focus** | "aiming vector" — set a target | `sights_set` | official rename |
| **Sign of Entwining** | "coiling vector" — wrap/bind *around* something | `entwine` | official rename |
| **Sign of Empowerment** | "reinforcement vector" — strengthen/reinforce/harden (incl. empowering *effects*, not only physical) | `strengthen` | official rename |
| **Sign of Binding** | "holding vector" — fixes/**anchors** the effect in place | `bind` | official rename + effect refine |
| **Sign of Convergence** | convergence | `convergence` | confirm |
| **Sign of Gathering** | gathering | `gather` | confirm name |
| **Sign of Solidification** | "solidification vector" — causes the effect to **harden/coagulate** | **none** | **NEW sign** |
| **Sign of Envelopment** | "cloaking vector" — clads/wraps the effect around like a garment | **none** | **NEW sign** |
| **Sigil of Sword** | — | **none** | **NEW sigil** (object decorative) |
| **Sigil of Water / Repetition** | — | `water` / `repetition_sigil` | confirm |

New canon symbols to add: **Sign of Solidification**, **Sign of Envelopment**, **Sigil of Sword**.

### Caster intent (CANON, from manga — confirmed in chat)
Magic is **not pure code**: it responds to the **caster's intent**. Canon evidence: a non-witch
doctor reached toward Coco's floating water bubbles and nudged them, though that wasn't the
spell's designated effect. Community framing (apt): *"like writing a letter to a god who knows
your intent"* — the written seal sets the rules; ambiguity is resolved by what the caster wills;
a seal that contradicts intent is ignored/overridden. Implication for us: the deduced effect is
the seal's *floor*, intent fine-tunes within it. **Belongs in CORE.md.**

### Decorative sigils impose a SHAPE — objects too, not just animals (CANON)
The **Sigil of Sword** (an object) and **Valance Leech** confirm decorative sigils aren't limited
to animals; they impose a *shape/identity* on the substance. Full deco list (guidebook): Dragon,
Flower, Horse, Liongoat, Torchstag, Scalewolf, Owlcat, Valance Leech, **Sword**.

### Dyes (CANON, guidebook Tools) — 3 we're missing
Have: Azuremoon Flower (duration↑), Blood (power↑), Blushing Bride Scales (seal invisible),
Golden Blaze Wyrm Scales (glow-in-dark), Roaming Scallop Shells (waterproof).
**Missing:** Dragon Egg Shells (effect unknown), Dragon Scales (effect unknown), Tranquileaf
(effect unknown).

---

## TIER 2 — Masterdoc (wiki-tier): spell roster confirmations
~90 spells with Sigil(s)/Sign(s)/Effect/First-appearance/Users. Use to raise `confidence`, fix
counts, and add absent canon spells. Notable confirmations / corrections vs our catalog:
- **Sylph Shoes**: Wind Underfoot + Convergence(8) + Levitation(8). Redrawn variant (Coco, vol 3
  ch 15) swaps Levitation→**longer Columns** ⇒ faster; anime ep 9 "corrects" back to Levitation.
- **Vapour Bubble**: Water + Wind(2); Gather(2) Cool(4) Column(6). (we have gather×2/cool×4/col×4 — **col count differs: 6**).
- **Wall Breaker** w/ **Iguin's blood** ink → far larger, devastating range, even turns water to mist (dye-as-power canon).
- **Snugstone**: Fire; Column(4) Radial(4) — *radiates warmth without a flame* (see Tier 3 retcon).
- **Floating Drops**: Wind + Water(2); Region(16) Column(2).
- **Sand Cage**: Earth; Crush(2) Column(2) **Inverted Column(2)** + unknowns — "panels made the way sand is turned into cloth"; built on Wall Breaker.
- New/absent canon spells worth adding: **Floating Disc of Water**, **Pillar of Smoke** (Smoke; Column 8), **Valance Leech of Light** (Light+Valance Leech; Column 5), **Beast Warding** (odor that drives animals away), **Bubble Carriage** (Aeriforms; Region 26 Column 26), **Washbarrel** (Repetition), **Floating Expansion** (Window; Float4 Enlarge Column8), **Spell of Reduction** (Repetition; Inv-Enlarge Diamond4), **Flameburst** (Column + **Angled Pull**), **Snowfending** (Fire; Float4 …), **Pegasus Carriage**, **Magic Cookpot** (Repetition6 Convergence16), **Light-Reducing Spell** (Vision — vision *aids sight* when separate from eye).
- **Memory Erasure / Extracting Truth** use **Glaives** (forbidden, body magic). **Petrification, Scalewolf Curse, Slime Transformation, Teleportation, Twin Bottles** listed under Forbidden.
- New sigils named: **Unburning Flames**, **Stability and Level Planes** (sign-as-sigil), **Time Stop**, plus the air family (Aeriforms / Wind Underfoot / Whorling Winds) all confirmed.

---

## TIER 3 — THEORY (Spell Checkers live analysis): DO NOT canonize; record as `theories`
- **"Inverse Radial is not canon."** Strong community consensus: what we modeled as *inverted
  Radial* is actually **Bind (upright)** — Bind makes a substance *stick to itself* (why the Sand
  **Bridge** tiles cohere and don't fall apart). In **Snugstone**, it's **inverted Bind** =
  "breaking the bind of fire," releasing it as **heat**. ⇒ They argue **Radial may not exist**;
  its two known uses (Snugstone heat, Sand Bridge cohesion) are Bind/inverted-Bind.
  - ⚠️ Contentious & destructive to our data (`radial` is used in Snugstone, Sand Cage, Sand
    Bridge, Beast Warding). The guidebook page shown does **not** list "Radial" — but absence ≠
    proof. **Hold for an explicit decision; record as theory until the full guide confirms.**
- **Sign of Empowerment** JP leans "reinforce" — may empower *effects*, not just physical hardness
  (inverse ⇒ weaken physically, not weaken-magic). Theory.
- **Sigil of Sword**: makes things "sword-like"/forms an edge; in Raincleaver likely shapes the
  water blade (with Gather putting water on the blade, Convergence moving it to the edges,
  Envelopment cladding the edge). Theory.
- **Sign of Solidification / Envelopment** mechanics: solidify = harden/coagulate (no durability
  implied); envelop = clad an object/effect like a garment (crystal-coating, etc.). Theory pending art.
- **The "dots"** (solid vs hollow small circles) may be **mathematical-notation operators** (the
  author confirmed math-notation inspiration); hollow vs solid pupils (Eye) seem meaningful. Theory.
- **No canon way to make ice/snow** if inverse-Radial falls (was cool+inverse-radial). Open.

---

## Action queue (proposed; see chat for tiering & approvals)
1. **Names (Tier 1):** add `officialName` to `sights_set/entwine/strengthen/bind/gather`; keep ids.
2. **New symbols (Tier 1):** add `solidification`, `envelopment` signs (+ grammar operators) and
   `sword` sigil (decorative/object); mark `confidence`/`origin` = guidebook-canon.
3. **CORE.md (Tier 1):** add §Caster intent and generalize "decorative = shape (animal **or
   object**)".
4. **Dyes (Tier 1):** add Dragon Egg Shells, Dragon Scales, Tranquileaf (effect unknown).
5. **Catalog (Tier 2):** raise confidences / fix counts (Vapour Bubble col=6, Floating Drops,
   Sand Cage inverted-column) and add the absent canon spells listed above.
6. **Radial→Bind (Tier 3):** **do nothing until the user decides** — record as `theories` on
   `radial`/`bind` lexicon entries only.
