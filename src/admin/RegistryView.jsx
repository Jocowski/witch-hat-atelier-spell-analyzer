// RegistryView.jsx — symbol registry CRUD: list / add / edit / delete symbols.
// Calls logAction after each mutation for the audit trail.
import { useCallback, useEffect, useState } from 'react'
import { listSymbols, addSymbol, updateSymbol, deleteSymbol } from '../data-services/symbols.js'
import { logAction } from '../data-services/audit.js'

const KIND_OPTIONS   = ['', 'sign', 'sigil']
const STATUS_OPTIONS = ['canon', 'fan']
const EMPTY_ADD = { kind: 'sign', name: '', label: '', engine_id: '', status: 'canon', operator_kind: '' }

// ─── inline-edit row ─────────────────────────────────────────────────────────
function EditRow({ sym, onSave, onCancel }) {
  const [form, setForm] = useState({ ...sym })
  const [err,  setErr]  = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault(); setErr(null); setLoading(true)
    try {
      const row = await updateSymbol(sym.id, {
        kind:          form.kind,
        name:          form.name.trim(),
        label:         form.label?.trim() || null,
        engine_id:     form.engine_id?.trim() || null,
        status:        form.status,
        operator_kind: form.operator_kind?.trim() || null,
      })
      await logAction({ action: 'symbol.update', target: row })
      onSave(row)
    } catch (err) {
      setErr(err.message)
    } finally {
      setLoading(false)
    }
  }

  const f = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  return (
    <tr className="admin-row-editing">
      <td>
        <select className="admin-select admin-select-sm" value={form.kind} onChange={f('kind')}>
          <option value="sign">sign</option>
          <option value="sigil">sigil</option>
        </select>
      </td>
      <td><input className="admin-input admin-input-sm" value={form.name} onChange={f('name')} required /></td>
      <td><input className="admin-input admin-input-sm" value={form.label ?? ''} onChange={f('label')} /></td>
      <td><input className="admin-input admin-input-sm" value={form.engine_id ?? ''} onChange={f('engine_id')} /></td>
      <td>
        <select className="admin-select admin-select-sm" value={form.status} onChange={f('status')}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td><input className="admin-input admin-input-sm" value={form.operator_kind ?? ''} onChange={f('operator_kind')} /></td>
      <td>
        {err && <p className="admin-error admin-error-inline">{err}</p>}
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={submit} disabled={loading}>
            {loading ? '…' : 'Save'}
          </button>
          <button className="admin-btn admin-btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      </td>
    </tr>
  )
}

// ─── add row ─────────────────────────────────────────────────────────────────
function AddRow({ onAdded }) {
  const [form,    setForm]    = useState(EMPTY_ADD)
  const [err,     setErr]     = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault(); setErr(null); setLoading(true)
    try {
      const row = await addSymbol({
        kind:          form.kind,
        name:          form.name.trim(),
        label:         form.label.trim() || undefined,
        engine_id:     form.engine_id.trim() || undefined,
        status:        form.status,
        operator_kind: form.operator_kind.trim() || undefined,
      })
      await logAction({ action: 'symbol.add', target: row })
      setForm(EMPTY_ADD)
      onAdded(row)
    } catch (err) {
      setErr(err.message)
    } finally {
      setLoading(false)
    }
  }

  const f = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  return (
    <tr className="admin-row-add">
      <td>
        <select className="admin-select admin-select-sm" value={form.kind} onChange={f('kind')}>
          <option value="sign">sign</option>
          <option value="sigil">sigil</option>
        </select>
      </td>
      <td><input className="admin-input admin-input-sm" value={form.name} onChange={f('name')} placeholder="name" required /></td>
      <td><input className="admin-input admin-input-sm" value={form.label} onChange={f('label')} placeholder="label" /></td>
      <td><input className="admin-input admin-input-sm" value={form.engine_id} onChange={f('engine_id')} placeholder="engine_id" /></td>
      <td>
        <select className="admin-select admin-select-sm" value={form.status} onChange={f('status')}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td><input className="admin-input admin-input-sm" value={form.operator_kind} onChange={f('operator_kind')} placeholder="operator_kind" /></td>
      <td>
        {err && <p className="admin-error admin-error-inline">{err}</p>}
        <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={submit} disabled={loading}>
          {loading ? '…' : 'Add'}
        </button>
      </td>
    </tr>
  )
}

// ─── main component ───────────────────────────────────────────────────────────
export default function RegistryView() {
  const [symbols,    setSymbols]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [editingId,  setEditingId]  = useState(null)
  const [kindFilter, setKindFilter] = useState('')
  const [deleteConf, setDeleteConf] = useState(null) // id to confirm
  const [deleteErr,  setDeleteErr]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const rows = await listSymbols()
      setSymbols(rows ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [])

  function handleSaved(updated) {
    setSymbols((prev) => prev.map((s) => s.id === updated.id ? updated : s))
    setEditingId(null)
  }

  function handleAdded(row) {
    if (row) setSymbols((prev) => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleDelete(id) {
    setDeleteErr(null)
    try {
      await deleteSymbol(id)
      await logAction({ action: 'symbol.delete', target: { id } })
      setSymbols((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setDeleteErr(err.message)
    } finally {
      setDeleteConf(null)
    }
  }

  const visible = kindFilter ? symbols.filter((s) => s.kind === kindFilter) : symbols

  return (
    <div className="admin-registry-wrap">
      <div className="admin-registry-header">
        <h3 className="admin-section-title">Symbol Registry</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="admin-label" style={{ flexDirection: 'row', gap: 6 }}>
            Kind:
            <select className="admin-select admin-select-sm" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              {KIND_OPTIONS.map((k) => <option key={k} value={k}>{k || 'all'}</option>)}
            </select>
          </label>
          <button className="admin-btn admin-btn-ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      {error && <p className="admin-error">Failed to load: {error}</p>}
      {deleteErr && <p className="admin-error">Delete failed: {deleteErr}</p>}

      {loading ? (
        <p className="admin-hint">Loading…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Name</th>
                <th>Label</th>
                <th>engine_id</th>
                <th>Status</th>
                <th>operator_kind</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((sym) =>
                editingId === sym.id
                  ? <EditRow key={sym.id} sym={sym} onSave={handleSaved} onCancel={() => setEditingId(null)} />
                  : (
                    <tr key={sym.id}>
                      <td><span className={`admin-badge admin-badge-${sym.kind}`}>{sym.kind}</span></td>
                      <td className="admin-cell-name">{sym.name}</td>
                      <td className="admin-cell-dim">{sym.label ?? '—'}</td>
                      <td className="admin-cell-dim">{sym.engine_id ?? '—'}</td>
                      <td><span className={`admin-badge admin-badge-${sym.status}`}>{sym.status}</span></td>
                      <td className="admin-cell-dim">{sym.operator_kind ?? '—'}</td>
                      <td>
                        {deleteConf === sym.id ? (
                          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span className="admin-hint">Delete?</span>
                            <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => handleDelete(sym.id)}>Yes</button>
                            <button className="admin-btn admin-btn-sm" onClick={() => setDeleteConf(null)}>No</button>
                          </span>
                        ) : (
                          <span style={{ display: 'flex', gap: 4 }}>
                            <button className="admin-btn admin-btn-sm" onClick={() => { setEditingId(sym.id); setDeleteConf(null) }}>Edit</button>
                            <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => setDeleteConf(sym.id)}>Delete</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
              )}
              <AddRow onAdded={handleAdded} />
            </tbody>
          </table>
          {visible.length === 0 && <p className="admin-hint admin-table-empty">No symbols{kindFilter ? ` of kind "${kindFilter}"` : ''} yet.</p>}
        </div>
      )}
    </div>
  )
}
