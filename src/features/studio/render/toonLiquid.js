// toonLiquid.js — cel-shaded "anime liquid" renderer (PoC).
// PURE MODULE — no JSON / DOM-global imports; draws onto a passed 2D context.
//
// Turns a cloud of particles into the Witch-Hat-Atelier ink look: a gooey metaball SILHOUETTE
// (filled marching squares over a scalar field), a flat 2-tone FILL, a thick black OUTLINE
// (the iso-contour stroked), and sparse white HIGHLIGHT blobs. Reuses the element's existing
// particle simulation — only the draw stage changes (see waterEffect.js `style: 'toon'`).
//
// Field model (metaballs): f(p) = Σ rᵢ² / (|p−cᵢ|² + ε). A lone blob crosses threshold 1.0 at
// |p−c| = rᵢ, so threshold≈1 gives a silhouette ~the blob radius; nearby blobs fuse where their
// fields add. A higher inner threshold contracts the silhouette → the lighter 2nd tone.

const MAX_CELLS = 240000 // grid-size safety cap; cell size grows if a spread-out cloud exceeds it

/**
 * drawToonLiquid(ctx, blobs, opts)
 *   blobs : [{ x, y, r, hl? }]  screen-space centres + radii (+ optional highlight flag)
 *   opts  : {
 *     cell, threshold, innerThreshold, influence,
 *     baseColor, innerColor, outlineColor, outlineWidth, highlightColor,
 *   }
 */
export function drawToonLiquid(ctx, blobs, opts = {}) {
  if (!blobs || blobs.length === 0) return

  const influence = opts.influence ?? 2.4
  const T = opts.threshold ?? 0.95
  const T2 = opts.innerThreshold ?? 2.6
  const eps = 1e-3

  const cw = ctx.canvas.width
  const ch = ctx.canvas.height

  // Bounding box of the cloud (clamped near the canvas so a stray far particle can't blow up the grid).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const b of blobs) {
    const m = b.r * influence
    if (b.x - m < minX) minX = b.x - m
    if (b.y - m < minY) minY = b.y - m
    if (b.x + m > maxX) maxX = b.x + m
    if (b.y + m > maxY) maxY = b.y + m
  }
  const pad = 80
  minX = Math.max(minX, -pad); minY = Math.max(minY, -pad)
  maxX = Math.min(maxX, cw + pad); maxY = Math.min(maxY, ch + pad)
  if (!(maxX > minX) || !(maxY > minY)) return

  // Pick a cell size; grow it if the cloud is so spread out the grid would be huge.
  let cell = Math.max(5, opts.cell ?? 9)
  let cols, rows
  for (;;) {
    cols = Math.ceil((maxX - minX) / cell) + 1
    rows = Math.ceil((maxY - minY) / cell) + 1
    if (cols * rows <= MAX_CELLS || cell > 64) break
    cell *= 1.4
  }
  const ox = minX, oy = minY
  const gw = cols + 1, gh = rows + 1
  const field = new Float32Array(gw * gh)

  // Accumulate each blob's field into the grid points within its influence box (local → cheap).
  for (const b of blobs) {
    const r2 = b.r * b.r
    const m = b.r * influence
    const c0 = Math.max(0, Math.floor((b.x - m - ox) / cell))
    const c1 = Math.min(gw - 1, Math.ceil((b.x + m - ox) / cell))
    const r0 = Math.max(0, Math.floor((b.y - m - oy) / cell))
    const r1 = Math.min(gh - 1, Math.ceil((b.y + m - oy) / cell))
    for (let gy = r0; gy <= r1; gy++) {
      const dy = oy + gy * cell - b.y
      const row = gy * gw
      for (let gx = c0; gx <= c1; gx++) {
        const dx = ox + gx * cell - b.x
        field[row + gx] += r2 / (dx * dx + dy * dy + eps)
      }
    }
  }

  // Filled marching squares at `threshold` → { fill: Path2D (silhouette), segs: contour line list }.
  // Per cell we walk the 4 corners clockwise (TL,TR,BR,BL): inside corners + edge crossings build the
  // inside polygon; crossings paired in order give the iso-contour segments (the outline).
  function build(threshold) {
    const fill = new Path2D()
    const segs = []
    const cx = [0, cell, cell, 0]
    const cy = [0, 0, cell, cell]
    const cf = [0, 0, 0, 0]
    for (let gy = 0; gy < rows; gy++) {
      const y = oy + gy * cell
      const base0 = gy * gw
      const base1 = base0 + gw
      for (let gx = 0; gx < cols; gx++) {
        const f00 = field[base0 + gx], f10 = field[base0 + gx + 1]
        const f11 = field[base1 + gx + 1], f01 = field[base1 + gx]
        // skip empty cells fast
        if (f00 < threshold && f10 < threshold && f11 < threshold && f01 < threshold) continue
        const x = ox + gx * cell
        cf[0] = f00; cf[1] = f10; cf[2] = f11; cf[3] = f01
        const poly = []
        const cross = []
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) & 3
          const inA = cf[k] >= threshold
          const inB = cf[k2] >= threshold
          if (inA) poly.push(x + cx[k], y + cy[k])
          if (inA !== inB) {
            const t = (threshold - cf[k]) / (cf[k2] - cf[k])
            const ix = x + cx[k] + (cx[k2] - cx[k]) * t
            const iy = y + cy[k] + (cy[k2] - cy[k]) * t
            poly.push(ix, iy)
            cross.push(ix, iy)
          }
        }
        if (poly.length >= 6) {
          fill.moveTo(poly[0], poly[1])
          for (let p = 2; p < poly.length; p += 2) fill.lineTo(poly[p], poly[p + 1])
          fill.closePath()
        }
        for (let c = 0; c + 3 < cross.length; c += 4) {
          segs.push(cross[c], cross[c + 1], cross[c + 2], cross[c + 3])
        }
      }
    }
    return { fill, segs }
  }

  const outer = build(T)

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'

  // 1) flat base fill
  ctx.fillStyle = opts.baseColor ?? '#2f8fd6'
  ctx.fill(outer.fill)

  // 2) inner lighter tone (contracted silhouette) → the 2-tone cel look
  if (opts.innerColor) {
    const inner = build(T2)
    ctx.fillStyle = opts.innerColor
    ctx.fill(inner.fill)
  }

  // 3) black ink outline — stroke the iso-contour segments (round caps connect them seamlessly)
  if (opts.outlineColor !== null) {
    ctx.strokeStyle = opts.outlineColor ?? '#0a2238'
    ctx.lineWidth = opts.outlineWidth ?? 3
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    const s = outer.segs
    for (let k = 0; k < s.length; k += 4) {
      ctx.moveTo(s[k], s[k + 1])
      ctx.lineTo(s[k + 2], s[k + 3])
    }
    ctx.stroke()
  }

  // 4) sparse flat white highlights (the "shine"); caller flags which blobs carry one
  if (opts.highlightColor !== null) {
    ctx.fillStyle = opts.highlightColor ?? 'rgba(236, 248, 255, 0.92)'
    for (const b of blobs) {
      if (!b.hl) continue
      const hr = b.r * 0.34
      ctx.beginPath()
      ctx.ellipse(b.x - b.r * 0.22, b.y - b.r * 0.28, hr * 1.25, hr * 0.7, -0.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}
