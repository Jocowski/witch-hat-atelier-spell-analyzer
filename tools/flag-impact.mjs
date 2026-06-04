// flag-impact.mjs — symbol-lifecycle impact checker (SPEC-symbol-versioning.md, Fase 1).
//
// Builds the dependency graph from data/{sigils,signs,spells}.json and reports which catalog spells
// depend on a symbol that is NOT `stable` — i.e. needs human re-review after a canon change. Symbols
// carry an optional `lifecycle` block ({ status, rev, ... }); absent ⇒ treated as stable.
//
//   node tools/flag-impact.mjs            # report (default). Exit 1 only if a spell references a
//                                         #   `removed` symbol (a real integrity break).
//   node tools/flag-impact.mjs --check    # same as default, for CI / pre-commit.
//   node tools/flag-impact.mjs --write    # also stamp lifecycle.flag onto stale spells in spells.json.
//
// Status meanings: stable | unverified | revised | deprecated | removed (see the spec).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = (p) => JSON.parse(readFileSync(join(root, 'data', p), 'utf8'))

const sigils = load('sigils.json')
const signs = load('signs.json')
const spellsDoc = load('spells.json')

const sigilList = Array.isArray(sigils) ? sigils : sigils.sigils || []
const signList = Array.isArray(signs) ? signs : signs.signs || []
const spells = Array.isArray(spellsDoc) ? spellsDoc : spellsDoc.spells || []

// symbol id → { status, rev, name, kind }
const symbolMap = new Map()
for (const s of [...sigilList, ...signList]) {
  const lc = s.lifecycle || {}
  symbolMap.set(s.id, {
    status: lc.status || 'stable',
    rev: lc.rev ?? 1,
    name: s.name || s.id,
    kind: sigilList.includes(s) ? 'sigil' : 'sign',
  })
}

// Collect the symbol ids a catalog spell depends on (core + signs).
function depsOf(spell) {
  const c = spell.composition || {}
  const ids = new Set()
  if (c.core) ids.add(c.core)
  for (const s of c.signs || []) if (s.id) ids.add(s.id)
  return [...ids]
}

const NON_STABLE = new Set(['unverified', 'revised', 'deprecated', 'removed'])

const stale = []
let hardBreak = false
for (const spell of spells) {
  const flaggedDeps = []
  for (const id of depsOf(spell)) {
    const sym = symbolMap.get(id)
    if (!sym) { flaggedDeps.push({ id, status: 'missing' }); hardBreak = true; continue }
    if (sym.status === 'removed') hardBreak = true
    if (sym.status === 'missing' || NON_STABLE.has(sym.status)) {
      flaggedDeps.push({ id, status: sym.status, rev: sym.rev })
    }
  }
  if (flaggedDeps.length) stale.push({ spell, flaggedDeps })
}

// ── report ──
const args = new Set(process.argv.slice(2))
const write = args.has('--write')

console.log(`flag:impact — ${spells.length} catalog spells, ${symbolMap.size} symbols`)
const nonStableSyms = [...symbolMap.entries()].filter(([, v]) => NON_STABLE.has(v.status))
if (nonStableSyms.length) {
  console.log(`\nNon-stable symbols (${nonStableSyms.length}):`)
  for (const [id, v] of nonStableSyms) console.log(`  · ${id} [${v.status}] rev ${v.rev}`)
} else {
  console.log('\nAll symbols are stable.')
}

if (stale.length === 0) {
  console.log('\n✅ No catalog spell depends on a non-stable symbol. Nothing to flag.')
} else {
  console.log(`\n⚠ ${stale.length} spell(s) depend on non-stable symbols:`)
  for (const { spell, flaggedDeps } of stale) {
    const reason = flaggedDeps.map((d) => `${d.id}[${d.status}]`).join(', ')
    console.log(`  · ${spell.id || spell.name} ← ${reason}`)
  }
}

if (write && stale.length) {
  const today = new Date().toISOString().slice(0, 10)
  for (const { spell, flaggedDeps } of stale) {
    spell.lifecycle = spell.lifecycle || {}
    spell.lifecycle.status = 'unverified'
    spell.lifecycle.flag = {
      reason: `depends on changed symbol(s): ${flaggedDeps.map((d) => d.id).join(', ')}`,
      since: today,
      by: 'flag:impact',
    }
  }
  // Preserve the top-level shape (array vs { spells: [...] }).
  const out = Array.isArray(spellsDoc) ? spells : { ...spellsDoc, spells }
  writeFileSync(join(root, 'data', 'spells.json'), JSON.stringify(out, null, 2) + '\n')
  console.log(`\n📝 Stamped lifecycle.flag on ${stale.length} spell(s) in data/spells.json.`)
}

// Exit non-zero only on a true integrity break (missing or removed dependency).
if (hardBreak) {
  console.error('\n❌ A spell references a missing/removed symbol — fix before shipping.')
  process.exit(1)
}
