# SPEC — Nested & Linked Spell Detection (Track 5)

> Status: **done - core shipped (Track 5); tails 5.5B-D, 5.6** · Branch: `feat/spell-studio` (sequence LAST in the backlog — highest conflict)
> Cross-refs: [IMPROVEMENTS.md](../../IMPROVEMENTS.md) §D (the Track 5 sketch this refines),
> [SPEC-cluster-recognition.md](../SPEC-cluster-recognition.md) (5.6 extends WS11b),
> [docs/IR.md](../../../IR.md) (wha-spell@2 format), [docs/contraptions.md](../../../contraptions.md) (assembly patterns).
> Key files: `src/draw/recognizer.js`, `src/studio/drawingModel.js`, `src/engine/compose.js`.
> **Not yet started.** Sequence after autosave, seed-from-SVG, dyes-in-deduction, recognizer
> robustness (A4–A5), AI-report cache, symbol-versioning Fase 2/3, and cluster recognition WS11b.

---

## 0. Why, and what exists already

The **engine already fully supports multi-circle spells.** `compose.js` (`toComposition`,
`analyzeCircleWith`, `reclassifyCorelessCircles`, `composeWith`) accepts a wha-spell@2 object
`{ circles:[…], relations:[…] }` and handles:

- **Nested seals** — one circle inside another; the nested-glyph rule (inner fires only when
  outer ring is closed); coreless boundary/modifier rings reclassified in context.
- **Linked seals** — two circles joined by a `link` relation; identical linked seals stack power.
- **Combined signatures** — `composeWith` narratively combines effects along the nesting/link graph.

The gap is entirely in the **drawing → recognition path**:

| Layer                | Current state                                    | After Track 5             |
|----------------------|--------------------------------------------------|---------------------------|
| `recognizer.js`      | `analyzeStrokes` finds ONE ring                  | Finds N rings; assigns symbols |
| `drawingModel.js`    | `toComposition` emits one `k0` circle            | Emits `{ circles[], relations[] }` |
| Relation extraction  | None                                             | Nest + link from geometry |
| Engine input         | Single-circle v2 (trivial wrap)                  | Full v2 device (unchanged engine) |
| UI authoring         | One ring only                                    | Add-ring affordance       |
| Cluster recognition  | Single-spell whole-drawing clouds (WS11b)        | Multi-circle device clouds |

**Highest-conflict track:** touches three central modules (recognizer, drawingModel, engine
contract). Sequence it last so the conflict budget is uncontested.

---

## 5.1 Multi-Ring Detection

### Goal
`analyzeStrokes` (recognizer.js) today picks the **largest closed circle-score stroke** as the
ring. This workstream extends it to detect **all** qualifying ring strokes, assigns every non-ring
symbol group to the ring that **encloses** it, and emits one `circle` descriptor per ring.

### Ring detection algorithm

```
For each stroke S in drawn strokes:
  cs = circleScore(S)                          // existing: {cx, cy, r, cv, closed}
  if cs.cv < CV_THRESH and cs.closed:
    accept as a ring candidate; record { cx, cy, r, strokeIndex }

Sort ring candidates by radius (smallest first — useful for nesting check later).
```

**`CV_THRESH`** (coefficient of variation threshold): the existing code uses `0.3`. This is
injected as `opts.ringCvThresh` (default `0.3`), not hardcoded, so callers can tighten it for
dense multi-ring drawings or loosen it for rough freehand.

**Multiple rings with the same stroke**: if two ring candidates overlap heavily (center distance
< 0.5 × smaller radius), keep only the larger (they are the same circle drawn twice). This
de-duplicates the common "drew it twice" case.

### Symbol-to-ring assignment (point-in-circle)

After ring detection, every **non-ring stroke group** is assigned to the innermost ring that
contains its centroid:

```
for each symbol group G (centroid cx, cy):
  candidate rings = rings where dist(G.centroid, ring.center) < ring.radius * RING_ASSIGN_SLACK
  if candidates:
    assign G to the ring with the smallest radius among candidates  // innermost enclosing ring
  else:
    assign G to the globally nearest ring (fallback — it's outside all rings but still associated)
```

**`RING_ASSIGN_SLACK`** (default `1.15`, injected as `opts.ringAssignSlack`): symbols can sit on
the ring boundary or slightly outside and still belong to it. `1.0` would be strictly inside;
`1.15` covers ring-position signs (zone `ring` in compose.js) that sit at `0.85–1.05 × radius`.

**Concentric circles with the same center** (double-ring / boundary-modifier pattern): the inner
ring's symbols land inside the inner ring; the outer ring gets any symbols in the annulus between
the two. No special case needed — the innermost-enclosing rule handles it.

### Output structure (one `circle` per ring)

`analyzeStrokes` today returns `{ ring, center, ringR, groups, composition }`.

After 5.1 it returns:

```js
{
  rings: [          // array of detected rings, sorted by radius ascending
    { cx, cy, r, closed, strokeIndex },
    …
  ],
  // groups is extended with a ringIndex field:
  groups: [
    { …existingFields…, ringIndex: 0 },   // which ring this group belongs to
    …
  ],
  // Per-ring summary (feeds buildMultiComposition):
  ringGroups: [
    { ring: { cx, cy, r, closed }, groups: [ …groupsForThisRing… ] },
    …
  ],
  // Legacy single-ring fields preserved for back-compat:
  ring, center, ringR,
  // Composition now v2 multi-circle:
  composition,
}
```

**Back-compat rule:** if exactly one ring is detected, `ring`, `center`, `ringR` are set as
before; callers that read only these fields continue to work. New callers read `ringGroups`.

### Pure-module constraint

`recognizer.js` is PURE — no JSON imports. All thresholds (`CV_THRESH`, `RING_ASSIGN_SLACK`)
come in through `opts`. The caller (StudioPage) reads them from `rules.json` and passes them in:

```js
// rules.json (existing recognition block):
"recognition": {
  "ringCvThresh": 0.3,
  "ringAssignSlack": 1.15,
  "linkEndpointSlack": 0.12,
  "nestCenterSlack": 0.85,
  …
}
```

---

## 5.2 Nesting Relations

### Goal
When one detected ring is geometrically **inside** another, emit `{ type: 'nest', outer, inner }`.
This maps directly onto `compose.js`'s existing `nest` relation — no engine changes required.

### Nesting test

```
For each pair of rings (A, B) where radius(A) < radius(B):
  if dist(A.center, B.center) + radius(A) < radius(B) * NEST_CENTER_SLACK:
    → B is outer, A is inner  →  nest relation { outer: B.id, inner: A.id }
```

**`NEST_CENTER_SLACK`** (default `0.85`, injected via `opts.nestCenterSlack`): strict containment
would require `dist + rA < rB` exactly; slack `0.85` means A's center+radius must fit inside
`0.85 × rB`. This tolerates a small amount of wobble in a freehand concentric drawing without
misclassifying side-by-side same-size rings as nested.

**Multi-level nesting**: the test is pairwise, so A inside B inside C emits two nest relations:
`{ outer:C, inner:B }` and `{ outer:B, inner:A }`. `composeWith` handles recursive nesting via
its `describe` walk.

**Side-by-side rings** (linked, not nested): do not satisfy the containment test; they produce no
nest relation. They will produce a link relation (5.3) if connected by a stroke.

### Assigned circle ids

Each ring gets an id `k0`, `k1`, `k2`, … in discovery order (smallest-first). The `outer`/`inner`
fields in the nest relation use these ids. `compose.js` expects these to match the `id` fields in
`circles[]`, which `buildMultiComposition` (5.4) guarantees.

---

## 5.3 Link Relations

### Goal
A stroke whose **endpoints** are each near a different ring boundary → emit
`{ type: 'link', a: ringId, b: ringId }`.

### Link detection

A stroke is a **link candidate** when:

1. It fails the ring test (not classified as a ring itself).
2. It is not assigned to any ring as a symbol group (i.e., it is not enclosed by any ring, or it
   straddles two rings).
3. Its **first point** is within `LINK_SLACK × radius` of ring A's boundary:
   `| dist(endpoint, ring.center) − ring.radius | < LINK_SLACK × ring.radius`
4. Its **last point** similarly lies near ring B's boundary, where B ≠ A.

**`LINK_SLACK`** (default `0.12`, injected as `opts.linkEndpointSlack`): `12%` of the ring's
radius. A 170px ring → tolerance of ~20px, which is generous for freehand lines ending on a ring.

**Strokes that touch the same ring at both ends** do not produce a link (both endpoints near the
same ring — they are a partial-ring draw or an arc decoration).

**Link endpoint identity**: the link relation's `a` and `b` are **circle ids** (`k0`, `k1`, …).
The IR also allows `a`/`b` to be component ids, but the recognizer always emits circle ids (the
user draws a line between rings, not between specific signs); component-level links remain a
manual authoring feature.

### After link detection

Remove link-candidate strokes from the ordinary symbol-group pool so they are not mis-recognized
as signs. They are consumed by the relation extractor.

---

## 5.4 drawingModel → wha-spell@2 (schema extension)

### Goal
Extend `drawingModel.toComposition` to output a proper multi-circle wha-spell@2 when the canvas
holds more than one ring, while remaining a PURE module and remaining back-compat for single-ring
drawings.

### Current output (single-ring, simplified)

```json
{
  "format": "wha-spell@2",
  "name": "",
  "circles": [
    {
      "id": "k0",
      "center": { "x": 0, "y": 0 },
      "radius": 170,
      "ring": { "closed": true },
      "core": { "id": "water", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
      "components": [ { "id": "column", "type": "column", "role": "sign", "x": 0, "y": -150, … } ],
      "dyes": []
    }
  ],
  "relations": []
}
```

### After 5.4 — multi-ring output (two circles, linked)

```json
{
  "format": "wha-spell@2",
  "name": "",
  "circles": [
    {
      "id": "k0",
      "center": { "x": -210, "y": 0 },
      "radius": 170,
      "ring": { "closed": true },
      "core": { "id": "water", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
      "components": [ { "id": "column", "type": "column", "role": "sign", "x": 0, "y": -130, … } ],
      "dyes": []
    },
    {
      "id": "k1",
      "center": { "x": 210, "y": 0 },
      "radius": 170,
      "ring": { "closed": true },
      "core": { "id": "water", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
      "components": [ { "id": "column", "type": "column", "role": "sign", "x": 0, "y": -130, … } ],
      "dyes": []
    }
  ],
  "relations": [
    { "type": "link", "a": "k0", "b": "k1" }
  ]
}
```

**Note:** `center` is in **spell-space px** (real canvas position of each ring's center). The
per-circle component coordinates are **relative to that circle's center** (same convention as
today — `compose.js` resolves each circle's geometry relative to its own center). So the
migration is: subtract the ring's `center` from each component's canvas `x,y`.

### Nesting example — inner water seal + outer modifier ring

```json
{
  "format": "wha-spell@2",
  "name": "Vapor Bubble",
  "circles": [
    {
      "id": "k0",
      "center": { "x": 0, "y": 0 },
      "radius": 110,
      "ring": { "closed": true },
      "core": { "id": "water", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
      "components": [],
      "dyes": []
    },
    {
      "id": "k1",
      "center": { "x": 0, "y": 0 },
      "radius": 220,
      "ring": { "closed": false },
      "core": null,
      "components": [
        { "id": "gather", "type": "gather", "role": "sign", "x": 0, "y": -195, … }
      ],
      "dyes": []
    }
  ],
  "relations": [
    { "type": "nest", "outer": "k1", "inner": "k0" }
  ]
}
```

### Back-compat: single-ring drawing

When the canvas holds exactly one ring, the output is **identical to today** (one circle at
`center:{x:0,y:0}`, `relations:[]`). The engine's `toComposition` in compose.js already
handles this v2 shape; callers that only ever drew one ring see no change.

### How it maps onto compose.js

`compose.js`'s `toComposition` accepts the v2 `{circles, relations}` shape and normalizes each
circle with `normalizeCircle`. The id, center, radius, ring, core, components, dyes, and
linkCount fields all match exactly. The relations array is passed straight to
`reclassifyCorelessCircles` and `composeWith`. **No changes needed in compose.js.**

### drawingModel changes (summary)

```
toComposition(model, opts):
  if model has only one ring (or no ring):
    → current single-circle path (unchanged)
  else:
    → call buildMultiComposition(ringGroups, relations, placedByRing, dyes)
       for each ring: build its circle descriptor (same core/component logic,
                       but coordinates relative to that ring's center)
       prepend relations from 5.2 + 5.3
```

`buildMultiComposition` is a new pure helper in drawingModel.js; it receives the ring data
extracted by the recognizer (via `recognizedToPlaced` or directly from `ringGroups`) plus any
**placed** symbols that were assigned to rings by the point-in-circle test.

The `isSigil` injection pattern is preserved: no JSON import inside drawingModel.js.

---

## 5.5 UI for Multi-Ring Authoring

### Goal
Let users explicitly **draw or place** across multiple rings so that nested/linked compositions
are easy to compose and round-trip correctly.

### Approach: implicit ring detection + minimal explicit affordance

The canonical draw-path (brush/circle tool) already lets the user draw any number of ring
strokes. With 5.1 in place, each closed-circle stroke becomes a ring automatically — no extra UI
mode is needed for the common case.

What is needed:

**A. Ring indicator overlay (low effort)**
After Detect, show each detected ring as a faint dashed circle overlay (distinct color per ring,
matching the composition circle id). This confirms to the user that multi-ring detection
succeeded and which ring each symbol belongs to.

**B. Symbol assignment correction (medium effort)**
If a symbol was assigned to the wrong ring (e.g., it fell between two rings), the user should be
able to drag it to a different ring. Implement as a context-menu or modifier-drag that re-assigns
the symbol's `ringIndex`. This is a correction path, not the primary draw path.

**C. "Add ring" button (low effort)**
A toolbar button that places a new ring stroke at a sensible default position (offset from the
existing ring center by `2.5 × existingRadius`). This is a shortcut for users who want to build
linked spells without drawing a freehand circle. The placed ring stroke is indistinguishable from
a drawn ring — the recognizer treats it identically.

**D. Dyes per ring**
The current dye panel assigns dyes globally (to `model.dyes`). For multi-ring spells, dyes should
be assignable per ring. Design: each ring gets a dye-slot affordance (a small ink-drop icon near
its ring indicator). The `model` shape gains `ringDyes: { [ringId]: [dyeId] }` alongside the
existing `dyes` (which remains as the legacy single-ring field and maps to `k0` on export).

**E. Cross-conflict note: SPEC-visual-renderer**
The prepared/active visual feature (planned as a SPEC-visual-renderer item, not yet written) is
deliberately **OFF by default** to avoid clashing with multi-ring drawing. The ring-detection
visual overlay (5.5A) is the only in-canvas rendering addition Track 5 adds; it must not conflict
with the visual renderer's z-ordering. When SPEC-visual-renderer is authored, cross-reference
this spec and gate the visual renderer's active-ring highlight behind a `showVisualRenderer`
feature flag that defaults to `false`.

---

## 5.6 Cluster Recognition for Contraptions

### Goal
Extend SPEC-cluster-recognition.md Phase 2 (WS11b) from single-circle whole-spell clouds to
**multi-circle device clouds**, so a known contraption shape (e.g., Serpent's Bed of Sand's seven
circles, Raincleaver's linked rain array) is recognized as a unit.

### Extension to the data model

The `cluster_samples` table (WS11b §2.2) gains two optional fields:

```sql
-- add to cluster_samples:
circle_count  int,                  -- number of circles in this device (1 for single seals)
layout_v2     jsonb,                -- the full wha-spell@2 composition (circles + relations)
                                    -- (WS11b stored layout = v1 composition; this supersedes it)
```

`layout_v2` is nullable; for single-circle entries it stays null and `layout` is used (back-compat).

### Multi-circle cloud normalization

A contraption drawing spans multiple ring areas. To normalize it for `$P` matching:

1. Collect **all strokes** (ring strokes + symbol strokes + link strokes).
2. Translate to centroid of the full bounding box (not individual ring centers).
3. Scale uniformly so the longest dimension = 1 (or the `$P` square-scale, same as single-circle).
4. Resample to `NUM_POINTS` — the same `makeCloud` call, on the combined point list.

This is the same `makeClusterCloud(strokes)` function from WS11b, unchanged. Multi-circle
drawings are longer point clouds but the normalization is identical; no new function needed.

### Capture

Extend the WS11b contribute flow: if the current composition has `circles.length > 1` and the
engine matches a known multi-circle recipe:

- `circle_count = circles.length`
- `layout_v2 = composition` (the full v2 output from 5.4's buildMultiComposition)
- `layout` = null (or omit — the v2 layout supersedes it)

The UI labels the action "Contribute device shape" to distinguish from single-spell contribute.

### Matching

`matchCluster` (WS11b §2.4) is unchanged — it matches the whole-drawing cloud against stored
`cluster.cloud` regardless of circle count. The `layout_v2` field is returned in the result; the
caller uses it to seed the overlay and recognized composition.

**Rotation sweep**: multi-circle devices are usually drawn in a consistent orientation (the
caster's geometry is intentional), so the same coarse rotation sweep (15° steps) used for
single-circle clusters applies. For symmetric contraptions (Raincleaver's row of identical seals)
a tighter sweep of 5° may help — make this a per-cluster `rotationSweepStep` field (nullable,
defaults to 15°).

### Integration

The coarse-to-fine detection flow (WS11b §2.5) is unchanged:

1. `matchCluster(drawn, clusters)` — now covers both single and multi-circle clusters.
2. **Confident match** → adopt `layout_v2` (or `layout` for single-circle entries) as the
   recognized composition; show the known effect; seed overlay boxes.
3. **Else** → per-symbol recognition with multi-ring detection (5.1–5.3).

### Acceptance

- Draw a known two-circle linked contraption (e.g., two identical water-column seals connected by
  a line); after contributing, drawing the same shape again is recognized as that device.
- The `layout_v2` field round-trips through Export/Import unchanged.
- Below threshold, behavior falls back to per-symbol multi-ring detection (5.1–5.3).

---

## Multi-Ring Detection Algorithm (consolidated reference)

```
analyzeStrokes(strokes, templates, opts):

  PHASE 1 — ring detection
  for each stroke S:
    cs = circleScore(S)
    if cs.cv < opts.ringCvThresh(0.3) and cs.closed:
      add to rings[]
  de-duplicate rings: if two rings overlap > 50% radius, keep larger
  sort rings by radius ascending; assign ids k0, k1, …

  PHASE 2 — link-candidate extraction (before grouping)
  for each non-ring stroke S:
    endpointA = S[0], endpointB = S[-1]
    for each ring R:
      nearA = | dist(endpointA, R.center) - R.r | < opts.linkEndpointSlack(0.12) * R.r
      nearB = | dist(endpointB, R.center) - R.r | < opts.linkEndpointSlack(0.12) * R.r
    if nearA for ring Ri and nearB for ring Rj (i ≠ j):
      record link candidate { a: Ri.id, b: Rj.id, stroke: S }
      mark S as consumed (exclude from symbol grouping)

  PHASE 3 — symbol grouping (existing gap-merge, applied per ring)
  symStrokes = non-ring strokes minus link candidates
  groups = existing proximity-merge (gap=45px) on symStrokes
  for each group G:
    G.ringIndex = index of innermost enclosing ring (point-in-circle with opts.ringAssignSlack(1.15))
               or nearest ring (fallback)
  ringGroups = group groups by ringIndex

  PHASE 4 — per-ring: center/border classification + de-rotate + classify
  for each ring R with its groups:
    center = { x: R.cx, y: R.cy }, ringR = R.r
    existing steps 3–5 (center/border, sweep de-rotation, $P match, confidence gate)
    coordinates are relative to R's center

  PHASE 5 — relation extraction
  nest relations:
    for each pair (A, B) where A.r < B.r:
      if dist(A.center, B.center) + A.r < B.r * opts.nestCenterSlack(0.85):
        add { type:'nest', outer: B.id, inner: A.id }
  link relations:
    for each link candidate { a, b }:
      add { type:'link', a, b }

  PHASE 6 — build composition
  if rings.length === 1:
    → existing buildComposition path (back-compat, single circle k0 at {0,0})
  else:
    → buildMultiComposition(ringGroups, relations) (new, 5.4)

  return { rings, groups, ringGroups, relations, ring, center, ringR, composition }
```

---

## Relation-Extraction Rules: Tolerances Summary

| Parameter          | Default | Injected via        | Meaning                                              |
|--------------------|---------|---------------------|------------------------------------------------------|
| `ringCvThresh`     | 0.30    | `opts.ringCvThresh` | Max stroke CV to accept as a ring                    |
| `ringAssignSlack`  | 1.15    | `opts.ringAssignSlack` | Fraction of ring radius for point-in-ring test    |
| `nestCenterSlack`  | 0.85    | `opts.nestCenterSlack` | Inner ring must fit within this fraction of outer |
| `linkEndpointSlack`| 0.12    | `opts.linkEndpointSlack` | Endpoint distance tolerance as fraction of ring radius |

All four come from `rules.json` (`recognition` block) and are passed in by StudioPage — never
hardcoded in recognizer.js.

---

## Cross-References

- **SPEC-ring-closure-floodfill.md** (not yet written): a future spec for improving ring-closure
  detection via flood-fill — can find partially-open circles, multiple enclosed regions. When
  written, multi-ring detection (5.1) should be revised to optionally use flood-fill to identify
  enclosed regions as rings, in addition to the circle-score approach above. The flood-fill path
  can find multiple enclosed regions in one pass — cross-reference 5.1's PHASE 1 there.
- **SPEC-cluster-recognition.md** (WS11b): 5.6 extends Phase 2. The `cluster_samples` table,
  `makeClusterCloud`, `matchCluster`, and the coarse-to-fine Detect flow are designed in WS11b;
  5.6 adds `circle_count` + `layout_v2` fields and the multi-circle contribute path only.
- **SPEC-recognizer-analysis.md** (A4–A5): rotation tolerance and adaptive segmentation. 5.1's
  PHASE 3 reuses the existing gap-merge; A5's radius-scaled gap should be applied per-ring (each
  ring's gap scales with its own radius, not the global drawing).
- **SPEC-visual-renderer** (not yet written): ring detection overlays (5.5A) are the only
  in-canvas visual Track 5 adds. Gate the visual renderer's active-ring highlights behind a
  `showVisualRenderer` feature flag (default `false`) to avoid z-order conflicts.

---

## Phasing and Effort

Track 5 is sequenced **last** because it touches three central modules simultaneously. Within the
track, sequence the workstreams in dependency order:

| # | Workstream                                   | Effort | Depends on       |
|---|----------------------------------------------|--------|------------------|
| 5.1 | Multi-ring detection in recognizer.js      | M      | —                |
| 5.2 | Nesting relations                           | S      | 5.1              |
| 5.3 | Link relations                              | S      | 5.1              |
| 5.4 | drawingModel → wha-spell@2 (multi-circle)   | M      | 5.1, 5.2, 5.3    |
| 5.5 | UI for multi-ring authoring                 | M–L    | 5.4              |
| 5.6 | Cluster recognition for contraptions        | S      | WS11b, 5.4       |

**5.1–5.4 are the core** (recognizer + drawingModel changes, fully testable without the UI).
**5.5** is UX on top and can be delivered incrementally (5.5A ring overlay first, then
5.5B/C/D). **5.6** is a small extension to WS11b's data model and contribute flow, low risk.

**Overall track effort: L** (three modules, careful test coverage required; the engine is
untouched but the pipeline handoff is intricate).

---

## Acceptance Criteria

**5.1 Multi-ring detection**
- Drawing two separate closed circles produces two rings with distinct ids (`k0`, `k1`).
- Each symbol is assigned to the ring whose center it is closest to and inside.
- A single-ring drawing produces the same output as today (back-compat).

**5.2 Nesting**
- Drawing a small circle inside a large circle produces `{ type:'nest', outer:'k1', inner:'k0' }`.
- Two side-by-side circles (non-overlapping) produce no nest relation.
- `compose.js` reclassifies a coreless outer ring (no core, no signs) as a boundary ring.

**5.3 Link**
- Drawing a line connecting two ring boundaries produces `{ type:'link', a:'k0', b:'k1' }`.
- A line whose both endpoints touch the same ring produces no link.
- The link stroke is not recognized as a symbol.

**5.4 wha-spell@2 output**
- `drawingModel.toComposition` for a two-ring canvas emits `circles.length === 2` with correct
  per-ring centers, radii, cores, components, and `relations`.
- Component coordinates are relative to their ring's center (not to the global canvas origin).
- The output passes `compose.js`'s `toComposition` normalization without error.
- Import/Export round-trip: exported JSON re-imported produces the identical two-circle composition.

**5.5 UI**
- The ring indicator overlay appears after Detect and correctly labels which symbols belong to each ring.
- The "Add ring" button creates a second ring at the expected offset.

**5.6 Cluster contraptions**
- A contributed multi-circle device is stored with `circle_count > 1` and `layout_v2` populated.
- Drawing that device again (rough strokes) matches the cluster with confidence above threshold.

---

## Testing Notes

All core logic (5.1–5.4) is **pure** and testable under `node --test` without DOM or Supabase.

### Recommended unit tests (`test/nested-linked.test.js`)

```js
// T1 — two concentric circles → nest relation
const strokes = [ bigCirclePoints, smallCirclePoints, waterSignPoints ]
const { rings, relations, composition } = analyzeStrokes(strokes, [], { ringCvThresh: 0.3, ... })
assert(rings.length === 2)
assert(relations.some(r => r.type === 'nest'))
assert(composition.circles.length === 2)
assert(composition.circles[0].core === null || /* inner has core */)

// T2 — two side-by-side circles + connecting line → link relation
const strokes = [ leftCircle, rightCircle, connectingLine, …symbols ]
const result = analyzeStrokes(strokes, [], opts)
assert(result.rings.length === 2)
assert(result.relations.length === 1 && result.relations[0].type === 'link')
assert(result.composition.relations[0].type === 'link')

// T3 — single ring back-compat
const strokes = [ oneCircle, …symbols ]
const result = analyzeStrokes(strokes, [], opts)
assert(result.rings.length === 1)
assert(result.composition.circles.length === 1)
assert(result.composition.circles[0].id === 'k0')
assert(result.composition.circles[0].center.x === 0)  // recentered to origin

// T4 — drawingModel.toComposition multi-ring
import { toComposition } from '../../src/studio/drawingModel.js'
const model = { placed: [...sigils, ...signs], rings: [...], ringAssignments: {...}, dyes: [] }
const comp = toComposition(model, { isSigil: (t) => t === 'water' })
assert(comp.format === 'wha-spell@2')
assert(comp.circles.length === 2)
assert(comp.relations.length >= 1)

// T5 — compose.js accepts the multi-ring output unchanged
import { toComposition as engineToComposition } from '../../src/engine/compose.js'
const normalized = engineToComposition(comp)   // should not throw
assert(normalized.circles.length === 2)
```

**Data injection for tests:** since `recognizer.js` is pure, pass thresholds in `opts`. Since
`drawingModel.js` is pure, inject `isSigil` as a function. Use `createRequire` for any JSON
fixture data (following the established pattern from `deduce.test.js`).

---

## Open Questions

1. **Overlapping rings that are NOT concentric**: two rings that partially intersect (Venn-style)
   are not a clear nest or link. Current approach: no relation emitted. Is this a real use case in
   WHA? If so, a future workstream could model it as a "merge" or "intersection" relation.

2. **Rings without any symbols**: a drawn ring with nothing inside is a valid boundary ring in the
   engine (reclassified as long as it encloses something). The recognizer should emit it; the
   engine handles it already. Confirm the UI does not filter out empty rings.

3. **Drawing order**: users naturally draw the outer ring first, then symbols, then the inner ring.
   The algorithm must be order-independent (it sorts rings by radius, not by draw order). Confirm
   no draw-order assumption leaks in.

4. **dyes per ring (5.5D)**: `model.dyes` today is a flat array. The multi-ring model needs per-ring
   dyes. The migration path: treat `model.dyes` as dyes for `k0` when `ringDyes` is absent, for
   full back-compat. Explicit design deferred to the 5.5 implementation sprint.

5. **Interaction with SPEC-ring-closure-floodfill.md**: the flood-fill approach can detect enclosed
   regions from partially-open circles and would naturally emit multiple regions. If that spec is
   authored before 5.1 is implemented, the flood-fill ring finder should replace PHASE 1 of the
   multi-ring algorithm above (returning the same `{cx, cy, r, closed}` interface). Design 5.1's
   ring-detection output as an interface, not a specific algorithm, to make this swap cheap.
