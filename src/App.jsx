import { useMemo, useState } from 'react'
import Palette from './components/Palette.jsx'
import GlyphCanvas from './components/GlyphCanvas.jsx'
import ResultPanel from './components/ResultPanel.jsx'
import { analyze } from './engine/analyze.js'
import { canBeCore, isSigilType, getComponentDef } from './engine/data.js'

let _id = 1
const nextId = () => `c${_id++}`

const EMPTY = { ring: { closed: false, doubled: false }, core: null, components: [], linkCount: 0 }

export default function App() {
  const [composition, setComposition] = useState(EMPTY)
  const [selectedId, setSelectedId] = useState(null)

  const result = useMemo(() => analyze(composition), [composition])

  const selected = useMemo(() => {
    if (!selectedId) return null
    if (composition.core?.id === selectedId) return { ...composition.core, role: 'sigil' }
    return composition.components.find((c) => c.id === selectedId) || null
  }, [selectedId, composition])

  // Adiciona componente. Sigil -> núcleo (substitui). Sign -> anel.
  function addComponent(type, kind, x, y) {
    const id = nextId()
    setComposition((prev) => {
      if (kind === 'sigil') {
        return { ...prev, core: { id, type, x: 0, y: 0, rotation: 0, scale: 1, inverted: false } }
      }
      const px = x ?? 0
      const py = y ?? -150
      return { ...prev, components: [...prev.components, { id, type, role: 'sign', x: px, y: py, rotation: 0, scale: 1, inverted: false }] }
    })
    setSelectedId(id)
  }

  // Adicionar por clique (sem coords) — posiciona signs em anel automaticamente.
  function addByClick(type, kind) {
    if (kind === 'sigil') return addComponent(type, kind)
    setComposition((prev) => {
      const n = prev.components.length
      const angle = (n * 60) % 360
      const rad = (angle * Math.PI) / 180
      const r = 150
      const id = nextId()
      setSelectedId(id)
      return {
        ...prev,
        components: [...prev.components, { id, type, role: 'sign', x: r * Math.sin(rad), y: -r * Math.cos(rad), rotation: 0, scale: 1, inverted: false }],
      }
    })
  }

  function moveComponent(id, x, y) {
    setComposition((prev) => {
      if (prev.core?.id === id) return { ...prev, core: { ...prev.core, x, y } }
      return { ...prev, components: prev.components.map((c) => (c.id === id ? { ...c, x, y } : c)) }
    })
  }

  function updateSelected(patch) {
    if (!selectedId) return
    setComposition((prev) => {
      if (prev.core?.id === selectedId) return { ...prev, core: { ...prev.core, ...patch } }
      return { ...prev, components: prev.components.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)) }
    })
  }

  function deleteSelected() {
    if (!selectedId) return
    setComposition((prev) => {
      if (prev.core?.id === selectedId) return { ...prev, core: null }
      return { ...prev, components: prev.components.filter((c) => c.id !== selectedId) }
    })
    setSelectedId(null)
  }

  function promoteToCore() {
    if (!selected || selected.role === 'sigil') return
    if (!canBeCore(selected.type)) return
    setComposition((prev) => ({
      ...prev,
      core: { id: selected.id, type: selected.type, x: 0, y: 0, rotation: 0, scale: 1, inverted: false },
      components: prev.components.filter((c) => c.id !== selected.id),
    }))
  }

  const selDef = selected ? getComponentDef(selected.type) : null

  return (
    <div className="app">
      <header className="app-header">
        <h1>⬡ Witch Hat Atelier — Spell Analyzer</h1>
        <p>Compose a glyph: drag a sigil to the center and signs around it. Close the ring to activate.</p>
      </header>

      <div className="layout">
        <Palette onAdd={addByClick} />

        <div className="panel canvas-wrap">
          <GlyphCanvas
            composition={composition}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={moveComponent}
            onDropAdd={addComponent}
          />

          {selected && (
            <div className="selected-toolbar">
              <span className="title">{selDef?.name} {selected.role === 'sigil' ? '(core)' : ''}</span>
              <button onClick={() => updateSelected({ rotation: ((selected.rotation || 0) - 30 + 360) % 360 })}>⟲ -30°</button>
              <button onClick={() => updateSelected({ rotation: ((selected.rotation || 0) + 30) % 360 })}>⟳ +30°</button>
              <button onClick={() => updateSelected({ scale: Math.max(0.4, (selected.scale ?? 1) - 0.15) })}>− smaller</button>
              <button onClick={() => updateSelected({ scale: Math.min(2.5, (selected.scale ?? 1) + 0.15) })}>+ larger</button>
              {selDef?.invertible && (
                <button onClick={() => updateSelected({ inverted: !selected.inverted })}>{selected.inverted ? 'un-invert' : 'invert'}</button>
              )}
              {selected.role === 'sign' && canBeCore(selected.type) && (
                <button onClick={promoteToCore}>↦ to center</button>
              )}
              <button className="danger" onClick={deleteSelected}>delete</button>
            </div>
          )}

          <div className="canvas-toolbar">
            <button
              className={composition.ring.closed ? '' : 'primary'}
              onClick={() => setComposition((p) => ({ ...p, ring: { ...p.ring, closed: !p.ring.closed } }))}
            >
              {composition.ring.closed ? 'Open ring (deactivate)' : 'Close ring (activate)'}
            </button>
            <button className="danger" onClick={() => { setComposition(EMPTY); setSelectedId(null) }}>Clear all</button>
          </div>
        </div>

        <ResultPanel result={result} />
      </div>
    </div>
  )
}
