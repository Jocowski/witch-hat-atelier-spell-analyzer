// spellEffectLab.js — Spell Effect Lab shell.
//
// Builds a synthetic SpellIR object from live sliders and displays it as a live-updating
// JSON block. Canvas rendering is a PLACEHOLDER — this shell is forward-compatible with the
// SpellIR shape from docs/app/SPEC-spell-ir.md; once the visual renderer lands, wire it here.
//
// TODO: wire to src/studio/render/effects/* once SPEC-visual-renderer lands.
//   import { SpellEffectRenderer } from '../src/studio/effects/SpellEffectRenderer.js'
//   import { buildSpellIR } from '../src/studio/effects/effectUtils.js'
//
// The "Paste wha-spell@1 JSON" path imports the REAL analyze() so parameters are deduced
// by the same engine the Studio uses.

import { analyze } from '../src/engine/analyze.js'

// ── State ─────────────────────────────────────────────────────────────────────────
let elements = [] // from grammar.json.elements
let currentElement = ''
let animHandle = null

// SpellIR parameter controls — shape mirrors SPEC-spell-ir.md §1.2 + §1.5.
// Each entry: { id, label, min, max, step, default, desc }
const SLIDER_DEFS = [
  { id: 'force',             label: 'force',             min: 0,    max: 1,    step: 0.01, default: 0.5,  desc: 'Overall intensity / push (0–1)' },
  { id: 'spread',            label: 'spread',            min: 0,    max: 1,    step: 0.01, default: 0.4,  desc: 'Lateral emission width (0=beam, 1=radial burst)' },
  { id: 'focus',             label: 'focus',             min: 0,    max: 1,    step: 0.01, default: 0.6,  desc: 'Tightness / concentration (tends to be 1−spread)' },
  { id: 'range',             label: 'range',             min: 0,    max: 1,    step: 0.01, default: 0.5,  desc: 'Travel distance / reach (0–1)' },
  { id: 'duration',          label: 'duration (s)',      min: 0.5,  max: 10,   step: 0.1,  default: 3.0,  desc: 'Active lifetime in seconds' },
  { id: 'stability',         label: 'stability',         min: 0,    max: 1,    step: 0.01, default: 0.7,  desc: 'Resistance to failure; derived from symmetry' },
  { id: 'gravity',           label: 'gravity',           min: 0,    max: 1,    step: 0.01, default: 1.0,  desc: '0=fully suspended/floating, 1=normal gravity' },
  { id: 'dirX',              label: 'direction X',       min: -1,   max: 1,    step: 0.01, default: 0,    desc: 'Paper-surface rightward component (−1..1)' },
  { id: 'dirY',              label: 'direction Y',       min: -1,   max: 1,    step: 0.01, default: 0,    desc: 'Paper-surface downward component (−1..1)' },
  { id: 'tiltFromZDeg',      label: 'tilt from Z (°)',   min: 0,    max: 90,   step: 0.5,  default: 0,    desc: 'Total tilt from paper normal (0=straight out)' },
  { id: 'dirCoherence',      label: 'dir coherence',     min: 0,    max: 1,    step: 0.01, default: 0,    desc: 'How aligned the directional signs are (0=cancel)' },
  { id: 'convergence',       label: 'convergence',       min: 0,    max: 1,    step: 0.01, default: 0,    desc: 'Stream-narrowing behaviour (future renderer param)' },
  { id: 'convergenceRadius', label: 'convergenceRadius', min: 0.03, max: 0.35, step: 0.01, default: 0.15, desc: 'Convergence cone radius (future renderer param)' },
  { id: 'ringRadius',        label: 'ring radius',       min: 0.2,  max: 0.46, step: 0.005,default: 0.35, desc: 'Synthetic ring size / portal scale (normalized)' },
]

const sliderValues = {}
for (const d of SLIDER_DEFS) sliderValues[d.id] = d.default

// ── Data loading ──────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const resp = await fetch('/data/grammar.json')
    const grammar = await resp.json()
    elements = Object.keys(grammar.elements ?? {})
    populateElementSelect()
  } catch (e) {
    console.warn('[effectLab] Could not load grammar.json:', e)
    elements = ['fire', 'water', 'earth', 'air', 'time']
    populateElementSelect()
  }
}

function populateElementSelect() {
  const sel = document.getElementById('elementSelect')
  sel.innerHTML = ''
  for (const el of elements) {
    const opt = document.createElement('option')
    opt.value = el; opt.textContent = el
    sel.appendChild(opt)
  }
  if (elements.length) { currentElement = elements[0]; sel.value = currentElement }
}

document.getElementById('elementSelect').addEventListener('change', (e) => {
  currentElement = e.target.value
  restartAnimation()
})

// ── Slider rendering ──────────────────────────────────────────────────────────────
function buildSliders() {
  const block = document.getElementById('sliderBlock')
  block.innerHTML = ''
  for (const d of SLIDER_DEFS) {
    const row = document.createElement('div')
    row.className = 'slider-row'

    const lbl = document.createElement('label')
    lbl.textContent = d.label
    lbl.htmlFor = `sl_${d.id}`

    const input = document.createElement('input')
    input.type = 'range'
    input.id = `sl_${d.id}`
    input.min = d.min; input.max = d.max; input.step = d.step; input.value = d.default

    const valSpan = document.createElement('span')
    valSpan.className = 'val'
    valSpan.id = `sv_${d.id}`
    valSpan.textContent = d.default

    const descSpan = document.createElement('span')
    descSpan.className = 'desc'
    descSpan.textContent = d.desc

    input.addEventListener('input', () => {
      const v = parseFloat(input.value)
      sliderValues[d.id] = v
      valSpan.textContent = v
      updateIRDisplay()
    })

    row.appendChild(lbl)
    row.appendChild(input)
    row.appendChild(valSpan)
    row.appendChild(descSpan)
    block.appendChild(row)
  }
}

// ── SpellIR assembly from slider values ─────────────────────────────────────────
// Mirrors SPEC-spell-ir.md §1.2 + §1.5 field shape.
function buildIRFromSliders() {
  const v = sliderValues
  // Derive z from tiltFromZDeg
  const tiltRad = (v.tiltFromZDeg * Math.PI) / 180
  const surfaceMag = Math.hypot(v.dirX, v.dirY)
  let x = 0, y = 0, z = 1, xTiltDeg = 0, yTiltDeg = 0
  if (surfaceMag > 0.001 && v.tiltFromZDeg > 0) {
    const surfaceScale = Math.sin(tiltRad) / surfaceMag
    x = v.dirX * surfaceScale
    y = v.dirY * surfaceScale
    z = Math.cos(tiltRad)
    xTiltDeg = (Math.atan2(x, z) * 180) / Math.PI
    yTiltDeg = (Math.atan2(y, z) * 180) / Math.PI
  }

  return {
    element: currentElement,
    force:       v.force,
    spread:      v.spread,
    focus:       v.focus,
    range:       v.range,
    duration:    v.duration,
    stability:   v.stability,
    gravity:     v.gravity,
    dirCoherence: v.dirCoherence,
    direction: { x, y, z, xTiltDeg, yTiltDeg, tiltFromZDeg: v.tiltFromZDeg },
    // Extra renderer params (future SpellEffectRenderer interface):
    convergence:       v.convergence,
    convergenceRadius: v.convergenceRadius,
    ringRadius:        v.ringRadius,
  }
}

function updateIRDisplay() {
  const ir = buildIRFromSliders()
  document.getElementById('irBlock').textContent = JSON.stringify(ir, null, 2)
  drawPlaceholder(ir)
  // TODO: when SpellEffectRenderer exists:
  //   renderer.update(ir)
}

// ── Canvas placeholder ─────────────────────────────────────────────────────────────
const underlayCtx = document.getElementById('underlayCanvas').getContext('2d')
const effectCtx = document.getElementById('effectCanvas').getContext('2d')
const CW = 520, CH = 520

function drawPlaceholder(ir) {
  const ucx = underlayCtx, ecx = effectCtx
  ucx.clearRect(0, 0, CW, CH)
  ecx.clearRect(0, 0, CW, CH)

  const cx = CW / 2, cy = CH / 2
  const ringR = ir.ringRadius * CW

  // Underlay: synthetic glyph guide ring
  ucx.save()
  ucx.strokeStyle = '#3a2a60'
  ucx.lineWidth = 2
  ucx.setLineDash([6, 4])
  ucx.beginPath(); ucx.arc(cx, cy, ringR, 0, Math.PI * 2); ucx.stroke()
  ucx.setLineDash([])
  // Center sigil placeholder
  ucx.strokeStyle = '#4a3a70'
  ucx.lineWidth = 1.5
  ucx.beginPath(); ucx.arc(cx, cy, 16, 0, Math.PI * 2); ucx.stroke()
  ucx.beginPath(); ucx.moveTo(cx - 10, cy); ucx.lineTo(cx + 10, cy); ucx.stroke()
  ucx.beginPath(); ucx.moveTo(cx, cy - 10); ucx.lineTo(cx, cy + 10); ucx.stroke()
  ucx.restore()

  // Effect placeholder: direction arrow + force circle
  ecx.save()
  // Force circle
  const forceR = 10 + ir.force * 60
  const elementColors = {
    fire: '#f08030', water: '#3090f0', earth: '#806030', air: '#90c0e0',
    time: '#c090f0', light: '#f8f060', default: '#a080f0',
  }
  const col = elementColors[ir.element] ?? elementColors.default
  ecx.strokeStyle = col
  ecx.globalAlpha = 0.5 + ir.stability * 0.3
  ecx.lineWidth = 2
  ecx.beginPath(); ecx.arc(cx, cy, forceR, 0, Math.PI * 2 * ir.spread); ecx.stroke()

  // Direction arrow
  if (ir.dirCoherence > 0.1 || Math.abs(ir.direction.x) > 0.05 || Math.abs(ir.direction.y) > 0.05) {
    const ax = ir.direction.x, ay = ir.direction.y
    const len = 50 + ir.range * 80
    const ex = cx + ax * len, ey = cy + ay * len
    ecx.strokeStyle = col
    ecx.globalAlpha = 0.7
    ecx.lineWidth = 2
    ecx.beginPath(); ecx.moveTo(cx, cy); ecx.lineTo(ex, ey); ecx.stroke()
    // Arrowhead
    const angle = Math.atan2(ey - cy, ex - cx)
    const hw = 8
    ecx.beginPath()
    ecx.moveTo(ex, ey)
    ecx.lineTo(ex - hw * Math.cos(angle - 0.4), ey - hw * Math.sin(angle - 0.4))
    ecx.lineTo(ex - hw * Math.cos(angle + 0.4), ey - hw * Math.sin(angle + 0.4))
    ecx.closePath(); ecx.fillStyle = col; ecx.fill()
  }

  // Placeholder text
  ecx.globalAlpha = 0.3
  ecx.fillStyle = '#8060a0'
  ecx.font = '11px system-ui'
  ecx.fillText('[ renderer placeholder — SPEC-visual-renderer ]', 10, CH - 14)
  ecx.restore()
}

// ── Animation loop placeholder ────────────────────────────────────────────────────
// TODO: replace with renderer.start(ir) / renderer.stop() once SpellEffectRenderer exists.
function restartAnimation() {
  if (animHandle) cancelAnimationFrame(animHandle)
  let t = 0
  function frame() {
    t += 0.02
    const ir = buildIRFromSliders()
    // Minimal animation: pulse the force ring opacity with time
    effectCtx.clearRect(0, 0, CW, CH)
    const pulse = 0.6 + 0.4 * Math.sin(t * (1 + ir.force))
    effectCtx.globalAlpha = pulse
    drawPlaceholder(ir)
    effectCtx.globalAlpha = 1
    animHandle = requestAnimationFrame(frame)
  }
  animHandle = requestAnimationFrame(frame)
}

// ── Paste wha-spell@1 path ────────────────────────────────────────────────────────
document.getElementById('btnApplySpell').addEventListener('click', async () => {
  const raw = document.getElementById('spellJsonInput').value.trim()
  if (!raw) return
  let composition
  try { composition = JSON.parse(raw) } catch { console.error('[effectLab] Invalid JSON'); return }

  try {
    const result = analyze(composition)
    applyAnalysisToSliders(result)
    updateIRDisplay()
  } catch (e) {
    console.error('[effectLab] analyze() failed:', e)
  }
})

// Map analyze() output to slider values — uses the same fields the future assembleSpellIR will
// expose (SPEC-spell-ir.md §1.2). Until SpellIR is wired, we do a best-effort mapping from the
// existing analysis fields.
function applyAnalysisToSliders(result) {
  const a = result.analysis ?? {}
  // Power → force
  const power = typeof a.power === 'number' ? Math.min(a.power, 1) : 0.5
  setSlider('force', 0.34 + power * 0.24)

  // Symmetry → stability
  const stabMap = { radial: 1.0, bilateral: 0.7, asymmetric: 0.3, none: 0.5 }
  setSlider('stability', stabMap[a.symmetry] ?? 0.5)

  // Sign count → spread (more signs in ring = broader effect)
  const signCount = typeof a.signCount === 'number' ? a.signCount : 0
  setSlider('spread', Math.min(0.32 + signCount * 0.07, 1))
  setSlider('focus', Math.max(0.46 - signCount * 0.04, 0))

  // Direction from aim
  if (a.aim && typeof a.aim.angle === 'number') {
    const ang = (a.aim.angle * Math.PI) / 180
    setSlider('dirX', Math.sin(ang) * (a.aim.magnitude ?? 0))
    setSlider('dirY', -Math.cos(ang) * (a.aim.magnitude ?? 0))
    setSlider('dirCoherence', a.aim.magnitude ?? 0)
    setSlider('tiltFromZDeg', Math.min((a.aim.magnitude ?? 0) * 76, 76))
  }

  // Element from deduction
  const deduced = result.deduction?.element ?? result.deduction?.substance ?? ''
  if (deduced && elements.includes(deduced)) {
    currentElement = deduced
    document.getElementById('elementSelect').value = deduced
  }
}

function setSlider(id, value) {
  const def = SLIDER_DEFS.find((d) => d.id === id)
  if (!def) return
  const clamped = Math.min(Math.max(value, def.min), def.max)
  sliderValues[id] = clamped
  const input = document.getElementById(`sl_${id}`)
  const valSpan = document.getElementById(`sv_${id}`)
  if (input) { input.value = clamped; valSpan.textContent = parseFloat(clamped.toFixed(3)) }
}

// ── Copy current IR ───────────────────────────────────────────────────────────────
document.getElementById('btnCopyIR').addEventListener('click', async () => {
  const txt = document.getElementById('irBlock').textContent
  try { await navigator.clipboard.writeText(txt) } catch { console.warn('Copy failed') }
})

// ── Reset ─────────────────────────────────────────────────────────────────────────
document.getElementById('btnReset').addEventListener('click', () => {
  for (const d of SLIDER_DEFS) setSlider(d.id, d.default)
  updateIRDisplay()
  restartAnimation()
})

// ── Init ──────────────────────────────────────────────────────────────────────────
buildSliders()
loadData().then(() => {
  updateIRDisplay()
  restartAnimation()
})
