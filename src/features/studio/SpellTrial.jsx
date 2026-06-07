/**
 * SpellTrial.jsx — the "cast" view, separated from the drawing surface.
 *
 * After Analyze, StudioPage captures the drawing as a still image and unlocks this view.
 * Here the spell's visual effect plays over that still. The cast runs ONCE for the spell's duration;
 * ↻ Re-run replays it, and the ⟳ Loop toggle auto-replays after each run.
 *
 * 3D portal look (matches wha-spell-simulator): the captured glyph is tilted back with a CSS
 * `perspective` + `rotateX` so the seal lies down like a glowing floor-portal, while the particle
 * EffectCanvas stays flat in screen space (it emits from a tilted-ellipse "portal plane").
 *
 * Props
 * ─────
 *   spellIR       : SpellIR | null   — the analyzed spell (null = render nothing, e.g. sigil-only)
 *   ringFound     : boolean          — whether a ring was detected (portal availability hint)
 *   background    : string | null    — PNG of the drawing (cast backdrop; Blushing-Bride strokes hidden)
 *   glow          : string | null    — PNG of just the Golden-Blaze strokes (a pulsing glow overlay)
 *   rulesRenderer : object           — rules.json renderer block (+ preparedActiveGating)
 *   spellName     : string           — label shown in the trial bar, if known
 *   stale         : boolean          — drawing changed since this cast → show a re-analyze badge
 *   onReanalyze   : () => void        — re-run analysis (from the stale badge)
 *   onClose       : () => void        — dismiss the render pane (optional)
 */
import { useRef, useState, useEffect, useMemo } from 'react'
import EffectCanvas from './render/EffectCanvas.jsx'

export default function SpellTrial({ spellIR, ringFound, background, glow, rulesRenderer, spellName, stale, onReanalyze, onClose }) {
  const stageRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  // Bumping this remounts EffectCanvas → fresh renderer → particles start over (Re-run / awaken).
  const [runKey, setRunKey] = useState(0)
  const [tilt, setTilt] = useState(true)      // 3D portal tilt on/off
  const [active, setActive] = useState(false) // drives the tilt-in "awaken" transition
  const [style, setStyle] = useState('toon')  // 'toon' (cel-shaded ink) | 'glow' (additive particles)
  const [loop, setLoop] = useState(false)     // auto-re-run after each cast finishes
  const [elapsed, setElapsed] = useState(0)   // seconds since this cast started (effect timer)

  const durationSec = Number(spellIR?.duration) > 0 ? Number(spellIR.duration) : 5

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth || 800, h: el.clientHeight || 600 })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Play the tilt-in awaken whenever we (re)enter the view or Re-run: start flat, tilt next frame.
  useEffect(() => {
    setActive(false)
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setActive(true)) })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [runKey])

  // Auto-re-run (Loop): after a cast plays out (its duration + a buffer for particles to clear), replay.
  useEffect(() => {
    if (!loop || !spellIR) return
    const t = setTimeout(() => setRunKey((k) => k + 1), durationSec * 1000 + 2500)
    return () => clearTimeout(t)
  }, [loop, runKey, spellIR, durationSec])

  // Spell-effect timer: count up from the start of each cast (resets on Re-run / new spell).
  useEffect(() => {
    if (!spellIR) { setElapsed(0); return }
    const start = performance.now()
    setElapsed(0)
    const id = setInterval(() => {
      const e = (performance.now() - start) / 1000
      setElapsed(e)
      if (e > durationSec + 1.5) clearInterval(id) // stop once the cast has finished
    }, 100)
    return () => clearInterval(id)
  }, [runKey, spellIR, durationSec])

  // Effect ring geometry. The portal is centred on the stage; its vertical anchor + foreshortening
  // come from the shared PORTAL_* constants (effectUtils). Radius is STAGE-RELATIVE so the particle
  // portal tracks the contain-fit backdrop seal as the pane resizes.
  // MEMOIZED (along with effectConfig below): the per-frame timer re-renders this component, and a new
  // object identity here would make EffectCanvas rebuild its renderer + flush particles every tick.
  const ringGeom = useMemo(() => ({
    found: !!ringFound,
    center: { x: size.w / 2, y: size.h / 2 },
    radius: Math.min(size.w, size.h) * 0.32,
  }), [ringFound, size.w, size.h])

  const effectConfig = useMemo(() => ({ ...rulesRenderer, style }), [rulesRenderer, style])

  const portalOn = tilt && active

  return (
    <div className="spell-trial">
      <div
        ref={stageRef}
        className={`spell-trial-stage${tilt ? ' tilt-3d' : ''}${portalOn ? ' portal-active' : ''}`}
      >
        {background && <img className="spell-trial-bg" src={background} alt="spell drawing" />}
        {glow && <img className="spell-trial-glow" src={glow} alt="" aria-hidden="true" />}
        {spellIR && (
          <div className="spell-trial-timer">
            ⏱ {Math.min(elapsed, durationSec).toFixed(1)}s / {durationSec.toFixed(1)}s
            {elapsed >= durationSec && <span className="spell-trial-timer-done"> · done</span>}
          </div>
        )}
        <EffectCanvas
          key={`${runKey}-${style}`}
          spellIR={spellIR}
          ringGeom={ringGeom}
          enabled={!!spellIR}
          rulesRenderer={effectConfig}
        />
      </div>
      <div className="spell-trial-bar">
        <span className="spell-trial-label">{spellName ? `Casting · ${spellName}` : 'Spell trial'}</span>
        {stale && (
          <button className="spell-trial-stale" onClick={onReanalyze} title="The drawing changed since this cast — re-analyze to update">
            ⟳ stale — re-analyze
          </button>
        )}
        <span className="action-spacer" />
        <button
          className="secondary"
          onClick={() => setStyle((s) => (s === 'toon' ? 'glow' : 'toon'))}
          title="Toggle the effect style: cel-shaded ink vs. glowing particles"
        >
          {style === 'toon' ? '🖌 Toon' : '✨ Glow'}
        </button>
        <button className="secondary" onClick={() => setTilt((t) => !t)} title="Toggle the 3D portal tilt">
          {tilt ? '◈ 3D' : '▭ Flat'}
        </button>
        <button className={`secondary${loop ? ' srh-btn-on' : ''}`} onClick={() => setLoop((l) => !l)} title="Auto-replay the cast in a loop">
          {loop ? '⟳ Loop ✓' : '⟳ Loop'}
        </button>
        <button className="primary" onClick={() => setRunKey((k) => k + 1)} title="Replay the effect">
          ↻ Re-run
        </button>
        {onClose && (
          <button className="secondary" onClick={onClose} title="Close the render pane">✕</button>
        )}
      </div>
    </div>
  )
}
