import { test } from 'node:test'
import assert from 'node:assert/strict'
import { line, rect, triangle, ellipse, circle, brush, eraserHitTest } from '../src/studio/tools/shapes.js'

// ---------- line ----------

test('line: returns start point for zero-length segment', () => {
  const pts = line({ x: 5, y: 5 }, { x: 5, y: 5 })
  assert.equal(pts.length, 1)
  assert.deepEqual(pts[0], { x: 5, y: 5 })
})

test('line: samples horizontal segment with correct start/end', () => {
  const pts = line({ x: 0, y: 0 }, { x: 100, y: 0 }, 25)
  // Should have start + intermediate + end points
  assert.ok(pts.length >= 2)
  assert.deepEqual(pts[0], { x: 0, y: 0 })
  const last = pts[pts.length - 1]
  assert.ok(Math.abs(last.x - 100) < 0.01 && Math.abs(last.y - 0) < 0.01)
})

test('line: spacing is approximately the requested step', () => {
  const pts = line({ x: 0, y: 0 }, { x: 80, y: 0 }, 8)
  // For length 80 with step 8 → 11 pts (0..10)
  assert.equal(pts.length, 11)
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    assert.ok(d <= 8.01, `spacing should be <= step, got ${d}`)
  }
})

test('line: diagonal segment produces correct point count', () => {
  // length = sqrt(60^2+80^2) = 100, step = 10 → 11 pts
  const pts = line({ x: 0, y: 0 }, { x: 60, y: 80 }, 10)
  assert.equal(pts.length, 11)
})

// ---------- rect ----------

test('rect: returns 5 points (4 corners + closing)', () => {
  const pts = rect({ x: 0, y: 0 }, { x: 10, y: 10 })
  assert.equal(pts.length, 5)
})

test('rect: last point equals first (closed polyline)', () => {
  const pts = rect({ x: 0, y: 0 }, { x: 10, y: 10 })
  assert.deepEqual(pts[pts.length - 1], pts[0])
})

test('rect: corners form the correct bounding box', () => {
  const pts = rect({ x: 5, y: 3 }, { x: 15, y: 13 })
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  assert.equal(Math.min(...xs), 5)
  assert.equal(Math.max(...xs), 15)
  assert.equal(Math.min(...ys), 3)
  assert.equal(Math.max(...ys), 13)
})

test('rect: works when a and b are given in any order', () => {
  const pts1 = rect({ x: 0, y: 0 }, { x: 20, y: 10 })
  const pts2 = rect({ x: 20, y: 10 }, { x: 0, y: 0 })
  assert.deepEqual(pts1, pts2)
})

// ---------- triangle ----------

test('triangle: returns 4 points (3 corners + closing)', () => {
  const pts = triangle({ x: 0, y: 0 }, { x: 10, y: 10 })
  assert.equal(pts.length, 4)
})

test('triangle: last point equals first (closed)', () => {
  const pts = triangle({ x: 0, y: 0 }, { x: 10, y: 10 })
  assert.deepEqual(pts[pts.length - 1], pts[0])
})

test('triangle: apex is at top-center of the bbox', () => {
  const pts = triangle({ x: 0, y: 0 }, { x: 20, y: 30 })
  // apex = pts[0]; bbox x0=0,x1=20,y0=0,y1=30 → apex should be {x:10, y:0}
  const apex = pts[0]
  assert.equal(apex.x, 10)
  assert.equal(apex.y, 0)
})

test('triangle: base corners are at bottom-left and bottom-right', () => {
  const pts = triangle({ x: 0, y: 0 }, { x: 20, y: 40 })
  // pts[1]=br, pts[2]=bl (both at y=40)
  const [apex, br, bl] = pts
  assert.equal(br.y, 40)
  assert.equal(bl.y, 40)
  assert.equal(bl.x, 0)
  assert.equal(br.x, 20)
})

test('triangle: apex is equidistant from both base corners', () => {
  const pts = triangle({ x: 0, y: 0 }, { x: 40, y: 50 })
  const [apex, br, bl] = pts
  const dLeft  = Math.hypot(apex.x - bl.x, apex.y - bl.y)
  const dRight = Math.hypot(apex.x - br.x, apex.y - br.y)
  assert.ok(Math.abs(dLeft - dRight) < 0.01, `distances should match: ${dLeft} vs ${dRight}`)
})

// ---------- ellipse ----------

test('ellipse: returns segments+1 points (closed)', () => {
  const pts = ellipse({ x: 0, y: 0 }, { x: 100, y: 60 }, 48)
  assert.equal(pts.length, 49) // 48 + 1 closing
})

test('ellipse: last point equals first (closed)', () => {
  const pts = ellipse({ x: 0, y: 0 }, { x: 100, y: 60 })
  const first = pts[0]
  const last  = pts[pts.length - 1]
  // Trig at theta=2π may differ from theta=0 by a tiny float epsilon — use approximate compare.
  assert.ok(Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6,
    `last point should equal first: first=${JSON.stringify(first)}, last=${JSON.stringify(last)}`)
})

test('ellipse: center is midpoint of a and b', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 100, y: 60 }
  const pts = ellipse(a, b, 4)
  // With 4 segments the 4 sampled pts should be at the extremes: top,right,bottom,left
  // Use approximate comparisons to handle floating-point trig imprecision.
  const xs = pts.slice(0, 4).map((p) => p.x)
  const ys = pts.slice(0, 4).map((p) => p.y)
  assert.ok(Math.abs(Math.min(...xs) - 0) < 1e-6, `min x should be ~0, got ${Math.min(...xs)}`)
  assert.ok(Math.abs(Math.max(...xs) - 100) < 1e-6, `max x should be ~100, got ${Math.max(...xs)}`)
  assert.ok(Math.abs(Math.min(...ys) - 0) < 1e-6, `min y should be ~0, got ${Math.min(...ys)}`)
  assert.ok(Math.abs(Math.max(...ys) - 60) < 1e-6, `max y should be ~60, got ${Math.max(...ys)}`)
})

test('ellipse: all points lie on the ellipse equation', () => {
  const a = { x: 10, y: 20 }
  const b = { x: 90, y: 80 }
  const pts = ellipse(a, b, 36)
  const cx = (a.x + b.x) / 2
  const cy = (a.y + b.y) / 2
  const rx = (b.x - a.x) / 2
  const ry = (b.y - a.y) / 2
  for (const p of pts) {
    const val = ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2
    assert.ok(Math.abs(val - 1) < 1e-8, `point not on ellipse: val=${val}`)
  }
})

// ---------- circle convenience ----------

test('circle: produces a closed circle of the requested radius', () => {
  const center = { x: 50, y: 50 }
  const r = 30
  const pts = circle(center, r, 48)
  assert.equal(pts.length, 49) // 48 + 1 closing
  // Use approximate comparison for the closing point (floating-point trig).
  assert.ok(Math.abs(pts[0].x - pts[48].x) < 1e-6 && Math.abs(pts[0].y - pts[48].y) < 1e-6,
    'first and last points should be equal (closed)')
  for (const p of pts) {
    const d = Math.hypot(p.x - center.x, p.y - center.y)
    assert.ok(Math.abs(d - r) < 1e-6, `point not on circle: d=${d}`)
  }
})

test('circle: center is the actual center (not a corner)', () => {
  const center = { x: 0, y: 0 }
  // Use enough segments that the centroid is accurate despite floating-point.
  const pts = circle(center, 100, 360)
  // Skip the duplicate closing point (pts[360] === pts[0]) when averaging.
  const unique = pts.slice(0, 360)
  const cx = unique.map((p) => p.x).reduce((a, b) => a + b, 0) / unique.length
  const cy = unique.map((p) => p.y).reduce((a, b) => a + b, 0) / unique.length
  assert.ok(Math.abs(cx) < 1e-6, `centroid x should be ~0, got ${cx}`)
  assert.ok(Math.abs(cy) < 1e-6, `centroid y should be ~0, got ${cy}`)
})

// ---------- brush ----------

test('brush: passthrough returns the same points', () => {
  const input = [{ x: 1, y: 2 }, { x: 3, y: 4 }]
  const out = brush(input)
  assert.deepEqual(out, input)
})

test('brush: returns a copy, not the same array reference', () => {
  const input = [{ x: 1, y: 2 }]
  const out = brush(input)
  assert.notEqual(out, input) // different reference
})

test('brush: empty input returns empty array', () => {
  assert.deepEqual(brush([]), [])
})

// ---------- eraserHitTest ----------

test('eraserHitTest: returns index of a stroke within radius', () => {
  const strokes = [
    [{ x: 10, y: 10 }],
    [{ x: 100, y: 100 }],
  ]
  const hits = eraserHitTest(strokes, { x: 10, y: 10 }, 5)
  assert.deepEqual(hits, [0])
})

test('eraserHitTest: returns empty when no strokes are within radius', () => {
  const strokes = [[{ x: 50, y: 50 }]]
  const hits = eraserHitTest(strokes, { x: 0, y: 0 }, 5)
  assert.deepEqual(hits, [])
})

test('eraserHitTest: respects radius boundary (border point included)', () => {
  const strokes = [[{ x: 5, y: 0 }]]
  const hits = eraserHitTest(strokes, { x: 0, y: 0 }, 5)
  assert.deepEqual(hits, [0]) // distance is exactly 5 → within radius (<=)
})

test('eraserHitTest: point just outside radius is not hit', () => {
  const strokes = [[{ x: 6, y: 0 }]]
  const hits = eraserHitTest(strokes, { x: 0, y: 0 }, 5)
  assert.deepEqual(hits, [])
})

test('eraserHitTest: returns multiple indices when multiple strokes are hit', () => {
  const strokes = [
    [{ x: 1, y: 0 }],
    [{ x: 100, y: 100 }],
    [{ x: 2, y: 0 }],
  ]
  const hits = eraserHitTest(strokes, { x: 0, y: 0 }, 10)
  assert.deepEqual(hits, [0, 2])
})

test('eraserHitTest: accepts stroke objects with .points property', () => {
  const strokes = [
    { tool: 'brush', points: [{ x: 5, y: 0 }] },
    { tool: 'line',  points: [{ x: 100, y: 100 }] },
  ]
  const hits = eraserHitTest(strokes, { x: 0, y: 0 }, 10)
  assert.deepEqual(hits, [0])
})

test('eraserHitTest: any point within radius triggers the hit (multi-point stroke)', () => {
  const strokes = [
    [{ x: 100, y: 100 }, { x: 3, y: 0 }], // second point is near origin
  ]
  const hits = eraserHitTest(strokes, { x: 0, y: 0 }, 10)
  assert.deepEqual(hits, [0])
})
