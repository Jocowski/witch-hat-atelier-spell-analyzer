// Orchestrates the full analysis of a spell (one or more circles), in sections:
// validity (rules) · sigils · signs · deduced effect · similar spells · dyes · geometry.
// Per-circle work + circle composition live in the pure compose.js; the catalog matcher lives in the
// pure match.js (shared with the CLI). This module binds the JSON and keeps the app-shaped result.
import { RULES, SPELLS, DYE_MAP, getComponentDef } from './data.js'
import { getSnapshot } from './symbolStore.js'
import { buildSignature as _buildSignature, buildCombinedSignature as _buildCombinedSignature, matchSpell as _matchSpell } from '#domain/engine/match.js'
import { toComposition, analyzeCircleWith, composeWith, reclassifyCorelessCircles } from '#domain/engine/compose.js'
import { computeOrientationAim, computeColumnFlow } from '#domain/engine/geometry.js'
import { assembleSpellIR } from '#domain/engine/ir.js'

// Build the engine deps from the CURRENT symbol snapshot (baseline ⊕ DB overlay), so re-analysis
// after an Admin edit uses fresh grammar/maps. Cheap object build per analyze() call.
function buildDeps() {
  const snap = getSnapshot()
  return {
    grammar: snap.grammar,
    deps: { grammar: snap.grammar, sigilMap: snap.sigilMap, signMap: snap.signMap, dyeMap: DYE_MAP, zones: RULES.zones, magnitudeCfg: RULES.magnitude },
  }
}
const irCfg = RULES.irTuning
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
      // F2-B: thread lifecycle from the matched spell record (absent = stable, no caveat).
      lifecycle: best.spell.lifecycle ?? null,
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

// Assemble SpellIR facts from a per-circle result + the original raw circle (SPEC-spell-ir.md).
// Re-derives the orientation aim to expose vx/vy/wsum for the tilt math (the circle result only
// keeps the aim label). Additive — never throws; an invalid circle yields a zeroed SpellIR.
function buildIRFacts(circleResult, circle, grammar, signMap) {
  const signComps = (circle.components || []).filter((c) => c.role === 'sign')
  const inside = signComps.filter((c) => c.zone !== 'outside')
  const types = new Set(inside.map((c) => c.type))
  const familyOf = (t) => signMap[t]?.family
  const aimSignComps = inside.filter((c) => grammar.operators[c.type]?.kind === 'direction')
  const aim = computeOrientationAim(aimSignComps.length ? aimSignComps : inside, familyOf)
  return {
    valid: circleResult.valid,
    analysis: circleResult.analysis,
    circle,
    signComps,
    types,
    aim,
    familyOf,
    grammarOps: grammar.operators,
    flow: computeColumnFlow(inside, familyOf),
  }
}

// ---------- Orchestrator ----------
// Accepts a v1 composition (core/components/ring) or a v2 spell ({circles,relations}).
export function analyze(input) {
  const { grammar, deps } = buildDeps()
  const signMap = deps.signMap
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
    const spellIR = assembleSpellIR(buildIRFacts(c0, circles[0], grammar, signMap), irCfg)
    return {
      name, valid: c0.valid, active: c0.active, status: statusOf(c0),
      issues: c0.issues, sigils: c0.sigils, signs: c0.signs,
      deduction: c0.deduction, similar,
      forbidden: computeForbidden(circles[0], similar.match),
      dyes: c0.dyes, analysis: c0.analysis,
      circles: per, relations, combined: c0.deduction,
      spellIR,
    }
  }

  // Multi-circle: match a COMBINED signature (union of all circles' signs + every core) so a
  // nested spell can match one catalog recipe; also keep each circle's own match in perCircle.
  const combined = composeWith(grammar, relations, per)
  const perCircle = per.map((p, i) => ({
    id: p.id, name: p.name,
    similar: computeSimilar(buildSignature(circles[i])),
    spellIR: assembleSpellIR(buildIRFacts(p, circles[i], grammar, signMap), irCfg),
  }))
  const combinedSimilar = computeSimilar(buildCombinedSignature(circles))
  // Forbidden across the whole device: any circle's parts, or the combined catalog match.
  const fb = circles.map((c) => computeForbidden(c, combinedSimilar.match))
  const forbidden = { forbidden: fb.some((f) => f.forbidden), reasons: [...new Set(fb.flatMap((f) => f.reasons))] }
  // Combined SpellIR: most-conservative summary across circles (max push, min stability/gravity).
  const irList = perCircle.map((p) => p.spellIR).filter(Boolean)
  const spellIR = irList.length
    ? {
        force: Math.max(...irList.map((r) => r.force)),
        spread: Math.max(...irList.map((r) => r.spread)),
        focus: Math.min(...irList.map((r) => r.focus)),
        range: Math.max(...irList.map((r) => r.range)),
        duration: Math.max(...irList.map((r) => r.duration)),
        stability: Math.min(...irList.map((r) => r.stability)),
        gravity: Math.min(...irList.map((r) => r.gravity)),
        dirCoherence: Math.max(...irList.map((r) => r.dirCoherence)),
        direction: irList[0].direction,
      }
    : null
  return {
    name, valid: per.every((p) => p.valid),
    circles: per, relations, combined,
    similar: combinedSimilar, forbidden,
    perCircle,
    spellIR,
  }
}
