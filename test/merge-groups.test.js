import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeGroups, makeCloud, strokesToTemplate } from '../src/draw/recognizer.js'

// Two halves of one drawn symbol that the segmenter over-split into separate groups.
const left  = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 }]
const right = [{ x: 20, y: 0 }, { x: 20, y: 10 }, { x: 20, y: 20 }]
const group = (stroke, role = 'sign') => ({ strokes: [stroke], pts: stroke.slice(), role, ringIndex: 0, angle: 12, match: { name: 'x', dist: 5, rotation: 0 } })

test('mergeGroups returns null for fewer than 2 groups', () => {
  assert.equal(mergeGroups([group(left)], []), null)
  assert.equal(mergeGroups([], []), null)
})

test('mergeGroups concatenates strokes and recomputes the centroid', () => {
  const merged = mergeGroups([group(left), group(right)], [])
  assert.equal(merged.strokes.length, 2)
  assert.equal(merged.pts.length, 6)
  assert.equal(merged.cx, 10) // midpoint of x=0 and x=20 columns
  assert.equal(merged.cy, 10)
})

test('mergeGroups keeps role core when any input was a core', () => {
  assert.equal(mergeGroups([group(left, 'sign'), group(right, 'core')], []).role, 'core')
  assert.equal(mergeGroups([group(left, 'sign'), group(right, 'sign')], []).role, 'sign')
})

test('mergeGroups with no clouds preserves the first available match', () => {
  const merged = mergeGroups([group(left), group(right)], [])
  assert.equal(merged.match.name, 'x')
})

test('mergeGroups re-recognizes against supplied clouds', () => {
  // Build a cloud from the COMBINED shape so the merged group should match it.
  const tmpl = strokesToTemplate([left, right], 'combo', 'sign')
  const clouds = [makeCloud('combo', tmpl.points)]
  const merged = mergeGroups([group(left), group(right)], clouds, { rotationSteps: 8 })
  assert.equal(merged.match.name, 'combo')
  assert.ok(merged.confidence >= 0 && merged.confidence <= 100)
})
