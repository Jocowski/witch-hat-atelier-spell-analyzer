// recognizer.js — the $P Point-Cloud Recognizer (Vatavu, Anthony & Wobbrock, ICMI 2012) plus the
// spell pipeline (ring → segment → core/border → de-rotate → classify → composition).
//
// PURE module: no JSON imports, no DOM. It takes raw strokes (arrays of {x,y}) and a list of
// templates, and returns the recognized symbols + a wha-spell@1 composition the engine can analyze.
// Keep it JSON-free so it stays trivially testable (mirrors the geometry.js/deduce.js convention).

const NUM_POINTS = 32
const ORIGIN = { X: 0, Y: 0 }

const P = (x, y, id) => ({ X: x, Y: y, ID: id })
const dist = (a, b) => Math.hypot(a.X - b.X, a.Y - b.Y)

function pathLength(points) {
  let d = 0
  for (let i = 1; i < points.length; i++) if (points[i].ID === points[i - 1].ID) d += dist(points[i - 1], points[i])
  return d
}
function resample(points, n) {
  const I = pathLength(points) / (n - 1)
  let D = 0
  const np = [points[0]]
  for (let i = 1; i < points.length; i++) {
    if (points[i].ID === points[i - 1].ID) {
      const d = dist(points[i - 1], points[i])
      if (D + d >= I) {
        const t = (I - D) / d
        const q = P(points[i - 1].X + t * (points[i].X - points[i - 1].X), points[i - 1].Y + t * (points[i].Y - points[i - 1].Y), points[i].ID)
        np.push(q); points.splice(i, 0, q); D = 0
      } else D += d
    }
  }
  while (np.length <= n - 1) np.push(P(points[points.length - 1].X, points[points.length - 1].Y, points[points.length - 1].ID))
  return np
}
function centroid(points) { let x = 0, y = 0; for (const p of points) { x += p.X; y += p.Y } return P(x / points.length, y / points.length, 0) }
function scaleToSquare(points) {
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity
  for (const p of points) { a = Math.min(a, p.X); b = Math.max(b, p.X); c = Math.min(c, p.Y); d = Math.max(d, p.Y) }
  const s = Math.max(b - a, d - c) || 1
  return points.map((p) => P((p.X - a) / s, (p.Y - c) / s, p.ID))
}
function translateToOrigin(points) { const ce = centroid(points); return points.map((p) => P(p.X + ORIGIN.X - ce.X, p.Y + ORIGIN.Y - ce.Y, p.ID)) }

export function makeCloud(name, points, weight = 1) {
  let p = resample(points.map((q) => P(q.X, q.Y, q.ID)), NUM_POINTS)
  p = scaleToSquare(p); p = translateToOrigin(p)
  return { name, points: p, weight: weight > 0 ? weight : 1 }
}

// Recognition confidence (%) from a raw $P cloud distance. 0 dist = perfect (100%); larger = lower.
// Kept here (pure) so the UI and the gate agree on one definition.
export function confidencePct(dist) {
  if (dist == null || dist === 0) return 100
  return Math.round(Math.min(1, 1 / dist) * 100)
}
function cloudDistance(p1, p2, start) {
  const matched = new Array(p1.length).fill(false)
  let sum = 0, i = start
  do {
    let index = -1, min = Infinity
    for (let j = 0; j < p1.length; j++) if (!matched[j]) { const d = dist(p1[i], p2[j]); if (d < min) { min = d; index = j } }
    matched[index] = true
    sum += (1 - ((i - start + p1.length) % p1.length) / p1.length) * min
    i = (i + 1) % p1.length
  } while (i !== start)
  return sum
}
function greedyMatch(pts, cloud) {
  const e = 0.5, step = Math.floor(Math.pow(pts.length, 1 - e))
  let min = Infinity
  for (let i = 0; i < pts.length; i += step) min = Math.min(min, cloudDistance(pts, cloud.points, i), cloudDistance(cloud.points, pts, i))
  return min
}

// Recognize a single symbol (array of {X,Y,ID} points) against prebuilt clouds. Returns ranked list.
// Ranking is by `adjDist = dist / weight` (a more-trusted template — e.g. a user correction — wins close
// calls); `dist` stays the raw geometric distance for display/telemetry. weight defaults to 1.
export function recognize(points, clouds) {
  if (!clouds.length || points.length < 2) return []
  const p = makeCloud('', points)
  return clouds
    .map((c) => {
      const d = greedyMatch(p.points, c)
      const w = c.weight ?? 1
      return { name: c.name, dist: d, score: d > 0 ? 1 / d : 1, adjDist: w > 0 ? d / w : d }
    })
    .sort((a, b) => a.adjDist - b.adjDist)
}

// ---------- geometry on raw {x,y} strokes ----------
const cxy = (pts) => { let x = 0, y = 0; for (const p of pts) { x += p.x; y += p.y } return { x: x / pts.length, y: y / pts.length } }
function circleScore(pts) {
  const c = cxy(pts)
  const radii = pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y))
  const r = radii.reduce((a, b) => a + b, 0) / radii.length
  const variance = radii.reduce((a, b) => a + (b - r) ** 2, 0) / radii.length
  const cv = Math.sqrt(variance) / (r || 1)
  const closed = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.4 * r
  return { cx: c.x, cy: c.y, r, cv, closed }
}
function minGap(a, b) {
  let m = Infinity
  for (let i = 0; i < a.length; i += 3) for (let j = 0; j < b.length; j += 3) { const d = Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y); if (d < m) m = d }
  return m
}
function rotateStroke(stroke, cx, cy, ang) {
  const co = Math.cos(ang), si = Math.sin(ang)
  return stroke.map((p) => { const dx = p.x - cx, dy = p.y - cy; return { x: cx + dx * co - dy * si, y: cy + dx * si + dy * co } })
}

// ---------- the full pipeline ----------
// strokes: array of strokes; each stroke = array of {x,y} (canvas px).
// templates: [{ name, role, points:[{X,Y,ID}] }].  opts: { gap } stroke-merge threshold (px).
// Returns { ring, center, groups:[{role,cx,cy,angle,match,strokes}], composition }.
export function analyzeStrokes(strokes, templates, opts = {}) {
  const gap = opts.gap ?? 45
  const confidenceMinPct = opts.confidenceMinPct ?? 0
  const clouds = templates.map((t) => makeCloud(t.name, t.points, t.weight))
  const drawn = strokes.filter((s) => s.length >= 2)
  if (!drawn.length || !clouds.length) return { ring: null, center: { x: 0, y: 0 }, groups: [], composition: null }

  // 1 · ring
  let ring = null, ringIdx = -1
  drawn.forEach((s, i) => { const cs = circleScore(s); if (cs.cv < 0.3 && cs.closed && (!ring || cs.r > ring.r)) { ring = cs; ringIdx = i } })
  let center, ringR
  if (ring) { center = { x: ring.cx, y: ring.cy }; ringR = ring.r } else { center = cxy(drawn.flat()); ringR = 200 }

  // 2 · segment by proximity
  const symStrokes = drawn.filter((_, i) => i !== ringIdx)
  let groups = symStrokes.map((s) => ({ strokes: [s], pts: s.slice() }))
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      if (minGap(groups[i].pts, groups[j].pts) < gap) {
        groups[i].strokes.push(...groups[j].strokes); groups[i].pts = groups[i].pts.concat(groups[j].pts); groups.splice(j, 1); merged = true; break outer
      }
    }
  }

  // 3 · center vs border
  groups.forEach((g) => { const c = cxy(g.pts); g.cx = c.x; g.cy = c.y; g.distC = Math.hypot(c.x - center.x, c.y - center.y) })
  groups.sort((a, b) => a.distC - b.distC)
  const innerR = 0.45 * ringR
  let core = groups.length && groups[0].distC < innerR ? groups[0] : null
  groups.forEach((g) => { g.role = g === core ? 'core' : 'sign' })

  // 4 + 5 · de-rotate (sweep) and classify
  groups.forEach((g) => {
    g.angle = ((Math.atan2(g.cx - center.x, -(g.cy - center.y)) * 180) / Math.PI + 360) % 360
    const sweep = g.role === 'core' ? [0] : Array.from({ length: 24 }, (_, k) => k * 15)
    let best = null
    for (const deg of sweep) {
      const pts = []
      g.strokes.forEach((s, si) => rotateStroke(s, g.cx, g.cy, (deg * Math.PI) / 180).forEach((p) => pts.push(P(p.x, p.y, si))))
      const ranked = recognize(pts, clouds)
      if (ranked.length && (!best || ranked[0].adjDist < best.adjDist)) {
        best = { name: ranked[0].name, dist: ranked[0].dist, adjDist: ranked[0].adjDist, rotation: deg }
      }
    }
    g.match = best
    // Confidence gate: a low-confidence guess is kept for display but flagged so the caller can render
    // it as "unknown?" and exclude it from the engine input (SPEC A2).
    g.confidence = best ? confidencePct(best.dist) : 0
    g.confident = best ? g.confidence >= confidenceMinPct : false
  })

  return { ring, center, ringR, groups, composition: buildComposition(groups, center, ring) }
}

// Build a wha-spell@1 composition (one circle) from analyzed groups. Coordinates are recentred on
// the ring center; rotation is the winning de-rotation sweep angle. The app's import path
// (toComposition) wraps this single circle into the v2 shape and remaps ids.
export function buildComposition(groups, center, ring) {
  const core = groups.find((g) => g.role === 'core' && g.match)
  return {
    ring: { closed: !!ring },
    core: core ? { id: core.match.name, type: core.match.name, x: Math.round(core.cx - center.x), y: Math.round(core.cy - center.y), rotation: 0, scale: 1, inverted: false } : null,
    components: groups.filter((g) => g.role === 'sign' && g.match).map((g) => ({
      type: g.match.name, role: 'sign',
      x: Math.round(g.cx - center.x), y: Math.round(g.cy - center.y),
      rotation: g.match.rotation, scale: 1, inverted: false,
    })),
    dyes: [],
  }
}

// Turn one analyzed group's strokes into a storable template (raw points, one ID per stroke).
export function groupToTemplate(group, name, role) {
  const points = []
  group.strokes.forEach((s, si) => s.forEach((p) => points.push({ X: p.x, Y: p.y, ID: si })))
  return { name, role: role || (group.role === 'core' ? 'sigil' : 'sign'), points }
}

// Turn freshly drawn strokes (training tab) into a storable template.
export function strokesToTemplate(strokes, name, role) {
  const points = []
  strokes.filter((s) => s.length >= 2).forEach((s, si) => s.forEach((p) => points.push({ X: p.x, Y: p.y, ID: si })))
  return { name, role, points }
}
