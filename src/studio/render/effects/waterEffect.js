// waterEffect.js — Water element particle effect.
// PURE MODULE — no JSON imports. Config injected via the `config` argument.
// Ported and adapted from wha-spell-simulator/src/renderer/effects/waterEffect.js.

import {
  clamp,
  randomBetween,
  activePortalPlane,
  convergenceFlow,
  convergePoint,
  effectFocus,
  effectGravity,
  effectOpacity,
  effectScale,
  effectSuspension,
  particleAlpha,
  PORTAL_SCALE_Y,
  portalOutDirection,
  perpendicularVector,
  pruneParticles,
  scaledParticleCount,
  spellLifetimeFrames,
  steadyParticleAlpha,
} from '../effectUtils.js'
import { drawToonLiquid } from '../toonLiquid.js'

const DEPTH_SCALE = 0.58
const WATER_ALPHA_SCALE = 0.58

// Cel-shaded ("anime ink") water palette + tuning. Derived from ring size + spell params so the
// silhouette/outline scale with the spell. Used when config.renderer.style === 'toon'.
function toonWaterOptions(ring, spellIR) {
  const r = ring.radius
  return {
    cell: clamp(r / 20, 6, 13),
    threshold: 0.95,
    innerThreshold: 2.6,
    influence: 2.4,
    baseColor: '#2f8fd6',                 // mid blue body
    innerColor: '#7cc4f2',                // lighter blue interior (2nd tone)
    outlineColor: '#0a2238',              // near-black ink outline
    outlineWidth: Math.max(2.2, r * 0.018) * (0.9 + (spellIR.force ?? 0.5) * 0.3),
    highlightColor: 'rgba(236, 248, 255, 0.95)',
  }
}

// Contained (orb) toon tuning: a FULL sphere should read as a solid round ball, not a lumpy cloud.
// vs. the stream palette we lower the threshold and raise the metaball influence so the field stays
// above threshold across the whole disk (rim included) → the iso-contour rounds out instead of
// pulling in between sparse particles. Same blue ink palette/outline as the stream water.
function toonContainedWaterOptions(ring, spellIR) {
  return {
    ...toonWaterOptions(ring, spellIR),
    threshold: 0.5, // lower → silhouette reaches the full radius (fuller, rounder ball)
    innerThreshold: 1.4, // 2nd tone follows the fuller body
    influence: 3.4, // wider field per blob → neighbours fuse into a continuous mass
  }
}

function waterFlowConfig(spellIR, ring, portal, frame) {
  const scale = effectScale(spellIR)
  const focus = effectFocus(spellIR)
  const gravity = effectGravity(spellIR)
  const suspension = effectSuspension(spellIR)
  const suspended = suspension >= 0.55
  const direction = portalOutDirection(spellIR)
  const side = perpendicularVector(direction)
  const directionIR = spellIR.direction ?? {}
  const directionCoherence = clamp(spellIR.directionCoherence ?? Math.hypot(directionIR.x ?? 0, directionIR.y ?? 0))
  const convergence = convergenceFlow(spellIR, portal, frame)
  const convergenceStrength = convergence.strength
  const convergenceProgress = convergence.progress
  const horizontalShare = clamp(Math.hypot(directionIR.x ?? 0, directionIR.y ?? 0))
  const verticalShare = clamp(directionIR.z ?? 1)
  const sourceScale = Math.min(0.64, 0.22 + scale * 0.06 + spellIR.spread * 0.18) * (1 - convergenceStrength * 0.36) * (1 - focus * 0.24)
  const pressure = (3.15 + spellIR.force * 5.65) * (0.88 + scale * 0.12)
  const suspendedRadius = ring.radius * (0.18 + spellIR.spread * 0.18 + scale * 0.035) * (1 - convergenceStrength * 0.5) * (1 - focus * 0.28)
  const travelFactor = 1 - suspension * 0.78

  const base = {
    suspended,
    gravity,
    suspension,
    direction,
    directionCoherence,
    side,
    convergence,
    converging: convergence.active,
    convergenceProgress,
    sourceRadiusX: portal.radiusX * sourceScale,
    sourceRadiusY: portal.radiusY * sourceScale,
    // Speed split is DIRECTION-DRIVEN (einlair): a horizontal jet (z≈0) barely rises, a balanced
    // column (z≈1) shoots up. The old fixed 0.62 vertical base made every spell go up regardless.
    horizontalSpeed: pressure * (0.1 + (0.16 + horizontalShare * 0.95) * travelFactor),
    verticalSpeed: pressure * (0.06 + (0.12 + verticalShare * 1.05) * travelFactor),
    gravityForce:
      (0.052 + spellIR.force * 0.038 + (1 - spellIR.stability) * 0.018) *
      gravity *
      (1 - Math.max(convergenceStrength, convergenceProgress)),
    streamLength:
      ring.radius *
      (0.16 + scale * 0.04 + (0.76 + spellIR.range * 0.34 + spellIR.force * 0.96) * travelFactor) *
      (1 - convergenceStrength * 0.34),
    streamDepth:
      ring.radius *
      (0.035 + spellIR.spread * 0.07 + suspension * 0.08) *
      (0.8 + scale * 0.18) *
      (1 - convergenceStrength * 0.48) *
      (1 - focus * 0.38),
    lateralPush:
      ring.radius *
      (0.004 + spellIR.spread * 0.018) *
      (1.12 - spellIR.stability * 0.38) *
      (1 - convergenceStrength * 0.44) *
      (1 - focus * 0.42),
    depthPush:
      ring.radius *
      (0.004 + spellIR.spread * 0.016) *
      (1.08 - spellIR.stability * 0.34) *
      (1 - convergenceStrength * 0.44) *
      (1 - focus * 0.42),
    maxHeightHint: ring.radius * (0.9 + spellIR.force * 1.2 + scale * 0.12),
    suspendedLife: spellLifetimeFrames(spellIR),
    suspendedHeight: ring.radius * (0.34 + spellIR.force * 0.16 + spellIR.spread * 0.1 + scale * 0.08),
    suspendedRadius,
    suspendedBob: ring.radius * (0.008 + (1 - spellIR.stability) * 0.012),
    suspendedWander: suspendedRadius * (0.05 + (1 - spellIR.stability) * 0.08),
    suspendedTension: 0.012 + spellIR.stability * 0.014,
    suspendedDamping: 0.958 + spellIR.stability * 0.026,
    minRadius: 3.6 * (0.86 + scale * 0.14),
    radiusScale: (0.82 + scale * 0.2) * (0.92 + spellIR.force * 0.18) * (1 - convergenceStrength * 0.14),
  }

  // Contained (orb) mode: compute sphere geometry above the portal center.
  // The sphere center is screen-up from the portal — using -y since screen y increases downward.
  // containRadius is a 0..1 normalized radius; we scale by ring.radius to get screen pixels.
  if (spellIR.contained) {
    const containRadius = spellIR.containRadius ?? 0.4
    const sphereRadius = ring.radius * containRadius
    const sphereCenterX = portal.center.x
    // A sphere floating in the air projects to a CIRCLE from any viewing angle — it is NOT lying on
    // the tilted floor plane, so it must NOT be foreshortened like the portal ellipse. Depth (the
    // viewer axis) only shades/sizes particles (front bigger/brighter); it does not flatten the
    // silhouette. So rx == ry == sphereRadius → a round ball, not a squished blob.
    // Height: the Orb forms a vessel that floats JUST above the seal — canon shows it resting a little
    // above the glyph ("a bucket held above the seal"; docs/magic.md:35, orb-container-analysis). It is
    // LEVITATION signs, NOT Orb, that lift an effect high into the air (docs/signs.md:57); plain Water
    // Orb (orb×4 + column×2, no levitation) sits close. Seat the sphere's BOTTOM a small floatGap up.
    const floatGap = ring.radius * 0.12
    const sphereCenterY = portal.center.y - sphereRadius - floatGap
    base.container = {
      cx: sphereCenterX,
      cy: sphereCenterY,
      rx: sphereRadius,    // circle: full lateral radius
      ry: sphereRadius,    // circle: full vertical radius (a floating sphere is round, not flattened)
      sphereRadius,        // used for 3D home-point sampling
      fillRate: spellIR.fillRate ?? 0.5,
      // Particle life = full spell duration so the fill ramps over the whole cast.
      particleLife: spellLifetimeFrames(spellIR),
    }
  }

  return base
}

function randomPortalSource(portal, flow) {
  const angle = Math.random() * Math.PI * 2
  const radius = Math.sqrt(Math.random())
  return {
    x: portal.center.x + Math.cos(angle) * flow.sourceRadiusX * radius,
    y: portal.center.y + Math.sin(angle) * flow.sourceRadiusY * radius,
  }
}

function spawnSuspendedWaterParticle(spellIR, portal, flow, frame) {
  const angle = Math.random() * Math.PI * 2
  const spread = Math.sqrt(Math.random()) * flow.suspendedRadius
  const phase = randomBetween(0, Math.PI * 2)
  const wobble = Math.sin(frame * 0.06 + phase) * (1 - spellIR.stability) * 0.52
  const homeLateral = Math.cos(angle) * spread
  const homeDepth = Math.sin(angle) * spread
  const baseRadius = randomBetween(7.4, 14.6) * flow.radiusScale
  const homeForward = flow.directionCoherence * flow.suspendedRadius * 0.72 + randomBetween(
    -flow.suspendedRadius * 0.08,
    flow.suspendedRadius * 0.08,
  )

  return {
    sourceX: portal.center.x,
    sourceY: portal.center.y,
    forward: homeForward + randomBetween(-flow.suspendedRadius * 0.04, flow.suspendedRadius * 0.04),
    height: flow.suspendedHeight + randomBetween(-flow.suspendedBob, flow.suspendedBob),
    depth: homeDepth,
    lateral: homeLateral,
    vForward: randomBetween(-0.28, 0.28) * flow.horizontalSpeed,
    vHeight: randomBetween(-0.24, 0.24),
    vDepth: randomBetween(-flow.depthPush, flow.depthPush) * 0.52 + wobble * 0.2,
    vLateral: randomBetween(-flow.lateralPush, flow.lateralPush) * 0.52 + wobble,
    homeForward,
    homeHeight: flow.suspendedHeight + randomBetween(-flow.suspendedBob, flow.suspendedBob),
    homeDepth,
    homeLateral,
    baseRadius,
    radius: baseRadius,
    phase,
    age: 0,
    life: flow.suspendedLife,
  }
}

function spawnWaterParticle(spellIR, ring, portal, flow, frame) {
  if (flow.suspended) {
    return spawnSuspendedWaterParticle(spellIR, portal, flow, frame)
  }
  const source = randomPortalSource(portal, flow)
  const phase = randomBetween(0, Math.PI * 2)
  const streamRadius = Math.max(flow.sourceRadiusX, flow.sourceRadiusY)
  const baseRadius = randomBetween(6.4, 12.8) * flow.radiusScale
  const wobble = Math.sin(frame * 0.08 + phase) * (1 - spellIR.stability) * 0.65

  return {
    sourceX: source.x,
    sourceY: source.y,
    forward: randomBetween(-streamRadius * 0.04, streamRadius * 0.06),
    height: randomBetween(0, ring.radius * 0.04),
    depth: randomBetween(-flow.streamDepth, flow.streamDepth),
    lateral: randomBetween(-flow.streamDepth, flow.streamDepth),
    vForward: randomBetween(0.82, 1.18) * flow.horizontalSpeed,
    vHeight: randomBetween(0.86, 1.18) * flow.verticalSpeed,
    vDepth: randomBetween(-flow.depthPush, flow.depthPush) + wobble * 0.28,
    vLateral: randomBetween(-flow.lateralPush, flow.lateralPush) + wobble,
    baseRadius,
    radius: baseRadius,
    phase,
    age: 0,
    life: flow.converging ? flow.suspendedLife : randomBetween(56, 98) * (0.84 + spellIR.stability * 0.32),
  }
}

function updateSuspendedWaterParticle(particle, flow, dt) {
  particle.age += dt

  const targetForward = particle.homeForward + Math.cos(particle.phase + particle.age * 0.026) * flow.suspendedWander * 0.18
  const targetHeight = particle.homeHeight + Math.sin(particle.phase * 1.4 + particle.age * 0.028) * flow.suspendedBob
  const targetLateral = particle.homeLateral + Math.sin(particle.phase + particle.age * 0.034) * flow.suspendedWander
  const targetDepth = particle.homeDepth + Math.cos(particle.phase * 1.2 + particle.age * 0.032) * flow.suspendedWander

  particle.vForward += (targetForward - particle.forward) * flow.suspendedTension * dt
  particle.vHeight += (targetHeight - particle.height) * flow.suspendedTension * dt
  particle.vLateral += (targetLateral - particle.lateral) * flow.suspendedTension * dt
  particle.vDepth += (targetDepth - particle.depth) * flow.suspendedTension * dt

  particle.forward += particle.vForward * dt
  particle.height += particle.vHeight * dt
  particle.lateral += particle.vLateral * dt
  particle.depth += particle.vDepth * dt

  particle.vForward *= flow.suspendedDamping
  particle.vHeight *= flow.suspendedDamping
  particle.vLateral *= flow.suspendedDamping
  particle.vDepth *= flow.suspendedDamping

  const shimmer = 0.95 + Math.sin(particle.phase + particle.age * 0.12) * 0.05
  particle.radius = Math.max(flow.minRadius, particle.baseRadius * shimmer)
}

function updateWaterParticle(particle, flow, dt) {
  if (flow.suspended) {
    updateSuspendedWaterParticle(particle, flow, dt)
    return
  }
  particle.age += dt

  const ageRatio = particle.age / Math.max(1, particle.life)
  const wobble = Math.sin(particle.phase + particle.age * 0.14) * (1 - ageRatio)
  particle.vHeight -= flow.gravityForce * dt
  particle.vLateral += wobble * flow.lateralPush * 0.032 * dt
  particle.vDepth += Math.cos(particle.phase + particle.age * 0.11) * flow.depthPush * 0.026 * dt

  particle.forward += particle.vForward * dt
  particle.height += particle.vHeight * dt
  particle.lateral += particle.vLateral * dt
  particle.depth += particle.vDepth * dt

  const hold = flow.convergenceProgress
  particle.vForward *= 0.993 - hold * 0.035
  particle.vHeight *= 1 - hold * 0.06
  particle.vLateral *= 0.984 - hold * 0.04
  particle.vDepth *= 0.986 - hold * 0.04

  const speed = Math.hypot(particle.vForward, particle.vHeight, particle.vLateral, particle.vDepth)
  const shimmer = 0.94 + Math.sin(particle.phase + particle.age * 0.18) * 0.06
  particle.radius = Math.max(flow.minRadius, particle.baseRadius - speed * 0.18) * shimmer

  if (!flow.converging && (particle.forward > flow.streamLength || particle.height < -flow.sourceRadiusY * 0.72)) {
    particle.age = particle.life + 1
  }
}

// ── Contained (orb) mode ─────────────────────────────────────────────────────
// Each particle gets a fixed "home" inside the sphere volume (random point in the 3D ball, projected
// to the 2.5D plane). A rising fill line controls visibility: only particles whose home is at or
// below the current fill level are active. The sphere fills bottom-to-top over the cast duration.

function spawnContainedWaterParticle(flow) {
  const c = flow.container
  // Random point inside a 3D unit sphere via rejection-free cube-root trick (no rejection needed
  // since we only need uniform 3D distribution, not necessarily uniform surface).
  // We treat (u, v, w) as local sphere coords: u=lateral, v=depth, w=height (screen-up).
  // The sphere home is then mapped to screen coords below.
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  const r = Math.cbrt(Math.random()) * c.sphereRadius // uniform in ball volume
  // Local 3D position inside sphere
  const localLateral = r * Math.sin(phi) * Math.cos(theta)
  const localDepth = r * Math.sin(phi) * Math.sin(theta)
  const localHeight = r * Math.cos(phi) // positive = up, negative = down

  // Project to a ROUND silhouette: screen-x = lateral, screen-y = -height (full, screen-up). Depth is
  // the viewer axis — it does NOT move the particle in screen-y (that would flatten the ball); instead
  // it shades/sizes the particle (front = toward viewer = bigger/brighter) for spherical volume.
  const homeX = c.cx + localLateral
  const homeY = c.cy - localHeight

  // Depth cue: localDepth in [-sphereRadius, +sphereRadius]; +ve = toward viewer. Front particles are
  // a bit larger so the flat disk of (lateral, height) reads as a 3D ball.
  const depthNorm = localDepth / Math.max(1, c.sphereRadius) // -1 (back) .. +1 (front)
  const depthSize = 0.78 + 0.42 * (depthNorm * 0.5 + 0.5)    // ~0.78 back .. ~1.2 front

  const phase = randomBetween(0, Math.PI * 2)
  const baseRadius = randomBetween(6, 11) * (0.82 + Math.random() * 0.2) * depthSize

  return {
    // Current screen position (starts at home; jostle is applied during update).
    x: homeX,
    y: homeY,
    // Velocity for liquid jostling (small, mean-reverting).
    vx: randomBetween(-0.4, 0.4),
    vy: randomBetween(-0.3, 0.3),
    // Fixed home inside the sphere (the fill-line gate uses localHeight).
    homeX,
    homeY,
    localHeight, // local height coord in the sphere — determines fill-line visibility
    sphereRadius: c.sphereRadius,
    phase,
    baseRadius,
    radius: baseRadius,
    age: 0,
    life: c.particleLife,
  }
}

function updateContainedWaterParticle(particle, flow, dt) {
  particle.age += dt
  // Small liquid jostle: particles wander a bit around their home point (spring tension).
  const tension = 0.008
  const damping = 0.94
  particle.vx += (particle.homeX - particle.x) * tension * dt
  particle.vy += (particle.homeY - particle.y) * tension * dt
  // Add a gentle upward swirl mimicking convection inside the sphere.
  const swirl = Math.sin(particle.phase + particle.age * 0.04) * 0.12
  particle.vx += swirl * dt
  particle.vy -= Math.abs(swirl) * 0.06 * dt
  particle.x += particle.vx * dt
  particle.y += particle.vy * dt
  particle.vx *= damping
  particle.vy *= damping
  // Shimmer radius
  const shimmer = 0.96 + Math.sin(particle.phase + particle.age * 0.1) * 0.04
  particle.radius = Math.max(3.2, particle.baseRadius * shimmer)
}

// Returns the current fill-line level (0 = empty bottom of sphere, 1 = full top).
// Driven by fillRate and the frame clock; saturates at 1 (full sphere holds indefinitely).
function containedFillLevel(flow, frame) {
  const c = flow.container
  // Fill in a SHORT, roughly FIXED time so the sphere is full for most of the cast — NOT tied to the
  // spell duration. (The old `duration*60 / fillRate` meant the orb only filled up as the spell was
  // already ending, and the Azuremoon "lasts longer" dye made it fill SLOWER, not hold longer.)
  // A stronger pump (einlair U → fillRate≈1 for Water Orb's opposed columns) fills faster; a weak
  // pump trickles in. Independent of duration → a longer cast just HOLDS the full sphere longer.
  const baseFillFrames = 78 / Math.max(0.15, c.fillRate) // ~1.3s @ 60fps when fillRate=1
  // Safety cap: even a very short cast (or weak pump) finishes filling within ~40% of its lifetime.
  const rampFrames = Math.min(baseFillFrames, flow.suspendedLife * 0.4)
  return clamp(frame / rampFrames)
}

// Project a contained particle to screen space. The particle already holds screen-space x/y after
// jostling, so projection is trivial — we just return {x, y} plus a simple depth cue.
function projectContainedParticle(particle) {
  return { x: particle.x, y: particle.y }
}

// Draw the faint spherical boundary of the container (one stroked ellipse on the 2.5D plane).
// The ellipse matches the sphere geometry: radiusX = lateral extent, radiusY = depth-foreshortened.
// Shown even when the sphere is partly empty so the vessel reads as a container from the start.
function drawContainerBoundary(ctx, flow, opacity) {
  const c = flow.container
  // Thin, desaturated ring — visible but not distracting.
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = `rgba(180, 210, 240, ${opacity * 0.38})`
  ctx.lineWidth = Math.max(1, c.rx * 0.028)
  ctx.setLineDash([Math.round(c.rx * 0.12), Math.round(c.rx * 0.08)])
  ctx.beginPath()
  ctx.ellipse(c.cx, c.cy, c.rx, c.ry, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

// ── End contained mode ────────────────────────────────────────────────────────

function projectWaterParticle(particle, flow) {
  const base = {
    x: particle.sourceX + flow.direction.x * particle.forward + flow.side.x * particle.lateral,
    y: particle.sourceY + flow.direction.y * particle.forward - particle.height + particle.depth * DEPTH_SCALE,
  }
  return convergePoint(base, flow.convergence, particle.phase)
}

function drawWaterMass(ctx, projected, particle, flow, alpha) {
  const heightRatio = clamp((particle.height ?? 0) / Math.max(1, flow.maxHeightHint))
  const radius = particle.radius * (1.5 + heightRatio * 0.22) * (1 - flow.convergenceProgress * 0.28)
  const gradient = ctx.createRadialGradient(
    projected.x - radius * 0.16, projected.y - radius * 0.18, 0,
    projected.x, projected.y, radius * 1.24,
  )
  gradient.addColorStop(0, `rgba(87, 190, 245, ${alpha * 0.16})`)
  gradient.addColorStop(0.28, `rgba(36, 150, 229, ${alpha * 0.2})`)
  gradient.addColorStop(0.68, `rgba(8, 95, 202, ${alpha * 0.14})`)
  gradient.addColorStop(1, 'rgba(4, 61, 173, 0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function drawWaterCore(ctx, projected, particle, flow, alpha) {
  const heightRatio = clamp((particle.height ?? 0) / Math.max(1, flow.maxHeightHint))
  const radius = particle.radius * (0.94 + heightRatio * 0.18) * (1 - flow.convergenceProgress * 0.24)
  const core = ctx.createRadialGradient(
    projected.x - radius * 0.28, projected.y - radius * 0.3, 0,
    projected.x, projected.y, radius * 1.08,
  )
  core.addColorStop(0, `rgba(128, 218, 255, ${alpha * 0.07})`)
  core.addColorStop(0.24, `rgba(55, 171, 238, ${alpha * 0.14})`)
  core.addColorStop(0.72, `rgba(18, 122, 218, ${alpha * 0.1})`)
  core.addColorStop(1, 'rgba(7, 83, 202, 0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function drawWaterHighlight(ctx, projected, particle, alpha) {
  if (Math.sin(particle.phase * 1.7) < -0.28) return
  const radius = particle.radius * (0.18 + (Math.sin(particle.phase * 2.3) * 0.5 + 0.5) * 0.14)
  ctx.fillStyle = `rgba(210, 245, 255, ${alpha * 0.05})`
  ctx.beginPath()
  ctx.ellipse(projected.x - particle.radius * 0.18, projected.y - particle.radius * 0.24, radius * 1.24, radius * 0.72, -0.34, 0, Math.PI * 2)
  ctx.fill()
}

function visibleWaterParticle(particle, flow, spellIR) {
  const alpha =
    flow.suspended || flow.converging
      ? steadyParticleAlpha(particle, spellIR, 12)
      : particleAlpha(particle) * Math.min(1, particle.age / 8) * effectOpacity(spellIR)
  if (alpha <= 0) return null
  const projected = projectWaterParticle(particle, flow)
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null
  return { projected, alpha: alpha * WATER_ALPHA_SCALE }
}

export function drawWaterEffect(ctx, state, spellIR, ring, dt, config) {
  const scale = effectScale(spellIR)
  const portal = activePortalPlane(ctx.canvas, ring)
  state.waterFrame = (state.waterFrame ?? 0) + dt
  const flow = waterFlowConfig(spellIR, ring, portal, state.waterFrame)

  // ── Contained (orb) mode — sphere that fills bottom-to-top ───────────────
  // Gate: spellIR.contained is set by the engine when an orb-type form sign is present.
  // This branch runs BEFORE the stream/suspended logic; the two existing modes are untouched.
  if (spellIR.contained && flow.container) {
    const c = flow.container
    const opacity = effectOpacity(spellIR)
    // Per-cast fill clock: reset to 0 whenever a NEW cast starts (activatedAt changes), so the orb
    // refills from empty on every cast / Re-run. The free-running state.waterFrame only resets on a
    // SIGNATURE change, so re-casting the same composition (or the persistent trial pane carrying a
    // stale clock) would otherwise show the sphere already full instantly. See the fill ramp in
    // containedFillLevel (driven by fillRate over the spell duration).
    if (state.containActivatedAt !== spellIR.activatedAt) {
      state.containActivatedAt = spellIR.activatedAt
      state.containFrame = 0
    }
    state.containFrame = (state.containFrame ?? 0) + dt
    const fillLevel = containedFillLevel(flow, state.containFrame)

    // Particle pool: all particles are pre-placed inside the sphere; only those below the fill
    // line are active. Target count scales with sphere size (containRadius) and spell params.
    // Denser pool than before: a solid full ball needs enough particles that the metaball field has
    // no interior gaps and a smooth rim. Scales with sphere size (containRadius) + spell force.
    const baseCount = 150 + spellIR.force * 70 + (spellIR.containRadius ?? 0.4) * 220
    const targetCount = scaledParticleCount(baseCount * (0.6 + scale * 0.22), spellIR, config)

    while (state.particles.length < targetCount) {
      state.particles.push(spawnContainedWaterParticle(flow))
    }

    // Fill line in local sphere space: runs from bottom (−sphereRadius) to top (+sphereRadius).
    // fillLevel=0 → fillLineLocal = −sphereRadius (nothing visible); 1 → +sphereRadius (full).
    const fillLineLocal = -c.sphereRadius + 2 * c.sphereRadius * fillLevel

    // Update all particles; collect those below the fill line (active/visible).
    const visibleParticles = []
    for (const particle of state.particles) {
      updateContainedWaterParticle(particle, flow, dt)
      // Only show particles whose home height is at or below the current fill line.
      if (particle.localHeight > fillLineLocal) continue
      // Fade in as the fill line passes over each particle's home.
      // Particles near the surface get a soft 0..1 fade over a small band.
      const bandWidth = c.sphereRadius * 0.12
      const depthBelow = fillLineLocal - particle.localHeight
      const surfaceFade = clamp(depthBelow / Math.max(1, bandWidth))
      const fadeIn = Math.min(1, particle.age / 10)
      const alpha = steadyParticleAlpha(particle, spellIR, 12) * surfaceFade * fadeIn
      if (alpha <= 0) continue
      const projected = projectContainedParticle(particle)
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue
      visibleParticles.push({ particle, projected, alpha: alpha * WATER_ALPHA_SCALE })
    }

    // Draw the sphere boundary first (behind particles) so the vessel reads as a container
    // even when partly empty. Use source-over so it's never additive-blown.
    drawContainerBoundary(ctx, flow, opacity)

    // Draw particles (in-fill liquid).
    if (config.renderer?.style === 'toon') {
      // Toon: feed active particles to the metaball renderer. Fatten each blob (×1.5) so the field
      // fuses into a continuous rounded mass instead of reading as separate droplets.
      const blobs = visibleParticles.map(({ particle, projected }) => ({
        x: projected.x,
        y: projected.y,
        r: particle.radius * 1.5,
        hl: Math.sin(particle.phase * 1.7) > 0.32,
      }))
      drawToonLiquid(ctx, blobs, toonContainedWaterOptions(ring, spellIR))
    } else {
      // Glow: additive radial gradients (same helpers as stream mode, just smaller).
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      for (const { particle, projected, alpha } of visibleParticles) {
        drawWaterMass(ctx, projected, particle, flow, alpha)
      }
      ctx.globalCompositeOperation = 'screen'
      for (const { particle, projected, alpha } of visibleParticles) {
        drawWaterCore(ctx, projected, particle, flow, alpha)
        drawWaterHighlight(ctx, projected, particle, alpha)
      }
      ctx.restore()
    }

    pruneParticles(state)
    return
  }
  // ── End contained mode ────────────────────────────────────────────────────

  // Stream and suspended modes — UNCHANGED from original implementation.
  const baseCount = flow.suspended ? 118 + spellIR.force * 74 + spellIR.spread * 56 : 96 + spellIR.force * 122
  const targetCount = scaledParticleCount(baseCount * (0.66 + scale * 0.22), spellIR, config)

  while (state.particles.length < targetCount) {
    state.particles.push(spawnWaterParticle(spellIR, ring, portal, flow, state.waterFrame))
  }

  const visibleParticles = []
  for (const particle of state.particles) {
    updateWaterParticle(particle, flow, dt)
    const visible = visibleWaterParticle(particle, flow, spellIR)
    if (visible) visibleParticles.push({ particle, ...visible })
  }

  // Toon mode: reuse the same projected particles as metaball blobs → cel-shaded ink water.
  if (config.renderer?.style === 'toon') {
    const blobs = visibleParticles.map(({ particle, projected }) => ({
      x: projected.x,
      y: projected.y,
      r: particle.radius,
      hl: Math.sin(particle.phase * 1.7) > 0.32, // sparse highlights (mirrors the glow gate)
    }))
    drawToonLiquid(ctx, blobs, toonWaterOptions(ring, spellIR))
    pruneParticles(state)
    return
  }

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  for (const { particle, projected, alpha } of visibleParticles) {
    drawWaterMass(ctx, projected, particle, flow, alpha)
  }
  ctx.globalCompositeOperation = 'screen'
  for (const { particle, projected, alpha } of visibleParticles) {
    drawWaterCore(ctx, projected, particle, flow, alpha)
    drawWaterHighlight(ctx, projected, particle, alpha)
  }
  ctx.restore()

  pruneParticles(state)
}
