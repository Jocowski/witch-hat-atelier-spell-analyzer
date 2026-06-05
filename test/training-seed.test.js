// training-seed.test.js — guards the bundled recognizer training set (data/training-seed.json),
// the hardcoded source the web prototype is "trained" from (docs/app/SPEC-web-prototype.md §3).
//
// Loads JSON via createRequire (plain `import x from './x.json'` fails under node --test), the same
// pattern the engine tests use. Regenerate the asset with `npm run build:seed`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const seed = require('../data/training-seed.json')
const sigils = require('../data/sigils.json').sigils ?? []
const signs = require('../data/signs.json').signs ?? []
const knownIds = new Set([...sigils.map((s) => s.id), ...signs.map((s) => s.id)])

test('seed is a non-empty array', () => {
  assert.ok(Array.isArray(seed))
  assert.ok(seed.length > 0, 'expected at least one training sample')
})

test('every sample name resolves to a known sigil/sign id', () => {
  const bad = seed.filter((s) => !knownIds.has(s.name)).map((s) => s.name)
  assert.deepEqual([...new Set(bad)], [], `unknown names: ${[...new Set(bad)].join(', ')}`)
})

test('every sample has a valid role', () => {
  for (const s of seed) assert.ok(s.role === 'sign' || s.role === 'sigil', `bad role on ${s.name}: ${s.role}`)
})

test('every sample has >= 2 numeric points', () => {
  for (const s of seed) {
    assert.ok(Array.isArray(s.points) && s.points.length >= 2, `${s.name}: needs >= 2 points`)
    for (const p of s.points) {
      assert.ok(Number.isFinite(p.X) && Number.isFinite(p.Y), `${s.name}: non-numeric point`)
    }
  }
})

test('every sample carries a source string', () => {
  for (const s of seed) assert.ok(typeof s.source === 'string' && s.source, `${s.name}: missing source`)
})
