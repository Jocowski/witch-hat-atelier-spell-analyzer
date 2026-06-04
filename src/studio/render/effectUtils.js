// effectUtils.js — Pure shared helpers for particle effect modules.
// PURE MODULE — no JSON imports. All config arrives via function arguments.
// Ported and adapted from wha-spell-simulator/src/renderer/effects/effectUtils.js.

// ── Math helpers ─────────────────────────────────────────────────────────────

export function clamp(v, lo = 0, hi = 1) {
  return Math.min(Math.max(v, lo), hi)
}

export function randomBetween(a, b) {
  return a + Math.random() * (b - a)
}

export function normalizeVector(v) {
  const mag = Math.hypot(v.x, v.y)
  if (mag < 1e-9) return { x: 0, y: -1 }
  return { x: v.x / mag, y: v.y / mag }
}

export function perpendicularVector(v) {
  return { x: -v.y, y: v.x }
}

// ── SpellIR param accessors ─────────────────────────────────────────────────

export function effectScale(spellIR) {
  return Math.max(1, spellIR?.effectScale ?? 1)
}

export function effectOpacity(spellIR) {
  return clamp(spellIR?.emission ?? 1)
}

export function effectGravity(spellIR) {
  return clamp(spellIR?.gravity ?? 1)
}

export function effectFocus(spellIR) {
  return clamp(spellIR?.focus ?? 0.5)
}

export function effectSuspension(spellIR) {
  return 1 - effectGravity(spellIR)
}

// ── Particle alpha helpers ───────────────────────────────────────────────────

export function particleAlpha(particle) {
  return clamp(1 - particle.age / particle.life)
}

export function steadyParticleAlpha(particle, spellIR, fadeInFrames = 10) {
  return Math.min(1, particle.age / fadeInFrames) * effectOpacity(spellIR)
}

export function particleDepth(particle) {
  return clamp(particle.age / Math.max(1, particle.life))
}

// ── Lifetime helpers ─────────────────────────────────────────────────────────

export function spellLifetimeFrames(spellIR, extraFrames = 36) {
  const durationSeconds = Number(spellIR?.duration)
  return Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds * 60 + extraFrames
    : 600
}

// ── Portal / ring helpers ────────────────────────────────────────────────────

// The activated paper is drawn as a tilted ellipse; effects emit from that same screen-space portal.
export function activePortalPlane(canvas, ring) {
  const scaleY = 0.44
  const originY = canvas.height * 0.64
  const liftY = canvas.height * 0.16
  return {
    center: {
      x: ring.center.x,
      y: originY + (ring.center.y - originY) * scaleY + liftY,
    },
    radiusX: ring.radius,
    radiusY: ring.radius * scaleY,
    scaleY,
  }
}

export function randomPortalPoint(portal, radiusXScale = 1, radiusYScale = radiusXScale) {
  const angle = Math.random() * Math.PI * 2
  const radius = Math.sqrt(Math.random())
  return {
    x: portal.center.x + Math.cos(angle) * portal.radiusX * radiusXScale * radius,
    y: portal.center.y + Math.sin(angle) * portal.radiusY * radiusYScale * radius,
  }
}

// Convert paper-local x/y/z direction into screen space. Positive z points out of the paper toward the top.
export function portalOutDirection(spellIR) {
  const direction = spellIR?.direction ?? {}
  const paperX = direction.x ?? 0
  const paperY = direction.y ?? -1
  const paperZ = direction.z ?? 0
  const paperYScreenScale = 0.44

  return normalizeVector({
    x: paperX,
    y: paperY * paperYScreenScale - paperZ,
  })
}

// ── Flow helpers ─────────────────────────────────────────────────────────────

// Shared element flow base for modules that use direction+convergence
export function elementFlow(spellIR, portal, frame) {
  const direction = portalOutDirection(spellIR)
  return {
    direction,
    side: perpendicularVector(direction),
    scale: effectScale(spellIR),
    focus: effectFocus(spellIR),
    convergence: convergenceFlow(spellIR, portal, frame),
  }
}

// Focus narrows the source area. Convergence narrows it further.
export function narrowedByFocusAndConvergence(value, focus, convergenceStrength, focusWeight, convergenceWeight) {
  return value * (1 - convergenceStrength * convergenceWeight) * (1 - focus * focusWeight)
}

// ── Convergence ──────────────────────────────────────────────────────────────

function smoothstep(value) {
  const c = clamp(value)
  return c * c * (3 - 2 * c)
}

function effectConvergence(spellIR) {
  const convergence = spellIR?.manifestations?.convergence ?? {}
  const strength = clamp(spellIR?.manifestations?.convergence?.strength ?? 0)
  return {
    strength,
    point: {
      x: clamp(convergence.point?.x ?? 0, -1, 1),
      y: clamp(convergence.point?.y ?? 0, -1, 1),
    },
    radius: clamp(convergence.radius ?? 0.14, 0.03, 0.6),
    rigidity: clamp(convergence.rigidity ?? strength),
  }
}

export function convergenceFlow(spellIR, portal, frame) {
  const convergence = effectConvergence(spellIR)
  const active = convergence.strength > 0.001
  const lifetime = spellLifetimeFrames(spellIR, 0)
  const shrinkFrames = Math.max(18, lifetime * 0.26)
  const progress = active ? convergence.strength * smoothstep(frame / shrinkFrames) : 0
  const direction = portalOutDirection(spellIR)
  const side = perpendicularVector(direction)
  const origin = {
    x: portal.center.x + side.x * convergence.point.x * portal.radiusX + direction.x * convergence.point.y * portal.radiusY,
    y: portal.center.y + side.y * convergence.point.x * portal.radiusX + direction.y * convergence.point.y * portal.radiusY,
  }

  return {
    active,
    strength: convergence.strength,
    progress,
    rigidity: convergence.rigidity,
    origin,
    direction,
    side,
    radiusX: portal.radiusX * convergence.radius,
    radiusY: portal.radiusY * convergence.radius,
    life: lifetime + 36,
  }
}

// Convergence keeps forward motion and compresses only the sideways spread around that path.
export function convergePoint(point, convergence, phase = 0, radiusScale = 1) {
  if (!convergence?.active || convergence.progress <= 0) {
    return point
  }

  const finalSpread = 0.18 + (1 - convergence.rigidity) * 0.28
  const remainingSpread = finalSpread + (1 - convergence.progress) * (1 - finalSpread)
  const relative = {
    x: point.x - convergence.origin.x,
    y: point.y - convergence.origin.y,
  }
  const forward = relative.x * convergence.direction.x + relative.y * convergence.direction.y
  const centerline = {
    x: convergence.origin.x + convergence.direction.x * forward,
    y: convergence.origin.y + convergence.direction.y * forward,
  }
  const compressed = {
    x: centerline.x + convergence.side.x * Math.cos(phase) * convergence.radiusX * remainingSpread * radiusScale,
    y: centerline.y + convergence.side.y * Math.sin(phase * 1.37) * convergence.radiusY * remainingSpread * radiusScale,
  }

  return {
    x: point.x + (compressed.x - point.x) * convergence.progress,
    y: point.y + (compressed.y - point.y) * convergence.progress,
  }
}

// ── Particle lifecycle ────────────────────────────────────────────────────────

export function scaledParticleCount(baseCount, spellIR, config) {
  return Math.min(config.renderer.particleCap, Math.round(baseCount * effectOpacity(spellIR)))
}

export function pruneParticles(state) {
  state.particles = state.particles.filter((p) => p.age < p.life)
}

export function resetParticleState(state) {
  for (const key of Object.keys(state)) {
    delete state[key]
  }
  state.particles = []
}
