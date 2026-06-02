// Smoke tests for the compiler tools added in the AI-core re-architecture:
//   - spell-engine-cli.mjs --facts  → structured, engine-observable facts (not prose authority)
//   - render.mjs                     → IR → SVG (the AI→human half of the compiler)
// These spawn the real tools over a small composition and assert the shape of their output.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(root, 'tools/spell-engine-cli.mjs')
const renderer = resolve(root, 'tools/render.mjs')

// Watershot-shaped composition: water core + two inward columns.
const spell = JSON.stringify({
  name: 'Smoke Test Jet',
  ring: { closed: true },
  core: { id: 'c0', type: 'water', x: 0, y: 0, rotation: 0, scale: 1, inverted: false },
  components: [
    { id: 's0', type: 'column', role: 'sign', x: 0, y: -150, rotation: 0, scale: 1, inverted: false },
    { id: 's1', type: 'column', role: 'sign', x: 0, y: 150, rotation: 180, scale: 1, inverted: false },
  ],
  linkCount: 0, dyes: [],
})

const run = (cmd, args) => execFileSync('node', [cmd, ...args], { input: spell, encoding: 'utf8' })

test('--facts emits structured, engine-observable facts (no authoritative effect)', () => {
  const facts = JSON.parse(run(cli, ['--facts']))
  assert.equal(facts.valid, true)
  assert.equal(facts.circleCount, 1)
  const c = facts.circles[0]
  assert.equal(c.core.id, 'water')
  assert.equal(c.core.element, 'water')
  // column is a `form` operator — the fact extractor exposes the kind, not an effect verdict.
  assert.deepEqual(c.operatorsByKind.form, ['column'])
  assert.equal(c.signs.find((s) => s.id === 'column').count, 2)
  assert.ok(c.geometry.symmetry) // geometry observed
  // The prose is explicitly demoted to a heuristic scaffold.
  assert.ok('heuristicSummary' in c)
  assert.match(facts.note, /non-authoritative|heuristic/i)
})

test('render.mjs turns the IR into a self-contained SVG', () => {
  const svg = run(renderer, [])
  assert.match(svg, /<svg[\s>]/)
  assert.match(svg, /viewBox="/)
  assert.match(svg, /<\/svg>/)
  // core + 2 columns ⇒ at least 3 drawn glyph paths.
  assert.ok((svg.match(/<path/g) || []).length >= 3)
})
