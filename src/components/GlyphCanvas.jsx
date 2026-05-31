import { useRef } from 'react'
import { getComponentDef } from '../engine/data.js'
import { CANVAS_RADIUS } from '../engine/geometry.js'

const VIEW = 600 // viewBox 600x600, origem central via -300

// Converte coords de clientes -> coords do SVG (origem no centro).
function clientToLocal(svg, clientX, clientY) {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM().inverse()
  const loc = pt.matrixTransform(ctm)
  return { x: loc.x, y: loc.y } // já centrado, pois viewBox = -300..300
}

function ComponentGlyph({ comp, selected, onPointerDown }) {
  const def = getComponentDef(comp.type)
  if (!def) return null
  const size = 56 * (comp.scale ?? 1)
  const s = size / 100 // svgPath está em -50..50
  // translate -> rotate -> scale; inversão = espelho no eixo vertical.
  const t = `translate(${comp.x} ${comp.y}) rotate(${comp.rotation || 0}) scale(${s} ${comp.inverted ? -s : s})`
  const color = comp.role === 'sigil' ? '#c0521f' : '#3a2a16'

  return (
    <g
      transform={t}
      onPointerDown={(e) => onPointerDown(e, comp.id)}
      style={{ cursor: 'grab' }}
    >
      {selected && <circle cx="0" cy="0" r="42" fill="rgba(201,162,74,.18)" stroke="#c9a24a" strokeWidth="2" strokeDasharray="4 3" />}
      {def.satellites?.map((sat, i) => {
        const r = sat.radius * 50
        const rad = (sat.angle * Math.PI) / 180
        return <circle key={i} cx={r * Math.sin(rad)} cy={-r * Math.cos(rad)} r="3.5" fill={color} />
      })}
      <path d={def.svgPath} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

export default function GlyphCanvas({ composition, selectedId, onSelect, onMove, onDropAdd }) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)

  const allComponents = [
    ...(composition.core ? [{ ...composition.core, role: 'sigil' }] : []),
    ...composition.components,
  ]

  function handlePointerDown(e, id) {
    e.stopPropagation()
    onSelect(id)
    const svg = svgRef.current
    const loc = clientToLocal(svg, e.clientX, e.clientY)
    const comp = allComponents.find((c) => c.id === id)
    dragRef.current = { id, dx: loc.x - comp.x, dy: loc.y - comp.y }
    svg.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return
    const loc = clientToLocal(svgRef.current, e.clientX, e.clientY)
    onMove(dragRef.current.id, loc.x - dragRef.current.dx, loc.y - dragRef.current.dy)
  }

  function handlePointerUp(e) {
    if (dragRef.current) {
      try { svgRef.current.releasePointerCapture(e.pointerId) } catch {}
    }
    dragRef.current = null
  }

  function handleDrop(e) {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/x-wha')
    if (!raw) return
    const { type, kind } = JSON.parse(raw)
    const loc = clientToLocal(svgRef.current, e.clientX, e.clientY)
    onDropAdd(type, kind, loc.x, loc.y)
  }

  return (
    <svg
      ref={svgRef}
      className="glyph-svg"
      width={VIEW}
      height={VIEW}
      viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerDown={() => onSelect(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Anéis-guia */}
      <circle cx="0" cy="0" r={CANVAS_RADIUS * 0.45} fill="none" stroke="rgba(90,60,30,.18)" strokeWidth="1" strokeDasharray="3 5" />
      <circle cx="0" cy="0" r={CANVAS_RADIUS * 0.75} fill="none" stroke="rgba(90,60,30,.18)" strokeWidth="1" strokeDasharray="3 5" />
      {/* eixos */}
      <line x1="0" y1={-CANVAS_RADIUS} x2="0" y2={CANVAS_RADIUS} stroke="rgba(90,60,30,.1)" />
      <line x1={-CANVAS_RADIUS} y1="0" x2={CANVAS_RADIUS} y2="0" stroke="rgba(90,60,30,.1)" />

      {/* Ring externo (ativação) */}
      {composition.ring.closed ? (
        <circle cx="0" cy="0" r={CANVAS_RADIUS} fill="none" stroke="#5a3b1e" strokeWidth="6" />
      ) : (
        // ring aberto: arco com gap no topo
        <path
          d={describeArc(0, 0, CANVAS_RADIUS, 18, 342)}
          fill="none"
          stroke="#9c7a4a"
          strokeWidth="6"
          strokeDasharray="2 0"
        />
      )}
      {!composition.ring.closed && (
        <text x="0" y={-CANVAS_RADIUS - 12} textAnchor="middle" fontSize="13" fill="#9c7a4a">ring open — inactive</text>
      )}

      {/* marca central se sem núcleo */}
      {!composition.core && (
        <text x="0" y="4" textAnchor="middle" fontSize="14" fill="rgba(90,60,30,.4)">drag a sigil to the center</text>
      )}

      {allComponents.map((comp) => (
        <ComponentGlyph
          key={comp.id}
          comp={comp}
          selected={comp.id === selectedId}
          onPointerDown={handlePointerDown}
        />
      ))}
    </svg>
  )
}

// Arco SVG (para o ring aberto). Ângulos em graus, 0=norte horário.
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
