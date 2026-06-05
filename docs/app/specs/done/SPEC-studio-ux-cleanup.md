# SPEC — Studio UX polish + canvas cleanup

> Status: **done - shipped (item 5 removed by request)** · Scope: **Studio UI (ToolDock, IdentifiedPanel, results drawer) + canvas
> stroke cleanup** · Branch: `feat/spell-studio-experiments` · Cross-refs:
> [DrawingSurface.jsx](../../../../src/studio/DrawingSurface.jsx), [ToolDock.jsx](../../../../src/studio/ToolDock.jsx),
> [IdentifiedPanel.jsx](../../../../src/studio/IdentifiedPanel.jsx), [StudioPage.jsx](../../../../src/studio/StudioPage.jsx),
> [tools/beautify.js](../../../../src/studio/tools/beautify.js), [SPEC-stroke-beautify.md](SPEC-stroke-beautify.md).

Six items, grouped: **layout/UX** (1, 2), **a bug** (3), **a toggle** (4), **an algorithm** (5).

## 1. ToolDock — wider + keep two columns
The dock ([drawing.css](../../../../src/studio/drawing.css) `.ds-dock`) is 76px with a `1fr 1fr` tool grid.
- Widen to ~**92px** so the two-column tool labels (Brush/Line/…/Duplicate) aren't cramped.
- Keep the existing 2-col `.ds-tool-row` grid (already correct).
- ~~Fix a CSS comment bug at drawing.css:119~~ — **false alarm**: the comment is correct (`/* */`);
  the `\*` was a ripgrep output-escaping artifact, not the file content. No change.

## 2. IdentifiedPanel + results drawer — reclaim width
Problem: each recognized row stacks **four text buttons** (⊕ Train · ✦ Smooth · Edit · 🗑) that eat the
row width; and the drawer stacks three full panels (Detection, Engine Analysis, AI Report) in one long
scroll.

Decision (best UX):
- **Icon-only row buttons.** Replace the text labels with single glyphs + `title`/`aria-label`
  (⊕ train · ✦ smooth · ✎ edit · 🗑 erase). Reclaims most of the row width; still discoverable via
  tooltip and accessible via aria-label. (The Edit *input* row stays text.)
- **Tabbed results drawer.** Convert the three stacked panels into **tabs** — `Detected` ·
  `Analysis` · `AI Report` — inside `studio-results-inner`. Each tab gets full width; the drawer stops
  being a long scroll. Default tab = `Detected`; auto-switch to `Analysis` after Analyze. Tab state is
  session-local (no persistence needed initially). This directly answers "3 columns → 3 tabs."
- *Not doing* a draggable per-panel width splitter (heavier, lower value than tabs); the drawer is
  already height-draggable.

## 3. BUG — "Erase" only removes from the list, not the drawing
`handleEraseRow` updates `detection` (list) even when the canvas removal matched nothing, so the symbol
vanishes from the list but stays drawn. Root cause: `eraseStrokesByRefs` matches a group's strokes to
canvas nodes by **reference / exact endpoints** (`samePoints`); after a re-detect or a beautify the
node's `points` array was replaced, so neither matches → 0 removed.

Fix: make the match **robust** — add a **point-membership fallback**. The recognizer group carries
`g.pts` (the union of its strokes' points, same world coords as the nodes). A stroke node belongs to the
group when ≥ 60% of its points are present in `g.pts` (rounded-coord set). `eraseStrokesByRefs(refs,
fallbackPts)`: try reference/endpoint match first, else point-membership against `fallbackPts`. Pass
`g.pts` from `handleEraseRow`. Only update the list when the canvas actually removed something (or the
group had no strokes), so list and drawing never diverge.

## 4. Toggle the detection overlay boxes
Add a **Boxes on/off** control so the dashed identified-symbol overlays can be hidden. `StudioPage`
gets a `showOverlays` state (default on); the `overlays` prop passed to `DrawingSurface` becomes `[]`
when off. Button lives in the results-drawer header (`srh-actions`) next to minimize/close, shown only
while there are overlays. Session-local.

## 5. ~~Merge a separate "overflow" stroke (cross-stroke dedup)~~ — **REMOVED**
> Built, then **removed at the user's request** — it didn't behave as wanted. The pure helpers
> (`strokesOverlap`, `dedupeStrokes`), `DrawingSurface.mergeOverlappingStrokes`, the ToolDock
> `≋ Merge` button, and the dedupe folded into `smoothStrokes` are all gone. The single-stroke
> retrace→line collapse inside `beautifyStroke` stays (it's part of plain smoothing). Design kept
> below for the record.

### (historical) original design
When a stroke is **re-traced as a separate stroke** over ~the same path, the result is a doubled/
overflowing line. Collapse such near-duplicates into one.

- **Pure helpers in `beautify.js`** (tested under `node --test`):
  - `strokesOverlap(a, b, opts) → bool` — true when one stroke lies along the other: a high fraction of
    the shorter stroke's points fall within `tol` of the longer stroke's polyline, **and** their extents
    (bbox) substantially coincide. `tol` defaults to a fraction of the combined bbox diagonal.
  - `dedupeStrokes(strokes, opts) → { kept:[idx], dropped:[idx] }` — greedily drops strokes that overlap
    an already-kept one (keeps the longer/denser of an overlapping pair).
- **Wiring:**
  - `DrawingSurface.mergeOverlappingStrokes(strokeRefs?)` — dedupe across the given strokes (or all
    `kind:'stroke'` nodes when omitted); remove the redundant ones; one undo step; returns count merged.
  - Surface it two ways: a **ToolDock "Merge" action** (global, in the Assist group) and folded into the
    Identified-panel **✦ Smooth** so cleaning a multi-stroke symbol also drops its overflow strokes.

## Testing
- `beautify.test.js`: `strokesOverlap` true for an out-and-back retrace pair / near-duplicate; false for
  two distinct strokes; `dedupeStrokes` keeps one of a duplicate pair, both of two distinct strokes.
- Existing suite stays green; lint clean; production build OK.
- Manual ([TEST-PLAN.md](../../TEST-PLAN.md)): erase removes from canvas + list together; Boxes toggle hides/
  shows overlays; tabs switch; icon buttons have tooltips; Merge collapses a doubled line.

## Out of scope (noted, not built here)
Spell-level detector/training (nested/linked recipes) — separate workstream (catalog coverage +
interaction rules), see the discussion in chat. Explicit selection-mode buttons — current Select tool
already does area/single/Shift-add.
