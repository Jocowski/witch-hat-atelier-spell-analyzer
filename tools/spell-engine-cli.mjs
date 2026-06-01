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
const { deduceWith } = await importLocal('src/engine/deduce.js')
const { computeSymmetry, computeDirectionalBias, classifyRegion, computePower, directionLabel, canSteer, canInvert } =
  await importLocal('src/engine/geometry.js')

const SIGIL_MAP = Object.fromEntries(sigilsDoc.sigils.map((s) => [s.id, s]))
const SIGN_MAP = Object.fromEntries(signsDoc.signs.map((s) => [s.id, s]))
const DYE_MAP = Object.fromEntries((dyesDoc.dyes || []).map((d) => [d.id, d]))
const SPELLS = spellsDoc.spells || []

const getDef = (type) => SIGIL_MAP[type] || SIGN_MAP[type] || null
const isSigilType = (type) => Boolean(SIGIL_MAP[type])
const signCanBeCenter = (type) => Boolean(SIGN_MAP[type]?.canBeCenter)

function analyze(composition) {
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

  const symmetry = computeSymmetry(components)
  const power = computePower(components, { linkCount: comp.linkCount || 0 })
  const tilted = signComps.some((c) => (((c.rotation || 0) % 360) + 360) % 360 !== 0)

  // AIM (where the magic goes) comes from the ORIENTATION of directional signs; BALANCE
  // (positional skew of column signs) is a deflection matter. "Above the seal" is the
  // out-of-plane default for a column beam / levitation lift — not compass north.
  const familyOf = (t) => SIGN_MAP[t]?.family
  const aimSigns = signComps.filter((c) => grammar.operators[c.type]?.kind === 'direction')
  const region = aimSigns.length ? classifyRegion(aimSigns, familyOf) : null
  const liftSigns = signComps.filter((c) => {
    const op = grammar.operators[c.type]
    return op?.kind === 'motion' && canSteer(familyOf(c.type))
  })
  const lift = liftSigns.length ? classifyRegion(liftSigns, familyOf) : null
  const formDirSigns = signComps.filter((c) => {
    const op = grammar.operators[c.type]
    return op?.kind === 'form' && op.directional
  })
  const formBalance = computeDirectionalBias(formDirSigns)
  const formBiased = formBalance.biased && formDirSigns.length >= 2
  let aimLabel = null
  if (region) {
    aimLabel = region.mode === 'aligned' ? directionLabel(region.angle)
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

  const valid = hasCore
  const status = hasCore ? { class: 'ok', text: 'Valid' } : { class: 'invalid', text: 'Invalid — no core' }

  const sigils = sigilComps.map((c) => {
    const d = getDef(c.type)
    return { id: c.type, name: d?.name || c.type, role: c.role, family: d?.family || null, element: d?.element || null, description: d?.description || '' }
  })

  const grouped = new Map()
  for (const c of signComps) {
    const inv = !!c.inverted && canInvert(SIGN_MAP[c.type]?.family)
    const key = c.type + (inv ? '!inv' : '')
    if (!grouped.has(key)) grouped.set(key, { type: c.type, inverted: inv, count: 0 })
    grouped.get(key).count++
  }
  const signs = [...grouped.values()].map((g) => {
    const d = SIGN_MAP[g.type]
    return { id: g.type, name: d?.name || g.type, category: d?.family || 'other', effect: d?.effect || '', count: g.count, inverted: g.inverted, invertible: canInvert(d?.family) }
  })

  const deduction = hasCore ? deduceWith(grammar, SIGIL_MAP, SIGN_MAP, composition) : null

  const dyes = (comp.dyes || []).map((id) => DYE_MAP[id]).filter(Boolean)
    .map((d) => ({ id: d.id, name: d.name, effect: d.effect, kind: d.kind, color: d.color }))

  const types = new Set(signComps.map((c) => c.type))
  let powerLabel = grammar.power.balanced
  if (types.has('radial')) powerLabel = grammar.power.tempered
  else if (types.has('convergence')) powerLabel = grammar.power.focused
  else if (power > 1.3 || (comp.linkCount || 0) > 0) powerLabel = grammar.power.amplified

  const analysisInfo = {
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
    linkCount: comp.linkCount || 0,
  }

  return { name: comp.name || '', valid, status, issues, sigils, signs, deduction, dyes, analysis: analysisInfo, catalogEmpty: SPELLS.length === 0 }
}

// ---------- Unknown id detection (helps catch typos before deducing) ----------
function unknownIds(composition) {
  const comp = composition || {}
  const unknown = []
  if (comp.core && !getDef(comp.core.type)) unknown.push({ where: 'core', type: comp.core.type })
  for (const c of comp.components || []) {
    if (!getDef(c.type)) unknown.push({ where: c.role || 'component', type: c.type })
  }
  return unknown
}

// ---------- Human-readable rendering ----------
function toText(r) {
  const L = []
  L.push(`# ${r.name || '(unnamed spell)'}`)
  L.push(`Status: ${r.status.text}  |  valid=${r.valid}`)
  L.push('')
  if (r.issues.length) {
    L.push('## Validity')
    for (const i of r.issues) L.push(`- [${i.severity}] ${i.message}`)
    L.push('')
  }
  if (r.sigils.length) {
    L.push('## Sigils (substance)')
    for (const s of r.sigils) L.push(`- ${s.name} (${s.role}, family=${s.family}, element=${s.element})`)
    L.push('')
  }
  if (r.signs.length) {
    L.push('## Signs (operators)')
    for (const s of r.signs) L.push(`- ${s.name}${s.inverted ? ' (inverted)' : ''}${s.count > 1 ? ` ×${s.count}` : ''} — ${s.category}`)
    L.push('')
  }
  if (r.deduction?.ok) {
    L.push('## Deduced effect')
    L.push(r.deduction.summary)
    L.push('')
    if (r.deduction.breakdown?.length) {
      L.push('Breakdown:')
      for (const b of r.deduction.breakdown) L.push(`- ${b.label}: ${b.text}`)
      L.push('')
    }
    if (r.deduction.notes?.length) { L.push('Notes:'); for (const n of r.deduction.notes) L.push(`- ${n}`); L.push('') }
    if (r.deduction.warnings?.length) { L.push('Warnings:'); for (const w of r.deduction.warnings) L.push(`- ${w}`); L.push('') }
  }
  if (r.dyes.length) {
    L.push('## Dyes')
    for (const d of r.dyes) L.push(`- ${d.name}: ${d.effect}`)
    L.push('')
  }
  L.push('## Other')
  const a = r.analysis
  L.push(`stability=${a.stability} | aim=${a.aim} | balance=${a.balance} | power=${a.power} (${a.powerLabel}) | symmetry=${a.symmetry}`)
  L.push(`sigils=${a.sigilCount} signs=${a.signCount} links=${a.linkCount}`)
  return L.join('\n')
}

// ---------- Entry ----------
function main() {
  const args = process.argv.slice(2)
  const textMode = args.includes('--text')
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

  if (textMode) {
    if (unknown.length) {
      console.log('!! Unknown ids (typos?): ' + unknown.map((u) => `${u.type}@${u.where}`).join(', ') + '\n')
    }
    console.log(toText(result))
  } else {
    console.log(JSON.stringify(result, null, 2))
  }
}

main()
