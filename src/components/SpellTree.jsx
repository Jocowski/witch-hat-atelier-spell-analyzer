// SpellTree: a structural overview of the whole spell — every circle, its core and
// components, and the relations between circles. The single biggest aid for complex/nested
// spells: click a row to select it on the canvas, hover to highlight, use the eye to focus a
// circle (dim the rest). Pure consumer of App state.
import { getComponentDef } from '../engine/data.js'

export default function SpellTree({
  composition, activeCircleId, selected, focusedCircleId,
  onSelectCircle, onSelectPart, onHover, onToggleFocus,
}) {
  const { circles, relations } = composition
  const nm = (id) => circles.find((c) => c.id === id)?.name || id

  return (
    <div className="spell-tree panel">
      <h2>Structure</h2>
      <ul className="tree">
        {circles.map((c) => {
          const isActive = c.id === activeCircleId
          const core = c.core
          const signs = c.components || []
          return (
            <li key={c.id} className="tree-circle">
              <div className={`tree-row circle ${isActive ? 'active' : ''}`}>
                <button className="tree-eye" title={focusedCircleId === c.id ? 'Unfocus' : 'Focus this circle (dim others)'}
                  onClick={(e) => { e.stopPropagation(); onToggleFocus(c.id) }}>
                  {focusedCircleId === c.id ? '◉' : '○'}
                </button>
                <button className="tree-label" onClick={() => onSelectCircle(c.id)}
                  onMouseEnter={() => onHover({ circleId: c.id })} onMouseLeave={() => onHover(null)}>
                  <span className="tree-icon">◯</span>{c.name || c.id}
                  <span className="tree-meta">{c.ring?.closed ? 'closed' : 'open'} · r{Math.round(c.radius ?? 0)}</span>
                </button>
              </div>
              <ul className="tree-parts">
                {core && (
                  <li className={`tree-row part ${selected?.partId === core.id ? 'sel' : ''}`}
                    onClick={() => onSelectPart(c.id, core.id)}
                    onMouseEnter={() => onHover({ circleId: c.id, partId: core.id })} onMouseLeave={() => onHover(null)}>
                    <span className="tree-icon core">✦</span>{getComponentDef(core.type)?.name || core.type}<span className="tree-meta">core</span>
                  </li>
                )}
                {signs.map((p) => (
                  <li key={p.id} className={`tree-row part ${selected?.partId === p.id ? 'sel' : ''}`}
                    onClick={() => onSelectPart(c.id, p.id)}
                    onMouseEnter={() => onHover({ circleId: c.id, partId: p.id })} onMouseLeave={() => onHover(null)}>
                    <span className={`tree-icon ${p.role}`}>{p.role === 'sigil' ? '◈' : '·'}</span>
                    {getComponentDef(p.type)?.name || p.type}
                    <span className="tree-meta">{p.role}{p.inverted ? ' · inv' : ''}</span>
                  </li>
                ))}
                {!core && signs.length === 0 && <li className="tree-row empty">empty circle</li>}
              </ul>
            </li>
          )
        })}
      </ul>
      {relations.length > 0 && (
        <div className="tree-rels">
          {relations.map((r, i) => (
            <span key={i} className={`rel-chip ${r.type}`}>
              {r.type === 'nest' ? `${nm(r.inner)} ⊂ ${nm(r.outer)}` : `${nm(r.a)} ↔ ${nm(r.b)}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
