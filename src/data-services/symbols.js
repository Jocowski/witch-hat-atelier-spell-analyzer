// data-services/symbols.js — registry queries for the `symbols` table.
import { supabase, hasSupabase } from './supabase.js'

/**
 * List symbols, optionally filtered by kind ('sign' | 'sigil').
 * @param {{ kind?: string }} [opts]
 * @returns {Promise<object[]>}
 */
export async function listSymbols({ kind } = {}) {
  if (!hasSupabase()) return []
  let query = supabase.from('symbols').select('*').order('name')
  if (kind) query = query.eq('kind', kind)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

/**
 * Resolve a registry symbol by its engine id (the sigils.json/signs.json id), falling back to a
 * case-insensitive name match. Used to turn a recognized/corrected type string into a real symbol
 * row (whose UUID a training_sample needs as its foreign key).
 * @param {string} engineId
 * @returns {Promise<object|null>} the symbol row, or null if absent / no DB.
 */
export async function getSymbolByEngineId(engineId) {
  if (!hasSupabase() || !engineId) return null
  const { data, error } = await supabase
    .from('symbols')
    .select('*')
    .or(`engine_id.eq.${engineId},name.eq.${engineId}`)
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] ?? null
}

/**
 * Insert a new symbol into the registry.
 * @param {{ kind: string, name: string, label?: string, engine_id?: string,
 *           status?: string, operator_kind?: string }} symbol
 * @returns {Promise<object>} The inserted row.
 */
export async function addSymbol({ kind, name, label, engine_id, status = 'canon', operator_kind }) {
  if (!hasSupabase()) return null
  const { data, error } = await supabase
    .from('symbols')
    .insert({ kind, name, label, engine_id, status, operator_kind })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Update fields on an existing symbol.
 * @param {string} id  UUID of the symbol row.
 * @param {object} patch  Partial column values to update.
 * @returns {Promise<object>} The updated row.
 */
export async function updateSymbol(id, patch) {
  if (!hasSupabase()) return null
  const { data, error } = await supabase
    .from('symbols')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Delete a symbol by id (hard delete; cascades to training_samples via FK).
 * @param {string} id  UUID of the symbol row.
 * @returns {Promise<void>}
 */
export async function deleteSymbol(id) {
  if (!hasSupabase()) return
  const { error } = await supabase.from('symbols').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Review queue: symbols with lc_status in (unverified, revised, deprecated) or lc_flag set.
 * Requires the F3 migration (20260606000000_symbols_lifecycle.sql) to be applied; returns []
 * when Supabase is unavailable or the columns don't exist yet.
 * @returns {Promise<object[]>}
 */
export async function listReviewQueue() {
  if (!hasSupabase()) return []
  const { data, error } = await supabase
    .from('symbols')
    .select('*')
    .or('lc_status.in.(unverified,revised,deprecated),lc_flag.not.is.null')
    .order('lc_status')
    .order('name')
  if (error) throw error
  return data ?? []
}
