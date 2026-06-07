import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isClosedStroke, pointInPolygon, polygonArea, findFillTarget } from '../src/features/studio/tools/fill.js'

// A 100×100 square (closed: last point == first).
const square = [
  { x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }, { x: -50, y: -50 },
]
// The same square with a real gap (open: last point far from first).
const openSquare = [
  { x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 },
]

// ---------- isClosedStroke ----------

test('isClosedStroke: a square whose ends meet is closed', () => {
  assert.equal(isClosedStroke(square), true)
})

test('isClosedStroke: a stroke with a large end gap is open', () => {
  // ends are 100px apart → way over the tolerance → open
  assert.equal(isClosedStroke(openSquare), false)
})

test('isClosedStroke: a small gap (within tolerance) still counts as closed', () => {
  const nearlyClosed = [
    { x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }, { x: -45, y: -50 },
  ]
  assert.equal(isClosedStroke(nearlyClosed), true)
})

test('isClosedStroke: fewer than 3 points is never closed', () => {
  assert.equal(isClosedStroke([{ x: 0, y: 0 }, { x: 1, y: 1 }]), false)
})

// ---------- pointInPolygon ----------

test('pointInPolygon: centre of the square is inside', () => {
  assert.equal(pointInPolygon({ x: 0, y: 0 }, square), true)
})

test('pointInPolygon: a point outside the square is outside', () => {
  assert.equal(pointInPolygon({ x: 200, y: 0 }, square), false)
})

// ---------- polygonArea ----------

test('polygonArea: 100×100 square has area 10000', () => {
  assert.equal(polygonArea(square), 10000)
})

// ---------- findFillTarget ----------

test('findFillTarget: returns the closed stroke under the click', () => {
  const nodes = [{ id: 'a', kind: 'stroke', points: square }]
  const hit = findFillTarget(nodes, { x: 0, y: 0 })
  assert.equal(hit?.id, 'a')
})

test('findFillTarget: an OPEN shape is never filled', () => {
  const nodes = [{ id: 'a', kind: 'stroke', points: openSquare }]
  assert.equal(findFillTarget(nodes, { x: 0, y: 0 }), null)
})

test('findFillTarget: a click outside every shape returns null', () => {
  const nodes = [{ id: 'a', kind: 'stroke', points: square }]
  assert.equal(findFillTarget(nodes, { x: 500, y: 500 }), null)
})

test('findFillTarget: nested shapes — the innermost (smallest) enclosing shape wins', () => {
  const inner = [
    { x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }, { x: -10, y: -10 },
  ]
  const nodes = [
    { id: 'outer', kind: 'stroke', points: square },
    { id: 'inner', kind: 'stroke', points: inner },
  ]
  const hit = findFillTarget(nodes, { x: 0, y: 0 })
  assert.equal(hit?.id, 'inner')
})
