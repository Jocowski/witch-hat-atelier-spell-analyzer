import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toPolar, toCartesian, computeSymmetry, computeDirectionalBias, computeSpin, inwardRotation, classifyRegion, computeRegionCoverage, computeOrientationAim, computeSignVectors, computeColumnFlow, directedAxisFacing, classifyZone, anchorToXY, xyToAnchor, CANVAS_RADIUS } from '../src/engine/geometry.js'

const directional = () => 'directional'

// ---------- directedAxisFacing (Phase 1: facing from drawn geometry) ----------

test('directedAxisFacing: a "|-" column (crossbar left, stem right) points EAST (~90°)', () => {
  const pts = [
    // crossbar: a vertical bar on the LEFT (the wide tail)
    { x: -10, y: -12 }, { x: -10, y: -6 }, { x: -10, y: 0 }, { x: -10, y: 6 }, { x: -10, y: 12 },
    // stem: a horizontal line running RIGHT (the narrow head)
    { x: -10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 },
  ]
  const f = directedAxisFacing(pts, { x: 0, y: 0 })
  assert.ok(f > 70 && f < 110, `expected ~east (90°), got ${f}`)
})

test('directedAxisFacing: returns null for too few points', () => {
  assert.equal(directedAxisFacing([{ x: 0, y: 0 }]), null)
})

// ---------- computeColumnFlow (Phase 2: einlair radial/upward flow) ----------

test('computeColumnFlow: a single inward column → all flow exits radially, no upward', () => {
  // Column on the LEFT facing east (inward, toward centre).
  const comps = [{ role: 'sign', type: 'column', x: -100, y: 0, rotation: 90, scale: 1 }]
  const flow = computeColumnFlow(comps, directional)
  assert.ok(Math.abs(flow.netFrac - 1) < 1e-9, `netFrac ${flow.netFrac}`)
  assert.ok(flow.upFrac < 1e-9, `upFrac ${flow.upFrac}`)
  assert.ok(Math.abs(flow.netAngle - 90) < 1e-6, `netAngle ${flow.netAngle}`) // east
  assert.equal(flow.inverted, false)
})

test('computeColumnFlow: two equal opposing inward columns (the "T") → all flow goes UP', () => {
  const comps = [
    { role: 'sign', type: 'column', x: -100, y: 0, rotation: 90, scale: 1 },  // faces east (inward)
    { role: 'sign', type: 'column', x: 100, y: 0, rotation: 270, scale: 1 },  // faces west (inward)
  ]
  const flow = computeColumnFlow(comps, directional)
  assert.ok(flow.netFrac < 1e-9, `netFrac ${flow.netFrac}`)   // radial cancels
  assert.ok(Math.abs(flow.upFrac - 1) < 1e-9, `upFrac ${flow.upFrac}`) // all upward
  assert.equal(flow.inverted, false)
})

test('computeColumnFlow: outward-facing columns are inverted (Φ<0) → radial spread, no upward', () => {
  const comps = [
    { role: 'sign', type: 'column', x: -100, y: 0, rotation: 270, scale: 1 }, // faces west (outward)
    { role: 'sign', type: 'column', x: 100, y: 0, rotation: 90, scale: 1 },   // faces east (outward)
  ]
  const flow = computeColumnFlow(comps, directional)
  assert.equal(flow.inverted, true)
  assert.ok(flow.upFrac < 1e-9, `upFrac ${flow.upFrac}`)
})

test('computeSignVectors: per-sign facing+force and the net resultant', () => {
  const components = [
    { role: 'sigil', type: 'water', x: 0, y: 0 },                    // ignored (not a sign)
    { role: 'sign', type: 'column', x: 0, y: -100, rotation: 0, scale: 1 },   // faces north
    { role: 'sign', type: 'column', x: 60, y: 0, rotation: 90, scale: 2 },    // faces east, 2× force
    { role: 'sign', type: 'fixate', x: -60, y: 0, scale: 1.5 },               // non-directional → no facing
  ]
  const familyOf = (t) => (t === 'fixate' ? 'non-directional' : 'directional')
  const { signs, net } = computeSignVectors(components, familyOf)
  assert.equal(signs.length, 3, 'only signs, not the sigil')
  assert.equal(signs[0].angle, 0)            // north-facing
  assert.equal(signs[0].magnitude, 1)
  assert.equal(signs[1].angle, 90)           // east-facing
  assert.equal(signs[1].magnitude, 2)        // force = scale
  assert.equal(signs[2].angle, null)         // non-directional → force only, no steer
  assert.equal(signs[2].magnitude, 1.5)
  // Net leans east (the 2× east sign outweighs the 1× north sign).
  assert.ok(net.aimed)
  assert.ok(net.angle > 45 && net.angle < 90, `expected east-of-north, got ${net.angle}`)
})

test('computeOrientationAim: equal opposing signs cancel (the Column "T" balance)', () => {
  // One sign faces north (0°), an equal-size one faces south (180°) → net push cancels.
  const signs = [
    { role: 'sign', type: 'column', rotation: 0, scale: 1 },
    { role: 'sign', type: 'column', rotation: 180, scale: 1 },
  ]
  const aim = computeOrientationAim(signs, directional)
  assert.ok(aim.magnitude < 1e-9, `expected ~0 magnitude, got ${aim.magnitude}`)
  assert.equal(aim.aimed, false)
})

test('computeOrientationAim: the larger sign wins the tug-of-war (magnitude weighting)', () => {
  // A bigger Column pointing south (180°) overpowers a small one pointing north → spell goes south.
  const signs = [
    { role: 'sign', type: 'column', rotation: 180, scale: 3 },
    { role: 'sign', type: 'column', rotation: 0, scale: 1 },
  ]
  const aim = computeOrientationAim(signs, directional)
  assert.ok(aim.aimed, 'unequal sizes should produce a net aim')
  assert.ok(Math.abs(aim.angle - 180) < 1e-6, `expected south (180°), got ${aim.angle}`)
  assert.ok(aim.magnitude > 0.34, `expected magnitude past threshold, got ${aim.magnitude}`)
})

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
