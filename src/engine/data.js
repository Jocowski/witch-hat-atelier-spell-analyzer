// TRANSITIONAL SHIM (refactor Phase 3 → removed in Phase 8). Moved to src/services/symbols/data.js.
// NOTE: data.js exports LIVE `let` bindings (SIGILS/SIGNS/SIGIL_MAP/SIGN_MAP) re-pointed on overlay
// change (invariant I2). `export *` re-exports are live per the ESM spec (verified under Node + Vite),
// so importers via this shim still observe overlay updates. Read these at call/render time, not capture.
export * from '../services/symbols/data.js'
