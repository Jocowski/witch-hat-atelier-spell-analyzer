/**
 * IdentifiedPanel.jsx — after Analyze, list each detected symbol with confidence and a correction
 * control. Two kinds of rows:
 *   - PLACED  symbols (dropped from the palette): already known; a relabel just re-runs analysis.
 *   - RECOGNIZED symbols (from drawn strokes): carry the recognizer GROUP, so a correction can save
 *     the drawn points as a NEW training example (the flywheel) — resolving the real symbol UUID via
 *     getSymbolByEngineId before writing to training_samples.
 *
 * Merge: the segmentation step can over-split ONE hand-drawn symbol into several recognized rows
 * (e.g. one "levitation" read as three). Tick their checkboxes and "Merge" stitches the strokes back
 * into a single group (re-recognized) and auto-opens its label editor so you set what it is — which
 * saves the combined strokes as one training example.
 *
 * Props:
 *   placed    : placed[] from canvas.getModel() (centre-origin) — known palette symbols.
 *   groups    : recognizer groups[] ({ role, match:{name,rotation,dist}, strokes, ... }).
 *   onRelabel : (group, newType) => void — caller can re-run analysis after a relabel.
 *   onMerge   : (groups[]) => void — caller merges the given recognized groups into one.
 */
import { useEffect, useState } from 'react'
import { SIGILS, SIGNS } from '../engine/data.js'
import { groupToTemplate } from '../draw/recognizer.js'
import { addSample } from '../data-services/samples.js'
import { getSymbolByEngineId } from '../data-services/symbols.js'

// Built per-render (not at module load) so DB-overlay symbols appear in the correction datalist.
function allSymbolIds() {
  return [
    ...SIGILS.map((s) => ({ id: s.id, label: `${s.name} (sigil)` })),
    ...SIGNS.map((s) => ({ id: s.id, label: `${s.name} (sign)` })),
  ]
}

function confidencePct(dist) {
  if (dist == null || dist === 0) return 100
  return Math.round(Math.min(1, 1 / dist) * 100)
}

function Row({
  type, kind, dist, isRecognized, confident = true, group, onRelabel,
  selectable = false, selected = false, onToggleSelect, autoEdit = false,
}) {
  const [editing, setEditing] = useState(() => !!autoEdit)
  const [newType, setNewType] = useState(type || '')
  const [status, setStatus] = useState(null) // null | 'saved' | 'trained' | 'error'
  // A just-merged row should train on confirm even if its (re-recognized) label is unchanged. We
  // latch this locally because the _justMerged flag is cleared as soon as the editor opens.
  const [forceTrain, setForceTrain] = useState(() => !!autoEdit)

  // A just-merged row asks to open its editor immediately. Clear the flag once consumed so a later
  // re-render doesn't reopen it.
  useEffect(() => {
    if (autoEdit) { setEditing(true); setForceTrain(true); setNewType(type || ''); if (group) group._justMerged = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit])

  async function doRelabel() {
    const target = newType.trim()
    if (!target) { setEditing(false); setForceTrain(false); return }
    const changed = target !== type
    // For a normal row, confirming the same label is a no-op. For a just-merged row we still want to
    // teach the combined strokes, so train even when the label is unchanged.
    if (!changed && !forceTrain) { setEditing(false); return }
    setForceTrain(false)
    if (changed) onRelabel?.(group, target) // group present for recognized rows; undefined for placed
    setEditing(false)
    // For a recognized symbol we have the drawn strokes → save a (corrected/confirmed) training example.
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
    <li className={`identified-row${selected ? ' selected' : ''}`}>
      <div className="identified-main">
        {selectable && (
          <input
            type="checkbox"
            className="identified-check"
            checked={selected}
            onChange={() => onToggleSelect?.(group)}
            title="Select to merge with other rows"
          />
        )}
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
            <button className="identified-cancel" onClick={() => { setEditing(false); setForceTrain(false) }} title="Cancel">✗</button>
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

export default function IdentifiedPanel({ placed = [], groups = [], onRelabel, onMerge }) {
  const recognized = groups.filter((g) => g.match)
  // Selected recognized groups (by reference) for the merge action. Reset whenever the group set
  // changes (a merge/correction replaces the array), so stale references never linger.
  const [selected, setSelected] = useState(() => new Set())
  useEffect(() => { setSelected(new Set()) }, [groups])

  if (placed.length === 0 && recognized.length === 0) return null

  function toggle(group) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group); else next.add(group)
      return next
    })
  }

  function doMerge() {
    const picked = recognized.filter((g) => selected.has(g))
    if (picked.length < 2) return
    onMerge?.(picked)
    setSelected(new Set())
  }

  const canMerge = recognized.length > 1
  const selectedCount = selected.size

  return (
    <div className="identified-panel">
      <div className="identified-titlebar">
        <h3 className="identified-title">Identified symbols</h3>
        {canMerge && (
          <button
            className="identified-merge-btn"
            onClick={doMerge}
            disabled={selectedCount < 2}
            title="Combine the ticked rows into one symbol (a single drawing read as several)"
          >
            ⧉ Merge{selectedCount >= 2 ? ` ${selectedCount}` : ''}
          </button>
        )}
      </div>
      {canMerge && (
        <p className="identified-merge-hint">
          One symbol split into several rows? Tick them and Merge, then set what it is.
        </p>
      )}
      <datalist id="all-symbol-ids">
        {allSymbolIds().map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </datalist>
      <ul className="identified-list">
        {placed.map((sym, i) => (
          <Row key={`placed-${i}`} type={sym.type || sym.id} kind={sym.kind === 'sigil' ? 'sigil' : 'sign'}
            isRecognized={false} onRelabel={onRelabel} />
        ))}
        {recognized.map((g, i) => (
          <Row key={`rec-${i}`} type={g.match.name} kind={g.role === 'core' ? 'sigil' : 'sign'}
            dist={g.match.dist} isRecognized confident={g.confident !== false} group={g} onRelabel={onRelabel}
            selectable={canMerge} selected={selected.has(g)} onToggleSelect={toggle} autoEdit={!!g._justMerged} />
        ))}
      </ul>
    </div>
  )
}
