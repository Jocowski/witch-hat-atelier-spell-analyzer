// radialSpread.js — Radial fountain effect for inverted-column spells.
// PURE MODULE — no JSON imports. Config injected via arguments.
// Renders the outward "fountain" spread around the seal when spellIR.radialSpread is present
// (emitted by the engine when flow.inverted is true — the Outward column case).
// See: docs/app/specs/SPEC-inverted-column.md §L4

import {
  clamp,
  randomBetween,
  activePortalPlane,
  effectOpacity,
  pruneParticles,
} from '../effectUtils.js'
import { drawToonLiquid } from '../toonLiquid.js'

const TWO_PI = Math.PI * 2

// ── Per-element palette ───────────────────────────────────────────────────────
// 'A' is substituted with the per-stop alpha string at draw time.
// glow: [inner color, mid color, outer transparent] for the radial gradient.
// toon: options forwarded to drawToonLiquid.

const PALETTE = {
  water: {
    glow: ['rgba(87,190,245,A)', 'rgba(36,150,229,A)', 'rgba(8,95,202,0)'],
    toon: { baseColor: '#2f8fd6', innerColor: '#7cc4f2', outlineColor: '#0a2238' },
  },
  fire: {
    glow: ['rgba(255,196,92,A)', 'rgba(240,120,40,A)', 'rgba(150,30,0,0)'],
    toon: { baseColor: '#e8702a', innerColor: '#ffd27a', outlineColor: '#3a1400' },
  },
  earth: {
    glow: ['rgba(196,150,96,A)', 'rgba(150,110,60,A)', 'rgba(80,55,25,0)'],
    toon: { baseColor: '#9c7b4a', innerColor: '#c8a064', outlineColor: '#2a1c0a' },
  },
  light: {
    glow: ['rgba(255,240,180,A)', 'rgba(255,215,120,A)', 'rgba(200,150,40,0)'],
    toon: { baseColor: '#e8c84a', innerColor: '#fff0b4', outlineColor: '#3a2c0a' },
  },
  wind: {
    glow: ['rgba(200,235,225,A)', 'rgba(140,200,190,A)', 'rgba(70,120,110,0)'],
    toon: { baseColor: '#8fd6c4', innerColor: '#d6f0ea', outlineColor: '#0a3830' },
  },
}

// Resolve element key: map 'air' → 'wind'; default unknown to 'water'.
function resolveElement(element) {
  if (element === 'air') return 'wind'
  return PALETTE[element] ? element : 'water'
}

// ── Coordinate model ──────────────────────────────────────────────────────────

// Unit vector facing outward in the engine's angle convention: 0=north, clockwise.
// Matches the FlowPanel / portalOutDirection convention used throughout the codebase.
export function facingUnit(thetaDeg) {
  const rad = thetaDeg * Math.PI / 180
  return { x: Math.sin(rad), y: -Math.cos(rad) }
}

// Project a polar-ish radial particle to screen space.
// portal = activePortalPlane(canvas, ring)
// p.theta in engine degrees (0=north CW), p.r in ring-radius units (1.0 = rim),
// p.height in screen-up px (≥ 0 — never behind the seal plane).
export function projectRadialParticle(p, portal) {
  const u = facingUnit(p.theta)
  return {
    x: portal.center.x + u.x * portal.radiusX * p.r,
    y: portal.center.y + u.y * portal.radiusY * p.r - p.height,
  }
}

// ── Flow config ───────────────────────────────────────────────────────────────

// Derive spawn/physics config from spellIR.radialSpread + ring geometry.
export function radialSpreadFlow(spellIR, ring, _portal, _frame) {
  const radialSpread = spellIR.radialSpread ?? {}
  const intensity = clamp(radialSpread.intensity ?? 0.6)
  const biasAngle = radialSpread.biasAngle ?? 0
  const biasStrength = clamp(radialSpread.biasStrength ?? 0)
  const swirl = clamp(radialSpread.swirl ?? 0, -1, 1)
  const archHeight = radialSpread.archHeight ?? 0.15

  // Max r (in ring-radius units) on the neutral side. Biased side reaches farther via densityAt.
  // Range: ~1.6 (low intensity, low range) to ~3.0 (high intensity, high range).
  const baseReach = 1.0 + 0.6 + intensity * 0.8 + (spellIR.range ?? 0.4) * 0.6

  // Per-frame radial growth rate (tune: ~50–90 frames to cross from r=1 to maxReach).
  const radialSpeed = 0.010 + 0.012 * intensity + 0.004 * (spellIR.force ?? 0.5)

  // Peak bounce height in px (arc crests then lands — the "trampoline" from the spec).
  const archPx = archHeight * ring.radius

  // Gravity deceleration on the height dimension (px/frame²). Kept LOW so the rim "bounce" is a
  // gentle, long, low hop that spans the outward journey (a flat fountain dome) rather than a
  // tall spout that crests and lands within a few frames.
  const gravityPerFrame = 0.06 + (spellIR.force ?? 0.5) * 0.06

  // Tangential angular drift per frame (swirl case).
  const swirlRate = swirl * 1.4

  // Small jitter at spawn so the rim ring doesn't look perfectly uniform.
  const rimJitter = 0.03

  return {
    intensity,
    biasAngle,
    biasStrength,
    swirl,
    archPx,
    baseReach,
    radialSpeed,
    gravityPerFrame,
    swirlRate,
    rimJitter,
  }
}

// ── Density helper ─────────────────────────────────────────────────────────────

// Returns the local density multiplier (1 ± biasStrength) at angle theta.
// Used both for rejection-sampling spawn angles and for scaling maxReach / speed.
export function densityAt(theta, biasAngle, biasStrength) {
  return 1 + biasStrength * Math.cos((theta - biasAngle) * Math.PI / 180)
}

// ── Spawn ─────────────────────────────────────────────────────────────────────

export function spawnRadialParticle(flow) {
  // Rejection-sample theta: accept angle proportional to the density at that angle.
  let theta
  for (;;) {
    theta = Math.random() * 360
    const accept = densityAt(theta, flow.biasAngle, flow.biasStrength) / (1 + flow.biasStrength)
    if (Math.random() < accept) break
  }

  const d = densityAt(theta, flow.biasAngle, flow.biasStrength) // 0..2

  const r = 1.0 + randomBetween(-flow.rimJitter * 4 / 3, flow.rimJitter * 2 / 3) // start at rim
  const maxReach = flow.baseReach * (0.7 + 0.3 * d)              // biased side reaches farther
  const vR = flow.radialSpeed * (0.8 + 0.4 * d) * randomBetween(0.9, 1.15)
  const vHeight = flow.archPx * randomBetween(0.05, 0.08)        // initial upward bounce impulse

  const baseRadius = randomBetween(5, 10) * (0.85 + (flow.intensity ?? 0.5) * 0.4)

  return {
    theta,
    r,
    maxReach,
    vR,
    vHeight,
    height: 0,
    phase: randomBetween(0, TWO_PI),
    baseRadius,
    radius: baseRadius,
    age: 0,
    life: randomBetween(60, 110),
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export function updateRadialParticle(p, flow, dt) {
  p.age += dt
  p.r += p.vR * dt
  p.theta += flow.swirlRate * dt          // swirl drift

  p.vHeight -= flow.gravityPerFrame * dt  // gravity pulls height back down
  p.height += p.vHeight * dt
  if (p.height < 0) p.height = 0         // NEVER below the seal plane (never behind the ring)

  // Shimmer radius
  p.radius = Math.max(2.5, p.baseRadius * (0.94 + Math.sin(p.phase + p.age * 0.16) * 0.06))

  // Death: travelled past its max reach (alpha fade + age>life handle the natural tail). The particle
  // does NOT die just because its hop landed — water that settles keeps sliding outward along the
  // seal plane, so the spread reaches the full radius instead of vanishing at the rim.
  if (p.r > p.maxReach) {
    p.age = p.life + 1
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────

// Main exported entry point. Called from SpellEffectRenderer when spellIR.radialSpread is present.
export function drawRadialSpreadEffect(ctx, state, spellIR, ring, dt, config) {
  const portal = activePortalPlane(ctx.canvas, ring)
  state.radialFrame = (state.radialFrame ?? 0) + dt

  const flow = radialSpreadFlow(spellIR, ring, portal, state.radialFrame)
  flow.intensity = spellIR.radialSpread.intensity ?? 0.6

  // The spread covers a large dome (≈2× the ring radius), so it needs many more particles than a
  // narrow stream to read as a full body of water rather than scattered droplets. Use a higher local
  // ceiling than the shared particleCap (which other effects keep at 400) since this effect alone
  // fans across the whole area.
  const baseCount = (180 + (spellIR.force ?? 0.5) * 150) * (0.7 + 0.3 * (spellIR.radialSpread.intensity ?? 0.6))
  const localCap = Math.max(config?.renderer?.particleCap ?? 400, 480)
  const targetCount = Math.min(localCap, Math.round(baseCount * effectOpacity(spellIR)))

  // Spawn up to target
  while (state.particles.length < targetCount) {
    state.particles.push(spawnRadialParticle(flow))
  }

  // Update all; collect visible (project; skip non-finite)
  const visibleParticles = []
  for (const p of state.particles) {
    updateRadialParticle(p, flow, dt)
    const alpha = clamp(1 - p.age / p.life) * Math.min(1, p.age / 6) * effectOpacity(spellIR)
    if (alpha <= 0) continue
    const projected = projectRadialParticle(p, portal)
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue
    visibleParticles.push({ p, projected, alpha })
  }

  const el = resolveElement(spellIR.element)
  const palette = PALETTE[el]
  const style = config?.renderer?.style

  if (style === 'toon') {
    // Toon: metaball blobs → drawToonLiquid with element palette
    const blobs = visibleParticles.map(({ p, projected }) => ({
      x: projected.x,
      y: projected.y,
      r: p.radius * 1.4,
      hl: Math.sin(p.phase * 1.7) > 0.32,
    }))
    drawToonLiquid(ctx, blobs, {
      cell: clamp(ring.radius / 20, 6, 13),
      threshold: 0.9,
      innerThreshold: 2.2,
      influence: 2.4,
      ...palette.toon,
      outlineWidth: Math.max(2, ring.radius * 0.016),
      highlightColor: 'rgba(255,255,255,0.9)',
    })
  } else {
    // Glow: additive radial gradients per particle
    const glowColors = palette.glow
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    for (const { p, projected, alpha } of visibleParticles) {
      const radius = p.radius * 1.5
      const gradient = ctx.createRadialGradient(
        projected.x - radius * 0.16, projected.y - radius * 0.18, 0,
        projected.x, projected.y, radius * 1.24,
      )
      gradient.addColorStop(0, glowColors[0].replace('A', (alpha * 0.5).toFixed(3)))
      gradient.addColorStop(0.4, glowColors[1].replace('A', (alpha * 0.35).toFixed(3)))
      gradient.addColorStop(1, glowColors[2])
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(projected.x, projected.y, radius * 1.24, 0, TWO_PI)
      ctx.fill()
    }
    ctx.restore()
  }

  pruneParticles(state)
}
