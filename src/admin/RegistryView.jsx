// RegistryView.jsx — symbol registry CRUD: list / add / edit / delete symbols.
// Add/Edit open the full SymbolEditor (identity + drawing svg + grammar semantics). After any
// mutation we reload the DB overlay (loadDbSymbols) so changes go live in the Studio drawing app.
import { useCallback, useEffect, useState } from 'react'
import { listSymbols, deleteSymbol } from '../data-services/symbols.js'
import { logAction } from '../data-services/audit.js'
import { loadDbSymbols } from '../engine/symbolLoader.js'
import SymbolEditor from './SymbolEditor.jsx'

const KIND_OPTIONS = ['', 'sign', 'sigil']

export default function RegistryView() {
  const [symbols,    setSymbols]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [editor,     setEditor]     = useState(null) // null | { sym: row|null }
  const [kindFilter, setKindFilter] = useState('')
  const [queueOnly,  setQueueOnly]  = useState(false)
  const [deleteConf, setDeleteConf] = useState(null)
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

  useEffect(() => { load() }, [load])

  // Propagate any registry change to the runtime store so the Studio palette/canvas update live.
  async function afterMutation() {
    await load()
    await loadDbSymbols()
  }

  async function handleSaved() {
    setEditor(null)
    await afterMutation()
  }

  async function handleDelete(id) {
    setDeleteErr(null)
    try {
      await deleteSymbol(id)
      await logAction({ action: 'symbol.delete', target: { id } })
      await afterMutation()
    } catch (err) {
      setDeleteErr(err.message)
    } finally {
      setDeleteConf(null)
    }
  }

  const visible = symbols
    .filter((s) => !kindFilter || s.kind === kindFilter)
    .filter((s) => !queueOnly || ['unverified', 'revised'].includes(s.lc_status) || s.lc_flag)

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
          <label className="admin-label" style={{ flexDirection: 'row', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={queueOnly} onChange={(e) => setQueueOnly(e.target.checked)} />
            Review queue
          </label>
          <button className="admin-btn admin-btn-ghost" onClick={load}>Refresh</button>
          <button className="admin-btn admin-btn-primary" onClick={() => setEditor({ sym: null })}>＋ Add symbol</button>
        </div>
      </div>

      {error && <p className="admin-error">Failed to load: {error}</p>}
      {deleteErr && <p className="admin-error">Delete failed: {deleteErr}</p>}

      {editor && (
        <SymbolEditor sym={editor.sym} onSaved={handleSaved} onCancel={() => setEditor(null)} />
      )}

      {loading ? (
        <p className="admin-hint">Loading…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Name</th>
                <th>engine_id</th>
                <th>Status</th>
                <th>Family</th>
                <th>Glyph</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((sym) => (
                <tr key={sym.id}>
                  <td><span className={`admin-badge admin-badge-${sym.kind}`}>{sym.kind}</span></td>
                  <td className="admin-cell-name">
                    {sym.name}
                    {sym.label ? <span className="admin-cell-dim"> · {sym.label}</span> : null}
                  </td>
                  <td className="admin-cell-dim">{sym.engine_id ?? '—'}</td>
                  <td><span className={`admin-badge admin-badge-${sym.status}`}>{sym.status}</span></td>
                  <td className="admin-cell-dim">{sym.family ?? '—'}</td>
                  <td>
                    {sym.svg_path
                      ? <svg viewBox="-50 -50 100 100" width="22" height="22"><path d={sym.svg_path} fill="currentColor" fillRule="evenodd" /></svg>
                      : <span className="admin-cell-dim">—</span>}
                  </td>
                  <td>
                    {deleteConf === sym.id ? (
                      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span className="admin-hint">Delete?</span>
                        <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => handleDelete(sym.id)}>Yes</button>
                        <button className="admin-btn admin-btn-sm" onClick={() => setDeleteConf(null)}>No</button>
                      </span>
                    ) : (
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button className="admin-btn admin-btn-sm" onClick={() => { setEditor({ sym }); setDeleteConf(null) }}>Edit</button>
                        <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => setDeleteConf(sym.id)}>Delete</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="admin-hint admin-table-empty">
              No symbols{kindFilter ? ` of kind "${kindFilter}"` : ''}{queueOnly ? ' in the review queue' : ''} yet.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
