// shapes.js — PURE paint-tool geometry for the Spell Studio.
// Turns paint-tool gestures into stroke point arrays ([{x,y}]).
// No JSON imports, no DOM, no React — runs under plain `node --test`.
//
// Coordinate convention: canvas Cartesian px, origin top-left (or wherever the canvas
// element places it). The caller is responsible for any canvas→world transform before
// passing points in, and for any world→canvas transform when rendering them back out.

// ---------- helpers ----------

/** Clamp a value between lo and hi. */
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

// ---------- exported shape functions ----------

/**
 * line(a, b, step) → [{x,y}]
 *
 * Sample points along the segment from a to b, spaced `step` px apart (default 8).
 * Always includes the start point; includes the end point when it is not already sampled.
 * a, b: {x, y}  step: number (px, > 0)
 */
export function line(a, b, step = 8) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return [{ x: a.x, y: a.y }]
  const pts = []
  const n = Math.max(1, Math.ceil(len / step))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push({ x: a.x + dx * t, y: a.y + dy * t })
  }
  return pts
}

/**
 * rect(a, b) → [{x,y}]  (5 points: 4 corners + closing point == first corner)
 *
 * Axis-aligned rectangle using a and b as opposite corners.
 * Returns a CLOSED polyline: the last point equals the first.
 * a, b: {x, y}
 */
export function rect(a, b) {
  const x0 = Math.min(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
    { x: x0, y: y0 }, // close
  ]
}

/**
 * triangle(a, b) → [{x,y}]  (4 points: 3 corners + closing point == first corner)
 *
 * Triangle inscribed in the bounding box of a and b:
 *   - apex at top-center of the bbox
 *   - base-left  at bottom-left of the bbox
 *   - base-right at bottom-right of the bbox
 * Returns a CLOSED polyline: the last point equals the first.
 * a, b: {x, y}
 */
export function triangle(a, b) {
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const y1 = Math.max(a.y, b.y)
  const apex = { x: (x0 + x1) / 2, y: y0 }
  const bl   = { x: x0, y: y1 }
  const br   = { x: x1, y: y1 }
  return [apex, br, bl, apex] // close
}

/**
 * ellipse(a, b, segments) → [{x,y}]  (segments+1 points, closed)
 *
 * Ellipse inscribed in the bounding box of a and b.
 * `segments` controls point density (default 48); the last point equals the first (closed).
 * a, b: {x, y}  segments: integer >= 3
 */
export function ellipse(a, b, segments = 48) {
  const cx = (a.x + b.x) / 2
  const cy = (a.y + b.y) / 2
  const rx = Math.abs(b.x - a.x) / 2
  const ry = Math.abs(b.y - a.y) / 2
  const n = Math.max(3, segments)
  const pts = []
  for (let i = 0; i <= n; i++) {
    const theta = (2 * Math.PI * i) / n
    pts.push({ x: cx + rx * Math.cos(theta), y: cy + ry * Math.sin(theta) })
  }
  return pts // pts[0] === pts[n] (closed)
}

/**
 * circle(center, radius, segments) → [{x,y}]  (segments+1 points, closed)
 *
 * Convenience: ellipse with equal radii from a center point and a radius.
 * center: {x, y}  radius: number  segments: integer >= 3 (default 48)
 */
export function circle(center, radius, segments = 48) {
  const r = Math.abs(radius)
  return ellipse(
    { x: center.x - r, y: center.y - r },
    { x: center.x + r, y: center.y + r },
    segments,
  )
}

/**
 * brush(points) → [{x,y}]
 *
 * Passthrough: the brush tool accumulates points directly; this is the identity function
 * that lets the Studio treat all tools uniformly (each tool produces a point array).
 * points: [{x, y}]
 */
export function brush(points) {
  return points.slice() // defensive copy
}

/**
 * eraserHitTest(strokes, point, radius) → number[]
 *
 * Returns the INDICES of `strokes` whose any point lies within `radius` px of `point`.
 * strokes: Array of point arrays ([{x,y}][])  or stroke objects with a `.points` array.
 * point: {x, y}   radius: number (px)
 *
 * Accepts two stroke formats:
 *   - plain point arrays: [[{x,y},...],...]
 *   - stroke objects:     [{points:[{x,y},...], ...}, ...]
 * Both formats are common in the Studio model.
 */
export function eraserHitTest(strokes, point, radius) {
  const r2 = radius * radius
  const hits = []
  for (let i = 0; i < strokes.length; i++) {
    // Support both a plain point array and an object with a `.points` property.
    const pts = Array.isArray(strokes[i]) ? strokes[i] : (strokes[i].points || [])
    const hit = pts.some((p) => {
      const dx = p.x - point.x
      const dy = p.y - point.y
      return dx * dx + dy * dy <= r2
    })
    if (hit) hits.push(i)
  }
  return hits
}
