// Integration tests for the catalog matcher. The matcher (buildSignature / matchSpell /
// computeSimilar) lives in src/engine/analyze.js, which imports JSON the Vite way and so
// cannot be loaded under plain `node --test`. The CLI (tools/spell-engine-cli.mjs) carries
// a synced port, so we exercise the matcher end-to-end through the CLI instead — which also
// guards the engine/CLI sync the repo requires.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const CLI = resolve(root, 'tools/spell-engine-cli.mjs')

function runCli(input) {
  const out = execFileSync('node', [CLI], { input: JSON.stringify(input), encoding: 'utf8' })
  return JSON.parse(out)
}

test('single-circle: a water core ringed by Column signs matches the Watershot Seal', () => {
  const r = runCli({
    name: 'test',
    ring: { closed: true },
    core: { id: 'c0', type: 'water', x: 0, y: 0 },
    components: [0, 90, 180, 270].map((a, i) => ({
      id: `s${i}`, type: 'column', role: 'sign',
      x: 150 * Math.sin((a * Math.PI) / 180), y: -150 * Math.cos((a * Math.PI) / 180),
      rotation: 0, scale: 1, inverted: false,
    })),
  })
  assert.ok(r.similar.match, 'expected a catalog match')
  // Several canon spells are water + a ring of Columns (Watershot, Rising Platform, …);
  // any of them is a correct single-circle match — assert it landed on one of them.
  assert.ok(
    ['Watershot Seal', 'Rising Platform of Water'].includes(r.similar.match.name),
    `unexpected match: ${r.similar.match.name}`,
  )
})

// ----- L6 Orb-container: Water Orb catalog verification (SPEC-orb-container §L6) -----
// Exercises the full pipeline: compose → CLI analyze → deduction + catalog match.
// The composition mirrors data/spells.json water_orb: water core + orb×4 around + column×2 sides.
test('Water Orb: deduced effect mentions sphere and filling bottom-to-top', () => {
  const r = runCli({
    name: 'Water Orb',
    ring: { closed: true },
    core: { id: 'c0', type: 'water', x: 0, y: 0 },
    components: [
      // 4 orbs equally around the ring
      { id: 'o1', type: 'orb', role: 'sign', x: 0,    y: -150, rotation: 0,   scale: 1 },
      { id: 'o2', type: 'orb', role: 'sign', x: 150,  y: 0,    rotation: 90,  scale: 1 },
      { id: 'o3', type: 'orb', role: 'sign', x: 0,    y: 150,  rotation: 180, scale: 1 },
      { id: 'o4', type: 'orb', role: 'sign', x: -150, y: 0,    rotation: 270, scale: 1 },
      // 2 opposing inward columns (east/west sides)
      { id: 'c1', type: 'column', role: 'sign', x: 150,  y: 0, rotation: 90,  scale: 1 },
      { id: 'c2', type: 'column', role: 'sign', x: -150, y: 0, rotation: 270, scale: 1 },
    ],
  })
  const summary = r.deduction?.summary ?? r.combined?.summary ?? ''
  // Container clause: substance gathers into a sphere, filling bottom-to-top
  assert.match(summary, /sphere/i, `deduction summary should mention sphere; got: "${summary}"`)
  assert.match(
    summary,
    /filling bottom-to-top/i,
    `deduction summary should mention "filling bottom-to-top"; got: "${summary}"`,
  )
})

test('Water Orb: catalog match returns water_orb as the top hit', () => {
  const r = runCli({
    name: 'Water Orb',
    ring: { closed: true },
    core: { id: 'c0', type: 'water', x: 0, y: 0 },
    components: [
      { id: 'o1', type: 'orb', role: 'sign', x: 0,    y: -150, rotation: 0,   scale: 1 },
      { id: 'o2', type: 'orb', role: 'sign', x: 150,  y: 0,    rotation: 90,  scale: 1 },
      { id: 'o3', type: 'orb', role: 'sign', x: 0,    y: 150,  rotation: 180, scale: 1 },
      { id: 'o4', type: 'orb', role: 'sign', x: -150, y: 0,    rotation: 270, scale: 1 },
      { id: 'c1', type: 'column', role: 'sign', x: 150,  y: 0, rotation: 90,  scale: 1 },
      { id: 'c2', type: 'column', role: 'sign', x: -150, y: 0, rotation: 270, scale: 1 },
    ],
  })
  assert.ok(r.similar.match, 'expected a catalog match for the Water Orb composition')
  assert.equal(
    r.similar.match.name,
    'Water Orb',
    `expected top catalog match to be "Water Orb", got "${r.similar.match.name}"`,
  )
})

test('Water Orb: deduction direction is "contained sphere", not a lateral jet', () => {
  const r = runCli({
    name: 'Water Orb',
    ring: { closed: true },
    core: { id: 'c0', type: 'water', x: 0, y: 0 },
    components: [
      { id: 'o1', type: 'orb', role: 'sign', x: 0,    y: -150, rotation: 0,   scale: 1 },
      { id: 'o2', type: 'orb', role: 'sign', x: 150,  y: 0,    rotation: 90,  scale: 1 },
      { id: 'o3', type: 'orb', role: 'sign', x: 0,    y: 150,  rotation: 180, scale: 1 },
      { id: 'o4', type: 'orb', role: 'sign', x: -150, y: 0,    rotation: 270, scale: 1 },
      { id: 'c1', type: 'column', role: 'sign', x: 150,  y: 0, rotation: 90,  scale: 1 },
      { id: 'c2', type: 'column', role: 'sign', x: -150, y: 0, rotation: 270, scale: 1 },
    ],
  })
  const direction = r.deduction?.direction ?? r.combined?.direction
  assert.equal(
    direction,
    'contained sphere',
    `deduction direction should be "contained sphere", got "${direction}"`,
  )
})

test('multi-circle: the nested Vapor Bubble matches its own catalog recipe via the combined signature', () => {
  const vapor = {
    format: 'wha-spell@2',
    name: 'Vapor Bubble Spell',
    circles: [
      {
        id: 'k4', name: 'Circle 1', center: { x: 0, y: 0 }, radius: 104, ring: { closed: false },
        core: { id: 'c4', type: 'wind', x: -76, y: -1, rotation: 90, scale: 1 },
        components: [
          { id: 'c2', type: 'gather', role: 'sign', x: 2, y: -46, rotation: 180, scale: 1.6 },
          { id: 'c3', type: 'gather', role: 'sign', x: -1, y: 49, rotation: 1.5, scale: 1.6 },
          { id: 'c5', type: 'wind', role: 'sigil', x: 75, y: -2, rotation: 90, scale: 1 },
          { id: 'c6', type: 'column', role: 'sign', x: 64, y: 42, rotation: 300, scale: 1 },
          { id: 'c7', type: 'column', role: 'sign', x: 64, y: -46, rotation: 233, scale: 1 },
          { id: 'c8', type: 'column', role: 'sign', x: -62, y: 37, rotation: 60, scale: 1 },
          { id: 'c9', type: 'column', role: 'sign', x: -58, y: -44, rotation: 120, scale: 1 },
          { id: 'c10', type: 'cool', role: 'sign', x: -37, y: -66, rotation: 145, scale: 1 },
          { id: 'c11', type: 'cool', role: 'sign', x: 41, y: -61, rotation: 214, scale: 1 },
          { id: 'c12', type: 'cool', role: 'sign', x: 43, y: 62, rotation: 323, scale: 1 },
          { id: 'c13', type: 'cool', role: 'sign', x: -41, y: 58, rotation: 34, scale: 1 },
        ],
      },
      {
        id: 'k5', name: 'Circle 2', center: { x: -1, y: 0 }, radius: 50, ring: { closed: true },
        core: { id: 'c1', type: 'water', x: 2, y: -1, rotation: 0, scale: 1 }, components: [],
      },
    ],
    relations: [{ type: 'nest', outer: 'k4', inner: 'k5' }],
  }
  const r = runCli(vapor)
  assert.equal(r.circles.length, 2)
  assert.ok(r.similar.match, 'expected a combined-signature catalog match for the nested spell')
  assert.equal(r.similar.match.name, 'Vapor Bubble Spell')
})
