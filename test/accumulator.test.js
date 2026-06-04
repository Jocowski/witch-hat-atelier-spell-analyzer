// Tests for compose.js buildAccumulator — magnitude accumulator (SPEC-magnitude-and-variants.md §3.2).
// Exercises ring-size, sigil-size, and dye modifier passes.
// Uses createRequire to load JSON so compose.js stays pure-module compliant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { buildAccumulator, analyzeCircleWith } from '../src/engine/compose.js'
import { CANVAS_RADIUS } from '../src/engine/geometry.js'

const require = createRequire(import.meta.url)
const RULES = require('../data/rules.json')
const dyesDoc = require('../data/dyes.json')
const grammarData = require('../data/grammar.json')
const sigilsDoc = require('../data/sigils.json')
const signsDoc = require('../data/signs.json')

const magnitudeCfg = RULES.magnitude
const dyeMap = Object.fromEntries(dyesDoc.dyes.map((d) => [d.id, d]))

// ---------- Ring-size pass (Layer 3a) ----------

test('ring size = CANVAS_RADIUS and core scale = 1 => multiplier = 1 (neutral)', () => {
  const circle = { radius: CANVAS_RADIUS, core: { scale: 1 }, dyes: [], components: [] }
  const acc = buildAccumulator(circle, 1.0, dyeMap, magnitudeCfg)
  // ring mult = 260/260 = 1, sigil mult = 1 → power = 1 * 1 * 1 = 1
  assert.ok(Math.abs(acc.power - 1.0) < 0.001, `expected power ~1.0, got ${acc.power}`)
})

test('ring radius = 2×CANVAS_RADIUS => power doubled (capped at maxMultiplier)', () => {
  const circle = { radius: CANVAS_RADIUS * 2, core: { scale: 1 }, dyes: [], components: [] }
  const basePower = 1.0
  const acc = buildAccumulator(circle, basePower, dyeMap, magnitudeCfg)
  const ringMult = Math.min(2.0, magnitudeCfg.ringSize.maxMultiplier)
  assert.ok(Math.abs(acc.power - basePower * ringMult) < 0.001, `expected ~${basePower * ringMult}, got ${acc.power}`)
})

test('null ring radius => no ring multiplier applied (power unchanged by ring pass)', () => {
  const circle = { radius: null, core: { scale: 1 }, dyes: [], components: [] }
  const acc = buildAccumulator(circle, 1.5, dyeMap, magnitudeCfg)
  // No ring mult (null radius), sigil scale = 1 → power = 1.5
  assert.ok(Math.abs(acc.power - 1.5) < 0.001, `expected 1.5, got ${acc.power}`)
})

// ---------- Sigil-size pass (Layer 3b) ----------

test('core sigil scale = 2 => power doubled by sigil pass', () => {
  const circle = { radius: null, core: { scale: 2 }, dyes: [], components: [] }
  const acc = buildAccumulator(circle, 1.0, dyeMap, magnitudeCfg)
  assert.ok(Math.abs(acc.power - 2.0) < 0.001, `expected 2.0, got ${acc.power}`)
})

test('no core => defaults to scale 1 (no sigil multiplier)', () => {
  const circle = { radius: null, core: null, dyes: [], components: [] }
  const acc = buildAccumulator(circle, 1.0, dyeMap, magnitudeCfg)
  assert.ok(Math.abs(acc.power - 1.0) < 0.001, `expected 1.0, got ${acc.power}`)
})

// ---------- Dye pass (3.1) ----------

test('dyes: blood (kind=power) => power multiplied by powerMultiplier (4×)', () => {
  const circle = { radius: null, core: { scale: 1 }, dyes: ['blood'], components: [] }
  const acc = buildAccumulator(circle, 1.0, dyeMap, magnitudeCfg)
  const expectedMult = dyeMap.blood.modifier.powerMultiplier
  assert.ok(Math.abs(acc.power - expectedMult) < 0.001, `expected ${expectedMult}, got ${acc.power}`)
})

test('dyes: azuremoon_flower (kind=duration) => duration multiplied by durationMultiplier (2×)', () => {
  const circle = { radius: null, core: { scale: 1 }, dyes: ['azuremoon_flower'], components: [] }
  const acc = buildAccumulator(circle, 1.0, dyeMap, magnitudeCfg)
  const expectedMult = dyeMap.azuremoon_flower.modifier.durationMultiplier
  assert.ok(Math.abs(acc.duration - expectedMult) < 0.001, `expected duration ${expectedMult}, got ${acc.duration}`)
  assert.ok(Math.abs(acc.power - 1.0) < 0.001, 'power should be unchanged')
})

test('dyes: blushing_bride_scales (kind=visibility) => params.sealVisible = false', () => {
  const circle = { radius: null, core: { scale: 1 }, dyes: ['blushing_bride_scales'], components: [] }
  const acc = buildAccumulator(circle, 1.0, dyeMap, magnitudeCfg)
  assert.equal(acc.params.sealVisible, false)
})

test('dyes: golden_blaze_wyrm_scales (kind=glow) => params.glowsInDark = true', () => {
  const circle = { radius: null, core: { scale: 1 }, dyes: ['golden_blaze_wyrm_scales'], components: [] }
  const acc = buildAccumulator(circle, 1.0, dyeMap, magnitudeCfg)
  assert.equal(acc.params.glowsInDark, true)
})

test('dyes: roaming_scallop_shells (kind=durability) => params.waterproof = true', () => {
  const circle = { radius: null, core: { scale: 1 }, dyes: ['roaming_scallop_shells'], components: [] }
  const acc = buildAccumulator(circle, 1.0, dyeMap, magnitudeCfg)
  assert.equal(acc.params.waterproof, true)
})

test('dyes: blood + azuremoon_flower => power ×4 AND duration ×2 (stack correctly)', () => {
  const circle = { radius: null, core: { scale: 1 }, dyes: ['blood', 'azuremoon_flower'], components: [] }
  const acc = buildAccumulator(circle, 1.0, dyeMap, magnitudeCfg)
  const expectedPower = dyeMap.blood.modifier.powerMultiplier
  const expectedDuration = dyeMap.azuremoon_flower.modifier.durationMultiplier
  assert.ok(Math.abs(acc.power - expectedPower) < 0.001, `power should be ${expectedPower}, got ${acc.power}`)
  assert.ok(Math.abs(acc.duration - expectedDuration) < 0.001, `duration should be ${expectedDuration}, got ${acc.duration}`)
})

test('dyes: no dyes => power and duration unchanged, params empty', () => {
  const circle = { radius: null, core: { scale: 1 }, dyes: [], components: [] }
  const acc = buildAccumulator(circle, 1.0, dyeMap, magnitudeCfg)
  assert.ok(Math.abs(acc.power - 1.0) < 0.001)
  assert.ok(Math.abs(acc.duration - 1.0) < 0.001)
  assert.equal(Object.keys(acc.params).length, 0)
})

// ---------- analyzeCircleWith integration: accumulator is present in the return ----------

test('analyzeCircleWith: accumulator is present and blood dye scales up power vs no-dye', () => {
  const sigilMap = Object.fromEntries(sigilsDoc.sigils.map((s) => [s.id, s]))
  const signMap = Object.fromEntries(signsDoc.signs.map((s) => [s.id, s]))
  const deps = { grammar: grammarData, sigilMap, signMap, dyeMap, zones: RULES.zones, magnitudeCfg }
  // A spell with one sign so computePower > 0, allowing blood to meaningfully multiply it.
  const mkComp = () => ({
    id: 'k0', name: '', center: { x: 0, y: 0 }, radius: CANVAS_RADIUS,
    ring: { closed: true },
    core: { id: 'c0', type: 'water', x: 0, y: 0, scale: 1 },
    components: [{ id: 's0', type: 'column', role: 'sign', x: 0, y: -150, rotation: 0, scale: 1 }],
    linkCount: 0,
  })
  const withBlood = analyzeCircleWith(deps, { ...mkComp(), dyes: ['blood'] })
  const noBlood   = analyzeCircleWith(deps, { ...mkComp(), dyes: [] })
  assert.ok(withBlood.accumulator, 'accumulator should be present')
  assert.ok(noBlood.accumulator, 'accumulator should be present (no-dye)')
  const bloodMult = dyeMap.blood.modifier.powerMultiplier
  assert.ok(withBlood.accumulator.power > noBlood.accumulator.power,
    `blood (${withBlood.accumulator.power}) should exceed no-dye (${noBlood.accumulator.power})`)
  assert.ok(
    Math.abs(withBlood.accumulator.power / noBlood.accumulator.power - bloodMult) < 0.001,
    `ratio should be ${bloodMult}, got ${withBlood.accumulator.power / noBlood.accumulator.power}`,
  )
})
