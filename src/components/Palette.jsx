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
      {def.text ? (
        <text x="0" y="15" textAnchor="middle" fontSize="58" fontWeight="700" fill="currentColor">{def.text}</text>
      ) : def.render === 'fill' ? (
        <path d={def.svgPath} fill="currentColor" fillRule="evenodd" />
      ) : (
        <path d={def.svgPath} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      )}
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

// Sigil families, in display order, per the Sigils doc.
const SIGIL_FAMILIES = [
  { id: 'fire', title: 'Fire' },
  { id: 'water', title: 'Water' },
  { id: 'earth', title: 'Earth' },
  { id: 'air', title: 'Air' },
  { id: 'time', title: 'Time' },
  { id: 'decorative', title: 'Decorative' },
  { id: 'misc', title: 'Misc' },
  { id: 'special', title: 'Special (sign-as-sigil)' },
]

export default function Palette({ onAdd }) {
  const usableSigns = SIGNS.filter((s) => s.id !== 'unknown_sign')
  const byFamily = (fam) => SIGILS.filter((s) => (s.family || 'misc') === fam)

  return (
    <div className="panel palette">
      <h2>Palette</h2>
      <p className="hint">Drag onto the canvas or click to add. Sigils go to the center; signs to the rings.</p>

      {SIGIL_FAMILIES.map(({ id, title }) => {
        const items = byFamily(id)
        if (!items.length) return null
        return (
          <div className="palette-section" key={id}>
            <h3>{title} sigils</h3>
            <div className="palette-grid">
              {items.map((d) => <Item key={d.id} def={d} kind="sigil" onAdd={onAdd} />)}
            </div>
          </div>
        )
      })}

      <div className="palette-section">
        <h3>Signs (keystones)</h3>
        <div className="palette-grid">
          {usableSigns.map((d) => <Item key={d.id} def={d} kind="sign" onAdd={onAdd} />)}
        </div>
      </div>
    </div>
  )
}
