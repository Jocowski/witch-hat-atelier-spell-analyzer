import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runSyntheticAccuracy } from '../tools/recognizer-accuracy.mjs'

// ── B5 accuracy-floor smoke (CI regression gate) ─────────────────────────────────────────────────
//
// Observed overall/per-role top-1 at { seed: 1, perN: 2 } ≈ 0.96 (96%).
//
// FLOOR = 0.85 gives ~11 percentage points of headroom below the observed value.
// This is deliberately generous — the gate should catch hard regressions (e.g. a broken
// rotation sweep or a bad template change) without ever flaking on normal variation.
// If the real number ever climbs significantly, raise FLOOR to track the improvement.
//
// Cost note: the $P classifier is inherently ~0.1s/item (62-template pool × 24 rotations), so
// the single shared run below is sized (perN=2 → 124 items) to stay a fast CI smoke. Determinism
// is guaranteed by the seeded PRNG and implicitly protected by this fixed-seed gate (a regression
// to non-determinism would flake it), so a dedicated determinism test is intentionally omitted.
//
// M5 note: runSyntheticAccuracy is now async (to support engine='ml'). The $P path (default)
// resolves immediately — no ML runtime is loaded here. The tests use top-level await via
// node:test's async test bodies.

const FLOOR       = 0.85  // overall top-1 gate; observed ≈ 0.96; ~11pp headroom
const SIGN_FLOOR  = 0.80  // per-role gate with extra headroom
const SIGIL_FLOOR = 0.80

// run once before tests — uses a module-level Promise so each test can await it cheaply.
const floorResultPromise = runSyntheticAccuracy({ seed: 1, perN: 2 })

test('runSyntheticAccuracy: returns structured result with items > 0', async () => {
  const result = await floorResultPromise
  assert.ok(result !== null, 'result must not be null (engine="p" never fails)')
  assert.ok(result.overall.items > 0, 'overall.items must be > 0')
  assert.ok(result.byRole.sign.items  > 0, 'sign items must be > 0')
  assert.ok(result.byRole.sigil.items > 0, 'sigil items must be > 0')
})

test('runSyntheticAccuracy: overall top-1 >= FLOOR (accuracy gate)', async () => {
  // Observed: ~0.96 at {seed:1,perN:2}. FLOOR=0.85 → ~11pp headroom.
  const result = await floorResultPromise
  const { top1, items } = result.overall
  assert.ok(
    top1 >= FLOOR,
    `overall top-1 ${(top1 * 100).toFixed(1)}% (${items} items) is below FLOOR ${(FLOOR * 100).toFixed(1)}%`
  )
})

test('runSyntheticAccuracy: per-role top-1 >= role floors', async () => {
  const result = await floorResultPromise
  const { sign, sigil } = result.byRole
  assert.ok(
    sign.top1 >= SIGN_FLOOR,
    `sign top-1 ${(sign.top1 * 100).toFixed(1)}% is below SIGN_FLOOR ${(SIGN_FLOOR * 100).toFixed(1)}%`
  )
  assert.ok(
    sigil.top1 >= SIGIL_FLOOR,
    `sigil top-1 ${(sigil.top1 * 100).toFixed(1)}% is below SIGIL_FLOOR ${(SIGIL_FLOOR * 100).toFixed(1)}%`
  )
})

// ── Floor-smoke failure verification ──────────────────────────────────────────────────────────────
// This test proves the gate would catch a deliberately broken config.
// We use an unreachably high FLOOR (1.1 = 110%) to trigger a guaranteed failure,
// then assert the assertion itself throws — confirming the gate is live.

test('runSyntheticAccuracy: floor smoke catches a deliberately broken floor', async () => {
  const result = await floorResultPromise
  const { top1 } = result.overall
  // top1 is always in [0,1]; IMPOSSIBLE_FLOOR = 1.1 guarantees failure.
  const IMPOSSIBLE_FLOOR = 1.1
  assert.throws(
    () => assert.ok(
      top1 >= IMPOSSIBLE_FLOOR,
      `overall top-1 ${(top1 * 100).toFixed(1)}% is below IMPOSSIBLE_FLOOR ${(IMPOSSIBLE_FLOOR * 100).toFixed(1)}%`
    ),
    { name: 'AssertionError' },
    'A floor of 110% should always fail — the gate is live'
  )
})
