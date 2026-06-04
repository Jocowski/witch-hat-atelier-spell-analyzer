// TrainingView.jsx — draw a symbol with the full Studio tools, pick/add a symbol from the registry,
// and save the training sample to the DB. Uses the shared DrawingSurface (black/white palette).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DrawingSurface from '../studio/DrawingSurface.jsx'
import { recognize, makeCloud, strokesToTemplate } from '../draw/recognizer.js'
import { listSymbols, addSymbol } from '../data-services/symbols.js'
import { addSample, listSamples } from '../data-services/samples.js'

const EMPTY_FORM = { kind: 'sign', name: '', label: '', status: 'canon', operator_kind: '' }

function groupByKind(symbols) {
  const groups = {}
  for (const s of symbols) { (groups[s.kind] ||= []).push(s) }
  return groups
}

// stroke objects from DrawingSurface ({tool,color,width,points}) → point arrays for the recognizer.
const toPointArrays = (strokes) => (strokes || []).map((s) => s.points).filter((p) => p && p.length >= 2)

export default function TrainingView() {
  const canvasRef = useRef(null)

  const [symbols, setSymbols] = useState([])
  const [symbolsErr, setSymbolsErr] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [exampleCount, setExampleCount] = useState(0)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addErr, setAddErr] = useState(null)
  const [addLoading, setAddLoading] = useState(false)

  const [liveGuess, setLiveGuess] = useState(null)
  const [clouds, setClouds] = useState([])

  const [saveMsg, setSaveMsg] = useState(null)
  const [saveErr, setSaveErr] = useState(null)
  const [saving, setSaving] = useState(false)

  const loadSymbols = useCallback(async () => {
    setSymbolsErr(null)
    try {
      const rows = await listSymbols()
      setSymbols(rows ?? [])
      if (rows?.length && !selectedId) setSelectedId(rows[0].id)
    } catch (err) { setSymbolsErr(err.message) }
  }, [selectedId])

  useEffect(() => { loadSymbols() }, [])

  // example count for the selected symbol
  useEffect(() => {
    if (!selectedId) { setExampleCount(0); return }
    let cancelled = false
    listSamples().then((rows) => {
      if (cancelled) return
      setExampleCount((rows ?? []).filter((r) => r.symbol_id === selectedId && !r.deleted_at).length)
    }).catch(() => setExampleCount(0))
    return () => { cancelled = true }
  }, [selectedId, saveMsg])

  // build recognizer clouds from active samples (best-effort, for the live guess)
  useEffect(() => {
    let cancelled = false
    listSamples().then((rows) => {
      if (cancelled || !rows?.length) return
      const byName = {}
      for (const r of rows) {
        if (r.deleted_at) continue
        const sym = symbols.find((s) => s.id === r.symbol_id)
        const name = sym?.engine_id || sym?.name || r.symbol_id
        ;(byName[name] ||= []).push(...(r.points ?? []))
      }
      const built = Object.entries(byName).filter(([, p]) => p.length >= 2).map(([name, p]) => makeCloud(name, p))
      if (!cancelled) setClouds(built)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [symbols, saveMsg])

  // live guess on each drawing change
  const handleChange = useCallback(() => {
    if (!clouds.length || !canvasRef.current) return
    const arrays = toPointArrays(canvasRef.current.getStrokes())
    if (!arrays.length) { setLiveGuess(null); return }
    const pts = arrays.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id })))
    setLiveGuess(recognize(pts, clouds).slice(0, 3))
  }, [clouds])

  async function handleSave() {
    setSaveErr(null); setSaveMsg(null)
    if (!selectedId) { setSaveErr('Select a symbol first.'); return }
    const arrays = toPointArrays(canvasRef.current?.getStrokes())
    const sym = symbols.find((s) => s.id === selectedId)
    const role = sym?.kind === 'sigil' ? 'sigil' : 'sign'
    const tmpl = strokesToTemplate(arrays, sym?.name ?? '', role)
    if (tmpl.points.length < 2) { setSaveErr('Draw something first.'); return }
    setSaving(true)
    try {
      await addSample({ symbol_id: selectedId, points: tmpl.points, role, source: 'drawn', app_version: 'studio' })
      setSaveMsg('Sample saved.')
      canvasRef.current?.clear(); setLiveGuess(null)
    } catch (err) { setSaveErr(err.message || 'Save failed.') } finally { setSaving(false) }
  }

  async function handleAddSymbol(e) {
    e.preventDefault()
    setAddErr(null); setAddLoading(true)
    try {
      const row = await addSymbol({
        kind: addForm.kind, name: addForm.name.trim(), label: addForm.label.trim() || undefined,
        status: addForm.status, operator_kind: addForm.operator_kind.trim() || undefined,
      })
      setAddForm(EMPTY_FORM); setShowAddForm(false)
      await loadSymbols()
      if (row?.id) setSelectedId(row.id)
    } catch (err) { setAddErr(err.message || 'Failed to add symbol.') } finally { setAddLoading(false) }
  }

  const grouped = useMemo(() => groupByKind(symbols), [symbols])
  const selectedSym = symbols.find((s) => s.id === selectedId)

  return (
    <div className="admin-train-wrap">
      <h3 className="admin-section-title">Training</h3>

      <div className="admin-train-layout">
        <div className="admin-train-canvas-col">
          <DrawingSurface ref={canvasRef} palette="bw" enableSymbols={false} compact onChange={handleChange} />
          <div className="admin-train-actions">
            <button className="admin-btn" onClick={() => { canvasRef.current?.clear(); setLiveGuess(null); setSaveMsg(null); setSaveErr(null) }}>Clear</button>
            <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !selectedId}>
              {saving ? 'Saving…' : 'Save sample'}
            </button>
          </div>
          {saveMsg && <p className="admin-ok">{saveMsg}</p>}
          {saveErr && <p className="admin-error">{saveErr}</p>}
        </div>

        <div className="admin-train-right">
          <div className="admin-field">
            <label className="admin-label">Symbol</label>
            {symbolsErr
              ? <p className="admin-error">Could not load symbols: {symbolsErr}</p>
              : (
                <select className="admin-select" value={selectedId}
                  onChange={(e) => { setSelectedId(e.target.value); setSaveMsg(null); setSaveErr(null) }}>
                  {Object.entries(grouped).map(([kind, rows]) => (
                    <optgroup key={kind} label={kind}>
                      {rows.map((s) => (
                        <option key={s.id} value={s.id}>{s.label || s.name}{s.label ? ` (${s.name})` : ''}</option>
                      ))}
                    </optgroup>
                  ))}
                  {symbols.length === 0 && <option value="">No symbols yet</option>}
                </select>
              )}
            {selectedSym && (
              <p className="admin-hint">
                {selectedSym.kind} · {selectedSym.status}
                {selectedSym.engine_id ? ` · engine_id: ${selectedSym.engine_id}` : ''}
                {' · '}<strong>{exampleCount} example{exampleCount !== 1 ? 's' : ''}</strong>
              </p>
            )}
          </div>

          <button className="admin-btn admin-btn-ghost" style={{ alignSelf: 'flex-start' }}
            onClick={() => { setShowAddForm((v) => !v); setAddErr(null) }}>
            {showAddForm ? 'Cancel add' : '+ Add new symbol'}
          </button>

          {showAddForm && (
            <form className="admin-add-form" onSubmit={handleAddSymbol}>
              <label className="admin-label">Kind
                <select className="admin-select" value={addForm.kind} onChange={(e) => setAddForm((f) => ({ ...f, kind: e.target.value }))}>
                  <option value="sign">sign</option>
                  <option value="sigil">sigil</option>
                </select>
              </label>
              <label className="admin-label">Name <span className="admin-hint">(unique, no spaces)</span>
                <input className="admin-input" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} required />
              </label>
              <label className="admin-label">Label <span className="admin-hint">(display name, optional)</span>
                <input className="admin-input" value={addForm.label} onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))} />
              </label>
              <label className="admin-label">Status
                <select className="admin-select" value={addForm.status} onChange={(e) => setAddForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="canon">canon</option>
                  <option value="fan">fan</option>
                </select>
              </label>
              <label className="admin-label">Operator kind <span className="admin-hint">(fan signs — mirrors grammar.json)</span>
                <input className="admin-input" value={addForm.operator_kind} onChange={(e) => setAddForm((f) => ({ ...f, operator_kind: e.target.value }))} placeholder="e.g. motion, form, power…" />
              </label>
              {addErr && <p className="admin-error">{addErr}</p>}
              <button type="submit" className="admin-btn admin-btn-primary" disabled={addLoading}>
                {addLoading ? 'Adding…' : 'Add symbol'}
              </button>
            </form>
          )}

          <div className="admin-live-guess">
            <h4 className="admin-subsection">Live guess</h4>
            {liveGuess
              ? <>
                  <div className="admin-guess-top">{liveGuess[0]?.name || '—'}</div>
                  <div className="admin-hint">{liveGuess.map((r) => `${r.name} (${r.dist.toFixed(2)})`).join(' · ')}</div>
                </>
              : <div className="admin-hint">Draw something to see a guess…</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
