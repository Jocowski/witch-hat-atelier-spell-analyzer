// Painel de análise: mostra TODAS as informações deriváveis de uma composição —
// validade (regras), efeito deduzido, sigils, signs, spells similares, dyes da
// tinta e métricas geométricas.

function Section({ title, sub, children }) {
  return (
    <section className="result-section">
      <h3>{title}{sub && <span className="sec-sub"> · {sub}</span>}</h3>
      {children}
    </section>
  )
}

function Effect({ deduction }) {
  if (!deduction) return <p className="muted">Add a sigil to the center to deduce an effect.</p>
  if (!deduction.ok) return <p className="muted">{deduction.summary}</p>
  return (
    <div className="effect-card">
      <p className="effect-summary">{deduction.summary}</p>
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
    </div>
  )
}

const CAT_LABEL = {
  directional: 'directional', 'semi-directional': 'semi-directional',
  'non-directional': 'non-directional', asymmetric: 'asymmetric', other: 'other',
}

export default function ResultPanel({ result }) {
  if (!result) return null
  const { name, status, issues, sigils, signs, deduction, similar, dyes, analysis } = result

  return (
    <div className="panel result">
      <h2>Analysis{name ? <span className="result-name"> — {name}</span> : ''}</h2>
      <div className={`status ${status.class}`}>{status.text}</div>

      <Section title="Validity">
        {issues.length === 0
          ? <p className="muted">All checks pass.</p>
          : <ul className="issues">{issues.map((i, k) => <li key={k} className={i.severity}>{i.message}</li>)}</ul>}
      </Section>

      <Section title="Effect" sub="deduced from the parts">
        <Effect deduction={deduction} />
      </Section>

      {sigils.length > 0 && (
        <Section title="Sigils" sub={`${sigils.length}`}>
          <ul className="def-list">
            {sigils.map((s, k) => (
              <li key={k}>
                <span className="dl-head">
                  <b>{s.name}</b>
                  {s.role === 'core' && <span className="tag">core</span>}
                  {s.family && <span className="tag soft">{s.family}</span>}
                  {s.element && s.element !== s.family && <span className="tag soft">{s.element}</span>}
                </span>
                {s.description && <span className="dl-text">{s.description}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {signs.length > 0 && (
        <Section title="Signs" sub={`${signs.reduce((n, s) => n + s.count, 0)}`}>
          <ul className="def-list">
            {signs.map((s, k) => (
              <li key={k}>
                <span className="dl-head">
                  <b>{s.name}</b>
                  {s.count > 1 && <span className="tag">×{s.count}</span>}
                  {s.inverted && <span className="tag inv">inverted</span>}
                  <span className="tag soft">{CAT_LABEL[s.category] || s.category}</span>
                  {!s.invertible && <span className="tag soft">not invertible</span>}
                </span>
                {s.effect && <span className="dl-text">{s.inverted && s.invertible ? 'Inverted — opposite of: ' : ''}{s.effect}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Similar spells">
        {similar.catalogEmpty ? (
          <p className="muted">No spells in the catalogue yet to compare against.</p>
        ) : similar.match ? (
          <div className={`spell-card ${similar.match.forbidden ? 'forbidden' : ''}`}>
            <div className="name">{similar.match.name}{similar.match.forbidden ? ' ⛔' : ''}</div>
            <div className="meta">{similar.match.category} · confidence {similar.match.confidence} · match {(similar.match.score * 100).toFixed(0)}%</div>
            <div className="effect">{similar.match.effect}</div>
            {similar.nearest.length > 0 && (
              <div className="alts">Also close: {similar.nearest.map((a) => `${a.name} (${(a.score * 100).toFixed(0)}%)`).join(' · ')}</div>
            )}
          </div>
        ) : similar.nearest.length > 0 ? (
          <p className="muted">No strong match. Closest: {similar.nearest.map((a) => `${a.name} (${(a.score * 100).toFixed(0)}%)`).join(' · ')}</p>
        ) : (
          <p className="muted">No catalogued spell resembles this composition.</p>
        )}
      </Section>

      {dyes.length > 0 && (
        <Section title="Conjuring ink" sub={`${dyes.length} ${dyes.length === 1 ? 'dye' : 'dyes'}`}>
          <ul className="ink-effects">
            {dyes.map((d) => (
              <li key={d.id}><span className="swatch" style={{ background: d.color }} /><b>{d.name}</b> — {d.effect}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Other information">
        <div className="geo-grid">
          <span>Stability: <b>{analysis.stability}</b></span>
          <span>Symmetry: <b>{analysis.symmetry}</b></span>
          <span>Balance: <b>{analysis.balance}</b></span>
          <span>Power: <b>{analysis.power}</b> ({analysis.powerLabel})</span>
          <span>Sigils: <b>{analysis.sigilCount}</b></span>
          <span>Signs: <b>{analysis.signCount}</b></span>
          <span>Aim: <b>{analysis.aim}</b></span>
          {analysis.linkCount > 0 && <span>Linked: <b>{analysis.linkCount}</b></span>}
          {analysis.inverted && <span className="flag">contains inverted signs</span>}
          {analysis.tilted && <span className="flag">tilted signs → spin</span>}
          {analysis.decorative && <span className="flag">decorative sigil (no practical effect)</span>}
        </div>
      </Section>
    </div>
  )
}
