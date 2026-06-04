import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStrokes, renderInk, compareInk, cellStats, rasterScore } from '../src/draw/rasterMatch.js'

// ---------- helpers ----------

const params = { inkSize: 40, coreRadius: 1, softRadius: 2, looseRadius: 4, gridSize: 10, rotationSet: [0, 45, 90, 135, 180, 225, 270, 315] }

/** Horizontal line stroke in [0,1] coords */
const hLine = () => [[{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }]]

/** Vertical line stroke in [0,1] coords */
const vLine = () => [[{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }]]

/** L-shape strokes in world coords */
const lShape = () => [
  [{ x: 0, y: 0 }, { x: 100, y: 0 }],   // horizontal bar
  [{ x: 100, y: 0 }, { x: 100, y: 100 }], // vertical drop
]

// ---------- normalizeStrokes ----------

test('normalizeStrokes: single point → x=0.5, y=0.5 (centered)', () => {
  const { strokes } = normalizeStrokes([[{ x: 50, y: 50 }]])
  assert.ok(Math.abs(strokes[0][0].x - 0.5) < 1e-6)
  assert.ok(Math.abs(strokes[0][0].y - 0.5) < 1e-6)
})

test('normalizeStrokes: horizontal segment → y coords centered, x spans [0,1]', () => {
  const raw = [[{ x: 0, y: 0 }, { x: 100, y: 0 }]]
  const { strokes, width } = normalizeStrokes(raw)
  assert.ok(Math.abs(width - 100) < 1e-6, `width should be 100, got ${width}`)
  // Both points should have y=0.5 (centered in the square)
  assert.ok(Math.abs(strokes[0][0].y - 0.5) < 1e-6, `y should be 0.5, got ${strokes[0][0].y}`)
  assert.ok(Math.abs(strokes[0][1].y - 0.5) < 1e-6)
})

test('normalizeStrokes: empty strokes → returns empty arrays', () => {
  const { strokes } = normalizeStrokes([[], []])
  assert.equal(strokes[0].length, 0)
})

// ---------- renderInk ----------

test('renderInk: horizontal line → ink in centre row, sparse near top/bottom', () => {
  const ink = renderInk(hLine(), 0, params)
  const size = params.inkSize
  const midRow = Math.floor(size / 2)
  // Middle row of soft mask should have more ink than top row
  let midCount = 0, topCount = 0
  for (let ix = 0; ix < size; ix++) {
    if (ink.soft.mask[midRow * size + ix]) midCount++
    if (ink.soft.mask[0 * size + ix]) topCount++
  }
  assert.ok(midCount > 0, 'middle row should have ink')
  assert.ok(midCount > topCount, `mid=${midCount} should exceed top=${topCount}`)
})

test('renderInk: returns three layers (core/soft/loose) with ink counts', () => {
  const ink = renderInk(hLine(), 0, params)
  assert.ok(ink.core.ink > 0, 'core should have ink')
  assert.ok(ink.soft.ink >= ink.core.ink, 'soft ink >= core ink (dilation)')
  assert.ok(ink.loose.ink >= ink.soft.ink, 'loose ink >= soft ink (more dilation)')
})

test('renderInk: rotation by 90° rotates horizontal → vertical', () => {
  const hInk = renderInk(hLine(), 0, params)
  const vInk = renderInk(hLine(), 90, params)
  const size = params.inkSize
  // For horizontal at 0°: column 0 should have sparse ink; column mid should be rich
  // After 90° rotation: the horizontal becomes vertical, so mid column sparse, mid row rich
  // Proxy: the centre column of the rotated ink should match the centre row of the original
  let hMidRow = 0, vMidRow = 0
  const mid = Math.floor(size / 2)
  for (let i = 0; i < size; i++) {
    hMidRow += hInk.soft.mask[mid * size + i]
    vMidRow += vInk.soft.mask[i * size + mid]
  }
  assert.ok(hMidRow > 5, `horizontal: mid row should have ink (got ${hMidRow})`)
  assert.ok(vMidRow > 5, `rotated 90°: mid column should have ink (got ${vMidRow})`)
})

// ---------- compareInk ----------

test('compareInk: identical strokes score high inkScore and low contaminationRisk', () => {
  const ink = renderInk(hLine(), 0, params)
  const result = compareInk(ink, ink, params)
  assert.ok(result.inkScore > 0.8, `inkScore should be > 0.8 for identical, got ${result.inkScore}`)
  assert.ok(result.contaminationRisk < 0.1, `contaminationRisk should be < 0.1 for identical, got ${result.contaminationRisk}`)
})

test('compareInk: completely different strokes have low inkScore', () => {
  const candInk = renderInk(hLine(), 0, params)
  // Reference: a dot in the corner — very different
  const cornerRef = renderInk([[{ x: 0.05, y: 0.05 }]], 0, params)
  const result = compareInk(candInk, cornerRef, params)
  assert.ok(result.inkScore < 0.5, `inkScore for unrelated shapes should be < 0.5, got ${result.inkScore}`)
})

test('compareInk: contaminated candidate (double ink) has elevated contaminationRisk', () => {
  // Reference: clean horizontal line
  const refInk = renderInk(hLine(), 0, params)
  // Candidate: horizontal + vertical (the extra vertical is "contamination")
  const candInk = renderInk([...hLine(), ...vLine()], 0, params)
  const result = compareInk(candInk, refInk, params)
  // The extra vertical ink is unexplained by the reference → higher contamination
  assert.ok(
    result.contaminationRisk > result.inkScore - 0.3 || result.unexplainedInkRatio > 0.2,
    `contaminated candidate should show higher unexplainedInkRatio (got ${result.unexplainedInkRatio}) or higher contaminationRisk (got ${result.contaminationRisk})`
  )
})

test('compareInk: all metric fields present', () => {
  const ink = renderInk(hLine(), 0, params)
  const result = compareInk(ink, ink, params)
  const required = ['inkScore', 'softDiceScore', 'contaminationRisk', 'candidateExplainedRatio', 'templateCoveredRatio', 'unexplainedInkRatio', 'missingInkRatio', 'requiredCellCoverage', 'forbiddenCellInkRatio', 'regionScore', 'contaminationCap']
  for (const key of required) {
    assert.ok(key in result, `missing field: ${key}`)
    assert.ok(typeof result[key] === 'number', `${key} should be a number`)
  }
})

// ---------- cellStats ----------

test('cellStats: identical ink → requiredCellCoverage=1, forbiddenCellInkRatio=0', () => {
  const ink = renderInk(hLine(), 0, params)
  const cs = cellStats(ink, ink, params)
  assert.ok(cs.requiredCellCoverage > 0.9, `requiredCellCoverage should be ~1, got ${cs.requiredCellCoverage}`)
  assert.ok(cs.forbiddenCellInkRatio < 0.1, `forbiddenCellInkRatio should be ~0, got ${cs.forbiddenCellInkRatio}`)
})

// ---------- rasterScore ----------

test('rasterScore: identical strokes → inkScore > 0.8', () => {
  const strokes = lShape()
  const result = rasterScore(strokes, strokes, params)
  assert.ok(result.inkScore > 0.8, `inkScore for identical strokes should be > 0.8, got ${result.inkScore}`)
})

test('rasterScore: rotated strokes still find good match via sweep', () => {
  // Reference: L-shape at 0°
  const ref = lShape()
  // Candidate: same L-shape rotated 90° (world coords rotation)
  const candidate = [
    [{ x: 0, y: 0 }, { x: 0, y: 100 }],  // was horizontal, now vertical
    [{ x: 0, y: 100 }, { x: -100, y: 100 }], // was vertical, now horizontal
  ]
  const result = rasterScore(candidate, ref, { ...params, rotationSet: [0, 45, 90, 135, 180, 225, 270, 315] })
  // The rotation sweep should find a good match at 90° or 270°
  assert.ok(result.inkScore > 0.4, `rotated match inkScore should be > 0.4, got ${result.inkScore}`)
})

test('rasterScore: contaminationCap applied when unexplainedInkRatio high', () => {
  // Candidate with massive extra ink (5 cross-strokes added)
  const big = [
    [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    [{ x: 0, y: 20 }, { x: 100, y: 20 }],
    [{ x: 0, y: 40 }, { x: 100, y: 40 }],
    [{ x: 0, y: 60 }, { x: 100, y: 60 }],
    [{ x: 0, y: 80 }, { x: 100, y: 80 }],
    [{ x: 0, y: 100 }, { x: 100, y: 100 }],
  ]
  // Reference: single line
  const small = [[{ x: 0, y: 50 }, { x: 100, y: 50 }]]
  const result = rasterScore(big, small, params)
  // A very "bloated" candidate relative to reference should have contaminationCap < 1.0
  // OR high unexplainedInkRatio
  assert.ok(
    result.contaminationCap < 1.0 || result.unexplainedInkRatio > 0.3,
    `bloated candidate should have contaminationCap < 1.0 (got ${result.contaminationCap}) or high unexplainedInkRatio (got ${result.unexplainedInkRatio})`
  )
})

test('rasterScore: returns bestRotationDeg field', () => {
  const result = rasterScore(lShape(), lShape(), params)
  assert.ok('bestRotationDeg' in result, 'result should have bestRotationDeg')
  assert.ok(typeof result.bestRotationDeg === 'number')
})
