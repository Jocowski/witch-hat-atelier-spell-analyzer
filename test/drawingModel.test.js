import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toComposition, recognizedToPlaced } from '../src/studio/drawingModel.js'

// Fake isSigil: treat 'fire', 'water', 'earth' as sigils; everything else as a sign.
const SIGIL_TYPES = new Set(['fire', 'water', 'earth', 'air', 'time'])
const opts = { isSigil: (type) => SIGIL_TYPES.has(type) }

// ---------- basic shape / format ----------

test('toComposition: returns wha-spell@2 format', () => {
  const comp = toComposition({ strokes: [], placed: [], dyes: [] }, opts)
  assert.equal(comp.format, 'wha-spell@2')
  assert.ok(Array.isArray(comp.circles))
  assert.equal(comp.circles.length, 1)
  assert.ok(Array.isArray(comp.relations))
  assert.equal(comp.relations.length, 0)
})

test('toComposition: circle id is k0', () => {
  const comp = toComposition({ strokes: [], placed: [], dyes: [] }, opts)
  assert.equal(comp.circles[0].id, 'k0')
})

test('toComposition: center is always {x:0,y:0}', () => {
  const comp = toComposition({ strokes: [], placed: [], dyes: [] }, opts)
  assert.deepEqual(comp.circles[0].center, { x: 0, y: 0 })
})

test('toComposition: name defaults to empty string when absent', () => {
  const comp = toComposition({ strokes: [], placed: [], dyes: [] }, opts)
  assert.equal(comp.name, '')
})

test('toComposition: name is forwarded from model', () => {
  const comp = toComposition({ name: 'Pyreball', strokes: [], placed: [], dyes: [] }, opts)
  assert.equal(comp.name, 'Pyreball')
})

// ---------- core selection ----------

test('toComposition: sigil nearest origin becomes core', () => {
  const placed = [
    { id: 's1', kind: 'sigil', type: 'fire',  x: 10, y: 0,   rotation: 0, scale: 1, inverted: false },
    { id: 's2', kind: 'sigil', type: 'water', x: 50, y: 0,   rotation: 0, scale: 1, inverted: false },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, opts)
  const circle = comp.circles[0]
  // fire (x=10) is closer to origin than water (x=50)
  assert.equal(circle.core?.type, 'fire')
})

test('toComposition: core is placed at x:0 y:0', () => {
  const placed = [
    { id: 's1', kind: 'sigil', type: 'fire', x: 40, y: 30, rotation: 0, scale: 1, inverted: false },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, opts)
  const core = comp.circles[0].core
  assert.equal(core.x, 0)
  assert.equal(core.y, 0)
})

test('toComposition: core carries rotation, scale, inverted from the placed item', () => {
  const placed = [
    { id: 's1', kind: 'sigil', type: 'fire', x: 5, y: 0, rotation: 45, scale: 1.5, inverted: true },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, opts)
  const core = comp.circles[0].core
  assert.equal(core.rotation, 45)
  assert.equal(core.scale, 1.5)
  assert.equal(core.inverted, true)
})

test('toComposition: core is null when no sigils are placed', () => {
  const placed = [
    { id: 'sg1', kind: 'sign', type: 'levitation', x: 50, y: 0, rotation: 0, scale: 1, inverted: false },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, opts)
  assert.equal(comp.circles[0].core, null)
})

// ---------- isSigil injection ----------

test('toComposition: isSigil predicate classifies types correctly', () => {
  // Using the injected isSigil, 'fire' is a sigil even when kind is not set
  const placed = [
    { id: 'f', kind: 'sigil', type: 'fire',      x: 0, y: 0, rotation: 0, scale: 1, inverted: false },
    { id: 'l', kind: 'sign',  type: 'levitation', x: 80, y: 0, rotation: 0, scale: 1, inverted: false },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, opts)
  const circle = comp.circles[0]
  assert.equal(circle.core?.type, 'fire')
  const signComp = circle.components.find((c) => c.type === 'levitation')
  assert.ok(signComp, 'levitation should be a component')
  assert.equal(signComp.role, 'sign')
})

test('toComposition: isSigil predicate overrides kind field', () => {
  // kind:'sign' but isSigil says it IS a sigil → treated as sigil
  const customOpts = { isSigil: (type) => type === 'vision_sigil' }
  const placed = [
    { id: 'v', kind: 'sign', type: 'vision_sigil', x: 0, y: 0, rotation: 0, scale: 1, inverted: false },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, customOpts)
  assert.equal(comp.circles[0].core?.type, 'vision_sigil')
})

// ---------- component roles ----------

test('toComposition: non-core sigils become components with role sigil', () => {
  const placed = [
    { id: 's1', kind: 'sigil', type: 'fire',  x: 5,  y: 0, rotation: 0, scale: 1, inverted: false },
    { id: 's2', kind: 'sigil', type: 'water', x: 80, y: 0, rotation: 0, scale: 1, inverted: false },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, opts)
  const circle = comp.circles[0]
  assert.equal(circle.core?.type, 'fire')
  const waterComp = circle.components.find((c) => c.type === 'water')
  assert.ok(waterComp, 'water should be a component')
  assert.equal(waterComp.role, 'sigil')
})

test('toComposition: signs become components with role sign', () => {
  const placed = [
    { id: 'f', kind: 'sigil', type: 'fire',      x: 0, y: 0, rotation: 0, scale: 1, inverted: false },
    { id: 'l', kind: 'sign',  type: 'levitation', x: 80, y: 0, rotation: 0, scale: 1, inverted: false },
    { id: 'c', kind: 'sign',  type: 'column',     x: 0, y: 80, rotation: 0, scale: 1, inverted: false },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, opts)
  const circle = comp.circles[0]
  const signComps = circle.components.filter((c) => c.role === 'sign')
  assert.equal(signComps.length, 2)
  const types = signComps.map((c) => c.type).sort()
  assert.deepEqual(types, ['column', 'levitation'])
})

test('toComposition: component x,y,rotation,scale,inverted are preserved', () => {
  const placed = [
    { id: 'f', kind: 'sigil', type: 'fire',      x: 0,  y: 0,  rotation: 0,  scale: 1,   inverted: false },
    { id: 'l', kind: 'sign',  type: 'levitation', x: 70, y: 30, rotation: 90, scale: 1.2, inverted: true  },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, opts)
  const lev = comp.circles[0].components.find((c) => c.type === 'levitation')
  assert.equal(lev.x, 70)
  assert.equal(lev.y, 30)
  assert.equal(lev.rotation, 90)
  assert.equal(lev.scale, 1.2)
  assert.equal(lev.inverted, true)
})

// ---------- dyes ----------

test('toComposition: dyes are forwarded to the circle', () => {
  const comp = toComposition({
    strokes: [], placed: [], dyes: ['dye_crimson', 'dye_azure'],
  }, opts)
  assert.deepEqual(comp.circles[0].dyes, ['dye_crimson', 'dye_azure'])
})

test('toComposition: empty dyes array is preserved', () => {
  const comp = toComposition({ strokes: [], placed: [], dyes: [] }, opts)
  assert.deepEqual(comp.circles[0].dyes, [])
})

// ---------- radius derivation ----------

test('toComposition: radius defaults to 170 when no placed symbols exist', () => {
  const comp = toComposition({ strokes: [], placed: [], dyes: [] }, opts)
  assert.equal(comp.circles[0].radius, 170)
})

test('toComposition: radius is derived from the farthest placed symbol (padded)', () => {
  const placed = [
    { id: 'f',  kind: 'sigil', type: 'fire',      x: 0,  y: 0,  rotation: 0, scale: 1, inverted: false },
    { id: 'l1', kind: 'sign',  type: 'levitation', x: 80, y: 0,  rotation: 0, scale: 1, inverted: false },
    { id: 'l2', kind: 'sign',  type: 'column',     x: 0,  y: 100, rotation: 0, scale: 1, inverted: false },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, opts)
  // farthest = 100 (y=100), padded 1.25x → 125
  assert.equal(comp.circles[0].radius, 125)
})

test('toComposition: radius is at least the default when all symbols are at origin', () => {
  // symbols at (0,0) have distance 0; fallback to DEFAULT_RADIUS
  const placed = [
    { id: 'f', kind: 'sigil', type: 'fire', x: 0, y: 0, rotation: 0, scale: 1, inverted: false },
  ]
  const comp = toComposition({ strokes: [], placed, dyes: [] }, opts)
  assert.equal(comp.circles[0].radius, 170) // farthest=0 → DEFAULT_RADIUS
})

// ---------- ring ----------

test('toComposition: ring.closed is false by default', () => {
  const comp = toComposition({ strokes: [], placed: [], dyes: [] }, opts)
  assert.equal(comp.circles[0].ring.closed, false)
})

test('toComposition: ring.closed is true when ringStroke is present', () => {
  const comp = toComposition({
    strokes: [], placed: [], dyes: [],
    ringStroke: { points: [{ x: 0, y: 0 }] }, // truthy
  }, opts)
  assert.equal(comp.circles[0].ring.closed, true)
})

test('toComposition: ring.closed is true when ringClosed flag is set', () => {
  const comp = toComposition({
    strokes: [], placed: [], dyes: [], ringClosed: true,
  }, opts)
  assert.equal(comp.circles[0].ring.closed, true)
})

// ---------- multi-sigil + full composition ----------

test('toComposition: full Pyreball-like model produces correct composition', () => {
  // Fire sigil at center + 4 levitation signs around it
  const placed = [
    { id: 'fire', kind: 'sigil', type: 'fire', x: 0, y: 0, rotation: 0, scale: 1, inverted: false },
    { id: 'l0',   kind: 'sign',  type: 'levitation', x:  80, y:   0, rotation:  90, scale: 1, inverted: false },
    { id: 'l1',   kind: 'sign',  type: 'levitation', x: -80, y:   0, rotation: 270, scale: 1, inverted: false },
    { id: 'l2',   kind: 'sign',  type: 'levitation', x:   0, y:  80, rotation: 180, scale: 1, inverted: false },
    { id: 'l3',   kind: 'sign',  type: 'levitation', x:   0, y: -80, rotation:   0, scale: 1, inverted: false },
  ]
  const comp = toComposition({
    strokes: [], placed, dyes: ['dye_crimson'], ringClosed: true,
  }, opts)
  const circle = comp.circles[0]

  // Core
  assert.equal(circle.core?.type, 'fire')
  assert.equal(circle.core?.x, 0)
  assert.equal(circle.core?.y, 0)

  // Components: 4 signs
  assert.equal(circle.components.length, 4)
  assert.ok(circle.components.every((c) => c.role === 'sign'))
  assert.ok(circle.components.every((c) => c.type === 'levitation'))

  // Ring closed
  assert.equal(circle.ring.closed, true)

  // Dyes
  assert.deepEqual(circle.dyes, ['dye_crimson'])

  // Radius: farthest = 80 * 1.25 = 100
  assert.equal(circle.radius, 100)
})

// ---------- recognizedToPlaced ----------

test('recognizedToPlaced: maps core groups to sigil kind', () => {
  const groups = [{ role: 'core', cx: 5, cy: 10, match: { name: 'fire', rotation: 0 } }]
  const placed = recognizedToPlaced(groups)
  assert.equal(placed.length, 1)
  assert.equal(placed[0].kind, 'sigil')
  assert.equal(placed[0].type, 'fire')
})

test('recognizedToPlaced: maps sign groups to sign kind', () => {
  const groups = [{ role: 'sign', cx: 80, cy: 0, match: { name: 'levitation', rotation: 45 } }]
  const placed = recognizedToPlaced(groups)
  assert.equal(placed[0].kind, 'sign')
  assert.equal(placed[0].rotation, 45)
})

test('recognizedToPlaced: filters out unmatched groups', () => {
  const groups = [
    { role: 'sign', cx: 80, cy: 0, match: null },
    { role: 'core', cx: 0,  cy: 0, match: { name: 'fire', rotation: 0 } },
  ]
  const placed = recognizedToPlaced(groups)
  assert.equal(placed.length, 1)
  assert.equal(placed[0].type, 'fire')
})

test('recognizedToPlaced: coordinates are rounded integers', () => {
  const groups = [
    { role: 'sign', cx: 80.7, cy: 30.2, match: { name: 'levitation', rotation: 0 } },
  ]
  const placed = recognizedToPlaced(groups)
  assert.equal(placed[0].x, 81)
  assert.equal(placed[0].y, 30)
})
