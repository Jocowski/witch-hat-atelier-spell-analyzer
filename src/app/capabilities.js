// capabilities.js — runtime capability gates for the unified gated build.
//
// Four independent predicates drive all feature surfacing in the UI.
// See docs/app/specs/SPEC-web-unified-gating.md §2 for the full capability matrix.
//
// Pure exports (no React, no Supabase import at module-init time):
//   aiEnabled         — build-time constant; inlined by Vite so the AI chunk is tree-shaken in prod.
//   featuresFor(caps) — pure function: caps object → flat UI-surface booleans. Unit-testable.
//
// Supabase re-export:
//   hasSupabase       — re-exported from src/data-services/supabase.js (already a predicate fn).
//
// React export (depends on AuthProvider context):
//   useCapabilities() — hook combining all four gates into one object.

// ── Gate 1: AI Report (build-time) ────────────────────────────────────────────
// Set VITE_AI_ENABLED=1 in your local .env to enable. Never set in the Pages build.
export const aiEnabled = import.meta.env.VITE_AI_ENABLED === '1'

// ── Gate 2: Supabase present ───────────────────────────────────────────────────
// Re-export the existing hasSupabase predicate from the Supabase client module.
// It returns true when the client was constructed (both env vars present), false otherwise.
export { hasSupabase } from '../data-services/supabase.js'

// ── Feature derivation (pure, unit-testable) ──────────────────────────────────
/**
 * Derive the flat set of UI-surface feature booleans from the four gates.
 * Each gate is independent — no gate implies another.
 *
 * @param {{ hasSupabase: boolean, isAuthed: boolean, isAdmin: boolean, aiEnabled: boolean }} caps
 * @returns {{
 *   canLogin:             boolean,  // Config panel offers Login (requires a backend)
 *   canUseDbTraining:     boolean,  // "Use database training" toggle visible (authed users only)
 *   canShowTrainingTools: boolean,  // "Show training tools" toggle visible (authed users only)
 *   canOpenAdmin:         boolean,  // "Open Admin" action visible (admin users only)
 *   canUseAI:             boolean,  // AI Report panel exists (build-time gate)
 * }}
 */
export function featuresFor({ hasSupabase, isAuthed, isAdmin, aiEnabled }) {
  return {
    canLogin:             hasSupabase,
    canUseDbTraining:     isAuthed,
    canShowTrainingTools: isAuthed,
    canOpenAdmin:         isAdmin,
    canUseAI:             aiEnabled,
  }
}

// ── React hook (depends on AuthProvider) ─────────────────────────────────────
import { useAuth }     from '../admin/AuthProvider.jsx'
import { hasSupabase as _hasSupabase } from '../data-services/supabase.js'

/**
 * React hook — combines all four capability gates and returns the gate values
 * plus all derived feature booleans.
 *
 * Must be called inside <AuthProvider>.
 *
 * @returns {{
 *   hasSupabase:          boolean,
 *   isAuthed:             boolean,
 *   isAdmin:              boolean,
 *   aiEnabled:            boolean,
 *   canLogin:             boolean,
 *   canUseDbTraining:     boolean,
 *   canShowTrainingTools: boolean,
 *   canOpenAdmin:         boolean,
 *   canUseAI:             boolean,
 * }}
 */
export function useCapabilities() {
  const { session, role } = useAuth()
  const caps = {
    hasSupabase: _hasSupabase(),
    isAuthed:    !!session,
    isAdmin:     role === 'admin',
    aiEnabled,
  }
  return { ...caps, ...featuresFor(caps) }
}
