// recognizerWorker.js — Web Worker entry for the $P recognizer pipeline.
//
// Invariant: recognizer.js stays PURE (no Worker/DOM).  This file is the thin
// browser-aware shell that wraps it.  The message logic is factored into the
// exported PURE function `handleWorkerMessage` so it can be unit-tested under
// node --test without a real Worker or `self`.
//
// Protocol:
//   {type:'setTemplates', token, templates}
//       → builds clouds for `templates` and caches them under `token`.
//         Evicts any previously cached token (keeps memory bounded to 1 entry).
//         Replies with {type:'ack', token} so the hook knows the cache is warm.
//
//   {type:'recognize', reqId, token, strokes, opts}
//       → looks up the cached clouds for `token`, runs analyzeStrokes, and
//         replies with {type:'result', reqId, result}.
//         If the token is not in cache: replies {type:'result', reqId, error:'no-templates'}.

import { analyzeStrokes, buildClouds } from './recognizer.js'

// ─────────────────────────────────────────────────────────────────────────────
// Pure message handler — NO self / postMessage inside; fully testable under Node.
//
// @param {{ cache: Map<string, ReturnType<buildClouds>> }} state
//   Mutable state object shared across calls.  Pass `{ cache: new Map() }` once.
// @param {{ type: string, [key: string]: unknown }} msg
//   Structured-clone of the worker message data.
// @returns {{ state: typeof state, reply: object | null }}
//   `reply` is the message to postMessage back (null = no reply for this msg).
// ─────────────────────────────────────────────────────────────────────────────
export function handleWorkerMessage(state, msg) {
  const { type } = msg

  if (type === 'setTemplates') {
    const { token, templates } = msg
    // Evict all other tokens first (one active token is all we ever need).
    for (const k of state.cache.keys()) {
      if (k !== token) state.cache.delete(k)
    }
    state.cache.set(token, buildClouds(templates))
    return { state, reply: { type: 'ack', token } }
  }

  if (type === 'recognize') {
    const { reqId, token, strokes, opts = {} } = msg
    const clouds = state.cache.get(token)
    if (!clouds) {
      return { state, reply: { type: 'result', reqId, error: 'no-templates' } }
    }
    const result = analyzeStrokes(strokes, null, { ...opts, clouds })
    return { state, reply: { type: 'result', reqId, result } }
  }

  // Unknown message type — no reply.
  return { state, reply: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker shell — only runs in a real Worker context (not in node --test).
// Guards against environments where `self` is undefined or not a WorkerGlobalScope.
// ─────────────────────────────────────────────────────────────────────────────
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  const state = { cache: new Map() }
  self.onmessage = (e) => {
    const { reply } = handleWorkerMessage(state, e.data)
    if (reply) self.postMessage(reply)
  }
}
