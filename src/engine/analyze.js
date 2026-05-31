// Orquestra: validação -> geometria -> assinatura -> matching -> interpretação.
import grammar from '../../data/grammar.json'
import { RULES, SIGNS, SPELLS, SIGN_MAP, SIGIL_MAP, getComponentDef, isSigilType, signCanBeCenter } from './data.js'
import { computeSymmetry, computeDirectionalBias, computePower, directionLabel } from './geometry.js'
import { deduceWith } from './deduce.js'

// Bind the grammar + maps for the app.
const deduce = (composition) => deduceWith(grammar, SIGIL_MAP, SIGN_MAP, composition)

// ---------- 1. Validação (regras blocking/warning) ----------
export function validate(composition) {
  const issues = []
  const { ring, core, components } = composition
  const signs = components.filter((c) => c.role === 'sign')

  // blocking: core present
  const hasCore = core && (isSigilType(core.type) || signCanBeCenter(core.type))
  if (!hasCore) {
    issues.push({ id: 'has-center', severity: 'blocking', message: 'Glyph has no core: place a sigil or a sign that can occupy the center.' })
  }

  // blocking: ring closed
  if (!ring?.closed) {
    issues.push({ id: 'ring-closed', severity: 'blocking', message: 'Ring open: spell prepared but INACTIVE. Close the ring to activate.' })
  }

  // warning: at least one sign
  if (signs.length === 0) {
    issues.push({ id: 'has-signs', severity: 'warning', message: 'No signs around the core: the element has no defined form.' })
  }

  return issues
}

// ---------- 2. Assinatura (recipe) da composição ----------
export function buildSignature(composition) {
  const { core, components } = composition
  const signs = components.filter((c) => c.role === 'sign')

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
    symmetry: computeSymmetry(components),
  }
}

// ---------- 3. Matching contra spells.json ----------
function multisetSimilarity(a, b) {
  // Jaccard ponderado sobre contagens (ignora marca !inv vs base parcialmente).
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  if (keys.size === 0) return 1
  let inter = 0
  let union = 0
  for (const k of keys) {
    const av = a[k] || 0
    const bv = b[k] || 0
    inter += Math.min(av, bv)
    union += Math.max(av, bv)
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

const CONFIDENCE_WEIGHT = { high: 1, medium: 0.9, low: 0.7, theoretical: 0.6, unknown: 0.4 }

export function matchSpell(signature) {
  const w = RULES.matching.weights
  const results = SPELLS.map((spell) => {
    const comp = spell.composition || {}
    const sigilMatch = comp.core && signature.core ? (comp.core === signature.core ? 1 : sameElement(comp.core, signature.core) ? 0.5 : 0) : comp.core === signature.core ? 1 : 0
    const signSetMatch = multisetSimilarity(signature.signMultiset, spellSignMultiset(spell))
    const symmetryMatch = comp.symmetry === signature.symmetry ? 1 : 0
    const placementMatch = 0.5 // placeholder: refinar com posições reais

    let score =
      w.sigilMatch * sigilMatch +
      w.signSetMatch * signSetMatch +
      w.symmetryMatch * symmetryMatch +
      w.placementMatch * placementMatch

    score *= CONFIDENCE_WEIGHT[spell.confidence] ?? 0.5
    return { spell, score: Number(score.toFixed(3)), parts: { sigilMatch, signSetMatch, symmetryMatch } }
  })
  results.sort((a, b) => b.score - a.score)
  return results
}

function sameElement(coreA, coreB) {
  const a = getComponentDef(coreA)?.element
  const b = getComponentDef(coreB)?.element
  return a && b && a === b
}

// ---------- 4. Interpretação livre (sem match) ----------
export function interpretFreeform(composition, signature) {
  const coreDef = composition.core ? getComponentDef(composition.core.type) : null
  const element = coreDef?.name || coreDef?.element || 'unknown element'

  const signs = composition.components.filter((c) => c.role === 'sign')
  const tags = new Set()
  const signNames = []
  for (const s of signs) {
    const def = SIGN_MAP[s.type]
    if (!def) continue
    signNames.push(def.name + (s.inverted ? ' (inverted)' : ''))
    for (const t of def.effectTags || []) tags.add(t + (s.inverted ? ':inv' : ''))
  }

  const bias = computeDirectionalBias(composition.components)
  let phrase = `Freeform composition: ${element} element`
  if (signNames.length) phrase += ` shaped by ${unique(signNames).join(', ')}`
  if (bias.biased) phrase += `, with the effect skewing ${directionLabel(bias.angle)}`
  phrase += '.'

  return { phrase, element, tags: [...tags] }
}

const unique = (arr) => [...new Set(arr)]

// ---------- Orquestrador ----------
export function analyze(composition) {
  const issues = validate(composition)
  const blocking = issues.filter((i) => i.severity === 'blocking')
  const signature = buildSignature(composition)

  const symmetry = signature.symmetry
  const bias = computeDirectionalBias(composition.components)
  const power = computePower(composition.components, { linkCount: composition.linkCount || 0 })

  const result = {
    valid: blocking.length === 0,
    active: blocking.length === 0, // sem blocking => ring fechado + núcleo => ativo
    issues,
    signature,
    geometry: { symmetry, bias, power },
    match: null,
    freeform: null,
    deduction: composition.core ? deduce(composition) : null, // explicação por partes
  }

  // Mesmo com ring aberto/sem núcleo, ainda mostramos o melhor palpite de identidade.
  const ranked = matchSpell(signature)
  const best = ranked[0]
  const threshold = RULES.matching.threshold

  if (best && best.score >= threshold && signature.signCount > 0) {
    result.match = {
      id: best.spell.id,
      name: best.spell.name,
      effect: best.spell.effect,
      category: best.spell.category,
      confidence: best.spell.confidence,
      forbidden: Boolean(best.spell.forbidden),
      score: best.score,
      alternatives: ranked.slice(1, 4).filter((r) => r.score > 0.3).map((r) => ({ name: r.spell.name, score: r.score })),
    }
  } else {
    result.freeform = interpretFreeform(composition, signature)
    result.nearest = ranked.slice(0, 3).filter((r) => r.score > 0.2).map((r) => ({ name: r.spell.name, score: r.score }))
  }

  return result
}
