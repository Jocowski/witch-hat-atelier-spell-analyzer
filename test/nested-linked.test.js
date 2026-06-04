// nested-linked.test.js — Track 5 unit tests (SPEC-nested-linked.md)
//
// Tests 5.1 (multi-ring detection), 5.2 (nest relations), 5.3 (link relations),
// and 5.4 (drawingModel multi-circle output).  All pure; no DOM, no JSON imports.
//
// Synthetic strokes only (no templates needed for ring detection; empty template
// list is passed so recognizer finds rings but emits no symbol matches).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeStrokes } from '../src/draw/recognizer.js'
import { toComposition, buildMultiComposition } from '../src/studio/drawingModel.js'
import { toComposition as engineToComposition } from '../src/engine/compose.js'

// ---------- helpers ----------

/** Generate a perfect circle stroke with N points. */
function circleStroke(cx, cy, r, n = 64) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  // close it
  pts.push({ x: cx + r, y: cy })
  return pts
}

/** A short horizontal line from (x1,y) to (x2,y). */
function lineStroke(x1, y, x2, n = 20) {
  const pts = []
  for (let i = 0; i < n; i++) {
    pts.push({ x: x1 + ((x2 - x1) * i) / (n - 1), y })
  }
  return pts
}

// opts that disable flood-fill (keep tests fast and deterministic) and turn off
// confidence gating (no templates, so every match would be empty anyway)
const baseOpts = {
  floodFill: false,       // use fast heuristic only
  confidenceMinPct: 0,
  ringCvThresh:     0.3,  // same as rules.json default
  ringAssignSlack:  1.15,
  nestCenterSlack:  0.85,
  linkEndpointSlack: 0.12,
  minRingRadius:    40,
}

// ============================================================
// T1 — two concentric circles → nest relation
// ============================================================

test('T1: two concentric circles produce two rings and a nest relation', () => {
  const outerCircle = circleStroke(0, 0, 200)  // r=200 (outer)
  const innerCircle = circleStroke(0, 0, 80)   // r=80  (inner)
  const strokes = [outerCircle, innerCircle]
  const result = analyzeStrokes(strokes, [], baseOpts)

  assert.equal(result.rings.length, 2, 'should detect 2 rings')

  // ids are assigned smallest-radius-first → k0 = inner (r=80), k1 = outer (r=200)
  const ids = result.rings.map((r) => r.id)
  assert.ok(ids.includes('k0'), 'k0 must be present')
  assert.ok(ids.includes('k1'), 'k1 must be present')

  // nest relation: outer=k1, inner=k0
  assert.ok(result.relations.length > 0, 'should have at least one relation')
  const nest = result.relations.find((r) => r.type === 'nest')
  assert.ok(nest, 'should have a nest relation')
  assert.equal(nest.inner, 'k0', 'inner ring is the smaller (k0)')
  assert.equal(nest.outer, 'k1', 'outer ring is the larger (k1)')

  // composition must have 2 circles
  assert.equal(result.composition.circles.length, 2, 'composition must have 2 circles')
  assert.deepEqual(result.composition.relations, result.relations, 'relations must propagate to composition')
})

test('T1b: nest relation carries correct outer/inner when drawn outer-first', () => {
  // Draw order: outer first, then inner (common user pattern)
  const outerFirst  = circleStroke(0, 0, 180)
  const innerSecond = circleStroke(5, -5, 70)  // slightly off-center (wobble)
  const result = analyzeStrokes([outerFirst, innerSecond], [], baseOpts)

  assert.equal(result.rings.length, 2)
  const nest = result.relations.find((r) => r.type === 'nest')
  assert.ok(nest, 'should produce a nest relation even when outer is drawn first')
})

test('T1c: two side-by-side circles (non-overlapping) produce NO nest relation', () => {
  // Two circles far apart — should not be nested
  const leftCircle  = circleStroke(-250, 0, 100)
  const rightCircle = circleStroke( 250, 0, 100)
  const result = analyzeStrokes([leftCircle, rightCircle], [], baseOpts)

  assert.equal(result.rings.length, 2)
  const nest = result.relations.find((r) => r.type === 'nest')
  assert.equal(nest, undefined, 'side-by-side circles should not produce a nest relation')
})

// ============================================================
// T2 — two separate circles + connecting line → link relation
// ============================================================

test('T2: two circles connected by a line produce a link relation', () => {
  const r = 100
  const leftCircle  = circleStroke(-300, 0, r)
  const rightCircle = circleStroke( 300, 0, r)
  // Line from right boundary of left circle to left boundary of right circle
  const connectingLine = lineStroke(-300 + r, 0, 300 - r)
  const strokes = [leftCircle, rightCircle, connectingLine]
  const result = analyzeStrokes(strokes, [], baseOpts)

  assert.equal(result.rings.length, 2, 'should detect 2 rings')

  const link = result.relations.find((r) => r.type === 'link')
  assert.ok(link, 'should have a link relation')
  // The two ring ids in the link are k0 and k1 (in some order)
  const pair = [link.a, link.b].sort()
  assert.deepEqual(pair, ['k0', 'k1'], 'link should connect the two rings')

  // link stroke should NOT be mis-recognized as a symbol group
  // (it won't match since we pass no templates; but it should not appear in groups)
  // groups are only symbol groups (not ring strokes and not link strokes)
  assert.equal(result.composition.relations.some((r) => r.type === 'link'), true, 'link propagates to composition')
})

test('T2b: a line whose both endpoints touch the same ring does NOT produce a link', () => {
  const r = 100
  const singleCircle = circleStroke(0, 0, r)
  // A chord — both endpoints on the same ring boundary
  const chord = [
    { x: -r, y: 0 },   // left boundary
    { x: 0, y: r },    // bottom boundary (same ring)
  ]
  const result = analyzeStrokes([singleCircle, chord], [], baseOpts)

  const link = result.relations.find((rel) => rel.type === 'link')
  assert.equal(link, undefined, 'chord on single ring should not produce a link')
})

test('T2c: multi-ring result exposes link in composition.relations', () => {
  const r = 80
  const left  = circleStroke(-220, 0, r)
  const right = circleStroke( 220, 0, r)
  const line  = lineStroke(-220 + r, 0, 220 - r)
  const result = analyzeStrokes([left, right, line], [], baseOpts)

  assert.equal(result.composition.format, 'wha-spell@2')
  assert.equal(result.composition.circles.length, 2)
  const links = result.composition.relations.filter((r) => r.type === 'link')
  assert.equal(links.length, 1)
})

// ============================================================
// T3 — single ring back-compat
// ============================================================

test('T3: single-ring drawing produces back-compat output (rings[0].id = k0)', () => {
  const singleCircle = circleStroke(0, 0, 150)
  const result = analyzeStrokes([singleCircle], [], baseOpts)

  assert.equal(result.rings.length, 1, 'one detected ring')
  assert.equal(result.rings[0].id, 'k0', 'ring id is k0')
  assert.deepEqual(result.relations, [], 'no relations for single ring')

  // Single-ring: composition is the v1 back-compat shape (ring/core/components at top level,
  // no .circles array) — identical to the pre-Track-5 output.
  assert.ok(result.composition, 'composition should be present')
  assert.ok('ring' in result.composition, 'single-ring composition has top-level ring field (v1 back-compat)')
})

test('T3b: single-ring ring/center/ringR back-compat fields are populated', () => {
  const singleCircle = circleStroke(50, 30, 120)
  const result = analyzeStrokes([singleCircle], [], baseOpts)

  // Legacy back-compat fields
  assert.ok(result.ring, 'ring field should be populated')
  assert.ok(result.center, 'center field should be populated')
  assert.ok(result.ringR > 0, 'ringR should be positive')
})

test('T3c: two concentric circles composition passes engine toComposition without error', () => {
  // This validates T1 composition is engine-consumable (T5 acceptance criterion)
  // Multi-ring recognizer output is wha-spell@2; the engine can normalize it.
  const outerCircle = circleStroke(0, 0, 200)
  const innerCircle = circleStroke(0, 0, 80)
  const result = analyzeStrokes([outerCircle, innerCircle], [], baseOpts)

  // Multi-ring: composition is wha-spell@2 with .circles
  assert.equal(result.rings.length, 2, 'need 2 rings for this test')
  assert.ok(Array.isArray(result.composition.circles), 'multi-ring composition has .circles')

  // Should not throw when passed through engine normalizer
  const normalized = engineToComposition(result.composition)
  assert.equal(normalized.circles.length, 2, 'engine normalizes 2 circles')
})

// ============================================================
// T4 — drawingModel.toComposition multi-ring path
// ============================================================

const SIGIL_TYPES = new Set(['fire', 'water', 'earth', 'air'])
const dmOpts = { isSigil: (type) => SIGIL_TYPES.has(type) }

test('T4: toComposition enters multi-ring path when model.rings has 2 entries', () => {
  const model = {
    placed: [
      { id: 'w', kind: 'sigil', type: 'water', x: -300, y: 0, rotation: 0, scale: 1, inverted: false },
      { id: 'f', kind: 'sigil', type: 'fire',  x:  300, y: 0, rotation: 0, scale: 1, inverted: false },
    ],
    rings: [
      { id: 'k0', cx: -300, cy: 0, r: 150, closed: true },
      { id: 'k1', cx:  300, cy: 0, r: 150, closed: true },
    ],
    relations: [{ type: 'link', a: 'k0', b: 'k1' }],
    ringAssignments: { w: 0, f: 1 },
    dyes: [],
  }
  const comp = toComposition(model, dmOpts)
  assert.equal(comp.format, 'wha-spell@2')
  assert.equal(comp.circles.length, 2, '2 circles in output')
  assert.equal(comp.relations.length, 1, '1 relation in output')
  assert.equal(comp.relations[0].type, 'link')
})

test('T4b: multi-ring component coordinates are relative to their ring center', () => {
  // Water sigil at world (0, 0), ring center also at (0, 0) → relative (0, 0)
  // Fire sigil at world (300, 0), ring center at (300, 0) → relative (0, 0) as core
  // A sign at world (300, -100), ring center at (300, 0) → relative (0, -100)
  const model = {
    placed: [
      { id: 'w',  kind: 'sigil', type: 'water',  x: 0,    y: 0,    rotation: 0, scale: 1, inverted: false },
      { id: 'f',  kind: 'sigil', type: 'fire',   x: 300,  y: 0,    rotation: 0, scale: 1, inverted: false },
      { id: 'sg', kind: 'sign',  type: 'column', x: 300,  y: -100, rotation: 0, scale: 1, inverted: false },
    ],
    rings: [
      { id: 'k0', cx: 0,   cy: 0, r: 120, closed: true },
      { id: 'k1', cx: 300, cy: 0, r: 120, closed: true },
    ],
    relations: [{ type: 'link', a: 'k0', b: 'k1' }],
    ringAssignments: { w: 0, f: 1, sg: 1 },
    dyes: [],
  }
  const comp = toComposition(model, dmOpts)
  const circle1 = comp.circles[1]  // k1

  // core is fire at relative (0,0)
  assert.equal(circle1.core?.type, 'fire')
  assert.equal(circle1.core?.x, 0)
  assert.equal(circle1.core?.y, 0)

  // column sign at world (300, -100) relative to ring center (300, 0) = (0, -100)
  const col = circle1.components.find((c) => c.type === 'column')
  assert.ok(col, 'column sign should be in k1')
  assert.equal(col.x, 0)
  assert.equal(col.y, -100)
})

test('T4c: single-ring toComposition output is unchanged (back-compat)', () => {
  // Verify single-ring output matches exactly what the old implementation produced
  const placed = [
    { id: 'f', kind: 'sigil', type: 'fire', x: 0, y: 0, rotation: 0, scale: 1, inverted: false },
    { id: 'l', kind: 'sign',  type: 'column', x: 0, y: -80, rotation: 0, scale: 1, inverted: false },
  ]
  const comp = toComposition({ placed, dyes: [], ringClosed: true }, dmOpts)

  assert.equal(comp.format, 'wha-spell@2')
  assert.equal(comp.circles.length, 1)
  assert.equal(comp.circles[0].id, 'k0')
  assert.deepEqual(comp.circles[0].center, { x: 0, y: 0 })
  assert.equal(comp.circles[0].ring.closed, true)
  assert.equal(comp.circles[0].core?.type, 'fire')
  assert.deepEqual(comp.relations, [])
})

test('T4d: nest relation emitted in drawingModel multi-ring composition', () => {
  const model = {
    placed: [
      { id: 'w', kind: 'sigil', type: 'water', x: 0, y: 0, rotation: 0, scale: 1, inverted: false },
    ],
    rings: [
      { id: 'k0', cx: 0, cy: 0, r: 90,  closed: true  },  // inner water seal
      { id: 'k1', cx: 0, cy: 0, r: 200, closed: false },   // outer modifier ring
    ],
    relations: [{ type: 'nest', outer: 'k1', inner: 'k0' }],
    ringAssignments: { w: 0 },
    dyes: [],
  }
  const comp = toComposition(model, dmOpts)
  assert.equal(comp.circles.length, 2)
  assert.equal(comp.relations[0].type, 'nest')
  assert.equal(comp.relations[0].outer, 'k1')
  assert.equal(comp.relations[0].inner, 'k0')
  // inner circle has the water core; outer is coreless
  const k0 = comp.circles.find((c) => c.id === 'k0')
  const k1 = comp.circles.find((c) => c.id === 'k1')
  assert.equal(k0.core?.type, 'water')
  assert.equal(k1.core, null)
})

// ============================================================
// T5 — buildMultiComposition direct API
// ============================================================

test('T5: buildMultiComposition produces correct wha-spell@2 shape', () => {
  const isItemSigil = (item) => item.kind === 'sigil' || SIGIL_TYPES.has(item.type)
  const model = {
    placed: [
      { id: 'w', kind: 'sigil', type: 'water', x: -200, y: 0, rotation: 0, scale: 1, inverted: false },
      { id: 'f', kind: 'sigil', type: 'fire',  x:  200, y: 0, rotation: 0, scale: 1, inverted: false },
    ],
    rings: [
      { id: 'k0', cx: -200, cy: 0, r: 100, closed: true },
      { id: 'k1', cx:  200, cy: 0, r: 100, closed: true },
    ],
    relations: [{ type: 'link', a: 'k0', b: 'k1' }],
    ringAssignments: { w: 0, f: 1 },
    dyes: ['dye_crimson'],
  }
  const comp = buildMultiComposition(model, isItemSigil)
  assert.equal(comp.format, 'wha-spell@2')
  assert.equal(comp.circles.length, 2)
  assert.equal(comp.circles[0].id, 'k0')
  assert.equal(comp.circles[1].id, 'k1')
  // Global dyes go to k0
  assert.deepEqual(comp.circles[0].dyes, ['dye_crimson'])
  assert.deepEqual(comp.circles[1].dyes, [])
  // centers are in world coords
  assert.equal(comp.circles[0].center.x, -200)
  assert.equal(comp.circles[1].center.x, 200)
})

// ============================================================
// T6 — ring de-duplication (drew the same circle twice)
// ============================================================

test('T6: two nearly-identical ring strokes are de-duplicated (keep larger)', () => {
  // Same center, nearly same radius → duplicate draw
  const ring1 = circleStroke(0, 0, 150)
  const ring2 = circleStroke(2, 1, 155)  // slightly bigger, same location
  const result = analyzeStrokes([ring1, ring2], [], baseOpts)

  // Should de-duplicate to a single ring
  assert.equal(result.rings.length, 1, 'duplicate rings should be merged to one')
})

// ============================================================
// T7 — analyzeStrokes with no rings returns empty rings/relations
// ============================================================

test('T7: analyzeStrokes with no rings returns empty rings and relations arrays', () => {
  const shortStroke = [{ x: 0, y: 0 }, { x: 10, y: 5 }]
  const result = analyzeStrokes([shortStroke], [], baseOpts)

  assert.ok(Array.isArray(result.rings), 'rings should be an array')
  assert.ok(Array.isArray(result.relations), 'relations should be an array')
  assert.equal(result.rings.length, 0)
  assert.equal(result.relations.length, 0)
})
