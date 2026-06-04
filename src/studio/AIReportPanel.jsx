/**
 * AIReportPanel.jsx — multi-topic streaming AI report for Spell Studio.
 *
 * Props:
 *   composition  : wha-spell composition object (passed to the bridge)
 *   bridgeUrl    : string (default VITE_AI_BRIDGE_URL or 'http://localhost:8787')
 */

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { getTopics, streamReport } from '../ai/report.js'

const DEFAULT_BRIDGE = import.meta.env.VITE_AI_BRIDGE_URL || 'http://localhost:8787'

function TopicCard({ topic, card }) {
  const isLoading = card?.loading
  const hasError  = card?.error
  const markdown  = card?.markdown

  return (
    <div className={`ai-card${isLoading ? ' loading' : ''}${hasError ? ' error' : ''}`}>
      <div className="ai-card-title">{topic.title}</div>
      {isLoading && <div className="ai-card-spinner" aria-label="Loading">…</div>}
      {hasError  && <div className="ai-card-error">⚠ {card.error}</div>}
      {markdown  && (
        <div className="ai-card-content">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

export default function AIReportPanel({ composition, bridgeUrl = DEFAULT_BRIDGE }) {
  const [bridgeStatus, setBridgeStatus] = useState('checking') // 'checking' | 'up' | 'down'
  const [topics,       setTopics]        = useState([])
  const [selected,     setSelected]      = useState(new Set())
  const [running,      setRunning]       = useState(false)
  const [cards,        setCards]         = useState({})  // id → { loading, markdown, error, title }
  const [streamError,  setStreamError]   = useState(null)
  const abortRef = useRef(null)

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

  async function runReport() {
    if (running || bridgeStatus !== 'up' || !composition) return
    setRunning(true)
    setStreamError(null)

    const selectedIds = [...selected]

    // initialise all selected cards as loading
    const initialCards = {}
    for (const id of selectedIds) {
      const topic = topics.find((t) => t.id === id)
      initialCards[id] = { loading: true, title: topic?.title || id, markdown: null, error: null }
    }
    setCards(initialCards)

    await streamReport({
      bridgeUrl,
      composition,
      topics: selectedIds,
      onCard(card) {
        setCards((prev) => ({
          ...prev,
          [card.id]: { loading: false, title: card.title || prev[card.id]?.title || card.id, markdown: card.markdown || null, error: card.error || null },
        }))
      },
      onDone() {
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

  function toggleTopic(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll()   { setSelected(new Set(topics.map((t) => t.id))) }
  function selectNone()  { setSelected(new Set()) }

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

          <button
            className="primary ai-ask-btn"
            disabled={running || selected.size === 0 || !composition}
            onClick={runReport}
          >
            {running ? 'Generating…' : 'Ask AI'}
          </button>

          {streamError && (
            <div className="note warn" style={{ marginTop: 8 }}>⚠ {streamError}</div>
          )}

          {Object.keys(cards).length > 0 && (
            <div className="ai-cards">
              {topics
                .filter((t) => cards[t.id])
                .map((t) => (
                  <TopicCard key={t.id} topic={t} card={cards[t.id]} />
                ))}
              {/* cards for topics not in the fetched list (e.g. no-topic-endpoint path) */}
              {Object.entries(cards)
                .filter(([id]) => !topics.find((t) => t.id === id))
                .map(([id, card]) => (
                  <TopicCard key={id} topic={{ id, title: card.title || id }} card={card} />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
