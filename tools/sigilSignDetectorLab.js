// sigilSignDetectorLab.js — live $P recognition workbench.
// Imports the REAL recognizer + templates modules; rules.json / sigils.json / signs.json
// are loaded via fetch so no JSON import attributes are needed (pure-module invariant).

import { recognize, makeCloud, confidencePct } from '../src/draw/recognizer.js'
import { loadTemplates } from '../src/draw/templates.js'

// ── State ─────────────────────────────────────────────────────────────────────────
let strokes = []
let current = []
let isDrawing = false
let templates = [] // active template set (localStorage or pasted override)
let sigilsData = []
let signsData = []
let rulesData = null
let overlayPath = null

// ── Canvas ────────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('labCanvas')
const ctx = canvas.getContext('2d')
const W = canvas.width
const H = canvas.height

// ── Data loading ──────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const [sg, sn, rl] = await Promise.all([
      fetch('/data/sigils.json'),
      fetch('/data/signs.json'),
      fetch('/data/rules.json'),
    ])
    sigilsData = (await sg.json()).sigils ?? []
    signsData = (await sn.json()).signs ?? []
    rulesData = await rl.json()
    populateOverlaySelect()
    updateThresholdDisplay()
  } catch (e) {
    console.warn('[detectorLab] Could not load JSON data:', e)
  }
  templates = loadTemplates()
  refreshTemplateSetInfo()
  runRecognition()
}

function populateOverlaySelect() {
  const sel = document.getElementById('overlaySelect')
  const addGroup = (label, items, role) => {
    const grp = document.createElement('optgroup')
    grp.label = label
    for (const s of items) {
      if (!s.id || !s.svgPath) continue
      const opt = document.createElement('option')
      opt.value = JSON.stringify({ svgPath: s.svgPath })
      opt.textContent = `${s.id} (${role})`
      grp.appendChild(opt)
    }
    sel.appendChild(grp)
  }
  addGroup('Sigils', sigilsData, 'sigil')
  addGroup('Signs', signsData, 'sign')
}

document.getElementById('overlaySelect').addEventListener('change', (e) => {
  if (!e.target.value) { overlayPath = null; redraw(); return }
  overlayPath = JSON.parse(e.target.value).svgPath
  redraw()
})

function updateThresholdDisplay() {
  const thresh = rulesData?.recognition?.confidenceMinPct ?? rulesData?.matching?.threshold ?? '?'
  document.getElementById('threshVal').textContent = typeof thresh === 'number' ? `${thresh}%` : thresh
}

// ── Drawing ───────────────────────────────────────────────────────────────────────
function toCanvas(e) {
  const r = canvas.getBoundingClientRect()
  const src = e.touches ? e.touches[0] : e
  return { x: src.clientX - r.left, y: src.clientY - r.top }
}
function onPointerDown(e) { e.preventDefault(); isDrawing = true; current = [toCanvas(e)] }
function onPointerMove(e) { e.preventDefault(); if (!isDrawing) return; current.push(toCanvas(e)); redraw() }
function onPointerUp(e) {
  e.preventDefault()
  if (!isDrawing) return
  isDrawing = false
  if (current.length >= 2) strokes.push(current.slice())
  current = []
  redraw()
  runRecognition()
}

canvas.addEventListener('pointerdown', onPointerDown)
canvas.addEventListener('pointermove', onPointerMove)
canvas.addEventListener('pointerup', onPointerUp)
canvas.addEventListener('pointerleave', onPointerUp)

// ── Redraw ────────────────────────────────────────────────────────────────────────
function redraw() {
  ctx.clearRect(0, 0, W, H)

  // Crosshairs
  ctx.save()
  ctx.strokeStyle = '#2a1a08'
  ctx.setLineDash([5, 5])
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // SVG overlay
  if (overlayPath) {
    ctx.save()
    ctx.globalAlpha = 0.2
    ctx.strokeStyle = '#f5c842'
    ctx.lineWidth = 1.5
    ctx.translate(W / 2, H / 2)
    ctx.scale(2.8, 2.8)
    ctx.stroke(new Path2D(overlayPath))
    ctx.restore()
  }

  // Strokes
  ctx.save()
  ctx.strokeStyle = '#f5c842'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const s of strokes) drawStroke(s)
  if (current.length >= 2) { ctx.strokeStyle = '#ffd060'; drawStroke(current) }
  ctx.restore()
}

function drawStroke(pts) {
  if (pts.length < 2) return
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

// ── Recognition ───────────────────────────────────────────────────────────────────
function getFilteredTemplates() {
  const mode = document.getElementById('modeSelect').value
  if (mode === 'all') return templates
  return templates.filter((t) => t.role === mode)
}

function runRecognition() {
  const allPts = []
  strokes.forEach((s, si) => s.forEach((p) => allPts.push({ X: p.x, Y: p.y, ID: si })))

  const filtered = getFilteredTemplates()
  const clouds = filtered.map((t) => makeCloud(t.name, t.points, t.weight ?? 1))

  if (allPts.length < 2 || clouds.length === 0) {
    clearDecision()
    return
  }

  const ranked = recognize(allPts, clouds)
  displayResults(ranked, filtered)
}

function clearDecision() {
  document.getElementById('topMatchName').textContent = '—'
  document.getElementById('topMatchRole').textContent = strokes.length === 0 ? 'Draw a symbol to recognize' : 'Not enough points or no templates'
  document.getElementById('confFill').style.width = '0%'
  document.getElementById('confVal').textContent = '—'
  document.getElementById('rawDist').textContent = '—'
  document.getElementById('adjDist').textContent = '—'
  document.getElementById('deRot').textContent = '—'
  document.getElementById('gateVal').textContent = '—'
  document.getElementById('rawJson').textContent = '—'
  document.getElementById('matchList').innerHTML = '<div style="color:#5a3a10;font-size:0.8rem;padding:8px">Top-8 matches will appear here.</div>'
}

function displayResults(ranked, filteredTemplates) {
  if (!ranked.length) { clearDecision(); return }

  const top = ranked[0]
  const confPct = confidencePct(top.dist)
  const thresh = rulesData?.recognition?.confidenceMinPct ?? 0
  const pass = confPct >= thresh

  // Decision panel
  document.getElementById('topMatchName').textContent = top.name
  // Find role from filtered templates
  const tmpl = filteredTemplates.find((t) => t.name === top.name)
  document.getElementById('topMatchRole').textContent = tmpl ? `role: ${tmpl.role}` : ''

  const confColor = pass ? '#6dcc8a' : confPct >= thresh * 0.7 ? '#f0a040' : '#cc6a6a'
  document.getElementById('confFill').style.width = `${Math.min(confPct, 100)}%`
  document.getElementById('confFill').style.background = confColor
  document.getElementById('confVal').innerHTML = `<span style="color:${confColor}">${confPct}%</span>`
  document.getElementById('rawDist').textContent = top.dist.toFixed(4)
  document.getElementById('adjDist').textContent = top.adjDist.toFixed(4)
  document.getElementById('deRot').textContent = '— (flat mode)'
  document.getElementById('gateVal').innerHTML = pass
    ? '<span class="gate-pass">PASS</span>'
    : '<span class="gate-fail">FAIL</span>'

  // Raw JSON block
  document.getElementById('rawJson').textContent = JSON.stringify(ranked.slice(0, 8), null, 2)

  // Match list (top 8)
  const list = document.getElementById('matchList')
  list.innerHTML = ''
  const top8 = ranked.slice(0, 8)
  top8.forEach((r, i) => {
    const t = filteredTemplates.find((x) => x.name === r.name)
    const rConf = confidencePct(r.dist)
    const item = document.createElement('div')
    item.className = 'match-item' + (i === 0 ? ' winner' : '')

    const mini = document.createElement('canvas')
    mini.width = 60; mini.height = 60
    drawMiniTemplate(mini, t)

    item.innerHTML = `
      <span class="rank">${i + 1}</span>
      <span class="mid">
        <span class="sym-id">${r.name}</span>
        <span class="sym-role">${t ? ` (${t.role})` : ''}</span><br/>
        <span class="metrics">dist ${r.dist.toFixed(3)} · adj ${r.adjDist.toFixed(3)} · conf ${rConf}%</span>
      </span>`
    item.prepend(mini)
    list.appendChild(item)
  })
}

// Draw a mini-preview of a template's normalized points on a small canvas.
function drawMiniTemplate(mini, tmpl) {
  if (!tmpl) return
  const mc = mini.getContext('2d')
  const mw = mini.width, mh = mini.height
  const cloud = makeCloud(tmpl.name, tmpl.points)
  const pts = cloud.points
  const xs = pts.map((p) => p.X), ys = pts.map((p) => p.Y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1
  const pad = 6
  const sc = Math.min((mw - pad * 2) / rangeX, (mh - pad * 2) / rangeY)
  const ox = mw / 2 - ((minX + maxX) / 2) * sc
  const oy = mh / 2 - ((minY + maxY) / 2) * sc
  const tx = (p) => ({ x: p.X * sc + ox, y: p.Y * sc + oy })

  // Group by ID
  const byId = {}
  for (const p of pts) { const id = p.ID ?? 0; if (!byId[id]) byId[id] = []; byId[id].push(p) }

  mc.strokeStyle = '#f5c842'
  mc.lineWidth = 1.2
  mc.lineCap = 'round'; mc.lineJoin = 'round'
  for (const stroke of Object.values(byId)) {
    if (stroke.length < 2) continue
    mc.beginPath(); const s0 = tx(stroke[0]); mc.moveTo(s0.x, s0.y)
    for (let j = 1; j < stroke.length; j++) { const p = tx(stroke[j]); mc.lineTo(p.x, p.y) }
    mc.stroke()
  }
}

// ── Mode / overlay change → re-run ───────────────────────────────────────────────
document.getElementById('modeSelect').addEventListener('change', runRecognition)

// ── Undo / Clear ──────────────────────────────────────────────────────────────────
document.getElementById('btnUndo').addEventListener('click', () => { strokes.pop(); redraw(); runRecognition() })
document.getElementById('btnClear').addEventListener('click', () => { strokes = []; current = []; redraw(); clearDecision() })

// ── Template paste override ───────────────────────────────────────────────────────
document.getElementById('btnApplyTemplates').addEventListener('click', () => {
  const raw = document.getElementById('pasteTemplates').value.trim()
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Expected array')
    templates = parsed
    refreshTemplateSetInfo()
    runRecognition()
  } catch (e) { console.error('[detectorLab] Invalid template JSON:', e) }
})
document.getElementById('btnResetTemplates').addEventListener('click', () => {
  templates = loadTemplates()
  document.getElementById('pasteTemplates').value = ''
  refreshTemplateSetInfo()
  runRecognition()
})

// ── Template set info ─────────────────────────────────────────────────────────────
function refreshTemplateSetInfo() {
  const filtered = getFilteredTemplates()
  const byName = {}
  for (const t of filtered) byName[t.name] = (byName[t.name] || 0) + 1
  const names = Object.keys(byName)
  const weights = rulesData?.recognition?.sampleWeights ?? {}
  const wInfo = Object.keys(weights).length
    ? ` · weights: ${Object.entries(weights).map(([k, v]) => `${k}=${v}`).join(', ')}`
    : ''
  const confMinPct = rulesData?.recognition?.confidenceMinPct ?? '?'
  document.getElementById('templateSetInfo').textContent =
    `${filtered.length} template(s) for ${names.length} symbol(s)${wInfo} · confidenceMinPct=${confMinPct}%`
}

// ── Init ──────────────────────────────────────────────────────────────────────────
loadData()
redraw()
