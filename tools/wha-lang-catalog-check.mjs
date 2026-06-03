// Catalog-reconstruction harness: rebuild every catalog spell through wha-lang and
// validate the emitted IR through the real engine. Surfaces expressiveness gaps
// (unknown types, divisibility, surround/center handling, capability errors).
//
//   node tools/wha-lang-catalog-check.mjs
//
// Each catalog `composition` is the matcher's FLATTENED model (core + sign multiset),
// so we reconstruct each as a single circle: signs at SURROUND if surrounds:true,
// else at RING (even). The point is to prove wha-lang can EXPRESS each spell's parts
// and yield a valid engine result with no unknownIds — not to reproduce exact geometry.

import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { SPELL, CIRCLE, SIGIL, SIGN, RING, SURROUND, IN, __resetIds } from './wha-lang.mjs'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rules = require(resolve(root, 'data/rules.json'))
const grammar = require(resolve(root, 'data/grammar.json'))
const sigilsDoc = require(resolve(root, 'data/sigils.json'))
const signsDoc = require(resolve(root, 'data/signs.json'))
const dyesDoc = require(resolve(root, 'data/dyes.json'))
const spellsDoc = require(resolve(root, 'data/spells.json'))

const importLocal = (rel) => import(pathToFileURL(resolve(root, rel)).href)
const compose = await importLocal('src/engine/compose.js')
const { toComposition, analyzeCircleWith, composeWith, reclassifyCorelessCircles } = compose

const SIGIL_MAP = Object.fromEntries(sigilsDoc.sigils.map((s) => [s.id, s]))
const SIGN_MAP = Object.fromEntries(signsDoc.signs.map((s) => [s.id, s]))
const DYE_MAP = Object.fromEntries((dyesDoc.dyes || []).map((d) => [d.id, d]))
const deps = { grammar, sigilMap: SIGIL_MAP, signMap: SIGN_MAP, dyeMap: DYE_MAP, zones: rules.zones }
const getDef = (t) => SIGIL_MAP[t] || SIGN_MAP[t] || null

function facts(input) {
  const norm = toComposition(input.composition || input)
  const per = norm.circles.map((c) => analyzeCircleWith(deps, c))
  if (per.length > 1) reclassifyCorelessCircles(per, norm.relations)
  const valid = per.every((p) => p.valid)
  const unknownIds = []
  for (const c of norm.circles) {
    if (c.core && !getDef(c.core.type)) unknownIds.push(`core:${c.core.type}`)
    for (const comp of c.components || []) if (!getDef(comp.type)) unknownIds.push(`${comp.role}:${comp.type}`)
  }
  const ops = new Set()
  for (const c of per) for (const s of c.signs || []) ops.add(s.id)
  return { valid, unknownIds, ops }
}

export function checkCatalog() {
const spells = spellsDoc.spells
let ok = 0
const gaps = []

for (const sp of spells) {
  __resetIds()
  const c = sp.composition || {}
  try {
    const coreId = c.core
    const core = coreId ? (SIGIL_MAP[coreId] ? SIGIL(coreId) : SIGN(coreId)) : undefined
    const children = (c.signs || []).map((s) => {
      const def = SIGN_MAP[s.id] || SIGIL_MAP[s.id]
      const surrounds = def && def.surrounds
      const opts = { inverted: !!s.inverted }
      opts.at = surrounds ? SURROUND : RING
      if (!surrounds) opts.face = IN
      return SIGN(s.id, s.count || 1, opts)
    })
    const circle = CIRCLE('k', core ? { core } : {}, ...children)
    const ir = SPELL(sp.name).stack(circle).emit()
    const f = facts(ir)
    const expected = (c.signs || []).map((s) => s.id)
    const missing = expected.filter((id) => !f.ops.has(id))
    if (!f.valid) gaps.push([sp.name, 'INVALID engine result'])
    else if (f.unknownIds.length) gaps.push([sp.name, 'unknownIds: ' + f.unknownIds.join(', ')])
    else if (missing.length) gaps.push([sp.name, 'signs dropped: ' + missing.join(', ')])
    else ok++
  } catch (e) {
    gaps.push([sp.name, 'THROW: ' + e.message])
  }
}

  return { ok, total: spells.length, gaps }
}

// CLI: run directly with `node tools/wha-lang-catalog-check.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, total, gaps } = checkCatalog()
  console.log(`\nReconstructed ${ok}/${total} catalog spells through wha-lang.`)
  if (gaps.length) {
    console.log(`\nGAPS (${gaps.length}):`)
    for (const [name, why] of gaps) console.log(`  - ${name}: ${why}`)
    process.exitCode = 1
  } else {
    console.log('No gaps — wha-lang expresses every catalog spell.')
  }
}
