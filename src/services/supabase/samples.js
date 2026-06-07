// data-services/samples.js — training_samples read/write/soft-delete/restore.
import { supabase, hasSupabase } from './client.js'

// Config source: rules.json recognition.verifiedMultiplier (passed in via activeTemplates(weightCfg)).
const VERIFIED_MULTIPLIER_DEFAULT = 1.3

/**
 * Return all active (non-deleted) training samples joined with their symbol,
 * shaped for the $P recognizer template store.
 *
 * Each element carries the effective `weight` (= sourceWeight * verifiedMultiplier when verified).
 * The recognizer stays PURE — weights are resolved here and passed in via t.weight.
 *
 * Shape returned per element:
 *   { name: string,    // symbol.engine_id if set, else symbol.name
 *     role: string,    // sample.role if set, else derived from symbol.kind
 *     points: any,     // sample.points (jsonb — [{X,Y,ID}])
 *     source: string,  // 'drawn' | 'confirmed' | 'corrected' — source axis of weight (A1)
 *     verified: bool,  // true if an admin has vouched for this sample (A6)
 *     weight: number   // effectiveWeight = sampleWeights[source] * (verified ? verifiedMultiplier : 1)
 *   }
 *
 * @param {object} [weightCfg]  Optional weight config injected by the caller (from rules.json).
 *   { sampleWeights: { corrected, drawn, confirmed, web }, verifiedMultiplier }
 *   Defaults to { sampleWeights: { corrected:1.5, drawn:1.0, confirmed:0.6, web:0 }, verifiedMultiplier:1.0 }
 *   so the function degrades gracefully when the caller doesn't pass config (no verify bump = neutral).
 * @param {{ verifiedOnly?: boolean }} [opts]
 *   verifiedOnly — when true, only rows with verified=true are returned (for the seed ⊕ DB overlay path).
 *   Default false (returns all active rows, legacy behaviour).
 * @returns {Promise<Array<{ name: string, role: string, points: any, source: string, verified: boolean, weight: number }>>}
 */
export async function activeTemplates(weightCfg, { verifiedOnly = false } = {}) {
  if (!hasSupabase()) return []
  const {
    sampleWeights      = { corrected: 1.5, drawn: 1.0, confirmed: 0.6, web: 0 },
    verifiedMultiplier = VERIFIED_MULTIPLIER_DEFAULT,
  } = weightCfg ?? {}
  // NOTE: select `*` (not an explicit `verified` column) so this still works BEFORE the
  // 20260605000000_verified_samples migration is applied — otherwise PostgREST errors on the
  // missing column, activeTemplates throws, the Studio falls back to empty templates, and Detect
  // silently recognizes nothing. `row.verified` is simply undefined (→ treated as unverified)
  // until the migration lands; the weight bump then activates automatically.
  let query = supabase
    .from('training_samples')
    .select('*, symbols(engine_id, name, kind)')
    .is('deleted_at', null)
  if (verifiedOnly) query = query.eq('verified', true)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data.map((row) => {
    const src    = row.source || 'drawn'
    const srcW   = sampleWeights[src] ?? 1.0
    const weight = row.verified ? srcW * verifiedMultiplier : srcW
    return {
      name:     row.symbols?.engine_id || row.symbols?.name || '',
      role:     row.role || (row.symbols?.kind === 'sigil' ? 'sigil' : 'sign'),
      points:   row.points,
      source:   src,
      verified: row.verified ?? false,
      weight,
    }
  })
}

/**
 * Set or clear the verified flag on a training sample (admin only — enforced by RLS).
 * Stamps verified_by = current user and verified_at = now() when setting; clears both when unsetting.
 *
 * Web→drawn re-tier on verify: `source = 'web'` has weight 0 (rules.json recognition.sampleWeights),
 * so verifying a web sample without changing its source keeps it permanently inert (0 × multiplier = 0).
 * To make it count, we promote source to 'drawn' (weight 1) in the same update.
 * When unverifying, source is NOT reverted — the admin decision stands; a re-tier is permanent.
 *
 * @param {string}  id        UUID of the training_samples row.
 * @param {boolean} verified  true to verify (+ re-tier web→drawn), false to unverify (source unchanged).
 * @returns {Promise<object|null>} The updated row, or null when Supabase is absent.
 */
export async function setVerified(id, verified) {
  if (!hasSupabase()) return null
  let patch
  if (verified) {
    // Fetch the current source so we know whether to re-tier it.
    const { data: row, error: fetchErr } = await supabase
      .from('training_samples')
      .select('source')
      .eq('id', id)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)
    // Re-tier web→drawn: web weight is 0, so without this the verified multiplier still yields 0.
    const sourcePatch = row?.source === 'web' ? { source: 'drawn' } : {}
    patch = {
      ...sourcePatch,
      verified:    true,
      verified_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      verified_at: new Date().toISOString(),
    }
  } else {
    // Unverify: clear the verify fields only; do NOT revert source (re-tier is permanent).
    patch = { verified: false, verified_by: null, verified_at: null }
  }
  const { data, error } = await supabase
    .from('training_samples')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Per-symbol active-sample counts, for active-learning + ML-readiness (A3).
 * Returns a map keyed by the symbol's id AND its engine_id/name, each → count, plus a `_total`.
 * (Both keys are populated so callers can look up by registry id or by engine id.)
 *
 * @returns {Promise<Record<string, number>>}
 */
export async function sampleCounts() {
  if (!hasSupabase()) return {}
  const { data, error } = await supabase
    .from('training_samples')
    .select('symbol_id, symbols(engine_id, name)')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  const counts = { _total: 0 }
  for (const row of data) {
    counts._total++
    if (row.symbol_id) counts[row.symbol_id] = (counts[row.symbol_id] || 0) + 1
    const eng = row.symbols?.engine_id || row.symbols?.name
    if (eng) counts[eng] = (counts[eng] || 0) + 1
  }
  return counts
}

/**
 * Add a new training sample.
 * @param {{ symbol_id: string, points: any, role?: string, rotation?: number,
 *           scale?: number, source?: string, app_version?: string }} sample
 * @returns {Promise<object>} The inserted row.
 */
export async function addSample({ symbol_id, points, role, rotation, scale, source = 'drawn', app_version }) {
  if (!hasSupabase()) return null
  const { data, error } = await supabase
    .from('training_samples')
    .insert({ symbol_id, points, role, rotation, scale, source, app_version })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/**
 * List training samples with optional filters; includes deleted_at for review.
 * @param {{ userId?: string, from?: string, to?: string, verified?: boolean }} [opts]
 *   userId   — filter by created_by UUID
 *   from     — ISO timestamp lower bound (inclusive) on created_at
 *   to       — ISO timestamp upper bound (inclusive) on created_at
 *   verified — when true/false, restrict to verified/unverified rows; omit for all
 * @returns {Promise<object[]>}
 */
export async function listSamples({ userId, from, to, verified } = {}) {
  if (!hasSupabase()) return []
  let query = supabase
    .from('training_samples')
    .select('*')
    .order('created_at', { ascending: false })
  if (userId)              query = query.eq('created_by', userId)
  if (from)                query = query.gte('created_at', from)
  if (to)                  query = query.lte('created_at', to)
  if (verified !== undefined) query = query.eq('verified', verified)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

/**
 * Soft-delete all active samples created AFTER a given cutoff (rollback-by-date).
 * Sets deleted_at = now() where created_at > cutoffISO and deleted_at IS NULL.
 * @param {string} cutoffISO  ISO 8601 timestamp — rows newer than this are soft-deleted.
 * @returns {Promise<void>}
 */
export async function softDeleteByDate(cutoffISO) {
  if (!hasSupabase()) return
  const { error } = await supabase
    .from('training_samples')
    .update({ deleted_at: new Date().toISOString() })
    .gt('created_at', cutoffISO)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

/**
 * Soft-delete all active samples belonging to a specific user.
 * Sets deleted_at = now() where created_by = userId and deleted_at IS NULL.
 * @param {string} userId  UUID of the profiles row.
 * @returns {Promise<void>}
 */
export async function softDeleteByUser(userId) {
  if (!hasSupabase()) return
  const { error } = await supabase
    .from('training_samples')
    .update({ deleted_at: new Date().toISOString() })
    .eq('created_by', userId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

/**
 * Soft-delete a single training sample by id (reversible via restore).
 * Sets deleted_at = now() for the given row.
 * @param {string} id  UUID of the training_samples row.
 * @returns {Promise<void>}
 */
export async function softDeleteOne(id) {
  if (!hasSupabase()) return
  const { error } = await supabase
    .from('training_samples')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

/**
 * Restore a soft-deleted sample by clearing its deleted_at.
 * @param {string} id  UUID of the training_samples row.
 * @returns {Promise<object>} The restored row.
 */
export async function restore(id) {
  if (!hasSupabase()) return null
  const { data, error } = await supabase
    .from('training_samples')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
