/**
 * SymbolPalette.jsx — searchable sigil/sign picker for Spell Studio.
 *
 * Props (unchanged — StudioPage contract preserved):
 *   onSelect(symbol) — called with { id, kind:'sigil'|'sign', type } when the
 *                      user clicks a tile.  Clicking the active tile again
 *                      cancels the pending placement.
 *   pendingType      — type id of the symbol currently awaiting placement
 *                      (null if none).
 *
 * Layout strategy
 * ───────────────
 * The palette is a flex-column that fills the sidebar height.
 * ┌─────────────────────┐  flex-shrink: 0  (header)
 * │  Symbols       ◀    │
 * ├─────────────────────┤  flex-shrink: 0  (search)
 * │  [ search… ]      × │
 * ├─────────────────────┤
 * │  SIGILS             │  ← ONE overflow-y:auto container (.sp-body)
 * │  ┌──┬──┬──┬──┐      │    containing both groups.
 * │  │  │  │  │  │      │    No nested scrollbars.
 * │  └──┴──┴──┴──┘      │
 * │  SIGNS              │
 * │  ┌──┬──┬──┬──┐      │
 * │  │  │  │  │  │      │
 * │  └──┴──┴──┴──┘      │
 * └─────────────────────┘
 *
 * The grid uses repeat(auto-fill, minmax(52px, 1fr)) so tiles wrap to
 * however many columns fit the sidebar width — no horizontal overflow.
 */

import { useState } from 'react'
import { SIGILS, SIGNS, getComponentDef } from '../engine/data.js'
import './symbolpalette.css'

/* ── Single tile ──────────────────────────────────────────────── */

function SymbolTile({ sym, kind, pendingType, onSelect }) {
  const def    = getComponentDef(sym.id)
  const active = pendingType === sym.id
  const lc     = def?.lifecycle

  return (
    <button
      className={`sp-tile${active ? ' sp-tile--active' : ''}`}
      title={sym.description || sym.name}
      onClick={() => onSelect({ id: sym.id, kind, type: sym.id })}
      aria-pressed={active}
    >
      <span className="sp-glyph" aria-hidden="true">
        {def?.svgPath ? (
          <svg
            viewBox="-50 -50 100 100"
            width="28"
            height="28"
            style={{ color: 'currentColor', display: 'block' }}
          >
            <path d={def.svgPath} fill="currentColor" fillRule="evenodd" />
          </svg>
        ) : (
          <span className="sp-glyph-circle" />
        )}
      </span>
      <span className="sp-name">{sym.name}</span>
      {['revised', 'unverified'].includes(lc?.status) && (
        <span
          className={`sp-lc-dot sp-lc-dot--${lc.status}`}
          title={[
            lc.status === 'revised'
              ? `Revised (rev ${lc.rev ?? '?'})`
              : 'Unverified — pending re-review',
            lc.flag?.reason,
            lc.reviewedAt && `Last reviewed: ${lc.reviewedAt}`,
          ].filter(Boolean).join(' · ')}
          aria-label={`Symbol status: ${lc.status}`}
        />
      )}
    </button>
  )
}

/* ── Palette ─────────────────────────────────────────────────── */

export default function SymbolPalette({ onSelect, pendingType }) {
  const [query,     setQuery]     = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const q = query.toLowerCase().trim()

  const lcHidden = (s) => ['deprecated', 'removed'].includes(s.lifecycle?.status)
  const sigils = SIGILS.filter((s) => s.family && s.family !== 'special' && !lcHidden(s))
  const signs  = SIGNS.filter((s)  => s.family && !['other'].includes(s.family) && !lcHidden(s))

  const filteredSigils = q
    ? sigils.filter((s) => s.name.toLowerCase().includes(q) || (s.element || '').toLowerCase().includes(q))
    : sigils
  const filteredSigns = q
    ? signs.filter((s) => s.name.toLowerCase().includes(q))
    : signs

  const noResults = filteredSigils.length === 0 && filteredSigns.length === 0

  return (
    <div className={`sp-palette${collapsed ? ' sp-palette--collapsed' : ''}`}>

      {/* ── fixed header ── */}
      <div className="sp-header">
        <span className="sp-title">Symbols</span>
        <button
          className="sp-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand palette' : 'Collapse palette'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '◀' : '▶'}
        </button>
      </div>

      {/* ── fixed search bar ── */}
      <div className="sp-search-row">
        <input
          type="text"
          className="sp-search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search symbols"
        />
        {query && (
          <button
            className="sp-clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* ── single scroll body — ONE overflow container ── */}
      <div className="sp-body">

        {noResults && (
          <p className="sp-empty">No symbols match "{query}"</p>
        )}

        {filteredSigils.length > 0 && (
          <div className="sp-group">
            <div className="sp-group-label">Sigils</div>
            <div className="sp-grid">
              {filteredSigils.map((s) => (
                <SymbolTile
                  key={s.id}
                  sym={s}
                  kind="sigil"
                  pendingType={pendingType}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        )}

        {filteredSigns.length > 0 && (
          <div className="sp-group">
            <div className="sp-group-label">Signs</div>
            <div className="sp-grid">
              {filteredSigns.map((s) => (
                <SymbolTile
                  key={s.id}
                  sym={s}
                  kind="sign"
                  pendingType={pendingType}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
