# TEST-PLAN.md — manual test checklist

> Steps to exercise Spell Studio and surface failures. Tick each; note anything that deviates from the
> **Expected** column. Automated coverage (engine/pure modules) runs with `npm test` (133 tests) — this
> doc covers the **UI + integration + data** paths that tests don't.

## 0. Setup
```bash
npx supabase start      # DB up
npm run ai              # AI bridge up (needs `claude` CLI)
npm run dev             # app → http://localhost:5173
```
- [ ] App loads at `/` (Studio). No console errors (open DevTools).
- [ ] `npm test` → 133 passing. `npm run build` → green.

---

## 1. Studio — drawing tools (`/`)
| # | Action | Expected | Failure looks like |
|---|---|---|---|
| 1 | Brush: draw freehand | smooth line in the active dye color | jagged/no line; page scrolls |
| 2 | Line / Rect / Triangle / Circle / Arrow: drag to size | shape previews while dragging, commits on release | shape missing; **page scrolls/moves while sizing** (the old bug) |
| 3 | On touch/pen: drag-size a shape | page never scrolls; shape sizes | page pans → regression |
| 4 | "Click-to-draw" toggle on: click start, click end | shape commits on 2nd click | only drag works |
| 5 | Eraser (stroke): click a line/shape/symbol | the whole object disappears | nothing erased |
| 6 | Eraser (pixel): drag across a line | only the touched part is removed (line splits) | whole line gone / nothing |
| 7 | Select: click any stroke/shape/symbol | it selects, Transformer handles appear | select does nothing (old bug) |
| 8 | Move / Rotate / scale a selected item | moves/rotates/resizes | handles inert |
| 9 | Area-select: drag a box over empty space around items | all enclosed items select; Shift adds | no marquee |
| 10 | Pan: right-click drag (or Space+drag) | canvas pans; no context menu | nothing / context menu pops |
| 11 | Zoom: Shift + mouse wheel | zooms around cursor; +/−/reset work | page scrolls instead |
| 12 | Tool dock | all tools visible in **two rows**, no scrollbar | dock scrolls |
| 13 | Dye color swatches | picking a color tints new strokes | color ignored |

## 2. Symbol palette (right)
- [ ] One vertical scrollbar only (no nested/horizontal scrollbars).
- [ ] Search filters sigils/signs by id/name.
- [ ] Click a tile → the symbol is placed at canvas center, **without a name label**.
- [ ] Placed symbol can be selected, moved, rotated, and **scaled bigger**.

## 3. Detect → correct → Analyze
- [ ] Train a couple symbols first (Admin) or accept low accuracy with little data.
- [ ] Draw a ring + a `fire` shape in the center + 4 `levitation` around (Pyreball-like).
- [ ] **Detect symbols** → each detected item shows a **dashed box + label** on the canvas (overlays track zoom/pan).
- [ ] The "Detection" panel lists symbols with confidence; **correct** a wrong one → its box/label + composition update; a `corrected` training sample is saved (check Review).
- [ ] **Analyze spell** → engine reading (validity, sigils, signs, effect, similar spells, geometry).
- [ ] If it matches a catalog spell → **"Contribute symbols to training"** appears → click → "Added N symbols" (verify rows with `source='confirmed'` in Review).
- [ ] Results panel: **minimize** and **close** both work.

## 4. AI report (bridge up)
- [ ] After Analyze, the AI section shows topic cards (all enabled by default).
- [ ] Click "Ask AI" → cards stream in **independently** (each fills as its job returns), rendered as **Markdown**.
- [ ] Stop the bridge (`Ctrl+C`) → the AI button shows an offline message instead of hanging.

## 5. Image, export/import
- [ ] **⧉ Copy image** → paste into an image editor → the drawing (no overlay/handles) is on the clipboard.
- [ ] **↓ Export** → downloads `spell-drawing.json`.
- [ ] **↑ Import** that file into a cleared canvas → the strokes + placed symbols reappear.

## 6. Themes
- [ ] Switch brown / dark / light / arcane → whole UI retints, including **scrollbars** and dye swatches.
- [ ] Reload → the chosen theme persists (localStorage `wha-theme`).

## 7. Admin — auth (`/admin`, `/login`)
- [ ] Visiting `/admin` while logged out → redirected to `/login`.
- [ ] Wrong credentials → error shown, no access.
- [ ] Login `admin@local.dev / admin123` → reaches `/admin`. Sign out → back to `/login`.
- [ ] (If you can create a non-admin user) a `role='user'` cannot reach `/admin` (RLS blocks writes too).

## 8. Admin — Training
- [ ] Canvas is **compact** (not over-tall) and has the drawing tools.
- [ ] Color is **black/white** only.
- [ ] Symbol select shows **label first, then name** (e.g. `Fire (fire)`), grouped by kind.
- [ ] Draw → **Save sample** → "Sample saved"; the example count for that symbol increments.
- [ ] **+ Add new symbol** (name/kind/status/operator) → it appears in the select and is auto-selected.
- [ ] Live guess updates as you draw (once a few samples exist).

## 9. Admin — Registry
- [ ] Table lists symbols; filter by kind.
- [ ] Add / edit / delete a symbol; each action is reflected and logged (Review audit).

## 10. Admin — Review
- [ ] Each row shows a **short id** (full uuid on hover).
- [ ] **See** → a preview modal **replays** that sample's drawing from its points.
- [ ] **Delete** (single) → row marked deleted; **Restore** brings it back.
- [ ] **Rollback by date** soft-deletes samples after the cutoff (restorable).
- [ ] **Delete all by user** soft-deletes that user's samples.
- [ ] Audit log lists the actions you just took.

## 11. Data / DB integrity
```bash
# symbols seeded
curl -s "http://127.0.0.1:54321/rest/v1/symbols?select=kind" -H "apikey: <anon>" | (count → 85: 33 sigil + 52 sign)
```
- [ ] A `confirmed` training insert succeeds (it was rejected before the WS11a migration).
- [ ] Soft-deleted samples don't appear in `activeTemplates()` (the recognizer ignores them).

## 12. Edge cases to probe
- [ ] Analyze an **empty** canvas → no crash; sensible "nothing to analyze".
- [ ] Analyze with **only placed symbols** (no strokes) → composition built from placed only.
- [ ] Analyze with **only strokes** (no placed) → recognizer path only.
- [ ] Very **zoomed-in/panned** canvas → Detect overlays still align with the symbols.
- [ ] Import a **malformed** JSON → toast "Invalid drawing JSON", no crash.
- [ ] Run with the **DB stopped** → Studio still draws/detects (localStorage templates); admin shows graceful errors.
- [ ] Run with the **bridge stopped** → everything except the AI report works.
