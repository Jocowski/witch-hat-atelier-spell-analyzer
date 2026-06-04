import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translate, scale, bboxCenter, maxHalfExtent, recenterAndFit } from '../src/draw/svgPath.js'

// A 20×20 square with its top-left at (10, 10) → bbox center (20, 20), half-extent (after centering) 10.
const SQUARE = 'M10 10 L30 10 L30 30 L10 30 Z'

test('bboxCenter finds the centroid of the bounding box', () => {
  const { cx, cy } = bboxCenter(SQUARE)
  assert.equal(cx, 20)
  assert.equal(cy, 20)
})

test('translate shifts every coordinate pair', () => {
  const d = translate(SQUARE, 20, 20) // subtract the bbox center → recentered on origin
  assert.equal(bboxCenter(d).cx, 0)
  assert.equal(bboxCenter(d).cy, 0)
})

test('scale multiplies coordinates uniformly', () => {
  const d = scale('M2 4 L6 8', 2)
  assert.equal(d, 'M4.00 8.00 L12.00 16.00')
})

test('recenterAndFit centers on origin and does not upscale a small mark', () => {
  const d = recenterAndFit(SQUARE) // half-extent 10 ≤ 42 → centered, not scaled
  assert.equal(bboxCenter(d).cx, 0)
  assert.equal(bboxCenter(d).cy, 0)
  assert.ok(Math.abs(maxHalfExtent(d) - 10) < 1e-6)
})

test('recenterAndFit shrinks an oversized mark to within ±42', () => {
  // A 200×200 square → half-extent 100 after centering → must scale down to 42.
  const big = 'M0 0 L200 0 L200 200 L0 200 Z'
  const d = recenterAndFit(big)
  assert.ok(maxHalfExtent(d) <= 42 + 1e-6, `half-extent ${maxHalfExtent(d)} should be ≤ 42`)
  assert.ok(maxHalfExtent(d) > 41, 'should fit snugly to ~42')
})
