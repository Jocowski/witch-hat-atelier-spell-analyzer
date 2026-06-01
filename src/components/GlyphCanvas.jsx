import { useEffect, useRef, useState } from 'react'
import { getComponentDef } from '../engine/data.js'

const VIEW = 600 // viewBox 600x600, origem central via -300
const ZOOM_MIN = 1 // 1 = enquadramento padrão; <1 só mostraria pergaminho vazio
const ZOOM_MAX = 8
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
// Raio visual do ring por tamanho escolhido (não afeta a geometria/análise).
export const RING_RADII = { small: 150, medium: 200, big: 260 }

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
  // Ink color stamped at draw time wins; otherwise the default per-role color.
  const color = comp.color || (comp.role === 'sigil' ? '#c0521f' : '#3a2a16')

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

export default function GlyphCanvas({ composition, selectedId, onSelect, onMove, onDropAdd }) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const panRef = useRef(null) // pan ativo: { x, y } em px de tela (right-drag)

  // Viewport (zoom/pan). cx/cy = ponto do conteúdo no centro da view; zoom = fator.
  const [view, setView] = useState({ cx: 0, cy: 0, zoom: 1 })
  const [panning, setPanning] = useState(false)
  const viewRef = useRef(view)
  viewRef.current = view
  const vw = VIEW / view.zoom // largura/altura do viewBox em coords de conteúdo
  const viewBox = `${view.cx - vw / 2} ${view.cy - vw / 2} ${vw} ${vw}`

  // Mantém o conteúdo enquadrado: no zoom 1 trava no centro; quanto mais zoom, mais pan.
  function clampView(cx, cy, zoom) {
    const half = Math.max(0, VIEW / 2 - VIEW / (2 * zoom))
    return { cx: clamp(cx, -half, half), cy: clamp(cy, -half, half), zoom }
  }

  // Ctrl + scroll = zoom centrado no cursor. Listener nativo (não-passivo) p/ poder
  // dar preventDefault e impedir o zoom da página.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    function onWheel(e) {
      if (!e.ctrlKey) return // scroll normal continua rolando a página
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const fx = (e.clientX - rect.left) / rect.width // fração do cursor na view
      const fy = (e.clientY - rect.top) / rect.height
      setView((v) => {
        const zoom = clamp(v.zoom * Math.exp(-e.deltaY * 0.0015), ZOOM_MIN, ZOOM_MAX)
        const w0 = VIEW / v.zoom
        const w1 = VIEW / zoom
        // ponto do conteúdo sob o cursor (antes) deve continuar sob o cursor (depois)
        const px = v.cx - w0 / 2 + fx * w0
        const py = v.cy - w0 / 2 + fy * w0
        return clampView(px - (fx - 0.5) * w1, py - (fy - 0.5) * w1, zoom)
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const R = RING_RADII[composition.ring?.size] ?? RING_RADII.medium

  // Mantém o ponto dentro do círculo de ativação (não deixa arrastar símbolos p/ fora).
  function clampToRing(x, y) {
    const d = Math.hypot(x, y)
    if (d <= R) return { x, y }
    const k = R / d
    return { x: x * k, y: y * k }
  }

  const allComponents = [
    ...(composition.core ? [{ ...composition.core, role: 'sigil' }] : []),
    ...composition.components,
  ]

  function handlePointerDown(e, id) {
    if (e.button !== 0) return // botão direito/meio: deixa borbulhar p/ o pan do SVG
    e.stopPropagation()
    onSelect(id)
    const svg = svgRef.current
    const loc = clientToLocal(svg, e.clientX, e.clientY)
    const comp = allComponents.find((c) => c.id === id)
    dragRef.current = { id, dx: loc.x - comp.x, dy: loc.y - comp.y }
    svg.setPointerCapture(e.pointerId)
  }

  // Pointerdown no fundo do SVG: botão direito = pan (só com zoom); esquerdo = desselecionar.
  function handleSvgPointerDown(e) {
    if (e.button === 2) {
      if (viewRef.current.zoom <= 1) return // sem zoom não há p/ onde arrastar
      panRef.current = { x: e.clientX, y: e.clientY }
      setPanning(true)
      try { svgRef.current.setPointerCapture(e.pointerId) } catch {}
      return
    }
    if (e.button === 0) onSelect(null)
  }

  function handlePointerMove(e) {
    if (panRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const k = VIEW / viewRef.current.zoom / rect.width // px de tela -> coords de conteúdo
      const dx = (e.clientX - panRef.current.x) * k
      const dy = (e.clientY - panRef.current.y) * k
      panRef.current = { x: e.clientX, y: e.clientY }
      setView((v) => clampView(v.cx - dx, v.cy - dy, v.zoom)) // "agarra" o conteúdo
      return
    }
    if (!dragRef.current) return
    const loc = clientToLocal(svgRef.current, e.clientX, e.clientY)
    const { x, y } = clampToRing(loc.x - dragRef.current.dx, loc.y - dragRef.current.dy)
    onMove(dragRef.current.id, x, y)
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
    const { x, y } = clampToRing(loc.x, loc.y)
    onDropAdd(type, kind, x, y)
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
      {/* Anéis-guia */}
      <circle cx="0" cy="0" r={R * 0.45} fill="none" stroke="rgba(90,60,30,.18)" strokeWidth="1" strokeDasharray="3 5" />
      <circle cx="0" cy="0" r={R * 0.75} fill="none" stroke="rgba(90,60,30,.18)" strokeWidth="1" strokeDasharray="3 5" />
      {/* eixos */}
      <line x1="0" y1={-R} x2="0" y2={R} stroke="rgba(90,60,30,.1)" />
      <line x1={-R} y1="0" x2={R} y2="0" stroke="rgba(90,60,30,.1)" />

      {/* Ring externo (ativação) */}
      {composition.ring.closed ? (
        <circle cx="0" cy="0" r={R} fill="none" stroke="#5a3b1e" strokeWidth="6" />
      ) : (
        // ring aberto: arco com gap no topo
        <path
          d={describeArc(0, 0, R, 18, 342)}
          fill="none"
          stroke="#9c7a4a"
          strokeWidth="6"
          strokeDasharray="2 0"
        />
      )}
      {!composition.ring.closed && (
        <text x="0" y={-R - 12} textAnchor="middle" fontSize="13" fill="#9c7a4a">ring open — inactive</text>
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

      <div className="zoom-hud">
        {view.zoom > 1.01 && (
          <button className="zoom-reset" onClick={() => setView({ cx: 0, cy: 0, zoom: 1 })} title="Reset zoom">
            {view.zoom.toFixed(1)}× · reset
          </button>
        )}
        <span className="zoom-hint">Ctrl + scroll to zoom · right-drag to pan</span>
      </div>
    </div>
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
