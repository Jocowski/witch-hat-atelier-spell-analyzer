// SamplePreview.jsx — modal canvas that replays a training sample's stroke points.
import { useEffect, useRef } from 'react'

const CANVAS_SIZE = 220
const PADDING     = 14

// The canvas 2D context cannot parse CSS `var(--x)` strings — assigning one to fillStyle/strokeStyle
// is silently ignored and the context keeps its default BLACK (which is why the modal rendered an
// all-black image: black bg fill + black, invisible strokes). Resolve the theme variable to a real
// color from the element's computed style, falling back to a literal when the var is unset.
function cssColor(el, name, fallback) {
  const v = el && getComputedStyle(el).getPropertyValue(name).trim()
  return v || fallback
}

/**
 * Groups a flat [{X,Y,ID}] array into strokes keyed by ID.
 * Returns an array of arrays (one inner array per stroke, in insertion order).
 */
function groupStrokes(points) {
  const map = new Map()
  for (const pt of points) {
    const key = pt.ID ?? 0
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(pt)
  }
  return [...map.values()]
}

/**
 * Compute a uniform scale + offset that fits all strokes into the canvas
 * with equal padding on all sides.
 */
function fitTransform(strokes, canvasSize, padding) {
  const pts = strokes.flat()
  if (pts.length === 0) return { scale: 1, dx: 0, dy: 0 }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const { X, Y } of pts) {
    if (X < minX) minX = X; if (X > maxX) maxX = X
    if (Y < minY) minY = Y; if (Y > maxY) maxY = Y
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const available = canvasSize - padding * 2
  const scale = Math.min(available / rangeX, available / rangeY)

  const dx = padding + (available - rangeX * scale) / 2 - minX * scale
  const dy = padding + (available - rangeY * scale) / 2 - minY * scale
  return { scale, dx, dy }
}

export default function SamplePreview({ sample, onClose }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Resolve theme colors to real values (canvas can't read CSS var() — see cssColor note above).
    const bgColor     = cssColor(canvas, '--panel-2', '#1e1e2e')
    const dimColor    = cssColor(canvas, '--ink-dim', '#888888')
    const strokeColor = cssColor(canvas, '--accent', '#a78bfa')
    const startColor  = cssColor(canvas, '--ok', '#4ade80')

    const points = Array.isArray(sample?.points) ? sample.points : []
    const strokes = groupStrokes(points)
    const { scale, dx, dy } = fitTransform(strokes, CANVAS_SIZE, PADDING)

    // Background
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    if (strokes.length === 0) {
      ctx.fillStyle = dimColor
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No points', CANVAS_SIZE / 2, CANVAS_SIZE / 2)
      return
    }

    // Draw each stroke as a polyline
    ctx.lineWidth   = 2
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.strokeStyle = strokeColor

    for (const stroke of strokes) {
      if (stroke.length === 0) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].X * scale + dx, stroke[0].Y * scale + dy)
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].X * scale + dx, stroke[i].Y * scale + dy)
      }
      ctx.stroke()

      // Mark first point
      const sx = stroke[0].X * scale + dx
      const sy = stroke[0].Y * scale + dy
      ctx.fillStyle = startColor
      ctx.beginPath()
      ctx.arc(sx, sy, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [sample])

  if (!sample) return null

  return (
    /* Backdrop */
    <div className="sample-preview-backdrop" onClick={onClose}>
      <div className="sample-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sample-preview-header">
          <span className="sample-preview-title">Sample drawing</span>
          <span className="admin-hint" title={sample.id}>id: {sample.id.slice(0, 8)}&hellip;</span>
          <button className="admin-btn admin-btn-sm admin-btn-ghost sample-preview-close" onClick={onClose}>
            Close
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="sample-preview-canvas"
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
        />
        <p className="admin-hint" style={{ margin: '8px 0 0', textAlign: 'center' }}>
          {(sample.points ?? []).length} point(s) &middot; {groupStrokes(sample.points ?? []).length} stroke(s)
        </p>
      </div>
    </div>
  )
}
