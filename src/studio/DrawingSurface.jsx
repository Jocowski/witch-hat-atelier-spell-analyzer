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
import {
  Stage, Layer, Line, Rect, Circle as KCircle, Path, Transformer, Text, Group,
} from 'react-konva'
import { line, rect, triangle, circle, brush } from './tools/shapes.js'
import { DYES, getComponentDef } from '../engine/data.js'
import ToolDock from './ToolDock.jsx'
import './drawing.css'

// ── constants ─────────────────────────────────────────────────────────────────

const RING_RADIUS   = 180   // faint guide ring (world coords)
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
  }
}

// ── DrawingSurface ────────────────────────────────────────────────────────────

const DrawingSurface = forwardRef(function DrawingSurface(props, ref) {
  const {
    palette       = 'dyes',
    enableSymbols = true,
    onChange,
    compact       = false,
    overlays,        // Array<{ box:{x,y,w,h}, label, kind }> | undefined
  } = props

  // ── tool / color / brush state ─────────────────────────────────────────────
  const [tool,      setTool]      = useState('brush')
  const [color,     setColor]     = useState('#c9a24a')
  const [dyeId,     setDyeId]     = useState(null)
  const [brushSize, setBrushSize] = useState(3)

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
  const [preview, setPreview] = useState(null)  // { tool,color,width,points } in-progress
  const [marquee, setMarquee] = useState(null)  // { x0,y0,x1,y1 } in world coords (rubber-band)
  const erasedRef   = useRef(false)             // a delete happened in this gesture
  const spaceRef    = useRef(false)             // space held → pan mode
  const marqueeShiftRef = useRef(false)         // shift held when marquee started

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
  const buildModel = useCallback((ns, ds) => {
    const strokes = []
    const placed  = []
    for (const n of ns) {
      if (n.kind === 'stroke') {
        strokes.push({ tool: n.tool, color: n.color, width: n.width, dyeId: n.dyeId, points: n.points })
      } else {
        placed.push({
          id: n.type, type: n.type, kind: n.symKind,
          x: n.x, y: n.y, rotation: n.rotation, scale: n.scale, inverted: n.inverted,
        })
      }
    }
    return { strokes, placed, dyes: ds.slice() }
  }, [])

  const fireChange = useCallback((ns, ds) => {
    onChangeRef.current?.(buildModel(ns ?? nodesRef.current, ds ?? dyesRef.current))
  }, [buildModel])

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
      setNodes([]); setDyes([]); setSelectedIds([])
      nodesRef.current = []; dyesRef.current = []
      onChangeRef.current?.({ strokes: [], placed: [], dyes: [] })
    },
    placeSymbol(type, kind) {
      if (!enableSymbols) return
      // Drop at the current viewport centre, converted to world coords (accounts for pan/zoom).
      const wc = toWorld(stageSz.width / 2, stageSz.height / 2)
      const sym = {
        id: nextId(), kind: 'symbol',
        type, symKind: kind || 'sign',
        x: Math.round(wc.x), y: Math.round(wc.y), rotation: 0, scale: 1, inverted: false, color,
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

    // ── NEW: toDataURL ───────────────────────────────────────────────────────
    // Captures a PNG of the content layer only (overlay + Transformer excluded).
    // opts is forwarded to Konva Stage.toDataURL (supports pixelRatio, mimeType, quality).
    toDataURL(opts = {}) {
      const stage = stageRef.current
      const overlayLayer = overlayLayerRef.current
      const tr = trRef.current

      // Temporarily hide elements that must not appear in the export.
      const overlayWasVisible = overlayLayer?.visible()
      if (overlayLayer) overlayLayer.visible(false)

      // Hide Transformer nodes
      if (tr) tr.visible(false)

      let dataURL
      try {
        dataURL = stage?.toDataURL({ pixelRatio: 1, ...opts }) ?? ''
      } finally {
        // Restore visibility
        if (overlayLayer) overlayLayer.visible(overlayWasVisible ?? true)
        if (tr) tr.visible(true)
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
  }), [buildModel, enableSymbols, color, dyeId, fireChange, toWorld, stageSz.width, stageSz.height])

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

  // ── space-to-pan key tracking ────────────────────────────────────────────────
  useEffect(() => {
    const down = (e) => { if (e.code === 'Space') spaceRef.current = true }
    const up   = (e) => { if (e.code === 'Space') spaceRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

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

  function commitStroke(points, toolName) {
    if (!points || points.length < 2) return
    const node = { id: nextId(), kind: 'stroke', tool: toolName, color, width: brushSize, dyeId, points }
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
    if (toRemove.size) { erasedRef.current = true; removeNodes(toRemove) }
  }

  function erasePixelAt(wp) {
    const R = Math.max(brushSize * 2, 10)
    const r2 = R * R
    let changed = false
    const out = []
    for (const n of nodesRef.current) {
      if (n.kind !== 'stroke') { out.push(n); continue }
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
      erasedRef.current = true
      setNodes(out); nodesRef.current = out
      fireChange(out)
    }
  }

  // ── pointer / gesture handlers (on Stage) ────────────────────────────────────
  function onStageMouseDown(e) {
    const stage = stageRef.current
    const evt = e.evt
    // pan: right-button OR space held → let Stage handle drag (draggable)
    if (evt.button === 2 || spaceRef.current) return  // Stage.draggable handles it

    const wp = pointerWorld()
    if (!wp) return

    // ── erasers ───────────────────────────────────────────────────────────────
    if (tool === 'eraserStroke') { drawingRef.current = true; erasedRef.current = false; eraseStrokeAt(wp); return }
    if (tool === 'eraserPixel')  { drawingRef.current = true; erasedRef.current = false; erasePixelAt(wp); return }

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
      startRef.current = wp
      if (tool === 'brush') { livePtsRef.current = [wp]; setPreview({ tool: 'brush', color, width: brushSize, points: [wp] }) }
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
      livePtsRef.current.push(wp)
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
      livePtsRef.current = []
      setPreview(null)
      commitStroke(pts, 'brush')
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
    if (evt.button === 2 || spaceRef.current) return
    if (tool === 'eraserStroke') {
      e.cancelBubble = true
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
    if (spaceRef.current) return 'grab'
    switch (tool) {
      case 'eraserStroke': case 'eraserPixel': return 'cell'
      case 'select': return 'default'
      case 'move': return 'move'
      case 'rotate': return 'crosshair'
      default: return 'crosshair'
    }
  }, [tool])

  const stageHeight = compact ? COMPACT_H : stageSz.height

  // ── overlay rendering ────────────────────────────────────────────────────────
  // Overlays use the same layer transform (layerProps) so they track pan/zoom exactly.
  // Font size and stroke width are divided by zoom to stay constant in screen pixels.
  const hasOverlays = Array.isArray(overlays) && overlays.length > 0
  const overlayStrokeW = 1.5 / zoom
  const labelFontSize  = OVERLAY_FONT_SIZE / zoom
  const labelPad       = 2 / zoom

  return (
    <div className={`ds-surface${compact ? ' ds-compact' : ''}`}>
      <ToolDock
        tool={tool} setTool={(t) => { setTool(t); if (t !== 'select' && t !== 'move' && t !== 'rotate') setSelectedIds([]) }}
        color={color} setColor={setColor}
        dyeId={dyeId} setDyeId={setDyeId}
        brushSize={brushSize} setBrushSize={setBrushSize}
        palette={palette}
        compact={compact}
        zoom={zoom}
        onZoomIn={() => zoomAtCenter(ZOOM_STEP)}
        onZoomOut={() => zoomAtCenter(-ZOOM_STEP)}
        onZoomReset={resetView}
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
          onTouchStart={onStageMouseDown}
          onTouchMove={onStageMouseMove}
          onTouchEnd={onStageMouseUp}
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
          }}
          // Enable Stage dragging only with right-button or space (decided on mousedown)
          onMouseDownCapture={(e) => {
            const native = e.evt
            const st = stageRef.current
            if (st && (native.button === 2 || spaceRef.current)) {
              st.draggable(true)
              st.startDrag()
            } else if (st) {
              st.draggable(false)
            }
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
                key: n.id,
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
                  <Path {...common}
                    data={def.svgPath} fill={n.color || '#c9a24a'} fillRule="evenodd"
                    scaleX={scale} scaleY={n.inverted ? -scale : scale} />
                )
              }
              // fallback: small circle for text/unknown glyphs (no label per spec)
              return (
                <KCircle {...common}
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
          {hasOverlays && (
            <Layer
              {...layerProps}
              ref={overlayLayerRef}
              listening={false}
            >
              {overlays.map((ov, i) => {
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
            </Layer>
          )}
        </Stage>
      </div>
    </div>
  )
})

export default DrawingSurface
