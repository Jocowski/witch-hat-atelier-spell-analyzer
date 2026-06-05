import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// require() lê JSON nativamente em Node (sem import attributes).
const require = createRequire(import.meta.url)
const sigilsDoc = require('../data/sigils.json')
const signsDoc = require('../data/signs.json')
const spellsDoc = require('../data/spells.json')
const grammarDoc = require('../data/grammar.json')

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

// F2-D — Symbol lifecycle: no catalog spell may reference a `removed` symbol.
// A removed symbol is a tombstone; any spell using it must be updated or archived.
describe('symbol lifecycle', () => {
  test('no catalog spell references a removed symbol', () => {
    const sigilList = sigilsDoc.sigils ?? []
    const signList  = signsDoc.signs ?? []
    const spellList = spellsDoc.spells ?? []

    const removedIds = new Set(
      [...sigilList, ...signList]
        .filter((s) => s.lifecycle?.status === 'removed')
        .map((s) => s.id),
    )
    if (removedIds.size === 0) return // nothing removed yet — passes trivially

    for (const spell of spellList) {
      const c = spell.composition || {}
      const deps = [c.core, ...(c.signs ?? []).map((s) => s.id)].filter(Boolean)
      for (const id of deps) {
        assert.ok(
          !removedIds.has(id),
          `Spell "${spell.id || spell.name}" references removed symbol "${id}". ` +
            `Update the spell's composition or mark it archived.`,
        )
      }
    }
  })
})

// ----- L6 Orb-container: data-integrity assertions (SPEC-orb-container §L6) -----

describe('orb-container grammar integrity', () => {
  // Every operator that declares container:"sphere" must also be kind:"form" and directional:false.
  // These are invariants of the container model (§0): a container is always a form operator
  // that does not aim a jet.
  test('every operator with container:"sphere" has kind:"form" and directional:false', () => {
    const operators = grammarDoc.operators ?? {}
    for (const [id, op] of Object.entries(operators)) {
      if (op.container === 'sphere') {
        assert.equal(
          op.kind,
          'form',
          `operator "${id}" has container:"sphere" but kind is "${op.kind}" (expected "form")`,
        )
        assert.equal(
          op.directional,
          false,
          `operator "${id}" has container:"sphere" but directional is ${op.directional} (expected false)`,
        )
      }
    }
  })

  // The orb-column and orb-rigid-earth interactions reference operator/element ids that
  // actually exist in the grammar. A typo here would silently prevent the interactions from firing.
  test('orb-column interaction references operators that exist (orb, column)', () => {
    const interactions = grammarDoc.interactions ?? []
    const orbColumn = interactions.find((i) => i.id === 'orb-column')
    assert.ok(orbColumn, 'orb-column interaction missing from grammar.json')
    for (const opId of orbColumn.when?.has ?? []) {
      assert.ok(
        grammarDoc.operators?.[opId],
        `orb-column interaction references operator "${opId}" which does not exist in grammar.operators`,
      )
    }
  })

  test('orb-rigid-earth interaction references operators and elements that exist', () => {
    const interactions = grammarDoc.interactions ?? []
    const orbRigid = interactions.find((i) => i.id === 'orb-rigid-earth')
    assert.ok(orbRigid, 'orb-rigid-earth interaction missing from grammar.json')
    // All ids in when.has must be valid operator ids
    for (const opId of orbRigid.when?.has ?? []) {
      assert.ok(
        grammarDoc.operators?.[opId],
        `orb-rigid-earth interaction references operator "${opId}" which does not exist in grammar.operators`,
      )
    }
    // when.element must be a valid element id
    const elemId = orbRigid.when?.element
    if (elemId) {
      assert.ok(
        grammarDoc.elements?.[elemId],
        `orb-rigid-earth interaction references element "${elemId}" which does not exist in grammar.elements`,
      )
    }
  })
})
