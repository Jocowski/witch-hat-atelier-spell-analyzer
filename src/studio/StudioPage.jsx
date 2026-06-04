/**
 * StudioPage.jsx — the main Spell Studio screen.
 *
 * Flow:  draw / place symbols  →  Detect (recognize, overlay boxes, correct)  →  Analyze (engine + AI).
 * Extras: copy the drawing as an image, export/import the drawing as JSON, and — when the spell
 * matches a known recipe — contribute the detected symbols to the training set.
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import './studio.css'

import DrawingSurface  from './DrawingSurface.jsx'
import SymbolPalette   from './SymbolPalette.jsx'
import IdentifiedPanel from './IdentifiedPanel.jsx'
import AIReportPanel   from './AIReportPanel.jsx'
import ThemeSwitcher   from '../theme/ThemeSwitcher.jsx'

import ResultPanel from '../components/ResultPanel.jsx'
import { analyze } from '../engine/analyze.js'
import { isSigilType } from '../engine/data.js'
import { toComposition, recognizedToPlaced } from './drawingModel.js'
import { analyzeStrokes, groupToTemplate } from '../draw/recognizer.js'
import { activeTemplates, addSample } from '../data-services/samples.js'
import { getSymbolByEngineId } from '../data-services/symbols.js'
import { logAnalysis } from '../data-services/analyses.js'
import { loadTemplates } from '../draw/templates.js'
import { buildSpellIRShim } from './render/spellIRShim.js'
import rules from '../../data/rules.json'

const BRIDGE_URL = import.meta.env.VITE_AI_BRIDGE_URL || 'http://localhost:8787'

// Visual effect renderer config (from rules.json) — passed to DrawingSurface as-is.
const RENDERER_CFG = rules.renderer ?? {}

// Prepared/active gating toggle (off by default, per SPEC §6.4).
// Session override via localStorage; falls back to rules.json default.
const GATING_LS_KEY = 'studio.renderer.preparedActiveGating'
function readGatingSetting() {
  const stored = localStorage.getItem(GATING_LS_KEY)
  if (stored !== null) return stored === '1'
  return RENDERER_CFG.preparedActiveGating ?? false
}

// Recognizer config (data-driven): source→weight (A1) + verified multiplier (A6) + confidence gate (A2).
// activeTemplates(rules.recognition) resolves the effective weight (sourceWeight * verifiedMultiplier)
// server-side, so the recognizer receives a numeric weight and stays PURE.
const CONFIDENCE_MIN_PCT = rules.recognition?.confidenceMinPct ?? 0

// Results-drawer persistence (Item 7).
const DRAWER_H_KEY = 'studio.drawer.height'
const DRAWER_C_KEY = 'studio.drawer.collapsed'
const DRAWER_MIN = 160
const readDrawerHeight = () => {
  const v = Number(localStorage.getItem(DRAWER_H_KEY))
  return Number.isFinite(v) && v >= DRAWER_MIN ? v : Math.round(window.innerHeight * 0.45)
}
const readDrawerCollapsed = () => localStorage.getItem(DRAWER_C_KEY) === '1'

// bounding box of a point list → { x, y, w, h }
function bbox(pts) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const p of pts) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y) }
  return { x: a - 6, y: b - 6, w: c - a + 12, h: d - b + 12 }
}
// detection overlay boxes (world/centre-origin) for the recognized groups + placed symbols
function overlaysFor(d) {
  const rec = d.recGroups.filter((g) => g.match).map((g) => ({
    box: bbox(g.pts),
    // A2: low-confidence detections read as "unknown?" instead of asserting a wrong label.
    label: g.confident === false ? `unknown? (${g.match.name})` : g.match.name,
    kind: g.role === 'core' ? 'sigil' : 'sign',
  }))
  const placed = d.placed.map((p) => {
    const half = 34 * (p.scale || 1)
    return { box: { x: p.x - half, y: p.y - half, w: half * 2, h: half * 2 }, label: p.type, kind: p.kind }
  })
  return [...rec, ...placed]
}

export default function StudioPage() {
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)

  const [phase, setPhase] = useState('idle') // 'idle' | 'detected' | 'analyzed'
  const [detection, setDetection] = useState({ placed: [], recGroups: [], ringClosed: false, dyes: [] })
  const [overlays, setOverlays] = useState([])
  const [composition, setComposition] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [collapsed, setCollapsed] = useState(readDrawerCollapsed)
  const [drawerHeight, setDrawerHeight] = useState(readDrawerHeight)
  const [flash, setFlash] = useState(null)
  const [contributeMsg, setContributeMsg] = useState(null)

  // Visual effect renderer state (1.1, 1.3, 1.4)
  const [spellIRShim, setSpellIRShim] = useState(null)          // SpellIR object for EffectCanvas
  const [ringGeom, setRingGeom] = useState(null)                  // ring geometry in canvas px
  const [activatedAt, setActivatedAt] = useState(null)            // timestamp of last activation
  const [preparedActiveGating, setPreparedActiveGating] = useState(readGatingSetting)

  // A0: accumulate the user's label corrections across the session so logAnalysis can record them.
  const correctionsRef = useRef([])

  const [templates, setTemplates] = useState([])
  useEffect(() => {
    (async () => {
      try { const tpl = await activeTemplates(rules.recognition); setTemplates(tpl.length ? tpl : loadTemplates()) }
      catch { setTemplates(loadTemplates()) }
    })()
  }, [])

  // persist drawer collapsed/height (Item 7)
  useEffect(() => { localStorage.setItem(DRAWER_C_KEY, collapsed ? '1' : '0') }, [collapsed])
  useEffect(() => { localStorage.setItem(DRAWER_H_KEY, String(drawerHeight)) }, [drawerHeight])

  // drag the drawer's top edge to resize (clamped 160px..85vh)
  function startDrawerResize(e) {
    e.preventDefault()
    const startY = e.clientY
    const startH = drawerHeight
    const onMove = (ev) => {
      const next = Math.max(DRAWER_MIN, Math.min(window.innerHeight * 0.85, startH + (startY - ev.clientY)))
      setDrawerHeight(next)
    }
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function toast(msg) { setFlash(msg); clearTimeout(toast._t); toast._t = setTimeout(() => setFlash(null), 2200) }

  function handleSymbolSelect(sym) { canvasRef.current?.placeSymbol(sym.type, sym.kind) }

  // A2: only confident detections feed the engine (low-confidence ones stay visible as "unknown?").
  const buildComposition = useCallback((d) => toComposition(
    {
      placed: [...d.placed, ...recognizedToPlaced(d.recGroups.filter((g) => g.confident !== false))],
      ringClosed: d.ringClosed || undefined, dyes: d.dyes,
    },
    { isSigil: isSigilType },
  ), [])

  // STEP 1 — detect
  const handleDetect = useCallback(() => {
    if (!canvasRef.current || busy) return
    setBusy(true)
    try {
      const model = canvasRef.current.getModel()
      const drawn = (canvasRef.current.getStrokes() || []).map((s) => s.points).filter((p) => p && p.length >= 2)
      let recGroups = [], ringClosed = false, recognizerResult = null
      if (drawn.length > 0 && templates.length > 0) {
        recognizerResult = analyzeStrokes(drawn, templates, {
          adaptiveGap:          true,
          gapK:                 rules.recognition?.gapK                 ?? 0.12,
          gapMin:               rules.recognition?.gapMin               ?? 14,
          gapMax:               rules.recognition?.gapMax               ?? 80,
          cvThreshold:          rules.recognition?.cvThreshold          ?? 0.3,
          cvThresholdRelaxed:   rules.recognition?.cvThresholdRelaxed   ?? 0.45,
          minRingRadius:        rules.recognition?.minRingRadius        ?? 40,
          floodFill:            rules.recognition?.floodFill            ?? true,
          floodFillConfig:      rules.recognition?.floodFillConfig      ?? {},
          rotationSteps:        rules.recognition?.rotationSteps        ?? 24,
          confidenceMinPct:     CONFIDENCE_MIN_PCT,
        })
        recGroups = recognizerResult.groups || []
        ringClosed = !!recognizerResult.ring
      }
      const d = { placed: model.placed, recGroups, ringClosed, dyes: model.dyes }
      setDetection(d)
      setOverlays(overlaysFor(d))
      setComposition(buildComposition(d))
      setResult(null); setContributeMsg(null)
      setPhase('detected')

      // Derive ring geometry for the effect canvas (SPEC-visual-renderer §3.3).
      // The effect canvas is fixed-size (canvas px); center = stage center.
      // Ring radius: recognizer provides world-px radius; fall back to guide-ring size.
      const RING_RADIUS_FALLBACK = 180
      const detectedRingRadius = recognizerResult?.ring?.radius ?? RING_RADIUS_FALLBACK
      // We derive the stage size from the wrapper element (DrawingSurface exposes no prop for this).
      // Use a safe-to-compute heuristic: the canvas is 100% of ds-stage-wrap.
      const stageEl = canvasRef.current?.getStageElement?.()
      const stageW = stageEl?.clientWidth ?? 800
      const stageH = stageEl?.clientHeight ?? 600
      setRingGeom({
        found: !!recognizerResult?.ring,
        center: { x: stageW / 2, y: stageH / 2 },
        radius: detectedRingRadius,
      })
    } finally { setBusy(false) }
  }, [busy, templates, buildComposition])

  // correct a recognized label → update group + overlay + composition (+ record the correction for A0)
  function handleCorrect(group, newType) {
    if (!group || !group.match) return
    const from = group.match.name
    if (from !== newType) correctionsRef.current.push({ from, to: newType, role: group.role })
    group.match.name = newType
    // A corrected label is, by definition, a confident one now.
    group.confident = true
    const d = { ...detection, recGroups: [...detection.recGroups] }
    setDetection(d); setOverlays(overlaysFor(d))
    const comp = buildComposition(d); setComposition(comp)
    if (phase === 'analyzed') setResult(analyze(comp))
  }

  // STEP 2 — analyze (+ A0: log the analysis + corrections for the improvement loop)
  const handleAnalyze = useCallback(() => {
    if (!composition || busy) return
    setBusy(true)
    try {
      const res = analyze(composition)
      setResult(res); setPhase('analyzed')
      const corrections = correctionsRef.current.length ? { items: [...correctionsRef.current] } : null
      logAnalysis({ composition, engine_result: res, corrections }).catch(() => {})

      // Build the SpellIR shim for the visual effect renderer (SPEC-visual-renderer §8 Phase R1).
      // The shim uses the real spellIR block from analyze() when available.
      const ringClosed = composition?.ring?.closed ?? detection.ringClosed ?? false
      const wasActive = spellIRShim?.active ?? false
      const nowActive = ringClosed || !preparedActiveGating  // toggle-off: always active
      const newActivatedAt = (!wasActive && nowActive) ? performance.now() : (activatedAt ?? performance.now())
      setActivatedAt(newActivatedAt)
      setSpellIRShim(buildSpellIRShim(res, ringClosed, newActivatedAt))
    } finally { setBusy(false) }
  }, [composition, busy, detection.ringClosed, spellIRShim, activatedAt, preparedActiveGating])

  function handleClear() {
    canvasRef.current?.clear()
    setPhase('idle'); setDetection({ placed: [], recGroups: [], ringClosed: false, dyes: [] })
    setOverlays([]); setComposition(null); setResult(null); setContributeMsg(null)
    correctionsRef.current = []
    // Reset visual effect state
    setSpellIRShim(null); setRingGeom(null); setActivatedAt(null)
  }

  // copy the drawing as a PNG to the clipboard
  async function handleCopyImage() {
    try {
      const blob = await canvasRef.current.getImageBlob()
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
      toast('Image copied to clipboard')
    } catch { toast('Image copy not supported in this browser') }
  }

  // export / import the drawing as JSON
  function handleExport() {
    const data = { format: 'spell-studio-drawing@1', model: canvasRef.current?.getModel() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'spell-drawing.json'; a.click()
    URL.revokeObjectURL(a.href)
  }
  function handleImport(e) {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => { try { const d = JSON.parse(r.result); canvasRef.current?.loadModel(d.model || d); toast('Drawing imported') } catch { toast('Invalid drawing JSON') } }
    r.readAsText(f); e.target.value = ''
  }

  // contribute the detected symbols to the training set (gated on a confident catalog match)
  async function handleContribute() {
    const groups = detection.recGroups.filter((g) => g.match)
    let saved = 0
    for (const g of groups) {
      try {
        const sym = await getSymbolByEngineId(g.match.name)
        if (!sym) continue
        const role = g.role === 'core' ? 'sigil' : 'sign'
        const points = groupToTemplate(g, g.match.name, role).points
        await addSample({ symbol_id: sym.id, points, role, source: 'confirmed', app_version: 'studio' })
        saved++
      } catch { /* skip */ }
    }
    setContributeMsg(saved ? `Added ${saved} symbol${saved === 1 ? '' : 's'} to training.` : 'Nothing could be added (no DB / unknown ids).')
  }

  const detectedCount = detection.placed.length + detection.recGroups.filter((g) => g.match).length
  const canContribute = phase === 'analyzed' && (result?.similar?.match) && detection.recGroups.some((g) => g.match)

  return (
    <div className="studio-page">
      <header className="studio-header">
        <h1 className="studio-title">Spell Studio</h1>
        <div className="studio-theme-slot"><ThemeSwitcher /></div>
      </header>

      <div className="studio-main">
        <div className="studio-centre">
          <div className="studio-canvas-wrap">
            <DrawingSurface
              ref={canvasRef}
              palette="dyes"
              enableSymbols
              overlays={overlays}
              spellIR={spellIRShim}
              ringGeom={ringGeom}
              effectsEnabled={phase === 'analyzed' && !!spellIRShim}
              rulesRenderer={{ ...RENDERER_CFG, preparedActiveGating }}
            />
          </div>

          <div className="studio-action-bar">
            <button className="primary analyze-btn" onClick={handleDetect} disabled={busy}>
              {busy && phase === 'idle' ? 'Detecting…' : 'Detect symbols'}
            </button>
            <button className="secondary clear-btn" onClick={handleClear}>Clear</button>
            <span className="action-spacer" />
            <button className="secondary" onClick={handleCopyImage} title="Copy the drawing as an image">⧉ Copy image</button>
            <button className="secondary" onClick={handleExport} title="Export the drawing as JSON">↓ Export</button>
            <button className="secondary" onClick={() => fileInputRef.current?.click()} title="Import a drawing JSON">↑ Import</button>
            <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImport} />
          </div>
        </div>

        <aside className="studio-sidebar-right">
          <SymbolPalette onSelect={handleSymbolSelect} pendingType={null} />
        </aside>
      </div>

      {phase !== 'idle' && (
        <div
          className={`studio-results ${collapsed ? 'collapsed' : ''}`}
          style={collapsed ? undefined : { height: drawerHeight, maxHeight: 'none' }}
        >
          {!collapsed && (
            <div className="studio-results-resize" onPointerDown={startDrawerResize} title="Drag to resize" />
          )}
          <div className="studio-results-head">
            <span className="srh-title">
              {phase === 'analyzed' ? 'Analysis' : 'Detection'} · {detectedCount} symbol{detectedCount === 1 ? '' : 's'}
            </span>
            <div className="srh-actions">
              {/* Ring gating toggle — only shown when preparedActiveGating is enabled in config (spec §6.4) */}
              {RENDERER_CFG.preparedActiveGating && (
                <label className="srh-toggle" title="When ON: open ring = prepared glow; close ring + re-Analyze = full effect. OFF = cast immediately.">
                  <input
                    type="checkbox"
                    checked={preparedActiveGating}
                    onChange={(e) => {
                      const v = e.target.checked
                      setPreparedActiveGating(v)
                      localStorage.setItem(GATING_LS_KEY, v ? '1' : '0')
                    }}
                  />
                  {' Ring gating'}
                </label>
              )}
              <button className="srh-btn" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expand' : 'Minimize'}>
                {collapsed ? '▢ expand' : '— minimize'}
              </button>
              <button className="srh-btn" onClick={handleClear} title="Close">✕ close</button>
            </div>
          </div>

          {!collapsed && (
            <div className="studio-results-inner">
              <div className="detect-block">
                <div className="detect-head">
                  <p className="detect-hint">Review the detected symbols (boxed on the canvas). Correct any that were misidentified, then analyze.</p>
                  {phase === 'detected' && (
                    <button className="primary" onClick={handleAnalyze} disabled={busy || !composition}>
                      {busy ? 'Analyzing…' : 'Analyze spell'}
                    </button>
                  )}
                </div>
                <IdentifiedPanel placed={detection.placed} groups={detection.recGroups} onRelabel={handleCorrect} />
                {canContribute && (
                  <div className="contribute-box">
                    <p className="detect-hint">This matches <strong>{result.similar.match.name}</strong> — its symbols are confirmed and can seed the training set.</p>
                    <button className="primary" onClick={handleContribute}>＋ Contribute symbols to training</button>
                    {contributeMsg && <span className="contribute-msg">{contributeMsg}</span>}
                  </div>
                )}
              </div>

              {phase === 'analyzed' && result && (
                <>
                  <ResultPanel result={result} />
                  <AIReportPanel composition={composition} engineResult={result} bridgeUrl={BRIDGE_URL} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {flash && <div className="studio-toast">{flash}</div>}
    </div>
  )
}
