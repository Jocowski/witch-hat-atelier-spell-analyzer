import { useEffect, useMemo, useRef, useState } from 'react'
import { getComponentDef } from '../engine/data.js'

const VIEW = 600 // viewBox 600x600, origin centered via -300
const ZOOM_MIN = 0.5
const ZOOM_MAX = 8
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
// Visual ring radius per chosen size (does not affect geometry/analysis).
export const RING_RADII = { small: 110, medium: 170, big: 240 }
const ringRadiusOf = (c) => c.radius ?? RING_RADII[c.ring?.size] ?? RING_RADII.medium

// Client coords -> SVG content coords (origin centered).
function clientToLocal(svg, clientX, clientY) {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const loc = pt.matrixTransform(svg.getScreenCTM().inverse())
  return { x: loc.x, y: loc.y }
}

function ComponentGlyph({ comp, circleId, selected, onPointerDown }) {
  const def = getComponentDef(comp.type)
  if (!def) return null
  const size = 56 * (comp.scale ?? 1)
  const s = size / 100 // svgPath is in -50..50
  // inverted flips top↔bottom (negate Y); mirrored flips left↔right (negate X).
  const t = `translate(${comp.x} ${comp.y}) rotate(${comp.rotation || 0}) scale(${comp.mirrored ? -s : s} ${comp.inverted ? -s : s})`
  const color = comp.color || (comp.role === 'sign' ? '#3a2a16' : '#c0521f')
  return (
    <g transform={t} onPointerDown={(e) => onPointerDown(e, circleId, comp.id)} style={{ cursor: 'grab' }}>
      {selected && <circle cx="0" cy="0" r="42" fill="rgba(201,162,74,.18)" stroke="#c9a24a" strokeWidth="2" strokeDasharray="4 3" />}
      {def.text ? (
        <text x="0" y="15" textAnchor="middle" fontSize="58" fontWeight="700" fill={color}>{def.text}</text>
      ) : def.render === 'fill' ? (
        <path d={def.svgPath} fill={color} fillRule="evenodd" stroke="none" />
      ) : (
        <path d={def.svgPath} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </g>
  )
}

// One circle (its own ring + core + components), drawn relative to the circle's center.
function CircleGroup({ circle, isActive, selectedPartId, onCircleActivate, onCircleMove, onPartDown }) {
  const R = ringRadiusOf(circle)
  const ringColor = circle.inkColor || '#5a3b1e'
  const openColor = circle.inkColor || '#9c7a4a'
  const core = circle.core ? { ...circle.core, role: 'core' } : null
  const parts = [...(core ? [core] : []), ...circle.components]
  return (
    <g transform={`translate(${circle.center.x} ${circle.center.y})`}>
      {/* interior: clicking it selects/activates the circle, but never moves it */}
      <circle cx="0" cy="0" r={R} fill="transparent" pointerEvents="all"
        onPointerDown={(e) => onCircleActivate(e, circle.id)} />

      {/* active highlight */}
      {isActive && <circle cx="0" cy="0" r={R + 4} fill="none" stroke="#c9a24a" strokeWidth="2" strokeDasharray="6 4" pointerEvents="none" />}

      {/* guide rings + axes */}
      <circle cx="0" cy="0" r={R * 0.45} fill="none" stroke="rgba(90,60,30,.16)" strokeWidth="1" strokeDasharray="3 5" pointerEvents="none" />
      <circle cx="0" cy="0" r={R * 0.75} fill="none" stroke="rgba(90,60,30,.16)" strokeWidth="1" strokeDasharray="3 5" pointerEvents="none" />
      <line x1="0" y1={-R} x2="0" y2={R} stroke="rgba(90,60,30,.08)" pointerEvents="none" />
      <line x1={-R} y1="0" x2={R} y2="0" stroke="rgba(90,60,30,.08)" pointerEvents="none" />

      {/* activation ring (closed circle / open arc), tinted by the circle's ink */}
      {circle.ring?.closed ? (
        <circle cx="0" cy="0" r={R} fill="none" stroke={ringColor} strokeWidth="6" pointerEvents="none" />
      ) : (
        <path d={describeArc(0, 0, R, 18, 342)} fill="none" stroke={openColor} strokeWidth="6" pointerEvents="none" />
      )}

      {/* grab the ring EDGE to move the whole circle (a thick invisible band on the rim) */}
      <circle cx="0" cy="0" r={R} fill="none" stroke="transparent" strokeWidth="22" pointerEvents="stroke"
        style={{ cursor: 'move' }} onPointerDown={(e) => onCircleMove(e, circle.id)} />

      {/* circle name / hint */}
      <text x="0" y={-R - 10} textAnchor="middle" fontSize="13" fill={isActive ? '#7a5a2a' : 'rgba(90,60,30,.55)'} pointerEvents="none">
        {circle.name || circle.id}{!circle.ring?.closed ? ' · open' : ''}
      </text>
      {!core && (
        <text x="0" y="4" textAnchor="middle" fontSize="12" fill="rgba(90,60,30,.4)" pointerEvents="none">drag a sigil here</text>
      )}

      {parts.map((p) => (
        <ComponentGlyph key={p.id} comp={p} circleId={circle.id} selected={p.id === selectedPartId} onPointerDown={onPartDown} />
      ))}
    </g>
  )
}

export default function GlyphCanvas({ composition, activeCircleId, selected, onSelectCircle, onSelectPart, onClearSelect, onMovePart, onMoveCircle, onDropAdd }) {
  const svgRef = useRef(null)
  const dragRef = useRef(null) // { kind:'part'|'circle', circleId, partId?, dx, dy }
  const panRef = useRef(null)

  const circles = composition.circles || []
  const relations = composition.relations || []

  // Render order: larger circles first so smaller (inner/concentric) ones sit on top and win clicks.
  const ordered = [...circles].sort((a, b) => ringRadiusOf(b) - ringRadiusOf(a))

  // Auto-fit the view to all circles: the base frame is the spell's bounding box; zoom/pan
  // adjust from there, so adding an offset circle keeps everything visible.
  const fit = useMemo(() => {
    if (!circles.length) return { cx: 0, cy: 0, size: VIEW }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of circles) {
      const R = ringRadiusOf(c)
      minX = Math.min(minX, c.center.x - R); minY = Math.min(minY, c.center.y - R)
      maxX = Math.max(maxX, c.center.x + R); maxY = Math.max(maxY, c.center.y + R)
    }
    const pad = 70
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, size: Math.max(maxX - minX, maxY - minY, 280) + pad * 2 }
  }, [circles])

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const fitRef = useRef(fit); fitRef.current = fit
  const zoomRef = useRef(zoom); zoomRef.current = zoom
  const panRefVal = useRef(pan); panRefVal.current = pan

  const size = fit.size / zoom
  const viewBox = `${fit.cx - size / 2 + pan.x} ${fit.cy - size / 2 + pan.y} ${size} ${size}`

  // Ctrl+scroll = zoom centered on cursor.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    function onWheel(e) {
      if (!e.ctrlKey) return
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const fx = (e.clientX - rect.left) / rect.width
      const fy = (e.clientY - rect.top) / rect.height
      const f = fitRef.current
      const z0 = zoomRef.current
      const z1 = clamp(z0 * Math.exp(-e.deltaY * 0.0015), ZOOM_MIN, ZOOM_MAX)
      const s0 = f.size / z0
      const s1 = f.size / z1
      const p = panRefVal.current
      const wx = f.cx - s0 / 2 + p.x + fx * s0
      const wy = f.cy - s0 / 2 + p.y + fy * s0
      setZoom(z1)
      setPan({ x: wx - fx * s1 - f.cx + s1 / 2, y: wy - fy * s1 - f.cy + s1 / 2 })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  // Absolute position lookups for relation lines.
  const centerOf = {}
  const partAbs = {}
  for (const c of circles) {
    centerOf[c.id] = c.center
    if (c.core) partAbs[c.core.id] = { x: c.center.x + (c.core.x || 0), y: c.center.y + (c.core.y || 0) }
    for (const p of c.components) partAbs[p.id] = { x: c.center.x + p.x, y: c.center.y + p.y }
  }
  const endpointAt = (id) => centerOf[id] || partAbs[id] || null
  const radiusById = {}
  for (const c of circles) radiusById[c.id] = ringRadiusOf(c)

  // Where a relation line should touch an endpoint: a circle's RIM (clipped along the line to
  // the other endpoint), or a component's own position. Returns null if the id is unknown.
  function touchPoint(id, toward) {
    const center = centerOf[id]
    if (center) {
      const R = radiusById[id]
      const dx = toward.x - center.x
      const dy = toward.y - center.y
      const d = Math.hypot(dx, dy) || 1
      return { x: center.x + (dx / d) * R, y: center.y + (dy / d) * R }
    }
    return partAbs[id] || null
  }

  // Which circle contains a point (smallest containing ring wins, for concentric).
  function circleAt(loc) {
    let best = null
    let bestR = Infinity
    for (const c of circles) {
      const R = ringRadiusOf(c)
      const d = Math.hypot(loc.x - c.center.x, loc.y - c.center.y)
      if (d <= R && R < bestR) { best = c; bestR = R }
    }
    return best
  }

  function handlePartDown(e, circleId, partId) {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelectPart(circleId, partId)
    const c = circles.find((x) => x.id === circleId)
    const part = c.core?.id === partId ? c.core : c.components.find((p) => p.id === partId)
    const loc = clientToLocal(svgRef.current, e.clientX, e.clientY)
    const absX = c.center.x + (part.x || 0)
    const absY = c.center.y + (part.y || 0)
    dragRef.current = { kind: 'part', circleId, partId, dx: loc.x - absX, dy: loc.y - absY }
    svgRef.current.setPointerCapture(e.pointerId)
  }

  // Click inside a circle: just select/activate it — never start a move.
  function handleCircleActivate(e, circleId) {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelectCircle(circleId)
  }
  // Grab the ring edge: select + start moving the whole circle.
  function handleCircleMove(e, circleId) {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelectCircle(circleId)
    const c = circles.find((x) => x.id === circleId)
    const loc = clientToLocal(svgRef.current, e.clientX, e.clientY)
    dragRef.current = { kind: 'circle', circleId, dx: loc.x - c.center.x, dy: loc.y - c.center.y }
    svgRef.current.setPointerCapture(e.pointerId)
  }

  function handleSvgPointerDown(e) {
    if (e.button === 2) {
      panRef.current = { x: e.clientX, y: e.clientY }
      setPanning(true)
      try { svgRef.current.setPointerCapture(e.pointerId) } catch {}
      return
    }
    if (e.button === 0) onClearSelect()
  }

  function handlePointerMove(e) {
    if (panRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const k = (fitRef.current.size / zoomRef.current) / rect.width
      const dx = (e.clientX - panRef.current.x) * k
      const dy = (e.clientY - panRef.current.y) * k
      panRef.current = { x: e.clientX, y: e.clientY }
      setPan((p) => ({ x: p.x - dx, y: p.y - dy }))
      return
    }
    const d = dragRef.current
    if (!d) return
    const loc = clientToLocal(svgRef.current, e.clientX, e.clientY)
    if (d.kind === 'circle') {
      onMoveCircle(d.circleId, loc.x - d.dx, loc.y - d.dy)
      return
    }
    // part: clamp to its circle's ring (local coords)
    const c = circles.find((x) => x.id === d.circleId)
    const R = ringRadiusOf(c)
    let lx = loc.x - d.dx - c.center.x
    let ly = loc.y - d.dy - c.center.y
    const dist = Math.hypot(lx, ly)
    if (dist > R) { lx = (lx * R) / dist; ly = (ly * R) / dist }
    onMovePart(d.circleId, d.partId, lx, ly)
  }

  function handlePointerUp(e) {
    if (dragRef.current || panRef.current) {
      try { svgRef.current.releasePointerCapture(e.pointerId) } catch {}
    }
    dragRef.current = null
    panRef.current = null
    setPanning(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/x-wha')
    if (!raw) return
    const { type, kind } = JSON.parse(raw)
    const loc = clientToLocal(svgRef.current, e.clientX, e.clientY)
    const target = circleAt(loc) || circles.find((c) => c.id === activeCircleId) || circles[0]
    if (!target) return
    const R = ringRadiusOf(target)
    let lx = loc.x - target.center.x
    let ly = loc.y - target.center.y
    const dist = Math.hypot(lx, ly)
    if (dist > R) { lx = (lx * R) / dist; ly = (ly * R) / dist }
    onDropAdd(target.id, type, kind, lx, ly)
  }

  return (
    <div className="glyph-stage">
      <svg
        ref={svgRef}
        className="glyph-svg"
        width={VIEW}
        height={VIEW}
        viewBox={viewBox}
        style={{ cursor: panning ? 'grabbing' : undefined }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerDown={handleSvgPointerDown}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* relation lines (behind circles) */}
        {relations.map((rel, i) => {
          const nest = rel.type === 'nest'
          const aId = nest ? rel.outer : rel.a
          const bId = nest ? rel.inner : rel.b
          const ca = endpointAt(aId)
          const cb = endpointAt(bId)
          if (!ca || !cb) return null
          // Connect rim-to-rim, not center-to-center.
          const a = touchPoint(aId, cb)
          const b = touchPoint(bId, ca)
          if (!a || !b) return null
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={nest ? 'rgba(90,60,30,.35)' : '#7a5a2a'}
              strokeWidth={nest ? 1.5 : 3}
              strokeDasharray={nest ? '4 4' : undefined}
              pointerEvents="none" />
          )
        })}

        {ordered.map((c) => (
          <CircleGroup
            key={c.id}
            circle={c}
            isActive={c.id === activeCircleId}
            selectedPartId={selected?.circleId === c.id ? selected.partId : null}
            onCircleActivate={handleCircleActivate}
            onCircleMove={handleCircleMove}
            onPartDown={handlePartDown}
          />
        ))}
      </svg>

      <div className="zoom-hud">
        {(Math.abs(zoom - 1) > 0.01 || pan.x || pan.y) && (
          <button className="zoom-reset" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} title="Reset view">
            {zoom.toFixed(1)}× · reset
          </button>
        )}
        <span className="zoom-hint">Ctrl + scroll to zoom · right-drag to pan · drag a ring to move a circle</span>
      </div>
    </div>
  )
}

// SVG arc (for the open ring). Angles in degrees, 0=north clockwise.
function describeArc(cx, cy, r, startDeg, endDeg) {
  const p = (deg) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
  }
  const start = p(startDeg)
  const end = p(endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}
