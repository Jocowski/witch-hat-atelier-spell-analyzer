/**
 * AIReportPanel.jsx — multi-topic streaming AI report for Spell Studio.
 *
 * Props:
 *   composition  : wha-spell composition object (passed to the bridge)
 *   engineResult : the object returned by analyze(composition) — used for the
 *                  AI-vs-engine disagreement check (item 3.5)
 *   bridgeUrl    : string (default VITE_AI_BRIDGE_URL or 'http://localhost:8787')
 */

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { getTopics, streamReport } from '../ai/report.js'
import { compositionHash, detectDisagreement } from '../ai/reportCache.js'
import { findCachedReport } from '../data-services/analyses.js'

const DEFAULT_BRIDGE = import.meta.env.VITE_AI_BRIDGE_URL || 'http://localhost:8787'

// ── Relative-time helper ──────────────────────────────────────────────────────

function relativeTime(isoString) {
  const ms = Date.now() - new Date(isoString).getTime()
  const s  = Math.floor(ms / 1000)
  if (s < 60)   return 'just now'
  const m = Math.floor(s  / 60)
  if (m < 60)   return `${m} min ago`
  const h = Math.floor(m  / 60)
  if (h < 24)   return `${h} h ago`
  const d = Math.floor(h  / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

// ── Confidence meter ──────────────────────────────────────────────────────────

function ConfidenceMeter({ value }) {
  const pct  = Math.round(value * 100)
  const tier = value >= 0.75 ? 'high' : value >= 0.4 ? 'mid' : 'low'
  return (
    <span
      className={`ai-confidence-meter conf-${tier}`}
      title={`AI confidence: ${pct}%`}
      aria-label={`AI confidence ${pct}%`}
    >
      <span className="conf-fill" style={{ width: `${pct}%` }} />
    </span>
  )
}

// ── Topic card ────────────────────────────────────────────────────────────────

function TopicCard({ topic, card, disagreement }) {
  const isLoading = card?.loading
  const hasError  = card?.error
  const markdown  = card?.markdown
  const confidence = card?.confidence   // number|null|undefined

  return (
    <div className={`ai-card${isLoading ? ' loading' : ''}${hasError ? ' error' : ''}`}>
      <div className="ai-card-header">
        <span className="ai-card-title">{topic.title}</span>
        {confidence != null && <ConfidenceMeter value={confidence} />}
        {disagreement && (
          <span
            className="ai-disagree-badge"
            title="The AI's deduced element or direction differs from the engine's deterministic reading. This may indicate a grammar gap."
          >
            AI disagrees with engine
          </span>
        )}
      </div>
      {isLoading && <div className="ai-card-spinner" aria-label="Loading">…</div>}
      {hasError  && <div className="ai-card-error">&#9888; {card.error}</div>}
      {markdown  && (
        <div className="ai-card-content">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function AIReportPanel({
  composition,
  engineResult,
  bridgeUrl = DEFAULT_BRIDGE,
}) {
  const [bridgeStatus, setBridgeStatus] = useState('checking') // 'checking' | 'up' | 'down'
  const [topics,       setTopics]        = useState([])
  const [selected,     setSelected]      = useState(new Set())
  const [running,      setRunning]       = useState(false)
  const [cards,        setCards]         = useState({})  // id → { loading, markdown, error, title, confidence, effectClaim }
  const [streamError,  setStreamError]   = useState(null)

  // 3.3 — session cache (Tier 1): Map<hash → { topicId → card }>
  const sessionCacheRef = useRef(new Map())
  // 3.3 — report metadata for the status line
  const [reportMeta, setReportMeta] = useState(null) // { fromCache, age?, tookMs?, hash }

  // ── bridge health check + topic fetch ────────────────────────────────────

  useEffect(() => {
    let alive = true
    setBridgeStatus('checking')
    setTopics([])
    setSelected(new Set())

    async function probe() {
      try {
        const hRes = await fetch(`${bridgeUrl}/health`)
        const h    = await hRes.json()
        if (!alive) return
        if (!h.ok || !h.claude) { setBridgeStatus('down'); return }
        setBridgeStatus('up')

        // fetch topics
        try {
          const tList = await getTopics(bridgeUrl)
          if (!alive) return
          setTopics(tList)
          setSelected(new Set(tList.map((t) => t.id)))
        } catch {
          // topics unavailable — bridge up but no topic endpoint yet
          setBridgeStatus('up')
        }
      } catch {
        if (alive) setBridgeStatus('down')
      }
    }

    probe()
    return () => { alive = false }
  }, [bridgeUrl])

  // ── run ───────────────────────────────────────────────────────────────────

  async function runReport({ forceRegenerate = false } = {}) {
    if (running || bridgeStatus !== 'up' || !composition) return
    setRunning(true)
    setStreamError(null)
    setReportMeta(null)

    const selectedIds = [...selected]
    const hash = compositionHash(composition, selectedIds)

    // Tier 1: session cache
    if (!forceRegenerate && sessionCacheRef.current.has(hash)) {
      const cached = sessionCacheRef.current.get(hash)
      setCards(cached)
      setReportMeta({ fromCache: true, age: 'this session', hash })
      setRunning(false)
      return
    }

    // Tier 2: Supabase persistence (best-effort, 1 s timeout)
    if (!forceRegenerate) {
      try {
        const row = await Promise.race([
          findCachedReport(hash),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1000)),
        ])
        if (row?.ai_report?.topics) {
          const { topics: topicMap } = row.ai_report
          // Rebuild the cards map from the stored shape.
          const rebuilt = {}
          for (const id of selectedIds) {
            const stored = topicMap[id]
            if (stored) {
              rebuilt[id] = {
                loading:     false,
                title:       topics.find((t) => t.id === id)?.title || id,
                markdown:    stored.markdown || null,
                error:       null,
                confidence:  stored.confidence ?? null,
                effectClaim: stored.effectClaim ?? null,
              }
            }
          }
          if (Object.keys(rebuilt).length > 0) {
            setCards(rebuilt)
            sessionCacheRef.current.set(hash, rebuilt)
            setReportMeta({ fromCache: true, age: relativeTime(row.created_at), hash })
            setRunning(false)
            return
          }
        }
      } catch {
        // DB miss or error — fall through to live run silently
      }
    }

    // Live run: clear hash from session cache if regenerating
    if (forceRegenerate) {
      sessionCacheRef.current.delete(hash)
    }

    const t0 = Date.now()

    // Initialise all selected cards as loading
    const initialCards = {}
    for (const id of selectedIds) {
      const topic = topics.find((t) => t.id === id)
      initialCards[id] = { loading: true, title: topic?.title || id, markdown: null, error: null, confidence: null, effectClaim: null }
    }
    setCards(initialCards)

    // Accumulate completed cards for session cache population on done
    const completedCards = {}

    await streamReport({
      bridgeUrl,
      composition,
      topics: selectedIds,
      onCard(card) {
        const cardEntry = {
          loading:     false,
          title:       card.title || topics.find((t) => t.id === card.id)?.title || card.id,
          markdown:    card.markdown || null,
          error:       card.error    || null,
          confidence:  card.confidence  ?? null,
          effectClaim: card.effectClaim ?? null,
        }
        completedCards[card.id] = cardEntry
        setCards((prev) => ({ ...prev, [card.id]: cardEntry }))
      },
      onDone() {
        const tookMs = Date.now() - t0
        // Populate session cache
        sessionCacheRef.current.set(hash, { ...completedCards })
        setReportMeta({ fromCache: false, tookMs, hash })
        setRunning(false)
      },
      onError(err) {
        setStreamError(err.message || String(err))
        setRunning(false)
        // mark remaining loading cards as errored
        setCards((prev) => {
          const next = { ...prev }
          for (const [id, c] of Object.entries(next)) {
            if (c.loading) next[id] = { ...c, loading: false, error: 'Stream interrupted.' }
          }
          return next
        })
      },
    })
  }

  function regenerate() {
    runReport({ forceRegenerate: true })
  }

  function toggleTopic(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll()  { setSelected(new Set(topics.map((t) => t.id))) }
  function selectNone() { setSelected(new Set()) }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="ai-report-panel">
      <h3 className="ai-report-title">AI Report</h3>

      {bridgeStatus === 'checking' && (
        <p className="ai-status muted">Checking AI bridge…</p>
      )}

      {bridgeStatus === 'down' && (
        <div className="ai-status offline">
          <p>AI bridge is offline. Start it with <code>npm run ai</code> to enable the AI report.</p>
          <p className="muted">The report streams through your local Claude bridge — no API cost.</p>
        </div>
      )}

      {bridgeStatus === 'up' && (
        <>
          {topics.length > 0 && (
            <div className="ai-topic-checklist">
              <div className="ai-checklist-controls">
                <button className="link-btn" onClick={selectAll}>All</button>
                <span className="ai-sep">·</span>
                <button className="link-btn" onClick={selectNone}>None</button>
                <span className="ai-sep muted">{selected.size}/{topics.length} selected</span>
              </div>
              {topics.map((t) => (
                <label key={t.id} className="ai-topic-row">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleTopic(t.id)}
                    disabled={running}
                  />
                  <span className="ai-topic-title">{t.title}</span>
                </label>
              ))}
            </div>
          )}

          {/* Cache status line + Regenerate button (shown once cards exist) */}
          {reportMeta && (
            <div className="ai-cache-status">
              <span className="muted">
                {reportMeta.fromCache
                  ? `cached · ${reportMeta.age}`
                  : `generated in ${reportMeta.tookMs} ms`}
              </span>
              {' · '}
              <button className="link-btn" onClick={regenerate} disabled={running}>
                Regenerate
              </button>
            </div>
          )}

          <button
            className="primary ai-ask-btn"
            disabled={running || selected.size === 0 || !composition}
            onClick={() => runReport()}
          >
            {running ? 'Generating…' : 'Ask AI'}
          </button>

          {streamError && (
            <div className="note warn" style={{ marginTop: 8 }}>&#9888; {streamError}</div>
          )}

          {Object.keys(cards).length > 0 && (
            <div className="ai-cards">
              {topics
                .filter((t) => cards[t.id])
                .map((t) => {
                  const card = cards[t.id]
                  const disagrees = t.id === 'effect'
                    ? detectDisagreement(engineResult ?? null, card?.effectClaim ?? null)
                    : false
                  return (
                    <TopicCard key={t.id} topic={t} card={card} disagreement={disagrees} />
                  )
                })}
              {/* cards for topics not in the fetched list (e.g. no-topic-endpoint path) */}
              {Object.entries(cards)
                .filter(([id]) => !topics.find((t) => t.id === id))
                .map(([id, card]) => (
                  <TopicCard key={id} topic={{ id, title: card.title || id }} card={card} disagreement={false} />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
