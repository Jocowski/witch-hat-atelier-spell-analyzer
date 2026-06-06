// recognizerEngine.js — async dispatcher for the recognizer engine seam (M1, SPEC-ml-recognizer.md).
//
// Reads `opts.engine` (default "p") and routes to the appropriate back-end:
//
//   "p"  → the caller-supplied `runP()` callback, which executes the existing $P pipeline
//          (worker or sync — the dispatcher doesn't care).  Wraps the result in a Promise so
//          the call site always gets an async boundary.
//
//   "ml" → lazily imports `./mlRecognizer.js` (so the onnx bundle is NEVER loaded for "p" users)
//          and delegates.  Until M4, that file does not exist; the import will throw, which is
//          caught and re-thrown as a clear "not built yet" error.
//
// Node-safe: no top-level impure imports (no JSON/DOM/onnx/fetch).
// The ml import is dynamic, conditional, and never runs on the "p" branch — safe for node --test.

/**
 * Return the engine name from opts (default "p").
 * @param {{ engine?: string }} opts
 * @returns {string}
 */
export function recognizerEngineName(opts) {
  return (opts && opts.engine) ? opts.engine : 'p'
}

/**
 * Route a recognition call through the configured engine.
 *
 * @param {{ strokes: Array, opts: object, runP: () => unknown }} params
 *   - `strokes`  the raw stroke array (forwarded to the ml engine if needed)
 *   - `opts`     the full options object passed by the caller (must carry `opts.engine`)
 *   - `runP`     a zero-argument callback that executes the existing $P path and returns its result
 *                (may be synchronous — wrapped in Promise.resolve here)
 * @returns {Promise<unknown>}  always a Promise; "p" resolves with the $P result, "ml" delegates
 */
export async function recognizeWithEngine({ strokes, opts, runP }) {
  const engine = recognizerEngineName(opts)

  if (engine === 'p') {
    // $P path — invoke the caller's callback and wrap synchronous results.
    return runP()
  }

  if (engine === 'ml') {
    // Lazy import: only executed when engine:"ml" is requested.
    // mlRecognizer.js does not exist yet (ships in M4); catch the import failure and throw
    // a clear, actionable error so callers see a useful message instead of a module-not-found stack.
    let mod
    try {
      mod = await import('./mlRecognizer.js')
    } catch {
      throw new Error('ml recognizer engine not built yet (Phase M4)')
    }
    return mod.recognizeWithMl({ strokes, opts, runP })
  }

  throw new Error(`recognizerEngine: unknown engine "${engine}" (expected "p" or "ml")`)
}
