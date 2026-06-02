# IR.md — the `wha-spell` intermediate representation

> The **shared language** of the project. A spell is drawn by a human and reasoned about by
> the AI; this JSON is what both sides compile to and from. The GUI emits it (Export), the
> GUI reads it (Import), [tools/render.mjs](../tools/render.mjs) turns it back into a picture,
> and [tools/spell-engine-cli.mjs](../tools/spell-engine-cli.mjs) parses it into facts. If you
> are the AI emitting a spell for the user, **emit this** — they can render or import it.

See also: [CORE.md](CORE.md) (what the parts *mean*), [lexicon/](lexicon/) (how each symbol is
*drawn*), [../ANALYSIS.md](../ANALYSIS.md) (engine internals).

---

## 1. Two versions, one model

- **`wha-spell@1`** — a single seal: one ring, one core, a flat list of components. The
  original and still the common case.
- **`wha-spell@2`** — a *spell device*: an array of circles plus a `relations` graph that
  nests / links / toggles them (contraptions: nested glyphs, linked seals, split rings).

The engine **normalizes v1 → v2 internally** ([src/engine/compose.js](../src/engine/compose.js)
`toComposition`): a v1 composition becomes a single circle `k0`. So everything below is
described in v2 terms; a v1 spell is just the one-circle special case.

A full app export wraps the composition:

```json
{ "format": "wha-spell@1", "version": 1, "composition": { /* … */ } }
```

Both the wrapper and a bare composition are accepted by the CLI and the renderer.

---

## 2. The circle (a single seal)

```jsonc
{
  "id": "k0",                       // unique within the spell
  "name": "",                       // optional label (shown above the ring)
  "center": { "x": 0, "y": 0 },     // circle center in spell-space px (v1 ⇒ {0,0})
  "radius": 170,                    // ring radius px; null ⇒ derived from ring.size
  "ring": { "closed": true, "size": "medium" },  // activation; size ∈ small|medium|big
  "core": { /* glyph */ } ,         // the substance — a sigil (or center-capable sign) | null
  "components": [ /* glyph, … */ ], // signs (and extra sigils) around the core
  "dyes": ["blood"],                // magical dyes mixed into THIS circle's ink
  "linkCount": 0,                   // # of identical linked copies (power bonus)
  "inkColor": null                  // display-only ring tint; ignored by reasoning
}
```

### The glyph (a placed sigil or sign)

```jsonc
{
  "id": "s1",                 // unique within the circle
  "type": "column",           // a real id from data/sigils.json or data/signs.json
  "role": "sign",             // "sign" | "sigil" (core omits role; it IS the core)
  "x": 0, "y": -150,          // position px, RELATIVE TO THE CIRCLE CENTER
  "rotation": 0,              // degrees; tilts the symbol → can spin/aim the effect
  "scale": 1,                 // size; bigger = stronger and pulls balance/aim its way
  "inverted": false,          // flips top↔bottom (negate Y) AND, if invertible, the effect
  "mirrored": false,          // flips left↔right (negate X) — VISUAL ONLY, ignored by engine
  "color": null,              // display-only override
  "anchor": { "ring": true, "angle": 90, "offset": 0 }  // optional: pin to the ring (see §4)
}
```

> **`type` must be a real id.** Region's id is `direction`, Billow's is `billowing`, Puppet's
> is `dancing_puppet`. The CLI lists `unknownIds` if a `type` is unrecognized — check it.

---

## 3. Coordinates & geometry conventions

These are load-bearing — the engine and renderer both depend on them:

- **Cartesian px, origin at the circle center, `y` is DOWN** (SVG convention).
- **Angle 0° = north, increasing clockwise.** `toPolar(x,y) = atan2(x, -y)`.
- A ring radius is ~170px (medium). Signs typically sit at radius ~120–200.
- **Zones** (distance ÷ radius): `inside` (≤0.85), `ring` (0.85–1.05), `outside` (>1.05).
  Signs in the `outside` zone are **external marks** — they frame the seal but do NOT steer
  aim/symmetry/balance or the core effect.

### Placing N signs evenly (balanced ring)

For sign `i` of `N` at radius `r`: `θ = i·360/N`, then `x = r·sin(θ°)`, `y = -r·cos(θ°)`.
Even spacing ⇒ radial symmetry ⇒ stable, straight-up effect. Enlarge one sign (`scale`) or
move it off-axis to deliberately aim.

---

## 4. Ring-anchored components (`anchor`)

Instead of raw `x,y`, a component may pin to the ring: `anchor: { ring:true, angle, offset }`
(`angle` deg 0=N CW; `offset` px in/out from the ring). The engine resolves it to `x,y` from
the circle's radius (`anchorToXY`), so a pinned sign tracks the ring when the circle is
resized. The anchor round-trips; the resolved `x,y` is what geometry/zones read.

---

## 5. Relations (v2 — contraptions)

```jsonc
"relations": [
  { "type": "nest", "outer": "k0", "inner": "k1" },        // k1 sits inside k0
  { "type": "link", "a": "k0", "b": "k2" }                 // two seals joined by a line
]
```

- **`nest`** — an inner circle inside an outer one. Canon "nested-glyph rule": the inner only
  takes effect once the **outer** ring is closed. A coreless ring that *encloses* others is a
  **boundary ring** (a chamber wall, not an explosion); a coreless ring *with signs* that
  encloses/links cored circles is a **modifier ring** (shapes what it wraps). See
  `reclassifyCorelessCircles` in compose.js.
- **`link`** — connected seals combine; several *identical* linked seals stack power beyond a
  single larger seal of the same area (Raincleaver). `linkCount` on a circle models this
  loosely without drawing the copies.
- **Endpoints** may be a circle id or a component id.

Not yet first-class in the IR (model loosely / note in prose for now): **split-ring toggling**
(a ring drawn across two objects), **second/inter-ring spells**, and **glaives** (claw
protrusions that set how deep magic embeds into flesh — body magic, forbidden).

---

## 6. Minimal examples

**v1 — Watershot (water core + 8 even columns):**

```json
{ "format": "wha-spell@1", "composition": {
  "name": "Watershot Seal",
  "ring": { "closed": true },
  "core": { "id": "c0", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
  "components": [
    { "id": "s0", "type": "column", "role": "sign", "x": 0,    "y": -150, "rotation": 0,   "scale": 1, "inverted": false },
    { "id": "s1", "type": "column", "role": "sign", "x": 106,  "y": -106, "rotation": 45,  "scale": 1, "inverted": false }
  ],
  "linkCount": 0, "dyes": []
} }
```
(…six more columns at 90/135/180/225/270/315°.)

**v2 — a nested seal (inner substance circle inside an outer modifier ring):**

```json
{ "format": "wha-spell@2", "name": "Vapor Bubble Spell",
  "circles": [
    { "id": "k0", "center": {"x":0,"y":0}, "radius": 110, "ring": {"closed": true},
      "core": { "id": "c0", "type": "water", "x":0, "y":0 }, "components": [] },
    { "id": "k1", "center": {"x":0,"y":0}, "radius": 220, "ring": {"closed": false},
      "core": null, "components": [ /* wind sigils + gather/column/cool signs */ ] }
  ],
  "relations": [ { "type": "nest", "outer": "k1", "inner": "k0" } ]
}
```

---

## 7. Tooling round-trip

```bash
node tools/render.mjs spell.json -o spell.svg     # IR → picture (AI → human)
node tools/spell-engine-cli.mjs --facts spell.json # IR → structured facts (for the AI)
node tools/spell-engine-cli.mjs --text  spell.json # IR → human-readable heuristic report
```

The GUI's Export/Import is the human↔IR half. Together they make the IR the single shared
language: a human draws → IR → the AI reasons; the AI emits IR → render → a human sees it.
