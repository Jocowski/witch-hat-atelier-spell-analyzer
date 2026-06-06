# SPEC — Responsive / mobile Spell Studio

> Status: **MVP shipped (Phase 0 + Phase 1 + P2.3 + P3.2-mobile) — Phase 3/4 polish pending** · Scope: **core flow on touch + small screens (draw → Detect → Analyze → read results)** · Branch: `feat/spell-studio-experiments`
>
> **Shipped:** `useViewport` ([src/app/useViewport.js](../../../src/app/useViewport.js)); `100dvh`; coarse-pointer
> touch targets; mobile horizontal dock; two-finger pinch-zoom + pan and a Pan ✋ tool (`H`) in
> [DrawingSurface.jsx](../../../src/studio/DrawingSurface.jsx)/[ToolDock.jsx](../../../src/studio/ToolDock.jsx);
> symbol bottom-sheet + FAB and the mobile Draw⇄Cast toggle in [StudioPage.jsx](../../../src/studio/StudioPage.jsx).
> **Pending:** P3.1 drawer snap points, P4 long-press transforms + hover-equivalents, P5 device matrix.
> Cross-refs: [APP-PLAN.md](../APP-PLAN.md), [SPEC.md](../SPEC.md), [IMPROVEMENTS.md](../IMPROVEMENTS.md), [TEST-PLAN.md](../TEST-PLAN.md)
> Touched files: [studio.css](../../../src/studio/studio.css), [drawing.css](../../../src/studio/drawing.css),
> [StudioPage.jsx](../../../src/studio/StudioPage.jsx), [DrawingSurface.jsx](../../../src/studio/DrawingSurface.jsx),
> [ToolDock.jsx](../../../src/studio/ToolDock.jsx), [SymbolPalette.jsx](../../../src/studio/SymbolPalette.jsx),
> [SpellTrial.jsx](../../../src/studio/SpellTrial.jsx)

Spell Studio is a desktop-first single-screen tool (canvas + left tool dock + right symbol palette +
bottom results drawer, shell `height:100vh; overflow:hidden`, [studio.css:9](../../../src/studio/studio.css#L9)).
There is effectively **no responsive layer**: the only two media queries in the app
([studio.css:1181](../../../src/studio/studio.css#L1181)) hide the palette below 860px and target a
`.studio-sidebar-left` node that no longer exists (the dock moved inside `DrawingSurface`). On touch the
app is **not usable** for its core purpose.

**Scope decision (this spec):** make the **core flow** — draw → Detect → Analyze → read the analysis —
work well on phones and tablets. **Admin** ([src/admin/](../../../src/admin/)) and power-tools
(Training/Trace/Registry/Review) stay **desktop-best** and only need to *degrade gracefully* (a "best on a
larger screen" notice is acceptable). Full touch parity for those is out of scope.

---

## Problem inventory (verified in code)

### Hard blockers — touch cannot perform these at all
- **B1 — No pan / zoom on touch.** Pan needs `evt.button === 2` (right-drag) or the space key
  ([DrawingSurface.jsx:850](../../../src/studio/DrawingSurface.jsx#L850)); zoom needs `Shift+wheel`
  ([DrawingSurface.jsx:707](../../../src/studio/DrawingSurface.jsx#L707)). The Stage wires
  `onTouchStart/Move/End` straight to the single-pointer **draw** handlers
  ([DrawingSurface.jsx:1110](../../../src/studio/DrawingSurface.jsx#L1110)), and `touch-action:none`
  ([drawing.css:35](../../../src/studio/drawing.css#L35)) suppresses native pinch/scroll. → On a phone you
  can draw but never move or zoom the glyph circle.
- **B2 — No multi-touch handling.** A second finger is read as more drawing; an instinctive pinch draws a
  stray stroke.
- **B3 — Symbol palette is `display:none` below 860px** ([studio.css:1182](../../../src/studio/studio.css#L1182)).
  On mobile the user **cannot place any sigil/sign** — half the composition vocabulary disappears.

### Layout breaks
- **L1 — `height:100vh`** ([studio.css:12](../../../src/studio/studio.css#L12)) — mobile browser chrome
  makes 100vh exceed the visible area; the action bar + drawer hide under the URL bar. Use `100dvh`.
- **L2 — Post-Analyze horizontal split** (draw | render side-by-side via `splitFrac`,
  [StudioPage.jsx:636](../../../src/studio/StudioPage.jsx#L636)) is unusable below ~700px.
- **L3 — Vertical tool dock** (92px, [drawing.css:44](../../../src/studio/drawing.css#L44)) consumes a
  quarter of a phone's width and never adopts the horizontal `compact` layout it already supports for
  Training ([drawing.css:60](../../../src/studio/drawing.css#L60)).
- **L4 — Action bar has no `flex-wrap`** ([StudioPage.jsx:654](../../../src/studio/StudioPage.jsx#L654)) —
  6+ controls overflow/clip below ~700px.
- **L5 — Results drawer** default 45vh; on a short viewport the dock + canvas + drawer leave almost no
  canvas.

### Touch ergonomics
- **E1 — Tiny targets**: `.srh-btn` 0.75rem, `.ds-zoom-btn` 28×24, `.identified-icon` 26×24,
  `.ds-swatch` 26px, resize handles 6px — all below the ~44px coarse-pointer floor.
- **E2 — Brush-size slider** is a 6px-wide vertical range input ([drawing.css:251](../../../src/studio/drawing.css#L251)) — ungrabbable by finger.
- **E3 — Hover-only affordances** (tooltips, `:hover` row highlight in `IdentifiedPanel`, dye `:hover`
  scale) have no touch equivalent.

---

## Breakpoints

Single source of truth. Add a `useViewport()` hook (or CSS custom-media) exposing:
- `mobile`  — `< 640px`
- `tablet`  — `640–1024px`
- `desktop` — `> 1024px`

Drive JSX layout decisions (split vs. toggle, palette inline vs. sheet) from the hook; drive pure styling
from `@media` + `@media (pointer: coarse)`. Remove the dead `.studio-sidebar-left` rules.

---

## Phase 0 — Foundations (small, unblocks everything)
**P0.1** `100vh → 100dvh` (with `@supports (height:100dvh)` fallback) in [studio.css](../../../src/studio/studio.css)
and the admin shells.
**P0.2** Add `useViewport()` and the breakpoint constants; delete the stale media queries.
**P0.3** Touch-target baseline: under `@media (pointer: coarse)` raise `.srh-btn`, `.ds-zoom-btn`,
`.identified-icon`, `.ds-swatch`, and resize handles to **min 40–44px**.

**Acceptance:** no layout hides under browser chrome on mobile Safari/Chrome; every interactive control in
the core flow is ≥40px on a coarse pointer.

## Phase 1 — Canvas input parity (the critical blocker) 🎯
All in [DrawingSurface.jsx](../../../src/studio/DrawingSurface.jsx).
**P1.1** Add a pointer-tracking gesture layer (track active `e.evt.touches`, or adopt `@use-gesture/react`):
- **1 finger** → draw (unchanged).
- **2 fingers** → pinch-zoom (distance delta → existing `setZoom`, anchored on the centroid) + pan
  (centroid delta → stage position).
- While ≥2 pointers are down, **suppress draw-commit** and discard the in-progress stroke
  (`livePtsRef`/`drawingRef`).
**P1.2** Add an explicit **Pan tool** ("hand") to [ToolDock.jsx](../../../src/studio/ToolDock.jsx) that
enables single-finger pan — surfaces the existing space-key path as UI (also helps trackpad/desktop users
who never found right-drag).
**P1.3** On coarse pointers, promote the dock's zoom +/−/recenter into a floating on-canvas control
(the dock buttons are too small and the dock is hidden/compacted on mobile).

**Acceptance:** on a phone you can pinch-zoom, two-finger pan, and single-finger pan (hand tool) the glyph;
no stray strokes from pinch; desktop mouse behavior unchanged.

## Phase 2 — Responsive shell
**P2.1** `.studio-main` reflows by breakpoint ([studio.css:60](../../../src/studio/studio.css#L60)):
- **Desktop** — unchanged (dock | canvas | palette; drawer bottom).
- **Tablet** — palette collapses to a toggled right drawer.
- **Mobile** — single column; dock → horizontal `compact` bar (reuse the existing Training layout,
  [drawing.css:60](../../../src/studio/drawing.css#L60)); canvas fills the viewport.
**P2.2** Action bar: add `flex-wrap` and move Copy/Export/Import into an overflow "⋯" menu on narrow widths
([StudioPage.jsx:654](../../../src/studio/StudioPage.jsx#L654)).
**P2.3 — fixes B3.** Symbol palette on mobile becomes a **bottom-sheet** opened by a "＋ Symbol" FAB,
instead of `display:none`. Restores symbol placement. ([SymbolPalette.jsx](../../../src/studio/SymbolPalette.jsx))

**Acceptance:** at 360px the canvas is the dominant element, all tools reachable, and a sigil/sign can be
placed via the bottom sheet.

## Phase 3 — Drawer & render-pane as mobile sheets
**P3.1** Results drawer → bottom sheet with snap points (peek / half / full) and swipe-to-expand on mobile;
keep the pointer-drag resize on desktop ([StudioPage.jsx:710](../../../src/studio/StudioPage.jsx#L710)).
**P3.2 — fixes L2.** Post-Analyze split: on mobile replace side-by-side draw|render with a **Draw ⇄ Cast**
segmented toggle (or a full-screen Cast overlay). Guard the `splitFrac` logic
([StudioPage.jsx:232](../../../src/studio/StudioPage.jsx#L232)) behind the desktop breakpoint.

**Acceptance:** reading the analysis and viewing the cast are both comfortable on a phone; desktop split
unchanged.

## Phase 4 — Touch polish & a11y
**P4.1 — fixes E2.** Replace the vertical brush slider with a larger horizontal / stepped control on coarse
pointers.
**P4.2 — fixes E3.** Every `:hover`-only affordance gets a tap/selected equivalent (e.g. tap a detected row
→ highlight its canvas box).
**P4.3** Long-press context actions on placed symbols (rotate / scale / delete) replacing the desktop
transform toolbar on touch.
**P4.4** Admin screens ([admin.css](../../../src/admin/admin.css)): verify graceful degradation; add a
"best on desktop" notice rather than full touch support (out of scope).

## Phase 5 — Validation
- Manual matrix: iPhone Safari · Android Chrome · iPad · desktop. Extend
  [TEST-PLAN.md](../TEST-PLAN.md) with touch cases: pinch-zoom, two-finger pan, hand-tool pan, symbol
  bottom-sheet, drawer snap points, Draw⇄Cast toggle.
- Log residual items in [IMPROVEMENTS.md](../IMPROVEMENTS.md).

---

## Sequencing / MVP

**MVP ("works on a phone") = Phase 0 + Phase 1 + P2.3 (symbol bottom-sheet).** Those remove the three hard
blockers (B1/B2/B3) and the chrome/sizing foundations. Phases 2 (rest), 3, 4 are "feels native" refinement.
Each phase is independently shippable and leaves desktop behavior unchanged.

## Non-goals
- Touch parity for Admin / Training / Trace / Registry / Review.
- A separate mobile codebase or PWA/offline work (could be a later spec).
- Changing the engine, recognizer, or data model — this is presentation/interaction only.
