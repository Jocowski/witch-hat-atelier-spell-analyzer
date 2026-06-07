// drawingModel.js — PURE: Studio canvas state → wha-spell@2 composition.
// No JSON imports, no DOM, no React — runs under plain `node --test`.
// Data dependencies (isSigil) are injected as function arguments.
//
// The Studio canvas holds two kinds of content:
//   • Drawn strokes  — raw paint (brush/shape), handed to the $P recognizer separately.
//   • Placed symbols — known signs/sigils dragged from the palette (already identified).
//
// toComposition() only maps the PLACED symbols + ring + dyes into a v2 composition.
// The recognizer handles drawn strokes independently; the caller merges both results.

// ---------- types (JSDoc reference, not runtime) ----------
//
// StudioModel = {
//   name?:      string,
//   strokes:    [{ tool, color, width, points:[{x,y}] }],   // drawn strokes (recognizer input)
//   placed:     [{ id, kind:'sign'|'sigil', type, x, y, rotation, scale, inverted }],
//   ringStroke?: any,      // presence implies ring is drawn (truthy = closed)
//   ringClosed?: bool,     // explicit override (e.g. toolbar toggle)
//   dyes:       [dyeId],
// }
//
// wha-spell@2 circle = {
//   id, center:{x,y}, radius, ring:{closed}, core, components:[...], dyes:[dyeId]
// }
// core      = { id, type, x:0, y:0, rotation, scale, inverted }
// component = { id, type, role:'sign'|'sigil', x, y, rotation, scale, inverted }

const DEFAULT_RADIUS = 170 // fallback when no placed symbols exist

// ---------- single-circle builder (shared by both paths) ----------

/**
 * Build a single wha-spell@2 circle descriptor for a set of placed items relative to a center.
 *
 * @param {Array}    placed      placed items for this ring (already assigned)
 * @param {Function} isItemSigil predicate: (item) → bool
 * @param {{x,y}}    center      ring center in world coords (components become relative to it)
 * @param {number}   radius      ring radius (px)
 * @param {boolean}  ringClosed  whether the ring stroke is closed
 * @param {string}   id          circle id ('k0', 'k1', …)
 * @param {string[]} dyes        dye ids for this circle
 */
function buildCircleDescriptor(placed, isItemSigil, center, radius, ringClosed, id, dyes) {
  const sigils = placed.filter(isItemSigil)
  const signs  = placed.filter((item) => !isItemSigil(item))

  let coreSigil = null
  if (sigils.length > 0) {
    coreSigil = sigils.reduce((nearest, item) => {
      const d  = Math.hypot((item.x || 0) - center.x, (item.y || 0) - center.y)
      const dn = Math.hypot((nearest.x || 0) - center.x, (nearest.y || 0) - center.y)
      return d < dn ? item : nearest
    })
  }

  const core = coreSigil
    ? {
        id:       coreSigil.id   || coreSigil.type,
        type:     coreSigil.type,
        x:        0,
        y:        0,
        rotation: coreSigil.rotation ?? 0,
        scale:    coreSigil.scale    ?? 1,
        inverted: !!coreSigil.inverted,
      }
    : null

  const otherSigils = sigils.filter((s) => s !== coreSigil)
  const components = [
    ...otherSigils.map((item) => ({
      id:       item.id   || item.type,
      type:     item.type,
      role:     'sigil',
      x:        (item.x ?? 0) - center.x,
      y:        (item.y ?? 0) - center.y,
      rotation: item.rotation ?? 0,
      scale:    item.scale    ?? 1,
      inverted: !!item.inverted,
    })),
    ...signs.map((item) => ({
      id:       item.id   || item.type,
      type:     item.type,
      role:     'sign',
      x:        (item.x ?? 0) - center.x,
      y:        (item.y ?? 0) - center.y,
      rotation: item.rotation ?? 0,
      scale:    item.scale    ?? 1,
      inverted: !!item.inverted,
      ...(item.metrics ? { metrics: item.metrics } : {}),
    })),
  ]

  return { id, center: { x: Math.round(center.x), y: Math.round(center.y) }, radius, ring: { closed: ringClosed }, core, components, dyes }
}

/**
 * toComposition(model, opts) → wha-spell@2 object
 *
 * Converts the Studio's canvas state into a wha-spell@2 composition.
 * Single-ring case: output is BIT-IDENTICAL to the previous implementation (back-compat).
 * Multi-ring case: delegates to buildMultiComposition (Track 5, SPEC-nested-linked.md §5.4).
 *
 * model:  StudioModel (see type above), extended for multi-ring:
 *   model.rings?:           [{cx,cy,r,closed,id}]  — detected ring descriptors
 *   model.ringAssignments?: { [placedId]: number }  — which ring index each placed item belongs to
 *   model.relations?:       [{type,…}]              — nest/link relations from the recognizer
 *
 * opts: {
 *   isSigil(type: string) → bool   — injected predicate; returns true when `type` is a sigil id.
 *                                     Keeps this module JSON-free (no direct sigils.json import).
 * }
 *
 * Placement rules (single-ring, unchanged):
 *   - Among all placed items whose kind === 'sigil' (or isSigil(type) is true), the one
 *     nearest the origin (0,0) becomes the `core` (placed at x:0,y:0 in the composition).
 *   - Other sigils become `components` with role:'sigil'.
 *   - All items with kind === 'sign' become `components` with role:'sign'.
 *   - `radius` is derived from the farthest placed symbol's distance from origin; falls back
 *     to DEFAULT_RADIUS (170) when there are no placed symbols.
 *   - `ring.closed` is true when ringStroke is truthy OR model.ringClosed is true.
 */
export function toComposition(model, opts = {}) {
  const { isSigil = () => false } = opts
  const placed = model.placed || []
  const dyes   = model.dyes   || []
  const isItemSigil = (item) => item.kind === 'sigil' || isSigil(item.type)

  // Multi-ring path: when the model carries explicit ring descriptors (from the recognizer)
  if (Array.isArray(model.rings) && model.rings.length > 1) {
    return buildMultiComposition(model, isItemSigil, opts)
  }

  // ---------- Single-ring path (unchanged from before) ----------

  const sigils = placed.filter(isItemSigil)
  const signs  = placed.filter((item) => !isItemSigil(item))

  // Derive radius: farthest placed symbol distance from origin, or DEFAULT_RADIUS.
  let radius = DEFAULT_RADIUS
  if (placed.length > 0) {
    const farthest = placed.reduce((max, item) => {
      const d = Math.hypot(item.x || 0, item.y || 0)
      return d > max ? d : max
    }, 0)
    // Only use computed radius when it is meaningful (> 0); pad slightly so symbols sit inside ring.
    if (farthest > 0) radius = Math.round(farthest * 1.25)
  }

  // Find the core sigil: the sigil placed nearest the origin.
  let coreSigil = null
  if (sigils.length > 0) {
    coreSigil = sigils.reduce((nearest, item) => {
      const d  = Math.hypot(item.x || 0, item.y || 0)
      const dn = Math.hypot(nearest.x || 0, nearest.y || 0)
      return d < dn ? item : nearest
    })
  }

  // Build core (placed at 0,0 — the engine expects the primary sigil at the center).
  const core = coreSigil
    ? {
        id:       coreSigil.id   || coreSigil.type,
        type:     coreSigil.type,
        x:        0,
        y:        0,
        rotation: coreSigil.rotation ?? 0,
        scale:    coreSigil.scale    ?? 1,
        inverted: !!coreSigil.inverted,
      }
    : null

  // Build components: remaining sigils + all signs.
  const otherSigils = sigils.filter((s) => s !== coreSigil)

  const components = [
    ...otherSigils.map((item) => ({
      id:       item.id   || item.type,
      type:     item.type,
      role:     'sigil',
      x:        item.x        ?? 0,
      y:        item.y        ?? 0,
      rotation: item.rotation ?? 0,
      scale:    item.scale    ?? 1,
      inverted: !!item.inverted,
    })),
    ...signs.map((item) => ({
      id:       item.id   || item.type,
      type:     item.type,
      role:     'sign',
      x:        item.x        ?? 0,
      y:        item.y        ?? 0,
      rotation: item.rotation ?? 0,
      scale:    item.scale    ?? 1,
      inverted: !!item.inverted,
      ...(item.metrics ? { metrics: item.metrics } : {}),
    })),
  ]

  // Ring: closed when a ringStroke exists or the explicit ringClosed flag is set.
  const ringClosed = !!(model.ringStroke || model.ringClosed)

  return {
    format:  'wha-spell@2',
    name:    model.name || '',
    circles: [
      {
        id:         'k0',
        center:     { x: 0, y: 0 },
        radius,
        ring:       { closed: ringClosed },
        core,
        components,
        dyes,
      },
    ],
    relations: [],
  }
}

/**
 * buildMultiComposition(model, isItemSigil, opts) → wha-spell@2
 *
 * Multi-ring path (Track 5, SPEC-nested-linked.md §5.4).
 * Called by toComposition when model.rings has more than one entry.
 *
 * The model must carry:
 *   model.rings           — [{id, cx, cy, r, closed}] from the recognizer
 *   model.ringAssignments — {[placedId]: ringIndex} mapping each placed item to a ring
 *   model.relations       — [{type:'nest'|'link', …}] from the recognizer
 *
 * Per-circle component coordinates are relative to THAT ring's center (compose.js convention).
 * The global dyes list is assigned to circle k0 (back-compat); per-ring dyes can be added later.
 *
 * This function is also exported so callers (tests, CLI tools) can invoke it directly.
 */
export function buildMultiComposition(model, isItemSigil, _opts = {}) {
  const placed    = model.placed    || []
  const rings     = model.rings     || []
  const relations = model.relations || []
  const dyes      = model.dyes      || []
  const assignments = model.ringAssignments || {}

  const circles = rings.map((ring, ri) => {
    // Collect placed items for this ring
    const ringPlaced = placed.filter((item) => {
      const id = item.id || item.type
      if (id in assignments) return assignments[id] === ri
      // Fallback: assign by proximity (innermost enclosing ring)
      return ri === rings.reduce((bestIdx, r, i) => {
        const d = Math.hypot((item.x || 0) - r.cx, (item.y || 0) - r.cy)
        const bestD = Math.hypot((item.x || 0) - rings[bestIdx].cx, (item.y || 0) - rings[bestIdx].cy)
        return d < bestD ? i : bestIdx
      }, 0)
    })

    // Derive radius from ring descriptor; fall back to placed-symbol distance or DEFAULT_RADIUS.
    let radius = ring.r ?? DEFAULT_RADIUS
    if (!ring.r && ringPlaced.length > 0) {
      const farthest = ringPlaced.reduce((max, item) => {
        const d = Math.hypot((item.x || 0) - ring.cx, (item.y || 0) - ring.cy)
        return d > max ? d : max
      }, 0)
      if (farthest > 0) radius = Math.round(farthest * 1.25)
    }

    const ringDyes = ri === 0 ? dyes : []   // global dyes go to k0; per-ring dyes are a future feature

    return buildCircleDescriptor(
      ringPlaced, isItemSigil,
      { x: ring.cx, y: ring.cy },
      Math.round(radius),
      !!ring.closed,
      ring.id || `k${ri}`,
      ringDyes,
    )
  })

  return {
    format:    'wha-spell@2',
    name:      model.name || '',
    circles,
    relations,
  }
}

/**
 * recognizedToPlaced(groups) → placed[]
 *
 * Helper: converts $P recognizer output groups (from recognizer.analyzeStrokes)
 * into the placed[] format that drawingModel understands, so callers can merge
 * recognized strokes with manually-placed symbols.
 *
 * groups: [{ role:'core'|'sign', cx, cy, match:{name}, match.rotation }]
 * Returns: [{ id, kind:'sign'|'sigil', type, x, y, rotation, scale, inverted }]
 *
 * NOTE: The recognizer does not emit sigil/sign kind metadata — role:'core' maps to
 * kind:'sigil' and role:'sign' maps to kind:'sign'. Callers should validate against
 * the registry if available.
 */
export function recognizedToPlaced(groups) {
  return groups
    .filter((g) => g.match)
    .map((g) => ({
      id:       g.match.name,
      kind:     g.role === 'core' ? 'sigil' : 'sign',
      type:     g.match.name,
      x:        Math.round(g.cx || 0),
      y:        Math.round(g.cy || 0),
      // Prefer the geometry-derived facing (where the sign actually points); fall back to the
      // recognizer's template-alignment rotation only when geometry wasn't computed.
      rotation: typeof g.facing === 'number' ? g.facing : (g.match.rotation ?? 0),
      scale:    1,
      inverted: false,
      // Carry the drawn directional magnitude (stem length) so the einlair flow weights by length.
      ...(g.metrics ? { metrics: g.metrics } : {}),
    }))
}
