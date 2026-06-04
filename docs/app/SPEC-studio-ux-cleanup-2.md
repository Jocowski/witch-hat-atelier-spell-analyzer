# SPEC — Studio UX round 2 (full-width analysis, nav, merge fix, dye grid)

> Status: **proposed** · Scope: **Studio layout + the overflow-merge algorithm** ·
> Branch: `feat/spell-studio-experiments` · Cross-refs:
> [router.jsx](../../src/router.jsx), [studio.css](../../src/studio/studio.css),
> [drawing.css](../../src/studio/drawing.css), [ResultPanel.jsx](../../src/components/ResultPanel.jsx),
> [tools/beautify.js](../../src/studio/tools/beautify.js), [SPEC-studio-ux-cleanup.md](SPEC-studio-ux-cleanup.md).

## 1. Analysis tab — use the full page width
Now that the drawer is tabbed (one panel at a time), the old side-by-side sizing wastes space: the
Analysis panel is capped at `max-width: 600px` ([studio.css:222](../../src/studio/studio.css#L222)),
so it sits in a corner. Fix:
- Drop the 600px cap and the side-border on `.studio-results-inner .panel.result` (and the AI panel) —
  full drawer width.
- Flow the analysis **sections into responsive columns** (CSS multi-column: `columns: 320px`) with
  `.result-section { break-inside: avoid }`, so the content fills the width as 1–N columns instead of
  one stretched strip. Add comfortable padding.

## 2. Remove the top Studio / Admin nav
The `Nav()` in [router.jsx:22](../../src/router.jsx#L22) renders a `Studio | Admin` bar. Remove it
(navigation is by URL). Studio keeps its own header; Admin/Login carry their own chrome. Delete the
`<Nav/>` render + the component.

## 3. ~~BUG — "Merge" deletes distinct strokes~~ — **FEATURE REMOVED**
> The overflow-merge feature was **removed entirely** at the user's request (it didn't behave as
> wanted). The `strokesOverlap`/`dedupeStrokes` helpers, the ToolDock `≋ Merge` button, the
> `mergeOverlaps` action, and the dedupe folded into `smoothStrokes` are all gone. The mutual-coverage
> fix below is retained here only as a historical record. (The Identified-panel row **Merge**, which
> combines over-split detections, is a *different* feature and remains.)

### (historical) the fix that was applied before removal
`strokesOverlap(a,b)` only tests that the **shorter** stroke lies within `tol` of the **longer** one,
with `tol = 6% of the *combined* bbox diagonal`. So a short mark lying on/near a long line is "covered"
→ flagged as a duplicate → deleted. That's why Merge makes distinct strokes vanish.

Fix — make overlap **conservative** (true re-trace only):
- **Comparable length** gate: `min(lenA,lenB)/max(lenA,lenB) ≥ lenRatio` (default 0.5). A small mark vs
  a long line fails this immediately.
- **Mutual coverage**: a high fraction (`coverFrac`, default 0.75) of **A**'s points lie within `tol` of
  **B**'s polyline **and** vice-versa. A partial/one-sided overlap no longer qualifies.
- `tol` scaled to the **smaller** stroke's own bbox diagonal (local), not the combined extent.

`dedupeStrokes` unchanged (still keeps the longer of an overlapping pair). Update/extend tests:
re-trace pair overlaps; small mark on a long line does **not**; perpendicular crossing strokes do not;
two distinct strokes do not.

## 4. Dye palette — two columns
`.ds-palette` ([drawing.css:208](../../src/studio/drawing.css#L208)) is a single vertical column. Make it
a **2-column grid** (two swatches per row) in the full (non-compact) dock; compact stays a wrapping row.

## Testing
- `beautify.test.js`: add the mark-on-line and crossing-strokes negatives; existing overlap/dedupe stay
  green. Full suite green; lint clean; build OK.
- Manual: Analysis fills width; nav gone; Merge only collapses real doubles (a mark on a line survives);
  dyes show two per row.

## Subagents
Not used — all four items touch the same handful of files (router/CSS/beautify); parallel agents would
collide. Done inline.
