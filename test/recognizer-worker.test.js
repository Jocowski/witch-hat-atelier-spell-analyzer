// test/recognizer-worker.test.js — unit tests for the PURE handleWorkerMessage function.
//
// No real Worker is constructed here — only the pure handler is exercised so these
// tests run under node --test without any browser globals.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { handleWorkerMessage } from '../src/draw/recognizerWorker.js'
import { analyzeStrokes, buildClouds } from '../src/draw/recognizer.js'

// ─── Minimal template set for testing ────────────────────────────────────────

// A simple L-shape (2 strokes) used as a named template.
const lPts = [
  ...[[0, -50], [0, 0], [0, 50]].map(([x, y]) => ({ X: x, Y: y, ID: 0 })),
  ...[[0, 50], [50, 50]].map(([x, y]) => ({ X: x, Y: y, ID: 1 })),
]
const templates = [{ name: 'l_shape', role: 'sign', points: lPts, weight: 1 }]

// A simple stroke set that matches reasonably well (same shape).
const sampleStrokes = [
  [{ x: 0, y: -50 }, { x: 0, y: 0 }, { x: 0, y: 50 }],
  [{ x: 0, y: 50 }, { x: 50, y: 50 }],
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fresh handler state. */
function freshState() { return { cache: new Map() } }

// ─────────────────────────────────────────────────────────────────────────────
// setTemplates
// ─────────────────────────────────────────────────────────────────────────────

test('handleWorkerMessage: setTemplates caches clouds under the token', () => {
  const state = freshState()
  const { reply } = handleWorkerMessage(state, { type: 'setTemplates', token: 'tok1', templates })

  assert.equal(reply.type, 'ack', 'should reply with ack')
  assert.equal(reply.token, 'tok1')
  assert.ok(state.cache.has('tok1'), 'cache should contain tok1')

  const clouds = state.cache.get('tok1')
  assert.ok(Array.isArray(clouds), 'cached value should be an array')
  assert.equal(clouds.length, templates.length, 'one cloud per template')
})

test('handleWorkerMessage: setTemplates evicts old tokens (cache bounded to 1)', () => {
  const state = freshState()
  // Cache token A first.
  handleWorkerMessage(state, { type: 'setTemplates', token: 'tokA', templates })
  assert.ok(state.cache.has('tokA'))

  // Set token B — tokA should be evicted.
  handleWorkerMessage(state, { type: 'setTemplates', token: 'tokB', templates })
  assert.ok(!state.cache.has('tokA'), 'old token should be evicted')
  assert.ok(state.cache.has('tokB'), 'new token should be cached')
  assert.equal(state.cache.size, 1, 'cache size should stay ≤ 1')
})

// ─────────────────────────────────────────────────────────────────────────────
// recognize — cached token
// ─────────────────────────────────────────────────────────────────────────────

test('handleWorkerMessage: recognize for a cached token returns result matching direct analyzeStrokes', () => {
  const state = freshState()
  handleWorkerMessage(state, { type: 'setTemplates', token: 'tok1', templates })

  const { reply } = handleWorkerMessage(state, {
    type: 'recognize',
    reqId: 42,
    token: 'tok1',
    strokes: sampleStrokes,
    opts: {},
  })

  assert.equal(reply.type, 'result')
  assert.equal(reply.reqId, 42)
  assert.ok(reply.result, 'result should be present')
  assert.ok(!reply.error, 'should not have an error field')

  // Cross-check against a direct analyzeStrokes call with the same clouds.
  const clouds = buildClouds(templates)
  const expected = analyzeStrokes(sampleStrokes, null, { clouds })
  // The composition format and ring field should be structurally equal.
  assert.deepEqual(reply.result.ring, expected.ring)
  assert.deepEqual(reply.result.groups?.length, expected.groups?.length)
})

test('handleWorkerMessage: recognize carries the reqId in the reply', () => {
  const state = freshState()
  handleWorkerMessage(state, { type: 'setTemplates', token: 'tok1', templates })

  const reqId = 99
  const { reply } = handleWorkerMessage(state, {
    type: 'recognize', reqId, token: 'tok1', strokes: sampleStrokes, opts: {},
  })
  assert.equal(reply.reqId, reqId)
})

// ─────────────────────────────────────────────────────────────────────────────
// recognize — unknown token (no-templates error)
// ─────────────────────────────────────────────────────────────────────────────

test('handleWorkerMessage: recognize for an unknown token returns error:no-templates', () => {
  const state = freshState()
  // Do NOT call setTemplates — cache is empty.

  const { reply } = handleWorkerMessage(state, {
    type: 'recognize',
    reqId: 7,
    token: 'missing',
    strokes: sampleStrokes,
    opts: {},
  })

  assert.equal(reply.type, 'result')
  assert.equal(reply.reqId, 7)
  assert.equal(reply.error, 'no-templates')
  assert.ok(!reply.result, 'should not have a result when token is missing')
})

// ─────────────────────────────────────────────────────────────────────────────
// Unknown message type
// ─────────────────────────────────────────────────────────────────────────────

test('handleWorkerMessage: unknown message type returns null reply', () => {
  const state = freshState()
  const { reply } = handleWorkerMessage(state, { type: 'bogus', reqId: 1 })
  assert.equal(reply, null)
})

// ─────────────────────────────────────────────────────────────────────────────
// Cache stays bounded across multiple token rotations
// ─────────────────────────────────────────────────────────────────────────────

test('handleWorkerMessage: cache stays bounded across multiple template updates', () => {
  const state = freshState()
  for (let i = 0; i < 5; i++) {
    handleWorkerMessage(state, { type: 'setTemplates', token: `tok${i}`, templates })
    assert.ok(state.cache.size <= 1, `cache size should be ≤ 1 after update ${i}`)
  }
  assert.equal(state.cache.size, 1)
  assert.ok(state.cache.has('tok4'), 'only the latest token should remain')
})
