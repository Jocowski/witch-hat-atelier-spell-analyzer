/**
 * DrawingSurface.jsx  (react-konva rewrite)
 * ─────────────────────────────────────────────────────────────────────────────
 * A self-contained drawing canvas built on react-konva. It manages tool / color /
 * zoom / pan / selection state internally and renders its own ToolDock alongside a
 * Konva <Stage>. Free-draw, shapes, placed symbols, erasers, selection (incl.
 * rubber-band area select), move / rotate / scale (via Transformer), pan and zoom
 * are all native Konva.
 *
 * Props
 * ─────
 *   palette      : 'dyes' | 'bw'   (default 'dyes')
 *   enableSymbols: bool            (default true)  show/hide symbol-placement support
 *   onChange     : (model) => void  called after each committed model change
 *   compact      : bool            (default false) compact toolbar + bounded height
 *   overlays     : Array<{ box:{x,y,w,h}, label:string, kind:string }>
 *                  optional detection overlays drawn in world/centre-origin coords.
 *                  Rendered as dashed accent rectangles with a label chip on a
 *                  non-interactive top layer that tracks zoom/pan exactly.
 *
 * Imperative API (forwardRef + useImperativeHandle) — UNCHANGED CONTRACT
 * ─────────────────────────────────────────────────────────────────────
 *   getModel()            → { strokes, placed, dyes }
 *                           strokes : [{tool,color,width,dyeId,points:[{x,y}]}]
 *                           placed  : [{id,type,kind,x,y,rotation,scale,inverted}]
 *                                     positions are CENTRE-ORIGIN (world coords, y down)
 *                           dyes    : [dyeId]
 *   getFreehandStrokes()  → [[{x,y}]]  brush-only, world coords (zoom-independent)
 *   getStrokes()          → same as getModel().strokes
 *   clear()               → wipes canvas
 *   placeSymbol(type, kind) → drops symbol at viewport centre
 *   selectNone()          → clears selection
 *
 * New imperative methods (additive)
 * ──────────────────────────────────
 *   toDataURL(opts?)      → string (PNG data URL). Captures only the content layer;
 *                           overlay layer and any Transformer/marquee are excluded.
 *                           opts forwarded to Konva Stage.toDataURL (pixelRatio etc.)
 *   getImageBlob()        → Promise<Blob> (PNG) — for clipboard/download.
 *   loadModel(model)      → void. Restores drawing from a model object shaped like
 *                           getModel()'s output. Replaces current content, resets
 *                           selection, and fires onChange.
 *
 * World coordinates
 * ─────────────────
 *   The internal model stores every point / symbol in WORLD coords whose origin is
 *   the canvas centre (y increases downward). The Konva content <Layer> carries the
 *   world→screen transform (pan offset + centre + zoom), so model data is always
 *   zoom/pan-independent — exactly what getModel()/getStrokes() must return.
 */

import {
  useRef, useEffect, useImperativeHandle, forwardRef,
  useCallback, useState, useMemo,
} from 'react'
import Konva from 'konva'
import {
  Stage, Layer, Line, Rect, Circle as KCircle, Path, Transformer, Text, Group, Arrow,
} from 'react-konva'
import { line, rect, triangle, circle, brush } from './tools/shapes.js'
import { beautifyStroke, weldsRingGap } from './tools/beautify.js'
import { findFillTarget } from './tools/fill.js'
import { getComponentDef } from '../engine/data.js'
import ToolDock from './ToolDock.jsx'
import EffectCanvas from './render/EffectCanvas.jsx'
import './drawing.css'

// Enable the RIGHT mouse button (2) for dragging. Konva's default `dragButtons` is [0, 1]
// (left + middle), so right-drag panning — wired below via startDrag() — silently no-ops without this.
// Process-wide, but this app only uses Konva here.
Konva.dragButtons = [0, 1, 2]

const HISTORY_LIMIT = 50  // max undo depth

// Beautify assist persisted prefs (SPEC-stroke-beautify.md) — default OFF (app unchanged until opted in).
const LS_AUTO_BEAUTIFY = 'studio.beautify.auto'
const LS_STREAMLINE    = 'studio.beautify.streamline'
const readBeautifyPref = (key) => { try { return localStorage.getItem(key) === '1' } catch { return false } }
const HOLD_SNAP_MS  = 450   // QuickShape: pause this long at the end of a brush stroke to snap it (Phase 2)
const STREAMLINE_ALPHA = 0.45  // live smoothing: new point = lerp(prev, raw, alpha); lower = smoother/laggier

// ── constants ─────────────────────────────────────────────────────────────────

const RING_RADIUS   = 180   // faint guide ring (world coords)
const TRACE_SCALE   = 2.8   // svgPath (-50..50 viewBox) → world units for the tracing guide
const SYMBOL_SIZE   = 20    // default half-size when rendering a symbol glyph (world units)
const MIN_ZOOM      = 0.15
const MAX_ZOOM      = 8
const ZOOM_STEP     = 0.15
const COMPACT_H     = 380   // bounded stage height in compact mode

const SHAPE_TOOLS = new Set(['line', 'rect', 'triangle', 'circle', 'arrow'])
const DRAW_TOOLS  = new Set(['brush', 'line', 'rect', 'triangle', 'circle', 'arrow'])

// Accent color used for overlays (matches --accent CSS var; hardcoded so Konva can use it)
const OVERLAY_ACCENT = '#c9a24a'
const OVERLAY_LABEL_BG = 'rgba(201,162,74,0.85)'
const OVERLAY_LABEL_COLOR = '#1a1208'
const OVERLAY_FONT_SIZE = 11   // world units (will be divided by zoom when rendered)

// Vector overlay colors: per-sign force arrows vs. the net (resultant) aim arrow.
const VEC_SIGN_COLOR  = '#3aa0e8'   // per-sign direction+force
const VEC_NET_COLOR   = '#e0683a'   // net resultant (in-plane / radial steer)
const VEC_FORCE_COLOR = '#8a7bd8'   // non-directional sign: force, no steer (ring, no arrow)
const VEC_UP_COLOR    = '#5ec8a0'   // out-of-plane "upward flow" (einlair U): balanced columns → up
const VEC_SPREAD_COLOR = '#d8923a'  // inverted columns (Φ<0): magic spreads radially outward
// Arrow length (world px) for a unit-magnitude vector; total length = base + magnitude·gain.
const VEC_SIGN_BASE = 16
const VEC_SIGN_GAIN = 52
const VEC_NET_BASE  = 70
const VEC_NET_GAIN  = 150

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
let UID = 0
const nextId = () => `n${++UID}`

// ── geometry helpers ──────────────────────────────────────────────────────────

/** Arrow: shaft point-array + an arrowhead sub-polyline (split by a NaN sentinel). */
function arrowPoints(a, b) {
  const shaft = line(a, b, 6)
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 4) return shaft
  const ux = dx / len, uy = dy / len
  const hs = Math.min(16, len * 0.35)
  const perp = { x: -uy, y: ux }
  const head1 = { x: b.x - ux * hs + perp.x * hs * 0.45, y: b.y - uy * hs + perp.y * hs * 0.45 }
  const head2 = { x: b.x - ux * hs - perp.x * hs * 0.45, y: b.y - uy * hs - perp.y * hs * 0.45 }
  return [...shaft, { x: NaN, y: NaN }, head1, b, head2]
}

/** Produce a world-coord point array for a shape tool drag from a→b. */
function shapePoints(toolName, a, b) {
  switch (toolName) {
    case 'line':     return line(a, b, 6)
    case 'rect':     return rect(a, b)
    case 'triangle': return triangle(a, b)
    case 'circle': {
      const r  = Math.max(Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2)
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
      return circle({ x: cx, y: cy }, r)
    }
    case 'arrow':    return arrowPoints(a, b)
    default:         return []
  }
}

/** A stroke's [{x,y}] points → flat [x0,y0,x1,y1,...] for Konva <Line>, NaN gaps dropped. */
function flatten(points) {
  const flat = []
  for (const p of points) {
    if (Number.isNaN(p.x) || Number.isNaN(p.y)) continue
    flat.push(p.x, p.y)
  }
  return flat
}

/** Axis-aligned bbox of a world-coord point array (ignores NaN sentinels). */
function strokeBBox(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (Number.isNaN(p.x) || Number.isNaN(p.y)) continue
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  if (minX === Infinity) return null
  return { minX, minY, maxX, maxY }
}

function rectsIntersect(a, b) {
  return !(b.minX > a.maxX || b.maxX < a.minX || b.minY > a.maxY || b.maxY < a.minY)
}

/** True when two point arrays are the same stroke (reference, or matching length + endpoints/mid). */
function samePoints(a, b) {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return false
  const i = a.length - 1
  const m = a.length >> 1
  return a[0].x === b[0].x && a[0].y === b[0].y &&
         a[m].x === b[m].x && a[m].y === b[m].y &&
         a[i].x === b[i].x && a[i].y === b[i].y
}

// ── model import helpers ──────────────────────────────────────────────────────

/** Validate and normalise a single stroke from a loadModel() call. Returns null if invalid. */
function normStroke(s) {
  if (!s || typeof s !== 'object') return null
  const points = Array.isArray(s.points)
    ? s.points.filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number')
    : []
  if (points.length < 2) return null
  return {
    id: nextId(),
    kind: 'stroke',
    tool: typeof s.tool === 'string' ? s.tool : 'brush',
    color: typeof s.color === 'string' ? s.color : '#c9a24a',
    width: typeof s.width === 'number' ? Math.max(1, s.width) : 3,
    dyeId: s.dyeId ?? null,
    fill: typeof s.fill === 'string' ? s.fill : null,
    fillDyeId: s.fillDyeId ?? null,
    points,
  }
}

/** Validate and normalise a single placed symbol from a loadModel() call. Returns null if invalid. */
function normPlaced(p) {
  if (!p || typeof p !== 'object') return null
  const type = typeof p.type === 'string' ? p.type : (typeof p.id === 'string' ? p.id : null)
  if (!type) return null
  return {
    id: nextId(),
    kind: 'symbol',
    type,
    symKind: typeof p.kind === 'string' ? p.kind : 'sign',
    x: typeof p.x === 'number' ? p.x : 0,
    y: typeof p.y === 'number' ? p.y : 0,
    rotation: typeof p.rotation === 'number' ? p.rotation : 0,
    scale: typeof p.scale === 'number' ? Math.max(0.1, p.scale) : 1,
    inverted: !!p.inverted,
    color: typeof p.color === 'string' ? p.color : '#c9a24a',
    dyeId: p.dyeId ?? null,
  }
}

// ── DrawingSurface ────────────────────────────────────────────────────────────

const DrawingSurface = forwardRef(function DrawingSurface(props, ref) {
  const {
    palette         = 'dyes',
    enableSymbols   = true,
    onChange,
    compact         = false,
    overlays,        // Array<{ box:{x,y,w,h}, label, kind }> | undefined
    traceSvg,        // string | null — an svgPath drawn faintly on the canvas as a tracing guide
    traceOpacity = 0.18, // opacity of the tracing guide
    highlight,       // { x,y,w,h } | null — a glowing box (e.g. the hovered Identified-panel row)
    vectors,         // Array<{ x,y, angle:(deg|null), magnitude, kind:'sign'|'net' }> | undefined
    //                  per-sign direction+force arrows (world coords); angle null = force-only ring
    spellIR,         // SpellIR | null — passed from StudioPage after Analyze
    ringGeom,        // { center:{x,y}, radius:number, found:boolean } | null
    effectsEnabled = false,  // master switch for the visual effect overlay
    rulesRenderer,   // rules.json.renderer block (particle config + thresholds)
  } = props

  // ── tool / color / brush state ─────────────────────────────────────────────
  const [tool,      setTool]      = useState('brush')
  const [color,     setColor]     = useState('#c9a24a')
  const [dyeId,     setDyeId]     = useState(null)
  const [brushSize, setBrushSize] = useState(3)

  // ── beautify assist (SPEC-stroke-beautify.md) — persisted user prefs ─────────
  const [autoBeautify, setAutoBeautify] = useState(() => readBeautifyPref(LS_AUTO_BEAUTIFY))
  const [streamline,   setStreamline]   = useState(() => readBeautifyPref(LS_STREAMLINE))
  useEffect(() => { try { localStorage.setItem(LS_AUTO_BEAUTIFY, autoBeautify ? '1' : '0') } catch { /* ignore */ } }, [autoBeautify])
  useEffect(() => { try { localStorage.setItem(LS_STREAMLINE,   streamline   ? '1' : '0') } catch { /* ignore */ } }, [streamline])

  // ── view (zoom + pan) — Konva-friendly: layer transform = pan + centre + zoom ─
  const [zoom,    setZoom]    = useState(1)
  const [pan,     setPan]     = useState({ x: 0, y: 0 })   // pan offset (screen px)
  const [stageSz, setStageSz] = useState({ width: 800, height: 600 })

  // ── content model (React state → drives both render and getModel) ───────────
  // node: { id, kind:'stroke'|'symbol', ...}
  //   stroke: { tool, color, width, dyeId, points:[{x,y}] }
  //   symbol: { type, symKind:'sign'|'sigil', x, y, rotation, scale, inverted, color }
  const [nodes, setNodes] = useState([])
  const [dyes,  setDyes]  = useState([])
  const [selectedIds, setSelectedIds] = useState([])

  // ── refs ────────────────────────────────────────────────────────────────────
  const wrapRef      = useRef(null)
  const stageRef     = useRef(null)
  const layerRef     = useRef(null)
  const overlayLayerRef = useRef(null)   // non-interactive overlay layer
  const trRef        = useRef(null)
  const nodeRefs     = useRef(new Map())   // id → Konva node (for Transformer attach)

  const nodesRef    = useRef(nodes); nodesRef.current = nodes
  const dyesRef     = useRef(dyes);  dyesRef.current  = dyes
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange

  // gesture refs (no re-render churn)
  const drawingRef  = useRef(false)
  const startRef    = useRef(null)              // world start point of current drag
  const livePtsRef  = useRef([])                // accumulating brush points (world)
  const lastMoveRef = useRef({ t: 0, x: 0, y: 0 })  // last brush move (time + world pos) → hold-to-snap (Phase 2)
  // live refs so gesture handlers read current prefs without re-subscribing
  const autoBeautifyRef = useRef(autoBeautify); autoBeautifyRef.current = autoBeautify
  const streamlineRef   = useRef(streamline);   streamlineRef.current   = streamline
  const [preview, setPreview] = useState(null)  // { tool,color,width,points } in-progress
  const [marquee, setMarquee] = useState(null)  // { x0,y0,x1,y1 } in world coords (rubber-band)
  const erasedRef   = useRef(false)             // a delete happened in this gesture
  const spaceRef    = useRef(false)             // space held → pan mode
  const marqueeShiftRef = useRef(false)         // shift held when marquee started
  const historyRef  = useRef({ past: [], future: [] })  // undo/redo snapshot stacks
  const pendingSnapRef = useRef(false)                  // a gesture began → snapshot on first mutation
  const [panning, setPanning] = useState(false)         // right/space drag in progress (cursor only)
  const pinchRef    = useRef(null)                      // { dist, cx, cy } two-finger pinch (screen px) | null
  const [dockCollapsed, setDockCollapsed] = useState(false)  // mobile: collapse the toolbar to reclaim canvas

  // ── world ↔ screen ──────────────────────────────────────────────────────────
  // screen = world*zoom + (pan + centre);  world = (screen - pan - centre) / zoom
  const cx = stageSz.width / 2
  const cy = stageSz.height / 2

  const toWorld = useCallback((sx, sy) => ({
    x: (sx - pan.x - cx) / zoom,
    y: (sy - pan.y - cy) / zoom,
  }), [pan.x, pan.y, cx, cy, zoom])

  /** World position of the current pointer (uses live stage pointer). */
  const pointerWorld = useCallback(() => {
    const stage = stageRef.current
    const p = stage?.getPointerPosition()
    if (!p) return null
    return toWorld(p.x, p.y)
  }, [toWorld])

  // ── model change notifier ────────────────────────────────────────────────────
  // `dyes` is DERIVED from the current content (stroke ink, stroke fill, placed symbols) — NOT an
  // append-only list — so erasing a dyed stroke removes its dye (e.g. Blood) from the spell.
  const buildModel = useCallback((ns) => {
    const strokes = []
    const placed  = []
    const dyeSet  = new Set()
    for (const n of ns) {
      if (n.kind === 'stroke') {
        strokes.push({ tool: n.tool, color: n.color, width: n.width, dyeId: n.dyeId, fill: n.fill ?? null, points: n.points })
        if (n.dyeId) dyeSet.add(n.dyeId)
        if (n.fillDyeId) dyeSet.add(n.fillDyeId)
      } else {
        placed.push({
          id: n.type, type: n.type, kind: n.symKind,
          x: n.x, y: n.y, rotation: n.rotation, scale: n.scale, inverted: n.inverted, dyeId: n.dyeId ?? null,
        })
        if (n.dyeId) dyeSet.add(n.dyeId)
      }
    }
    return { strokes, placed, dyes: [...dyeSet] }
  }, [])

  const fireChange = useCallback((ns, ds) => {
    onChangeRef.current?.(buildModel(ns ?? nodesRef.current, ds ?? dyesRef.current))
  }, [buildModel])

  // ── undo/redo (Item 2) ───────────────────────────────────────────────────────
  // The whole drawing is two immutable arrays (nodes, dyes) that every mutation REPLACES wholesale,
  // so a snapshot can just keep the current array references. snapshot() is called once at the START
  // of each mutating action (gesture-start for draw/erase, so a stroke or an eraser drag = one step).
  const snapshot = useCallback(() => {
    const h = historyRef.current
    h.past.push({ nodes: nodesRef.current, dyes: dyesRef.current })
    if (h.past.length > HISTORY_LIMIT) h.past.shift()
    h.future = []
  }, [])

  // Take the pending gesture's snapshot on its FIRST real mutation, so a brush stroke / eraser drag
  // collapses to a single undo step and a no-op gesture (click that draws/erases nothing) adds none.
  const maybeSnap = useCallback(() => {
    if (pendingSnapRef.current) { snapshot(); pendingSnapRef.current = false }
  }, [snapshot])

  const applySnapshot = useCallback((s) => {
    nodesRef.current = s.nodes; dyesRef.current = s.dyes
    setNodes(s.nodes); setDyes(s.dyes); setSelectedIds([])
    fireChange(s.nodes, s.dyes)
  }, [fireChange])

  const undo = useCallback(() => {
    const h = historyRef.current
    if (!h.past.length) return
    h.future.push({ nodes: nodesRef.current, dyes: dyesRef.current })
    applySnapshot(h.past.pop())
  }, [applySnapshot])

  const redo = useCallback(() => {
    const h = historyRef.current
    if (!h.future.length) return
    h.past.push({ nodes: nodesRef.current, dyes: dyesRef.current })
    applySnapshot(h.future.pop())
  }, [applySnapshot])

  // Tool selection that also clears the selection when leaving a transform tool. Shared by the
  // ToolDock buttons and the keyboard shortcuts (Item 3) so behavior stays identical.
  const selectTool = useCallback((t) => {
    setTool(t)
    if (t !== 'select' && t !== 'move' && t !== 'rotate') setSelectedIds([])
  }, [])

  // Manual beautify (Beautify button / Q): snap the selected stroke(s) to clean shapes.
  // Falls back to the most recent stroke when nothing is selected. One undo step for the batch.
  // Defined before the keydown effect that lists it as a dependency (avoids a TDZ on mount).
  const beautifySelected = useCallback(() => {
    const all = nodesRef.current
    const selected = new Set(selectedIds)
    let targets = all.filter((n) => n.kind === 'stroke' && selected.has(n.id))
    if (targets.length === 0) {
      const last = [...all].reverse().find((n) => n.kind === 'stroke')
      if (last) targets = [last]
    }
    if (targets.length === 0) return
    const ids = new Set(targets.map((n) => n.id))
    let changed = false
    // Manual = intentional cleanup: smooth curvy/organic strokes (spirals etc.) that match no
    // primitive, instead of leaving them raw. (Auto stays snap-only — see commitStroke.)
    const next = all.map((n) => {
      if (!ids.has(n.id)) return n
      const res = beautifyStroke(n.points, { smoothFallback: true })
      if (res.kind === 'none') return n
      changed = true
      return { ...n, points: res.points }
    })
    if (!changed) return
    snapshot()
    setNodes(next); nodesRef.current = next
    fireChange(next)
  }, [selectedIds, snapshot, fireChange])

  // Duplicate the current selection (strokes + symbols), offset slightly, and select the copies.
  // One undo step. Bound to Ctrl/Cmd+D and the ToolDock "Duplicate" button.
  const duplicateSelected = useCallback(() => {
    const sel = new Set(selectedIds)
    const originals = nodesRef.current.filter((n) => sel.has(n.id))
    if (originals.length === 0) return
    const OFF = 24 // world-px offset so the copy is visibly displaced
    const clones = originals.map((n) => {
      if (n.kind === 'stroke') {
        return { ...n, id: nextId(), points: n.points.map((p) => (Number.isNaN(p.x) ? p : { x: p.x + OFF, y: p.y + OFF })) }
      }
      return { ...n, id: nextId(), x: (n.x || 0) + OFF, y: (n.y || 0) + OFF }
    })
    snapshot()
    const next = [...nodesRef.current, ...clones]
    nodesRef.current = next
    setNodes(next)
    setSelectedIds(clones.map((c) => c.id))
    fireChange(next)
  }, [selectedIds, snapshot, fireChange])

  // ── imperative API (contract preserved + new methods) ───────────────────────
  useImperativeHandle(ref, () => ({
    // ── EXISTING (contract unchanged) ───────────────────────────────────────
    getModel() {
      return buildModel(nodesRef.current, dyesRef.current)
    },
    getFreehandStrokes() {
      return nodesRef.current.filter((n) => n.kind === 'stroke' && n.tool === 'brush').map((n) => n.points)
    },
    getStrokes() {
      return nodesRef.current
        .filter((n) => n.kind === 'stroke')
        .map((n) => ({ tool: n.tool, color: n.color, width: n.width, dyeId: n.dyeId, points: n.points }))
    },
    clear() {
      snapshot()
      setNodes([]); setDyes([]); setSelectedIds([])
      nodesRef.current = []; dyesRef.current = []
      onChangeRef.current?.({ strokes: [], placed: [], dyes: [] })
    },
    undo() { undo() },
    redo() { redo() },
    placeSymbol(type, kind) {
      if (!enableSymbols) return
      snapshot()
      // Drop at the current viewport centre, converted to world coords (accounts for pan/zoom).
      const wc = toWorld(stageSz.width / 2, stageSz.height / 2)
      const sym = {
        id: nextId(), kind: 'symbol',
        type, symKind: kind || 'sign',
        x: Math.round(wc.x), y: Math.round(wc.y), rotation: 0, scale: 1, inverted: false, color, dyeId,
      }
      setNodes((prev) => {
        const next = [...prev, sym]
        nodesRef.current = next
        let ds = dyesRef.current
        if (dyeId && !ds.includes(dyeId)) { ds = [...ds, dyeId]; setDyes(ds); dyesRef.current = ds }
        fireChange(next, ds)
        return next
      })
      setSelectedIds([sym.id])
    },
    selectNone() { setSelectedIds([]) },

    // ── NEW: smoothStrokes ───────────────────────────────────────────────────
    // Beautify specific strokes IN PLACE — snap to a clean shape when one fits, else smooth the
    // jitter — keeping each stroke's size/position/style (no SVG swap). Used by the Identified panel
    // to clean a recognized symbol's actual drawing. One undo step. Returns the count changed.
    //   strokeRefs: array of point-arrays ([{x,y}][]) identifying the strokes to clean.
    smoothStrokes(strokeRefs) {
      if (!Array.isArray(strokeRefs) || strokeRefs.length === 0) return 0
      const updates = new Map() // node id → new points
      for (const sref of strokeRefs) {
        const node = nodesRef.current.find((n) => n.kind === 'stroke' && samePoints(n.points, sref))
        if (!node || updates.has(node.id)) continue
        const res = beautifyStroke(node.points, { smoothFallback: true })
        if (res.kind === 'none') continue
        updates.set(node.id, res.points)
      }
      if (updates.size === 0) return 0
      snapshot()
      const next = nodesRef.current.map((n) => (updates.has(n.id) ? { ...n, points: updates.get(n.id) } : n))
      nodesRef.current = next
      setNodes(next)
      fireChange(next)
      return updates.size
    },

    // ── NEW: erase helpers (used by the Identified panel's per-row delete) ────
    // Remove the stroke nodes belonging to a recognized group. Matches by reference/endpoints first
    // (samePoints); if that finds nothing (stale refs after a re-detect/beautify), falls back to
    // point-membership against the group's full point cloud `fallbackPts` (g.pts). Returns the count.
    eraseStrokesByRefs(strokeRefs, fallbackPts) {
      const ids = new Set()
      for (const sref of (strokeRefs || [])) {
        const node = nodesRef.current.find((n) => n.kind === 'stroke' && samePoints(n.points, sref))
        if (node) ids.add(node.id)
      }
      // Fallback: a node belongs to the group when most of its points are inside the group's cloud.
      if (ids.size === 0 && Array.isArray(fallbackPts) && fallbackPts.length) {
        const key = (p) => `${Math.round(p.x)},${Math.round(p.y)}`
        const cloud = new Set(fallbackPts.filter((p) => p && !Number.isNaN(p.x)).map(key))
        for (const n of nodesRef.current) {
          if (n.kind !== 'stroke') continue
          const pts = n.points.filter((p) => p && !Number.isNaN(p.x))
          if (pts.length === 0) continue
          let inside = 0
          for (const p of pts) if (cloud.has(key(p))) inside++
          if (inside / pts.length >= 0.6) ids.add(n.id)
        }
      }
      if (ids.size === 0) return 0
      snapshot()
      const next = nodesRef.current.filter((n) => !ids.has(n.id))
      nodesRef.current = next
      setNodes(next)
      setSelectedIds((prev) => prev.filter((id) => !ids.has(id)))
      fireChange(next)
      return ids.size
    },
    // Remove the placed symbol of `type` nearest (x,y). Returns 1 if removed, else 0.
    erasePlacedSymbol(type, x, y) {
      let best = null, bestD = Infinity
      for (const n of nodesRef.current) {
        if (n.kind !== 'symbol' || n.type !== type) continue
        const d = Math.hypot((n.x || 0) - (x || 0), (n.y || 0) - (y || 0))
        if (d < bestD) { bestD = d; best = n }
      }
      if (!best) return 0
      snapshot()
      const next = nodesRef.current.filter((n) => n.id !== best.id)
      nodesRef.current = next
      setNodes(next)
      setSelectedIds((prev) => prev.filter((id) => id !== best.id))
      fireChange(next)
      return 1
    },

    // ── NEW: toDataURL ───────────────────────────────────────────────────────
    // Captures a PNG of the content layer only (overlay + Transformer excluded).
    // opts is forwarded to Konva Stage.toDataURL (supports pixelRatio, mimeType, quality).
    // Dye filtering (for the render backdrop's per-dye effects):
    //   opts.hideDyeIds : string[]  — temporarily hide strokes drawn with these dye ids
    //   opts.soloDyeIds : string[]  — show ONLY strokes drawn with these dye ids (hide the rest)
    toDataURL(opts = {}) {
      const { hideDyeIds, soloDyeIds, ...stageOpts } = opts
      const stage = stageRef.current
      const overlayLayer = overlayLayerRef.current
      const tr = trRef.current

      // Temporarily hide elements that must not appear in the export.
      const overlayWasVisible = overlayLayer?.visible()
      if (overlayLayer) overlayLayer.visible(false)
      if (tr) tr.visible(false)

      // Per-dye stroke filtering: toggle the matching Konva stroke nodes' visibility.
      const dyeHidden = []
      const solo = Array.isArray(soloDyeIds) && soloDyeIds.length ? soloDyeIds : null
      const hide = Array.isArray(hideDyeIds) && hideDyeIds.length ? hideDyeIds : null
      if (solo || hide) {
        for (const n of nodesRef.current) {
          const knode = nodeRefs.current.get(n.id)
          if (!knode) continue
          // solo: keep ONLY strokes drawn with a soloed dye (hide everything else, symbols included);
          // hide: drop strokes drawn with a hidden dye.
          const shouldHide = solo
            ? !(n.kind === 'stroke' && solo.includes(n.dyeId))
            : (n.kind === 'stroke' && hide.includes(n.dyeId))
          if (shouldHide) { dyeHidden.push([knode, knode.visible()]); knode.visible(false) }
        }
      }

      let dataURL
      try {
        dataURL = stage?.toDataURL({ pixelRatio: 1, ...stageOpts }) ?? ''
      } finally {
        if (overlayLayer) overlayLayer.visible(overlayWasVisible ?? true)
        if (tr) tr.visible(true)
        for (const [k, v] of dyeHidden) k.visible(v)
        stage?.batchDraw()
      }
      return dataURL
    },

    // ── NEW: getImageBlob ────────────────────────────────────────────────────
    // Returns a Promise<Blob> (PNG). Reuses toDataURL then converts via fetch.
    getImageBlob() {
      const dataURL = this.toDataURL()
      return fetch(dataURL).then((r) => r.blob())
    },

    // ── NEW: loadModel ───────────────────────────────────────────────────────
    // Restores drawing from a model shaped like getModel()'s output.
    // Validates/guards every field; resets selection; fires onChange.
    loadModel(model) {
      if (!model || typeof model !== 'object') return
      snapshot()

      const rawStrokes = Array.isArray(model.strokes) ? model.strokes : []
      const rawPlaced  = Array.isArray(model.placed)  ? model.placed  : []
      const rawDyes    = Array.isArray(model.dyes)    ? model.dyes.filter((d) => typeof d === 'string') : []

      const strokeNodes = rawStrokes.map(normStroke).filter(Boolean)
      const symbolNodes = rawPlaced.map(normPlaced).filter(Boolean)
      const nextNodes = [...strokeNodes, ...symbolNodes]
      const nextDyes  = rawDyes.slice()

      nodesRef.current = nextNodes
      dyesRef.current  = nextDyes
      setNodes(nextNodes)
      setDyes(nextDyes)
      setSelectedIds([])
      onChangeRef.current?.(buildModel(nextNodes, nextDyes))
    },
  }), [buildModel, enableSymbols, color, dyeId, fireChange, toWorld, stageSz.width, stageSz.height, snapshot, undo, redo])

  // ── size observer ────────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => {
      const w = wrap.clientWidth  || 800
      const h = compact ? COMPACT_H : (wrap.clientHeight || 600)
      setStageSz({ width: w, height: h })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [compact])

  // ── keyboard: space-to-pan · undo/redo · tool shortcuts (Items 2 + 3) ─────────
  useEffect(() => {
    // Tool letters. `t` would collide with rotate's mnemonic, so triangle uses `g`.
    const TOOL_KEYS = { b: 'brush', l: 'line', r: 'rect', g: 'triangle', c: 'circle', a: 'arrow', f: 'fill', v: 'select', m: 'move', t: 'rotate', h: 'pan' }
    const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    const down = (e) => {
      if (e.code === 'Space') { spaceRef.current = true; return }
      if (isTyping(e.target)) return
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase()
        if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
        else if (k === 'y') { e.preventDefault(); redo() }
        else if (k === 'd') { e.preventDefault(); duplicateSelected() }  // duplicate selection
        return
      }
      if (e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'e') { e.preventDefault(); selectTool(e.shiftKey ? 'eraserPixel' : 'eraserStroke') }
      else if (k === 'q') { e.preventDefault(); beautifySelected() }  // QuickShape: beautify selection
      else if (TOOL_KEYS[k]) { e.preventDefault(); selectTool(TOOL_KEYS[k]) }
    }
    const up = (e) => { if (e.code === 'Space') spaceRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [undo, redo, selectTool, beautifySelected, duplicateSelected])

  // ── attach Transformer to current selection ──────────────────────────────────
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    if (tool !== 'select' && tool !== 'move' && tool !== 'rotate') { tr.nodes([]); tr.getLayer()?.batchDraw(); return }
    const knodes = selectedIds.map((id) => nodeRefs.current.get(id)).filter(Boolean)
    tr.nodes(knodes)
    tr.getLayer()?.batchDraw()
  }, [selectedIds, nodes, tool])

  // ── zoom ──────────────────────────────────────────────────────────────────────
  const applyZoom = useCallback((newZoom, pivotSx, pivotSy) => {
    const z = clamp(newZoom, MIN_ZOOM, MAX_ZOOM)
    // keep world point under pivot fixed: world = (pivot - pan - c)/zoom must stay constant
    setPan((prev) => {
      const wx = (pivotSx - prev.x - cx) / zoom
      const wy = (pivotSy - prev.y - cy) / zoom
      return { x: pivotSx - cx - wx * z, y: pivotSy - cy - wy * z }
    })
    setZoom(z)
  }, [zoom, cx, cy])

  const zoomAtCenter = useCallback((delta) => applyZoom(zoom + delta, cx, cy), [applyZoom, zoom, cx, cy])
  const resetView    = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])

  // wheel: Shift+wheel zooms around cursor (clamped); plain wheel pans
  const onWheel = useCallback((e) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    const p = stage?.getPointerPosition()
    if (!p) return
    if (e.evt.shiftKey) {
      const factor = e.evt.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP
      applyZoom(zoom * factor, p.x, p.y)
    } else {
      setPan((prev) => ({ x: prev.x - e.evt.deltaX * 0.6, y: prev.y - e.evt.deltaY * 0.6 }))
    }
  }, [applyZoom, zoom])

  // ── selection helpers ──────────────────────────────────────────────────────────
  const isTransformTool = tool === 'select' || tool === 'move' || tool === 'rotate'

  function commitStroke(points, toolName, { beautify = false } = {}) {
    if (!points || points.length < 2) return
    let pts = points
    // Auto-beautify (QuickShape): only freehand strokes; shape tools already emit clean geometry.
    // Snap only on a confident shape match (smoothFallback off ⇒ freeform strokes stay raw).
    if (beautify && toolName === 'brush') {
      const res = beautifyStroke(points, { smoothFallback: false })
      if (res.kind !== 'none') pts = res.points
    }
    // Close-the-ring weld: when beautify is active, a stroke that bridges an existing open ring's
    // gap merges into one closed circle (prepared spell → cast) instead of adding a separate line.
    if (beautify || autoBeautifyRef.current) {
      for (const n of nodesRef.current) {
        if (n.kind !== 'stroke') continue
        const circ = weldsRingGap(n.points, pts)
        if (circ) {
          maybeSnap()
          const next = nodesRef.current.map((x) => (x.id === n.id ? { ...x, points: circ } : x))
          setNodes(next); nodesRef.current = next
          fireChange(next)
          return
        }
      }
    }
    maybeSnap()
    const node = { id: nextId(), kind: 'stroke', tool: toolName, color, width: brushSize, dyeId, points: pts }
    setNodes((prev) => {
      const next = [...prev, node]
      nodesRef.current = next
      let ds = dyesRef.current
      if (dyeId && !ds.includes(dyeId)) { ds = [...ds, dyeId]; setDyes(ds); dyesRef.current = ds }
      fireChange(next, ds)
      return next
    })
  }

  function removeNodes(idSet) {
    if (idSet.size === 0) return
    setNodes((prev) => {
      const next = prev.filter((n) => !idSet.has(n.id))
      nodesRef.current = next
      fireChange(next)
      return next
    })
    setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)))
  }

  // ── erasers (operate in world coords) ────────────────────────────────────────
  function eraseStrokeAt(wp) {
    const radius = Math.max(brushSize * 2, 8) / 1  // world units
    const toRemove = new Set()
    for (const n of nodesRef.current) {
      if (n.kind === 'stroke') {
        const hit = n.points.some((p) => !Number.isNaN(p.x) && Math.hypot(p.x - wp.x, p.y - wp.y) <= radius)
        if (hit) toRemove.add(n.id)
      } else if (enableSymbols) {
        const half = SYMBOL_SIZE * (n.scale ?? 1) + 4
        if (Math.hypot(n.x - wp.x, n.y - wp.y) <= half) toRemove.add(n.id)
      }
    }
    if (toRemove.size) { maybeSnap(); erasedRef.current = true; removeNodes(toRemove) }
  }

  function erasePixelAt(wp) {
    const R = Math.max(brushSize * 2, 10)
    const r2 = R * R
    let changed = false
    const out = []
    for (const n of nodesRef.current) {
      if (n.kind !== 'stroke') {
        // Item 4: a vector symbol can't be partially erased — delete it whole when the eraser touches it.
        if (enableSymbols && n.kind === 'symbol') {
          const half = SYMBOL_SIZE * (n.scale ?? 1) + 4
          if (Math.hypot((n.x ?? 0) - wp.x, (n.y ?? 0) - wp.y) <= R + half) { changed = true; continue }
        }
        out.push(n); continue
      }
      let any = false
      const segs = []
      let cur = []
      for (const p of n.points) {
        if (Number.isNaN(p.x)) { if (cur.length >= 2) segs.push(cur); cur = []; continue }
        const inside = (p.x - wp.x) ** 2 + (p.y - wp.y) ** 2 <= r2
        if (inside) { if (cur.length >= 2) segs.push(cur); cur = []; any = true }
        else cur.push(p)
      }
      if (cur.length >= 2) segs.push(cur)
      if (!any) { out.push(n) }
      else {
        changed = true
        for (const seg of segs) out.push({ ...n, id: nextId(), points: seg })
      }
    }
    if (changed) {
      maybeSnap()
      erasedRef.current = true
      setNodes(out); nodesRef.current = out
      fireChange(out)
    }
  }

  // ── fill (ink bucket) — flood a CLOSED stroke with the active ink ─────────────
  // One click = one undo step. No-op when the click isn't inside a closed shape (an open
  // shape, or empty space). Clicking a shape already filled with the active color clears it
  // (toggle), so the same tool both fills and un-fills.
  function fillAt(wp) {
    const strokeNodes = nodesRef.current.filter((n) => n.kind === 'stroke')
    const target = findFillTarget(strokeNodes, wp)
    if (!target) return  // open shape or empty space → nothing to fill
    const nextFill = target.fill === color ? null : color
    snapshot()
    const next = nodesRef.current.map((n) => (n.id === target.id ? { ...n, fill: nextFill, fillDyeId: nextFill ? dyeId : null } : n))
    setNodes(next); nodesRef.current = next
    // Filling with a dyed ink registers the dye on the spell (same as a dyed stroke).
    let ds = dyesRef.current
    if (nextFill && dyeId && !ds.includes(dyeId)) { ds = [...ds, dyeId]; setDyes(ds); dyesRef.current = ds }
    fireChange(next, ds)
  }

  // ── touch gestures: 1 finger = draw/tool · 2 fingers = pinch-zoom + pan ────────
  // (SPEC-responsive-mobile Phase 1). Multi-touch is intercepted here BEFORE it reaches the
  // single-pointer draw handlers, which are unaware of touch count. Coords are stage-local px.
  function touchPoints(touches) {
    const rect = stageRef.current?.container()?.getBoundingClientRect()
    const out = []
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]
      out.push({ x: t.clientX - (rect?.left || 0), y: t.clientY - (rect?.top || 0) })
    }
    return out
  }

  // Abandon any in-progress single-pointer gesture without committing (e.g. a second finger
  // landed mid-stroke → that stroke must not be drawn).
  function abortDrawing() {
    drawingRef.current = false
    livePtsRef.current = []
    startRef.current = null
    setPreview(null)
    setMarquee(null)
  }

  function onStageTouchStart(e) {
    const touches = e.evt.touches
    if (touches && touches.length >= 2) {
      abortDrawing()
      const [a, b] = touchPoints(touches)
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }
      return
    }
    onStageMouseDown(e)
  }

  function onStageTouchMove(e) {
    const touches = e.evt.touches
    if (pinchRef.current && touches && touches.length >= 2) {
      e.evt.preventDefault()
      const [a, b] = touchPoints(touches)
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const ncx = (a.x + b.x) / 2, ncy = (a.y + b.y) / 2
      const prev = pinchRef.current
      if (prev.dist > 0) applyZoom(zoom * (dist / prev.dist), ncx, ncy)  // zoom anchored on the pinch centre
      setPan((p) => ({ x: p.x + (ncx - prev.cx), y: p.y + (ncy - prev.cy) }))  // pan by centroid drift
      pinchRef.current = { dist, cx: ncx, cy: ncy }
      return
    }
    onStageMouseMove(e)
  }

  function onStageTouchEnd(e) {
    if (pinchRef.current) {
      // Keep pinching until fewer than 2 fingers remain. When a finger lifts, don't let the
      // remaining one resume drawing from a stale gesture — require a fresh touch.
      if (e.evt.touches && e.evt.touches.length >= 2) return
      pinchRef.current = null
      drawingRef.current = false
      return
    }
    onStageMouseUp(e)
  }

  // ── pointer / gesture handlers (on Stage) ────────────────────────────────────
  function onStageMouseDown(e) {
    const stage = stageRef.current
    const evt = e.evt
    // pan: right-button OR space held. Start the Stage drag HERE, from Konva's own mousedown —
    // react-konva doesn't wire DOM capture-phase handlers (onMouseDownCapture maps to a non-existent
    // 'mousedowncapture' Konva event that never fires), so the drag must be kicked off from this
    // handler. Konva.dragButtons (set at module load) allows the right button.
    if (evt.button === 2 || spaceRef.current || tool === 'pan') {
      if (stage) { stage.draggable(true); stage.startDrag(); setPanning(true) }
      return
    }

    const wp = pointerWorld()
    if (!wp) return

    // ── erasers ───────────────────────────────────────────────────────────────
    if (tool === 'eraserStroke') { drawingRef.current = true; erasedRef.current = false; pendingSnapRef.current = true; eraseStrokeAt(wp); return }
    if (tool === 'eraserPixel')  { drawingRef.current = true; erasedRef.current = false; pendingSnapRef.current = true; erasePixelAt(wp); return }

    // ── fill (single click, no drag) ──────────────────────────────────────────
    if (tool === 'fill') { fillAt(wp); return }

    // ── transform tools (select / move / rotate) ──────────────────────────────
    if (isTransformTool) {
      // click on a node is handled by the node's own onMouseDown (selects it).
      // Empty-space click → begin rubber-band marquee (or clear).
      const onEmpty = e.target === stage || e.target.attrs?._bg
      if (onEmpty) {
        if (!evt.shiftKey) setSelectedIds([])
        drawingRef.current = true
        startRef.current = wp
        marqueeShiftRef.current = !!evt.shiftKey
        setMarquee({ x0: wp.x, y0: wp.y, x1: wp.x, y1: wp.y })
      }
      return
    }

    // ── draw tools ──────────────────────────────────────────────────────────────
    if (DRAW_TOOLS.has(tool)) {
      drawingRef.current = true
      pendingSnapRef.current = true  // commitStroke takes the snapshot on mouseup (one step per stroke)
      startRef.current = wp
      if (tool === 'brush') {
        livePtsRef.current = [wp]
        lastMoveRef.current = { t: performance.now(), x: wp.x, y: wp.y }
        setPreview({ tool: 'brush', color, width: brushSize, points: [wp] })
      }
    }
  }

  function onStageMouseMove() {
    if (!drawingRef.current) return
    const wp = pointerWorld()
    if (!wp) return

    if (tool === 'eraserStroke') { eraseStrokeAt(wp); return }
    if (tool === 'eraserPixel')  { erasePixelAt(wp);  return }

    if (isTransformTool && marquee) {
      setMarquee((m) => (m ? { ...m, x1: wp.x, y1: wp.y } : m))
      return
    }

    if (tool === 'brush') {
      // Streamline (Phase 3): pull each new point toward the previous one to damp hand jitter.
      let p = wp
      if (streamlineRef.current && livePtsRef.current.length) {
        const prev = livePtsRef.current[livePtsRef.current.length - 1]
        p = { x: prev.x + (wp.x - prev.x) * STREAMLINE_ALPHA, y: prev.y + (wp.y - prev.y) * STREAMLINE_ALPHA }
      }
      livePtsRef.current.push(p)
      lastMoveRef.current = { t: performance.now(), x: wp.x, y: wp.y }  // for hold-to-snap
      setPreview({ tool: 'brush', color, width: brushSize, points: livePtsRef.current.slice() })
      return
    }
    if (SHAPE_TOOLS.has(tool) && startRef.current) {
      setPreview({ tool, color, width: brushSize, points: shapePoints(tool, startRef.current, wp) })
    }
  }

  function onStageMouseUp() {
    if (!drawingRef.current) { return }
    drawingRef.current = false
    const wp = pointerWorld()

    if (tool === 'eraserStroke' || tool === 'eraserPixel') {
      erasedRef.current = false
      return
    }

    if (isTransformTool && marquee) {
      const box = {
        minX: Math.min(marquee.x0, marquee.x1), maxX: Math.max(marquee.x0, marquee.x1),
        minY: Math.min(marquee.y0, marquee.y1), maxY: Math.max(marquee.y0, marquee.y1),
      }
      setMarquee(null)
      // tiny marquee = treated as a click on empty space (already cleared on down)
      if (Math.abs(box.maxX - box.minX) < 3 && Math.abs(box.maxY - box.minY) < 3) return
      const hits = []
      for (const n of nodesRef.current) {
        const bb = n.kind === 'stroke'
          ? strokeBBox(n.points)
          : { minX: n.x - SYMBOL_SIZE * n.scale, maxX: n.x + SYMBOL_SIZE * n.scale,
              minY: n.y - SYMBOL_SIZE * n.scale, maxY: n.y + SYMBOL_SIZE * n.scale }
        if (bb && rectsIntersect(box, bb)) hits.push(n.id)
      }
      setSelectedIds((prev) => (
        marqueeShiftRef.current ? Array.from(new Set([...prev, ...hits])) : hits
      ))
      return
    }

    if (tool === 'brush') {
      const pts = brush(livePtsRef.current)
      // Phase 2 (QuickShape hold-to-snap): pausing at the end of the stroke snaps it even when
      // Auto is off. Held = no pointer movement for HOLD_SNAP_MS before release.
      const held = (performance.now() - lastMoveRef.current.t) >= HOLD_SNAP_MS
      const beautify = autoBeautifyRef.current || held
      livePtsRef.current = []
      setPreview(null)
      commitStroke(pts, 'brush', { beautify })
      return
    }
    if (SHAPE_TOOLS.has(tool) && startRef.current && wp) {
      const pts = shapePoints(tool, startRef.current, wp)
      setPreview(null)
      commitStroke(pts, tool)
    }
  }

  // ── per-node interaction (click to select; eraserStroke click) ───────────────
  function onNodeMouseDown(e, id) {
    const evt = e.evt
    if (evt.button === 2 || spaceRef.current || tool === 'pan') return
    if (tool === 'eraserStroke') {
      e.cancelBubble = true
      snapshot()
      erasedRef.current = true
      removeNodes(new Set([id]))
      return
    }
    if (isTransformTool) {
      e.cancelBubble = true
      setSelectedIds((prev) => {
        if (evt.shiftKey) {
          return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        }
        return prev.includes(id) && prev.length === 1 ? prev : [id]
      })
    }
  }

  // ── commit Konva node transform back into the world-coord model ──────────────
  function commitSymbolTransform(id, knode) {
    snapshot()
    const absScaleX = Math.abs(knode.scaleX())
    setNodes((prev) => {
      const next = prev.map((n) => {
        if (n.id !== id || n.kind !== 'symbol') return n
        // Path symbols render at base scaleX = (SYMBOL_SIZE/50)*n.scale; the fallback circle
        // renders at scaleX = 1. A Transformer resize multiplies the node's scaleX — recover
        // the new model scale by dividing out the appropriate base.
        const def  = n.type ? getComponentDef(n.type) : null
        const base = def?.svgPath ? (SYMBOL_SIZE / 50) : 1
        const newScale = Math.max(0.1, absScaleX / base)
        // node position is already in layer (world) coords — the Layer holds the view transform.
        return {
          ...n,
          x: knode.x(),
          y: knode.y(),
          rotation: knode.rotation(),
          scale: Math.round(newScale * 100) / 100,
        }
      })
      nodesRef.current = next
      fireChange(next)
      return next
    })
  }

  function commitStrokeTransform(id, knode) {
    snapshot()
    // Bake the Konva node transform into the stroke's world points, then reset the node.
    const tr = knode.getTransform()
    setNodes((prev) => {
      const next = prev.map((n) => {
        if (n.id !== id || n.kind !== 'stroke') return n
        const pts = n.points.map((p) =>
          (Number.isNaN(p.x) ? p : tr.point({ x: p.x, y: p.y })))
        return { ...n, points: pts }
      })
      nodesRef.current = next
      fireChange(next)
      return next
    })
    knode.position({ x: 0, y: 0 }); knode.rotation(0); knode.scaleX(1); knode.scaleY(1)
  }

  // ── render geometry derived from view ────────────────────────────────────────
  const layerProps = { x: pan.x + cx, y: pan.y + cy, scaleX: zoom, scaleY: zoom }
  const dash = (n) => n / zoom

  const cursor = useMemo(() => {
    if (panning) return 'grabbing'
    if (spaceRef.current || tool === 'pan') return 'grab'
    return cursorForTool(tool)
  }, [tool, panning])

  function cursorForTool(t) {
    switch (t) {
      case 'eraserStroke': case 'eraserPixel': return 'cell'
      case 'fill': return 'pointer'
      case 'select': return 'default'
      case 'move': return 'move'
      case 'rotate': return 'crosshair'
      default: return 'crosshair'
    }
  }

  const stageHeight = compact ? COMPACT_H : stageSz.height

  // ── overlay rendering ────────────────────────────────────────────────────────
  // Overlays use the same layer transform (layerProps) so they track pan/zoom exactly.
  // Font size and stroke width are divided by zoom to stay constant in screen pixels.
  const hasOverlays = Array.isArray(overlays) && overlays.length > 0
  const hasHighlight = !!(highlight && highlight.w > 0 && highlight.h > 0)
  const hasVectors = Array.isArray(vectors) && vectors.length > 0
  const overlayStrokeW = 1.5 / zoom
  const labelFontSize  = OVERLAY_FONT_SIZE / zoom
  const labelPad       = 2 / zoom

  return (
    <div className={`ds-surface${compact ? ' ds-compact' : ''}`}>
      <ToolDock
        tool={tool} setTool={selectTool}
        color={color} setColor={setColor}
        dyeId={dyeId} setDyeId={setDyeId}
        brushSize={brushSize} setBrushSize={setBrushSize}
        palette={palette}
        compact={compact}
        collapsed={dockCollapsed}
        onToggleCollapse={compact ? undefined : () => setDockCollapsed((c) => !c)}
        zoom={zoom}
        onZoomIn={() => zoomAtCenter(ZOOM_STEP)}
        onZoomOut={() => zoomAtCenter(-ZOOM_STEP)}
        onZoomReset={resetView}
        onRecenter={() => setPan({ x: 0, y: 0 })}
        autoBeautify={autoBeautify} setAutoBeautify={setAutoBeautify}
        streamline={streamline} setStreamline={setStreamline}
        onBeautify={beautifySelected}
        onDuplicate={duplicateSelected}
        hasSelection={selectedIds.length > 0}
      />

      <div
        ref={wrapRef}
        className="ds-stage-wrap"
        style={compact ? { height: COMPACT_H, flex: 'none' } : undefined}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Stage
          ref={stageRef}
          width={stageSz.width}
          height={stageHeight}
          style={{ cursor, touchAction: 'none', background: 'var(--panel-2)' }}
          draggable={false}  /* panning is enabled imperatively on right-button / space */
          onMouseDown={onStageMouseDown}
          onMouseMove={onStageMouseMove}
          onMouseUp={onStageMouseUp}
          onTouchStart={onStageTouchStart}
          onTouchMove={onStageTouchMove}
          onTouchEnd={onStageTouchEnd}
          onWheel={onWheel}
          onContextMenu={(e) => e.evt.preventDefault()}
          onDragEnd={(e) => {
            const st = stageRef.current
            if (e.target === st) {
              // Stage was panned: fold its drag offset into `pan`, then reset the Stage
              // origin to 0 so the Layer transform (pan + centre + zoom) isn't double-applied.
              const px = st.x(), py = st.y()
              st.position({ x: 0, y: 0 })
              st.draggable(false)
              setPan((prev) => ({ x: prev.x + px, y: prev.y + py }))
            }
            setPanning(false)
          }}
        >
          {/* ── Content layer ──────────────────────────────────────────────── */}
          <Layer {...layerProps} ref={layerRef}>
            {/* background hit-rect so empty-space clicks register for marquee/clear.
                Tagged _bg so onStageMouseDown treats a hit here as "empty space". */}
            <Rect x={-100000} y={-100000} width={200000} height={200000} _bg listening />

            {/* faint guide ring + centre dot */}
            <KCircle x={0} y={0} radius={RING_RADIUS} stroke="rgba(201,162,74,0.18)"
              strokeWidth={2 / zoom} dash={[dash(8), dash(6)]} listening={false} />
            <KCircle x={0} y={0} radius={3 / zoom} fill="rgba(201,162,74,0.25)" listening={false} />

            {/* optional tracing guide: a faint reference glyph to draw over (Training) */}
            {traceSvg && (
              <Path
                data={traceSvg}
                x={0} y={0}
                scaleX={TRACE_SCALE} scaleY={TRACE_SCALE}
                fill={OVERLAY_ACCENT}
                fillRule="evenodd"
                opacity={traceOpacity}
                listening={false}
              />
            )}

            {/* committed nodes */}
            {nodes.map((n) => {
              const selectable = isTransformTool
              if (n.kind === 'stroke') {
                return (
                  <Line
                    key={n.id}
                    ref={(el) => { if (el) nodeRefs.current.set(n.id, el); else nodeRefs.current.delete(n.id) }}
                    points={flatten(n.points)}
                    stroke={n.color || '#c9a24a'}
                    strokeWidth={n.width || 3}
                    closed={!!n.fill}
                    fill={n.fill || undefined}
                    lineCap="round"
                    lineJoin="round"
                    hitStrokeWidth={Math.max(n.width || 3, 12)}
                    draggable={selectable}
                    onMouseDown={(e) => onNodeMouseDown(e, n.id)}
                    onTouchStart={(e) => onNodeMouseDown(e, n.id)}
                    onDragEnd={(e) => commitStrokeTransform(n.id, e.target)}
                    onTransformEnd={(e) => commitStrokeTransform(n.id, e.target)}
                  />
                )
              }
              // symbol
              const def = n.type ? getComponentDef(n.type) : null
              const scale = (SYMBOL_SIZE / 50) * (n.scale ?? 1)  // viewBox -50..50 → half-size
              const common = {
                x: n.x, y: n.y, rotation: n.rotation,
                draggable: selectable,
                onMouseDown: (e) => onNodeMouseDown(e, n.id),
                onTouchStart: (e) => onNodeMouseDown(e, n.id),
                onDragEnd: (e) => commitSymbolTransform(n.id, e.target),
                onTransformEnd: (e) => commitSymbolTransform(n.id, e.target),
                ref: (el) => { if (el) nodeRefs.current.set(n.id, el); else nodeRefs.current.delete(n.id) },
              }
              if (def?.svgPath) {
                return (
                  <Path key={n.id} {...common}
                    data={def.svgPath} fill={n.color || '#c9a24a'} fillRule="evenodd"
                    scaleX={scale} scaleY={n.inverted ? -scale : scale} />
                )
              }
              // fallback: small circle for symbols with no vector path (no label)
              return (
                <KCircle key={n.id} {...common}
                  radius={SYMBOL_SIZE * (n.scale ?? 1) * 0.8}
                  stroke={n.color || '#c9a24a'} strokeWidth={2} />
              )
            })}

            {/* preview (in-progress brush / shape) */}
            {preview && preview.points.length >= 2 && (
              <Line
                points={flatten(preview.points)}
                stroke={preview.color || '#c9a24a'}
                strokeWidth={preview.width || 3}
                lineCap="round" lineJoin="round"
                dash={[dash(5), dash(4)]}
                listening={false}
              />
            )}

            {/* rubber-band marquee */}
            {marquee && (
              <Rect
                x={Math.min(marquee.x0, marquee.x1)}
                y={Math.min(marquee.y0, marquee.y1)}
                width={Math.abs(marquee.x1 - marquee.x0)}
                height={Math.abs(marquee.y1 - marquee.y0)}
                stroke="var(--accent)" strokeWidth={1 / zoom}
                dash={[dash(4), dash(3)]}
                fill="rgba(201,162,74,0.08)"
                listening={false}
              />
            )}

            {/* Transformer (move + rotate + scale handles) */}
            {isTransformTool && (
              <Transformer
                ref={trRef}
                rotateEnabled={tool !== 'move'}
                resizeEnabled={tool !== 'rotate' && tool !== 'move'}
                ignoreStroke
                anchorSize={8}
                borderStroke="var(--accent)"
                anchorStroke="var(--accent)"
                rotateAnchorOffset={24}
                boundBoxFunc={(oldB, newB) => (newB.width < 5 || newB.height < 5 ? oldB : newB)}
              />
            )}
          </Layer>

          {/* ── Overlay layer (non-interactive, always on top) ──────────────── */}
          {(hasOverlays || hasHighlight || hasVectors) && (
            <Layer
              {...layerProps}
              ref={overlayLayerRef}
              listening={false}
            >
              {/* glow box for the hovered Identified-panel row — drawn under the dashed overlays */}
              {hasHighlight && (
                <Rect
                  x={highlight.x} y={highlight.y} width={highlight.w} height={highlight.h}
                  stroke={OVERLAY_ACCENT}
                  strokeWidth={2.5 / zoom}
                  cornerRadius={4 / zoom}
                  fill="rgba(201,162,74,0.12)"
                  shadowColor={OVERLAY_ACCENT}
                  shadowBlur={16 / zoom}
                  shadowOpacity={0.9}
                  listening={false}
                />
              )}
              {hasOverlays && overlays.map((ov, i) => {
                if (!ov || !ov.box) return null
                const { x, y, w, h } = ov.box
                const label = String(ov.label ?? '')
                // Estimate label chip width: chars * approx char width in world units
                const chipW = Math.max(label.length * labelFontSize * 0.62 + labelPad * 2, labelFontSize + labelPad * 2)
                const chipH = labelFontSize + labelPad * 2
                return (
                  <Group key={i}>
                    {/* dashed accent rectangle */}
                    <Rect
                      x={x} y={y} width={w} height={h}
                      stroke={OVERLAY_ACCENT}
                      strokeWidth={overlayStrokeW}
                      dash={[dash(6), dash(4)]}
                      fill="transparent"
                      listening={false}
                    />
                    {/* label chip at top-left of the box */}
                    {label && (
                      <Group x={x} y={y - chipH}>
                        <Rect
                          x={0} y={0}
                          width={chipW} height={chipH}
                          fill={OVERLAY_LABEL_BG}
                          cornerRadius={2 / zoom}
                          listening={false}
                        />
                        <Text
                          x={labelPad} y={labelPad}
                          text={label}
                          fontSize={labelFontSize}
                          fontFamily="system-ui, sans-serif"
                          fill={OVERLAY_LABEL_COLOR}
                          listening={false}
                        />
                      </Group>
                    )}
                  </Group>
                )
              })}

              {/* ── Per-sign direction + force vectors (and the net resultant) ──── */}
              {hasVectors && vectors.map((v, i) => {
                if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return null
                const mag = Math.max(0, v.magnitude ?? 0)
                // Out-of-plane "upward flow" (einlair U): concentric ⊙ at the seal centre, ∝ U.
                if (v.kind === 'up') {
                  const r = 12 + mag * 46
                  return (
                    <Group key={`v${i}`} listening={false}>
                      <KCircle x={v.x} y={v.y} radius={r} stroke={VEC_UP_COLOR} strokeWidth={2.4 / zoom}
                        dash={[dash(6), dash(5)]} listening={false} />
                      <KCircle x={v.x} y={v.y} radius={r * 0.58} stroke={VEC_UP_COLOR} strokeWidth={1.6 / zoom}
                        dash={[dash(4), dash(4)]} opacity={0.6} listening={false} />
                      <KCircle x={v.x} y={v.y} radius={3.5 / zoom} fill={VEC_UP_COLOR} listening={false} />
                      <Text x={v.x + 6 / zoom} y={v.y - r - 16 / zoom} text="↑ up-flow"
                        fontSize={12 / zoom} fontStyle="bold" fill={VEC_UP_COLOR} listening={false} />
                    </Group>
                  )
                }
                // Inverted columns (Φ<0): magic spreads radially OUTWARD — dashed ring + outward ticks.
                if (v.kind === 'spread') {
                  const r = 18 + mag * 40
                  const tick = 12 / zoom
                  const ticks = []
                  for (let k = 0; k < 8; k++) {
                    const a = (k * Math.PI) / 4
                    const c = Math.cos(a), s = Math.sin(a)
                    ticks.push(
                      <Line key={k} points={[v.x + c * r, v.y + s * r, v.x + c * r + c * tick, v.y + s * r + s * tick]}
                        stroke={VEC_SPREAD_COLOR} strokeWidth={2 / zoom} lineCap="round" listening={false} />,
                    )
                  }
                  return (
                    <Group key={`v${i}`} listening={false}>
                      <KCircle x={v.x} y={v.y} radius={r} stroke={VEC_SPREAD_COLOR} strokeWidth={2.2 / zoom}
                        dash={[dash(6), dash(5)]} listening={false} />
                      {ticks}
                    </Group>
                  )
                }
                // Non-directional sign: no front → show a force RING (radius ∝ force), no arrow.
                if (v.angle == null) {
                  return (
                    <KCircle
                      key={`v${i}`}
                      x={v.x} y={v.y}
                      radius={(6 + mag * 10)}
                      stroke={VEC_FORCE_COLOR}
                      strokeWidth={2 / zoom}
                      dash={[dash(3), dash(3)]}
                      listening={false}
                    />
                  )
                }
                const isNet = v.kind === 'net'
                const rad = (v.angle * Math.PI) / 180
                const dx = Math.sin(rad)
                const dy = -Math.cos(rad) // 0° = north (−y) in the y-down world
                const len = isNet ? VEC_NET_BASE + mag * VEC_NET_GAIN : VEC_SIGN_BASE + mag * VEC_SIGN_GAIN
                const x2 = v.x + dx * len
                const y2 = v.y + dy * len
                const color = isNet ? VEC_NET_COLOR : VEC_SIGN_COLOR
                return (
                  <Arrow
                    key={`v${i}`}
                    points={[v.x, v.y, x2, y2]}
                    stroke={color}
                    fill={color}
                    strokeWidth={(isNet ? 3.2 : 2.2) / zoom}
                    pointerLength={(isNet ? 13 : 10) / zoom}
                    pointerWidth={(isNet ? 12 : 9) / zoom}
                    opacity={isNet ? 0.95 : 0.85}
                    listening={false}
                  />
                )
              })}
            </Layer>
          )}
        </Stage>

        {/* ── Effect overlay canvas (pointer-events:none, z-index above Stage) ── */}
        <EffectCanvas
          spellIR={spellIR}
          ringGeom={ringGeom}
          enabled={!!effectsEnabled}
          rulesRenderer={rulesRenderer}
        />
      </div>
    </div>
  )
})

export default DrawingSurface
