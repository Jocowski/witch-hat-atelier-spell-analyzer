# Current Architecture Specification

> **Status:** Discovery / assessment only — **no refactor proposed.**
> **Date:** 2026-06-06
> **Scope:** Full-system architectural discovery of the *Witch Hat Atelier* Spell Analyzer / Spell Studio.
> **Method:** Static read of the repository (source, data, tooling, Supabase migrations, agent/skill/MCP config). No code was changed.

This document describes the system **as it actually is today**, not as documented elsewhere. Where the live code diverges from `CLAUDE.md` / `docs/app/SPEC.md`, the divergence is recorded under **Technical Debt** and **Open Questions** rather than silently reconciled.

---

## 1. Executive Summary

The project is a **single-page web application** ("Spell Studio") that lets a user *draw* a magic seal from the manga *Witch Hat Atelier*, **recognizes** the drawn sigils/signs into a structured composition, **validates and deduces** the spell's effect from a first-principles rules engine, optionally renders a **live particle "cast"** of the effect, and (in dev) streams a **multi-topic AI report** reasoned by Claude. An **Admin** surface (training, symbol registry, image tracing, sample review) feeds an improvement flywheel backed by **Supabase**.

Key architectural facts:

- **Frontend:** React 18 + Vite 5, **no router at the app root** — `main.jsx` renders `StudioPage` directly; admin is reached through a capability-gated overlay that uses a `MemoryRouter`. (This contradicts `CLAUDE.md`, which still describes a `router.jsx`.)
- **Engine:** A set of **pure, JSON-injected** modules (`geometry.js`, `deduce.js`, `compose.js`, `match.js`, `ir.js`, `symbolMerge.js`) plus thin JSON-binding modules (`data.js`, `analyze.js`, `symbolStore.js`). The pure/bound split exists specifically so `node --test` can run without import-attribute support.
- **Data-driven:** Almost all domain knowledge lives in `data/*.json` (26 sigils, 36 signs, 60 spells, 8 dyes, 36 grammar operators, 15 elements, 16 interactions). A runtime **DB overlay** can edit symbols live for authenticated users.
- **Recognizer:** An in-house **$P point-cloud recognizer** (pure `recognizer.js`) is the default ("p") engine; an **optional ONNX/ML engine** ("ml") exists behind a lazy seam and is **not** the default.
- **Backend:** Supabase (Postgres + Auth + RLS) with 11 migrations. The app **degrades gracefully to fully anonymous, zero-network** operation when Supabase env vars are absent.
- **AI:** A **local Node bridge** (`tools/ai-bridge.mjs`) shells out to the `claude` CLI (`claude -p`) — no API token cost. Gated off in the published build by a build-time constant.
- **Agents/Skills/MCP:** Three project-local Claude **skills** (spell-analyzer, spell-creator, spell-idea) drive a doc-writing/analysis flywheel; two **vendored Supabase skills**; one **Supabase MCP** server (`.mcp.json`). There is **no runtime agent orchestration inside the app** — agents are author-time tooling.

Overall the system is **mature, well-tested (40+ test files), and unusually disciplined about purity and graceful degradation**, but it carries notable drift between documentation and the live entry/routing layer, several very large files (`DrawingSurface.jsx` 1466 LOC, `StudioPage.jsx` 912 LOC), and dead route-guard components.

---

## 2. Product Overview

### 2.1 Problem solved

*Witch Hat Atelier* has a rule-based magic system: a caster draws a **circular seal** containing a central **sigil** (the substance/element) surrounded by **signs** (operators that shape it), mixes magical **dyes** into the ink, and closes a **ring** to activate it. The app lets a fan:

1. **Compose** such a seal by drawing it freehand (or placing catalogued symbols).
2. Get it **recognized** into a structured, machine-readable composition.
3. **Validate** it against the system's rules (is it stable? does it have a core? is it forbidden?).
4. **Deduce the effect** of *any* composition — including novel ones never shown in the manga — from first principles.
5. **Compare** it to the closest canon spell.
6. **See it cast** as an animated effect.
7. (dev) Get an **AI-reasoned analysis** grounded in the repo's canon docs.

### 2.2 Primary users

| User | Surface | Capability gate |
|------|---------|-----------------|
| **Anonymous visitor** | Studio (draw → detect → analyze → cast) | none — zero Supabase calls |
| **Invited / authenticated user** | Studio + DB-training toggle + contribute samples (held for review) | `isAuthed` |
| **Admin** | Everything + Admin overlay (Training, Registry, Trace, Review) | `role === 'admin'` |
| **Developer / maintainer** | CLI tools, AI bridge, ML toolchain, Claude skills | local only |

### 2.3 Core features

- Freehand drawing canvas (react-konva) with full paint toolset, undo/redo, pan/zoom, dyes.
- $P stroke recognition → composition, with correctable detection overlays.
- Rules engine: validity, sigils, signs, deduced effect, similar-spell match, forbidden-magic flag, dyes, geometry analysis.
- Live "Spell Trial" particle renderer (canvas-2D effects per element family).
- Flow visualization (per-sign direction/force vectors, einlair flow model).
- Export/import drawing JSON; copy canvas as image.

### 2.4 Non-core / secondary features

- AI multi-topic streaming report (dev-only, gated).
- Admin training flywheel + symbol registry overlay + image tracing.
- ML (ONNX) recognizer engine (optional, off by default, partly experimental).
- Theming (4 themes).
- Responsive/mobile layout (bottom-sheet palette, Draw⇄Cast toggle).

### 2.5 Workflow inventory

1. **Compose → Detect → Analyze → Cast** (main loop, `StudioPage`).
2. **Auto-analyze** (debounced re-detect+re-cast on every drawing change; engine+render only, no logging/AI).
3. **Correct a detection** → records a correction → re-analyzes → feeds the improvement loop.
4. **Contribute samples to training** (currently **parked**: `SPELL_TRAINING_ENABLED = false` in `StudioPage.jsx`).
5. **Admin training:** draw → label → save a `training_sample`.
6. **Admin registry:** CRUD a symbol that overlays the JSON baseline live.
7. **Admin trace:** upload/draw an image → vectorized `svgPath`.
8. **Admin review:** filter / verify / rollback / soft-delete samples.
9. **Author-time (Claude skills):** analyze / create / brainstorm spells → write docs to `docs/spells/`.
10. **CLI:** `--facts` / `--text` / `render` / `vectorize` / `bench:accuracy` / `flag:impact`.

---

## 3. Architecture Overview

### 3.1 Architectural style

- **Client-heavy SPA** with a **pure functional core** (the engine) wrapped by thin data-binding adapters.
- **Data-driven**: behavior is configuration (`data/*.json`) + a runtime DB overlay, not hardcoded logic.
- **Capability-gated unified build**: one static bundle serves anonymous, authed, and admin users; features appear by runtime predicate (`capabilities.js`) and build-time constants (`aiEnabled`).
- **Graceful degradation everywhere**: no Supabase → anonymous JSON-only; no AI bridge → AI tab hidden; no Worker → sync recognizer; no Python/ONNX → $P engine.

### 3.2 High-level diagram (current)

```
                          ┌──────────────────────────────────────────────┐
 Browser (Vite SPA)       │  main.jsx                                      │
                          │   └─ ThemeProvider → AuthProvider → StudioPage │
                          └──────────────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼───────────────────────────────────────┐
        ▼                                 ▼                                          ▼
  DrawingSurface (konva)          Recognizer ($P / ml seam)                  Engine (pure core)
  - strokes, dyes, symbols        recognizer.js  ─► composition              analyze() → sections
  - overlays/vectors              recognizerEngine.js (engine seam)            ├ compose.js (per-circle + relations)
  - copy/export                   useRecognizerWorker (Worker offload)         ├ deduce.js (effect sentence)
        │                         mlRecognizer.js (lazy ONNX)                  ├ geometry.js (polar/flow/IR math)
        │                                                                      ├ match.js (catalog matcher)
        ▼                                                                      ├ ir.js (numeric SpellIR)
  SpellTrial / EffectCanvas  ◄──── SpellIR shim ◄──────────────────────────────┘ symbolStore⊕symbolMerge (overlay)
  (canvas-2D particle effects)                                                       │
        │                                                                            ▼
        │                                                                       data/*.json (source of truth)
        ▼
  ResultPanel / FlowPanel / AIReportPanel(dev)

  ── side channels ───────────────────────────────────────────────────────────────────────────
  data-services/* ──► Supabase (Auth, profiles, symbols, training_samples, analyses,
                                 audit_log, symbol_prototypes, web_submissions) [optional]
  src/ai/report.js ──► tools/ai-bridge.mjs ──► `claude -p` ──► spell-engine-cli --facts/--text [dev]
  Admin overlay (ConfigPanel → AdminOverlay → MemoryRouter → AdminPage)            [admin only]
```

### 3.3 Folder responsibility matrix

| Path | Responsibility | Purity / coupling |
|------|----------------|-------------------|
| `data/` | Source-of-truth JSON (rules, sigils, signs, spells, dyes, grammar, training-seed, fact-caveats) | data only |
| `src/engine/` | Validation, deduction, geometry, matching, IR, symbol overlay | **mixed**: pure modules + JSON-bound modules (deliberate split) |
| `src/draw/` | $P recognizer, ring closure, rasterization, embeddings, ML engine, seed templates, SVG path | mostly pure; `mlRecognizer.js` impure (ONNX) |
| `src/studio/` | The Studio UI: canvas, palette, panels, tools, render pipeline, hooks | React + heavy I/O |
| `src/studio/render/` | Canvas-2D particle effect renderer + per-element effects + IR shim | pure-ish render math + canvas |
| `src/admin/` | Auth provider, admin shell + 4 views, login/guard (some dead) | React + Supabase |
| `src/data-services/` | Supabase client + table adapters (auth, profiles via auth, symbols, samples, analyses, audit, prototypes) | I/O; all degrade to no-op without Supabase |
| `src/ai/` | Browser SSE client for the AI bridge + report cache | I/O |
| `src/app/` | Capability gates + viewport hook | pure + React |
| `src/theme/` | Theme provider/switcher + CSS-variable themes | React + CSS |
| `src/components/` | `ResultPanel.jsx` only (last survivor of the legacy editor) | React |
| `tools/` | CLI: AI bridge, engine CLI, vectorizers, accuracy/bench, render, seed builders, lab HTML | Node scripts |
| `ml/` | Dev-only Python siamese-encoder training toolchain (never imported by app/CI) | isolated |
| `supabase/` | `config.toml`, 11 migrations, `seed.sql` | schema |
| `docs/` | Canon source, first-principles CORE, lexicon, IR spec, per-spell docs, app specs | docs |
| `.claude/skills/` | 3 project Claude skills (analyzer/creator/idea) | author-time agents |
| `test/` | 40+ `node --test` suites over pure modules + tools | tests |

### 3.4 Dependency map (module → key imports)

```
analyze.js  → data.js, symbolStore.js, match.js, compose.js, geometry.js, ir.js
compose.js  → geometry.js, deduce.js                      (PURE)
deduce.js   → geometry.js                                 (PURE, no JSON)
geometry.js → (none)                                      (PURE, no JSON)
match.js    → geometry.js                                 (PURE)
ir.js       → geometry.js                                 (PURE)
data.js     → data/rules,spells,dyes (JSON) + symbolStore.js
symbolStore.js → data/sigils,signs,grammar (JSON) + symbolMerge.js
symbolMerge.js → (none)                                   (PURE, no JSON)
recognizer.js → ringClosure.js, geometry.js(directedAxisFacing) (PURE, no JSON)
recognizerEngine.js → dynamic import ./mlRecognizer.js (only when engine==='ml')
StudioPage.jsx → engine/*, draw/recognizer, data-services/*, studio/*, app/*, data/rules.json
```

**Critical invariant (enforced by tests + comments):** `geometry.js` and `deduce.js` (and the other "pure" modules) **must not import JSON** — Node's `node --test` cannot load `import x from './x.json'` without import attributes, while Vite uses the plain form. JSON binding is confined to `data.js` / `analyze.js` / `symbolStore.js`.

---

## 4. Domain Model

### 4.1 Core concepts

| Concept | Definition | Where modeled |
|---------|-----------|---------------|
| **Sigil** | The *substance* / element at the seal's center (e.g. Fire, Water). 26 records. Has `family`, `element`, `svgPath`, optional `lifecycle`. | `data/sigils.json` |
| **Sign** | An *operator* shaping the substance. 36 records. Has `family` (directional / semi-directional / non-directional / asymmetric / unknown / other), `effectTags`, `invertible`, `canBeCenter`, `surrounds`. | `data/signs.json` |
| **Element** | Physical material a sigil provides; carries `substance`, `raw`, `state` (fluid/granular/rigid), `capability` (create/manipulate/collect). 15 elements. | `data/grammar.json.elements` |
| **Operator** | A sign's deduction behavior: `kind` (form/transmute/motion/direction/target/power/support/special), `verb`, `invertedVerb`, `directional`, `container`. 36 operators. | `data/grammar.json.operators` |
| **Interaction** | Synergy/warning rule with a `when` predicate over present types/element/core. 16 rules. | `data/grammar.json.interactions` |
| **Dye** | Magical ink modifier (kind/color/effect + numeric `modifier`). 8 dyes. | `data/dyes.json` |
| **Ring** | The activation circle. `closed` activates the spell; radius scales power. | composition |
| **Composition** | The UI↔engine contract. v1 = single circle (`core/components/ring/dyes`); v2 = `{circles[], relations[]}`. | `compose.js` |
| **Circle** | A self-contained single-ring seal (a v1 composition); v2 spells nest/link circles. | `compose.js` |
| **Relation** | `nest` (outer/inner) or `link` (a/b) between circles. | `compose.js`, `recognizer.js` |
| **Spell (catalog recipe)** | A known recipe for the matcher with `composition`, `effect`, `category`, `confidence`, `origin` (canon/wiki/fan), `source`. 60 records, all `wiki`. | `data/spells.json` |
| **SpellIR** | Numeric effect intermediate (force/spread/focus/range/duration/stability/gravity/dirCoherence/direction[+tilt]) consumed by the renderer. | `ir.js` |
| **Training sample** | One drawn glyph example (points + role + source + verified + weight) → recognizer template. | Supabase `training_samples` |
| **Symbol (registry row)** | DB row that overlays a JSON sigil/sign (presentation + semantics) live. | Supabase `symbols` |
| **Analysis** | Logged composition + engine result + ai report + corrections (improvement loop). | Supabase `analyses` |
| **Profile / Role** | App user mirror of `auth.users` with `user`/`admin` role. | Supabase `profiles` |
| **Prototype** | Per-symbol ML embedding vector per model version. | Supabase `symbol_prototypes` |

### 4.2 Entity relationships

```
auth.users 1──1 profiles 1──* training_samples *──1 symbols 1──* symbol_prototypes
                  │                                   │
                  ├──* analyses                       └─(engine_id) ⇢ overlays sigils.json/signs.json
                  └──* audit_log

composition (v2) ── circles[1..n] ── { core: sigil?, components: (sign|sigil)[], dyes[] }
                  └ relations[] (nest outer/inner | link a/b)

spell (catalog) ── composition recipe ── matched against built signature (match.js)
```

### 4.3 Ownership / source-of-truth matrix

| Data | Version-controlled canon | Runtime overlay | Owner |
|------|--------------------------|-----------------|-------|
| Sigils / signs / grammar | `data/*.json` (baseline) | `symbols` table via `symbolMerge` (authed) | JSON is canon; DB only overlays |
| Rules / spells / dyes | `data/*.json` (static) | none | JSON only |
| Recognizer templates | `seedTemplates()` bundled seed (floor) | `training_samples` (verified, additive) | seed is floor; DB augments |
| ML model + prototypes | `src/draw/ml-assets/*` committed | `symbol_prototypes` table (flywheel) | committed baseline + DB |
| Spell docs | `docs/spells/*.md` | — | author/skills |

---

## 5. React Analysis

### 5.1 Component hierarchy (live)

```
main.jsx
└ ThemeProvider
  └ AuthProvider                         (Supabase session + role context)
    └ Root (calls loadDbSymbols only when session present)
      └ StudioPage                       (912 LOC — the orchestrator)
        ├ ThemeSwitcher
        ├ DrawingSurface (forwardRef)    (1466 LOC — konva canvas, tools, export)
        ├ SpellTrial → EffectCanvas      (particle render)
        ├ SymbolPalette                  (desktop rail / mobile bottom-sheet)
        ├ Results drawer (tabs):
        │   ├ IdentifiedPanel            (detected rows: relabel/merge/beautify/erase)
        │   ├ FlowPanel                  (vector flow)
        │   ├ ResultPanel                (engine sections)
        │   └ AIReportPanel (lazy, dev)  (SSE topic cards)
        └ ConfigPanel
            └ AdminOverlay (lazy) → MemoryRouter → AdminPage
                 ├ TrainingView · RegistryView (SymbolEditor) · TraceView · ReviewView (SamplePreview)
```

### 5.2 Routing architecture

- **App root has no router.** `main.jsx` renders `StudioPage` directly.
- Admin is an **overlay**, not a route: `ConfigPanel` (gated by `canOpenAdmin`) lazy-loads `AdminOverlay`, which wraps `AdminPage` in a **`MemoryRouter`** so `AdminPage`'s `useNavigate()`/`Link` work **without touching the browser URL** (avoids GitHub Pages SPA 404s).
- `react-router-dom` is therefore used only *inside* the admin subtree.
- **Dead route components:** `src/admin/RequireAdmin.jsx` and `src/admin/LoginPage.jsx` document a `router.jsx` that no longer exists; they appear unused by the live tree (gating moved to `capabilities.js`).

### 5.3 State management patterns

- **No global state library.** State is:
  - **React Context** for cross-cutting concerns: `AuthProvider` (session/role), `ThemeProvider`.
  - **External store via `useSyncExternalStore`-style subscription** for symbol data: `symbolStore.js` holds the snapshot; `useSymbolData()` subscribes; `data.js` exposes **live `let` bindings** re-pointed on overlay change.
  - **Local component state** for everything else; `StudioPage` is a large `useState`/`useRef`/`useCallback` hub (≈20 state slots).
  - **`localStorage`** for UI persistence (drawer height/collapsed, auto-analyze, gating, training toggles, theme).
- Recognition runs in a **Web Worker** (`useRecognizerWorker`) with a synchronous fallback; a **generation counter** drops superseded auto-analyze runs.

### 5.4 Hooks usage

Custom hooks: `useAuth`, `useCapabilities`, `useSymbolData`, `useTemplates`, `useRecognizerWorker`, `useViewport`. Mostly small and focused. `StudioPage` uses `useMemo` for cloud building and renderer config to avoid expensive rebuilds on unrelated re-renders (noted explicitly in comments — e.g. hover shouldn't flush particles).

### 5.5 Evaluation

| Axis | Assessment |
|------|-----------|
| **Coupling** | Engine ↔ UI is **clean** (composition contract + sectioned result). Within the UI, `StudioPage` is a **god component** coupling drawing, recognition, analysis, render, dye logic, training contribution, and layout. |
| **Reusability** | Pure engine + render math are highly reusable (shared by CLI/tests). `DrawingSurface` is a reusable ref-API canvas. UI panels are reasonably modular. |
| **Maintainability** | Strong: heavy purposeful comments, tests, graceful degradation. Weakened by the two oversized files and doc drift. |
| **Scalability** | Recognition offloaded to a Worker; bundle split into cacheable chunks; ONNX kept in a lazy chunk; AI chunk tree-shaken in prod. Good. |

---

## 6. Spell Engine Specification

### 6.1 Entry point

`analyze(input)` (`engine/analyze.js`) accepts a v1 composition or a v2 `{circles, relations}` and returns sectioned results consumed by `ResultPanel`:

```
{ name, valid, active, status, issues[], sigils[], signs[],
  deduction, similar, forbidden, dyes[], analysis,
  circles[], relations, combined, spellIR, perCircle? }
```

Per call it rebuilds engine deps from the **current symbol snapshot** (baseline ⊕ overlay) so admin edits take effect without reload.

### 6.2 Pipeline

1. **Normalize** input to v2 (`toComposition`) — v1 becomes one circle; ring-anchored components resolved to x/y.
2. **Per-circle analysis** (`analyzeCircleWith`):
   - Promote a center-capable sign to effective core if no sigil core (Billow Cluster case).
   - **Zone-tag** every component (`inside`/`ring`/`outside`); outside marks never steer the spell.
   - **Geometry**: symmetry, power, spin (tangential cant), region/lift/form-direction aim, directional bias.
   - **Validity issues** (blocking/warning/info): no core, empty closed ring → explosion, asymmetry instability, aim, tilt/spin, external marks.
   - **Deduction** (`deduceWith`): substance(s) → primary clause (transmute > form > raw element) → direction → motion/support/special/power/target → interactions → stability/power labels. Produces a human sentence + per-part breakdown + notes/warnings.
   - **Magnitude accumulator**: ring size → sigil size → dyes → `{power, duration, params}`.
3. **Multi-circle**: reclassify coreless circles (boundary/modifier) via the relations graph; `composeWith` narrates nesting (inner active only when outer ring closed) + links (identical linked seals stack power); combined SpellIR is the conservative summary.
4. **Catalog match** (`match.js`): build a zone-aware **signature** (core/element + sign multiset + symmetry), score each catalog spell (weighted sigil/sign-set/symmetry match × confidence weight), threshold from `rules.matching.threshold` (0.7). Surfaces match + nearest + `parts` (why).
5. **Forbidden check** (`computeForbidden`): matched-recipe forbidden flag, or any part carrying a configured forbidden `effectTag`.
6. **SpellIR** (`ir.js`): numeric effect (force/spread/focus/range/duration/stability/gravity/dirCoherence) + 3D direction with force-driven tilt; container (orb) and inverted-column (radial spread) overrides.

### 6.3 Geometry model (`geometry.js`)

- Polar convention: **0° = north, clockwise**, `atan2(x, -y)`. (Documented past bug: `computeDirectionalBias` must use `atan2(vx, -vy)`.)
- Sign-category semantics: only **directional** signs steer (`canSteer`); **directional + semi-directional** can invert (`canInvert`); rotation/inversion meaning is category-driven.
- **einlair flow model** (`computeColumnFlow`): treats directional signs as flow vectors; radial resultant R exits in-plane, cancelled flow U is forced out-of-plane (upward jet), signed flux distinguishes inward (basic) from inverted (radial spread). Backed by `docs/theories/einlair-vector-analysis`.
- **Containment model** (`computeContainment`): orb form signs define a vessel filled by upward flow.
- `directedAxisFacing` derives a sign's facing from drawn geometry via PCA (used by the recognizer, not template rotation).

### 6.4 Recognition flow (`draw/recognizer.js`)

PURE module, no JSON/DOM. Pipeline: detect ring(s) (circle-score heuristic + optional flood-fill closure confirmation) → segment strokes into groups (adaptive gap) → classify core vs sign (innermost within 0.45·R = core) → role-split template pools → cheap **coarse pre-filter** (top-K, rotation-tolerant) → **$P greedy match over a rotation sweep** → confidence% gate → extract directional-magnitude metric. Supports **single-ring** (legacy back-compat) and **multi-ring** (nest/link relation extraction) paths, emitting a `wha-spell@1`/`@2` composition. Templates are weighted (`adjDist = dist/weight`) so corrections/verified samples win close calls.

### 6.5 Engine seam (`recognizerEngine.js` + `mlRecognizer.js`)

`recognizeWithEngine({strokes, opts, runP})` routes on `opts.engine`: `"p"` runs the caller's $P callback; `"ml"` **lazily** imports `mlRecognizer.js` (ONNX, prototypes) so `onnxruntime-web` never loads for $P users. Default is `"p"` (`rules.recognition.engine`).

### 6.6 Rendering pipeline (`studio/render/`)

`buildSpellIRShim(result, ringClosed, t0, {direction, duration, power})` → `SpellTrial`/`EffectCanvas` → `SpellEffectRenderer` dispatches per-element canvas-2D effects (fire/water/earth/light/wind/radialSpread). Dyes modulate the render (Azuremoon → 2× duration, Blood → 4× power, Blushing-Bride → hidden strokes, Golden-Blaze → glow layer). Direction comes from the einlair flow mapped to a 3D vector with foreshortening.

### 6.7 Data structures

- **Composition** (v1/v2) — UI↔engine contract (see §4.1).
- **Signature** — matcher recipe (core/element + sign multiset + symmetry).
- **SpellIR** — numeric effect for the renderer.
- **Cloud / template** — `$P` normalized point cloud (32 points, scaled-to-square, origin-translated) with role/weight/coarse descriptor.

---

## 7. Supabase Architecture Specification

### 7.1 Client

`data-services/supabase.js` constructs the browser client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. When absent, `supabase === null` and `hasSupabase() === false`; **every** data-service function early-returns a safe no-op (`[]`, `{}`, or `null`). Anonymous visitors make **zero** Supabase calls (`loadDbSymbols` is only called when a session exists).

### 7.2 Tables (from 11 migrations)

| Table | Purpose | Notable columns |
|-------|---------|-----------------|
| `profiles` | App user mirror of `auth.users` | `role` ('user'/'admin') |
| `symbols` | Registry overlaying JSON sigils/signs | `kind`, `engine_id`, `status`, presentation (`svg_path`/`render`/`family`), sign semantics (`effect_tags`/`invertible`/`can_be_center`/`surrounds`), operator (`op_kind`/`op_verb`/`op_inverted_verb`/`op_directional`/`op_default_direction`), sigil semantics (`element`/`substance*`), lifecycle (`lc_status`/`lc_rev`/`lc_flag`) |
| `training_samples` | Recognizer template examples (soft-deletable) | `points` jsonb, `role`, `source` ('drawn'/'corrected'/'confirmed'/'web'), `verified`, `deleted_at` |
| `analyses` | Improvement loop log | `composition`, `engine_result`, `ai_report`, `corrections` jsonb |
| `audit_log` | Admin actions | `actor`, `action`, `target` |
| `symbol_prototypes` | Per-symbol ML embeddings | `embedding` jsonb, `model_version` (PK `(symbol_id, model_version)`) |

### 7.3 Migrations timeline

`init` → `source_confirmed` → `verified_samples` → `symbols_lifecycle` → `symbols_dynamic` (overlay columns) → `remove_deprecated_signs` → `consolidate_sign_sigils` → `remove_sigils` → `web_submissions` (source='web', authed insert, scoped read) → `harden_function_search_path` → `symbol_prototypes`.

### 7.4 Auth flow

Supabase Auth (`auth.users`). A trigger (`handle_new_user`) auto-creates a `profiles` row on signup. `AuthProvider` boots the session, subscribes to `onAuthChange`, and fetches the profile/role. Admin gating is by `role === 'admin'` (`capabilities.js`), **not** by route. Local admin seeded via `tools/seed-admin.mjs`.

### 7.5 Row-Level Security (policy intent)

- `profiles`: self read/update; admins read all.
- `symbols`: **public read** (Studio needs it anonymously), admin write.
- `training_samples`: **scoped read** (verified OR own OR admin) — anon still reads verified rows for the overlay; admin full write; **authed users may insert only unverified `source='web'` rows they own** (weight 0 until an admin verifies → re-tiers `web→drawn`).
- `analyses`: owner reads own (admins all); user inserts as self.
- `audit_log` / `symbol_prototypes`: admin write; prototypes public read.
- `is_admin()` is `security definer`; a later migration hardens function `search_path`.

### 7.6 Storage / Edge functions

- **Storage:** no first-class bucket usage found in app code (tracing happens client-side via `imagetracerjs`; images are committed under `assets/`).
- **Edge functions:** none in the repo.

---

## 8. Agent Analysis

There is **no runtime agent system inside the application**. "Agents" here are **author-time Claude Code** constructs.

### 8.1 Agent inventory

| Agent | Type | Where | Role |
|-------|------|-------|------|
| Claude Code (interactive) | CLI assistant | developer machine | builds/maintains the repo |
| AI bridge "reasoner" | `claude -p` headless | `tools/ai-bridge.mjs` | reasons spell effects from `--facts` + docs; one process per topic (concurrency 3) |
| Project skills (3) | Claude skills | `.claude/skills/` | analyze/create/brainstorm spells |
| Vendored skills (2) | Claude skills | skills-lock (Supabase) | Supabase guidance |

### 8.2 Responsibility / delegation graph

```
Developer ⇄ Claude Code
   ├─ invokes skill: spell-idea  → concept brainstorm (hands off)
   ├─ invokes skill: spell-creator → feasibility + buildable recipe (validated through real engine)
   └─ invokes skill: spell-analyzer → full analysis → writes docs/spells/*.md

App browser → src/ai/report.js (SSE) → ai-bridge.mjs
   → spell-engine-cli --facts (ground truth) + --text (scaffold)
   → claude -p (allowed tools: Read, Glob, Grep over repo docs)
   → per-topic markdown cards (+ CONFIDENCE, EFFECT_CLAIM)
```

The AI bridge **delegates fact extraction to the deterministic engine** and only asks Claude to *reason*, explicitly instructing it to trust FACTS and treat the heuristic as a non-authoritative scaffold — mirroring the project's "AI is the core reasoner, code is the compiler" direction (`PLAN.md`).

---

## 9. Skills Analysis

### 9.1 Skills catalog

| Skill | Category | Purpose | Consumers | Dependencies |
|-------|----------|---------|-----------|--------------|
| **spell-analyzer** | Project | Analyze an existing spell end-to-end; archive to `docs/spells/` | developer via Claude | engine CLI, `docs/CORE.md`, `docs/lexicon/`, references |
| **spell-creator** | Project | Design a new spell from an effect; validate via real engine; emit importable JSON | developer | engine, `references/design-playbook.md` |
| **spell-idea** | Project | Brainstorm spell concepts from outside inspiration; hands off | developer | none (ideation only) |
| **supabase** | Shared (vendored) | Any Supabase task | developer | `supabase/agent-skills` (locked hash) |
| **supabase-postgres-best-practices** | Shared (vendored) | Postgres optimization | developer | vendored |

(Other skills listed in the session — obsidian, skill-creator, verify, run, etc. — are **environment/global** skills, not project artifacts.)

### 9.2 Notes

- The three project skills form an **ideation → creation → analysis** pipeline and are the human-facing twin of the in-app AI report. They are explicitly grounded in `docs/CORE.md` + `docs/lexicon/` and forbidden from inventing ids/effects.
- Usage frequency is author-time and unmetered; they are central to how the canon docs/spell catalog grow.

---

## 10. MCP Analysis

### 10.1 MCP inventory

| Server | Transport | Where | Scope |
|--------|-----------|-------|-------|
| **supabase** | HTTP | `.mcp.json` | `project_ref=qgabhkzeejiuprsdoint`; features: docs, account, database, debugging, development, functions, branching, storage |

### 10.2 MCP dependency map

- **Client:** Claude Code (developer environment), authenticated separately (the hosted Supabase project for the web publish, per memory notes).
- **No MCP server is hosted by this repo**; the app does not act as an MCP client/server at runtime. MCP is purely a developer tool for managing the hosted Supabase backend.
- Tool registrations / context / resource providers: provided by the remote Supabase MCP endpoint, not defined locally.

---

## 11. Tooling Analysis

### 11.1 Tooling catalog (`tools/`, `npm` scripts)

| Tool | Script | Purpose |
|------|--------|---------|
| `ai-bridge.mjs` | `npm run ai` | Local AI server: `/health`, `/analyze`, `/report/topics`, `/report/stream` (SSE); shells `claude -p` |
| `spell-engine-cli.mjs` | `npm run facts` / `--text` | Structured facts / heuristic readout for a spell JSON (engine as compiler) |
| `render.mjs` | `npm run render` | IR → SVG picture |
| `vectorize-sigils.cjs` / `vectorize-signs.cjs` | `npm run vectorize:*` | potrace PNG → `svgPath` (viewBox `-50 -50 100 100`), auto-discovers unknown signs |
| `unknown-report.cjs` | `npm run unknown:report` | Cross-reference unknown-sign appearances |
| `flag-impact.mjs` | `npm run flag:impact` | Flag catalog spells whose symbols changed (lifecycle) |
| `seed-training.mjs` / `build-training-seed.mjs` | `npm run seed:training` / `build:seed` / `seed:refresh` | Build the bundled recognizer seed |
| `recognizer-accuracy.mjs` / `recognizer-bench.mjs` | `npm run bench:accuracy` | Recognizer accuracy A/B + benchmark (the M5 $P-vs-ML gate) |
| `seed-admin.mjs` | — | Create/promote a local admin |
| `wha-lang*.mjs` | — | The `wha-lang` textual spell language (parser/CLI/catalog check) |
| `*Lab.html` / `strokeTemplate*` | — | Browser dev labs for detector/effect tuning + template authoring |

### 11.2 Build & dev tooling

- **Vite 5** (`base: '/witch-hat-atelier-spell-analyzer/'` for Pages), React plugin, `.onnx` as static asset, `onnxruntime-web` excluded from pre-bundling and kept in a lazy chunk; manual chunks for react/supabase/markdown/konva.
- **ESLint 9** flat config (React + hooks + prettier-compat), **Prettier** (no semicolons, single quotes, 2-space, printWidth 100; not yet run repo-wide to preserve column alignment).
- **Tests:** `node --test "test/**/*.test.js"` (40+ suites). **CI** (`deploy-pages.yml`): on push to `main` → `npm ci` → `npm test` → `npm run build` (with Supabase secrets) → deploy `dist/` to GitHub Pages.
- **ML toolchain** (`ml/`): `uv`-managed Python; renders dataset with the **same JS rasterizer**, pre-trains on Omniglot, fine-tunes, exports ONNX with torch↔onnxruntime parity check, builds prototypes. **Never imported by app/tests/CI.**

---

## 12. Dependency Audit

### 12.1 Runtime dependencies

| Package | Classification | Notes |
|---------|---------------|-------|
| `react`, `react-dom` | **Required** | core UI |
| `konva`, `react-konva` | **Required** | drawing canvas |
| `react-router-dom` | **Required (narrow)** | used **only** inside the admin `MemoryRouter`; root has no router |
| `@supabase/supabase-js` | **Required (optional at runtime)** | backend; app degrades to null client |
| `react-markdown` | **Required (dev-gated)** | AI report rendering; tree-shaken out when `aiEnabled` is false |
| `onnxruntime-web` | **Optional / experimental** | only loaded when `engine:'ml'`; default is `'p'` |
| `imagetracerjs` | **Required (admin)** | browser image tracing (Trace view) |

### 12.2 Dev dependencies

`vite`, `@vitejs/plugin-react`, eslint stack, prettier, `globals` — **required** for build/lint. `potrace` — **required** for vectorize scripts (build-time art pipeline). `supabase` (CLI) — **required** for local stack/migrations.

### 12.3 Findings

- **No obviously unused runtime deps.** `onnxruntime-web` is the main "optional/experimental" one (correctly isolated).
- **`react-router-dom` is over-scoped relative to need** — it powers only `AdminPage`'s navigation; could in principle be removed if admin navigation were de-routerized, but that's a refactor, not a bug.
- ML/Python deps are **out-of-tree** (`ml/pyproject.toml`), correctly isolated from the JS dependency graph.

---

## 13. Technical Debt Report

### 13.1 Documentation ↔ code drift (highest-signal)

- **`CLAUDE.md` describes a `src/router.jsx` and routes `/`, `/login`, `/admin/*`.** Live: **no `router.jsx`**; `main.jsx` → `StudioPage`; admin is an overlay via `ConfigPanel` → `AdminOverlay` (MemoryRouter). Several `docs/app/specs/done/*` and `IMPROVEMENTS.md` also reference `router.jsx`.
- **Symbol counts drift:** `CLAUDE.md` says "33 sigils / 52 signs"; live JSON has **26 sigils / 36 signs / 60 spells** (after the `remove_deprecated_signs` / `consolidate_sign_sigils` / `remove_sigils` migrations and catalog growth). `CLAUDE.md` says "21 catalog spells, all wiki"; live is 60.

### 13.2 Dead / orphaned code

- `src/admin/RequireAdmin.jsx` and `src/admin/LoginPage.jsx` — route guard + login page for the removed router; appear unreferenced by the live tree (login now lives in `ConfigPanel`). Candidate dead code.
- `components/ResultPanel.jsx` is the only survivor of the legacy editor (intentional) — fine, but a reminder that `src/components/` is a near-empty legacy folder.

### 13.3 Large files (maintainability risk)

| File | LOC | Concern |
|------|-----|---------|
| `tools/recognizer-accuracy.mjs` | 1786 | dev tool; acceptable but large |
| `src/studio/DrawingSurface.jsx` | 1466 | canvas + all tools + export in one component |
| `src/studio/StudioPage.jsx` | 912 | **god component**: orchestrates draw/detect/analyze/cast/dye/training/layout |
| `src/draw/recognizer.js` | 850 | dense but cohesive + pure + tested |

### 13.4 Duplicated / parallel logic

- **Single-ring vs multi-ring paths** in `recognizer.js` (`analyzeStrokes`) duplicate segmentation/merge loops and composition building (`buildComposition` vs `buildMultiRingComposition`) for back-compat.
- **Aim/region/direction logic** is computed in both `compose.js` (for the analysis section) and `deduce.js` (for the sentence) — overlapping but not identical; risk of divergence.
- Catalog `computeSimilar` is intentionally **not** shared between app and CLI (only `match.js` is) — a documented, accepted duplication.

### 13.5 Architectural constraints / hidden dependencies

- **The JSON-import-purity rule** is a hidden, must-not-break constraint (a JSON import in `geometry.js`/`deduce.js` silently breaks `node --test`). Enforced by convention + comments + tests, not by lint.
- **`data.js` live `let` bindings** must be read at call/render time, not captured into long-lived consts — a subtle footgun documented in-file.
- **`activeTemplates` selects `*`** specifically to survive pre-migration schemas — a deliberate but fragile coupling to migration order.
- **Polar convention** (`atan2(x,-y)`) must be mirrored everywhere; a past real bug (`computeDirectionalBias`) shows the fragility.

### 13.6 Circular dependencies

- None observed in the engine (clean DAG). `StudioPage` ↔ `runAutoAnalyze` uses a **ref to break a definition cycle** (documented).

### 13.7 Tight coupling

- `StudioPage` is tightly coupled to many subsystems (canvas ref API, recognizer opts, dye ids hardcoded as constants, render shim). Dye behavior (Azuremoon/Blood/etc.) is **hardcoded by id** in `StudioPage` rather than data-driven from `dyes.json` modifiers (which the engine accumulator *does* read) — a split source of truth for dye effects.

---

## 14. Risks

| # | Risk | Impact | Likelihood |
|---|------|--------|-----------|
| R1 | Doc drift (router/symbol counts) misleads contributors / future agents | Wrong assumptions, wasted work | High (already present) |
| R2 | `StudioPage`/`DrawingSurface` size makes change risky and review hard | Regressions, slow onboarding | Medium |
| R3 | JSON-purity invariant broken by an unaware edit → test suite breaks cryptically | CI red, confusion | Medium |
| R4 | Dye-effect logic split between `StudioPage` (render) and engine accumulator (`dyes.json`) | Inconsistent dye behavior | Medium |
| R5 | ML engine is partly experimental; prototypes/flywheel depend on admin + migrations being in sync | Silent recognizer degradation if misconfigured | Low–Medium |
| R6 | `activeTemplates('*')` + migration-order coupling | Recognizer reads nothing if schema/policy mismatch | Low |
| R7 | AI bridge depends on a local `claude` CLI + subscription; not viable for public multi-user | Prod AI requires tunnel or BYO key | Known/accepted |
| R8 | Hosted Supabase `project_ref` + anon key shipped in the Pages build | Standard for anon RLS, but widens attack surface if RLS is wrong | Low (RLS scoped) |

---

## 15. Unknowns

- **Exact live state of the ML ("ml") engine** end-to-end in production (model freshness, prototype coverage — README says 62/85 symbols seeded, rest via flywheel). Not exercised in this read.
- **Whether `RequireAdmin.jsx`/`LoginPage.jsx` are truly unreferenced** in every build path (strong evidence yes; not exhaustively proven).
- **Runtime behavior of `web_submissions`** path with real invited users (RLS verified by migration intent, not by live test here).
- **Storage usage**: none found in code, but the Supabase MCP enables `storage` — possible out-of-band use.
- **Performance characteristics** of recognition/render on low-end mobile (responsive code exists; not benchmarked here).
- **Current branch divergence**: this analysis is on `feat/spell-studio-experiments`; how it differs from `main`/`feat/web-unified` was not diffed.

---

## 16. Open Questions

1. **Routing intent:** Is the router-less root + admin-overlay the intended end state, and should `router.jsx`/`RequireAdmin`/`LoginPage` references be removed from docs and code? (Affects any future "fix the routing" work.)
2. **Doc reconciliation:** Should `CLAUDE.md` be updated to the live symbol/spell counts and entry point now, or is it intentionally describing a different branch?
3. **`StudioPage` decomposition:** Is there appetite to extract the detect/analyze/cast orchestration and dye logic into hooks/services? (Pure assessment flags it; no proposal made.)
4. **Dye source of truth:** Should render-time dye effects be driven from `dyes.json` modifiers (as the engine accumulator already is) instead of hardcoded ids in `StudioPage`?
5. **ML engine status:** Is `engine:'ml'` meant to graduate to default, stay opt-in, or be retired? This determines whether `onnxruntime-web` + `ml/` + `symbol_prototypes` are load-bearing or experimental.
6. **Catalog matcher duplication:** Keep app/CLI `computeSimilar` separate (current accepted state) or unify?
7. **Single-ring vs multi-ring recognizer paths:** Keep the back-compat single-ring fast path, or collapse onto the multi-ring path?

---

*End of discovery. No refactor is proposed in this document, per the SPEC constraints.*
