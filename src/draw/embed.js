// embed.js — Engine-agnostic embedding interface (M1, SPEC-ml-recognizer.md §0 / M1 design).
//
// Defines the two-function contract that every recognizer engine must satisfy, and provides
// the "$P" implementation as proof that the seam is engine-agnostic.
//
// CONTRACT
// ─────────
//   embed(group, opts) → Float32Array
//     Converts a stroke group into a fixed-length numeric vector (the "fingerprint").
//     The returned vector is the engine's internal representation of the shape — how it
//     represents the drawing as numbers, independent of what symbol it might be.
//
//     `group` shape (same as recognizer pipeline groups):
//       { strokes: Array<Array<{x,y}>>, pts: Array<{x,y}> }
//     `opts`  optional; the ML engine may use opts.role, opts.rotationSteps, etc.
//
//   recognizeFromEmbedding(vec, prototypes) → Array<{ name: string, score: number }>
//     Given a vector returned by embed() and a list of named prototype vectors (one per symbol),
//     returns a ranked list of matches (best first, highest score = best match).
//
//     `prototypes` shape:  Array<{ name: string, vec: Float32Array }>
//     Return shape:        Array<{ name: string, score: number }>   (ranked, score ∈ [0, 1])
//
// $P IMPLEMENTATION
// ──────────────────
// The "$P" engine represents a group as its normalized $P point-cloud (32 × 2 = 64 floats).
// `embed`  builds the cloud via `makeCloud` then flattens (x0,y0,x1,y1,...) to Float32Array.
// `recognizeFromEmbedding`  reconstructs a cloud from a Float32Array and delegates to
//   `recognize()` for the greedy-match score, then normalises scores to [0,1].
//
// PURITY
// ───────
// PURE module: imports ONLY from the pure `recognizer.js`.  No JSON/DOM/onnx/fetch.
// Node-testable under `node --test` without any import attributes.

import { makeCloud, recognize } from './recognizer.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a stroke group's points to the {X,Y,ID} format makeCloud expects.
 * Flat across all strokes; each stroke gets its own integer ID.
 *
 * @param {{ strokes: Array<Array<{x,y}>>, pts?: Array<{x,y}> }} group
 * @returns {Array<{X:number,Y:number,ID:number}>}
 */
function groupToCloudPoints(group) {
  if (group.strokes && group.strokes.length > 0) {
    return group.strokes.flatMap((s, si) => s.map((p) => ({ X: p.x, Y: p.y, ID: si })))
  }
  // Fallback: use pre-flattened pts (legacy callers that don't carry .strokes)
  if (group.pts && group.pts.length > 0) {
    return group.pts.map((p, i) => ({ X: p.x, Y: p.y, ID: i }))
  }
  return []
}

/**
 * Reconstruct a makeCloud-compatible object from a Float32Array embedding.
 * The vector is (x0,y0,x1,y1,...) with NUM_POINTS=32 points.
 * The reconstructed cloud has the normalized .points array needed by greedyMatch
 * (used inside recognize()).  name and weight are set to '' / 1 — irrelevant for querying.
 *
 * @param {Float32Array} vec
 * @returns {{ name: string, points: Array<{X,Y,ID}>, weight: number }}
 */
function cloudFromVec(vec) {
  const points = []
  for (let i = 0; i < vec.length; i += 2) {
    points.push({ X: vec[i], Y: vec[i + 1], ID: 0 })
  }
  return { name: '', points, weight: 1 }
}

// ─────────────────────────────────────────────────────────────────────────────
// embed — $P implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * $P embed: build the normalized point-cloud for a stroke group and flatten it to Float32Array.
 *
 * Returns a Float32Array of length 64 (32 points × 2 coords): [x0,y0,x1,y1,...].
 * The coordinates are in the normalized $P space (scaled to unit square, centred at origin).
 *
 * @param {{ strokes: Array<Array<{x,y}>>, pts?: Array<{x,y}> }} group
 * @param {object} [_opts]  unused in the $P implementation (present for interface uniformity)
 * @returns {Float32Array}
 */
export function embed(group, _opts) {
  const cloudPoints = groupToCloudPoints(group)
  if (cloudPoints.length === 0) return new Float32Array(0)

  const cloud = makeCloud('', cloudPoints)
  // cloud.points is an array of {X,Y,ID} — flatten to [x0,y0,x1,y1,...].
  const vec = new Float32Array(cloud.points.length * 2)
  for (let i = 0; i < cloud.points.length; i++) {
    vec[i * 2]     = cloud.points[i].X
    vec[i * 2 + 1] = cloud.points[i].Y
  }
  return vec
}

// ─────────────────────────────────────────────────────────────────────────────
// recognizeFromEmbedding — $P implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * $P embedding-based recognition: reconstruct a cloud from `vec` and match it against
 * prototypes using the same `recognize()` path as the live pipeline.
 *
 * `prototypes` is an array of { name, vec: Float32Array } — one per known symbol.
 * Each prototype's `vec` is produced by `embed()` over a reference sample.
 *
 * Returns a ranked array of { name, score } (best first, score ∈ [0, 1]).
 * Score is derived from $P's adjDist: score = 1 / (1 + adjDist), so a perfect match gives 1.
 *
 * @param {Float32Array}                          vec         query embedding
 * @param {Array<{ name: string, vec: Float32Array }>} prototypes  reference embeddings
 * @returns {Array<{ name: string, score: number }>}
 */
export function recognizeFromEmbedding(vec, prototypes) {
  if (!prototypes || prototypes.length === 0) return []
  if (!vec || vec.length === 0) return []

  // Reconstruct a cloud object from the query vector.
  const queryCloud = cloudFromVec(vec)

  // Build a cloud list compatible with recognize() — each prototype becomes a cloud.
  const clouds = prototypes.map(({ name, vec: pVec }) => {
    const c = cloudFromVec(pVec)
    c.name   = name
    c.weight = 1
    return c
  })

  // recognize() expects an array of {X,Y,ID} raw points (pre-normalization), but our
  // queryCloud.points are ALREADY normalized.  We pass them directly as the "points" argument;
  // recognize() will call makeCloud on them, which re-normalizes a normalized input — this is
  // idempotent for inputs already in the unit-square-centred form (makeCloud is stable on
  // already-normalized inputs).
  const rawPoints = queryCloud.points.map((p) => ({ X: p.X, Y: p.Y, ID: p.ID }))
  const ranked = recognize(rawPoints, clouds)

  // Convert adjDist to a [0,1] score.  score = 1 / (1 + adjDist) so 0 dist → 1.0.
  return ranked.map(({ name, adjDist }) => ({
    name,
    score: 1 / (1 + adjDist),
  }))
}
