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
import { loadTemplates } from '../draw/templates.js'

const BRIDGE_URL = import.meta.env.VITE_AI_BRIDGE_URL || 'http://localhost:8787'

// bounding box of a point list → { x, y, w, h }
function bbox(pts) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const p of pts) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y) }
  return { x: a - 6, y: b - 6, w: c - a + 12, h: d - b + 12 }
}
// detection overlay boxes (world/centre-origin) for the recognized groups + placed symbols
function overlaysFor(d) {
  const rec = d.recGroups.filter((g) => g.match).map((g) => ({
    box: bbox(g.pts), label: g.match.name, kind: g.role === 'core' ? 'sigil' : 'sign',
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
  const [collapsed, setCollapsed] = useState(false)
  const [flash, setFlash] = useState(null)
  const [contributeMsg, setContributeMsg] = useState(null)

  const [templates, setTemplates] = useState([])
  useEffect(() => {
    (async () => {
      try { const tpl = await activeTemplates(); setTemplates(tpl.length ? tpl : loadTemplates()) }
      catch { setTemplates(loadTemplates()) }
    })()
  }, [])

  function toast(msg) { setFlash(msg); clearTimeout(toast._t); toast._t = setTimeout(() => setFlash(null), 2200) }

  function handleSymbolSelect(sym) { canvasRef.current?.placeSymbol(sym.type, sym.kind) }

  const buildComposition = useCallback((d) => toComposition(
    { placed: [...d.placed, ...recognizedToPlaced(d.recGroups)], ringClosed: d.ringClosed || undefined, dyes: d.dyes },
    { isSigil: isSigilType },
  ), [])

  // STEP 1 — detect
  const handleDetect = useCallback(() => {
    if (!canvasRef.current || busy) return
    setBusy(true)
    try {
      const model = canvasRef.current.getModel()
      const drawn = (canvasRef.current.getStrokes() || []).map((s) => s.points).filter((p) => p && p.length >= 2)
      let recGroups = [], ringClosed = false
      if (drawn.length > 0 && templates.length > 0) {
        const r = analyzeStrokes(drawn, templates, { gap: 45 })
        recGroups = r.groups || []
        ringClosed = !!r.ring
      }
      const d = { placed: model.placed, recGroups, ringClosed, dyes: model.dyes }
      setDetection(d)
      setOverlays(overlaysFor(d))
      setComposition(buildComposition(d))
      setResult(null); setContributeMsg(null)
      setPhase('detected'); setCollapsed(false)
    } finally { setBusy(false) }
  }, [busy, templates, buildComposition])

  // correct a recognized label → update group + overlay + composition
  function handleCorrect(group, newType) {
    if (!group || !group.match) return
    group.match.name = newType
    const d = { ...detection, recGroups: [...detection.recGroups] }
    setDetection(d); setOverlays(overlaysFor(d))
    const comp = buildComposition(d); setComposition(comp)
    if (phase === 'analyzed') setResult(analyze(comp))
  }

  // STEP 2 — analyze
  const handleAnalyze = useCallback(() => {
    if (!composition || busy) return
    setBusy(true)
    try { setResult(analyze(composition)); setPhase('analyzed'); setCollapsed(false) }
    finally { setBusy(false) }
  }, [composition, busy])

  function handleClear() {
    canvasRef.current?.clear()
    setPhase('idle'); setDetection({ placed: [], recGroups: [], ringClosed: false, dyes: [] })
    setOverlays([]); setComposition(null); setResult(null); setContributeMsg(null)
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
            <DrawingSurface ref={canvasRef} palette="dyes" enableSymbols overlays={overlays} />
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
        <div className={`studio-results ${collapsed ? 'collapsed' : ''}`}>
          <div className="studio-results-head">
            <span className="srh-title">
              {phase === 'analyzed' ? 'Analysis' : 'Detection'} · {detectedCount} symbol{detectedCount === 1 ? '' : 's'}
            </span>
            <div className="srh-actions">
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
                  <AIReportPanel composition={composition} bridgeUrl={BRIDGE_URL} />
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
