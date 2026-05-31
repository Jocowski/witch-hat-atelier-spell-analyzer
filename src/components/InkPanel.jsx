import { DYES } from '../engine/data.js'

// Conjuring-ink mixer: toggle magical dyes into the ink to modify the spell.
export default function InkPanel({ dyes, onToggle }) {
  const active = new Set(dyes || [])
  return (
    <div className="ink-panel">
      <h3>Conjuring Ink</h3>
      <p className="hint">Mix magical dyes into the ink for extra effects.</p>
      <div className="dye-list">
        {DYES.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`dye-chip ${active.has(d.id) ? 'on' : ''}`}
            title={d.effect}
            aria-pressed={active.has(d.id)}
            onClick={() => onToggle(d.id)}
          >
            <span className="swatch" style={{ background: d.color }} />
            {d.name}
          </button>
        ))}
      </div>
    </div>
  )
}
