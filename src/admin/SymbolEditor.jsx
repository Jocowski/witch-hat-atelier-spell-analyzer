// SymbolEditor.jsx — full add/edit form for a registry symbol, including the dynamic-symbol fields
// that overlay the JSON baseline in the drawing app (svg_path, family, grammar operator/element).
// Inline "Trace image"/"Draw it" reuse src/draw/imageTrace.js so an admin can set/replace a symbol's
// SVG here — from an uploaded image or by drawing it on a canvas, without leaving the editor.
import { useRef, useState } from 'react'
import { addSymbol, updateSymbol } from '../data-services/symbols.js'
import { logAction } from '../data-services/audit.js'
import { rasterizeImage, rasterizeStrokes, traceCanvas } from '../draw/imageTrace.js'
import DrawingSurface from '../studio/DrawingSurface.jsx'

const OP_KINDS = ['', 'form', 'transmute', 'motion', 'direction', 'target', 'power', 'support', 'special']
const TRISTATE = ['', 'true', 'false'] // '' = inherit baseline (null), else explicit boolean
const LC_STATUS = ['', 'stable', 'unverified', 'revised', 'deprecated', 'removed']

// ── form <-> row mapping ──────────────────────────────────────────────────────
function rowToForm(sym) {
  const s = sym || {}
  const tri = (v) => (v === true ? 'true' : v === false ? 'false' : '')
  const arr = (v) => (Array.isArray(v) ? v.join(', ') : '')
  return {
    kind: s.kind || 'sign',
    name: s.name || '',
    label: s.label || '',
    engine_id: s.engine_id || '',
    status: s.status || 'canon',
    family: s.family || '',
    render: s.render || '',
    svg_path: s.svg_path || '',
    effect_tags: arr(s.effect_tags),
    invertible: tri(s.invertible),
    can_be_center: tri(s.can_be_center),
    surrounds: tri(s.surrounds),
    op_kind: s.op_kind || '',
    op_verb: s.op_verb || '',
    op_inverted_verb: s.op_inverted_verb || '',
    op_directional: tri(s.op_directional),
    op_default_direction: s.op_default_direction || '',
    element: s.element || '',
    substance: s.substance || '',
    substance_raw: s.substance_raw || '',
    substance_qualities: arr(s.substance_qualities),
    lc_status: s.lc_status || '',
    lc_rev: s.lc_rev != null ? String(s.lc_rev) : '',
  }
}

const orNull = (s) => { const t = (s || '').trim(); return t === '' ? null : t }
const triToBool = (v) => (v === 'true' ? true : v === 'false' ? false : null)
const csvToArr = (s) => { const t = (s || '').trim(); return t === '' ? null : t.split(',').map((x) => x.trim()).filter(Boolean) }

function formToRow(f) {
  const base = {
    kind: f.kind,
    name: f.name.trim(),
    label: orNull(f.label),
    engine_id: orNull(f.engine_id),
    status: f.status,
    family: orNull(f.family),
    render: orNull(f.render),
    svg_path: orNull(f.svg_path),
    lc_status: orNull(f.lc_status),
    lc_rev: f.lc_rev?.trim() ? Number(f.lc_rev) : null,
  }
  if (f.kind === 'sigil') {
    return {
      ...base,
      element: orNull(f.element),
      substance: orNull(f.substance),
      substance_raw: orNull(f.substance_raw),
      substance_qualities: csvToArr(f.substance_qualities),
    }
  }
  return {
    ...base,
    effect_tags: csvToArr(f.effect_tags),
    invertible: triToBool(f.invertible),
    can_be_center: triToBool(f.can_be_center),
    surrounds: triToBool(f.surrounds),
    op_kind: orNull(f.op_kind),
    op_verb: orNull(f.op_verb),
    op_inverted_verb: orNull(f.op_inverted_verb),
    op_directional: triToBool(f.op_directional),
    op_default_direction: orNull(f.op_default_direction),
  }
}

// ── component ─────────────────────────────────────────────────────────────────
export default function SymbolEditor({ sym, onSaved, onCancel }) {
  const isEdit = !!sym?.id
  const [form, setForm] = useState(() => rowToForm(sym))
  const [err, setErr] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tracing, setTracing] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const fileRef = useRef(null)
  const drawRef = useRef(null)

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  async function handleTraceFile(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setTracing(true); setErr(null)
    try {
      const url = URL.createObjectURL(file)
      const img = new Image()
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
      const { normalizedD } = traceCanvas(rasterizeImage(img), {})
      URL.revokeObjectURL(url)
      if (normalizedD) setForm((p) => ({ ...p, svg_path: normalizedD, render: p.render || 'fill' }))
      else setErr('Nothing traced — try a cleaner, higher-contrast image.')
    } catch {
      setErr('Could not trace that image.')
    } finally {
      setTracing(false)
    }
  }

  function handleTraceDrawing() {
    setErr(null)
    const strokes = drawRef.current?.getStrokes() || []
    if (!strokes.length) { setErr('Draw something first.'); return }
    const { normalizedD } = traceCanvas(rasterizeStrokes(strokes), {})
    if (normalizedD) setForm((p) => ({ ...p, svg_path: normalizedD, render: p.render || 'fill' }))
    else setErr('Nothing traced — draw a bolder mark.')
  }

  async function submit(e) {
    e.preventDefault(); setErr(null)
    if (!form.name.trim()) { setErr('Name is required.'); return }
    if (!form.family.trim()) {
      setErr('Family is required — without it the symbol is hidden from the palette. Use a sign family (directional / semi-directional / non-directional / asymmetric) or a sigil family (fire / water / earth / air / …).')
      return
    }
    setSaving(true)
    try {
      const row = formToRow(form)
      const saved = isEdit ? await updateSymbol(sym.id, row) : await addSymbol(row)
      await logAction({ action: isEdit ? 'symbol.update' : 'symbol.add', target: saved || row })
      onSaved(saved)
    } catch (e2) {
      setErr(e2.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const isSign = form.kind === 'sign'
  const opWarn = isSign && form.svg_path && !(form.op_kind && form.op_verb.trim())

  return (
    <form className="admin-sym-editor" onSubmit={submit}>
      <div className="admin-sym-editor-head">
        <h4 className="admin-subsection">{isEdit ? `Edit ${sym.name}` : 'New symbol'}</h4>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" className="admin-btn admin-btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      </div>
      {err && <p className="admin-error">{err}</p>}

      <div className="admin-sym-grid">
        {/* Identity */}
        <fieldset className="admin-sym-fs">
          <legend>Identity</legend>
          <label className="admin-label">Kind
            <select className="admin-select" value={form.kind} onChange={f('kind')} disabled={isEdit}>
              <option value="sign">sign</option>
              <option value="sigil">sigil</option>
            </select>
          </label>
          <label className="admin-label">Name <span className="admin-hint">(unique, no spaces)</span>
            <input className="admin-input" value={form.name} onChange={f('name')} required />
          </label>
          <label className="admin-label">Label <span className="admin-hint">(display name)</span>
            <input className="admin-input" value={form.label} onChange={f('label')} />
          </label>
          <label className="admin-label">engine_id <span className="admin-hint">(maps to JSON id; defaults to name)</span>
            <input className="admin-input" value={form.engine_id} onChange={f('engine_id')} />
          </label>
          <label className="admin-label">Status
            <select className="admin-select" value={form.status} onChange={f('status')}>
              <option value="canon">canon</option>
              <option value="fan">fan</option>
            </select>
          </label>
          <div className="admin-sym-tri-row">
            <label className="admin-label">Lifecycle
              <select className="admin-select admin-select-sm" value={form.lc_status} onChange={f('lc_status')}>
                {LC_STATUS.map((v) => <option key={v} value={v}>{v || '(stable)'}</option>)}
              </select>
            </label>
            <label className="admin-label">Rev
              <input type="number" min="1" step="1" className="admin-input admin-input-sm" style={{ width: 60 }}
                value={form.lc_rev} onChange={f('lc_rev')} />
            </label>
          </div>
        </fieldset>

        {/* Presentation */}
        <fieldset className="admin-sym-fs">
          <legend>Drawing (palette + canvas)</legend>
          <label className="admin-label">Family <span className="admin-hint">★ required — palette won’t show it otherwise</span>
            <input className={`admin-input${!form.family.trim() ? ' admin-input-warn' : ''}`} value={form.family} onChange={f('family')}
              required placeholder={isSign ? 'directional / non-directional / …' : 'fire / water / …'} />
          </label>
          <label className="admin-label">Render
            <select className="admin-select" value={form.render} onChange={f('render')}>
              <option value="">(fill)</option>
              <option value="fill">fill</option>
              <option value="stroke">stroke</option>
            </select>
          </label>
          <label className="admin-label">svg_path <span className="admin-hint">(centered −50…50 viewBox)</span>
            <textarea className="admin-input admin-sym-svg" rows={3} value={form.svg_path} onChange={f('svg_path')} />
          </label>
          <div className="admin-sym-trace-row">
            <button type="button" className="admin-btn admin-btn-sm" onClick={() => fileRef.current?.click()} disabled={tracing}>
              {tracing ? 'Tracing…' : 'Trace image…'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleTraceFile} />
            <button type="button" className={`admin-btn admin-btn-sm${drawing ? ' admin-btn-primary' : ''}`} onClick={() => setDrawing((d) => !d)}>
              {drawing ? 'Hide canvas' : 'Draw it…'}
            </button>
            <span className="admin-sym-preview">
              {form.svg_path
                ? <svg viewBox="-50 -50 100 100" width="40" height="40"><path d={form.svg_path} fill="currentColor" fillRule="evenodd" /></svg>
                : <span className="sp-glyph-circle" />}
            </span>
          </div>
          {drawing && (
            <div className="admin-sym-draw">
              <DrawingSurface ref={drawRef} palette="bw" enableSymbols={false} compact />
              <div className="admin-train-actions">
                <button type="button" className="admin-btn admin-btn-sm" onClick={() => drawRef.current?.clear()}>Clear</button>
                <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={handleTraceDrawing}>Trace drawing → svg_path</button>
              </div>
            </div>
          )}
        </fieldset>

        {/* Semantics */}
        {isSign ? (
          <fieldset className="admin-sym-fs">
            <legend>Sign semantics (engine)</legend>
            {opWarn && <p className="admin-hint" style={{ color: 'var(--warn, #c80)' }}>⚠ No operator kind/verb — it will render but deduce a generic effect.</p>}
            <label className="admin-label">Operator kind
              <select className="admin-select" value={form.op_kind} onChange={f('op_kind')}>
                {OP_KINDS.map((k) => <option key={k} value={k}>{k || '(none)'}</option>)}
              </select>
            </label>
            <label className="admin-label">Operator verb <span className="admin-hint">“the substance …”</span>
              <input className="admin-input" value={form.op_verb} onChange={f('op_verb')} placeholder="is driven upward and floats" />
            </label>
            <label className="admin-label">Inverted verb <span className="admin-hint">(if invertible)</span>
              <input className="admin-input" value={form.op_inverted_verb} onChange={f('op_inverted_verb')} />
            </label>
            <label className="admin-label">Directional
              <select className="admin-select" value={form.op_directional} onChange={f('op_directional')}>
                {TRISTATE.map((v) => <option key={v} value={v}>{v || '(inherit)'}</option>)}
              </select>
            </label>
            <label className="admin-label">Default direction
              <input className="admin-input" value={form.op_default_direction} onChange={f('op_default_direction')} placeholder="up / outward / …" />
            </label>
            <label className="admin-label">effect_tags <span className="admin-hint">(comma-separated)</span>
              <input className="admin-input" value={form.effect_tags} onChange={f('effect_tags')} placeholder="lift, float, directional" />
            </label>
            <div className="admin-sym-tri-row">
              <label className="admin-label">Invertible
                <select className="admin-select admin-select-sm" value={form.invertible} onChange={f('invertible')}>
                  {TRISTATE.map((v) => <option key={v} value={v}>{v || '(inherit)'}</option>)}
                </select>
              </label>
              <label className="admin-label">Can be center
                <select className="admin-select admin-select-sm" value={form.can_be_center} onChange={f('can_be_center')}>
                  {TRISTATE.map((v) => <option key={v} value={v}>{v || '(inherit)'}</option>)}
                </select>
              </label>
              <label className="admin-label">Surrounds
                <select className="admin-select admin-select-sm" value={form.surrounds} onChange={f('surrounds')}>
                  {TRISTATE.map((v) => <option key={v} value={v}>{v || '(inherit)'}</option>)}
                </select>
              </label>
            </div>
          </fieldset>
        ) : (
          <fieldset className="admin-sym-fs">
            <legend>Sigil semantics (engine)</legend>
            <label className="admin-label">Element <span className="admin-hint">(grammar element id)</span>
              <input className="admin-input" value={form.element} onChange={f('element')} placeholder="fire / water / earth / air …" />
            </label>
            <label className="admin-label">Substance <span className="admin-hint">(noun: “flame”, “water”)</span>
              <input className="admin-input" value={form.substance} onChange={f('substance')} />
            </label>
            <label className="admin-label">Substance (raw) <span className="admin-hint">“burns, giving off heat”</span>
              <input className="admin-input" value={form.substance_raw} onChange={f('substance_raw')} />
            </label>
            <label className="admin-label">Qualities <span className="admin-hint">(comma-separated)</span>
              <input className="admin-input" value={form.substance_qualities} onChange={f('substance_qualities')} placeholder="hot, luminous" />
            </label>
          </fieldset>
        )}
      </div>
    </form>
  )
}
