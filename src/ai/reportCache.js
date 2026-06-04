/**
 * src/ai/reportCache.js — Pure helpers for AI report caching.
 *
 * All exports are pure (no JSON imports, no DOM, no framework deps) so they
 * can be unit-tested with `node --test` directly.
 *
 * Exports:
 *   REPORT_VERSION      — bump to invalidate all cached reports when prompts change
 *   stableStringify(obj) → string      — recursive key-sort for deterministic JSON
 *   fnv32a(str)          → string      — FNV-1a 32-bit hash as lowercase hex
 *   compositionHash(composition, topicIds) → string  — the cache key
 */

/**
 * Bump this when the bridge prompt templates change enough to warrant re-running
 * all cached reports. A version change produces a different hash, so all existing
 * cache entries are naturally invalidated (they won't be queried any more).
 */
export const REPORT_VERSION = '1.0'

// ── Stable stringify ──────────────────────────────────────────────────────────

/**
 * Recursively sort object keys so that JSON.stringify produces the same string
 * regardless of insertion order. Arrays are preserved in order; primitives are
 * returned as-is.
 *
 * @param {*} v
 * @returns {*}  The same value/structure with objects having sorted keys.
 */
function sortKeys(v) {
  if (v === null || typeof v !== 'object') return v
  if (Array.isArray(v)) return v.map(sortKeys)
  return Object.keys(v)
    .sort()
    .reduce((acc, k) => {
      acc[k] = sortKeys(v[k])
      return acc
    }, {})
}

/**
 * Deterministic JSON stringify: keys are sorted recursively.
 *
 * @param {*} obj
 * @returns {string}
 */
export function stableStringify(obj) {
  return JSON.stringify(sortKeys(obj))
}

// ── FNV-1a 32-bit ─────────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash over a UTF-16 string (each char treated as a code unit).
 * Fast, no crypto dependency, collision risk negligible for this use case.
 *
 * Returns an 8-character lowercase hex string (zero-padded to 32 bits).
 *
 * @param {string} str
 * @returns {string}  e.g. "a1b2c3d4"
 */
export function fnv32a(str) {
  let h = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    // Multiply by FNV prime (0x01000193), keeping result in 32-bit unsigned range.
    // JavaScript bitwise ops work on signed 32-bit integers, so we split the
    // multiplication to avoid sign-extension artefacts.
    h = (Math.imul(h, 0x01000193) >>> 0)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

// ── Disagreement detection ────────────────────────────────────────────────────

/**
 * Compare the engine's deterministic result against the AI's `effectClaim`
 * (from the `effect` topic SSE payload) and return true when they structurally
 * disagree on element or direction.
 *
 * This is intentionally cheap and conservative — it only flags clear
 * mismatches, not stylistic differences.  Verb/primaryClause comparison is
 * deliberately omitted to avoid false positives from vocabulary differences.
 *
 * @param {object|null} engineResult  The object returned by `analyze(composition)`.
 * @param {object|null} effectClaim   The parsed EFFECT_CLAIM from the AI response:
 *                                    { element, primaryClause, direction }
 * @returns {boolean}
 */
export function detectDisagreement(engineResult, effectClaim) {
  if (!effectClaim || !engineResult) return false

  const engElement   = engineResult.sigils?.[0]?.element ?? null
  const engDirection = engineResult.analysis?.direction  ?? null

  // Element mismatch: different non-null elements (both must be present to compare).
  if (engElement && effectClaim.element && engElement !== effectClaim.element) return true

  // Direction mismatch: only flag when both are non-null, non-"none", and explicitly differ.
  const dirMismatch =
    engDirection && engDirection !== 'none' &&
    effectClaim.direction && effectClaim.direction !== 'none' &&
    engDirection !== effectClaim.direction
  if (dirMismatch) return true

  return false
}

// ── Composition hash ──────────────────────────────────────────────────────────

/**
 * Compute the cache key for a (composition, topics, reportVersion) tuple.
 *
 * Same composition + same topics + same REPORT_VERSION → same key every time.
 * Any change to any of the three inputs → different key.
 *
 * @param {object}          composition  The wha-spell composition object.
 * @param {Iterable<string>} topicIds    The selected topic ids (any order — sorted internally).
 * @returns {string}  8-char hex hash.
 */
export function compositionHash(composition, topicIds) {
  const payload = stableStringify({
    spell: composition,
    topics: [...topicIds].sort(),
    reportVersion: REPORT_VERSION,
  })
  return fnv32a(payload)
}
