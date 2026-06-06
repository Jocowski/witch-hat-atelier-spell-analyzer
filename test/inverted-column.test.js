// Tests for the inverted-column radialSpread IR block — SPEC-inverted-column.md §L2 + §L3.
// Uses createRequire to load JSON (same pattern as ir.test.js) so the module stays pure.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { assembleSpellIR } from '../src/engine/ir.js'
import { CANVAS_RADIUS, computeColumnFlow } from '../src/engine/geometry.js'

const require = createRequire(import.meta.url)
const RULES = require('../data/rules.json')
const grammarData = require('../data/grammar.json')

// ---------- L3 setup: sign family lookup from signs.json ----------
const signsDoc = require('../data/signs.json')
const signArr = Array.isArray(signsDoc) ? signsDoc : signsDoc.signs
const signMap = Object.fromEntries(signArr.map((s) => [s.id, s]))
const familyOf = (t) => signMap[t]?.family

const cfg = RULES.irTuning

// ---------- helper ----------
// Minimal valid facts object; also accepts a `flow` field (null by default) passed through directly.
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
  flow = null,
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
    flow,
  }
}

// ---------- Case 1: balanced inverted ----------
// Two balanced outward columns → radialSpread emitted, biasStrength === 0, direction.z === 0, swirl === 0.
test('balanced inverted flow => radialSpread block present, biasStrength 0, z 0, swirl 0', () => {
  const flow = {
    inverted: true,
    T: 2,
    R: 0,
    netAngle: 0,
    netFrac: 0,
    parts: [{ b: 0 }, { b: 0 }],
  }
  const ir = assembleSpellIR(makeFacts({ flow }), cfg)
  assert.ok(ir.radialSpread !== undefined, 'radialSpread should be present for inverted flow')
  assert.equal(ir.radialSpread.biasStrength, 0, 'biasStrength should be 0 for balanced inverted')
  assert.equal(ir.direction.z, 0, 'direction.z should be 0 (in-plane spread)')
  assert.equal(ir.radialSpread.swirl, 0, 'swirl should be 0 when no tangential component')
})

// ---------- Case 2: unbalanced inverted ----------
// One dominant side → biasStrength and biasAngle reflect the asymmetry.
// With netFrac=0.5 >= columnSaturateKnee (0.34), pressureLateralShare saturates to 1.
test('unbalanced inverted flow => biasStrength 1 and biasAngle 90', () => {
  const flow = {
    inverted: true,
    T: 3,
    R: 1.5,
    netAngle: 90,
    netFrac: 0.5,
    parts: [{ b: 0 }],
  }
  const ir = assembleSpellIR(makeFacts({ flow }), cfg)
  assert.ok(ir.radialSpread !== undefined, 'radialSpread should be present')
  assert.equal(ir.radialSpread.biasStrength, 1, 'biasStrength should be 1 (netFrac 0.5 >= knee 0.34 → saturated)')
  assert.equal(ir.radialSpread.biasAngle, 90, 'biasAngle should equal netAngle (90)')
})

// ---------- Case 3: tangential / swirl ----------
// Columns swept sideways → |swirl| > 0 (specifically === 1 when Σb/T = 1).
test('tangential inverted flow => swirl === 1', () => {
  const flow = {
    inverted: true,
    T: 2,
    R: 0.5,
    netAngle: 0,
    netFrac: 0.25,
    parts: [{ b: 1 }, { b: 1 }],
  }
  const ir = assembleSpellIR(makeFacts({ flow }), cfg)
  assert.ok(ir.radialSpread !== undefined, 'radialSpread should be present')
  assert.ok(Math.abs(ir.radialSpread.swirl) > 0, `swirl should be > 0, got ${ir.radialSpread.swirl}`)
  assert.equal(ir.radialSpread.swirl, 1, 'swirl should be clamped to 1 when Σb/T = 1')
})

// ---------- Case 4: non-inverted (inward) ----------
// Normal inward column flow → no radialSpread block.
test('non-inverted (inward) flow => radialSpread absent', () => {
  const flow = {
    inverted: false,
    T: 2,
    R: 0,
    netAngle: 0,
    netFrac: 0,
    parts: [],
  }
  const ir = assembleSpellIR(makeFacts({ flow }), cfg)
  assert.equal(ir.radialSpread, undefined, 'radialSpread should not be present for inward flow')
})

// ---------- Case 5: null flow (no columns) ----------
// Existing spells with no column signs → flow is null → radialSpread absent (no regression).
test('null flow (no column signs) => radialSpread absent', () => {
  const ir = assembleSpellIR(makeFacts({ flow: null }), cfg)
  assert.equal(ir.radialSpread, undefined, 'radialSpread should be absent when flow is null')
})

// ============================================================
// §L3 — Engine tests: canon oracle + extrapolation
// All four cases drive the PURE pipeline end-to-end:
//   computeColumnFlow(components, familyOf) → flow
//   assembleSpellIR(makeFacts({ flow, valid:true }), cfg) → ir
// No analyze() call; JSON loaded via createRequire only.
// ============================================================

// Helper: synthetic inverted column at a given position/rotation/scale.
const mkCol = (x, y, rotation, scale = 1) => ({
  type: 'column',
  role: 'sign',
  x,
  y,
  rotation,
  scale,
  inverted: true,
})

// ---------- L3 Case 1: Beast_Warding (real asset) ----------
// 4 balanced inverted columns → radialSpread present, biasStrength near 0, direction.z === 0.
test('L3 Beast_Warding: real asset → inverted flow, balanced radialSpread, z=0', () => {
  const bw = require('../assets/spells/Beast_Warding.json')
  const components = bw.circles[0].components
  const flow = computeColumnFlow(components, familyOf)
  assert.ok(flow !== null, 'flow should not be null (columns are present)')
  assert.equal(flow.inverted, true, 'Beast_Warding should have inverted (outward) flow')
  assert.ok(
    flow.netFrac < 0.1,
    `Beast_Warding netFrac should be < 0.1 (balanced), got ${flow.netFrac}`,
  )
  const ir = assembleSpellIR(makeFacts({ flow, valid: true }), cfg)
  assert.ok(ir.radialSpread !== undefined, 'radialSpread should be present for inverted flow')
  assert.ok(
    ir.radialSpread.biasStrength < 0.1,
    `biasStrength should be < 0.1 (balanced), got ${ir.radialSpread.biasStrength}`,
  )
  assert.equal(ir.direction.z, 0, 'direction.z should be 0 (in-plane spread, no upward jet)')
})

// ---------- L3 Case 2: Crystal_Shard (real asset) ----------
// 4 cardinal inverted columns → inverted flow, netFrac near 0, radialSpread present.
test('L3 Crystal_Shard: real asset → inverted flow, near-zero bias, z=0', () => {
  const cs = require('../assets/spells/Crystal_Shard.json')
  const components = cs.circles[0].components
  const flow = computeColumnFlow(components, familyOf)
  assert.ok(flow !== null, 'flow should not be null (columns are present)')
  assert.equal(flow.inverted, true, 'Crystal_Shard should have inverted (outward) flow')
  assert.ok(
    flow.netFrac < 0.05,
    `Crystal_Shard netFrac should be < 0.05 (near-zero), got ${flow.netFrac}`,
  )
  const ir = assembleSpellIR(makeFacts({ flow, valid: true }), cfg)
  assert.ok(ir.radialSpread !== undefined, 'radialSpread should be present for inverted flow')
  assert.ok(
    ir.radialSpread.biasStrength < 0.05,
    `biasStrength should be < 0.05 (near-zero), got ${ir.radialSpread.biasStrength}`,
  )
  assert.equal(ir.direction.z, 0, 'direction.z should be 0 (in-plane spread, no upward jet)')
})

// ---------- L3 Case 3: Synthetic balanced — 4 cardinal outward inverted columns ----------
// All scale=1, symmetric → flow.inverted, netFrac≈0, radialSpread.biasStrength≈0.
test('L3 synthetic balanced: 4 cardinal inverted columns → biasStrength near 0', () => {
  const comps = [
    mkCol(0, -90, 180),   // north position, facing outward (rotation 180 + inverted → facing 0 = north outward)
    mkCol(90, 0, 270),    // east position
    mkCol(0, 90, 0),      // south position
    mkCol(-90, 0, 90),    // west position
  ]
  const flow = computeColumnFlow(comps, familyOf)
  assert.ok(flow !== null, 'flow should not be null')
  assert.equal(flow.inverted, true, 'synthetic balanced should have inverted flow')
  assert.ok(
    flow.netFrac < 0.01,
    `netFrac should be < 0.01 (perfectly balanced), got ${flow.netFrac}`,
  )
  const ir = assembleSpellIR(makeFacts({ flow, valid: true }), cfg)
  assert.ok(ir.radialSpread !== undefined, 'radialSpread should be present')
  assert.ok(
    ir.radialSpread.biasStrength < 0.01,
    `biasStrength should be < 0.01 (balanced), got ${ir.radialSpread.biasStrength}`,
  )
})

// ---------- L3 Case 4: Synthetic unbalanced — north column oversized (scale 2.5) ----------
// Dominant north column → flow.inverted, netFrac>0.2, biasAngle near 0° (north).
test('L3 synthetic unbalanced: oversized north column → biasStrength > 0.2, biasAngle near north', () => {
  const comps = [
    mkCol(0, -90, 180, 2.5), // north position, scale 2.5 (dominant)
    mkCol(90, 0, 270),
    mkCol(0, 90, 0),
    mkCol(-90, 0, 90),
  ]
  const flow = computeColumnFlow(comps, familyOf)
  assert.ok(flow !== null, 'flow should not be null')
  assert.equal(flow.inverted, true, 'unbalanced synthetic should still have inverted flow')
  assert.ok(
    flow.netFrac > 0.2,
    `netFrac should be > 0.2 (unbalanced), got ${flow.netFrac}`,
  )
  const ir = assembleSpellIR(makeFacts({ flow, valid: true }), cfg)
  assert.ok(ir.radialSpread !== undefined, 'radialSpread should be present')
  assert.ok(
    ir.radialSpread.biasStrength > 0.2,
    `biasStrength should be > 0.2 (unbalanced), got ${ir.radialSpread.biasStrength}`,
  )
  // biasAngle should be near north (0°): angular distance from 0 must be < 15°.
  const biasAngle = ir.radialSpread.biasAngle
  const angDist = Math.min(biasAngle, 360 - biasAngle)
  assert.ok(
    angDist < 15,
    `biasAngle should be near north (0°), got ${biasAngle}° (angular distance from 0: ${angDist}°)`,
  )
})
