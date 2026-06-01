import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toPolar, toCartesian, computeSymmetry, computeDirectionalBias, computeSpin, inwardRotation, classifyRegion, computeRegionCoverage, classifyZone, anchorToXY, xyToAnchor, CANVAS_RADIUS } from '../src/engine/geometry.js'

const directional = () => 'directional'

test('anchorToXY: a ring anchor sits on the rim at the given angle', () => {
  const { x, y } = anchorToXY(90, 0, 100) // due east on a radius-100 ring
  assert.ok(Math.abs(x - 100) < 1e-6)
  assert.ok(Math.abs(y - 0) < 1e-6)
})

test('anchorToXY/xyToAnchor: round-trip, and offset tracks ring resize', () => {
  const a = xyToAnchor(70, -70, 100) // NE, ~99px out → offset ≈ -1
  const p1 = anchorToXY(a.angle, a.offset, 100)
  assert.ok(Math.abs(p1.x - 70) < 1e-6 && Math.abs(p1.y - -70) < 1e-6)
  // Same anchor on a bigger ring moves outward (offset preserved, radius grows).
  const p2 = anchorToXY(a.angle, a.offset, 200)
  assert.ok(Math.hypot(p2.x, p2.y) > Math.hypot(p1.x, p1.y))
})

test('classifyZone: inside / ring band / outside relative to radius', () => {
  const R = 100
  assert.equal(classifyZone(0, -50, R), 'inside') // 0.5R
  assert.equal(classifyZone(0, -90, R), 'ring') // 0.9R within 0.85..1.05
  assert.equal(classifyZone(0, -130, R), 'outside') // 1.3R
})

test('classifyZone: missing position or radius defaults to inside', () => {
  assert.equal(classifyZone(null, null, 100), 'inside')
  assert.equal(classifyZone(undefined, undefined, 100), 'inside')
})

test('toPolar: norte = 0°', () => {
  const { angle } = toPolar(0, -100)
  assert.ok(Math.abs(angle - 0) < 0.001 || Math.abs(angle - 360) < 0.001)
})

test('toPolar: leste = 90°', () => {
  const { angle } = toPolar(100, 0)
  assert.ok(Math.abs(angle - 90) < 0.001)
})

test('toPolar/toCartesian: ida e volta', () => {
  const { x, y } = toCartesian(135, 0.5)
  const { angle, radius } = toPolar(x, y)
  assert.ok(Math.abs(angle - 135) < 0.001)
  assert.ok(Math.abs(radius - 0.5) < 0.001)
})

test('computeSymmetry: 4 signs radiais', () => {
  const comps = [0, 90, 180, 270].map((a, i) => {
    const { x, y } = toCartesian(a, 0.6)
    return { id: 'c' + i, role: 'sign', x, y, scale: 1 }
  })
  assert.equal(computeSymmetry(comps), 'radial')
})

test('computeSymmetry: 1 sign = assimétrico', () => {
  const { x, y } = toCartesian(0, 0.6)
  assert.equal(computeSymmetry([{ id: 'a', role: 'sign', x, y }]), 'asymmetric')
})

test('computeDirectionalBias: radial = equilibrado', () => {
  const comps = [0, 90, 180, 270].map((a, i) => {
    const { x, y } = toCartesian(a, 0.6)
    return { id: 'c' + i, role: 'sign', x, y, scale: 1 }
  })
  assert.equal(computeDirectionalBias(comps).biased, false)
})

test('computeDirectionalBias: signs só num lado = desviado', () => {
  const comps = [0, 20, 340].map((a, i) => {
    const { x, y } = toCartesian(a, 0.6)
    return { id: 'c' + i, role: 'sign', x, y, scale: 1 }
  })
  const bias = computeDirectionalBias(comps)
  assert.equal(bias.biased, true)
})

// A ring of inward-facing directional signs (the Pyreball case) is ORIENTED, not spinning.
test('computeSpin: inward-facing ring does not spin', () => {
  const comps = [0, 90, 180, 270].map((a, i) => {
    const { x, y } = toCartesian(a, 0.5)
    return { id: 'c' + i, type: 'levitation', role: 'sign', x, y, rotation: inwardRotation(x, y) }
  })
  const spin = computeSpin(comps, directional)
  assert.equal(spin.spinning, false)
  assert.ok(spin.cant < 1, `cant should be ~0, got ${spin.cant}`)
})

// Canting every sign 90° off its radial axis (tangential) DOES spin the spell.
test('computeSpin: tangentially canted ring spins', () => {
  const comps = [0, 90, 180, 270].map((a, i) => {
    const { x, y } = toCartesian(a, 0.5)
    return { id: 'c' + i, type: 'levitation', role: 'sign', x, y, rotation: (inwardRotation(x, y) + 90) % 360 }
  })
  const spin = computeSpin(comps, directional)
  assert.equal(spin.spinning, true)
  assert.ok(spin.cant > 80, `cant should be ~90, got ${spin.cant}`)
})

// Non-directional signs have no front — their rotation never counts as spin.
test('computeSpin: non-directional rotation is ignored', () => {
  const comps = [{ id: 'f', type: 'float', role: 'sign', x: 0, y: -100, rotation: 73 }]
  const spin = computeSpin(comps, () => 'non-directional')
  assert.equal(spin.spinning, false)
})

// --- classifyRegion: positional coverage (Rising Wave) ---

// helper: an inward-facing region sign at position angle `a`.
const inwardRegion = (a, i, scale = 1) => {
  const { x, y } = toCartesian(a, 0.6)
  return { id: 'r' + i, type: 'direction', role: 'sign', x, y, rotation: inwardRotation(x, y), scale }
}

// A FULL, evenly-spaced ring of inward regions is positionally balanced ⇒ contained.
test('classifyRegion: balanced inward ring => contained (regression)', () => {
  const comps = [0, 90, 180, 270].map((a, i) => inwardRegion(a, i))
  const cover = computeRegionCoverage(comps, directional)
  assert.ok(cover.magnitude < 0.34, `balanced ring magnitude should be ~0, got ${cover.magnitude}`)
  assert.equal(classifyRegion(comps, directional).mode, 'inward')
})

// Inward regions covering only the TOP half (Rising Wave) ⇒ biased surge toward the cluster (up).
test('classifyRegion: one-sided inward regions => biased toward the cluster', () => {
  const comps = [315, 345, 15, 45].map((a, i) => inwardRegion(a, i)) // all in the top arc
  const cover = computeRegionCoverage(comps, directional)
  assert.ok(cover.magnitude > 0.34, `clustered magnitude should be large, got ${cover.magnitude}`)
  const region = classifyRegion(comps, directional)
  assert.equal(region.mode, 'biased')
  // centroid of a top arc points up (~0/360°)
  assert.ok(region.angle < 20 || region.angle > 340, `expected ~up, got ${region.angle}`)
})

// Off-vertical cluster ⇒ the bias follows where the regions sit (the diagonal case).
test('classifyRegion: tilted cluster => biased toward that diagonal', () => {
  const comps = [30, 60, 90, 120].map((a, i) => inwardRegion(a, i)) // upper-right arc
  const region = classifyRegion(comps, directional)
  assert.equal(region.mode, 'biased')
  assert.ok(region.angle > 45 && region.angle < 105, `expected upper-right, got ${region.angle}`)
})
