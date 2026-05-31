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

// Direção para a qual um sign "aponta" (0 = norte, horário), a partir da sua própria
// rotação. Se for invertível e estiver invertido, a frente vira 180°.
export function signFacing(c, invertible = false) {
  let f = (((c.rotation || 0) % 360) + 360) % 360
  if (c.inverted && invertible) f = (f + 180) % 360
  return f
}

// AIM por ORIENTAÇÃO: resultante dos vetores de "frente" (rotação) dos signs direcionais.
// Diferente de computeDirectionalBias, que usa a POSIÇÃO (centro de massa) — este lê para
// onde os signs apontam. { aimed, angle, magnitude } (magnitude 0 = frentes se cancelam).
export function computeOrientationAim(signs, invertibleOf = () => false) {
  if (!signs.length) return { aimed: false, angle: 0, magnitude: 0 }
  let vx = 0
  let vy = 0
  for (const c of signs) {
    const f = signFacing(c, invertibleOf(c.type))
    const rad = (f * Math.PI) / 180
    vx += Math.sin(rad)
    vy += -Math.cos(rad)
  }
  const magnitude = Math.hypot(vx, vy) / signs.length
  let angle = (Math.atan2(vx, -vy) * 180) / Math.PI
  if (angle < 0) angle += 360
  return { aimed: magnitude > 0.34, angle, magnitude }
}

// Classifica um grupo de signs de "direção" (region/pull) nas 4 configurações canônicas
// (signs.md, Region): todos na mesma direção => dispara para lá; todos para dentro =>
// contido no ring; todos para fora => fora do ring; opostos (frentes se cancelam) =>
// só na linha do ring. Retorna { mode, angle? } ou null.
export function classifyRegion(signs, invertibleOf = () => true, tol = 35) {
  if (!signs.length) return null
  const items = signs.map((c) => ({
    facing: signFacing(c, invertibleOf(c.type)),
    pos: toPolar(c.x, c.y).angle,
  }))
  const aim = computeOrientationAim(signs, invertibleOf)
  const isInward = items.every((it) => angleDelta(it.facing, (it.pos + 180) % 360) <= tol)
  const isOutward = items.every((it) => angleDelta(it.facing, it.pos) <= tol)
  if (aim.aimed && !isInward && !isOutward) return { mode: 'aligned', angle: aim.angle }
  if (isInward) return { mode: 'inward' }
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
