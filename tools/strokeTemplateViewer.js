// strokeTemplateViewer.js — paste a template JSON → visualize reconstructed strokes + metrics.
// Calls makeCloud() from the REAL recognizer.js so the normalization shown here is identical
// to what the recognizer uses at runtime.

import { makeCloud } from '../src/draw/recognizer.js'

const canvas = document.getElementById('viewCanvas')
const ctx = canvas.getContext('2d')
const W = canvas.width
const H = canvas.height

// ── Parse ─────────────────────────────────────────────────────────────────────────
function parseInput(raw) {
  let obj
  try { obj = JSON.parse(raw) } catch { return { error: 'Invalid JSON' } }

  // Accept: { name, role, points } or a training_samples row { symbol_id, points, ... }
  let name = obj.name ?? obj.symbol_id ?? '?'
  let role = obj.role ?? 'unknown'
  let points = obj.points

  if (!Array.isArray(points) || points.length === 0) return { error: 'No "points" array found' }
  // Validate point shape
  if (!Object.prototype.hasOwnProperty.call(points[0], 'X')) return { error: 'Points must have {X,Y,ID} shape' }
  return { name, role, points }
}

// ── Reconstruct strokes from ID field ────────────────────────────────────────────
function reconstructStrokes(points) {
  const byId = {}
  for (const p of points) {
    const id = p.ID ?? 0
    if (!byId[id]) byId[id] = []
    byId[id].push(p)
  }
  return Object.values(byId)
}

// ── Render ────────────────────────────────────────────────────────────────────────
function render(parsed) {
  ctx.clearRect(0, 0, W, H)
  if (parsed.error) {
    ctx.fillStyle = '#cc6a6a'
    ctx.font = '14px system-ui'
    ctx.fillText(parsed.error, 20, 40)
    return
  }

  const { name, role, points } = parsed

  // Run through makeCloud to get normalized points (same path as recognizer).
  const cloud = makeCloud(name, points)
  const npts = cloud.points // [{X,Y,ID}] in the normalized [-0.5..0.5] range (after scale+center)

  // Map normalized coordinates to canvas space.
  // After scaleToSquare + translateToOrigin, X/Y are near [-0.5, 0.5] (actually 0..1 pre-center, then ~-0.5..0.5)
  // We'll auto-fit by finding the bounding box.
  const xs = npts.map((p) => p.X)
  const ys = npts.map((p) => p.Y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const pad = 60
  const scaleX = (W - pad * 2) / rangeX
  const scaleY = (H - pad * 2) / rangeY
  const sc = Math.min(scaleX, scaleY)
  const cx = W / 2 - ((minX + maxX) / 2) * sc
  const cy = H / 2 - ((minY + maxY) / 2) * sc
  const tx = (p) => ({ x: p.X * sc + cx, y: p.Y * sc + cy })

  // Bounding box overlay
  ctx.save()
  ctx.strokeStyle = '#3a2a08'
  ctx.setLineDash([5, 5])
  ctx.lineWidth = 1
  const bx1 = minX * sc + cx, by1 = minY * sc + cy
  const bw = rangeX * sc, bh = rangeY * sc
  ctx.strokeRect(bx1, by1, bw, bh)
  ctx.setLineDash([])
  ctx.restore()

  // Crosshairs at centroid (origin after normalization)
  ctx.save()
  ctx.strokeStyle = '#5a3a10'
  ctx.setLineDash([4, 4])
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // Strokes (grouped by ID — same as $P does internally)
  const strokes = reconstructStrokes(npts)
  const colors = ['#f5c842', '#60c0f0', '#a0e870', '#f09040', '#d060e0']
  ctx.save()
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  strokes.forEach((stroke, i) => {
    if (stroke.length < 2) return
    ctx.strokeStyle = colors[i % colors.length]
    ctx.beginPath()
    const s0 = tx(stroke[0])
    ctx.moveTo(s0.x, s0.y)
    for (let j = 1; j < stroke.length; j++) {
      const p = tx(stroke[j])
      ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
    // Start dot
    ctx.fillStyle = colors[i % colors.length]
    ctx.beginPath(); ctx.arc(s0.x, s0.y, 4, 0, Math.PI * 2); ctx.fill()
  })
  ctx.restore()

  // Label
  ctx.fillStyle = '#a08040'
  ctx.font = '12px system-ui'
  ctx.fillText(`${name} (${role})`, 10, H - 10)

  // Metrics
  const centX = npts.reduce((s, p) => s + p.X, 0) / npts.length
  const centY = npts.reduce((s, p) => s + p.Y, 0) / npts.length
  const ptsPerStroke = strokes.map((s, i) => `  stroke ${i}: ${s.length} pts`).join('\n')
  document.getElementById('metricsBlock').textContent = [
    `name:         ${name}`,
    `role:         ${role}`,
    `raw points:   ${points.length}`,
    `norm points:  ${npts.length} (NUM_POINTS=32)`,
    `strokes:      ${strokes.length}`,
    ptsPerStroke,
    `centroid X:   ${centX.toFixed(4)} (≈0 = centered)`,
    `centroid Y:   ${centY.toFixed(4)} (≈0 = centered)`,
    `bbox:         X [${minX.toFixed(3)}, ${maxX.toFixed(3)}]`,
    `              Y [${minY.toFixed(3)}, ${maxY.toFixed(3)}]`,
  ].join('\n')
}

// ── Button handlers ───────────────────────────────────────────────────────────────
document.getElementById('btnRender').addEventListener('click', () => {
  const raw = document.getElementById('templateInput').value.trim()
  if (!raw) { setStatus('Paste a template JSON first', 'error'); return }
  const parsed = parseInput(raw)
  render(parsed)
  setStatus(parsed.error ? parsed.error : 'Rendered', parsed.error ? 'error' : 'ok')
})

document.getElementById('btnClear').addEventListener('click', () => {
  ctx.clearRect(0, 0, W, H)
  document.getElementById('metricsBlock').textContent = '—'
  setStatus('Paste a template to begin')
})

function setStatus(text, type = '') {
  const pill = document.getElementById('statusPill')
  pill.textContent = text
  pill.className = 'pill' + (type ? ` ${type}` : '')
}

// ── Initial blank canvas ─────────────────────────────────────────────────────────
ctx.fillStyle = '#12080a'
ctx.fillRect(0, 0, W, H)
