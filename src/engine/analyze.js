// Orchestrates the full analysis of a spell (one or more circles), in sections:
// validity (rules) · sigils · signs · deduced effect · similar spells · dyes · geometry.
// Per-circle work + circle composition live in the pure compose.js; this binds the JSON.
import grammar from '../../data/grammar.json'
import { RULES, SPELLS, SIGN_MAP, SIGIL_MAP, DYE_MAP, getComponentDef } from './data.js'
import { computeSymmetry } from './geometry.js'
import { toComposition, analyzeCircleWith, composeWith } from './compose.js'

const deps = { grammar, sigilMap: SIGIL_MAP, signMap: SIGN_MAP, dyeMap: DYE_MAP }

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

// ----- Similar-spell match (catalog) for a single circle -----
function computeSimilar(circle) {
  const signature = buildSignature(circle)
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
  return { catalogEmpty: SPELLS.length === 0, match, nearest }
}

// `status`/`active` drive the app's activation visual only; they are NOT part of the analysis.
function statusOf(c) {
  if (!c.hasCore) return { class: 'invalid', text: 'Invalid — no core' }
  return c.ringClosed ? { class: 'ok', text: '✦ Spell active' } : { class: 'inactive', text: '◔ Prepared (ring open — inactive)' }
}

// ---------- Orchestrator ----------
// Accepts a v1 composition (core/components/ring) or a v2 spell ({circles,relations}).
export function analyze(input) {
  const { name, circles, relations } = toComposition(input)
  const per = circles.map((c) => analyzeCircleWith(deps, c))

  if (per.length === 1) {
    // Single circle: keep the legacy top-level shape so the app/ResultPanel are unchanged,
    // while also exposing the v2 circles[]/relations/combined fields.
    const c0 = per[0]
    return {
      name, valid: c0.valid, active: c0.active, status: statusOf(c0),
      issues: c0.issues, sigils: c0.sigils, signs: c0.signs,
      deduction: c0.deduction, similar: computeSimilar(circles[0]),
      dyes: c0.dyes, analysis: c0.analysis,
      circles: per, relations, combined: c0.deduction,
    }
  }

  const combined = composeWith(grammar, relations, per)
  return {
    name, valid: per.every((p) => p.valid),
    circles: per, relations, combined,
    similar: { catalogEmpty: SPELLS.length === 0, match: null, nearest: [] },
  }
}
