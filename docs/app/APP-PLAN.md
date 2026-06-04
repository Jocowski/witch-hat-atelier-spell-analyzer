# APP-PLAN.md — the full Spell Studio re-architecture

> The master plan for turning the analyzer into **Spell Studio**: a near-fullscreen drawing app where
> you draw a spell (paint tools + placed signs/sigils), hit **Analyze**, get the engine reading, then
> a **multi-topic AI report** that streams in field-by-field, plus a password-gated **Admin** area for
> training, backed by a real database — and a human-approved loop where **Claude Code improves the
> engine/docs** from accumulated use. Supersedes the input-method scope of [DRAWING-APP.md](DRAWING-APP.md);
> keep [PLAN.md](../../PLAN.md) (AI-as-reasoner) and [CORE.md](../CORE.md) as the reasoning foundation.

## 0. Decisions locked for this plan

- **Stack/DB:** **Supabase** (Postgres + Auth + Storage). Local via `supabase start` for dev/training;
  hosted Supabase for prod. Chosen because the app ships to **production** and needs **login/password**
  (Supabase Auth = no hand-rolled auth) and a path to the future gallery/community. *(Confirmable — the
  schema below is plain Postgres, so swapping to managed Postgres + a custom auth layer is mechanical.)*
- **Improvement loop:** **human-approved review packets** — the app exports accumulated data; a Claude
  Code session proposes concrete diffs; you review and merge. Never auto-merges.
- **AI delivery:** the AI report runs through your **local `claude -p` bridge exposed via a secure
  tunnel** (e.g. cloudflared/ngrok) — so even the deployed front reaches *your* machine, **for you
  only**, at no API cost. **Future:** a "bring your own API key" option lets other users run the AI on
  their own Anthropic key. No public/shared paid endpoint at launch.
- **AI report format:** rendered as **Markdown** in the UI (not plain text).
- **Paint colors = canon dyes:** the brush color palette is the set of **magical dyes** — picking a
  color tints the stroke *and* records that dye on the spell (`composition.dyes`), which the engine
  already surfaces. Visual-first, engine-aware, optional.
- **Theming:** four themes — **brown (Atelier, default)**, dark, light, and "arcane" (the prototype
  purple/blue). User-switchable; persisted.

---

## 1. Architecture at a glance

```
┌─────────────────────────── CLIENT (React/Vite, SPA) ───────────────────────────┐
│  Studio (main, near-fullscreen canvas)          Admin (/admin, auth-gated)       │
│   • paint tools: brush·line·square·triangle·circle·eraser                        │
│   • palette: place registered SIGNS / SIGILS                                     │
│   • Analyze ▸ recognizer ($P, client) + engine analyze() (client)               │
│   • AI report (streamed cards)            • same canvas in "training mode"        │
└───────────────┬─────────────────────────────────────────────┬───────────────────┘
                │ supabase-js (DB + Auth, RLS)                  │ fetch (SSE)
                ▼                                               ▼
   ┌─────────────────────────┐                   ┌──────────────────────────────────┐
   │  SUPABASE                │                   │  AI service                       │
   │  • Auth (users)          │                   │  dev:  ai-bridge → claude -p      │
   │  • Postgres (schema §5)  │                   │        (free, local, subagents)   │
   │  • Storage (spell images)│                   │  prod: serverless fn → Anthropic  │
   │  • RLS policies          │                   │        API (paid) [gated]         │
   └─────────────────────────┘                   └──────────────────────────────────┘
                │                                               
                ▼  (periodic) export "review packet"           
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │  IMPROVEMENT LOOP (human-approved): packet → Claude Code session → proposed   │
   │  diffs (catalog / grammar / lexicon / rules / template gaps) → you merge PR    │
   └─────────────────────────────────────────────────────────────────────────────┘
```

The engine (`analyze()`) and the recognizer (`$P`) stay **client-side** — instant, no server round-trip.
The server side is only **data (Supabase)** and **AI (bridge/serverless)**.

---

## 2. The Studio (main screen)

### 2.1 Layout
- **Near-fullscreen canvas** centered. A floating **tool dock** (left) and a **palette drawer** (right,
  collapsible) for signs/sigils. A thin **action bar** under the canvas: `Analyze` + status + result drawer.

### 2.2 Tools (paint + symbols)
| Tool | Produces | Notes |
|---|---|---|
| Brush | freehand stroke (point list) | the raw input the recognizer expects |
| Line / Square / Triangle / Circle | a **clean stroke** (sampled outline) | shape tools emit point lists too, so the recognizer sees everything uniformly |
| Eraser | removes strokes / symbols under it | hit-test on strokes & placed symbols |
| Select / Move | transform existing items | move, rotate, scale, delete |
| **Color / dye** | sets the active **dye** | the palette = the canon dyes (`dyes.json`); the chosen color tints strokes and is recorded on `composition.dyes` |
| **Sign / Sigil palette** | a **placed symbol** with a known id | bypasses recognition — already identified |

**Key idea:** there are two kinds of canvas content — **drawn strokes** (need recognition) and **placed
symbols** (known). Analyze treats them differently and merges into one `composition`.

### 2.4 Theming
Four CSS-variable themes, switchable from the header and persisted to `localStorage`:
**brown (Atelier — default)**, **dark**, **light**, **arcane** (the prototype purple/blue). The whole
UI (and the brush dye swatches) reads from theme variables, so adding a theme is one variable block.

### 2.3 What a drawing stores
```
{ strokes:[ { tool, color, width, points:[{x,y}] } ],
  placed:[ { id, kind:'sign'|'sigil', x, y, rotation, scale } ],
  ring?: { ... } }
```

---

## 3. Analyze (recognition + engine)

Pressing **Analyze**:
1. **Placed symbols** → already known, go straight into the composition.
2. **Drawn strokes** → the recognizer pipeline (ring → segment → core/border → de-rotate → `$P`),
   using templates pulled from Supabase (trained in Admin). → identified symbols + confidence.
3. Build one **`composition`** (the `wha-spell` shape) from both.
4. Run the **engine** `analyze(composition)` client-side → structured reading.

### 3.1 "Identified" panel
- Lists each detected sign/sigil: **what it is + confidence**, with a **correction control**.
- A correction is logged as a **training candidate** (→ Admin review / the flywheel).
- Then the full engine analysis (validity, effect, sigils, signs, catalog match, geometry).

---

## 4. AI report — multi-topic, streamed, subagent-per-topic

After the engine reading, an **Ask AI** button reveals a grid of **topic cards**, each loading
independently. Each card = one focused AI job; they run **in parallel** and fill in as they finish.

### 4.1 Topics (each an independent card — **user-selectable, all ON by default**)
A checklist lets the user pick which cards to generate; everything is enabled by default (you're the
only user at first). Each selected topic = one parallel AI job.

1. **Would it work? & why** — feasibility/validity from first principles (substances + operators + geometry).
2. **The effect, simply** — a plain, vivid description of what the spell does, as a player would enjoy it.
3. **What each symbol does here** — per sigil/sign: its role *in this specific spell*.
4. **How canon is it?** — closeness to real spells + provenance (canon/wiki/fan) honesty.
5. **Power & danger** — how strong, how stable, backfire/forbidden-magic risks.
6. **Casting & appearance** — what it looks/feels like to cast in-world (flavor).
7. **Tweaks & variations** — concrete changes (add/remove/rotate signs) to strengthen or reshape it.
8. **Closest canon spells** — comparison to specific named spells and how this differs.
9. **Name & lore** — a fitting spell name + a sentence of in-world lore.
10. **Practical uses** — combat / utility / everyday applications.

*(The set lives in the `/spell-report` skill so topics are easy to add/remove/reword.)*

### 4.2 The mechanism — a dedicated skill + streaming bridge
- A **new skill** (working name `/spell-report`) owns the **topic definitions + prompt templates**
  and the grounding instructions (reason from `CORE.md` + `lexicon/`, trust engine `--facts`).
- The **AI service** runs **one job per topic concurrently** (each a `claude -p` "subagent" in dev /
  an Anthropic API call in prod) and **streams** results over **SSE**: each card flips from
  `loading` → filled the moment its job returns. (No waiting for the slowest topic.)
- New endpoint: `POST /report/stream` (SSE) → `{ composition, topics[] }` → emits `{topic, content}`
  events as each completes.

### 4.3 Delivery & honest constraints
- **Now (you only):** the deployed front calls **your local bridge through a secure tunnel**
  (cloudflared/ngrok → `http://localhost:8787`). Works whenever your machine + bridge are up; the AI
  is effectively private to you and costs nothing beyond your Claude Code subscription.
- **Markdown:** each card renders the returned **Markdown** (headings, lists, emphasis), not raw text.
- **Parallel `claude -p`** = several concurrent Claude Code sessions under your subscription — fine for
  one user, mind rate limits; cap concurrency / queue the topic jobs.
- **Future (other users):** a **"bring your own API key"** setting routes their AI jobs to their own
  Anthropic key. No shared paid endpoint — you never pay for someone else's analyses.

---

## 5. Database (Supabase / Postgres)

### 5.0 What Supabase is (one-minute primer)
An open-source **"backend-as-a-service"**: a hosted **Postgres** database that comes with **Auth**
(signup/login/sessions), **Storage** (files), auto-generated APIs, and **Row Level Security** (rules
*in the database* deciding who may read/write each row). You talk to it straight from the React app
with `@supabase/supabase-js` — RLS makes that safe without writing your own server. Develop locally
with the `supabase` CLI (the whole stack in Docker), then push the same schema to the hosted project —
**same Postgres both sides.** **Free tier exists** (enough to launch small); details in §8/§10.

### 5.1 Schema
```sql
-- users come from Supabase Auth (auth.users). App-facing profile + role:
profiles(            id uuid PK = auth.uid, username text UNIQUE, role text /*admin|user*/, created_at timestamptz)

-- the registry that powers the training SELECT and "add new symbol":
symbols(             id uuid PK, kind text /*sign|sigil*/, name text UNIQUE, label text,
                     engine_id text /*links to sigils.json/signs.json id, nullable for fan*/,
                     status text /*canon|fan*/, operator_kind text /*for fan signs → grammar semantics*/,
                     created_by uuid FK profiles, created_at timestamptz )

-- every training example (the flywheel asset). Soft-deletable for rollback:
training_samples(    id uuid PK, symbol_id uuid FK symbols, points jsonb /*[{X,Y,ID}]*/,
                     role text, rotation real, scale real,
                     source text /*drawn|corrected*/, app_version text,
                     created_by uuid FK profiles, created_at timestamptz,
                     deleted_at timestamptz NULL )      -- ← rollback / delete-by-user

-- logged analyses (feed the improvement loop):
analyses(            id uuid PK, composition jsonb, engine_result jsonb, ai_report jsonb,
                     corrections jsonb, created_by uuid FK, created_at timestamptz )

-- admin action trail (rollbacks, deletes, registry edits):
audit_log(           id uuid PK, actor uuid FK, action text, target jsonb, at timestamptz )

-- (future) community gallery:
spells(              id uuid PK, name text, composition jsonb, image_path text /*Storage*/,
                     ai_report jsonb, author uuid FK, visibility text, created_at timestamptz )
```

### 5.2 Why this shape
- **`created_at` + `created_by` on every sample** → exactly your review needs: rollback by date
  (`deleted_at = now() where created_at > cutoff`), or wipe a contributor (`where created_by = X`).
- **Soft-delete (`deleted_at`)** → rollbacks are reversible; the client only ever reads
  `deleted_at IS NULL`. Templates served to the recognizer = active samples grouped by `symbol`.
- **`symbols` registry** → the training UI is a **select** (no retyping), and "add new" is one insert;
  `engine_id` keeps labels tied to the real `sigils.json`/`signs.json` ids so produced spells analyze.
- **RLS:** users read their own + public data; only `role='admin'` writes symbols/training and runs
  rollbacks. Auth is enforced at the DB, not just the UI.

---

## 6. Auth & Admin

### 6.1 Auth
- **Supabase Auth** (email or username+password). First admin seeded via a one-off SQL/seed script.
  `profiles.role` gates Admin. No hand-rolled crypto — it's handled.

### 6.2 Admin screen (`/admin`, role=admin)
- **Training** — the *same canvas* in "training mode": draw a symbol → **select** it from the
  `symbols` registry **or add a new one** (name + kind + status + optional `operator_kind` for fan
  signs) → **Save** (writes a `training_sample` with your user id + timestamp). Live `$P` guess +
  example counter, exactly like the prototype.
- **Registry** — list / add / edit signs & sigils; mark canon vs fan; fan signs capture the operator
  semantics the engine needs (mirrors `grammar.json`).
- **Training review** — a table of samples filterable by **user** and **date**, with:
  - **Rollback by date** (soft-delete everything after a cutoff; restorable),
  - **Delete all by a user** (soft-delete `where created_by = X`),
  - **Audit log** of every admin action,
  - per-sample restore (undelete).

---

## 7. The improvement loop (Claude Code refines the engine/docs)

Human-in-the-loop, **never auto-merge**. The app accumulates `analyses` (composition + engine result +
AI report + your corrections) and training `corrections`. Then:

1. **Export a "review packet"** — a command/endpoint bundles recent data into
   `docs/review/packet-<date>.json` + a short markdown brief of the signals.
2. **A Claude Code session ingests it** (you run it, or a `/schedule` routine) and proposes **concrete
   diffs**, reusing the repo's existing [INGESTION.md](../INGESTION.md)/lexicon workflow:
   - frequent corrections → recognizer template gaps / mislabeled symbols,
   - engine-deduced vs AI-disagreed → **engine logic gaps** (deduce/grammar fixes),
   - low-confidence catalog matches → **missing recipes** for `spells.json`,
   - unknown signs encountered → new lexicon dossiers.
3. **You review & merge** as normal PRs. Optionally a weekly `/schedule` opens the proposal for you.

This is the safe version of "the app teaches the engine": data in → *proposals* out → your judgment merges.

---

## 8. Tech stack

| Layer | Choice |
|---|---|
| Front | keep **Vite + React**; add a router (Studio vs `/admin`), a canvas layer, `@supabase/supabase-js`, a Markdown renderer (`react-markdown`), CSS-variable themes |
| Canvas | plain `<canvas>` (the prototype/recognizer already proves it) — add shape tools |
| Recognizer | `src/draw/recognizer.js` (`$P` + pipeline) — client-side, templates from Supabase |
| Engine | existing `analyze()` — client-side, unchanged |
| Data/Auth | **Supabase** (local `supabase start` for dev, hosted for prod) |
| AI (dev) | `tools/ai-bridge.mjs` → `claude -p`, extended with `/report/stream` (SSE, parallel) |
| AI (prod) | serverless function → Anthropic API, gated/rate-limited |
| Deploy | front on Vercel/Netlify; Supabase hosted; AI serverless fn alongside the front |

---

## 9. Phased delivery (each phase ships something usable)

| Phase | Deliverable |
|---|---|
| **A** | Studio canvas: paint tools (brush/line/square/triangle/circle/eraser) + select/move; place signs/sigils from a static palette; build `composition`; wire existing engine `analyze()`. *(no DB, no recognition yet)* |
| **B** | Recognizer on drawn strokes + "Identified" panel + corrections → produces the composition. *(uses localStorage templates first)* |
| **C** | **Supabase** stand-up (local): schema §5, Auth, RLS. Move templates to DB; serve to the recognizer. Seed registry from `sigils.json`/`signs.json`. |
| **D** | **Admin** training screen (registry select + add-new) writing `training_samples` with user/timestamp; live guess. |
| **E** | **Training review**: rollback-by-date, delete-by-user, soft-delete/restore, audit log. |
| **F** | **AI report**: the `/spell-report` skill + `/report/stream` SSE + parallel topic cards (loading → filled). |
| **G** | **Improvement loop**: review-packet export + Claude Code ingestion workflow (+ optional `/schedule`). |
| **H** | **Prod**: deploy front + hosted Supabase + serverless AI (API, gated). Seed templates from SVGs so day-one recognition works. |
| **I** *(later)* | Community **gallery** (`spells` table + Storage): browse, share; every saved spell feeds the flywheel. |

---

### 9.1 Hosting & cost (free to start)
- **Supabase free tier** (verify current numbers): ~500 MB Postgres, ~1 GB Storage, ~50k monthly auth
  users, 2 projects — **free projects pause after ~1 week idle** (a request wakes them, or upgrade to
  Pro ~$25/mo). Enough to launch and run small.
- **Front** on Vercel/Netlify free tier. **AI** = your local bridge via a free tunnel. So a small
  launch can cost **$0** until usage grows.

## 10. Risks & honest constraints

- **Prod AI cost** — the free local-Claude trick doesn't serve strangers; budget the Anthropic API or
  gate/limit the AI report. Decide this before launch.
- **Recognizer cold start** — needs seeded templates (Phase H) to be useful on day one.
- **Shape-tool vs hand-drawn** — a tool-perfect square differs from a sketched one; train both or
  normalize before `$P`.
- **Segmentation** — still the hard part for dense freehand; placed symbols sidestep it entirely.
- **Concurrency/rate limits** — parallel AI subagents can hit limits; cap concurrency, queue topics.
- **Self-improvement safety** — keep it human-approved; never let the pipeline write the engine/docs
  unattended.
- **Security** — RLS + Auth are the real gate (not just hidden UI); don't expose admin writes without
  role checks server-side.

## 11. Open items to confirm

- **Resolved:** DB = Supabase · AI = local bridge via tunnel (BYO-key later) · report = Markdown ·
  paint colors = dyes · themes (brown default) · topics = the §4.1 menu, all on by default.
- Supabase free tier is enough to launch; pick the **hosting region** when we deploy (§10/Phase H).
- Front hosting target (Vercel vs Netlify) — decide at Phase H.
- Tunnel tool for the AI bridge (cloudflared vs ngrok) — decide at Phase F.
