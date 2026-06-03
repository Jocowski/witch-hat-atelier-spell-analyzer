// Regression guard: wha-lang must be able to express EVERY catalog spell.
// Reconstructs each data/spells.json entry through wha-lang and validates the emitted
// IR through the real engine (no unknownIds, valid, no dropped signs). Catches both a
// wha-lang regression and a bad/typo'd catalog id. See tools/wha-lang-catalog-check.mjs.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkCatalog } from '../tools/wha-lang-catalog-check.mjs'

test('wha-lang reconstructs every catalog spell (no gaps)', () => {
  const { ok, total, gaps } = checkCatalog()
  assert.equal(
    gaps.length,
    0,
    `wha-lang could not express ${gaps.length}/${total} catalog spells:\n` +
      gaps.map(([n, w]) => `  - ${n}: ${w}`).join('\n'),
  )
  assert.equal(ok, total, `expected all ${total} reconstructed, got ${ok}`)
})
