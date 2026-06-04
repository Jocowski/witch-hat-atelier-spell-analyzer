// fill.js — PURE geometry for the Spell Studio "fill" (ink-bucket) tool.
// Decides whether a click lands inside a CLOSED stroke and which stroke to flood.
// No JSON imports, no DOM, no React — runs under plain `node --test`.
//
// Coordinate convention: same world coords as the rest of the Studio model
// (centre-origin, y down). The caller passes the click point already in world coords.

// ---------- helpers ----------

/** Strip NaN sentinels (sub-stroke gaps) from a point array. */
function clean(points) {
  return points.filter((p) => p && !Number.isNaN(p.x) && !Number.isNaN(p.y))
}

/** Diagonal length of a point array's axis-aligned bounding box. */
function bboxDiag(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  if (minX === Infinity) return 0
  return Math.hypot(maxX - minX, maxY - minY)
}

// ---------- exported geometry ----------

/**
 * isClosedStroke(points, tol) → boolean
 *
 * True when a stroke's point array forms a closed loop — its first and last points
 * meet (within `tol` world units, or within 8% of the stroke's bbox diagonal, whichever
 * is larger, so big loops get a proportionally larger allowance). An OPEN stroke (a line,
 * an arc, a loop with a real gap) returns false, so the fill tool refuses to flood it.
 */
export function isClosedStroke(points, tol = 14) {
  if (!Array.isArray(points)) return false
  const pts = clean(points)
  if (pts.length < 3) return false
  const a = pts[0], b = pts[pts.length - 1]
  const gap = Math.hypot(a.x - b.x, a.y - b.y)
  return gap <= Math.max(tol, bboxDiag(pts) * 0.08)
}

/**
 * pointInPolygon(pt, polygon) → boolean
 *
 * Ray-casting (even–odd) point-in-polygon test. `polygon` is a point array ([{x,y}]);
 * it may be open or closed (the edge from last→first is always considered). NaN gaps
 * are ignored.
 */
export function pointInPolygon(pt, polygon) {
  const pts = clean(polygon)
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y
    const xj = pts[j].x, yj = pts[j].y
    const intersect =
      (yi > pt.y) !== (yj > pt.y) &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * polygonArea(polygon) → number
 *
 * Absolute area of a polygon via the shoelace formula (NaN gaps ignored).
 * Used to pick the smallest (innermost) enclosing shape when shapes are nested.
 */
export function polygonArea(polygon) {
  const pts = clean(polygon)
  if (pts.length < 3) return 0
  let sum = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    sum += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y)
  }
  return Math.abs(sum) / 2
}

/**
 * findFillTarget(strokeNodes, pt, opts?) → node | null
 *
 * Among `strokeNodes` (model nodes with a `.points` array), find the one to flood when
 * the user clicks at `pt`. A candidate must be CLOSED (isClosedStroke) AND contain `pt`.
 * When several qualify (nested shapes), the smallest-area one wins so the click fills the
 * innermost region. Returns null when the point isn't inside any closed stroke — i.e. the
 * shape under the cursor is open, or there's nothing there — so the caller does nothing.
 */
export function findFillTarget(strokeNodes, pt, opts = {}) {
  const tol = opts.tol ?? 14
  let best = null
  let bestArea = Infinity
  for (const n of strokeNodes) {
    if (!n || !Array.isArray(n.points)) continue
    if (!isClosedStroke(n.points, tol)) continue
    if (!pointInPolygon(pt, n.points)) continue
    const area = polygonArea(n.points)
    if (area < bestArea) { bestArea = area; best = n }
  }
  return best
}
