// strokeTemplateMaker.js — draw raw strokes → normalized $P template export.
// Imports the REAL pure modules; JSON data loaded via fetch (no JSON import attributes).
// Serves as a zero-friction authoring tool before the Supabase Training admin is available.

import { makeCloud, strokesToTemplate } from '../src/draw/recognizer.js'
import { loadTemplates, saveTemplates, addTemplate } from '../src/draw/templates.js'

// ── Canvas setup ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('drawCanvas')
const ctx = canvas.getContext('2d')
const W = canvas.width
const H = canvas.height

// Drawing state
let strokes = [] // array of [{x,y}] per stroke
let current = [] // active stroke being drawn
let isDrawing = false

// Overlay state
let overlayPath = null // SVGPath string from selected symbol
let overlayCheck = document.getElementById('overlayCheck')

// ── Data loading ─────────────────────────────────────────────────────────────────
let sigilsData = []
let signsData = []

async function loadSymbolData() {
  try {
    const [sg, sn] = await Promise.all([fetch('/data/sigils.json'), fetch('/data/signs.json')])
    sigilsData = (await sg.json()).sigils ?? []
    signsData = (await sn.json()).signs ?? []
    populateSelect()
  } catch (e) {
    console.warn('[maker] Could not load symbol data:', e)
  }
}

function populateSelect() {
  const sel = document.getElementById('symbolSelect')
  sel.innerHTML = '<option value="">— select symbol —</option>'

  const addGroup = (label, items, role) => {
    const grp = document.createElement('optgroup')
    grp.label = label
    for (const s of items) {
      if (!s.id) continue
      const opt = document.createElement('option')
      opt.value = JSON.stringify({ id: s.id, role, svgPath: s.svgPath ?? '' })
      opt.textContent = s.id
      grp.appendChild(opt)
    }
    sel.appendChild(grp)
  }

  addGroup('Sigils', sigilsData, 'sigil')
  addGroup('Signs', signsData, 'sign')
}

// ── Symbol select → auto-fill name/role + overlay ────────────────────────────────
document.getElementById('symbolSelect').addEventListener('change', (e) => {
  if (!e.target.value) { overlayPath = null; redraw(); return }
  const { id, role, svgPath } = JSON.parse(e.target.value)
  document.getElementById('nameInput').value = id
  document.getElementById('roleSelect').value = role
  overlayPath = svgPath || null
  redraw()
})

// ── Drawing ──────────────────────────────────────────────────────────────────────
function toCanvas(e) {
  const r = canvas.getBoundingClientRect()
  const src = e.touches ? e.touches[0] : e
  return { x: src.clientX - r.left, y: src.clientY - r.top }
}

function onPointerDown(e) {
  e.preventDefault()
  isDrawing = true
  current = [toCanvas(e)]
}
function onPointerMove(e) {
  e.preventDefault()
  if (!isDrawing) return
  current.push(toCanvas(e))
  redraw()
}
function onPointerUp(e) {
  e.preventDefault()
  if (!isDrawing) return
  isDrawing = false
  if (current.length >= 2) strokes.push(current.slice())
  current = []
  redraw()
  setStatus('Drawing captured', 'info')
}

canvas.addEventListener('pointerdown', onPointerDown)
canvas.addEventListener('pointermove', onPointerMove)
canvas.addEventListener('pointerup', onPointerUp)
canvas.addEventListener('pointerleave', onPointerUp)

// ── Render ───────────────────────────────────────────────────────────────────────
function redraw() {
  ctx.clearRect(0, 0, W, H)

  // Crosshairs
  ctx.save()
  ctx.strokeStyle = '#3a2a08'
  ctx.setLineDash([6, 6])
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // SVG overlay
  if (overlayPath && overlayCheck.checked) {
    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.strokeStyle = '#f5c842'
    ctx.lineWidth = 1.5
    ctx.translate(W / 2, H / 2)
    ctx.scale(3, 3) // viewBox is -50..50 → 100px unit; scale to ~300px
    const p2d = new Path2D(overlayPath)
    ctx.stroke(p2d)
    ctx.restore()
  }

  // Committed strokes
  ctx.save()
  ctx.strokeStyle = '#f5c842'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of strokes) drawStroke(s)

  // Active stroke
  if (current.length >= 2) {
    ctx.strokeStyle = '#ffd060'
    drawStroke(current)
  }
  ctx.restore()
}

function drawStroke(pts) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

// ── Controls ─────────────────────────────────────────────────────────────────────
document.getElementById('btnUndo').addEventListener('click', () => {
  strokes.pop(); redraw(); setStatus('Undo', 'info')
})
document.getElementById('btnClear').addEventListener('click', () => {
  strokes = []; current = []; redraw(); setStatus('Ready')
})
overlayCheck.addEventListener('change', redraw)

document.getElementById('btnExport').addEventListener('click', () => {
  const tmpl = buildTemplate()
  if (!tmpl) return
  const normalized = makeCloud(tmpl.name, tmpl.points)
  const out = { name: tmpl.name, role: tmpl.role, points: normalized.points }
  document.getElementById('outputArea').value = JSON.stringify(out, null, 2)
  setStatus('Exported', 'ok')
})

document.getElementById('btnCopy').addEventListener('click', async () => {
  const txt = document.getElementById('outputArea').value
  if (!txt.trim()) { setStatus('Nothing to copy'); return }
  try { await navigator.clipboard.writeText(txt); setStatus('Copied', 'ok') }
  catch { setStatus('Copy failed') }
})

document.getElementById('btnSave').addEventListener('click', () => {
  const tmpl = buildTemplate()
  if (!tmpl) return
  addTemplate(tmpl)
  setStatus('Saved to localStorage', 'ok')
  refreshStoredInfo()
})

document.getElementById('btnClearLS').addEventListener('click', () => {
  saveTemplates([])
  setStatus('localStorage cleared')
  refreshStoredInfo()
})

function buildTemplate() {
  const name = document.getElementById('nameInput').value.trim()
  const role = document.getElementById('roleSelect').value
  if (!name) { setStatus('Enter a name first'); return null }
  if (strokes.length === 0) { setStatus('Draw something first'); return null }
  return strokesToTemplate(strokes, name, role)
}

// ── Status pill ──────────────────────────────────────────────────────────────────
function setStatus(text, type = '') {
  const pill = document.getElementById('statusPill')
  pill.textContent = text
  pill.className = 'pill' + (type ? ` ${type}` : '')
}

// ── Stored template info ──────────────────────────────────────────────────────────
function refreshStoredInfo() {
  const all = loadTemplates()
  const byName = {}
  for (const t of all) byName[t.name] = (byName[t.name] || 0) + 1
  const lines = Object.entries(byName).map(([n, c]) => `${n}: ${c}`)
  const el = document.getElementById('storedInfo')
  el.textContent = all.length === 0
    ? 'No templates stored.'
    : `${all.length} template(s): ${lines.join(', ')}`

}

// ── Init ──────────────────────────────────────────────────────────────────────────
loadSymbolData()
refreshStoredInfo()
redraw()
