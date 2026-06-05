# SPEC — Unified Web Build with Runtime Capability Gating

**Branch:** `feat/web-unified` (off `feat/spell-studio-experiments`, the most-updated feature branch) →
later fast-forwarded onto `spell-studio-web` for deploy.
**Status:** planned (no code yet — this is the design + change map).
**Supersedes:** the deletion-fork model of [SPEC-web-prototype.md](../SPEC-web-prototype.md). That branch
shipped a static build by *physically removing* the backend; this spec keeps **one codebase** and reveals
features at **runtime** via independent gates. Once this ships, `spell-studio-web` becomes a deploy target,
not a divergent fork.
**Related:** [APP-PLAN.md](../APP-PLAN.md) · [PLAN-web-publish.md](../PLAN-web-publish.md) (execution plan) ·
[SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) (training flywheel).

---

## 1. Goal

A **single** Vite build, deployable to GitHub Pages, that:

- **Anonymous (default):** runs the full **draw → detect → analyze** loop with a **trained recognizer from
  a bundled static seed**. No login, no training UI, no AI. **Zero Supabase calls.** This is the public
  experience and it is identical in feel to today's `spell-studio-web` build.
- **Config gear (always present):** opens a settings drawer that offers **invite-only login** when a
  Supabase backend is configured.
- **Logged-in (invited) user:** can toggle **"Use database training"** (recognizer = seed ⊕ verified DB
  overlay) and **"Show training tools"** (reveal contribute-to-training buttons, hidden by default).
- **Logged-in admin:** additionally can open the **Admin** tools (Review / Registry / Trace / Training) to
  **verify / promote** submitted samples.
- **AI Report:** appears **only** when a build-time env var is set — i.e. on local `npm run dev`, never in
  the published build.

The guiding rule: **a contribution from an invited user is "web" training with weight 0 — it has no effect
on recognition until an admin verifies it.**

---

## 2. The gating contract (capability matrix)

Four **independent** gates. Each is a pure predicate; the UI keys off them. No gate implies another.

| Gate | Source of truth | True when | Controls |
|---|---|---|---|
| `hasSupabase()` | build env (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) | client constructed (non-null) | Config panel offers **Login** at all |
| `isAuthed()` | live Supabase session | a user is signed in | **Use DB training** + **Show training tools** toggles |
| `isAdmin()` | `profiles.role` via `is_admin()` | session user is admin | **Admin** tools (verify/promote/registry) |
| `aiEnabled` | `import.meta.env.VITE_AI_ENABLED === '1'` | set at build (local only) | **AI Report** tab/panel exists |

**Default anonymous state** = all gates false ⇒ Studio + static seed only.

`hasSupabase()` already exists ([src/data-services/supabase.js](../../../src/data-services/supabase.js) returns
`null` when env absent). `isAuthed()`/`isAdmin()` come from the existing `AuthProvider` + `is_admin()`. `aiEnabled`
is new (a build-time-inlined constant).

---

## 3. Feature behavior

### 3.1 Default recognizer = static seed

- The recognizer's templates are sourced from the **bundled** `data/training-seed.json` (built from
  `supabase/seed.sql` by `tools/build-training-seed.mjs`). **Refactor:** templates become **React
  state/context** (`useTemplates()`), not a module constant, so the source can switch at runtime.
- `useTemplates()` returns: **seed** by default; **seed ⊕ verified DB overlay** when *Use DB training* is on
  AND the user is authed. Merge (never replace) so recognition can only get **better than** the shipped
  baseline, and still works if the DB is paused/unreachable.

### 3.2 Config gear → invite-only login

- A gear button in the Studio chrome opens a **settings drawer** (modal, no routing).
- If `hasSupabase()`: render a **Login** section (email + password). **No sign-up link** — accounts are
  invite-only (§5). If `!hasSupabase()`: show "Backend not configured" and hide login.
- The Supabase client + auth UI are **lazy-loaded** on first open (§6).

### 3.3 "Use database training" toggle (authed)

- Default **OFF**. Persisted in `localStorage`. When ON, `useTemplates()` fetches **verified** rows
  (`verified = true`) and merges them over the seed.
- DB reads are **authed-only** — anonymous visitors never trigger a Supabase fetch (egress guard +
  avoids waking a paused free-tier project for the public).

### 3.4 "Show training tools" toggle (authed)

- Default **OFF**. When ON, reveals the contribute-to-training buttons in the Identified/Result panels
  (the same affordances the legacy Studio had, gated here).
- Submitting writes a `training_sample` with **`source = 'web'`, `verified = false`, `created_by = auth.uid()`**.
- **Weight 0 until verified.** Add `"web": 0` to `rules.json.recognition.sampleWeights`, AND the active
  overlay query filters `verified = true`. Two independent guarantees that an unverified web sample cannot
  influence anyone's recognition (including the submitter's own session).

### 3.5 Admin tools (admin)

- From the config panel, an **"Open Admin"** action (visible only when `isAdmin()`) lazy-loads `AdminPage`
  as a **full-screen overlay** (reuses its existing tab switch: Training / Registry / Trace / Review).
  **No router** — keeps GitHub Pages free of SPA 404s.
- **Review** gains/keeps a **Verify** action: sets `verified = true`, `verified_by`, `verified_at`, and
  optionally re-tiers `source` `'web' → 'drawn'`/`'corrected'` so its weight becomes ≥ 1. Only then does the
  sample enter the verified overlay.

### 3.6 AI Report (local only)

- The AI panel (`AIReportPanel` + `ai/report.js` + `ai/reportCache.js`) is **dynamic-imported** only when
  `aiEnabled`. Because the flag is build-time-inlined, the published build never sets it → the AI chunk is
  never requested in prod. Local `.env` sets `VITE_AI_ENABLED=1` (+ `VITE_AI_BRIDGE_URL`) → AI appears and
  talks to the local `claude -p` bridge.
- **The deploy workflow must never set `VITE_AI_*`.**

---

## 4. Database & RLS changes

Current state (from `supabase/migrations/`): `training_samples` already has `source`
(`check in ('drawn','corrected','confirmed')`), `verified`/`verified_by`/`verified_at`, `created_by`,
`deleted_at`; RLS = `samples_read_all` (select using `true`) + `samples_admin_write` (all, `is_admin()`).
`profiles` + `is_admin()` exist.

**New migration `20260609000000_web_submissions.sql`:**

1. **Extend the source constraint** to allow the public tier:
   ```sql
   alter table public.training_samples drop constraint if exists training_samples_source_check;
   alter table public.training_samples
     add constraint training_samples_source_check
     check (source in ('drawn','corrected','confirmed','web'));
   ```
2. **Authenticated insert policy** (invited users may submit, but only unverified web rows they own):
   ```sql
   create policy samples_authed_insert on public.training_samples
     for insert to authenticated
     with check (
       created_by = auth.uid()
       and source = 'web'
       and verified = false
     );
   ```
   (The existing `samples_admin_write` still covers admin insert/update/delete/verify. Authed users get
   **no** UPDATE/DELETE — they cannot self-verify or alter rows.)
3. **Tighten reads** (optional but recommended — egress + tidiness): replace `samples_read_all` with
   verified-or-owner-or-admin:
   ```sql
   drop policy if exists samples_read_all on public.training_samples;
   create policy samples_read_scoped on public.training_samples
     for select using (
       verified = true or created_by = auth.uid() or public.is_admin()
     );
   ```

**`rules.json`:** add `"web": 0` to `recognition.sampleWeights` (alongside `corrected:1.5, drawn:1,
confirmed:0.6`). Document it in the block's `note`.

**`analyses` logging:** keep authed-only (no anonymous writes) to avoid an anon write surface; the public
default doesn't log.

---

## 5. Auth: invite-only

- **Supabase dashboard → Authentication → disable public sign-ups** (invite-only). This is the linchpin of
  the trust model: the public can't self-register, so the *only* people who can submit training are people
  you invited. Combined with weight-0/unverified, even an invited user's submission is inert until you verify.
- Invite via the dashboard "Invite user" flow or `tools/seed-admin.mjs` (promote to admin where needed).
- The config panel shows **login only**, never a register link.

---

## 6. Bundle & lazy-loading

Keep the anonymous bundle ≈ today's web build. Eager vs. lazy:

- **Eager:** Studio, engine, recognizer, static seed, themes, export/import.
- **Lazy (dynamic `import()`):** `@supabase/supabase-js` + auth/login, the config-panel DB sections, the
  contribute-to-training UI, `AdminPage` + admin views (+ `imagetracerjs` via Trace), the AI panel.
- `vite.config.js`: keep `base: '/witch-hat-atelier-spell-analyzer/'`; `manualChunks` for `react`,
  `konva`, `supabase`, `markdown`. Verify the anonymous initial bundle does **not** include Supabase/admin/AI.

---

## 7. File / change map

**Port from `spell-studio-web` into this branch (the static seed pipeline):**
- `tools/build-training-seed.mjs`, `src/draw/seedTemplates.js`, `test/training-seed.test.js`,
  the `build:seed` npm script, the `base` in `vite.config.js`, `.github/workflows/deploy-pages.yml`
  (retarget trigger; add Supabase secrets to the build env — §8).
- Regenerate `data/training-seed.json` via `npm run build:seed`.

**New:**
- `src/studio/useTemplates.js` (or context) — seed default, seed ⊕ verified DB overlay when enabled.
- `src/studio/ConfigPanel.jsx` — gear-triggered drawer: login + toggles + (admin) Open-Admin.
- `src/app/capabilities.js` — the four gate predicates (`hasSupabase`, `isAuthed`, `isAdmin`, `aiEnabled`).
- `supabase/migrations/20260609000000_web_submissions.sql` (§4).

**Modified (re-gate, don't delete):**
- `src/main.jsx` — mount Studio + `AuthProvider`; **no router** (admin via lazy overlay).
- `src/studio/StudioPage.jsx` — templates from `useTemplates()`; AI panel behind `aiEnabled`; training
  buttons behind the toggle; wire the config gear.
- `src/studio/IdentifiedPanel.jsx` — contribute buttons behind *Show training tools*; submit writes
  `source='web', verified=false`.
- `src/data-services/samples.js` — `activeTemplates` filters `verified=true`; add `addWebSample()` (or
  reuse `addSample` with the web source).
- `rules.json` — `recognition.sampleWeights.web = 0`.
- `vite.config.js`, `package.json`, `.github/workflows/deploy-pages.yml`.

**Keep as-is (gated, not removed):** all of `src/admin/*`, `src/ai/*`, `src/data-services/*`,
`src/engine/symbolLoader.js`.

---

## 8. Env & secrets

| Var | Local `.env` | GitHub Actions (Pages build) |
|---|---|---|
| `VITE_SUPABASE_URL` | local stack URL | **hosted** project URL (Secret) |
| `VITE_SUPABASE_ANON_KEY` | local anon key | hosted anon key (Secret) — public by design; safe **iff** RLS is hardened |
| `VITE_AI_ENABLED` / `VITE_AI_BRIDGE_URL` | set (`1` / localhost) | **never set** |

`SUPABASE_SECRET` / service_role **never** appears in any `VITE_` var or the build env.
The deploy workflow injects the two Supabase secrets into the `npm run build` step's env.

---

## 9. Testing

- **Pure gating** — `capabilities` predicates: given caps ⇒ which features (unit, no DB).
- **`useTemplates`** — seed default; merge with verified overlay; never regresses below seed.
- **`symbolMerge` / overlay** — verified rows merge correctly; unverified excluded.
- **`build:seed`** — `training-seed.json` validates against canon ids (existing `training-seed.test.js`).
- **RLS** (SQL, optional but recommended): anon can read only verified; authed can insert web/unverified
  own rows only; authed cannot update/verify/delete; admin can verify.
- **Manual** (per [TEST-PLAN.md](../TEST-PLAN.md)): anon path unchanged & makes no network calls; login
  reveals toggles; submit → unverified row, no recognition change; admin verify → appears after overlay
  refresh / seed rebuild; AI absent in a prod-mode build, present locally.

---

## 10. Out of scope / later

- **Anonymous → quarantine submissions.** This spec is **authed-only writes** (invite-only as the trust
  gate). An anonymous public-submission lane (more volume, needs captcha/rate-limit) can be added later.
- **Spell gallery** — shareable spells table. Same quarantine pattern; separate spec.
- **Resampling stored points** to shrink the seed/rows ~5× — optimization, not required for launch.
- **ML model** swap for `$P` — gated by `mlReadiness` coverage; unrelated to this work.
