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

// Blood dye grows the held orb. Multiplier is modest (not BLOOD_POWER itself, which would dwarf the
// stage) and capped so the sphere stays on-screen above the seal.
const BLOOD_ORB_GROWTH = 1.6
const BLOOD_ORB_RADIUS_MAX = 1.25

/**
 * buildSpellIRShim(result, ringClosed, activatedAt)
 *
 * result       — return value from analyze()
 * ringClosed   — boolean from the recognizer's ring detection
 * activatedAt  — performance.now() timestamp when the activation event was detected
 *
 * Returns a SpellIR object suitable for feeding into SpellEffectRenderer.
 */
export function buildSpellIRShim(result, ringClosed, activatedAt, opts = {}) {
  if (!result) return null

  // Element: derive from the primary sigil family (first sigil in the result)
  const primarySigil = result.sigils?.[0]
  const element = primarySigil?.family ?? primarySigil?.element ?? 'fire'

  // Signature: stable string for particle reset (rebuild on composition change)
  const signature = buildSignature(result)

  // Use the real spellIR block if available (analyze() emits it)
  const base = result.spellIR ?? {}
  const power = opts.power ?? 1 // Blood dye → dramatic amplification (see params below)

  return {
    // Core validity / activation
    valid: result.valid ?? false,
    active: ringClosed ?? true,
    prepared: !ringClosed,
    activatedAt: activatedAt ?? null,

    // Element routing
    element,

    // Numeric params from real SpellIR when available; fallback to sensible defaults.
    // `power` (Blood dye) is a dramatic amplifier — canon: blood turns a simple light spell into a
    // giant flash, an earth-crush into a canyon. We don't simulate 1000×, but a powered cast erupts
    // much bigger (effectScale), faster/farther (force/range), and wider (spread). `duration`
    // overrides the run length (Azuremoon dye doubles it).
    force: Math.min(2.2, (base.force ?? 0.5) * (power > 1 ? 3 : 1)),
    spread: power > 1 ? Math.min(1, (base.spread ?? 0.4) + 0.32) : (base.spread ?? 0.4),
    focus: base.focus ?? 0.6,
    range: power > 1 ? Math.min(1.6, (base.range ?? 0.5) * 1.7) : (base.range ?? 0.5),
    duration: opts.duration ?? base.duration ?? 3.0,
    effectScale: power > 1 ? 2.6 : (base.effectScale ?? 1),
    stability: base.stability ?? 0.7,
    gravity: base.gravity ?? 1.0,
    dirCoherence: base.dirCoherence ?? 0,
    // Direction drives WHERE the effect goes. Prefer the caller's einlair-derived direction
    // (radial x/y + upward z), falling back to the engine block, then a gentle upward spout.
    direction: opts.direction ?? base.direction ?? { x: 0, y: 0, z: 1, xTiltDeg: 0, yTiltDeg: 0, tiltFromZDeg: 0 },

    // Container (orb) fields — forwarded straight from the engine IR so the renderer's
    // contained-fill branch runs. Without these the low-gravity water falls into "suspended"
    // mode and the sphere pops in all at once instead of filling bottom-to-top.
    // Blood dye amplifies the vessel too: drawing the orb sigils in blood grows the held sphere
    // (canon: blood makes the same seal erupt dramatically bigger). The orb radius is the visual
    // lever (sphereRadius = ring.radius * containRadius), so scale it with the powered cast.
    contained: base.contained ?? false,
    containRadius:
      base.containRadius != null
        ? Math.min(BLOOD_ORB_RADIUS_MAX, base.containRadius * (power > 1 ? BLOOD_ORB_GROWTH : 1))
        : base.containRadius,
    fillRate: base.fillRate,
    capacity: power > 1 && base.capacity != null ? base.capacity * BLOOD_ORB_GROWTH : base.capacity,

    // Quality (used for partial-failure threshold)
    quality: base.quality ?? 1.0,

    // Practice trial: keep the stream emitting continuously (no end-of-duration fade).
    sustain: !!opts.sustain,

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
