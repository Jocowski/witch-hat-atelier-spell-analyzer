// Análise geométrica da composição: polar, simetria, balanço direcional, potência.
// Convenção (rules.json): angle 0° = norte, sentido horário; radius normalizado 0..1.

export const CANVAS_RADIUS = 260 // raio do ring em px no SVG

// x,y (origem no centro, y para baixo no SVG) -> { angle(0..360, 0=norte CW), radius(0..1) }
export function toPolar(x, y) {
  const radiusPx = Math.hypot(x, y)
  // atan2 padrão tem 0 no leste e cresce anti-horário; convertemos para 0=norte, horário.
  let angle = (Math.atan2(x, -y) * 180) / Math.PI // 0 = norte, horário
  if (angle < 0) angle += 360
  return { angle, radius: Math.min(radiusPx / CANVAS_RADIUS, 1) }
}

// polar -> x,y em px
export function toCartesian(angle, radius) {
  const r = radius * CANVAS_RADIUS
  const rad = (angle * Math.PI) / 180
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) }
}

// Resolve a ring-anchor { angle, offset } to local x,y on a circle of the given radius.
// angle is degrees (0 = north, clockwise); offset shifts in/out from the ring (px, default 0).
// A pinned sign sits on the ring and tracks the ring when the circle is resized.
export function anchorToXY(angle, offset = 0, radius = CANVAS_RADIUS) {
  const r = (radius || CANVAS_RADIUS) + (offset || 0)
  const rad = (angle * Math.PI) / 180
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) }
}

// Inverse: local x,y on a circle of `radius` → ring-anchor { angle, offset }.
export function xyToAnchor(x, y, radius = CANVAS_RADIUS) {
  let angle = (Math.atan2(x, -y) * 180) / Math.PI
  if (angle < 0) angle += 360
  return { angle, offset: Math.hypot(x, y) - (radius || CANVAS_RADIUS) }
}

// Zone of a component relative to its circle's ring: 'inside' | 'ring' | 'outside'.
// Read from its distance to the circle center as a fraction of the ring radius (px).
// Components with no position (catalog recipes) or no radius default to 'inside'.
// `zones` is the rules.json block { ringBandFrac, outsideFrac } (defaults are conservative).
const DEFAULT_ZONES = { ringBandFrac: 0.85, outsideFrac: 1.05, outerMaxFrac: 1.7 }
export function classifyZone(x, y, radius, zones = DEFAULT_ZONES) {
  if (x == null || y == null) return 'inside'
  const R = radius || CANVAS_RADIUS
  if (!R) return 'inside'
  const frac = Math.hypot(x, y) / R
  const ringBand = zones.ringBandFrac ?? DEFAULT_ZONES.ringBandFrac
  const outside = zones.outsideFrac ?? DEFAULT_ZONES.outsideFrac
  if (frac > outside) return 'outside'
  if (frac > ringBand) return 'ring'
  return 'inside'
}

// Agrupa ângulos em N setores e mede a distribuição para inferir simetria.
export function computeSymmetry(components) {
  const signs = components.filter((c) => c.role === 'sign')
  if (signs.length === 0) return 'none'
  if (signs.length === 1) return 'asymmetric'

  const angles = signs.map((c) => toPolar(c.x, c.y).angle)

  // Teste de simetria radial: ângulos ~igualmente espaçados.
  const sorted = [...angles].sort((a, b) => a - b)
  const gaps = sorted.map((a, i) => {
    const next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1]
    return next - a
  })
  const meanGap = 360 / sorted.length
  const radialErr = gaps.reduce((s, g) => s + Math.abs(g - meanGap), 0) / gaps.length
  if (radialErr < meanGap * 0.25) return 'radial'

  // Teste bilateral: existe um eixo (vertical/horizontal) que espelha os ângulos.
  const mirrorsAbout = (axis) =>
    angles.every((a) =>
      angles.some((b) => angleClose(reflect(a, axis), b, 12)),
    )
  if (mirrorsAbout(0) || mirrorsAbout(90)) return 'bilateral'

  return 'asymmetric'
}

function reflect(angle, axis) {
  // espelha 'angle' em torno do eixo (axis em graus: 0 = vertical N-S, 90 = horizontal)
  let r = (2 * axis - angle) % 360
  if (r < 0) r += 360
  return r
}
function angleClose(a, b, tol) {
  const d = Math.abs(((a - b + 540) % 360) - 180)
  return Math.abs(d - 180) <= tol
}

// Vetor de viés direcional: soma ponderada por escala das posições dos signs direcionais.
// Retorna { biased: bool, angle, magnitude } — desvio do efeito.
export function computeDirectionalBias(components) {
  const signs = components.filter((c) => c.role === 'sign')
  if (signs.length === 0) return { biased: false, angle: 0, magnitude: 0 }

  let vx = 0
  let vy = 0
  for (const c of signs) {
    const { angle } = toPolar(c.x, c.y)
    const w = c.scale ?? 1
    const rad = (angle * Math.PI) / 180
    vx += Math.sin(rad) * w
    vy += -Math.cos(rad) * w
  }
  const magnitude = Math.hypot(vx, vy) / signs.length // 0 = balanceado
  // Mesma convenção de toPolar (0=norte, horário): atan2(x, -y).
  let angle = (Math.atan2(vx, -vy) * 180) / Math.PI
  if (angle < 0) angle += 360
  return { biased: magnitude > 0.25, angle, magnitude }
}

// Diferença angular mínima entre dois ângulos (0..180).
function angleDelta(a, b) {
  let d = Math.abs(((a - b) % 360) + 360) % 360
  if (d > 180) d = 360 - d
  return d
}

// Canon sign categories (signs.md, "Sign Categories") decide what a sign's rotation and
// inversion actually mean:
//   - directional: has a front; rotation STEERS the spell; inverting flips the front 180°.
//   - semi-directional: has a front, but it does NOT steer the spell; inverting flips the
//     EFFECT to its opposite (crush↔reform, enlarge↔shrink).
//   - non-directional: no front — rotation is irrelevant and the sign CANNOT be inverted.
//   - asymmetric: behavior under angling/inverting is unknown (treat as non-steering).
export function canSteer(family) {
  return family === 'directional'
}
export function canInvert(family) {
  return family === 'directional' || family === 'semi-directional'
}

// Direction a sign "points" (0 = north, clockwise), or null when the sign has no steering
// front (semi-/non-directional, asymmetric). Only directional signs steer the spell; an
// inverted directional sign has its front flipped 180°.
export function signFacing(c, family) {
  if (!canSteer(family)) return null
  let f = (((c.rotation || 0) % 360) + 360) % 360
  if (c.inverted) f = (f + 180) % 360
  return f
}

// Rotation (deg, 0 = north CW) that makes a sign's TOP face the center of the seal, given
// its position. This is the "neutral" orientation for a sign in the ring (the canon
// arrow-tip-faces-inward default). The UI uses it as the default/reset rotation.
export function inwardRotation(x, y) {
  return ((Math.atan2(x, -y) * 180) / Math.PI + 180 + 360) % 360
}

// Rotation (deg, 0 = north CW) that makes a sign's TOP face AWAY from the center (outward),
// given its position. The neutral orientation for signs whose canon default points outward
// rather than inward — e.g. Sights Set, whose tip faces out of the seal.
export function outwardRotation(x, y) {
  return (inwardRotation(x, y) + 180) % 360
}

// SPIN = tangential cant of a sign's facing off its radial (inward/outward) axis. A sign
// aimed inward or outward is ORIENTED (steering the spell), not spinning; one canted toward
// the tangent (~90° off radial) spins the spell. Only signs with a front (directional) can
// cant — non-directional rotation is meaningless and ignored. Returns { spinning, cant }
// where cant is the max tangential deviation in degrees (0 = radial, 90 = fully tangential).
export function computeSpin(components, familyOf = () => null, { tolDeg = 15 } = {}) {
  const signs = components.filter((c) => c.role === 'sign')
  let cant = 0
  for (const c of signs) {
    const facing = signFacing(c, familyOf(c.type))
    if (facing == null) continue // no front → rotation is meaningless, never "spin"
    const pos = toPolar(c.x, c.y).angle // radial axis (outward); inward = pos + 180
    let off = angleDelta(facing, pos)
    if (off > 90) off = 180 - off // fold: inward AND outward both count as "aligned"
    cant = Math.max(cant, off)
  }
  return { spinning: cant > tolDeg, cant }
}

// AIM por ORIENTAÇÃO: resultante dos vetores de "frente" (rotação) dos signs direcionais.
// Diferente de computeDirectionalBias, que usa a POSIÇÃO (centro de massa) — este lê para
// onde os signs apontam. Signs sem frente (signFacing === null) são ignorados.
// { aimed, angle, magnitude } (magnitude 0 = frentes se cancelam).
export function computeOrientationAim(signs, familyOf = () => null) {
  // Each facing vector is weighted by the sign's magnitude (size). Two opposing signs of EQUAL size
  // still cancel (magnitude 0), but a larger sign wins the tug-of-war — the Column "T" lesson: the
  // longer/bigger keystone steers the spell its way. Weight defaults to scale; a future variant-metric
  // (stem length) can override it via `c.metrics.directionalMagnitude`. Normalize by Σweight (not count)
  // so a lone large sign doesn't push magnitude past 1.
  const items = signs
    .map((c) => ({ f: signFacing(c, familyOf(c.type)), w: magnitudeOf(c) }))
    .filter((it) => it.f != null)
  if (!items.length) return { aimed: false, angle: 0, magnitude: 0 }
  let vx = 0
  let vy = 0
  let wsum = 0
  for (const { f, w } of items) {
    const rad = (f * Math.PI) / 180
    vx += Math.sin(rad) * w
    vy += -Math.cos(rad) * w
    wsum += w
  }
  const magnitude = wsum > 0 ? Math.hypot(vx, vy) / wsum : 0
  let angle = (Math.atan2(vx, -vy) * 180) / Math.PI
  if (angle < 0) angle += 360
  return { aimed: magnitude > 0.34, angle, magnitude }
}

// A sign's directional magnitude: an explicit variant metric if present, else its uniform scale.
// (SPEC-sign-variants-sizing.md — Layer 1 uses scale; Layer 2 will fill metrics.directionalMagnitude.)
function magnitudeOf(c) {
  const m = c?.metrics?.directionalMagnitude
  return typeof m === 'number' && m > 0 ? m : (c?.scale ?? 1)
}

// Positional resultant of WHERE region signs sit on the ring (scale-weighted unit vectors
// by position angle). magnitude ≈ 0 ⇒ spread evenly around the ring (balanced); large ⇒
// clustered on one arc. Canon (signs.md:96–99) shows the magic emitting FROM where the
// region signs are ("the red regions"), so a one-sided cluster biases the manifestation
// toward that side even when every sign faces inward. { centroidAngle, magnitude }.
export function computeRegionCoverage(signs, familyOf = () => null) {
  const items = signs.filter((c) => signFacing(c, familyOf(c.type)) != null)
  if (!items.length) return { centroidAngle: 0, magnitude: 0 }
  let vx = 0
  let vy = 0
  for (const c of items) {
    const { angle } = toPolar(c.x, c.y)
    const w = c.scale ?? 1
    const rad = (angle * Math.PI) / 180
    vx += Math.sin(rad) * w
    vy += -Math.cos(rad) * w
  }
  const magnitude = Math.hypot(vx, vy) / items.length
  let centroidAngle = (Math.atan2(vx, -vy) * 180) / Math.PI
  if (centroidAngle < 0) centroidAngle += 360
  return { centroidAngle, magnitude }
}

// Classifica um grupo de signs com frente (region/pull/levitation) nas configurações
// canônicas (signs.md, Region): todos na mesma direção => apontam para lá; todos para
// dentro => contido/centrado; todos para fora => para fora do ring; opostos (frentes se
// cancelam) => só na linha do ring. CASO EXTRA (não enumerado nos docs, mas demonstrado
// pelo Rising Wave): signs para dentro porém cobrindo só um arco do ring (coverage acima
// de coverTol) => a magia emerge enviesada para esse lado em vez de contida. Signs sem
// frente são descartados. { mode, angle? } | null.
export function classifyRegion(signs, familyOf = () => 'directional', tol = 35, coverTol = 0.34) {
  const items = signs
    .map((c) => ({ facing: signFacing(c, familyOf(c.type)), pos: toPolar(c.x, c.y).angle }))
    .filter((it) => it.facing != null)
  if (!items.length) return null
  const aim = computeOrientationAim(signs, familyOf)
  const isInward = items.every((it) => angleDelta(it.facing, (it.pos + 180) % 360) <= tol)
  const isOutward = items.every((it) => angleDelta(it.facing, it.pos) <= tol)
  if (aim.aimed && !isInward && !isOutward) return { mode: 'aligned', angle: aim.angle }
  if (isInward) {
    // Inward-facing regions normally CONTAIN the magic within the ring — but only when they
    // ring the seal evenly. Covering just one arc (positional resultant > coverTol) biases
    // the surge toward that cluster (Rising Wave: inward regions on the top half ⇒ the water
    // surges out toward the top rather than staying contained).
    // A single sign trivially has coverage magnitude 1 (one vector), which is not a
    // meaningful "one arc" — needs at least two signs to read as a one-sided ring.
    const cover = computeRegionCoverage(signs, familyOf)
    if (items.length >= 2 && cover.magnitude > coverTol) return { mode: 'biased', angle: cover.centroidAngle }
    return { mode: 'inward' }
  }
  if (isOutward) return { mode: 'outward' }
  if (!aim.aimed) return { mode: 'opposed' }
  return { mode: 'aligned', angle: aim.angle }
}

// Potência relativa: escala média dos componentes × nitidez (assumida) × bônus de link.
export function computePower(components, { neatness = 1, linkCount = 0 } = {}) {
  const all = components.filter((c) => c.role === 'sign' || c.role === 'sigil')
  if (all.length === 0) return 0
  const avgScale = all.reduce((s, c) => s + (c.scale ?? 1), 0) / all.length
  const linkBonus = 1 + Math.min(linkCount, 5) * 0.2
  return Number((avgScale * neatness * linkBonus).toFixed(2))
}

export function directionLabel(angle) {
  const dirs = ['up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left']
  return dirs[Math.round(angle / 45) % 8]
}
