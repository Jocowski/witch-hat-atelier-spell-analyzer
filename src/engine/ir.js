// Numeric SpellIR assembly — SPEC-spell-ir.md §1.2 + §1.5.
// Derives a quantitative IR block from already-computed analysis facts.
// PURE MODULE — no JSON imports. All config arrives via the `cfg` argument
// (bound in analyze.js from RULES.irTuning). All tunables live in rules.json.
//
// Cross-agent contract (recognizer ↔ engine):
//   The recognizer writes `metrics: { directionalMagnitude: <number> }` onto sign components
//   after $P recognition. The engine reads it via `magnitudeOf(c)` in geometry.js
//   (c.metrics?.directionalMagnitude ?? c.scale ?? 1). ir.js receives the already-computed
//   `aim` object (from computeOrientationAim) which already incorporates those weights.
//
// `assembleSpellIR(facts, cfg)` — main export.
// `directionFromSurfaceVector(sv, force, cfg)` — exported for unit tests.
import { clamp, canSteer, CANVAS_RADIUS, computeContainment } from './geometry.js'

// ---------- 3D direction with tilt (SPEC §1.5) ----------
// Adapted from the sibling project's directionFromSurfaceVector() in spellDirection.js.
// Paper-plane frame: x = rightward, y = downward along the paper surface, z = out of paper.
// The repo's angle convention (atan2(x,-y), 0=north CW) maps to this frame without rotation:
//   vx_surface = sin(angle_rad), vy_surface = -cos(angle_rad)
// which is exactly the vx/vy produced by computeOrientationAim — no extra conversion needed.
//
// `sv`    — { x, y } surface vector (pre-normalisation, from aim.vx/aim.vy / aim.wsum)
// `force` — 0..1 (clamped) — stronger force tilts the effect toward the paper plane
// `cfg`   — irTuning block from rules.json
export function directionFromSurfaceVector(sv, force, cfg) {
  const surfaceMagnitude = Math.hypot(sv.x, sv.y)
  if (surfaceMagnitude < (cfg.minSurfaceDirectionMagnitude ?? 0.001)) {
    return { x: 0, y: 0, z: 1, xTiltDeg: 0, yTiltDeg: 0, tiltFromZDeg: 0 }
  }
  const f = clamp(force, 0, 1)
  const tiltFromZDeg = f * (cfg.forceTiltMaxDeg ?? 76)
  const tiltRadians = (tiltFromZDeg * Math.PI) / 180
  const surfaceScale = Math.sin(tiltRadians) / surfaceMagnitude
  const x = sv.x * surfaceScale
  const y = sv.y * surfaceScale
  const z = Math.cos(tiltRadians)
  const xTiltDeg = (Math.atan2(x, z) * 180) / Math.PI
  const yTiltDeg = (Math.atan2(y, z) * 180) / Math.PI
  const actualTilt = (Math.acos(clamp(z, -1, 1)) * 180) / Math.PI
  return { x, y, z, xTiltDeg, yTiltDeg, tiltFromZDeg: actualTilt }
}

// ---------- Main assembly ----------
// `facts` shape:
//   {
//     valid,        boolean
//     analysis,     { symmetry, power, signCount, linkCount, tilted, aim, powerLabel }
//     circle,       the raw circle object (for radius, linkCount, ring.closed, dyes)
//     signComps,    components with role 'sign' that are inside the ring
//     types,        Set<string> of sign type ids present (inside-ring)
//     aim,          result of computeOrientationAim — { aimed, angle, magnitude, vx, vy, wsum }
//     familyOf,     (typeId: string) => string | undefined — sign family lookup
//     grammarOps,   grammar.operators — to check sign kinds
//   }
// `cfg` — rules.json irTuning block
export function assembleSpellIR(facts, cfg) {
  const { valid, analysis, circle, signComps, types, aim, familyOf, grammarOps } = facts

  if (!valid) {
    return {
      force: 0, spread: 0, focus: 0, range: 0,
      duration: 0, stability: 0,
      gravity: 1, dirCoherence: 0,
      direction: { x: 0, y: 0, z: 1, xTiltDeg: 0, yTiltDeg: 0, tiltFromZDeg: 0 },
    }
  }

  const insideSignCount = (signComps || []).filter((c) => c.zone !== 'outside').length
  const circlePower = analysis.power ?? 0
  const dirCoherence = aim?.magnitude ?? 0
  const symmetry = analysis.symmetry ?? 'none'
  const signCount = analysis.signCount ?? 0
  const circleRadius = circle?.radius ?? null

  // --- force ---
  const signPowerContrib = insideSignCount * (cfg.forceSignPower ?? 0.08)
  const scalePowerContrib = circlePower * (cfg.forcePowerScale ?? 0.24)
  const force = clamp((cfg.forceBase ?? 0.34) + signPowerContrib + scalePowerContrib)

  // --- spread ---
  const spread = clamp((cfg.spreadBase ?? 0.32) + (1 - dirCoherence) * (cfg.spreadInverseCoherence ?? 0.28))

  // --- focus ---
  let focus = clamp((cfg.focusBase ?? 0.46) + dirCoherence * (cfg.focusCoherence ?? 0.20))
  if (types && types.has('convergence')) {
    focus = clamp(focus + (cfg.focusConvergenceBonus ?? 0.15))
  }

  // --- range ---
  const signCountContrib = signCount * (cfg.rangeSignPower ?? 0.05)
  const ringContrib = circleRadius != null
    ? (circleRadius / CANVAS_RADIUS) * (cfg.rangeRingScale ?? 0.20)
    : 0
  const range = clamp((cfg.rangeBase ?? 0.42) + signCountContrib + ringContrib)

  // --- duration ---
  const symmetryScores = { radial: 1.0, bilateral: 0.7, asymmetric: 0.3, none: 0.0 }
  const symmetryScore = symmetryScores[symmetry] ?? 0
  const powerScore = clamp(circlePower)
  const qualityScore = clamp(
    symmetryScore * (cfg.durationSymmetryWeight ?? 0.55) +
    powerScore * (cfg.durationPowerWeight ?? 0.45),
  )
  const dMin = cfg.durationMinSec ?? 0.65
  const dMax = cfg.durationMaxSec ?? 8.5
  const duration = clamp(
    dMin + Math.pow(qualityScore, cfg.durationCurve ?? 1.45) * (cfg.durationSecondsScale ?? 6.4),
    dMin,
    dMax,
  )

  // --- stability ---
  const stabilityMap = cfg.stabilityMap ?? { radial: 1.0, bilateral: 0.7, asymmetric: 0.3, none: 0.5 }
  const stability = stabilityMap[symmetry] ?? 0.5

  // --- gravity ---
  const levitationSigns = (signComps || []).filter((c) => {
    if (c.zone === 'outside') return false
    const op = grammarOps?.[c.type]
    return op?.kind === 'motion' && canSteer(familyOf ? familyOf(c.type) : null)
  })
  const levCount = levitationSigns.length
  const liftStrength = levCount / (cfg.gravityLevitationDivisor ?? 3)
  let gravity = clamp(1 - liftStrength * (cfg.gravityLevitationScale ?? 0.42))

  // --- containment (orb-container model, SPEC-orb-container §L4) ---
  // isContainer is built from grammarOps (same source used for all other operator checks) so this
  // module stays JSON-free. signComps is the same list used for levitation above.
  const isContainer = (type) => grammarOps?.[type]?.container === 'sphere'
  const containment = computeContainment(signComps || [], familyOf ?? (() => null), isContainer)

  // --- 3D direction ---
  // Surface vector from computeOrientationAim (vx/vy already in the paper-plane frame).
  const wsum = aim?.wsum ?? 0
  const sv = wsum > 0
    ? { x: (aim?.vx ?? 0) / wsum, y: (aim?.vy ?? 0) / wsum }
    : { x: 0, y: 0 }
  let direction = directionFromSurfaceVector(sv, force, cfg)

  // --- container overrides ---
  // When the spell has a container form (orb): the substance rises into the suspended sphere rather
  // than jetting laterally. Suppress the in-plane aim (scale x/y down) and ensure a positive z so
  // particles climb into the vessel. Gravity drops to a low "floating" value.
  if (containment) {
    // Gravity: the sphere floats — clamp to cfg.containerGravity (default 0.15)
    gravity = clamp(Math.min(gravity, cfg.containerGravity ?? 0.15))
    // Direction: preserve shape (same keys) but suppress lateral jet
    const lateralScale = cfg.containerLateralScale ?? 0.15
    const z = Math.max(direction.z, cfg.containerMinZ ?? 0.3)
    const x = direction.x * lateralScale
    const y = direction.y * lateralScale
    // Re-derive tilt angles from the clamped vector (it may no longer be unit-length after scaling)
    const xTiltDeg = (Math.atan2(x, z) * 180) / Math.PI
    const yTiltDeg = (Math.atan2(y, z) * 180) / Math.PI
    const tiltFromZDeg = (Math.acos(clamp(z, -1, 1)) * 180) / Math.PI
    direction = { x, y, z, xTiltDeg, yTiltDeg, tiltFromZDeg }

    return {
      force, spread, focus, range, duration, stability, gravity, dirCoherence, direction,
      contained: true,
      containRadius: containment.radiusFrac,
      fillRate: containment.fillFrac,
      capacity: containment.capacity,
    }
  }

  return { force, spread, focus, range, duration, stability, gravity, dirCoherence, direction }
}
