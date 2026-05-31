import { directionLabel } from '../engine/geometry.js'

function Comparison({ match, freeform, nearest }) {
  if (match) {
    return (
      <div className={`spell-card ${match.forbidden ? 'forbidden' : ''}`}>
        <div className="name">{match.name}{match.forbidden ? ' ⛔' : ''}</div>
        <div className="meta">{match.category} · confidence {match.confidence} · match {(match.score * 100).toFixed(0)}%</div>
        <div className="effect">{match.effect}</div>
        <div className="score-bar"><i style={{ width: `${Math.min(match.score * 100, 100)}%` }} /></div>
        {match.alternatives?.length > 0 && (
          <div className="alts">Alternatives: {match.alternatives.map((a) => `${a.name} (${(a.score * 100).toFixed(0)}%)`).join(' · ')}</div>
        )}
      </div>
    )
  }
  if (freeform) {
    return (
      <div className="spell-card">
        <div className="name">Uncatalogued spell</div>
        <div className="meta">derived interpretation</div>
        <div className="effect">{freeform.phrase}</div>
        {nearest?.length > 0 && (
          <div className="alts">Closest matches: {nearest.map((a) => `${a.name} (${(a.score * 100).toFixed(0)}%)`).join(' · ')}</div>
        )}
      </div>
    )
  }
  return null
}

function Deduction({ deduction, match }) {
  if (!deduction?.ok) {
    return <div className="spell-card"><div className="effect">{deduction?.summary || 'Incomplete spell.'}</div></div>
  }
  return (
    <div className="spell-card deduced">
      <div className="name">What it does</div>
      <div className="meta">deduced from the parts</div>
      <div className="effect">{deduction.summary}</div>

      {match && (
        <div className="match-note">✓ Matches a catalogued spell: <b>{match.name}</b> ({(match.score * 100).toFixed(0)}%)</div>
      )}

      <ul className="breakdown">
        {deduction.breakdown.map((b, k) => (
          <li key={k} className={`role-${b.role}`}>
            <span className="bk-label">{b.label}</span>
            <span className="bk-text">{b.text}</span>
          </li>
        ))}
      </ul>

      {deduction.notes.map((n, k) => <div key={`n${k}`} className="note synergy">↔ {n}</div>)}
      {deduction.warnings.map((w, k) => <div key={`w${k}`} className="note warn">⚠ {w}</div>)}

      <div className="deduced-meta">
        <span>Stability: <b>{deduction.stability}</b></span>
        <span>Power: <b>{deduction.power}</b></span>
        <span>Direction: <b>{deduction.direction}</b></span>
      </div>
    </div>
  )
}

export default function ResultPanel({ result }) {
  if (!result) return null
  const { valid, active, issues, match, freeform, geometry, nearest, deduction } = result

  let statusClass = 'invalid'
  let statusText = 'Invalid'
  if (valid && active) { statusClass = 'ok'; statusText = '✦ Spell active' }
  else if (issues.some((i) => i.id === 'ring-closed') && !issues.some((i) => i.id === 'has-center')) {
    statusClass = 'inactive'; statusText = '◔ Prepared (inactive)'
  }

  return (
    <div className="panel result">
      <h2>{active ? 'Effect' : 'Analysis'}</h2>
      <div className={`status ${statusClass}`}>{statusText}</div>

      {active
        ? <Deduction deduction={deduction} match={match} />
        : <Comparison match={match} freeform={freeform} nearest={nearest} />}

      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((i, k) => <li key={k} className={i.severity}>{i.message}</li>)}
        </ul>
      )}

      <div className="geo">
        <span>Symmetry: <b>{geometry.symmetry}</b></span>
        <span>Power: <b>{geometry.power}</b></span>
        <span>Balance: <b>{geometry.bias.biased ? `skewed ${directionLabel(geometry.bias.angle)}` : 'balanced'}</b></span>
        <span>Signs: <b>{result.signature.signCount}</b></span>
      </div>
    </div>
  )
}
