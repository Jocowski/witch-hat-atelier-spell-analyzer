// Tests for wha-lang (tools/wha-lang.mjs) — the spell-authoring language.
//
// Two layers:
//   1. Resolver unit tests — the §6 placement math (the ONLY trig) in isolation.
//   2. Reconstruction tests — build a spell, .emit(), then run the emitted JSON through the
//      REAL engine (src/engine via compose/geometry, mirroring tools/spell-engine-cli.mjs) and
//      assert valid:true, unknownIds:[], and the expected operatorsByKind / symmetry / zones.
//
// JSON is loaded via createRequire (Vite-style bare JSON imports fail under plain node --test).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  SPELL, CIRCLE, GROUP, SIGIL, SIGN,
  RING, CARDINAL, DIAGONAL, SURROUND,
  IN, OUT, AROUND, FRONT, AUTO,
  INNER, MID, RING_R, OUT_R,
  polarToXY, resolveAngles, faceToRotation, __resetIds,
} from '../tools/wha-lang.mjs'

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
const compose = await importLocal('src/engine/compose.js')
const geometry = await importLocal('src/engine/geometry.js')
const { toComposition, analyzeCircleWith, composeWith, reclassifyCorelessCircles } = compose
const { computeSymmetry, classifyZone } = geometry

const SIGIL_MAP = Object.fromEntries(sigilsDoc.sigils.map((s) => [s.id, s]))
const SIGN_MAP = Object.fromEntries(signsDoc.signs.map((s) => [s.id, s]))
const DYE_MAP = Object.fromEntries((dyesDoc.dyes || []).map((d) => [d.id, d]))
const deps = { grammar, sigilMap: SIGIL_MAP, signMap: SIGN_MAP, dyeMap: DYE_MAP, zones: rules.zones }
const getDef = (t) => SIGIL_MAP[t] || SIGN_MAP[t] || null

// ---- mirror of tools/spell-engine-cli.mjs facts extraction (just what the tests assert) ----
function facts(input) {
  // Accept the app wrapper { format, version, composition } or a bare composition / v2 object.
  const norm = toComposition(input.composition || input)
  const per = norm.circles.map((c) => analyzeCircleWith(deps, c))
  if (per.length > 1) reclassifyCorelessCircles(per, norm.relations)
  const valid = per.every((p) => p.valid)
  // unknown id detection
  const unknownIds = []
  for (const c of norm.circles) {
    if (c.core && !getDef(c.core.type)) unknownIds.push({ where: `core@${c.id}`, type: c.core.type })
    for (const comp of c.components || []) {
      if (!getDef(comp.type)) unknownIds.push({ where: `${comp.role}@${c.id}`, type: comp.type })
    }
  }
  const circles = per.map((c, i) => {
    const raw = norm.circles[i]
    const zones = { inside: 0, ring: 0, outside: 0 }
    for (const comp of raw.components || []) {
      if (comp.role !== 'sign') continue
      zones[classifyZone(comp.x, comp.y, raw.radius, rules.zones)]++
    }
    const byKind = {}
    for (const s of c.signs || []) {
      const kind = grammar.operators[s.id]?.kind || 'unknown'
      ;(byKind[kind] ||= []).push(s.inverted ? `${s.id}!inv` : s.id)
    }
    const a = c.analysis || {}
    return {
      id: c.id,
      valid: c.valid,
      contextRole: c.contextRole || null,
      core: (c.sigils || []).find((s) => s.role === 'core') || null,
      symmetry: a.symmetry,
      spin: !!a.tilted,
      aim: a.aim,
      zones,
      operatorsByKind: byKind,
    }
  })
  return { valid, unknownIds, circleCount: per.length, circles }
}

// ============================================================================
// 1. RESOLVER UNIT TESTS (the §6 math)
// ============================================================================

test('polarToXY: cardinal positions (0=N, CW, y down)', () => {
  const r = 100
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`)
  let p = polarToXY(0, r); close(p.x, 0); close(p.y, -100) // N
  p = polarToXY(90, r); close(p.x, 100); close(p.y, 0) // E
  p = polarToXY(180, r); close(p.x, 0); close(p.y, 100) // S
  p = polarToXY(270, r); close(p.x, -100); close(p.y, 0) // W
})

test('polarToXY: diagonal positions', () => {
  const r = 100
  const d = (r * Math.SQRT1_2)
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-4, `${a} ≈ ${b}`)
  let p = polarToXY(45, r); close(p.x, d); close(p.y, -d)
  p = polarToXY(135, r); close(p.x, d); close(p.y, d)
  p = polarToXY(225, r); close(p.x, -d); close(p.y, d)
  p = polarToXY(315, r); close(p.x, -d); close(p.y, -d)
})

test('resolveAngles: RING ⇒ N evenly-spaced own anchors', () => {
  assert.deepEqual(resolveAngles(RING, 4, 18), [0, 90, 180, 270])
  assert.deepEqual(resolveAngles(RING, 8, 18), [0, 45, 90, 135, 180, 225, 270, 315])
})

test('resolveAngles: CARDINAL / DIAGONAL anchors (count = #anchors)', () => {
  assert.deepEqual(resolveAngles(CARDINAL, 4, 18), [0, 90, 180, 270])
  assert.deepEqual(resolveAngles(DIAGONAL, 4, 18), [45, 135, 225, 315])
})

test('resolveAngles: auto-flank count=8 over CARDINAL ⇒ 2 per cardinal at ±spread', () => {
  const spread = 18
  const out = resolveAngles(CARDINAL, 8, spread)
  // 2 per anchor, centered: a + spread·(j − 0.5) ⇒ a−9, a+9
  assert.deepEqual(out, [
    (0 - 9 + 360) % 360, 0 + 9,
    90 - 9, 90 + 9,
    180 - 9, 180 + 9,
    270 - 9, 270 + 9,
  ])
})

test('resolveAngles: count not divisible over anchors ⇒ clear error', () => {
  assert.throws(() => resolveAngles(CARDINAL, 6, 18), /does not divide evenly/)
})

test('resolveAngles: explicit angle list', () => {
  assert.deepEqual(resolveAngles([10, 200, 350], 3, 18), [10, 200, 350])
})

test('faceToRotation: IN/OUT/AROUND/FRONT per the §6 table (calibrated)', () => {
  // IN ⇒ θ+180 (top points at center), OUT ⇒ θ, AROUND ⇒ θ+90 (tangential), FRONT ⇒ 0.
  assert.equal(faceToRotation(IN, 90), 270)
  assert.equal(faceToRotation(OUT, 90), 90)
  assert.equal(faceToRotation(AROUND, 90), 180)
  assert.equal(faceToRotation(FRONT, 90), 0)
  assert.equal(faceToRotation(IN, 0), 180)
  assert.equal(faceToRotation(OUT, 0), 0)
})

test('faceToRotation: AUTO reads defaultFacing from data', () => {
  const sightsSet = SIGN_MAP['sights_set'] // defaultFacing: 'outward'
  const column = SIGN_MAP['column'] // no defaultFacing ⇒ inward
  assert.equal(faceToRotation(AUTO, 90, sightsSet), 90) // outward ⇒ θ
  assert.equal(faceToRotation(AUTO, 90, column), 270) // default ⇒ θ+180 (inward)
})

test('radius zones resolve to fractions of R (via emitted coordinates)', () => {
  __resetIds()
  // A single column at RING_R on an explicit-radius circle should land at ~0.92·R.
  const c = CIRCLE({ radius: 200, core: SIGIL('WATER') }, SIGN('column', 1, { at: [0], radius: RING_R, face: IN }))
  const sp = SPELL('z'); sp.circles.push(c)
  const out = sp.emit()
  const comp = out.circles ? out.circles[0].components[0] : out.composition.components[0]
  const dist = Math.hypot(comp.x, comp.y)
  assert.ok(Math.abs(dist - 0.92 * 200) < 1e-3, `dist ${dist} ≈ ${0.92 * 200}`)
})

// ============================================================================
// 2. RECONSTRUCTION TESTS (build → emit → real engine)
// ============================================================================

test('Watershot: water + COLUMN×8 RING IN ⇒ valid, radial, ring zone, catalog match', () => {
  __resetIds()
  const c = CIRCLE({ core: SIGIL('WATER') }, SIGN('column', 8, { at: RING, face: IN, radius: RING_R }))
  const sp = SPELL('Watershot Seal'); sp.circles.push(c)
  const ir = sp.emit()
  assert.equal(ir.format, 'wha-spell@1') // single circle, no relations

  const f = facts(ir)
  assert.equal(f.valid, true)
  assert.deepEqual(f.unknownIds, [])
  const k = f.circles[0]
  assert.equal(k.symmetry, 'radial')
  assert.equal(k.spin, false)
  assert.deepEqual(k.operatorsByKind, { form: ['column'] })
  assert.equal(k.zones.ring, 8)
  assert.equal(k.zones.inside, 0)
  assert.equal(k.zones.outside, 0)

  // The catalog matcher must still recognize it as the Watershot Seal.
  const m = matchBest(ir)
  assert.equal(m.spell.name, 'Watershot Seal')
  assert.ok(m.score >= rules.matching.threshold, `score ${m.score} ≥ ${rules.matching.threshold}`)
})

test('Light Beam: light + COLUMN×4 CARDINAL IN ⇒ valid, radial, columns', () => {
  __resetIds()
  const c = CIRCLE({ core: SIGIL('LIGHT') }, SIGN('column', 4, { at: CARDINAL, face: IN }))
  const sp = SPELL('Light Beam'); sp.circles.push(c)
  const f = facts(sp.emit())
  assert.equal(f.valid, true)
  assert.deepEqual(f.unknownIds, [])
  const k = f.circles[0]
  assert.equal(k.symmetry, 'radial')
  assert.deepEqual(k.operatorsByKind, { form: ['column'] })
  assert.equal(k.core.id, 'light')
})

test('Gathering Shadows: VISION core + EYE×4 DIAGONAL + BEND×4 ⇒ valid, radial, eye+bend', () => {
  __resetIds()
  const c = CIRCLE({ core: SIGN('VISION') },
    SIGN('EYE', 4, { at: DIAGONAL }),
    SIGN('BEND', 4, { at: CARDINAL }),
  )
  const sp = SPELL('Gathering Shadows'); sp.circles.push(c)
  const f = facts(sp.emit())
  assert.equal(f.valid, true)
  assert.deepEqual(f.unknownIds, [])
  const k = f.circles[0]
  // VISION (a center-capable sign) maps to its *_sigil substance form as the core.
  assert.equal(k.core.id, 'vision_sigil')
  assert.equal(k.symmetry, 'radial')
  assert.deepEqual(new Set(k.operatorsByKind.special), new Set(['eye', 'bend']))
})

test('Cloak Spell (4-ring device): stack ⇒ valid wha-spell@2, no unknownIds', async () => {
  const mod = await import(pathToFileURL(resolve(root, 'examples/cloak.wha.mjs')).href)
  const ir = mod.default.emit()
  assert.equal(ir.format, 'wha-spell@2')
  assert.equal(ir.circles.length, 4)
  assert.equal(ir.relations.length, 3) // stack ⇒ 3 nest relations
  assert.ok(ir.relations.every((r) => r.type === 'nest'))

  const f = facts(ir)
  assert.equal(f.valid, true)
  assert.deepEqual(f.unknownIds, [])
  assert.equal(f.circleCount, 4)

  const byId = Object.fromEntries(f.circles.map((c) => [c.id, c]))
  // inner: vision core + winds + the eye/bend/column arms — all inside the ring.
  assert.equal(byId.inner.core.id, 'vision_sigil')
  assert.equal(byId.inner.zones.outside, 0)
  assert.ok(byId.inner.operatorsByKind.form?.includes('column'))
  assert.deepEqual(new Set(byId.inner.operatorsByKind.special), new Set(['eye', 'bend']))
  // body: puppet + region (coreless modifier ring around the heart).
  assert.ok(byId.body.operatorsByKind.motion?.includes('dancing_puppet'))
  assert.ok(byId.body.operatorsByKind.direction?.includes('direction'))
  // channelway bands: region band spins (face=AROUND), bend band on the rim.
  assert.equal(byId.chan_region.spin, true)
  assert.equal(byId.chan_region.zones.ring, 18)
  assert.equal(byId.chan_bend.zones.ring, 24)
})

// ============================================================================
// 3. CAPABILITY / ERROR ENFORCEMENT (spec §9)
// ============================================================================

test('unknown TYPE throws with nearest-id suggestions', () => {
  assert.throws(() => SIGN('coloumn', 8), /unknown SIGN type "coloumn".*column/s)
})

test('inverted only on invertible signs', () => {
  assert.throws(() => SIGN('eye', 1, { inverted: true }), /not invertible/)
  // a directional sign is fine
  assert.doesNotThrow(() => SIGN('column', 1, { inverted: true }))
})

test('at=SURROUND only on surrounds:true signs', () => {
  __resetIds()
  const bad = CIRCLE({ core: SIGN('VISION') }, SIGN('column', 1, { at: SURROUND }))
  const sp = SPELL('x'); sp.circles.push(bad)
  assert.throws(() => sp.emit(), /SURROUND is only valid on surrounds:true/)
  // weave (surrounds:true) is allowed
  __resetIds()
  const ok = CIRCLE({ core: SIGIL('WATER') }, SIGN('weave', 1, { at: SURROUND }))
  const sp2 = SPELL('y'); sp2.circles.push(ok)
  assert.doesNotThrow(() => sp2.emit())
})

test('core must be a sigil or a canBeCore sign', () => {
  __resetIds()
  const bad = CIRCLE({ core: SIGN('eye') })
  const sp = SPELL('x'); sp.circles.push(bad)
  assert.throws(() => sp.emit(), /cannot occupy the center/)
})

test('aliases resolve to data ids (REGION→direction, PUPPET→dancing_puppet, VISION core→vision_sigil)', () => {
  __resetIds()
  const c = CIRCLE({ core: SIGN('VISION') }, SIGN('REGION', 4, { at: CARDINAL }), SIGN('PUPPET', 4, { at: DIAGONAL }))
  const sp = SPELL('a'); sp.circles.push(c)
  const ir = sp.emit()
  const comp = ir.composition || ir.circles?.[0]
  const core = comp.core
  assert.equal(core.type, 'vision_sigil')
  const types = new Set((comp.components || ir.circles[0].components).map((x) => x.type))
  assert.ok(types.has('direction'))
  assert.ok(types.has('dancing_puppet'))
})

// ============================================================================
// 4. STRUCTURE OPS (spec §8 — the circle graph)
// ============================================================================

test('link ⇒ wha-spell@2 with a link relation', () => {
  __resetIds()
  const a = CIRCLE({ core: SIGIL('WATER') }, SIGN('column', 4, { at: CARDINAL, face: IN }))
  const b = CIRCLE({ core: SIGIL('WATER') }, SIGN('column', 4, { at: CARDINAL, face: IN }))
  const ir = SPELL('Linked').link(a, b).emit()
  assert.equal(ir.format, 'wha-spell@2')
  assert.equal(ir.circles.length, 2)
  assert.deepEqual(ir.relations, [{ type: 'link', a: 'k0', b: 'k1' }])
  assert.equal(facts(ir).valid, true)
})

test('toggle ⇒ a toggle relation', () => {
  __resetIds()
  const a = CIRCLE({ core: SIGIL('WATER') }, SIGN('column', 4, { at: CARDINAL, face: IN }))
  const b = CIRCLE({ core: SIGIL('EARTH') }, SIGN('column', 4, { at: CARDINAL, face: IN }))
  const ir = SPELL('Toggled').toggle(a, b).emit()
  assert.equal(ir.relations[0].type, 'toggle')
})

test('stack auto-assigns ascending radii and chains nest innermost→outermost', () => {
  __resetIds()
  const a = CIRCLE({ core: SIGIL('WATER') }, SIGN('column', 4, { at: CARDINAL, face: IN }))
  const b = CIRCLE({}, SIGN('weave', 1, { at: SURROUND }))
  const c = CIRCLE({}, SIGN('rain', 1, { at: SURROUND }))
  const ir = SPELL('Stacked').stack(a, b, c).emit()
  const radii = ir.circles.map((x) => x.radius)
  assert.ok(radii[0] < radii[1] && radii[1] < radii[2], `ascending radii ${radii}`)
  assert.deepEqual(ir.relations, [
    { type: 'nest', outer: 'k1', inner: 'k0' },
    { type: 'nest', outer: 'k2', inner: 'k1' },
  ])
})

test('cluster (G3) stamps whole circles at offsets and auto-wires nest into a parent', () => {
  __resetIds()
  const unit = CIRCLE({ core: SIGIL('LIGHT') }, SIGN('column', 4, { at: CARDINAL, face: IN }))
  const parent = CIRCLE({ radius: 320 }, SIGN('weave', 1, { at: SURROUND }))
  const ir = SPELL('Cluster').cluster(unit, 3, { at: RING, radius: RING_R, into: parent }).emit()
  // unit + parent + 3 clones = 5 circles; 3 nest relations into the parent.
  assert.equal(ir.circles.length, 5)
  const nests = ir.relations.filter((r) => r.type === 'nest' && r.outer === parent.id)
  assert.equal(nests.length, 3)
  // clones sit at distinct offset centers (not all at origin).
  const clones = ir.circles.filter((c) => /_cluster\d+$/.test(c.id))
  assert.equal(clones.length, 3)
  assert.ok(clones.some((c) => c.center.x !== 0 || c.center.y !== 0))
})

// ---- catalog matcher (mirror of the CLI's matchSpell, just enough for the assertion) ----
function matchBest(input) {
  const norm = toComposition(input.composition || input)
  const circle = norm.circles[0]
  const signs = (circle.components || []).filter((c) => c.role === 'sign')
  const multiset = {}
  for (const s of signs) {
    const zone = classifyZone(s.x, s.y, circle.radius, rules.zones)
    const key = `${s.type}${s.inverted ? '!inv' : ''}${zone === 'outside' ? '@out' : ''}`
    multiset[key] = (multiset[key] || 0) + 1
  }
  const core = circle.core?.type ?? null
  const coreEl = core ? getDef(core)?.element ?? null : null
  const w = rules.matching.weights
  const CW = { high: 1, medium: 0.9, low: 0.7, theoretical: 0.6, unknown: 0.4 }
  const simil = (a, b) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    if (!keys.size) return 1
    let inter = 0, uni = 0
    for (const k of keys) { inter += Math.min(a[k] || 0, b[k] || 0); uni += Math.max(a[k] || 0, b[k] || 0) }
    return uni === 0 ? 1 : inter / uni
  }
  const ranked = (spellsDoc.spells || []).map((spell) => {
    const comp = spell.composition || {}
    const sm = {}
    for (const s of comp.signs ?? []) {
      const key = `${s.id}${s.inverted ? '!inv' : ''}${s.placement === 'outside' ? '@out' : ''}`
      sm[key] = (sm[key] || 0) + (s.count || 1)
    }
    const sigilMatch = core === comp.core ? 1 : (coreEl && getDef(comp.core)?.element === coreEl ? 0.5 : 0)
    const signSetMatch = simil(multiset, sm)
    const symmetryMatch = comp.symmetry === computeSymmetry(circle.components || []) ? 1 : 0
    let score = w.sigilMatch * sigilMatch + w.signSetMatch * signSetMatch + w.symmetryMatch * symmetryMatch + w.placementMatch * 0.5
    score *= CW[spell.confidence] ?? 0.5
    return { spell, score: Number(score.toFixed(3)) }
  })
  ranked.sort((a, b) => b.score - a.score)
  return ranked[0]
}
