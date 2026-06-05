/**
 * FlowPanel.jsx — "why is the spell steered this way?" view.
 *
 * Renders the einlair vector model (docs/theories/einlair-vector-analysis) for the current
 * composition: a small schematic diagram (ring + per-sign contribution arrows + the net resultant
 * + the out-of-plane up-flow) and a breakdown table (per-sign facing / force / radial / tangential,
 * then totals R, T, U, Φ and a plain-English verdict). Pure presentation — all numbers come from
 * computeSignVectors()/computeColumnFlow() in the engine.
 */
import { directionLabel } from '../engine/geometry.js'

// Match the canvas overlay colors so the schematic reads the same as the on-seal arrows.
const C_SIGN = '#3aa0e8'
const C_NET = '#e0683a'
const C_UP = '#5ec8a0'
const C_FORCE = '#8a7bd8'
const C_SPREAD = '#d8923a'

const SVG = 240
const CTR = SVG / 2

// 0° = north, clockwise → unit vector in y-down space.
function facingUnit(deg) {
  const r = (deg * Math.PI) / 180
  return { x: Math.sin(r), y: -Math.cos(r) }
}

// An arrow as a line + a triangular head (SVG px).
function Arrow({ x1, y1, x2, y2, color, width = 2.4, head = 9 }) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len
  const px = -uy, py = ux
  const hx = x2 - ux * head, hy = y2 - uy * head
  const p1 = `${x2},${y2}`
  const p2 = `${hx + px * head * 0.5},${hy + py * head * 0.5}`
  const p3 = `${hx - px * head * 0.5},${hy - py * head * 0.5}`
  return (
    <g>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={`${p1} ${p2} ${p3}`} fill={color} />
    </g>
  )
}

export default function FlowPanel({ signs = [], flow, ringRadius = 180 }) {
  const directional = (flow?.parts?.length ?? 0) > 0
  // Scale world coords → svg so the ring fits with a margin.
  const maxR = Math.max(ringRadius, ...signs.map((s) => Math.hypot(s.x || 0, s.y || 0)), 1)
  const scale = (CTR - 26) / maxR
  const W = (x) => CTR + (x || 0) * scale
  const ringPx = ringRadius * scale

  return (
    <div className="flow-panel">
      <div className="flow-diagram">
        <svg width={SVG} height={SVG} viewBox={`0 0 ${SVG} ${SVG}`} role="img" aria-label="Spell flow diagram">
          {/* ring + centre */}
          <circle cx={CTR} cy={CTR} r={ringPx} fill="none" stroke="rgba(201,162,74,0.5)" strokeWidth="1.5" strokeDasharray="5 5" />
          <circle cx={CTR} cy={CTR} r="2.5" fill="rgba(201,162,74,0.7)" />

          {/* per-sign vectors */}
          {signs.map((s, i) => {
            const sx = W(s.x), sy = W(s.y)
            if (s.angle == null) {
              const rr = 5 + (s.magnitude || 0) * 7
              return <circle key={i} cx={sx} cy={sy} r={rr} fill="none" stroke={C_FORCE} strokeWidth="2" strokeDasharray="3 3" />
            }
            const u = facingUnit(s.angle)
            const len = 18 + (s.magnitude || 0) * 26
            return <Arrow key={i} x1={sx} y1={sy} x2={sx + u.x * len} y2={sy + u.y * len} color={C_SIGN} />
          })}

          {/* einlair flow indicators at the centre */}
          {flow && !flow.inverted && flow.netFrac > 0.04 && (() => {
            const u = facingUnit(flow.netAngle)
            const len = 26 + flow.netFrac * 64
            return <Arrow key="net" x1={CTR} y1={CTR} x2={CTR + u.x * len} y2={CTR + u.y * len} color={C_NET} width={3} head={11} />
          })()}
          {flow && !flow.inverted && flow.upFrac > 0.06 && (
            <g>
              <circle cx={CTR} cy={CTR} r={10 + flow.upFrac * 30} fill="none" stroke={C_UP} strokeWidth="2.2" strokeDasharray="6 5" />
              <circle cx={CTR} cy={CTR} r="3" fill={C_UP} />
              <text x={CTR + 6} y={CTR - 12 - flow.upFrac * 30} fill={C_UP} fontSize="12" fontWeight="600">↑ up</text>
            </g>
          )}
          {flow && flow.inverted && (
            <g>
              <circle cx={CTR} cy={CTR} r="34" fill="none" stroke={C_SPREAD} strokeWidth="2.2" strokeDasharray="6 5" />
              {Array.from({ length: 8 }, (_, k) => {
                const a = (k * Math.PI) / 4
                const c = Math.cos(a), s = Math.sin(a)
                return <line key={k} x1={CTR + c * 34} y1={CTR + s * 34} x2={CTR + c * 46} y2={CTR + s * 46} stroke={C_SPREAD} strokeWidth="2" strokeLinecap="round" />
              })}
            </g>
          )}
        </svg>
      </div>

      <div className="flow-readout">
        {!directional ? (
          <p className="detect-hint">No directional signs — nothing steers this spell, so there is no flow vector to show.</p>
        ) : (
          <>
            <table className="flow-table">
              <thead>
                <tr><th>Sign</th><th>Facing</th><th>Force</th><th>Radial</th><th>Tangent</th></tr>
              </thead>
              <tbody>
                {flow.parts.map((p, i) => (
                  <tr key={i}>
                    <td>{p.type}</td>
                    <td>{Math.round(p.facing)}°</td>
                    <td>{p.magnitude.toFixed(2)}</td>
                    <td>{p.a.toFixed(2)}</td>
                    <td>{p.b.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flow-totals">
              <span title="Radial flow that exits the seal = |Σ cᵢ|">R = {flow.R.toFixed(2)}</span>
              <span title="Total flow in = Σ |cᵢ|">T = {flow.T.toFixed(2)}</span>
              <span title="Out-of-plane (upward) flow = T − R">U = {flow.U.toFixed(2)}</span>
              <span title="Signed flux: Φ>0 inward (upward possible), Φ<0 outward (radial spread)">Φ = {flow.flux.toFixed(2)}</span>
            </div>
            <p className="flow-verdict">{verdict(flow)}</p>
          </>
        )}
      </div>
    </div>
  )
}

function verdict(flow) {
  if (flow.inverted) {
    const bias = flow.netFrac > 0.15 ? ` biased ${directionLabel(flow.netAngle)}` : ''
    return `Inverted (Φ<0): the magic spreads radially outward${bias}.`
  }
  const dir = `${directionLabel(flow.netAngle)} (${Math.round(flow.netAngle)}°)`
  const up = Math.round(flow.upFrac * 100)
  const rad = Math.round(flow.netFrac * 100)
  if (flow.upFrac > 0.6) return `Columns cancel radially → the spell erupts straight UP (≈${up}% upward).`
  if (flow.netFrac > 0.6) return `Directed ${dir} — ≈${rad}% of the flow exits that way.`
  return `Mixed: ≈${rad}% exits ${dir}, ≈${up}% goes upward.`
}
