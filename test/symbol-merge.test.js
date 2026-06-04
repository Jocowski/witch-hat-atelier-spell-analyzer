import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSymbols } from '../src/engine/symbolMerge.js'

function baseline() {
  return {
    sigils: [{ id: 'fire', kind: 'sigil', name: 'Fire', element: 'fire', svgPath: 'M0 0', family: 'fire' }],
    signs: [{ id: 'levitation', kind: 'sign', name: 'Levitation', svgPath: 'M1 1', family: 'directional', invertible: true }],
    grammar: {
      elements: { fire: { substance: 'flame', raw: 'burns', qualities: ['hot'] }, unknown: { substance: 'force', raw: '—' } },
      operators: { levitation: { kind: 'motion', verb: 'floats' } },
      interactions: [],
    },
  }
}

test('overlay adds a brand-new sign with a grammar operator', () => {
  const b = baseline()
  const out = mergeSymbols(b, [
    { kind: 'sign', name: 'gust', svg_path: 'M9 9', family: 'directional', op_kind: 'motion', op_verb: 'is blown along' },
  ])
  const gust = out.signs.find((s) => s.id === 'gust')
  assert.ok(gust, 'new sign added')
  assert.equal(gust.svgPath, 'M9 9')
  assert.equal(gust.family, 'directional')
  assert.deepEqual(out.grammar.operators.gust, { kind: 'motion', verb: 'is blown along' })
})

test('overlay overrides an svgPath on a canon sign, keeping other baseline fields', () => {
  const b = baseline()
  const out = mergeSymbols(b, [{ kind: 'sign', name: 'levitation', svg_path: 'M2 2' }])
  const lev = out.signs.find((s) => s.id === 'levitation')
  assert.equal(lev.svgPath, 'M2 2')         // overridden
  assert.equal(lev.invertible, true)        // baseline field preserved
  assert.equal(lev.family, 'directional')
})

test('engine_id wins over name when resolving the target id', () => {
  const b = baseline()
  const out = mergeSymbols(b, [{ kind: 'sign', name: 'Levitation Display', engine_id: 'levitation', svg_path: 'M3 3' }])
  assert.equal(out.signs.find((s) => s.id === 'levitation').svgPath, 'M3 3')
  assert.ok(!out.signs.find((s) => s.id === 'Levitation Display'))
})

test('a sigil row with substance fields rebuilds the grammar element', () => {
  const b = baseline()
  const out = mergeSymbols(b, [
    { kind: 'sigil', name: 'ice', element: 'ice', substance: 'ice', substance_raw: 'freezes', substance_qualities: ['cold'] },
  ])
  assert.deepEqual(out.grammar.elements.ice, { substance: 'ice', raw: 'freezes', qualities: ['cold'] })
})

test('a sign row without op_kind/op_verb leaves the grammar operators untouched', () => {
  const b = baseline()
  const before = JSON.stringify(b.grammar.operators)
  const out = mergeSymbols(b, [{ kind: 'sign', name: 'plain', svg_path: 'M4 4', family: 'non-directional' }])
  assert.ok(out.signs.find((s) => s.id === 'plain'))           // still added for presentation
  assert.equal(out.grammar.operators.plain, undefined)         // no operator built
  assert.equal(JSON.stringify(b.grammar.operators), before)    // baseline untouched
})

test('mergeSymbols never mutates the baseline', () => {
  const b = baseline()
  const snapshot = JSON.stringify(b)
  mergeSymbols(b, [
    { kind: 'sign', name: 'levitation', svg_path: 'ZZZ' },
    { kind: 'sigil', name: 'fire', svg_path: 'YYY' },
  ])
  assert.equal(JSON.stringify(b), snapshot)
})

test('null/undefined fields fall through to the baseline (not overwritten with null)', () => {
  const b = baseline()
  const out = mergeSymbols(b, [{ kind: 'sign', name: 'levitation', svg_path: null, family: undefined }])
  const lev = out.signs.find((s) => s.id === 'levitation')
  assert.equal(lev.svgPath, 'M1 1')     // baseline kept
  assert.equal(lev.family, 'directional')
})

test('empty/falsey rows are ignored', () => {
  const b = baseline()
  const out = mergeSymbols(b, [null, undefined, { kind: 'sign' /* no id */ }])
  assert.equal(out.signs.length, b.signs.length)
})
