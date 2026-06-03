// wha-lang — the spell-authoring language (JS-builder implementation).
//
// Spec: docs/wha-lang.md  ·  Target IR: docs/IR.md (wha-spell@1 / @2)  ·  Geometry: docs/CORE.md §4
//
// This is the SOURCE language. You describe a Witch Hat Atelier seal by INTENT — what parts,
// how many, roughly where, which way they face — and the compiler owns every x/y/rotation.
// It compiles to the wha-spell IR that the engine, renderer and analyzer already consume.
//
// Design boundaries (spec §1):
//   1. Drawing, not meaning — wha-lang never encodes what a spell DOES. Effect reasoning stays
//      in the analyzer / CORE.md.
//   2. Data-driven symbols — SIGIL/SIGN types are validated against data/{sigils,signs}.json and
//      capability flags (canBeCenter, surrounds, invertible, defaultFacing) are read from there.
//   3. One place does math — the §6 placement resolver (resolvePlaced) is the ONLY trig.
//   4. Recursive placement — a GROUP is a mini-circle with its own local frame; no part ever
//      references another part, so there is no constraint solver.
//
// JSON loading caveat: this repo's tests run under plain `node --test`, where
// `import x from './x.json'` FAILS. We load JSON via createRequire — never import assertions.

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const SIGILS = require(resolve(root, 'data/sigils.json')).sigils
const SIGNS = require(resolve(root, 'data/signs.json')).signs

const SIGIL_MAP = Object.fromEntries(SIGILS.map((s) => [s.id, s]))
const SIGN_MAP = Object.fromEntries(SIGNS.map((s) => [s.id, s]))

// ---------------------------------------------------------------------------
// Placement constants (the placement vocabulary, spec §5/§6).
// They are plain tagged objects so the resolver can branch on `.kind`/`.value`
// while callers use them as opaque tokens (CARDINAL, IN, RING_R, …).
// ---------------------------------------------------------------------------

// Anchors / arc-sugar — resolve to a set of anchor angles (deg, 0=N CW).
const anchor = (name, angles) => ({ kind: 'anchor', name, angles })
export const RING = anchor('RING', null) // null ⇒ each item is its own evenly-spaced anchor
export const CARDINAL = anchor('CARDINAL', [0, 90, 180, 270])
export const DIAGONAL = anchor('DIAGONAL', [45, 135, 225, 315])
export const SURROUND = { kind: 'surround', name: 'SURROUND' }
// Arc sugar (spec §5 "arc-sugar"): convenience anchor sets over partial arcs.
export const TOP = anchor('TOP', [315, 0, 45])
export const BOTTOM = anchor('BOTTOM', [135, 180, 225])
export const SIDES = anchor('SIDES', [90, 270])
export const FRONT_ARC = anchor('FRONT_ARC', [315, 0, 45])
export const BACK_ARC = anchor('BACK_ARC', [135, 180, 225])
export const ALTERNATING = anchor('ALTERNATING', [0, 45, 90, 135, 180, 225, 270, 315])

// Faces — resolve to a rotation given the item's own angle θ (spec §6 step 5).
const face = (name) => ({ kind: 'face', name })
export const IN = face('IN')
export const OUT = face('OUT')
export const AROUND = face('AROUND')
export const FRONT = face('FRONT')
export const AUTO = face('AUTO')

// Radius zones — fraction of the circle radius R (spec §6 step 3).
const zone = (name, frac) => ({ kind: 'zone', name, frac })
export const CENTER = zone('CENTER', 0)
export const INNER = zone('INNER', 0.45)
export const MID = zone('MID', 0.7)
export const RING_R = zone('RING', 0.92)
export const OUT_R = zone('OUT', 1.12)

// ---------------------------------------------------------------------------
// Type resolution + capability flags (spec §2, §9 — read from data).
// ---------------------------------------------------------------------------

// Logical alias table: a friendly TYPE name → the real data id. Identity for the rest.
const ALIASES = {
  REGION: 'direction',
  PUPPET: 'dancing_puppet',
  BILLOW: 'billowing',
  FOCUS: 'sights_set',
  EMPOWERMENT: 'strengthen',
  BINDING: 'bind',
  GATHERING: 'gather',
  ENTWINING: 'entwine',
}
// A center-capable sign maps to its *_sigil substance form when used as a core (spec §5).
const CORE_SIGIL_OF = {
  vision: 'vision_sigil',
  billowing: 'billowing_sigil',
  repetition: 'repetition_sigil',
  unknown_sign: 'unknown_sigil',
}

// Levenshtein for the "nearest valid id" suggestion on an unknown TYPE.
function editDistance(a, b) {
  const m = a.length
  const n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    }
  }
  return d[m][n]
}
function nearestIds(type, pool) {
  const t = String(type).toLowerCase()
  return pool
    .map((id) => ({ id, dist: editDistance(t, id) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((x) => x.id)
}

// Resolve a logical TYPE to a real data id within the right namespace (sigil vs sign).
function resolveType(kind, type) {
  if (typeof type !== 'string') throw new Error(`wha-lang: ${kind} type must be a string, got ${typeof type}`)
  const upper = type.toUpperCase()
  let id = ALIASES[upper] || type
  // Allow callers to pass either an alias key (WIND), the lowercased id (wind), or the id itself.
  const map = kind === 'SIGIL' ? SIGIL_MAP : SIGN_MAP
  if (!map[id] && map[id.toLowerCase()]) id = id.toLowerCase()
  if (!map[id]) {
    const pool = Object.keys(map)
    throw new Error(
      `wha-lang: unknown ${kind} type "${type}". Nearest valid ids: ${nearestIds(id, pool).join(', ')}.`,
    )
  }
  return id
}

// ---------------------------------------------------------------------------
// Node constructors (AST, spec §4).
// ---------------------------------------------------------------------------

const PART = Symbol('part')
const GROUP_NODE = Symbol('group')

function normalizeArgs(count, opts) {
  // SIGIL(TYPE), SIGIL(TYPE, count), SIGIL(TYPE, opts), SIGIL(TYPE, count, opts)
  if (count && typeof count === 'object') {
    opts = count
    count = undefined
  }
  return { count: count ?? 1, opts: opts || {} }
}

function makePart(kind, type, count, opts) {
  const a = normalizeArgs(count, opts)
  const id = resolveType(kind, type)
  const def = (kind === 'SIGIL' ? SIGIL_MAP : SIGN_MAP)[id]
  // Capability check: inverted only on invertible signs (spec §9).
  if (a.opts.inverted && !def.invertible) {
    throw new Error(`wha-lang: "${id}" is not invertible (family=${def.family}); inverted is only valid on invertible signs.`)
  }
  return {
    __node: PART,
    nodeKind: kind, // 'SIGIL' | 'SIGN'
    type: id,
    def,
    count: a.count,
    opts: a.opts,
  }
}

export function SIGIL(type, count, opts) {
  return makePart('SIGIL', type, count, opts)
}
export function SIGN(type, count, opts) {
  return makePart('SIGN', type, count, opts)
}

// GROUP — either define a reusable local layout (GROUP("name", ...children)) or place a
// previously-defined group (GROUP(groupDef, count?, opts?)). The first form returns a group
// definition node; the second wraps it for placement.
export function GROUP(nameOrDef, ...rest) {
  if (typeof nameOrDef === 'string') {
    // Definition form: children are the remaining args.
    const children = rest.filter((c) => c && (c.__node === PART || c.__node === GROUP_NODE))
    return { __node: GROUP_NODE, name: nameOrDef, children, count: 1, opts: {} }
  }
  // Placement form: nameOrDef is a group definition; rest = [count?, opts?].
  if (!nameOrDef || nameOrDef.__node !== GROUP_NODE) {
    throw new Error('wha-lang: GROUP(def, count?, opts?) — first arg must be a group definition (from GROUP("name", ...)).')
  }
  const a = normalizeArgs(rest[0], rest[1])
  return { ...nameOrDef, count: a.count, opts: { ...nameOrDef.opts, ...a.opts } }
}

// ---------------------------------------------------------------------------
// The placement resolver — THE ONLY MATH (spec §6). Keep all trig here.
// Convention (IR.md §3 / CORE.md §4): angle 0°=N, clockwise, y down;
//   x = r·sin(θ°), y = −r·cos(θ°).  Zones: inside ≤0.85, ring 0.85–1.05, outside >1.05.
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180
const round = (n) => Number(n.toFixed(4))

// Step 4 — position from polar (angle θ deg, radius r px).
export function polarToXY(theta, r) {
  return { x: round(r * Math.sin(theta * DEG)), y: round(-r * Math.cos(theta * DEG)) }
}

// Step 5 — rotation from face. Calibrated against the engine/renderer:
//   IN  → θ+180 (the sign's TOP points at the center; matches inwardRotation in geometry.js
//         and the canonical reference seals e.g. Light Beam columns at (0,-95) rot 180).
//   OUT → θ     (points away from center).
//   AROUND → θ+90 (fully tangential ⇒ computeSpin reads it as spinning).
//   FRONT → 0   (all items aimed the same way, north).
//   AUTO → from data defaultFacing: 'outward' ⇒ OUT, else IN.
export function faceToRotation(faceTok, theta, def) {
  const name = faceTok?.name || 'AUTO'
  const norm = (d) => ((d % 360) + 360) % 360
  switch (name) {
    case 'IN':
      return norm(theta + 180)
    case 'OUT':
      return norm(theta)
    case 'AROUND':
      return norm(theta + 90)
    case 'FRONT':
      return 0
    case 'AUTO':
    default: {
      const df = def?.defaultFacing
      return df === 'outward' ? norm(theta) : norm(theta + 180)
    }
  }
}

// Step 3 — radius zone → px. A zone token resolves to a fraction of R; a number is absolute px.
function resolveRadiusPx(radiusOpt, R, faceTok) {
  if (typeof radiusOpt === 'number') return radiusOpt
  if (radiusOpt && radiusOpt.kind === 'zone') return radiusOpt.frac * R
  // Default MID, but RING when face=AROUND (a tangential band sits on the rim) — spec §5 table.
  const isAround = faceTok?.name === 'AROUND'
  return (isAround ? RING_R.frac : MID.frac) * R
}

// Steps 1+2 — anchor angles, then distribute N over anchors with auto-flanking.
// Returns an array of item angles (deg). `at=RING` ⇒ N evenly-spaced own anchors.
export function resolveAngles(atTok, N, spread) {
  const at = atTok || RING
  if (at.kind === 'anchor' && at.angles == null) {
    // RING: each item is its own evenly-spaced anchor.
    return Array.from({ length: N }, (_, i) => ((i * 360) / N) % 360)
  }
  if (Array.isArray(atTok)) {
    // Explicit angle list [θ,…]: one item per listed angle (N must match the count).
    return atTok.map((a) => ((a % 360) + 360) % 360)
  }
  const A = at.angles
  const m = A.length
  if (N % m !== 0) {
    throw new Error(
      `wha-lang: count ${N} does not divide evenly over ${m} ${at.name} anchors. Use at=RING, an explicit angle list, or a count that is a multiple of ${m}.`,
    )
  }
  const k = N / m // items per anchor
  const out = []
  for (const a of A) {
    if (k === 1) {
      out.push(((a % 360) + 360) % 360)
    } else {
      // Auto-flank: k items centered on the anchor at a + spread·(j − (k−1)/2).
      for (let j = 0; j < k; j++) {
        const off = spread * (j - (k - 1) / 2)
        out.push((((a + off) % 360) + 360) % 360)
      }
    }
  }
  return out
}

// Resolve one Placed (a part with placement opts) on a circle of radius R into placed glyphs:
// [{ type, role, x, y, rotation, scale, inverted, surrounds? }].  This is §6 end-to-end.
function resolvePlaced(node, R, idGen) {
  const opts = node.opts || {}
  const N = node.count ?? 1
  const role = node.nodeKind === 'SIGIL' ? 'sigil' : 'sign'
  const def = node.def
  const atTok = opts.at ?? RING
  const faceTok = opts.face ?? AUTO
  const spread = opts.spread ?? 18
  const scale = opts.scale ?? 1
  const inverted = !!opts.inverted

  // SURROUND — an encircling band: one sign, no flanking (spec §6 step 1, §9).
  if (atTok && atTok.kind === 'surround') {
    if (!def.surrounds) {
      throw new Error(`wha-lang: at=SURROUND is only valid on surrounds:true signs; "${node.type}" is not one.`)
    }
    return [{
      id: idGen(),
      type: node.type,
      role,
      x: 0,
      y: 0,
      rotation: 0,
      scale,
      inverted,
      surrounds: true,
    }]
  }

  const angles = resolveAngles(atTok, N, spread)
  const rPx = resolveRadiusPx(opts.radius, R, faceTok)
  return angles.map((theta) => {
    const { x, y } = polarToXY(theta, rPx)
    return {
      id: idGen(),
      type: node.type,
      role,
      x,
      y,
      rotation: faceToRotation(faceTok, theta, def),
      scale,
      inverted,
    }
  })
}

// ---------------------------------------------------------------------------
// GROUP recursion (spec §7). A group is laid out in a LOCAL frame: origin at its anchor,
// local +outward axis = away from the circle center (local "north" = the radial-outward
// direction). Children use the same opts, but `radius` means distance along the local
// outward axis and `face` is relative to the local frame. When stamped at an anchor at
// angle φ (radius rAnchor), the local frame is translated to that anchor point and rotated
// so local-outward aligns with φ's radial-outward.
// How big a group's LOCAL mini-circle is, as a fraction of the host R. The group is a compact
// unit: its children's radius zones are fractions of this local extent (not the full host
// radius), so a stamped arm stays inside the ring instead of shooting past the rim.
const GROUP_LOCAL_SCALE = 0.32

function resolveGroup(node, R, idGen) {
  const opts = node.opts || {}
  const N = node.count ?? 1
  const atTok = opts.at ?? RING
  const spread = opts.spread ?? 18
  // Where each stamp of the group ORIGIN sits (the anchor points on the host circle). Groups
  // default to the INNER zone so the arm's outward extent still fits within the ring.
  const anchorAngles = resolveAngles(atTok, N, spread)
  const anchorR = resolveRadiusPx(opts.radius ?? INNER, R, opts.face ?? AUTO)
  const localR_base = R * GROUP_LOCAL_SCALE

  // Lay out the group's children once in the LOCAL frame. Local frame: origin (0,0) is the
  // anchor; local +y axis points OUTWARD (away from circle center). A child placed at local
  // radius rL along local-outward sits at local (0, -rL) in a "local north = outward" frame,
  // i.e. we treat the local outward axis as the child's polar reference. We reuse the same
  // resolver math on a unit "local circle" whose own radius is R (so zones scale the same).
  const localGlyphs = []
  for (const child of node.children) {
    if (child.__node === GROUP_NODE) {
      throw new Error('wha-lang: nested GROUP definitions are not supported; flatten the layout.')
    }
    const childOpts = child.opts || {}
    const childAt = childOpts.at ?? RING
    const childN = child.count ?? 1
    const childFace = childOpts.face ?? AUTO
    const childSpread = childOpts.spread ?? 18
    // Local angles: in the local frame the children fan out around the local outward axis.
    // RING here means "stacked along the outward axis at angle 0 (local outward)"; an explicit
    // anchor set fans them at those angles relative to local-outward.
    const localAngles =
      childAt.kind === 'anchor' && childAt.angles == null
        ? Array.from({ length: childN }, () => 0) // all along the outward axis (flank by spread below)
        : resolveAngles(childAt, childN, childSpread)
    // Distance along the local outward axis, as a fraction of the group's LOCAL extent. The
    // local origin (the group anchor) is 0; a child at zone Z sits Z·localR_base further out
    // along the arm. Default MID (the middle of the arm); an absolute number is raw local px.
    // (Spec §10 narrates the bare EYE as the "innermost" element and the bend, at radius=OUT,
    // as "further out" — MID-vs-OUT preserves that inner→outer ordering within the arm.)
    const childRadiusOpt = childOpts.radius ?? MID
    const localR =
      typeof childRadiusOpt === 'number'
        ? childRadiusOpt
        : (childRadiusOpt.kind === 'zone' ? childRadiusOpt.frac : MID.frac) * localR_base
    // Flank multiple RING children along the outward axis by spread so they don't overlap.
    const angles =
      childAt.kind === 'anchor' && childAt.angles == null && childN > 1
        ? localAngles.map((_, j) => childSpread * (j - (childN - 1) / 2))
        : localAngles
    for (const localTheta of angles) {
      // In the local frame, "outward" is local angle 0; a child at local angle θ, distance r.
      const lx = round(localR * Math.sin(localTheta * DEG))
      const ly = round(-localR * Math.cos(localTheta * DEG)) // local-outward is -y (local north)
      localGlyphs.push({
        type: child.type,
        role: child.nodeKind === 'SIGIL' ? 'sigil' : 'sign',
        lx,
        ly,
        rotation: faceToRotation(childFace, localTheta, child.def),
        scale: childOpts.scale ?? 1,
        inverted: !!childOpts.inverted,
      })
    }
  }

  // Stamp the local layout at each anchor, rotating local-outward to align with the radial.
  // The local frame has +outward = local north (the -y axis). Stamping at compass angle φ
  // rotates the whole local frame by φ (clockwise) about the anchor point. A local vector
  // (lx, ly) maps to world offset (lx·cosφ − ly·sinφ, lx·sinφ + ly·cosφ): this sends a local
  // point at compass angle α distance d to compass angle (α+φ) at the same distance, so a
  // child sitting "outward" lands radial-outward from the anchor regardless of where the
  // anchor is. (Derived from x=r·sinθ, y=−r·cosθ; see the §6 conventions.)
  const out = []
  for (const phi of anchorAngles) {
    const ax = anchorR * Math.sin(phi * DEG)
    const ay = -anchorR * Math.cos(phi * DEG)
    const cos = Math.cos(phi * DEG)
    const sin = Math.sin(phi * DEG)
    for (const g of localGlyphs) {
      const childWorldX = round(ax + g.lx * cos - g.ly * sin)
      const childWorldY = round(ay + g.lx * sin + g.ly * cos)
      out.push({
        id: idGen(),
        type: g.type,
        role: g.role,
        x: childWorldX,
        y: childWorldY,
        // The child's facing rotation is relative to local-outward; in the world it is offset
        // by the anchor angle φ so "local IN/OUT" still means toward/away from circle center.
        rotation: ((g.rotation + phi) % 360 + 360) % 360,
        scale: g.scale,
        inverted: g.inverted,
      })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// CIRCLE — a single ring (spec §8).
// ---------------------------------------------------------------------------

let CIRCLE_SEQ = 0
function nextCircleId() {
  return `k${CIRCLE_SEQ++}`
}

class Circle {
  constructor(idOrOpts, opts, children) {
    if (typeof idOrOpts === 'string') {
      this.id = idOrOpts
      this.opts = opts || {}
    } else {
      this.id = nextCircleId()
      this.opts = idOrOpts || {}
      children = opts ? [opts, ...(children || [])] : children
    }
    this.children = (children || []).filter(Boolean)
    this.radius = this.opts.radius ?? null
    this.ringClosed = this.opts.ring === 'open' ? false : this.opts.open ? false : true
    this.dyes = this.opts.dyes || []
    this.center = this.opts.center || { x: 0, y: 0 }
    // core: a SIGIL part, a canBeCore SIGN part, or null.
    this.coreNode = this.opts.core || null
  }

  // Compile this circle to a wha-spell circle object.
  compile() {
    // Radius used by the §6 resolver for zone fractions. When the circle carries an explicit
    // radius we use it (and emit it in v2). When it does NOT, we fall back to the engine's own
    // default ring radius (CANVAS_RADIUS = 260 in geometry.js) — that is what classifyZone
    // assumes when a circle has no radius (notably every wha-spell@1 single seal, which cannot
    // carry a radius field). Matching that constant keeps a `RING_R` placement landing in the
    // engine's `ring` zone instead of drifting to `inside`.
    const R = this.radius ?? 260
    let glyphSeq = 0
    const idGen = () => `${this.id}s${glyphSeq++}`

    // ----- core -----
    let core = null
    if (this.coreNode) {
      const node = this.coreNode
      if (node.__node !== PART) throw new Error('wha-lang: core must be a SIGIL(...) or a canBeCore SIGN(...).')
      let coreType = node.type
      const def = node.def
      const isSigil = node.nodeKind === 'SIGIL'
      const canCore = isSigil || def.canBeCenter
      if (!canCore) {
        throw new Error(`wha-lang: core must be a sigil or a canBeCore sign; "${coreType}" cannot occupy the center.`)
      }
      // Map a center-capable sign to its *_sigil substance form (spec §5: VISION→vision_sigil).
      if (!isSigil && CORE_SIGIL_OF[coreType]) coreType = CORE_SIGIL_OF[coreType]
      core = {
        id: `${this.id}c`,
        type: coreType,
        x: 0,
        y: 0,
        rotation: 0,
        scale: node.opts?.scale ?? 1,
        inverted: !!node.opts?.inverted,
      }
    }

    // ----- components -----
    const components = []
    for (const child of this.children) {
      if (child.__node === PART) {
        components.push(...resolvePlaced(child, R, idGen))
      } else if (child.__node === GROUP_NODE) {
        components.push(...resolveGroup(child, R, idGen))
      } else {
        throw new Error('wha-lang: circle children must be SIGIL/SIGN parts or GROUP placements.')
      }
    }

    return {
      id: this.id,
      name: this.opts.name || '',
      center: this.center,
      radius: this.radius ?? null,
      ring: { closed: this.ringClosed, size: this.opts.size || 'medium' },
      core,
      components,
      dyes: this.dyes,
      linkCount: this.opts.linkCount || 0,
    }
  }
}

// CIRCLE(coreOrOpts, ...children). coreOrOpts may be an options object ({ radius, core, ... })
// or, for the spec's `circle NAME { core X; ... }` shorthand, a string id + opts.
export function CIRCLE(a, b, ...rest) {
  if (typeof a === 'string') {
    // CIRCLE("name", { opts }, ...children)
    if (b && b.kind === undefined && b.__node === undefined && !Array.isArray(b) && typeof b === 'object') {
      return new Circle(a, b, rest)
    }
    // CIRCLE("name", ...children) — no opts
    return new Circle(a, {}, [b, ...rest].filter(Boolean))
  }
  // CIRCLE({ opts }, ...children)
  return new Circle(a, b, rest)
}

// ---------------------------------------------------------------------------
// SPELL — the circle graph (spec §8). Holds circles + relations and emits the IR.
// ---------------------------------------------------------------------------

class Spell {
  constructor(name) {
    this._name = name || ''
    this.circles = []
    this.relations = []
  }

  name(str) {
    this._name = str
    return this
  }

  _register(circle) {
    if (!this.circles.includes(circle)) this.circles.push(circle)
    return circle
  }

  // nest(inner, outer-less form): the spec writes `nest A in B` (B encloses A). Our builder
  // method nest(inner, outer) — to match `.nest(inner)` on a spell that already has a base,
  // we support both .nest(inner, outer) and the relation-add form.
  nest(inner, outer) {
    this._register(inner)
    if (outer) this._register(outer)
    this.relations.push({ type: 'nest', outer: outer.id, inner: inner.id })
    return this
  }

  // stack(...innermostFirst): sugar for the linear chain nest A in B; nest B in C; … with
  // auto-ascending radii (clustered toward the rim) when a circle omits its radius.
  stack(...circles) {
    const chain = circles.filter(Boolean)
    chain.forEach((c) => this._register(c))
    // Auto-assign ascending radii where omitted (innermost smallest). Bunch toward the rim:
    // pick a base and step so borders crowd outward (canon borders bunch).
    const anyMissing = chain.some((c) => c.radius == null)
    if (anyMissing) {
      const base = 140
      const step = 33
      chain.forEach((c, i) => {
        if (c.radius == null) c.radius = base + i * step
      })
    }
    for (let i = 0; i < chain.length - 1; i++) {
      this.relations.push({ type: 'nest', outer: chain[i + 1].id, inner: chain[i].id })
    }
    return this
  }

  link(a, b) {
    this._register(a)
    this._register(b)
    this.relations.push({ type: 'link', a: a.id, b: b.id })
    return this
  }

  toggle(a, b) {
    this._register(a)
    this._register(b)
    this.relations.push({ type: 'toggle', a: a.id, b: b.id })
    return this
  }

  // cluster(unit, count, opts): place whole CIRCLES at computed offset centers (the §6 resolver,
  // unit = a circle) and auto-wire them. Default wiring: nest each placed circle in `unit` if
  // `opts.into` is given, else link them together. (spec §8 G3)
  cluster(unit, count, opts = {}) {
    return this._arrayLike(unit, count, opts, 'cluster')
  }

  // array(unit, opts): like cluster but reads count/anchors from opts (a line/ring of circles).
  array(unit, opts = {}) {
    const count = opts.count ?? 1
    return this._arrayLike(unit, count, opts, 'array')
  }

  _arrayLike(unit, count, opts, mode) {
    this._register(unit)
    const R = opts.spacing ?? unit.radius ?? 170
    const atTok = opts.at ?? RING
    const spread = opts.spread ?? 18
    const angles = resolveAngles(atTok, count, spread)
    const rPx = resolveRadiusPx(opts.radius, R, AUTO)
    const placed = []
    angles.forEach((theta, i) => {
      const { x, y } = polarToXY(theta, rPx)
      // Clone the unit circle at the offset center.
      const clone = CIRCLE({ ...unit.opts, center: { x, y } })
      clone.children = unit.children
      clone.radius = unit.radius
      clone.ringClosed = unit.ringClosed
      clone.coreNode = unit.coreNode
      clone.dyes = unit.dyes
      clone.id = `${unit.id}_${mode}${i}`
      this._register(clone)
      placed.push(clone)
    })
    // Auto-wire: nest into a parent if given; otherwise link the placed circles to the unit.
    if (opts.into) {
      this._register(opts.into)
      for (const p of placed) this.relations.push({ type: 'nest', outer: opts.into.id, inner: p.id })
    } else {
      for (const p of placed) this.relations.push({ type: 'link', a: unit.id, b: p.id })
    }
    return this
  }

  // Emit the wha-spell IR. Single circle + no relations ⇒ wha-spell@1; else wha-spell@2.
  emit() {
    // Make sure any circle referenced only via relations is registered.
    const compiled = this.circles.map((c) => c.compile())
    if (compiled.length === 1 && this.relations.length === 0) {
      const c = compiled[0]
      return {
        format: 'wha-spell@1',
        version: 1,
        composition: {
          name: this._name,
          ring: { closed: c.ring.closed, size: c.ring.size },
          core: c.core,
          components: c.components,
          linkCount: c.linkCount,
          dyes: c.dyes,
        },
      }
    }
    return {
      format: 'wha-spell@2',
      name: this._name,
      circles: compiled,
      relations: this.relations,
    }
  }
}

export function SPELL(name) {
  return new Spell(name)
}

// Reset the circle id sequence (useful for deterministic tests).
export function __resetIds() {
  CIRCLE_SEQ = 0
}
