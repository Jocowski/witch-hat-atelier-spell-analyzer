# PLAN — Publish Spell Studio to GitHub Pages (unified, gated)

**Branch:** `feat/web-unified` (off `feat/spell-studio-experiments`) → deploys via `spell-studio-web`.
**Spec:** [specs/SPEC-web-unified-gating.md](specs/SPEC-web-unified-gating.md) — the design & change map.
**Goal:** publish one build where the public gets a polished, backend-free **draw → detect → analyze**
experience, and invited users / admins unlock DB training behind a config gear — with **invited
submissions worth 0 until an admin verifies them**, and **AI only on localhost**.

This file is the **execution order**: what to do, in what sequence, and how we know each step is done.

---

## Decisions locked (from the conversation)

- **Invite-only accounts.** Supabase public sign-up disabled; only invited users exist. (The trust gate.)
- **Invited submissions = `source:'web'`, `verified:false`, weight 0.** Inert until an admin verifies.
- **One codebase, runtime gating** — not a deletion-fork. The old `spell-studio-web` becomes a deploy
  target only.
- **Base branch = `feat/spell-studio-experiments`** (the genuinely most-updated branch; `main` is behind
  by the Orb + Spell Trial commits).
- **AI Report = build-time env gate** (`VITE_AI_ENABLED`); never set in the Pages build.

---

## Prerequisites (do before / alongside code)

1. **Create a hosted Supabase project** (free tier). Record its URL + anon key.
2. **Push migrations** to it (`supabase db push` / `migration up`), including the new
   `20260609000000_web_submissions.sql` (Wave 3).
3. **Authentication → disable public sign-ups** (invite-only).
4. **Seed an admin** (`tools/seed-admin.mjs`) and invite yourself.
5. **GitHub repo:** Settings → Pages → Source = **GitHub Actions**; repo **public**.
6. **GitHub Secrets:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (hosted values). **Do not** add any
   `VITE_AI_*` secret.

---

## Waves

### Wave 1 — Port the static seed pipeline onto `feat/web-unified`
Bring the static-build machinery from `spell-studio-web` (it's not on the feature branch):
- `tools/build-training-seed.mjs`, `src/draw/seedTemplates.js`, `test/training-seed.test.js`,
  `build:seed` npm script, `base` in `vite.config.js`, `.github/workflows/deploy-pages.yml`.
- `npm run build:seed` → regenerate `data/training-seed.json`.
- **Done when:** `npm run build` produces a working static bundle and `npm test` is green, *with all the
  backend code still present* (we re-gate it, not delete it).

### Wave 2 — Capabilities + `useTemplates` refactor (no behavior change yet)
- `src/app/capabilities.js` — `hasSupabase` / `isAuthed` / `isAdmin` / `aiEnabled` predicates.
- `src/studio/useTemplates.js` — returns the **static seed** by default (parity with Wave 1).
- Rewire `StudioPage` to read templates from `useTemplates()`.
- **Done when:** anonymous Studio behaves exactly as Wave 1 (seed recognizer), tests green, and a quick
  bundle check shows the anon path pulls **no** Supabase/admin/AI chunk.

### Wave 3 — Database & RLS
- Migration `20260609000000_web_submissions.sql`: extend `source` check to include `'web'`; add
  `samples_authed_insert` (web/unverified/own only); tighten read to verified-or-owner-or-admin.
- `rules.json`: `recognition.sampleWeights.web = 0` (+ note).
- Push to the hosted project; verify policies with the anon key and an invited (non-admin) JWT.
- **Done when:** anon can read only verified rows; an invited user can insert a web/unverified row but
  **cannot** update/verify/delete; admin can verify.

### Wave 4 — Config gear, login, toggles (gated UI)
- `src/studio/ConfigPanel.jsx` — gear-triggered drawer; lazy-loads Supabase/auth.
  - Login section when `hasSupabase()` (no register link).
  - When `isAuthed()`: **Use database training** + **Show training tools** toggles (localStorage).
  - When `isAdmin()`: **Open Admin** (lazy `AdminPage` overlay).
- `useTemplates()` gains the **seed ⊕ verified DB overlay** path (authed + toggle on).
- `IdentifiedPanel` contribute buttons behind *Show training tools*; submit → `source:'web'`.
- **Done when:** the capability matrix in the spec is observable end-to-end in the running app.

### Wave 5 — Admin verify loop + AI gate
- Ensure **Review** has a **Verify** action (set `verified`, re-tier `source`); confirm verified samples
  reach the overlay after refresh.
- AI panel behind `aiEnabled` via dynamic import; confirm absent in a prod-mode build, present locally.
- Document/automate the **seed refresh loop**: verify in DB → `npm run seed:training`
  (DB→`seed.sql`) → `npm run build:seed` (→`training-seed.json`) → commit → deploy.
- **Done when:** a sample submitted by an invited user is inert until verified, then (a) shows in the DB
  overlay for opted-in users and (b) can be baked into the next static seed for everyone.

### Wave 6 — Ship
- Merge/fast-forward `feat/web-unified` → `spell-studio-web`; push → workflow builds & deploys.
- Run the launch checklist below against the live URL.

---

## Acceptance criteria (the whole thing is "done" when…)

1. **Anonymous visitor:** full draw→detect→analyze on the static seed; **no** network calls to Supabase;
   no login/training/AI surfaces. Bundle ≈ current web build.
2. **Config gear** present; offers login only when backend configured; **no public sign-up** anywhere.
3. **Invited user:** can enable DB training (seed ⊕ verified) and submit samples; submissions are
   `web`/`verified:false`/**weight 0** and change recognition for **no one**.
4. **Admin:** can verify a submission; once verified it enters the overlay and can be baked into the seed.
5. **AI Report:** visible on local `npm run dev`, **absent** on the published site.
6. `npm test` green; `npm run build` clean; RLS verified with real anon + invited JWTs.

---

## Launch checklist (live URL)

- [ ] Pages source = GitHub Actions; repo public; workflow green.
- [ ] Hosted Supabase reachable; migrations applied; sign-ups disabled; admin seeded.
- [ ] Anon load makes zero Supabase requests (DevTools network).
- [ ] Login (invited) → toggles appear; submit → row is `web`/unverified.
- [ ] Recognition unchanged by an unverified submission (different account / incognito).
- [ ] Admin verify → sample usable; `seed:training` + `build:seed` refreshes the public baseline.
- [ ] AI tab not present in prod; present locally.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Anon key public in the bundle | Designed to be public; **RLS hardened** (Wave 3); invite-only sign-up; service_role never shipped |
| Poisoned training data | Invite-only + `verified:false`/weight-0 by construction; admin verify is the only path in |
| Bundle bloat from re-added backend | Lazy-load Supabase/admin/AI; verify anon chunk excludes them (Wave 2) |
| Free-tier egress (5 GB/mo) | Anon uses the **static seed** (GitHub bandwidth); DB reads are authed-only |
| Free-tier 7-day pause | Only affects logged-in DB actions; public default never touches Supabase |
| AI leaking to prod | Build-time `VITE_AI_ENABLED`; workflow never sets `VITE_AI_*` |
| Branch drift returns | This is a single codebase; `spell-studio-web` is now a deploy target, not a fork |

---

## Out of scope (later)

Anonymous→quarantine public submissions (volume, needs captcha/rate-limit); spell **gallery**; point
resampling to shrink seed/rows; `$P`→ML model swap.
