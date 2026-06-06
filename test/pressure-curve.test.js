// Tests for pressureLateralShare — the canon "pressure" response curve.
// Rising Platform of Water: "one sign longer than the rest → too much pressure → water spurts sideways".
// Deadzone (floor) keeps hand-drawn wobble balanced; past knee it saturates quickly.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pressureLateralShare, computeColumnFlow } from '../src/engine/geometry.js'

const require = createRequire(import.meta.url)
const RULES = require('../data/rules.json')
const signsDoc = require('../data/signs.json')

const signArr = Array.isArray(signsDoc) ? signsDoc : signsDoc.signs
const signMap = Object.fromEntries(signArr.map((s) => [s.id, s]))
const familyOf = (t) => signMap[t]?.family

const cfg = RULES.irTuning

// ---------- Unit tests: deadzone ----------
test('pressureLateralShare(0, cfg) === 0 (below floor → no lean)', () => {
  assert.equal(pressureLateralShare(0, cfg), 0)
})

test('pressureLateralShare(0.1, cfg) === 0 (within deadzone → no lean)', () => {
  assert.equal(pressureLateralShare(0.1, cfg), 0)
})

// ---------- Unit tests: saturation ----------
test('pressureLateralShare(0.5, cfg) === 1 (above knee → fully lateral)', () => {
  assert.equal(pressureLateralShare(0.5, cfg), 1)
})

test('pressureLateralShare(0.34, cfg) === 1 (at knee → fully lateral)', () => {
  assert.equal(pressureLateralShare(0.34, cfg), 1)
})

// ---------- Unit tests: midpoint and monotonicity ----------
test('pressureLateralShare(0.23, cfg) is approximately 0.5 (midpoint of ramp)', () => {
  // midpoint of floor..knee: (0.12 + 0.34) / 2 = 0.23 → smoothstep t=0.5 → 0.5
  const val = pressureLateralShare(0.23, cfg)
  assert.ok(Math.abs(val - 0.5) < 0.1, `expected ~0.5, got ${val}`)
})

test('pressureLateralShare is monotonic on the ramp (0.2 < 0.25 < 0.3)', () => {
  const v1 = pressureLateralShare(0.2, cfg)
  const v2 = pressureLateralShare(0.25, cfg)
  const v3 = pressureLateralShare(0.3, cfg)
  assert.ok(v1 < v2, `expected pressureLateralShare(0.2) < pressureLateralShare(0.25), got ${v1} vs ${v2}`)
  assert.ok(v2 < v3, `expected pressureLateralShare(0.25) < pressureLateralShare(0.3), got ${v2} vs ${v3}`)
})

// ---------- Integration: balanced stays balanced ----------
test('Integration Beast_Warding: balanced columns → pressureLateralShare < 0.1', () => {
  const bw = require('../assets/spells/Beast_Warding.json')
  const components = bw.circles[0].components
  const flow = computeColumnFlow(components, familyOf)
  assert.ok(flow !== null, 'flow should not be null')
  const lateral = pressureLateralShare(flow.netFrac, cfg)
  assert.ok(
    lateral < 0.1,
    `Beast_Warding balanced → lateral share should be < 0.1, got ${lateral} (netFrac ${flow.netFrac})`,
  )
})

// ---------- Integration: clearly-longer column steers hard ----------
test('Integration synthetic: one column 2.5× scale → pressureLateralShare > 0.6', () => {
  // 4 cardinal INWARD columns (Φ>0), east one is 2.5× — dominant horizontal lean.
  // Inward rotation: a sign at north (0,-90) facing inward (toward south) has rotation 180;
  // east (90,0) inward → rotation 270; south (0,90) inward → rotation 0; west (-90,0) inward → rotation 90.
  const comps = [
    { type: 'column', role: 'sign', x: 0,   y: -90, rotation: 180, scale: 1,   inverted: false }, // north, inward
    { type: 'column', role: 'sign', x: 90,  y: 0,   rotation: 270, scale: 2.5, inverted: false }, // east, inward, dominant
    { type: 'column', role: 'sign', x: 0,   y: 90,  rotation: 0,   scale: 1,   inverted: false }, // south, inward
    { type: 'column', role: 'sign', x: -90, y: 0,   rotation: 90,  scale: 1,   inverted: false }, // west, inward
  ]
  const flow = computeColumnFlow(comps, familyOf)
  assert.ok(flow !== null, 'flow should not be null')
  // Verify this is inward (Φ>0) — the spell tries to exit but one side wins
  assert.equal(flow.inverted, false, 'inward columns → flow.inverted should be false (Φ>0)')
  const lateral = pressureLateralShare(flow.netFrac, cfg)
  assert.ok(
    lateral > 0.6,
    `a 2.5× column should drive lateral share > 0.6, got ${lateral} (netFrac ${flow.netFrac})`,
  )
})

// ---------- Representative curve spot-checks ----------
test('curve spot-checks for the key cases', () => {
  // These ground-truth values validate the smoothstep formula directly.
  // pressureLateralShare(0.03): below floor (0.12) → 0
  assert.equal(pressureLateralShare(0.03, cfg), 0, 'netFrac 0.03 → 0 (below floor)')
  // pressureLateralShare(0.22): in ramp → smoothstep((0.22-0.12)/(0.34-0.12)) = smoothstep(0.4545...)
  // t=0.4545, s = t²(3-2t) = 0.2066*(3-0.909) = 0.2066*2.091 ≈ 0.432
  const v022 = pressureLateralShare(0.22, cfg)
  assert.ok(v022 > 0.3 && v022 < 0.6, `netFrac 0.22 → expected ~0.43, got ${v022}`)
  // pressureLateralShare(0.4): above knee (0.34) → 1
  assert.equal(pressureLateralShare(0.4, cfg), 1, 'netFrac 0.4 → 1 (above knee)')
  // pressureLateralShare(0.57): above knee → 1
  assert.equal(pressureLateralShare(0.57, cfg), 1, 'netFrac 0.57 → 1 (above knee)')
})
