#!/usr/bin/env node
// spell-engine-cli — runs the REAL spell engine over a composition JSON and
// prints the structured analysis as JSON. Used by the /spell-analyzer and
// /spell-creator skills so they reason from ground truth (the same rules the
// app enforces) instead of eyeballing the docs.
//
// This mirrors the orchestration in src/engine/analyze.js, but loads the data
// JSON via createRequire (Node can't use Vite-style bare JSON imports) and
// imports the PURE modules (geometry.js, deduce.js) directly. Keep it in sync
// with analyze.js if the pipeline there changes.
//
// Usage:
//   node tools/spell-engine-cli.mjs path/to/composition.json
//   echo '<json>' | node tools/spell-engine-cli.mjs       (reads stdin)
//   node tools/spell-engine-cli.mjs --text path.json      (human-readable)
//
// The input is a `composition` object (the wha-spell@1 export shape):
//   { name, ring:{closed}, core:{id,type,x,y,rotation,scale,inverted}|null,
//     components:[{id,type,role:'sign'|'sigil',x,y,rotation,scale,inverted}],
//     linkCount, dyes:[dyeId] }
// Files exported by the app wrap this as { format:'wha-spell@1', composition };
// both shapes are accepted.

import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const rules = require(resolve(root, 'data/rules.json'))
const grammar = require(resolve(root, 'data/grammar.json'))
const sigilsDoc = require(resolve(root, 'data/sigils.json'))
const signsDoc = require(resolve(root, 'data/signs.json'))
const dyesDoc = require(resolve(root, 'data/dyes.json'))
const spellsDoc = require(resolve(root, 'data/spells.json'))

const importLocal = (rel) => import(pathToFileURL(resolve(root, rel)).href)
const { toComposition, analyzeCircleWith, composeWith, reclassifyCorelessCircles } = await importLocal('src/engine/compose.js')
const { computeSymmetry, classifyZone } = await importLocal('src/engine/geometry.js')

const SIGIL_MAP = Object.fromEntries(sigilsDoc.sigils.map((s) => [s.id, s]))
const SIGN_MAP = Object.fromEntries(signsDoc.signs.map((s) => [s.id, s]))
const DYE_MAP = Object.fromEntries((dyesDoc.dyes || []).map((d) => [d.id, d]))
const SPELLS = spellsDoc.spells || []

const deps = { grammar, sigilMap: SIGIL_MAP, signMap: SIGN_MAP, dyeMap: DYE_MAP, zones: rules.zones }
const getDef = (type) => SIGIL_MAP[type] || SIGN_MAP[type] || null

// ---------- Catalog matcher (mirrors src/engine/analyze.js — keep in sync) ----------
function signKey(type, inverted, zone) {
  return `${type}${inverted ? '!inv' : ''}${zone === 'outside' ? '@out' : ''}`
}
function buildSignature(circle) {
  const { core, components, radius } = circle
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
// Combined signature for a multi-circle spell (union of signs + all cores; symmetry from the
// circle with the most signs) — lets a nested spell match one catalog recipe.
function buildCombinedSignature(circles) {
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
function sameElement(coreA, coreB) {
  const a = getDef(coreA)?.element
  const b = getDef(coreB)?.element
  return a && b && a === b
}
const CONFIDENCE_WEIGHT = { high: 1, medium: 0.9, low: 0.7, theoretical: 0.6, unknown: 0.4 }
function matchSpell(signature) {
  const w = rules.matching.weights
  const cores = signature.cores && signature.cores.length ? signature.cores : (signature.core != null ? [signature.core] : [])
  const results = SPELLS.map((spell) => {
    const comp = spell.composition || {}
    const sigilMatch = cores.includes(comp.core) ? 1 : cores.some((c) => sameElement(c, comp.core)) ? 0.5 : 0
    const signSetMatch = multisetSimilarity(signature.signMultiset, spellSignMultiset(spell))
    const symmetryMatch = comp.symmetry === signature.symmetry ? 1 : 0
    let score = w.sigilMatch * sigilMatch + w.signSetMatch * signSetMatch + w.symmetryMatch * symmetryMatch + w.placementMatch * 0.5
    score *= CONFIDENCE_WEIGHT[spell.confidence] ?? 0.5
    return { spell, score: Number(score.toFixed(3)), parts: { sigilMatch, signSetMatch, symmetryMatch } }
  })
  results.sort((a, b) => b.score - a.score)
  return results
}
function computeSimilar(signature) {
  const ranked = SPELLS.length ? matchSpell(signature) : []
  const best = ranked[0]
  const threshold = rules.matching.threshold
  let match = null
  let nearest = []
  if (best && best.score >= threshold && signature.signCount > 0) {
    match = { name: best.spell.name, score: best.score, effect: best.spell.effect, parts: best.parts }
  } else {
    nearest = ranked.slice(0, 3).filter((r) => r.score > 0.2).map((r) => ({ name: r.spell.name, score: r.score }))
  }
  return { catalogEmpty: SPELLS.length === 0, match, nearest }
}

// Orchestrate per-circle analysis + composition (mirrors src/engine/analyze.js, minus the
// catalog `similar` match the app does). Accepts a v1 composition or a v2 {circles,relations}.
function analyze(input) {
  const { name, circles, relations } = toComposition(input)
  const per = circles.map((c) => analyzeCircleWith(deps, c))
  // Relation-aware validity: coreless boundary/modifier rings aren't a false "invalid" in a
  // nested/linked spell (mirrors src/engine/analyze.js). Single circles are left untouched.
  if (per.length > 1) reclassifyCorelessCircles(per, relations)
  const valid = per.every((p) => p.valid)
  if (per.length === 1) {
    const c0 = per[0]
    return {
      name, valid, status: { text: valid ? 'Valid' : 'Invalid — no core' },
      issues: c0.issues, sigils: c0.sigils, signs: c0.signs, deduction: c0.deduction,
      similar: computeSimilar(buildSignature(circles[0])),
      dyes: c0.dyes, analysis: c0.analysis,
      circles: per, relations, combined: c0.deduction, catalogEmpty: SPELLS.length === 0,
    }
  }
  const combined = composeWith(grammar, relations, per)
  const perCircle = per.map((p, i) => ({ id: p.id, name: p.name, similar: computeSimilar(buildSignature(circles[i])) }))
  return {
    name, valid, status: { text: valid ? 'Valid' : 'Invalid — a circle is missing its core' },
    similar: computeSimilar(buildCombinedSignature(circles)),
    perCircle,
    circles: per, relations, combined, catalogEmpty: SPELLS.length === 0,
  }
}

// ---------- Unknown id detection (helps catch typos before deducing) ----------
function unknownIds(input) {
  const { circles } = toComposition(input)
  const unknown = []
  for (const c of circles) {
    if (c.core && !getDef(c.core.type)) unknown.push({ where: `core@${c.id}`, type: c.core.type })
    for (const comp of c.components || []) {
      if (!getDef(comp.type)) unknown.push({ where: `${comp.role || 'component'}@${c.id}`, type: comp.type })
    }
  }
  return unknown
}

// ---------- Human-readable rendering ----------
// Render one circle's sections. `h` is the heading prefix ('##' for a single-circle spell,
// '###' when nested under a per-circle "## Circle" header).
function renderCircle(L, c, h) {
  if (c.issues.length) {
    L.push(`${h} Validity`)
    for (const i of c.issues) L.push(`- [${i.severity}] ${i.message}`)
    L.push('')
  }
  if (c.sigils.length) {
    L.push(`${h} Sigils (substance)`)
    for (const s of c.sigils) L.push(`- ${s.name} (${s.role}, family=${s.family}, element=${s.element})`)
    L.push('')
  }
  if (c.signs.length) {
    L.push(`${h} Signs (operators)`)
    for (const s of c.signs) L.push(`- ${s.name}${s.inverted ? ' (inverted)' : ''}${s.count > 1 ? ` ×${s.count}` : ''} — ${s.category}`)
    L.push('')
  }
  if (c.deduction?.ok) {
    L.push(`${h} Deduced effect`)
    L.push(c.deduction.summary)
    L.push('')
    if (c.deduction.breakdown?.length) {
      L.push('Breakdown:')
      for (const b of c.deduction.breakdown) L.push(`- ${b.label}: ${b.text}`)
      L.push('')
    }
    if (c.deduction.notes?.length) { L.push('Notes:'); for (const n of c.deduction.notes) L.push(`- ${n}`); L.push('') }
    if (c.deduction.warnings?.length) { L.push('Warnings:'); for (const w of c.deduction.warnings) L.push(`- ${w}`); L.push('') }
  }
  if (c.dyes.length) {
    L.push(`${h} Dyes`)
    for (const d of c.dyes) L.push(`- ${d.name}: ${d.effect}`)
    L.push('')
  }
  const a = c.analysis
  L.push(`${h} Other`)
  L.push(`stability=${a.stability} | aim=${a.aim} | balance=${a.balance} | power=${a.power} (${a.powerLabel}) | symmetry=${a.symmetry}`)
  L.push(`sigils=${a.sigilCount} signs=${a.signCount} links=${a.linkCount}`)
}

// Render the catalog "Similar spells" section (engine match against data/spells.json).
function renderSimilar(L, similar, h) {
  if (!similar) return
  L.push('')
  L.push(`${h} Similar spells (engine catalog)`)
  if (similar.catalogEmpty) {
    L.push('- (catalog empty)')
  } else if (similar.match) {
    const m = similar.match
    L.push(`- Match: ${m.name} (score ${m.score}) — ${m.effect}`)
  } else if (similar.nearest?.length) {
    L.push('- Nearest: ' + similar.nearest.map((n) => `${n.name} (${n.score})`).join(', '))
  } else {
    L.push('- No catalog match.')
  }
}

function toText(r) {
  const L = []
  L.push(`# ${r.name || '(unnamed spell)'}`)
  L.push(`Status: ${r.status.text}  |  valid=${r.valid}  |  circles=${r.circles.length}`)
  L.push('')
  if (r.circles.length === 1) {
    renderCircle(L, r.circles[0], '##')
    renderSimilar(L, r.similar, '##')
  } else {
    for (const c of r.circles) {
      L.push(`## Circle: ${c.name || c.id}`)
      renderCircle(L, c, '###')
      L.push('')
    }
    L.push('## Combined effect')
    L.push(r.combined.summary)
    if (r.combined.notes?.length) { L.push(''); L.push('Notes:'); for (const n of r.combined.notes) L.push(`- ${n}`) }
    renderSimilar(L, r.similar, '##')
    if (r.relations?.length) {
      L.push('')
      L.push('Relations:')
      for (const rel of r.relations) {
        if (rel.type === 'nest') L.push(`- nest: ${rel.inner} inside ${rel.outer}`)
        else if (rel.type === 'link') L.push(`- link: ${rel.a} ↔ ${rel.b}`)
        else L.push(`- ${JSON.stringify(rel)}`)
      }
    }
  }
  return L.join('\n')
}

// ---------- Structured FACTS (the AI reasons FROM these) ----------
// The re-architecture (PLAN.md) makes the engine a COMPILER + fact-extractor, not the
// authority on what a spell does. `--facts` returns clean, engine-observable facts —
// parts present, their categories/operator kinds, geometry, zones, catalog neighbours —
// WITHOUT asserting the effect. The prose `deduction.summary` is still included but is
// explicitly demoted to `heuristicSummary` (a non-authoritative scaffold). Reason the
// actual effect from docs/CORE.md + docs/lexicon/ using these facts.
function buildFacts(input, result) {
  const norm = toComposition(input)
  const circleFacts = result.circles.map((c, i) => {
    const raw = norm.circles[i] || { components: [], radius: null }
    // Zone breakdown of the sign components (inside | ring | outside).
    const zones = { inside: 0, ring: 0, outside: 0 }
    for (const comp of raw.components || []) {
      if (comp.role !== 'sign') continue
      zones[classifyZone(comp.x, comp.y, raw.radius, rules.zones)]++
    }
    // Operators grouped by kind (stable mapping from grammar.json — observational, not an effect claim).
    const byKind = {}
    for (const s of c.signs || []) {
      const kind = grammar.operators[s.id]?.kind || 'unknown'
      ;(byKind[kind] ||= []).push(s.inverted ? `${s.id}!inv` : s.id)
    }
    const a = c.analysis || {}
    return {
      id: c.id,
      name: c.name || null,
      valid: c.valid,
      contextRole: c.contextRole || null,
      centerPromoted: !!c.centerPromoted,
      core: c.sigils?.find((s) => s.role === 'core')
        ? (() => { const k = c.sigils.find((s) => s.role === 'core'); return { id: k.id, name: k.name, element: k.element, family: k.family } })()
        : null,
      extraSigils: (c.sigils || []).filter((s) => s.role === 'sigil').map((s) => ({ id: s.id, name: s.name, element: s.element })),
      signs: (c.signs || []).map((s) => ({
        id: s.id, name: s.name, category: s.category, count: s.count,
        inverted: s.inverted, invertible: s.invertible, operatorKind: grammar.operators[s.id]?.kind || 'unknown',
      })),
      operatorsByKind: byKind,
      geometry: {
        symmetry: a.symmetry, stability: a.stability, aim: a.aim, balance: a.balance,
        power: a.power, powerLabel: a.powerLabel, spin: !!a.tilted,
        signCount: a.signCount, sigilCount: a.sigilCount, linkCount: a.linkCount,
      },
      zones,
      flags: {
        hasUnknownSigns: (c.signs || []).some((s) => /^unknown/.test(s.id)),
        inverted: (c.signs || []).some((s) => s.inverted),
        decorative: !!a.decorative,
      },
      dyes: (c.dyes || []).map((d) => ({ id: d.id, name: d.name, effect: d.effect })),
      issues: c.issues || [],
      heuristicSummary: c.deduction?.summary || null,
      heuristicNotes: c.deduction?.notes || [],
      heuristicWarnings: c.deduction?.warnings || [],
    }
  })
  return {
    name: result.name || null,
    valid: result.valid,
    circleCount: result.circles.length,
    circles: circleFacts,
    relations: result.relations || [],
    combinedHeuristicSummary: result.circles.length > 1 ? result.combined?.summary || null : circleFacts[0]?.heuristicSummary || null,
    catalog: result.similar || null,
    unknownIds: result.unknownIds || [],
    note: 'FACTS are engine-observable only. Deduce the actual effect from docs/CORE.md + docs/lexicon/ using these facts; *heuristicSummary fields are a non-authoritative scaffold, not ground truth.',
  }
}

// ---------- Entry ----------
function main() {
  const args = process.argv.slice(2)
  const textMode = args.includes('--text')
  const factsMode = args.includes('--facts')
  const fileArg = args.find((a) => !a.startsWith('--'))
  let raw
  if (fileArg) raw = readFileSync(resolve(process.cwd(), fileArg), 'utf8')
  else raw = readFileSync(0, 'utf8') // stdin

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    console.error('Invalid JSON input:', e.message)
    process.exit(2)
  }
  // Accept either a bare composition or the app's { format, composition } wrapper.
  const composition = parsed.composition || parsed

  const unknown = unknownIds(composition)
  const result = analyze(composition)
  if (unknown.length) result.unknownIds = unknown

  if (factsMode) {
    console.log(JSON.stringify(buildFacts(composition, result), null, 2))
  } else if (textMode) {
    if (unknown.length) {
      console.log('!! Unknown ids (typos?): ' + unknown.map((u) => `${u.type}@${u.where}`).join(', ') + '\n')
    }
    console.log(toText(result))
  } else {
    console.log(JSON.stringify(result, null, 2))
  }
}

main()
