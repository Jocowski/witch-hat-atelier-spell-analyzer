// Tests for the orb-container IR fields added in SPEC-orb-container §L4.
// Verifies that Water-Orb-like compositions emit contained/containRadius/fillRate/capacity
// and that non-orb spells are completely unaffected (regression).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { assembleSpellIR } from '../src/engine/ir.js'
import { toCartesian, inwardRotation, computeOrientationAim, CANVAS_RADIUS } from '../src/engine/geometry.js'

const require = createRequire(import.meta.url)
const RULES = require('../data/rules.json')
const grammarData = require('../data/grammar.json')

const cfg = RULES.irTuning

// ---------- helpers ----------
// Build a minimal facts object (mirrors the pattern in ir.test.js).
function makeFacts({
  valid = true,
  symmetry = 'radial',
  power = 1.0,
  signCount = 6,
  signComps = [],
  types = new Set(),
  aim = { aimed: false, angle: 0, magnitude: 0, vx: 0, vy: 0, wsum: 0 },
  circle = { radius: CANVAS_RADIUS, core: { scale: 1 }, dyes: [], components: [] },
  familyOf = () => null,
  grammarOps = grammarData.operators,
} = {}) {
  return { valid, analysis: { symmetry, power, signCount, linkCount: 0, tilted: false },
    circle, signComps, types, aim, familyOf, grammarOps }
}

// Place a sign at a radial position (angle in deg, r in 0..1) facing inward.
function mkSign(type, angle, r = 0.6, scale = 1) {
  const { x, y } = toCartesian(angle, r)
  return { id: `${type}@${angle}`, type, role: 'sign', x, y,
           rotation: inwardRotation(x, y), scale, zone: 'inside' }
}

// familyOf for a Water Orb: orb = non-directional; column = directional.
const waterOrbFamilyOf = (t) => {
  if (t === 'orb') return 'non-directional'
  if (t === 'column') return 'directional'
  return null
}

// Water Orb composition: 4 orbs equally around + 2 opposing inward columns (east/west).
// Mirrors the catalog spell: orb×4 around + column×2 sides.
const waterOrbSigns = [
  mkSign('orb', 0),    // north
  mkSign('orb', 90),   // east
  mkSign('orb', 180),  // south
  mkSign('orb', 270),  // west
  mkSign('column', 90, 0.6),  // east, faces west (inward) via inwardRotation
  mkSign('column', 270, 0.6), // west, faces east (inward) via inwardRotation
]

// ---------- Water Orb: container fields present ----------
test('Water Orb (4 orbs + 2 opposing columns) => contained:true', () => {
  const facts = makeFacts({ signComps: waterOrbSigns, signCount: 6, familyOf: waterOrbFamilyOf })
  const ir = assembleSpellIR(facts, cfg)
  assert.equal(ir.contained, true, `contained should be true, got ${ir.contained}`)
})

test('Water Orb => gravity < 0.2 (sphere floats)', () => {
  const facts = makeFacts({ signComps: waterOrbSigns, signCount: 6, familyOf: waterOrbFamilyOf })
  const ir = assembleSpellIR(facts, cfg)
  assert.ok(ir.gravity < 0.2, `gravity should be < 0.2 for a floating orb, got ${ir.gravity}`)
})

test('Water Orb => containRadius in (0, 1]', () => {
  const facts = makeFacts({ signComps: waterOrbSigns, signCount: 6, familyOf: waterOrbFamilyOf })
  const ir = assembleSpellIR(facts, cfg)
  assert.ok(ir.containRadius > 0 && ir.containRadius <= 1,
    `containRadius should be in (0,1], got ${ir.containRadius}`)
})

test('Water Orb => fillRate > 0 (columns pump substance upward)', () => {
  const facts = makeFacts({ signComps: waterOrbSigns, signCount: 6, familyOf: waterOrbFamilyOf })
  const ir = assembleSpellIR(facts, cfg)
  assert.ok(ir.fillRate > 0, `fillRate should be > 0, got ${ir.fillRate}`)
})

test('Water Orb => capacity > 0', () => {
  const facts = makeFacts({ signComps: waterOrbSigns, signCount: 6, familyOf: waterOrbFamilyOf })
  const ir = assembleSpellIR(facts, cfg)
  assert.ok(ir.capacity > 0, `capacity should be > 0, got ${ir.capacity}`)
})

test('Water Orb => direction.z >= containerMinZ (substance rises into vessel, not lateral jet)', () => {
  const facts = makeFacts({ signComps: waterOrbSigns, signCount: 6, familyOf: waterOrbFamilyOf })
  const ir = assembleSpellIR(facts, cfg)
  const minZ = cfg.containerMinZ ?? 0.3
  assert.ok(ir.direction.z >= minZ,
    `direction.z should be >= ${minZ} (upward into vessel), got ${ir.direction.z}`)
})

test('Water Orb => direction has the same keys as a non-container spell', () => {
  const orbFacts = makeFacts({ signComps: waterOrbSigns, signCount: 6, familyOf: waterOrbFamilyOf })
  const plainFacts = makeFacts()
  const orbIR = assembleSpellIR(orbFacts, cfg)
  const plainIR = assembleSpellIR(plainFacts, cfg)
  const orbKeys = new Set(Object.keys(orbIR.direction))
  const plainKeys = new Set(Object.keys(plainIR.direction))
  for (const k of plainKeys) {
    assert.ok(orbKeys.has(k), `direction key "${k}" missing from container IR`)
  }
})

// ---------- Non-orb spell: regression — no container fields, gravity/direction unchanged ----------
test('non-orb spell (column only) => contained falsy', () => {
  // A simple spell with only column signs; no orb.
  const columnFacts = makeFacts({
    signComps: [mkSign('column', 0), mkSign('column', 180)],
    signCount: 2,
    familyOf: () => 'directional',
  })
  const ir = assembleSpellIR(columnFacts, cfg)
  assert.ok(!ir.contained, `contained should be falsy for a non-orb spell, got ${ir.contained}`)
})

test('non-orb spell => no containRadius, fillRate, or capacity fields', () => {
  const columnFacts = makeFacts({
    signComps: [mkSign('column', 0)],
    signCount: 1,
    familyOf: () => 'directional',
  })
  const ir = assembleSpellIR(columnFacts, cfg)
  assert.equal(ir.containRadius, undefined, `containRadius should be absent for non-orb spell`)
  assert.equal(ir.fillRate, undefined, `fillRate should be absent for non-orb spell`)
  assert.equal(ir.capacity, undefined, `capacity should be absent for non-orb spell`)
})

test('non-orb spell => gravity matches the standard levitation formula (not forced to 0.15)', () => {
  // A spell with no signs at all: gravity should be the base value (no levitation → gravity = 1).
  const baseFacts = makeFacts({ signComps: [], signCount: 0 })
  const ir = assembleSpellIR(baseFacts, cfg)
  assert.equal(ir.gravity, 1, `base gravity (no signs) should be 1, got ${ir.gravity}`)
})

test('non-orb spell with columns => direction.x or direction.y can be > 0 (lateral jet allowed)', () => {
  // East-aimed spell: direction should NOT be suppressed (no orb present).
  const { x: x1, y: y1 } = toCartesian(90, 0.6)
  const { x: x2, y: y2 } = toCartesian(270, 0.6)
  // Both region signs face east (rotation: 90).
  const eastSigns = [
    { id: 'r1', type: 'direction', role: 'sign', x: x1, y: y1, rotation: 90, scale: 1, zone: 'inside' },
    { id: 'r2', type: 'direction', role: 'sign', x: x2, y: y2, rotation: 90, scale: 1, zone: 'inside' },
  ]
  const aim = computeOrientationAim(eastSigns, () => 'directional')
  const facts = makeFacts({
    signComps: eastSigns,
    signCount: 2,
    aim,
    familyOf: () => 'directional',
  })
  const ir = assembleSpellIR(facts, cfg)
  // No orb → direction should have meaningful x component (east aim not suppressed)
  assert.ok(ir.direction.x > 0, `lateral direction.x should be > 0 for east-aimed non-orb spell, got ${ir.direction.x}`)
})
