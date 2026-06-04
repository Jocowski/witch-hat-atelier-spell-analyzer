// match.js — the catalog matcher (signature building + scoring), shared by the app (analyze.js)
// and the CLI (tools/spell-engine-cli.mjs). PURE: imports no JSON, so it runs under both Vite and
// plain `node --test`/the CLI — the caller injects the data as `deps`. This removes the old
// copy-pasted "keep in sync" duplication; each caller keeps only its own `computeSimilar` (which
// shapes the result differently for the app UI vs the --facts CLI).
//
// deps = { rules, spells, getDef }
//   rules  : data/rules.json   (uses rules.zones, rules.matching.weights)
//   spells : data/spells.json's spells array (the catalog)
//   getDef : (type) => sigil/sign definition (used for `.element`)
import { computeSymmetry, classifyZone } from './geometry.js'

// Multiset key for a sign: type, plus `!inv` when inverted counts, plus `@out` when the sign sits
// OUTSIDE its ring (external marks distinguish spells in the catalog).
export function signKey(type, inverted, zone) {
  return `${type}${inverted ? '!inv' : ''}${zone === 'outside' ? '@out' : ''}`
}

// Signature (recipe) of a single circle: core type/element + zone-aware sign multiset + symmetry.
export function buildSignature(deps, composition) {
  const { rules, getDef } = deps
  const { core, components, radius } = composition
  const signs = (components || []).filter((c) => c.role === 'sign')
  const multiset = {}
  for (const s of signs) {
    const zone = classifyZone(s.x, s.y, radius, rules.zones)
    const key = signKey(s.type, s.inverted, zone)
    multiset[key] = (multiset[key] || 0) + 1
  }
  const coreType = core?.type ?? null
  return {
    core: coreType,
    cores: coreType != null ? [coreType] : [],
    coreElement: core ? getDef(core.type)?.element ?? null : null,
    signMultiset: multiset,
    signCount: signs.length,
    symmetry: computeSymmetry(components || []),
  }
}

// Combined signature for a multi-circle spell: union of every circle's signs (zone-aware) + all
// cores, with symmetry from the circle carrying the most signs — lets a nested spell match one recipe.
export function buildCombinedSignature(deps, circles) {
  const { rules, getDef } = deps
  const multiset = {}
  const cores = []
  let signCount = 0
  let formCircle = null
  for (const c of circles) {
    if (c.core?.type) cores.push(c.core.type)
    const signs = (c.components || []).filter((x) => x.role === 'sign')
    signCount += signs.length
    for (const s of signs) {
      const zone = classifyZone(s.x, s.y, c.radius, rules.zones)
      const key = signKey(s.type, s.inverted, zone)
      multiset[key] = (multiset[key] || 0) + 1
    }
    if (!formCircle || signs.length > formCircle.n) formCircle = { circle: c, n: signs.length }
  }
  return {
    core: cores[0] ?? null,
    cores,
    coreElement: cores[0] ? getDef(cores[0])?.element ?? null : null,
    signMultiset: multiset,
    signCount,
    symmetry: formCircle ? computeSymmetry(formCircle.circle.components || []) : 'none',
  }
}

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
    const key = signKey(s.id, s.inverted, s.placement === 'outside' ? 'outside' : null)
    m[key] = (m[key] || 0) + (s.count || 1)
  }
  return m
}

function sameElement(getDef, coreA, coreB) {
  const a = getDef(coreA)?.element
  const b = getDef(coreB)?.element
  return a && b && a === b
}

const CONFIDENCE_WEIGHT = { high: 1, medium: 0.9, low: 0.7, theoretical: 0.6, unknown: 0.4 }

// Rank the catalog against a signature → [{ spell, score, parts }] sorted best-first.
export function matchSpell(deps, signature) {
  const { rules, spells, getDef } = deps
  const w = rules.matching.weights
  const cores = signature.cores && signature.cores.length ? signature.cores : (signature.core != null ? [signature.core] : [])
  const results = spells.map((spell) => {
    const comp = spell.composition || {}
    const sigilMatch = cores.includes(comp.core) ? 1 : cores.some((c) => sameElement(getDef, c, comp.core)) ? 0.5 : 0
    const signSetMatch = multisetSimilarity(signature.signMultiset, spellSignMultiset(spell))
    const symmetryMatch = comp.symmetry === signature.symmetry ? 1 : 0
    let score = w.sigilMatch * sigilMatch + w.signSetMatch * signSetMatch + w.symmetryMatch * symmetryMatch + w.placementMatch * 0.5
    score *= CONFIDENCE_WEIGHT[spell.confidence] ?? 0.5
    return { spell, score: Number(score.toFixed(3)), parts: { sigilMatch, signSetMatch, symmetryMatch } }
  })
  results.sort((a, b) => b.score - a.score)
  return results
}
