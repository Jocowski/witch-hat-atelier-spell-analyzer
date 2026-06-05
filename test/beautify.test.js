// beautify.test.js — pure-module tests for stroke beautification (no JSON/DOM).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beautifyStroke, rdp, fitCircle, chaikin, weldsRingGap, selfIntersects, edgesAreStraight } from '../src/studio/tools/beautify.js'

// ---------- helpers: synthesize hand-drawn-ish strokes ----------

// deterministic pseudo-noise so tests are reproducible
function noise(seed) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return (s / 0x7fffffff) * 2 - 1 // [-1, 1]
  }
}

function wobblyCircle(cx, cy, r, n = 64, jitter = 3, seed = 1) {
  const rnd = noise(seed)
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n
    const rr = r + rnd() * jitter
    pts.push({ x: cx + rr * Math.cos(t), y: cy + rr * Math.sin(t) })
  }
  return pts
}

function wobblyEllipse(cx, cy, rx, ry, n = 64, jitter = 3, seed = 2) {
  const rnd = noise(seed)
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n
    pts.push({ x: cx + (rx + rnd() * jitter) * Math.cos(t), y: cy + (ry + rnd() * jitter) * Math.sin(t) })
  }
  return pts
}

// sample a closed polygon's edges with per-point jitter (wiggly edges)
function wobblyPolygon(verts, perEdge = 20, jitter = 4, seed = 3) {
  const rnd = noise(seed)
  const pts = []
  const loop = [...verts, verts[0]]
  for (let i = 0; i < loop.length - 1; i++) {
    const a = loop[i], b = loop[i + 1]
    for (let k = 0; k < perEdge; k++) {
      const t = k / perEdge
      pts.push({ x: a.x + (b.x - a.x) * t + rnd() * jitter, y: a.y + (b.y - a.y) * t + rnd() * jitter })
    }
  }
  pts.push({ x: verts[0].x, y: verts[0].y })
  return pts
}

function driftingLine(a, b, n = 30, jitter = 3, seed = 4) {
  const rnd = noise(seed)
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push({ x: a.x + (b.x - a.x) * t + rnd() * jitter, y: a.y + (b.y - a.y) * t + rnd() * jitter })
  }
  return pts
}

// ---------- primitives ----------

test('rdp reduces a noisy line to ~2 endpoints', () => {
  const pts = driftingLine({ x: 0, y: 0 }, { x: 200, y: 0 }, 40, 1, 9)
  const simplified = rdp(pts, 5)
  assert.ok(simplified.length <= 4, `expected few corners, got ${simplified.length}`)
})

test('fitCircle recovers center and radius of a clean circle', () => {
  const pts = wobblyCircle(100, 50, 40, 80, 0) // no jitter
  const fit = fitCircle(pts)
  assert.ok(fit, 'expected a fit')
  assert.ok(Math.abs(fit.cx - 100) < 1, `cx ${fit.cx}`)
  assert.ok(Math.abs(fit.cy - 50) < 1, `cy ${fit.cy}`)
  assert.ok(Math.abs(fit.r - 40) < 1, `r ${fit.r}`)
  assert.ok(fit.residNorm < 0.01, `residNorm ${fit.residNorm}`)
})

test('fitCircle returns null for collinear points', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }]
  assert.equal(fitCircle(pts), null)
})

test('chaikin keeps endpoints and adds intermediate points', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 0 }]
  const out = chaikin(pts, 1)
  assert.deepEqual(out[0], pts[0])
  assert.deepEqual(out[out.length - 1], pts[pts.length - 1])
  assert.ok(out.length > pts.length)
})

// ---------- beautifyStroke: shape snapping ----------

test('wobbly circle → kind circle, recovered geometry', () => {
  const pts = wobblyCircle(0, 0, 50, 64, 3, 11)
  const res = beautifyStroke(pts)
  assert.equal(res.kind, 'circle')
  assert.ok(res.confidence >= 0.7, `confidence ${res.confidence}`)
  // regenerated points should sit ~50px from the origin
  const meanR = res.points.reduce((s, p) => s + Math.hypot(p.x, p.y), 0) / res.points.length
  assert.ok(Math.abs(meanR - 50) < 4, `meanR ${meanR}`)
})

// a circular stroke that stops short of closing, leaving an angular gap (open ring)
function gappedCircle(cx, cy, r, gapDeg = 40, n = 60, jitter = 2, seed = 31) {
  const rnd = noise(seed)
  const sweep = 360 - gapDeg
  const pts = []
  for (let i = 0; i <= n; i++) {
    const deg = (sweep * i) / n // 0 .. sweep, leaving [sweep, 360] empty
    const t = (deg * Math.PI) / 180
    const rr = r + rnd() * jitter
    pts.push({ x: cx + rr * Math.cos(t), y: cy + rr * Math.sin(t) })
  }
  return pts
}

test('gapped circle → kind arc, gap preserved (NOT force-closed)', () => {
  const pts = gappedCircle(0, 0, 50, 45, 60, 2, 33)
  const res = beautifyStroke(pts)
  assert.equal(res.kind, 'arc')
  // endpoints must stay apart (the ring is intentionally open ⇒ a prepared, uncast spell)
  const first = res.points[0]
  const last = res.points[res.points.length - 1]
  assert.ok(Math.hypot(first.x - last.x, first.y - last.y) > 20, 'arc endpoints should leave a gap')
  // still circular: points sit ~50px from center
  const meanR = res.points.reduce((s, p) => s + Math.hypot(p.x, p.y), 0) / res.points.length
  assert.ok(Math.abs(meanR - 50) < 4, `meanR ${meanR}`)
})

test('near-closed circle (tiny gap) → kind circle, closed', () => {
  const pts = gappedCircle(0, 0, 50, 6, 64, 2, 34) // 6° gap = essentially closed
  const res = beautifyStroke(pts)
  assert.equal(res.kind, 'circle')
})

test('wobbly ellipse → kind ellipse, not forced to circle', () => {
  const pts = wobblyEllipse(0, 0, 90, 40, 80, 2, 7)
  const res = beautifyStroke(pts)
  assert.equal(res.kind, 'ellipse')
})

test('shaky triangle → kind triangle with 3 corners', () => {
  const verts = [{ x: 0, y: -60 }, { x: 60, y: 50 }, { x: -60, y: 50 }]
  const pts = wobblyPolygon(verts, 24, 4, 5)
  const res = beautifyStroke(pts)
  assert.equal(res.kind, 'triangle')
  assert.ok(res.confidence >= 0.7, `confidence ${res.confidence}`)
})

test('shaky square → kind rect', () => {
  const verts = [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }]
  const pts = wobblyPolygon(verts, 22, 4, 6)
  const res = beautifyStroke(pts)
  assert.equal(res.kind, 'rect')
})

// a smooth teardrop / droplet: sharp tip at top, rounded belly, CURVED sides (MathWorld teardrop curve).
// tip (cusp) at t=0; m controls pointiness. Oriented tip-up, centered on (cx,cy).
function teardrop(cx, cy, width, height, m = 3, n = 96, jitter = 0, seed = 61) {
  const rnd = noise(seed)
  const jx = () => (jitter ? rnd() * jitter : 0)
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n
    const px = Math.sin(t) * Math.pow(Math.sin(t / 2), m) // width axis (±~0.4)
    const py = Math.cos(t)                                 // height axis (tip at t=0 ⇒ py=1)
    pts.push({ x: cx + width * px + jx(), y: cy - height * py + jx() })
  }
  return pts
}

test('teardrop (droplet) is NOT faceted into a triangle/polygon', () => {
  const pts = teardrop(0, 0, 120, 80, 3, 96, 1.5, 71)
  const auto = beautifyStroke(pts) // Auto / QuickShape (smoothFallback off)
  assert.ok(!['triangle', 'rect', 'polygon'].includes(auto.kind), `got faceted: ${auto.kind}`)
  assert.equal(auto.kind, 'none', `expected raw, got ${auto.kind}`)
  // manual Smooth still de-jitters it (stays a curve, never a polygon)
  const manual = beautifyStroke(pts, { smoothFallback: true })
  assert.equal(manual.kind, 'smoothed')
})

test('edgesAreStraight: true for straight edges, false for a bowed one', () => {
  const a = { x: 0, y: 0 }, b = { x: 120, y: 0 }, c = { x: 60, y: 90 }
  const interior = (p, q, k = 6) => {
    const o = []
    for (let i = 1; i < k; i++) { const t = i / k; o.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }) }
    return o
  }
  const corners = [a, b, c]
  const straight = [a, ...interior(a, b), b, ...interior(b, c), c, ...interior(c, a)]
  assert.equal(edgesAreStraight(straight, corners, true, 0.08), true)
  // bow the a→b edge: its interior points bulge ~25% of the chord ⇒ not a straight edge
  const bowedAB = bow(a, b, 0.25, 8).slice(1, -1)
  const bowed = [a, ...bowedAB, b, ...interior(b, c), c, ...interior(c, a)]
  assert.equal(edgesAreStraight(bowed, corners, true, 0.08), false)
})

test('drifting line → kind line, endpoints preserved', () => {
  const a = { x: -80, y: 10 }, b = { x: 80, y: -10 }
  const pts = driftingLine(a, b, 30, 3, 8)
  const res = beautifyStroke(pts)
  assert.equal(res.kind, 'line')
  const first = res.points[0]
  const last = res.points[res.points.length - 1]
  // endpoints should land near the drawn endpoints (RDP picks actual extremes)
  assert.ok(Math.hypot(first.x - a.x, first.y - a.y) < 12 || Math.hypot(first.x - b.x, first.y - b.y) < 12)
  assert.ok(Math.hypot(last.x - b.x, last.y - b.y) < 12 || Math.hypot(last.x - a.x, last.y - a.y) < 12)
})

test('retraced line (drawn out and back over itself) → kind line, no degenerate ellipse', () => {
  const A = { x: -80, y: 0 }, B = { x: 80, y: 0 }
  const pts = [...driftingLine(A, B, 20, 2, 51), ...driftingLine(B, A, 20, 2, 52)]
  const res = beautifyStroke(pts)
  assert.equal(res.kind, 'line')
  const xs = res.points.map((p) => p.x)
  assert.ok(Math.min(...xs) < -60 && Math.max(...xs) > 60, 'line should span the drawn extent')
})

// ---------- figure-8 / self-intersecting strokes (billow) are not snapped ----------

// Gerono lemniscate (a horizontal figure-8 that crosses itself at the origin)
function figure8(cx, cy, a, n = 96, jitter = 1.5, seed = 91) {
  const rnd = noise(seed)
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n
    pts.push({ x: cx + a * Math.cos(t) + rnd() * jitter, y: cy + a * Math.sin(t) * Math.cos(t) + rnd() * jitter })
  }
  return pts
}

test('selfIntersects: true for a crossing polyline, false for a simple square', () => {
  assert.equal(selfIntersects([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }]), true)
  assert.equal(selfIntersects([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], true), false)
})

test('figure-8 (billow) is NOT snapped to an oval or a straight-edged 8', () => {
  const pts = figure8(0, 0, 60)
  const auto = beautifyStroke(pts) // Auto / QuickShape (smoothFallback off)
  assert.equal(auto.kind, 'none', `expected raw, got ${auto.kind}`)
  const manual = beautifyStroke(pts, { smoothFallback: true }) // manual Smooth
  assert.equal(manual.kind, 'smoothed')
})

// ---------- beautifyStroke: gating / no false positives ----------

test('genuine squiggle → none by default (no forced shape)', () => {
  const rnd = noise(21)
  const pts = []
  for (let i = 0; i < 40; i++) pts.push({ x: i * 5, y: 40 * Math.sin(i / 2) + rnd() * 15 })
  const res = beautifyStroke(pts)
  assert.ok(res.kind === 'none' || res.kind === 'line' ? res.kind === 'none' : true)
  assert.equal(res.kind, 'none')
})

test('genuine squiggle → smoothed when smoothFallback enabled', () => {
  const rnd = noise(22)
  const pts = []
  for (let i = 0; i < 40; i++) pts.push({ x: i * 5, y: 40 * Math.sin(i / 2) + rnd() * 15 })
  const res = beautifyStroke(pts, { smoothFallback: true })
  assert.equal(res.kind, 'smoothed')
  assert.ok(res.points.length >= pts.length)
})

test('degenerate inputs are returned untouched, no throw', () => {
  assert.equal(beautifyStroke([]).kind, 'none')
  assert.equal(beautifyStroke([{ x: 1, y: 1 }]).kind, 'none')
  assert.equal(beautifyStroke([{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }]).kind, 'none')
  // NaN sentinels (arrow heads) are stripped, not fatal
  const withNaN = [{ x: 0, y: 0 }, { x: NaN, y: NaN }, { x: 10, y: 10 }]
  assert.doesNotThrow(() => beautifyStroke(withNaN))
})

// ---------- weldsRingGap: close-the-ring (cross-stroke) ----------

test('weldsRingGap: a closing stroke across an open ring → full closed circle', () => {
  const arc = gappedCircle(0, 0, 50, 60, 60, 1, 41) // 300° arc, 60° gap
  const A = arc[0]
  const B = arc[arc.length - 1]
  const bridge = driftingLine(B, A, 10, 1, 42) // line connecting the two open ends
  const circ = weldsRingGap(arc, bridge)
  assert.ok(circ, 'expected a welded closed circle')
  const meanR = circ.reduce((s, p) => s + Math.hypot(p.x, p.y), 0) / circ.length
  assert.ok(Math.abs(meanR - 50) < 3, `meanR ${meanR}`)
  // completed loop: first ≈ last
  assert.ok(Math.hypot(circ[0].x - circ[circ.length - 1].x, circ[0].y - circ[circ.length - 1].y) < 6, 'should be closed')
})

// a quadratic-bezier "bow" from A to B that bulges sideways by `bulge`·chord (a curved bridge)
function bow(A, B, bulge = 0.4, n = 16) {
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len
  const c = { x: mx + nx * bulge * len, y: my + ny * bulge * len }
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t
    pts.push({ x: u * u * A.x + 2 * u * t * c.x + t * t * B.x, y: u * u * A.y + 2 * u * t * c.y + t * t * B.y })
  }
  return pts
}

test('weldsRingGap: a CURVED second arc across the gap does NOT weld (two arcs stay separate)', () => {
  const arc = gappedCircle(0, 0, 50, 60, 60, 1, 81)
  const A = arc[0]
  const B = arc[arc.length - 1]
  const curved = bow(B, A, 0.45, 18) // a bowed stroke, not a straight closing chord
  assert.equal(weldsRingGap(arc, curved), null)
})

test('weldsRingGap: a stroke that does not touch the ends → null', () => {
  const arc = gappedCircle(0, 0, 50, 60, 60, 1, 43)
  const bridge = driftingLine({ x: 200, y: 200 }, { x: 260, y: 200 }, 10, 1, 44)
  assert.equal(weldsRingGap(arc, bridge), null)
})

test('weldsRingGap: an already-closed circle (no gap) → null', () => {
  const full = wobblyCircle(0, 0, 50, 64, 1, 45)
  const bridge = driftingLine(full[0], full[full.length - 1], 6, 1, 46)
  assert.equal(weldsRingGap(full, bridge), null)
})

test('weldsRingGap: a non-circular base stroke → null', () => {
  const tri = wobblyPolygon([{ x: 0, y: -60 }, { x: 60, y: 50 }, { x: -60, y: 50 }], 24, 3, 47)
  const bridge = driftingLine({ x: -60, y: 50 }, { x: 60, y: 50 }, 10, 1, 48)
  assert.equal(weldsRingGap(tri, bridge), null)
})

test('does not mutate the input array', () => {
  const pts = wobblyCircle(0, 0, 50, 64, 3, 11)
  const copy = pts.map((p) => ({ ...p }))
  beautifyStroke(pts)
  assert.deepEqual(pts, copy)
})
