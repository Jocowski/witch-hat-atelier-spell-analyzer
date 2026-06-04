// spellIRShim.js — Minimal SpellIR shim built from the existing analyze() result.
// Used for Phase R1–R4 until the full SPEC-spell-ir.md compiler is in place.
// Delete this file in Phase R5 when spellIR is emitted directly by analyze().
//
// NOTE: analyze() ALREADY emits a real spellIR block (see src/engine/ir.js + analyze.js).
// This shim only fills in the fields the renderer needs that are NOT yet in the engine IR:
//   - element (primary sigil family)
//   - valid
//   - active / prepared (ring state)
//   - activatedAt
//   - signature (stable string for particle reset)
// All numeric params (force/spread/focus/range/duration/stability/gravity/direction) are
// forwarded from the real spellIR when present.

/**
 * buildSpellIRShim(result, ringClosed, activatedAt)
 *
 * result       — return value from analyze()
 * ringClosed   — boolean from the recognizer's ring detection
 * activatedAt  — performance.now() timestamp when the activation event was detected
 *
 * Returns a SpellIR object suitable for feeding into SpellEffectRenderer.
 */
export function buildSpellIRShim(result, ringClosed, activatedAt) {
  if (!result) return null

  // Element: derive from the primary sigil family (first sigil in the result)
  const primarySigil = result.sigils?.[0]
  const element = primarySigil?.family ?? primarySigil?.element ?? 'fire'

  // Signature: stable string for particle reset (rebuild on composition change)
  const signature = buildSignature(result)

  // Use the real spellIR block if available (analyze() emits it)
  const base = result.spellIR ?? {}

  return {
    // Core validity / activation
    valid: result.valid ?? false,
    active: ringClosed ?? true,
    prepared: !ringClosed,
    activatedAt: activatedAt ?? null,

    // Element routing
    element,

    // Numeric params from real SpellIR when available; fallback to sensible defaults
    force: base.force ?? 0.5,
    spread: base.spread ?? 0.4,
    focus: base.focus ?? 0.6,
    range: base.range ?? 0.5,
    duration: base.duration ?? 3.0,
    stability: base.stability ?? 0.7,
    gravity: base.gravity ?? 1.0,
    dirCoherence: base.dirCoherence ?? 0,
    direction: base.direction ?? { x: 0, y: 0, z: 1, xTiltDeg: 0, yTiltDeg: 0, tiltFromZDeg: 0 },

    // Quality (used for partial-failure threshold)
    quality: base.quality ?? 1.0,

    // Signature for particle flush
    signature,
  }
}

// ── Signature builder ─────────────────────────────────────────────────────────
// A simple but stable string that changes whenever the spell composition changes.
// We use the deduction text + sigil list + sign list — changes on any symbol change.
function buildSignature(result) {
  const sigilIds = (result.sigils ?? []).map((s) => s.id ?? s.type ?? '').join(',')
  const signIds = (result.signs ?? []).map((s) => s.id ?? s.type ?? '').join(',')
  const deduction = result.deduction?.effect ?? result.deduction?.text ?? ''
  return `${sigilIds}|${signIds}|${deduction}`
}
