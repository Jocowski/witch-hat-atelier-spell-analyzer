// symbolStore.js — the single runtime source of truth for symbol data (sigils/signs/grammar).
//
// Holds the JSON baseline ⊕ the DB overlay (see symbolMerge.js). Initialised SYNCHRONOUSLY to the
// pure JSON baseline, so first paint, the no-DB path, and the legacy behaviour are byte-identical to
// before. applyOverlay() replaces the snapshot and notifies subscribers; data.js / analyze.js /
// SymbolPalette read getSnapshot() so an Admin edit propagates to the drawing app at runtime.
//
// This is the ONLY app module that binds these JSON files (Vite-style imports), so it must not be
// loaded by `node --test` — the pure merge logic lives in symbolMerge.js and is tested there.
import sigilsDoc from '../../../data/sigils.json'
import signsDoc from '../../../data/signs.json'
import grammar from '../../../data/grammar.json'
import { mergeSymbols } from '#domain/engine/symbolMerge.js'

const baseline = {
  sigils: sigilsDoc.sigils,
  signs: signsDoc.signs,
  grammar,
}

const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]))

function buildSnapshot(merged) {
  return {
    sigils: merged.sigils,
    signs: merged.signs,
    grammar: merged.grammar,
    sigilMap: byId(merged.sigils),
    signMap: byId(merged.signs),
  }
}

// Current snapshot — starts as the pure baseline (no overlay).
let snapshot = buildSnapshot(baseline)

const subscribers = new Set()

export function getSnapshot() {
  return snapshot
}

/** Subscribe to snapshot changes (for React useSyncExternalStore). Returns an unsubscribe fn. */
export function subscribe(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

/** Merge DB rows over the baseline and publish the new snapshot. Pass [] to reset to baseline. */
export function applyOverlay(dbRows) {
  snapshot = buildSnapshot(mergeSymbols(baseline, dbRows || []))
  for (const fn of subscribers) fn()
}

// Render defaults stay static (they're not overlaid).
export const SIGIL_RENDER_DEFAULTS = sigilsDoc.renderDefaults
export const SIGN_RENDER_DEFAULTS = signsDoc.renderDefaults
