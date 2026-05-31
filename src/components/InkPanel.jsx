import { DYES } from '../engine/data.js'

// Painel de tinta: seleção ÚNICA de ink (uma "caneta"). O ink selecionado colore os
// sigils/signs desenhados ENQUANTO estiver ativo; cada peça guarda sua própria cor.
// Sem ink selecionado => cor padrão. Clicar no ink ativo o desmarca.
export default function InkPanel({ activeInk, onSelect }) {
  return (
    <div className="ink-panel">
      <h3>Conjuring Ink</h3>
      <p className="hint">Pick one ink to draw with — new sigils & signs take its color. Click it again for the default ink.</p>
      <div className="ink-grid">
        {DYES.map((d) => {
          const on = activeInk === d.id
          return (
            <button
              key={d.id}
              className={`ink-chip ${on ? 'on' : ''}`}
              style={{ '--dye': d.color }}
              onClick={() => onSelect(d.id)}
              title={d.effect}
              aria-pressed={on}
            >
              <span className="swatch" style={{ background: d.color }} />
              <span className="ink-name">{d.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
