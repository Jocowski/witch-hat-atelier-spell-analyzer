// test/aibridge.test.js — unit tests for pure helpers in tools/ai-bridge.mjs
// and src/ai/reportCache.js (detectDisagreement).
// Run with: node --test test/aibridge.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTopicResponse } from '../tools/ai-bridge.mjs'
import { detectDisagreement } from '../src/ai/reportCache.js'

// ── parseTopicResponse ────────────────────────────────────────────────────────

test('parseTopicResponse: well-formed CONFIDENCE line is extracted and removed from markdown', () => {
  const raw = 'This spell launches a jet of water outward.\nCONFIDENCE: 0.85'
  const { markdown, confidence, effectClaim } = parseTopicResponse(raw)
  assert.equal(markdown, 'This spell launches a jet of water outward.')
  assert.equal(confidence, 0.85)
  assert.equal(effectClaim, null)
})

test('parseTopicResponse: missing CONFIDENCE line returns confidence: null', () => {
  const raw = 'This spell creates a wall of earth.'
  const { markdown, confidence } = parseTopicResponse(raw)
  assert.equal(markdown, 'This spell creates a wall of earth.')
  assert.equal(confidence, null)
})

test('parseTopicResponse: confidence value is clamped to [0, 1]', () => {
  const { confidence: above } = parseTopicResponse('text\nCONFIDENCE: 1.5')
  assert.equal(above, 1)
  const { confidence: below } = parseTopicResponse('text\nCONFIDENCE: -0.2')
  assert.equal(below, 0)
})

test('parseTopicResponse: CONFIDENCE: 0.0 is valid', () => {
  const { confidence } = parseTopicResponse('highly speculative\nCONFIDENCE: 0.0')
  assert.equal(confidence, 0)
})

test('parseTopicResponse: CONFIDENCE: 1.0 is valid', () => {
  const { confidence } = parseTopicResponse('rock solid\nCONFIDENCE: 1.0')
  assert.equal(confidence, 1)
})

test('parseTopicResponse: malformed float after CONFIDENCE: falls back to null', () => {
  const { confidence } = parseTopicResponse('text\nCONFIDENCE: abc')
  assert.equal(confidence, null)
})

test('parseTopicResponse: EFFECT_CLAIM JSON is parsed correctly (effect topic)', () => {
  const raw = [
    'Launches water outward in a column.',
    'CONFIDENCE: 0.9',
    'EFFECT_CLAIM: {"element":"water","primaryClause":"launch","direction":"outward"}',
  ].join('\n')
  const { markdown, confidence, effectClaim } = parseTopicResponse(raw)
  assert.equal(markdown, 'Launches water outward in a column.')
  assert.equal(confidence, 0.9)
  assert.deepEqual(effectClaim, { element: 'water', primaryClause: 'launch', direction: 'outward' })
})

test('parseTopicResponse: EFFECT_CLAIM with null direction', () => {
  const raw = [
    'Forms an earth wall.',
    'CONFIDENCE: 0.7',
    'EFFECT_CLAIM: {"element":"earth","primaryClause":"form","direction":null}',
  ].join('\n')
  const { effectClaim } = parseTopicResponse(raw)
  assert.deepEqual(effectClaim, { element: 'earth', primaryClause: 'form', direction: null })
})

test('parseTopicResponse: malformed EFFECT_CLAIM JSON returns null without throwing', () => {
  const raw = 'text\nCONFIDENCE: 0.6\nEFFECT_CLAIM: {broken json'
  let result
  assert.doesNotThrow(() => { result = parseTopicResponse(raw) })
  assert.equal(result.effectClaim, null)
  assert.equal(result.confidence, 0.6)
})

test('parseTopicResponse: EFFECT_CLAIM without CONFIDENCE — confidence is null, claim parsed', () => {
  // In practice this shouldn't happen (CONFIDENCE always comes first), but be robust.
  const raw = 'text\nEFFECT_CLAIM: {"element":"fire","primaryClause":"launch","direction":"outward"}'
  const { markdown, confidence, effectClaim } = parseTopicResponse(raw)
  assert.equal(confidence, null)
  assert.deepEqual(effectClaim, { element: 'fire', primaryClause: 'launch', direction: 'outward' })
  // 'text' should remain since neither line is a CONFIDENCE line
  assert.equal(markdown, 'text')
})

test('parseTopicResponse: multi-line markdown is preserved intact', () => {
  const raw = [
    '## Effect',
    '',
    'A jet of water launches outward.',
    '',
    'It is accurate and fast.',
    'CONFIDENCE: 0.82',
  ].join('\n')
  const { markdown } = parseTopicResponse(raw)
  assert.match(markdown, /## Effect/)
  assert.match(markdown, /A jet of water launches outward\./)
  assert.doesNotMatch(markdown, /CONFIDENCE/)
})

test('parseTopicResponse: trailing whitespace in raw string handled gracefully', () => {
  const raw = 'text\nCONFIDENCE: 0.75   \n  '
  const { confidence, markdown } = parseTopicResponse(raw)
  assert.equal(confidence, 0.75)
  assert.equal(markdown, 'text')
})

// ── detectDisagreement ────────────────────────────────────────────────────────

// Helper: build a minimal engineResult shape
function mkEngine({ element = 'fire', direction = 'outward' } = {}) {
  return {
    sigils: [{ element }],
    analysis: { direction },
  }
}

test('detectDisagreement: same element + same direction → false', () => {
  const engine = mkEngine({ element: 'fire', direction: 'outward' })
  const claim  = { element: 'fire', primaryClause: 'launch', direction: 'outward' }
  assert.equal(detectDisagreement(engine, claim), false)
})

test('detectDisagreement: different elements → true', () => {
  const engine = mkEngine({ element: 'fire', direction: 'outward' })
  const claim  = { element: 'earth', primaryClause: 'form', direction: 'outward' }
  assert.equal(detectDisagreement(engine, claim), true)
})

test('detectDisagreement: different non-null non-none directions → true', () => {
  const engine = mkEngine({ element: 'water', direction: 'outward' })
  const claim  = { element: 'water', primaryClause: 'launch', direction: 'inward' }
  assert.equal(detectDisagreement(engine, claim), true)
})

test('detectDisagreement: both directions null → false', () => {
  const engine = { sigils: [{ element: 'fire' }], analysis: { direction: null } }
  const claim  = { element: 'fire', primaryClause: 'launch', direction: null }
  assert.equal(detectDisagreement(engine, claim), false)
})

test('detectDisagreement: one direction "none" → false (not flagged)', () => {
  const engine = mkEngine({ element: 'fire', direction: 'none' })
  const claim  = { element: 'fire', primaryClause: 'launch', direction: 'outward' }
  assert.equal(detectDisagreement(engine, claim), false)
})

test('detectDisagreement: ai direction "none" → false (not flagged)', () => {
  const engine = mkEngine({ element: 'fire', direction: 'outward' })
  const claim  = { element: 'fire', primaryClause: 'launch', direction: 'none' }
  assert.equal(detectDisagreement(engine, claim), false)
})

test('detectDisagreement: null effectClaim → false', () => {
  const engine = mkEngine()
  assert.equal(detectDisagreement(engine, null), false)
})

test('detectDisagreement: null engineResult → false', () => {
  const claim = { element: 'fire', primaryClause: 'launch', direction: 'outward' }
  assert.equal(detectDisagreement(null, claim), false)
})

test('detectDisagreement: engine has no sigils array → false (not crash)', () => {
  const engine = { analysis: { direction: 'outward' } }
  const claim  = { element: 'earth', primaryClause: 'form', direction: 'outward' }
  // element comparison: engElement is null → no element mismatch flagged
  assert.equal(detectDisagreement(engine, claim), false)
})

test('detectDisagreement: claim has no element → false', () => {
  const engine = mkEngine({ element: 'fire', direction: 'outward' })
  const claim  = { primaryClause: 'launch', direction: 'outward' }
  assert.equal(detectDisagreement(engine, claim), false)
})

test('detectDisagreement: element match but direction differs → true', () => {
  const engine = mkEngine({ element: 'air', direction: 'upward' })
  const claim  = { element: 'air', primaryClause: 'form', direction: 'outward' }
  assert.equal(detectDisagreement(engine, claim), true)
})
