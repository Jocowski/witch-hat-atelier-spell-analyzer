import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRingClosure, strokesBounds, scoreCircleFit, } from '../src/draw/ringClosure.js'

// ---------- helpers ----------

/** Generate a circle stroke with N points, optional gap fraction (0..1 of circumference). */
function circleStroke(cx, cy, r, n = 64, gapFraction = 0) {
  const pts = []
  const endAngle = 2 * Math.PI * (1 - gapFraction)
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * endAngle
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  return pts
}

/** A small closed square (simulates a closed sign, not a ring). */
function squareStroke(cx, cy, size) {
  const h = size / 2
  return [
    { x: cx - h, y: cy - h }, { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h }, { x: cx - h, y: cy + h },
    { x: cx - h, y: cy - h }, // close
  ]
}

// Lenient config for testing (smaller minRadius so tests don't need giant circles)
const baseConfig = { minRadius: 30 }

// ---------- strokesBounds ----------

test('strokesBounds: single point', () => {
  const bounds = strokesBounds([[{ x: 10, y: 20 }]])
  assert.equal(bounds.minX, 10)
  assert.equal(bounds.minY, 20)
  assert.equal(bounds.maxX, 10)
  assert.equal(bounds.maxY, 20)
})

test('strokesBounds: empty strokes returns zeros', () => {
  const bounds = strokesBounds([])
  assert.equal(bounds.width, 0)
})

// ---------- scoreCircleFit ----------

test('scoreCircleFit: perfect circle points → perfection ~1', () => {
  const pts = []
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * 2 * Math.PI
    pts.push({ x: 200 * Math.cos(t), y: 200 * Math.sin(t) })
  }
  const result = scoreCircleFit(pts)
  assert.ok(result.perfection > 0.9, `expected high perfection, got ${result.perfection}`)
  assert.ok(result.normalizedRmse < 0.05, `expected low rmse, got ${result.normalizedRmse}`)
  assert.ok(Math.abs(result.r - 200) < 5, `expected r≈200, got ${result.r}`)
})

test('scoreCircleFit: too few points returns zero', () => {
  const result = scoreCircleFit([{ x: 0, y: 0 }, { x: 1, y: 1 }])
  assert.equal(result.perfection, 0)
})

// ---------- analyzeRingClosure — empty / trivial ----------

test('analyzeRingClosure: empty strokes → closed=false (graceful no-op)', () => {
  const r = analyzeRingClosure([], baseConfig)
  assert.equal(r.closed, false)
  assert.equal(r.enclosedAreaPx, 0)
})

test('analyzeRingClosure: single point stroke → closed=false', () => {
  const r = analyzeRingClosure([[{ x: 0, y: 0 }]], baseConfig)
  assert.equal(r.closed, false)
})

// ---------- analyzeRingClosure — clean full circle ----------

test('analyzeRingClosure: clean full circle (r=100) → closed=true', () => {
  const stroke = circleStroke(200, 200, 100, 128)
  const r = analyzeRingClosure([stroke], baseConfig)
  assert.equal(r.closed, true, `expected closed=true, got closed=${r.closed}, area=${r.enclosedAreaPx}`)
  assert.ok(r.enclosedAreaPx > 2000, `expected meaningful enclosed area, got ${r.enclosedAreaPx}`)
})

test('analyzeRingClosure: clean full circle has enclosedAreaPx >> minEnclosedAreaPx', () => {
  const stroke = circleStroke(300, 300, 150, 128)
  const r = analyzeRingClosure([stroke], baseConfig)
  assert.ok(r.enclosedAreaPx > r.minEnclosedAreaPx, `area ${r.enclosedAreaPx} should exceed min ${r.minEnclosedAreaPx}`)
})

// ---------- analyzeRingClosure — messy / gapped circles ----------

test('analyzeRingClosure: circle with 1% gap → closed=true (ink-disk bridges the small gap)', () => {
  // 1% of 100px-radius circle circumference ≈ 6px gap — within the 4px ink-disk bridge tolerance
  const stroke = circleStroke(200, 200, 100, 128, 0.01)
  const r = analyzeRingClosure([stroke], baseConfig)
  assert.equal(r.closed, true, `expected closed=true for 1% gap, got ${r.closed}, area=${r.enclosedAreaPx}`)
})

test('analyzeRingClosure: circle with 15% gap → closed=false (gap too large for default config)', () => {
  const stroke = circleStroke(200, 200, 100, 128, 0.15)
  const r = analyzeRingClosure([stroke], baseConfig)
  // With a 15% gap and default inkRadius=4 the flood leaks in — closed should be false
  assert.equal(r.closed, false, `expected closed=false for 15% gap, got ${r.closed}`)
})

// ---------- analyzeRingClosure — small closed sign (the "not a ring" guard) ----------

test('analyzeRingClosure: tiny square (30px) → closed=false (area below guard)', () => {
  const stroke = squareStroke(200, 200, 30)
  const r = analyzeRingClosure([stroke], { ...baseConfig, minEnclosedAreaPx: 2000 })
  assert.equal(r.closed, false, `tiny square should fail area guard, got closed=${r.closed}, area=${r.enclosedAreaPx}`)
})

test('analyzeRingClosure: small closed sign (r=20) with minRadius=40 → closed=false (radius guard)', () => {
  const stroke = circleStroke(200, 200, 20, 64)
  const r = analyzeRingClosure([stroke], { ...baseConfig, minRadius: 40, minEnclosedAreaPx: 100 })
  assert.equal(r.closed, false, `small sign should fail radius guard`)
})

// ---------- analyzeRingClosure — two-stroke ring ----------

test('analyzeRingClosure: two half-circles as separate strokes → closed=true', () => {
  // Explicit top semicircle (0 → π) and bottom semicircle (π → 2π)
  const n = 64
  const topHalf = []
  const botHalf = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI
    topHalf.push({ x: 200 + 100 * Math.cos(t), y: 200 + 100 * Math.sin(t) })
  }
  for (let i = 0; i <= n; i++) {
    const t = Math.PI + (i / n) * Math.PI
    botHalf.push({ x: 200 + 100 * Math.cos(t), y: 200 + 100 * Math.sin(t) })
  }
  const r = analyzeRingClosure([topHalf, botHalf], baseConfig)
  assert.equal(r.closed, true, `two half-circles should form a closed ring, got ${r.closed}`)
})

// ---------- analyzeRingClosure — large circle (stress / MAX_RASTER_DIM) ----------

test('analyzeRingClosure: large circle (r=800) → closed=true (auto-scales cellSize)', () => {
  // r=800 → bounding box ~1600×1600; default cellSize=2 would give 800+ cells → triggers auto-scale
  const stroke = circleStroke(900, 900, 800, 256)
  const r = analyzeRingClosure([stroke], { ...baseConfig, minRadius: 200, minEnclosedAreaPx: 50000, minEnclosedAreaRatio: 0.02 })
  assert.equal(r.closed, true, `large circle should still be closed, got ${r.closed}`)
  assert.ok(r.rasterMeta.width <= 1024 + 2, `raster width should respect MAX_RASTER_DIM, got ${r.rasterMeta.width}`)
})

// ---------- computeAdaptiveGap ----------

import { computeAdaptiveGap } from '../src/draw/recognizer.js'

const GAP_MIN = 14
const GAP_MAX = 80

test('computeAdaptiveGap: ringR=200 → gap ≈ 24 (gapK=0.12)', () => {
  const gap = computeAdaptiveGap(200, [], { gapK: 0.12, gapMin: GAP_MIN, gapMax: GAP_MAX })
  assert.ok(Math.abs(gap - 24) < 0.5, `expected ≈24, got ${gap}`)
})

test('computeAdaptiveGap: ringR=50 → gap = gapMin (floor clamp)', () => {
  const gap = computeAdaptiveGap(50, [], { gapK: 0.12, gapMin: GAP_MIN, gapMax: GAP_MAX })
  assert.equal(gap, GAP_MIN)
})

test('computeAdaptiveGap: ringR=900 → gap = gapMax (ceiling clamp)', () => {
  const gap = computeAdaptiveGap(900, [], { gapK: 0.12, gapMin: GAP_MIN, gapMax: GAP_MAX })
  assert.equal(gap, GAP_MAX)
})

test('computeAdaptiveGap: ringR=null, two strokes 30px apart → gap in [gapMin, gapMax]', () => {
  // Two strokes: one at x=0, one at x=30
  const s1 = [{ x: 0, y: 0 }, { x: 5, y: 0 }]
  const s2 = [{ x: 30, y: 0 }, { x: 35, y: 0 }]
  const gap = computeAdaptiveGap(null, [s1, s2], { gapK: 0.12, gapMin: GAP_MIN, gapMax: GAP_MAX })
  assert.ok(gap >= GAP_MIN && gap <= GAP_MAX, `gap ${gap} should be in [${GAP_MIN}, ${GAP_MAX}]`)
  assert.ok(gap > 14, `median nearest-neighbour fallback should be > gapMin for 30px gap`)
})

test('computeAdaptiveGap: ringR=null, single stroke → returns gapMin', () => {
  const s1 = [{ x: 0, y: 0 }]
  const gap = computeAdaptiveGap(null, [s1], { gapK: 0.12, gapMin: GAP_MIN, gapMax: GAP_MAX })
  assert.equal(gap, GAP_MIN)
})
