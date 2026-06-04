// renderer.test.js — Pure-function tests for the SpellEffectRenderer state machine,
// SpellIR→effect-config mapping, and effectUtils helpers.
// Runs under plain `node --test` (no Vite, no canvas, no DOM).
// Per SPEC-visual-renderer §10.1.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ── Imports (pure modules only) ────────────────────────────────────────────────

import {
  resolveRendererState,
  isFailedCast,
  isPartialFailure,
} from '../src/studio/render/SpellEffectRenderer.js'

import {
  clamp,
  randomBetween,
  normalizeVector,
  perpendicularVector,
  effectScale,
  effectOpacity,
  effectGravity,
  effectFocus,
  effectSuspension,
  particleAlpha,
  particleDepth,
  spellLifetimeFrames,
  portalOutDirection,
  scaledParticleCount,
  resetParticleState,
} from '../src/studio/render/effectUtils.js'

import { fireFlowConfig } from '../src/studio/render/effects/fireEffect.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  renderer: {
    particleBaseCount: 60,
    particleCap: 400,
    preparedActiveGating: false,
    stabilityFailThreshold: 0.25,
    qualityFailThreshold: 0.20,
  },
}

const RING = { center: { x: 400, y: 300 }, radius: 180, found: true }

function makeSpellIR(overrides = {}) {
  return {
    valid: true,
    active: true,
    prepared: false,
    element: 'fire',
    force: 0.5,
    spread: 0.4,
    focus: 0.6,
    range: 0.5,
    duration: 3.0,
    stability: 0.7,
    gravity: 1.0,
    dirCoherence: 0,
    direction: { x: 0, y: 0, z: 1, xTiltDeg: 0, yTiltDeg: 0, tiltFromZDeg: 0 },
    quality: 1.0,
    signature: 'test',
    ...overrides,
  }
}

function makePortal() {
  return {
    center: { x: 400, y: 400 },
    radiusX: 180,
    radiusY: 79.2,
    scaleY: 0.44,
  }
}

// ── resolveRendererState tests ────────────────────────────────────────────────

describe('resolveRendererState', () => {
  test('null spellIR → idle', () => {
    assert.equal(resolveRendererState(null, false), 'idle')
    assert.equal(resolveRendererState(null, true), 'idle')
  })

  test('invalid spell → failed (gating off)', () => {
    const ir = makeSpellIR({ valid: false })
    assert.equal(resolveRendererState(ir, false), 'failed')
  })

  test('invalid spell → failed (gating on)', () => {
    const ir = makeSpellIR({ valid: false })
    assert.equal(resolveRendererState(ir, true), 'failed')
  })

  test('valid spell, gating OFF → active immediately', () => {
    const ir = makeSpellIR({ valid: true, active: false, prepared: true })
    assert.equal(resolveRendererState(ir, false), 'active')
  })

  test('valid spell, gating OFF, active:true → active', () => {
    const ir = makeSpellIR({ valid: true, active: true, prepared: false })
    assert.equal(resolveRendererState(ir, false), 'active')
  })

  test('valid spell, gating ON, ring open → prepared', () => {
    const ir = makeSpellIR({ valid: true, active: false, prepared: true })
    assert.equal(resolveRendererState(ir, true), 'prepared')
  })

  test('valid spell, gating ON, ring closed → active', () => {
    const ir = makeSpellIR({ valid: true, active: true, prepared: false })
    assert.equal(resolveRendererState(ir, true), 'active')
  })

  test('valid spell, gating ON, neither active nor prepared → idle', () => {
    const ir = makeSpellIR({ valid: true, active: false, prepared: false })
    assert.equal(resolveRendererState(ir, true), 'idle')
  })
})

// ── isFailedCast tests ────────────────────────────────────────────────────────

describe('isFailedCast', () => {
  test('null spellIR → failed', () => {
    assert.equal(isFailedCast(null, DEFAULT_CONFIG), true)
  })

  test('invalid spell → failed', () => {
    assert.equal(isFailedCast(makeSpellIR({ valid: false }), DEFAULT_CONFIG), true)
  })

  test('valid, high stability + quality → not failed', () => {
    assert.equal(isFailedCast(makeSpellIR({ stability: 0.8, quality: 0.9 }), DEFAULT_CONFIG), false)
  })

  test('stability below threshold → failed', () => {
    assert.equal(isFailedCast(makeSpellIR({ stability: 0.2 }), DEFAULT_CONFIG), true)
  })

  test('stability exactly at threshold → failed (< not <=)', () => {
    // threshold is 0.25; stability 0.25 is NOT below threshold
    assert.equal(isFailedCast(makeSpellIR({ stability: 0.25 }), DEFAULT_CONFIG), false)
  })

  test('stability just below threshold (0.249) → failed', () => {
    assert.equal(isFailedCast(makeSpellIR({ stability: 0.249 }), DEFAULT_CONFIG), true)
  })

  test('quality below threshold → failed', () => {
    assert.equal(isFailedCast(makeSpellIR({ quality: 0.1 }), DEFAULT_CONFIG), true)
  })

  test('custom config threshold', () => {
    const cfg = { renderer: { ...DEFAULT_CONFIG.renderer, stabilityFailThreshold: 0.5 } }
    assert.equal(isFailedCast(makeSpellIR({ stability: 0.4 }), cfg), true)
    assert.equal(isFailedCast(makeSpellIR({ stability: 0.6 }), cfg), false)
  })
})

// ── isPartialFailure tests ────────────────────────────────────────────────────

describe('isPartialFailure', () => {
  test('invalid spell → not partial (full failure)', () => {
    assert.equal(isPartialFailure(makeSpellIR({ valid: false }), DEFAULT_CONFIG), false)
  })

  test('high stability → no partial failure', () => {
    assert.equal(isPartialFailure(makeSpellIR({ stability: 0.9, quality: 0.9 }), DEFAULT_CONFIG), false)
  })

  test('stability in partial-failure zone (between threshold and 2x threshold)', () => {
    // threshold = 0.25, 2x = 0.5 → stability 0.4 → partial
    assert.equal(isPartialFailure(makeSpellIR({ stability: 0.4, quality: 0.9 }), DEFAULT_CONFIG), true)
  })

  test('quality in partial-failure zone', () => {
    // qualityThreshold = 0.20, 2x = 0.40 → quality 0.35 → partial
    assert.equal(isPartialFailure(makeSpellIR({ quality: 0.35, stability: 0.8 }), DEFAULT_CONFIG), true)
  })
})

// ── effectUtils helpers ───────────────────────────────────────────────────────

describe('clamp', () => {
  test('clamps below 0', () => assert.equal(clamp(-0.5), 0))
  test('clamps above 1', () => assert.equal(clamp(1.5), 1))
  test('passes through 0.5', () => assert.equal(clamp(0.5), 0.5))
  test('custom bounds', () => assert.equal(clamp(5, 0, 10), 5))
  test('clamps with custom lo', () => assert.equal(clamp(-1, 2, 5), 2))
})

describe('randomBetween', () => {
  test('result within [a, b]', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomBetween(-10, 10)
      assert.ok(v >= -10 && v <= 10)
    }
  })
  test('a === b → returns a', () => {
    assert.equal(randomBetween(5, 5), 5)
  })
})

describe('normalizeVector', () => {
  test('unit vector (1,0) unchanged', () => {
    const n = normalizeVector({ x: 1, y: 0 })
    assert.ok(Math.abs(n.x - 1) < 1e-9)
    assert.ok(Math.abs(n.y) < 1e-9)
  })
  test('zero vector → fallback (0, -1)', () => {
    const n = normalizeVector({ x: 0, y: 0 })
    assert.equal(n.x, 0)
    assert.equal(n.y, -1)
  })
  test('arbitrary vector is unit length', () => {
    const n = normalizeVector({ x: 3, y: 4 })
    const mag = Math.hypot(n.x, n.y)
    assert.ok(Math.abs(mag - 1) < 1e-9)
  })
})

describe('perpendicularVector', () => {
  test('perp of (1,0) → (0,1)', () => {
    const p = perpendicularVector({ x: 1, y: 0 })
    assert.ok(Math.abs(p.x) < 1e-9)   // -0 and 0 both OK
    assert.ok(Math.abs(p.y - 1) < 1e-9)
  })
  test('perp of (0,1) → (-1,0)', () => {
    const p = perpendicularVector({ x: 0, y: 1 })
    assert.ok(Math.abs(p.x - (-1)) < 1e-9)
    assert.ok(Math.abs(p.y) < 1e-9)
  })
  test('perp is dot-product zero with original', () => {
    const v = { x: 3, y: 4 }
    const p = perpendicularVector(v)
    assert.ok(Math.abs(v.x * p.x + v.y * p.y) < 1e-9)
  })
})

describe('effectScale', () => {
  test('defaults to 1 when no effectScale', () => {
    assert.equal(effectScale({}), 1)
    assert.equal(effectScale(null), 1)
  })
  test('returns effectScale when >= 1', () => {
    assert.equal(effectScale({ effectScale: 2 }), 2)
  })
  test('clamps to minimum 1', () => {
    assert.equal(effectScale({ effectScale: 0.5 }), 1)
  })
})

describe('effectOpacity', () => {
  test('defaults to 1', () => assert.equal(effectOpacity({}), 1))
  test('clamps to [0,1]', () => {
    assert.equal(effectOpacity({ emission: 1.5 }), 1)
    assert.equal(effectOpacity({ emission: -0.1 }), 0)
  })
  test('passes through 0.5', () => assert.equal(effectOpacity({ emission: 0.5 }), 0.5))
})

describe('effectGravity', () => {
  test('defaults to 1', () => assert.equal(effectGravity({}), 1))
  test('clamps to [0,1]', () => {
    assert.equal(effectGravity({ gravity: 1.2 }), 1)
    assert.equal(effectGravity({ gravity: -0.1 }), 0)
  })
})

describe('effectFocus', () => {
  test('defaults to 0.5', () => assert.equal(effectFocus({}), 0.5))
  test('clamps to [0,1]', () => {
    assert.equal(effectFocus({ focus: 1.5 }), 1)
    assert.equal(effectFocus({ focus: -0.1 }), 0)
  })
})

describe('effectSuspension', () => {
  test('suspension = 1 - gravity', () => {
    assert.ok(Math.abs(effectSuspension({ gravity: 0.3 }) - 0.7) < 1e-9)
    assert.equal(effectSuspension({ gravity: 1 }), 0)
    assert.equal(effectSuspension({ gravity: 0 }), 1)
  })
})

describe('particleAlpha', () => {
  test('age=0 → alpha=1', () => assert.equal(particleAlpha({ age: 0, life: 60 }), 1))
  test('age=life → alpha=0', () => assert.equal(particleAlpha({ age: 60, life: 60 }), 0))
  test('half life → alpha=0.5', () => {
    const a = particleAlpha({ age: 30, life: 60 })
    assert.ok(Math.abs(a - 0.5) < 1e-9)
  })
})

describe('particleDepth', () => {
  test('age=0 → depth=0', () => assert.equal(particleDepth({ age: 0, life: 60 }), 0))
  test('age=life → depth=1', () => assert.equal(particleDepth({ age: 60, life: 60 }), 1))
})

describe('spellLifetimeFrames', () => {
  test('3s duration → 3*60+36 = 216', () => {
    assert.equal(spellLifetimeFrames({ duration: 3 }), 216)
  })
  test('0 duration → fallback 600', () => {
    assert.equal(spellLifetimeFrames({ duration: 0 }), 600)
  })
  test('null → fallback 600', () => {
    assert.equal(spellLifetimeFrames(null), 600)
  })
  test('custom extra frames', () => {
    assert.equal(spellLifetimeFrames({ duration: 2 }, 0), 120)
  })
})

describe('portalOutDirection', () => {
  test('no direction → normalized result pointing up (negative y screen)', () => {
    const d = portalOutDirection({})
    const mag = Math.hypot(d.x, d.y)
    assert.ok(Math.abs(mag - 1) < 1e-9)
  })
  test('direction with z=1, x=0, y=0 → strong upward', () => {
    const d = portalOutDirection({ direction: { x: 0, y: 0, z: 1 } })
    assert.ok(d.y < 0)  // upward in screen space
  })
  test('returned vector is unit length', () => {
    const d = portalOutDirection(makeSpellIR())
    const mag = Math.hypot(d.x, d.y)
    assert.ok(Math.abs(mag - 1) < 1e-9)
  })
})

describe('scaledParticleCount', () => {
  test('clamped by particleCap', () => {
    const ir = makeSpellIR({ emission: 1 })
    const count = scaledParticleCount(500, ir, DEFAULT_CONFIG)
    assert.ok(count <= 400)
  })
  test('zero emission → zero count', () => {
    const ir = makeSpellIR({ emission: 0 })
    assert.equal(scaledParticleCount(100, ir, DEFAULT_CONFIG), 0)
  })
  test('half emission → half particles', () => {
    const ir = makeSpellIR({ emission: 0.5 })
    const count = scaledParticleCount(100, ir, DEFAULT_CONFIG)
    assert.equal(count, 50)
  })
})

describe('resetParticleState', () => {
  test('clears all keys and restores particles:[]', () => {
    const state = { particles: [1, 2, 3], fireFrame: 42, extra: 'foo' }
    resetParticleState(state)
    assert.deepEqual(state, { particles: [] })
  })
})

// ── fireFlowConfig (SpellIR → effect-config mapping) ────────────────────────

describe('fireFlowConfig', () => {
  test('high force + high gravity → not suspended', () => {
    const ir = makeSpellIR({ force: 0.9, gravity: 1.0, spread: 0.2, stability: 0.8 })
    const portal = makePortal()
    const flow = fireFlowConfig(ir, RING, portal, 0)
    assert.equal(flow.suspended, false)
  })

  test('zero gravity (levitation) → suspended', () => {
    const ir = makeSpellIR({ force: 0.5, gravity: 0.0 })
    const portal = makePortal()
    const flow = fireFlowConfig(ir, RING, portal, 0)
    assert.equal(flow.suspended, true)
  })

  test('high focus → narrower source (smaller suspendedRadiusX)', () => {
    const irLowFocus = makeSpellIR({ focus: 0.1, gravity: 0.0 })
    const irHighFocus = makeSpellIR({ focus: 0.9, gravity: 0.0 })
    const portal = makePortal()
    const flowLow = fireFlowConfig(irLowFocus, RING, portal, 0)
    const flowHigh = fireFlowConfig(irHighFocus, RING, portal, 0)
    assert.ok(flowHigh.suspendedRadiusX < flowLow.suspendedRadiusX)
  })

  test('high stability → higher suspendedDamping (less wander)', () => {
    const irLow = makeSpellIR({ stability: 0.1, gravity: 0.0 })
    const irHigh = makeSpellIR({ stability: 0.9, gravity: 0.0 })
    const portal = makePortal()
    const flowLow = fireFlowConfig(irLow, RING, portal, 0)
    const flowHigh = fireFlowConfig(irHigh, RING, portal, 0)
    assert.ok(flowHigh.suspendedDamping > flowLow.suspendedDamping)
  })

  test('direction and side are unit vectors', () => {
    const ir = makeSpellIR({ direction: { x: 0.5, y: 0.3, z: 0.8, xTiltDeg: 30, yTiltDeg: 20, tiltFromZDeg: 36 } })
    const portal = makePortal()
    const flow = fireFlowConfig(ir, RING, portal, 0)
    const dirMag = Math.hypot(flow.direction.x, flow.direction.y)
    const sideMag = Math.hypot(flow.side.x, flow.side.y)
    assert.ok(Math.abs(dirMag - 1) < 1e-9)
    assert.ok(Math.abs(sideMag - 1) < 1e-9)
  })
})
