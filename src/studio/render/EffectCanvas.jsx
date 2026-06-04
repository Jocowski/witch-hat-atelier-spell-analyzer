/**
 * EffectCanvas.jsx — React component that owns the effect overlay canvas.
 *
 * Mounts an absolutely-positioned <canvas> inside `.ds-stage-wrap`, above the Konva Stage,
 * with `pointer-events: none`. Owns the rAF loop, instantiates SpellEffectRenderer,
 * and re-triggers on SpellIR change via signature-based particle reset.
 *
 * Props:
 *   spellIR   : SpellIR | null     — updated after each Analyze; null = no spell
 *   ringGeom  : { center:{x,y}, radius:number, found:boolean } | null
 *   enabled   : boolean            — master switch; false = canvas hidden, rAF stopped
 */
import { useRef, useEffect, useCallback } from 'react'
import { SpellEffectRenderer } from './SpellEffectRenderer.js'
import DEFAULT_RENDERER_CONFIG from './renderConfig.js'

// Merge rules.json renderer block (if provided) with the default config.
function buildConfig(rulesRenderer) {
  if (!rulesRenderer) return DEFAULT_RENDERER_CONFIG
  return {
    renderer: {
      ...DEFAULT_RENDERER_CONFIG.renderer,
      ...rulesRenderer,
    },
  }
}

export default function EffectCanvas({ spellIR, ringGeom, enabled, rulesRenderer }) {
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const rafRef = useRef(null)
  const spellIRRef = useRef(spellIR)
  const ringGeomRef = useRef(ringGeom)
  const enabledRef = useRef(enabled)
  const activatedAtRef = useRef(null)
  const prevActiveRef = useRef(false)

  // Keep refs fresh without re-creating the rAF loop
  spellIRRef.current = spellIR
  ringGeomRef.current = ringGeom
  enabledRef.current = enabled

  // Track activation event (prepared → active flip) to stamp activatedAt
  useEffect(() => {
    const current = spellIR?.active ?? false
    const prev = prevActiveRef.current
    if (current && !prev) {
      // Activation event: open ring → closed ring (or first Analyze with toggle off)
      activatedAtRef.current = performance.now()
    }
    prevActiveRef.current = current
  }, [spellIR])

  // Canvas setup + resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const config = buildConfig(rulesRenderer)
    const renderer = new SpellEffectRenderer(canvas, config)
    rendererRef.current = renderer

    // Size the canvas to match its parent container
    function resize() {
      const parent = canvas.parentElement
      if (!parent) return
      const w = parent.clientWidth || 800
      const h = parent.clientHeight || 600
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement || document.body)

    return () => ro.disconnect()
  }, [rulesRenderer])

  // rAF loop
  const tick = useCallback((timestamp) => {
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    if (!canvas || !renderer || !enabledRef.current) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    let ir = spellIRRef.current
    const ring = ringGeomRef.current

    // Stamp activatedAt into the SpellIR when it's active (renderer uses it for emission fade)
    if (ir && ir.active && activatedAtRef.current !== null) {
      ir = { ...ir, activatedAt: activatedAtRef.current }
    }

    const config = buildConfig(rulesRenderer)
    const preparedActiveGating = config?.renderer?.preparedActiveGating ?? false
    const showGuides = preparedActiveGating

    renderer.config = config
    renderer.render(ir, ring, timestamp, { showGuides })

    rafRef.current = requestAnimationFrame(tick)
  }, [rulesRenderer])

  // Start/stop rAF loop
  useEffect(() => {
    if (enabled) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      // Clear the canvas when disabled
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [enabled, tick])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  )
}
