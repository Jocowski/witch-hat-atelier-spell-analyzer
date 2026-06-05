# SPEC — Stroke beautify (QuickShape-style shape snapping + smoothing)

> Status: **done - shipped** (Phases 1–3) · Scope: **Studio drawing tools (pure geometry + UI)**
> Branch: `feat/spell-studio-experiments` · Cross-refs:
> [src/studio/tools/shapes.js](../../../../src/studio/tools/shapes.js) (clean-shape emitters — reused),
> [src/studio/DrawingSurface.jsx](../../../../src/studio/DrawingSurface.jsx) (`commitStroke` — the hook point),
> [src/studio/ToolDock.jsx](../../../../src/studio/ToolDock.jsx) (toolbar — Beautify button + toggle),
> [src/draw/recognizer.js](../../../../src/draw/recognizer.js) ($P classifier — optional shared classification),
> [src/draw/ringClosure.js](../../../../src/draw/ringClosure.js) (closure heuristic — reused).

## The problem

When the user draws a circle freehand it comes out wobbly; a triangle has wiggly edges; a
straight line drifts. They want the app to **clean it up** — snap a wobbly circle to a *perfect*
circle, a shaky triangle to clean straight edges, a drifting line to a true segment — while
**leaving genuinely freeform strokes alone**. This is exactly **Procreate's QuickShape**
(snap-to-shape) plus **Streamline** (jitter smoothing). The user wants it as a **user-controlled
toggle**, not a forced behavior: *they* decide whether to use it.

## What the app already owns (so we build, not adopt)

The hard parts already exist in the codebase — beautify is a thin transform on top:

- **Clean-shape emitters** — [shapes.js](../../../../src/studio/tools/shapes.js) already turns
  parameters into perfect point arrays: `circle(center, r)`, `ellipse(a, b)`, `triangle(a, b)`,
  `rect(a, b)`, `line(a, b)`. Beautify *re-uses these* to regenerate the clean stroke.
- **A shape classifier** — the `$P` recognizer ([recognizer.js](../../../../src/draw/recognizer.js))
  already understands stroke shapes; closure logic lives in
  [ringClosure.js](../../../../src/draw/ringClosure.js).
- **A simple stroke model** — `{ tool, color, width, points:[{x,y}] }`
  ([drawingModel.js:17](../../../../src/studio/drawingModel.js#L17)). Beautify is `points → points`;
  nothing else in the model changes.
- **A single commit funnel** — every drawn stroke (brush *and* shapes) lands in
  `commitStroke(points, toolName)` ([DrawingSurface.jsx:521](../../../../src/studio/DrawingSurface.jsx#L521)).
  Auto-beautify hooks **one place**.
- **Undo/redo** — `maybeSnap()`/`snapshot()` already wraps each stroke as one history step, so
  beautify is automatically undoable; that is the safety net that lets us *replace* points instead
  of storing a second raw copy.

Decision: **build a small pure module**, not adopt a framework. rough.js/fabric/paper would
duplicate the classifier and the shape emitters we already have. The only outside ideas worth
borrowing are two well-known algorithms (below), which are short enough to inline.

## Design

### Module — `src/studio/tools/beautify.js` (PURE)

Same discipline as `shapes.js`/`geometry.js`: **no JSON imports, no DOM, no React** — runs under
`node --test`. Self-contained (no new npm dependency); the two algorithms it needs are implemented
inline (~40 lines total), keeping with the repo's low-dependency, pure-module ethos:

- **Ramer–Douglas–Peucker (RDP)** polyline simplification → reduces an N-point wiggle to its real
  corners. (Reference impl: [simplify-js](https://mourner.github.io/simplify-js/); we inline it to
  stay dependency-free and `{x,y}`-native.)
- **Kåsa least-squares circle fit** → `{cx, cy, r}` in linear time, no iterative solver.
  (Reference impl: [circle-fit](https://github.com/Meakk/circle-fit).)

> Alternative if we'd rather not inline: add `simplify-js` + `circle-fit` as deps (~5 KB total).
> Recommendation is **inline** — both are tiny, it avoids a 6-year-stale transitive dep, and it
> keeps the module trivially testable. Revisit only if Phase 3 wants paper.js Bézier smoothing.

#### Public API

```js
// beautifyStroke(points, opts?) → { points, kind, confidence }
//   points:     [{x,y}]  the regenerated clean stroke (or the ORIGINAL when nothing fits)
//   kind:       'circle' | 'ellipse' | 'triangle' | 'rect' | 'polygon' | 'line' | 'smoothed' | 'none'
//   confidence: 0..1     fit quality; below opts.minConfidence ⇒ kind 'none' (or 'smoothed')
//
// opts = {
//   minConfidence = 0.7,   // gate — mirrors recognition.confidenceMinPct philosophy
//   smoothFallback = true, // when no shape fits, apply Chaikin smoothing instead of leaving raw
//   tolerance,             // RDP epsilon; default adaptive ≈ 2.5% of stroke bbox diagonal
// }
export function beautifyStroke(points, opts) { /* … */ }
```

#### Classification → fit pipeline

1. **Guard** — fewer than ~4 points, or near-zero bbox ⇒ return original (`kind:'none'`).
2. **Closure** — closed if `dist(first, last)` is small vs. bbox diagonal (reuse ringClosure idea).
3. **Simplify** — RDP at adaptive tolerance → `corners[]`.
3b. **Ring gap is sacred (topology-preserving).** A closed ring *activates* the spell; an open
   ring is a *prepared* (uncast) spell. So circle detection runs **independently of the closed
   flag**: fit a circle, measure the angular coverage (`arcGeometry`), and if the drawn stroke
   leaves a wedge ≥ `gapPreserveDeg` (default 16°) it snaps to a clean **open arc** (`kind:'arc'`)
   that keeps the gap — it is *never* force-closed. A near-closed loop (tiny gap) becomes a perfect
   closed circle. This means beautify preserves the caster's intent: a gapped ring stays gapped, so
   downstream ring-closure detection still reads it as open (prepared).
4. **Dispatch on (closed?, corner count):**
   | closed | corners | → kind | fit |
   |--------|---------|--------|-----|
   | yes | ~0–2 (smooth loop) | **circle / ellipse** | Kåsa circle fit; if residual high but axis-aligned-ish, use `ellipse(bbox)`. Circle vs ellipse: aspect ratio of bbox. |
   | yes | 3 | **triangle** | `triangle()` from the 3 corners (or bbox triangle) |
   | yes | 4 | **rect** | `rect(bbox)` (axis-aligned) — later: rotated via min-area box |
   | yes | 5+ | **polygon** | regular N-gon through corners (centroid + mean radius) |
   | no | 2 | **line** | `line(first, last)` |
   | no | 3+ | freeform open | smoothing fallback |
5. **Confidence** = goodness-of-fit (mean residual of original points to the regenerated shape,
   normalized by bbox diagonal → `1 - error`). Below `minConfidence`:
   - `smoothFallback:true` ⇒ **Chaikin smoothing** (~15 lines, no dep) → `kind:'smoothed'`
     (Streamline-style: de-jitter without forcing a shape).
   - else ⇒ return original, `kind:'none'`.
6. **Preserve metadata** — caller keeps the stroke's `tool/color/width/dyeId`; only `points` change.
   (Beautify returns points; `commitStroke`/the button re-wraps them into the existing node.)

Pure helpers to add (all testable): `closedness(points)`, `rdp(points, eps)`,
`fitCircle(points)`, `polygonResidual(points, shape)`, `chaikin(points, iters)`.

### UI — ToolDock + DrawingSurface

Two triggers share the one function (matches Procreate: QuickShape *and* a manual path):

1. **Auto-beautify toggle** (the user's ask — *they* decide). A switch in
   [ToolDock.jsx](../../../../src/studio/ToolDock.jsx), in its own section near the tool groups.
   - **Off (default)** → `commitStroke` behaves exactly as today (raw ink). Zero behavior change.
   - **On** → in `commitStroke`, before building the node, run `beautifyStroke(points)`; if
     `kind !== 'none'`, substitute the returned points. Still **one** undo step (the hook is inside
     the existing `maybeSnap()` path). Brush *and* shape tools both pass through here, so a
     brush-drawn circle snaps too.
   - Persist the toggle like other Studio prefs (localStorage / settings), default **Off** so the
     app is unchanged until the user opts in. Surface it to `ToolDock` via props
     (`autoBeautify`, `setAutoBeautify`) from `StudioPage`/the parent that owns Studio state.
3. **"Beautify" button** (manual, works even with the toggle Off). Cleans the **currently selected**
   stroke(s); if none selected, optionally the last stroke. Maps each through `beautifyStroke`,
   replaces points in place, one undo step. Lives next to the Select group; keyboard shortcut
   (proposed **Q** for QuickShape — verify it's free in DrawingSurface's keydown map).

Both triggers are no-ops on placed symbols and on eraser/transform tools — beautify only touches
`kind:'stroke'` nodes.

### Data / model impact

**None to the persisted format.** Strokes stay `{tool,color,width,points}`; beautify only rewrites
`points`. No migration, no schema change. Because the toggle gates it and undo backs it, we
**replace** points rather than storing raw+clean copies (simpler; clean strokes also *improve*
Detect accuracy and yield cleaner training samples — a virtuous loop with the recognizer).

## Phasing

- **Phase 1 — core + manual button (this branch).**
  `beautify.js` + unit tests; **Beautify** button in ToolDock operating on selection; one undo step.
  Ship the **Auto-beautify toggle** here too (it's just "call the same fn in `commitStroke`").
  Default Off. *This is the whole user request.*
- **Phase 2 — QuickShape hold-to-snap (optional polish).**
  Detect a pause-at-end on `pointerup` and auto-run beautify even with the toggle off; show a
  "snapped to ellipse → tap for perfect circle" refine affordance. Same `beautifyStroke`.
- **Phase 3 — live Streamline (optional).**
  Real-time jitter stabilization while drawing (per-stroke). This is where paper.js
  `path.simplify()` Bézier fitting could earn a dependency. Skip until needed.

## Testing (`node --test`, pure)

`test/beautify.test.js`:
- wobbly circle (sampled circle + noise) → `kind:'circle'`, recovered `r`/center within tolerance.
- shaky triangle → `kind:'triangle'`, 3 corners.
- drifting line → `kind:'line'`, endpoints preserved.
- ellipse (non-equal radii) → `kind:'ellipse'`, not forced to circle.
- genuine squiggle → `kind:'smoothed'` (with fallback) or `'none'` (without); **never** a wrong
  shape (no false positives — the confidence gate is the contract).
- degenerate inputs (< 4 pts, zero bbox, duplicate points) → original returned, no throw.
- **purity**: module imports no JSON/DOM (so the suite stays green under plain Node).

Manual (add a row to [TEST-PLAN.md](../../TEST-PLAN.md)): toggle On → draw shapes → they snap, one
Ctrl+Z reverts to raw; toggle Off → raw; Beautify button cleans selection; placed symbols
untouched; Detect still works on beautified strokes.

## Implementation status (shipped on `feat/spell-studio-experiments`)

- **Core** — [src/studio/tools/beautify.js](../../../../src/studio/tools/beautify.js): pure
  `beautifyStroke(points, opts) → {points, kind, confidence}` with inline RDP, angle-based corner
  filtering, Kåsa circle fit, and Chaikin fallback; reuses `shapes.js` emitters. Exports
  `rdp`, `fitCircle`, `chaikin`, `filterCornersByAngle` for testing.
- **Tests** — [test/beautify.test.js](../../../../test/beautify.test.js): 13 cases (circle/ellipse/
  triangle/rect/line snapping, no-false-positive gate, degenerate inputs, purity). Full suite
  387/387 green; lint clean; production build OK.
- **Phase 1** — Auto-beautify toggle + Beautify button + **Q** hotkey in
  [ToolDock.jsx](../../../../src/studio/ToolDock.jsx) (new "Assist" section, props optional). Wired in
  [DrawingSurface.jsx](../../../../src/studio/DrawingSurface.jsx): `commitStroke(pts,'brush',{beautify})`
  snaps freehand strokes; `beautifySelected()` cleans the selection (or last stroke) as one undo
  step. Prefs persist in localStorage (`studio.beautify.auto`, default **Off**).
- **Phase 2** — QuickShape hold-to-snap: pausing ≥ `HOLD_SNAP_MS` (450 ms) at the end of a brush
  stroke snaps it even with Auto off (no movement ⇒ time accrues on `lastMoveRef`).
- **Phase 3** — Streamline: a **Smooth** toggle applies a live EMA jitter filter to brush input
  (`STREAMLINE_ALPHA`); dependency-free (no paper.js needed).
- **Organic glyphs (spiral / repetition etc.)** — no primitive fits them, so snapping is wrong.
  The **manual Beautify button** runs with `smoothFallback: true` ⇒ such strokes are *smoothed*
  (`kind:'smoothed'`) rather than left raw; **Auto stays snap-only** (`smoothFallback: false`) so it
  never forces a doodle into a shape. Canon-perfect cleanup of a *named* glyph remains the job of
  **Detect → canonical SVG** (carrying `scale`/`rotation`/`metrics`, per the variant note below).
- **Identified-symbols panel actions** ([IdentifiedPanel.jsx](../../../../src/studio/IdentifiedPanel.jsx)):
  - **✦ Smooth** (per row) + **✦ Smooth all** (header) — clean a recognized symbol's *actual drawn
    strokes* **in place** (snap to a clean shape if one fits, else de-jitter), keeping the drawn
    size/style/position. *No SVG swap* — it does **not** replace the ink with the canonical glyph
    (that flattens size/variant). Implemented via `DrawingSurface.smoothStrokes(strokeRefs)`, which
    matches the group's source strokes (by reference/endpoints) and runs `beautifyStroke` with
    `smoothFallback: true`. One undo step. Manual-only.
  - **⊕ Train** (per row) — feed this drawing to the training set under its *current* recognized
    label, no relabel needed (`source:'drawn'`, weight 1.0). Complements the Edit→relabel
    (`corrected`, 1.5) and catalog-gated Contribute (`confirmed`, 0.6) paths.
  - **Hover glow** — hovering/focusing a row highlights the matching drawing on canvas via a new
    `highlight` prop on DrawingSurface (a glowing Konva `Rect` on the overlay layer at the group's /
    placed symbol's bbox), and emphasizes the row itself (`.identified-row:hover`). Lets the user
    see *where* each listed symbol is.
- **Close-the-ring weld (cross-stroke)** — `weldsRingGap(arcPts, bridgePts, opts) → circle | null`
  (pure, exported, tested): when a freshly committed stroke bridges the two open ends of an existing
  **open ring**, [DrawingSurface.jsx](../../../../src/studio/DrawingSurface.jsx) `commitStroke` replaces
  the arc + bridge with one **closed circle** (one undo step) — the closing gesture *casts* the
  prepared spell. Gated by the Auto-beautify flag (or a hold), keeping the "Auto off ⇒ nothing
  changes" contract. Reuses `fitCircle`/`arcGeometry`; no per-stroke metadata needed (recomputed).

## Open questions

1. **Default tolerance / aggressiveness** — one fixed adaptive epsilon, or a small "snap strength"
   slider later? Start fixed.
2. **Rotated rectangles** — Phase 1 is axis-aligned (`rect(bbox)`); rotated needs a min-area box.
   Defer unless it looks bad in practice.
3. **Shared classifier** — reuse `$P` for classification vs. the lightweight corner-count heuristic?
   Corner-count is simpler and dependency-light for Phase 1; revisit if accuracy is poor.
4. **Hotkey** — confirm **Q** is unused before claiming it.
