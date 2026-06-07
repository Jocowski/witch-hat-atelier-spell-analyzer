// imageTrace.js — browser raster→SVG tracing for the Admin "Trace image → SVG" tool.
//
// Wraps imagetracerjs (public-domain, pure-JS) to turn an uploaded image or a drawn symbol into a
// monochrome SVG path, then normalises that path into the engine's `viewBox="-50 -50 100 100"`
// convention via svgPath.recenterAndFit — the same math the Node vectorizer applies. The output is a
// ready-to-paste `svgPath` 'd' string (+ the raw multi-path SVG for download).
//
// DOM-bound (canvas + DOMParser), so it lives outside the pure recognizer/engine modules.

import ImageTracer from 'imagetracerjs'
import { recenterAndFit, bboxCenter, translate } from '#domain/recognizer/svgPath.js'

const WORK_SIZE = 256 // working raster size; symbol is fit to ~80% of this, centered

// Draw `source` (an HTMLImageElement) onto a white WORK_SIZE canvas, fit + centered with padding.
export function rasterizeImage(img, size = WORK_SIZE, pad = 0.1) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size, size)
  const inner = size * (1 - 2 * pad)
  const s = Math.min(inner / img.naturalWidth, inner / img.naturalHeight)
  const w = img.naturalWidth * s, h = img.naturalHeight * s
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
  return cv
}

// Rasterize recognizer/DrawingSurface strokes ([{points:[{x,y}]}]) onto a white canvas: black
// polylines, fit + centered. Gives clean control over background/contrast vs. an exported PNG.
export function rasterizeStrokes(strokes, size = WORK_SIZE, pad = 0.12, lineWidth = 6) {
  const pts = (strokes || []).flatMap((s) => s.points || s || [])
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size, size)
  if (pts.length < 2) return cv

  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const p of pts) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y) }
  const bw = c - a || 1, bh = d - b || 1
  const inner = size * (1 - 2 * pad)
  const s = Math.min(inner / bw, inner / bh)
  const ox = (size - bw * s) / 2 - a * s
  const oy = (size - bh * s) / 2 - b * s
  const tx = (p) => ({ x: p.x * s + ox, y: p.y * s + oy })

  ctx.strokeStyle = '#000'
  ctx.lineWidth = lineWidth
  ctx.lineJoin = ctx.lineCap = 'round'
  for (const stroke of strokes || []) {
    const sp = stroke.points || stroke || []
    if (sp.length < 2) continue
    ctx.beginPath()
    sp.forEach((p, i) => { const q = tx(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y) })
    ctx.stroke()
  }
  return cv
}

// Binarize ImageData in place to pure black/white using a 0..255 luminance threshold.
function binarize(imgd, threshold) {
  const d = imgd.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const v = lum < threshold ? 0 : 255
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  return imgd
}

const BLACK = { r: 0, g: 0, b: 0, a: 255 }
const WHITE = { r: 255, g: 255, b: 255, a: 255 }

// Trace a canvas → { rawSvg, combinedD, normalizedD }.
//   opts: { threshold=128, turdSize=8, simplify=1, fit=true }
export function traceCanvas(canvas, opts = {}) {
  const threshold = opts.threshold ?? 128
  const turdSize = opts.turdSize ?? 8
  const simplify = opts.simplify ?? 1
  const fit = opts.fit !== false

  const ctx = canvas.getContext('2d')
  const imgd = ctx.getImageData(0, 0, canvas.width, canvas.height)
  binarize(imgd, threshold)

  const rawSvg = ImageTracer.imagedataToSVG(imgd, {
    pal: [BLACK, WHITE],
    colorsampling: 0,
    pathomit: turdSize,
    ltres: simplify,
    qtres: simplify,
    rightangleenhance: false,
    roundcoords: 2,
    scale: 1,
    linefilter: true,
    strokewidth: 0,
  })

  const combinedD = extractDarkPathD(rawSvg)
  let normalizedD = ''
  if (combinedD) {
    // The traced path lives in 0..WORK_SIZE space; recenter on its bbox and (optionally) fit to ±42,
    // matching the engine's centered viewBox so it drops straight into sigils.json / signs.json.
    normalizedD = fit ? recenterAndFit(combinedD) : recenterOnly(combinedD)
  }
  return { rawSvg, combinedD, normalizedD }
}

// Pull the dark (symbol) sub-paths out of an ImageTracer SVG and concatenate their `d` data.
// ImageTracer emits one <path fill="rgb(r,g,b)"> per color region; we drop the white background.
function extractDarkPathD(svgStr) {
  const doc = new DOMParser().parseFromString(svgStr, 'image/svg+xml')
  const paths = [...doc.querySelectorAll('path')]
  const ds = []
  for (const p of paths) {
    const fill = p.getAttribute('fill') || ''
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/i.exec(fill)
    const lum = m ? 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3] : 0
    if (lum < 128) { const d = p.getAttribute('d'); if (d) ds.push(d.trim()) }
  }
  return ds.join(' ')
}

// Recenter a path on its bbox without scaling (bbox math lives in svgPath).
function recenterOnly(d) {
  const { cx, cy } = bboxCenter(d)
  return translate(d, cx, cy)
}
