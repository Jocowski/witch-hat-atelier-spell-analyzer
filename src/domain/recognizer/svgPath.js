// svgPath.js — pure SVG path-data transforms, the browser twin of the math in
// tools/vectorize-{sigils,signs}.cjs. Used by the Admin "Trace image → SVG" tool to normalise a
// freshly traced path into the engine's `viewBox="-50 -50 100 100"` convention (centered on the
// origin, fit within ±42) so the result can be pasted straight into sigils.json / signs.json.
//
// PURE: operates on absolute-coordinate path 'd' strings (M/L/C/S/Q/T/Z, as emitted by potrace and
// ImageTracer). Kept JSON/DOM-free so it stays trivially testable under node --test.

const FIT_HALF = 42

const tokens = (d) => d.match(/[A-Za-z]|-?\d*\.?\d+/g) || []
const clean = (s) => s.replace(/([A-Za-z]) /g, '$1')

// Translate every coordinate pair by (dx, dy).
export function translate(d, dx, dy) {
  const toks = tokens(d)
  const out = []
  let cmd = '', idx = 0
  for (const t of toks) {
    if (/[A-Za-z]/.test(t)) { cmd = t; idx = 0; out.push(t); continue }
    if (/[MLCSQT]/.test(cmd)) { out.push((parseFloat(t) - (idx % 2 === 0 ? dx : dy)).toFixed(2)); idx++ }
    else out.push(t)
  }
  return clean(out.join(' '))
}

// Uniformly scale every coordinate by k.
export function scale(d, k) {
  const toks = tokens(d)
  const out = []
  let cmd = ''
  for (const t of toks) {
    if (/[A-Za-z]/.test(t)) { cmd = t; out.push(t); continue }
    if (/[MLCSQT]/.test(cmd)) out.push((parseFloat(t) * k).toFixed(2))
    else out.push(t)
  }
  return clean(out.join(' '))
}

// Rotate coordinates about the origin by `deg` degrees (clockwise on screen, y-down).
export function rotate(d, deg) {
  const r = (deg * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r)
  const toks = tokens(d)
  const out = []
  let cmd = '', buf = []
  const flush = () => {
    for (let k = 0; k + 1 < buf.length; k += 2) {
      const x = buf[k], y = buf[k + 1]
      out.push((x * cos - y * sin).toFixed(2), (x * sin + y * cos).toFixed(2))
    }
    buf = []
  }
  for (const t of toks) {
    if (/[A-Za-z]/.test(t)) { flush(); cmd = t; out.push(t); continue }
    if (/[MLCSQT]/.test(cmd)) buf.push(parseFloat(t))
    else out.push(t)
  }
  flush()
  return clean(out.join(' '))
}

// Bounding-box center of a path (sampling cubic béziers like the vectorizer does).
export function bboxCenter(d) {
  const { a, b, c, e } = bboxBounds(d)
  return { cx: (a + c) / 2, cy: (b + e) / 2 }
}

function bboxBounds(d) {
  const t = tokens(d)
  let i = 0, x = 0, y = 0, cmd = '', a = 1e9, b = 1e9, c = -1e9, e = -1e9
  const num = () => parseFloat(t[i++])
  const hit = (px, py) => { a = Math.min(a, px); b = Math.min(b, py); c = Math.max(c, px); e = Math.max(e, py) }
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++]
    const C = cmd.toUpperCase()
    if (C === 'M' || C === 'L') { x = num(); y = num(); hit(x, y); cmd = C === 'M' ? 'L' : cmd }
    else if (C === 'C') {
      const a1 = num(), b1 = num(), c1 = num(), e1 = num(), f = num(), g = num()
      for (let k = 1; k <= 12; k++) { const u = k / 12, m = 1 - u; hit(m*m*m*x + 3*m*m*u*a1 + 3*m*u*u*c1 + u*u*u*f, m*m*m*y + 3*m*m*u*b1 + 3*m*u*u*e1 + u*u*u*g) }
      x = f; y = g
    } else if (C === 'Z') { /* */ }
    else num()
  }
  return { a, b, c, e }
}

// Largest half-extent of a path already centered on the origin.
export function maxHalfExtent(d) {
  const t = tokens(d)
  let i = 0, x = 0, y = 0, cmd = '', m = 0
  const num = () => parseFloat(t[i++])
  const hit = (px, py) => { m = Math.max(m, Math.abs(px), Math.abs(py)) }
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++]
    const C = cmd.toUpperCase()
    if (C === 'M' || C === 'L') { x = num(); y = num(); hit(x, y); cmd = C === 'M' ? 'L' : cmd }
    else if (C === 'C') {
      const a1 = num(), b1 = num(), c1 = num(), e1 = num(), f = num(), g = num()
      for (let k = 1; k <= 12; k++) { const u = k / 12, mm = 1 - u; hit(mm*mm*mm*x + 3*mm*mm*u*a1 + 3*mm*u*u*c1 + u*u*u*f, mm*mm*mm*y + 3*mm*mm*u*b1 + 3*mm*u*u*e1 + u*u*u*g) }
      x = f; y = g
    } else if (C === 'Z') { /* */ }
    else num()
  }
  return m
}

// Recenter on the bbox, optionally rotate, then shrink to fit within ±FIT_HALF of the viewBox.
// Mirrors recenterAndFit() in the Node vectorizer so the tool's output matches the build pipeline.
export function recenterAndFit(d, deg = 0) {
  const { cx, cy } = bboxCenter(d)
  let out = translate(d, cx, cy)
  if (deg) out = rotate(out, deg)
  const half = maxHalfExtent(out)
  if (half > FIT_HALF) out = scale(out, FIT_HALF / half)
  return out
}
