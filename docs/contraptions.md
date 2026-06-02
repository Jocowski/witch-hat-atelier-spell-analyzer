# Contraptions — multi-spell devices

> Spells combine into **devices**. A contraption is more than one seal (or one seal with
> special activation structure) working together: nested, linked, toggled, or inter-ring. This
> is the assembly layer above a single circle. The IR for it is [IR.md](IR.md) §5 (v2 circles +
> `relations`); the canon mechanics are in [magic.md](magic.md) and [../data/rules.json](../data/rules.json)
> (`mechanics`). Reason about each circle with [CORE.md](CORE.md), then combine along the
> structure below.

## The four assembly patterns

### 1. Nested glyphs (a seal inside a seal)
An inner circle sits inside an outer one. **Canon rule:** the inner only takes effect once the
**outer** ring is closed (the nested-glyph rule). Two coreless-ring sub-cases the engine
recognizes:
- **Boundary ring** — an *empty* enclosing ring = a chamber wall, not an explosion. (It encloses
  others; it has no signs of its own.)
- **Modifier ring** — a coreless ring *with signs* that shapes the seal(s) it encloses/links to,
  rather than carrying its own substance.

*Use it for:* a substance basin wrapped by a shaping plant; a containment shell around an
effect; staging (prepare inner, arm by closing outer).
*Canon:* Serpent's Bed of Sand (7 circles), Vapor Bubble (water basin + air-conditioning ring),
Cloak Spell.

### 2. Linked seals (joined by a line)
Two or more seals connected by a drawn line **combine their effects**. Several *identical*
linked seals **stack power beyond** a single larger seal of the same area (Raincleaver). The
IR models this as a `link` relation, or loosely as `linkCount` on a circle.

*Use it for:* scaling power past what one seal can do; distributing one effect across positions;
chaining different effects in sequence.
*Canon:* Raincleaver (many small linked rain seals).

### 3. Toggled seals (split ring)
A single ring is drawn across **two separate objects**; the spell activates when the halves
touch (the ring closes) and deactivates when they part. This is an on/off switch built from
geometry, not a sign. Not yet first-class in the IR — model as two circles whose union closes a
ring, and describe in prose.

*Use it for:* anything that must switch on contact/proximity; wearable or door spells.
*Canon:* Sylph Shoes Seal, Glowstone Path.

### 4. Second / inter-ring spell (double ring)
A seal wrapped by a second concentric ring, with the space **between the rings** filled by
another spell — combining effects even across different objects.

*Use it for:* layering an outer modifier/persistence band around a core effect.
*Canon:* see magic.md (ring) / advanced mechanics.

## Reading a contraption (procedure)
1. **Decompose** into circles; classify each (cored seal, boundary ring, modifier ring).
2. **Reason each circle** independently with CORE.md (substance × operators × geometry).
3. **Combine along relations:** nest → outer wraps inner (inner gated by outer ring); link →
   effects combine / identical stack; toggle → activation switch; inter-ring → outer band modifies core.
4. **Trace the flow:** in feeder/cluster designs, satellites *supply* a central transmuter
   (e.g. Wall-Breaker satellites mill rock → a central Billow cluster fluffs it → an outer
   Repetition wrap makes it persist). Name the production line.
5. **Check feasibility end-to-end:** the whole device inherits the strictest substance
   constraint (a manipulate-substance device still needs a real source somewhere in the chain).

## Special hardware: glaives
**Glaives** are claw-like protrusions (not signs or sigils) that set **how deeply** the magic
embeds into a target's flesh — used in memory erasure and slime rendering. Because they act on
the body, glaive spells are **forbidden magic** (only Memory Erasure is permitted). Flag any
glaive device as forbidden.

## Building one (IR)
Each circle is a normal seal ([IR.md](IR.md) §2) with its own `center`/`radius`; wire them with
`relations` (§5). Render the whole device with `node tools/render.mjs device.json -o device.svg`
and read its facts with `node tools/spell-engine-cli.mjs --facts device.json` (the engine
reclassifies coreless boundary/modifier rings so the device validates in context).
