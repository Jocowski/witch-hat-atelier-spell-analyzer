// ReviewView.jsx — training governance: samples table, rollback, delete-by-user, restore, audit log.
import { useCallback, useEffect, useState } from 'react'
import { listSamples, softDeleteByDate, softDeleteByUser, softDeleteOne, restore } from '../data-services/samples.js'
import { logAction, recentAudit } from '../data-services/audit.js'
import { listSymbols } from '../data-services/symbols.js'
import SamplePreview from './SamplePreview.jsx'

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

// ─── main component ───────────────────────────────────────────────────────────
export default function ReviewView() {
  const [samples,      setSamples]      = useState([])
  const [symbols,      setSymbols]      = useState([])
  const [samplesErr,   setSamplesErr]   = useState(null)
  const [samplesLoad,  setSamplesLoad]  = useState(true)

  // Filters
  const [filterUser, setFilterUser] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')

  // Rollback by date
  const [rollbackDate,    setRollbackDate]    = useState('')
  const [rollbackConfirm, setRollbackConfirm] = useState(false)
  const [rollbackMsg,     setRollbackMsg]     = useState(null)
  const [rollbackErr,     setRollbackErr]     = useState(null)
  const [rollbackLoading, setRollbackLoading] = useState(false)

  // Delete by user
  const [deleteUserId,   setDeleteUserId]   = useState('')
  const [deleteUserConf, setDeleteUserConf] = useState(false)
  const [deleteUserMsg,  setDeleteUserMsg]  = useState(null)
  const [deleteUserErr,  setDeleteUserErr]  = useState(null)
  const [deleteUserLoad, setDeleteUserLoad] = useState(false)

  // Per-row restore
  const [restoreMsg, setRestoreMsg] = useState(null)
  const [restoreErr, setRestoreErr] = useState(null)

  // Per-row delete
  const [deleteRowMsg, setDeleteRowMsg] = useState(null)
  const [deleteRowErr, setDeleteRowErr] = useState(null)

  // Sample preview modal
  const [previewSample, setPreviewSample] = useState(null)

  // Audit log
  const [audit,      setAudit]      = useState([])
  const [auditErr,   setAuditErr]   = useState(null)
  const [auditLoad,  setAuditLoad]  = useState(true)

  // Symbol name lookup
  const symMap = Object.fromEntries(symbols.map((s) => [s.id, s.name]))

  // ── load ──
  const loadSamples = useCallback(async () => {
    setSamplesLoad(true); setSamplesErr(null)
    try {
      const opts = {}
      if (filterUser.trim()) opts.userId = filterUser.trim()
      if (filterFrom)        opts.from   = new Date(filterFrom).toISOString()
      if (filterTo)          opts.to     = new Date(filterTo + 'T23:59:59').toISOString()
      const rows = await listSamples(opts)
      setSamples(rows ?? [])
    } catch (err) {
      setSamplesErr(err.message)
    } finally {
      setSamplesLoad(false)
    }
  }, [filterUser, filterFrom, filterTo])

  const loadAudit = useCallback(async () => {
    setAuditLoad(true); setAuditErr(null)
    try {
      const rows = await recentAudit(100)
      setAudit(rows ?? [])
    } catch (err) {
      setAuditErr(err.message)
    } finally {
      setAuditLoad(false)
    }
  }, [])

  useEffect(() => {
    listSymbols().then((rows) => setSymbols(rows ?? [])).catch(() => {})
    loadSamples()
    loadAudit()
  }, [])

  // ── rollback by date ──
  async function handleRollback() {
    if (!rollbackDate) { setRollbackErr('Pick a date.'); return }
    setRollbackLoading(true); setRollbackErr(null); setRollbackMsg(null)
    try {
      const iso = new Date(rollbackDate + 'T00:00:00').toISOString()
      await softDeleteByDate(iso)
      await logAction({ action: 'samples.rollback_by_date', target: { cutoff: iso } })
      setRollbackMsg(`Rolled back: samples after ${rollbackDate} soft-deleted.`)
      setRollbackConfirm(false)
      await loadSamples(); await loadAudit()
    } catch (err) {
      setRollbackErr(err.message || 'Rollback failed.')
    } finally {
      setRollbackLoading(false)
    }
  }

  // ── delete by user ──
  async function handleDeleteByUser() {
    if (!deleteUserId.trim()) { setDeleteUserErr('Enter a user id.'); return }
    setDeleteUserLoad(true); setDeleteUserErr(null); setDeleteUserMsg(null)
    try {
      await softDeleteByUser(deleteUserId.trim())
      await logAction({ action: 'samples.delete_by_user', target: { userId: deleteUserId.trim() } })
      setDeleteUserMsg(`Samples from user ${deleteUserId.trim()} soft-deleted.`)
      setDeleteUserConf(false)
      await loadSamples(); await loadAudit()
    } catch (err) {
      setDeleteUserErr(err.message || 'Delete failed.')
    } finally {
      setDeleteUserLoad(false)
    }
  }

  // ── per-row restore ──
  async function handleRestore(id) {
    setRestoreErr(null); setRestoreMsg(null)
    try {
      await restore(id)
      await logAction({ action: 'sample.restore', target: { id } })
      setRestoreMsg(`Sample ${id.slice(0, 8)}… restored.`)
      await loadSamples(); await loadAudit()
    } catch (err) {
      setRestoreErr(err.message || 'Restore failed.')
    }
  }

  // ── per-row delete (soft) ──
  async function handleDeleteOne(id) {
    if (!window.confirm(`Soft-delete sample ${id.slice(0, 8)}…? (Reversible via Restore)`)) return
    setDeleteRowErr(null); setDeleteRowMsg(null)
    try {
      await softDeleteOne(id)
      await logAction({ action: 'sample.delete', target: { id } })
      setDeleteRowMsg(`Sample ${id.slice(0, 8)}… soft-deleted.`)
      await loadSamples(); await loadAudit()
    } catch (err) {
      setDeleteRowErr(err.message || 'Delete failed.')
    }
  }

  return (
    <div className="admin-review-wrap">
      <h3 className="admin-section-title">Training Review</h3>

      {/* ── Governance actions ── */}
      <div className="admin-review-actions">
        {/* Rollback by date */}
        <div className="admin-review-action-card">
          <h4 className="admin-subsection">Rollback by date</h4>
          <p className="admin-hint">Soft-deletes all samples created <em>after</em> the selected date (reversible via Restore).</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="admin-input admin-input-sm"
              value={rollbackDate}
              onChange={(e) => { setRollbackDate(e.target.value); setRollbackConfirm(false) }}
            />
            {rollbackConfirm ? (
              <>
                <span className="admin-hint">Confirm rollback after {rollbackDate}?</span>
                <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={handleRollback} disabled={rollbackLoading}>
                  {rollbackLoading ? '…' : 'Confirm'}
                </button>
                <button className="admin-btn admin-btn-sm" onClick={() => setRollbackConfirm(false)}>Cancel</button>
              </>
            ) : (
              <button
                className="admin-btn admin-btn-sm admin-btn-danger"
                onClick={() => { setRollbackErr(null); setRollbackMsg(null); setRollbackConfirm(true) }}
                disabled={!rollbackDate}
              >
                Rollback after this date
              </button>
            )}
          </div>
          {rollbackMsg && <p className="admin-ok">{rollbackMsg}</p>}
          {rollbackErr && <p className="admin-error">{rollbackErr}</p>}
        </div>

        {/* Delete all by user */}
        <div className="admin-review-action-card">
          <h4 className="admin-subsection">Delete all by user</h4>
          <p className="admin-hint">Soft-deletes all samples from a specific user UUID (reversible).</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="admin-input admin-input-sm"
              style={{ minWidth: 260 }}
              value={deleteUserId}
              onChange={(e) => { setDeleteUserId(e.target.value); setDeleteUserConf(false) }}
              placeholder="user UUID"
            />
            {deleteUserConf ? (
              <>
                <span className="admin-hint">Delete all from {deleteUserId.slice(0, 8)}…?</span>
                <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={handleDeleteByUser} disabled={deleteUserLoad}>
                  {deleteUserLoad ? '…' : 'Confirm'}
                </button>
                <button className="admin-btn admin-btn-sm" onClick={() => setDeleteUserConf(false)}>Cancel</button>
              </>
            ) : (
              <button
                className="admin-btn admin-btn-sm admin-btn-danger"
                onClick={() => { setDeleteUserErr(null); setDeleteUserMsg(null); setDeleteUserConf(true) }}
                disabled={!deleteUserId.trim()}
              >
                Delete all by user
              </button>
            )}
          </div>
          {deleteUserMsg && <p className="admin-ok">{deleteUserMsg}</p>}
          {deleteUserErr && <p className="admin-error">{deleteUserErr}</p>}
        </div>
      </div>

      {/* ── Sample table ── */}
      <div className="admin-review-section">
        <div className="admin-review-filter-row">
          <h4 className="admin-subsection">Samples</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="admin-input admin-input-sm" style={{ minWidth: 200 }} placeholder="Filter by user UUID" value={filterUser} onChange={(e) => setFilterUser(e.target.value)} />
            <label className="admin-hint" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              From <input type="date" className="admin-input admin-input-sm" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </label>
            <label className="admin-hint" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              To <input type="date" className="admin-input admin-input-sm" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </label>
            <button className="admin-btn admin-btn-sm" onClick={loadSamples}>Apply</button>
            <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => { setFilterUser(''); setFilterFrom(''); setFilterTo('') }}>Clear</button>
          </div>
        </div>

        {restoreMsg   && <p className="admin-ok">{restoreMsg}</p>}
        {restoreErr   && <p className="admin-error">{restoreErr}</p>}
        {deleteRowMsg && <p className="admin-ok">{deleteRowMsg}</p>}
        {deleteRowErr && <p className="admin-error">{deleteRowErr}</p>}
        {samplesErr   && <p className="admin-error">Load error: {samplesErr}</p>}

        {samplesLoad ? (
          <p className="admin-hint">Loading…</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Created at</th>
                  <th>Created by</th>
                  <th>Symbol</th>
                  <th>Role</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Deleted at</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((row) => (
                  <tr key={row.id} className={row.deleted_at ? 'admin-row-deleted' : ''}>
                    <td className="admin-cell-dim admin-cell-uuid" title={row.id}>{row.id.slice(0, 8)}&hellip;</td>
                    <td className="admin-cell-dim">{fmtDate(row.created_at)}</td>
                    <td className="admin-cell-dim admin-cell-uuid">{row.created_by ? row.created_by.slice(0, 8) + '…' : '—'}</td>
                    <td>{symMap[row.symbol_id] ?? row.symbol_id?.slice(0, 8) + '…'}</td>
                    <td><span className="admin-badge">{row.role ?? '—'}</span></td>
                    <td className="admin-cell-dim">{row.source}</td>
                    <td>
                      {row.deleted_at
                        ? <span className="admin-badge admin-badge-deleted">deleted</span>
                        : <span className="admin-badge admin-badge-active">active</span>
                      }
                    </td>
                    <td className="admin-cell-dim">{fmtDate(row.deleted_at)}</td>
                    <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => setPreviewSample(row)}>
                        See
                      </button>
                      {row.deleted_at ? (
                        <button className="admin-btn admin-btn-sm" onClick={() => handleRestore(row.id)}>
                          Restore
                        </button>
                      ) : (
                        <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => handleDeleteOne(row.id)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {samples.length === 0 && (
                  <tr><td colSpan={9} className="admin-hint admin-table-empty">No samples match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Audit log ── */}
      <div className="admin-review-section">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <h4 className="admin-subsection">Audit Log</h4>
          <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={loadAudit}>Refresh</button>
        </div>
        {auditErr && <p className="admin-error">Could not load audit log: {auditErr}</p>}
        {auditLoad ? (
          <p className="admin-hint">Loading…</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>At</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id}>
                    <td className="admin-cell-dim">{fmtDate(row.at)}</td>
                    <td className="admin-cell-dim admin-cell-uuid">{row.actor ? row.actor.slice(0, 8) + '…' : '—'}</td>
                    <td><code className="admin-code">{row.action}</code></td>
                    <td className="admin-cell-dim admin-cell-mono">{row.target ? JSON.stringify(row.target).slice(0, 80) : '—'}</td>
                  </tr>
                ))}
                {audit.length === 0 && (
                  <tr><td colSpan={4} className="admin-hint admin-table-empty">No audit entries yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Sample preview modal ── */}
      {previewSample && (
        <SamplePreview sample={previewSample} onClose={() => setPreviewSample(null)} />
      )}
    </div>
  )
}
