// SpellEffectRenderer.js — Per-frame render logic for spell particle effects.
// Manages particle state, delta-time, signature-based reset, prepared-glow,
// failure-flicker, and active-effect dispatch.
// PURE CLASS — no JSON imports. Config injected via the constructor.
// Ported and adapted from wha-spell-simulator/src/renderer/spellEffectRenderer.js.

import { drawFireEffect } from './effects/fireEffect.js'
import { drawWaterEffect } from './effects/waterEffect.js'
import { drawWindEffect } from './effects/windEffect.js'
import { drawEarthEffect } from './effects/earthEffect.js'
import { drawLightEffect } from './effects/lightEffect.js'
import { drawRadialSpreadEffect } from './effects/radialSpread.js'
import { resetParticleState, clamp } from './effectUtils.js'

// ── Constants ──────────────────────────────────────────────────────────────────

const SPELL_END_FADE_MS = 420
const TARGET_FRAME_MS = 16.67
const DELTA_FRAME_MIN = 0.4
const DELTA_FRAME_MAX = 2.5
const FULL_CIRCLE_RAD = Math.PI * 2

// Prepared glow constants
const PREPARED_PULSE_PERIOD_MS = 520
const PREPARED_GLOW_BASE_ALPHA = 0.08
const PREPARED_GLOW_PULSE_ALPHA = 0.05
const PREPARED_GLOW_RADIUS_SCALE = 0.7
const RING_GLOW_IDLE_ALPHA = 0.06
const RING_GLOW_PREPARED_ALPHA = 0.12
const RING_GLOW_LINE_WIDTH = 6

// Failure flicker constants
const FAILED_FLICKER_PERIOD_MS = 70
const FAILED_FLICKER_BASE_ALPHA = 0.14
const FAILED_FLICKER_PULSE_ALPHA = 0.16
const FAILED_FLICKER_LINE_WIDTH = 7
const FAILED_FLICKER_DASH = [10, 14]
const FAILED_FLICKER_RADIUS_SCALE = 0.92
const FAILED_FLICKER_RADIUS_PULSE_SCALE = 0.02

// ── Element dispatch map ──────────────────────────────────────────────────────

const EFFECTS = {
  fire: drawFireEffect,
  water: drawWaterEffect,
  wind: drawWindEffect,
  earth: drawEarthEffect,
  // 'air' is the WHA element name; map to wind visuals
  air: drawWindEffect,
  light: drawLightEffect,
}

// ── State machine (pure function) ────────────────────────────────────────────
// Exported so tests can cover state transitions without a canvas.

/**
 * resolveRendererState(spellIR, preparedActiveGating)
 * Returns: 'idle' | 'prepared' | 'active' | 'failed'
 *
 * When preparedActiveGating is false (default), any valid spell is immediately 'active'.
 */
export function resolveRendererState(spellIR, preparedActiveGating = false) {
  if (!spellIR) return 'idle'
  if (!spellIR.valid) return 'failed'

  if (preparedActiveGating) {
    // gating ON: ring state decides prepared vs active
    if (spellIR.prepared && !spellIR.active) return 'prepared'
    if (spellIR.active) return 'active'
    return 'idle'
  }

  // gating OFF (default): cast immediately on Analyze
  return 'active'
}

/**
 * isFailedCast(spellIR, config)
 * Returns true when the spell should show a full failure flicker (no element particles).
 */
export function isFailedCast(spellIR, config) {
  if (!spellIR || !spellIR.valid) return true
  const stabilityThreshold = config?.renderer?.stabilityFailThreshold ?? 0.25
  const qualityThreshold = config?.renderer?.qualityFailThreshold ?? 0.20
  if ((spellIR.stability ?? 1) < stabilityThreshold) return true
  if ((spellIR.quality ?? 1) < qualityThreshold) return true
  return false
}

/**
 * isPartialFailure(spellIR, config)
 * Returns true when the spell is valid but partially degraded (flicker overlay on top of particles).
 */
export function isPartialFailure(spellIR, config) {
  if (!spellIR || !spellIR.valid) return false
  const stabilityThreshold = config?.renderer?.stabilityFailThreshold ?? 0.25
  const qualityThreshold = config?.renderer?.qualityFailThreshold ?? 0.20
  // Partial: above threshold but still low (< 2x threshold) — creates degraded look
  const stab = spellIR.stability ?? 1
  const qual = spellIR.quality ?? 1
  return stab < stabilityThreshold * 2 || qual < qualityThreshold * 2
}

// ── Emission fade ─────────────────────────────────────────────────────────────

function spellDurationMs(spellIR) {
  const durationSeconds = Number(spellIR?.duration)
  return Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds * 1000 : 0
}

function spellEmission(spellIR, timestamp) {
  if (spellIR?.sustain) return 1  // practice trial: keep emitting (continuous stream, no end-fade)
  const durationMs = spellDurationMs(spellIR)
  if (durationMs <= 0) return 1  // no duration info → always emitting

  const activatedAt = spellIR.activatedAt
  if (typeof activatedAt !== 'number') return 1  // not yet stamped

  const elapsed = Math.max(0, timestamp - activatedAt)
  if (elapsed <= durationMs) return 1
  return clamp(1 - (elapsed - durationMs) / SPELL_END_FADE_MS)
}

// ── SpellEffectRenderer class ──────────────────────────────────────────────────

export class SpellEffectRenderer {
  constructor(canvas, config) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.config = config
    this.state = { particles: [] }
    this.lastSignature = null
    this.lastTime = null
  }

  render(spellIR, ring, timestamp, options = {}) {
    const { width, height } = this.canvas
    const ctx = this.ctx
    ctx.clearRect(0, 0, width, height)

    // Nothing to draw without ring geometry
    if (!ring?.found || !spellIR) return

    // Delta-time normalisation (60 FPS relative)
    const dt = clamp(
      this.lastTime === null ? 1 : (timestamp - this.lastTime) / TARGET_FRAME_MS,
      DELTA_FRAME_MIN,
      DELTA_FRAME_MAX,
    )
    this.lastTime = timestamp

    // Signature reset: flush particle state when spell composition changes
    if (this.lastSignature !== spellIR.signature) {
      this.lastSignature = spellIR.signature
      resetParticleState(this.state)
    }

    const preparedActiveGating = this.config?.renderer?.preparedActiveGating ?? false
    const rendererState = resolveRendererState(spellIR, preparedActiveGating)

    // Ring glow (only when gating is on and guides requested)
    if (options.showGuides && rendererState !== 'active') {
      this.drawRingGlow(ring, rendererState === 'prepared')
    }

    if (rendererState === 'failed') {
      this.drawFailedFlicker(ring, timestamp)
      return
    }

    if (rendererState === 'prepared') {
      if (options.showGuides) this.drawPreparedGlow(ring, timestamp)
      return
    }

    if (rendererState === 'idle') return

    // Active: run element particles
    // Hard failure: full flicker, no particles
    if (isFailedCast(spellIR, this.config)) {
      this.drawFailedFlicker(ring, timestamp)
      return
    }

    const drawEffect = EFFECTS[spellIR.element]
    if (!drawEffect) return

    const emission = spellEmission(spellIR, timestamp)
    if (emission <= 0 && !this.state.particles.length) return

    const renderSpellIR = { ...spellIR, emission }

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    if (renderSpellIR.radialSpread) {
      drawRadialSpreadEffect(ctx, this.state, renderSpellIR, ring, dt, this.config)
    } else {
      drawEffect(ctx, this.state, renderSpellIR, ring, dt, this.config)
    }
    ctx.restore()
    // NOTE: the partial-failure flicker ring was removed — for a valid but low-stability spell it drew
    // a distracting pulsing red circle over a working cast. True failures still flicker (failed state).
  }

  drawRingGlow(ring, isPrepared) {
    const alpha = isPrepared ? RING_GLOW_PREPARED_ALPHA : RING_GLOW_IDLE_ALPHA
    this.ctx.save()
    this.ctx.strokeStyle = `rgba(255, 217, 114, ${alpha})`
    this.ctx.lineWidth = RING_GLOW_LINE_WIDTH
    this.ctx.beginPath()
    this.ctx.arc(ring.center.x, ring.center.y, ring.radius, 0, FULL_CIRCLE_RAD)
    this.ctx.stroke()
    this.ctx.restore()
  }

  drawPreparedGlow(ring, timestamp) {
    const pulse = 0.5 + Math.sin(timestamp / PREPARED_PULSE_PERIOD_MS) * 0.5
    this.ctx.save()
    this.ctx.fillStyle = `rgba(88, 171, 174, ${PREPARED_GLOW_BASE_ALPHA + pulse * PREPARED_GLOW_PULSE_ALPHA})`
    this.ctx.beginPath()
    this.ctx.arc(ring.center.x, ring.center.y, ring.radius * PREPARED_GLOW_RADIUS_SCALE, 0, FULL_CIRCLE_RAD)
    this.ctx.fill()
    this.ctx.restore()
  }

  /**
   * drawFailedFlicker(ring, timestamp, alphaScale = 1)
   * alphaScale < 1 → degraded-cast overlay (valid but low-quality spell).
   */
  drawFailedFlicker(ring, timestamp, alphaScale = 1) {
    const pulse = Math.max(0, Math.sin(timestamp / FAILED_FLICKER_PERIOD_MS))
    this.ctx.save()
    this.ctx.strokeStyle = `rgba(184, 69, 49, ${(FAILED_FLICKER_BASE_ALPHA + pulse * FAILED_FLICKER_PULSE_ALPHA) * alphaScale})`
    this.ctx.lineWidth = FAILED_FLICKER_LINE_WIDTH
    this.ctx.setLineDash(FAILED_FLICKER_DASH)
    this.ctx.beginPath()
    this.ctx.arc(
      ring.center.x,
      ring.center.y,
      ring.radius * (FAILED_FLICKER_RADIUS_SCALE + pulse * FAILED_FLICKER_RADIUS_PULSE_SCALE),
      0,
      FULL_CIRCLE_RAD,
    )
    this.ctx.stroke()
    this.ctx.restore()
  }
}
