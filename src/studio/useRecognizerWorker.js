// useRecognizerWorker.js — React hook that runs the $P recognizer in a Web Worker.
//
// Exposes:
//   recognizeAsync(strokes, opts) → Promise<analyzeStrokes result>
//
// Design:
//   • The worker is lazily constructed once (via Vite's new URL(…, import.meta.url) form
//     so the production/GitHub-Pages build picks it up as a separate chunk).
//   • When `templates` identity changes the hook sends a `setTemplates` message so clouds
//     are built once inside the worker (never shipped per call — see spec P4 "Cloud transfer
//     note").  The token is a monotonically incrementing integer derived from a ref.
//   • `recognizeAsync` posts a `recognize` message and returns a Promise that resolves on
//     the matching `{type:'result', reqId}` response.  A monotonically increasing `reqId`
//     lets the hook drop stale responses: any response older than the latest issued reqId
//     is silently discarded (a newer Detect supersedes an in-flight one).
//   • Fallback: if `typeof Worker === 'undefined'` OR construction throws, the hook runs
//     `analyzeStrokes` synchronously and returns a resolved Promise — identical result, just
//     blocking.  P1 clouds (passed via opts) are used on the sync path too.

import { useRef, useEffect, useCallback } from 'react'
import { analyzeStrokes, buildClouds } from '../draw/recognizer.js'

// ─────────────────────────────────────────────────────────────────────────────

export function useRecognizerWorker(templates, clouds) {
  // Worker instance (null when unavailable or not yet constructed).
  const workerRef = useRef(null)
  // Is the worker available and initialised (not fallen back to sync)?
  const workerOkRef = useRef(false)

  // Pending request map: reqId → { resolve, reject }
  const pendingRef = useRef(new Map())

  // Monotonically increasing request id counter.
  const reqIdRef = useRef(0)
  // The latest issued reqId — responses older than this are stale and dropped.
  const latestReqIdRef = useRef(0)

  // Token for the current templates identity (incremented each time templates changes).
  const tokenRef = useRef(0)
  const prevTemplatesRef = useRef(null)

  // ── Worker construction (once) ────────────────────────────────────────────
  useEffect(() => {
    if (typeof Worker === 'undefined') return   // SSR / old webview — stay on sync path

    try {
      const w = new Worker(
        new URL('../draw/recognizerWorker.js', import.meta.url),
        { type: 'module' },
      )

      w.onmessage = (e) => {
        const msg = e.data
        if (msg.type === 'result') {
          const { reqId } = msg
          // Drop stale responses (from superseded Detect calls).
          if (reqId < latestReqIdRef.current) return
          const pending = pendingRef.current.get(reqId)
          if (!pending) return
          pendingRef.current.delete(reqId)
          if (msg.error) {
            pending.reject(new Error(msg.error))
          } else {
            pending.resolve(msg.result)
          }
        }
        // ack messages are informational — no pending promise to resolve.
      }

      w.onerror = (err) => {
        console.error('[recognizerWorker] worker error', err)
        // Reject all pending promises and fall back to the sync path.
        for (const { reject } of pendingRef.current.values()) reject(err)
        pendingRef.current.clear()
        workerOkRef.current = false
      }

      workerRef.current = w
      workerOkRef.current = true
    } catch (err) {
      console.warn('[recognizerWorker] could not construct Worker, using sync fallback', err)
    }

    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
      workerOkRef.current = false
      // eslint-disable-next-line react-hooks/exhaustive-deps -- pendingRef is a stable Map ref, captured to a local var intentionally
      const pending = pendingRef.current
      for (const { reject } of pending.values()) reject(new Error('worker terminated'))
      pending.clear()
    }
  }, [])   // run once on mount

  // ── Send setTemplates when templates identity changes ─────────────────────
  useEffect(() => {
    if (!workerOkRef.current || !workerRef.current) return
    if (templates === prevTemplatesRef.current) return   // identity unchanged
    prevTemplatesRef.current = templates
    tokenRef.current += 1
    workerRef.current.postMessage({
      type: 'setTemplates',
      token: tokenRef.current,
      templates,
    })
  })   // runs after every render; the identity check above makes it a no-op unless templates changed

  // ── recognizeAsync ────────────────────────────────────────────────────────
  const recognizeAsync = useCallback((strokes, opts = {}) => {
    const reqId = ++reqIdRef.current
    latestReqIdRef.current = reqId

    // ── Fallback: no worker available → synchronous path ──────────────────
    if (!workerOkRef.current || !workerRef.current) {
      try {
        // Use the P1 clouds memo passed in from StudioPage (same as the sync path did before P4).
        const result = analyzeStrokes(strokes, null, { ...opts, clouds: clouds ?? buildClouds([]) })
        return Promise.resolve(result)
      } catch (err) {
        return Promise.reject(err)
      }
    }

    // ── Worker path: if templates changed since last setTemplates, send now ──
    // (Handles the case where the first recognizeAsync fires before the useEffect above runs.)
    if (templates !== prevTemplatesRef.current) {
      prevTemplatesRef.current = templates
      tokenRef.current += 1
      workerRef.current.postMessage({
        type: 'setTemplates',
        token: tokenRef.current,
        templates,
      })
    }

    return new Promise((resolve, reject) => {
      // On `no-templates` error from the worker, fall back synchronously.
      const wrappedReject = (err) => {
        if (err && err.message === 'no-templates') {
          // Worker cache miss — rebuild clouds here and resolve synchronously.
          try {
            const result = analyzeStrokes(strokes, null, { ...opts, clouds: clouds ?? buildClouds(templates ?? []) })
            resolve(result)
          } catch (e2) {
            reject(e2)
          }
        } else {
          reject(err)
        }
      }
      pendingRef.current.set(reqId, { resolve, reject: wrappedReject })

      workerRef.current.postMessage({
        type: 'recognize',
        reqId,
        token: tokenRef.current,
        strokes,
        opts,
      })
    })
  }, [templates, clouds])   // recreate when either changes

  return { recognizeAsync }
}
