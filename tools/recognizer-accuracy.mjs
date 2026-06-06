/**
 * recognizer-accuracy.mjs — B0/B1/B2/B3/B4 accuracy harness for the $P recognizer.
 *
 * Measures top-1 and top-3 classification accuracy on a dataset of labeled samples.
 *
 * This is the CORRECTNESS sibling of recognizer-bench.mjs (which measures speed).
 * Scope: B0 scores the CLASSIFIER given a clean, pre-segmented symbol group. It does
 * NOT run ring detection or stroke segmentation — those are exercised by the perf bench
 * and a later phase (B4 full-analyzeStrokes path). Synthetic accuracy over-states real
 * accuracy; treat this as a rotation/scale/noise regression guard and A/B tool, not a
 * ground-truth claim about real-world recognition.
 *
 * Rotation is ROLE-AWARE on purpose: the real pipeline sweeps rotations for SIGNS
 * (so they may appear at any angle) but classifies SIGILS/cores at angle 0 only
 * (they are drawn upright). Perturbing sigils with a full [0,360) spin would therefore
 * measure a deliberate design choice (no core sweep), not robustness — and would swamp
 * the metric that B2/B3 actually tune (scale/jitter). So signs get the full circle and
 * sigils get only a small upright hand-wobble. Both ranges are configurable.
 *
 * CLI flags (--key=value or --key value, or bare boolean --flag):
 *
 * Source selection (B4):
 *   --source    dataset source: "seed" (default, B0–B3 synthetic), "fixture" (JSON file),
 *               or "db" (live Supabase pull via SUPABASE_URL + SUPABASE_SECRET env vars).
 *   --file      path to fixture JSON when --source=fixture (required for that mode).
 *   --folds     number of folds for k-fold cross-validation (--source=fixture/db only).
 *               Default = leave-one-out (LOO): folds = sample count per label.
 *   --verified-only  when --source=db, pull only verified=true samples (the gold set).
 *
 * Fixture JSON shape (for --source=fixture):
 *   A JSON array of objects, each with:
 *     { name: string,   // symbol engine id (the label to predict)
 *       role: string,   // "sign" | "sigil"
 *       points: [{X: number, Y: number, ID: number}, ...],
 *       source: string  // "drawn" | "confirmed" | "corrected" (used for weight only if a
 *                       //  fixture is used as a training seed in synthetic mode; in k-fold
 *                       //  mode the source field is informational only)
 *     }
 *   Singletons (labels with only 1 sample) are valid in the file but are automatically
 *   skipped during k-fold evaluation (cannot hold out the only example and still have it
 *   in the pool). The coverage line reports how many were skipped.
 *
 * Synthetic (seed) flags (B0–B3 only):
 *   --seed      PRNG seed (default: 1)
 *   --perN      perturbations per template (default: 5)
 *   --scaleLo   minimum scale factor (default: 0.8)
 *   --scaleHi   maximum scale factor (default: 1.25)
 *   --jitter    per-point ±jitter in px (default: 2)
 *   --signRot   sign rotation half-range in deg (default: 180 → full circle)
 *   --sigilRot  sigil rotation half-range in deg (default: 15 → upright wobble)
 *   --matrix    (B1) dump the full NxN confusion grid as CSV (also needs --out)
 *   --out       (B1) path for the CSV output (default: confusion.csv when --matrix is set)
 *
 * Usage:
 *   node tools/recognizer-accuracy.mjs
 *   node tools/recognizer-accuracy.mjs --seed=42 --perN=10
 *   node tools/recognizer-accuracy.mjs --matrix --out confusion.csv
 *   node tools/recognizer-accuracy.mjs --source=fixture --file path/to/samples.json
 *   node tools/recognizer-accuracy.mjs --source=fixture --file samples.json --folds=5
 *   node tools/recognizer-accuracy.mjs --source=db
 *   node tools/recognizer-accuracy.mjs --source=db --verified-only
 */

import { createRequire } from 'module'
import { writeFileSync, readFileSync } from 'fs'
import { pathToFileURL } from 'url'
import {
  buildClouds,
  bestMatchOverRotations,
  recognize,
  confidencePct,
  prefilter,
  makeCloudN,
  rotateCloudPoints,
} from '../src/draw/recognizer.js'

// Load JSON via createRequire — plain `import x from './x.json'` fails under Node without Vite.
const require = createRequire(import.meta.url)
const seedData = require('../data/training-seed.json')
const rules = require('../data/rules.json')

// ── CLI argument parsing (--key=value or --key value) ────────────────────────────────────────────

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const eqMatch = arg.match(/^--([a-zA-Z][a-zA-Z0-9-]*)=(.*)$/)
    if (eqMatch) {
      args[eqMatch[1]] = eqMatch[2]
    } else if (arg.startsWith('--') && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      args[arg.slice(2)] = argv[++i]
    } else if (arg.startsWith('--')) {
      // bare boolean flag, e.g. --matrix
      args[arg.slice(2)] = true
    }
  }
  return args
}

const cliArgs = parseArgs(process.argv.slice(2))

// B4: source selector
const SOURCE        = typeof cliArgs.source === 'string' ? cliArgs.source : 'seed'
const FIXTURE_FILE  = typeof cliArgs.file === 'string' ? cliArgs.file : null
const FOLDS_ARG     = cliArgs.folds !== undefined ? Number(cliArgs.folds) : null  // null = LOO
const VERIFIED_ONLY = Boolean(cliArgs['verified-only'])

const SEED    = Number(cliArgs.seed    ?? 1)
const PER_N   = Number(cliArgs.perN    ?? 5)
const SCALE_LO = Number(cliArgs.scaleLo ?? 0.8)
const SCALE_HI = Number(cliArgs.scaleHi ?? 1.25)
const JITTER  = Number(cliArgs.jitter  ?? 2)
// Role-aware rotation half-range (deg): signs span the full circle (sweep handles it);
// sigils get only a small upright wobble (the pipeline classifies cores at angle 0).
const SIGN_ROT  = Number(cliArgs.signRot  ?? 180)
const SIGIL_ROT = Number(cliArgs.sigilRot ?? 15)

// B1 flags
const DUMP_MATRIX  = Boolean(cliArgs.matrix)
const MATRIX_OUT   = typeof cliArgs.out === 'string' ? cliArgs.out : (DUMP_MATRIX ? 'confusion.csv' : null)
const TOP_N        = 15   // top-N confusion pairs and weakest-symbols to print

// B2 flags
const TARGET_ACC   = Number(cliArgs.targetAcc ?? 0.95)  // fraction 0..1; recommend smallest cutoff ≥ this accuracy

// ── Seeded PRNG — mulberry32 ─────────────────────────────────────────────────────────────────────
// Returns a PRNG function that yields floats in [0, 1). All randomness in this harness MUST
// go through this so that --seed guarantees bit-identical results across runs.

function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s += 0x6d2b79f5
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }
}

const rng = mulberry32(SEED)

// ── opts — matches StudioPage.runRecognition / recognizer-bench.mjs lines 66-85 ─────────────────

const DEFAULT_SAMPLE_WEIGHTS = { corrected: 1.5, drawn: 1.0, confirmed: 0.6 }
const sampleWeights = rules.recognition?.sampleWeights ?? DEFAULT_SAMPLE_WEIGHTS

const CONFIDENCE_MIN_PCT = rules.recognition?.confidenceMinPct ?? 0
const opts = {
  adaptiveGap:           true,
  gapK:                  rules.recognition?.gapK                  ?? 0.12,
  gapMin:                rules.recognition?.gapMin                ?? 14,
  gapMax:                rules.recognition?.gapMax                ?? 80,
  cvThreshold:           rules.recognition?.cvThreshold           ?? 0.3,
  cvThresholdRelaxed:    rules.recognition?.cvThresholdRelaxed    ?? 0.45,
  minRingRadius:         rules.recognition?.minRingRadius         ?? 40,
  floodFill:             rules.recognition?.floodFill             ?? true,
  floodFillConfig:       rules.recognition?.floodFillConfig       ?? {},
  rotationSteps:         rules.recognition?.rotationSteps         ?? 24,
  confidenceMinPct:      CONFIDENCE_MIN_PCT,
  ringAssignSlack:       rules.recognition?.ringAssignSlack       ?? 1.15,
  nestCenterSlack:       rules.recognition?.nestCenterSlack       ?? 0.85,
  linkEndpointSlack:     rules.recognition?.linkEndpointSlack     ?? 0.12,
  prefilterK:            rules.recognition?.prefilterK            ?? 15,
  prefilterCoarsePoints: rules.recognition?.prefilterCoarsePoints ?? 8,
}

// ── Build template list (same shape as recognizer-bench.mjs) ─────────────────────────────────────

const seedTemplates = seedData.map((s) => ({
  name:   s.name,
  role:   s.role,
  points: s.points,
  source: s.source,
  weight: sampleWeights[s.source] ?? 1.0,
}))

// ── Build clouds ONCE from the unperturbed seed ──────────────────────────────────────────────────

const clouds = buildClouds(seedTemplates)

// ── Perturbation helpers ─────────────────────────────────────────────────────────────────────────

/**
 * Rotate a single {X,Y,ID} point around origin by deg degrees.
 */
function rotatePoint(p, deg) {
  const rad = (deg * Math.PI) / 180
  const co = Math.cos(rad)
  const si = Math.sin(rad)
  // Centroid has already been moved to origin before calling this
  return { X: p.X * co - p.Y * si, Y: p.X * si + p.Y * co, ID: p.ID }
}

/**
 * Perturb a template's raw {X,Y,ID} points (params-explicit version):
 *   1. rotate by a random angle in [-rotHalfRange, +rotHalfRange)
 *   2. scale by a random factor in [scaleLo, scaleHi]
 *   3. add per-point ±jitter px uniform noise
 *
 * All randomness comes from the caller-supplied `prng` function so results are deterministic.
 *
 * @param {Array<{X,Y,ID}>} points        original template points
 * @param {number}          rotHalfRange  rotation half-range in deg (role-aware; see header)
 * @param {function}        prng          seeded PRNG → float in [0,1)
 * @param {number}          scaleLo       minimum scale factor
 * @param {number}          scaleHi       maximum scale factor
 * @param {number}          jitter        per-point ±jitter in px
 * @returns {Array<{X,Y,ID}>}             perturbed copy
 */
function perturbPointsWithParams(points, rotHalfRange, prng, scaleLo, scaleHi, jitter) {
  const deg   = (prng() * 2 - 1) * rotHalfRange
  const scale = scaleLo + prng() * (scaleHi - scaleLo)

  // Compute centroid of the original points (to rotate around)
  let cx = 0, cy = 0
  for (const p of points) { cx += p.X; cy += p.Y }
  cx /= points.length
  cy /= points.length

  return points.map((p) => {
    // Translate to origin, rotate, scale, translate back
    const ox = p.X - cx
    const oy = p.Y - cy
    const rotated = rotatePoint({ X: ox, Y: oy, ID: p.ID }, deg)
    const scaled  = { X: rotated.X * scale, Y: rotated.Y * scale, ID: p.ID }
    // Re-centre at original centroid, then add jitter
    return {
      X:  cx + scaled.X + (prng() * 2 - 1) * jitter,
      Y:  cy + scaled.Y + (prng() * 2 - 1) * jitter,
      ID: p.ID,
    }
  })
}

/**
 * Perturb a template's raw {X,Y,ID} points (CLI wrapper — uses module-level rng + consts).
 *
 * @param {Array<{X,Y,ID}>} points        original template points
 * @param {number}          rotHalfRange  rotation half-range in deg (role-aware; see header)
 * @returns {Array<{X,Y,ID}>}             perturbed copy
 */
function perturbPoints(points, rotHalfRange) {
  return perturbPointsWithParams(points, rotHalfRange, rng, SCALE_LO, SCALE_HI, JITTER)
}

// ── Synthetic dataset generation ─────────────────────────────────────────────────────────────────

/**
 * Generate PER_N perturbed test items for every seed template.
 * Each item carries its true { name, role } as ground truth.
 *
 * @returns {Array<{trueName, trueRole, points}>}
 */
function buildTestItems() {
  const items = []
  for (const tmpl of seedTemplates) {
    const rotHalfRange = tmpl.role === 'sigil' ? SIGIL_ROT : SIGN_ROT
    for (let i = 0; i < PER_N; i++) {
      items.push({
        trueName: tmpl.name,
        trueRole: tmpl.role,
        points:   perturbPoints(tmpl.points, rotHalfRange),
      })
    }
  }
  return items
}

// ── Classification ───────────────────────────────────────────────────────────────────────────────

/**
 * Classify one test item against a given cloud pool.
 * If cloudPool is omitted, uses the globally-built clouds from the seed.
 *
 * Strategy (consistent with classifyAndRecognize in recognizer.js):
 *  - Use pool.sigil for 'sigil'/'core' items, pool.sign for 'sign' items.
 *  - Run bestMatchOverRotations over the full sweep to find the best rotation.
 *  - At that best rotation, call recognize() to get the full ranked list for top-3.
 *
 * Returns { ranked: [{name, dist, adjDist}], bestDist, bestRotation }
 *
 * @param {{ trueName: string, trueRole: string, points: Array<{X,Y,ID}> }} item
 * @param {object} [cloudPool]  optional cloud pool (from buildClouds); defaults to global clouds
 */
function classifyItem(item, cloudPool) {
  const { trueRole, points } = item
  const pool2 = cloudPool ?? clouds

  // Role-matched pool (mirrors classifyAndRecognize logic)
  const pool = trueRole === 'sigil'
    ? (pool2.sigil && pool2.sigil.length > 0 ? pool2.sigil : pool2)
    : (pool2.sign  && pool2.sign.length  > 0 ? pool2.sign  : pool2)

  // Build the rotation sweep — signs use the full sweep; sigils/cores use [0] (no rotation sweep)
  const sweep = trueRole === 'sigil'
    ? [0]
    : Array.from({ length: opts.rotationSteps }, (_, k) => k * (360 / opts.rotationSteps))

  // Convert {X,Y,ID} → {x,y,_id} expected by bestMatchOverRotations
  const rawPts = points.map((p) => ({ x: p.X, y: p.Y, _id: p.ID }))

  // Compute centroid for the pivot (mirrors how classifyAndRecognize passes cx/cy)
  let cx = 0, cy = 0
  for (const p of rawPts) { cx += p.x; cy += p.y }
  cx /= rawPts.length
  cy /= rawPts.length

  const best = bestMatchOverRotations(rawPts, pool, sweep, { cx, cy })
  if (!best) return { ranked: [], bestDist: Infinity, bestRotation: 0 }

  // At the best rotation, call recognize() for the ranked list (needed for top-3).
  // Re-rotate the raw points to the winning angle, then recognize against the pool.
  const rad = (best.rotation * Math.PI) / 180
  const co = Math.cos(rad), si = Math.sin(rad)
  const rotatedPts = rawPts.map((p, idx) => {
    const dx = p.x - cx, dy = p.y - cy
    return {
      X: cx + dx * co - dy * si,
      Y: cy + dx * si + dy * co,
      ID: p._id ?? idx,
    }
  })

  const ranked = recognize(rotatedPts, pool)

  return { ranked, bestDist: best.dist, bestRotation: best.rotation }
}

// ── Shared metric helpers ────────────────────────────────────────────────────────────────────────

function pct(n, d) {
  if (d === 0) return '  N/A'
  return `${((n / d) * 100).toFixed(1)}%`
}

/**
 * Score an array of classified records into tally + confusion + calibration accumulators.
 *
 * @param {Array<{trueName, trueRole, ranked: Array<{name,dist}>}>} records
 *   Each record must have trueName, trueRole, and the ranked output from classifyItem.
 * @returns {{ tally, confusion, calibrationData, symTotals }}
 */
function scoreRecords(records) {
  const tally = {
    sign:    { items: 0, top1: 0, top3: 0 },
    sigil:   { items: 0, top1: 0, top3: 0 },
    overall: { items: 0, top1: 0, top3: 0 },
  }
  const confusion = {}
  const symTotals = {}
  const calibrationData = []

  for (const { trueName, trueRole, ranked } of records) {
    const role = trueRole
    const bucket = tally[role] ?? tally.sign
    bucket.items++
    tally.overall.items++

    const isTop1 = ranked.length > 0 && ranked[0].name === trueName
    if (isTop1) { bucket.top1++; tally.overall.top1++ }

    const top3Names = ranked.slice(0, 3).map((r) => r.name)
    const isTop3 = top3Names.includes(trueName)
    if (isTop3) { bucket.top3++; tally.overall.top3++ }

    if (!symTotals[trueName]) symTotals[trueName] = { total: 0, correct: 0, role }
    symTotals[trueName].total++
    if (isTop1) symTotals[trueName].correct++

    if (!isTop1 && ranked.length > 0) {
      const predName = ranked[0].name ?? '(none)'
      if (!confusion[trueName]) confusion[trueName] = {}
      confusion[trueName][predName] = (confusion[trueName][predName] ?? 0) + 1
    }

    if (ranked.length > 0) {
      calibrationData.push({ confidence: confidencePct(ranked[0].dist), correct: isTop1 })
    }
  }

  return { tally, confusion, calibrationData, symTotals }
}

/**
 * Print the accuracy table rows (column header + data rows).
 * Does NOT print an outer title line — the caller does that.
 * @param {{ tally: object }} params
 */
function printAccuracyTable({ tally }) {
  console.log(`  ${'role'.padEnd(10)} ${'items'.padStart(6)}   ${'top-1'.padStart(6)}    ${'top-3'.padStart(6)}`)
  console.log(`  ${'-'.repeat(38)}`)
  for (const role of ['sign', 'sigil', 'overall']) {
    const t = tally[role]
    console.log(
      `  ${role.padEnd(10)} ${String(t.items).padStart(6)}   ${pct(t.top1, t.items).padStart(6)}    ${pct(t.top3, t.items).padStart(6)}`
    )
  }
}

/**
 * Print B1 top-confusion pairs.
 * @param {object} confusion  confusion[trueName][predName] = count
 */
function printConfusion(confusion) {
  const confPairs = []
  for (const [trueName, preds] of Object.entries(confusion)) {
    for (const [predName, count] of Object.entries(preds)) {
      confPairs.push({ trueName, predName, count })
    }
  }
  confPairs.sort((a, b) => b.count - a.count || a.trueName.localeCompare(b.trueName))

  console.log('  Top confusions (true → predicted : count)')
  console.log(`  ${'-'.repeat(48)}`)
  if (confPairs.length === 0) {
    console.log('  no confusions (all top-1 correct)')
  } else {
    const topPairs = confPairs.slice(0, TOP_N)
    for (const { trueName, predName, count } of topPairs) {
      const lhs = `${trueName} → ${predName}`
      console.log(`  ${lhs.padEnd(44)} ${String(count).padStart(3)}`)
    }
    if (confPairs.length > TOP_N) {
      console.log(`  … and ${confPairs.length - TOP_N} more pair(s)`)
    }
  }
  console.log()
}

/**
 * Print B1 weakest-symbol list.
 * @param {object} symTotals  symTotals[name] = { total, correct, role }
 */
function printWeakest(symTotals) {
  const symList = Object.entries(symTotals)
    .map(([name, { total, correct, role }]) => ({
      name,
      role,
      total,
      correct,
      recall: total > 0 ? correct / total : 0,
    }))
    .sort((a, b) => a.recall - b.recall || a.name.localeCompare(b.name))

  const allPerfect = symList.every((s) => s.recall === 1)

  console.log('  Weakest symbols — lowest recall first (active-learning worklist)')
  console.log(`  ${'name'.padEnd(24)} ${'role'.padEnd(6)} ${'recall'.padStart(7)}   correct/total`)
  console.log(`  ${'-'.repeat(60)}`)
  if (allPerfect) {
    console.log('  all symbols at 100% recall')
  } else {
    const worst = symList.slice(0, TOP_N)
    for (const { name, role, recall, correct, total } of worst) {
      const recallStr = `${(recall * 100).toFixed(1)}%`
      console.log(
        `  ${name.padEnd(24)} ${role.padEnd(6)} ${recallStr.padStart(7)}   ${correct}/${total}`
      )
    }
    if (symList.length > TOP_N) {
      console.log(`  … ${symList.length - TOP_N} more symbol(s) not shown (recall ≥ ${(symList[TOP_N].recall * 100).toFixed(1)}%)`)
    }
  }
  console.log()
}

/**
 * Print B2 confidence-calibration sweep.
 * @param {{ calibrationData: Array<{confidence: number, correct: boolean}> }} param0
 */
function printCalibration({ calibrationData }) {
  const total = calibrationData.length
  const targetPct = (TARGET_ACC * 100).toFixed(1)

  console.log('  Confidence calibration (accuracy vs confidenceMinPct cutoff)')
  console.log(`  ${'cutoff'.padStart(6)}   ${'coverage'.padStart(9)}   accuracy(accepted)`)
  console.log(`  ${'-'.repeat(42)}`)

  let recommendedCutoff = null
  let recommendedAccuracy = null
  let recommendedCoverage = null
  let bestFallbackCutoff = null
  let bestFallbackAccuracy = 0
  let bestFallbackCoverage = null

  for (let c = 0; c <= 90; c += 5) {
    const accepted = calibrationData.filter((d) => d.confidence >= c)
    const acceptedCount = accepted.length
    const coverage = total > 0 ? acceptedCount / total : 0
    const correctCount = accepted.filter((d) => d.correct).length
    const accuracy = acceptedCount > 0 ? correctCount / acceptedCount : null

    const coverageStr = `${(coverage * 100).toFixed(1)}%`
    const accuracyStr = accuracy != null ? `${(accuracy * 100).toFixed(1)}%` : '  N/A'

    console.log(
      `  ${String(c).padStart(6)}   ${coverageStr.padStart(9)}   ${accuracyStr.padStart(6)}`
    )

    if (recommendedCutoff === null && accuracy != null && accuracy >= TARGET_ACC) {
      recommendedCutoff  = c
      recommendedAccuracy  = accuracy
      recommendedCoverage  = coverage
    }

    if (accuracy != null && accuracy > bestFallbackAccuracy) {
      bestFallbackAccuracy  = accuracy
      bestFallbackCutoff    = c
      bestFallbackCoverage  = coverage
    }
  }

  console.log()

  const currentMin = rules.recognition?.confidenceMinPct ?? 0

  if (recommendedCutoff !== null) {
    console.log(
      `  Recommended confidenceMinPct = ${recommendedCutoff}  (≥${targetPct}% target)` +
      ` — accuracy ${(recommendedAccuracy * 100).toFixed(1)}% @ coverage ${(recommendedCoverage * 100).toFixed(1)}%`
    )
  } else {
    console.log(
      `  No cutoff in 0–90 reaches the ≥${targetPct}% target.` +
      ` Best: confidenceMinPct = ${bestFallbackCutoff}` +
      ` — accuracy ${(bestFallbackAccuracy * 100).toFixed(1)}% @ coverage ${(bestFallbackCoverage * 100).toFixed(1)}%`
    )
  }
  console.log(`  Current rules.json confidenceMinPct = ${currentMin}`)
  console.log()
}

/**
 * Print B1 optional CSV matrix.
 * @param {{ symTotals, confusion }} param0
 */
function printMatrix({ symTotals, confusion }) {
  if (!DUMP_MATRIX) return
  const labels = Object.keys(symTotals)
  const rows = [['true \\ pred', ...labels]]
  for (const trueName of labels) {
    const confRow = confusion[trueName] ?? {}
    const correct = symTotals[trueName]?.correct ?? 0
    const total   = symTotals[trueName]?.total   ?? 0
    const misses  = total - correct
    void misses
    const cells = labels.map((predName) => {
      if (predName === trueName) return correct
      return confRow[predName] ?? 0
    })
    rows.push([trueName, ...cells])
  }

  const csv = rows.map((row) => row.map((cell) => {
    const s = String(cell)
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\n')

  writeFileSync(MATRIX_OUT, csv, 'utf8')
  console.log(`  wrote full matrix to ${MATRIX_OUT} (${labels.length}×${labels.length})`)
  console.log()
}

// ── Scoring ───────────────────────────────────────────────────────────────────────────────────────

function runAccuracy() {
  const testItems = buildTestItems()

  // Per-role accumulators (B0)
  const tally = {
    sign:    { items: 0, top1: 0, top3: 0 },
    sigil:   { items: 0, top1: 0, top3: 0 },
    overall: { items: 0, top1: 0, top3: 0 },
  }

  // B1 accumulators — built in the SAME loop, no second classification pass
  // confusion[trueName][predName] = count of top-1 misses
  const confusion = {}          // off-diagonal miss counts
  const symTotals = {}          // symTotals[name] = { total, correct, role }

  // B2 accumulator — one record per item; derived from the same classification, no second pass.
  // confidence = confidencePct(ranked[0].dist): raw geometric dist of the top-1 winner,
  //   matching how the live gate computes confidence from match.dist (invariant #2).
  // correct = whether that top-1 winner is the true label.
  const calibrationData = []   // { confidence: number 0-100, correct: boolean }

  for (const item of testItems) {
    const { ranked } = classifyItem(item)
    const role = item.trueRole // 'sign' | 'sigil'

    const bucket = tally[role] ?? tally.sign  // fallback for unknown roles
    bucket.items++
    tally.overall.items++

    // top-1: ranked[0].name === trueName
    const isTop1 = ranked.length > 0 && ranked[0].name === item.trueName
    if (isTop1) { bucket.top1++; tally.overall.top1++ }

    // top-3: trueName appears in first 3 names
    const top3Names = ranked.slice(0, 3).map((r) => r.name)
    const isTop3 = top3Names.includes(item.trueName)
    if (isTop3) { bucket.top3++; tally.overall.top3++ }

    // B1: per-symbol recall tracking
    const { trueName } = item
    if (!symTotals[trueName]) symTotals[trueName] = { total: 0, correct: 0, role }
    symTotals[trueName].total++
    if (isTop1) symTotals[trueName].correct++

    // B1: confusion accumulation — only for misses
    if (!isTop1 && ranked.length > 0) {
      const predName = ranked[0].name ?? '(none)'
      if (!confusion[trueName]) confusion[trueName] = {}
      confusion[trueName][predName] = (confusion[trueName][predName] ?? 0) + 1
    }

    // B2: record confidence of the top-1 winner using raw dist (not adjDist).
    // confidencePct is defined on raw geometric dist — matches the live gate (invariant #2).
    if (ranked.length > 0) {
      calibrationData.push({ confidence: confidencePct(ranked[0].dist), correct: isTop1 })
    }
  }

  // ── B0: Print results ─────────────────────────────────────────────────────────────────────────

  console.log()
  console.log(`$P recognizer accuracy — synthetic (seed, perN=${PER_N}, seed=${SEED})`)
  console.log(`  rotation half-range: sign ±${SIGN_ROT}°, sigil ±${SIGIL_ROT}° · scale ${SCALE_LO}–${SCALE_HI} · jitter ±${JITTER}px`)
  console.log(`  ${'role'.padEnd(10)} ${'items'.padStart(6)}   ${'top-1'.padStart(6)}    ${'top-3'.padStart(6)}`)
  console.log(`  ${'-'.repeat(38)}`)

  for (const role of ['sign', 'sigil', 'overall']) {
    const t = tally[role]
    console.log(
      `  ${role.padEnd(10)} ${String(t.items).padStart(6)}   ${pct(t.top1, t.items).padStart(6)}    ${pct(t.top3, t.items).padStart(6)}`
    )
  }

  console.log()
  console.log(
    '  Note: synthetic accuracy over-states real accuracy — the test items are perturbed'
  )
  console.log(
    '  copies of the seed templates, which are also present in the cloud. Use as a'
  )
  console.log(
    '  rotation/scale/noise regression guard and A/B tool, not a ground-truth claim.'
  )
  console.log()

  // ── B1: Top confusions ────────────────────────────────────────────────────────────────────────

  // Flatten confusion map into sortable pairs
  const confPairs = []
  for (const [trueName, preds] of Object.entries(confusion)) {
    for (const [predName, count] of Object.entries(preds)) {
      confPairs.push({ trueName, predName, count })
    }
  }
  confPairs.sort((a, b) => b.count - a.count || a.trueName.localeCompare(b.trueName))

  console.log('  Top confusions (true → predicted : count)')
  console.log(`  ${'-'.repeat(48)}`)
  if (confPairs.length === 0) {
    console.log('  no confusions (all top-1 correct)')
  } else {
    const topPairs = confPairs.slice(0, TOP_N)
    for (const { trueName, predName, count } of topPairs) {
      const lhs = `${trueName} → ${predName}`
      console.log(`  ${lhs.padEnd(44)} ${String(count).padStart(3)}`)
    }
    if (confPairs.length > TOP_N) {
      console.log(`  … and ${confPairs.length - TOP_N} more pair(s)`)
    }
  }
  console.log()

  // ── B1: Weakest symbols (lowest recall) ───────────────────────────────────────────────────────

  const symList = Object.entries(symTotals)
    .map(([name, { total, correct, role }]) => ({
      name,
      role,
      total,
      correct,
      recall: total > 0 ? correct / total : 0,
    }))
    .sort((a, b) => a.recall - b.recall || a.name.localeCompare(b.name))

  const allPerfect = symList.every((s) => s.recall === 1)

  console.log('  Weakest symbols — lowest recall first (active-learning worklist)')
  console.log(`  ${'name'.padEnd(24)} ${'role'.padEnd(6)} ${'recall'.padStart(7)}   correct/total`)
  console.log(`  ${'-'.repeat(60)}`)
  if (allPerfect) {
    console.log('  all symbols at 100% recall')
  } else {
    const worst = symList.slice(0, TOP_N)
    for (const { name, role, recall, correct, total } of worst) {
      const recallStr = `${(recall * 100).toFixed(1)}%`
      console.log(
        `  ${name.padEnd(24)} ${role.padEnd(6)} ${recallStr.padStart(7)}   ${correct}/${total}`
      )
    }
    if (symList.length > TOP_N) {
      console.log(`  … ${symList.length - TOP_N} more symbol(s) not shown (recall ≥ ${(symList[TOP_N].recall * 100).toFixed(1)}%)`)
    }
  }
  console.log()

  // ── B1: Optional CSV matrix dump ──────────────────────────────────────────────────────────────

  if (DUMP_MATRIX) {
    // Collect all unique symbol names (rows = true labels, cols = predicted labels)
    // Use the order from symTotals (insertion order = seed template order) for rows;
    // cols = same set (square grid)
    const labels = Object.keys(symTotals)

    const rows = [['true \\ pred', ...labels]]
    for (const trueName of labels) {
      const confRow = confusion[trueName] ?? {}
      const correct = symTotals[trueName]?.correct ?? 0
      const total   = symTotals[trueName]?.total   ?? 0
      const misses  = total - correct
      // diagonal = correct count; off-diagonal = miss counts from confRow
      const cells = labels.map((predName) => {
        if (predName === trueName) return correct
        return confRow[predName] ?? 0
      })
      // Sanity: sum of off-diagonal cells should equal misses
      void misses // used implicitly via correct/total above
      rows.push([trueName, ...cells])
    }

    const csv = rows.map((row) => row.map((cell) => {
      const s = String(cell)
      // Quote cells containing commas or quotes
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')).join('\n')

    writeFileSync(MATRIX_OUT, csv, 'utf8')
    console.log(`  wrote full matrix to ${MATRIX_OUT} (${labels.length}×${labels.length})`)
    console.log()
  }

  // ── B2: Confidence calibration ────────────────────────────────────────────────────────────────

  const total = calibrationData.length
  const targetPct = (TARGET_ACC * 100).toFixed(1)

  console.log('  Confidence calibration (accuracy vs confidenceMinPct cutoff)')
  console.log(`  ${'cutoff'.padStart(6)}   ${'coverage'.padStart(9)}   accuracy(accepted)`)
  console.log(`  ${'-'.repeat(42)}`)

  let recommendedCutoff = null
  let recommendedAccuracy = null
  let recommendedCoverage = null
  let bestFallbackCutoff = null
  let bestFallbackAccuracy = 0
  let bestFallbackCoverage = null

  for (let c = 0; c <= 90; c += 5) {
    const accepted = calibrationData.filter((d) => d.confidence >= c)
    const acceptedCount = accepted.length
    const coverage = total > 0 ? acceptedCount / total : 0
    const correctCount = accepted.filter((d) => d.correct).length
    const accuracy = acceptedCount > 0 ? correctCount / acceptedCount : null

    const coverageStr = `${(coverage * 100).toFixed(1)}%`
    const accuracyStr = accuracy != null ? `${(accuracy * 100).toFixed(1)}%` : '  N/A'

    console.log(
      `  ${String(c).padStart(6)}   ${coverageStr.padStart(9)}   ${accuracyStr.padStart(6)}`
    )

    // Track the first cutoff that meets the target (smallest = lowest coverage cost)
    if (recommendedCutoff === null && accuracy != null && accuracy >= TARGET_ACC) {
      recommendedCutoff  = c
      recommendedAccuracy  = accuracy
      recommendedCoverage  = coverage
    }

    // Track best-accuracy fallback in case no cutoff reaches target
    if (accuracy != null && accuracy > bestFallbackAccuracy) {
      bestFallbackAccuracy  = accuracy
      bestFallbackCutoff    = c
      bestFallbackCoverage  = coverage
    }
  }

  console.log()

  const currentMin = rules.recognition?.confidenceMinPct ?? 0

  if (recommendedCutoff !== null) {
    console.log(
      `  Recommended confidenceMinPct = ${recommendedCutoff}  (≥${targetPct}% target)` +
      ` — accuracy ${(recommendedAccuracy * 100).toFixed(1)}% @ coverage ${(recommendedCoverage * 100).toFixed(1)}%`
    )
  } else {
    console.log(
      `  No cutoff in 0–90 reaches the ≥${targetPct}% target.` +
      ` Best: confidenceMinPct = ${bestFallbackCutoff}` +
      ` — accuracy ${(bestFallbackAccuracy * 100).toFixed(1)}% @ coverage ${(bestFallbackCoverage * 100).toFixed(1)}%`
    )
  }
  console.log(`  Current rules.json confidenceMinPct = ${currentMin}`)
  console.log()

  // ── B3: Prefilter-K safety sweep ──────────────────────────────────────────────────────────────
  //
  // Strategy: faithfully reproduce what classifyAndRecognize does for each item (lines ~480-491
  // of recognizer.js).  For each K:
  //   1. Build the input coarse cloud at COARSE_ANGLE_STEPS=8 evenly-spaced angles via makeCloudN
  //      + rotateCloudPoints (now exported, pure).
  //   2. Call prefilter(inputCoarseByAngle, pool, K) to get the top-K matchPool.
  //   3. Guard: if pool.length <= K, skip the prefilter and use the full pool (exactly as the
  //      real code does — this is the sanity check that K >= pool-size equals baseline).
  //   4. Run bestMatchOverRotations over matchPool; score top-1.
  //
  // Baseline (K=9999): pool.length is always <= 9999 for our template set, so the guard fires
  // everywhere → full sweep → identical to classifyItem / B0.
  //
  // Reuses the SAME testItems that were already generated above (apples-to-apples comparison,
  // invariant: same seed → identical B3 output).

  const COARSE_ANGLE_STEPS = 8
  const coarseAngles = Array.from({ length: COARSE_ANGLE_STEPS }, (_, k) => k * (360 / COARSE_ANGLE_STEPS))
  const B3_K_SWEEP = [5, 8, 10, 13, 15, 20, 30]
  const B3_BASELINE_K = 9999

  /**
   * Classify one test item using the prefilter at the given K.
   * Mirrors classifyAndRecognize's P3 block exactly.
   *
   * @param {{trueName, trueRole, points: Array<{X,Y,ID}>}} item
   * @param {number} K  prefilterK to apply (9999 = effectively disabled)
   * @returns {boolean}  true if top-1 prediction === trueName
   */
  function classifyItemWithK(item, K) {
    const { trueRole, points } = item

    // Role-matched pool (same fallback logic as classifyItem / classifyAndRecognize)
    const pool = trueRole === 'sigil'
      ? (clouds.sigil && clouds.sigil.length > 0 ? clouds.sigil : clouds)
      : (clouds.sign  && clouds.sign.length  > 0 ? clouds.sign  : clouds)

    // Rotation sweep: signs use the full sweep; sigils/cores use [0] only.
    const sweep = trueRole === 'sigil'
      ? [0]
      : Array.from({ length: opts.rotationSteps }, (_, k) => k * (360 / opts.rotationSteps))

    // Convert {X,Y,ID} template points → {x,y,_id} (rawPts shape for bestMatchOverRotations)
    const rawPts = points.map((p) => ({ x: p.X, y: p.Y, _id: p.ID }))

    // Compute centroid pivot (mirrors classifyAndRecognize's g.cx/g.cy passed to bestMatchOverRotations)
    let cx = 0, cy = 0
    for (const p of rawPts) { cx += p.x; cy += p.y }
    cx /= rawPts.length
    cy /= rawPts.length

    // P3 guard: skip prefilter when pool.length <= K (same condition as the real code)
    let matchPool = pool
    if (pool.length > K) {
      // Build input coarse cloud — mirrors classifyAndRecognize lines ~483-491 exactly.
      // rawPts has {x,y,_id}; makeCloudN expects {X,Y,ID} — convert via explicit map.
      const inputRawXYID = rawPts.map((p) => ({ X: p.x, Y: p.y, ID: p._id ?? 0 }))
      const inputNorm = makeCloudN('', inputRawXYID, opts.prefilterCoarsePoints)
      const inputCoarseByAngle = coarseAngles.map((deg) => ({
        points: deg === 0 ? inputNorm.points : rotateCloudPoints(inputNorm.points, deg),
      }))
      matchPool = prefilter(inputCoarseByAngle, pool, K)
    }

    const best = bestMatchOverRotations(rawPts, matchPool, sweep, { cx, cy })
    return best != null && best.name === item.trueName
  }

  // Compute baseline accuracy (K=9999 → guard always fires → full pool, identical to B0)
  let baselineTop1 = 0
  for (const item of testItems) {
    if (classifyItemWithK(item, B3_BASELINE_K)) baselineTop1++
  }
  const baselineAcc = testItems.length > 0 ? baselineTop1 / testItems.length : 0

  // Sweep each K and collect accuracy + drop
  const kResults = B3_K_SWEEP.map((K) => {
    let top1 = 0
    for (const item of testItems) {
      if (classifyItemWithK(item, K)) top1++
    }
    const acc = testItems.length > 0 ? top1 / testItems.length : 0
    const drop = baselineAcc - acc   // positive = accuracy lost; 0 = safe
    return { K, acc, drop }
  })

  // Recommendation: smallest K with zero drop (drop === 0 exactly, since we compare integer counts).
  // The skip guard in classifyAndRecognize fires when pool.length <= K, so any K >= max pool size
  // is GUARANTEED to equal baseline (the guard fires for every group → full sweep → no prefilter).
  // Pool sizes are sign pool size vs sigil pool size; max determines the true safe floor.
  const signPoolSize  = (clouds.sign  && clouds.sign.length  > 0) ? clouds.sign.length  : clouds.length
  const sigilPoolSize = (clouds.sigil && clouds.sigil.length > 0) ? clouds.sigil.length : clouds.length
  const maxPoolSize   = Math.max(signPoolSize, sigilPoolSize)  // true safe K floor (guard-guaranteed)

  const safeResults = kResults.filter((r) => r.drop === 0)
  const smallestSafeK = safeResults.length > 0 ? safeResults[0].K : null

  const configuredK = rules.recognition?.prefilterK ?? 15

  console.log('  Prefilter-K safety (top-1 accuracy vs no-prefilter baseline)')
  console.log(`  pool sizes: sign=${signPoolSize}, sigil=${sigilPoolSize} — skip guard fires at K >= pool size`)
  console.log(`  baseline (no prefilter): ${(baselineAcc * 100).toFixed(1)}%`)
  console.log(`  ${'K'.padEnd(6)}  ${'accuracy'.padStart(9)}  ${'drop'.padStart(6)}`)
  console.log(`  ${'-'.repeat(28)}`)

  for (const { K, acc, drop } of kResults) {
    const accStr = `${(acc * 100).toFixed(1)}%`
    const dropStr = drop === 0 ? ' 0.0pp' : `-${(drop * 100).toFixed(1)}pp`
    // Annotate rows where the guard fires for at least one pool (sanity check visible in output)
    const guardNote = K >= sigilPoolSize && K < signPoolSize
      ? ' (guard: sigil only)'
      : K >= maxPoolSize
        ? ' (guard: all pools)'
        : ''
    console.log(`  ${String(K).padEnd(6)}  ${accStr.padStart(9)}  ${dropStr.padStart(6)}${guardNote}`)
  }

  console.log()
  // IMPORTANT framing: "drop" is the coarse 8-point pre-filter's SENSITIVITY to the current
  // perturbation — a stress test of its noise-robustness, NOT evidence that the configured K is a
  // production defect. On clean inputs the pre-filter is equivalent at every K (verify:
  // --jitter=0 --scaleLo=1 --scaleHi=1 --signRot=0 --sigilRot=0 → 0.0pp at all K). The skip guard
  // makes K >= max pool size (${maxPoolSize}) trivially equivalent — that just means "prefilter off".
  // So treat any drop as a signal to confirm against REAL held-out data (B4) before touching rules.json.
  if (smallestSafeK !== null) {
    console.log(
      `  Smallest K with zero drop under this perturbation = ${smallestSafeK}` +
      `   |   rules.json prefilterK = ${configuredK}`
    )
  } else {
    console.log(
      `  No tested K (${B3_K_SWEEP[0]}–${B3_K_SWEEP[B3_K_SWEEP.length - 1]}) reaches zero drop under this` +
      ` perturbation — the coarse pre-filter is the noise bottleneck here (prefilter bypassed only at` +
      ` K >= max pool size = ${maxPoolSize}).   rules.json prefilterK = ${configuredK}`
    )
  }
  console.log('  Note: drop = coarse pre-filter sensitivity to THIS perturbation (a stress test), not a')
  console.log('        prod defect. On clean glyphs all K are equivalent; confirm against real data (B4).')
  console.log()
}

// ── B4: k-fold cross-validation over real/fixture/db samples ────────────────────────────────────

/**
 * Load fixture samples from a JSON file.
 * @param {string} filePath
 * @returns {Array<{name, role, points, source}>}
 */
function loadFixture(filePath) {
  let raw
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (err) {
    console.error(`--source=fixture: cannot read file "${filePath}": ${err.message}`)
    process.exit(1)
  }
  let data
  try {
    data = JSON.parse(raw)
  } catch (err) {
    console.error(`--source=fixture: "${filePath}" is not valid JSON: ${err.message}`)
    process.exit(1)
  }
  if (!Array.isArray(data)) {
    console.error(`--source=fixture: "${filePath}" must be a JSON array of sample objects.`)
    process.exit(1)
  }
  return data
}

/**
 * Load samples from Supabase via a dynamic import (B4 db mode).
 * Uses process.env.SUPABASE_URL + process.env.SUPABASE_SECRET (or SUPABASE_SERVICE_KEY).
 * Gracefully exits 0 when env vars are absent.
 *
 * @returns {Promise<Array<{name, role, points, source}>>}
 */
async function loadDbSamples() {
  const url = process.env.SUPABASE_URL
  const key  = process.env.SUPABASE_SECRET ?? process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    console.log(
      '--source=db requires SUPABASE_URL + SUPABASE_SECRET in the environment (none found); nothing to do.'
    )
    process.exit(0)
  }

  let createClient
  try {
    const mod = await import('@supabase/supabase-js')
    createClient = mod.createClient
  } catch (err) {
    console.error(`--source=db: failed to import @supabase/supabase-js: ${err.message}`)
    process.exit(1)
  }

  const client = createClient(url, key)

  let query = client
    .from('training_samples')
    .select('*, symbols(engine_id, name, kind)')
    .is('deleted_at', null)
  if (VERIFIED_ONLY) query = query.eq('verified', true)

  const { data, error } = await query
  if (error) {
    console.error(`--source=db: Supabase query failed: ${error.message}`)
    process.exit(1)
  }
  if (!data || data.length === 0) {
    console.log('--source=db: no samples returned from Supabase (table empty or all deleted).')
    process.exit(0)
  }

  return data.map((row) => ({
    name:   row.symbols?.engine_id || row.symbols?.name || '',
    role:   row.role || (row.symbols?.kind === 'sigil' ? 'sigil' : 'sign'),
    points: row.points,
    source: row.source || 'drawn',
  })).filter((s) => s.name && Array.isArray(s.points) && s.points.length > 0)
}

/**
 * Run k-fold (leave-one-out by default) cross-validation over the given samples.
 *
 * @param {Array<{name, role, points, source}>} samples  raw sample objects
 * @param {string} sourceLabel  display name for the header (e.g. 'fixture: foo.json')
 */
function runKFold(samples, sourceLabel) {
  // Sort samples by stable key (name then original index) so fold composition is deterministic.
  const sorted = samples
    .map((s, i) => ({ ...s, _origIdx: i }))
    .sort((a, b) => a.name.localeCompare(b.name) || a._origIdx - b._origIdx)

  // Group by label
  const byLabel = new Map()
  for (const s of sorted) {
    if (!byLabel.has(s.name)) byLabel.set(s.name, [])
    byLabel.get(s.name).push(s)
  }

  const totalLabels = byLabel.size
  const evaluableLabels = []
  const singletonLabels = []
  for (const [name, group] of byLabel) {
    if (group.length >= 2) evaluableLabels.push(name)
    else singletonLabels.push(name)
  }

  const totalHeldOut = evaluableLabels.reduce((sum, name) => {
    const group = byLabel.get(name)
    const k = FOLDS_ARG !== null ? Math.min(FOLDS_ARG, group.length) : group.length  // LOO = group.length
    return sum + k
  }, 0)

  // Print header
  console.log()
  console.log(`$P recognizer accuracy — held-out k-fold (${sourceLabel})`)
  console.log(
    `  folds: ${FOLDS_ARG !== null ? FOLDS_ARG : 'LOO'} · ` +
    `verified-only: ${VERIFIED_ONLY}`
  )

  // Coverage line — mandatory honesty before any numbers
  console.log(
    `  Coverage: ${evaluableLabels.length}/${totalLabels} labels evaluable` +
    ` (${singletonLabels.length} singleton${singletonLabels.length !== 1 ? 's' : ''} skipped),` +
    ` ${totalHeldOut} held-out item${totalHeldOut !== 1 ? 's' : ''} scored.`
  )

  if (evaluableLabels.length === 0) {
    console.log(
      '  No evaluable labels (all symbols have only 1 sample). ' +
      'Add more samples via the Training tab to enable held-out evaluation.'
    )
    console.log()
    return
  }

  // ── Run k-fold ────────────────────────────────────────────────────────────────────────────────

  // All records accumulate across folds for aggregate metrics
  const allRecords = []  // { trueName, trueRole, ranked }

  for (const labelName of evaluableLabels) {
    const group = byLabel.get(labelName)
    // Determine actual folds: LOO = group.length; else min(FOLDS_ARG, group.length)
    const numFolds = FOLDS_ARG !== null ? Math.min(FOLDS_ARG, group.length) : group.length

    // For LOO: hold out index i. For k-fold: split group into numFolds roughly-equal chunks,
    // hold out chunk i. We assign items to folds by index mod numFolds (round-robin, stable).
    for (let foldIdx = 0; foldIdx < numFolds; foldIdx++) {
      // Which items are held out in this fold?
      const isLOO = FOLDS_ARG === null || numFolds === group.length
      const heldOutItems = isLOO
        ? [group[foldIdx]]
        : group.filter((_, idx) => idx % numFolds === foldIdx)

      if (heldOutItems.length === 0) continue

      // Training pool: ALL samples EXCEPT the held-out ones for this fold.
      // We must exclude the exact held-out items (by _origIdx) from the pool.
      const heldOutIdxSet = new Set(heldOutItems.map((s) => s._origIdx))
      const trainingItems = sorted.filter((s) => !heldOutIdxSet.has(s._origIdx))

      // Build clouds from training items only — this is the critical held-out guarantee.
      const trainingTemplates = trainingItems.map((s) => ({
        name:   s.name,
        role:   s.role,
        points: s.points,
        source: s.source,
        weight: sampleWeights[s.source] ?? 1.0,
      }))
      const foldClouds = buildClouds(trainingTemplates)

      // Classify each held-out item using the fold's cloud pool
      for (const heldItem of heldOutItems) {
        const testItem = {
          trueName: heldItem.name,
          trueRole: heldItem.role,
          points:   heldItem.points,
        }
        const { ranked } = classifyItem(testItem, foldClouds)
        allRecords.push({ trueName: heldItem.name, trueRole: heldItem.role, ranked })
      }
    }
  }

  // ── Score and print using shared helpers ──────────────────────────────────────────────────────

  const { tally, confusion, calibrationData, symTotals } = scoreRecords(allRecords)

  console.log()
  printAccuracyTable({ tally })
  console.log()
  console.log(
    '  Note: held-out accuracy is the true generalization metric — each item was classified'
  )
  console.log(
    '  using only samples that were NOT in its fold\'s held-out set. High accuracy over few'
  )
  console.log(
    '  evaluable labels is not a headline; see Coverage line above.'
  )
  console.log()

  printConfusion(confusion)
  printWeakest(symTotals)
  printMatrix({ symTotals, confusion })
  printCalibration({ calibrationData })
}

// ── B5: Pure exported scoring function (no console, deterministic, self-contained PRNG) ──────────

/**
 * Run the synthetic accuracy benchmark and return structured results without any console output.
 *
 * This function is self-contained: it builds its OWN seeded PRNG from `seed` and does NOT depend
 * on the module-level `rng` or CLI-derived consts. The module-level `clouds` (built from the
 * unperturbed seed) are reused — they are CLI-independent and deterministic given the seed data.
 *
 * @param {object} [opts]
 * @param {number} [opts.seed=1]       PRNG seed — same seed → bit-identical results
 * @param {number} [opts.perN=5]       perturbations per template
 * @param {number} [opts.signRot=180]  sign rotation half-range in deg (full circle)
 * @param {number} [opts.sigilRot=15]  sigil rotation half-range in deg (upright wobble)
 * @param {number} [opts.scaleLo=0.8]  minimum scale factor
 * @param {number} [opts.scaleHi=1.25] maximum scale factor
 * @param {number} [opts.jitter=2]     per-point ±jitter in px
 * @returns {{
 *   overall: { top1: number, top3: number, items: number },
 *   byRole:  { sign: { top1: number, top3: number, items: number },
 *              sigil: { top1: number, top3: number, items: number } }
 * }}
 *   top1/top3 are FRACTIONS in [0,1]. NO console output is produced.
 */
export function runSyntheticAccuracy({
  seed     = 1,
  perN     = 5,
  signRot  = 180,
  sigilRot = 15,
  scaleLo  = 0.8,
  scaleHi  = 1.25,
  jitter   = 2,
} = {}) {
  // Own seeded PRNG — independent of the module-level `rng` (which is CLI-derived).
  const localRng = mulberry32(seed)

  // Accumulate tally per role + overall
  const tally = {
    sign:    { items: 0, top1: 0, top3: 0 },
    sigil:   { items: 0, top1: 0, top3: 0 },
    overall: { items: 0, top1: 0, top3: 0 },
  }

  for (const tmpl of seedTemplates) {
    const rotHalfRange = tmpl.role === 'sigil' ? sigilRot : signRot
    for (let i = 0; i < perN; i++) {
      const perturbedPoints = perturbPointsWithParams(
        tmpl.points, rotHalfRange, localRng, scaleLo, scaleHi, jitter
      )
      const item = { trueName: tmpl.name, trueRole: tmpl.role, points: perturbedPoints }
      const { ranked } = classifyItem(item)

      const role = tmpl.role
      const bucket = tally[role] ?? tally.sign
      bucket.items++
      tally.overall.items++

      const isTop1 = ranked.length > 0 && ranked[0].name === item.trueName
      if (isTop1) { bucket.top1++; tally.overall.top1++ }

      const top3Names = ranked.slice(0, 3).map((r) => r.name)
      const isTop3 = top3Names.includes(item.trueName)
      if (isTop3) { bucket.top3++; tally.overall.top3++ }
    }
  }

  function fraction(t) {
    return {
      top1:  t.items > 0 ? t.top1 / t.items : 0,
      top3:  t.items > 0 ? t.top3 / t.items : 0,
      items: t.items,
    }
  }

  return {
    overall: fraction(tally.overall),
    byRole: {
      sign:  fraction(tally.sign),
      sigil: fraction(tally.sigil),
    },
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────────────────────────

async function main() {
  if (SOURCE === 'seed') {
    runAccuracy()
  } else if (SOURCE === 'fixture') {
    if (!FIXTURE_FILE) {
      console.error('--source=fixture requires --file <path>')
      process.exit(1)
    }
    const samples = loadFixture(FIXTURE_FILE)
    runKFold(samples, `fixture: ${FIXTURE_FILE}`)
  } else if (SOURCE === 'db') {
    const samples = await loadDbSamples()
    runKFold(samples, 'db')
  } else {
    console.error(`Unknown --source value: "${SOURCE}". Use "seed", "fixture", or "db".`)
    process.exit(1)
  }
}

// ── Main guard — prevents CLI execution when this module is imported (e.g. from tests) ───────────
// Windows-safe: process.argv[1] may be a Win32 path, so we normalise both sides via pathToFileURL.
// Guard against process.argv[1] being undefined (e.g. `node --input-type=module` / REPL mode).
const isMain = process.argv[1] != null &&
  pathToFileURL(process.argv[1]).href === import.meta.url

if (isMain) {
  main().catch((err) => {
    console.error('Unexpected error:', err)
    process.exit(1)
  })
}
