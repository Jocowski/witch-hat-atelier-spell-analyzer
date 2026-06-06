// data-services/prototypes.js — symbol_prototypes read/write/flywheel (M4b).
//
// The prototype for a symbol is a mean-pooled, L2-normalized embedding computed
// from that symbol's active training samples via the ML encoder.  Storing prototypes
// in Supabase lets the correction flywheel update them without Python retraining:
//   save a sample → rebuildPrototypeForSymbol → upsertPrototype → next Detect uses it.
//
// Shape of a loaded prototype row (matches the bundled prototypes.json per-symbol shape
// so mlRecognizer.js can consume both from the same code path):
//   { symbol_id, name, role, embedding: number[], model_version }
//
// Graceful degradation: every function early-returns [] / null when !hasSupabase(),
// mirroring the samples.js pattern.  mlRecognizer falls back to the bundled
// prototypes.json when this module returns [].
import { supabase, hasSupabase } from './supabase.js'

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Load all prototypes for a given model version, joined with their symbol name + role.
 *
 * Returns a flat array ready for mlRecognizer: each element has the same shape as
 * a bundled prototypes.json entry so both sources are interchangeable:
 *   { symbol_id, name, role, embedding: number[], model_version }
 *
 * Returns [] when Supabase is absent (mlRecognizer falls back to bundled prototypes).
 *
 * @param {string} modelVersion  The model version string (from model.meta.json `version`).
 * @returns {Promise<Array<{ symbol_id: string, name: string, role: string, embedding: number[], model_version: string }>>}
 */
export async function loadPrototypes(modelVersion) {
  if (!hasSupabase()) return []
  const { data, error } = await supabase
    .from('symbol_prototypes')
    .select('symbol_id, model_version, embedding, updated_at, symbols(engine_id, name, kind)')
    .eq('model_version', modelVersion)
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return []
  return data.map((row) => ({
    symbol_id:     row.symbol_id,
    // Prefer engine_id (the canonical recognizer name) over the display name.
    name:          row.symbols?.engine_id || row.symbols?.name || row.symbol_id,
    // kind 'sigil' → role 'sigil'; anything else → 'sign' (mirrors samples.js role derivation).
    role:          row.symbols?.kind === 'sigil' ? 'sigil' : 'sign',
    // embedding is stored as a jsonb array of numbers; parse if it arrives as a string.
    embedding:     Array.isArray(row.embedding) ? row.embedding : JSON.parse(row.embedding),
    model_version: row.model_version,
  }))
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Upsert a single prototype for a (symbol_id, model_version) pair.
 * Stamps updated_by = current auth user, updated_at = now().
 *
 * Returns null when Supabase is absent (no-op, graceful).
 *
 * @param {{ symbol_id: string, embedding: number[]|Float32Array, model_version: string }} proto
 * @returns {Promise<object|null>}  The upserted row, or null when Supabase is absent.
 */
export async function upsertPrototype({ symbol_id, embedding, model_version }) {
  if (!hasSupabase()) return null
  // Convert Float32Array / typed array to a plain number[] for jsonb storage.
  const embArray = Array.isArray(embedding) ? embedding : Array.from(embedding)
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null
  const { data, error } = await supabase
    .from('symbol_prototypes')
    .upsert(
      {
        symbol_id,
        model_version,
        embedding: embArray,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: 'symbol_id,model_version' }
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

// ─── Flywheel ─────────────────────────────────────────────────────────────────

/**
 * Flywheel: rebuild and upsert the prototype for one symbol from its active samples.
 *
 * Steps:
 *   1. Fetch the symbol's active (non-deleted) training samples from Supabase.
 *      With verifiedOnly=true, only verified samples are used (higher quality signal).
 *   2. Embed each sample's strokes via the injected `embedFn` (= mlRecognizer.embedStrokes).
 *      `embedFn` is injected (not imported directly) to keep this module decoupled from onnx —
 *      this preserves the lazy-chunk invariant: no onnxruntime-web is loaded unless the caller
 *      (TrainingView) has already loaded it.
 *   3. Mean-pool the embeddings, L2-normalize the result.
 *   4. Call upsertPrototype with the new vector.
 *
 * Returns null (no-op) when:
 *   - Supabase is absent
 *   - The symbol has no active samples (nothing to learn from)
 *   - All embed calls fail (embedFn throws for every sample)
 *
 * @param {string}   symbol_id    UUID of the symbols row.
 * @param {object}   opts
 * @param {Function} opts.embedFn        Async fn(strokes, {role?}) → Float32Array  (= embedStrokes).
 * @param {string}   opts.modelVersion   Version string from model.meta.json.
 * @param {boolean}  [opts.verifiedOnly] When true, use only verified samples (default false).
 * @returns {Promise<object|null>}  The upserted row, or null on no-op / no Supabase.
 */
export async function rebuildPrototypeForSymbol(symbol_id, { embedFn, modelVersion, verifiedOnly = false }) {
  if (!hasSupabase()) return null

  // 1. Fetch the symbol's active samples + symbol kind (for role derivation).
  let query = supabase
    .from('training_samples')
    .select('points, role, symbols(engine_id, name, kind)')
    .eq('symbol_id', symbol_id)
    .is('deleted_at', null)
  if (verifiedOnly) query = query.eq('verified', true)

  const { data: samples, error } = await query
  if (error) throw new Error(error.message)
  if (!samples || samples.length === 0) return null

  // Derive the role from the symbol kind (sigil → 'sigil'; else → 'sign').
  const sym = samples[0]?.symbols
  const role = sym?.kind === 'sigil' ? 'sigil' : 'sign'

  // 2. Embed each sample — accumulate successes, silently skip failures.
  const embeddings = []
  for (const sample of samples) {
    const pts = sample.points  // [{X,Y,ID}]
    if (!pts || pts.length < 2) continue
    // Convert stored {X,Y,ID} points to the strokes format embedFn expects: [[{x,y}]].
    // Group by ID to reconstruct individual strokes.
    const byId = new Map()
    for (const p of pts) {
      const id = p.ID ?? 0
      if (!byId.has(id)) byId.set(id, [])
      byId.get(id).push({ x: p.X, y: p.Y })
    }
    const strokes = [...byId.values()].filter((s) => s.length >= 2)
    if (!strokes.length) continue
    try {
      const emb = await embedFn(strokes, { role })
      if (emb && emb.length > 0) embeddings.push(emb)
    } catch {
      // Skip this sample if embed fails — don't propagate; partial prototypes are better than none.
    }
  }

  if (embeddings.length === 0) return null

  // 3. Mean-pool the embeddings, then L2-normalize.
  const dim = embeddings[0].length
  const mean = new Float32Array(dim)
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) mean[i] += emb[i]
  }
  for (let i = 0; i < dim; i++) mean[i] /= embeddings.length
  const norm = Math.sqrt(mean.reduce((s, v) => s + v * v, 0))
  if (norm > 1e-10) {
    for (let i = 0; i < dim; i++) mean[i] /= norm
  }

  // 4. Upsert.
  return upsertPrototype({ symbol_id, embedding: mean, model_version: modelVersion })
}
