// ringClosure.js — MS-Paint-style flood-fill ring-closure detection.
//
// PURE module: no JSON imports, no DOM, no Konva.
// All tunables arrive via the `config` parameter object.
// Safe for node --test (mirrors the geometry.js / deduce.js convention).
//
// Algorithm:
//   1. Rasterize all strokes onto a pixel grid (each sample stamped as an ink disk).
//   2. BFS-flood the exterior from every border cell (4-connected, ink blocks propagation).
//   3. Dry cells (not reached by the flood) form enclosed regions.
//   4. Score the outer ink edge with a circle fit.
//   5. Accept as "ring closed" when enclosedArea + minRadius + perfection all pass.

// Config source: rules.json recognition.floodFillConfig (injected via StudioPage → analyzeStrokes).

const DEFAULT_CONFIG = {
  cellSize: 2,            // px per raster cell (halved grid = 4× fewer cells)
  padding: 24,            // border padding around stroke bounds (px)
  inkRadius: 4,           // radius of the ink disk stamped per sample point (px)
  sampleStep: 1.5,        // inter-sample step when walking stroke segments (px)
  minEnclosedAreaPx: 2000, // absolute floor — no ring smaller than this (px²)
  minEnclosedAreaRatio: 0.06, // relative floor — enclosed / boundsArea
  maxNormalizedRmse: 0.22,    // circle-fit error tolerance (higher = messier circles OK)
  minPerfection: 0.24,        // derived threshold from RMSE; lower = more forgiving
  // minRadius must be passed by caller (no default here)
}

const MAX_RASTER_DIM = 1024 // cells — prevent pathological slowdowns

/** Build axis-aligned bounding box for a flat array of strokes. */
export function strokesBounds(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const stroke of strokes) {
    for (const p of stroke) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * Fit a circle to a set of {x,y} points (Kåsa/Pratt-style algebraic fit via centroid + radii).
 * Returns { cx, cy, r, normalizedRmse, perfection }.
 */
export function scoreCircleFit(points, config = {}) {
  const maxRmse = config.maxNormalizedRmse ?? DEFAULT_CONFIG.maxNormalizedRmse
  if (points.length < 3) return { cx: 0, cy: 0, r: 0, normalizedRmse: 1, perfection: 0 }

  // Centroid
  let cx = 0, cy = 0
  for (const p of points) { cx += p.x; cy += p.y }
  cx /= points.length; cy /= points.length

  // Mean radius
  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy))
  const r = radii.reduce((a, b) => a + b, 0) / radii.length
  if (r < 1) return { cx, cy, r, normalizedRmse: 1, perfection: 0 }

  // RMSE of radii deviations
  const variance = radii.reduce((a, b) => a + (b - r) ** 2, 0) / radii.length
  const rmse = Math.sqrt(variance)
  const normalizedRmse = rmse / r
  const perfection = Math.max(0, Math.min(1, 1 - normalizedRmse / maxRmse))

  return { cx, cy, r, normalizedRmse, perfection }
}

/**
 * Analyze whether a set of strokes topologically encloses a region.
 *
 * @param {Array<Array<{x:number,y:number}>>} strokes
 * @param {object} config — see DEFAULT_CONFIG and tunables section in SPEC
 * @returns {RingClosureResult}
 */
export function analyzeRingClosure(strokes, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Graceful no-op for empty input
  const allPts = strokes.flatMap((s) => s)
  if (!strokes.length || allPts.length < 3) {
    return _emptyResult(cfg)
  }

  const bounds = strokesBounds(strokes)

  // Choose cell size, auto-scaling to stay within MAX_RASTER_DIM
  let cellSize = cfg.cellSize
  const rawW = bounds.width + 2 * cfg.padding
  const rawH = bounds.height + 2 * cfg.padding
  const dimW = Math.ceil(rawW / cellSize)
  const dimH = Math.ceil(rawH / cellSize)
  if (dimW > MAX_RASTER_DIM || dimH > MAX_RASTER_DIM) {
    const scale = Math.max(dimW, dimH) / MAX_RASTER_DIM
    cellSize = cellSize * scale
  }

  const sampleStep = 0.75 * cellSize

  const width = Math.ceil((bounds.width + 2 * cfg.padding) / cellSize) + 1
  const height = Math.ceil((bounds.height + 2 * cfg.padding) / cellSize) + 1
  const offsetX = bounds.minX - cfg.padding
  const offsetY = bounds.minY - cfg.padding
  const rasterSize = width * height

  // Ink grid: 0=empty, 1=ink
  const ink = new Uint8Array(rasterSize)

  // Map world→cell
  const toCell = (wx, wy) => {
    const cx_ = Math.round((wx - offsetX) / cellSize)
    const cy_ = Math.round((wy - offsetY) / cellSize)
    return { cx: cx_, cy: cy_ }
  }
  const cellIdx = (cx_, cy_) => cy_ * width + cx_
  const inBounds = (cx_, cy_) => cx_ >= 0 && cy_ >= 0 && cx_ < width && cy_ < height

  // Stamp ink disk at a cell
  const inkR = Math.ceil(cfg.inkRadius / cellSize)
  function stampDisk(cx_, cy_) {
    for (let dy = -inkR; dy <= inkR; dy++) {
      for (let dx = -inkR; dx <= inkR; dx++) {
        if (dx * dx + dy * dy <= inkR * inkR) {
          const nx = cx_ + dx, ny = cy_ + dy
          if (inBounds(nx, ny)) ink[cellIdx(nx, ny)] = 1
        }
      }
    }
  }

  // Rasterize all strokes
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.length; i++) {
      const p = stroke[i]
      const { cx: pcx, cy: pcy } = toCell(p.x, p.y)
      stampDisk(pcx, pcy)

      if (i > 0) {
        // Walk the segment
        const prev = stroke[i - 1]
        const dx = p.x - prev.x, dy = p.y - prev.y
        const len = Math.hypot(dx, dy)
        if (len > sampleStep) {
          const steps = Math.floor(len / sampleStep)
          for (let s = 1; s < steps; s++) {
            const t = s / steps
            const { cx: scx, cy: scy } = toCell(prev.x + dx * t, prev.y + dy * t)
            stampDisk(scx, scy)
          }
        }
      }
    }
  }

  // BFS flood from all border cells (exterior flood)
  const WET = 2
  const queue = new Int32Array(rasterSize)
  let head = 0, tail = 0

  const flood = (idx) => {
    if (ink[idx] === 0) { ink[idx] = WET; queue[tail++] = idx }
  }

  // Seed border cells
  for (let cx_ = 0; cx_ < width; cx_++) {
    flood(cellIdx(cx_, 0))
    flood(cellIdx(cx_, height - 1))
  }
  for (let cy_ = 0; cy_ < height; cy_++) {
    flood(cellIdx(0, cy_))
    flood(cellIdx(width - 1, cy_))
  }

  // BFS
  const dx4 = [1, -1, 0, 0]
  const dy4 = [0, 0, 1, -1]
  while (head < tail) {
    const idx = queue[head++]
    const cy_ = Math.floor(idx / width)
    const cx_ = idx % width
    for (let d = 0; d < 4; d++) {
      const nx = cx_ + dx4[d], ny = cy_ + dy4[d]
      if (inBounds(nx, ny)) {
        const nidx = cellIdx(nx, ny)
        if (ink[nidx] === 0) flood(nidx)
      }
    }
  }

  // Count dry cells (enclosed area) and collect outside-edge ink pixels
  let enclosedAreaPx = 0
  const outsideEdge = [] // {x, y} in world coords

  for (let cy_ = 0; cy_ < height; cy_++) {
    for (let cx_ = 0; cx_ < width; cx_++) {
      const idx = cellIdx(cx_, cy_)
      if (ink[idx] === 0) {
        enclosedAreaPx++
      } else if (ink[idx] === 1) {
        // Ink cell — check if it borders a wet (exterior) cell
        let bordersExterior = false
        for (let d = 0; d < 4; d++) {
          const nx = cx_ + dx4[d], ny = cy_ + dy4[d]
          if (inBounds(nx, ny) && ink[cellIdx(nx, ny)] === WET) { bordersExterior = true; break }
        }
        if (bordersExterior) {
          outsideEdge.push({ x: offsetX + cx_ * cellSize, y: offsetY + cy_ * cellSize })
        }
      }
    }
  }

  // Convert enclosed area from cells² to px²
  const enclosedAreaPxReal = enclosedAreaPx * cellSize * cellSize
  const boundsAreaPx = rawW * rawH

  // Minimum area guard (both absolute and relative)
  const minAreaAbs = cfg.minEnclosedAreaPx
  const minAreaRel = boundsAreaPx * cfg.minEnclosedAreaRatio
  const minEnclosedAreaThreshold = Math.max(minAreaAbs, minAreaRel)

  // Circle fit on the outer edge
  const fitResult = outsideEdge.length >= 3 ? scoreCircleFit(outsideEdge, cfg) : { cx: 0, cy: 0, r: 0, normalizedRmse: 1, perfection: 0 }

  // Determine which strokes contributed to the outside edge
  // Approximate: any stroke whose points are near an outside-edge pixel
  const strokeIds = []
  if (outsideEdge.length > 0) {
    for (let si = 0; si < strokes.length; si++) {
      let contributes = false
      for (const p of strokes[si]) {
        const { cx: pcx, cy: pcy } = toCell(p.x, p.y)
        // Check within inkR cells of any outside edge pixel — just check if the cell itself is ink
        if (inBounds(pcx, pcy) && ink[cellIdx(pcx, pcy)] === 1) {
          contributes = true
          break
        }
      }
      if (contributes) strokeIds.push(si)
    }
  }

  // Closure decision
  const minRadius = cfg.minRadius ?? 0
  const areaOk = enclosedAreaPxReal >= minEnclosedAreaThreshold
  const radiusOk = fitResult.r >= minRadius
  const perfectionOk = fitResult.perfection >= cfg.minPerfection
  const closed = areaOk && radiusOk && perfectionOk && outsideEdge.length > 0

  return {
    closed,
    enclosedAreaPx: enclosedAreaPxReal,
    minEnclosedAreaPx: minEnclosedAreaThreshold,
    cx: fitResult.cx,
    cy: fitResult.cy,
    r: fitResult.r,
    normalizedRmse: fitResult.normalizedRmse,
    perfection: fitResult.perfection,
    edgePixelCount: outsideEdge.length,
    strokeIds,
    rasterMeta: { width, height, cellSize, offsetX, offsetY },
  }
}

function _emptyResult(cfg) {
  return {
    closed: false,
    enclosedAreaPx: 0,
    minEnclosedAreaPx: cfg.minEnclosedAreaPx,
    cx: 0, cy: 0, r: 0,
    normalizedRmse: 1,
    perfection: 0,
    edgePixelCount: 0,
    strokeIds: [],
    rasterMeta: { width: 0, height: 0, cellSize: cfg.cellSize, offsetX: 0, offsetY: 0 },
  }
}
