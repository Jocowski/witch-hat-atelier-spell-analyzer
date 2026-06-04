// test/reportCache.test.js — unit tests for src/ai/reportCache.js
// Run with: node --test test/reportCache.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REPORT_VERSION, stableStringify, fnv32a, compositionHash } from '../src/ai/reportCache.js'

// ── Minimal spell compositions for testing ────────────────────────────────────

const baseComposition = {
  name: 'Test Spell',
  ring: { closed: true },
  core: { id: 'c0', type: 'fire', x: 0, y: 0, rotation: 0, scale: 1, inverted: false, mirrored: false },
  components: [
    { id: 's0', type: 'column', role: 'sign', x: 0, y: -100, rotation: 0, scale: 1, inverted: false, mirrored: false },
  ],
  linkCount: 0,
  dyes: [],
}

// A copy with keys in a different insertion order — should hash identically.
const sameCompositionDifferentKeyOrder = {
  dyes: [],
  linkCount: 0,
  components: [
    { mirrored: false, inverted: false, scale: 1, rotation: 0, y: -100, x: 0, role: 'sign', type: 'column', id: 's0' },
  ],
  core: { mirrored: false, inverted: false, scale: 1, rotation: 0, y: 0, x: 0, type: 'fire', id: 'c0' },
  ring: { closed: true },
  name: 'Test Spell',
}

const editedComposition = {
  ...baseComposition,
  core: { ...baseComposition.core, type: 'water' },  // changed element
}

const ringOpenComposition = {
  ...baseComposition,
  ring: { closed: false },
}

const topics = ['effect', 'feasibility', 'symbols']

// ── stableStringify ───────────────────────────────────────────────────────────

test('stableStringify: same object → same string regardless of key insertion order', () => {
  const a = { z: 1, a: 2, m: 3 }
  const b = { m: 3, z: 1, a: 2 }
  assert.equal(stableStringify(a), stableStringify(b))
})

test('stableStringify: nested objects have sorted keys too', () => {
  const a = { outer: { z: 1, a: 2 } }
  const b = { outer: { a: 2, z: 1 } }
  assert.equal(stableStringify(a), stableStringify(b))
})

test('stableStringify: arrays preserve order (not sorted)', () => {
  const a = { arr: [3, 1, 2] }
  const b = { arr: [1, 2, 3] }
  assert.notEqual(stableStringify(a), stableStringify(b))
})

test('stableStringify: handles null, primitives, booleans', () => {
  const a = { a: null, b: true, c: 42, d: 'hello' }
  const b = { d: 'hello', c: 42, b: true, a: null }
  assert.equal(stableStringify(a), stableStringify(b))
})

// ── fnv32a ────────────────────────────────────────────────────────────────────

test('fnv32a: returns 8-char hex string', () => {
  const h = fnv32a('hello')
  assert.match(h, /^[0-9a-f]{8}$/)
})

test('fnv32a: empty string produces a known value', () => {
  // FNV-1a 32-bit of "" = 0x811c9dc5
  assert.equal(fnv32a(''), '811c9dc5')
})

test('fnv32a: same input → same output (deterministic)', () => {
  const h1 = fnv32a('witch hat atelier')
  const h2 = fnv32a('witch hat atelier')
  assert.equal(h1, h2)
})

test('fnv32a: different inputs → different outputs', () => {
  assert.notEqual(fnv32a('fire'), fnv32a('water'))
})

// ── compositionHash: stability ────────────────────────────────────────────────

test('compositionHash: same composition + same topics → same hash', () => {
  const h1 = compositionHash(baseComposition, topics)
  const h2 = compositionHash(baseComposition, topics)
  assert.equal(h1, h2)
})

test('compositionHash: key insertion order does not affect hash', () => {
  const h1 = compositionHash(baseComposition, topics)
  const h2 = compositionHash(sameCompositionDifferentKeyOrder, topics)
  assert.equal(h1, h2)
})

test('compositionHash: topic order does not affect hash (topics are sorted)', () => {
  const h1 = compositionHash(baseComposition, ['effect', 'feasibility', 'symbols'])
  const h2 = compositionHash(baseComposition, ['symbols', 'effect', 'feasibility'])
  assert.equal(h1, h2)
})

// ── compositionHash: busting ──────────────────────────────────────────────────

test('compositionHash: editing element (fire→water) busts the hash', () => {
  const h1 = compositionHash(baseComposition, topics)
  const h2 = compositionHash(editedComposition, topics)
  assert.notEqual(h1, h2)
})

test('compositionHash: opening/closing the ring busts the hash', () => {
  const h1 = compositionHash(baseComposition, topics)
  const h2 = compositionHash(ringOpenComposition, topics)
  assert.notEqual(h1, h2)
})

test('compositionHash: adding a dye busts the hash', () => {
  const withDye = { ...baseComposition, dyes: ['crimson'] }
  const h1 = compositionHash(baseComposition, topics)
  const h2 = compositionHash(withDye, topics)
  assert.notEqual(h1, h2)
})

test('compositionHash: adding a sign component busts the hash', () => {
  const withExtra = {
    ...baseComposition,
    components: [
      ...baseComposition.components,
      { id: 's1', type: 'spread', role: 'sign', x: 100, y: 0, rotation: 90, scale: 1, inverted: false, mirrored: false },
    ],
  }
  const h1 = compositionHash(baseComposition, topics)
  const h2 = compositionHash(withExtra, topics)
  assert.notEqual(h1, h2)
})

test('compositionHash: changing topic selection busts the hash', () => {
  const h1 = compositionHash(baseComposition, ['effect', 'feasibility'])
  const h2 = compositionHash(baseComposition, ['effect', 'feasibility', 'symbols'])
  assert.notEqual(h1, h2)
})

test('compositionHash: removing a topic busts the hash', () => {
  const h1 = compositionHash(baseComposition, ['effect', 'feasibility', 'symbols'])
  const h2 = compositionHash(baseComposition, ['effect', 'feasibility'])
  assert.notEqual(h1, h2)
})

// ── REPORT_VERSION ────────────────────────────────────────────────────────────

test('REPORT_VERSION is a non-empty string', () => {
  assert.equal(typeof REPORT_VERSION, 'string')
  assert.ok(REPORT_VERSION.length > 0)
})

test('compositionHash with a bumped REPORT_VERSION produces a different hash', () => {
  // We can't change the exported constant, so we test the underlying mechanism:
  // stableStringify with a different reportVersion must differ.
  const p1 = stableStringify({ spell: baseComposition, topics: [...topics].sort(), reportVersion: '1.0' })
  const p2 = stableStringify({ spell: baseComposition, topics: [...topics].sort(), reportVersion: '2.0' })
  assert.notEqual(fnv32a(p1), fnv32a(p2))
})

test('compositionHash returns an 8-char hex string', () => {
  const h = compositionHash(baseComposition, topics)
  assert.match(h, /^[0-9a-f]{8}$/)
})
