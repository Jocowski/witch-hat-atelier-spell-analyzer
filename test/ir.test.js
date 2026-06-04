// Tests for src/engine/ir.js — pure SpellIR assembly + 3D direction tilt.
// Uses createRequire to load JSON (same pattern as deduce.test.js) so the module stays pure.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { assembleSpellIR, directionFromSurfaceVector } from '../src/engine/ir.js'
import { toCartesian, computeOrientationAim, inwardRotation, magnitudeOf, clamp, CANVAS_RADIUS } from '../src/engine/geometry.js'

const require = createRequire(import.meta.url)
const RULES = require('../data/rules.json')
const grammarData = require('../data/grammar.json')

const cfg = RULES.irTuning

// ---------- helpers ----------
// Build a minimal facts object for a valid spell.
function makeFacts({
  valid = true,
  symmetry = 'radial',
  power = 1.0,
  signCount = 4,
  signComps = [],
  types = new Set(),
  aim = { aimed: false, angle: 0, magnitude: 0, vx: 0, vy: 0, wsum: 0 },
  circle = { radius: CANVAS_RADIUS, core: { scale: 1 }, dyes: [], components: [] },
  familyOf = () => null,
  grammarOps = grammarData.operators,
} = {}) {
  return {
    valid,
    analysis: { symmetry, power, signCount, linkCount: 0, tilted: false },
    circle,
    signComps,
    types,
    aim,
    familyOf,
    grammarOps,
  }
}

// ---------- Invalid spell ----------
test('invalid spell => all zeros (gravity=1, neutral direction)', () => {
  const facts = makeFacts({ valid: false })
  const ir = assembleSpellIR(facts, cfg)
  assert.equal(ir.force, 0)
  assert.equal(ir.spread, 0)
  assert.equal(ir.focus, 0)
  assert.equal(ir.range, 0)
  assert.equal(ir.duration, 0)
  assert.equal(ir.stability, 0)
  assert.equal(ir.gravity, 1)
  assert.equal(ir.dirCoherence, 0)
  assert.deepEqual(ir.direction, { x: 0, y: 0, z: 1, xTiltDeg: 0, yTiltDeg: 0, tiltFromZDeg: 0 })
})

// ---------- Valid spell — shape assertions ----------
test('valid spell produces numeric fields in expected ranges', () => {
  const facts = makeFacts()
  const ir = assembleSpellIR(facts, cfg)
  assert.ok(ir.force >= 0 && ir.force <= 1, `force ${ir.force} out of range`)
  assert.ok(ir.spread >= 0 && ir.spread <= 1, `spread ${ir.spread} out of range`)
  assert.ok(ir.focus >= 0 && ir.focus <= 1, `focus ${ir.focus} out of range`)
  assert.ok(ir.range >= 0 && ir.range <= 1, `range ${ir.range} out of range`)
  assert.ok(ir.duration >= cfg.durationMinSec, `duration ${ir.duration} below min`)
  assert.ok(ir.duration <= cfg.durationMaxSec, `duration ${ir.duration} above max`)
  assert.ok(ir.stability >= 0 && ir.stability <= 1, `stability ${ir.stability} out of range`)
  assert.ok(ir.gravity >= 0 && ir.gravity <= 1, `gravity ${ir.gravity} out of range`)
  assert.ok(ir.dirCoherence >= 0 && ir.dirCoherence <= 1, `dirCoherence ${ir.dirCoherence} out of range`)
})

// ---------- Symmetry → stability mapping ----------
test('radial symmetry => stability 1.0', () => {
  const ir = assembleSpellIR(makeFacts({ symmetry: 'radial' }), cfg)
  assert.equal(ir.stability, 1.0)
})

test('bilateral symmetry => stability 0.7', () => {
  const ir = assembleSpellIR(makeFacts({ symmetry: 'bilateral' }), cfg)
  assert.equal(ir.stability, 0.7)
})

test('asymmetric => stability 0.3', () => {
  const ir = assembleSpellIR(makeFacts({ symmetry: 'asymmetric' }), cfg)
  assert.equal(ir.stability, 0.3)
})

test('no-signs symmetry (none) => stability 0.5 (neutral)', () => {
  const ir = assembleSpellIR(makeFacts({ symmetry: 'none' }), cfg)
  assert.equal(ir.stability, 0.5)
})

// ---------- Duration in configured window ----------
test('radial symmetry => duration in [durationMinSec, durationMaxSec]', () => {
  const ir = assembleSpellIR(makeFacts({ symmetry: 'radial', power: 1.0 }), cfg)
  assert.ok(ir.duration >= cfg.durationMinSec && ir.duration <= cfg.durationMaxSec)
})

test('asymmetric => duration lower than bilateral, bilateral lower than radial', () => {
  const asym  = assembleSpellIR(makeFacts({ symmetry: 'asymmetric' }), cfg)
  const bilat = assembleSpellIR(makeFacts({ symmetry: 'bilateral' }), cfg)
  const radial = assembleSpellIR(makeFacts({ symmetry: 'radial' }), cfg)
  assert.ok(asym.duration <= bilat.duration, `asymmetric (${asym.duration}) should be <= bilateral (${bilat.duration})`)
  assert.ok(bilat.duration <= radial.duration, `bilateral (${bilat.duration}) should be <= radial (${radial.duration})`)
})

// ---------- Convergence sign → focus bonus ----------
test('convergence sign present => focus bonus applied', () => {
  const withConv = assembleSpellIR(makeFacts({ types: new Set(['convergence']) }), cfg)
  const noConv   = assembleSpellIR(makeFacts({ types: new Set() }), cfg)
  assert.ok(withConv.focus > noConv.focus, `focus with convergence (${withConv.focus}) should exceed without (${noConv.focus})`)
})

// ---------- Levitation → gravity drops ----------
const mkLevSign = (angle, scale = 1) => {
  const { x, y } = toCartesian(angle, 0.6)
  return { id: `lev${angle}`, type: 'levitation', role: 'sign', x, y,
           rotation: inwardRotation(x, y), scale, zone: 'inside' }
}

test('levitation sign present => gravity < 1', () => {
  const facts = makeFacts({
    signComps: [mkLevSign(0)],
    familyOf: (t) => t === 'levitation' ? 'directional' : null,
  })
  const ir = assembleSpellIR(facts, cfg)
  assert.ok(ir.gravity < 1, `gravity should be < 1, got ${ir.gravity}`)
})

test('more levitation signs => gravity lower', () => {
  const single = assembleSpellIR(makeFacts({
    signComps: [mkLevSign(0)],
    familyOf: (t) => t === 'levitation' ? 'directional' : null,
  }), cfg)
  const multi = assembleSpellIR(makeFacts({
    signComps: [mkLevSign(0), mkLevSign(90), mkLevSign(180), mkLevSign(270)],
    familyOf: (t) => t === 'levitation' ? 'directional' : null,
  }), cfg)
  assert.ok(multi.gravity < single.gravity, `multi (${multi.gravity}) should be lower than single (${single.gravity})`)
})

// ---------- Force clamp ----------
test('force clamp: adding many signs keeps force <= 1', () => {
  const signComps = [0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => {
    const { x, y } = toCartesian(a, 0.6)
    return { id: `s${i}`, type: 'column', role: 'sign', x, y, scale: 2, zone: 'inside' }
  })
  const facts = makeFacts({ signComps, signCount: 8, power: 3.0 })
  const ir = assembleSpellIR(facts, cfg)
  assert.ok(ir.force <= 1, `force should be clamped to <= 1, got ${ir.force}`)
})

// ---------- Larger ring → higher range ----------
test('larger ring radius => higher range than same spell in smaller ring', () => {
  const smallR = assembleSpellIR(makeFacts({ circle: { radius: CANVAS_RADIUS * 0.5, core: { scale: 1 }, dyes: [], components: [] } }), cfg)
  const largeR = assembleSpellIR(makeFacts({ circle: { radius: CANVAS_RADIUS * 1.5, core: { scale: 1 }, dyes: [], components: [] } }), cfg)
  assert.ok(largeR.range > smallR.range, `larger ring (${largeR.range}) should have higher range than smaller (${smallR.range})`)
})

// ---------- directionFromSurfaceVector ----------
test('directionFromSurfaceVector: zero surface vector => z=1, tiltFromZDeg=0', () => {
  const d = directionFromSurfaceVector({ x: 0, y: 0 }, 0.8, cfg)
  assert.equal(d.z, 1)
  assert.equal(d.tiltFromZDeg, 0)
  assert.equal(d.x, 0)
  assert.equal(d.y, 0)
})

test('directionFromSurfaceVector: east vector, force=0.5 => tiltFromZDeg ≈ 0.5×76=38', () => {
  const d = directionFromSurfaceVector({ x: 1, y: 0 }, 0.5, cfg)
  assert.ok(d.x > 0, `x should be > 0, got ${d.x}`)
  assert.ok(Math.abs(d.y) < 0.001, `y should be ~0, got ${d.y}`)
  const expectedTilt = 0.5 * (cfg.forceTiltMaxDeg ?? 76)
  assert.ok(Math.abs(d.tiltFromZDeg - expectedTilt) < 1, `tiltFromZDeg ${d.tiltFromZDeg} should be ~${expectedTilt}`)
})

test('directionFromSurfaceVector: force=1.0 => tiltFromZDeg ≈ forceTiltMaxDeg', () => {
  const d = directionFromSurfaceVector({ x: 1, y: 0 }, 1.0, cfg)
  const maxTilt = cfg.forceTiltMaxDeg ?? 76
  assert.ok(Math.abs(d.tiltFromZDeg - maxTilt) < 1, `expected ~${maxTilt}°, got ${d.tiltFromZDeg}`)
})

test('directionFromSurfaceVector: output vector is normalized (hypot ≈ 1)', () => {
  const d = directionFromSurfaceVector({ x: 1, y: 0 }, 0.7, cfg)
  const len = Math.hypot(d.x, d.y, d.z)
  assert.ok(Math.abs(len - 1) < 1e-6, `vector length should be 1, got ${len}`)
})

test('directionFromSurfaceVector: northeast vector tilts in both x and y', () => {
  const d = directionFromSurfaceVector({ x: 0.707, y: 0.707 }, 0.6, cfg)
  assert.ok(d.x > 0, `x should be > 0`)
  assert.ok(d.y > 0, `y should be > 0`)
  assert.ok(d.z > 0, `z should be > 0`)
})

// ---------- magnitudeOf cross-agent contract ----------
test('magnitudeOf: falls back to scale when no metrics', () => {
  const c = { type: 'column', role: 'sign', x: 0, y: -100, scale: 1.5 }
  assert.equal(magnitudeOf(c), 1.5)
})

test('magnitudeOf: prefers metrics.directionalMagnitude over scale', () => {
  const c = { type: 'column', role: 'sign', x: 0, y: -100, scale: 1.5, metrics: { directionalMagnitude: 1.8 } }
  assert.equal(magnitudeOf(c), 1.8)
})

test('magnitudeOf: falls back to 1 when neither scale nor metrics present', () => {
  const c = { type: 'column', role: 'sign', x: 0, y: -100 }
  assert.equal(magnitudeOf(c), 1)
})

// ---------- Column "T" variant test (SPEC acceptance) ----------
// Two opposing Column signs; one with metrics.directionalMagnitude = 1.8, one with scale = 1.
// Net aim should tilt toward the 1.8 sign (per SPEC-magnitude-and-variants.md P2a).
test('Column T: opposing columns, one with metrics 1.8 vs scale 1 => aim toward the larger', () => {
  const colNorth = { id: 'c1', type: 'column', role: 'sign',
    x: 0, y: -100, rotation: 0, scale: 1, metrics: { directionalMagnitude: 1.8 } }
  // Column facing north (0°): rotation 0 => facing north.
  // Column facing south (180°): sits at south, rotation 0 but inverted facing.
  // To oppose: second column at south pointing south (rotation 180 to face south).
  const colSouth = { id: 'c2', type: 'column', role: 'sign',
    x: 0, y: 100, rotation: 180, scale: 1 }
  const familyOf = () => 'directional'
  const aim = computeOrientationAim([colNorth, colSouth], familyOf)
  // colNorth faces 0° (north), w=1.8; colSouth faces 180° (south), w=1.
  // vx = sin(0)*1.8 + sin(π)*1 = 0; vy = -cos(0)*1.8 + -cos(π)*1 = -1.8 + 1 = -0.8
  // Net aim points north (vy < 0 = north direction). magnitude > 0.
  assert.ok(aim.magnitude > 0, `magnitude should be > 0 (larger sign wins), got ${aim.magnitude}`)
  // North is angle 0° (or 360°)
  assert.ok(aim.angle < 20 || aim.angle > 340, `aim should point north (~0°), got ${aim.angle}`)
})

// ---------- computeOrientationAim back-compat: equal opposing signs cancel ----------
test('computeOrientationAim: two equal opposing columns cancel (magnitude ≈ 0)', () => {
  const col1 = { id: 'c1', type: 'column', role: 'sign', x: 0, y: -100, rotation: 0, scale: 1 }
  const col2 = { id: 'c2', type: 'column', role: 'sign', x: 0, y: 100, rotation: 180, scale: 1 }
  const familyOf = () => 'directional'
  const aim = computeOrientationAim([col1, col2], familyOf)
  assert.ok(aim.magnitude < 0.01, `magnitude should be ~0, got ${aim.magnitude}`)
})

// ---------- SpellIR: directed spell (east-facing regions) ----------
test('directed spell (east region signs) => direction.x > 0 and tilt away from z', () => {
  // Simulate a water spell with two east-facing direction signs.
  const { x: x1, y: y1 } = toCartesian(90, 0.6) // east position
  const { x: x2, y: y2 } = toCartesian(270, 0.6) // west position (opposing but facing east)
  const region1 = { id: 'r1', type: 'direction', role: 'sign', x: x1, y: y1, rotation: 90, scale: 1, zone: 'inside' }
  const region2 = { id: 'r2', type: 'direction', role: 'sign', x: x2, y: y2, rotation: 90, scale: 1, zone: 'inside' }
  const familyOf = () => 'directional'
  const aim = computeOrientationAim([region1, region2], familyOf)
  assert.ok(aim.magnitude > 0.5, `east-facing aim should have magnitude > 0.5, got ${aim.magnitude}`)
  assert.ok(aim.angle > 70 && aim.angle < 110, `aim should point east (~90°), got ${aim.angle}`)

  const signComps = [region1, region2]
  const facts = makeFacts({
    signComps, signCount: 2, symmetry: 'bilateral',
    aim,
    types: new Set(['direction']),
    familyOf,
  })
  const ir = assembleSpellIR(facts, cfg)
  assert.ok(ir.direction.x > 0, `direction.x should be > 0 for east-aimed spell, got ${ir.direction.x}`)
  assert.ok(ir.direction.z < 1, `direction.z should be < 1 (tilted away from normal), got ${ir.direction.z}`)
  assert.ok(ir.dirCoherence > 0.5, `coherence should be > 0.5 for aligned east signs, got ${ir.dirCoherence}`)
  assert.ok(ir.spread < 0.5, `spread should be low for coherent beam, got ${ir.spread}`)
})

// ---------- clamp helper ----------
test('clamp: values inside range pass through', () => {
  assert.equal(clamp(0.5), 0.5)
  assert.equal(clamp(0.5, 0, 1), 0.5)
})

test('clamp: values below lo return lo', () => {
  assert.equal(clamp(-0.1), 0)
  assert.equal(clamp(-5, 2, 10), 2)
})

test('clamp: values above hi return hi', () => {
  assert.equal(clamp(1.5), 1)
  assert.equal(clamp(20, 0, 10), 10)
})
