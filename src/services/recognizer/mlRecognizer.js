// mlRecognizer.js — ML recognizer: onnxruntime-web inference + cosine prototype matching (M4).
//
// ── Architecture ──────────────────────────────────────────────────────────────
// This is the "ml" engine back-end behind recognizerEngine.js.  It NEVER runs
// for "engine:'p'" users — the dispatcher lazy-imports this file only on demand.
//
// SPEC-ml-recognizer.md §M4 traps honoured:
//   • numThreads = 1 — GitHub Pages sends no COOP/COEP; multi-thread wasm hangs.
//   • Vite `?url` import for model.onnx — base-path-safe URL (no hardcoded paths).
//   • All onnx/asset imports are DYNAMIC (inside functions, not at module level) —
//     so the module itself is Node-importable without crashing node --test.
//   • One rasterizer (glyphRasterizer.js) — train/serve pixel skew is designed out.
//
// ── Prototypes (M4b: Supabase-first with bundled fallback) ────────────────────
// Load order: Supabase symbol_prototypes (keyed by model_version) → bundled prototypes.json.
// Supabase prototypes are updated by the flywheel (rebuildPrototypeForSymbol in prototypes.js)
// on every training sample save, without Python retraining.
// Bundled prototypes.json shape (offline fallback):
//   { modelVersion: number, inputSize: number,
//     symbols: { [idx]: { name: string, role: 'sign'|'sigil', embedding: number[] } } }
//
// ── Public API ────────────────────────────────────────────────────────────────
//   warmupMl(opts?)                                     → Promise<boolean>
//   embedStrokes(strokes, opts?)                        → Promise<Float32Array>
//   rankWithMlRuntime(runtime, strokes, opts?)          → Promise<[{name,role,score,cosine}]>
//     (M5 injectable-runtime core — the harness calls this with a Node-loaded session)
//   rankWithMl(strokes, opts?)                          → Promise<[{name,role,score,cosine}]>
//     (convenience wrapper: loads the browser runtime, then calls rankWithMlRuntime)
//   recognizeWithMl({strokes,opts,runP})                → Promise<analyzeStrokes-shaped result>
//
// ── M5 injectable-loader design (SPEC-ml-recognizer.md §M5) ──────────────────
// The ranking math (rasterize → embed → best-cosine-over-rotations → softmax → ranked list)
// lives entirely in `rankWithMlRuntime(runtime, strokes, opts)`.  The `runtime` object is
// `{ ort, session, prototypes, meta }`.  The browser passes it from `getRuntimeAsync()`;
// the Node harness builds its own `runtime` using `readFileSync` + local `file://` wasm
// paths, then calls the SAME `rankWithMlRuntime`.  No ranking logic is duplicated.
//
// ── Node-safety ───────────────────────────────────────────────────────────────
// No top-level ort/fetch/canvas — everything is inside async functions behind
// the lazy-singleton `_runtimePromise`.  `node --test` can import this file.

import { rasterizeStrokes, rasterToModelInput } from '#domain/recognizer/glyphRasterizer.js'
import { buildComposition, buildMultiRingComposition } from '#domain/recognizer/recognizer.js'

// ─── Rotation sweeps ──────────────────────────────────────────────────────────

// Signs: full-circle sweep at 30° steps (12 rotations).
const SIGN_ROTATIONS  = Array.from({ length: 12 }, (_, i) => i * 30)
// Sigils: upright only (the $P pipeline classifies them as core and sweeps [0]).
const SIGIL_ROTATIONS = [0]
// Fallback when role is unknown: full circle.
const FULL_ROTATIONS  = SIGN_ROTATIONS

// ─── Softmax with temperature ─────────────────────────────────────────────────

/**
 * Softmax over an array of logits (cosine similarities) with temperature.
 * Higher temperature → flatter distribution.
 */
function softmaxWithTemperature(values, temperature = 0.1) {
  const t = Math.max(temperature, 1e-6)
  const scaled = values.map((v) => v / t)
  const maxS = Math.max(...scaled)
  const exps = scaled.map((v) => Math.exp(v - maxS))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

// ─── L2 normalization ─────────────────────────────────────────────────────────

function l2Normalize(arr) {
  let norm = 0
  for (let i = 0; i < arr.length; i++) norm += arr[i] * arr[i]
  norm = Math.sqrt(norm)
  if (norm < 1e-10) return arr
  const out = new Float32Array(arr.length)
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] / norm
  return out
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  // Both vectors are L2-normalized, so norms = 1 and cosine = dot product.
  return dot
}

// ─── Lazy runtime singleton ──────────────────────────────────────────────────

/**
 * The lazy singleton state.  Set to null so a caller retry re-triggers loading.
 * @type {Promise<{session: ort.InferenceSession, prototypes: Array, meta: object}> | null}
 */
let _runtimePromise = null

/**
 * Load (once) the ort session + prototypes + meta.
 * All imports are dynamic so this file stays Node-safe at module-eval time.
 * On failure _runtimePromise is nulled so the next caller retries.
 */
function getRuntimeAsync() {
  if (_runtimePromise) return _runtimePromise
  _runtimePromise = (async () => {
    try {
      // Dynamic import — not executed at module load time.
      const ort = await import('onnxruntime-web')

      // ── Trap: GitHub Pages has no COOP/COEP → multi-thread wasm hangs.
      // Always force single-thread.
      ort.env.wasm.numThreads = 1

      // ── CDN wasm paths (match the installed version; avoids bundling the heavy wasm).
      // onnxruntime-web 1.26.0 publishes to jsdelivr under the same version.
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/'

      // ── Load model.onnx via Vite's `?url` import (base-path aware).
      // `?url` returns the final public URL string after Vite processes it.
      const { default: modelUrl } = await import('./ml-assets/model.onnx?url')

      // ── Create the inference session.
      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
      })

      // ── Load model meta (version string for Supabase prototype keying).
      const { default: metaData } = await import('./ml-assets/model.meta.json')
      const modelVersion = String(metaData.version ?? '1')

      // ── M4b: Load prototypes Supabase-first, fall back to the bundled prototypes.json.
      //    Dynamic import keeps the Supabase client out of the "engine:p" bundle path.
      let prototypes = []
      try {
        const { loadPrototypes } = await import('../supabase/prototypes.js')
        const dbRows = await loadPrototypes(modelVersion)
        if (dbRows && dbRows.length > 0) {
          prototypes = dbRows.map((row) => ({
            name:      row.name,
            role:      row.role,
            embedding: new Float32Array(row.embedding),
          }))
        }
      } catch {
        // Supabase unavailable or query failed — fall through to bundled fallback below.
        prototypes = []
      }

      // Bundled fallback: used when Supabase is absent, offline, or returned no rows.
      if (prototypes.length === 0) {
        const { default: protoData } = await import('./ml-assets/prototypes.json')
        prototypes = Object.values(protoData.symbols).map((sym) => ({
          name:      sym.name,
          role:      sym.role,
          embedding: new Float32Array(sym.embedding),
        }))
      }

      // L2-normalize all prototype embeddings once (prototypes come from the Python bake
      // or Supabase where vectors are already normalized, but normalize defensively).
      for (const p of prototypes) {
        p.embedding = l2Normalize(p.embedding)
      }

      const meta = {
        modelVersion,
        inputSize:    metaData.inputSize ?? 32,
        embeddingDim: prototypes[0]?.embedding.length ?? 64,
      }

      return { ort, session, prototypes, meta }
    } catch (err) {
      // Allow retry on the next call.
      _runtimePromise = null
      throw err
    }
  })()
  return _runtimePromise
}

// ─── Low-level: run the model for one raster ──────────────────────────────────

/**
 * Run the onnx session for one (pre-rasterized, normalized) Float32Array input.
 * Returns the raw embedding Float32Array (not yet L2-normalized).
 *
 * @param {object}     session   ort.InferenceSession
 * @param {object}     ort       the onnxruntime-web module (for Tensor construction)
 * @param {Float32Array} input   model input (inputSize*inputSize values in [0,1])
 * @param {number}     size      model input grid side (e.g. 32)
 * @returns {Promise<Float32Array>}
 */
async function runEmbedding(session, ort, input, size) {
  const tensor = new ort.Tensor('float32', input, [1, 1, size, size])
  const feeds = { [session.inputNames[0]]: tensor }
  const results = await session.run(feeds)
  const raw = results[session.outputNames[0]].data
  // Convert to plain Float32Array if it isn't already (some ort builds return a typed view).
  return raw instanceof Float32Array ? raw : new Float32Array(raw)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Pre-warm the ML runtime (load model + prototypes ahead of first recognition).
 * Returns true on success, false if anything fails (non-fatal — graceful degrade).
 *
 * @param {object} [_opts]  reserved for future use
 * @returns {Promise<boolean>}
 */
export async function warmupMl(_opts) {
  try {
    await getRuntimeAsync()
    return true
  } catch {
    return false
  }
}

/**
 * Embed a set of strokes into a single L2-normalized Float32Array by:
 *   1. Rasterizing at each candidate rotation,
 *   2. Running the onnx encoder,
 *   3. Picking the embedding that produces the highest cosine against any prototype.
 *
 * The "best-rotation" strategy is not applied here — this function returns the
 * embedding at the single rotation that is most likely to be the canonical upright,
 * computed as the one with the highest maximum cosine against any prototype.
 * (For the ranker, we embed at each rotation separately and keep the best cosine
 * per prototype — see rankWithMl.)
 *
 * @param {Array}  strokes  Array of strokes ({x,y}|{X,Y} arrays).
 * @param {object} [opts]
 * @param {string} [opts.role]  'sign' | 'sigil' — selects the rotation sweep.
 * @returns {Promise<Float32Array>}  L2-normalized embedding vector.
 */
export async function embedStrokes(strokes, opts = {}) {
  const { ort, session, prototypes, meta } = await getRuntimeAsync()
  const role = opts.role
  const rotations = role === 'sigil' ? SIGIL_ROTATIONS : SIGN_ROTATIONS
  const size = meta.inputSize

  let bestEmbedding = null
  let bestMaxCos = -Infinity

  for (const deg of rotations) {
    const raster = rasterizeStrokes(strokes, { size, rotationDeg: deg })
    const input  = rasterToModelInput(raster)
    const raw    = await runEmbedding(session, ort, input, size)
    const emb    = l2Normalize(raw)

    // Quickly score this rotation by its best cosine against any prototype.
    let maxCos = -Infinity
    for (const p of prototypes) {
      const cos = cosineSimilarity(emb, p.embedding)
      if (cos > maxCos) maxCos = cos
    }

    if (maxCos > bestMaxCos) {
      bestMaxCos    = maxCos
      bestEmbedding = emb
    }
  }

  return bestEmbedding ?? new Float32Array(meta.embeddingDim)
}

/**
 * Core ranking logic — injectable runtime (M5 seam).
 *
 * This is the SINGLE source of truth for "rasterize → embed → best-cosine-over-rotations →
 * softmax → ranked list".  Both the browser path (`rankWithMl`) and the Node harness
 * (M5 accuracy harness) call this function with a pre-loaded `runtime` object.
 * Only the *loading* differs by environment; the math here is identical in both.
 *
 * @param {{ ort: object, session: object, prototypes: Array, meta: object }} runtime
 * @param {Array}  strokes
 * @param {object} [opts]
 * @param {string} [opts.role]  'sign' | 'sigil' | undefined
 * @returns {Promise<Array<{name:string, role:string, score:number, cosine:number}>>}
 *   Sorted best-first.
 */
export async function rankWithMlRuntime(runtime, strokes, opts = {}) {
  const { ort, session, prototypes, meta } = runtime
  const role = opts.role
  const rotations = role === 'sigil' ? SIGIL_ROTATIONS : (role === 'sign' ? SIGN_ROTATIONS : FULL_ROTATIONS)
  const size = meta.inputSize

  // best cosine per prototype across all rotations
  const bestCos = new Float32Array(prototypes.length).fill(-Infinity)

  for (const deg of rotations) {
    const raster = rasterizeStrokes(strokes, { size, rotationDeg: deg })
    const input  = rasterToModelInput(raster)
    const raw    = await runEmbedding(session, ort, input, size)
    const emb    = l2Normalize(raw)

    for (let i = 0; i < prototypes.length; i++) {
      const cos = cosineSimilarity(emb, prototypes[i].embedding)
      if (cos > bestCos[i]) bestCos[i] = cos
    }
  }

  // Convert cosines → scores via softmax with temperature.
  const cosArray = Array.from(bestCos)
  const scores   = softmaxWithTemperature(cosArray, 0.1)

  const ranked = prototypes.map((p, i) => ({
    name:   p.name,
    role:   p.role,
    score:  scores[i],
    cosine: bestCos[i],
  }))

  // Sort by score descending.
  ranked.sort((a, b) => b.score - a.score)
  return ranked
}

/**
 * Rank all known symbols against the drawn strokes using the ML encoder.
 * Convenience wrapper: loads the browser runtime (lazy singleton), then delegates
 * to rankWithMlRuntime — the shared scoring core.
 *
 * @param {Array}  strokes
 * @param {object} [opts]
 * @param {string} [opts.role]  'sign' | 'sigil' | undefined
 * @returns {Promise<Array<{name:string, role:string, score:number, cosine:number}>>}
 *   Sorted best-first.
 */
export async function rankWithMl(strokes, opts = {}) {
  const runtime = await getRuntimeAsync()
  return rankWithMlRuntime(runtime, strokes, opts)
}

/**
 * Full-pipeline ML recognition: runs $P structure via runP(), then re-labels
 * each group's identity using the ML encoder + prototype match, then rebuilds
 * the composition (both single-ring and multi-ring).
 *
 * Single-ring: composition rebuilt via the exported `buildComposition` from recognizer.js.
 * Multi-ring:  composition rebuilt via the exported `buildMultiRingComposition` from recognizer.js
 *   (same pure assembler the $P path uses — single source of truth, so ML and $P differ only in
 *   leaf identity, never in composition structure).
 *
 * @param {{ strokes: Array, opts: object, runP: () => unknown }} params
 * @returns {Promise<object>}  analyzeStrokes-shaped result with engine:'ml'
 */
export async function recognizeWithMl({ strokes: _strokes, opts, runP }) {
  // 1. Get the full $P structure (ring detection, grouping, relations).
  //    runP() returns the {ring,center,ringR,rings,ringGroups,groups,relations,composition} shape.
  const structure = await Promise.resolve(runP())

  // If there are no groups to relabel, return the structure as-is.
  if (!structure || !Array.isArray(structure.groups) || structure.groups.length === 0) {
    return { ...structure, engine: 'ml' }
  }

  try {
    const { meta } = await getRuntimeAsync()
    const confidenceMinPct = opts?.confidenceMinPct ?? 0

    // 2. Relabel each group's identity using the ML encoder.
    await relabelGroups(structure.groups, { meta, confidenceMinPct })

    // 3. Rebuild the composition from the ML-relabeled groups.
    const isMultiRing = structure.rings && structure.rings.length > 1
    let composition
    if (isMultiRing) {
      // Multi-ring: rebuild the wha-spell@2 composition from ML-relabeled ringGroups using the
      // SAME exported assembler the $P path uses. relabelGroups() mutates groups in place, and
      // structure.groups entries === the objects inside structure.ringGroups[i].groups, so the
      // ringGroups already carry ML labels. No geometry is recomputed — only leaf identity changed.
      composition = buildMultiRingComposition(structure.ringGroups, structure.relations)
    } else {
      // Single-ring: rebuild the wha-spell@1 composition from the relabeled groups.
      composition = buildComposition(structure.groups, structure.center, structure.ring)
    }

    return {
      ...structure,
      groups:      structure.groups,
      composition,
      engine:      'ml',
    }
  } catch (err) {
    // If the ML engine fails mid-flight (e.g. ort session error), fall back
    // to the $P structure with a note rather than crashing the caller.
    return {
      ...structure,
      engine:  'ml',
      _mlError: err?.message ?? String(err),
    }
  }
}

// ─── Internals ────────────────────────────────────────────────────────────────

/**
 * Relabel each group in place: embed its strokes via the ML encoder and update
 * `group.match` (name + rotation=0) + `group.confidence` + `group.confident`.
 *
 * If the ML encoder fails for a group, the existing $P match is preserved.
 *
 * @param {Array}  groups           analyzed groups from $P (with role/strokes/cx/cy).
 * @param {object} opts
 * @param {object} opts.meta        runtime meta (inputSize, embeddingDim)
 * @param {number} opts.confidenceMinPct  gate threshold (0–100)
 */
async function relabelGroups(groups, { meta, confidenceMinPct }) {
  const { ort, session, prototypes } = await getRuntimeAsync()
  const size = meta.inputSize

  for (const g of groups) {
    const strokes = g.strokes
    if (!strokes || strokes.length === 0) continue

    // Role-aware rotation sweep (sigils recognized upright).
    const role      = g.role === 'core' ? 'sigil' : 'sign'
    const rotations = role === 'sigil' ? SIGIL_ROTATIONS : SIGN_ROTATIONS

    // Filter prototypes to the group's role for a fair comparison.
    // Fall back to all prototypes if no prototypes match the role.
    const pool = prototypes.filter((p) => p.role === role)
    const activePool = pool.length > 0 ? pool : prototypes

    let bestCos    = new Float32Array(activePool.length).fill(-Infinity)

    for (const deg of rotations) {
      const raster = rasterizeStrokes(strokes, { size, rotationDeg: deg })
      const input  = rasterToModelInput(raster)
      const raw    = await runEmbedding(session, ort, input, size)
      const emb    = l2Normalize(raw)

      for (let i = 0; i < activePool.length; i++) {
        const cos = cosineSimilarity(emb, activePool[i].embedding)
        if (cos > bestCos[i]) bestCos[i] = cos
      }
    }

    // Pick the best match.
    let bestIdx  = 0
    let bestCosV = bestCos[0]
    for (let i = 1; i < activePool.length; i++) {
      if (bestCos[i] > bestCosV) { bestCosV = bestCos[i]; bestIdx = i }
    }

    // Compute confidence from cosine (normalize [−1,1] → [0,100]).
    // We use a simple linear map: cosine 1.0 → 100%, 0.0 → 50%, etc.
    // This mirrors the intent of $P's confidencePct (0–100) without the dist→score mapping.
    const confidence = Math.round(((bestCosV + 1) / 2) * 100)
    const confident  = confidence >= confidenceMinPct

    // Update the group's match in place.
    g.match = {
      name:     activePool[bestIdx].name,
      rotation: 0,   // ML doesn't produce a de-rotation angle; use 0
      dist:     1 - bestCosV,   // synthetic "distance" for code that reads match.dist
    }
    g.confidence = confidence
    g.confident  = confident
  }
}
