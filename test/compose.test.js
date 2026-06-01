import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { toComposition, analyzeCircleWith, composeWith } from '../src/engine/compose.js'
import { toCartesian } from '../src/engine/geometry.js'

const require = createRequire(import.meta.url)
const grammar = require('../data/grammar.json')
const sigilMap = Object.fromEntries(require('../data/sigils.json').sigils.map((s) => [s.id, s]))
const signMap = Object.fromEntries(require('../data/signs.json').signs.map((s) => [s.id, s]))
const deps = { grammar, sigilMap, signMap, dyeMap: {} }

let id = 0
// A single circle (v1-shaped) with a core + evenly spaced signs.
function circle(over, core, signs) {
  const components = (signs || []).map((s, i) => {
    const angle = (360 / signs.length) * i
    const { x, y } = toCartesian(angle, 0.6)
    return { id: `s${id++}`, type: s.type, role: 'sign', x, y, rotation: s.rotation ?? 0, scale: s.scale ?? 1, inverted: !!s.inverted }
  })
  return { id: over.id, name: over.name, ring: over.ring ?? { closed: true }, core: core ? { id: `c${id++}`, type: core, x: 0, y: 0 } : null, components, ...over }
}

test('toComposition wraps a v1 composition into a single circle', () => {
  const v1 = { name: 'X', ring: { closed: true }, core: { type: 'fire', x: 0, y: 0 }, components: [{ type: 'column', role: 'sign', x: 0, y: -100 }], linkCount: 0, dyes: [] }
  const c = toComposition(v1)
  assert.equal(c.circles.length, 1)
  assert.equal(c.relations.length, 0)
  assert.equal(c.circles[0].core.type, 'fire')
  assert.equal(c.circles[0].components.length, 1)
  assert.equal(c.name, 'X')
})

test('toComposition passes a v2 spell through, normalizing circle defaults', () => {
  const v2 = { name: 'Nested', circles: [{ id: 'outer', core: { type: 'water' }, components: [] }, { id: 'inner' }], relations: [{ type: 'nest', outer: 'outer', inner: 'inner' }] }
  const c = toComposition(v2)
  assert.equal(c.circles.length, 2)
  assert.equal(c.circles[0].id, 'outer')
  assert.deepEqual(c.circles[1].ring, { closed: false }) // default filled in
  assert.equal(c.relations[0].type, 'nest')
})

test('analyzeCircleWith reproduces the single-ring pipeline (fire + columns => above the seal)', () => {
  const c = circle({ id: 'k0' }, 'fire', [{ type: 'column' }, { type: 'column' }, { type: 'column' }, { type: 'column' }])
  const r = analyzeCircleWith(deps, c)
  assert.ok(r.valid)
  assert.match(r.deduction.summary, /column or beam/i)
  assert.match(r.deduction.summary, /above the seal/i)
  assert.equal(r.analysis.aim, 'above the seal')
})

test('analyzeCircleWith: no core => invalid (blocking issue), no deduction', () => {
  const c = circle({ id: 'k0' }, null, [{ type: 'column' }])
  const r = analyzeCircleWith(deps, c)
  assert.equal(r.valid, false)
  assert.equal(r.deduction, null)
  assert.ok(r.issues.some((i) => i.severity === 'blocking'))
})

test('composeWith nests an inner circle inside an outer one and narrates the wrap', () => {
  const outer = analyzeCircleWith(deps, circle({ id: 'outer', name: 'Outer', ring: { closed: true } }, 'water', [{ type: 'column' }, { type: 'column' }]))
  const inner = analyzeCircleWith(deps, circle({ id: 'inner', name: 'Inner', ring: { closed: true } }, 'fire', [{ type: 'levitation' }, { type: 'levitation' }, { type: 'levitation' }, { type: 'levitation' }]))
  const combined = composeWith(grammar, [{ type: 'nest', outer: 'outer', inner: 'inner' }], [outer, inner])
  assert.match(combined.summary, /water/i)             // outer effect present
  assert.match(combined.summary, /levitate/i)           // inner effect folded in
  assert.match(combined.summary, /nested within it Inner/i)
  assert.deepEqual(combined.roots, ['outer'])           // inner is not a root
})

test('composeWith flags the nested-glyph activation rule when the outer ring is open', () => {
  const outer = analyzeCircleWith(deps, circle({ id: 'outer', name: 'Outer', ring: { closed: false } }, 'water', [{ type: 'column' }, { type: 'column' }]))
  const inner = analyzeCircleWith(deps, circle({ id: 'inner', name: 'Inner', ring: { closed: true } }, 'fire', [{ type: 'levitation' }, { type: 'levitation' }]))
  const combined = composeWith(grammar, [{ type: 'nest', outer: 'outer', inner: 'inner' }], [outer, inner])
  assert.ok(combined.notes.some((n) => /only once its outer ring is closed/i.test(n)))
})

test('composeWith records links between circles', () => {
  const a = analyzeCircleWith(deps, circle({ id: 'a', name: 'A', ring: { closed: true } }, 'fire', [{ type: 'column' }, { type: 'column' }]))
  const b = analyzeCircleWith(deps, circle({ id: 'b', name: 'B', ring: { closed: true } }, 'fire', [{ type: 'column' }, { type: 'column' }]))
  const combined = composeWith(grammar, [{ type: 'link', a: 'a', b: 'b' }], [a, b])
  assert.equal(combined.roots.length, 2) // neither is nested
  assert.ok(combined.notes.some((n) => /linked by a line/i.test(n)))
})
