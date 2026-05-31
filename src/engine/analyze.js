// Orquestra a análise completa de uma composição, em seções:
// validade (regras) · sigils · signs · efeito deduzido · spells similares ·
// dyes (tinta) · outras informações geométricas. Tudo derivado das docs/.
import grammar from '../../data/grammar.json'
import { RULES, SPELLS, SIGN_MAP, SIGIL_MAP, DYE_MAP, getComponentDef, isSigilType, signCanBeCenter } from './data.js'
import { computeSymmetry, computeDirectionalBias, computePower, directionLabel } from './geometry.js'
import { deduceWith } from './deduce.js'

const deduce = (composition) => deduceWith(grammar, SIGIL_MAP, SIGN_MAP, composition)

// ---------- Assinatura (recipe) da composição, p/ o matcher ----------
export function buildSignature(composition) {
  const { core, components } = composition
  const signs = (components || []).filter((c) => c.role === 'sign')
  const multiset = {}
  for (const s of signs) {
    const key = s.inverted ? `${s.type}!inv` : s.type
    multiset[key] = (multiset[key] || 0) + 1
  }
  return {
    core: core?.type ?? null,
    coreElement: core ? getComponentDef(core.type)?.element ?? null : null,
    signMultiset: multiset,
    signCount: signs.length,
    symmetry: computeSymmetry(components || []),
  }
}

// ---------- Matching contra spells.json ----------
function multisetSimilarity(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  if (keys.size === 0) return 1
  let inter = 0, union = 0
  for (const k of keys) {
    inter += Math.min(a[k] || 0, b[k] || 0)
    union += Math.max(a[k] || 0, b[k] || 0)
  }
  return union === 0 ? 1 : inter / union
}
function spellSignMultiset(spell) {
  const m = {}
  for (const s of spell.composition?.signs ?? []) {
    const key = s.inverted ? `${s.id}!inv` : s.id
    m[key] = (m[key] || 0) + (s.count || 1)
  }
  return m
}
function sameElement(coreA, coreB) {
  const a = getComponentDef(coreA)?.element
  const b = getComponentDef(coreB)?.element
  return a && b && a === b
}
const CONFIDENCE_WEIGHT = { high: 1, medium: 0.9, low: 0.7, theoretical: 0.6, unknown: 0.4 }

export function matchSpell(signature) {
  const w = RULES.matching.weights
  const results = SPELLS.map((spell) => {
    const comp = spell.composition || {}
    const sigilMatch = comp.core === signature.core ? 1 : sameElement(comp.core, signature.core) ? 0.5 : 0
    const signSetMatch = multisetSimilarity(signature.signMultiset, spellSignMultiset(spell))
    const symmetryMatch = comp.symmetry === signature.symmetry ? 1 : 0
    let score = w.sigilMatch * sigilMatch + w.signSetMatch * signSetMatch + w.symmetryMatch * symmetryMatch + w.placementMatch * 0.5
    score *= CONFIDENCE_WEIGHT[spell.confidence] ?? 0.5
    return { spell, score: Number(score.toFixed(3)), parts: { sigilMatch, signSetMatch, symmetryMatch } }
  })
  results.sort((a, b) => b.score - a.score)
  return results
}

// ---------- Orquestrador ----------
export function analyze(composition) {
  const comp = composition || {}
  const core = comp.core || null
  const components = comp.components || []
  const signComps = components.filter((c) => c.role === 'sign')
  const sigilComps = [
    ...(core ? [{ ...core, role: 'core' }] : []),
    ...components.filter((c) => c.role === 'sigil').map((c) => ({ ...c, role: 'sigil' })),
  ]

  const hasCore = !!(core && (isSigilType(core.type) || signCanBeCenter(core.type)))
  const ringClosed = !!comp.ring?.closed

  // ----- Geometria -----
  const symmetry = computeSymmetry(components)
  const bias = computeDirectionalBias(components)
  const power = computePower(components, { linkCount: comp.linkCount || 0 })
  const tilted = signComps.some((c) => (((c.rotation || 0) % 360) + 360) % 360 !== 0)

  // ----- Validade (regras das docs) -----
  const issues = []
  if (!hasCore) issues.push({ severity: 'blocking', message: 'No core: place a sigil (or a sign that can occupy the center) so the seal has a substance.' })
  if (!ringClosed) issues.push({ severity: 'inactive', message: 'Ring open: the spell is prepared but INACTIVE. Close the ring to activate.' })
  if (ringClosed && !hasCore && signComps.length === 0) issues.push({ severity: 'warning', message: 'A closed ring with nothing inside discharges raw energy — an explosion.' })
  if (hasCore && signComps.length === 0) issues.push({ severity: 'warning', message: 'No signs around the core: the element has no defined form (raw, undirected discharge).' })
  if (signComps.length >= 2) {
    if (symmetry === 'asymmetric') issues.push({ severity: 'warning', message: 'Asymmetric signs — the spell may be unstable. At least bilateral symmetry is recommended for stability.' })
    else issues.push({ severity: 'info', message: `Stable: ${symmetry} symmetry.` })
  }
  if (bias.biased && signComps.length >= 2) issues.push({ severity: 'info', message: `Unbalanced signs: the effect will skew ${directionLabel(bias.angle)} (bigger/more signs pull the manifestation their way).` })
  if (tilted) issues.push({ severity: 'info', message: 'Some signs are tilted — tilting signs makes the spell spin (more tilt = more spin, but less reach).' })

  const valid = hasCore
  const active = hasCore && ringClosed
  let status
  if (!hasCore) status = { class: 'invalid', text: 'Invalid — no core' }
  else if (!ringClosed) status = { class: 'inactive', text: '◔ Prepared (ring open — inactive)' }
  else status = { class: 'ok', text: '✦ Spell active' }

  // ----- Sigils -----
  const sigils = sigilComps.map((c) => {
    const d = getComponentDef(c.type)
    return { id: c.type, name: d?.name || c.type, role: c.role, family: d?.family || null, element: d?.element || null, description: d?.description || '' }
  })

  // ----- Signs (agrupados por tipo + inversão) -----
  const grouped = new Map()
  for (const c of signComps) {
    const key = c.type + (c.inverted ? '!inv' : '')
    if (!grouped.has(key)) grouped.set(key, { type: c.type, inverted: !!c.inverted, count: 0 })
    grouped.get(key).count++
  }
  const signs = [...grouped.values()].map((g) => {
    const d = SIGN_MAP[g.type]
    return { id: g.type, name: d?.name || g.type, category: d?.family || 'other', effect: d?.effect || '', count: g.count, inverted: g.inverted, invertible: !!d?.invertible }
  })

  // ----- Efeito deduzido (gramática) -----
  const deduction = hasCore ? deduce(composition) : null

  // ----- Spells similares (catálogo) -----
  const signature = buildSignature(composition)
  const ranked = SPELLS.length ? matchSpell(signature) : []
  const best = ranked[0]
  const threshold = RULES.matching.threshold
  let match = null
  let nearest = []
  if (best && best.score >= threshold && signature.signCount > 0) {
    match = {
      id: best.spell.id, name: best.spell.name, effect: best.spell.effect,
      category: best.spell.category, confidence: best.spell.confidence,
      forbidden: Boolean(best.spell.forbidden), score: best.score,
    }
    nearest = ranked.slice(1, 4).filter((r) => r.score > 0.3).map((r) => ({ name: r.spell.name, score: r.score }))
  } else {
    nearest = ranked.slice(0, 3).filter((r) => r.score > 0.2).map((r) => ({ name: r.spell.name, score: r.score }))
  }
  const similar = { catalogEmpty: SPELLS.length === 0, match, nearest }

  // ----- Dyes (conjuring ink) -----
  const dyes = (comp.dyes || []).map((id) => DYE_MAP[id]).filter(Boolean)
    .map((d) => ({ id: d.id, name: d.name, effect: d.effect, kind: d.kind, color: d.color }))

  // ----- Outras informações -----
  const types = new Set(signComps.map((c) => c.type))
  let powerLabel = grammar.power.balanced
  if (types.has('radial')) powerLabel = grammar.power.tempered
  else if (types.has('convergence')) powerLabel = grammar.power.focused
  else if (power > 1.3 || (comp.linkCount || 0) > 0) powerLabel = grammar.power.amplified

  const analysis = {
    symmetry,
    stability: grammar.stability[symmetry] || grammar.stability.none,
    balance: bias.biased ? `skewed ${directionLabel(bias.angle)}` : 'balanced',
    power,
    powerLabel,
    tilted,
    inverted: signs.some((s) => s.inverted),
    decorative: sigils.some((s) => s.family === 'decorative'),
    sigilCount: sigils.length,
    signCount: signComps.length,
    linkCount: comp.linkCount || 0,
    ring: ringClosed ? 'closed (active)' : 'open (inactive)',
  }

  return { name: comp.name || '', valid, active, status, issues, sigils, signs, deduction, similar, dyes, analysis }
}
