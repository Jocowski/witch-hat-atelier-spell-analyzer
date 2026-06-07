// src/domain/ — the PURE reasoning core (invariant I1): no React, JSON, CSS, DOM, Supabase, or onnx.
// engine/ = spell validity/deduction/geometry/matching/IR + symbol overlay merge; recognizer/ = the
// $P point-cloud recognizer + ring/raster/embed/path math. Every module here is unit-tested under
// `node --test` and reused by the CLI. JSON/DB binding lives one layer up (src/services/symbols/).
//
// Namespaced re-exports (collision-proof) so consumers can `import { engine } from '#domain'` if they
// prefer; most call sites import the specific module directly (e.g. `#domain/engine/geometry.js`).
export * as geometry from './engine/geometry.js'
export * as deduce from './engine/deduce.js'
export * as compose from './engine/compose.js'
export * as match from './engine/match.js'
export * as ir from './engine/ir.js'
export * as symbolMerge from './engine/symbolMerge.js'
export * as recognizer from './recognizer/recognizer.js'
export * as ringClosure from './recognizer/ringClosure.js'
export * as rasterMatch from './recognizer/rasterMatch.js'
export * as embed from './recognizer/embed.js'
export * as svgPath from './recognizer/svgPath.js'
export * as glyphRasterizer from './recognizer/glyphRasterizer.js'
