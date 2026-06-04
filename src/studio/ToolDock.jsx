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
 *   brush | line | rect | triangle | circle | arrow
 *   eraserStroke | eraserPixel
 *   select | move | rotate
 */

import { DYES } from '../engine/data.js'

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

const TOOL_GROUPS = [
  {
    label: 'Draw',
    tools: [{ id: 'brush', label: 'Brush', icon: '✏' }],
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
  onZoomIn, onZoomOut, onZoomReset,
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
                title={`${group.label}: ${t.label}`}
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
          <button className="ds-zoom-btn ds-zoom-reset" title="Reset zoom + pan" onClick={onZoomReset}>1:1</button>
        </div>
      </div>
    </div>
  )
}
