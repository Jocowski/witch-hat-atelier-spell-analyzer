# Asymmetric, Uncategorized & Unknown Signs

> **Asymmetric = no symmetry of any kind, and unpredictable.** Canon explicitly notes that
> asymmetric signs "are unpredictable and largely unknown. It is not known if inverting,
> mirroring, or angling them changes their behavior" ([../signs.md:26](../signs.md)). So unlike
> the other three families, you cannot read a front off an asymmetric sign's shape and steer it —
> their geometry knobs are *unconfirmed*, and the entries below honor that.
>
> This file also holds the signs the system **cannot yet name**: the `other` catch-alls (Bird,
> Animal Signs, the generic Unknown Sign) and the **catalogued-but-unidentified** marks
> (`unknown_01`…`unknown_05`, `unknown_07`, `unknown_08` — `unknown_06` was retired, reassigned to
> **Convergence** once its triangle was identified). For those the **Drawing** field is the most valuable thing on the
> page — when a sign's identity is the open question, its *shape* is the only reliable handle, and
> reasoning from shape (per [../CORE.md](../CORE.md) §3–§4) is exactly the skill these entries are
> meant to teach.

---

## Asymmetric signs

### Sign of Wind  `sign_of_wind`  ·  asymmetric  ·  operator: motion

**Drawing.** A small open loop/eyelet at the top trailing into a single tail that curves down
and sweeps off to one side — a stylized cyclone-with-a-tail (reads like a Greek "ρ" or a coiled
gust). No mirror axis; the loop is the "head," the tail the spiral's throw. Asymmetric: there is
no clean front, so its orientation cannot be reasoned about the way a directional sign's can.

**Acts as.** A `motion` operator — *"is set whirling into a spinning spiral"*, the **"whirlwind
keystone"** Agott names in Spiraling Flame, where it sets a column of flame spinning into a
spiral ([../signs.md:181](../signs.md)). **Not invertible.** This may not generalize: in the
Pegasus Carriage Spell the same sign appears to act as a plain **wind sigil** instead, not a spin
operator ([../signs.md:179](../signs.md)). So apply "whirlwind / spin" only where canon supports
it, and treat it as "unclear" otherwise.

**Parameters.** Unknown. Canon does not establish whether angling, mirroring, or inverting it
changes its effect ([../signs.md:26](../signs.md)); the spiral it produces in Spiraling Flame is
not measurable from geometry, so the engine cannot quantify the spin.

**Findings.**
- 2026-06-01: In Spiraling Flame it is the keystone that twists the flame column into a spiral
  (kind `motion`); in the Pegasus Carriage Spell it reads as a plain wind sigil — so **spin may
  not generalize**. The engine can't measure the spin. ([../signs.md:181](../signs.md))
- History: appeared only in ch.1 (sylph shoes, pegasus carriage), was suspected a retconned wind
  *sigil*, then re-confirmed canon by the vol. 12 bonus — so it is a genuine sign, not a sigil
  artifact. ([../signs.md:179](../signs.md))

**Appears in.** Spiraling Flame · Pegasus Carriage Spell ([../signs.md:183](../signs.md))

---

### Purify  `purify`  ·  asymmetric  ·  operator: special

**Drawing.** A tall hook/cane that curls over at the top and descends into a small open loop or
curl at the bottom — roughly a ")" with a terminal swirl. No symmetry axis. Traced top-outward,
so it carries `defaultFacing:"outward"` (the business end is at the **bottom** of the art) — an
exported `inverted:true` on it is often just that flag, not a deliberate flip (see Findings).

**Acts as.** A `special` operator — *"is purified, separating impurities out of the element."* It
pulls particulates/contaminants out of water, dust out of air, etc.; the separated matter then
**accumulates near the spell** ([../signs.md:319](../signs.md)). **Not invertible.** Precondition:
something to clean — it acts on a substance that is itself a suspension (dirty water, dusty air);
on a clean or solid substance it has nothing to separate. Frequently partnered with **Collection**
(intake) to make a continuous purifier.

**Parameters.** Unknown / unconfirmed, as with all asymmetric signs ([../signs.md:26](../signs.md)).
It is not modelled as steering a direction; the pile of removed impurities sits "near the spell"
rather than being aimed.

**Findings.**
- 2026-06-01: Purify + **Collection** = a standing **wastewater purifier**; the sewer-grate
  purifier and the Purify spell both use it. Pairs naturally with **water** because dirty water is
  a fluid suspension, and runs in water's cheaper collect/manipulate mode
  ([../sigils.md:41](../sigils.md)).
- 2026-06-01: Drawn **top-outward** (`defaultFacing:"outward"`) like collection / sights_set /
  convergence — so an export showing `inverted:true` may just reflect that flag, not an intended
  inversion. Check before reporting a flip.

**Appears in.** Purify (and the sewer-grate purifier) ([../signs.md:321](../signs.md))

---

## Uncategorized

> These keep `family:"other"` and stay **hidden from the palette**. Bird is a real `form`
> operator that simply has no doc-family; Animal Signs is decorative with no effect; the generic
> Unknown Sign is a placeholder for marks not yet isolated into their own numbered entry.

### Bird  `bird`  ·  other (form/creature)  ·  operator: form

**Drawing.** A schematic bird-in-flight: a central inverted-V body (two strokes from an apex down
to the wings), a pair of swept wing strokes on each side, and a small V/chevron tail at the
bottom — bilaterally symmetric about the vertical. It is a **surrounding** sign (`surrounds:true`):
the central sigil sits *inside* it, with the bird drawn around the core rather than beside it.

**Acts as.** A `form` operator — *"gathers into the shape of a bird that flies about"*: it
projects the glyph's magic as a **bird-shaped projection** that flies around for a while
([../signs.md](../signs.md), Bird of Light Beacon). It is a form/creature shape, **not** a
substance — it cannot supply its own element (a Bird over nothing has no material to shape). Used
as a decoy / mobile beacon. **Not invertible.**

**Parameters.** As a surrounding form it wraps whatever core it encloses; the substance is set by
that core (light → a bird of light, etc.). No aimed front.

**Findings.**
- It is `canBeCenter:false` despite surrounding the core — the core sigil supplies the substance;
  Bird only gives the flying shape. (Compare the `*_sigil` center-capable signs, which *can* stand
  in as the substance.)

**Appears in.** Bird of Light Beacon.

---

### Animal Signs  `animal_signs`  ·  other (decorative)  ·  operator: none

**Drawing.** A looping, paw-print-like decorative squiggle (a chain of small curved lobes) — the
animal motifs of the Zozah Peninsula. No functional front; purely ornamental.

**Acts as.** **No operator** (`kind:"none"`) — *"adds a decorative animal motif with no magical
effect."* It has **no practical use** and is a tradition "in decline" ([../signs.md](../signs.md)).
A no-effect mark: it does not change the substance, aim, intensity, or shape. **Not invertible.**

**Parameters.** None — it contributes nothing to the deduction.

**Findings.**
- Don't confuse with the **`horse` decorative *sigil***, which is a genuine substance/shape-giver
  with real utility (Water Horse). `animal_signs` is a *sign* with no effect; the decorative
  *sigils* (esp. Horse) are the exception that carries utility. (Water Horse, 2026-06-01.)

**Appears in.** (Decorative only; no functional canon spell.)

---

### Unknown Sign  `unknown_sign`  ·  other (placeholder)  ·  operator: unknown

**Drawing.** A generic placeholder glyph (an arch over a short stem with a detached dot below) —
**not** a faithful trace of any specific mark. It stands in wherever a spell contains a sign that
has not yet been deciphered *and* has not been isolated into its own numbered entry.

**Acts as.** `operator:"unknown"` — *"contributes an effect that has not yet been identified."*
Any spell containing it has a **necessarily incomplete deduced effect**; say so explicitly rather
than guessing ([../CORE.md](../CORE.md) §6).

**Parameters.** Undefined.

**Findings.**
- Once a specific, isolated unknown mark recurs or matters, give it its own numbered entry in
  family `unknown` (`unknown_NN`) — that supersedes this catch-all for that mark.

**Appears in.** Used as a placeholder in spells like Water Pen, Capture Pennant, etc.
([../spells.md](../spells.md)).

---

## Catalogued but unidentified

> **Family `unknown`** holds specific, isolated marks that appear in a canon spell but have **no
> name and no deciphered function** — each given a theory-neutral catalog number so evidence can
> accumulate across appearances ([../signs.md:331-339](../signs.md)). They are **visible** in the
> palette (unlike the `other` catch-alls). The analyzer treats each as effect-unknown and flags
> any spell using one as having an **incomplete deduced effect**.
>
> **For these entries the schema is shape-forward** — identity is the open question, so the
> *Drawing* is the primary handle and theories are stated *as theories, with confidence*.
>
> **Workflow to add a new unknown sign.** Drop `Unknown_NN.png` into
> `assets/images/signs/unknown/`, run `npm run vectorize:signs` (it auto-traces to id `unknown_NN`,
> scaled to fit the viewBox — no MAP edit needed), then add the `unknown_NN` entry to
> `data/signs.json` (family `unknown`) and an operator to `data/grammar.json`, and run
> `npm run unknown:report` to cross-reference its appearances for theorizing. (Add the signs.json
> entry *first* with a placeholder `svgPath`, then vectorize to fill it in.)

### Unknown Sign 1  `unknown_01`  ·  unknown  ·  operator: unknown

**Drawing.** A single **vertical stem** running top→bottom, crossed by several short horizontal
**rungs/bars** and a small flat crossbar near the middle, with a small filled lozenge (and a dot
or two) at the center — like a thin staff or ladder. Stored **upright** (top = top); it is
bilaterally narrow but not a clean mirror of itself.

**Seen in.** **Water Horse**, where it flanks the central water sigil as a **left/right pair**,
the two copies being **horizontal mirror images** of each other (placed with the editor's
**mirror** control, separate from invert).

**Theories.**
- *Directional (low confidence):* the front-to-front mirrored flanking placement is what a
  *directional* sign would do, but this is unconfirmed — seen in only one spell.
- Broader (with `unknown_02`): together the Water Horse unknowns may encode the **cohesion /
  locomotion / steering of the water-body** that lets the horse hold shape and pull loads — but
  what each individual mark contributes can't be separated from a single appearance.

**Findings.**
- 2026-06-01: First catalogued from Water Horse (water core + `horse` decorative *sigil*). The 5
  unknown signs there ⇒ engine flags "deduced effect incomplete"; a **second appearance** is
  needed before its role can be deduced. ([../signs.md:344-359](../signs.md))

---

### Unknown Sign 2  `unknown_02`  ·  unknown  ·  operator: unknown

**Drawing.** The simplest of the set: a **straight, slightly tapered vertical bar / line** — a
single thick stroke, no curve, no branches.

**Seen in.** **Water Horse**, along the **bottom row beneath the water sigil**, *alternating with
the Region (chevron) signs*.

**Theories.**
- *None firm.* A bare line interleaved with Region signs gives no shape-clue to lean on — it could
  be a spacer, a tie/connector between the chevrons, or a contributor to the water-body's
  cohesion. Marked `invertible:true` in data on the bare possibility that the line has ends, but
  this is unverified.

**Findings.**
- 2026-06-01: Catalogued from Water Horse; with one appearance there is no basis for what the line
  contributes. ([../signs.md:361-373](../signs.md))

---

### Unknown Sign 3  `unknown_03`  ·  unknown  ·  operator: unknown

**Drawing.** A **triangle / "A"-shape** (apex up) with a **horizontal crossbar** through it, and a
small **outward-recurving curl at each lower foot**. Bottom-heavy, ground-like; reads decorative.

**Seen in.** **Water Pen**, a **single copy at the bottom of the seal**, below the central water
sigil — *not* a mirrored pair.

**Theories.**
- *Nib-shaper (very low confidence):* in Water Pen it sits where the dagger/pen-nib glob's
  downward point hangs, so it *might* shape the nib's tip — but this is one spell and unconfirmed.
- The single, bottom-centered placement gives **no evidence** that orientation or inversion
  matters (no opposing copy to compare against).

**Findings.**
- 2026-06-01: Catalogued from Water Pen (a water **tool** spell, not a weapon). Reads as
  decorative; 3 unknown signs in that spell ⇒ shape/hover unresolved.
  ([../signs.md:375-388](../signs.md))

---

### Unknown Sign 4  `unknown_04`  ·  unknown  ·  operator: unknown

**Drawing.** An **arc** — a tall, shallow-S segment of a large circle's perimeter, **convex
bulging to one side** (as stored, convex-left), with a small dot near its lower tip. It traces a
**body's outward-bulging flank** (the convex faces *away* from the core when paired). Stored
**upright**; the two copies in a seal are **horizontal mirror images** (mirror control, not
invert).

**Seen in.** **Water Pen**, as a **left/right mirrored pair enclosing the central water sigil** —
the two arcs hug the flanks of the dagger/pen-nib glob.

**Theories.**
- *Directional or enclosing (low confidence):* the front-to-front mirrored pair hugging the core
  is consistent with a directional or enclosing sign, unconfirmed (one spell).
- *Body-shaper:* the arcs trace the curved flanks of the nib glob, so they *may* shape its body —
  unconfirmed.
- **Distinct from `unknown_05`:** this arc's convex bulges *outward* (away from the core); the
  Sand Cage half-circle's convex faces *toward* the core — **opposite concavity**, so they likely
  encode different roles. Do not conflate them.

**Findings.**
- 2026-06-01: Catalogued from Water Pen; pairs with the Dispersion + Columns at the top that meter
  the brush. Needs a second appearance to pin its function.
  ([../signs.md:390-405](../signs.md))

---

### Unknown Sign 5  `unknown_05`  ·  unknown  ·  operator: unknown

**Drawing.** A clean **half-circle** (semicircular arc), drawn as a **dome / inverted-U open at
the bottom**. Crucially, its **convex (closed) side faces the core** and its **open mouth faces
outward** toward the ring — it curves *around* the core's poles rather than capping an outer shell.

**Seen in.** **Sand Cage** (Tetia's spell to cage the Scalewolf Euini), as a **top/bottom pair at
the seal's north and south points**, on the vertical axis **just outboard of the inverted Crush
signs** (between them and the ring) — sitting exactly at the two poles the side Column "bars" leave
uncovered. The two copies are horizontal mirror images of each other.

**Theories (unconfirmed).**
- *Closing hoop / band (moderate):* the top and bottom rings that bind the side Column "bars" into
  a closed, **rigid** cage frame (like the hoops of a barrel or birdcage) — turning open bars into
  a sealed enclosure. Fits Sand Cage's "rigid cage" result.
- *Inward-recurving lip / anti-escape (moderate):* the cage wall folding back inward at the poles
  (like the recurved rim of a jar) to seal the weak top/bottom points so a struggling captive
  can't push out — consistent with caging the thrashing Scalewolf.
- **NOT the same sign as `unknown_04`:** that arc's convex bulges *outward*; this one's convex
  faces the core — **opposite concavity** ⇒ likely different roles.
- *Low confidence overall:* seen in **one spell only** (Sand Cage); the wiki lists it as
  function-unknown. A second appearance is needed to confirm.

**Findings.**
- 2026-06-01: Catalogued from Sand Cage (earth, rigid sibling of the Serpent's Bed of Sand). Runs
  in earth's manipulate-not-create mode ([../sigils.md:53](../sigils.md)); the cage is temporary
  (inverted Crush). The new-unknown-sign workflow was validated here (add signs.json entry first,
  drop the PNG, `vectorize:signs`). ([../signs.md:407-429](../signs.md))

> **`unknown_06` (retired).** The Phantasmal Fireball's large downward triangle was first
> catalogued as `unknown_06`, then identified as **Convergence** (`convergence`, a downward
> triangle ▽ — *focuses/concentrates + stiffens*) framing the Unburning Flames sigil to hold the
> heatless flame into a dense, contained body. The id was removed; see Convergence in
> [signs-semi-directional.md](signs-semi-directional.md).

### Unknown Sign 7  `unknown_07`  ·  unknown  ·  operator: unknown

**Drawing.** Two short **horizontal parallel bars** — an **"="** shape — drawn as strokes
(`M-38 -10 L38 -10 M-38 10 L38 10`). Hand-authored clean vector; **do not re-trace** the crop.

**Seen in.** **Phantasmal Fireball**, filling the gaps **between the radiating arms**, inside the
ring (a small, evenly repeated mark).

**Theories (unconfirmed).**
- *Possibly related to [Unknown Sign 2](#unknown-sign-2--unknown_02--uncategorized--operator-unknown)
  (`unknown_02`), the single **line**-shaped sign* — this may be a **doubled** variant, or a
  distinct double-line keystone. Unconfirmed.
- *Filler / balancing or reinforcement (low):* evenly spaced marks that keep the radial layout
  symmetric/stable, or a repetition of whatever the single line encodes.
- *Low confidence:* one spell only.

**Findings.**
- 2026-06-01: Catalogued from Phantasmal Fireball. Cross-reference `unknown_02` (the line) if a
  second appearance clarifies whether "line" and "double line" are the same family.

### Unknown Sign 8  `unknown_08`  ·  unknown  ·  operator: unknown

**Drawing.** A small **circle with one half solid-filled** and the other half left as an open
outline (a **◐**), drawn filled with `fill-rule:evenodd` (a thin ring + a filled left semicircle).
Hand-authored clean vector; **do not re-trace** the crop.

**Seen in.** **Phantasmal Fireball**, as **three external marks OUTSIDE the main ring**, each
tethered to it by a short connecting stem.

**Theories (unconfirmed).**
- *External mark / tuning node (moderate):* like the solid satellite dots (●) on other seals
  (e.g. Sand Cage), but the **half-fill** may encode a state (half/on) or a paired/toggle
  relationship among the three — not a core-shaping keystone.
- *Low confidence:* one spell only.

**Findings.**
- 2026-06-01: Catalogued from Phantasmal Fireball. Distinct from the fully-solid external dots.
  When composing, place these in the **outside** zone (radius beyond the ring band) so the engine
  treats them as external marks, not aim/symmetry drivers.
