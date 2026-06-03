# Directional Signs

> **Directional = the sign has a front.** It manifests its effect in a specific direction; its
> **angle** (and sometimes **size**) steers where the spell goes, and it is **invertible**
> (flip it to its opposite). All directional signs have bilateral symmetry but lack radial
> symmetry (signs.md:11). Eight signs live here. For how geometry passes these as arguments,
> see [../CORE.md](../CORE.md) §4; for the operator kinds, §3a.

---

### Column  `column`  ·  directional  ·  operator: form

**Drawing.** A long vertical line capped at one end by a short horizontal bar — a **T / ⊤**.
Bilateral about the vertical axis; no radial symmetry. The bar is the foot; the **long line is
the business-end and normally faces inward** (toward the core), so the beam fires up/out along
that line. The shorter (bar) side faces outward (signs.json; signs.md:34).

**Acts as.** A `form` operator: the substance "is projected as a tight column or beam." It is
element-agnostic — column on water → a jet, on light → a beam, on fire → a lance ([../CORE.md](../CORE.md) §1).
Invertible: inverted, the magic "is driven inward and erupts rather than projecting out,"
emitting on all sides in a way that closely resembles Dispersion — the difference between the
two is canonically unknown (signs.md:34, signs.md:45).

**Parameters.** Angle/rotation aims the beam; **size and count set the aim too** — an
unbalanced ring leans the beam toward the side with more/larger columns (signs.md:34). Inversion
flips project↔erupt.

**Findings.**
- 2026-06-01 (Watershot): a single oversized column produces a *real* directional lean toward
  the big column, but a lone 2.35× of 8 measured only ~0.18 bias — under the engine's 0.25
  `biased` threshold — so the engine reports "balanced/straight up." Override per canon: size
  sets aim (signs.md:11/34). Equalizing the ring drops bias to ~0.013 (genuinely vertical).
- 2026-06-01 (Water Pen): Dispersion + balanced horizontal Columns = a metered bleed
  **re-confined into one coherent glob** (the inked-pen reservoir), the opposite of a jet.
  Clustered/rotated Columns make the engine's `aim=up`/spin artifacts; canon glob hovers below.
- 2026-06-01 (Vapor Bubble): four balanced Columns there merely **confine airflow**, not "beam
  above the seal" as the engine narrates — treat the beam label as an artifact.
- 2026-06-02 (Beast Warding): four balanced **inverted** Columns on a Light substance spread the
  light **omnidirectionally** (≈ Dispersion) into an all-around ward-glow — the inverse of Light
  Beam's focused beam. Engine again reported "aim above the seal"; another confirmed artifact of
  4 balanced Columns (compounded by light's lateral-aim artifact, substances.md:73).
- 2026-06-01 (Flame Shot): a single large Column extending to the far side aims the flame
  **forward** toward the column's point.
- 2026-06-01 (Rising Platform): inward-vs-outward column rotation is **cosmetic** on a radial
  ring; what actually changes a column is the `inverted` flag (erupt ≈ dispersion), not its
  rotation. Don't conflate "rotated outward" with "inverted."

**Appears in.** Watershot Seal · Flame Shot Seal · Wall Breaker Seal · Light Beam · Rising
Platform of Water · Snugstone Spell · Crystal Shard (inverted) · Beast Warding (inverted ×4) (signs.md:39).

---

### Dispersion  `dispersion`  ·  directional  ·  operator: form

**Drawing.** A Column (vertical line + horizontal foot-bar) with an extra **open arc/bowl
curve below the bar** — like a column sitting over a shallow cup. Bilateral about the vertical
axis. Because it spills on all sides, it has no single aiming front; the arc opens downward/out.

**Acts as.** A `form` operator: the magic "leaks out and spreads on every side, like an
overflowing bucket" — essentially a column that *leaks* instead of *firing* (signs.json;
signs.md:45). Default direction is outward/omnidirectional. Listed invertible, but both upright
and inverted variants have been seen with no clear difference in effect; canon does not know
whether it is directional or semi-directional (signs.md:45).

**Parameters.** Mostly omnidirectional, so angle matters little; presence sets "leak" vs.
"fire." Inversion is documented but its effect is unresolved in canon.

**Findings.**
- Canon ambiguity (signs.md:45): inverted **Column** very closely matches Dispersion's effect
  (Snugstone). What distinguishes the two is unknown — when reading an inverted column or a
  dispersion, note the spread is the same and flag the uncertainty rather than inventing a
  difference.
- 2026-06-01 (Water Pen): paired with balanced Columns, Dispersion's outward leak is the supply
  that the Columns re-gather into one glob — a metering role, not a weapon.

**Appears in.** Water Pen · Bird of Light Beacon · Petrification (signs.md:47).

---

### Levitation  `levitation`  ·  directional  ·  operator: motion

**Drawing.** A vertical line tipped with an **arrowhead at one end** and a short horizontal
bar at the other — an up-arrow with a foot. Bilateral about the vertical axis. The
**arrow tip is the front and typically faces inward** (toward the core) (signs.md:53).

**Acts as.** A `motion` operator: the substance "is lifted and made to levitate." Its behavior
**depends on the paired sigil** (signs.md:53–57): for **water/fire/light**, it floats the
effect (and objects held over the seal) straight up — sign size = the weight it can hold, sigil
size = lift power. For **air/wind**, it propels the object the seal is drawn on, and *then* the
arrow direction steers the movement (anime confirmed: motion follows the arrow, signs.md:57).
Invertible.

**Parameters.** For air/wind: rotation aims the thrust. For water/fire/light: size sets
liftable weight; direction does **not** steer (lift is vertical).

**Findings.**
- ENGINE BLIND SPOT (signs.md:55): **levitation on water/fire/light lifts vertically without
  steering** — only air/wind levitation is directional. The engine routes every directional
  sign through aim/spin math element-agnostically, so a non-uniform water/fire/light levitation
  reports a **spurious lateral aim and/or spin** — treat those as artifacts; the lift is up.
  (Rising Platform.)
- Canon history (signs.md:57): the Skysoaring Seal's direction was drawn inconsistently across
  panels; the anime settled it — wind-spell motion goes the way the arrow points.
- Retcon note (signs.md:85): two early spells (Pyreball, an unnamed ch.3 spell) had their
  **Float** signs replaced with **Levitation** — don't confuse the two; Float is non-directional
  and only lifts what it's drawn on.

**Appears in.** Pyreball Seal · Rising Platform of Water · Skysoaring Seal · Pegasus Carriage
Spell · Wall-Anchored Floatglow Lamp (signs.md:59).

---

### Pull  `pull`  ·  directional  ·  operator: direction

**Drawing.** A vertical line ending in a **large double-chevron arrowhead** (two stacked
downward V's) — a heavy, emphatic down-arrow. Bilateral about the vertical axis. The
**arrowhead is the front**; pointing it inward draws matter toward the seal (signs.md:65).

**Acts as.** A `direction` operator: it "draws matter of the same element inward toward the
glyph" — anything matching the seal's sigil (water, air, fire…) is pulled in when the arrow
points inward (signs.md:65). Invertible: inverted, it "pushes matter of the same element away"
(repels). Reads geometry heavily.

**Parameters.** Angle is the key knob: arrow straight-inward = pure attraction; **angled inward
= a combined pull + twist (vortex)**; a full 90° cant likely twists without pulling at all
(signs.md:65). Inversion flips attract↔push.

**Findings.**
- 2026-06-03: **Angled/tangential Pull is the canon way to make a WIND spell spin** — not tilted
  Convergence. The Grasping Wind reading (angled = pull+twist; ~90° cant = pure twist/vortex) means
  a tangential `pull` ring spins the air into a vortex. When a design needs a spinning wind effect,
  reach for Pull (or `sign_of_wind`) here, and leave Convergence as a non-spinning compactor by the
  core. (Spell Checkers community, on a Rasen-Shuriken fan design; see
  [signs-semi-directional.md](signs-semi-directional.md) Convergence.)
- Precondition: it moves *existing* same-element matter — it does not create substance. With no
  ambient matter of the sigil's element present, it has nothing to draw.
- Vortex is the angled mode (`vortexWhenAngled` in grammar.json) — read tilt before calling it a
  straight pull. (Canon: Grasping Wind, signs.md:65.)

**Appears in.** Flame Burst Spell · Wall Bend · Grasping Wind (signs.md:67).

---

### Region  `direction`  ·  directional  ·  operator: direction

**Drawing.** A simple **chevron / caret (∧)** — two strokes meeting at an apex, no stem.
Bilateral about the vertical axis. The **apex is the front**; the spell manifests in the
direction the apex points (signs.md:96). (Note: id is `direction`, display name **Region**.)

**Acts as.** A `direction` operator: the substance "is aimed," controlled entirely by how the
region signs are *arranged* (`arrangementControlled`). Per canon (signs.md:96): all pointing the
same side ⇒ fires that way; all inward ⇒ manifests up/inside the ring only; all outward ⇒
manifests outside the ring (no effect within); **opposed pairs facing each other ⇒ magic emerges
only along the ring between them** (Floating Drops). Invertible.

**Parameters.** Rotation + arrangement are everything; **positional clustering** also biases the
manifestation toward an arc even when each faces inward.

**Findings.**
- ENGINE BLIND SPOT: the engine reads *where* region signs sit only coarsely. A one-sided inward
  cluster now reads `biased` (surging toward the cluster), but it still misses an **off-vertical
  tilt** — when region signs cover only part of the ring, read the positional distribution
  yourself; don't trust `aim` blindly. (Rising Wave.)
- 2026-06-01 (Rising Wave): a half-ring of Region = **diagonal propulsion** (launches the caster
  up at an angle). Same goal as Rising Platform (Levitation, straight up), opposite mechanism
  (Region asymmetry vs. Levitation lift).
- 2026-05-31 (Flame Shot): flanking Region signs facing **forward** (not inward-opposed)
  **confine** the magic ahead so it travels farther — a "barrel," not a gate.
- 2026-06-01 (Water Bolt): the engine's direction word (e.g. "down") on a ground-drawn seal is
  an **in-plane axis label, not gravity** — the volley fires horizontally; don't narrate "down"
  as a downward shot.

**Appears in.** Flame Shot Seal · Rising Wave · Water Bolt · Floating Drops · Makeover Mask
Spell · Illusory Labyrinth (signs.md:101).

---

### Collection  `collection`  ·  directional  ·  operator: support

**Drawing.** Two crossed diagonal strokes forming an **X**, with the upper pair opening into a
**V** — i.e. an X whose top is an open mouth. Bilateral; it **surrounds** the core (drawn as a
ring of several). The **open side is the intake and typically faces inward** (signs.md:115).
Note: the art is drawn top-outward (`defaultFacing:"outward"`), so an `inverted:true` export may
just reflect that flag, not a deliberate inversion.

**Acts as.** A `support` operator: it "gathers surrounding material to feed the spell,"
collecting material above and around the seal for another operator to use (signs.json;
signs.md:115). **Useless alone** — it only supplies a `form`/`transmute` operator (e.g. it feeds
Billow the material to fluff into cloud). Listed invertible but never seen inverted in canon
(signs.md:115).

**Parameters.** Orientation sets which way it draws material in (open mouth = intake); count
scales how much is gathered. It `surrounds`, so it's placed as a ring.

**Findings.**
- Precondition (CORE §3b): a support sign does nothing on its own — pair it with what it feeds
  (Billow → cloud; an Orb/body to fill). Failure mode: "has nothing to feed."
- Facing caveat (2026-06-01): drawn top-outward by default; check the `defaultFacing` flag before
  reporting an export's `inverted:true` as intentional. (Same trap as Purify/Convergence/Sights Set.)
- 2026-06-01 (Purify): Collection as the **intake** of a standing-water purifier (draws dirty
  water in so Purify can separate the impurities).

**Appears in.** Purify · Billow Cluster (signs.md:117); also the Serpent's Bed of Sand Billow
Cluster (×4 around a Billow center).

---

### Sights Set  `sights_set`  ·  directional  ·  operator: target

> **Official name (World Guide 2026): Sign of Focus** — JP "aiming vector" = set/lock a target ([../world-guide-2026.md](../world-guide-2026.md)).

**Drawing.** A vertical line tipped with an **arrowhead at the top** and a small **diamond /
rhombus on the shaft** (mid/lower) — like a sighting reticle on an arrow. Bilateral about the
vertical axis; the arrow tip is the aiming front. Drawn top-outward (`defaultFacing:"outward"`).

**Acts as.** A `target` operator: the spell "is aimed at a chosen target (seemingly
mind-directed)" — it scopes *what* is affected to a point/target the caster picks. Along with
Puppet it is one of the only **mind-directed** signs (signs.md:163). Most likely
directional/semi-directional; never seen inverted (signs.md:163).

**Parameters.** Selects a target rather than a fixed compass direction; the chosen point is set
by the caster's mind, not purely by drawn angle. Size/orientation effects unconfirmed.

**Findings.**
- Canon uncertainty (signs.md:163): classification (directional vs. semi-directional) and exact
  mechanism are unconfirmed — flag this rather than asserting a precise geometry response.
- Facing caveat: drawn top-outward by default — an `inverted:true` export may just be that flag.
- Use (signs.md:163): on the Capture Pennant Spell it lets a knight pick a specific
  object/person for the pennants to wrap around (pairs with Entwine).

**Appears in.** Spiraling Flame · Capture Pennant Spell (signs.md:165).

---

### Gather  `gather`  ·  directional  ·  operator: support

> **Official name (World Guide 2026): Sign of Gathering** — JP "gathering vector" ([../world-guide-2026.md](../world-guide-2026.md)).

**Drawing.** A vertical line tipped with an **arrowhead at the top**, plus a smaller
**chevron/X crossing lower on the shaft** — visibly busier than Collection's plain X (an
"active" collection mark). Bilateral about the vertical axis; the arrow points the intake.

**Acts as.** A `support` operator: it "actively draws in surrounding material to feed the
spell" — a more active counterpart to Collection (signs.json; signs.md:197). Like Collection it
is useless alone and only supplies another operator. Either directional or semi-directional;
never seen inverted (signs.md:197).

**Parameters.** Orientation aims the intake; count scales supply. The presumed difference from
Collection is **active pull** vs. passive collection (unconfirmed, signs.md:197).

**Findings.**
- Canon uncertainty (signs.md:197): how Gather differs from Collection is unconfirmed — say so;
  treat "more active intake" as the working theory, not fact.
- 2026-06-01 (Vapor Bubble): two Gather signs in the outer ring **actively draw atmospheric
  vapor in** so the dew-still can chill it past the dew point — Gather as the intake stage of an
  air→water collection plant, running in water's cheap collect mode (sigils.md:41).

**Appears in.** Vapor Bubble Spell (signs.md:199).
