/**
 * recognizer-bench.mjs — P0 benchmark harness for the $P recognizer pipeline.
 *
 * Measures analyzeStrokes() median ms across synthetic template sets of size
 * M ∈ {50, 150, 400} to establish a pre-optimisation baseline.
 *
 * Usage: node tools/recognizer-bench.mjs
 */

import { performance } from 'perf_hooks'
import { createRequire } from 'module'
import { analyzeStrokes, buildClouds } from '../src/draw/recognizer.js'

// seedTemplates imports JSON + rules which requires Vite; load the seed directly via require.
const require = createRequire(import.meta.url)
const seedData = require('../data/training-seed.json')

// ── Build the seed template list in the same shape seedTemplates() returns ──────────────────────
const DEFAULT_SAMPLE_WEIGHTS = { corrected: 1.5, drawn: 1.0, confirmed: 0.6 }
const rules = require('../data/rules.json')
const sampleWeights = rules.recognition?.sampleWeights ?? DEFAULT_SAMPLE_WEIGHTS

const seedTemplates = seedData.map((s) => ({
  name: s.name,
  role: s.role,
  points: s.points,
  source: s.source,
  weight: sampleWeights[s.source] ?? 1.0,
}))

// ── Jitter helper: add ±maxJitter px to each point, give each template a unique name ───────────
function jitterTemplate(template, suffix, maxJitter = 2) {
  return {
    name: `${template.name}__${suffix}`,
    role: template.role,
    weight: template.weight,
    points: template.points.map((p) => ({
      X: p.X + (Math.random() * 2 - 1) * maxJitter,
      Y: p.Y + (Math.random() * 2 - 1) * maxJitter,
      ID: p.ID,
    })),
  }
}

// ── Build a synthetic template set of exactly size M ─────────────────────────────────────────
function buildTemplateSet(M) {
  if (seedTemplates.length === 0) throw new Error('seed is empty')
  if (M <= seedTemplates.length) {
    // Sample/truncate — still jitter so they're not all identical clones
    return seedTemplates.slice(0, M).map((t, i) => jitterTemplate(t, `s${i}`))
  }
  // Replicate seed with jitter until we have M entries
  const result = []
  let round = 0
  while (result.length < M) {
    for (const t of seedTemplates) {
      if (result.length >= M) break
      result.push(jitterTemplate(t, `r${round}_${result.length}`))
    }
    round++
  }
  return result
}

// ── opts matching StudioPage.runRecognition (defaults from rules.json with ?? fallbacks) ───────
const CONFIDENCE_MIN_PCT = rules.recognition?.confidenceMinPct ?? 0
const opts = {
  adaptiveGap:          true,
  gapK:                 rules.recognition?.gapK                 ?? 0.12,
  gapMin:               rules.recognition?.gapMin               ?? 14,
  gapMax:               rules.recognition?.gapMax               ?? 80,
  cvThreshold:          rules.recognition?.cvThreshold          ?? 0.3,
  cvThresholdRelaxed:   rules.recognition?.cvThresholdRelaxed   ?? 0.45,
  minRingRadius:        rules.recognition?.minRingRadius        ?? 40,
  floodFill:            rules.recognition?.floodFill            ?? true,
  floodFillConfig:      rules.recognition?.floodFillConfig      ?? {},
  rotationSteps:        rules.recognition?.rotationSteps        ?? 24,
  confidenceMinPct:     CONFIDENCE_MIN_PCT,
  ringAssignSlack:      rules.recognition?.ringAssignSlack      ?? 1.15,
  nestCenterSlack:      rules.recognition?.nestCenterSlack      ?? 0.85,
  linkEndpointSlack:    rules.recognition?.linkEndpointSlack    ?? 0.12,
  // P3 pre-filter
  prefilterK:           rules.recognition?.prefilterK           ?? 15,
  prefilterCoarsePoints: rules.recognition?.prefilterCoarsePoints ?? 8,
}

// ── Sample drawings (raw strokes: [[{x,y},...], ...]) ────────────────────────────────────────
//
// These are synthetic but geometrically plausible. They don't need to recognise as specific
// symbols — they just need to exercise the full pipeline (ring detection, adaptive gap,
// segmentation, $P cloud matching across all templates).

// Sample A: Water-Orb-ish — a ring + a centre blob + two outer marks.
// Drawn at roughly 400×400 canvas centre (200,200), ring radius ≈120.
const sampleA = (() => {
  const cx = 200, cy = 200, r = 120
  // Ring stroke (32 pts, nearly closed)
  const ring = []
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * 2 * Math.PI
    ring.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  // Centre blob (small circle, radius 12)
  const blob = []
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * 2 * Math.PI
    blob.push({ x: cx + 12 * Math.cos(a), y: cy + 12 * Math.sin(a) })
  }
  // Outer mark 1 — short vertical line near top of ring
  const mark1 = [
    { x: cx,      y: cy - r + 20 },
    { x: cx,      y: cy - r + 35 },
    { x: cx - 4,  y: cy - r + 40 },
    { x: cx + 4,  y: cy - r + 40 },
  ]
  // Outer mark 2 — short diagonal near right of ring
  const mark2 = [
    { x: cx + r - 30, y: cy - 15 },
    { x: cx + r - 20, y: cy      },
    { x: cx + r - 10, y: cy + 15 },
  ]
  return [ring, blob, mark1, mark2]
})()

// Sample B: Pyreball-ish — ring + core dot + upward-facing sign (triangle-ish shape)
const sampleB = (() => {
  const cx = 200, cy = 200, r = 100
  const ring = []
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * 2 * Math.PI
    ring.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  // Core dot
  const core = [
    { x: cx - 5, y: cy - 5 },
    { x: cx + 5, y: cy - 5 },
    { x: cx + 5, y: cy + 5 },
    { x: cx - 5, y: cy + 5 },
    { x: cx - 5, y: cy - 5 },
  ]
  // Sign: upward-pointing arrow shape (above ring centre)
  const sign = [
    { x: cx,      y: cy - r + 10 },
    { x: cx - 15, y: cy - r + 35 },
    { x: cx + 15, y: cy - r + 35 },
    { x: cx,      y: cy - r + 10 },
  ]
  // Another sign at the bottom
  const sign2 = [
    { x: cx - 20, y: cy + r - 40 },
    { x: cx,      y: cy + r - 15 },
    { x: cx + 20, y: cy + r - 40 },
  ]
  return [ring, core, sign, sign2]
})()

// Sample C: Single symbol — just a standalone small sigil-like shape, no ring.
const sampleC = (() => {
  // A simple cross shape centred at (50,50)
  const cx = 50, cy = 50
  const horizontal = [
    { x: cx - 20, y: cy },
    { x: cx - 10, y: cy },
    { x: cx,      y: cy },
    { x: cx + 10, y: cy },
    { x: cx + 20, y: cy },
  ]
  const vertical = [
    { x: cx, y: cy - 20 },
    { x: cx, y: cy - 10 },
    { x: cx, y: cy      },
    { x: cx, y: cy + 10 },
    { x: cx, y: cy + 20 },
  ]
  return [horizontal, vertical]
})()

const SAMPLES = [
  { name: 'Water-Orb-ish (ring+blob+2marks)', strokes: sampleA },
  { name: 'Pyreball-ish (ring+core+2signs)',  strokes: sampleB },
  { name: 'Single symbol (no ring)',          strokes: sampleC },
]

// ── Timing helpers ────────────────────────────────────────────────────────────────────────────

function median(arr) {
  const sorted = arr.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Benchmark the "templates (rebuild)" path — analyzeStrokes receives templates and rebuilds
 * clouds internally on every call (the pre-P1 hot path). prefilterK is set to 9999 so this
 * column measures ONLY the cloud rebuild cost, not P2/P3 savings.
 */
function benchRebuild(strokes, templates, k, warmup) {
  const rebuildOpts = { ...opts, prefilterK: 9999 }
  for (let i = 0; i < warmup; i++) analyzeStrokes(strokes, templates, rebuildOpts)
  const times = []
  for (let i = 0; i < k; i++) {
    const t0 = performance.now()
    analyzeStrokes(strokes, templates, rebuildOpts)
    times.push(performance.now() - t0)
  }
  return median(times)
}

/**
 * Benchmark the "clouds (P1 cached, no role split, no pre-filter)" path — clouds are built ONCE
 * and passed via opts.clouds, but the .sigil/.sign pool properties are stripped (once, before
 * timing) so classifyAndRecognize falls back to matching every group against the full list.
 * prefilterK is set to 9999 to disable the P3 pre-filter as well, isolating the P1 rebuild win.
 */
function benchCachedP1(strokes, p1Clouds, k, warmup) {
  // p1Clouds must already have .sigil/.sign stripped (caller does this once per M, not per call)
  // Override prefilterK to 9999 to disable pre-filter (isolates P1 win from P2+P3).
  const cachedOpts = { ...opts, clouds: p1Clouds, prefilterK: 9999 }
  for (let i = 0; i < warmup; i++) analyzeStrokes(strokes, null, cachedOpts)
  const times = []
  for (let i = 0; i < k; i++) {
    const t0 = performance.now()
    analyzeStrokes(strokes, null, cachedOpts)
    times.push(performance.now() - t0)
  }
  return median(times)
}

/**
 * Benchmark the "clouds (P1+P2 cached + role-split, NO pre-filter)" path — clouds are built
 * ONCE with buildClouds (carries .sigil/.sign pools) and passed via opts.clouds.
 * prefilterK is set to a huge value so the guard skips the pre-filter for every pool,
 * isolating the P2 win from P3.
 */
function benchCachedP2(strokes, clouds, k, warmup) {
  // Override prefilterK to 9999 so the guard fires and the full pool is always swept (no P3).
  const cachedOpts = { ...opts, clouds, prefilterK: 9999 }
  for (let i = 0; i < warmup; i++) analyzeStrokes(strokes, null, cachedOpts)
  const times = []
  for (let i = 0; i < k; i++) {
    const t0 = performance.now()
    analyzeStrokes(strokes, null, cachedOpts)
    times.push(performance.now() - t0)
  }
  return median(times)
}

/**
 * Benchmark the "clouds P1+P2+P3 (pre-filter active)" path — same as P2 but with the real
 * prefilterK from rules.json so the cheap coarse pre-filter narrows the sweep to top-K.
 * Cost goes from × pool to × K, which is the dominant saving as M grows.
 */
function benchCachedP3(strokes, clouds, k, warmup) {
  // Use the actual prefilterK from rules.json (in opts).
  const cachedOpts = { ...opts, clouds }
  for (let i = 0; i < warmup; i++) analyzeStrokes(strokes, null, cachedOpts)
  const times = []
  for (let i = 0; i < k; i++) {
    const t0 = performance.now()
    analyzeStrokes(strokes, null, cachedOpts)
    times.push(performance.now() - t0)
  }
  return median(times)
}

// ── Main ──────────────────────────────────────────────────────────────────────────────────────

const TARGET_SIZES = [50, 150, 400]
const K = 15
const WARMUP = 3

console.log(`\n$P recognizer benchmark — P0 baseline + P1 cloud caching + P2 role-split + P3 pre-filter`)
console.log(`  seed templates : ${seedTemplates.length}`)
console.log(`  iterations     : ${K} (after ${WARMUP} warmup)`)
console.log(`  samples        : ${SAMPLES.length}`)
console.log(`  prefilterK     : ${opts.prefilterK} (from rules.json)`)
console.log(`  columns:`)
console.log(`    rebuild          = clouds rebuilt every call (baseline, also uses P2 pools internally)`)
console.log(`    clouds P1        = clouds cached once, NO role-split (full-list match per group)`)
console.log(`    clouds P1+P2     = clouds cached once + role-split pools (P2 win)`)
console.log(`    clouds P1+P2+P3  = P2 + coarse pre-filter (top-K only full sweep) (P3 win)`)
console.log(`  The P1 full-list column is intentionally the P2 control: it isolates the P2 speedup.`)
console.log()

// Pre-build template sets (outside timing loop)
const templateSets = {}
const cloudSets    = {}   // P2+P3: has .sigil/.sign pools + coarse descriptors
const p1CloudSets  = {}   // P1: same clouds but no pool properties (simulates pre-P2 state)
for (const M of TARGET_SIZES) {
  templateSets[M] = buildTemplateSet(M)
  // P1+P2+P3: build clouds once with role pools + coarse descriptors
  cloudSets[M] = buildClouds(templateSets[M])
  // P1-only: shallow-clone each cloud without .sigil/.sign so classifyAndRecognize uses the full list
  p1CloudSets[M] = cloudSets[M].map((c) => ({ ...c }))
}

// Results table: rows = M × 4 paths, cols = per-sample median + overall median
const NUM_W = 12

// Header
const sampleHeaders = SAMPLES.map((s) => s.name.slice(0, NUM_W - 1).padStart(NUM_W))
const headerLine =
  '  M'.padEnd(6) +
  'path'.padEnd(24) +
  sampleHeaders.join('') +
  'overall (med)'.padStart(NUM_W + 2)
console.log(headerLine)
console.log('  ' + '-'.repeat(4 + 24 + NUM_W * SAMPLES.length + NUM_W + 2))

const overallMediansRebuild = {}
const overallMediansP1      = {}
const overallMediansP2      = {}
const overallMediansP3      = {}

for (const M of TARGET_SIZES) {
  const templates = templateSets[M]
  const clouds    = cloudSets[M]
  const p1Clouds  = p1CloudSets[M]

  const rebuildMedians = SAMPLES.map(({ strokes }) => benchRebuild(strokes, templates, K, WARMUP))
  const p1Medians      = SAMPLES.map(({ strokes }) => benchCachedP1(strokes, p1Clouds, K, WARMUP))
  const p2Medians      = SAMPLES.map(({ strokes }) => benchCachedP2(strokes, clouds, K, WARMUP))
  const p3Medians      = SAMPLES.map(({ strokes }) => benchCachedP3(strokes, clouds, K, WARMUP))

  const overallRebuild = median(rebuildMedians)
  const overallP1      = median(p1Medians)
  const overallP2      = median(p2Medians)
  const overallP3      = median(p3Medians)
  overallMediansRebuild[M] = overallRebuild
  overallMediansP1[M]      = overallP1
  overallMediansP2[M]      = overallP2
  overallMediansP3[M]      = overallP3

  const rebuildCells = rebuildMedians.map((ms) => `${ms.toFixed(2)} ms`.padStart(NUM_W))
  const p1Cells      = p1Medians.map((ms)      => `${ms.toFixed(2)} ms`.padStart(NUM_W))
  const p2Cells      = p2Medians.map((ms)      => `${ms.toFixed(2)} ms`.padStart(NUM_W))
  const p3Cells      = p3Medians.map((ms)      => `${ms.toFixed(2)} ms`.padStart(NUM_W))

  const pctP1 = overallRebuild > 0
    ? (((overallRebuild - overallP1) / overallRebuild) * 100).toFixed(1)
    : '0.0'
  const pctP2vsP1 = overallP1 > 0
    ? (((overallP1 - overallP2) / overallP1) * 100).toFixed(1)
    : '0.0'
  const pctP3vsP2 = overallP2 > 0
    ? (((overallP2 - overallP3) / overallP2) * 100).toFixed(1)
    : '0.0'

  console.log(
    `  ${String(M).padEnd(4)}` +
    'templates (rebuild)'.padEnd(24) +
    rebuildCells.join('') +
    `${overallRebuild.toFixed(2)} ms`.padStart(NUM_W + 2)
  )
  console.log(
    `  ${' '.repeat(4)}` +
    'clouds P1 (full list)'.padEnd(24) +
    p1Cells.join('') +
    `${overallP1.toFixed(2)} ms`.padStart(NUM_W + 2)
  )
  console.log(
    `  ${' '.repeat(4)}` +
    'clouds P1+P2 (split)'.padEnd(24) +
    p2Cells.join('') +
    `${overallP2.toFixed(2)} ms`.padStart(NUM_W + 2)
  )
  console.log(
    `  ${' '.repeat(4)}` +
    'clouds P1+P2+P3 (prefilter)'.padEnd(24) +
    p3Cells.join('') +
    `${overallP3.toFixed(2)} ms`.padStart(NUM_W + 2)
  )
  console.log(
    `  ${' '.repeat(4)}` +
    'P1 saving vs rebuild'.padEnd(24) +
    `${pctP1}% faster`.padStart(NUM_W * SAMPLES.length + NUM_W + 2)
  )
  console.log(
    `  ${' '.repeat(4)}` +
    'P2 saving vs P1'.padEnd(24) +
    `${pctP2vsP1}% faster`.padStart(NUM_W * SAMPLES.length + NUM_W + 2)
  )
  console.log(
    `  ${' '.repeat(4)}` +
    'P3 saving vs P2'.padEnd(24) +
    `${pctP3vsP2}% faster`.padStart(NUM_W * SAMPLES.length + NUM_W + 2)
  )
  console.log()
}

// Summary
console.log('  Summary (overall median ms):')
console.log(`  ${'M'.padEnd(6)} ${'rebuild'.padEnd(14)} ${'P1 (full)'.padEnd(14)} ${'P1+P2 (split)'.padEnd(16)} ${'P1+P2+P3'.padEnd(16)} P2→P3 saving`)
console.log('  ' + '-'.repeat(82))
for (const M of TARGET_SIZES) {
  const r  = overallMediansRebuild[M]
  const p1 = overallMediansP1[M]
  const p2 = overallMediansP2[M]
  const p3 = overallMediansP3[M]
  const pctP3vsP2 = p2 > 0 ? (((p2 - p3) / p2) * 100).toFixed(1) : '0.0'
  console.log(
    `  ${String(M).padEnd(6)} ${`${r.toFixed(2)} ms`.padEnd(14)} ${`${p1.toFixed(2)} ms`.padEnd(14)} ${`${p2.toFixed(2)} ms`.padEnd(16)} ${`${p3.toFixed(2)} ms`.padEnd(16)} ${pctP3vsP2}%`
  )
}

console.log()

// Confirm that larger M is slower (rebuild path)
const [m0, m1, m2] = TARGET_SIZES
const isSlower = overallMediansRebuild[m1] > overallMediansRebuild[m0] && overallMediansRebuild[m2] > overallMediansRebuild[m1]
console.log(`  Larger M is visibly slower (rebuild): ${isSlower ? 'YES ✓' : 'NOT confirmed (check noise)'}`)

// P2 win: role-split faster than full-list at M=400
const p2Win = overallMediansP2[m2] < overallMediansP1[m2]
console.log(`  P2 role-split faster than P1 (full-list) at M=${m2}: ${p2Win ? 'YES ✓' : 'NOT confirmed (check noise)'}`)

// P3 win: pre-filter faster than P2 at M=400 (cost goes from × pool to × K)
const p3Win = overallMediansP3[m2] < overallMediansP2[m2]
console.log(`  P3 pre-filter faster than P2 at M=${m2}: ${p3Win ? 'YES ✓' : 'NOT confirmed (check noise)'}`)

// P1+P2+P3 vs rebuild (combined gain from all phases)
const combinedWin = overallMediansP3[m2] < overallMediansRebuild[m2]
const combinedPct = overallMediansRebuild[m2] > 0
  ? (((overallMediansRebuild[m2] - overallMediansP3[m2]) / overallMediansRebuild[m2]) * 100).toFixed(1)
  : '0.0'
console.log(`  P1+P2+P3 combined faster than rebuild at M=${m2}: ${combinedWin ? `YES ✓ (${combinedPct}%)` : 'NOT confirmed (check noise)'}`)
console.log()
