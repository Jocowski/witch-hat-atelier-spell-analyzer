// Orchestrates the full analysis of a spell (one or more circles), in sections:
// validity (rules) · sigils · signs · deduced effect · similar spells · dyes · geometry.
// Per-circle work + circle composition live in the pure compose.js; the catalog matcher lives in the
// pure match.js (shared with the CLI). This module binds the JSON and keeps the app-shaped result.
import grammar from '../../data/grammar.json'
import { RULES, SPELLS, SIGN_MAP, SIGIL_MAP, DYE_MAP, getComponentDef } from './data.js'
import { buildSignature as _buildSignature, buildCombinedSignature as _buildCombinedSignature, matchSpell as _matchSpell } from './match.js'
import { toComposition, analyzeCircleWith, composeWith, reclassifyCorelessCircles } from './compose.js'

const deps = { grammar, sigilMap: SIGIL_MAP, signMap: SIGN_MAP, dyeMap: DYE_MAP, zones: RULES.zones }
const matchDeps = { rules: RULES, spells: SPELLS, getDef: getComponentDef }

// Thin wrappers binding the injected data to the pure matcher (keep the existing public signatures).
export function buildSignature(composition) { return _buildSignature(matchDeps, composition) }
export function buildCombinedSignature(circles) { return _buildCombinedSignature(matchDeps, circles) }
export function matchSpell(signature) { return _matchSpell(matchDeps, signature) }

// A catalog spell is forbidden when explicitly flagged or in a forbidden category (rules.forbidden).
function spellIsForbidden(spell) {
  const cats = RULES.forbidden?.spellCategories ?? ['forbidden']
  return Boolean(spell.forbidden) || cats.includes(spell.category)
}

// ----- Similar-spell match (catalog) from a prebuilt signature (app-shaped result) -----
function computeSimilar(signature) {
  const ranked = SPELLS.length ? matchSpell(signature) : []
  const best = ranked[0]
  const threshold = RULES.matching.threshold
  let match = null
  let nearest = []
  if (best && best.score >= threshold && signature.signCount > 0) {
    match = {
      id: best.spell.id, name: best.spell.name, effect: best.spell.effect,
      category: best.spell.category, confidence: best.spell.confidence,
      forbidden: spellIsForbidden(best.spell), score: best.score,
      // B1: surface WHY it matched — the weighted sub-scores from match.js.
      parts: best.parts, weights: RULES.matching.weights,
    }
    nearest = ranked.slice(1, 4).filter((r) => r.score > 0.3).map((r) => ({ name: r.spell.name, score: r.score }))
  } else {
    nearest = ranked.slice(0, 3).filter((r) => r.score > 0.2).map((r) => ({ name: r.spell.name, score: r.score }))
  }
  return { catalogEmpty: SPELLS.length === 0, match, nearest }
}

// B4: forbidden-magic check. Flags the composition when its matched recipe is forbidden, or when any of
// its parts carries a configured forbidden effectTag (body/environment-affecting, per forbidden-magic.md).
// Returns { forbidden, reasons[] } — data-driven via rules.forbidden, so the engine stays generic.
function computeForbidden(circle, match) {
  const cfg = RULES.forbidden ?? {}
  const tags = new Set(cfg.tags ?? [])
  const reasons = []
  if (match?.forbidden) reasons.push(`Matches a known forbidden spell: ${match.name}.`)
  const parts = [circle.core, ...(circle.components ?? [])].filter(Boolean)
  for (const p of parts) {
    const def = getComponentDef(p.type)
    for (const t of def?.effectTags ?? []) {
      if (tags.has(t)) reasons.push(`"${def?.name || p.type}" carries a forbidden trait (${t}).`)
    }
  }
  return { forbidden: reasons.length > 0, reasons: [...new Set(reasons)] }
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
  // In a multi-circle spell, a coreless circle may be a legitimate boundary/modifier ring — let
  // the relations graph reclassify those so the spell isn't a false "invalid" (single circles skip).
  if (per.length > 1) reclassifyCorelessCircles(per, relations)

  if (per.length === 1) {
    // Single circle: keep the legacy top-level shape so the app/ResultPanel are unchanged,
    // while also exposing the v2 circles[]/relations/combined fields.
    const c0 = per[0]
    const similar = computeSimilar(buildSignature(circles[0]))
    return {
      name, valid: c0.valid, active: c0.active, status: statusOf(c0),
      issues: c0.issues, sigils: c0.sigils, signs: c0.signs,
      deduction: c0.deduction, similar,
      forbidden: computeForbidden(circles[0], similar.match),
      dyes: c0.dyes, analysis: c0.analysis,
      circles: per, relations, combined: c0.deduction,
    }
  }

  // Multi-circle: match a COMBINED signature (union of all circles' signs + every core) so a
  // nested spell can match one catalog recipe; also keep each circle's own match in perCircle.
  const combined = composeWith(grammar, relations, per)
  const perCircle = per.map((p, i) => ({ id: p.id, name: p.name, similar: computeSimilar(buildSignature(circles[i])) }))
  const combinedSimilar = computeSimilar(buildCombinedSignature(circles))
  // Forbidden across the whole device: any circle's parts, or the combined catalog match.
  const fb = circles.map((c) => computeForbidden(c, combinedSimilar.match))
  const forbidden = { forbidden: fb.some((f) => f.forbidden), reasons: [...new Set(fb.flatMap((f) => f.reasons))] }
  return {
    name, valid: per.every((p) => p.valid),
    circles: per, relations, combined,
    similar: combinedSimilar, forbidden,
    perCircle,
  }
}
