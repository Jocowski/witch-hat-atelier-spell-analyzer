// Multi-circle composition (wha-spell@2). A spell is one or more CIRCLES (each circle is a
// self-contained single-ring seal — the old wha-spell@1 shape) plus a RELATIONS graph that
// nests circles inside one another and links circles/components together.
//
// This module is PURE (no JSON imports) so it runs under plain `node --test`. The orchestrators
// (engine/analyze.js, tools/spell-engine-cli.mjs) inject the data maps. Keep it JSON-free.
//
// v2 shape:
//   { format:'wha-spell@2', name, circles:[ { id, center:{x,y}, radius?, ring:{closed,size?},
//       core, components:[...], dyes:[...], linkCount?, name? } ], relations:[ ... ] }
//   relations: { type:'nest', outer:<circleId>, inner:<circleId> }
//            | { type:'link', a:<circleId|componentId>, b:<circleId|componentId> }
// Each circle's component coords are relative to THAT circle's center, so the per-circle
// geometry (geometry.js) is reused unchanged.

import { computeSymmetry, computeDirectionalBias, classifyRegion, computePower, directionLabel, canSteer, canInvert, computeSpin, classifyZone, anchorToXY } from './geometry.js'
import { deduceWith } from './deduce.js'

// A ring-anchored component (anchor.ring) gets its x,y from the circle radius so it tracks the
// ring; the resolved x,y is what geometry/zone/deduction read. The anchor itself round-trips.
function resolveAnchored(components, radius) {
  return (components || []).map((c) =>
    c.anchor?.ring ? { ...c, ...anchorToXY(c.anchor.angle || 0, c.anchor.offset || 0, radius) } : c,
  )
}

// ---------- Normalize / migrate any input to the v2 shape ----------
function normalizeCircle(c, i) {
  const radius = c.radius ?? null
  return {
    id: c.id || `k${i}`,
    name: c.name || '',
    center: c.center || { x: 0, y: 0 },
    radius,
    ring: c.ring || { closed: false },
    core: c.core || null,
    components: resolveAnchored(c.components, radius),
    dyes: c.dyes || [],
    linkCount: c.linkCount || 0,
    inkColor: c.inkColor || null, // display-only: tints the ring; ignored by deduction
  }
}

// Accepts a v2 object ({circles,relations}) OR a v1 composition (core/components/ring) and
// returns the canonical v2 form { name, circles[], relations[] }. v1 becomes one circle.
export function toComposition(input) {
  const src = input || {}
  if (Array.isArray(src.circles)) {
    return {
      name: src.name || '',
      circles: src.circles.map(normalizeCircle),
      relations: Array.isArray(src.relations) ? src.relations : [],
    }
  }
  return {
    name: src.name || '',
    circles: [normalizeCircle({
      id: 'k0',
      ring: src.ring,
      core: src.core,
      components: src.components,
      dyes: src.dyes,
      linkCount: src.linkCount,
    }, 0)],
    relations: [],
  }
}

// ---------- Per-circle analysis (the single-ring pipeline), data injected ----------
// deps = { grammar, sigilMap, signMap, dyeMap }. Returns one circle's structured analysis.
export function analyzeCircleWith(deps, circle) {
  const { grammar, sigilMap, signMap, dyeMap, zones } = deps
  const getDef = (t) => sigilMap[t] || signMap[t] || null
  const isSigil = (t) => !!sigilMap[t]
  const canCenter = (t) => !!signMap[t]?.canBeCenter

  const core = circle.core || null
  // Tag every component with its ring zone (inside | ring | outside). Outside signs are
  // external marks/protrusions: they still appear in the signs list and deduction, but they
  // must NOT skew the inside-ring aim/symmetry/balance (geometry below uses ring-only signs).
  const components = (circle.components || []).map((c) => ({ ...c, zone: classifyZone(c.x, c.y, circle.radius, zones) }))
  const signComps = components.filter((c) => c.role === 'sign')
  const ringSignComps = signComps.filter((c) => c.zone !== 'outside')
  const sigilComps = [
    ...(core ? [{ ...core, role: 'core' }] : []),
    ...components.filter((c) => c.role === 'sigil').map((c) => ({ ...c, role: 'sigil' })),
  ]

  const hasCore = !!(core && (isSigil(core.type) || canCenter(core.type)))
  const ringClosed = !!circle.ring?.closed

  // ----- Geometry (inside-ring signs only; outside marks don't steer the spell) -----
  const ringComps = components.filter((c) => c.zone !== 'outside')
  const symmetry = computeSymmetry(ringComps)
  const power = computePower(components, { linkCount: circle.linkCount || 0 })
  // AIM (where the magic goes) from sign ORIENTATION; "above the seal" is the out-of-plane
  // default for a column beam / levitation lift — not compass north.
  const familyOf = (t) => signMap[t]?.family
  // SPIN: only signs canted tangentially off their radial axis spin the spell. A ring of
  // signs aimed inward/outward is oriented, not spinning (so a normal inward-facing ring
  // like the Pyreball Seal must NOT read as "tilted → spin").
  const tilted = computeSpin(ringComps, familyOf).spinning
  const aimSigns = ringSignComps.filter((c) => grammar.operators[c.type]?.kind === 'direction')
  const region = aimSigns.length ? classifyRegion(aimSigns, familyOf) : null
  const liftSigns = ringSignComps.filter((c) => {
    const op = grammar.operators[c.type]
    return op?.kind === 'motion' && canSteer(familyOf(c.type))
  })
  const lift = liftSigns.length ? classifyRegion(liftSigns, familyOf) : null
  const formDirSigns = ringSignComps.filter((c) => {
    const op = grammar.operators[c.type]
    return op?.kind === 'form' && op.directional
  })
  const formBalance = computeDirectionalBias(formDirSigns)
  const formBiased = formBalance.biased && formDirSigns.length >= 2
  let aimLabel = null
  if (region) {
    aimLabel = region.mode === 'aligned' ? directionLabel(region.angle)
      : region.mode === 'biased' ? `surging ${directionLabel(region.angle)} (uneven region ring)`
      : region.mode === 'inward' ? 'contained within the ring'
      : region.mode === 'outward' ? 'outside the ring'
      : 'along the ring'
  } else if (lift) {
    aimLabel = lift.mode === 'aligned' ? directionLabel(lift.angle) : 'above the seal'
  } else if (formBiased) {
    aimLabel = directionLabel(formBalance.angle)
  } else if (formDirSigns.length) {
    aimLabel = 'above the seal'
  }

  // ----- Validity -----
  const issues = []
  if (!hasCore) issues.push({ severity: 'blocking', message: 'No core: place a sigil (or a sign that can occupy the center) so the seal has a substance.' })
  if (ringClosed && !hasCore && signComps.length === 0) issues.push({ severity: 'warning', message: 'A closed ring with nothing inside discharges raw energy — an explosion.' })
  if (hasCore && signComps.length === 0) issues.push({ severity: 'warning', message: 'No signs around the core: the element has no defined form (raw, undirected discharge).' })
  if (signComps.length >= 2) {
    if (symmetry === 'asymmetric') issues.push({ severity: 'warning', message: 'Asymmetric signs — the spell may be unstable. At least bilateral symmetry is recommended for stability.' })
    else issues.push({ severity: 'info', message: `Stable: ${symmetry} symmetry.` })
  }
  if (formBiased) issues.push({ severity: 'info', message: `Unbalanced projection signs: the beam skews ${directionLabel(formBalance.angle)} (bigger/more column signs pull it that way).` })
  else if (aimLabel) issues.push({ severity: 'info', message: `Aim: the effect manifests ${aimLabel} (from the directional signs).` })
  if (tilted) issues.push({ severity: 'info', message: 'Some signs are tilted — tilting signs makes the spell spin (more tilt = more spin, but less reach).' })
  const outsideCount = signComps.filter((c) => c.zone === 'outside').length
  if (outsideCount) issues.push({ severity: 'info', message: `${outsideCount} external mark${outsideCount > 1 ? 's' : ''} outside the ring — framing only; they don't steer the spell.` })

  // ----- Sigils -----
  const sigils = sigilComps.map((c) => {
    const d = getDef(c.type)
    return { id: c.type, name: d?.name || c.type, role: c.role, family: d?.family || null, element: d?.element || null, description: d?.description || '' }
  })

  // ----- Signs (grouped by type + inversion; inversion only counts when the category allows it) -----
  const grouped = new Map()
  for (const c of signComps) {
    const inv = !!c.inverted && canInvert(signMap[c.type]?.family)
    const key = c.type + (inv ? '!inv' : '')
    if (!grouped.has(key)) grouped.set(key, { type: c.type, inverted: inv, count: 0 })
    grouped.get(key).count++
  }
  const signs = [...grouped.values()].map((g) => {
    const d = signMap[g.type]
    return { id: g.type, name: d?.name || g.type, category: d?.family || 'other', effect: d?.effect || '', count: g.count, inverted: g.inverted, invertible: canInvert(d?.family) }
  })

  // ----- Deduced effect (a circle is a v1-shaped composition; pass zone-tagged components) -----
  const deduction = hasCore ? deduceWith(grammar, sigilMap, signMap, { ...circle, components }) : null

  // ----- Dyes -----
  const dyes = (circle.dyes || []).map((id) => dyeMap[id]).filter(Boolean)
    .map((d) => ({ id: d.id, name: d.name, effect: d.effect, kind: d.kind, color: d.color }))

  // ----- Other info -----
  const types = new Set(signComps.map((c) => c.type))
  let powerLabel = grammar.power.balanced
  if (types.has('radial')) powerLabel = grammar.power.tempered
  else if (types.has('convergence')) powerLabel = grammar.power.focused
  else if (power > 1.3 || (circle.linkCount || 0) > 0) powerLabel = grammar.power.amplified

  const analysis = {
    symmetry,
    stability: grammar.stability[symmetry] || grammar.stability.none,
    balance: formBiased ? `skewed ${directionLabel(formBalance.angle)}` : 'balanced',
    aim: aimLabel || 'undirected',
    power,
    powerLabel,
    tilted,
    inverted: signs.some((s) => s.inverted),
    decorative: sigils.some((s) => s.family === 'decorative'),
    sigilCount: sigils.length,
    signCount: signComps.length,
    linkCount: circle.linkCount || 0,
  }

  return { id: circle.id, name: circle.name || '', valid: hasCore, hasCore, active: hasCore && ringClosed, ringClosed, issues, sigils, signs, deduction, dyes, analysis }
}

// ---------- Combine per-circle results along the relations graph ----------
// Nesting: an inner circle's effect is wrapped by its outer circle; canon says the inner only
// contributes when the outer ring is closed (magic.md, Nested Glyphs) — surfaced as a note,
// not an active/inactive verdict. Links: connected seals' effects combine.
export function composeWith(grammar, relations, circles) {
  const byId = Object.fromEntries(circles.map((c) => [c.id, c]))
  const rels = Array.isArray(relations) ? relations : []
  const nests = rels.filter((r) => r.type === 'nest' && byId[r.outer] && byId[r.inner])
  const links = rels.filter((r) => r.type === 'link')

  const outerOf = {}
  const innersOf = {}
  for (const n of nests) {
    outerOf[n.inner] = n.outer
    ;(innersOf[n.outer] ||= []).push(n.inner)
  }
  const roots = circles.filter((c) => !outerOf[c.id])
  const label = (c) => c.name || c.id
  const effect = (c) => c.deduction?.summary || '(no defined effect)'
  // A seal's "shape" = its core element + its multiset of sign ids (for the identical-linked rule).
  const sigOf = (c) => {
    const coreEl = (c.sigils || []).find((s) => s.role === 'core')?.element || (c.sigils || [])[0]?.element || '?'
    const signs = (c.signs || []).flatMap((s) => Array(s.count).fill(s.id)).sort().join(',')
    return `${coreEl}|${signs}`
  }

  const notes = []
  // Recursively narrate a circle and everything nested inside it (outer-first, inner folded in).
  function describe(c, seen = new Set()) {
    if (seen.has(c.id)) return effect(c) // guard against cyclic nesting
    seen.add(c.id)
    const inners = (innersOf[c.id] || []).map((id) => byId[id]).filter(Boolean)
    let s = effect(c)
    if (inners.length) {
      // Nested-glyph rule (magic.md): the inner seal only takes effect once the outer ring is closed.
      if (!c.ringClosed) notes.push(`The seal(s) nested inside ${label(c)} take effect only once its outer ring is closed (nested-glyph rule).`)
      const innerText = inners.map((ic) => describe(ic, seen)).join('; and ')
      const base = s.replace(/\.\s*$/, '') // drop the trailing period before continuing the sentence
      s = `${base}, and nested within it ${inners.map(label).join(', ')}: ${innerText}`
    }
    return s
  }

  const rootText = roots.map((r) => describe(r))
  let summary = rootText.join('. ')

  // Links (magic.md): connected seals combine; several IDENTICAL linked seals stack power
  // beyond what one larger seal of the same area could do.
  for (const l of links) {
    const a = byId[l.a]
    const b = byId[l.b]
    const an = a ? label(a) : l.a
    const bn = b ? label(b) : l.b
    if (a && b && sigOf(a) === sigOf(b)) {
      notes.push(`${an} and ${bn} are identical seals linked by a line — identical linked seals stack power (their combined strength exceeds a single larger seal of the same area).`)
    } else {
      notes.push(`${an} and ${bn} are linked by a line — their effects combine.`)
    }
  }
  if (summary && !/[.!?]$/.test(summary)) summary += '.'

  return { ok: true, summary, roots: roots.map((r) => r.id), nesting: nests, links, notes }
}
