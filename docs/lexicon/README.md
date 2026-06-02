# The Symbol Lexicon

> **What this is.** One structured entry per sigil and sign, describing **how it is drawn**
> (in geometric primitives — lines, arcs, dots, circles), **what it does** (as an operator on
> a substance — see [../CORE.md](../CORE.md)), and the **accumulated findings** about it from
> real analyses. It gives the reasoning core a vocabulary for symbol *construction* — so you
> can reason about an unfamiliar or **unknown** sign from its shape, the way a witch would.
>
> The opaque `svgPath` strings in [../../data/signs.json](../../data/signs.json) are
> machine art (potrace); **this** is the human/AI-readable description of the same symbol.

## Files

- [substances.md](substances.md) — all sigils (the substances), by family.
- [signs-directional.md](signs-directional.md) — directional signs (have a front; angle/size steer).
- [signs-semi-directional.md](signs-semi-directional.md) — semi-directional (invertible; size = strength).
- [signs-non-directional.md](signs-non-directional.md) — non-directional (radial; not invertible).
- [signs-asymmetric.md](signs-asymmetric.md) — asymmetric (unpredictable) + uncategorized/unknown signs.

## Entry schema

Each symbol gets one entry. Keep it tight and grounded — cite [../signs.md](../signs.md) /
[../sigils.md](../sigils.md) by `file:line` for canon claims; flag uncertainty rather than
inventing it.

```markdown
### Display Name  `id`  ·  <category/family>  ·  operator: <kind>

**Drawing.** How it's constructed from primitives: the strokes (line / arc / dot / circle /
curve), roughly how many and how arranged, its symmetry class (radial / bilateral about which
axis / none), and **where the "front" / business-end points** (the part that aims or acts).
One or two sentences — enough that someone could sketch it and that you could match an unknown
sign to it by shape.

**Acts as.** The operator kind and what it does to a substance; note `invertible` and what
inversion flips it to; any precondition (a partner sign / a real source) and failure mode.

**Parameters.** What its geometry knobs change here (angle, size, quantity, position, tilt).

**Findings.** Accumulated, dated nuances from analyses (canon corrections, engine artifacts to
override, per-substance behavior). Newest first. This is where ingested knowledge lands.

**Appears in.** A few canon spells that use it (from signs.md "Spells Using…").
```

## How knowledge accumulates here (the feedback loop)

This lexicon is the **per-symbol dossier**. When an analysis teaches something durable about a
sign or sigil — a canon correction, an engine blind spot to override, how it behaves on a new
substance — append a dated one-liner to that symbol's **Findings**. Over time the entry for,
say, `convergence` accumulates every role it has played (compactor on earth, intake on water),
so the *next* spell using it is easier to read. See [../INGESTION.md](../INGESTION.md) for the
full workflow and how this relates to the skill `learnings.md` logs.
