import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toPolar, toCartesian, computeSymmetry, computeDirectionalBias, computeSpin, inwardRotation, CANVAS_RADIUS } from '../src/engine/geometry.js'

const directional = () => 'directional'

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
