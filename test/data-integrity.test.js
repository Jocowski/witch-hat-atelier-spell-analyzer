import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// require() lê JSON nativamente em Node (sem import attributes).
const require = createRequire(import.meta.url)
const sigilsDoc = require('../data/sigils.json')
const signsDoc = require('../data/signs.json')
const spellsDoc = require('../data/spells.json')

const sigilIds = new Set(sigilsDoc.sigils.map((s) => s.id))
const signIds = new Set(signsDoc.signs.map((s) => s.id))

test('todo core de spell existe como sigil ou sign', () => {
  for (const spell of spellsDoc.spells) {
    const core = spell.composition?.core
    if (!core || core === 'none') continue
    assert.ok(
      sigilIds.has(core) || signIds.has(core),
      `spell "${spell.id}" referencia core inexistente: "${core}"`,
    )
  }
})

test('todo sign referenciado em spells existe', () => {
  for (const spell of spellsDoc.spells) {
    for (const s of spell.composition?.signs ?? []) {
      assert.ok(signIds.has(s.id), `spell "${spell.id}" referencia sign inexistente: "${s.id}"`)
    }
  }
})

test('todo svgPath de sigil é não-vazio', () => {
  for (const s of sigilsDoc.sigils) {
    assert.ok(typeof s.svgPath === 'string' && s.svgPath.length > 0, `sigil "${s.id}" sem svgPath`)
  }
})

test('todo svgPath de sign é não-vazio', () => {
  for (const s of signsDoc.signs) {
    assert.ok(typeof s.svgPath === 'string' && s.svgPath.length > 0, `sign "${s.id}" sem svgPath`)
  }
})

test('ids de spells são únicos', () => {
  const ids = spellsDoc.spells.map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length, 'há ids de spell duplicados')
})

test('cada spell tem effect e category', () => {
  for (const s of spellsDoc.spells) {
    assert.ok(s.effect, `spell "${s.id}" sem effect`)
    assert.ok(s.category, `spell "${s.id}" sem category`)
  }
})
