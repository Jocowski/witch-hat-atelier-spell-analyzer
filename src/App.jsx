import { useEffect, useMemo, useRef, useState } from 'react'
import Palette from './components/Palette.jsx'
import GlyphCanvas, { RING_RADII } from './components/GlyphCanvas.jsx'
import ResultPanel from './components/ResultPanel.jsx'
import InkPanel from './components/InkPanel.jsx'
import Inspector from './components/Inspector.jsx'
import SpellTree from './components/SpellTree.jsx'
import { analyze } from './engine/analyze.js'
import { toComposition } from './engine/compose.js'
import { inwardRotation, outwardRotation, classifyZone, xyToAnchor, anchorToXY } from './engine/geometry.js'
import { canBeCore, getComponentDef, DYE_MAP, DYES, RULES } from './engine/data.js'

let _id = 1
const nextId = () => `c${_id++}`
let _cid = 1
const nextCircleId = () => `k${_cid++}`

// Neutral rotation for a sign at (x, y): top faces the center by default, but signs whose
// canon orientation points outward (defaultFacing: 'outward', e.g. Sights Set) face away.
const neutralRotation = (type, x, y) =>
  getComponentDef(type)?.defaultFacing === 'outward' ? outwardRotation(x, y) : inwardRotation(x, y)

const SIGIL = { rotation: 0, scale: 1, inverted: false, mirrored: false }
const newCircle = (over = {}) => ({ id: nextCircleId(), name: '', center: { x: 0, y: 0 }, radius: 170, ring: { closed: false }, core: null, components: [], dyes: [], inkColor: null, ...over })

const FIRST = newCircle({ name: 'Circle 1' })
const EMPTY = { name: '', circles: [FIRST], relations: [] }

const COLOR_TO_DYE = Object.fromEntries(DYES.map((d) => [d.color.toLowerCase(), d.id]))
// Free-value ring radius: min is below the old 'small' (110), max above the old 'big' (240).
const RADIUS_MIN = 50
const RADIUS_MAX = 460
const radiusOf = (c) => c.radius ?? RING_RADII[c.ring?.size] ?? RING_RADII.medium

export default function App() {
  const [composition, setComposition] = useState(EMPTY)
  const [activeCircleId, setActiveCircleId] = useState(FIRST.id)
  const [selected, setSelected] = useState(null) // { circleId, partId }
  const [hovered, setHovered] = useState(null) // { circleId, partId? } from the tree
  const [focusedCircleId, setFocusedCircleId] = useState(null) // dim the other circles
  const [rightTab, setRightTab] = useState('structure') // right rail: structure | analysis
  const [activeInk, setActiveInk] = useState(null)
  const [notice, setNotice] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState(null)

  // ---- undo / redo (snapshot history; drags & sliders checkpoint once at interaction start) ----
  const compRef = useRef(composition); compRef.current = composition
  const pastRef = useRef([])
  const futureRef = useRef([])
  const [histVer, setHistVer] = useState(0)
  const canUndo = pastRef.current.length > 0
  const canRedo = futureRef.current.length > 0
  function checkpoint() { pastRef.current = [...pastRef.current, compRef.current].slice(-60); futureRef.current = []; setHistVer((v) => v + 1) }
  function undo() {
    if (!pastRef.current.length) return
    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [compRef.current, ...futureRef.current]
    setComposition(prev); setSelected(null); setHistVer((v) => v + 1)
  }
  function redo() {
    if (!futureRef.current.length) return
    const next = futureRef.current[0]
    pastRef.current = [...pastRef.current, compRef.current]
    futureRef.current = futureRef.current.slice(1)
    setComposition(next); setSelected(null); setHistVer((v) => v + 1)
  }

  const inkColor = activeInk ? DYE_MAP[activeInk]?.color : undefined
  const withInk = (part) => (inkColor ? { ...part, color: inkColor } : part)

  // Derive each circle's dyes from the inks its parts were drawn with (fallback: stored dyes).
  function circleDyes(c) {
    const ids = new Set()
    for (const p of [c.core, ...c.components]) {
      const id = p?.color && COLOR_TO_DYE[p.color.toLowerCase()]
      if (id) ids.add(id)
    }
    const ringDye = c.inkColor && COLOR_TO_DYE[c.inkColor.toLowerCase()]
    if (ringDye) ids.add(ringDye)
    return ids.size ? [...ids] : (c.dyes || [])
  }
  const compForAnalysis = useMemo(
    () => ({ ...composition, circles: composition.circles.map((c) => ({ ...c, dyes: circleDyes(c) })) }),
    [composition],
  )
  const result = useMemo(() => analyze(compForAnalysis), [compForAnalysis])

  const activeCircle = composition.circles.find((c) => c.id === activeCircleId) || composition.circles[0]
  const otherCircles = composition.circles.filter((c) => c.id !== activeCircle?.id)

  const selectedCircle = selected ? composition.circles.find((c) => c.id === selected.circleId) : null
  const selectedPart = selected && selectedCircle
    ? (selectedCircle.core?.id === selected.partId ? { ...selectedCircle.core, role: 'core' } : selectedCircle.components.find((p) => p.id === selected.partId))
    : null
  const isCore = selectedPart?.role === 'core'
  const selDef = selectedPart ? getComponentDef(selectedPart.type) : null
  const selectedZone = selectedPart && !isCore && selectedCircle
    ? classifyZone(selectedPart.x, selectedPart.y, radiusOf(selectedCircle), RULES.zones) : null
  const canPromoteSel = !!selectedPart && !isCore && (selectedPart.role === 'sigil' || canBeCore(selectedPart.type))

  function flash(msg) {
    setNotice(msg)
    window.clearTimeout(flash._t)
    flash._t = window.setTimeout(() => setNotice(null), 2500)
  }
  function selectInk(id) { setActiveInk((cur) => (cur === id ? null : id)) }

  // ---- circle helpers ----
  function patchCircle(id, fn) {
    setComposition((prev) => ({ ...prev, circles: prev.circles.map((c) => (c.id === id ? fn(c) : c)) }))
  }
  function placeExtraSigil(c) {
    const n = c.components.filter((p) => p.role === 'sigil').length
    const angle = ((n * 72) % 360) * (Math.PI / 180)
    const r = 60
    return { x: r * Math.sin(angle), y: -r * Math.cos(angle) }
  }

  // ---- add / move / edit parts (scoped to a circle) ----
  function addComponent(circleId, type, kind, x, y) {
    checkpoint()
    const id = nextId()
    patchCircle(circleId, (c) => {
      if (kind === 'sigil') {
        if (!c.core) return { ...c, core: withInk({ id, type, x: 0, y: 0, ...SIGIL }) }
        const pos = x != null && y != null ? { x, y } : placeExtraSigil(c)
        return { ...c, components: [...c.components, withInk({ id, type, role: 'sigil', ...pos, ...SIGIL })] }
      }
      const sx = x ?? 0, sy = y ?? -100
      // Default a sign to its neutral orientation (top facing center, or outward for
      // signs like Sights Set whose canon tip points away from the seal).
      return { ...c, components: [...c.components, withInk({ id, type, role: 'sign', x: sx, y: sy, ...SIGIL, rotation: neutralRotation(type, sx, sy) })] }
    })
    setActiveCircleId(circleId)
    setSelected({ circleId, partId: id })
  }
  function addByClick(type, kind) {
    const cid = activeCircle?.id
    if (!cid) return
    if (kind === 'sigil') return addComponent(cid, type, kind)
    const n = (activeCircle.components || []).filter((p) => p.role === 'sign').length
    const angle = (n * 60) % 360
    const rad = (angle * Math.PI) / 180
    const r = radiusOf(activeCircle) * 0.65
    addComponent(cid, type, kind, r * Math.sin(rad), -r * Math.cos(rad))
  }
  function movePart(circleId, partId, x, y) {
    patchCircle(circleId, (c) => {
      if (c.core?.id === partId) return { ...c, core: { ...c.core, x, y } }
      const R = radiusOf(c)
      return {
        ...c,
        components: c.components.map((p) => {
          if (p.id !== partId) return p
          // A ring-pinned sign tracks the ring: store the drag as an updated anchor (angle/offset).
          if (p.anchor?.ring) { const a = xyToAnchor(x, y, R); return { ...p, x, y, anchor: { ring: true, angle: a.angle, offset: a.offset } } }
          return { ...p, x, y }
        }),
      }
    })
  }
  // Pin/unpin the selected sign to its circle's ring (anchor follows resize; drag moves along it).
  function togglePinToRing() {
    if (!selected) return
    checkpoint()
    patchCircle(selected.circleId, (c) => {
      const R = radiusOf(c)
      return {
        ...c,
        components: c.components.map((p) => {
          if (p.id !== selected.partId) return p
          if (p.anchor?.ring) { const { anchor, ...rest } = p; return rest } // unpin: keep current x,y
          const a = xyToAnchor(p.x, p.y, R)
          return { ...p, ...anchorToXY(a.angle, a.offset, R), anchor: { ring: true, angle: a.angle, offset: a.offset } }
        }),
      }
    })
  }
  function updateSelected(patch) {
    if (!selected) return
    patchCircle(selected.circleId, (c) => {
      if (c.core?.id === selected.partId) return { ...c, core: { ...c.core, ...patch } }
      return { ...c, components: c.components.map((p) => (p.id === selected.partId ? { ...p, ...patch } : p)) }
    })
  }
  function deleteSelected() {
    if (!selected) return
    checkpoint()
    patchCircle(selected.circleId, (c) => {
      if (c.core?.id === selected.partId) {
        const next = c.components.find((p) => p.role === 'sigil')
        if (next) return { ...c, core: { id: next.id, type: next.type, x: 0, y: 0, rotation: next.rotation || 0, scale: next.scale ?? 1, inverted: !!next.inverted, mirrored: !!next.mirrored, color: next.color }, components: c.components.filter((p) => p.id !== next.id) }
        return { ...c, core: null }
      }
      return { ...c, components: c.components.filter((p) => p.id !== selected.partId) }
    })
    setSelected(null)
  }
  // ---- group / arrange ops ----
  // Duplicate the selected component (a small offset so it's visible), and select the copy.
  function duplicateSelected() {
    if (!selectedPart || isCore) return
    checkpoint()
    const id = nextId()
    patchCircle(selected.circleId, (c) => ({
      ...c,
      components: [...c.components, { ...selectedPart, id, x: (selectedPart.x || 0) + 16, y: (selectedPart.y || 0) + 16, anchor: undefined }],
    }))
    setSelected({ circleId: selected.circleId, partId: id })
  }
  // Clone the selected sign into N copies spread evenly around the ring at its current radius.
  function radialClone(n) {
    if (!selectedPart || isCore || n < 2) return
    checkpoint()
    const r = Math.hypot(selectedPart.x || 0, selectedPart.y || 0) || (radiusOf(selectedCircle) * 0.65)
    const base = ((Math.atan2(selectedPart.x || 0, -(selectedPart.y || 0)) * 180) / Math.PI + 360) % 360
    patchCircle(selected.circleId, (c) => {
      const copies = []
      for (let i = 1; i < n; i++) {
        const ang = ((base + (360 / n) * i) * Math.PI) / 180
        const x = r * Math.sin(ang), y = -r * Math.cos(ang)
        copies.push({ ...selectedPart, id: nextId(), x, y, rotation: neutralRotation(selectedPart.type, x, y), anchor: undefined })
      }
      return { ...c, components: [...c.components, ...copies] }
    })
  }
  // Respace a circle's signs at equal angles around the ring (each keeps its own radius),
  // re-facing them inward — turns a rough cluster into a clean radially-symmetric ring.
  function distributeEvenly(circleId) {
    const c = composition.circles.find((x) => x.id === circleId)
    if (!c) return
    const signs = c.components.filter((p) => p.role === 'sign')
    if (signs.length < 2) return
    checkpoint()
    patchCircle(circleId, (cc) => {
      let i = 0
      const n = signs.length
      return {
        ...cc,
        components: cc.components.map((p) => {
          if (p.role !== 'sign') return p
          const r = Math.hypot(p.x || 0, p.y || 0) || (radiusOf(cc) * 0.65)
          const ang = ((360 / n) * i++) * (Math.PI / 180)
          const x = r * Math.sin(ang), y = -r * Math.cos(ang)
          return { ...p, x, y, rotation: neutralRotation(p.type, x, y), anchor: undefined }
        }),
      }
    })
  }

  // Move a non-core component (sign or extra sigil) from one circle to another, keeping its
  // local x,y (so it lands in the same spot relative to the new circle's center).
  function movePartToCircle(fromId, partId, toId) {
    if (fromId === toId) return
    checkpoint()
    let moved = null
    setComposition((prev) => {
      const circles = prev.circles.map((c) => {
        if (c.id !== fromId) return c
        const comp = c.components.find((p) => p.id === partId)
        if (!comp) return c
        moved = comp
        return { ...c, components: c.components.filter((p) => p.id !== partId) }
      })
      if (!moved) return prev
      return { ...prev, circles: circles.map((c) => (c.id === toId ? { ...c, components: [...c.components, moved] } : c)) }
    })
    if (moved) { setActiveCircleId(toId); setSelected({ circleId: toId, partId }) }
  }

  function promoteToCore() {
    if (!selectedPart || isCore) return
    if (!(selectedPart.role === 'sigil' || canBeCore(selectedPart.type))) return
    checkpoint()
    patchCircle(selected.circleId, (c) => {
      const np = { id: selectedPart.id, type: selectedPart.type, x: 0, y: 0, rotation: selectedPart.rotation || 0, scale: selectedPart.scale ?? 1, inverted: !!selectedPart.inverted, mirrored: !!selectedPart.mirrored, color: selectedPart.color }
      let components = c.components.filter((p) => p.id !== selectedPart.id)
      if (c.core && c.core.id !== selectedPart.id) components = [...components, { ...c.core, role: 'sigil', x: 80, y: 0 }]
      return { ...c, core: np, components }
    })
  }

  // ---- circle management ----
  function addCircle(concentric) {
    checkpoint()
    const act = activeCircle
    let center = { x: 0, y: 0 }
    let radius = 170
    if (concentric && act) {
      center = { ...act.center }
      radius = Math.max(RADIUS_MIN, Math.round(radiusOf(act) * 0.55))
    } else if (act) {
      center = { x: act.center.x + radiusOf(act) + 200, y: act.center.y }
    }
    const c = newCircle({ name: `Circle ${composition.circles.length + 1}`, center, radius, inkColor: inkColor || null })
    setComposition((prev) => ({
      ...prev,
      circles: [...prev.circles, c],
      relations: concentric && act ? [...prev.relations, { type: 'nest', outer: act.id, inner: c.id }] : prev.relations,
    }))
    setActiveCircleId(c.id)
    setSelected(null)
  }
  // Wrap the active circle in a new, larger OUTER ring (nesting the active circle inside it) —
  // the complement of "+ inner ring", for building nested spells from the inside out.
  function addOuterRing() {
    const act = activeCircle
    if (!act) return
    checkpoint()
    const radius = Math.min(RADIUS_MAX, Math.round(radiusOf(act) * 1.8))
    const c = newCircle({ name: `Circle ${composition.circles.length + 1}`, center: { ...act.center }, radius, inkColor: inkColor || null })
    setComposition((prev) => ({
      ...prev,
      circles: [...prev.circles, c],
      relations: [...prev.relations, { type: 'nest', outer: c.id, inner: act.id }],
    }))
    setActiveCircleId(c.id); setSelected(null)
  }
  // Auto-nest: when a circle is dragged inside a larger one, wire the nest relation.
  function autoNest(innerId, outerId) {
    if (composition.relations.some((r) => r.type === 'nest' && r.inner === innerId)) return // already nested
    checkpoint()
    addRelation({ type: 'nest', outer: outerId, inner: innerId })
    const nm = (id) => composition.circles.find((c) => c.id === id)?.name || id
    flash(`Nested ${nm(innerId)} inside ${nm(outerId)}`)
  }

  function deleteCircle(id) {
    if (composition.circles.length <= 1) { flash('A spell needs at least one circle'); return }
    checkpoint()
    const circle = composition.circles.find((c) => c.id === id)
    const partIds = new Set(circle ? [circle.core?.id, ...circle.components.map((p) => p.id)].filter(Boolean) : [])
    const remaining = composition.circles.filter((c) => c.id !== id)
    setComposition((prev) => ({
      ...prev,
      circles: prev.circles.filter((c) => c.id !== id),
      relations: prev.relations.filter((r) => (r.type === 'nest' ? r.outer !== id && r.inner !== id : r.a !== id && r.b !== id && !partIds.has(r.a) && !partIds.has(r.b))),
    }))
    if (activeCircleId === id) setActiveCircleId(remaining[0].id)
    if (selected?.circleId === id) setSelected(null)
  }
  // Resize a circle, re-resolving any ring-pinned parts so they stay on the (new) rim.
  function setCircleRadius(id, radius) {
    patchCircle(id, (c) => ({
      ...c,
      radius,
      components: c.components.map((p) => (p.anchor?.ring ? { ...p, ...anchorToXY(p.anchor.angle || 0, p.anchor.offset || 0, radius) } : p)),
    }))
  }
  const setRingClosed = (id, closed) => { checkpoint(); patchCircle(id, (c) => ({ ...c, ring: { ...c.ring, closed } })) }
  const setCircleName = (id, name) => patchCircle(id, (c) => ({ ...c, name }))

  // ---- relations ----
  function addRelation(rel) {
    setComposition((prev) => {
      const dup = prev.relations.some((r) => JSON.stringify(r) === JSON.stringify(rel))
      return dup ? prev : { ...prev, relations: [...prev.relations, rel] }
    })
  }
  function removeRelation(idx) {
    setComposition((prev) => ({ ...prev, relations: prev.relations.filter((_, i) => i !== idx) }))
  }

  // ---- selection from canvas ----
  const selectPart = (circleId, partId) => { setActiveCircleId(circleId); setSelected({ circleId, partId }) }
  const selectCircle = (circleId) => { setActiveCircleId(circleId); setSelected(null) }
  const clearSelect = () => setSelected(null)

  useEffect(() => {
    function onKeyDown(e) {
      const el = document.activeElement
      const tag = el?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable
      const mod = e.ctrlKey || e.metaKey
      if (mod && (e.key === 'z' || e.key === 'Z')) { if (typing) return; e.preventDefault(); e.shiftKey ? redo() : undo(); return }
      if (mod && (e.key === 'y' || e.key === 'Y')) { if (typing) return; e.preventDefault(); redo(); return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && selected) { e.preventDefault(); deleteSelected() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected])

  // ---- export / import / image ----
  function exportObject() {
    return { format: 'wha-spell@2', name: composition.name || '', circles: compForAnalysis.circles, relations: composition.relations }
  }
  async function copyJSON() {
    try { await navigator.clipboard.writeText(JSON.stringify(exportObject(), null, 2)); flash('Spell JSON copied to clipboard') }
    catch { flash('Clipboard blocked — could not copy JSON') }
  }
  function applyImport() {
    let data
    try { data = JSON.parse(importText) } catch (e) { setImportError('Invalid JSON: ' + e.message); return }
    let norm
    try { norm = toComposition(data.composition || data) } catch { norm = null }
    if (!norm || !norm.circles.length) { setImportError('Could not read a spell (need a wha-spell@1 or @2 composition).'); return }
    const idMap = {}
    const circles = norm.circles.map((c) => {
      const ncid = nextCircleId(); idMap[c.id] = ncid
      const core = c.core ? { ...c.core, id: (idMap[c.core.id] = nextId()) } : null
      const components = (c.components || []).map((p) => ({ ...p, id: (idMap[p.id] = nextId()) }))
      return { id: ncid, name: c.name || '', center: c.center || { x: 0, y: 0 }, radius: c.radius ?? null, ring: c.ring || { closed: false }, core, components, dyes: c.dyes || [], inkColor: c.inkColor || null }
    })
    const relations = (norm.relations || []).map((r) => (r.type === 'nest'
      ? { type: 'nest', outer: idMap[r.outer] || r.outer, inner: idMap[r.inner] || r.inner }
      : { type: 'link', a: idMap[r.a] || r.a, b: idMap[r.b] || r.b }))
    setComposition({ name: norm.name || '', circles, relations })
    setActiveCircleId(circles[0].id)
    setSelected(null); setImportOpen(false); setImportText(''); setImportError(null); flash('Spell imported')
  }

  function spellViewBox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of composition.circles) {
      let reach = radiusOf(c)
      for (const p of c.components || []) reach = Math.max(reach, Math.hypot(p.x || 0, p.y || 0))
      minX = Math.min(minX, c.center.x - reach); minY = Math.min(minY, c.center.y - reach)
      maxX = Math.max(maxX, c.center.x + reach); maxY = Math.max(maxY, c.center.y + reach)
    }
    if (!isFinite(minX)) return '-300 -300 600 600'
    const pad = 50, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    const side = Math.max(maxX - minX, maxY - minY) + pad * 2
    return `${cx - side / 2} ${cy - side / 2} ${side} ${side}`
  }
  async function copyImage() {
    const svg = document.querySelector('.glyph-svg')
    if (!svg) return
    const clone = svg.cloneNode(true)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('viewBox', spellViewBox())
    clone.querySelectorAll('[stroke-dasharray="4 3"], [stroke-dasharray="6 4"]').forEach((el) => el.remove())
    const xml = new XMLSerializer().serializeToString(clone)
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
    const out = 1200
    const title = (composition.name || '').trim()
    const band = title ? Math.round(out * 0.12) : 0
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = out; canvas.height = out + band
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#efe2c4'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (title) {
        ctx.fillStyle = '#3a2a16'
        ctx.font = `700 ${Math.round(out * 0.05)}px Georgia, "Times New Roman", serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(title, out / 2, band / 2, out * 0.9)
      }
      ctx.drawImage(img, 0, band, out, out)
      canvas.toBlob(async (blob) => {
        try { await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]); flash('Spell image copied to clipboard') }
        catch { flash('Image copy not supported in this browser') }
      }, 'image/png')
    }
    img.onerror = () => flash('Could not render the spell image')
    img.src = url
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>⬡ Witch Hat Atelier — Spell Analyzer</h1>
        <p>Compose glyphs across one or more circles: drag a sigil to a circle's center and signs around it. Nest or link circles to combine spells.</p>
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
            activeCircleId={activeCircleId}
            selected={selected}
            hovered={hovered}
            focusedCircleId={focusedCircleId}
            onSelectCircle={selectCircle}
            onSelectPart={selectPart}
            onClearSelect={clearSelect}
            onMovePart={movePart}
            onMoveCircle={(id, x, y) => patchCircle(id, (c) => ({ ...c, center: { x, y } }))}
            onDropAdd={addComponent}
            onBeginInteraction={checkpoint}
            onFocusCircle={(id) => setFocusedCircleId((cur) => (cur === id ? null : id))}
            onAutoNest={autoNest}
          />

          <Inspector
            part={selectedPart}
            def={selDef}
            isCore={isCore}
            zone={selectedZone}
            otherCircles={otherCircles}
            canPromote={canPromoteSel}
            pinned={!!selectedPart?.anchor?.ring}
            onUpdate={updateSelected}
            onResetRotation={() => updateSelected({ rotation: isCore ? 0 : neutralRotation(selectedPart.type, selectedPart.x, selectedPart.y) })}
            onPromoteToCore={promoteToCore}
            onTogglePin={togglePinToRing}
            onMoveToCircle={(toId) => movePartToCircle(selected.circleId, selected.partId, toId)}
            onDuplicate={duplicateSelected}
            onRadialClone={radialClone}
            onDelete={deleteSelected}
          />

          {/* ---- Circles panel ---- */}
          <div className="circles-panel">
            <div className="cp-row">
              <span className="cp-label">Circles</span>
              {composition.circles.map((c) => (
                <button
                  key={c.id}
                  className={`cp-chip ${c.id === activeCircleId ? 'on' : ''}`}
                  onClick={() => selectCircle(c.id)}
                  title="Select / activate this circle"
                >
                  {c.name || c.id}
                </button>
              ))}
              <button className="cp-add" onClick={() => addCircle(false)} title="Add a separate circle">+ circle</button>
              <button className="cp-add" onClick={() => addCircle(true)} title="Add a smaller ring nested inside the active circle">+ inner ring</button>
              <button className="cp-add" onClick={addOuterRing} title="Wrap the active circle in a larger outer ring">+ outer ring</button>
            </div>

            {activeCircle && (
              <div className="cp-row">
                <input
                  className="cp-name"
                  type="text"
                  value={activeCircle.name || ''}
                  placeholder={activeCircle.id}
                  onChange={(e) => setCircleName(activeCircle.id, e.target.value)}
                  aria-label="Active circle name"
                />
                <span className="cp-sub">size</span>
                <input type="range" className="cp-size" min={RADIUS_MIN} max={RADIUS_MAX} step={2}
                  value={radiusOf(activeCircle)}
                  onPointerDown={checkpoint}
                  onChange={(e) => setCircleRadius(activeCircle.id, Number(e.target.value))}
                  aria-label="Circle size" />
                <span className="cp-sizeval">{Math.round(radiusOf(activeCircle))}</span>
                <button className={activeCircle.ring?.closed ? '' : 'primary'} onClick={() => setRingClosed(activeCircle.id, !activeCircle.ring?.closed)}>
                  {activeCircle.ring?.closed ? 'open ring' : 'close ring'}
                </button>
                <button onClick={() => distributeEvenly(activeCircle.id)} title="Respace this circle's signs evenly around the ring (radial symmetry)">⊛ distribute</button>
                <button className="cp-ink" onClick={() => patchCircle(activeCircle.id, (c) => ({ ...c, inkColor: inkColor || null }))}
                  title={inkColor ? 'Tint this ring with the selected ink' : 'Reset ring to default ink (pick an ink below first)'}>
                  <span className="swatch" style={{ background: activeCircle.inkColor || '#5a3b1e' }} /> ink ring
                </button>
                {composition.circles.length > 1 && (
                  <button className="danger" onClick={() => deleteCircle(activeCircle.id)}>delete circle</button>
                )}
              </div>
            )}

            {activeCircle && otherCircles.length > 0 && (
              <div className="cp-row">
                <span className="cp-sub">nest inside</span>
                <select value="" onChange={(e) => { if (e.target.value) addRelation({ type: 'nest', outer: e.target.value, inner: activeCircle.id }) }}>
                  <option value="">choose outer…</option>
                  {otherCircles.map((c) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
                </select>
                <span className="cp-sub">link to</span>
                <select value="" onChange={(e) => { if (e.target.value) addRelation({ type: 'link', a: activeCircle.id, b: e.target.value }) }}>
                  <option value="">choose circle…</option>
                  {otherCircles.map((c) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
                </select>
              </div>
            )}

            {composition.relations.length > 0 && (
              <div className="cp-rels">
                {composition.relations.map((r, i) => {
                  const nm = (id) => composition.circles.find((c) => c.id === id)?.name || id
                  const label = r.type === 'nest' ? `${nm(r.inner)} ⊂ ${nm(r.outer)}` : `${nm(r.a)} ↔ ${nm(r.b)}`
                  return (
                    <span key={i} className={`rel-chip ${r.type}`}>
                      {r.type === 'nest' ? '▣ ' : '∿ '}{label}
                      <button onClick={() => removeRelation(i)} title="Remove relation">×</button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <div className="canvas-toolbar">
            <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↶ undo</button>
            <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">↷ redo</button>
            <button onClick={copyJSON}>Export (JSON)</button>
            <button onClick={() => { setImportText(''); setImportError(null); setImportOpen(true) }}>Import (JSON)</button>
            <button onClick={copyImage}>Copy image</button>
            <button className="danger" onClick={() => { checkpoint(); const c = newCircle({ name: 'Circle 1' }); setComposition({ name: '', circles: [c], relations: [] }); setActiveCircleId(c.id); setSelected(null) }}>Clear all</button>
          </div>

          <InkPanel activeInk={activeInk} onSelect={selectInk} />
        </div>

        <div className="right-rail">
          <div className="rail-tabs">
            <button className={rightTab === 'structure' ? 'on' : ''} onClick={() => setRightTab('structure')}>Structure</button>
            <button className={rightTab === 'analysis' ? 'on' : ''} onClick={() => setRightTab('analysis')}>Analysis</button>
          </div>
          {rightTab === 'structure' ? (
            <SpellTree
              composition={composition}
              activeCircleId={activeCircleId}
              selected={selected}
              focusedCircleId={focusedCircleId}
              onSelectCircle={selectCircle}
              onSelectPart={selectPart}
              onHover={setHovered}
              onToggleFocus={(id) => setFocusedCircleId((cur) => (cur === id ? null : id))}
            />
          ) : (
            <ResultPanel result={result} />
          )}
        </div>
      </div>

      {notice && <div className="toast">{notice}</div>}

      {importOpen && (
        <div className="modal-overlay" onClick={() => setImportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import spell (JSON)</h3>
            <p className="hint">Paste a spell JSON (wha-spell@1 or @2, as produced by “Export (JSON)”).</p>
            <textarea
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setImportError(null) }}
              placeholder='{ "format": "wha-spell@2", "circles": [ ... ], "relations": [ ... ] }'
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
