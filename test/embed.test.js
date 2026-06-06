// test/embed.test.js — unit tests for src/draw/embed.js (M1, SPEC-ml-recognizer.md).
//
// Validates the $P engine-agnostic interface:
//   embed(group, opts) → Float32Array
//   recognizeFromEmbedding(vec, prototypes) → ranked [{ name, score }]
//
// The key assertion (engine-agnosticism proof): for a clean input, the top-1 returned by
// recognizeFromEmbedding() must match the top-1 returned by recognize() directly.
//
// Node-safe: JSON loaded via createRequire (the project convention).  No DOM/Worker/onnx.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import { embed, recognizeFromEmbedding } from '../src/draw/embed.js'
import { recognize, makeCloud, buildClouds } from '../src/draw/recognizer.js'

const require = createRequire(import.meta.url)

// ─────────────────────────────────────────────────────────────────────────────
// Seed templates — two clearly distinct shapes used throughout
// ─────────────────────────────────────────────────────────────────────────────

// L-shape: vertical bar + horizontal base (2 strokes)
const lShapeStrokes = [
  [{ x: 0, y: -50 }, { x: 0, y: 0 }, { x: 0, y: 50 }],
  [{ x: 0, y: 50 }, { x: 50, y: 50 }],
]

// T-shape: crossbar + stem (2 strokes)
const tShapeStrokes = [
  [{ x: -50, y: -20 }, { x: 50, y: -20 }],
  [{ x: 0, y: -20 }, { x: 0, y: 50 }],
]

/** Convert raw strokes to the group shape embed() expects. */
function strokesToGroup(strokes) {
  return {
    strokes,
    pts: strokes.flat(),
  }
}

/** Convert raw strokes to {X,Y,ID} points for recognize(). */
function strokesToCloudPoints(strokes) {
  return strokes.flatMap((s, si) => s.map((p) => ({ X: p.x, Y: p.y, ID: si })))
}

// Two named prototypes (one per shape) — produced by embed() over a reference drawing.
// We build them at test time so they're driven by the same code under test.
const lGroup = strokesToGroup(lShapeStrokes)
const tGroup = strokesToGroup(tShapeStrokes)

const lVec = embed(lGroup)
const tVec = embed(tGroup)

const prototypes = [
  { name: 'l_shape', vec: lVec },
  { name: 't_shape', vec: tVec },
]

// ─────────────────────────────────────────────────────────────────────────────
// embed — shape and type contract
// ─────────────────────────────────────────────────────────────────────────────

test('embed: returns a Float32Array', () => {
  const vec = embed(lGroup)
  assert.ok(vec instanceof Float32Array, 'result must be Float32Array')
})

test('embed: length is 2 × NUM_POINTS (64 for $P default of 32 points)', () => {
  const NUM_POINTS = 32  // mirrors recognizer.js
  const vec = embed(lGroup)
  assert.equal(vec.length, NUM_POINTS * 2, `expected ${NUM_POINTS * 2} floats, got ${vec.length}`)
})

test('embed: same group → identical vector (deterministic)', () => {
  const v1 = embed(lGroup)
  const v2 = embed(lGroup)
  assert.deepEqual(Array.from(v1), Array.from(v2), 'embed must be deterministic')
})

test('embed: different shapes → different vectors', () => {
  const vL = embed(lGroup)
  const vT = embed(tGroup)
  // Not all elements can be equal (shapes are clearly distinct)
  const allSame = vL.every((v, i) => Math.abs(v - vT[i]) < 1e-6)
  assert.ok(!allSame, 'l_shape and t_shape embeddings must differ')
})

test('embed: empty group returns empty Float32Array', () => {
  const emptyGroup = { strokes: [], pts: [] }
  const vec = embed(emptyGroup)
  assert.ok(vec instanceof Float32Array, 'must still return Float32Array')
  assert.equal(vec.length, 0, 'empty group → length 0')
})

test('embed: group with pts fallback (no .strokes) returns a valid vector', () => {
  const flatGroup = { pts: lShapeStrokes.flat() }
  const vec = embed(flatGroup)
  assert.ok(vec instanceof Float32Array)
  assert.ok(vec.length > 0, 'pts-fallback path should produce a non-empty vector')
})

// ─────────────────────────────────────────────────────────────────────────────
// recognizeFromEmbedding — basic contract
// ─────────────────────────────────────────────────────────────────────────────

test('recognizeFromEmbedding: returns an array', () => {
  const result = recognizeFromEmbedding(lVec, prototypes)
  assert.ok(Array.isArray(result), 'must return an array')
})

test('recognizeFromEmbedding: each entry has name (string) and score (number)', () => {
  const result = recognizeFromEmbedding(lVec, prototypes)
  assert.ok(result.length > 0, 'must return at least one entry')
  for (const item of result) {
    assert.equal(typeof item.name, 'string', 'name must be a string')
    assert.equal(typeof item.score, 'number', 'score must be a number')
  }
})

test('recognizeFromEmbedding: empty prototypes → empty array', () => {
  const result = recognizeFromEmbedding(lVec, [])
  assert.deepEqual(result, [])
})

test('recognizeFromEmbedding: empty vec → empty array', () => {
  const result = recognizeFromEmbedding(new Float32Array(0), prototypes)
  assert.deepEqual(result, [])
})

test('recognizeFromEmbedding: scores are in (0, 1] range', () => {
  const result = recognizeFromEmbedding(lVec, prototypes)
  for (const { score } of result) {
    assert.ok(score > 0 && score <= 1,
      `score ${score} must be in (0, 1]`)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE-AGNOSTICISM PROOF
// Top-1 via recognizeFromEmbedding must agree with top-1 via recognize() directly.
// ─────────────────────────────────────────────────────────────────────────────

test('engine-agnosticism: embed+recognizeFromEmbedding top-1 == recognize() top-1 for l_shape', () => {
  // Query: l_shape input
  const queryVec = embed(lGroup)
  const embeddingTop1 = recognizeFromEmbedding(queryVec, prototypes)[0]

  // Direct recognize() path: build clouds from the same two templates
  const lPts = strokesToCloudPoints(lShapeStrokes)
  const tPts = strokesToCloudPoints(tShapeStrokes)
  const clouds = [makeCloud('l_shape', lPts), makeCloud('t_shape', tPts)]
  const queryPts = strokesToCloudPoints(lShapeStrokes)
  const directTop1 = recognize(queryPts, clouds)[0]

  assert.ok(embeddingTop1, 'embedding path must return at least one result')
  assert.ok(directTop1,    'direct recognize() must return at least one result')
  assert.equal(
    embeddingTop1.name,
    directTop1.name,
    `top-1 mismatch: embed+match="${embeddingTop1.name}", recognize()="${directTop1.name}"`
  )
})

test('engine-agnosticism: embed+recognizeFromEmbedding top-1 == recognize() top-1 for t_shape', () => {
  // Query: t_shape input
  const queryVec = embed(tGroup)
  const embeddingTop1 = recognizeFromEmbedding(queryVec, prototypes)[0]

  const lPts = strokesToCloudPoints(lShapeStrokes)
  const tPts = strokesToCloudPoints(tShapeStrokes)
  const clouds = [makeCloud('l_shape', lPts), makeCloud('t_shape', tPts)]
  const queryPts = strokesToCloudPoints(tShapeStrokes)
  const directTop1 = recognize(queryPts, clouds)[0]

  assert.ok(embeddingTop1, 'embedding path must return at least one result')
  assert.ok(directTop1,    'direct recognize() must return at least one result')
  assert.equal(
    embeddingTop1.name,
    directTop1.name,
    `top-1 mismatch: embed+match="${embeddingTop1.name}", recognize()="${directTop1.name}"`
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Engine-agnosticism on the real seed templates (load via createRequire)
// ─────────────────────────────────────────────────────────────────────────────

test('engine-agnosticism: seed templates — embed+match top-1 agrees with recognize() for 5 samples', () => {
  const seedData = require('../data/training-seed.json')
  const rules    = require('../data/rules.json')

  const sampleWeights = rules.recognition?.sampleWeights ?? { corrected: 1.5, drawn: 1.0, confirmed: 0.6 }

  // Build clouds (the $P way) from the seed
  const templates = seedData.map((s) => ({
    name:   s.name,
    role:   s.role,
    points: s.points,
    weight: sampleWeights[s.source] ?? 1.0,
  }))
  const clouds = buildClouds(templates)

  // Build prototypes via embed() — one per unique symbol name (first sample wins)
  const seenNames = new Set()
  const seedPrototypes = []
  for (const s of seedData) {
    if (seenNames.has(s.name)) continue
    seenNames.add(s.name)
    const group = {
      strokes: [s.points.map((p) => ({ x: p.X, y: p.Y }))],
      pts:      s.points.map((p) => ({ x: p.X, y: p.Y })),
    }
    seedPrototypes.push({ name: s.name, vec: embed(group) })
  }

  // Test a small subset (first 5 unique symbols) to keep the test fast
  const testSamples = seedData.slice(0, 5)
  const mismatches = []

  for (const s of testSamples) {
    const group = {
      strokes: [s.points.map((p) => ({ x: p.X, y: p.Y }))],
      pts:      s.points.map((p) => ({ x: p.X, y: p.Y })),
    }

    // Embedding path
    const queryVec = embed(group)
    const embTop1  = recognizeFromEmbedding(queryVec, seedPrototypes)[0]

    // Direct recognize() path — same cloud set
    const rawPts   = s.points.map((p) => ({ X: p.X, Y: p.Y, ID: p.ID }))
    const directRanked = recognize(rawPts, clouds)
    const dirTop1  = directRanked[0]

    if (!embTop1 || !dirTop1) continue  // skip if no match (shouldn't happen with seed data)
    if (embTop1.name !== dirTop1.name) {
      mismatches.push({ sample: s.name, embedding: embTop1.name, direct: dirTop1.name })
    }
  }

  if (mismatches.length > 0) {
    for (const m of mismatches) {
      console.error(
        `seed top-1 mismatch for "${m.sample}": embed+match="${m.embedding}", direct="${m.direct}"`
      )
    }
  }

  // The $P embedding IS the cloud — on a self-match this MUST agree.
  // If it doesn't it's a bug in embed() or recognizeFromEmbedding(), not an inherent ambiguity.
  assert.equal(mismatches.length, 0,
    `${mismatches.length} seed samples disagreed between embed+match and direct recognize()`)
})

// ─────────────────────────────────────────────────────────────────────────────
// recognizerEngine dispatcher — "p" is a pass-through, "ml" throws clearly
// ─────────────────────────────────────────────────────────────────────────────

import { recognizerEngineName, recognizeWithEngine } from '../src/draw/recognizerEngine.js'

test('recognizerEngineName: returns "p" when no engine in opts', () => {
  assert.equal(recognizerEngineName({}),           'p')
  assert.equal(recognizerEngineName(null),         'p')
  assert.equal(recognizerEngineName(undefined),    'p')
  assert.equal(recognizerEngineName({ engine: 'p' }), 'p')
})

test('recognizerEngineName: returns "ml" when opts.engine is "ml"', () => {
  assert.equal(recognizerEngineName({ engine: 'ml' }), 'ml')
})

test('recognizeWithEngine: engine:"p" invokes runP and resolves its return value', async () => {
  const sentinel = { ring: null, groups: [], composition: null }
  let called = false
  const result = await recognizeWithEngine({
    strokes: [],
    opts:    { engine: 'p' },
    runP:    () => { called = true; return sentinel },
  })
  assert.ok(called, 'runP must be called for engine:"p"')
  assert.equal(result, sentinel, 'must resolve with runP return value')
})

test('recognizeWithEngine: engine:"p" (default, no opts.engine) also invokes runP', async () => {
  let called = false
  await recognizeWithEngine({ strokes: [], opts: {}, runP: () => { called = true; return null } })
  assert.ok(called, 'default engine (no opts.engine) must use the $P runP path')
})

// M4 update: the ml engine is now implemented (mlRecognizer.js ships in M4).
// In Node (test environment) the onnxruntime-web dynamic import either loads or
// fails with a runtime error — either way the dispatcher no longer throws the
// "not built yet (Phase M4)" placeholder.  This test verifies the seam contract:
// the "ml" branch attempts to invoke the real engine (it may fail in Node because
// wasm inference is a browser concern, but the stub error is gone).
test('recognizeWithEngine: engine:"ml" no longer throws the M3 "not built yet" stub error', async () => {
  let threwStub = false
  try {
    await recognizeWithEngine({ strokes: [], opts: { engine: 'ml' }, runP: () => null })
  } catch (err) {
    const msg = err?.message ?? ''
    // The stub error ("not built yet (Phase M4)") must NOT appear — that was the M3 placeholder.
    // Any other error (e.g. onnxruntime-web failing under Node) is acceptable.
    threwStub = msg.includes('not built yet') && msg.includes('Phase M4')
  }
  assert.ok(!threwStub, 'engine:"ml" must not throw the M3 "not built yet" placeholder (M4 ships the real engine)')
})

test('recognizeWithEngine: unknown engine rejects with a clear error', async () => {
  await assert.rejects(
    () => recognizeWithEngine({ strokes: [], opts: { engine: 'unknown_engine' }, runP: () => null }),
    /unknown engine/
  )
})
