// Inspector: the editor for the currently-selected part. Replaces the old cramped
// horizontal selected-toolbar with a panel that exposes numeric position, rotation, scale,
// inversion/mirror, promote-to-center, move-to-circle, zone, and delete. Purely controlled —
// every change goes back through App's updateSelected / deleteSelected / etc.
export default function Inspector({
  part, def, isCore, zone, otherCircles, pinned,
  onUpdate, onResetRotation, onPromoteToCore, onTogglePin, onMoveToCircle, onDuplicate, onRadialClone, onDelete, canPromote,
}) {
  if (!part) {
    return (
      <div className="inspector empty">
        <p className="hint">Select a sigil or sign on the canvas to edit it.</p>
      </div>
    )
  }
  const round = (v) => (Number.isFinite(v) ? Math.round(v) : 0)
  const setNum = (key, v) => { const n = Number(v); if (Number.isFinite(n)) onUpdate({ [key]: n }) }

  return (
    <div className="inspector">
      <div className="insp-head">
        <span className="insp-title">{def?.name || part.type}</span>
        <span className="insp-role">{isCore ? 'core' : part.role === 'sigil' ? 'sigil' : 'sign'}</span>
        {!isCore && zone && <span className={`insp-zone z-${zone}`}>{zone}</span>}
      </div>

      {!isCore && (
        <div className="insp-row">
          <label className="insp-field">x<input type="number" step="1" value={round(part.x)} onChange={(e) => setNum('x', e.target.value)} /></label>
          <label className="insp-field">y<input type="number" step="1" value={round(part.y)} onChange={(e) => setNum('y', e.target.value)} /></label>
        </div>
      )}

      <div className="insp-row">
        <label className="insp-field" title="Rotation in degrees (0° = north).">
          ∠<input type="number" step="1" value={round(part.rotation || 0)}
            onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onUpdate({ rotation: ((v % 360) + 360) % 360 }) }} />°
        </label>
        <button onClick={onResetRotation} title="Reset rotation (top faces the center, or outward for signs like Sights Set; a core resets to 0°).">⟲ reset</button>
      </div>

      <div className="insp-row">
        <span className="insp-sub">scale</span>
        <button onClick={() => onUpdate({ scale: Math.max(0.4, (part.scale ?? 1) - 0.15) })}>−</button>
        <span className="insp-val">{(part.scale ?? 1).toFixed(2)}×</span>
        <button onClick={() => onUpdate({ scale: Math.min(4, (part.scale ?? 1) + 0.15) })}>+</button>
      </div>

      <div className="insp-row">
        {def?.invertible && (
          <button className={part.inverted ? 'on' : ''} onClick={() => onUpdate({ inverted: !part.inverted })}>{part.inverted ? 'un-invert' : 'invert'}</button>
        )}
        <button className={part.mirrored ? 'on' : ''} onClick={() => onUpdate({ mirrored: !part.mirrored })}
          title="Mirror left↔right (visual only — does not change the deduced effect).">⇆ mirror</button>
        {canPromote && <button onClick={onPromoteToCore}>↦ to center</button>}
      </div>

      {!isCore && (
        <div className="insp-row">
          <button className={pinned ? 'on' : ''} onClick={onTogglePin}
            title="Pin this sign to the ring — it tracks the ring when the circle is resized, and drags along it.">
            {pinned ? '📌 pinned to ring' : '📌 pin to ring'}
          </button>
        </div>
      )}

      {!isCore && (
        <div className="insp-row">
          <span className="insp-sub">arrange</span>
          <button onClick={onDuplicate} title="Duplicate this part">⧉ duplicate</button>
          <button onClick={() => onRadialClone(4)} title="Clone into 4 copies evenly around the ring">radial ×4</button>
          <button onClick={() => onRadialClone(6)} title="Clone into 6 copies evenly around the ring">×6</button>
          <button onClick={() => onRadialClone(8)} title="Clone into 8 copies evenly around the ring">×8</button>
        </div>
      )}

      {!isCore && otherCircles?.length > 0 && (
        <div className="insp-row">
          <span className="insp-sub">move to</span>
          <select value="" onChange={(e) => { if (e.target.value) onMoveToCircle(e.target.value) }}>
            <option value="">circle…</option>
            {otherCircles.map((c) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
          </select>
        </div>
      )}

      <div className="insp-row">
        <button className="danger" onClick={onDelete} title="Delete (Del)">delete</button>
      </div>
    </div>
  )
}
