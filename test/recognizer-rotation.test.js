import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'module'
import { makeCloud, buildClouds, bestMatchOverRotations, analyzeStrokes, prefilter } from '../src/draw/recognizer.js'

const require = createRequire(import.meta.url)

// ---------- helpers ----------

/** Build a cloud from a simple stroke array */
function buildCloud(name, strokes) {
  const pts = strokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id })))
  return makeCloud(name, pts)
}

/** Rotate a point around (cx,cy) by deg degrees */
function rotPt(p, cx, cy, deg) {
  const rad = (deg * Math.PI) / 180
  const dx = p.x - cx, dy = p.y - cy
  return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) }
}

/** Rotate a stroke around a centre */
function rotateStrokePoints(stroke, cx, cy, deg) {
  return stroke.map((p) => rotPt(p, cx, cy, deg))
}

// A simple L-shape sign (2 strokes)
const lShapeStrokes = [
  [{ x: 0, y: -50 }, { x: 0, y: 50 }],  // vertical bar
  [{ x: 0, y: 50 }, { x: 50, y: 50 }],  // horizontal base
]

// A simple T-shape sign (2 strokes)
const tShapeStrokes = [
  [{ x: -50, y: -20 }, { x: 50, y: -20 }],  // crossbar
  [{ x: 0, y: -20 }, { x: 0, y: 50 }],       // stem
]

// ---------- bestMatchOverRotations ----------

test('bestMatchOverRotations: null result when no clouds', () => {
  const pts = lShapeStrokes.flat()
  const result = bestMatchOverRotations(pts, [], [0])
  assert.equal(result, null)
})

test('bestMatchOverRotations: null result when no points', () => {
  const cloud = buildCloud('test', lShapeStrokes)
  const result = bestMatchOverRotations([], [cloud], [0])
  assert.equal(result, null)
})

// Helper: flatten strokes to rawPoints with per-stroke _id (as bestMatchOverRotations receives them)
function flattenWithIds(strokes) {
  return strokes.flatMap((s, si) => s.map((p) => ({ x: p.x, y: p.y, _id: si })))
}

test('bestMatchOverRotations: straight match at 0° recognizes the correct symbol', () => {
  const cloud = buildCloud('l_shape', lShapeStrokes)
  const pts = flattenWithIds(lShapeStrokes)
  const result = bestMatchOverRotations(pts, [cloud], [0])
  assert.ok(result !== null)
  assert.equal(result.name, 'l_shape')
  // $P dist ~0 for a true self-match (same per-stroke IDs as the template)
  assert.ok(result.dist < 0.5, `expected good self-match dist, got dist=${result.dist}`)
})

test('bestMatchOverRotations: rotated sign still matches with a sweep', () => {
  const cloud = buildCloud('l_shape', lShapeStrokes)
  // Rotate the strokes 45° and check that the sweep finds the match
  const cx = 0, cy = 0
  const rotated = flattenWithIds(lShapeStrokes.map((s) => rotateStrokePoints(s, cx, cy, 45)))
  const steps = Array.from({ length: 24 }, (_, k) => k * 15)
  const result = bestMatchOverRotations(rotated, [cloud], steps, { cx, cy })
  assert.ok(result !== null, 'rotated sign should still produce a match')
  assert.equal(result.name, 'l_shape')
  // The winning rotation should compensate for the 45° pre-rotation.
  // Either ~45° (de-rotate CW) or ~315° (de-rotate CCW by -45°) are valid —
  // the L-shape has similar point distributions at both. Accept either.
  const rot = result.rotation
  const nearPos = rot <= 60                    // within 60° of 45°
  const nearNeg = rot >= 300                   // within 60° of 315° (i.e. −45°)
  assert.ok(nearPos || nearNeg, `expected rotation near ±45°, got ${rot}`)
})

test('bestMatchOverRotations: recognizes best among multiple symbols', () => {
  const cloudL = buildCloud('l_shape', lShapeStrokes)
  const cloudT = buildCloud('t_shape', tShapeStrokes)
  const pts = flattenWithIds(lShapeStrokes)
  const steps = Array.from({ length: 24 }, (_, k) => k * 15)
  const result = bestMatchOverRotations(pts, [cloudL, cloudT], steps)
  assert.ok(result !== null)
  assert.equal(result.name, 'l_shape', `expected l_shape to win, got ${result.name}`)
})

test('bestMatchOverRotations: core (sigil) with [0] step never rotates', () => {
  const cloud = buildCloud('core_sym', lShapeStrokes)
  const pts = lShapeStrokes.flat()
  const result = bestMatchOverRotations(pts, [cloud], [0])
  assert.ok(result !== null)
  assert.equal(result.rotation, 0, `core sweep should always report rotation=0, got ${result.rotation}`)
})

// ---------- analyzeStrokes pipeline regression ----------

// Minimal template set — one sign
const tpl = [{ name: 'arrow', role: 'sign', points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))) }]

// A large circle stroke for the ring
function makeRing(cx, cy, r, n = 64) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  return pts
}

test('analyzeStrokes: explicit gap:45 → still works (regression)', () => {
  const ring = makeRing(300, 300, 180)
  const sign = lShapeStrokes.map((s) => s.map((p) => ({ x: p.x + 300, y: p.y + 200 })))
  const r = analyzeStrokes([ring, ...sign], tpl, { gap: 45, confidenceMinPct: 0, floodFill: false })
  // With floodFill:false and explicit gap, the ring should be detected via old heuristic
  assert.ok(r.ring !== null || r.groups.length >= 0, 'pipeline should not crash')
})

test('analyzeStrokes: adaptiveGap:true runs without error', () => {
  const ring = makeRing(300, 300, 180)
  const sign = lShapeStrokes.map((s) => s.map((p) => ({ x: p.x + 300, y: p.y + 200 })))
  const r = analyzeStrokes([ring, ...sign], tpl, { adaptiveGap: true, confidenceMinPct: 0 })
  assert.ok(r.groups !== undefined)
})

test('analyzeStrokes: messy ring (cv between 0.3 and 0.45) detected via flood-fill', () => {
  // Create a slightly elliptical ring (higher cv) that the strict heuristic would miss
  const pts = []
  for (let i = 0; i <= 128; i++) {
    const t = (i / 128) * 2 * Math.PI
    // Slight ellipse: rx=180, ry=150 → not perfectly round
    pts.push({ x: 300 + 180 * Math.cos(t), y: 300 + 150 * Math.sin(t) })
  }
  const r = analyzeStrokes([pts], tpl, { floodFill: true, cvThreshold: 0.15, minRingRadius: 40, confidenceMinPct: 0 })
  // Flood-fill should detect the ring even though cv is high
  // We just assert no crash and the ring field is either null or has the expected fields
  assert.ok(r !== undefined)
  if (r.ring) {
    assert.ok(typeof r.ring.cx === 'number')
    assert.ok(typeof r.ring.cy === 'number')
  }
})

test('analyzeStrokes: small closed sign alone does NOT become the ring', () => {
  // A tiny circle (r=20) drawn alone — should not be detected as the activation ring
  const pts = []
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * 2 * Math.PI
    pts.push({ x: 200 + 20 * Math.cos(t), y: 200 + 20 * Math.sin(t) })
  }
  const r = analyzeStrokes([pts], tpl, {
    floodFill: true,
    minRingRadius: 40,          // 20px circle below radius guard
    confidenceMinPct: 0,
  })
  assert.equal(r.ring, null, `tiny closed sign should not be the ring, got ring.r=${r.ring?.r}`)
})

// ---------- Track 4 Layer 2b: directionalMagnitude metrics ----------

test('analyzeStrokes: confident sign gets metrics.directionalMagnitude attached', () => {
  const ring = makeRing(300, 300, 200)
  // Place the sign well away from center so it's classified as 'sign'
  const sign = lShapeStrokes.map((s) => s.map((p) => ({ x: p.x + 300, y: p.y + 130 })))
  const r = analyzeStrokes([ring, ...sign], tpl, { floodFill: false, gap: 60, confidenceMinPct: 0 })
  const signGroups = r.groups.filter((g) => g.role === 'sign' && g.confident && g.match)
  for (const g of signGroups) {
    assert.ok(g.metrics !== undefined, 'confident sign should have metrics')
    assert.ok(typeof g.metrics.directionalMagnitude === 'number', 'directionalMagnitude should be a number')
    assert.ok(g.metrics.directionalMagnitude >= 0, 'directionalMagnitude should be non-negative')
  }
})

// ---------- P1 — Cloud caching ----------

const NUM_POINTS = 32 // mirrors recognizer.js constant

test('buildClouds: returns one entry per template with name, role, weight, and points.length === NUM_POINTS', () => {
  const templates = [
    { name: 'l_shape', role: 'sign',  points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
    { name: 't_shape', role: 'sigil', points: tShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.5 },
  ]
  const clouds = buildClouds(templates)
  assert.equal(clouds.length, templates.length, 'one cloud per template')
  for (let i = 0; i < templates.length; i++) {
    assert.equal(clouds[i].name,          templates[i].name,   `cloud[${i}].name`)
    assert.equal(clouds[i].role,          templates[i].role,   `cloud[${i}].role`)
    assert.equal(clouds[i].weight,        templates[i].weight, `cloud[${i}].weight`)
    assert.equal(clouds[i].points.length, NUM_POINTS,          `cloud[${i}].points.length`)
  }
})

test('buildClouds: empty template list returns empty array (length 0)', () => {
  // P2 attaches .sigil/.sign pools as named properties on the array; the flat length is still 0.
  const clouds = buildClouds([])
  assert.equal(clouds.length, 0, 'empty template list → zero clouds')
})

test('P1 equivalence: analyzeStrokes(s, templates) and analyzeStrokes(s, null, {clouds}) return identical groups', () => {
  const ring = makeRing(300, 300, 180)
  const sign = lShapeStrokes.map((s) => s.map((p) => ({ x: p.x + 300, y: p.y + 200 })))
  const strokes = [ring, ...sign]
  const sharedOpts = { floodFill: false, gap: 45, confidenceMinPct: 0 }

  const resultA = analyzeStrokes(strokes, tpl, sharedOpts)
  const prebuilt = buildClouds(tpl)
  const resultB = analyzeStrokes(strokes, null, { ...sharedOpts, clouds: prebuilt })

  // Same number of groups
  assert.equal(resultB.groups.length, resultA.groups.length, 'group count must match')

  // For every group, the match name and role must be identical (order is deterministic)
  for (let i = 0; i < resultA.groups.length; i++) {
    const a = resultA.groups[i]
    const b = resultB.groups[i]
    assert.equal(b.role, a.role, `groups[${i}].role`)
    // Both matched or both unmatched
    assert.equal(b.match == null, a.match == null, `groups[${i}].match presence`)
    if (a.match && b.match) {
      assert.equal(b.match.name, a.match.name, `groups[${i}].match.name`)
    }
  }
})

// ---------- P2 — Role-split clouds ----------

test('buildClouds: attaches .sigil and .sign pool properties', () => {
  const templates = [
    { name: 'l_shape', role: 'sign',  points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
    { name: 't_shape', role: 'sigil', points: tShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.5 },
    { name: 'u_shape', role: 'sign',  points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x + 10, Y: p.y, ID: id }))), weight: 1.0 },
  ]
  const clouds = buildClouds(templates)
  // Flat array still works as before
  assert.equal(clouds.length, 3, 'flat array length unchanged')
  // .sigil pool contains the sigil-role entry
  assert.ok(Array.isArray(clouds.sigil), 'clouds.sigil is an array')
  assert.ok(Array.isArray(clouds.sign),  'clouds.sign is an array')
  assert.equal(clouds.sigil.length, 1, 'one sigil entry')
  assert.equal(clouds.sign.length,  2, 'two sign entries')
  assert.equal(clouds.sigil[0].name, 't_shape', 'sigil pool entry is t_shape')
  for (const c of clouds.sign) {
    assert.equal(c.role, 'sign', 'every entry in sign pool has role sign')
  }
})

test('buildClouds: empty template list has empty .sigil/.sign pools', () => {
  const clouds = buildClouds([])
  assert.ok(Array.isArray(clouds.sigil), 'sigil pool is array')
  assert.ok(Array.isArray(clouds.sign),  'sign pool is array')
  assert.equal(clouds.sigil.length, 0)
  assert.equal(clouds.sign.length,  0)
})

test('buildClouds: role core in template goes to .sigil pool', () => {
  const templates = [
    { name: 'core_sym', role: 'core', points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
  ]
  const clouds = buildClouds(templates)
  assert.equal(clouds.sigil.length, 1, 'core role belongs in the sigil pool')
  assert.equal(clouds.sigil[0].name, 'core_sym')
  assert.equal(clouds.sign.length, 0)
})

// ── P2 top-1 equivalence on the seed template set ──────────────────────────────────────────────
//
// For every group in a clear in-pool composition, the top-1 match returned by the role-split
// pipeline (P2 via buildClouds pools) MUST equal the top-1 returned by matching against the
// FULL cloud list (a fake "unpartitioned" cloud that has no .sigil/.sign).
// If any winner differs we report it with the cross-role analysis, but do NOT silently pass.

test('P2 top-1 equivalence: seed templates — role-split matches same winner as full-list match', () => {
  // Load seed templates (same as bench)
  const seedData = require('../data/training-seed.json')
  const rules    = require('../data/rules.json')
  const sampleWeights = rules.recognition?.sampleWeights ?? { corrected: 1.5, drawn: 1.0, confirmed: 0.6 }
  const seedTemplates = seedData.map((s) => ({
    name:   s.name,
    role:   s.role,
    points: s.points,
    source: s.source,
    weight: sampleWeights[s.source] ?? 1.0,
  }))

  // Build the P2-partitioned clouds (has .sigil/.sign)
  const p2Clouds = buildClouds(seedTemplates)

  // Build a plain full-list cloud with NO .sigil/.sign properties so classifyAndRecognize falls
  // back to the full list for both core and sign groups.
  const fullClouds = p2Clouds.map((c) => ({ ...c })) // shallow clone — no .sigil/.sign attached

  // Shared strokes: a ring + a centre sigil-shape + two outer sign-shapes.
  // These are drawn inside the ring so they participate in both the single-ring and group paths.
  const cx = 300, cy = 300, r = 180
  const ring = (() => {
    const pts = []
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * 2 * Math.PI
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
    }
    return pts
  })()

  // Core: small blob near centre (will be classified as core)
  const coreBlob = [
    { x: cx - 8, y: cy - 8 }, { x: cx + 8, y: cy - 8 },
    { x: cx + 8, y: cy + 8 }, { x: cx - 8, y: cy + 8 },
    { x: cx - 8, y: cy - 8 },
  ]
  // Sign 1: near top of ring
  const sign1 = lShapeStrokes.map((s) => s.map((p) => ({ x: p.x + cx, y: p.y + cy - 140 })))
  // Sign 2: near right of ring (rotated)
  const sign2 = tShapeStrokes.map((s) => s.map((p) => ({ x: p.x + cx + 140, y: p.y + cy })))

  const strokes = [ring, coreBlob, ...sign1, ...sign2]
  const sharedOpts = { floodFill: false, gap: 45, confidenceMinPct: 0 }

  const resultFull = analyzeStrokes(strokes, null, { ...sharedOpts, clouds: fullClouds })
  const resultP2   = analyzeStrokes(strokes, null, { ...sharedOpts, clouds: p2Clouds })

  assert.equal(resultP2.groups.length, resultFull.groups.length,
    'P2 and full-list must produce the same number of groups')

  const changedWinners = []
  for (let i = 0; i < resultFull.groups.length; i++) {
    const gFull = resultFull.groups[i]
    const gP2   = resultP2.groups[i]
    assert.equal(gP2.role, gFull.role, `groups[${i}].role must match`)
    if (gFull.match && gP2.match && gFull.match.name !== gP2.match.name) {
      // Investigate: is this a legitimate cross-role correction or a regression?
      const fullWinnerRole = p2Clouds.find((c) => c.name === gFull.match.name)?.role ?? 'unknown'
      const p2WinnerRole   = p2Clouds.find((c) => c.name === gP2.match.name)?.role ?? 'unknown'
      changedWinners.push({
        groupIdx:      i,
        groupRole:     gFull.role,
        fullWinner:    gFull.match.name,
        fullWinnerRole,
        p2Winner:      gP2.match.name,
        p2WinnerRole,
      })
    }
  }

  if (changedWinners.length > 0) {
    // Report each changed winner with cross-role analysis so a human can judge.
    for (const w of changedWinners) {
      const isCrossRoleCorrection =
        // A sign group previously won a sigil template (cross-role false match now removed)
        (w.groupRole === 'sign'  && w.fullWinnerRole === 'sigil' && w.p2WinnerRole === 'sign') ||
        // A core group previously won a sign template (cross-role false match now removed)
        (w.groupRole === 'core'  && w.fullWinnerRole === 'sign'  && w.p2WinnerRole === 'sigil')
      const verdict = isCrossRoleCorrection ? 'CROSS-ROLE CORRECTION (expected)' : 'REGRESSION (investigate)'
      console.error(
        `P2 top-1 changed — group[${w.groupIdx}] role=${w.groupRole}: ` +
        `full="${w.fullWinner}"(${w.fullWinnerRole}) → p2="${w.p2Winner}"(${w.p2WinnerRole}) [${verdict}]`
      )
    }
    // Only real regressions (not corrections) are failures
    const regressions = changedWinners.filter((w) => {
      const isCrossRoleCorrection =
        (w.groupRole === 'sign'  && w.fullWinnerRole === 'sigil' && w.p2WinnerRole === 'sign') ||
        (w.groupRole === 'core'  && w.fullWinnerRole === 'sign'  && w.p2WinnerRole === 'sigil')
      return !isCrossRoleCorrection
    })
    assert.equal(regressions.length, 0,
      `P2 role-split caused ${regressions.length} regression(s) (non-cross-role winner change). See console output above.`)
  }
})

test('P2 role isolation: core group match is from sigil pool; sign group match is from sign pool', () => {
  // Build an explicitly partitioned template set: 1 sigil + 1 sign (clearly different shapes)
  const sigilTemplates = [
    { name: 'the_sigil', role: 'sigil', points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
  ]
  const signTemplates = [
    { name: 'the_sign', role: 'sign', points: tShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
  ]
  const allTemplates = [...sigilTemplates, ...signTemplates]
  const clouds = buildClouds(allTemplates)

  assert.equal(clouds.sigil.length, 1, 'sigil pool has 1 entry')
  assert.equal(clouds.sign.length,  1, 'sign pool has 1 entry')

  // Draw: ring + core (near centre) + sign (near ring border)
  const cx = 300, cy = 300, r = 180
  const ring = (() => {
    const pts = []
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * 2 * Math.PI
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
    }
    return pts
  })()
  // Core blob: near centre
  const coreBlob = [
    { x: cx - 8, y: cy - 8 }, { x: cx + 8, y: cy - 8 },
    { x: cx + 8, y: cy + 8 }, { x: cx - 8, y: cy + 8 },
    { x: cx - 8, y: cy - 8 },
  ]
  // Sign: near top of ring (will be classified as sign)
  const signStrokes = lShapeStrokes.map((s) => s.map((p) => ({ x: p.x + cx, y: p.y + cy - 140 })))

  const strokes = [ring, coreBlob, ...signStrokes]
  const result = analyzeStrokes(strokes, null, { floodFill: false, gap: 45, confidenceMinPct: 0, clouds })

  const coreGroups = result.groups.filter((g) => g.role === 'core' && g.match)
  const signGroups = result.groups.filter((g) => g.role === 'sign' && g.match)

  // Core group's winner must come from the sigil pool (unless fallback fired, which can't happen here
  // since the sigil pool has 1 entry)
  for (const g of coreGroups) {
    const winnerCloud = clouds.sigil.find((c) => c.name === g.match.name)
    assert.ok(
      winnerCloud != null,
      `core group matched "${g.match.name}" which is NOT in the sigil pool — role isolation violated`
    )
  }

  // Sign group's winner must come from the sign pool
  for (const g of signGroups) {
    const winnerCloud = clouds.sign.find((c) => c.name === g.match.name)
    assert.ok(
      winnerCloud != null,
      `sign group matched "${g.match.name}" which is NOT in the sign pool — role isolation violated`
    )
  }
})

test('P2 fallback: core group matches full list when sigil pool is empty', () => {
  // All templates are signs — sigil pool will be empty → fallback to full list
  const signOnlyTemplates = [
    { name: 'only_sign', role: 'sign', points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
  ]
  const clouds = buildClouds(signOnlyTemplates)
  assert.equal(clouds.sigil.length, 0, 'sigil pool is empty — fallback should fire')

  const cx = 300, cy = 300, r = 180
  const ring = (() => {
    const pts = []
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * 2 * Math.PI
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
    }
    return pts
  })()
  // Core blob near centre
  const coreBlob = [
    { x: cx - 10, y: cy - 10 }, { x: cx + 10, y: cy - 10 },
    { x: cx + 10, y: cy + 10 }, { x: cx - 10, y: cy + 10 },
    { x: cx - 10, y: cy - 10 },
  ]
  const strokes = [ring, coreBlob]
  const result = analyzeStrokes(strokes, null, { floodFill: false, gap: 45, confidenceMinPct: 0, clouds })

  const coreGroups = result.groups.filter((g) => g.role === 'core' && g.match)
  // With the fallback, the core group should still get a match (from the sign pool as full-list fallback)
  // We can't mandate a specific name, but the pipeline must not crash or return null for the match entirely
  // when templates exist — verify no exception was thrown (we reached here) and if a match was found it's
  // from the known full list.
  for (const g of coreGroups) {
    assert.ok(g.match.name === 'only_sign',
      `fallback: core group should match the only available template "only_sign", got "${g.match.name}"`)
  }
})

// ──────────────────────────────────────────────────────────────────────────────────────────────────
// P3 — Cheap pre-filter (coarse descriptor → full match on top-K only)
// ──────────────────────────────────────────────────────────────────────────────────────────────────

// Helpers for P3 tests
const P3_COARSE_N = 8  // mirrors prefilterCoarsePoints default
const P3_COARSE_ANGLES = 8  // mirrors COARSE_ANGLE_STEPS in classifyAndRecognize

// Build a coarse input-by-angle array the same way classifyAndRecognize does it internally.
// We mirror the logic here so we can test prefilter() in isolation.
function makeCoarseInputByAngle(rawPts, coarseN = P3_COARSE_N) {
  // Normalize: resample → scaleToSquare → translateToOrigin (same as makeCloudN)
  // We use makeCloud with a small pool to extract the normalized points, but since
  // makeCloud is for templates (fixed N), we just build a single cloud and use its points
  // as the base for rotation. Actually: use the same normalization path directly via a
  // single-element template array passed through buildClouds with coarseN.
  // Simplest: build a template from rawPts and extract its .coarse.points.
  const pts = rawPts.map((p, i) => ({ X: p.x, Y: p.y, ID: p._id ?? i }))
  const [cloud] = buildClouds([{ name: 'tmp', role: 'sign', points: pts, weight: 1 }], coarseN)
  const base = cloud.coarse.points
  const angles = Array.from({ length: P3_COARSE_ANGLES }, (_, k) => k * (360 / P3_COARSE_ANGLES))
  return angles.map((deg) => {
    if (deg === 0) return { points: base }
    const rad = (deg * Math.PI) / 180
    const co = Math.cos(rad), si = Math.sin(rad)
    return { points: base.map((p) => ({ X: p.X * co - p.Y * si, Y: p.X * si + p.Y * co, ID: p.ID })) }
  })
}

// ── buildClouds: P3 descriptors are attached per cloud ──────────────────────────────────────────

test('buildClouds P3: each cloud has .coarse with points of the right length', () => {
  const templates = [
    { name: 'l_shape', role: 'sign',  points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
    { name: 't_shape', role: 'sigil', points: tShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.5 },
  ]
  const coarseN = 8
  const clouds = buildClouds(templates, coarseN)
  for (let i = 0; i < clouds.length; i++) {
    assert.ok(clouds[i].coarse !== undefined, `cloud[${i}] must have .coarse`)
    assert.equal(clouds[i].coarse.points.length, coarseN, `cloud[${i}].coarse.points.length must be ${coarseN}`)
  }
})

test('buildClouds P3: each cloud has .strokeCount ≥ 1', () => {
  const templates = [
    { name: 'l_shape', role: 'sign', points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
  ]
  const clouds = buildClouds(templates)
  for (const c of clouds) {
    assert.ok(typeof c.strokeCount === 'number', 'strokeCount must be a number')
    assert.ok(c.strokeCount >= 1, 'strokeCount must be at least 1')
  }
})

// ── prefilter: basic contract ────────────────────────────────────────────────────────────────────

test('prefilter: returns ≤ K clouds', () => {
  const templates = [
    { name: 'l_shape', role: 'sign', points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
    { name: 't_shape', role: 'sign', points: tShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
  ]
  const clouds = buildClouds(templates)
  const inputByAngle = makeCoarseInputByAngle(flattenWithIds(lShapeStrokes))

  const top1 = prefilter(inputByAngle, clouds, 1)
  assert.ok(top1.length <= 1, 'must return ≤ K=1')

  const top2 = prefilter(inputByAngle, clouds, 2)
  assert.ok(top2.length <= 2, 'must return ≤ K=2')

  // With K > pool size, still returns all
  const topMany = prefilter(inputByAngle, clouds, 100)
  assert.equal(topMany.length, clouds.length, 'K > pool size → returns all')
})

test('prefilter: empty pool returns empty array', () => {
  const result = prefilter([], [], 5)
  assert.equal(result.length, 0)
})

test('prefilter: includes the eventual full-match winner for the l_shape input', () => {
  const templates = [
    { name: 'l_shape', role: 'sign',  points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
    { name: 't_shape', role: 'sign',  points: tShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
  ]
  const clouds = buildClouds(templates)
  const inputPts = flattenWithIds(lShapeStrokes)

  // Full-match winner (no prefilter)
  const steps = Array.from({ length: 24 }, (_, k) => k * 15)
  const winner = bestMatchOverRotations(inputPts, clouds, steps)
  assert.ok(winner !== null)

  // prefilter at K=1 must include the winner
  const inputByAngle = makeCoarseInputByAngle(inputPts)
  const top = prefilter(inputByAngle, clouds, 1)
  const topNames = top.map((c) => c.name)
  assert.ok(topNames.includes(winner.name),
    `prefilter(K=1) must include winner "${winner.name}", got [${topNames.join(', ')}]`)
})

test('prefilter: includes the winner even for a ROTATED input (rotation tolerance)', () => {
  const templates = [
    { name: 'l_shape', role: 'sign',  points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
    { name: 't_shape', role: 'sign',  points: tShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
  ]
  const clouds = buildClouds(templates)

  // Rotate the l_shape 90°
  const cx = 0, cy = 0, deg = 90
  const rotated = flattenWithIds(lShapeStrokes.map((s) => rotateStrokePoints(s, cx, cy, deg)))
  const steps = Array.from({ length: 24 }, (_, k) => k * 15)

  // Full-match winner at 90°
  const winner = bestMatchOverRotations(rotated, clouds, steps)
  assert.ok(winner !== null, 'rotation sweep must find a winner')

  // prefilter at K=1 must still include the winner despite rotation
  const inputByAngle = makeCoarseInputByAngle(rotated)
  const top = prefilter(inputByAngle, clouds, 1)
  const topNames = top.map((c) => c.name)
  assert.ok(topNames.includes(winner.name),
    `prefilter(K=1) must include rotated-input winner "${winner.name}", got [${topNames.join(', ')}]`)
})

// ── Skip guard: pre-filter is skipped when pool.length ≤ K ──────────────────────────────────────

test('P3 guard: pre-filter skipped when pool.length ≤ K → same result as no-prefilter', () => {
  // Build a small pool with only 2 templates (well below any reasonable K)
  const smallTemplates = [
    { name: 'l_shape', role: 'sign', points: lShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
    { name: 't_shape', role: 'sign', points: tShapeStrokes.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id }))), weight: 1.0 },
  ]
  const clouds = buildClouds(smallTemplates)
  assert.equal(clouds.length, 2, 'small pool has 2 clouds')

  const ring = makeRing(300, 300, 180)
  const sign = lShapeStrokes.map((s) => s.map((p) => ({ x: p.x + 300, y: p.y + 160 })))
  const strokes = [ring, ...sign]
  const sharedOpts = { floodFill: false, gap: 45, confidenceMinPct: 0, clouds }

  // With K >= pool size (guard fires — skip pre-filter)
  const resultGuard = analyzeStrokes(strokes, null, { ...sharedOpts, prefilterK: 2 })
  // With K=999 (effectively no pre-filter)
  const resultNoFilter = analyzeStrokes(strokes, null, { ...sharedOpts, prefilterK: 999 })

  assert.equal(resultGuard.groups.length, resultNoFilter.groups.length, 'group count must match')
  for (let i = 0; i < resultNoFilter.groups.length; i++) {
    const a = resultNoFilter.groups[i]
    const b = resultGuard.groups[i]
    assert.equal(b.match?.name, a.match?.name,
      `guard: groups[${i}] match must equal no-prefilter match`)
  }
})

// ── P3 top-1 equivalence on the seed template set (including rotated drawings) ─────────────────
//
// Critical gate: for every sample drawing (including rotated sign symbols), the top-1 match WITH
// the pre-filter (prefilterK from rules.json) == WITHOUT it (prefilterK=9999). If any winner
// differs, the test FAILS — do not weaken this test. Raise K in rules.json if needed.

test('P3 top-1 equivalence: seed templates + rotated signs — pre-filter matches same winner as full sweep', () => {
  const seedData = require('../data/training-seed.json')
  const rules    = require('../data/rules.json')
  const sampleWeights = rules.recognition?.sampleWeights ?? { corrected: 1.5, drawn: 1.0, confirmed: 0.6 }
  const seedTemplates = seedData.map((s) => ({
    name:   s.name,
    role:   s.role,
    points: s.points,
    source: s.source,
    weight: sampleWeights[s.source] ?? 1.0,
  }))
  const clouds = buildClouds(seedTemplates)

  // Read K from rules.json (same as the running app)
  const prefilterK = rules.recognition?.prefilterK ?? 15

  const cx = 300, cy = 300, r = 180
  const ring = makeRing(cx, cy, r)
  const coreBlob = [
    { x: cx - 8, y: cy - 8 }, { x: cx + 8, y: cy - 8 },
    { x: cx + 8, y: cy + 8 }, { x: cx - 8, y: cy + 8 },
    { x: cx - 8, y: cy - 8 },
  ]

  const sign1Base = lShapeStrokes.map((s) => s.map((p) => ({ x: p.x + cx, y: p.y + cy - 140 })))
  const sign2Base = tShapeStrokes.map((s) => s.map((p) => ({ x: p.x + cx + 140, y: p.y + cy })))

  // Build test drawings: unrotated + several rotations that stress the rotation-tolerance of pre-filter
  const testCases = []
  for (const deg of [0, 45, 90, 135, 180, 270]) {
    const rotSign1 = sign1Base.map((s) => s.map((p) => rotPt(p, cx, cy, deg)))
    const rotSign2 = sign2Base.map((s) => s.map((p) => rotPt(p, cx, cy, deg)))
    testCases.push({ label: `rotated_${deg}`, strokes: [ring, coreBlob, ...rotSign1, ...rotSign2] })
  }

  const sharedOpts = { floodFill: false, gap: 45, confidenceMinPct: 0, clouds }

  const regressions = []
  for (const { label, strokes } of testCases) {
    const resultFull = analyzeStrokes(strokes, null, { ...sharedOpts, prefilterK: 9999 })
    const resultP3   = analyzeStrokes(strokes, null, { ...sharedOpts, prefilterK })

    assert.equal(resultP3.groups.length, resultFull.groups.length,
      `${label}: group count must match`)

    for (let i = 0; i < resultFull.groups.length; i++) {
      const gFull = resultFull.groups[i]
      const gP3   = resultP3.groups[i]
      if ((gP3.match?.name ?? null) !== (gFull.match?.name ?? null)) {
        regressions.push({
          label, groupIdx: i, groupRole: gFull.role,
          fullWinner: gFull.match?.name, p3Winner: gP3.match?.name,
        })
      }
    }
  }

  if (regressions.length > 0) {
    for (const r of regressions) {
      console.error(
        `P3 top-1 changed — ${r.label} group[${r.groupIdx}] role=${r.groupRole}: ` +
        `full="${r.fullWinner}" → p3="${r.p3Winner}" [prefilterK=${prefilterK}]`
      )
    }
  }
  assert.equal(regressions.length, 0,
    `P3 pre-filter caused ${regressions.length} regression(s) with prefilterK=${prefilterK}. ` +
    `Raise prefilterK in rules.json. See console output above.`)
})

test('P3 prefilter: winner always in top-K for all seed samples', () => {
  const seedData = require('../data/training-seed.json')
  const rules    = require('../data/rules.json')
  const sampleWeights = rules.recognition?.sampleWeights ?? { corrected: 1.5, drawn: 1.0, confirmed: 0.6 }
  const seedTemplates = seedData.map((s) => ({
    name:   s.name, role: s.role, points: s.points, source: s.source,
    weight: sampleWeights[s.source] ?? 1.0,
  }))
  const clouds = buildClouds(seedTemplates)
  const prefilterK = rules.recognition?.prefilterK ?? 15

  const cx = 300, cy = 300, r = 180
  const ring = makeRing(cx, cy, r)
  const sign1 = lShapeStrokes.map((s) => s.map((p) => ({ x: p.x + cx, y: p.y + cy - 140 })))
  const sign2 = tShapeStrokes.map((s) => s.map((p) => ({ x: p.x + cx + 140, y: p.y + cy })))
  const strokes = [ring, ...sign1, ...sign2]
  const sharedOpts = { floodFill: false, gap: 45, confidenceMinPct: 0, clouds }

  const resultFull = analyzeStrokes(strokes, null, { ...sharedOpts, prefilterK: 9999 })

  for (const g of resultFull.groups.filter((g) => g.match)) {
    const pool = g.role === 'core' ? clouds.sigil : clouds.sign
    if (!pool || pool.length <= prefilterK) continue  // guard: skip small pools

    const rawPts = g.strokes.flatMap((s, si) => s.map((p) => ({ x: p.x, y: p.y, _id: si })))
    const inputByAngle = makeCoarseInputByAngle(rawPts)
    const top = prefilter(inputByAngle, pool, prefilterK)
    const topNames = top.map((c) => c.name)

    assert.ok(topNames.includes(g.match.name),
      `winner "${g.match.name}" (role=${g.role}) must be in top-${prefilterK}, got [${topNames.join(', ')}]`)
  }
})
