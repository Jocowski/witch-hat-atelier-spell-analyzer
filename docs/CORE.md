# CORE.md — the magic system from first principles

> **This is the reasoning core of the project.** Read it before analyzing or designing a
> spell. It is not a lookup table (that is [data/](../data/) + [lexicon/](lexicon/)) and not a
> quick cheat-sheet (that is the skill references). It is the *model you reason with* — how to
> work out, from fundamentals, what any composition does, whether it works, and what would
> change if you altered it.
>
> **Stance (see [../PLAN.md](../PLAN.md)).** You — the AI — are the runtime. The code engine
> is a compiler + a fact extractor: it parses a drawing into reliable, observable facts
> (`node tools/spell-engine-cli.mjs --facts`) and renders results back to a picture
> (`tools/render.mjs`). It also ships a fast prose *heuristic* (`deduction.summary`) — treat
> that as a scaffold, **not** ground truth. The effect is something you *derive* here.

Source of truth for canon: [magic.md](magic.md), [sigils.md](sigils.md), [signs.md](signs.md),
[magical-dye.md](magical-dye.md), [forbidden-magic.md](forbidden-magic.md). Cite them by
`file:line` when a claim rests on canon.

---

## 1. The execution model

A seal is a little program. Reading it:

```
effect  =  SUBSTANCE        (what the magic is made of — the sigil/core)
         ▶ shaped by OPERATORS   (the signs, applied as transformations)
         ▶ parameterized by GEOMETRY  (direction · position · quantity · size · tilt · inversion · symmetry)
         ▶ gated by ACTIVATION   (the ring; nested/linked/toggled structure)
         ▶ modulated by INK      (magical dyes)
```

The single most important consequence: **the same operators mean different things on
different substances.** `column` on water → a jet; `column` on light → a beam; `column` on
fire → a lance of flame. You never reason about a sign in the abstract — you reason about a
sign *acting on this substance, with these parameters*. (magic.md, "a spell's effect depends
on the sigil it is paired with".)

So the procedure is always: **identify the substance and its nature → apply each operator as
a transformation of that substance → resolve the geometry → check it can actually run.**

### 1a. Caster intent — the seal is a floor, not a cage (CANON)

Magic is **not pure code**: it also responds to the **caster's will**. Canon shows a non-witch
doctor reach toward Coco's floating water bubbles and nudge them, though that was not the spell's
written effect (World Guide 2026 / community confirm; see [world-guide-2026.md](world-guide-2026.md)).
The useful framing: a seal is **like a letter to a god who already knows your intent** — the
written symbols set the rules and the *floor* of what happens, and ambiguity left by the drawing
is resolved by what the caster is willing. A seal that flatly contradicts intent is overridden by
what was *written*, but anything the writing leaves open, intent fine-tunes.

Consequence for us: **deduce the effect the seal guarantees** (that is what these docs reason
about), then note that within its slack the caster's intent steers specifics (which direction an
undirected float drifts, how a motion plays out). Don't treat the deduction as the *only* possible
outcome — treat it as the floor the symbols pin down.

---

## 2. Substances (the operands)

A substance is not just "water" or "earth" — it is an object with **properties** that decide
what is physically possible. Three properties dominate:

### 2a. Capability — can it CREATE its material, only MANIPULATE existing material, or COLLECT it?

This is the highest-leverage question in the whole system. It decides whether a spell is
self-sufficient or needs a source.

| Capability | Meaning | Reason like… |
|---|---|---|
| **create** | conjures the material from nothing | self-sufficient; works anywhere |
| **manipulate** | only moves/reshapes material that is *already there* | "a machine that needs feedstock" — find the source or it does nothing |
| **collect** | draws the material in from the environment | "a pump that needs a reservoir" — needs ambient supply (humidity, a body of water) |

Canon anchors:
- **Earth can only manipulate** stone/sand/soil/wood — it *cannot create* matter
  (sigils.md ~:53). An Earth Orb is therefore a *reservoir that must be fed real earth*,
  whereas a Water Orb makes its own water.
- **Water can create, but collecting is cheaper** (sigils.md ~:41). Long-duration / large
  water spells should collect ambient humidity (Vapor Bubble, Rainbringer, Qifrey's Water
  Dragon "uses water from nearby clouds") rather than create.
- **Wind moves air but does not create it; Aeriforms creates air but does not move it**
  (sigils.md, air family). Need both ⇒ combine sigils.

When a spell relies on manipulate/collect, **always state what real-world source it needs** —
that is usually the most important thing about it.

### 2b. Physical state — how does the material behave once you have it?

`fluid` (water), `granular` (sand, loose earth), `rigid` (rock, wood, crystal), `gaseous`
(air, smoke, heatless flame), `luminous/energetic` (fire, light), `immaterial` (time, guidance
pull, recorded sound, the "shape" of a decorative sigil).

State decides whether an operator's mechanic even fits. Example: **Orb** fills a sphere
bottom-to-top under gravity. A fluid or granular substance pools cleanly; a rigid one
(rock, wood) would stack and jam and needs a compaction operator (e.g. convergence) first.
Match the operator's assumed physics to the substance's state, and call out the mismatch.
See also: full container model (capture-U, substance gating, pump+vessel, failure modes) in [`theories/orb-container-analysis/analysis.md`](theories/orb-container-analysis/analysis.md).

### 2c. Source & cost — does running it consume something, and how much?

Create-mode spells cost magic but no feedstock. Manipulate/collect spells are limited by their
source. Size, neatness, and links scale power and duration (§4). Note when a spell is
practical-but-fragile (depends on a scarce source) vs. robust.

> Substances at a glance — fire/heat/light, water, earth (stone/sand/soil/wood), air/wind,
> time (halt or revert), crystal, smoke, guidance (attraction), calling (recorded sound),
> and decorative creature-shapes. Per-element detail, with the create/manipulate/collect
> note, lives in [lexicon/substances.md](lexicon/substances.md) and [sigils.md](sigils.md).

---

## 3. Operators (the signs)

Each sign is a **typed operator** on the substance. To reason about one, ask four things:

1. **Kind** — what category of transformation is it? (the `kind` in
   [data/grammar.json](../data/grammar.json))
2. **Preconditions** — what does it need to do anything? (a substance in the right state; a
   partner operator; a real source)
3. **Parameters** — what do its geometry knobs (direction/size/quantity/tilt/inversion) change?
4. **Failure mode** — what happens if a precondition is unmet?

### 3a. The operator kinds (the "type system")

| Kind | Transformation | Representative signs | Note |
|---|---|---|---|
| **form** | shapes the output *channel* the substance leaves by | column→beam, dispersion→leak outward, bolt→fast fragments, rain→rainfall, orb→sphere | element-agnostic; the substance flows through the shape |
| **transmute** | changes the substance's *state/shape* | weave→ribbon, billowing→cloud, crush→dust (inverted→reassemble), enlarge→grow (inverted→shrink) | **outranks form** for the primary clause |
| **motion** | adds movement | levitation→lift, float→ignore gravity, dancing_puppet→dart about | |
| **direction** | aims or attracts | region→manifest where it points, pull→draw same-element matter in (inverted→push; angled→vortex) | reads geometry heavily |
| **target** | scopes *what* is affected | window→the object it's drawn on, diamond→neighbors, crosshair→an area, sights_set→a chosen target | |
| **power** | tunes intensity | convergence→focus/harden/compact, radial→temper down | |
| **support** | feeds another operator | collection, gather (supply material for billowing/orb) | useless alone — needs the operator it feeds |
| **special** | compound/unique | vision+eye+bend→concealment; repetition→revert; purify; link; bind; cool; strengthen; entwine; glaives | reason case-by-case from the lexicon |

**Resolution order** (how to assemble the sentence): `transmute or form` → `motion` →
`direction` → `target` → `power` → `special` → `support`. Exactly one of transmute/form
usually owns the primary clause; if neither is present, the substance manifests raw.

### 3b. Preconditions and failure modes (think in pre/post-conditions)

This is what lets you answer "will it work?" and "what if I use Z instead?":

- **billowing** needs material to fluff into cloud → precondition: a `support` sign
  (collection/gather) or an ambient supply. *Failure:* "has nothing to turn into cloud."
- **bolt** makes fragments but doesn't aim them → wants a `direction` sign. *Failure:* bolts
  fly with no controlled aim.
- **crush** pulverizes on contact but has little reach → wants a `column` to drive it.
- **convergence on earth** compacts loose grains into a rigid form (the rigidity trick); on
  water it can instead serve as *intake*, converging cloud-water to a point to be collected.
  Same operator, different role by substance + context — decide which from the spell's goal.
- **support signs alone do nothing** — they only feed a form/transmute operator.

When you swap a sign, walk its kind + preconditions: a different `form` sign reshapes the
output channel (column→bolt turns a jet into a volley); a different `power` sign retunes
intensity (convergence→radial turns "focused/hardened" into "gentle/tempered"); swapping a
`transmute` changes the substance's state entirely.

> The complete per-sign operator data (verb, inverted verb, kind, partners) is in
> [data/grammar.json](../data/grammar.json); the per-sign *drawing* + accumulated findings are
> in [lexicon/](lexicon/). Use those for specifics; use this section for *how to reason*.

---

## 4. Geometry as parameters

Geometry is how a drawn seal passes arguments to its operators. Six knobs:

- **Direction (where signs point / their angle).** Only signs *with a front* steer:
  **directional** signs (column, pull, region, levitation, …). All-aligned ⇒ aimed that way;
  all-inward ⇒ contained/centered; all-outward ⇒ pushed outside the ring; opposed ⇒ emerges
  only along the ring. (signs.md, Region.) "Above the seal" is the out-of-plane default for a
  beam/lift — **not** compass north; only a genuine lateral imbalance earns a compass label.
- **Position (where signs sit).** A one-sided cluster of region signs biases the manifestation
  toward that arc even when each faces inward (Rising Wave). Position imbalance of form signs
  skews the beam (the Watershot lesson: a longer/larger column leans the jet its way).
- **Quantity & size.** More or larger signs on one side win the direction; size sets *strength*
  for semi-directional signs and, for levitation, the weight it can hold. Bigger seal = more
  powerful overall.
- **Tilt (rotation off the radial axis).** Canting signs tangentially makes the spell **spin**;
  more tilt = more spin, less reach. A normal inward/outward-facing ring is *oriented*, not
  spinning.
- **Inversion (`inverted`).** Flips the operator to its opposite — but **only for invertible
  signs** (directional / semi-directional): crush↔reassemble, enlarge↔shrink, pull↔push,
  floating-expansion↔spell-of-reduction. Non-directional signs have no front to flip (not
  invertible); asymmetric signs are unpredictable. Two identical spells, one inverted, cancel.
- **Symmetry.** Radial or bilateral ⇒ stable. Asymmetric (esp. ≥2 asymmetric signs) ⇒ may be
  unstable. Symmetry is *stability*, not effect — but instability is a real defect to flag.

**Engine caveats** (the facts geometry is observational but element-blind — override these):
levitation on water/fire/light lifts *vertically without steering*, yet the engine routes
every directional sign through aim/spin math, so it may report a spurious lateral aim/spin —
treat as artifact. A lone sign read slightly off-origin can false-flag "asymmetric/unstable."
An in-plane direction label ("down") on a ground-drawn seal means *horizontal*, not gravity.

---

## 5. Composition & resolution

To deduce a full spell:

1. **Substance.** Identify the core sigil(s) and their capability/state/source (§2). Multiple
   sigils ⇒ combine substances (Water Horse = water + horse-shape; Qifrey's Dragon = water +
   dragon-shape).
2. **Primary clause.** Apply the dominant operator: a `transmute` if present, else a `form`,
   else the raw element.
3. **Direction.** Resolve where it goes from the directional signs + balance (§4).
4. **Layer the rest** in resolution order: motion, target, power, special, support.
5. **Interactions.** Apply synergies/warnings between operators (billowing needs collection;
   bolt wants direction; convergence+earth hardens; vision+eye+bend conceals). The engine
   facts surface many; reason the rest from preconditions (§3b).
6. **Stability & power.** Symmetry → stability; size/neatness/links and convergence/radial →
   power and duration.
7. **Source & feasibility.** Re-check capability: does it have the material it needs to run?
8. **Compare to the closest canon spell** — state what is the same, what differs, and *why*,
   grounded in the docs. Then give a one-line bottom line.

For **contraptions** (multi-circle, [IR.md](IR.md) §5): resolve each circle, then combine
along the relations — a nested inner seal is wrapped by its outer (and only fires when the
outer ring closes); linked seals combine, identical linked seals stack power; an empty
enclosing ring is a boundary/chamber, a coreless ring with signs is a modifier that shapes
what it wraps.

---

## 6. Validity & failure modes

A seal is **invalid** (won't run) or **flawed** (runs badly) for definite reasons:

- **No core** → no substance → no spell. (A center-capable sign — vision, repetition,
  billowing, weave, rain, bird, dancing_puppet, enlarge — can serve as the center; but a bare
  *sign* at center has no element, so the substance is "unknown" unless it's the `*_sigil`
  variant.)
- **Closed ring, nothing inside** → raw discharge = explosion.
- **Core, no signs** → the element has no defined form (raw, undirected).
- **Unmet operator precondition** → that operator does nothing useful (billowing with no
  collection; bolt with no aim; a manipulate-substance with no source present).
- **Asymmetry** → possible instability.
- **Unidentified signs** (`unknown_*`) → the deduction is necessarily incomplete; say so.

Activation note: ring open vs. closed is the app's activation *visual*. Reason about what the
spell *does*; do not narrate active/inactive.

---

## 7. Limits & forbidden magic

Hard limits that make designs authentic (decline-or-flag, don't fudge):

- Earth can't create matter; wind can't create air; creating water is costly.
- Inversion only for directional/semi-directional signs.
- A sign supplies *form*, never a new *substance* (a decorative/animal sign isn't a fire
  source).
- Decorative sigils impose a **shape/identity** on the substance — and that identity can be an
  **object, not only an animal** (the canon **Sigil of Sword** and Valance Leech confirm this;
  World Guide 2026). They are mostly aesthetic, but several carry real utility (Horse; Sword
  shapes the Raincleaver's water blade).
- **Forbidden** (forbidden-magic.md): anything drawn on / affecting the human body (incl.
  healing — only Memory Erasure is permitted), reality-warping, or excessive
  destruction/environment alteration. You may still *design/analyze* forbidden spells in this
  fictional context, but mark them **forbidden** unmistakably.

---

## 8. How this connects to the tools

- `node tools/spell-engine-cli.mjs --facts spell.json` → the **observations** you reason from
  (parts, operator kinds, geometry, zones, catalog neighbours). The `heuristicSummary` is a
  scaffold, not the answer. Each circle also carries a **`caveats`** array: auto-surfaced
  corrections for the recurring engine artifacts recorded in the lexicon (e.g. "4 balanced
  Columns → the aim label is an artifact"). **Apply caveats before trusting the matching
  geometry field.** They are generated from [../data/fact-caveats.json](../data/fact-caveats.json).
- `node tools/render.mjs spell.json -o out.svg` → turn a spell you designed into a picture for
  the user.
- The catalog match (`data/spells.json`) answers "have I seen this before?" — a *tool*, not the
  verdict.

Reason here first; let the engine confirm structure and geometry; let the lexicon and dossiers
supply specifics and accumulated nuance.
