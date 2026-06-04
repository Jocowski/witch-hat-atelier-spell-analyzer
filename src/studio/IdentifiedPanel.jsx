/**
 * IdentifiedPanel.jsx — after Analyze, list each detected symbol with confidence and a correction
 * control. Two kinds of rows:
 *   - PLACED  symbols (dropped from the palette): already known; a relabel just re-runs analysis.
 *   - RECOGNIZED symbols (from drawn strokes): carry the recognizer GROUP, so a correction can save
 *     the drawn points as a NEW training example (the flywheel) — resolving the real symbol UUID via
 *     getSymbolByEngineId before writing to training_samples.
 *
 * Props:
 *   placed    : placed[] from canvas.getModel() (centre-origin) — known palette symbols.
 *   groups    : recognizer groups[] ({ role, match:{name,rotation,dist}, strokes, ... }).
 *   onRelabel : (oldType, newType) => void — caller can re-run analysis after a relabel.
 */
import { useState } from 'react'
import { SIGILS, SIGNS } from '../engine/data.js'
import { groupToTemplate } from '../draw/recognizer.js'
import { addSample } from '../data-services/samples.js'
import { getSymbolByEngineId } from '../data-services/symbols.js'

const ALL_IDS = [
  ...SIGILS.map((s) => ({ id: s.id, label: `${s.name} (sigil)` })),
  ...SIGNS.map((s) => ({ id: s.id, label: `${s.name} (sign)` })),
]

function confidencePct(dist) {
  if (dist == null || dist === 0) return 100
  return Math.round(Math.min(1, 1 / dist) * 100)
}

function Row({ type, kind, dist, isRecognized, confident = true, group, onRelabel }) {
  const [editing, setEditing] = useState(false)
  const [newType, setNewType] = useState(type || '')
  const [status, setStatus] = useState(null) // null | 'saved' | 'trained' | 'error'

  async function doRelabel() {
    const target = newType.trim()
    if (!target || target === type) { setEditing(false); return }
    onRelabel?.(group, target) // group present for recognized rows; undefined for placed (caller ignores)
    setEditing(false)
    // For a recognized symbol we have the drawn strokes → save a corrected training example.
    if (!isRecognized || !group) { setStatus('saved'); return }
    try {
      const symbol = await getSymbolByEngineId(target)
      if (!symbol) { setStatus('saved'); return } // no DB or unknown id → relabel only
      const role = group.role === 'core' ? 'sigil' : 'sign'
      const points = groupToTemplate(group, target, role).points
      await addSample({ symbol_id: symbol.id, points, role, source: 'corrected', app_version: 'studio' })
      setStatus('trained')
    } catch {
      setStatus('error')
    }
  }

  const pct = confidencePct(dist)
  const confClass = pct >= 60 ? 'conf-high' : pct >= 30 ? 'conf-mid' : 'conf-low'
  // A2: below the gate, don't assert the label — show "unknown?" with the top guess as a suggestion.
  const uncertain = isRecognized && !confident

  return (
    <li className="identified-row">
      <div className="identified-main">
        <span className={`identified-badge ${kind}`}>{kind}</span>
        <span className="identified-type">
          {uncertain ? 'unknown?' : (type || '—')}
          {uncertain && type && <span className="identified-suggest"> (maybe {type})</span>}
        </span>
        {isRecognized
          ? <span className={`identified-conf ${confClass}`} title="Recognition confidence">{pct}%</span>
          : <span className="identified-placed" title="Placed from palette">placed</span>}
      </div>
      <div className="identified-controls">
        {editing ? (
          <>
            <input className="identified-input" list="all-symbol-ids" value={newType} autoFocus
              onChange={(e) => setNewType(e.target.value)} placeholder="correct id…" />
            <button className="identified-confirm" onClick={doRelabel} title="Confirm">✓</button>
            <button className="identified-cancel" onClick={() => setEditing(false)} title="Cancel">✗</button>
          </>
        ) : (
          <>
            {status === 'trained' && <span className="identified-saved" title="Saved as a training example">trained ✓</span>}
            {status === 'saved' && <span className="identified-saved">relabeled</span>}
            {status === 'error' && <span className="note warn">save failed</span>}
            <button className="identified-edit" onClick={() => setEditing(true)} title="Correct this symbol">Edit</button>
          </>
        )}
      </div>
    </li>
  )
}

export default function IdentifiedPanel({ placed = [], groups = [], onRelabel }) {
  const recognized = groups.filter((g) => g.match)
  if (placed.length === 0 && recognized.length === 0) return null

  return (
    <div className="identified-panel">
      <h3 className="identified-title">Identified symbols</h3>
      <datalist id="all-symbol-ids">
        {ALL_IDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </datalist>
      <ul className="identified-list">
        {placed.map((sym, i) => (
          <Row key={`placed-${i}`} type={sym.type || sym.id} kind={sym.kind === 'sigil' ? 'sigil' : 'sign'}
            isRecognized={false} onRelabel={onRelabel} />
        ))}
        {recognized.map((g, i) => (
          <Row key={`rec-${i}`} type={g.match.name} kind={g.role === 'core' ? 'sigil' : 'sign'}
            dist={g.match.dist} isRecognized confident={g.confident !== false} group={g} onRelabel={onRelabel} />
        ))}
      </ul>
    </div>
  )
}
