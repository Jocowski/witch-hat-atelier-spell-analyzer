/**
 * ToolDock.jsx — drawing toolbar for Spell Studio / Training.
 *
 * Two layouts:
 *   • full     (default) — vertical dock on the left of the canvas.
 *                          Tools are laid out in a 2-column grid so the dock
 *                          never needs to scroll.
 *   • compact  (compact prop) — horizontal, wrapping toolbar with smaller controls,
 *                so the Training screen stays short. Tools are laid out in a
 *                2-row grid so there is no horizontal scroll / overflow.
 *
 * Props
 * ─────
 *   tool / setTool             current tool id + setter
 *   color / setColor           active CSS color + setter
 *   dyeId / setDyeId           active dye id (null = default ink) + setter
 *   brushSize / setBrushSize   brush width in px + setter
 *   palette                    'dyes' | 'bw'  (default 'dyes')
 *   compact                    bool — render the compact horizontal layout
 *   zoom                       current zoom factor (e.g. 1.0)
 *   onZoomIn / onZoomOut / onZoomReset   zoom callbacks
 *
 * Tool IDs
 * ────────
 *   brush | fill | line | rect | triangle | circle | arrow
 *   eraserStroke | eraserPixel
 *   select | move | rotate
 */

import { DYES } from '../engine/data.js'

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

const TOOL_GROUPS = [
  {
    label: 'Draw',
    tools: [
      { id: 'brush', label: 'Brush', icon: '✏' },
      { id: 'fill',  label: 'Fill',  icon: '🪣' },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { id: 'line',     label: 'Line',   icon: '╱' },
      { id: 'rect',     label: 'Rect',   icon: '▭' },
      { id: 'triangle', label: 'Tri',    icon: '△' },
      { id: 'circle',   label: 'Circle', icon: '◯' },
      { id: 'arrow',    label: 'Arrow',  icon: '➜' },
    ],
  },
  {
    label: 'Erase',
    tools: [
      { id: 'eraserStroke', label: 'Stroke', icon: '⌫' },
      { id: 'eraserPixel',  label: 'Pixel',  icon: '◫' },
    ],
  },
  {
    label: 'Select',
    tools: [
      { id: 'select', label: 'Select', icon: '⬚' },
      { id: 'move',   label: 'Move',   icon: '✥' },
      { id: 'rotate', label: 'Rotate', icon: '↻' },
    ],
  },
]

// Keyboard shortcuts (mirror DrawingSurface's keydown map) shown in tooltips for discoverability.
const HOTKEYS = {
  brush: 'B', fill: 'F', line: 'L', rect: 'R', triangle: 'G', circle: 'C', arrow: 'A',
  eraserStroke: 'E', eraserPixel: 'Shift+E', select: 'V', move: 'M', rotate: 'T',
}

const BW_COLORS = [
  { id: 'black', color: '#1a1a1a', name: 'Black' },
  { id: 'white', color: '#f0f0f0', name: 'White' },
]

const ACCENT = '#c9a24a'

export default function ToolDock({
  tool,        setTool,
  color,       setColor,
  dyeId,       setDyeId,
  brushSize,   setBrushSize,
  palette      = 'dyes',
  compact      = false,
  zoom         = 1,
  onZoomIn, onZoomOut, onZoomReset, onRecenter,
  // ── Assist (stroke beautify, SPEC-stroke-beautify.md) — optional; omit to hide the section ──
  autoBeautify, setAutoBeautify,   // QuickShape: auto-snap freehand strokes to clean shapes on finish
  streamline,   setStreamline,     // Streamline: live jitter-smoothing while drawing
  onBeautify,                      // manual: beautify the current selection (or last stroke)
  onDuplicate,                     // duplicate the current selection
  hasSelection = false,            // whether anything is selected (enables selection actions)
}) {
  const colors = palette === 'bw' ? BW_COLORS : DYES

  function pickColor(c) {
    setColor(c.color)
    setDyeId(c.id === 'black' || c.id === 'white' ? null : c.id)
  }

  return (
    <div className={`ds-dock${compact ? ' ds-dock-compact' : ''}`}>
      {/* ── Tool groups ───────────────────────────────────────── */}
      {TOOL_GROUPS.map((group) => (
        <div key={group.label} className="ds-tool-group">
          {!compact && <div className="ds-group-label">{group.label}</div>}
          {/* Two-row grid: full mode uses a 2-col grid; compact uses a 2-row wrapped flex */}
          <div className="ds-tool-row">
            {group.tools.map((t) => (
              <button
                key={t.id}
                className={`ds-tool-btn${tool === t.id ? ' ds-active' : ''}`}
                title={`${group.label}: ${t.label}${HOTKEYS[t.id] ? ` (${HOTKEYS[t.id]})` : ''}`}
                onClick={() => setTool(t.id)}
                aria-pressed={tool === t.id}
              >
                <span className="ds-tool-icon">{t.icon}</span>
                {!compact && <span className="ds-tool-label">{t.label}</span>}
              </button>
            ))}
          </div>
          <div className="ds-sep" />
        </div>
      ))}

      {/* ── Assist: beautify / smooth (QuickShape + Streamline) ─── */}
      {(onBeautify || setAutoBeautify || setStreamline || onDuplicate) && (
        <div className="ds-tool-group ds-assist-group">
          {!compact && <div className="ds-group-label">Assist</div>}
          <div className="ds-tool-row">
            {onBeautify && (
              <button
                className="ds-tool-btn"
                title={`Beautify: snap the selected stroke to a clean shape (Q)`}
                onClick={onBeautify}
              >
                <span className="ds-tool-icon">✦</span>
                {!compact && <span className="ds-tool-label">Beautify</span>}
              </button>
            )}
            {setAutoBeautify && (
              <button
                className={`ds-tool-btn${autoBeautify ? ' ds-active' : ''}`}
                title="Auto-beautify (QuickShape): freehand strokes snap to clean shapes when you finish drawing"
                onClick={() => setAutoBeautify(!autoBeautify)}
                aria-pressed={!!autoBeautify}
              >
                <span className="ds-tool-icon">◎</span>
                {!compact && <span className="ds-tool-label">Auto{autoBeautify ? ' ✓' : ''}</span>}
              </button>
            )}
            {setStreamline && (
              <button
                className={`ds-tool-btn${streamline ? ' ds-active' : ''}`}
                title="Streamline: smooth out hand jitter live as you draw"
                onClick={() => setStreamline(!streamline)}
                aria-pressed={!!streamline}
              >
                <span className="ds-tool-icon">∿</span>
                {!compact && <span className="ds-tool-label">Smooth{streamline ? ' ✓' : ''}</span>}
              </button>
            )}
            {onDuplicate && (
              <button
                className="ds-tool-btn"
                title="Duplicate the selection (Ctrl+D). Use Select/Move/Rotate + Shift-click to pick several first."
                onClick={onDuplicate}
                disabled={!hasSelection}
              >
                <span className="ds-tool-icon">⧉</span>
                {!compact && <span className="ds-tool-label">Duplicate</span>}
              </button>
            )}
          </div>
          <div className="ds-sep" />
        </div>
      )}

      {/* ── Color / dye palette ───────────────────────────────── */}
      <div className="ds-palette-group">
        {!compact && <div className="ds-section-label">{palette === 'bw' ? 'Color' : 'Dye'}</div>}
        <div className="ds-palette">
          {palette !== 'bw' && (
            <button
              className={`ds-swatch${dyeId === null ? ' ds-active' : ''}`}
              title="Default ink (no dye)"
              onClick={() => { setColor(ACCENT); setDyeId(null) }}
              style={{ background: ACCENT }}
              aria-label="Default ink"
            />
          )}
          {colors.map((c) => (
            <button
              key={c.id}
              className={`ds-swatch${(palette === 'bw' ? color === c.color : dyeId === c.id) ? ' ds-active' : ''}`}
              title={c.name + (c.effect ? ` — ${c.effect}` : '')}
              onClick={() => pickColor(c)}
              style={{ background: c.color }}
              aria-label={c.name}
            />
          ))}
        </div>
      </div>

      <div className="ds-sep" />

      {/* ── Brush size ────────────────────────────────────────── */}
      <div className="ds-size-group">
        {!compact && <div className="ds-section-label">Size</div>}
        <div className="ds-size-wrap">
          <input
            type="range"
            min={1}
            max={24}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="ds-size-slider"
            aria-label="Brush size"
            title={`Size: ${brushSize}px`}
          />
          <div
            className="ds-size-dot"
            style={{ width: clamp(brushSize, 2, 24), height: clamp(brushSize, 2, 24), background: color }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="ds-sep" />

      {/* ── Zoom controls ─────────────────────────────────────── */}
      <div className="ds-zoom-group">
        {!compact && <div className="ds-section-label">Zoom</div>}
        <div className="ds-zoom-wrap">
          <button className="ds-zoom-btn" title="Zoom in (Shift+scroll)" onClick={onZoomIn}>+</button>
          <div className="ds-zoom-label">{Math.round(zoom * 100)}%</div>
          <button className="ds-zoom-btn" title="Zoom out (Shift+scroll)" onClick={onZoomOut}>−</button>
          {onRecenter && (
            <button className="ds-zoom-btn ds-zoom-recenter" title="Recenter view (keep zoom)" onClick={onRecenter}>⊕</button>
          )}
          <button className="ds-zoom-btn ds-zoom-reset" title="Reset zoom + pan" onClick={onZoomReset}>1:1</button>
        </div>
      </div>
    </div>
  )
}
