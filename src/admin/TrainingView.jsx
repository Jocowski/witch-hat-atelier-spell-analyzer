// TrainingView.jsx — draw a symbol with the full Studio tools, pick/add a symbol from the registry,
// and save the training sample to the DB. Uses the shared DrawingSurface (black/white palette).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DrawingSurface from '../studio/DrawingSurface.jsx'
import { recognize, makeCloud, strokesToTemplate } from '../draw/recognizer.js'
import { getComponentDef } from '../engine/data.js'
import { listSymbols, addSymbol } from '../data-services/symbols.js'
import { addSample, listSamples } from '../data-services/samples.js'
import rules from '../../data/rules.json'
import modelMeta from '../draw/ml-assets/model.meta.json'

// M4b: model version string for Supabase prototype keying (from model.meta.json).
const MODEL_VERSION = String(modelMeta.version ?? '1')

const EMPTY_FORM = { kind: 'sign', name: '', label: '', status: 'canon', operator_kind: '' }

// A3 — ML-readiness thresholds (data-driven via rules.json).
const ML_TMIN = rules.mlReadiness?.tMin ?? 50
const ML_COVERAGE_TARGET = rules.mlReadiness?.coverageTarget ?? 0.9

// Dataset coverage + ML-readiness bars and the least-covered symbols to draw next (active learning).
function CoveragePanel({ symbols, counts, onPick }) {
  const total = symbols.length
  if (!total) return null
  const bySymbol = counts.bySymbol || {}
  const covered = symbols.filter((s) => (bySymbol[s.id] || 0) >= ML_TMIN).length
  const coveragePct = covered / total
  const volumeTarget = total * ML_TMIN
  const volumePct = Math.min(1, (counts.total || 0) / (volumeTarget || 1))
  const ready = coveragePct >= ML_COVERAGE_TARGET
  const least = symbols
    .map((s) => ({ s, n: bySymbol[s.id] || 0 }))
    .sort((a, b) => a.n - b.n)
    .slice(0, 6)
  const Bar = ({ frac }) => (
    <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${Math.round(frac * 100)}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-2), var(--accent))' }} />
    </div>
  )
  return (
    <div className="admin-coverage" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h4 className="admin-subsection">Dataset readiness {ready ? '· ✅ ML-ready' : `· ${ML_TMIN}+/symbol target`}</h4>
      <div>
        <div className="admin-hint">Coverage: {covered}/{total} symbols ≥ {ML_TMIN} ({Math.round(coveragePct * 100)}% · target {Math.round(ML_COVERAGE_TARGET * 100)}%)</div>
        <Bar frac={coveragePct} />
      </div>
      <div>
        <div className="admin-hint">Volume: {counts.total || 0}/{volumeTarget} samples ({Math.round(volumePct * 100)}%)</div>
        <Bar frac={volumePct} />
      </div>
      <div>
        <div className="admin-hint">Draw these next (fewest samples):</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {least.map(({ s, n }) => (
            <button key={s.id} className="admin-btn admin-btn-ghost" style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              onClick={() => onPick(s.id)} title={`${n} sample${n === 1 ? '' : 's'}`}>
              {s.label || s.name} <span style={{ opacity: 0.6 }}>({n})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function groupByKind(symbols) {
  const groups = {}
  for (const s of symbols) { (groups[s.kind] ||= []).push(s) }
  return groups
}

// stroke objects from DrawingSurface ({tool,color,width,points}) → point arrays for the recognizer.
const toPointArrays = (strokes) => (strokes || []).map((s) => s.points).filter((p) => p && p.length >= 2)

// Rotation-tolerant ranking for the live guess (mirrors the spell pipeline's de-rotation sweep —
// $P itself is NOT rotation-invariant, so a symbol drawn at an angle would otherwise tank). We rotate
// the drawn points around their centroid over a sweep, recognize() at each angle, and keep the best
// score per symbol name. Without this, drawing a sign even slightly rotated mis-ranks badly.
const GUESS_ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315]
function rankOverRotations(pts, clouds) {
  if (pts.length < 2 || !clouds.length) return []
  let cx = 0, cy = 0
  for (const p of pts) { cx += p.X; cy += p.Y }
  cx /= pts.length; cy /= pts.length
  const best = new Map()
  for (const deg of GUESS_ROTATIONS) {
    const r = (deg * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r)
    const rot = pts.map((p) => ({
      X: cx + (p.X - cx) * co - (p.Y - cy) * si,
      Y: cy + (p.X - cx) * si + (p.Y - cy) * co,
      ID: p.ID,
    }))
    for (const m of recognize(rot, clouds)) {
      const cur = best.get(m.name)
      if (!cur || m.adjDist < cur.adjDist) best.set(m.name, m)
    }
  }
  return [...best.values()].sort((a, b) => a.adjDist - b.adjDist).slice(0, 3)
}

// Reference image of the symbol being trained — the SVG the app actually renders (DB svg_path
// overlay, falling back to the JSON baseline via getComponentDef). Lets the user copy the original
// shape while drawing a sample.
function SymbolPreview({ sym }) {
  if (!sym) return null
  const def = getComponentDef(sym.engine_id || sym.name)
  const svgPath = sym.svg_path || def?.svgPath
  return (
    <div className="admin-symbol-preview" title="The original symbol to draw">
      {svgPath ? (
        <svg viewBox="-50 -50 100 100" width="120" height="120" aria-label={`${sym.label || sym.name} reference`}>
          <path d={svgPath} fill="currentColor" fillRule="evenodd" />
        </svg>
      ) : (
        <div className="admin-hint" style={{ padding: 20, textAlign: 'center' }}>No reference image for this symbol yet.</div>
      )}
    </div>
  )
}

export default function TrainingView() {
  const canvasRef = useRef(null)

  const [symbols, setSymbols] = useState([])
  const [symbolsErr, setSymbolsErr] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [exampleCount, setExampleCount] = useState(0)
  const [showTrace, setShowTrace] = useState(false)   // overlay the reference glyph on the canvas to trace over

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addErr, setAddErr] = useState(null)
  const [addLoading, setAddLoading] = useState(false)

  const [liveGuess, setLiveGuess] = useState(null)
  // M2 (SPEC-ml-recognizer.md): ML column state.
  //   mlGuess  — ranked [{name, score/confidence}] when M4 ships, null when not yet drawn
  //   mlStatus — 'idle' | 'pending' | 'unavailable' | 'ready'
  //   mlNote   — human-readable status text derived from the caught error message
  //
  // M4-readiness contract: when mlRecognizer.js ships, recognizeWithEngine({…, engine:'ml'})
  // resolves to an array of { name: string, score: number, confidence?: number } ranked best-first.
  // The ML column maps that to <GuessRow> exactly as the $P column does — no further UI change needed.
  const [mlGuess, setMlGuess]   = useState(null)
  const [mlStatus, setMlStatus] = useState('idle')   // 'idle'|'pending'|'unavailable'|'ready'
  const [mlNote, setMlNote]     = useState('')
  // monotonic request-id: guarantees stale async ML results are dropped (mirrors useRecognizerWorker).
  const mlReqId   = useRef(0)
  // debounce timer handle for the ML attempt.
  const mlTimer   = useRef(null)
  const [clouds, setClouds] = useState([])
  const [counts, setCounts] = useState({ bySymbol: {}, total: 0 })

  const [saveMsg, setSaveMsg] = useState(null)
  const [saveErr, setSaveErr] = useState(null)
  const [saving, setSaving] = useState(false)
  // M4b flywheel: prototype rebuild status (best-effort, never blocks the save flow).
  const [protoStatus, setProtoStatus] = useState(null)  // null | 'updating' | 'updated' | 'skipped'

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
      const bySymbol = {}
      const built = []
      let total = 0
      for (const r of rows) {
        if (r.deleted_at) continue
        total++
        bySymbol[r.symbol_id] = (bySymbol[r.symbol_id] || 0) + 1
        const sym = symbols.find((s) => s.id === r.symbol_id)
        const name = sym?.engine_id || sym?.name || r.symbol_id
        const pts = r.points ?? []
        // ONE cloud PER sample — do NOT merge all samples of a symbol into one blob: that concatenates
        // separate drawings (with colliding per-stroke IDs) and resample() walks across them, producing
        // a garbled cloud that matches nothing. recognize() ranks across all per-sample clouds; the
        // guess (rankOverRotations) then keeps the best score per symbol name.
        if (pts.length >= 2) built.push(makeCloud(name, pts))
      }
      if (!cancelled) { setClouds(built); setCounts({ bySymbol, total }) }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [symbols, saveMsg])

  // live guess on each drawing change — two columns: $P (sync, instant) + ML (async, debounced).
  const handleChange = useCallback(() => {
    if (!canvasRef.current) return
    const arrays = toPointArrays(canvasRef.current.getStrokes())

    if (!arrays.length) {
      // Canvas cleared — reset both columns.
      setLiveGuess(null)
      setMlGuess(null)
      setMlStatus('idle')
      setMlNote('')
      return
    }

    // ── $P column (synchronous, unchanged behavior) ───────────────────────────
    if (clouds.length) {
      const pts = arrays.flatMap((s, id) => s.map((p) => ({ X: p.x, Y: p.y, ID: id })))
      setLiveGuess(rankOverRotations(pts, clouds))
    }

    // ── ML column (async, debounced, stale-dropped) ───────────────────────────
    // The admin ML column calls rankWithMl directly (single-symbol ranker) — not
    // the full recognizeWithMl pipeline.  Lazy dynamic import keeps onnxruntime-web
    // out of the "engine:p" bundle path (invariant: engine:"p" never downloads onnx).
    if (mlTimer.current) clearTimeout(mlTimer.current)
    mlTimer.current = setTimeout(async () => {
      // Capture the request id BEFORE the await so stale results can be detected.
      const myId = ++mlReqId.current
      setMlStatus('pending')

      try {
        // Lazy import — onnxruntime-web is only pulled in on first use.
        const { rankWithMl } = await import('../draw/mlRecognizer.js')
        // The drawn strokes represent a single symbol; role is unknown here,
        // so the full-circle sweep is used (rankWithMl handles that when role is absent).
        const ranked = await rankWithMl(arrays, {})
        // Drop stale: a newer call has already run if myId !== mlReqId.current.
        if (myId !== mlReqId.current) return
        // ranked is [{name, role, score, cosine}] best-first.
        setMlGuess(ranked.slice(0, 3))
        setMlStatus('ready')
        setMlNote('')
      } catch (err) {
        if (myId !== mlReqId.current) return
        // Graceful placeholder — extract useful text from the error without alarming the user.
        const msg = err?.message ?? String(err)
        setMlGuess(null)
        setMlStatus('unavailable')
        // Keep the note informative but calm (no "Error:", no red).
        setMlNote(msg.includes('M4') ? 'ML engine ships in M4' : 'ML engine not available')
      }
    }, 200) // 200 ms debounce — enough to skip mid-stroke flicker, short enough to feel live
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
      canvasRef.current?.clear()
      setLiveGuess(null)
      setMlGuess(null); setMlStatus('idle'); setMlNote('')

      // ── M4b: Flywheel — rebuild the prototype for this symbol (best-effort, non-blocking).
      // We lazy-import both modules so onnxruntime-web is only pulled in when the ML column
      // has already loaded it (i.e. engine:"p" users never download onnx from this path).
      // Wrap in a fire-and-forget async to never stall the save response.
      setProtoStatus('updating')
      ;(async () => {
        try {
          const [{ rebuildPrototypeForSymbol }, { embedStrokes }] = await Promise.all([
            import('../data-services/prototypes.js'),
            import('../draw/mlRecognizer.js'),
          ])
          const result = await rebuildPrototypeForSymbol(selectedId, {
            embedFn:      embedStrokes,
            modelVersion: MODEL_VERSION,
          })
          setProtoStatus(result ? 'updated' : 'skipped')
        } catch {
          // Best-effort: a failure here must never surface as an error to the user.
          setProtoStatus('skipped')
        }
      })()
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
  // The reference glyph's svgPath (DB overlay, else JSON baseline) — shared by the side preview and
  // the optional on-canvas tracing guide.
  const tracePath = selectedSym
    ? (selectedSym.svg_path || getComponentDef(selectedSym.engine_id || selectedSym.name)?.svgPath || null)
    : null

  return (
    <div className="admin-train-wrap">
      <h3 className="admin-section-title">Training</h3>

      <div className="admin-train-layout">
        <div className="admin-train-canvas-col">
          <DrawingSurface ref={canvasRef} palette="bw" enableSymbols={false} compact onChange={handleChange}
            traceSvg={showTrace ? tracePath : null} />
          <div className="admin-train-actions">
            <button className="admin-btn" onClick={() => { canvasRef.current?.clear(); setLiveGuess(null); setMlGuess(null); setMlStatus('idle'); setMlNote(''); setSaveMsg(null); setSaveErr(null); setProtoStatus(null) }}>Clear</button>
            <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !selectedId}>
              {saving ? 'Saving…' : 'Save sample'}
            </button>
            <label className="admin-label admin-train-trace-toggle" title="Show the reference glyph faintly on the canvas to draw over"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <input type="checkbox" checked={showTrace} onChange={(e) => setShowTrace(e.target.checked)} disabled={!tracePath} />
              Trace overlay
            </label>
          </div>
          {saveMsg && <p className="admin-ok">{saveMsg}</p>}
          {saveErr && <p className="admin-error">{saveErr}</p>}
          {/* M4b flywheel status — calm, dim; never alarming */}
          {protoStatus === 'updating' && <p className="admin-hint" style={{ marginTop: 2 }}>Updating ML prototype…</p>}
          {protoStatus === 'updated'  && <p className="admin-hint" style={{ marginTop: 2 }}>ML prototype updated.</p>}
          {protoStatus === 'skipped'  && <p className="admin-hint" style={{ marginTop: 2 }}>Prototype update skipped (no Supabase or no samples).</p>}
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
            {selectedSym && <SymbolPreview sym={selectedSym} />}
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

          {/* ── Live guess — two-column A/B lab (M4, SPEC-ml-recognizer.md) ─────────
               $P column: synchronous, always instant, unchanged from pre-M2.
               ML column: async, debounced 200 ms, stale-dropped via mlReqId.
               M4: rankWithMl returns [{name, role, score, cosine}] — rendered below
               with r.score as the displayed confidence.  Degrades to a calm placeholder
               if onnx fails to load (unavailable state). */}
          <div className="admin-live-guess admin-live-guess-ab">
            <h4 className="admin-subsection">Live guess</h4>
            <div className="admin-ab-columns">
              {/* $P column — behavior identical to pre-M2 */}
              <div className="admin-ab-col">
                <div className="admin-ab-col-label">$P</div>
                {liveGuess
                  ? <>
                      <div className="admin-guess-top">{liveGuess[0]?.name || '—'}</div>
                      <div className="admin-hint">
                        {liveGuess.map((r) => `${r.name} (${r.dist.toFixed(2)})`).join(' · ')}
                      </div>
                    </>
                  : <div className="admin-hint">Draw something…</div>}
              </div>

              <div className="admin-ab-divider" aria-hidden="true" />

              {/* ML column — async, gracefully degrades until M4 */}
              <div className="admin-ab-col">
                <div className="admin-ab-col-label">ML</div>
                {mlStatus === 'idle' && (
                  <div className="admin-hint">Draw something…</div>
                )}
                {mlStatus === 'pending' && (
                  <div className="admin-hint admin-ab-pending">Thinking…</div>
                )}
                {mlStatus === 'ready' && mlGuess && (
                  <>
                    <div className="admin-guess-top">{mlGuess[0]?.name || '—'}</div>
                    <div className="admin-hint">
                      {mlGuess.map((r) => {
                        const score = r.confidence != null ? r.confidence.toFixed(2) : r.score?.toFixed(2) ?? '?'
                        return `${r.name} (${score})`
                      }).join(' · ')}
                    </div>
                  </>
                )}
                {mlStatus === 'unavailable' && (
                  <div className="admin-hint admin-ab-unavailable">
                    {mlNote || 'ML engine not available'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <CoveragePanel symbols={symbols} counts={counts} onPick={(id) => { setSelectedId(id); setSaveMsg(null); setSaveErr(null) }} />
        </div>
      </div>
    </div>
  )
}
