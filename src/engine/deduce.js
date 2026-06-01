// Compositional deduction: explains what a spell does from its parts,
// grounded in data/grammar.json. The sigil gives the SUBSTANCE; each sign is an
// OPERATOR that transforms how that substance manifests.
//
// deduceWith(...) is pure (grammar + maps injected) so it can be unit-tested in
// plain Node. The app binds the real JSON via deduce() in engine/analyze.js.
// NOTE: keep this module free of JSON imports so Node can load it without import attributes.
import { computeSymmetry, computeDirectionalBias, classifyRegion, directionLabel, canSteer, canInvert } from './geometry.js'

const KIND_ORDER = ['transmute', 'form', 'motion', 'direction', 'target', 'power', 'special', 'support', 'none']

// Collapse signs into unique {type, count, inverted} entries. A sign's `inverted` flag only
// counts when its category allows inversion (directional/semi-directional); non-directional
// signs have no front to flip, so an `inverted` flag on them is ignored.
function groupSigns(components, signMap) {
  const map = new Map()
  for (const c of components) {
    if (c.role !== 'sign') continue
    const inv = !!c.inverted && canInvert(signMap[c.type]?.family)
    const key = `${c.type}|${inv ? 1 : 0}`
    if (!map.has(key)) map.set(key, { type: c.type, inverted: inv, count: 0 })
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

  // Additional sigils (mixed spells): components with role 'sigil' beyond the core.
  const extraSigils = (composition.components || []).filter((c) => c.role === 'sigil')
  const extra = extraSigils.map((c) => {
    const d = sigilMap[c.type] || signMap[c.type] || null
    const e = (d && g.elements[d.element]) || g.elements.unknown
    return { type: c.type, def: d, el: e }
  })
  // Combined substance phrase for the summary (deduped, core first).
  const substancePhrase = joinList(
    [substance, ...extra.map((x) => x.el.substance)].filter((v, i, a) => a.indexOf(v) === i),
  )

  const groups = groupSigns(composition.components, signMap)
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
  // Extra sigils each add their own substance line.
  for (const x of extra) {
    breakdown.push({
      part: x.type,
      role: 'core',
      label: x.def?.name || x.type,
      text: `Also provides the substance: ${x.el.substance} (${x.el.raw}).`,
    })
  }

  // ----- Primary clause: transmute outranks form, else raw element -----
  let primary
  const transmute = byKind.transmute?.[0]
  const form = byKind.form?.[0]
  if (transmute) {
    primary = `The ${substancePhrase} ${opVerb(transmute.op, transmute.inverted)}`
  } else if (form) {
    primary = `The ${substancePhrase} ${opVerb(form.op, form.inverted)}`
  } else {
    primary = `The ${substancePhrase} ${el.raw}`
  }

  // ----- Direction -----
  // Three separate concepts, in canon terms:
  //   region/pull (kind 'direction') — where the magic manifests, from where the signs POINT
  //     (aligned => fired that way / inward => contained / outward => outside / opposed => ring).
  //   levitation (a DIRECTIONAL motion sign) — inward or balanced => the effect floats straight
  //     up, centered ABOVE the seal; all aligned one way (air/wind case) => carried that way.
  //   column/dispersion (FORM directional) — beams ABOVE the seal by default; positional
  //     imbalance skews the beam (the Watershot lesson). "Above the seal" is the out-of-plane
  //     default, NOT a compass north — only a genuine lateral bias gets a compass label.
  const signComps = composition.components.filter((c) => c.role === 'sign')
  const familyOf = (t) => signMap[t]?.family

  const aimSigns = signComps.filter((c) => g.operators[c.type]?.kind === 'direction')
  const region = aimSigns.length ? classifyRegion(aimSigns, familyOf) : null

  const liftSigns = signComps.filter((c) => {
    const op = g.operators[c.type]
    return op?.kind === 'motion' && canSteer(familyOf(c.type))
  })
  const lift = liftSigns.length ? classifyRegion(liftSigns, familyOf) : null

  const formDirSigns = signComps.filter((c) => {
    const op = g.operators[c.type]
    return op?.kind === 'form' && op.directional
  })
  const formBalance = computeDirectionalBias(formDirSigns)
  const formBiased = formBalance.biased && formDirSigns.length >= 2

  let directionClause = ''
  let aimLabel = 'balanced'
  if (!transmute) {
    if (region) {
      if (region.mode === 'aligned') { aimLabel = directionLabel(region.angle); directionClause = `, fired ${aimLabel}` }
      else if (region.mode === 'biased') { aimLabel = directionLabel(region.angle); directionClause = `, surging ${aimLabel} (the region signs ring only one side of the seal)` }
      else if (region.mode === 'inward') { aimLabel = 'contained'; directionClause = `, contained within the ring` }
      else if (region.mode === 'outward') { aimLabel = 'outward'; directionClause = `, manifesting outside the ring` }
      else { aimLabel = 'on the ring'; directionClause = `, emerging only along the ring` }
      if (region.mode === 'aligned' && formBiased) directionClause += ` (pulled toward ${directionLabel(formBalance.angle)} by uneven signs)`
    } else if (lift) {
      if (lift.mode === 'aligned') { aimLabel = directionLabel(lift.angle); directionClause = `, carried ${aimLabel}` }
      else { aimLabel = 'above the seal'; directionClause = `, centered above the seal` }
    } else if (form?.op?.directional) {
      if (formBiased) { aimLabel = directionLabel(formBalance.angle); directionClause = `, skewed toward ${aimLabel} (unbalanced signs)` }
      else { aimLabel = 'above the seal'; directionClause = `, above the seal` }
    } else if (form?.op?.defaultDirection === 'outward') {
      aimLabel = 'outward'; directionClause = `, spreading outward`
    }
  }

  // ----- Motion (lift/float/dart) -----
  const motionClauses = (byKind.motion || []).map((m) => opVerb(m.op, m.inverted))

  // ----- Support (collection/gather: feed the spell) -----
  const supportClause = (byKind.support || []).map((s) => opVerb(s.op, s.inverted))
  // ----- Target scope -----
  const targetClause = (byKind.target || []).map((t) => opVerb(t.op, t.inverted))
  // ----- Power -----
  const powerClause = (byKind.power || []).map((p) => opVerb(p.op, p.inverted))
  // ----- Special -----
  const specialClause = (byKind.special || []).map((s) => opVerb(s.op, s.inverted))

  // Assemble summary.
  let summary = primary + directionClause
  if (motionClauses.length) summary += `; it ${joinList(motionClauses)}`
  if (supportClause.length) summary += `; it ${joinList(supportClause)}`
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
        text: capitalize(`the ${substancePhrase} ${opVerb(item.op, item.inverted)}.`),
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
    direction: aimLabel,
  }
}

function joinList(arr) {
  const a = [...new Set(arr)]
  if (a.length <= 1) return a.join('')
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1) }
