/**
 * src/ai/report.js — browser client for the AI multi-topic streaming report.
 *
 * The bridge endpoint POST /report/stream is a Server-Sent Events stream.
 * Because the payload (composition JSON) can be large we can't use a plain
 * EventSource (GET only), so we POST with fetch and read the SSE frames from
 * the response body reader manually.
 *
 * Exports:
 *   streamReport({ bridgeUrl, composition, topics, onCard, onDone, onError })
 *   getTopics(bridgeUrl)  → Promise<Array<{ id, title, prompt }>>
 */

/**
 * Fetch the topic catalog from the bridge.
 *
 * @param {string} bridgeUrl  e.g. "http://localhost:8787"
 * @returns {Promise<Array<{ id: string, title: string, prompt: string }>>}
 */
export async function getTopics(bridgeUrl) {
  const res = await fetch(`${bridgeUrl}/report/topics`)
  if (!res.ok) throw new Error(`/report/topics returned ${res.status}`)
  return res.json()
}

/**
 * Open a streaming AI report for a spell composition.
 *
 * Sends POST /report/stream with the composition + optional topic filter,
 * then parses the SSE frames and dispatches callbacks as each card arrives.
 *
 * @param {object}   opts
 * @param {string}   opts.bridgeUrl    Base URL of the ai-bridge (no trailing slash).
 * @param {object}   opts.composition  The wha-spell composition object.
 * @param {string[]} [opts.topics]     Array of topic ids to request (default: all).
 * @param {function} opts.onCard       Called with { id, title, markdown } or { id, title, error }
 *                                     each time a topic resolves.
 * @param {function} [opts.onDone]     Called with no arguments when the stream ends.
 * @param {function} [opts.onError]    Called with an Error if the fetch or stream fails fatally.
 * @returns {Promise<void>}  Resolves when the stream ends (or rejects on a fatal error if
 *                           onError is not provided).
 */
export async function streamReport({ bridgeUrl, composition, topics, onCard, onDone, onError }) {
  let response
  try {
    response = await fetch(`${bridgeUrl}/report/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ composition, topics }),
    })
  } catch (err) {
    const wrapped = new Error(`AI bridge unreachable: ${err.message}`)
    if (onError) { onError(wrapped); return }
    throw wrapped
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const err = new Error(`/report/stream responded ${response.status}: ${text}`)
    if (onError) { onError(err); return }
    throw err
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE frames are separated by double newlines (\n\n).
      const frames = buffer.split('\n\n')
      // Keep the last (potentially incomplete) chunk in the buffer.
      buffer = frames.pop()

      for (const frame of frames) {
        if (!frame.trim()) continue

        let eventName = 'message'
        let dataLine = ''

        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) {
            eventName = line.slice('event:'.length).trim()
          } else if (line.startsWith('data:')) {
            dataLine = line.slice('data:'.length).trim()
          }
        }

        if (!dataLine) continue

        let payload
        try {
          payload = JSON.parse(dataLine)
        } catch {
          // Malformed frame — skip.
          continue
        }

        if (eventName === 'topic') {
          onCard?.(payload)
        } else if (eventName === 'done') {
          onDone?.()
          return
        } else if (eventName === 'error') {
          const err = new Error(payload.error || 'Unknown stream error')
          if (onError) { onError(err); return }
          throw err
        }
      }
    }

    // Stream ended without an explicit 'done' event — still consider it complete.
    onDone?.()
  } catch (err) {
    if (onError) { onError(err) } else { throw err }
  } finally {
    reader.cancel().catch(() => {})
  }
}
