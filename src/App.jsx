import { useEffect, useMemo, useState } from 'react'
import Palette from './components/Palette.jsx'
import GlyphCanvas from './components/GlyphCanvas.jsx'
import ResultPanel from './components/ResultPanel.jsx'
import InkPanel from './components/InkPanel.jsx'
import { analyze } from './engine/analyze.js'
import { canBeCore, getComponentDef } from './engine/data.js'

let _id = 1
const nextId = () => `c${_id++}`

const EMPTY = { ring: { closed: false, doubled: false, size: 'medium' }, core: null, components: [], linkCount: 0, dyes: [], name: '' }
const SIGIL = { rotation: 0, scale: 1, inverted: false }

export default function App() {
  const [composition, setComposition] = useState(EMPTY)
  const [selectedId, setSelectedId] = useState(null)
  const [notice, setNotice] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState(null)

  const result = useMemo(() => analyze(composition), [composition])

  const isCore = composition.core?.id === selectedId
  const selected = useMemo(() => {
    if (!selectedId) return null
    if (composition.core?.id === selectedId) return { ...composition.core, role: 'sigil' }
    return composition.components.find((c) => c.id === selectedId) || null
  }, [selectedId, composition])

  function flash(msg) {
    setNotice(msg)
    window.clearTimeout(flash._t)
    flash._t = window.setTimeout(() => setNotice(null), 2500)
  }

  function toggleDye(id) {
    setComposition((prev) => {
      const dyes = prev.dyes || []
      return { ...prev, dyes: dyes.includes(id) ? dyes.filter((d) => d !== id) : [...dyes, id] }
    })
  }

  // Conta sigils extra (componentes role 'sigil', sem o core) p/ posicionar novos.
  function placeExtraSigil(prev, x, y) {
    if (x != null && y != null) return { x, y }
    const n = prev.components.filter((c) => c.role === 'sigil').length
    const angle = ((n * 72) % 360) * (Math.PI / 180)
    const r = 80
    return { x: r * Math.sin(angle), y: -r * Math.cos(angle) }
  }

  // Adiciona componente. 1º sigil -> core; sigils extras e signs -> components.
  function addComponent(type, kind, x, y) {
    const id = nextId()
    setComposition((prev) => {
      if (kind === 'sigil') {
        if (!prev.core) return { ...prev, core: { id, type, x: 0, y: 0, ...SIGIL } }
        const pos = placeExtraSigil(prev, x, y)
        return { ...prev, components: [...prev.components, { id, type, role: 'sigil', ...pos, ...SIGIL }] }
      }
      const px = x ?? 0
      const py = y ?? -150
      return { ...prev, components: [...prev.components, { id, type, role: 'sign', x: px, y: py, ...SIGIL }] }
    })
    setSelectedId(id)
  }

  // Adicionar por clique (sem coords) — signs em anel automático; sigils via addComponent.
  function addByClick(type, kind) {
    if (kind === 'sigil') return addComponent(type, kind)
    setComposition((prev) => {
      const n = prev.components.filter((c) => c.role === 'sign').length
      const angle = (n * 60) % 360
      const rad = (angle * Math.PI) / 180
      const r = 150
      const id = nextId()
      setSelectedId(id)
      return {
        ...prev,
        components: [...prev.components, { id, type, role: 'sign', x: r * Math.sin(rad), y: -r * Math.cos(rad), ...SIGIL }],
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
      if (prev.core?.id === selectedId) {
        // Ao apagar o core, promove o próximo sigil (se houver) para manter o spell coerente.
        const nextSigil = prev.components.find((c) => c.role === 'sigil')
        if (nextSigil) {
          return {
            ...prev,
            core: { id: nextSigil.id, type: nextSigil.type, x: 0, y: 0, rotation: nextSigil.rotation || 0, scale: nextSigil.scale ?? 1, inverted: !!nextSigil.inverted },
            components: prev.components.filter((c) => c.id !== nextSigil.id),
          }
        }
        return { ...prev, core: null }
      }
      return { ...prev, components: prev.components.filter((c) => c.id !== selectedId) }
    })
    setSelectedId(null)
  }

  // Apaga o selecionado com a tecla Delete/Backspace (ignora se estiver digitando num campo).
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      if (!selectedId) return
      e.preventDefault()
      deleteSelected()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId])

  // Leva o selecionado para o centro (core). Funciona p/ sigils extras e signs-centro.
  function promoteToCore() {
    if (!selected || isCore) return
    if (!(selected.role === 'sigil' || canBeCore(selected.type))) return
    setComposition((prev) => {
      const newCore = { id: selected.id, type: selected.type, x: 0, y: 0, rotation: selected.rotation || 0, scale: selected.scale ?? 1, inverted: !!selected.inverted }
      let components = prev.components.filter((c) => c.id !== selected.id)
      if (prev.core && prev.core.id !== selected.id) {
        components = [...components, { ...prev.core, role: 'sigil', x: 80, y: 0 }]
      }
      return { ...prev, core: newCore, components }
    })
  }

  // ---------- Export / Import / Copy image ----------
  function exportObject() {
    const { ring, core, components, linkCount, dyes, name } = composition
    return { format: 'wha-spell@1', name: name || '', ring, core, components, linkCount: linkCount || 0, dyes: dyes || [] }
  }

  async function copyJSON() {
    const json = JSON.stringify(exportObject(), null, 2)
    try {
      await navigator.clipboard.writeText(json)
      flash('Spell JSON copied to clipboard')
    } catch {
      flash('Clipboard blocked — could not copy JSON')
    }
  }

  function applyImport() {
    let data
    try {
      data = JSON.parse(importText)
    } catch (e) {
      setImportError('Invalid JSON: ' + e.message)
      return
    }
    if (!data || typeof data !== 'object' || (!data.core && !(data.components || []).some((c) => c.role === 'sigil'))) {
      setImportError('JSON must describe a spell with at least one sigil (a "core" or a role:"sigil" component).')
      return
    }
    // Re-id everything so it never collides with the running id counter.
    const core = data.core ? { ...data.core, id: nextId() } : null
    const components = (data.components || []).map((c) => ({ ...c, id: nextId() }))
    setComposition({
      ring: data.ring && typeof data.ring === 'object' ? data.ring : { closed: false },
      core,
      components,
      linkCount: data.linkCount || 0,
      dyes: Array.isArray(data.dyes) ? data.dyes : [],
      name: typeof data.name === 'string' ? data.name : '',
    })
    setSelectedId(null)
    setImportOpen(false)
    setImportText('')
    setImportError(null)
    flash('Spell imported')
  }

  async function copyImage() {
    const svg = document.querySelector('.glyph-svg')
    if (!svg) return
    const clone = svg.cloneNode(true)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    // drop the selection highlight (dashed "4 3" ring) so the image is clean
    clone.querySelectorAll('[stroke-dasharray="4 3"]').forEach((el) => el.remove())
    const xml = new XMLSerializer().serializeToString(clone)
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
    const out = 1200 // px (2× the 600 viewBox for crispness)
    const title = (composition.name || '').trim()
    const band = title ? Math.round(out * 0.12) : 0 // dedicated strip above the glyph
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = out
      canvas.height = out + band
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#efe2c4' // parchment (the SVG's CSS bg isn't serialized)
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // Title in its own strip so it never overlaps the ring.
      if (title) {
        ctx.fillStyle = '#3a2a16'
        ctx.font = `700 ${Math.round(out * 0.05)}px Georgia, "Times New Roman", serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(title, out / 2, band / 2, out * 0.9)
      }
      ctx.drawImage(img, 0, band, out, out)
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
          flash('Spell image copied to clipboard')
        } catch {
          flash('Image copy not supported in this browser')
        }
      }, 'image/png')
    }
    img.onerror = () => flash('Could not render the spell image')
    img.src = url
  }

  const selDef = selected ? getComponentDef(selected.type) : null

  return (
    <div className="app">
      <header className="app-header">
        <h1>⬡ Witch Hat Atelier — Spell Analyzer</h1>
        <p>Compose a glyph: drag sigils to the center and signs around them. Close the ring to activate.</p>
      </header>

      <div className="layout">
        <Palette onAdd={addByClick} />

        <div className="panel canvas-wrap">
          <input
            className="spell-name"
            type="text"
            placeholder="Untitled spell"
            value={composition.name || ''}
            onChange={(e) => setComposition((p) => ({ ...p, name: e.target.value }))}
            aria-label="Spell name"
          />

          <GlyphCanvas
            composition={composition}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={moveComponent}
            onDropAdd={addComponent}
          />

          {selected && (
            <div className="selected-toolbar">
              <span className="title">{selDef?.name} {isCore ? '(core)' : selected.role === 'sigil' ? '(sigil)' : ''}</span>
              <button onClick={() => updateSelected({ rotation: ((selected.rotation || 0) - 30 + 360) % 360 })}>⟲ -30°</button>
              <button onClick={() => updateSelected({ rotation: ((selected.rotation || 0) + 30) % 360 })}>⟳ +30°</button>
              <button onClick={() => updateSelected({ scale: Math.max(0.4, (selected.scale ?? 1) - 0.15) })}>− smaller</button>
              <button onClick={() => updateSelected({ scale: Math.min(2.5, (selected.scale ?? 1) + 0.15) })}>+ larger</button>
              {selDef?.invertible && (
                <button onClick={() => updateSelected({ inverted: !selected.inverted })}>{selected.inverted ? 'un-invert' : 'invert'}</button>
              )}
              {!isCore && (selected.role === 'sigil' || canBeCore(selected.type)) && (
                <button onClick={promoteToCore}>↦ to center</button>
              )}
              <button className="danger" onClick={deleteSelected} title="Delete (Del)">delete</button>
            </div>
          )}

          <div className="ring-size" role="group" aria-label="Ring size">
            <span className="rs-label">Ring size</span>
            {['small', 'medium', 'big'].map((sz) => (
              <button
                key={sz}
                className={`rs-btn ${(composition.ring.size || 'medium') === sz ? 'on' : ''}`}
                onClick={() => setComposition((p) => ({ ...p, ring: { ...p.ring, size: sz } }))}
              >
                {sz}
              </button>
            ))}
          </div>

          <div className="canvas-toolbar">
            <button
              className={composition.ring.closed ? '' : 'primary'}
              onClick={() => setComposition((p) => ({ ...p, ring: { ...p.ring, closed: !p.ring.closed } }))}
            >
              {composition.ring.closed ? 'Open ring (deactivate)' : 'Close ring (activate)'}
            </button>
            <button onClick={copyJSON}>Export (JSON)</button>
            <button onClick={() => { setImportText(''); setImportError(null); setImportOpen(true) }}>Import (JSON)</button>
            <button onClick={copyImage}>Copy image</button>
            <button className="danger" onClick={() => { setComposition(EMPTY); setSelectedId(null) }}>Clear all</button>
          </div>

          <InkPanel dyes={composition.dyes} onToggle={toggleDye} />
        </div>

        <ResultPanel result={result} />
      </div>

      {notice && <div className="toast">{notice}</div>}

      {importOpen && (
        <div className="modal-overlay" onClick={() => setImportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import spell (JSON)</h3>
            <p className="hint">Paste a spell JSON (as produced by “Export (JSON)”).</p>
            <textarea
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setImportError(null) }}
              placeholder='{ "format": "wha-spell@1", "core": { ... }, "components": [ ... ] }'
              rows={12}
              spellCheck={false}
            />
            {importError && <div className="modal-error">{importError}</div>}
            <div className="modal-actions">
              <button onClick={() => setImportOpen(false)}>Cancel</button>
              <button className="primary" onClick={applyImport}>Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
