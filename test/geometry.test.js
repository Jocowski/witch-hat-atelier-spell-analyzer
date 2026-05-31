import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toPolar, toCartesian, computeSymmetry, computeDirectionalBias, CANVAS_RADIUS } from '../src/engine/geometry.js'

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
