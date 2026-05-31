import { useState } from 'react'
import { SIGILS, SIGNS } from '../engine/data.js'

// Renderiza o glyph de um sigil/sign num <svg> de preview.
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

// Sigil families (Sigils doc) and sign categories (Signs doc), in display order.
const SIGIL_FAMILIES = [
  ['fire', 'Fire'], ['water', 'Water'], ['earth', 'Earth'], ['air', 'Air'],
  ['time', 'Time'], ['decorative', 'Decorative'], ['misc', 'Misc'],
]
const SIGN_FAMILIES = [
  ['directional', 'Directional'], ['semi-directional', 'Semi-Directional'],
  ['non-directional', 'Non-Directional'], ['asymmetric', 'Asymmetric'],
]

function Section({ title, items, kind, onAdd, searching, collapsed, onToggle }) {
  const open = searching ? true : !collapsed // a search forces sections open
  return (
    <div className="palette-section">
      <button className="palette-section-head" onClick={onToggle} aria-expanded={open} disabled={searching}>
        <span className="caret">{open ? '▾' : '▸'}</span>
        <span className="sec-title">{title}</span>
        <span className="sec-count">{items.length}</span>
      </button>
      {open && (
        <div className="palette-grid">
          {items.map((d) => <Item key={d.id} def={d} kind={kind} onAdd={onAdd} />)}
        </div>
      )}
    </div>
  )
}

export default function Palette({ onAdd }) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const q = query.trim().toLowerCase()
  const toggle = (key) => setCollapsed((c) => ({ ...c, [key]: !c[key] }))

  // Build the visible sections for a group, filtering items by the search query
  // and dropping sections (and, upstream, the whole group) that have no matches.
  const sectionsFor = (list, families, prefix, suffix) =>
    families
      .map(([fam, title]) => {
        const all = list.filter((s) => (s.family || '') === fam)
        const items = q ? all.filter((d) => d.name.toLowerCase().includes(q)) : all
        return { key: prefix + fam, title: `${title} ${suffix}`, items }
      })
      .filter((s) => s.items.length)

  const sigilSections = sectionsFor(SIGILS, SIGIL_FAMILIES, 'sig-', 'sigils')
  const signSections = sectionsFor(SIGNS, SIGN_FAMILIES, 'sgn-', 'signs')

  const renderGroup = (label, sections, kind) =>
    sections.length ? (
      <>
        <h4 className="palette-group">{label}</h4>
        {sections.map((s) => (
          <Section key={s.key} title={s.title} items={s.items} kind={kind} onAdd={onAdd}
            searching={!!q} collapsed={collapsed[s.key]} onToggle={() => toggle(s.key)} />
        ))}
      </>
    ) : null

  return (
    <div className="panel palette">
      <h2>Palette</h2>
      <div className="palette-search">
        <input
          type="search"
          placeholder="Search sigils & signs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search sigils and signs by name"
        />
        {query && <button className="clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
      </div>
      <p className="hint">Drag onto the canvas or click to add. Sigils go to the center; signs to the rings.</p>

      {renderGroup('Sigils (elements)', sigilSections, 'sigil')}
      {renderGroup('Signs (keystones)', signSections, 'sign')}
      {!sigilSections.length && !signSections.length && (
        <p className="hint">No sigils or signs match “{query}”.</p>
      )}
    </div>
  )
}
