import { SIGILS, SIGNS } from '../engine/data.js'

// Renderiza o svgPath de um sigil/sign num <svg> de preview.
function Glyph({ def }) {
  return (
    <svg viewBox="-50 -50 100 100" aria-hidden>
      {def.satellites?.map((s, i) => {
        const r = s.radius * 50
        const rad = (s.angle * Math.PI) / 180
        return <circle key={i} cx={r * Math.sin(rad)} cy={-r * Math.cos(rad)} r="3.5" fill="currentColor" />
      })}
      <path d={def.svgPath} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Item({ def, kind, onAdd }) {
  return (
    <div
      className={`palette-item ${kind === 'sigil' ? 'is-sigil' : ''}`}
      title={`${def.name}${def.effect ? ' — ' + def.effect : def.description ? ' — ' + def.description : ''}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('application/x-wha', JSON.stringify({ type: def.id, kind }))}
      onClick={() => onAdd(def.id, kind)}
    >
      <Glyph def={def} />
      <span className="label">{def.name}</span>
    </div>
  )
}

export default function Palette({ onAdd }) {
  const mainSigils = SIGILS.filter((s) => ['main', 'variant', 'minor'].includes(s.category))
  const specialSigils = SIGILS.filter((s) => s.category === 'sign-as-sigil')
  const usableSigns = SIGNS.filter((s) => s.id !== 'unknown_sign')

  return (
    <div className="panel palette">
      <h2>Palette</h2>
      <p className="hint">Drag onto the canvas or click to add. Sigils go to the center; signs to the rings.</p>

      <div className="palette-section">
        <h3>Sigils (elements)</h3>
        <div className="palette-grid">
          {mainSigils.map((d) => <Item key={d.id} def={d} kind="sigil" onAdd={onAdd} />)}
        </div>
      </div>

      <div className="palette-section">
        <h3>Special sigils (sign-as-sigil)</h3>
        <div className="palette-grid">
          {specialSigils.map((d) => <Item key={d.id} def={d} kind="sigil" onAdd={onAdd} />)}
        </div>
      </div>

      <div className="palette-section">
        <h3>Signs (keystones)</h3>
        <div className="palette-grid">
          {usableSigns.map((d) => <Item key={d.id} def={d} kind="sign" onAdd={onAdd} />)}
        </div>
      </div>
    </div>
  )
}
