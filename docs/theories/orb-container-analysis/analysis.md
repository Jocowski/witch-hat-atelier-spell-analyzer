# Orb as a Container — the "fill a sphere" model

> **Status: theory-locked (L0).** This doc pins the model that all downstream layers
> (grammar.json, geometry.js, deduce.js, ir.js, renderer) must implement.
> Canonical precedent: the einlair vector model (see
> [`docs/theories/einlair-vector-analisys/analysis.md`](../einlair-vector-analisys/analysis.md)).
> Spec: [`docs/app/specs/SPEC-orb-container.md`](../../app/specs/SPEC-orb-container.md).

---

## 1. What Column and Orb each do (and how they fit together)

The einlair model (`computeColumnFlow`) decomposes the seal's column signs into three scalars:

- **R** — the net radial flow: the vector sum of all column signs projected onto the seal plane.
  `R = |Σ cᵢ|`
- **T** — total inflow: the scalar sum of all column magnitudes.
  `T = Σ |cᵢ|`
- **U** — upward (out-of-plane) flow: the portion of inflow that cannot escape radially.
  `U = T − R`

When two Column signs point directly toward each other from opposite sides (the Water Orb
layout), their radial components cancel exactly: `R ≈ 0`, so `U ≈ T` — all the inflow is
redirected upward, out of the seal plane.

**Column is the pump. Orb is the vessel.**

Column opens a directional output channel; it aims a jet. Orb is a `form` operator that does
*not* aim. Instead it **captures the seal's upward einlair flow `U` into a suspended
sphere** that fills from the bottom up. The two signs are complementary halves of one flow
model:

```
substance (sigil)
  └─▶ driven upward by Column pairs (U ≈ T when balanced)
       └─▶ collected and contained by Orb (the vessel fills bottom-to-top)
```

This is a clean unification with no special-casing: Orb simply consumes `U` rather than
introducing a new aiming vector.

---

## 2. The capture-U model

Three quantities govern the container:

### 2a. Fill rate ∝ U

The rate at which the orb sphere fills is proportional to the seal's upward einlair flow `U`.
More inward-facing, better-balanced Column signs → higher `U` → faster fill.

- A single Column sign: `R = T`, `U = 0` — the substance jets sideways; the orb sphere sits
  empty (or fills negligibly slowly from leakage).
- Two opposed Columns (Water Orb layout): `R ≈ 0`, `U ≈ T` — maximum fill rate; the
  substance is driven upward directly into the sphere.
- Partial cancellation (two columns, not exactly opposed): `U` is intermediate; the orb fills
  at a reduced rate and any residual `R` leaks as a weak lateral jet.

### 2b. Capacity ∝ orbCount · size

The sphere's volume (and the amount of substance it can hold) scales with **how many Orb signs
are present** and **how large each is drawn**:

```
capacity   = Σ magnitudeOf(orbSign)   (count × individual size)
radiusFrac ∝ 0.25 + k₁·orbCount + k₂·(capacity − orbCount)
```

Water Orb places **4 Orb signs** around the seal, making a large container. One Orb sign would
produce a small sphere.

### 2c. Fills bottom-to-top under gravity

Gravity acts on the contained substance. The sphere floats (gravity is low — the orb is
levitated, like a bucket held in the air), but the substance *inside* it obeys gravity: it
pools at the bottom and the fill line rises upward as more substance enters. The sphere is
full only when the fill line reaches the top.

This is the "bucket held above the seal" image:

```
     ___
    /   \   ← empty (air)
   |-----|  ← fill line, rising
   |~~~~~|  ← substance (fills from bottom)
    \___/
       ↑
   [glyph]
```

Consequence: the Orb sign does **not** pull material in by itself. It defines the container
space and lets substance accumulate. If there is no intake source (no balanced Columns, no
Collection sign, no caster pouring water in directly), the orb sphere sits empty.

---

## 3. Substance gating — what can an Orb hold?

The substance's physical state (CORE.md §2b) decides whether the container mechanic works
cleanly or requires additional preparation. Four categories:

| State | Can Orb hold it cleanly? | Why | Canon cite |
|---|---|---|---|
| **fluid** | Yes — pools cleanly | Liquid fills any container from the bottom up; gravity distributes it evenly. | water: CORE.md §2b, sigils.md:39–43; lexicon/substances.md (Water §Behavior) |
| **granular** | Yes, with caveats | Loose grains (sand, soil) pour and stack like a coarse fluid; fine-grained flows well, but coarser chunks may bridge or arch. Practically clean for canonical sand/fine soil. | earth (granular mode): CORE.md §2b; lexicon/substances.md (Earth §Drawing note) |
| **rigid** | No — jams without a compaction operator | Rigid pieces (rock, wood, crystal) do not flow; they stack, wedge, and jam inside the sphere. A compaction sign (e.g. Convergence, `kind:"power"`, `hardensLoose:true`) must be added to crush/pack the rigid pieces first, reducing them to dust or granules that can then pool. | earth (rigid mode): CORE.md §2b + §2a; lexicon/substances.md (Earth §Behavior); lexicon/substances.md (Crystal §Behavior: "rigid state means form signs that assume flow (Orb) want a compaction or shaping partner") |
| **manipulate-only substance** | Needs a real source — the orb is an empty reservoir by default | Manipulate-capability substances (earth, wind) cannot conjure their material (CORE.md §2a). An Earth Orb is a reservoir that must be *fed* real earth before it can fill; without a feedstock source it stays empty. A create-capability substance (water, fire) self-supplies. | earth capability: CORE.md §2a (canon anchor: sigils.md:53); Water vs Earth Orb contrast: lexicon/substances.md (Water §Findings); lexicon/substances.md (Earth §Findings) |

**Gaseous and energetic substances** (`gaseous`: smoke, air, heatless flame; `luminous/energetic`:
fire, light) are `create`-capable or close to it, but they do not pool under gravity the same
way a fluid does. They would fill the sphere as a pressurized or glowing cloud rather than a
rising liquid level — the bottom-to-top fill mechanic applies in principle (denser parts sink)
but the visual is very different from a water orb. This is undocumented in the canon; flag as
theoretical.

---

## 4. The pump-and-vessel relationship: Water Orb worked through explicitly

**Canon spell.** Water Orb (`data/spells.json`, id `water_orb`, origin `wiki`, confidence `high`):

```
core:   water
signs:  orb ×4  (placement: around, orientation: inward)
        column ×2  (placement: sides, orientation: inward)
symmetry: radial
effect: "Gathers water into a free-floating spherical container held above the glyph,
         with no physical vessel."
```

Source: telepedia "Water Orb" — manga debut ch. 53.

**Step-by-step reasoning.**

1. **Substance.** Water sigil. Capability: create (self-sufficient — no external water source
   needed; sigils.md:41). State: fluid. Water Orb therefore needs no feedstock.

2. **Upward flow.** Two Column signs on opposite sides, both inward-facing. By the einlair model:
   - Each column vector points toward center; in polar coordinates: radial component `a = −1`
     per sign (pointing inward).
   - The two vectors are opposed (φ₁ = 0, φ₂ = π), so their Cartesian sums cancel: `R = 0`.
   - `T = 2` (sum of magnitudes); `U = T − R = 2`.
   - All inflow is upward. The columns act as a pump driving the water out of the seal plane.

3. **Container.** Four Orb signs placed around the seal. Four signs → substantial `capacity`;
   the sphere radius scales with both count and individual sign size. Orbs are non-directional
   (no front) so their radial placement is symmetric — the resulting sphere is centered directly
   above the seal, not biased to one side.

4. **Fill.** Water (fluid, create-mode) is driven upward by `U = 2` and collected into the
   sphere. It pools from the bottom; the fill line rises. Since the water sigil creates its own
   water, the sphere fills continuously until the spell ends or the sphere is full.

5. **Gravity / float.** The sphere floats above the glyph — gravity is suppressed for the
   container itself (like levitation) but the water inside obeys gravity (pools at the bottom).
   The result is an invisible spherical container holding free-floating water.

**What if you removed the Column signs?**

With no Column signs, `U = 0`. The orb sphere is defined but receives no upward flow. The
water sigil's raw output (`pours and flows outward` — grammar.json `elements.water.raw`) would
manifest as an undirected outward pour rather than filling the sphere. The orb would require
manual filling (the canon shows Qifrey pouring water in directly —
`docs/lexicon/signs-non-directional.md:292–293`) or a Collection/Pull sign.

**What if you used only one Column?**

One Column: `R ≠ 0` (the inflow is net lateral), `U < T`. The orb fills at reduced rate and
a lateral jet bleeds off some substance sideways. The spell would be asymmetric and less
efficient as a container — part water jet, part orb fill.

---

## 5. Failure modes

### 5a. Rigid substance jams without Convergence

Rigid substances (rock, wood, crystal) do not flow. Placed in an Orb without preparation, they
would pile up and jam against the sphere's interior rather than pooling cleanly. The container
can still be defined (the Orb signs are valid), but the substance will not fill bottom-to-top
uniformly — it will wedge and block.

**Fix:** add Convergence (`kind:"power"`, `hardensLoose:true`). Convergence compacts loose
grains into a denser rigid form on contact (the classic earth trick — CORE.md §3b), but can
also be read as a crushing intake: it reduces rigid pieces to granular dust that then flows.
One Convergence is often sufficient to convert the substance to a poolable granular state.

Without Convergence, an Earth Orb with rigid rock input does nothing useful.

### 5b. Manipulate/collect substance needs a real source

Manipulate-only substances (earth, wind) cannot conjure their material (CORE.md §2a). An Earth
Orb is therefore an **empty reservoir** by default. The Orb signs define the container space
but cannot create earth to fill it — a real earth source (ground beneath, a pre-placed earth
mass) must feed the sphere, or a `support` sign (Collection, Gather) must draw it in.

Contrast: **Water Orb creates its own water** (water is `create`-mode). The sphere self-fills
as soon as the upward flow is established.

**Canon anchor.** "Earth can only manipulate stone/sand/soil/wood — it cannot create matter"
(CORE.md §2a, citing sigils.md:53). An Earth Orb without a feedstock source is a valid
container that holds nothing.

### 5c. No orb count → no container

Without any Orb sign, there is no container. The upward einlair flow `U` still exists (if
Columns are balanced), but it exits the seal plane as a vertical jet rather than being
collected. The water would fountain upward and fall back rather than forming a sphere.

Minimum orb count for a functional container: 1 (a very small sphere). Water Orb uses 4 to
achieve a large, useful container. More Orb signs = more capacity and a larger radius.

### 5d. Imbalanced Columns bleed off as a lateral jet

If the Column signs are not balanced (not opposed or not equal in size), `R > 0`. Some
substance escapes sideways rather than rising into the orb. The sphere fills more slowly; the
jet can create an unintended directional hazard. The fill fraction is `U / T = (T − R) / T`,
which falls as the imbalance grows. Fully unbalanced (one column) leaves `U ≈ 0` and the
sphere barely fills.

---

## 6. Net rule

> **Orb consumes the seal's upward/contained flow (`U`) and turns it into a filling vessel.**
> It reuses `U` rather than introducing a new aiming vector — no special case, a clean
> unification with the einlair flow model.

Parameters:

| Parameter | Governed by | Monotonic in |
|---|---|---|
| Fill rate | Upward flow `U = T − R` | Improves as Column balance improves |
| Capacity / sphere radius | Orb count and individual size | Grows with more/larger Orb signs |
| Substance suitability | Physical state + capability (§3) | — (binary gating, not continuous) |
| Fill direction | Gravity (downward inside sphere) | Fixed — always fills bottom-to-top |

The model is **substance-agnostic in structure** (the same geometry computes `capacity`,
`radiusFrac`, and `fillFrac` regardless of element) and **substance-aware in output** (the
notes about pooling/jamming/needing-a-source come from the substance's `state`/`capability`,
not from hardcoded element ids).

---

## 7. Connections and citations

| Concept | Primary source |
|---|---|
| Upward flow `U = T − R` | `docs/theories/einlair-vector-analisys/analysis.md`; `src/engine/geometry.js computeColumnFlow` |
| Orb as `form` operator, fills bottom-to-top | `docs/lexicon/signs-non-directional.md:272–295` |
| Physical state categories | `docs/CORE.md §2b` |
| Capability (create/manipulate/collect) | `docs/CORE.md §2a`; `docs/sigils.md:41` (water), `docs/sigils.md:53` (earth) |
| Water Orb canon recipe | `data/spells.json` (id `water_orb`, origin `wiki`) |
| Earth capability anchor | `docs/sigils.md:53`; `docs/lexicon/substances.md` (Earth §Behavior) |
| Convergence as compaction operator | `docs/CORE.md §3b`; `data/grammar.json operators.convergence` |
| Earth Orb vs Water Orb capability contrast | `docs/lexicon/substances.md` (Earth §Findings; Water §Findings) |
| Crystal (rigid, self-creating) — Orb needs compaction partner | `docs/lexicon/substances.md` (Crystal §Behavior) |
| Spec (all layers) | `docs/app/specs/SPEC-orb-container.md` |
