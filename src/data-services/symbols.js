// data-services/symbols.js — registry queries for the `symbols` table.
import { supabase, hasSupabase } from './supabase.js'

// Writable columns. The dynamic-symbol columns (svg_path … substance_qualities) overlay the JSON
// baseline at runtime (see src/engine/symbolMerge.js); all are nullable. addSymbol/updateSymbol
// whitelist against this so callers can pass a partial row without listing every field.
const WRITABLE = [
  'kind', 'name', 'label', 'engine_id', 'status', 'operator_kind',
  'lc_status', 'lc_rev', 'lc_flag',
  // presentation
  'svg_path', 'render', 'family',
  // sign semantics
  'effect_tags', 'invertible', 'can_be_center', 'surrounds',
  // sign grammar operator
  'op_kind', 'op_verb', 'op_inverted_verb', 'op_directional', 'op_default_direction',
  // sigil semantics
  'element', 'substance', 'substance_raw', 'substance_qualities',
]

// Pick only whitelisted, defined keys from an input object.
function pickWritable(input) {
  const out = {}
  for (const k of WRITABLE) if (input[k] !== undefined) out[k] = input[k]
  return out
}

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
 * Insert a new symbol into the registry. Accepts any whitelisted column (see WRITABLE), so the
 * dynamic-symbol fields (svg_path, family, op_*, element, …) can be set at creation time.
 * @param {object} symbol  At minimum { kind, name }.
 * @returns {Promise<object>} The inserted row.
 */
export async function addSymbol(symbol) {
  if (!hasSupabase()) return null
  const row = pickWritable({ status: 'canon', ...symbol })
  const { data, error } = await supabase
    .from('symbols')
    .insert(row)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Update fields on an existing symbol (whitelisted against WRITABLE).
 * @param {string} id  UUID of the symbol row.
 * @param {object} patch  Partial column values to update.
 * @returns {Promise<object>} The updated row.
 */
export async function updateSymbol(id, patch) {
  if (!hasSupabase()) return null
  const { data, error } = await supabase
    .from('symbols')
    .update(pickWritable(patch))
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
