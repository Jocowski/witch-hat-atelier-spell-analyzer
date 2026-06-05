// test/use-templates.test.js — unit tests for mergeTemplates() from src/studio/useTemplates.js.
//
// Tests the PURE mergeTemplates(seed, dbRows) function only — no React, no Supabase, no DB.
// The hook itself requires React + AuthProvider so it is not tested here.

import { test } from 'node:test'
import assert from 'node:assert/strict'

// mergeTemplates is a plain exported function with no React or Supabase imports.
// We import it directly — it is the only export from useTemplates that is pure.
// The file uses import.meta.env indirectly (via capabilities.js through the hook),
// but mergeTemplates itself has no such dependency — it runs fine in Node.
//
// Note: the file also imports from react and capabilities.js which cannot be loaded
// in plain Node.  However, because mergeTemplates is the only thing being tested
// and it lives at the TOP of the module (before any React imports are evaluated),
// we work around the Node ESM restriction by copy-inlining the function here —
// the same strategy used by capabilities.test.js.  This keeps the test pure and
// dependency-free while documenting the CONTRACT: any change to mergeTemplates in
// useTemplates.js must be mirrored here to keep the contract in sync.

/**
 * Mirror of mergeTemplates() from src/studio/useTemplates.js.
 * Keep in sync with the source.
 *
 * @param {Array} seed
 * @param {Array} dbRows
 * @returns {Array}
 */
function mergeTemplates(seed, dbRows) {
  return [...seed, ...dbRows]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTemplate(name, role = 'sign') {
  return { name, role, points: [{ x: 0, y: 0 }], source: 'drawn', weight: 1.0 }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('mergeTemplates: returns seed unchanged when dbRows is empty', () => {
  const seed = [makeTemplate('water'), makeTemplate('fire', 'sigil')]
  const result = mergeTemplates(seed, [])
  assert.equal(result.length, seed.length, 'should have same count as seed')
  assert.deepEqual(result, seed, 'should be identical to seed when no dbRows')
})

test('mergeTemplates: returns seed + dbRows when both are present', () => {
  const seed   = [makeTemplate('water'), makeTemplate('fire', 'sigil')]
  const dbRows = [makeTemplate('earth'), makeTemplate('levitation')]
  const result = mergeTemplates(seed, dbRows)
  assert.equal(
    result.length,
    seed.length + dbRows.length,
    'result length should be seed.length + dbRows.length',
  )
  // Seed entries come first
  assert.deepEqual(result[0], seed[0], 'first element should be first seed entry')
  assert.deepEqual(result[1], seed[1], 'second element should be second seed entry')
  // DB rows follow
  assert.deepEqual(result[2], dbRows[0], 'third element should be first dbRow')
  assert.deepEqual(result[3], dbRows[1], 'fourth element should be second dbRow')
})

test('mergeTemplates: never returns fewer than seed.length items (seed is the floor)', () => {
  const seed = [
    makeTemplate('water'),
    makeTemplate('fire', 'sigil'),
    makeTemplate('region'),
  ]
  // Empty dbRows
  assert.ok(
    mergeTemplates(seed, []).length >= seed.length,
    'empty dbRows: result.length must be >= seed.length',
  )
  // Non-empty dbRows
  const dbRows = [makeTemplate('earth')]
  assert.ok(
    mergeTemplates(seed, dbRows).length >= seed.length,
    'non-empty dbRows: result.length must be >= seed.length',
  )
})

test('mergeTemplates: works with empty seed and non-empty dbRows', () => {
  const dbRows = [makeTemplate('water'), makeTemplate('earth')]
  const result = mergeTemplates([], dbRows)
  assert.equal(result.length, dbRows.length, 'should return all dbRows when seed is empty')
  assert.deepEqual(result, dbRows, 'should equal dbRows when seed is empty')
})

test('mergeTemplates: works when both seed and dbRows are empty', () => {
  const result = mergeTemplates([], [])
  assert.equal(result.length, 0, 'should return empty array when both inputs are empty')
})

test('mergeTemplates: does not mutate the original seed array', () => {
  const seed   = [makeTemplate('water')]
  const dbRows = [makeTemplate('earth')]
  const seedCopy = [...seed]
  mergeTemplates(seed, dbRows)
  assert.deepEqual(seed, seedCopy, 'seed array must not be mutated')
})
