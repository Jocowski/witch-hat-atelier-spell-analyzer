// Compositional deduction: explains what a spell does from its parts,
// grounded in data/grammar.json. The sigil gives the SUBSTANCE; each sign is an
// OPERATOR that transforms how that substance manifests.
//
// deduceWith(...) is pure (grammar + maps injected) so it can be unit-tested in
// plain Node. The app binds the real JSON via deduce() in engine/analyze.js.
// NOTE: keep this module free of JSON imports so Node can load it without import attributes.
import { computeSymmetry, computeDirectionalBias, directionLabel } from './geometry.js'

const KIND_ORDER = ['transmute', 'form', 'motion', 'direction', 'target', 'power', 'special', 'support', 'none']

// Collapse signs into unique {type, count, inverted} entries.
function groupSigns(components) {
  const map = new Map()
  for (const c of components) {
    if (c.role !== 'sign') continue
    const key = `${c.type}|${c.inverted ? 1 : 0}`
    if (!map.has(key)) map.set(key, { type: c.type, inverted: !!c.inverted, count: 0 })
    map.get(key).count++
  }
  return [...map.values()]
}

function opVerb(op, inverted) {
  if (inverted && op.invertedVerb) return op.invertedVerb
  return op.verb
}

// Evaluate one interaction's `when` against the present types/element/core.
function interactionApplies(when, ctx) {
  if (when.has) {
    const has = Array.isArray(when.has) ? when.has : [when.has]
    if (!has.every((t) => ctx.types.has(t))) return false
  }
  if (when.missing) {
    const missing = Array.isArray(when.missing) ? when.missing : [when.missing]
    if (!missing.every((t) => !ctx.types.has(t))) return false
  }
  if (when.element && ctx.element !== when.element) return false
  if (when.core && ctx.core !== when.core) return false
  return true
}

export function deduceWith(g, sigilMap, signMap, composition) {
  const core = composition.core
  if (!core) {
    return { ok: false, summary: 'No core: place a sigil (or a sign that can sit at the center) to give the spell a substance.' }
  }

  const coreDef = sigilMap[core.type] || signMap[core.type] || null
  const elementId = coreDef?.element || 'unknown'
  const el = g.elements[elementId] || g.elements.unknown
  const substance = el.substance

  const groups = groupSigns(composition.components)
  const types = new Set(groups.map((x) => x.type))

  // Bucket operators by kind.
  const byKind = {}
  for (const grp of groups) {
    const op = g.operators[grp.type]
    if (!op) continue
    ;(byKind[op.kind] ||= []).push({ ...grp, op })
  }

  const breakdown = []
  // Core line.
  breakdown.push({
    part: core.type,
    role: 'core',
    label: coreDef?.name || core.type,
    text: `Provides the substance: ${substance} (${el.raw}).`,
  })

  // ----- Primary clause: transmute outranks form, else raw element -----
  let primary
  const transmute = byKind.transmute?.[0]
  const form = byKind.form?.[0]
  if (transmute) {
    primary = `The ${substance} ${opVerb(transmute.op, transmute.inverted)}`
  } else if (form) {
    primary = `The ${substance} ${opVerb(form.op, form.inverted)}`
  } else {
    primary = `The ${substance} ${el.raw}`
  }

  // ----- Direction -----
  const bias = computeDirectionalBias(composition.components)
  const signCount = composition.components.filter((c) => c.role === 'sign').length
  let directionClause = ''
  const directionalForm = transmute ? null : form
  // Só reportar "skew" com >=2 signs (um único sign não desbalanceia de forma significativa).
  if (bias.biased && signCount >= 2) {
    directionClause = `, skewed toward ${directionLabel(bias.angle)} (unbalanced signs)`
  } else if (byKind.motion?.some((m) => m.op.directional) || directionalForm?.op?.directional) {
    directionClause = `, directed upward`
  } else if (directionalForm?.op?.defaultDirection === 'outward') {
    directionClause = `, spreading outward`
  }

  // ----- Motion (lift/float/dart) -----
  const motionClauses = (byKind.motion || []).map((m) => opVerb(m.op, m.inverted))

  // ----- Target scope -----
  const targetClause = (byKind.target || []).map((t) => opVerb(t.op, t.inverted))
  // ----- Power -----
  const powerClause = (byKind.power || []).map((p) => opVerb(p.op, p.inverted))
  // ----- Special -----
  const specialClause = (byKind.special || []).map((s) => opVerb(s.op, s.inverted))

  // Assemble summary.
  let summary = primary + directionClause
  if (motionClauses.length) summary += `; it ${joinList(motionClauses)}`
  if (specialClause.length) summary += `; it ${joinList(specialClause)}`
  if (powerClause.length) summary += `. The effect ${joinList(powerClause)}`
  if (targetClause.length) summary += `. It ${joinList(targetClause)}`
  summary = summary.replace(/\.\s*\./g, '.').trim()
  if (!/[.!?]$/.test(summary)) summary += '.'

  // ----- Per-sign breakdown (one line per kind, in pipeline order) -----
  for (const kind of KIND_ORDER) {
    for (const item of byKind[kind] || []) {
      breakdown.push({
        part: item.type,
        role: kind,
        label: (signMap[item.type]?.name || item.type) + (item.inverted ? ' (inverted)' : '') + (item.count > 1 ? ` ×${item.count}` : ''),
        text: capitalize(`the ${substance} ${opVerb(item.op, item.inverted)}.`),
      })
    }
  }

  // ----- Interactions: synergies / warnings / notes -----
  const ctx = { types, element: elementId, core: core.type }
  const notes = []
  const warnings = []
  for (const rule of g.interactions) {
    if (!interactionApplies(rule.when, ctx)) continue
    if (rule.type === 'warning') warnings.push(rule.text)
    else notes.push(rule.text)
  }

  // ----- Stability & power labels -----
  const symmetry = computeSymmetry(composition.components)
  const stability = g.stability[symmetry] || g.stability.none
  let powerLabel = g.power.balanced
  if (types.has('radial')) powerLabel = g.power.tempered
  else if (types.has('convergence')) powerLabel = g.power.focused

  return {
    ok: true,
    element: { id: elementId, substance },
    summary,
    breakdown,
    notes,
    warnings,
    stability,
    power: powerLabel,
    direction: bias.biased ? directionLabel(bias.angle) : (directionClause ? directionClause.replace(/^,\s*/, '') : 'balanced'),
  }
}

function joinList(arr) {
  const a = [...new Set(arr)]
  if (a.length <= 1) return a.join('')
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1) }
