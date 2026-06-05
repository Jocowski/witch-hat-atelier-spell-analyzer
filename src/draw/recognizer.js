// recognizer.js — the $P Point-Cloud Recognizer (Vatavu, Anthony & Wobbrock, ICMI 2012) plus the
// spell pipeline (ring → segment → core/border → de-rotate → classify → composition).
//
// PURE module: no JSON imports, no DOM. It takes raw strokes (arrays of {x,y}) and a list of
// templates, and returns the recognized symbols + a wha-spell@1 composition the engine can analyze.
// Keep it JSON-free so it stays trivially testable (mirrors the geometry.js/deduce.js convention).

import { analyzeRingClosure } from './ringClosure.js'
import { directedAxisFacing } from '../engine/geometry.js' // pure (no JSON) — safe under node --test

// Config source: all opts below (rotationSteps, gapK/gapMin/gapMax, cvThreshold/cvThresholdRelaxed,
// minRingRadius, floodFill/floodFillConfig, rasterMatch veto) are passed in by the caller
// (StudioPage) from rules.json `recognition`; the `?? <default>` fallbacks keep this module pure
// and runnable under node --test with no JSON import.

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

// P3 internal helper: same normalization as makeCloud but for an arbitrary n-point cloud.
// Used to build coarse descriptors at a configurable resolution without touching makeCloud's API.
function makeCloudN(name, points, n, weight = 1) {
  let p = resample(points.map((q) => P(q.X, q.Y, q.ID)), n)
  p = scaleToSquare(p); p = translateToOrigin(p)
  return { name, points: p, weight: weight > 0 ? weight : 1 }
}

// P3 internal helper: rotate a set of P-points ({X,Y,ID}) around the origin by deg degrees.
// Used to build the coarse input cloud at multiple coarse angles for rotation-tolerant pre-filter.
function rotateCloudPoints(points, deg) {
  const rad = (deg * Math.PI) / 180
  const co = Math.cos(rad), si = Math.sin(rad)
  return points.map((p) => ({ X: p.X * co - p.Y * si, Y: p.X * si + p.Y * co, ID: p.ID }))
}

/**
 * Build the recognizer's cloud objects once. Pure; safe under node --test.
 * Carries each template's `role` field through so P2 role-split can filter without
 * re-building. This is the cached, role-aware wrapper around makeCloud.
 *
 * P2 — Role-split pools are attached once as named properties so classifyAndRecognize
 * can pick the right subset per group without recomputing on every call:
 *   clouds.sigil — templates with role 'sigil' or 'core' (matched by core groups)
 *   clouds.sign  — templates with role 'sign' (matched by sign groups)
 * If a pool is empty the caller falls back to the full list.
 *
 * P3 — Each cloud also carries:
 *   cloud.coarse      — an n-point cloud (default 8) for the cheap pre-filter distance.
 *   cloud.strokeCount — number of distinct stroke IDs (cheap structural hint).
 *
 * @param {Array<{name, role, points, weight}>} templates
 * @param {number} [coarseN=8]  resolution for the coarse descriptor
 * @returns {Array<{name, role, weight, points, coarse, strokeCount}> & {sigil: Array, sign: Array}}
 */
export function buildClouds(templates, coarseN = 8) {
  const clouds = templates.map((t) => {
    const cloud = makeCloud(t.name, t.points, t.weight)
    cloud.role = t.role
    // P3: precompute coarse descriptor + stroke count (once per template change).
    cloud.coarse = makeCloudN(t.name, t.points, coarseN, t.weight)
    cloud.strokeCount = new Set(t.points.map((p) => p.ID)).size
    return cloud
  })
  // P2: partition into role pools — computed once per template change, not per group.
  clouds.sigil = clouds.filter((c) => c.role === 'sigil' || c.role === 'core')
  clouds.sign  = clouds.filter((c) => c.role === 'sign')
  return clouds
}

/**
 * P3 — Rank `clouds` by a cheap coarse-cloud distance to `inputCoarseByAngle` and return the
 * top-K clouds (by ascending best coarse distance).
 *
 * Rotation-tolerant: `inputCoarseByAngle` is an array of pre-rotated coarse clouds (each is an
 * object with a `.points` array at one coarse angle).  For each candidate cloud the score is the
 * minimum greedyMatch distance over all input angles, so a rotated sign is never penalised.
 *
 * @param {Array<{points: Array<{X,Y,ID}>}>} inputCoarseByAngle  coarse input at several angles
 * @param {Array}                            clouds               pool to rank (each has .coarse)
 * @param {number}                           K                    how many to return
 * @returns {Array}  the top-K clouds from `clouds`, sorted by ascending coarse score
 */
export function prefilter(inputCoarseByAngle, clouds, K) {
  if (!clouds.length) return []
  const scored = clouds.map((c) => {
    let best = Infinity
    for (const ic of inputCoarseByAngle) {
      const d = greedyMatch(ic.points, c.coarse)
      if (d < best) best = d
    }
    return { cloud: c, score: best }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, K).map((s) => s.cloud)
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

// ---------- adaptive gap ----------

/**
 * Compute the segmentation gap threshold from ring radius or a median nearest-neighbour fallback.
 *
 * @param {number|null} ringR   detected ring radius (null if no ring)
 * @param {Array}       strokes symbol strokes (after ring removal)
 * @param {object}      config  { gapK, gapMin, gapMax }
 * @returns {number}  gap in px
 */
export function computeAdaptiveGap(ringR, strokes, config = {}) {
  // Config source: rules.json recognition.gapK / gapMin / gapMax (injected via StudioPage).
  const gapK   = config.gapK   ?? 0.12
  const gapMin = config.gapMin ?? 14
  const gapMax = config.gapMax ?? 80

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

  if (ringR != null && ringR > 0) {
    return clamp(gapK * ringR, gapMin, gapMax)
  }

  // Fallback: median nearest-neighbour distance across strokes
  if (strokes.length < 2) return gapMin
  const distances = []
  for (let i = 0; i < strokes.length; i++) {
    let nearest = Infinity
    for (let j = 0; j < strokes.length; j++) {
      if (i !== j) {
        const d = minGap(strokes[i], strokes[j])
        if (d < nearest) nearest = d
      }
    }
    if (isFinite(nearest)) distances.push(nearest)
  }
  if (!distances.length) return gapMin
  distances.sort((a, b) => a - b)
  const median = distances[Math.floor(distances.length / 2)]
  return clamp(median * 0.9, gapMin, gapMax)
}

// ---------- rotation sweep (extracted, reusable) ----------

/**
 * Run recognize() over a rotation sweep and return the best single match.
 *
 * @param {Array<{x,y}>}  rawPoints  flat array of {x,y} (raw canvas coords, not clouded)
 * @param {Array}         clouds     prebuilt makeCloud() objects
 * @param {number[]}      steps      rotation offsets in degrees to try
 * @param {{cx?:number, cy?:number}} opts  pivot for rotation (default: centroid of rawPoints)
 * @returns {{ name, dist, adjDist, rotation } | null}
 */
export function bestMatchOverRotations(rawPoints, clouds, steps, opts = {}) {
  if (!clouds.length || !rawPoints.length) return null

  // Pivot: caller-supplied or centroid of rawPoints
  const pivot = (opts.cx != null && opts.cy != null)
    ? { x: opts.cx, y: opts.cy }
    : rawPoints.reduce(
        (acc, p) => ({ x: acc.x + p.x / rawPoints.length, y: acc.y + p.y / rawPoints.length }),
        { x: 0, y: 0 }
      )

  let best = null
  for (const deg of steps) {
    const rad = (deg * Math.PI) / 180
    const pts = []
    // rawPoints may carry an optional _id field (per-stroke ID for $P's multi-stroke aware path)
    rawPoints.forEach((p, idx) => {
      const rot = rotateStroke([{ x: p.x, y: p.y }], pivot.x, pivot.y, rad)[0]
      pts.push(P(rot.x, rot.y, p._id ?? idx))
    })
    const ranked = recognize(pts, clouds)
    if (ranked.length && (!best || ranked[0].adjDist < best.adjDist)) {
      best = { name: ranked[0].name, dist: ranked[0].dist, adjDist: ranked[0].adjDist, rotation: deg }
    }
  }
  return best
}

// ---------- variant metric extractors ----------

/**
 * Extract directionalMagnitude for a sign group by projecting the group's bounding strokes onto
 * the sign's facing axis (the direction the sign pushes), normalised by ringR.
 *
 * "Facing axis" is derived from `facingAngleDeg` (0 = up/north, 90 = east, etc.)
 * We project all points onto the axis vector and return (max − min) / ringR.
 *
 * @param {Array<Array<{x,y}>>} strokes  the group's raw strokes
 * @param {number} facingAngleDeg  sign's facing direction (deg, same convention as rotation field)
 * @param {number} ringR  ring radius in px (normalisation reference)
 * @returns {number}  directionalMagnitude ≥ 0
 */
export function extractAxisLengthAlongFacing(strokes, facingAngleDeg, ringR) {
  if (!strokes.length || ringR <= 0) return 1
  // Axis vector (unit): angle 0 = north = (0, -1); 90 = east = (1, 0)
  const rad = (facingAngleDeg * Math.PI) / 180
  const ax = Math.sin(rad), ay = -Math.cos(rad)

  const allPts = strokes.flat()
  if (allPts.length === 0) return 1

  let minProj = Infinity, maxProj = -Infinity
  for (const p of allPts) {
    const proj = p.x * ax + p.y * ay
    if (proj < minProj) minProj = proj
    if (proj > maxProj) maxProj = proj
  }

  const length = maxProj - minProj
  return length / ringR
}

// ---------- multi-ring helpers (Track 5 — SPEC-nested-linked.md) ----------

/**
 * Detect all ring-candidate strokes in the drawn set using the fast heuristic.
 * Returns an array of { cx, cy, r, cv, closed, strokeIndex } sorted by radius ascending.
 * Duplicate rings (two strokes that are really the same circle, drawn twice) are merged
 * by keeping only the larger when centers are within 50% of the smaller radius.
 *
 * @param {Array<Array<{x,y}>>} drawn    filtered strokes (length ≥ 2)
 * @param {number}              cvThresh max CV to accept as a ring
 * @param {number}              minR     minimum ring radius
 * @returns {Array}  ring descriptors, sorted radius ascending
 */
function detectAllRings(drawn, cvThresh, minR) {
  const candidates = []
  drawn.forEach((s, i) => {
    const cs = circleScore(s)
    if (cs.cv < cvThresh && cs.closed && cs.r >= minR) {
      candidates.push({ cx: cs.cx, cy: cs.cy, r: cs.r, cv: cs.cv, closed: true, strokeIndex: i })
    }
  })
  // De-duplicate: if two candidates are almost the same circle (drawn twice), keep the larger.
  // "Same circle" = centers are close AND radii are similar.
  //   • center distance < 0.5 * smaller r   (they're co-located)
  //   • radius ratio > 0.75                  (radii are within ~25% of each other)
  // Concentric circles (genuinely different radii, e.g. r=80 and r=200, ratio=0.4) are NOT deduped.
  const deduped = []
  for (const c of candidates) {
    const dup = deduped.findIndex((d) => {
      const centerClose = Math.hypot(d.cx - c.cx, d.cy - c.cy) < 0.5 * Math.min(d.r, c.r)
      const radiiSimilar = Math.min(d.r, c.r) / Math.max(d.r, c.r) > 0.75
      return centerClose && radiiSimilar
    })
    if (dup >= 0) {
      if (c.r > deduped[dup].r) deduped[dup] = c  // keep the larger
    } else {
      deduped.push(c)
    }
  }
  deduped.sort((a, b) => a.r - b.r)  // smallest first → id k0, k1, …
  return deduped
}

/**
 * Given a set of rings and a set of non-ring strokes, find link-candidate strokes:
 * those whose first AND last point each lie within `slack * ringRadius` of DIFFERENT ring
 * boundaries.  Returns { linkCandidates:[{a,b,stroke,strokeIndex}], consumed:Set<number> }.
 *
 * @param {Array}  rings           ring descriptors with .id, .cx, .cy, .r
 * @param {Array}  nonRingStrokes  [{stroke:[{x,y}], origIdx}]
 * @param {number} slack           linkEndpointSlack (fraction of ring radius)
 */
function extractLinkCandidates(rings, nonRingStrokes, slack) {
  const linkCandidates = []
  const consumed = new Set()

  for (const { stroke, origIdx } of nonRingStrokes) {
    if (stroke.length < 2) continue
    const p0 = stroke[0]
    const pN = stroke[stroke.length - 1]

    let nearA = null, nearB = null
    for (const ring of rings) {
      const tol = slack * ring.r
      if (Math.abs(Math.hypot(p0.x - ring.cx, p0.y - ring.cy) - ring.r) < tol) {
        nearA = nearA ?? ring.id
      }
      if (Math.abs(Math.hypot(pN.x - ring.cx, pN.y - ring.cy) - ring.r) < tol) {
        nearB = nearB ?? ring.id
      }
    }
    if (nearA && nearB && nearA !== nearB) {
      linkCandidates.push({ a: nearA, b: nearB, stroke, strokeIndex: origIdx })
      consumed.add(origIdx)
    }
  }
  return { linkCandidates, consumed }
}

/**
 * Assign each group (with centroid cx,cy) to its innermost enclosing ring.
 * Falls back to the nearest ring if the group centroid is outside all rings.
 * Mutates each group in place, adding .ringIndex.
 *
 * @param {Array}  groups      groups with .cx .cy
 * @param {Array}  rings       ring descriptors { cx, cy, r } (sorted by r ascending)
 * @param {number} slack       ringAssignSlack (fraction of ring radius, default 1.15)
 */
function assignGroupsToRings(groups, rings, slack) {
  if (!rings.length) {
    groups.forEach((g) => { g.ringIndex = 0 })
    return
  }
  groups.forEach((g) => {
    // candidates: rings whose center distance < radius * slack
    const candidates = rings.filter(
      (ring) => Math.hypot(g.cx - ring.cx, g.cy - ring.cy) < ring.r * slack
    )
    if (candidates.length) {
      // innermost = smallest radius among candidates
      const innermost = candidates.reduce((min, r) => (r.r < min.r ? r : min), candidates[0])
      g.ringIndex = rings.indexOf(innermost)
    } else {
      // fallback: nearest ring
      let nearestIdx = 0, nearestDist = Infinity
      rings.forEach((ring, ri) => {
        const d = Math.hypot(g.cx - ring.cx, g.cy - ring.cy)
        if (d < nearestDist) { nearestDist = d; nearestIdx = ri }
      })
      g.ringIndex = nearestIdx
    }
  })
}

/**
 * Extract nesting relations from the ring array.
 * A ring A (inner) is nested inside ring B (outer) when:
 *   dist(A.center, B.center) + A.r < B.r * nestCenterSlack
 *
 * @param {Array}  rings           ring descriptors with .id, .cx, .cy, .r (sorted by r ascending)
 * @param {number} nestCenterSlack fraction-of-outer-radius tolerance
 * @returns {Array}  relation objects { type:'nest', outer, inner }
 */
function extractNestRelations(rings, nestCenterSlack) {
  const relations = []
  for (let i = 0; i < rings.length; i++) {
    for (let j = i + 1; j < rings.length; j++) {
      const inner = rings[i]  // smaller r (sorted ascending)
      const outer = rings[j]
      const d = Math.hypot(inner.cx - outer.cx, inner.cy - outer.cy)
      if (d + inner.r < outer.r * nestCenterSlack) {
        relations.push({ type: 'nest', outer: outer.id, inner: inner.id })
      }
    }
  }
  return relations
}

// ---------- classify+recognize a group of strokes relative to a ring center ----------
// opts: { prefilterK, prefilterCoarsePoints } — P3 pre-filter settings (both optional with defaults)
function classifyAndRecognize(groups, center, effectiveRingR, rotationSteps, clouds, confidenceMinPct, opts = {}) {
  const prefilterK            = opts.prefilterK            ?? 15
  const prefilterCoarsePoints = opts.prefilterCoarsePoints ?? 8
  // Number of coarse angles to evaluate in the pre-filter (8 × 45° gives full rotation coverage).
  const COARSE_ANGLE_STEPS = 8

  const innerR = 0.45 * effectiveRingR
  groups.forEach((g) => { const c = cxy(g.pts); g.cx = c.x; g.cy = c.y; g.distC = Math.hypot(c.x - center.x, c.y - center.y) })
  groups.sort((a, b) => a.distC - b.distC)
  const core = groups.length && groups[0].distC < innerR ? groups[0] : null
  groups.forEach((g) => { g.role = g === core ? 'core' : 'sign' })

  // P2 — Role-split pools: a core group matches the sigil pool; a sign group matches the sign pool.
  // Fall back to the full cloud list when the selected pool is empty (covers sign-as-sigil cores
  // and any template set where a role bucket is unpopulated). Relies purely on cloud.role; no JSON import.
  const sigilPool = (clouds.sigil && clouds.sigil.length > 0) ? clouds.sigil : clouds
  const signPool  = (clouds.sign  && clouds.sign.length  > 0) ? clouds.sign  : clouds

  const sweep = Array.from({ length: rotationSteps }, (_, k) => k * (360 / rotationSteps))
  groups.forEach((g) => {
    g.angle = ((Math.atan2(g.cx - center.x, -(g.cy - center.y)) * 180) / Math.PI + 360) % 360
    const steps = g.role === 'core' ? [0] : sweep
    const pool  = g.role === 'core' ? sigilPool : signPool
    const rawPts = g.strokes.flatMap((s, strokeIdx) => s.map((p) => ({ x: p.x, y: p.y, _id: strokeIdx })))

    // P3 — Cheap pre-filter: if the pool is larger than K, rank by coarse distance first
    // and run the expensive sweep only on the top-K candidates.
    // Guard: skip pre-filter when pool.length <= K (no gain; also guarantees no regression on small sets).
    let matchPool = pool
    if (pool.length > prefilterK) {
      // Build the input coarse cloud (n=prefilterCoarsePoints) at COARSE_ANGLE_STEPS evenly-spaced
      // angles so the ranking is rotation-tolerant (a sign at any orientation is ranked correctly).
      const inputRaw = rawPts.map((p) => P(p.x, p.y, p._id ?? 0))
      let inputNorm = resample(inputRaw, prefilterCoarsePoints)
      inputNorm = scaleToSquare(inputNorm)
      inputNorm = translateToOrigin(inputNorm)
      const coarseAngles = Array.from({ length: COARSE_ANGLE_STEPS }, (_, k) => k * (360 / COARSE_ANGLE_STEPS))
      const inputCoarseByAngle = coarseAngles.map((deg) => ({
        points: deg === 0 ? inputNorm : rotateCloudPoints(inputNorm, deg),
      }))
      matchPool = prefilter(inputCoarseByAngle, pool, prefilterK)
    }

    g.match = bestMatchOverRotations(rawPts, matchPool, steps, { cx: g.cx, cy: g.cy })
    g.confidence = g.match ? confidencePct(g.match.dist) : 0
    g.confident = g.match ? g.confidence >= confidenceMinPct : false

    if (g.confident && g.match && g.role === 'sign' && effectiveRingR > 0) {
      // Facing from the DRAWN geometry (the sign's middle line), NOT match.rotation — the recognizer's
      // rotation is a template-alignment offset, not where the sign points (see einlair analysis).
      const geomFacing = directedAxisFacing(g.pts, center)
      if (geomFacing != null) g.facing = geomFacing
      const facingAngle = g.facing ?? g.match.rotation ?? 0
      const mag = extractAxisLengthAlongFacing(g.strokes, facingAngle, effectiveRingR)
      g.metrics = { directionalMagnitude: mag }
    }
  })
}

// ---------- the full pipeline ----------
// strokes: array of strokes; each stroke = array of {x,y} (canvas px).
// templates: [{ name, role, points:[{X,Y,ID}] }].  opts: { gap } stroke-merge threshold (px).
//
// Single-ring return (back-compat):
//   { ring, center, ringR, groups:[{role,cx,cy,angle,match,strokes}], composition,
//     rings:[…], ringGroups:[…], relations:[] }
// Multi-ring return (new):
//   { ring, center, ringR,           ← back-compat (largest ring)
//     rings:[…], ringGroups:[…],     ← per-ring descriptors + per-ring group arrays
//     groups:[…],                    ← ALL groups (each with .ringIndex)
//     relations:[{type,…}],          ← nest + link relations
//     composition }                  ← wha-spell@2 (single or multi)
export function analyzeStrokes(strokes, templates, opts = {}) {
  const confidenceMinPct = opts.confidenceMinPct ?? 0
  const cvThreshold = opts.cvThreshold ?? 0.3
  const cvThresholdRelaxed = opts.cvThresholdRelaxed ?? 0.45
  const minRingRadius = opts.minRingRadius ?? 40
  const useFloodFill = opts.floodFill !== false  // default true
  const floodFillConfig = opts.floodFillConfig ?? {}
  const rotationSteps = opts.rotationSteps ?? 24

  // Track 5 tolerance opts (defaulted here; caller reads from rules.json and passes in)
  const ringAssignSlack  = opts.ringAssignSlack  ?? 1.15
  const nestCenterSlack  = opts.nestCenterSlack  ?? 0.85
  const linkEndpointSlack = opts.linkEndpointSlack ?? 0.12

  // P3 pre-filter opts (defaulted here; actual values come from rules.json via caller)
  const prefilterK            = opts.prefilterK            ?? 15
  const prefilterCoarsePoints = opts.prefilterCoarsePoints ?? 8
  const p3Opts = { prefilterK, prefilterCoarsePoints }

  // Use prebuilt clouds if provided (P1 caching); otherwise build from templates (back-compat).
  const clouds = opts.clouds ?? buildClouds(templates ?? [])
  const drawn = strokes.filter((s) => s.length >= 2)
  if (!drawn.length) return { ring: null, center: { x: 0, y: 0 }, groups: [], rings: [], ringGroups: [], relations: [], composition: null }

  // ---------- PHASE 1: detect all ring candidates ----------
  const multiRings = detectAllRings(drawn, cvThreshold, minRingRadius)

  // Assign sequential ids k0, k1, …
  multiRings.forEach((r, i) => { r.id = `k${i}` })

  // ---- Single-ring path (legacy behavior preserved) ----
  if (multiRings.length <= 1) {
    // Use the existing single-ring logic (flood-fill confirmation etc.) for perfect back-compat.
    let ring = null, ringIdx = -1

    let fastRingCandidate = null, fastRingIdx = -1
    let relaxedRingCandidate = null, relaxedRingIdx = -1
    drawn.forEach((s, i) => {
      const cs = circleScore(s)
      if (cs.cv < cvThreshold && cs.closed && cs.r >= minRingRadius) {
        if (!fastRingCandidate || cs.r > fastRingCandidate.r) { fastRingCandidate = cs; fastRingIdx = i }
      }
      if (cs.cv < cvThresholdRelaxed && cs.r >= minRingRadius) {
        if (!relaxedRingCandidate || cs.r > relaxedRingCandidate.r) { relaxedRingCandidate = cs; relaxedRingIdx = i }
      }
    })

    if (fastRingCandidate && !useFloodFill) {
      ring = { ...fastRingCandidate, floodClosed: undefined, strokeIds: [fastRingIdx] }
      ringIdx = fastRingIdx
    } else if (useFloodFill) {
      const ffCfg = { ...floodFillConfig, minRadius: minRingRadius }
      if (fastRingCandidate) {
        const ffResult = analyzeRingClosure([drawn[fastRingIdx]], ffCfg)
        if (ffResult.closed) {
          ring = { cx: ffResult.cx, cy: ffResult.cy, r: ffResult.r, cv: fastRingCandidate.cv, closed: true, floodClosed: true, perfection: ffResult.perfection, strokeIds: ffResult.strokeIds.map(() => fastRingIdx) }
          ringIdx = fastRingIdx
        }
      }
      if (!ring && relaxedRingCandidate && relaxedRingIdx !== fastRingIdx) {
        const ffResult = analyzeRingClosure([drawn[relaxedRingIdx]], ffCfg)
        if (ffResult.closed) {
          ring = { cx: ffResult.cx, cy: ffResult.cy, r: ffResult.r, cv: relaxedRingCandidate.cv, closed: true, floodClosed: true, perfection: ffResult.perfection, strokeIds: [relaxedRingIdx] }
          ringIdx = relaxedRingIdx
        }
      }
      if (!ring && drawn.length > 1) {
        const ffResult = analyzeRingClosure(drawn, ffCfg)
        if (ffResult.closed) {
          ringIdx = ffResult.strokeIds.length > 0 ? ffResult.strokeIds[0] : -1
          ring = { cx: ffResult.cx, cy: ffResult.cy, r: ffResult.r, cv: 0, closed: true, floodClosed: true, perfection: ffResult.perfection, strokeIds: ffResult.strokeIds }
        }
      }
      if (!ring && fastRingCandidate) {
        ring = { ...fastRingCandidate, floodClosed: false, strokeIds: [fastRingIdx] }
        ringIdx = fastRingIdx
      }
    }

    let center, ringR
    if (ring) { center = { x: ring.cx, y: ring.cy }; ringR = ring.r } else { center = cxy(drawn.flat()); ringR = null }

    const symStrokes = drawn.filter((_, i) => i !== ringIdx)
    let gap
    if (opts.gap != null) {
      gap = opts.gap
    } else if (opts.adaptiveGap) {
      gap = computeAdaptiveGap(ringR, symStrokes, { gapK: opts.gapK, gapMin: opts.gapMin, gapMax: opts.gapMax })
    } else {
      gap = 45
    }

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

    const effectiveRingR = ringR ?? 200
    classifyAndRecognize(groups, center, effectiveRingR, rotationSteps, clouds, confidenceMinPct, p3Opts)

    // Single ring descriptor for ringGroups
    const singleRingDesc = ring ? { cx: ring.cx, cy: ring.cy, r: ring.r, closed: true, id: 'k0' } : null
    const rings = singleRingDesc ? [singleRingDesc] : []
    groups.forEach((g) => { g.ringIndex = 0 })
    const ringGroups = rings.length
      ? [{ ring: singleRingDesc, groups: groups.slice() }]
      : [{ ring: null, groups: groups.slice() }]

    return {
      ring, center, ringR: effectiveRingR,
      rings, ringGroups,
      groups,
      relations: [],
      composition: buildComposition(groups, center, ring),
    }
  }

  // ---------- PHASE 2 (multi-ring): link-candidate extraction ----------
  const ringStrokeIndices = new Set(multiRings.map((r) => r.strokeIndex))
  const nonRingStrokes = drawn
    .map((s, i) => ({ stroke: s, origIdx: i }))
    .filter(({ origIdx }) => !ringStrokeIndices.has(origIdx))

  const { linkCandidates, consumed } = extractLinkCandidates(multiRings, nonRingStrokes, linkEndpointSlack)

  // ---------- PHASE 3: symbol grouping (excluding link strokes) ----------
  const symStrokesMR = nonRingStrokes.filter(({ origIdx }) => !consumed.has(origIdx)).map(({ stroke }) => stroke)

  let gap
  if (opts.gap != null) {
    gap = opts.gap
  } else if (opts.adaptiveGap) {
    // Use the largest ring's radius as the reference for the global gap
    const refR = multiRings[multiRings.length - 1].r
    gap = computeAdaptiveGap(refR, symStrokesMR, { gapK: opts.gapK, gapMin: opts.gapMin, gapMax: opts.gapMax })
  } else {
    gap = 45
  }

  let allGroups = symStrokesMR.map((s) => ({ strokes: [s], pts: s.slice() }))
  let mergedMR = true
  while (mergedMR) {
    mergedMR = false
    outer2: for (let i = 0; i < allGroups.length; i++) for (let j = i + 1; j < allGroups.length; j++) {
      if (minGap(allGroups[i].pts, allGroups[j].pts) < gap) {
        allGroups[i].strokes.push(...allGroups[j].strokes); allGroups[i].pts = allGroups[i].pts.concat(allGroups[j].pts); allGroups.splice(j, 1); mergedMR = true; break outer2
      }
    }
  }

  // Compute group centroids before ring assignment
  allGroups.forEach((g) => { const c = cxy(g.pts); g.cx = c.x; g.cy = c.y })

  // Assign groups to rings
  assignGroupsToRings(allGroups, multiRings, ringAssignSlack)

  // ---------- PHASE 4: per-ring classification + recognition ----------
  const ringGroups = multiRings.map((ring, ri) => {
    const myGroups = allGroups.filter((g) => g.ringIndex === ri)
    const center = { x: ring.cx, y: ring.cy }
    const effectiveRingR = ring.r
    classifyAndRecognize(myGroups, center, effectiveRingR, rotationSteps, clouds, confidenceMinPct, p3Opts)
    return { ring: { cx: ring.cx, cy: ring.cy, r: ring.r, closed: ring.closed, id: ring.id }, groups: myGroups }
  })

  // ---------- PHASE 5: relation extraction ----------
  const nestRelations = extractNestRelations(multiRings, nestCenterSlack)
  const linkRelations = linkCandidates.map(({ a, b }) => ({ type: 'link', a, b }))
  const relations = [...nestRelations, ...linkRelations]

  // ---------- PHASE 6: build multi-circle composition ----------
  // Back-compat: the largest ring becomes the primary ring / center for legacy callers
  const primaryRing = multiRings[multiRings.length - 1]
  const legacyRing = { cx: primaryRing.cx, cy: primaryRing.cy, r: primaryRing.r, closed: primaryRing.closed }
  const legacyCenter = { x: primaryRing.cx, y: primaryRing.cy }

  const composition = buildMultiRingComposition(ringGroups, relations)

  return {
    // Back-compat legacy fields (largest ring)
    ring: legacyRing,
    center: legacyCenter,
    ringR: primaryRing.r,
    // New multi-ring fields
    rings: multiRings.map(({ id, cx, cy, r, closed }) => ({ id, cx, cy, r, closed })),
    ringGroups,
    groups: allGroups,
    relations,
    composition,
  }
}

/**
 * Build a wha-spell@2 multi-circle composition from per-ring groups + relations.
 * Each circle's component coordinates are relative to THAT ring's center.
 *
 * @param {Array}  ringGroups  [{ ring:{cx,cy,r,closed,id}, groups:[…] }]
 * @param {Array}  relations   nest/link relation objects
 */
function buildMultiRingComposition(ringGroups, relations) {
  const circles = ringGroups.map(({ ring, groups }) => {
    // Center for this circle in world coords
    const cx = ring.cx, cy = ring.cy
    const coreGroup = groups.find((g) => g.role === 'core' && g.match)
    const core = coreGroup ? {
      id: coreGroup.match.name,
      type: coreGroup.match.name,
      x: Math.round(coreGroup.cx - cx),
      y: Math.round(coreGroup.cy - cy),
      rotation: 0, scale: 1, inverted: false,
    } : null
    const components = groups
      .filter((g) => g.role === 'sign' && g.match)
      .map((g) => ({
        type: g.match.name, role: 'sign',
        x: Math.round(g.cx - cx),
        y: Math.round(g.cy - cy),
        rotation: g.match.rotation, scale: 1, inverted: false,
        ...(g.metrics ? { metrics: g.metrics } : {}),
      }))
    return {
      id: ring.id,
      center: { x: Math.round(cx), y: Math.round(cy) },
      radius: Math.round(ring.r),
      ring: { closed: !!ring.closed },
      core,
      components,
      dyes: [],
    }
  })

  return {
    format: 'wha-spell@2',
    name: '',
    circles,
    relations,
  }
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
      ...(g.metrics ? { metrics: g.metrics } : {}),
    })),
    dyes: [],
  }
}

/**
 * Merge several analyzed groups into ONE, re-recognizing the combined strokes.
 *
 * The segmentation step can over-split a single hand-drawn symbol into multiple groups when its
 * strokes sit farther apart than the adaptive gap (e.g. one "levitation" read as three). This lets
 * the UI stitch those groups back together: it concatenates their strokes, recomputes the centroid,
 * and runs the de-rotation sweep over the combined shape so the result carries a fresh match +
 * confidence. The merged group keeps `role:'core'` if ANY input was a core, else `'sign'`, and
 * inherits the first group's ringIndex.
 *
 * PURE: clouds are passed in (built by the caller from templates). When no clouds are available the
 * first group's existing match is preserved so the merge still collapses the rows.
 *
 * @param {Array}  groups   ≥2 analyzed groups ({ strokes, pts, role, ringIndex, angle, match })
 * @param {Array}  clouds   prebuilt makeCloud() objects
 * @param {object} opts     { rotationSteps=24, confidenceMinPct=0 }
 * @returns {object|null}   the merged group, or null if fewer than 2 groups given
 */
export function mergeGroups(groups, clouds = [], opts = {}) {
  if (!Array.isArray(groups) || groups.length < 2) return null
  const rotationSteps = opts.rotationSteps ?? 24
  const confidenceMinPct = opts.confidenceMinPct ?? 0

  const strokes = groups.flatMap((g) => g.strokes)
  const pts = strokes.flat().map((p) => ({ x: p.x, y: p.y }))
  const c = cxy(pts)
  const role = groups.some((g) => g.role === 'core') ? 'core' : 'sign'

  let match
  if (clouds.length) {
    const steps = role === 'core' ? [0] : Array.from({ length: rotationSteps }, (_, k) => k * (360 / rotationSteps))
    const rawPts = strokes.flatMap((s, si) => s.map((p) => ({ x: p.x, y: p.y, _id: si })))
    match = bestMatchOverRotations(rawPts, clouds, steps, { cx: c.x, cy: c.y })
  } else {
    match = groups.find((g) => g.match)?.match ?? null
  }

  const confidence = match ? confidencePct(match.dist) : 0
  return {
    strokes,
    pts,
    cx: c.x,
    cy: c.y,
    role,
    angle: groups[0].angle,
    ringIndex: groups[0].ringIndex ?? 0,
    match,
    confidence,
    confident: match ? confidence >= confidenceMinPct : false,
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
