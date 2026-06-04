// beautify.js — PURE stroke beautification (QuickShape-style snap + Streamline-style smooth).
// Turns a wobbly hand-drawn stroke into a clean shape (perfect circle, straight-edged
// triangle/rect/polygon, true line) when it confidently fits one — otherwise leaves the
// stroke alone (or optionally smooths it). See docs/app/SPEC-stroke-beautify.md.
//
// No JSON imports, no DOM, no React — runs under plain `node --test`. The clean-shape
// emitters are reused from shapes.js so there is one source of truth for shape geometry.
//
// Coordinate convention: same as shapes.js — plain {x,y} px in whatever space the caller
// passes (the Studio passes world coords). beautifyStroke is points → points.

import { line, ellipse as ellipseShape, circle as circleShape } from './shapes.js'

// ---------- tunables (all overridable via opts) ----------

const DEFAULTS = {
  minConfidence: 0.7, // below this, a detected shape is rejected (gate — mirrors recognition.confidenceMinPct)
  smoothFallback: false, // when no shape fits: true ⇒ Chaikin-smooth, false ⇒ return original untouched
  toleranceFrac: 0.04, // RDP epsilon as a fraction of the bbox diagonal (absorbs hand jitter, keeps dominant corners)
  closeFrac: 0.18, // closed if dist(first,last) < closeFrac * bbox diagonal
  circleResidNorm: 0.08, // mean radial residual / radius below which a closed loop reads as a circle/ellipse
  circleAspect: 0.82, // bbox min/max ratio above which a circular loop is a circle (else ellipse)
  minCircleSpanDeg: 200, // a stroke must wrap at least this far around to count as a circle/arc (vs a stray curve)
  gapPreserveDeg: 16, // angular gap at/above which a circular stroke stays an OPEN arc (preserves an intentional ring gap)
  residBand: 0.16, // residual/diag that maps to confidence 0 (residual 0 ⇒ confidence 1)
  chaikinIters: 2, // smoothing passes for the fallback
}

// ---------- small geometry helpers ----------

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) }

/** Strip NaN sentinels (arrow heads etc.) and obvious dupes; returns a fresh array. */
function clean(points) {
  const out = []
  for (const p of points || []) {
    if (!p || Number.isNaN(p.x) || Number.isNaN(p.y)) continue
    const last = out[out.length - 1]
    if (last && last.x === p.x && last.y === p.y) continue
    out.push({ x: p.x, y: p.y })
  }
  return out
}

/** Axis-aligned bbox + derived center/size/diagonal. */
function bbox(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const w = maxX - minX
  const h = maxY - minY
  return { minX, minY, maxX, maxY, w, h, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, diag: Math.hypot(w, h) }
}

/** Perpendicular distance from p to the infinite line through a→b (for RDP). */
function perpDist(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return dist(p, a)
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len
}

/** Distance from p to the segment a→b (for residual measurement). */
function segDist(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/** Mean distance of each point to the nearest segment of a polyline. */
function meanResidualToPolyline(points, poly) {
  if (poly.length < 2) return Infinity
  let sum = 0
  for (const p of points) {
    let best = Infinity
    for (let i = 0; i < poly.length - 1; i++) {
      const d = segDist(p, poly[i], poly[i + 1])
      if (d < best) best = d
    }
    sum += best
  }
  return sum / points.length
}

// ---------- self-intersection (figure-8 / complex strokes aren't simple primitives) ----------

/** Do segments p1→p2 and p3→p4 properly cross? (CCW orientation test; ignores collinear touch.) */
function segmentsCross(p1, p2, p3, p4) {
  const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x)
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
}

/**
 * Does the polyline cross itself? A circle/ellipse/triangle/rect is a *simple* (non-self-intersecting)
 * curve, so a self-intersection means the stroke is NOT one of those primitives (e.g. a figure-8 /
 * billow). Tested on the simplified corners, so it's cheap. `closed` adds the closing edge.
 */
export function selfIntersects(poly, closed = false) {
  const n = poly.length
  if (n < 4) return false
  const edges = []
  for (let i = 0; i < n - 1; i++) edges.push([poly[i], poly[i + 1]])
  if (closed && n > 2) edges.push([poly[n - 1], poly[0]])
  const m = edges.length
  for (let i = 0; i < m; i++) {
    for (let j = i + 2; j < m; j++) {
      if (i === 0 && j === m - 1 && (closed || poly[0] === poly[n - 1])) continue // adjacent at the wrap
      if (segmentsCross(edges[i][0], edges[i][1], edges[j][0], edges[j][1])) return true
    }
  }
  return false
}

// ---------- Ramer–Douglas–Peucker (inline; ref: simplify-js) ----------

/** Simplify a polyline, keeping points farther than eps from the running chord. */
export function rdp(points, eps) {
  if (points.length < 3) return points.slice()
  const keep = new Array(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [lo, hi] = stack.pop()
    let maxD = 0
    let idx = -1
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDist(points[i], points[lo], points[hi])
      if (d > maxD) { maxD = d; idx = i }
    }
    if (maxD > eps && idx !== -1) {
      keep[idx] = true
      stack.push([lo, idx], [idx, hi])
    }
  }
  return points.filter((_, i) => keep[i])
}

/** Drop corners whose turn angle is shallow (noise spikes), keeping genuine vertices. */
export function filterCornersByAngle(corners, closed, minTurnDeg = 25) {
  const n = corners.length
  if (n <= (closed ? 3 : 2)) return corners.slice()
  const minCos = Math.cos((minTurnDeg * Math.PI) / 180) // turn > minTurnDeg ⇒ cos(angle between dirs) < this
  const kept = []
  for (let i = 0; i < n; i++) {
    const isEnd = !closed && (i === 0 || i === n - 1)
    if (isEnd) { kept.push(corners[i]); continue }
    const prev = corners[(i - 1 + n) % n]
    const next = corners[(i + 1) % n]
    const ax = corners[i].x - prev.x, ay = corners[i].y - prev.y
    const bx = next.x - corners[i].x, by = next.y - corners[i].y
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by)
    if (la === 0 || lb === 0) continue
    const cos = (ax * bx + ay * by) / (la * lb) // 1 = straight, lower = sharper turn
    if (cos < minCos) kept.push(corners[i]) // keep only genuine (sharp-enough) vertices
  }
  return kept.length >= (closed ? 3 : 2) ? kept : corners.slice()
}

// ---------- Kåsa least-squares circle fit (inline; ref: circle-fit) ----------

/** Fit a circle to points → {cx,cy,r,residNorm} or null if degenerate (collinear). */
export function fitCircle(points) {
  const n = points.length
  if (n < 3) return null
  let Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, Sxz = 0, Syz = 0, Sz = 0
  for (const p of points) {
    const x = p.x, y = p.y, z = x * x + y * y
    Sx += x; Sy += y; Sxx += x * x; Syy += y * y; Sxy += x * y
    Sxz += x * z; Syz += y * z; Sz += z
  }
  // Solve [Sxx Sxy Sx; Sxy Syy Sy; Sx Sy n] · [A B C]ᵀ = [Sxz Syz Sz]ᵀ  (circle x²+y² = A x + B y + C)
  const m = [
    [Sxx, Sxy, Sx, Sxz],
    [Sxy, Syy, Sy, Syz],
    [Sx, Sy, n, Sz],
  ]
  const sol = solve3(m)
  if (!sol) return null
  const [A, B, C] = sol
  const cx = A / 2
  const cy = B / 2
  const r2 = C + cx * cx + cy * cy
  if (!(r2 > 0)) return null
  const r = Math.sqrt(r2)
  let resid = 0
  for (const p of points) resid += Math.abs(Math.hypot(p.x - cx, p.y - cy) - r)
  return { cx, cy, r, residNorm: resid / n / r }
}

/** Solve a 3×3 augmented system via Cramer's rule; null if singular. */
function solve3(m) {
  const det = (a) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
  const base = [
    [m[0][0], m[0][1], m[0][2]],
    [m[1][0], m[1][1], m[1][2]],
    [m[2][0], m[2][1], m[2][2]],
  ]
  const D = det(base)
  if (Math.abs(D) < 1e-9) return null
  const col = (k) => base.map((row, i) => row.map((v, j) => (j === k ? m[i][3] : v)))
  return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D]
}

// ---------- Chaikin corner-cutting smoother (Streamline-style fallback) ----------

/** One or more Chaikin passes; keeps endpoints, rounds the corners between them. */
export function chaikin(points, iters = 1) {
  let pts = points
  for (let k = 0; k < iters; k++) {
    if (pts.length < 3) break
    const out = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
    }
    out.push(pts[pts.length - 1])
    pts = out
  }
  return pts
}

// ---------- shape regenerators ----------

/** Resample straight edges through a set of corners (closed or open). */
function polylineThrough(corners, step, closed) {
  const verts = closed ? [...corners, corners[0]] : corners
  const out = []
  for (let i = 0; i < verts.length - 1; i++) {
    const seg = line(verts[i], verts[i + 1], step)
    // drop the duplicated joint between consecutive segments
    out.push(...(i === 0 ? seg : seg.slice(1)))
  }
  return out
}

/**
 * Angular coverage of a point set around a fitted circle center.
 * Returns { spanDeg, gapDeg, start, end } where [start,end] (radians, end ≥ start) is the
 * COVERED arc — i.e. the largest empty wedge (the drawn gap) is excluded.
 */
export function arcGeometry(points, fit) {
  const angs = points.map((p) => Math.atan2(p.y - fit.cy, p.x - fit.cx)).sort((a, b) => a - b)
  const n = angs.length
  let maxGap = -1
  let gapIdx = 0
  for (let i = 0; i < n; i++) {
    const next = i + 1 < n ? angs[i + 1] : angs[0] + 2 * Math.PI
    const g = next - angs[i]
    if (g > maxGap) { maxGap = g; gapIdx = i }
  }
  const start = angs[(gapIdx + 1) % n]
  let end = angs[gapIdx]
  if (end < start) end += 2 * Math.PI // wrap so the sweep skips the empty wedge
  const toDeg = 180 / Math.PI
  return { spanDeg: (end - start) * toDeg, gapDeg: maxGap * toDeg, start, end }
}

/** Clean circular arc points from a fitted circle over [start,end] radians. */
function arcPoints(fit, start, end, step) {
  const r = fit.r
  const segs = Math.max(8, Math.round((r * (end - start)) / step))
  const out = []
  for (let i = 0; i <= segs; i++) {
    const t = start + ((end - start) * i) / segs
    out.push({ x: fit.cx + r * Math.cos(t), y: fit.cy + r * Math.sin(t) })
  }
  return out
}

/** confidence from a residual: 1 at residual 0, 0 at residBand·diag. */
function confFrom(residual, diag, residBand) {
  if (diag === 0) return 0
  const c = 1 - residual / diag / residBand
  return c < 0 ? 0 : c > 1 ? 1 : c
}

// ---------- main entry ----------

/**
 * beautifyStroke(points, opts) → { points, kind, confidence }
 *
 *   points     : [{x,y}]   the regenerated clean stroke, OR the original when nothing fits
 *   kind       : 'circle' | 'arc' | 'ellipse' | 'triangle' | 'rect' | 'polygon' | 'line' | 'smoothed' | 'none'
 *                ('arc' = a circular stroke drawn with an intentional gap — an OPEN ring, kept open)
 *   confidence : 0..1      fit quality (1 for a clean match; 'smoothed'/'none' report 0)
 *
 * Pure: never mutates the input. Returns a new array on success; the same reference is fine
 * for the pass-through ('none') case but callers should treat the result as read-only.
 */
export function beautifyStroke(points, opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const pts = clean(points)

  // Guard: too few points or a degenerate (zero-size) stroke → leave it alone.
  if (pts.length < 4) return { points: points || [], kind: 'none', confidence: 0 }
  const bb = bbox(pts)
  if (bb.diag < 6) return { points: points || [], kind: 'none', confidence: 0 }

  const eps = Math.max(2, o.toleranceFrac * bb.diag)
  const closed = dist(pts[0], pts[pts.length - 1]) < o.closeFrac * bb.diag
  const step = Math.max(4, bb.diag / 50)

  // RDP corners. For a closed shape the last≈first, so the true vertex count drops the closer.
  let corners = rdp(pts, eps)
  if (closed && corners.length > 1 && dist(corners[0], corners[corners.length - 1]) < o.closeFrac * bb.diag) {
    corners = corners.slice(0, -1)
  }
  // Drop shallow noise corners so a jittery square stays a quad, not a pentagon.
  corners = filterCornersByAngle(corners, closed)
  const cornersN = corners.length

  const accept = (shape) => {
    const residual = meanResidualToPolyline(pts, shape.poly)
    const confidence = confFrom(residual, bb.diag, o.residBand)
    if (confidence < o.minConfidence) return null
    return { points: shape.poly, kind: shape.kind, confidence }
  }

  let result = null

  // A figure-8 / billow / any self-crossing stroke is NOT a simple primitive — don't snap it to a
  // circle/ellipse/polygon/line (that's what turned the billow "8" into an oval or a straight-edged 8).
  // Such strokes fall through to smoothing (manual) or stay raw (auto).
  const simple = !selfIntersects(corners, closed)

  // 1) Circle / arc — detected independently of the closed-flag so a deliberately GAPPED ring
  //    (open ring = a *prepared*, not-yet-cast spell) is preserved as a clean OPEN arc rather than
  //    snapped shut. A near-closed loop becomes a perfect closed circle (or ellipse if oblong).
  const fit = simple ? fitCircle(pts) : null
  if (fit && fit.residNorm < o.circleResidNorm) {
    const arc = arcGeometry(pts, fit)
    if (arc.spanDeg >= o.minCircleSpanDeg) {
      if (arc.gapDeg >= o.gapPreserveDeg) {
        result = accept({ kind: 'arc', poly: arcPoints(fit, arc.start, arc.end, step) })
      } else {
        const aspect = bb.w === 0 || bb.h === 0 ? 0 : Math.min(bb.w, bb.h) / Math.max(bb.w, bb.h)
        result = aspect >= o.circleAspect
          ? accept({ kind: 'circle', poly: circleShape({ x: fit.cx, y: fit.cy }, fit.r) })
          : accept({ kind: 'ellipse', poly: ellipseShape({ x: bb.minX, y: bb.minY }, { x: bb.maxX, y: bb.maxY }) })
      }
    }
  }

  // 2) Polygon: a closed loop with a few dominant corners → straight edges through them.
  if (!result && simple && closed && cornersN >= 3 && cornersN <= 6) {
    const kind = cornersN === 3 ? 'triangle' : cornersN === 4 ? 'rect' : 'polygon'
    result = accept({ kind, poly: polylineThrough(corners, step, true) })
  }
  // 3) Thin sliver (a line traced back over itself — the "overflow" of retracing the same stroke)
  //    → collapse to a single straight line along the long axis instead of a degenerate ellipse.
  if (!result && simple) {
    const aspect = bb.w === 0 || bb.h === 0 ? 0 : Math.min(bb.w, bb.h) / Math.max(bb.w, bb.h)
    if (aspect < 0.18) {
      const horiz = bb.w >= bb.h
      let a = pts[0], b = pts[0]
      for (const p of pts) {
        const v = horiz ? p.x : p.y
        if (v < (horiz ? a.x : a.y)) a = p
        if (v > (horiz ? b.x : b.y)) b = p
      }
      result = accept({ kind: 'line', poly: line(a, b, step) })
    }
  }
  // 4) Smooth oblong closed loop (no sharp corners) → ellipse.
  if (!result && simple && closed && cornersN >= 7) {
    result = accept({ kind: 'ellipse', poly: ellipseShape({ x: bb.minX, y: bb.minY }, { x: bb.maxX, y: bb.maxY }) })
  }
  // 4) Open straight stroke → line.
  if (!result && simple && !closed && cornersN === 2) {
    result = accept({ kind: 'line', poly: line(corners[0], corners[1], step) })
  }

  if (result) return result

  // No confident shape. Optionally de-jitter without forcing a shape (Streamline-style).
  if (o.smoothFallback) {
    return { points: chaikin(pts, o.chaikinIters), kind: 'smoothed', confidence: 0 }
  }
  return { points: points || [], kind: 'none', confidence: 0 }
}

/**
 * weldsRingGap(arcPts, bridgePts, opts) → closed-circle points [{x,y}] | null
 *
 * Cross-stroke "close the ring": when `bridgePts` is a stroke whose two ends land on the two open
 * ends of `arcPts` (an open, gapped circle), return the points of the COMPLETED closed circle —
 * so an extra closing stroke welds the ring shut (prepared spell → cast). Returns null when arcPts
 * isn't a gapped ring or bridgePts doesn't span its gap.
 *
 * Pure — the caller (DrawingSurface) owns replacing the two stroke nodes with one closed circle.
 */
export function weldsRingGap(arcPts, bridgePts, opts = {}) {
  const o = { ...DEFAULTS, weldResidNorm: 0.12, weldMinSpanDeg: 200, weldGapMinDeg: 6, weldSnapFrac: 0.22, weldSnapMin: 14, ...opts }
  const arc = clean(arcPts)
  const bridge = clean(bridgePts)
  if (arc.length < 6 || bridge.length < 2) return null

  // arcPts must fit a circle and be MOSTLY a ring but with a real gap.
  const fit = fitCircle(arc)
  if (!fit || fit.residNorm > o.weldResidNorm) return null
  const geo = arcGeometry(arc, fit)
  if (geo.spanDeg < o.weldMinSpanDeg || geo.gapDeg < o.weldGapMinDeg) return null

  // The ring's two open ends are the arc stroke's endpoints.
  const A = arc[0]
  const B = arc[arc.length - 1]
  const P = bridge[0]
  const Q = bridge[bridge.length - 1]

  // The bridge must be a roughly STRAIGHT closing chord — not itself an arc. Otherwise a SECOND arc
  // drawn near the first (e.g. a "Cc" sign) would satisfy the endpoint test and wrongly close the ring.
  // Reject when the bridge bows away from the line P→Q by more than weldStraightFrac of its chord.
  const chord = dist(P, Q)
  if (chord < 1) return null
  let maxDev = 0
  for (const p of bridge) { const d = perpDist(p, P, Q); if (d > maxDev) maxDev = d }
  if (maxDev > (o.weldStraightFrac ?? 0.12) * chord) return null

  const snap = Math.max(o.weldSnapMin, o.weldSnapFrac * fit.r)
  const bridged =
    (dist(P, A) <= snap && dist(Q, B) <= snap) ||
    (dist(P, B) <= snap && dist(Q, A) <= snap)
  if (!bridged) return null

  // Welded ⇒ the completed closed circle (reuse the fitted center/radius).
  const step = Math.max(4, (2 * fit.r) / 50)
  return circleShape({ x: fit.cx, y: fit.cy }, fit.r, Math.max(24, Math.round((2 * Math.PI * fit.r) / step)))
}

