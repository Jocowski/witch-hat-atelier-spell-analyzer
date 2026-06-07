// symbolMerge.js — overlay DB `symbols` rows onto the JSON symbol baseline.
//
// PURE: no JSON imports, no DOM. Takes the baseline ({ sigils, signs, grammar }) and the DB rows, and
// returns a NEW merged { sigils, signs, grammar } without mutating the baseline. This is what makes
// the Admin registry drive the drawing app: presentation (svgPath/family) + semantics (operator/
// element) are overlaid here, then the store (symbolStore.js) feeds the palette + engine.
//
// Kept JSON/DOM-free so it runs under `node --test` (mirrors the deduce.js/geometry.js convention).
//
// Per-row contract (a `symbols` row, snake_case from Postgres):
//   { kind:'sign'|'sigil', name, label?, engine_id?,
//     svg_path?, render?, family?,                                   ← presentation
//     effect_tags?, invertible?, can_be_center?, surrounds?,         ← sign semantics
//     op_kind?, op_verb?, op_inverted_verb?, op_directional?, op_default_direction?,  ← sign operator
//     operator_kind?,                                                ← legacy op kind (fallback)
//     element?, substance?, substance_raw?, substance_qualities? }   ← sigil semantics
// Only NON-NULL fields overlay; everything else falls through to the JSON baseline.

const def = (v) => v !== null && v !== undefined

// Presentation/semantic overlay for a sigil OR sign entry (only provided fields).
function entryOverlay(row) {
  const o = {}
  if (def(row.svg_path)) { o.svgPath = row.svg_path }
  if (def(row.render)) { o.render = row.render }
  if (def(row.family)) { o.family = row.family }
  if (def(row.label) || def(row.name)) { o.name = row.label || row.name }
  // sign-only fields (harmless on a sigil entry, but we only call this per-kind anyway)
  if (def(row.effect_tags)) { o.effectTags = row.effect_tags }
  if (def(row.invertible)) { o.invertible = row.invertible }
  if (def(row.can_be_center)) { o.canBeCenter = row.can_be_center }
  if (def(row.surrounds)) { o.surrounds = row.surrounds }
  // sigil-only
  if (def(row.element)) { o.element = row.element }
  return o
}

// Build a grammar operator object from a sign row, or null when there isn't enough to deduce with.
function operatorFrom(row, existing) {
  const kind = def(row.op_kind) ? row.op_kind : row.operator_kind
  const verb = def(row.op_verb) ? row.op_verb : existing?.verb
  if (!def(kind) || !def(verb)) return null // not enough → leave baseline operator (if any) untouched
  const op = { ...(existing || {}), kind, verb }
  if (def(row.op_inverted_verb)) { op.invertedVerb = row.op_inverted_verb }
  if (def(row.op_directional)) { op.directional = row.op_directional }
  if (def(row.op_default_direction)) { op.defaultDirection = row.op_default_direction }
  return op
}

// Build a grammar element object from a sigil row, or null when nothing element-related is provided.
function elementFrom(row, existing) {
  if (!def(row.substance) && !def(row.substance_raw) && !def(row.substance_qualities)) return null
  const el = { ...(existing || {}) }
  if (def(row.substance)) { el.substance = row.substance }
  if (def(row.substance_raw)) { el.raw = row.substance_raw }
  if (def(row.substance_qualities)) { el.qualities = row.substance_qualities }
  return el
}

// Upsert an overlay onto an array of entries by id (returns a new array; never mutates input entries).
function upsert(arr, id, kind, overlay) {
  const out = arr.slice()
  const i = out.findIndex((e) => e.id === id)
  if (i >= 0) {
    out[i] = { ...out[i], ...overlay }
  } else {
    out.push({ id, kind, name: overlay.name || id, ...overlay })
  }
  return out
}

/**
 * @param {{ sigils:Array, signs:Array, grammar:object }} baseline
 * @param {Array<object>} dbRows  symbols table rows (snake_case)
 * @returns {{ sigils:Array, signs:Array, grammar:object }}  merged copy
 */
export function mergeSymbols(baseline, dbRows = []) {
  let sigils = baseline.sigils.slice()
  let signs = baseline.signs.slice()
  const operators = { ...(baseline.grammar.operators || {}) }
  const elements = { ...(baseline.grammar.elements || {}) }

  for (const row of dbRows || []) {
    if (!row) continue
    const id = row.engine_id || row.name
    if (!id) continue
    const overlay = entryOverlay(row)

    if (row.kind === 'sigil') {
      sigils = upsert(sigils, id, 'sigil', overlay)
      const elId = def(row.element) ? row.element : sigils.find((e) => e.id === id)?.element
      if (def(elId)) {
        const el = elementFrom(row, elements[elId])
        if (el) { elements[elId] = el }
      }
    } else {
      signs = upsert(signs, id, 'sign', overlay)
      const op = operatorFrom(row, operators[id])
      if (op) { operators[id] = op }
    }
  }

  return {
    sigils,
    signs,
    grammar: { ...baseline.grammar, operators, elements },
  }
}
