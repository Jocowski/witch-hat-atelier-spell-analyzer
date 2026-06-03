# wha-lang — the spell authoring language (SPEC v0.1)

> A small, composable language for **describing a Witch Hat Atelier seal by intent** instead of
> by hand-computed coordinates. You say *what parts, how many, roughly where, which way they
> face*; the compiler owns every `x`/`y`/`rotation`. `wha-lang` is the **source language**; it
> compiles to the **`wha-spell`** IR ([IR.md](IR.md)) that the engine, renderer, and analyzer
> already consume.
>
> Status: **draft spec, pre-implementation.** This document is the contract to build against.

---

## 0. Why this exists

Authoring `wha-spell` JSON by hand fails: a four-ring seal is ~250 lines of `{x,y,rotation,
scale}` and every mistake is a trig error, not a design choice. `wha-lang` moves authoring up to
the level people (and the AI) actually think at:

```
SIGN(COLUMN, 8, at=DIAGONAL, face=OUT)   // "two columns on each diagonal, pointing out"
```
…instead of eight coordinate triples. The compiler is the only thing that does arithmetic.

---

## 1. Design principles (the load-bearing boundaries)

1. **Drawing, not meaning.** `wha-lang` describes *only the geometry and structure of the seal*.
   It never encodes what a spell *does*. Effect/feasibility reasoning stays in
   [CORE.md](CORE.md) + the analyzer. ⇒ When effect rules change, the language does **not**.
2. **Data-driven symbols.** `SIGIL`/`SIGN` types are validated against
   [data/sigils.json](../data/sigils.json) / [data/signs.json](../data/signs.json), and
   capability flags (`canBeCore`, `surrounds`, `invertible`, `defaultFacing`) are **read from
   that data**. ⇒ Add a symbol to the JSON and it is instantly usable; no language edit.
3. **One place does math.** Exactly one resolver turns anchors/zones/faces into coordinates
   (§6). Everything we ever got wrong by hand lives in that single tested function.
4. **Recursive placement.** A `GROUP` is a mini-circle with its own local frame, so *relative*
   arrangements ("two columns aimed at a bend") are expressed by nesting layout scopes — **no
   part ever references another part**, so there is no constraint solver.

---

## 2. Compilation pipeline

```
wha-lang source ─▶ parse ─▶ AST ─▶ resolve placements (the only math) ─▶ wha-spell@2 JSON
                                                                          │
                                              tools/render.mjs ◀──────────┤
                                              spell-engine-cli --facts ◀──┘
```
A single-circle spell emits `wha-spell@1`; anything with relations emits `wha-spell@2`.

---

## 3. Coordinate conventions (inherited from IR.md §3 — do not diverge)

- Cartesian px, origin at circle center, **`y` is down** (SVG).
- **Angle 0° = north, increasing clockwise.** A point at angle θ, radius r:
  `x = r·sin(θ°)`, `y = −r·cos(θ°)`.
- Zones (distance ÷ circle radius): `inside ≤ 0.85`, `ring 0.85–1.05`, `outside > 1.05`.
  Signs in `outside` are external framing marks (they don't steer aim/balance).

---

## 4. The model (AST)

```
Spell   = { name, circles: Circle[], relations: Relation[] }
Circle  = { id, core?: Part, children: Placed[], radius, ring: open|closed, dyes: Id[], center }
Group   = { name, core?: Part, children: Placed[] }          // a reusable local layout
Part    = { kind: SIGIL|SIGN, type: Id, inverted: bool, scale: number }
Placed  = { node: Part|Group, placement: Placement }
Placement = { at, count, radius, face, spread, scale, inverted }
Relation  = nest(outer,inner) | link(a,b) | toggle(a,b)
```
`children` may hold Parts **or** Groups — that recursion is what gives relative placement.

---

## 5. Primitives & surface syntax

> Two concrete syntaxes map to the same AST: a **parsed DSL** (shown here) and an equivalent
> **JS-builder** (§12). Pick one at build time; the spec is identical underneath.

```
SIGIL(TYPE, count?, opts?)      // a substance:  VISION, WIND, FIRE, WATER, EARTH, LIGHT…
SIGN(TYPE, count?, opts?)       // an operator:  COLUMN, REGION, EYE, BEND, PUPPET, WEAVE…
group NAME { … }                // define a reusable local layout
GROUP(NAME, count?, opts?)      // place a defined group
circle NAME radius=R ring? { … }// a ring; `core X` sets the center substance
nest A in B                     // B encloses A
link A, B                       // joined seals
toggle A, B                     // split-ring switch across two objects
stack A, B, C                   // sugar: nest a chain innermost→outermost
```
- `TYPE` is a logical name resolved to a data id (e.g. `REGION → direction`, `PUPPET →
  dancing_puppet`, `BILLOW → billowing`). The resolver keeps the alias table; unknown types are
  a compile error listing the nearest valid ids.
- `count` defaults to `1`.
- `core X` accepts a sigil **or** a center-capable sign; a center sign is mapped to its
  `*_sigil` form automatically (`VISION → vision_sigil`) per the `canBeCore` data.

### opts (the placement vocabulary)

| opt | values | default |
|---|---|---|
| `at` | `RING` · `CARDINAL` · `DIAGONAL` · `SURROUND` · `[θ,θ,…]` | `RING` |
| `face` | `IN` · `OUT` · `AROUND` · `FRONT` · `AUTO` | `AUTO` |
| `radius` | `INNER` · `MID` · `RING` · `OUT` · number(px) | `MID` (`RING` if `face=AROUND`) |
| `spread` | degrees between flanked items | `18` |
| `scale` | number | `1` |
| `inverted` | bool (rejected if the sign isn't `invertible`) | `false` |

---

## 6. Placement resolution (the only math)

Given a circle of radius `R`, resolve one `Placed` of `count = N`:

**Step 1 — anchor angles `A`:**
- `RING` → `A = []` (each item is its own evenly-spaced anchor: `θ_i = i·360/N`).
- `CARDINAL` → `A = [0, 90, 180, 270]`.
- `DIAGONAL` → `A = [45, 135, 225, 315]`.
- `[θ…]` → `A` = the listed angles.
- `SURROUND` → skip steps 2–5; emit **one** sign flagged as the encircling band (for
  `surrounds:true` signs — weave, rain, collection, puppet).

**Step 2 — distribute `N` over anchors** (when `at ≠ RING`):
- `m = |A|`, `k = N / m` (must divide evenly, else compile error suggesting `RING` or a count).
- For each anchor `a`: if `k = 1`, one item at `a`; if `k > 1`, `k` items flanking `a`, centered,
  at `a + spread·(j − (k−1)/2)` for `j = 0…k−1`. *(This is the auto-flanking rule: `count=8 at
  CARDINAL` → 2 per cardinal.)*

**Step 3 — radius `r`:** resolve the zone to a fraction of `R` — `INNER=0.45`, `MID=0.70`,
`RING=0.92`, `OUT=1.12` — or use the absolute number.

**Step 4 — position:** `x = r·sin(θ°)`, `y = −r·cos(θ°)`.

**Step 5 — rotation from `face`** (θ = the item's own angle):
| face | rotation | meaning |
|---|---|---|
| `IN` | `θ + 180` | the sign's TOP points at the center |
| `OUT` | `θ` | points away from center |
| `AROUND` | `θ + 90` | tangential ⇒ the spell spins |
| `FRONT` | `0` | all items aimed the same way (north) |
| `AUTO` | from data `defaultFacing` | `defaultFacing:"outward"` ⇒ `OUT`, else `IN` |

> **Calibration note (resolved in implementation).** The constant was calibrated against the
> engine/renderer: a sign drawn at rotation `0` points **north (toward center when placed at
> north)**, so making it point *inward from any angle θ* requires `θ + 180` — matching
> `inwardRotation` in `src/engine/geometry.js` and the canon reference seals (e.g. Light Beam's
> columns at `(0, -95)` carry rotation `180`). An earlier spec draft listed `IN = θ`; the live
> resolver in `tools/wha-lang.mjs` (`faceToRotation`) is authoritative.

---

## 7. GROUP — recursive / relative placement

A `group` is laid out in a **local frame**: origin at its anchor, local **+outward axis = away
from the circle center** (local "north"). Children use the same `opts`, but `radius` means
*distance along the local outward axis* and `face` is relative to the local frame. When placed
with `GROUP(name, N, at=…)`, the group is instantiated at each anchor: its origin is set to the
anchor point (at the placement `radius`), then the whole group is rotated so local-outward aligns
with that anchor's radial-outward.

Because a group has a fixed outward axis, "two columns pointing at the bend" is just columns with
`face=OUT` placed inward of a bend that sits further `OUT` — **no part-to-part reference needed**.

```
group shadow_arm {              // the cloak's diagonal unit
  SIGN(EYE)                     // local origin (innermost)
  SIGN(BEND)   radius=OUT       // further out along the arm
  SIGN(COLUMN, 2) face=OUT spread=24   // two columns flanking, aimed outward at the bend
}
```

---

## 8. CIRCLE, structure & the circle-graph

- A `circle` has a `radius`, a `ring` state (`closed` default; `open` = prepared-but-inactive),
  an optional `core`, `children`, and `dyes`. Its `center` defaults to `(0,0)`.
- Structure is a **graph**, not a stack. The three canon relations ([magic.md:59–89](magic.md#L59)):
  - **`nest A in B`** — enclosure. **Many circles may nest in one** (`nest C2 in C1; nest C3 in
    C1`) ⇒ the "one big circle, several siblings inside" case. Inner activates only when the
    outer ring closes (nested-glyph rule).
  - **`link A, B`** — seals joined by a line; effects combine. *Identical* links **stack power**;
    inverted-identical **cancel**. (Topology only — combination is the analyzer's job.)
  - **`toggle A, B`** — one ring split across two objects; closes when they meet.
- **`stack A, B, C, D`** is sugar for the linear chain `nest A in B; nest B in C; nest C in D`
  (innermost → outermost). Auto-assigns ascending radii if omitted (clustered toward the rim by
  default, since canon borders bunch — override per circle).

> **Not in the kernel:** there is no `overlap`/"circles cutting circles" relation — it is **not
> canon** (the five documented mechanics are inversion, linked, nested, toggle, glaives —
> [magic.md:59](magic.md#L59)). A sign sitting "half in / half out" of a ring is a *placement*
> (it lands in the `ring` zone, e.g. `radius=RING`), **not** a circle relation. If a fan design
> ever needs truly intersecting rings, model it ad-hoc with offset `center`s and reason in
> prose; do not promote it to the language.

---

## 9. Capability rules (read from data, enforced at compile time)

- **`core` must be a sigil or a `canBeCore` sign.** A bare non-core sign at center → error.
- **`inverted` only on `invertible` signs** (directional / semi-directional) → else error.
- **`at=SURROUND` only on `surrounds:true` signs**, and a surround sign implies `count=1`.
- **A closed ring with no core and no children** → flagged (raw discharge / boundary ring).
- **A coreless circle with children** is a **modifier ring** (shapes what it nests/links).
- Unknown `TYPE` → error with nearest-id suggestions.

These reuse the engine's own rules ([data/rules.json](../data/rules.json)); the compiler
pre-checks so errors surface in `wha-lang`, not deep in the JSON.

---

## 10. Worked example — the Cloak Spell

```
spell "Cloak Spell" {

  // one diagonal arm: an eye, a bend further out, two columns aimed at the bend
  group shadow_arm {
    SIGN(EYE)
    SIGN(BEND)   radius=OUT
    SIGN(COLUMN, 2) face=OUT spread=24
  }

  circle inner radius=140 {
    core SIGN(VISION)
    SIGIL(WIND, 4)        at=CARDINAL          // one wind per cardinal
    GROUP(shadow_arm, 4)  at=DIAGONAL          // the eye→bend→columns unit, ×4
  }

  circle body radius=172 {
    SIGN(PUPPET, 4) at=CARDINAL                // mind-pilot wheels on the cardinals
    SIGN(REGION, 8) at=CARDINAL face=IN        // 2 per cardinal (auto-flank), aimed inward
  }

  circle chan_region radius=205 { SIGN(REGION, 18) face=AROUND }   // channelway, inner band
  circle chan_bend   radius=235 { SIGN(BEND,   24) face=AROUND }   // channelway, braided rim

  stack inner, body, chan_region, chan_bend
}
```

~15 lines, zero coordinates, reads like the spell — and it compiles to the same four-ring
`wha-spell@2` device we built by hand. Change `18`/`24` for border density; `radius=140` resizes
the heart; `spread=24` opens the column pairs.

---

## 11. Grammar (parsed-DSL form, EBNF sketch)

```ebnf
spell      = "spell" string "{" { groupdef | circle | relation } "}" ;
groupdef   = "group" ident "{" { coreline | partline } "}" ;
circle     = "circle" ident "radius=" number [ "open" | "closed" ] "{" { coreline | partline } "}" ;
coreline   = "core" part ;
partline   = ( part | groupcall ) [ opts ] ;
part       = ("SIGIL"|"SIGN") "(" TYPE [ "," number ] ")" ;
groupcall  = "GROUP" "(" ident [ "," number ] ")" ;
opts       = { ident "=" value } ;            (* at=…  face=…  radius=…  spread=…  scale=…  inverted=… *)
relation   = ("nest" ident "in" ident) | ("link" idlist) | ("toggle" idlist) | ("stack" idlist) ;
```
`let NAME = …` bindings (reusing a part/group expression) are optional sugar over `group`.

---

## 12. JS-builder mapping (the no-parser implementation)

Same AST, expressed as function calls (combine with commas instead of `+`):

```js
import { SPELL, CIRCLE, GROUP, SIGIL, SIGN, CARDINAL, DIAGONAL, AROUND, IN, OUT, OUT_R } from "../tools/wha-lang.mjs";

const shadowArm = GROUP("shadow_arm",
  SIGN("EYE"),
  SIGN("BEND",   { radius: "OUT" }),
  SIGN("COLUMN", 2, { face: OUT, spread: 24 }),
);

const inner = CIRCLE("inner", { radius: 140, core: SIGN("VISION") },
  SIGIL("WIND", 4, { at: CARDINAL }),
  GROUP(shadowArm, 4, { at: DIAGONAL }),
);
// …body, chanRegion, chanBend…

const cloak = SPELL("Cloak Spell").stack(inner, body, chanRegion, chanBend);
cloak.emit();   // → wha-spell@2 JSON   → render / facts
```

---

## 13. Deferred / out of scope (recorded, not built)

| Item | Status |
|---|---|
| `overlap` / intersecting rings | **non-canon** — excluded; prose-only escape hatch if ever needed (§8) |
| **Glaives** (body-embedding claws) | future primitive `GLAIVE(...)`; always **forbidden**-flagged. Not in v0.1 |
| **Dyes** | parsed into `circle.dyes`; informational only (no effect math), matching the engine |
| **Deliberate asymmetry** (Watershot lean) | supported via explicit `at=[θ…]` + per-part `scale` |
| **Link power-combination semantics** | topology only; combine/stack/cancel is analyzer reasoning |
| **Inter-ring "double ring"** ([rules.json:116](../data/rules.json#L116)) | treated as ordinary concentric `nest`; not a separate mechanic in magic.md |

---

## 14. Extensibility checklist (how it adapts when canon grows)

- **New sign/sigil** → add to `data/*.json` (+ alias if its logical name differs). Usable
  immediately; no language change.
- **New placement shape** → add an `at` keyword + a case in the §6 resolver. Nothing else moves.
- **New structural mechanic** → add a `Relation` type + how it emits to `wha-spell@2` relations.
- **New effect rule** → changes the analyzer/CORE only; `wha-lang` is untouched (principle §1).
```
