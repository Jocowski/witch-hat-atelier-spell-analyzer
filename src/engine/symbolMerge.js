// TRANSITIONAL SHIM (refactor Phase 2 → removed in Phase 8). Re-exports the module from its new
// home under src/domain/. Lets existing importers keep their old path until they migrate to #domain/*.
export * from '../domain/engine/symbolMerge.js'
