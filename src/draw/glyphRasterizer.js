// glyphRasterizer.js — SHARED rasterizer: strokes → grayscale image buffer.
//
// ══════════════════════════════════════════════════════════════════════════════
// INVARIANT #6 — ONE RASTERIZER (SPEC-ml-recognizer.md §0)
// ══════════════════════════════════════════════════════════════════════════════
// This file is the SINGLE implementation of the strokes→pixels transform.
// It is used in TWO contexts:
//   • M3 training-data generation: run via Node by ml/render_dataset.mjs.
//     Produces the PNG images the siamese CNN encoder trains on.
//   • M4 browser inference: imported by src/draw/mlRecognizer.js (future).
//     Produces the query image that gets embedded at recognition time.
// Because it is the same code in both cases, train/serve pixel skew is
// designed out at the source — no parity test needed.
//
// PURITY CONTRACT
// ───────────────
// • NO DOM / canvas imports (would break Node)
// • NO JSON imports (would break `node --test` — ERR_IMPORT_ATTRIBUTE_MISSING)
// • NO fetch / Worker / onnx / Supabase imports
// • Pure integer/float deterministic math throughout
// This module imports nothing. It works in any JS environment.
//
// API
// ───
//   rasterizeStrokes(strokes, opts?) → Uint8Array  (size*size values, 0=white 255=black)
//   rasterToModelInput(raster)       → Float32Array (size*size values, 0.0..1.0)
//
// opts (all optional):
//   size            {number}  output grid side in pixels (default 32)
//   rotationDeg     {number}  clockwise rotation about centroid before rasterizing (default 0)
//   strokeWidthRatio {number} stroke width as fraction of grid size (default 0.08)
//   padRatio        {number}  padding as fraction of grid size on each side (default 0.1)
//   superscale      {number}  supersample factor, then box-downsample (default 2)
//
// strokes shape: Array of strokes, each stroke is Array of {x,y} or {X,Y} points.
// The input coordinate system can be anything (canvas px, normalized, etc.) — the
// rasterizer fits all strokes into the unit box before stamping, so absolute scale is irrelevant.

// ─── Internal constants ────────────────────────────────────────────────────────

const DEFAULT_SIZE             = 32
const DEFAULT_STROKE_WIDTH_RATIO = 0.08
const DEFAULT_PAD_RATIO        = 0.10
const DEFAULT_SUPERSCALE       = 2

// ─── Point normalization ───────────────────────────────────────────────────────

/**
 * Normalize one point: accept {x,y} or {X,Y}.
 * @param {{ x?: number, y?: number, X?: number, Y?: number }} pt
 * @returns {{ x: number, y: number }}
 */
function normPt(pt) {
  return { x: pt.x ?? pt.X ?? 0, y: pt.y ?? pt.Y ?? 0 }
}

/**
 * Flatten strokes array into a flat list of {x,y} points.
 * @param {Array<Array<object>>} strokes
 * @returns {Array<{x:number, y:number}>}
 */
function flattenStrokes(strokes) {
  const pts = []
  for (const stroke of strokes) {
    for (const pt of stroke) {
      pts.push(normPt(pt))
    }
  }
  return pts
}

// ─── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Compute axis-aligned bounding box of a point list.
 * Returns { minX, minY, maxX, maxY } or null if empty.
 */
function boundingBox(pts) {
  if (pts.length === 0) return null
  let minX = pts[0].x, maxX = pts[0].x
  let minY = pts[0].y, maxY = pts[0].y
  for (let i = 1; i < pts.length; i++) {
    const { x, y } = pts[i]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Rotate a point {x,y} clockwise by `deg` degrees around the given center.
 */
function rotatePt(pt, cx, cy, deg) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = pt.x - cx
  const dy = pt.y - cy
  return {
    x: cx + dx * cos + dy * sin,
    y: cy - dx * sin + dy * cos,
  }
}

// ─── Rasterize core ───────────────────────────────────────────────────────────

/**
 * Stamp a filled disk of integer radius `r` around pixel (cx, cy) into a
 * flat Uint8Array `buf` of dimensions `w × h`.  Uses integer squared-distance
 * to avoid sqrt — fully deterministic.
 *
 * Coordinates are in supersampled-grid space.
 */
function stampDisk(buf, w, h, cx, cy, r) {
  const r2 = r * r
  const x0 = Math.max(0, Math.ceil(cx - r))
  const x1 = Math.min(w - 1, Math.floor(cx + r))
  const y0 = Math.max(0, Math.ceil(cy - r))
  const y1 = Math.min(h - 1, Math.floor(cy + r))
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = px - cx
      const dy = py - cy
      if (dx * dx + dy * dy <= r2) {
        buf[py * w + px] = 255
      }
    }
  }
}

/**
 * Stamp disks along the segment from (ax,ay) to (bx,by) at `step`-px intervals.
 * This approximates a filled stroke without any anti-aliasing — deterministic.
 */
function stampSegment(buf, w, h, ax, ay, bx, by, r) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.5) {
    stampDisk(buf, w, h, ax, ay, r)
    return
  }
  // step = half-radius to get dense enough coverage without gaps
  const step = Math.max(0.5, r * 0.5)
  const steps = Math.ceil(len / step)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    stampDisk(buf, w, h, ax + dx * t, ay + dy * t, r)
  }
}

// ─── Box downsampling ──────────────────────────────────────────────────────────

/**
 * Box-downsample a `(sw × sh)` Uint8Array to `(tw × th)`.
 * Each output pixel averages the corresponding block of input pixels.
 * Returns Uint8Array of length `tw * th`.
 */
function boxDownsample(src, sw, sh, tw, th) {
  const out = new Uint8Array(tw * th)
  const bw = sw / tw  // block width (fractional OK)
  const bh = sh / th
  for (let oy = 0; oy < th; oy++) {
    for (let ox = 0; ox < tw; ox++) {
      // input pixel range covered by this output pixel
      const x0 = ox * bw
      const x1 = (ox + 1) * bw
      const y0 = oy * bh
      const y1 = (oy + 1) * bh
      // integer bounds
      const ix0 = Math.floor(x0)
      const ix1 = Math.ceil(x1)
      const iy0 = Math.floor(y0)
      const iy1 = Math.ceil(y1)
      let sum = 0
      let wsum = 0
      for (let iy = iy0; iy < iy1 && iy < sh; iy++) {
        // fractional row weight at boundaries
        const wy = Math.min(iy + 1, y1) - Math.max(iy, y0)
        for (let ix = ix0; ix < ix1 && ix < sw; ix++) {
          const wx = Math.min(ix + 1, x1) - Math.max(ix, x0)
          const w = wx * wy
          sum += src[iy * sw + ix] * w
          wsum += w
        }
      }
      out[oy * tw + ox] = wsum > 0 ? Math.round(sum / wsum) : 0
    }
  }
  return out
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert an array of strokes to a square grayscale raster.
 *
 * @param {Array<Array<{x?:number,y?:number,X?:number,Y?:number}>|object>} strokes
 *   Each element is a stroke (array of points).  Accepts {x,y} or {X,Y} keys.
 * @param {object}  [opts]
 * @param {number}  [opts.size=32]             Output grid side (pixels).
 * @param {number}  [opts.rotationDeg=0]       CW rotation about centroid before rasterizing.
 * @param {number}  [opts.strokeWidthRatio=0.08] Stroke width / size.
 * @param {number}  [opts.padRatio=0.10]       Per-side padding / size.
 * @param {number}  [opts.superscale=2]        Supersample factor before box-downsample.
 * @returns {Uint8Array}  size*size values; 0 = background (white), 255 = ink (black).
 */
export function rasterizeStrokes(strokes, opts = {}) {
  const size            = opts.size             ?? DEFAULT_SIZE
  const rotationDeg     = opts.rotationDeg      ?? 0
  const strokeWidthRatio = opts.strokeWidthRatio ?? DEFAULT_STROKE_WIDTH_RATIO
  const padRatio        = opts.padRatio         ?? DEFAULT_PAD_RATIO
  const superscale      = opts.superscale       ?? DEFAULT_SUPERSCALE

  // 1. Flatten all strokes to a point list, normalizing {X,Y} → {x,y}.
  const allPts = flattenStrokes(strokes)
  if (allPts.length === 0) return new Uint8Array(size * size)

  // 2. Optional rotation about centroid.
  let pts = allPts
  if (rotationDeg !== 0) {
    const cx = allPts.reduce((s, p) => s + p.x, 0) / allPts.length
    const cy = allPts.reduce((s, p) => s + p.y, 0) / allPts.length
    pts = allPts.map((p) => rotatePt(p, cx, cy, rotationDeg))
  }

  // 3. Compute bounding box after rotation.
  const bb = boundingBox(pts)
  if (!bb) return new Uint8Array(size * size)

  const bbW = bb.maxX - bb.minX
  const bbH = bb.maxY - bb.minY
  const bbMax = Math.max(bbW, bbH)

  // 4. Compute supersampled canvas dimensions.
  const ss = Math.max(1, Math.round(superscale))
  const ssSize = size * ss

  // 5. Compute pad in supersampled pixels.
  const pad = Math.round(padRatio * ssSize)
  const drawableSize = ssSize - 2 * pad

  // 6. Scale factor: map bbMax → drawableSize (aspect-preserving).
  //    Guard against degenerate (single-point) glyphs.
  const scale = bbMax > 0 ? drawableSize / bbMax : 1

  // 7. Map offsets: input coords → supersampled canvas pixels.
  //    Center the bounding box inside the drawable area.
  const offX = pad + (drawableSize - bbW * scale) / 2 - bb.minX * scale
  const offY = pad + (drawableSize - bbH * scale) / 2 - bb.minY * scale

  // 8. Allocate supersampled buffer (background = 0 = white).
  const buf = new Uint8Array(ssSize * ssSize)

  // 9. Stroke radius in supersampled pixels.
  const r = Math.max(1, Math.round((strokeWidthRatio * ssSize) / 2))

  // 10. Stamp each stroke segment.
  //     We already computed the global rotation centroid above (stored in `pts`).
  //     For each stroke we re-apply the same rotation inline to avoid index tracking,
  //     then project to canvas coords.
  const rotCx = rotationDeg !== 0 ? allPts.reduce((s, p) => s + p.x, 0) / allPts.length : 0
  const rotCy = rotationDeg !== 0 ? allPts.reduce((s, p) => s + p.y, 0) / allPts.length : 0

  for (const stroke of strokes) {
    if (!stroke || stroke.length === 0) continue
    const canvasPts = stroke.map((rawPt) => {
      let p = normPt(rawPt)
      if (rotationDeg !== 0) p = rotatePt(p, rotCx, rotCy, rotationDeg)
      return { x: p.x * scale + offX, y: p.y * scale + offY }
    })
    for (let i = 0; i < canvasPts.length - 1; i++) {
      stampSegment(buf, ssSize, ssSize, canvasPts[i].x, canvasPts[i].y, canvasPts[i + 1].x, canvasPts[i + 1].y, r)
    }
    // Stamp the final point as a disk to handle single-point strokes.
    if (canvasPts.length > 0) {
      const last = canvasPts[canvasPts.length - 1]
      stampDisk(buf, ssSize, ssSize, last.x, last.y, r)
    }
  }

  // 11. Box-downsample from ssSize×ssSize to size×size.
  if (ss === 1) return buf
  return boxDownsample(buf, ssSize, ssSize, size, size)
}

/**
 * Convert a raster (0=background, 255=ink) to the normalized Float32Array
 * that the ML model expects as input: values in [0.0, 1.0] where 1.0 = ink.
 *
 * @param {Uint8Array} raster  Output of rasterizeStrokes().
 * @returns {Float32Array}     Same length; each value in [0, 1].
 */
export function rasterToModelInput(raster) {
  const out = new Float32Array(raster.length)
  for (let i = 0; i < raster.length; i++) {
    out[i] = raster[i] / 255
  }
  return out
}
