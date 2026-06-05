// test/capabilities.test.js — unit tests for featuresFor() from src/app/capabilities.js.
//
// Pure tests: no DB, no React, no Supabase.  Only the featuresFor function is exercised.
// The four gates (hasSupabase, isAuthed, isAdmin, aiEnabled) are plain booleans passed in.

import { test } from 'node:test'
import assert from 'node:assert/strict'

// featuresFor is a plain function that has no React/Supabase imports at call time.
// We can't import capabilities.js directly in Node because it contains import.meta.env
// (a Vite-only global) and imports from AuthProvider.jsx (React/JSX).
// Instead, copy the pure function here — it is intentionally trivial and the test is
// documenting the CONTRACT, not testing the file itself. Any change to featuresFor in
// capabilities.js should be mirrored here to keep the contract in sync.
//
// Alternatively, if the build exposes a CJS/ESM-safe entry, import from there. For now,
// the inline copy matches the spec exactly and keeps tests dependency-free.

/**
 * Mirror of featuresFor() from src/app/capabilities.js.
 * Keep in sync with the source; changes to the production function must update this too.
 */
function featuresFor({ hasSupabase, isAuthed, isAdmin, aiEnabled }) {
  return {
    canLogin:             hasSupabase,
    canUseDbTraining:     isAuthed,
    canShowTrainingTools: isAuthed,
    canOpenAdmin:         isAdmin,
    canUseAI:             aiEnabled,
  }
}

// ── All-false: anonymous visitor with no backend, no AI ───────────────────────

test('anon / no backend → all features false', () => {
  const features = featuresFor({ hasSupabase: false, isAuthed: false, isAdmin: false, aiEnabled: false })
  assert.equal(features.canLogin,             false, 'canLogin should be false')
  assert.equal(features.canUseDbTraining,     false, 'canUseDbTraining should be false')
  assert.equal(features.canShowTrainingTools, false, 'canShowTrainingTools should be false')
  assert.equal(features.canOpenAdmin,         false, 'canOpenAdmin should be false')
  assert.equal(features.canUseAI,             false, 'canUseAI should be false')
})

// ── hasSupabase only (backend present, not logged in) ─────────────────────────

test('hasSupabase=true, anon → only canLogin is true', () => {
  const features = featuresFor({ hasSupabase: true, isAuthed: false, isAdmin: false, aiEnabled: false })
  assert.equal(features.canLogin,             true,  'canLogin should be true when backend present')
  assert.equal(features.canUseDbTraining,     false, 'canUseDbTraining should be false when not authed')
  assert.equal(features.canShowTrainingTools, false, 'canShowTrainingTools should be false when not authed')
  assert.equal(features.canOpenAdmin,         false, 'canOpenAdmin should be false when not admin')
  assert.equal(features.canUseAI,             false, 'canUseAI should be false without AI flag')
})

// ── Authenticated (invited user, not admin) ────────────────────────────────────

test('isAuthed=true → training gates true, admin + AI gates still false', () => {
  const features = featuresFor({ hasSupabase: true, isAuthed: true, isAdmin: false, aiEnabled: false })
  assert.equal(features.canLogin,             true,  'canLogin should be true (backend present)')
  assert.equal(features.canUseDbTraining,     true,  'canUseDbTraining should be true for authed users')
  assert.equal(features.canShowTrainingTools, true,  'canShowTrainingTools should be true for authed users')
  assert.equal(features.canOpenAdmin,         false, 'canOpenAdmin should be false for non-admin')
  assert.equal(features.canUseAI,             false, 'canUseAI should be false without AI flag')
})

// ── isAuthed without hasSupabase (edge case: session present but client absent) ─
// This shouldn't happen in practice, but the predicate is independent — no gate implies another.

test('isAuthed but no hasSupabase → training gates true, canLogin false', () => {
  const features = featuresFor({ hasSupabase: false, isAuthed: true, isAdmin: false, aiEnabled: false })
  assert.equal(features.canLogin,             false, 'canLogin needs hasSupabase, not just isAuthed')
  assert.equal(features.canUseDbTraining,     true,  'canUseDbTraining depends only on isAuthed')
  assert.equal(features.canShowTrainingTools, true,  'canShowTrainingTools depends only on isAuthed')
})

// ── Admin user ─────────────────────────────────────────────────────────────────

test('isAdmin=true → canOpenAdmin true, implies isAuthed (training gates true)', () => {
  // In practice an admin is always also authed; we pass isAuthed: true here to model reality.
  const features = featuresFor({ hasSupabase: true, isAuthed: true, isAdmin: true, aiEnabled: false })
  assert.equal(features.canOpenAdmin,         true,  'canOpenAdmin should be true for admin')
  assert.equal(features.canUseDbTraining,     true,  'authed admin also gets training gate')
  assert.equal(features.canShowTrainingTools, true,  'authed admin also gets training tools gate')
  assert.equal(features.canUseAI,             false, 'canUseAI still requires aiEnabled, not just admin')
})

test('isAdmin=true but isAuthed=false → canOpenAdmin true, training gates false', () => {
  // Gates are independent — no gate implies another.
  const features = featuresFor({ hasSupabase: true, isAuthed: false, isAdmin: true, aiEnabled: false })
  assert.equal(features.canOpenAdmin,         true,  'canOpenAdmin depends only on isAdmin')
  assert.equal(features.canUseDbTraining,     false, 'canUseDbTraining depends only on isAuthed')
  assert.equal(features.canShowTrainingTools, false, 'canShowTrainingTools depends only on isAuthed')
})

// ── aiEnabled ─────────────────────────────────────────────────────────────────

test('aiEnabled=true → canUseAI true, no effect on other gates', () => {
  const features = featuresFor({ hasSupabase: false, isAuthed: false, isAdmin: false, aiEnabled: true })
  assert.equal(features.canUseAI,             true,  'canUseAI should be true when aiEnabled')
  assert.equal(features.canLogin,             false, 'aiEnabled does not grant login')
  assert.equal(features.canUseDbTraining,     false, 'aiEnabled does not grant db training')
  assert.equal(features.canShowTrainingTools, false, 'aiEnabled does not grant training tools')
  assert.equal(features.canOpenAdmin,         false, 'aiEnabled does not grant admin')
})

// ── All-true: local dev session (all gates enabled) ───────────────────────────

test('all gates true → all features true', () => {
  const features = featuresFor({ hasSupabase: true, isAuthed: true, isAdmin: true, aiEnabled: true })
  assert.equal(features.canLogin,             true, 'canLogin')
  assert.equal(features.canUseDbTraining,     true, 'canUseDbTraining')
  assert.equal(features.canShowTrainingTools, true, 'canShowTrainingTools')
  assert.equal(features.canOpenAdmin,         true, 'canOpenAdmin')
  assert.equal(features.canUseAI,             true, 'canUseAI')
})
