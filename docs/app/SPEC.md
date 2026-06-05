# SPEC.md — Spell Studio development spec

> The build spec for the re-architecture in [APP-PLAN.md](APP-PLAN.md). Analyzes the **current**
> architecture, states exactly **what changes**, **what's new**, and breaks the work into ordered
> **workstreams** with file paths, data contracts and acceptance criteria. Branch: `feat/spell-studio`.

---

## 1. Current architecture (what exists today)

A single-page **Vite + React** app with **no router**; a giant `App.jsx` owns all state. The domain
logic is a **data-driven engine** of pure modules. Knowledge lives in `data/*.json` + `docs/`.

```
src/
  main.jsx                 React root (no router)
  App.jsx                  ⚠ MONOLITH: composition state, circles, selection, undo/redo,
                           import/export, image copy, all toolbar handlers
  index.css                ⚠ hardcoded "Atelier brown" theme (no theme system)
  components/
    Palette.jsx            sign/sigil picker (adds to active circle)
    GlyphCanvas.jsx        SVG renderer + drag/move of circles & parts (the authoring surface)
    Inspector.jsx          editor for the selected part (rotation/scale/invert/pin…)
    SpellTree.jsx          structure tree (circles/relations)
    InkPanel.jsx           dye/ink picker (color → dye)
    ResultPanel.jsx        analysis display + AI section (added; calls ai-bridge, plain text)
    DrawModal.jsx          ★ added: draw + $P recognizer + pipeline → composition (localStorage)
  draw/
    recognizer.js          ★ added: $P + spell pipeline (PURE, no JSON/DOM)
    templates.js           ★ added: template store (localStorage)
  engine/
    data.js                binds data/*.json (Vite imports) → SIGILS/SIGNS/DYES/maps
    analyze.js             orchestrator + catalog matcher (binds JSON)
    compose.js             PURE: per-circle analysis + multi-circle composition (v2)
    geometry.js            PURE: symmetry/zones/aim/spin/polar math
    deduce.js              PURE: deduceWith(grammar, maps, composition) → effect sentence
data/*.json                source of truth (rules, sigils, signs, dyes, grammar, spells, fact-caveats)
tools/
    spell-engine-cli.mjs   engine over a composition → --facts / --text / JSON (used by skills)
    ai-bridge.mjs          ★ added: local server, claude -p → AI analysis (/health, /analyze)
    render.mjs, vectorize-*, wha-lang*  (SVG render, PNG→path tracing, the authoring language)
test/*.test.js             node --test over the PURE modules + data integrity
```

### Responsibilities & invariants (must respect)
- **`composition` is the contract.** v2 shape: `{ name, circles:[{ id, center, radius, ring, core,
  components, dyes, inkColor }], relations }`. Both UI and engine speak it; `toComposition()` migrates
  v1→v2 and remaps. **The recognizer and Studio must produce this shape** (already do, single-circle).
- **Pure vs JSON-bound split** (tests run under plain `node --test`): `geometry.js`, `deduce.js`,
  `compose.js`, `recognizer.js` import **no JSON**; binding happens in `analyze.js`/`data.js`/CLIs.
  **Do not add JSON imports to the pure modules.** New pure logic stays pure; new tests inject data.
- **Engine runs client-side** — instant, no server. Keep it that way.
- **Adding a sign/sigil touches multiple JSONs** and is enforced by tests (operator coverage,
  element coverage, referential integrity). The Admin "add symbol" flow must not break these.

### Strengths to preserve
Data-driven engine · pure/testable core · single `composition` contract · client-side analysis ·
SVG symbol rendering + geometry helpers (reusable by the Studio) · the facts/CLI seam the skills use.

### Pain points the re-architecture fixes
`App.jsx` is a monolith (state not extractable) · no routing (can't add `/admin`) · no theme system
(brown hardcoded) · templates only in `localStorage` (no central training) · no auth/DB · the
authoring surface (`GlyphCanvas`, SVG drag-drop) is **not** a paint canvas with brush/shape tools ·
AI is a single blocking call rendered as plain text.

---

## 2. Gap analysis — keep / change / build

| Area | Today | Action |
|---|---|---|
| Engine (`geometry/deduce/compose/analyze`) | pure + data-bound, solid | **KEEP** (unchanged) |
| `data/*.json` | source of truth | **KEEP** + **seed** into Supabase `symbols` registry |
| Recognizer (`draw/recognizer.js`) | works, pure | **KEEP**; feed templates from DB |
| `templates.js` (localStorage) | local only | **CHANGE** → data service backed by Supabase (local cache fallback) |
| `ai-bridge.mjs` | one blocking `/analyze` | **CHANGE** → add `/report/stream` (SSE) + parallel topic jobs |
| `ResultPanel` AI section | plain text, one call | **CHANGE** → topic checklist + streaming cards + **Markdown** |
| `App.jsx` monolith | all state inline | **REFACTOR** → router + `StudioPage`/`AdminPage` + a `useSpell` store |
| `GlyphCanvas` (SVG drag-drop) | structured authoring | **KEEP** as the symbol/structure layer; reuse rendering + geometry |
| Drawing surface (paint tools) | — | **NEW** `StudioCanvas` (brush/line/square/triangle/circle/eraser) |
| `DrawModal` | modal w/ recognizer | **FOLD** into the Studio (training UI moves to Admin) |
| Theming | brown hardcoded | **NEW** CSS-var theme system (brown default + dark/light/arcane) |
| Color = dye | `InkPanel` exists | **WIRE** brush color → dye id → `composition.dyes` |
| Routing | none | **NEW** `react-router-dom` (Studio `/`, Admin `/admin`) |
| Auth | none | **NEW** Supabase Auth + route guards |
| Database | none | **NEW** Supabase (schema §6) local→prod |
| Admin (training + review) | prototype only | **NEW** training screen, registry CRUD, review/rollback |
| Improvement loop | manual | **NEW** review-packet export + Claude Code workflow |
| AI skill | `/spell-analyzer` (single) | **NEW** `/spell-report` (multi-topic prompt set) |

---

## 3. Target architecture (new layout)

```
src/
  main.jsx                 mount <AppRouter/>
  router.jsx               NEW routes: "/" Studio · "/admin/*" (guarded) · "/login"
  theme/
    themes.css             NEW 4 themes as [data-theme="…"] CSS-var blocks (brown default)
    ThemeProvider.jsx      NEW switch + persist (localStorage)
  state/
    useSpell.js            NEW composition store (extracted from App.jsx: state + actions + undo)
  studio/
    StudioPage.jsx         NEW main screen (canvas + tools + palette + analyze + results)
    StudioCanvas.jsx       NEW paint+symbol canvas (strokes layer + placed-symbol layer)
    tools/                 NEW brush, line, rect, triangle, circle, eraser, select (stroke emitters)
    ToolDock.jsx           NEW tool + color(dye) + brush-size UI
    drawingModel.js        NEW PURE: { strokes, placed, ring, dyes } → composition mapping
  draw/                    KEEP recognizer.js; templates.js → re-point to data service
  admin/
    AdminPage.jsx          NEW shell (auth-gated): Training · Registry · Review tabs
    TrainingView.jsx       NEW canvas-in-training-mode + registry select/add + save sample
    RegistryView.jsx       NEW symbols CRUD (canon/fan + operator semantics)
    ReviewView.jsx         NEW samples table + rollback-by-date + delete-by-user + audit
  data-services/
    supabase.js            NEW supabase-js client (env-config)
    symbols.js             NEW registry queries (list/add/edit)
    samples.js             NEW training read (templates) / write / soft-delete / rollback
    analyses.js            NEW log analyses; export review packet
    auth.js                NEW login/logout/session/role
  ai/
    report.js              NEW client: open SSE to /report/stream, dispatch cards
  components/              KEEP (GlyphCanvas, Inspector, SpellTree, InkPanel, Palette, ResultPanel*)
tools/
  ai-bridge.mjs            CHANGE: + /report/stream (SSE, parallel topics)
  review-packet.mjs        NEW: bundle analyses/corrections → docs/review/packet-<date>.{json,md}
supabase/                  NEW: config.toml + migrations/*.sql + seed.sql (CLI-managed)
.claude/skills/spell-report/ NEW skill: topic definitions + prompt templates
```

---

## 4. Workstreams (ordered, each independently shippable)

> Each WS lists **goal · files · depends-on · acceptance**. WS map to plan phases A–I.

### WS0 — Project scaffolding (refactor)  *(plan A)*
- **Goal:** add routing + theme system + lift composition state out of `App.jsx` without behavior change.
- **Files:** `router.jsx`, `theme/*`, `state/useSpell.js`; refactor `App.jsx` → `studio/StudioPage.jsx`.
- **Acceptance:** existing app works at `/`; switching theme persists; `npm run build` + 77 tests green.

### WS1 — Studio canvas + paint tools  *(plan A)*
- **Goal:** near-fullscreen canvas; tools **brush/line/square/triangle/circle/eraser/select**; each
  shape tool emits a clean **stroke** (point list); color picker = **dyes**; place signs/sigils from
  palette as **known** symbols; build `composition` via `drawingModel.js`.
- **Files:** `studio/StudioCanvas.jsx`, `studio/tools/*`, `studio/ToolDock.jsx`, `studio/drawingModel.js`.
- **Depends:** WS0. Reuse `components/GlyphCanvas` symbol rendering + `engine/geometry`.
- **Acceptance:** draw freehand + shapes + place symbols; `drawingModel.js` (PURE, unit-tested) yields a
  valid v2 `composition`; engine `analyze()` runs on it live.

### WS2 — Analyze: recognition + engine reading  *(plan B)*
- **Goal:** Analyze button → placed symbols (known) + drawn strokes (recognizer) → composition →
  engine analysis; "Identified" panel per symbol with confidence + **correction** control.
- **Files:** wire `draw/recognizer.js`; `studio/IdentifiedPanel.jsx`; extend `ResultPanel`.
- **Depends:** WS1. Templates initially from `localStorage`, later DB (WS4).
- **Acceptance:** drawing a Pyreball-shaped seal yields `fire` + 4×`levitation`; corrections re-label
  and are queued as training candidates.

### WS3 — Supabase data layer  *(plan C)*
- **Goal:** local Supabase (Docker) up; schema §6 + RLS; `supabase.js` client; seed `symbols` from
  `sigils.json`/`signs.json`; `.env` (gitignored).
- **Files:** `supabase/config.toml`, `supabase/migrations/0001_init.sql`, `supabase/seed.sql`,
  `data-services/supabase.js`, `.env.example`, `.gitignore` update.
- **Depends:** Docker running. **Decision:** Supabase (locked).
- **Acceptance:** `npx supabase start` boots; tables + RLS exist; registry seeded; client reads symbols.

### WS4 — Templates from DB  *(plan C)*
- **Goal:** recognizer templates come from `training_samples` (active) via `data-services/samples.js`;
  `templates.js` becomes a thin cache over it (offline fallback to localStorage).
- **Depends:** WS3. **Acceptance:** templates trained in Admin appear in Studio recognition.

### WS5 — Auth + Admin shell  *(plan D)*
- **Goal:** Supabase Auth login; `/admin/*` guarded by `role='admin'`; seed first admin.
- **Files:** `data-services/auth.js`, `admin/AdminPage.jsx`, route guards in `router.jsx`, `/login`.
- **Depends:** WS3. **Acceptance:** non-admin can't reach `/admin` (UI **and** RLS); admin can.

### WS6 — Training + Registry (Admin)  *(plan D)*
- **Goal:** canvas-in-training-mode → **select** symbol from registry **or add new** → save
  `training_sample` (user id + timestamp); registry CRUD (canon/fan + operator semantics).
- **Files:** `admin/TrainingView.jsx`, `admin/RegistryView.jsx`, `data-services/symbols.js`, `samples.js`.
- **Depends:** WS5, WS4. **Acceptance:** saving a sample writes with `created_by`+`created_at`; new
  symbol insert keeps engine integrity (warn if `engine_id` missing for canon).

### WS7 — Training review / governance (Admin)  *(plan E)*
- **Goal:** samples table filter by user/date; **rollback-by-date** + **delete-by-user** (soft-delete,
  restorable); audit log.
- **Files:** `admin/ReviewView.jsx`, `data-services/samples.js` (+ `audit`).
- **Depends:** WS6. **Acceptance:** rollback soft-deletes by cutoff and is reversible; deletions logged.

### WS8 — AI report: streaming, multi-topic  *(plan F)*
- **Goal:** `/spell-report` skill (topic prompts, §4.1 of plan); `ai-bridge` `/report/stream` (SSE)
  runs selected topics **in parallel**, streams each result; UI topic **checklist (all on)** + **loading
  cards** that fill as jobs return; render **Markdown**.
- **Files:** `.claude/skills/spell-report/SKILL.md`, `tools/ai-bridge.mjs` (+SSE), `ai/report.js`,
  `ResultPanel` AI cards + `react-markdown`.
- **Depends:** WS2. **Acceptance:** picking topics renders N cards; each fills independently; bridge
  detected via `/health`; offline → graceful message.

### WS9 — Improvement loop  *(plan G)*
- **Goal:** `tools/review-packet.mjs` bundles recent `analyses`/corrections → `docs/review/packet-*.{json,md}`;
  a documented Claude Code workflow proposes diffs (catalog/grammar/lexicon/rules); optional `/schedule`.
- **Files:** `tools/review-packet.mjs`, `docs/review/README.md`.
- **Depends:** WS2/WS7. **Acceptance:** packet builds from logged data; a dry-run session produces a
  concrete proposal; nothing auto-merges.

### WS10 — Prod readiness  *(plan H, deferred)*
- Seed templates from SVGs; hosted Supabase push (`supabase db push`); Vercel deploy; AI via tunnel
  (cloudflared/ngrok) → local bridge, BYO-key path stubbed. *(Not now — local-only until functional.)*

---

## 5. Data contracts

### 5.1 Drawing model (Studio internal) → composition
```js
// StudioCanvas state (PURE-mappable by drawingModel.js)
{ strokes:[ { tool:'brush'|'line'|'rect'|'triangle'|'circle', color, width, points:[{x,y}] } ],
  placed:[ { id, kind:'sign'|'sigil', x, y, rotation, scale } ],
  ringStroke?: {...}, dyes:[dyeId] }
// → drawingModel.toComposition(model, recognized) →  wha-spell@2 (existing shape)
```
- Brush color → dye id via the existing color→dye map (`InkPanel`/`COLOR_TO_DYE`); collected into
  `circle.dyes`. Visual + engine-aware, optional.

### 5.2 Endpoints (ai-bridge)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ ok, claude, port }` *(exists)* |
| POST | `/analyze` | `{ composition }` | `{ ok, analysis, facts }` *(exists)* |
| POST | `/report/stream` | `{ composition, topics[] }` | **SSE**: `event: topic` → `{ id, markdown }` per job |

### 5.3 Supabase schema  →  see [APP-PLAN.md §5.1](APP-PLAN.md). Tables: `profiles`, `symbols`,
`training_samples` (soft-delete), `analyses`, `audit_log`, (`spells` later). RLS: admin-only writes to
`symbols`/`training_samples`; users read public + own; analyses owned by creator.

---

## 6. Refactor steps for existing code (order)

1. **Extract state:** move composition state + actions (add/move/edit/undo/import/export) from
   `App.jsx` into `state/useSpell.js` (context + reducer). `App.jsx` becomes `StudioPage.jsx`.
2. **Add router** (`react-router-dom`); mount `StudioPage` at `/`. No behavior change.
3. **Theme extraction:** pull hardcoded colors in `index.css` into `theme/themes.css` as a `brown`
   default block; add `dark`/`light`/`arcane`; `ThemeProvider` toggles `data-theme`.
4. **Templates indirection:** `templates.js` API stays, implementation swaps to `data-services/samples.js`
   (DB) with localStorage fallback — recognizer untouched.
5. **AI section:** `ResultPanel` AI → `ai/report.js` + Markdown + topic cards.
6. `DrawModal` logic folds into `StudioCanvas` (free-draw) + Admin `TrainingView` (train); retire modal.

> Guardrail: keep `geometry.js`/`deduce.js`/`compose.js`/`recognizer.js`/`drawingModel.js` **JSON-free
> and DOM-free** so the `node --test` suite keeps running. Bind data in services/pages only.

---

## 7. Dependencies to add

| Dep | Why | Scope |
|---|---|---|
| `react-router-dom` | Studio vs Admin routing | prod |
| `@supabase/supabase-js` | DB + Auth client | prod |
| `react-markdown` | render AI report cards | prod |
| `supabase` (CLI) | local stack + migrations | dev |
| *(state: native React context — no lib)* | composition store | — |

---

## 8. Testing

- **Keep** `node --test` over pure modules + data integrity (must stay green throughout).
- **Add** pure tests: `drawingModel.toComposition` (model→v2), recognizer pipeline on synthetic
  strokes, `review-packet` builder.
- **DB:** lightweight integration tests against local Supabase (optional, gated; not in the pure suite).
- **Manual:** see [TEST-PLAN.md](TEST-PLAN.md) for the UI/integration checklist.

---

## 9. Delivery order & status

| WS | Plan phase | Blocks on | Status |
|---|---|---|---|
| WS0 scaffolding | A | — | todo |
| WS1 studio canvas | A | WS0 | todo |
| WS2 analyze+recognize | B | WS1 | partial (recognizer + bridge done) |
| WS3 supabase | C | Docker | todo (Docker installed, daemon off) |
| WS4 templates from DB | C | WS3 | todo |
| WS5 auth+admin shell | D | WS3 | todo |
| WS6 training+registry | D | WS5,WS4 | todo |
| WS7 review/governance | E | WS6 | todo |
| WS8 AI streaming report | F | WS2 | todo (bridge `/analyze` done) |
| WS9 improvement loop | G | WS2/WS7 | todo |
| WS10 prod | H | functional app | deferred |
| WS11a contribute fix | — | WS6 | todo (Phase 1 DB fix — see [SPEC-cluster-recognition.md](specs/SPEC-cluster-recognition.md)) |
| WS11b cluster recognition | — | WS11a | todo (Phase 2 — see [SPEC-cluster-recognition.md](specs/SPEC-cluster-recognition.md)) |

**Already built on this track:** `draw/recognizer.js`, `draw/templates.js`, `components/DrawModal.jsx`,
`tools/ai-bridge.mjs` (`/health`+`/analyze`, validated end-to-end), `docs/DRAWING-APP.md`, `docs/APP-PLAN.md`.

---

## 10. Risks & open decisions
- **Monolith refactor risk** — extract `useSpell` carefully; lean on the build + existing tests as a net.
- **Shape-tool vs hand-drawn templates** — train both forms or normalize before `$P`.
- **Engine integrity on fan symbols** — Admin "add symbol" must capture operator semantics or mark the
  symbol non-analyzable; never silently break the coverage tests.
- **Supabase free-tier idle pause** (prod, later); **prod AI via tunnel** legitimacy (you-only).
- **Open:** hosting region, Vercel vs Netlify, tunnel tool — all WS10 (deferred).
