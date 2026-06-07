/**
 * StudioPage.jsx — the main Spell Studio screen.
 *
 * Flow:  draw / place symbols  →  Detect (recognize, overlay boxes, correct)  →  Analyze (engine + AI).
 * Extras: copy the drawing as an image, export/import the drawing as JSON, and — when the spell
 * matches a known recipe — contribute the detected symbols to the training set.
 */

import { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import './studio.css'

import DrawingSurface  from './DrawingSurface.jsx'
import SymbolPalette   from './SymbolPalette.jsx'
import IdentifiedPanel from './IdentifiedPanel.jsx'
import SpellTrial      from './SpellTrial.jsx'
import FlowPanel       from './FlowPanel.jsx'
import ThemeSwitcher   from '../../theme/ThemeSwitcher.jsx'
import ConfigPanel     from './ConfigPanel.jsx'

import ResultPanel from '../../components/ResultPanel.jsx'
import { analyze } from '../../engine/analyze.js'
import { isSigilType, getComponentDef } from '../../engine/data.js'
import { computeSignVectors, computeColumnFlow, pressureLateralShare } from '../../engine/geometry.js'
import { useSymbolData } from '../../engine/useSymbolData.js'
import { loadDbSymbols } from '../../engine/symbolLoader.js'
import { toComposition, recognizedToPlaced } from './drawingModel.js'
import { buildClouds, groupToTemplate, mergeGroups } from '../../draw/recognizer.js'
import { useRecognizerWorker } from './useRecognizerWorker.js'
import { addSample } from '../../data-services/samples.js'
import { getSymbolByEngineId } from '../../data-services/symbols.js'
import { logAnalysis } from '../../data-services/analyses.js'
import { useTemplates } from './useTemplates.js'
import { buildSpellIRShim } from './render/spellIRShim.js'
import rules from '../../../data/rules.json'
import { aiEnabled, useCapabilities } from '../../app/capabilities.js'
import { useViewport } from '../../app/useViewport.js'

// AI Report panel — dynamically imported only when aiEnabled (build-time constant).
// When aiEnabled is false (the published build), Rollup/Vite eliminates the dynamic import()
// expression entirely, so react-markdown and the ai/* modules are never emitted to dist/.
const AIReportPanel = aiEnabled ? lazy(() => import('./AIReportPanel.jsx')) : null

const BRIDGE_URL = import.meta.env.VITE_AI_BRIDGE_URL || 'http://localhost:8787'

// Stable per-group id so the Identified-panel rows keep stable React keys across re-detects
// (index keys made row-local state — open editors, status badges — bleed onto the wrong row).
let GROUP_UID = 0
const tagGroups = (groups) => { for (const g of groups || []) { if (!g._uid) g._uid = `g${++GROUP_UID}` } ; return groups }

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
const ROTATION_STEPS = rules.recognition?.rotationSteps ?? 24

// Results-drawer persistence (Item 7).
const DRAWER_H_KEY = 'studio.drawer.height'
const DRAWER_C_KEY = 'studio.drawer.collapsed'
const DRAWER_MIN = 160
const readDrawerHeight = () => {
  const v = Number(localStorage.getItem(DRAWER_H_KEY))
  if (Number.isFinite(v) && v >= DRAWER_MIN) return v
  // Smaller default share on phones so the canvas keeps usable height.
  const isSmall = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches
  return Math.round(window.innerHeight * (isSmall ? 0.38 : 0.45))
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
  // 5.5A: ring indicator overlays — faint dashed bounding-square per detected ring, labeled by id.
  // Uses the DrawingSurface's existing overlay box mechanism (world/centre-origin coords).
  const rings = (d.detectedRings || []).map((ring) => ({
    box: { x: ring.cx - ring.r, y: ring.cy - ring.r, w: ring.r * 2, h: ring.r * 2 },
    label: ring.id,
    kind: 'ring',
  }))
  return [...rings, ...rec, ...placed]
}

// einlair direction for the renderer: flatten the composition's sign components → computeColumnFlow,
// then map the radial resultant (in-plane x/y) + the upward share (z) into the SpellIR.direction the
// effect renderer consumes. No steering signs → a gentle upward spout (z=1). Convention: 0°=north CW;
// paper y is south-positive (so north → up-screen after the renderer's foreshortening).
function einlairDirection(comp) {
  const familyOf = (t) => getComponentDef(t)?.family
  const comps = []
  for (const circle of comp?.circles || []) {
    const cx = circle.center?.x || 0
    const cy = circle.center?.y || 0
    for (const c of circle.components || []) comps.push({ ...c, x: (c.x || 0) + cx, y: (c.y || 0) + cy })
  }
  const flow = computeColumnFlow(comps, familyOf)
  if (!flow) return { x: 0, y: 0, z: 1 } // nothing steers it → gentle upward spout
  const rad = (flow.netAngle * Math.PI) / 180
  const lateral = pressureLateralShare(flow.netFrac, rules.irTuning)
  return {
    x: Math.sin(rad) * lateral,
    y: -Math.cos(rad) * lateral,
    z: flow.inverted ? 0 : (1 - lateral),
  }
}

// ── Dye effects on the render (data/dyes.json ids) ──────────────────────────────
const DYE_AZUREMOON  = 'azuremoon_flower'        // longer duration
const DYE_BLOOD      = 'blood'                   // stronger jet + more water
const DYE_INVISIBLE  = 'blushing_bride_scales'   // those strokes hidden from the render backdrop
const DYE_GLOW       = 'golden_blaze_wyrm_scales' // those strokes keep glowing
const TRIAL_BASE_SECONDS    = 5    // default single-run length (#4)
const AZUREMOON_DURATION_MULT = 2
const BLOOD_POWER             = 4   // Blood dye: dramatic amplification (bigger/faster/farther/more)

// All dye ids present anywhere in the composition.
function compositionDyes(comp) {
  const set = new Set()
  for (const circle of comp?.circles || []) for (const d of circle.dyes || []) set.add(d)
  return set
}
// Count of sign components across all circles.
function signCountOf(comp) {
  return (comp?.circles || []).reduce((n, c) => n + (c.components || []).filter((x) => x.role === 'sign').length, 0)
}

export default function StudioPage() {
  // Re-render the palette + canvas when the DB symbol overlay loads or an Admin edit lands.
  useSymbolData()

  const { isAuthed } = useCapabilities()

  // Responsive layout (SPEC-responsive-mobile). On narrow screens the right palette is hidden
  // (CSS) and replaced by a bottom-sheet; on mobile the post-Analyze split becomes a Draw⇄Cast toggle.
  const { isMobile, isDesktop } = useViewport()
  const [paletteSheetOpen, setPaletteSheetOpen] = useState(false)
  const [mobileView, setMobileView] = useState('draw') // mobile only: 'draw' | 'cast'

  // Re-pull the overlay when the tab regains focus — authed sessions only.
  // Anonymous visitors must never trigger a Supabase call; skip entirely when not signed in.
  useEffect(() => {
    if (!isAuthed) return
    const refresh = () => { if (document.visibilityState !== 'hidden') loadDbSymbols() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [isAuthed])

  // M4b: Pre-warm the ML runtime on Studio mount when engine:'ml' is configured.
  // This pays the one-time model + prototype load cost early so the first Detect is not stalled.
  // Lazy dynamic import keeps onnxruntime-web out of the engine:'p' bundle path (the import()
  // inside warmupMl is gated by the singleton so it never loads unless engine === 'ml').
  useEffect(() => {
    if (rules.recognition?.engine !== 'ml') return
    // Best-effort, non-blocking — failures are swallowed (warmupMl returns false on failure).
    import('../../draw/mlRecognizer.js').then(({ warmupMl }) => warmupMl()).catch(() => {})
  }, [])  // run once on mount

  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)

  const [phase, setPhase] = useState('idle') // 'idle' | 'detected' | 'analyzed'
  // detection includes: placed, recGroups, ringClosed, dyes, detectedRings, relations
  const [detection, setDetection] = useState({ placed: [], recGroups: [], ringClosed: false, dyes: [], detectedRings: [], relations: [] })
  const [overlays, setOverlays] = useState([])
  const [hovered, setHovered]   = useState(null)   // bbox of the row being hovered → canvas glow
  const [showBoxes, setShowBoxes] = useState(true)  // toggle the detection overlay boxes on the canvas
  const [showVectors, setShowVectors] = useState(false) // toggle per-sign direction/force arrows
  const [tab, setTab] = useState('detected')        // results-drawer tab: 'detected' | 'analysis' | 'ai'
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
  const [preparedActiveGating, setPreparedActiveGating] = useState(readGatingSetting)

  // Spell Trial — after the first Analyze the centre SPLITS: drawing on one half, render on the other.
  // The render pane is PERSISTENT (stays open across edits); it shows the last cast and a "stale" badge
  // when the drawing changed since. Auto-analyze (opt-in) re-casts it automatically, debounced.
  const [trialReady, setTrialReady] = useState(false)
  const [trialStale, setTrialStale] = useState(false) // drawing changed since the shown cast
  const [trialBg, setTrialBg] = useState(null)        // PNG data URL of the drawing (cast backdrop)
  const [trialGlow, setTrialGlow] = useState(null)    // PNG of just the Golden-Blaze strokes (glow layer)
  const [splitFrac, setSplitFrac] = useState(0.5)     // drawing-pane share of the centre width (0.2..0.8)
  const trialReadyRef = useRef(false)
  trialReadyRef.current = trialReady
  const workRef = useRef(null)

  // Auto-analyze: re-detect + re-analyze on every drawing change (engine + trial only — no AI, no log).
  const AUTO_LS_KEY = 'studio.autoAnalyze'
  const AUTO_DELAY_LS_KEY = 'studio.autoDelay'
  const [autoAnalyze, setAutoAnalyze] = useState(() => localStorage.getItem(AUTO_LS_KEY) === '1')
  const [autoDelay, setAutoDelay] = useState(() => Number(localStorage.getItem(AUTO_DELAY_LS_KEY)) || 600)
  const autoAnalyzeRef = useRef(autoAnalyze)
  autoAnalyzeRef.current = autoAnalyze
  const autoDelayRef = useRef(autoDelay)
  autoDelayRef.current = autoDelay
  const autoTimerRef = useRef(null)
  const runAutoRef = useRef(null)   // points at runAutoAnalyze (set below; ref breaks the definition cycle)
  useEffect(() => { localStorage.setItem(AUTO_LS_KEY, autoAnalyze ? '1' : '0') }, [autoAnalyze])
  useEffect(() => { localStorage.setItem(AUTO_DELAY_LS_KEY, String(autoDelay)) }, [autoDelay])
  useEffect(() => () => clearTimeout(autoTimerRef.current), [])

  // Any edit to the drawing marks the open render stale; with auto-analyze on, schedule a debounced re-cast.
  const handleDrawingChange = useCallback(() => {
    if (trialReadyRef.current) setTrialStale(true)
    if (autoAnalyzeRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = setTimeout(() => runAutoRef.current?.(), autoDelayRef.current)
    }
  }, [])

  // Dismiss the render pane (the user closed it) — drawing returns to full width.
  const closeTrial = useCallback(() => {
    trialReadyRef.current = false
    setTrialReady(false)
    setSpellIRShim(null)
  }, [])

  // Drag the divider between the drawing and render panes.
  const startSplitResize = useCallback((e) => {
    e.preventDefault()
    const el = workRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const onMove = (ev) => setSplitFrac(Math.max(0.2, Math.min(0.8, (ev.clientX - rect.left) / rect.width)))
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  // A0: accumulate the user's label corrections across the session so logAnalysis can record them.
  const correctionsRef = useRef([])

  // ── Config panel (gear) state ─────────────────────────────────────────────────
  const [configOpen, setConfigOpen] = useState(false)

  // localStorage-backed feature toggles (gated to authed users in ConfigPanel).
  // Keys EXACTLY: 'studio.useDbTraining' and 'studio.showTrainingTools', values '1'/'0'.
  const [useDbTraining, setUseDbTraining] = useState(
    () => localStorage.getItem('studio.useDbTraining') === '1',
  )
  const [showTrainingTools, setShowTrainingTools] = useState(
    () => localStorage.getItem('studio.showTrainingTools') === '1',
  )
  useEffect(() => { localStorage.setItem('studio.useDbTraining',    useDbTraining    ? '1' : '0') }, [useDbTraining])
  useEffect(() => { localStorage.setItem('studio.showTrainingTools', showTrainingTools ? '1' : '0') }, [showTrainingTools])

  const templates = useTemplates({ useDbTraining })

  // P1 — Cloud caching: build template clouds once per template-set change, not on every Detect call.
  // Memoised on `templates` identity (useTemplates returns a stable reference when the set is unchanged).
  const clouds = useMemo(() => buildClouds(templates), [templates])

  // P4 — Web Worker offload: recognition runs off the main thread so the UI never freezes.
  // Falls back to the synchronous path automatically when Worker is unavailable (SSR, old webview).
  const { recognizeAsync } = useRecognizerWorker(templates, clouds)

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

  function handleSymbolSelect(sym) {
    canvasRef.current?.placeSymbol(sym.type, sym.kind)
    // On mobile the palette is a bottom-sheet covering the canvas — close it so the placed
    // symbol is visible and can be moved.
    setPaletteSheetOpen(false)
  }

  // A2: only confident detections feed the engine (low-confidence ones stay visible as "unknown?").
  // Multi-ring path: when we have >1 detected rings, pass rings/relations/ringAssignments so
  // toComposition builds a proper wha-spell@2 with multiple circles (Track 5 §5.4).
  const buildComposition = useCallback((d) => {
    const confidentRecognized = recognizedToPlaced(d.recGroups.filter((g) => g.confident !== false))
    const allPlaced = [...d.placed, ...confidentRecognized]
    const hasMultiRings = Array.isArray(d.detectedRings) && d.detectedRings.length > 1
    if (hasMultiRings) {
      // Build ring assignment map: each recognized group carries .ringIndex; map id → ringIndex.
      const assignments = {}
      for (const g of d.recGroups) {
        if (g.match && g.ringIndex != null) assignments[g.match.name] = g.ringIndex
      }
      // Placed symbols from the palette: assign by proximity to ring centers
      for (const item of d.placed) {
        if ((item.id || item.type) in assignments) continue
        const key = item.id || item.type
        const rings = d.detectedRings
        let bestIdx = 0, bestDist = Infinity
        rings.forEach((r, i) => {
          const dist = Math.hypot((item.x || 0) - r.cx, (item.y || 0) - r.cy)
          if (dist < bestDist) { bestDist = dist; bestIdx = i }
        })
        assignments[key] = bestIdx
      }
      return toComposition(
        { placed: allPlaced, rings: d.detectedRings, ringAssignments: assignments, relations: d.relations || [], dyes: d.dyes, name: '' },
        { isSigil: isSigilType },
      )
    }
    return toComposition(
      { placed: allPlaced, ringClosed: d.ringClosed || undefined, dyes: d.dyes },
      { isSigil: isSigilType },
    )
  }, [])

  // Run the recognizer over the current canvas → Promise<{ d, comp, ringGeomVal }>.
  // P4: delegates to recognizeAsync (Worker or sync fallback) so the main thread never blocks.
  const runRecognition = useCallback(async () => {
    if (!canvasRef.current) return null
    const model = canvasRef.current.getModel()
    const drawn = (canvasRef.current.getStrokes() || []).map((s) => s.points).filter((p) => p && p.length >= 2)
    let recGroups = [], ringClosed = false, recognizerResult = null
    if (drawn.length > 0 && templates.length > 0) {
      recognizerResult = await recognizeAsync(drawn, {
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
        // P3: cheap pre-filter — coarse descriptor → full match on top-K only
        prefilterK:           rules.recognition?.prefilterK           ?? 15,
        prefilterCoarsePoints: rules.recognition?.prefilterCoarsePoints ?? 8,
        // Track 5: multi-ring tolerances (SPEC-nested-linked.md)
        ringAssignSlack:      rules.recognition?.ringAssignSlack      ?? 1.15,
        nestCenterSlack:      rules.recognition?.nestCenterSlack      ?? 0.85,
        linkEndpointSlack:    rules.recognition?.linkEndpointSlack    ?? 0.12,
      })
      recGroups = tagGroups(recognizerResult.groups || [])
      ringClosed = !!recognizerResult.ring
    }
    const detectedRings  = recognizerResult?.rings     || []
    const detectedRelations = recognizerResult?.relations || []
    const d = { placed: model.placed, recGroups, ringClosed, dyes: model.dyes, detectedRings, relations: detectedRelations }
    const RING_RADIUS_FALLBACK = 180
    const stageEl = canvasRef.current?.getStageElement?.()
    const stageW = stageEl?.clientWidth ?? 800
    const stageH = stageEl?.clientHeight ?? 600
    const ringGeomVal = {
      found: !!recognizerResult?.ring,
      center: { x: stageW / 2, y: stageH / 2 },
      radius: recognizerResult?.ring?.radius ?? RING_RADIUS_FALLBACK,
    }
    return { d, comp: buildComposition(d), ringGeomVal }
  }, [templates, recognizeAsync, buildComposition])

  // Push a recognition result into the detect-step state.
  const applyDetection = useCallback(({ d, comp, ringGeomVal }, { keepResult = false } = {}) => {
    setDetection(d)
    setOverlays(overlaysFor(d))
    setComposition(comp)
    if (!keepResult) { setResult(null); setContributeMsg(null) }
    setPhase((p) => (p === 'analyzed' && keepResult ? p : 'detected'))
    setRingGeom(ringGeomVal)
  }, [])

  // STEP 1 — detect (manual button).
  // P4: async so `busy` brackets the real async gap and the spinner can paint.
  const handleDetect = useCallback(async () => {
    if (!canvasRef.current || busy) return
    setBusy(true)
    try {
      const det = await runRecognition()
      if (det) { applyDetection(det); setTab('detected') }
    } finally { setBusy(false) }
  }, [busy, runRecognition, applyDetection])

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

  // Merge several over-split recognized groups into one (single drawn symbol read as 2+).
  // Re-recognizes the combined strokes, replaces the inputs with the merged group, and refreshes
  // overlays + composition. The merged row auto-opens its label editor (see IdentifiedPanel).
  const handleMerge = useCallback((groupsToMerge) => {
    if (!groupsToMerge || groupsToMerge.length < 2) return
    const merged = mergeGroups(groupsToMerge, clouds, { rotationSteps: ROTATION_STEPS, confidenceMinPct: CONFIDENCE_MIN_PCT })
    if (!merged) return
    merged._justMerged = true // signal IdentifiedPanel to open the label editor on this row
    tagGroups([merged]) // stable React key for the new row
    const set = new Set(groupsToMerge)
    const recGroups = detection.recGroups.filter((g) => !set.has(g))
    recGroups.push(merged)
    const d = { ...detection, recGroups }
    setDetection(d); setOverlays(overlaysFor(d))
    const comp = buildComposition(d); setComposition(comp)
    if (phase === 'analyzed') setResult(analyze(comp))
  }, [detection, clouds, buildComposition, phase])

  // Beautify recognized symbols: SMOOTH their actual drawn strokes in place (snap to a clean shape
  // when one fits, else de-jitter) — keeping the drawn size/style/position. Not an SVG swap.
  const handleBeautifyGroups = useCallback((groupsArr) => {
    const list = (groupsArr || []).filter((g) => g && g.match)
    if (list.length === 0 || !canvasRef.current) return
    const refs = list.flatMap((g) => g.strokes || [])
    const n = canvasRef.current.smoothStrokes(refs) || 0
    toast(n ? `Smoothed ${n} stroke${n === 1 ? '' : 's'}` : 'Nothing to smooth')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Erase a listed symbol from the drawing: remove its strokes (recognized) or placed node, then
  // drop it from the detection and refresh composition/overlays.
  const handleEraseRow = useCallback((payload) => {
    if (!canvasRef.current || !payload) return
    let d
    if (payload.group) {
      const g = payload.group
      // Pass g.pts so erase works even when stroke references went stale (re-detect/beautify).
      const removed = canvasRef.current.eraseStrokesByRefs(g.strokes || [], g.pts || [])
      if (!removed) { toast('Could not find this symbol on the canvas'); return }
      d = { ...detection, recGroups: detection.recGroups.filter((x) => x !== g) }
    } else if (payload.placed) {
      const sym = payload.placed
      const removed = canvasRef.current.erasePlacedSymbol(sym.type, sym.x, sym.y)
      if (!removed) { toast('Could not find this symbol on the canvas'); return }
      d = { ...detection, placed: detection.placed.filter((p) => p !== sym) }
    } else return
    setDetection(d); setOverlays(overlaysFor(d)); setHovered(null)
    const comp = buildComposition(d); setComposition(comp)
    if (phase === 'analyzed') setResult(analyze(comp))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detection, phase, buildComposition])

  // Cast: run the engine on a composition, refresh the trial render + backdrop. `silent` (auto-analyze)
  // skips the AI-loop logging and the tab switch so live re-casts don't spam the DB or steal the tab.
  const castFrom = useCallback((comp, ringClosed, { silent = false } = {}) => {
    if (!comp) return
    const res = analyze(comp)
    setResult(res); setPhase('analyzed'); setTrialStale(false)
    if (!silent) {
      setTab('analysis')
      setMobileView('cast') // mobile: reveal the cast pane after an explicit Analyze
      const corrections = correctionsRef.current.length ? { items: [...correctionsRef.current] } : null
      logAnalysis({ composition: comp, engine_result: res, corrections }).catch(() => {})
    }
    const dyes = compositionDyes(comp)

    // Build the SpellIR shim FIRST (before opening the trial) so SpellTrial mounts with the spell
    // already present — otherwise EffectCanvas can mount disabled and never start.
    // #3: a sigil with no signs doesn't form a directed spell → render nothing (just show the seal).
    let shim = null
    if (signCountOf(comp) > 0) {
      // Each cast restarts its run (EffectCanvas also re-stamps on a new spell). #4 single run:
      // a default duration (Azuremoon dye doubles it). #5 Blood: stronger jet + more water.
      const newActivatedAt = performance.now()
      const duration = TRIAL_BASE_SECONDS * (dyes.has(DYE_AZUREMOON) ? AZUREMOON_DURATION_MULT : 1)
      const power = dyes.has(DYE_BLOOD) ? BLOOD_POWER : 1
      shim = buildSpellIRShim(res, !!ringClosed, newActivatedAt, { direction: einlairDirection(comp), duration, power })
    }
    setSpellIRShim(shim)

    // Per-dye backdrop captures: hide Blushing-Bride strokes; solo Golden-Blaze strokes for the glow.
    let bg = null, glow = null
    try {
      bg = canvasRef.current?.toDataURL?.({ pixelRatio: 2, hideDyeIds: [DYE_INVISIBLE] }) ?? null
      glow = dyes.has(DYE_GLOW) ? (canvasRef.current?.toDataURL?.({ pixelRatio: 2, soloDyeIds: [DYE_GLOW] }) ?? null) : null
    } catch { /* capture unsupported */ }
    setTrialBg(bg); setTrialGlow(glow)
    trialReadyRef.current = true
    setTrialReady(true)
  }, [])

  // STEP 2 — analyze (manual button: logs to the improvement loop + switches to the Analysis tab).
  const handleAnalyze = useCallback(() => {
    if (!composition || busy) return
    setBusy(true)
    try { castFrom(composition, detection.ringClosed, { silent: false }) }
    finally { setBusy(false) }
  }, [composition, busy, detection.ringClosed, castFrom])

  // Auto-analyze: debounced detect → analyze on every drawing change. Engine + trial only.
  // P4: async so the worker path is used; a generation counter drops superseded runs.
  const autoGenRef = useRef(0)
  const runAutoAnalyze = useCallback(async () => {
    if (busy || !canvasRef.current) return
    const gen = ++autoGenRef.current
    const det = await runRecognition()
    // Drop the result if a newer auto-analyze run has been started since this one was fired.
    if (gen !== autoGenRef.current) return
    if (!det) return
    applyDetection(det, { keepResult: true })
    castFrom(det.comp, det.d.ringClosed, { silent: true })
  }, [busy, runRecognition, applyDetection, castFrom])
  runAutoRef.current = runAutoAnalyze

  function handleClear() {
    canvasRef.current?.clear()
    setPhase('idle'); setDetection({ placed: [], recGroups: [], ringClosed: false, dyes: [], detectedRings: [], relations: [] })
    setOverlays([]); setComposition(null); setResult(null); setContributeMsg(null)
    correctionsRef.current = []
    // Reset visual effect state
    setSpellIRShim(null); setRingGeom(null)
    // Reset the Spell Trial split
    trialReadyRef.current = false
    setTrialReady(false); setTrialBg(null); setTrialGlow(null); setTrialStale(false)
    clearTimeout(autoTimerRef.current)
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
        await addSample({ symbol_id: sym.id, points, role, source: 'web', app_version: 'studio' })
        saved++
      } catch { /* skip */ }
    }
    setContributeMsg(saved ? `Added ${saved} symbol${saved === 1 ? '' : 's'} to training.` : 'Nothing could be added (no DB / unknown ids).')
  }

  const detectedCount = detection.placed.length + detection.recGroups.filter((g) => g.match).length
  // Spell-match training contribution is PARKED until spell-level training is built (not yet a
  // developed function). Flip SPELL_TRAINING_ENABLED to true to restore the "Contribute symbols
  // to training" box (it offers to seed the training set from a confident catalog match).
  const SPELL_TRAINING_ENABLED = false
  const canContribute = SPELL_TRAINING_ENABLED && phase === 'analyzed' && (result?.similar?.match) && detection.recGroups.some((g) => g.match)

  // Per-sign direction+force vectors via the engine geometry (einlair model). Computed once per render
  // and shared by the canvas overlay (vectorOverlays) and the Flow tab (FlowPanel).
  // NOTE: the composition is wha-spell@2 ({ circles:[{ components }] }) — sign components live inside
  // each circle (their x/y are relative to that circle's centre), so flatten them back to world coords.
  const signVectors = (() => {
    if (!composition) return null
    const familyOf = (t) => getComponentDef(t)?.family
    const comps = []
    let ringRadius = 180
    for (const circle of composition.circles || []) {
      ringRadius = circle.radius || ringRadius
      const cx = circle.center?.x || 0
      const cy = circle.center?.y || 0
      for (const c of circle.components || []) comps.push({ ...c, x: (c.x || 0) + cx, y: (c.y || 0) + cy })
    }
    return { ...computeSignVectors(comps, familyOf), ringRadius }
  })()

  const vectorOverlays = (() => {
    if (!signVectors) return []
    const { signs, flow } = signVectors
    const out = signs.map((s) => ({ x: s.x, y: s.y, angle: s.angle, magnitude: s.magnitude, kind: 'sign' }))
    if (flow) {
      // einlair flow: in-plane net (radial) + out-of-plane (upward) when columns cancel radially;
      // inverted (Φ<0) → the magic spreads radially OUTWARD instead, with no upward flow.
      if (flow.netFrac > 0.04) out.push({ x: 0, y: 0, angle: flow.netAngle, magnitude: flow.netFrac, kind: 'net' })
      if (!flow.inverted && flow.upFrac > 0.06) out.push({ x: 0, y: 0, magnitude: flow.upFrac, kind: 'up' })
      if (flow.inverted) out.push({ x: 0, y: 0, magnitude: 1, kind: 'spread' })
    }
    return out
  })()
  const hasFlow = (signVectors?.signs?.length ?? 0) > 0

  // Stable renderer-config object for the trial (a new identity each render would make EffectCanvas
  // rebuild its renderer + flush particles on every unrelated StudioPage re-render — e.g. hover).
  const trialRenderer = useMemo(() => ({ ...RENDERER_CFG, preparedActiveGating }), [preparedActiveGating])

  // Desktop/tablet: draw + cast sit side-by-side (resizable). Mobile: the cast is a full-cover
  // overlay switched by the Draw⇄Cast toggle, so the canvas stays mounted/measured underneath.
  const showSplit = trialReady && !isMobile

  return (
    <div className="studio-page">
      <header className="studio-header">
        <h1 className="studio-title">Spell Studio</h1>
        <div className="studio-theme-slot"><ThemeSwitcher /></div>
        <button
          className="cfg-gear-btn"
          onClick={() => setConfigOpen(true)}
          title="Settings"
          aria-label="Open settings"
        >
          ⚙
        </button>
      </header>

      <div className="studio-main">
        <div className="studio-centre">
          <div className={`studio-work${showSplit ? ' split' : ''}`} ref={workRef}>
            {/* Mobile: Draw ⇄ Cast segmented toggle (the desktop side-by-side split is unusable
                at phone widths, so the cast pane becomes a full-cover overlay instead). */}
            {trialReady && isMobile && (
              <div className="studio-mobile-viewtabs" role="tablist">
                <button className={`smv-tab${mobileView === 'draw' ? ' active' : ''}`} role="tab"
                  aria-selected={mobileView === 'draw'} onClick={() => setMobileView('draw')}>✎ Draw</button>
                <button className={`smv-tab${mobileView === 'cast' ? ' active' : ''}`} role="tab"
                  aria-selected={mobileView === 'cast'} onClick={() => setMobileView('cast')}>✦ Cast</button>
              </div>
            )}

            {/* Drawing pane — takes the full width until Analyze splits it (desktop only). */}
            <div
              className="studio-draw-pane"
              style={showSplit ? { flexBasis: `${splitFrac * 100}%` } : undefined}
            >
              <div className="studio-canvas-wrap">
                <DrawingSurface
                  ref={canvasRef}
                  palette="dyes"
                  enableSymbols
                  onChange={handleDrawingChange}
                  overlays={showBoxes ? overlays : []}
                  vectors={showVectors ? vectorOverlays : []}
                  highlight={hovered}
                />
              </div>

              <div className="studio-action-bar">
                <button className="primary analyze-btn" onClick={handleDetect} disabled={busy}>
                  {busy && phase === 'idle' ? 'Detecting…' : 'Detect symbols'}
                </button>
                <button className="secondary clear-btn" onClick={handleClear}>Clear</button>
                <label className="auto-toggle" title="Auto-detect + analyze on every drawing change (engine + render only; AI report stays manual)">
                  <input type="checkbox" checked={autoAnalyze} onChange={(e) => setAutoAnalyze(e.target.checked)} />
                  {' ⚡ Auto'}
                </label>
                {autoAnalyze && (
                  <select
                    className="auto-delay"
                    value={autoDelay}
                    onChange={(e) => setAutoDelay(Number(e.target.value))}
                    title="How long to wait after the last edit before auto-analyzing"
                  >
                    <option value={250}>0.25s</option>
                    <option value={600}>0.6s</option>
                    <option value={1000}>1s</option>
                    <option value={2000}>2s</option>
                    <option value={4000}>4s</option>
                  </select>
                )}
                {!isDesktop && (
                  <button className="secondary palette-open-btn" onClick={() => setPaletteSheetOpen(true)} title="Add a sigil or sign">＋ Symbol</button>
                )}
                <span className="action-spacer" />
                <button className="secondary" onClick={handleCopyImage} title="Copy the drawing as an image">⧉ Copy image</button>
                <button className="secondary" onClick={handleExport} title="Export the drawing as JSON">↓ Export</button>
                <button className="secondary" onClick={() => fileInputRef.current?.click()} title="Import a drawing JSON">↑ Import</button>
                <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImport} />
              </div>
            </div>

            {/* Render pane — the live spell trial, beside the drawing (desktop/tablet). */}
            {showSplit && (
              <>
                <div className="studio-split-divider" onPointerDown={startSplitResize} title="Drag to resize" />
                <SpellTrial
                  spellIR={spellIRShim}
                  ringFound={ringGeom?.found}
                  background={trialBg}
                  glow={trialGlow}
                  rulesRenderer={trialRenderer}
                  spellName={result?.similar?.match?.name || result?.name}
                  stale={trialStale}
                  onReanalyze={handleAnalyze}
                  onClose={closeTrial}
                />
              </>
            )}

            {/* Mobile: the cast pane overlays the canvas (canvas stays mounted underneath). */}
            {trialReady && isMobile && mobileView === 'cast' && (
              <div className="studio-mobile-cast">
                <SpellTrial
                  spellIR={spellIRShim}
                  ringFound={ringGeom?.found}
                  background={trialBg}
                  glow={trialGlow}
                  rulesRenderer={trialRenderer}
                  spellName={result?.similar?.match?.name || result?.name}
                  stale={trialStale}
                  onReanalyze={handleAnalyze}
                  onClose={() => setMobileView('draw')}
                />
              </div>
            )}
          </div>
        </div>

        {/* Symbol palette — fixed right rail on desktop; a bottom-sheet (opened by a FAB) on
            narrow screens so symbol placement stays available (SPEC-responsive-mobile P2.3). */}
        {isDesktop ? (
          <aside className="studio-sidebar-right">
            <SymbolPalette onSelect={handleSymbolSelect} pendingType={null} />
          </aside>
        ) : (
          paletteSheetOpen && (
            <div className="studio-sheet-backdrop" onClick={() => setPaletteSheetOpen(false)}>
              <div className="studio-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="studio-sheet-handle" />
                <div className="studio-sheet-head">
                  <span className="studio-sheet-title">Symbols</span>
                  <button className="studio-sheet-close" onClick={() => setPaletteSheetOpen(false)} aria-label="Close">✕</button>
                </div>
                <div className="studio-sheet-body">
                  <SymbolPalette onSelect={handleSymbolSelect} pendingType={null} />
                </div>
              </div>
            </div>
          )
        )}
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
              {overlays.length > 0 && (
                <button
                  className={`srh-btn${showBoxes ? '' : ' srh-btn-off'}`}
                  onClick={() => setShowBoxes((s) => !s)}
                  title={showBoxes ? 'Hide the detection boxes on the canvas' : 'Show the detection boxes'}
                >
                  {showBoxes ? '◳ boxes' : '◳ boxes off'}
                </button>
              )}
              {vectorOverlays.length > 0 && (
                <button
                  className={`srh-btn${showVectors ? '' : ' srh-btn-off'}`}
                  onClick={() => setShowVectors((s) => !s)}
                  title={showVectors
                    ? 'Hide the per-sign direction/force arrows'
                    : 'Show each sign’s direction + force (blue) and the net steer (orange)'}
                >
                  {showVectors ? '➜ vectors' : '➜ vectors off'}
                </button>
              )}
              <button className="srh-btn" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expand' : 'Minimize'}>
                {collapsed ? '▢ expand' : '— minimize'}
              </button>
              <button className="srh-btn" onClick={handleClear} title="Close">✕ close</button>
            </div>
          </div>

          {!collapsed && (
            <>
              {/* Tabs — each panel gets the full drawer width instead of one long scroll. */}
              <div className="studio-results-tabs" role="tablist">
                <button className={`srt-tab${tab === 'detected' ? ' active' : ''}`} role="tab" aria-selected={tab === 'detected'}
                  onClick={() => setTab('detected')}>Detected</button>
                <button className={`srt-tab${tab === 'flow' ? ' active' : ''}`} role="tab" aria-selected={tab === 'flow'}
                  onClick={() => setTab('flow')} disabled={!hasFlow} title="Why the spell is steered this way (vector flow)">Flow</button>
                <button className={`srt-tab${tab === 'analysis' ? ' active' : ''}`} role="tab" aria-selected={tab === 'analysis'}
                  onClick={() => setTab('analysis')} disabled={phase !== 'analyzed'}>Analysis</button>
                {aiEnabled && (
                  <button className={`srt-tab${tab === 'ai' ? ' active' : ''}`} role="tab" aria-selected={tab === 'ai'}
                    onClick={() => setTab('ai')} disabled={phase !== 'analyzed'}>AI Report</button>
                )}
              </div>

              <div className="studio-results-inner">
                {tab === 'detected' && (
                  <div className="detect-block">
                    <div className="detect-head">
                      <p className="detect-hint">Review the detected symbols (boxed on the canvas). Correct any that were misidentified, then analyze.</p>
                      {phase === 'detected' && (
                        <button className="primary" onClick={handleAnalyze} disabled={busy || !composition}>
                          {busy ? 'Analyzing…' : 'Analyze spell'}
                        </button>
                      )}
                    </div>
                    <IdentifiedPanel placed={detection.placed} groups={detection.recGroups} onRelabel={handleCorrect} onMerge={handleMerge}
                      onBeautify={(g) => handleBeautifyGroups([g])} onBeautifyAll={(gs) => handleBeautifyGroups(gs)}
                      onHover={setHovered} onErase={handleEraseRow} trainingEnabled={showTrainingTools} />
                    {canContribute && (
                      <div className="contribute-box">
                        <p className="detect-hint">This matches <strong>{result.similar.match.name}</strong> — its symbols are confirmed and can seed the training set.</p>
                        <button className="primary" onClick={handleContribute}>＋ Contribute symbols to training</button>
                        {contributeMsg && <span className="contribute-msg">{contributeMsg}</span>}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'flow' && hasFlow && (
                  <FlowPanel signs={signVectors.signs} flow={signVectors.flow} ringRadius={signVectors.ringRadius} />
                )}
                {tab === 'analysis' && phase === 'analyzed' && result && <ResultPanel result={result} />}
                {aiEnabled && AIReportPanel && tab === 'ai' && phase === 'analyzed' && result && (
                  <Suspense fallback={<div className="ai-loading">Loading AI…</div>}>
                    <AIReportPanel composition={composition} engineResult={result} bridgeUrl={BRIDGE_URL} />
                  </Suspense>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {flash && <div className="studio-toast">{flash}</div>}

      <ConfigPanel
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        useDbTraining={useDbTraining}
        onToggleDbTraining={() => setUseDbTraining((v) => !v)}
        showTrainingTools={showTrainingTools}
        onToggleTrainingTools={() => setShowTrainingTools((v) => !v)}
      />
    </div>
  )
}
