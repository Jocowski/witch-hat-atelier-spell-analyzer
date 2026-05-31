import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { deduceWith } from '../src/engine/deduce.js'
import { toCartesian } from '../src/engine/geometry.js'

const require = createRequire(import.meta.url)
const grammar = require('../data/grammar.json')
const sigilMap = Object.fromEntries(require('../data/sigils.json').sigils.map((s) => [s.id, s]))
const signMap = Object.fromEntries(require('../data/signs.json').signs.map((s) => [s.id, s]))

// Helper: build a composition with a core + signs evenly spaced.
let id = 0
function comp(core, signs) {
  const components = signs.map((s, i) => {
    const angle = (360 / signs.length) * i
    const { x, y } = toCartesian(angle, 0.6)
    return { id: `s${id++}`, type: s.type, role: 'sign', x, y, rotation: 0, scale: s.scale ?? 1, inverted: !!s.inverted }
  })
  return { ring: { closed: true }, core: core ? { id: `c${id++}`, type: core, x: 0, y: 0 } : null, components }
}

const D = (core, signs) => deduceWith(grammar, sigilMap, signMap, comp(core, signs))

test('no core => not ok', () => {
  const r = D(null, [{ type: 'column' }])
  assert.equal(r.ok, false)
})

test('water + column => beam of water, upward', () => {
  const r = D('water', [{ type: 'column' }, { type: 'column' }, { type: 'column' }, { type: 'column' }])
  assert.ok(r.ok)
  assert.match(r.summary, /water/i)
  assert.match(r.summary, /column or beam/i)
  assert.match(r.summary, /upward/i)
})

test('light + column => beam of light (same FORM, different substance)', () => {
  const r = D('light', [{ type: 'column' }, { type: 'column' }, { type: 'column' }, { type: 'column' }])
  assert.match(r.summary, /light/i)
  assert.match(r.summary, /column or beam/i)
})

test('earth + crush => pulverized; inverted crush => reassembled', () => {
  const normal = D('earth', [{ type: 'crush' }, { type: 'crush' }])
  assert.match(normal.summary, /pulverized/i)
  const inv = D('earth', [{ type: 'crush', inverted: true }, { type: 'crush', inverted: true }])
  assert.match(inv.summary, /reassembled/i)
})

test('bolt without direction => warning; with direction => synergy note', () => {
  const noDir = D('water', [{ type: 'bolt' }, { type: 'bolt' }])
  assert.ok(noDir.warnings.some((w) => /Direction sign/i.test(w)))
  const withDir = D('water', [{ type: 'bolt' }, { type: 'direction' }])
  assert.ok(withDir.notes.some((n) => /aims the bolts/i.test(n)))
})

test('radial + fire => tempered warmth (power + synergy)', () => {
  const r = D('fire', [{ type: 'radial' }, { type: 'column' }])
  assert.match(r.power, /weakened|gentle/i)
  assert.ok(r.notes.some((n) => /warmth/i.test(n)))
})

test('billowing without collection warns; with collection synergizes', () => {
  const alone = D('billowing_sigil', [{ type: 'billowing' }])
  assert.ok(alone.warnings.some((w) => /Collection/i.test(w)))
  const fed = D('billowing_sigil', [{ type: 'collection' }, { type: 'collection' }, { type: 'billowing' }])
  assert.ok(fed.notes.some((n) => /converts into a cloud/i.test(n)))
})

test('vision + eye + bend => concealment synergy', () => {
  const r = D('vision_sigil', [{ type: 'eye' }, { type: 'eye' }, { type: 'bend' }, { type: 'bend' }])
  assert.ok(r.notes.some((n) => /shadows|concealment/i.test(n)))
})

test('unbalanced columns => skewed direction', () => {
  // three columns clustered on one side
  const components = [10, 30, 350].map((a, i) => {
    const { x, y } = toCartesian(a, 0.6)
    return { id: `s${id++}`, type: 'column', role: 'sign', x, y, rotation: 0, scale: 1, inverted: false }
  })
  const r = deduceWith(grammar, sigilMap, signMap, { ring: { closed: true }, core: { id: 'c', type: 'water' }, components })
  assert.match(r.summary, /skewed/i)
})

test('breakdown lists the core and each sign', () => {
  const r = D('earth', [{ type: 'column' }, { type: 'crush' }])
  const roles = r.breakdown.map((b) => b.role)
  assert.ok(roles.includes('core'))
  assert.ok(roles.includes('form'))     // column
  assert.ok(roles.includes('transmute')) // crush
})

test('every sign id has a grammar operator (coverage)', () => {
  for (const s of require('../data/signs.json').signs) {
    assert.ok(grammar.operators[s.id], `missing grammar operator for sign "${s.id}"`)
  }
})

test('every sigil element has a grammar element entry (coverage)', () => {
  for (const s of require('../data/sigils.json').sigils) {
    assert.ok(grammar.elements[s.element], `missing grammar element for "${s.element}" (sigil ${s.id})`)
  }
})
