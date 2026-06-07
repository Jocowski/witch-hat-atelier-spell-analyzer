# Refactor Plan Specification

> **Status:** Plan only — **no code changed by this document.**
> **Input:** [docs/specs/current-architecture-spec.md](current-architecture-spec.md)
> **Date:** 2026-06-06
> **Prime directive:** **Behavior must not change.** The application must work *exactly* as it does today after every phase. This is a **structural / organizational refactor** (moves, boundaries, extraction-without-logic-change, doc reconciliation), not a rewrite.
> **Audience:** Independent agents executing the refactor. Every phase is self-contained, independently deployable, reversible, and gated by tests. No additional clarification should be required.

---

## 0. Reading guide & non-negotiable invariants

Before touching anything, an executing agent **must** internalize these invariants from the current-architecture spec. Violating any of them changes behavior or breaks the build/tests:

| # | Invariant | Why it exists | How to honor it |
|---|-----------|---------------|-----------------|
| **I1** | **Pure modules must not import JSON, React, DOM, or Supabase.** Today this is `geometry.js`, `deduce.js`, `compose.js`, `match.js`, `ir.js`, `symbolMerge.js`, `recognizer.js`, `recognizerEngine.js`, `ringClosure.js`, `rasterMatch.js`, `embed.js`, `svgPath.js`, `glyphRasterizer.js`. | `node --test` cannot load `import x from './x.json'` (no import attributes). Vite uses the plain form. | Keep these in `domain/`. JSON/DB binding stays in the runtime layer (`analyze.js`, `data.js`, `symbolStore.js`). Enforce with ESLint (Phase 0). |
| **I2** | **`data.js` exports live `let` bindings** (`SIGILS`, `SIGNS`, `SIGIL_MAP`, `SIGN_MAP`) re-pointed on overlay change. | Admin edits propagate at runtime without rebuild. | Never convert them to `const`; importers must read at call/render time. Moving the file is fine; preserve the `subscribe()` re-point. |
| **I3** | **Graceful degradation.** No Supabase env → `supabase === null`, every data-service is a no-op; anonymous users make **zero** network calls. | Anonymous Pages build + offline tests. | Don't add unconditional Supabase/`import.meta.env` access at module top-level outside the guarded points that already exist. |
| **I4** | **AI is build-time gated.** `aiEnabled = import.meta.env.VITE_AI_ENABLED === '1'` lets Vite tree-shake `react-markdown` + `ai/*` out of the Pages build. | Keep the published bundle lean. | The `aiEnabled ? lazy(() => import(...)) : null` pattern and the `import.meta.env` reference must survive moves verbatim. |
| **I5** | **Lazy chunks must stay dynamic `import()`.** `mlRecognizer.js` (ONNX), `AdminOverlay.jsx`, `AIReportPanel.jsx`. | Keeps `onnxruntime-web`/admin/markdown out of the entry path. | When moving these, update the dynamic `import('...')` string but keep it dynamic. `vite.config.js` `manualChunks` keys are package names, not paths — moves don't affect them. |
| **I6** | **Polar convention** `atan2(x, -y)`, `0° = north, clockwise`, mirrored everywhere. | A past real bug. | Pure move only — never "tidy" the math. |
| **I7** | **`activeTemplates` selects `*`** to survive pre-migration schemas. | Recognizer must not silently read nothing. | Keep the `*` select and the `row.verified ?? false` fallback. |
| **I8** | **Tests run under `node --test`; Vite path aliases do NOT resolve there.** | The whole pure layer is tested in plain Node. | Use **Node.js `package.json` `"imports"` subpath map** (e.g. `#domain/*`) as the aliasing mechanism — it works in *both* Node and Vite — OR keep intra-layer imports relative (preferred for the pure cluster, which moves as a unit). See §3.4. |

> **Golden rule for the whole refactor:** *If a change cannot be proven byte-identical at the pipeline output (engine snapshots) and within tolerance at the recognizer (accuracy bench), it does not belong in this refactor.* Anything that risks behavior change is split out, snapshot-gated, and marked **OPTIONAL/DEFERRED**.

---

## 1. Target Architecture

### 1.1 Layering model (the core idea)

Four runtime layers with a strict, one-directional dependency rule, plus repo-level (author-time) concerns:

```
            ┌──────────────────────────────────────────────────────┐
 RUNTIME    │  features/        (React UI: studio, admin)           │  may import: shared, services, domain
            │     └─ shared/    (theme, capabilities, viewport, ui) │  may import: services, domain
            │     └─ services/  (I/O: supabase, ai, recognizer rt,  │  may import: domain
            │                    symbol runtime / JSON binding)      │
            │     └─ domain/    (PURE: engine + recognizer logic)    │  may import: NOTHING (except itself)
            └──────────────────────────────────────────────────────┘
 AUTHOR-TIME (repo root, NOT bundled):
   .claude/skills/   agents/   .mcp.json   tools/   docs/   data/   ml/   supabase/
```

**Dependency rule (enforced by ESLint in Phase 0/8):**
`domain → (nothing)` · `services → domain` · `shared → services, domain` · `features → shared, services, domain`.
No upward imports. No `features → features` cross-imports (share via `shared/` or `services/`).

### 1.2 Per-area target

| Area | Target | Rationale |
|------|--------|-----------|
| **React** | One `features/` tree, each feature self-contained (`components/`, `hooks/`, `state/`, `*.css`). God components decomposed into hooks. No root router (keep current overlay model); document it. | Removes the `StudioPage` god component; co-locates feature code; matches the live (router-less) reality. |
| **Domain Layer** | `src/domain/` — the pure engine + pure recognizer. Zero React/JSON/IO. Single enforceable purity boundary. | Makes I1 a structural fact, not a convention. Maximizes testability & reuse (CLI/tests already depend on it). |
| **Services** | `src/services/` — `supabase/` (data adapters), `ai/` (bridge client), `recognizer/` (worker, ML, seed/templates, image trace), `symbols/` (JSON binding + DB overlay store + `analyze` orchestrator). | Concentrates all I/O and JSON/DB binding behind one layer; keeps `domain/` pure. |
| **Supabase** | Unchanged schema. Organize `services/supabase/` by table-adapter; add a `client.ts/js` + an `index` barrel. Add a `supabase/README.md` mapping migrations→features. | No DB behavior change; better discoverability. |
| **Skills** | Keep in `.claude/skills/` (must NOT go in `src/` — would be bundled). Add `.claude/skills/README.md` index + a shared `references/` convention. Document the runtime AI client (`services/ai`) as the in-app twin. | Skills are author-time agents; bundling them is wrong. |
| **Agents** | Add repo-root `agents/` for author-time agent docs/prompts (e.g. the AI-bridge reasoner prompt, skill→agent map). No runtime agents exist; document that explicitly. | Discoverability; single home for agent definitions. |
| **MCP** | Keep `.mcp.json` at root; add `mcp/README.md` documenting the Supabase MCP server, its `project_ref`, feature flags, and auth. | One documented home; no behavior change. |
| **Tooling** | Keep `tools/` at root (Node scripts, not bundled). Group by concern via subfolders (`tools/engine/`, `tools/recognizer/`, `tools/art/`, `tools/ai/`, `tools/seed/`, `tools/labs/`) and update `package.json` script paths + a `tools/README.md`. | Discoverability; scripts already isolated from the bundle. |

> **Reconciliation note on the requested `src/agents`, `src/skills`, `src/mcp`:** these are **author-time Claude constructs**, not application runtime code. Placing them under `src/` would pull them into the Vite build graph and ship them to users. The plan therefore keeps **agents/skills/mcp at the repo root** (their natural, non-bundled home) and gives `src/` only the runtime layers. The *runtime counterpart* of "agents" is the AI client, which lives at `src/services/ai/`. This is called out so an executing agent does not mistakenly create bundled `src/agents` etc.

---

## 2. Target Folder Structure (every folder explained)

```
repo/
├─ src/
│  ├─ domain/                  PURE logic. No React, JSON, DOM, Supabase, or env. The reasoning core.
│  │  ├─ engine/               geometry, deduce, compose, match, ir, symbolMerge  (pure)
│  │  ├─ recognizer/           recognizer, recognizerEngine, ringClosure, rasterMatch, embed, svgPath, glyphRasterizer (pure)
│  │  └─ index.js              barrel re-exporting the public domain API
│  │
│  ├─ services/                All I/O + JSON/DB binding. Imports domain only. Degrades gracefully.
│  │  ├─ supabase/             client.js + table adapters (auth, profiles-via-auth, symbols, samples, analyses, audit, prototypes)
│  │  ├─ ai/                   report.js (SSE client), reportCache.js
│  │  ├─ recognizer/           recognizerWorker, useRecognizerWorker, seedTemplates, templates, mlRecognizer (ONNX), imageTrace, ml-assets/
│  │  └─ symbols/              symbolStore, symbolLoader, useSymbolData, data.js (JSON binding + live bindings), analyze.js (orchestrator)
│  │
│  ├─ features/                User-facing feature modules. One folder per feature; self-contained.
│  │  ├─ studio/               StudioPage + components/ + hooks/ + state/ + render/ + tools/ + studio.css
│  │  └─ admin/                AdminPage + views (Training, Registry, Trace, Review) + AuthProvider + ConfigPanel + AdminOverlay + admin.css
│  │
│  ├─ shared/                  Cross-cutting UI + app utilities used by ≥2 features.
│  │  ├─ theme/                ThemeProvider, ThemeSwitcher, themes.css
│  │  ├─ capabilities/         capabilities.js (gates), useViewport.js
│  │  └─ ui/                   ResultPanel.jsx + any future shared presentational components
│  │
│  ├─ main.jsx                 Entry: ThemeProvider → AuthProvider → StudioPage
│  └─ index.css
│
├─ agents/                     AUTHOR-TIME. Agent definitions/prompts (AI-bridge reasoner prompt, skill↔agent map). Not bundled.
├─ .claude/skills/             AUTHOR-TIME. Claude skills (spell-analyzer/creator/idea) + vendored Supabase skills + README index.
├─ mcp/                        AUTHOR-TIME. MCP docs (README mapping .mcp.json servers). .mcp.json stays at repo root.
├─ tools/                      Node CLI scripts, grouped: engine/ recognizer/ art/ ai/ seed/ labs/ + README.
├─ data/                       Source-of-truth JSON (unchanged).
├─ ml/                         Dev-only Python toolchain (unchanged, isolated).
├─ supabase/                   config.toml, migrations/, seed.sql + README (unchanged schema).
└─ docs/                       Canon docs, specs (incl. this plan), per-spell docs.
```

**Folder responsibilities (one line each):**

- `src/domain/` — *what the magic is*: validity, deduction, geometry, matching, IR, recognition math. Pure, dependency-free, the most-tested and most-reused layer.
- `src/domain/engine/` — the spell-reasoning core (pure).
- `src/domain/recognizer/` — the $P recognition + raster/embed math (pure).
- `src/services/` — *how the app talks to the world*: Supabase, the AI bridge, the recognizer runtime (worker/ML), and JSON/DB symbol binding. The only layer allowed to do I/O.
- `src/services/supabase/` — the client + one adapter per table; all no-op without env (I3).
- `src/services/ai/` — browser SSE client to the local AI bridge; gated by `aiEnabled` (I4).
- `src/services/recognizer/` — Worker offload, ML/ONNX engine, seed/templates, image tracing, committed ML assets.
- `src/services/symbols/` — the binding bridge: imports JSON (Vite-style), overlays DB rows via the pure `symbolMerge`, exposes the live snapshot + the `analyze()` orchestrator. **The home of I1's "binding stays out of domain."**
- `src/features/` — React feature modules; each owns its components/hooks/state/styles.
- `src/features/studio/` — the main draw→detect→analyze→cast experience.
- `src/features/admin/` — auth + the four admin views + config overlay.
- `src/shared/` — theme, capability gates, viewport, shared presentational components (`ResultPanel`).
- `agents/` — author-time agent definitions (no runtime agents exist; documented as such).
- `.claude/skills/` — author-time Claude skills (kept out of `src/` so they're never bundled).
- `mcp/` — author-time MCP documentation; `.mcp.json` config remains at repo root where the toolchain expects it.
- `tools/` — Node scripts (AI bridge, engine CLI, vectorizers, benches, seeds, labs), grouped by concern.
- `data/`, `ml/`, `supabase/`, `docs/` — unchanged roles.

### 2.1 Concrete file-move map (authoritative)

> Moves are **mechanical relocations with import-path updates only**. No file's logic changes during a move phase.

| Current path | Target path | Layer | Phase |
|--------------|-------------|-------|-------|
| `src/engine/geometry.js` | `src/domain/engine/geometry.js` | domain | 2 |
| `src/engine/deduce.js` | `src/domain/engine/deduce.js` | domain | 2 |
| `src/engine/compose.js` | `src/domain/engine/compose.js` | domain | 2 |
| `src/engine/match.js` | `src/domain/engine/match.js` | domain | 2 |
| `src/engine/ir.js` | `src/domain/engine/ir.js` | domain | 2 |
| `src/engine/symbolMerge.js` | `src/domain/engine/symbolMerge.js` | domain | 2 |
| `src/draw/recognizer.js` | `src/domain/recognizer/recognizer.js` | domain | 2 |
| `src/draw/recognizerEngine.js` | `src/domain/recognizer/recognizerEngine.js` | domain | 2 |
| `src/draw/ringClosure.js` | `src/domain/recognizer/ringClosure.js` | domain | 2 |
| `src/draw/rasterMatch.js` | `src/domain/recognizer/rasterMatch.js` | domain | 2 |
| `src/draw/embed.js` | `src/domain/recognizer/embed.js` | domain | 2 |
| `src/draw/svgPath.js` | `src/domain/recognizer/svgPath.js` | domain | 2 |
| `src/draw/glyphRasterizer.js` | `src/domain/recognizer/glyphRasterizer.js` | domain | 2 |
| `src/engine/data.js` | `src/services/symbols/data.js` | services | 3 |
| `src/engine/analyze.js` | `src/services/symbols/analyze.js` | services | 3 |
| `src/engine/symbolStore.js` | `src/services/symbols/symbolStore.js` | services | 3 |
| `src/engine/symbolLoader.js` | `src/services/symbols/symbolLoader.js` | services | 3 |
| `src/engine/useSymbolData.js` | `src/services/symbols/useSymbolData.js` | services | 3 |
| `src/data-services/supabase.js` | `src/services/supabase/client.js` | services | 3 |
| `src/data-services/{auth,symbols,samples,analyses,audit,prototypes}.js` | `src/services/supabase/{...}.js` | services | 3 |
| `src/ai/report.js`, `reportCache.js` | `src/services/ai/{report,reportCache}.js` | services | 3 |
| `src/draw/recognizerWorker.js` | `src/services/recognizer/recognizerWorker.js` | services | 3 |
| `src/studio/useRecognizerWorker.js` | `src/services/recognizer/useRecognizerWorker.js` | services | 3 |
| `src/draw/seedTemplates.js`, `templates.js` | `src/services/recognizer/{seedTemplates,templates}.js` | services | 3 |
| `src/draw/mlRecognizer.js`, `ml-assets/` | `src/services/recognizer/{mlRecognizer.js,ml-assets/}` | services | 3 |
| `src/draw/imageTrace.js` | `src/services/recognizer/imageTrace.js` | services | 3 |
| `src/studio/useTemplates.js` | `src/services/recognizer/useTemplates.js` | services | 3 |
| `src/theme/*` | `src/shared/theme/*` | shared | 4 |
| `src/app/capabilities.js`, `useViewport.js` | `src/shared/capabilities/*` | shared | 4 |
| `src/components/ResultPanel.jsx` | `src/shared/ui/ResultPanel.jsx` | shared | 4 |
| `src/studio/*` (UI) | `src/features/studio/**` | features | 4 |
| `src/admin/*` (incl. AuthProvider) + `src/studio/{ConfigPanel,AdminOverlay,AIReportPanel}.jsx` | `src/features/admin/**` | features | 4 |
| `src/admin/RequireAdmin.jsx`, `LoginPage.jsx` | **DELETE** (dead) | — | 1 |

> `drawingModel.js`, `IdentifiedPanel`, `SymbolPalette`, `FlowPanel`, `SpellTrial`, `ToolDock`, `DrawingSurface`, `render/**`, `tools/{beautify,fill,shapes}.js` move with `features/studio/`. Note `studio/tools/*` (beautify/fill/shapes) are pure-ish stroke utilities — **candidate for `domain/` later**, but to limit Phase-4 scope they move with the feature first and may be promoted in a follow-up (out of scope here).

---

## 3. Cross-cutting mechanisms (set up once, used by all phases)

### 3.1 Transitional re-export shims (the safety mechanism for moves)

To make each move phase **independently deployable and trivially reversible**, every moved module leaves a **one-line re-export shim** at its *old* path until the final cleanup phase:

```js
// src/engine/geometry.js  (TRANSITIONAL SHIM — remove in Phase 8)
export * from '../domain/engine/geometry.js'
```

- Importers that haven't been updated keep working unchanged → the app behaves identically mid-migration.
- Rollback = restore the file content from git; no dependents break.
- Shims are removed only in Phase 8, after all importers point at the new paths and a green build proves it.

> **Live-binding caveat (I2):** `data.js` exports mutable `let`s. A `export *` shim re-exports the *current* binding but does **not** track later reassignment across the shim boundary in all bundlers reliably. Therefore **`data.js` does not get a `export *` shim** — instead its importers are updated **in the same commit** as its move (Phase 3), and a snapshot test confirms overlay propagation still works. This is the one module that moves atomically rather than via shim.

### 3.2 Aliasing (works in BOTH Vite and `node --test`)

Add **Node.js subpath imports** in `package.json` (native to Node ≥ 16, resolved by `node --test`) and mirror them in Vite:

```jsonc
// package.json
"imports": {
  "#domain/*":   "./src/domain/*",
  "#services/*": "./src/services/*",
  "#shared/*":   "./src/shared/*",
  "#features/*": "./src/features/*"
}
```
```js
// vite.config.js — resolve.alias mirrors the same map
resolve: { alias: { '#domain': '/src/domain', '#services': '/src/services', '#shared': '/src/shared', '#features': '/src/features' } }
```

- **Rule:** *intra-layer* imports stay **relative** (the pure cluster moves as a unit, so its internal relative imports survive moves untouched — zero churn). *Cross-layer* imports use the `#alias`.
- This avoids the trap in I8 (Vite-only aliases break `node --test`). Subpath imports are the one mechanism valid in both.
- Adding the maps is **behavior-neutral** and is done in Phase 0 before any move.

### 3.3 ESLint boundary enforcement

Add `eslint-plugin-import` (or `no-restricted-imports`) rules encoding the dependency rule (§1.1) and the purity rule (I1):

- `src/domain/**` → forbid importing `react`, `*.json`, `*.css`, `#services/*`, `#shared/*`, `#features/*`, `@supabase/*`, `onnxruntime-web`.
- `src/services/**` → forbid `#features/*`, `#shared/*`, `react-dom` (hooks OK).
- `src/features/**` → forbid `#features/<other-feature>/*`.

Introduced **warn-only in Phase 0**, flipped to **error in Phase 8**. Catches accidental I1 violations mechanically.

### 3.4 Test import strategy

- Tests currently import pure modules by relative path and JSON via `createRequire`. When a module moves, its test's import path updates to the `#domain/*` subpath (Node resolves it). JSON `createRequire('../../data/x.json')` paths are unaffected (data/ does not move).
- Snapshot/golden tests (Phase 0) import the *binding* layer (`analyze`) via `#services/symbols/analyze.js` after Phase 3; before that, via the current path. The harness is written path-agnostic by importing through the alias from day one (the alias is added Phase 0; for Phase 0 it points at the current `src/engine`, then is re-pointed when files move — but since we use subpath imports to *directories*, the alias target moves with the files, so the test import string never changes after Phase 0). 

---

## 4. Migration Strategy (phased, each independently deployable)

> Each phase ends green on: `npm run lint`, `npm test`, `npm run build`, **engine golden snapshots unchanged**, **recognizer accuracy within tolerance**. Each phase is one or more small PRs on a branch off `main`; deployable on its own; reversible by `git revert`.

### Phase 0 — Safety net & guardrails (no moves, no behavior change)

**Goal:** make every later phase verifiable and reversible.

1. **Engine golden snapshots:** add `test/golden-pipeline.test.js` that runs `analyze()` (and `tools/spell-engine-cli.mjs --facts`) over the entire `assets/spells/*.json` corpus and asserts deep-equality against committed `test/__golden__/*.json`. Generate the goldens once from current `main` and commit them. **This is the primary regression oracle for the whole refactor.**
2. **Recognizer accuracy baseline:** run `npm run bench:accuracy`, commit the result as `test/__golden__/recognizer-baseline.json`; add a test asserting accuracy ≥ baseline − tolerance (e.g. 0 regression; tolerance 0 for deterministic seed).
3. **Aliasing:** add `package.json` `"imports"` + Vite `resolve.alias` (§3.2). Targets point at *current* locations; no files move.
4. **ESLint boundaries:** add the rule set (§3.3) as **warnings**.
5. **(Recommended) UI smoke harness:** add a minimal Playwright happy-path (`draw a ring + fire sigil → Detect → Analyze → Cast renders`) as `e2e/smoke.spec.js`. Optional but strongly advised before Phase 4/5. If declined, the manual `docs/app/TEST-PLAN.md` is the fallback regression for UI.

**Rollback:** revert the config/test commits; runtime untouched.
**Exit criteria:** goldens + baseline committed and green; aliases resolve in both `node --test` and `vite build`.

---

### Phase 1 — Doc reconciliation + dead-code removal (lowest risk)

**Goal:** eliminate documentation drift and orphaned code identified in the architecture spec §13.

1. Update `CLAUDE.md` to live reality: no `router.jsx` (entry is `main.jsx → StudioPage`, admin via overlay); correct counts (**26 sigils / 36 signs / 60 spells / 8 dyes / 36 operators / 15 elements / 16 interactions**).
2. Prove `src/admin/RequireAdmin.jsx` and `src/admin/LoginPage.jsx` are unreferenced (`grep` for imports; `npm run build` with them deleted). Delete them.
3. Update `docs/app/SPEC.md` / `IMPROVEMENTS.md` `router.jsx` references with a "superseded by overlay model" note (do not rewrite history docs; annotate).

**Rollback:** `git revert`; deleted files restorable from history.
**Tests required:** `npm test` + `npm run build` green (proves dead-code removal is safe). Goldens unchanged (no engine touch).
**Exit criteria:** build green without the two files; docs match code.

---

### Phase 2 — Establish `src/domain/` (pure layer)

**Goal:** physically separate the pure cluster behind one enforceable boundary.

1. Move the 13 pure modules per §2.1 into `src/domain/{engine,recognizer}/`. Because they move **as a unit**, their **intra-cluster relative imports are unchanged** (e.g. `deduce.js`'s `import … from './geometry.js'` still resolves).
2. Leave **`export *` shims** at every old path (§3.1).
3. Add `src/domain/index.js` barrel.
4. Update **test** import paths for moved modules to `#domain/*` (or keep relative to the new location — pick `#domain/*` for stability).
5. Flip ESLint purity rule (I1) to **error scoped to `src/domain/**`** to lock the boundary now.

**Rollback:** delete `src/domain/`, restore originals (shims make dependents path-agnostic, so revert is clean).
**Tests required:** unit (all pure-module suites) + golden snapshots + accuracy bench — all unchanged.
**Exit criteria:** every domain module lives under `src/domain/`, imports nothing forbidden, all tests green; shims keep old paths alive.

---

### Phase 3 — Establish `src/services/` (I/O + binding layer)

**Goal:** concentrate all I/O and JSON/DB binding; keep `domain/` pure.

1. Move `data-services/*`, `ai/*`, the recognizer runtime (`recognizerWorker`, `useRecognizerWorker`, `seedTemplates`, `templates`, `mlRecognizer` + `ml-assets/`, `imageTrace`, `useTemplates`), and the symbol runtime (`symbolStore`, `symbolLoader`, `useSymbolData`, `data.js`, `analyze.js`) into `src/services/{supabase,ai,recognizer,symbols}/` per §2.1.
2. **Atomic move for `data.js`** (no shim — I2/§3.1): move it and update all its importers in the same commit; rely on the overlay-propagation snapshot test to confirm live bindings still update.
3. Preserve the dynamic `import()` for `mlRecognizer` (I5) — update the string only. Confirm the `manualChunks`/onnx lazy-chunk behavior with `npm run build` + inspect that `onnxruntime` is still a separate chunk and not in the entry.
4. Preserve `import.meta.env` references in `supabase/client.js` and `capabilities`/`ai` exactly (I3, I4).
5. Shims at old paths for everything except `data.js`.
6. Update `tools/*` and any test imports that referenced these by path to `#services/*`.

**Rollback:** restore originals; shims cover non-atomic moves; `data.js` revert is a single-commit revert.
**Tests required:** unit + golden + accuracy + **build-chunk check** (onnx + admin + markdown remain lazy) + the overlay-propagation test (admin edit → re-analyze sees new grammar).
**Exit criteria:** all I/O under `services/`; `domain/` still imports nothing; chunks unchanged; AI still tree-shaken when `VITE_AI_ENABLED` unset.

---

### Phase 4 — Establish `src/features/` and `src/shared/`

**Goal:** co-locate UI per feature; create the shared layer.

1. Move `theme/`, `app/{capabilities,useViewport}`, `components/ResultPanel` → `src/shared/{theme,capabilities,ui}`.
2. Move `studio/*` → `src/features/studio/**` (group internals into `components/`, `hooks/`, `state/`, keep `render/`, `tools/`).
3. Move `admin/*` (+ `AuthProvider`) and `studio/{ConfigPanel,AdminOverlay,AIReportPanel}` → `src/features/admin/**`.
4. Update `main.jsx` imports to `#shared`/`#features`.
5. Keep `AdminOverlay`'s `MemoryRouter` and the lazy `import()` of `AdminOverlay`/`AIReportPanel` intact (I5).
6. Shims at old paths (UI shims are simple default/named re-exports).

**Rollback:** restore originals via shims/revert.
**Tests required:** unit + golden + accuracy + **build** + **UI smoke (Playwright)** happy-path (or manual TEST-PLAN). The smoke test is the regression anchor here because UI has no unit coverage today.
**Exit criteria:** `src/` contains only `domain/ services/ features/ shared/ main.jsx index.css`; app boots and the smoke path passes identically.

---

### Phase 5 — Decompose god components (behavior-preserving extraction)

**Goal:** reduce coupling in `StudioPage.jsx` (912 LOC) and `DrawingSurface.jsx` (1466 LOC) **without changing behavior**.

Extract cohesive logic into hooks/modules **with identical inputs/outputs** (pure move of code into a hook; same state, same effects, same order):

- `useSpellAnalysis()` — detect/analyze/cast orchestration (`runRecognition`, `buildComposition`, `castFrom`, `handleAnalyze`, auto-analyze loop).
- `useDetectionEditing()` — `handleCorrect/handleMerge/handleErase/handleBeautify`.
- `useResultsDrawer()` — drawer height/collapse/tab persistence.
- `useSpellRender()` — SpellIR shim + trial backdrop/glow + dye-derived params.
- `DrawingSurface` → split tool handlers into `features/studio/tools/` modules already partly present; extract export/clipboard into `useCanvasExport`.

**Rules:** one extraction per PR; each PR must show **zero golden-snapshot diff** and **identical smoke-test behavior**; no change to effect ordering, debounce timing, or localStorage keys.

**Rollback:** revert the individual extraction PR.
**Tests required:** golden + accuracy + smoke + (if added) component tests for the new hooks. Manual TEST-PLAN spot-check for canvas interactions.
**Exit criteria:** `StudioPage` and `DrawingSurface` materially smaller; behavior provably unchanged.

---

### Phase 6 — Pattern standardization (CAREFUL — partly behavior-risky, gated)

**Goal:** remove duplicated/split logic flagged in spec §13.4 and §13.7, **only where provably behavior-preserving**.

1. **Dye source-of-truth (OPTIONAL/DEFERRED):** today render-time dye effects are hardcoded by id in `StudioPage` (`AZUREMOON_DURATION_MULT`, `BLOOD_POWER`, etc.) while the engine accumulator reads `dyes.json.modifier`. Unify *only* by moving the constants into `dyes.json`/config such that the **emitted numbers are byte-identical** (snapshot the SpellIR shim before/after). If exact parity can't be guaranteed, **do not do it in this refactor** — log it as a follow-up feature.
2. **Aim/direction duplication (`compose.js` vs `deduce.js`):** do **not** merge logic (risk). Instead, extract the shared sub-computation into a single pure helper that both call, asserting identical outputs via tests. Behavior-neutral.
3. **Recognizer single-/multi-ring paths:** **leave as-is** (back-compat). Out of scope; note as future work.

**Rollback:** revert per change.
**Tests required:** golden (must be **zero diff**) + accuracy + smoke. Any non-zero diff blocks the change.
**Exit criteria:** standardization done only where snapshots are identical; risky items explicitly deferred with tickets.

---

### Phase 7 — Agents / Skills / MCP / Tooling organization (author-time, no runtime impact)

**Goal:** improve agent integration, skill organization, MCP organization, tooling discoverability.

1. **Skills:** add `.claude/skills/README.md` indexing the three project skills + the two vendored ones, their triggers, and their shared `references/` convention. Confirm `skills-lock.json` integrity unchanged.
2. **Agents:** create `agents/README.md` documenting: (a) there are **no runtime agents**; (b) the AI-bridge reasoner prompt (extract the prompt strings from `tools/ai-bridge.mjs` into `agents/ai-bridge-reasoner.md` as documentation, referenced by the bridge via comment — do **not** change the bridge's runtime strings unless snapshot-equal); (c) the skill↔agent map.
3. **MCP:** add `mcp/README.md` documenting `.mcp.json` (Supabase server, `project_ref`, feature flags, auth model). `.mcp.json` stays at root.
4. **Tooling:** regroup `tools/` into subfolders by concern; update `package.json` script paths and `tools/README.md`. Verify every `npm run` script still resolves (`npm run facts/render/vectorize:*/bench:accuracy/ai/flag:impact/seed:*`).

**Rollback:** revert; scripts restored.
**Tests required:** `npm test` + run each affected `npm run` script once (smoke) + `npm run build`.
**Exit criteria:** every author-time concern has a documented home; all scripts run from new paths.

---

### Phase 8 — Remove transitional shims + enforce boundaries

**Goal:** finalize.

1. Confirm no imports reference old paths (grep + build).
2. Delete all re-export shims from Phases 2–4.
3. Flip ESLint boundary rules (§3.3) from warn to **error** repo-wide.
4. Final docs pass: update `CLAUDE.md` "Architecture" section to the new layering; add `docs/ARCHITECTURE.md` describing the layer rule + the `#alias` map for onboarding.

**Rollback:** re-add shims (kept in git history) if a missed importer surfaces.
**Tests required:** full suite + golden + accuracy + smoke + build, all green with boundaries as errors.
**Exit criteria:** `src/` is the target structure; no shims; boundaries enforced; onboarding doc present.

---

## 5. Risk Analysis (per change class)

| ID | Change | Risk | Impact | Likelihood | Mitigation |
|----|--------|------|--------|-----------|------------|
| RK1 | Adding `package.json` `"imports"` + Vite alias | Alias resolves in one tool but not the other | Build or tests break | Low | Phase 0 adds both maps together; CI runs `node --test` *and* `vite build` before any move |
| RK2 | Moving pure modules (Phase 2) | An intra-cluster relative import breaks | Engine/recognizer broken | Low | Move the cluster **as a unit** so relatives are preserved; `export *` shims; golden snapshots catch any break |
| RK3 | Breaking I1 (JSON/React leaks into `domain/`) | Silent `node --test` failure | Test suite red, confusing | Medium | ESLint purity rule **error-scoped to domain** from Phase 2; CI gate |
| RK4 | Moving `data.js` live bindings (Phase 3) | Overlay propagation stops (admin edits don't apply) | Admin registry feature silently broken | Medium | **Atomic move, no shim**; dedicated overlay-propagation test (admin edit → re-analyze sees new grammar) |
| RK5 | Moving lazy-imported modules (`mlRecognizer`, `AdminOverlay`, `AIReportPanel`) | Dynamic import becomes static → chunk bloat / onnx in entry | Larger bundle, slower load (perf regression) | Medium | Keep `import()` dynamic; Phase 3/4 **build-chunk assertion** that onnx/admin/markdown stay separate chunks |
| RK6 | Moving AI/env-gated code (Phase 3) | `import.meta.env` reference altered → AI not tree-shaken in Pages build | Bundle ships `react-markdown`/ai in prod | Low | Preserve `import.meta.env.VITE_AI_ENABLED` verbatim; build twice (with/without flag) and diff chunk presence |
| RK7 | UI moves (Phase 4) with no unit coverage | Subtle render/handler regression undetected | User-visible breakage | Medium | Playwright smoke (Phase 0) + manual TEST-PLAN; shims allow incremental revert |
| RK8 | God-component extraction (Phase 5) | Effect ordering / debounce / localStorage key drift | Behavior change (auto-analyze, persistence) | Medium-High | One extraction per PR; **zero golden diff** + smoke required; explicit "no key/timing change" checklist per PR |
| RK9 | Dye unification (Phase 6) | Numeric drift in render params | Visual cast differs (behavior change) | High (if attempted naively) | **Snapshot SpellIR shim**; only proceed on byte-identical output; else **defer** |
| RK10 | Tooling regroup (Phase 7) | `npm run` script path breaks | CLI/CI breakage | Low | Update `package.json` paths in same commit; run each script once; CI runs `npm test` (which uses the glob, not moved tools) |
| RK11 | Deleting dead code (Phase 1) | A hidden dynamic reference exists | Runtime error | Low | grep for string + dynamic import; `npm run build` + smoke before delete |
| RK12 | Shim removal (Phase 8) | A missed importer still uses old path | Build break | Low | grep gate before delete; shims recoverable from history |
| RK13 | CI lacks UI/e2e stage | Regressions slip past CI | Behavior change merged | Medium | Add Playwright smoke to CI in Phase 0 (recommended); otherwise enforce manual TEST-PLAN sign-off per phase |

---

## 6. Testing Strategy

### 6.1 What exists today
- **Unit:** 40+ `node --test` suites over pure modules + tools (`geometry`, `deduce`, `compose`, `match`, `ir`, `symbol-merge`, recognizer suites, `aibridge`, etc.).
- **Accuracy bench:** `npm run bench:accuracy` (deterministic seed).
- **No** React component / integration / e2e tests. UI regression today is the manual `docs/app/TEST-PLAN.md`.

### 6.2 What this refactor adds (Phase 0)
- **Golden pipeline snapshots:** `analyze()` + `--facts` over `assets/spells/*.json` → committed `__golden__`. The refactor's primary oracle: **every move/extraction phase must produce zero diff.**
- **Recognizer baseline:** committed accuracy result; per-phase assertion of no regression.
- **Overlay-propagation test:** simulate a DB symbol overlay → `applyOverlay` → `analyze` reflects new grammar (guards RK4).
- **Build-chunk assertions:** post-`vite build` check that `onnxruntime`, admin, and markdown remain separate lazy chunks and absent from the entry (guards RK5/RK6).
- **(Recommended) Playwright smoke:** the draw→detect→analyze→cast happy path (guards RK7/RK8).

### 6.3 Required gates per phase

| Phase | Unit | Integration (golden + overlay) | Regression (accuracy + build-chunk + smoke) |
|-------|------|-------------------------------|---------------------------------------------|
| 0 | establish | establish goldens | establish baseline + smoke |
| 1 | ✅ | ✅ (unchanged) | build + smoke |
| 2 | ✅ all pure suites | ✅ zero diff | accuracy = baseline |
| 3 | ✅ | ✅ zero diff + **overlay test** | accuracy + **chunk check** |
| 4 | ✅ | ✅ zero diff | build + **smoke** |
| 5 | ✅ (+ new hook tests) | ✅ **zero diff** | accuracy + **smoke** + manual canvas spot-check |
| 6 | ✅ | ✅ **zero diff mandatory** | smoke; any diff ⇒ block/defer |
| 7 | ✅ | ✅ unchanged | run every `npm run` script once + build |
| 8 | ✅ | ✅ | full suite + smoke + build, ESLint errors clean |

### 6.4 Definitions
- **Unit tests:** pure-module behavior in isolation (`node --test`). Mandatory green every phase.
- **Integration tests:** the bound pipeline end-to-end (`analyze`/`--facts` over the real corpus + JSON binding + overlay). Zero golden diff is the contract that behavior is unchanged.
- **Regression tests:** cross-cutting guarantees — recognizer accuracy ≥ baseline, bundle chunking preserved, UI happy-path identical. These catch the failures unit/integration can't (perf, UI, env gating).

---

## 7. Execution checklist (for an independent agent)

For **every** PR in any phase:
1. Branch off `main` (never commit to `main` directly).
2. Make only the moves/edits scoped to that PR's step in §4.
3. Update imports to `#aliases` (cross-layer) / relative (intra-layer); add shims where the phase requires.
4. Run: `npm run lint && npm test && npm run build`.
5. Run: golden snapshot suite (**must be zero diff** unless the step explicitly allows it — only Phase 1 docs and Phase 6-if-parity), accuracy bench (≥ baseline), build-chunk check (Phases 3–4), smoke (Phases 4–5).
6. If any gate fails → fix or revert; never weaken a golden to make it pass.
7. PR description states: which invariants (I1–I8) were touched and how they were preserved; which risks (RK*) apply and their mitigation evidence.
8. Merge only when all gates green. Each merged PR is independently deployable.

---

## 8. Out of scope (explicitly deferred, not done here)

- Recognizer single-/multi-ring path unification (RK-heavy; back-compat).
- Removing `react-router-dom` by de-routerizing admin (behavior-risky; cosmetic).
- ML engine promotion/retirement decision (product decision, see architecture spec Open Q5).
- Any change to Supabase schema, RLS, or migrations.
- Any change to `data/*.json` domain content (only Phase 6 dye-config move, and only if byte-identical).
- New features of any kind.

---

---

## 9. Execution Status (updated 2026-06-06)

> Executed on branch `feat/spell-studio-experiments`. Every step below ended green on `npm test`, `npm run lint`, and `npm run build`. Behavior preserved throughout (golden engine snapshots unchanged; recognizer accuracy steady at 97.1%). Work is **not committed** (no commit was requested) — it sits in the working tree for review.

### ✅ Done & verified

| Phase | What landed | Verification |
|-------|-------------|--------------|
| **0 — Safety net** | `test/golden-pipeline.test.js` + `test/__golden__/` (52 snapshots over the 26-spell corpus, both `analyze` & `--facts` modes); `test/__golden__/recognizer-baseline.json` (97.1%); Node `package.json` `imports` + Vite alias mirror (`#domain`/`#services`/`#shared`/`#features`); ESLint layer-boundary rules. | 588 tests, build, accuracy 97.1% |
| **1 — Docs + dead code** | CLAUDE.md reconciled (router model + counts 26/36/60); `RequireAdmin.jsx` & `LoginPage.jsx` deleted; SPEC/IMPROVEMENTS annotated. *(via subagent + main)* | build green w/o dead files |
| **2 — `src/domain/`** | 13 pure modules moved to `domain/{engine,recognizer}/` + barrel; `recognizerEngine.js` reclassified to services (dynamic ML import); shims at old paths. | 588 tests, accuracy 97.1% |
| **3 — `src/services/`** | `supabase/` (adapters + `client.js`), `ai/`, `recognizer/` (ml, seed, templates, imageTrace, engine, ml-assets), `symbols/` (data, analyze, symbolStore, symbolLoader); JSON-depth + cross-layer (`#domain`) fixes; shims. `data.js` live-bindings preserved through `export *` (verified). | 588 tests, build, chunks intact |
| **4 — `features/` + `shared/`** | `studio/`→`features/studio/`, `admin/`→`features/admin/`, `shared/{theme,capabilities,ui,auth}/`; uniform escaping-import +1 regex; `main.jsx` rewired; test import paths updated; shims. | 588 tests, build, chunks intact |
| **7 (docs part)** | `agents/README.md`, `mcp/README.md`, `.claude/skills/README.md`. *(via subagent)* | n/a |
| **8 (enforcement part)** | `domain/`+`services/` boundary rules flipped from warn → **error** (0 violations). | lint 0 errors |

**Invariant status:** I1 enforced (ESLint error). I2 verified (`export *` live re-export, Node+Vite). I3/I4 intact (anonymous zero-network; AI tree-shaken — markdown is a 0.9 kB stub). I5 intact (`ort.bundle.min` byte-identical hash; `mlRecognizer`/`AdminOverlay` still lazy). I6/I7/I8 honored (pure moves; `activeTemplates('*')` untouched; subpath imports resolve in both toolchains).

### ⏳ Remaining (deferred, with rationale)

- **Phase 5 — god-component decomposition (`StudioPage`/`DrawingSurface`).** DEFERRED. The plan gates this on a UI smoke test (RK8) that does not exist; decomposing live UI with build-only verification risks behavior change against the prime directive. Recommended next step: add the Playwright happy-path smoke (Phase 0 step 5), then extract the hooks listed in §4 Phase 5, one zero-golden-diff PR each.
- **Phase 6 — dye source-of-truth unification.** DEFERRED by design (RK9): only proceed if the emitted SpellIR numbers are byte-identical; otherwise it's a feature change, not a refactor.
- **Phase 7 — tooling regroup (`tools/` subfolders + `package.json` script paths).** NOT DONE (author-time docs done). Mechanical; gate by running each `npm run` script once. When moving `tools/spell-engine-cli.mjs`, update `test/golden-pipeline.test.js`'s CLI path and the script's `importLocal('src/engine/*')` shim paths.
- **Phase 8 — shim removal.** PARTIAL: boundary enforcement is on; the transitional re-export shims (`src/{engine,draw,ai,data-services,app,theme,components}/*`) are intentionally retained as a working compatibility layer. To finish: repoint each importer in `features/`, `main.jsx`, `tools/`, and `test/` from shim paths to the `#alias` canonical paths, then delete the shim files. Pure cleanup — no behavior change; gate with golden snapshots + build.
  - Also fold the two real files still parked in shim dirs into their layer: `src/engine/useSymbolData.js` → `services/symbols/`, `src/draw/recognizerWorker.js` → `services/recognizer/` (and update the `new URL(...)` in `useRecognizerWorker.js`).

### How to finish safely
Run `npm test` (must stay 588 green, golden snapshots zero-diff), `npm run lint` (0 errors), `npm run build` (chunks: `ort.bundle.min`/`mlRecognizer`/`AdminOverlay` separate, markdown a stub), and `npm run bench:accuracy` (≥ 97.1%) after each step. Regenerate goldens only from a known-good tree (`UPDATE_GOLDENS=1`).

---

*End of plan. Phases 0–4 (+ enforcement) executed and verified; 5–8 scoped above. Execution is gated entirely by the tests in §6 and the invariants in §0.*
