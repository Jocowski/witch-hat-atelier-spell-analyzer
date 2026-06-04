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

/**
 * toComposition(model, opts) → wha-spell@2 object
 *
 * Converts the Studio's canvas state into a single-circle wha-spell@2 composition.
 *
 * model:  StudioModel (see type above)
 * opts: {
 *   isSigil(type: string) → bool   — injected predicate; returns true when `type` is a sigil id.
 *                                     Keeps this module JSON-free (no direct sigils.json import).
 * }
 *
 * Placement rules:
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

  // Split placed into sigils and signs.
  // A placed item is treated as a sigil if kind==='sigil' OR isSigil(type) returns true.
  const isItemSigil = (item) => item.kind === 'sigil' || isSigil(item.type)
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
      rotation: g.match.rotation ?? 0,
      scale:    1,
      inverted: false,
    }))
}
