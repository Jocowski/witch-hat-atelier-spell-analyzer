// rasterMatch.js — Multi-layer raster matcher (complement / contamination veto to $P).
//
// PURE module: no JSON imports, no DOM.
// All thresholds and grid sizes are passed in as a `params` object.
// Safe for node --test (mirrors geometry.js / deduce.js convention).
//
// Architecture: $P remains the primary matcher. This module is a POST-FILTER:
//   draw strokes
//     → $P sweep
//         → candidate
//             → raster veto: contaminationRisk > threshold?
//                 yes → suppress (unknown?)
//                 no  → pass through
//
// TODO(orchestrator): wire to rules.json rasterMatch block

const DEFAULT_PARAMS = {
  inkSize: 40,          // pixel grid side length
  coreRadius: 1,        // dilation radius for "core" (tight) mask
  softRadius: 2,        // dilation radius for "soft" (main Dice) mask
  looseRadius: 4,       // dilation radius for "loose" (explain check) mask
  gridSize: 10,         // region grid side for cell stats
  rotationSet: [0, 45, 90, 135, 180, 225, 270, 315], // degrees
  contaminationVetoThreshold: 0.55,
  tieBandPct: 0,        // 0 = tie-breaking disabled
}

// ---------- stroke normalization ----------

/**
 * Normalize strokes to [0,1]² bounding-box fit, preserving aspect ratio (centered in the square).
 * Returns { strokes, width, height } where width/height are the original world-unit dimensions.
 */
export function normalizeStrokes(strokes) {
  const allPts = strokes.flatMap((s) => s)
  if (!allPts.length) return { strokes: strokes.map(() => []), width: 0, height: 0 }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of allPts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  const wRaw = maxX - minX
  const hRaw = maxY - minY
  const s = Math.max(wRaw, hRaw) || 1
  // Degenerate dimensions: center the flat axis at 0.5 of the unit square.
  const padX = wRaw === 0 ? s * 0.5 : (s - wRaw) / 2
  const padY = hRaw === 0 ? s * 0.5 : (s - hRaw) / 2
  const w = wRaw || 1
  const h = hRaw || 1

  const normalized = strokes.map((stroke) =>
    stroke.map((p) => ({
      x: (p.x - minX + padX) / s,
      y: (p.y - minY + padY) / s,
    }))
  )

  return { strokes: normalized, width: w, height: h }
}

// ---------- ink rendering ----------

/**
 * Render normalized strokes ([0,1]² coords) to a pixel grid with 3 dilation layers.
 *
 * @param {Array<Array<{x:number,y:number}>>} normalizedStrokes  coordinates in [0,1]
 * @param {number} rotationDeg   rotate each point around (0.5, 0.5) before marking
 * @param {object} params        see DEFAULT_PARAMS
 * @returns {{ core, soft, loose }}  each { mask: Uint8Array, ink: number }
 */
export function renderInk(normalizedStrokes, rotationDeg, params = {}) {
  const p = { ...DEFAULT_PARAMS, ...params }
  const size = p.inkSize
  const total = size * size

  // Rotation matrix around (0.5, 0.5)
  const rad = (rotationDeg * Math.PI) / 180
  const cosR = Math.cos(rad), sinR = Math.sin(rad)
  const rotate = (x, y) => {
    const dx = x - 0.5, dy = y - 0.5
    return { x: 0.5 + dx * cosR - dy * sinR, y: 0.5 + dx * sinR + dy * cosR }
  }

  // Collect all pixel positions (grid coords 0..size-1)
  const pixelSet = new Set()
  for (const stroke of normalizedStrokes) {
    for (let i = 0; i < stroke.length; i++) {
      const rp = rotate(stroke[i].x, stroke[i].y)
      const px = Math.round(rp.x * (size - 1))
      const py = Math.round(rp.y * (size - 1))
      if (px >= 0 && py >= 0 && px < size && py < size) {
        pixelSet.add(py * size + px)
      }

      if (i > 0) {
        // Walk segment
        const prev = stroke[i - 1]
        const rPrev = rotate(prev.x, prev.y)
        const dx = rp.x - rPrev.x, dy = rp.y - rPrev.y
        const len = Math.hypot(dx, dy)
        const steps = Math.max(1, Math.ceil(len * size * 2))
        for (let t = 1; t < steps; t++) {
          const frac = t / steps
          const ix = Math.round((rPrev.x + dx * frac) * (size - 1))
          const iy = Math.round((rPrev.y + dy * frac) * (size - 1))
          if (ix >= 0 && iy >= 0 && ix < size && iy < size) {
            pixelSet.add(iy * size + ix)
          }
        }
      }
    }
  }

  // Build base mask
  const base = new Uint8Array(total)
  for (const idx of pixelSet) base[idx] = 1

  // Dilate to produce the three masks
  const dilate = (src, radius) => {
    if (radius === 0) { const m = src.slice(); return { mask: m, ink: m.reduce((a, v) => a + v, 0) } }
    const dst = new Uint8Array(total)
    const r2 = radius * radius
    for (let iy = 0; iy < size; iy++) {
      for (let ix = 0; ix < size; ix++) {
        if (dst[iy * size + ix]) continue
        check: for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= r2) {
              const nx = ix + dx, ny = iy + dy
              if (nx >= 0 && ny >= 0 && nx < size && ny < size && src[ny * size + nx]) {
                dst[iy * size + ix] = 1
                break check
              }
            }
          }
        }
      }
    }
    return { mask: dst, ink: dst.reduce((a, v) => a + v, 0) }
  }

  const core = dilate(base, p.coreRadius)
  const soft = dilate(base, p.softRadius)
  const loose = dilate(base, p.looseRadius)

  return { core, soft, loose }
}

// ---------- overlap helpers ----------
function overlap(maskA, maskB) {
  let count = 0
  for (let i = 0; i < maskA.length; i++) if (maskA[i] && maskB[i]) count++
  return count
}

function clamp01(v) { return Math.max(0, Math.min(1, v)) }

// ---------- region grid stats ----------

/**
 * Compute region grid occupancy metrics.
 * @param {object} candidateInk  output of renderInk
 * @param {object} referenceInk  output of renderInk
 * @param {object} params
 * @returns {{ requiredCellCoverage, forbiddenCellInkRatio, regionScore }}
 */
export function cellStats(candidateInk, referenceInk, params = {}) {
  const p = { ...DEFAULT_PARAMS, ...params }
  const gridSize = p.gridSize
  const inkSize = p.inkSize
  const cellW = inkSize / gridSize
  const cellH = inkSize / gridSize

  let requiredCells = 0, coveredRequired = 0
  let forbiddenCandCells = 0, totalCandCells = 0

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      // Check if any reference core pixel is in this cell
      let refHasCore = false, candHasCore = false
      let refHasLoose = false, candHasLoose = false

      const x0 = Math.floor(gx * cellW), x1 = Math.ceil((gx + 1) * cellW)
      const y0 = Math.floor(gy * cellH), y1 = Math.ceil((gy + 1) * cellH)

      for (let iy = y0; iy < y1 && iy < inkSize; iy++) {
        for (let ix = x0; ix < x1 && ix < inkSize; ix++) {
          const idx = iy * inkSize + ix
          if (referenceInk.core.mask[idx]) refHasCore = true
          if (referenceInk.loose.mask[idx]) refHasLoose = true
          if (candidateInk.core.mask[idx]) candHasCore = true
          if (candidateInk.loose.mask[idx]) candHasLoose = true
        }
      }

      if (refHasCore) {
        requiredCells++
        if (candHasLoose) coveredRequired++
      }
      if (candHasCore) {
        totalCandCells++
        if (!refHasLoose) forbiddenCandCells++
      }
    }
  }

  const requiredCellCoverage = requiredCells > 0 ? coveredRequired / requiredCells : 0
  const forbiddenCellInkRatio = totalCandCells > 0 ? forbiddenCandCells / totalCandCells : 0
  const regionScore = clamp01(requiredCellCoverage * 0.68 + (1 - forbiddenCellInkRatio) * 0.32)

  return { requiredCellCoverage, forbiddenCellInkRatio, regionScore }
}

// ---------- per-rotation comparison ----------

/**
 * Score a candidate against a reference at a fixed rotation.
 * Both are the output of renderInk.
 *
 * @param {object} candidateInk  { core, soft, loose }
 * @param {object} referenceInk  { core, soft, loose }
 * @param {object} params
 * @returns {object} metrics (see SPEC §2.5)
 */
export function compareInk(candidateInk, referenceInk, params = {}) {
  const p = { ...DEFAULT_PARAMS, ...params }

  const candCoreInk = candidateInk.core.ink
  const refCoreInk  = referenceInk.core.ink
  const candSoftInk = candidateInk.soft.ink
  const refSoftInk  = referenceInk.soft.ink

  const overlapCandCoreRefLoose = overlap(candidateInk.core.mask, referenceInk.loose.mask)
  const overlapRefCoreCandLoose = overlap(referenceInk.core.mask, candidateInk.loose.mask)
  const overlapSoftSoft         = overlap(candidateInk.soft.mask, referenceInk.soft.mask)

  const candidateExplainedRatio = candCoreInk > 0 ? overlapCandCoreRefLoose / candCoreInk : 0
  const templateCoveredRatio    = refCoreInk  > 0 ? overlapRefCoreCandLoose / refCoreInk  : 0
  const softDiceScore           = (candSoftInk + refSoftInk) > 0
    ? (2 * overlapSoftSoft) / (candSoftInk + refSoftInk) : 0

  const unexplainedInkRatio = 1 - candidateExplainedRatio
  const missingInkRatio     = 1 - templateCoveredRatio

  // Region grid stats
  const cs = cellStats(candidateInk, referenceInk, p)
  const { requiredCellCoverage, forbiddenCellInkRatio, regionScore } = cs

  // inkScore (composite shape agreement)
  const inkScore = clamp01(
    candidateExplainedRatio * 0.32
    + templateCoveredRatio  * 0.32
    + softDiceScore         * 0.14
    + requiredCellCoverage  * 0.16
    + (1 - forbiddenCellInkRatio) * 0.06
  )

  // contaminationRisk
  const contaminationRisk = clamp01(
    clamp01((unexplainedInkRatio - 0.26) / 0.34) * 0.58
    + clamp01((missingInkRatio   - 0.46) / 0.34) * 0.22
    + clamp01((forbiddenCellInkRatio - 0.18) / 0.46) * 0.20
  )

  // contaminationCap
  let contaminationCap = 1.0
  if (unexplainedInkRatio > 0.36 && templateCoveredRatio < 0.82) {
    contaminationCap = clamp01(0.62 - (unexplainedInkRatio - 0.36) * 0.8)
    contaminationCap = Math.max(0.2, contaminationCap)
  }

  return {
    inkScore,
    softDiceScore,
    contaminationRisk,
    candidateExplainedRatio,
    templateCoveredRatio,
    unexplainedInkRatio,
    missingInkRatio,
    requiredCellCoverage,
    forbiddenCellInkRatio,
    regionScore,
    contaminationCap,
  }
}

// ---------- rotation sweep wrapper ----------

/**
 * Convenience wrapper: normalize, render, sweep rotations, return best-rotation result.
 *
 * @param {Array<Array<{x:number,y:number}>>} candidateStrokes
 * @param {Array<Array<{x:number,y:number}>>} referenceStrokes
 * @param {object} params  — see DEFAULT_PARAMS; pass rotationSet to override the sweep
 * @returns {object}  best-rotation result with bestRotationDeg appended
 */
export function rasterScore(candidateStrokes, referenceStrokes, params = {}) {
  const p = { ...DEFAULT_PARAMS, ...params }

  const { strokes: normCand }  = normalizeStrokes(candidateStrokes)
  const { strokes: normRef }   = normalizeStrokes(referenceStrokes)

  const rotSet = p.rotationSet ?? DEFAULT_PARAMS.rotationSet
  // Pre-render the reference at 0° (it does not rotate in the sweep)
  const refInk = renderInk(normRef, 0, p)

  let best = null
  for (const deg of rotSet) {
    const candInk = renderInk(normCand, deg, p)
    const result = compareInk(candInk, refInk, p)
    if (!best || result.inkScore > best.inkScore) {
      best = { ...result, bestRotationDeg: deg }
    }
  }

  return best ?? { inkScore: 0, softDiceScore: 0, contaminationRisk: 1, candidateExplainedRatio: 0, templateCoveredRatio: 0, unexplainedInkRatio: 1, missingInkRatio: 1, requiredCellCoverage: 0, forbiddenCellInkRatio: 1, regionScore: 0, contaminationCap: 0.2, bestRotationDeg: 0 }
}
