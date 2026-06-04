# SPEC — AI report surfacing: cache + calibrated confidence + engine disagreement

> Status: **proposed** · Scope: **AI report caching, per-topic confidence, AI-vs-engine disagreement**
> Branch: `feat/spell-studio`
> Depends on: B2 + B6 sketches in [SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) (this
> spec supersedes those stubs with a full build design), A0 `logAnalysis` wired (prerequisite for
> the persistence tier and the disagreement log).
> Cross-refs: [APP-PLAN.md](APP-PLAN.md) §4 (AI report architecture),
> [SPEC-recognizer-analysis.md](SPEC-recognizer-analysis.md) (items B2 + B6),
> [IMPROVEMENTS.md](IMPROVEMENTS.md) (WS9 improvement loop).
> Files touched: `src/ai/report.js`, `src/studio/AIReportPanel.jsx`,
> `tools/ai-bridge.mjs`, `tools/report-topics.json`, `src/data-services/analyses.js`.

---

## Overview

Two tightly related improvements to the AI report layer:

**3.3 — Cache by composition hash.** The streaming multi-topic report
([AIReportPanel.jsx](../../src/studio/AIReportPanel.jsx) / [report.js](../../src/ai/report.js))
re-runs the full AI pipeline on every "Ask AI" press — even when the composition hasn't changed and
the spell is already known. A two-tier cache (session in-memory + optional Supabase persistence) makes
re-analysis instant, shows the user whether a result is fresh or cached, and provides a Regenerate
escape hatch.

**3.5 — Calibrated confidence + "AI disagrees with engine" badge.** The engine produces a
deterministic deduction string (`result.deduction.summary`) and structured facts. The AI produces a
natural-language analysis. Today neither the confidence nor the agreement between them is surfaced.
This item: (a) adds a structured `confidence: 0..1` field per topic to the SSE protocol, rendered as
a small meter in each card; (b) compares the AI's `effect` topic to the engine's deterministic
deduction using a cheap structural comparison (element / primary-clause / direction fields); when they
diverge, renders an "AI disagrees with engine" badge on the affected card, and logs the divergence
via `logAnalysis` as an engine-gap candidate that feeds the improvement loop.

---

## Item 3.3 — AI report cache by composition hash

### 3.3.1 Cache key

The cache key is a **string hash over three inputs** combined into one stable JSON payload and hashed
with FNV-1a (32-bit, hex-encoded — fast, no browser crypto dependency needed, collision risk is
negligible for this use):

```
key = fnv32a(stableStringify({ spell: canonicalComposition, topics: sortedTopicIds, reportVersion: REPORT_VERSION }))
```

**`canonicalComposition`** is the `wha-spell@1` composition object with keys sorted recursively
(deterministic regardless of insertion order). This is the same object already exported by
`DrawingSurface` — no additional transformation needed beyond a recursive key-sort.

**`sortedTopicIds`** is the user's selected topic set serialized as a sorted array. Topic-selection
changes bust the cache naturally (a set change yields a different key), which is the intended
behavior — a partial run is not a complete report.

**`REPORT_VERSION`** is a semver string constant in `report.js` (e.g. `'1.0'`). Bump it manually
when the bridge prompt templates change significantly enough to warrant re-running all cached reports.
This avoids serving stale AI text after a quality improvement to the topic prompts.

**What busts the cache:** any composition edit (adding/removing/rotating a symbol, changing a dye,
opening/closing the ring), any change to the selected topic set, any manual bump of `REPORT_VERSION`.
Re-analyzing an identical composition with the same topics always hits the cache (unless Regenerate
was pressed).

### 3.3.2 Hash implementation

Add a small pure helper `src/ai/reportCache.js` (no JSON imports, no framework deps):

```
// src/ai/reportCache.js
export const REPORT_VERSION = '1.0'

// Recursive key-sort for canonical JSON stringify.
function sortKeys(v) { ... }   // handles objects, arrays, primitives

export function stableStringify(obj) {
  return JSON.stringify(sortKeys(obj))
}

// FNV-1a 32-bit (hex string).
export function fnv32a(str) { ... }

export function compositionHash(composition, topicIds) {
  const payload = stableStringify({
    spell: composition,
    topics: [...topicIds].sort(),
    reportVersion: REPORT_VERSION,
  })
  return fnv32a(payload)
}
```

This module is pure and testable with `node --test` (no JSON imports, no Vite globals).

### 3.3.3 Session cache (in-memory, Tier 1)

A `Map` keyed by hash lives inside a React ref (or a module-level singleton) in `AIReportPanel.jsx`:

```
// shape: Map<hash, { topicId → { markdown, confidence, generatedAt: number } }>
const sessionCacheRef = useRef(new Map())
```

Lifecycle: populated when a report finishes streaming; looked up at the start of `runReport()`;
cleared when the component unmounts or when the user presses **Regenerate** (hash-specific clear).
No size limit for now (the per-topic markdown is small; a session is unlikely to accumulate enough
analyses to matter).

### 3.3.4 Persistence cache (Supabase, Tier 2)

Reuses the existing `analyses.ai_report jsonb` column — no new table. Shape written to the column:

```json
{
  "hash":        "<hex>",
  "reportVersion": "1.0",
  "topics": {
    "effect":      { "markdown": "...", "confidence": 0.88, "generatedAt": 1717500000000 },
    "feasibility": { "markdown": "...", "confidence": 0.73, "generatedAt": 1717500000000 }
  }
}
```

**Write path:** after a report stream completes successfully, call `logAnalysis` (already in
`StudioPage`) with `ai_report` set to the above shape. This is already where the analyses row is
written (SPEC-recognizer-analysis.md A0); just ensure the `ai_report` payload is passed when the
report finishes.

**Read path:** add a lightweight `findCachedReport(hash)` helper to `analyses.js`:

```js
// analyses.js
export async function findCachedReport(hash) {
  if (!hasSupabase()) return null
  const { data } = await supabase
    .from('analyses')
    .select('ai_report, created_at')
    .filter('ai_report->>hash', 'eq', hash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data   // null if not found
}
```

This query is a JSON path filter (`->>`) on a jsonb column — works with the existing schema and
Supabase's PostgREST JSON operators. No migration needed.

**Cache lookup order in `runReport()`:**
1. Check session cache (`sessionCacheRef.current.get(hash)`). If hit, render immediately.
2. If miss and Supabase is configured, call `findCachedReport(hash)`. If hit, populate session
   cache from the DB result and render. Update the "cached" timestamp from `created_at`.
3. If both miss (or Regenerate was pressed), run the streaming AI pipeline as today, then populate
   both tiers on completion.

Tier 2 is best-effort: if `findCachedReport` throws (Supabase down, unauthenticated), log and fall
through to the live run. The UI must not block on the DB lookup for more than ~1s — apply a
`Promise.race` timeout.

### 3.3.5 UI states

The `AIReportPanel` header area gains a status line and a button:

| State | UI text | Notes |
|---|---|---|
| No report yet | (existing "Ask AI" button) | unchanged |
| Streaming live | "Generating…" spinner | existing behavior |
| Just finished | "Generated in {ms} ms" | shown once after stream |
| Session cache hit | "cached · this session" | instant population |
| Supabase cache hit | "cached · {relative-time}" (e.g. "cached · 2 h ago") | from `created_at` |
| Regenerate available | **Regenerate** link-button | always visible when cards are shown |

The **Regenerate** button clears the hash from both tiers and re-runs the stream. It is a `link-btn`
(same class as the existing All/None controls), not a primary action, to keep visual weight low.

The status line uses the existing `.muted` class. Example rendering:

```jsx
{reportMeta && (
  <span className="ai-cache-status muted">
    {reportMeta.fromCache ? `cached · ${reportMeta.age}` : `generated in ${reportMeta.tookMs} ms`}
    {' · '}<button className="link-btn" onClick={regenerate}>Regenerate</button>
  </span>
)}
```

---

## Item 3.5 — Calibrated confidence + "AI disagrees with engine"

### 3.5.1 Bridge protocol change — per-topic confidence field

**Current SSE payload** per `topic` event:
```json
{ "id": "effect", "title": "The effect, simply", "markdown": "..." }
```

**New payload** (backward-compatible — consumers check for `confidence` before using it):
```json
{
  "id":         "effect",
  "title":      "The effect, simply",
  "markdown":   "...",
  "confidence": 0.82,
  "effectClaim": { "element": "fire", "primaryClause": "launch", "direction": "outward" }
}
```

`confidence` is a float in `[0, 1]`. `effectClaim` is only emitted by the `effect` topic (see §3.5.3
below) and is omitted from all other topics.

**How confidence is generated.** The bridge prompts Claude to output a JSON block at the end of each
topic response in addition to the markdown. The prompt for every topic is appended with:

```
After your Markdown answer, output EXACTLY one line:
CONFIDENCE: <float 0.0–1.0>
where 1.0 = very confident (well-attested in canon/FACTS, unambiguous operators),
      0.5 = moderate (plausible but inferred, limited canon grounding),
      0.0 = highly speculative (novel symbols, conflicting operators, no canon analog).
Do not add any text after the CONFIDENCE line.
```

The bridge's `callClaude` result is then post-processed in a new `parseTopicResponse(raw)` helper:

```js
// tools/ai-bridge.mjs (new helper)
function parseTopicResponse(raw) {
  const lines = raw.trimEnd().split('\n')
  const last = lines[lines.length - 1].trim()
  const m = last.match(/^CONFIDENCE:\s*([\d.]+)/)
  if (m) {
    const confidence = Math.min(1, Math.max(0, parseFloat(m[1])))
    const markdown = lines.slice(0, -1).join('\n').trim()
    return { markdown, confidence }
  }
  // Backward-compatible: Claude didn't emit the line (older bridge, or parse failure).
  return { markdown: raw.trim(), confidence: null }
}
```

The `null` sentinel means "no confidence available" — the meter is not rendered in that case (no
empty/0 meter shown for topics that didn't emit it).

**`effectClaim` parsing.** The `effect` topic prompt is additionally instructed to output a
machine-readable claim:

```
Also output EXACTLY one line (after the CONFIDENCE line):
EFFECT_CLAIM: {"element":"<id>","primaryClause":"<verb>","direction":"<label|null>"}
where:
  element       = the sigil's element id as in the FACTS (e.g. "fire", "water", "earth", "air", "time")
  primaryClause = the dominant verb/action (e.g. "launch", "form", "pull", "expand", "transmute")
  direction     = the dominant direction label if present (e.g. "outward", "inward", "upward") or null
```

`parseTopicResponse` extracts this line (if present) and attaches it as `effectClaim` to the SSE
payload. If parsing fails or the line is absent, `effectClaim` is omitted — the disagreement check
simply skips (no false positive).

**Backward compatibility.** The `confidence` and `effectClaim` fields are additions to an existing
JSON object. `report.js` already passes `payload` straight to `onCard()` which sets it into the
`cards` state map. No changes to the SSE frame format or event name. Old bridge → new client: fields
absent, meters not rendered. New bridge → old client: unknown fields ignored.

### 3.5.2 `report.js` change

`onCard` payload is already forwarded verbatim. The only change in `report.js` is to carry
`confidence` and `effectClaim` through the card shape so `AIReportPanel` can read them:

The `streamReport` `onCard` callback type becomes:
```
onCard({ id, title, markdown, confidence?: number|null, effectClaim?: object, error? })
```

No logic in `report.js` — the component does all interpretation.

### 3.5.3 Disagreement comparison

**The engine side.** `analyze(composition)` returns `result.deduction.summary` (a string like
"Launches fire outward") and, for structured access, `result.deduction` which has an `element`
field derived from the core sigil's element. The engine's direction comes from
`result.analysis.direction` (the `directionLabel` string, e.g. `"outward"`, `"inward"`, `"none"`).

**The AI side.** When the `effect` topic card resolves with an `effectClaim` field, we have:
`{ element, primaryClause, direction }`.

**Comparison logic** (cheap structural, no NLP):

```js
// src/studio/AIReportPanel.jsx (or a helper)
function detectDisagreement(engineResult, effectClaim) {
  if (!effectClaim || !engineResult) return false

  const engElement  = engineResult.sigils?.[0]?.element ?? null
  const engDirection = engineResult.analysis?.direction ?? null

  // Element mismatch: different non-null elements (both must be present to compare).
  if (engElement && effectClaim.element && engElement !== effectClaim.element) return true

  // Direction mismatch: engine says directional, AI says a clearly different direction.
  // Only flag when both are non-null and non-"none" and explicitly differ.
  const dirMismatch =
    engDirection && engDirection !== 'none' &&
    effectClaim.direction && effectClaim.direction !== 'none' &&
    engDirection !== effectClaim.direction
  if (dirMismatch) return true

  return false
}
```

Rationale for this scope: element is the most fundamental property (what substance the spell
operates on) and direction is the most structurally important modifier. Verb/primaryClause comparison
is deliberately omitted at this stage — vocabulary differences between the AI's natural language and
the engine's grammar verbs would produce too many false positives, degrading the signal.

This comparison is intentionally **cheap and conservative** (flags only clear structural mismatches,
not synonyms). The goal is to surface genuine cases where the AI is reasoning about a different
substance or spatial orientation than the engine, not to flag stylistic differences.

### 3.5.4 Disagreement badge + UI

When `detectDisagreement` returns true for the `effect` card, render a badge alongside the card
title:

```jsx
{disagreement && (
  <span className="ai-disagree-badge" title="The AI's deduced element or direction differs from the engine's deterministic reading. This may indicate a grammar gap.">
    AI disagrees with engine
  </span>
)}
```

Styling: small pill, amber/warning color using the `--color-warn` theme variable (consistent with
the `.note.warn` callout used elsewhere). Not red (not an error — it's a signal for the improvement
loop). The badge appears in the `TopicCard` header, right of the topic title.

The badge is shown only on the `effect` card (the one card that emits `effectClaim`). Other cards
show only the confidence meter (no disagreement check).

### 3.5.5 Confidence meter UI

Each `TopicCard` renders a confidence meter when `card.confidence != null`:

```jsx
function ConfidenceMeter({ value }) {
  // value: 0..1
  const pct = Math.round(value * 100)
  const tier = value >= 0.75 ? 'high' : value >= 0.4 ? 'mid' : 'low'
  return (
    <span className={`ai-confidence-meter conf-${tier}`} title={`AI confidence: ${pct}%`}>
      <span className="conf-fill" style={{ width: `${pct}%` }} />
    </span>
  )
}
```

Rendered inline in the `TopicCard` header, right of the topic title, left of the disagreement badge
(if present). Small enough not to crowd the header — approximately 48px wide, 6px tall.

CSS uses `--color-conf-high / mid / low` CSS variables so it adapts to all four themes.

### 3.5.6 Logging the disagreement

When a disagreement is detected, include it in the `logAnalysis` call (already in `StudioPage`'s
`handleAnalyze`). Add a `disagreements` field to the `ai_report` payload:

```json
{
  "hash": "...",
  "reportVersion": "1.0",
  "topics": { ... },
  "disagreements": [
    {
      "topic":       "effect",
      "engineElement":   "fire",
      "aiElement":       "earth",
      "engineDirection": "outward",
      "aiDirection":     null,
      "detectedAt":  1717500000000
    }
  ]
}
```

This extends the existing `ai_report` JSONB column with no schema change. The improvement loop
(APP-PLAN.md §7) can query `analyses` for rows where `ai_report->'disagreements'` is non-empty to
build the engine-gap candidate queue:

```sql
select id, composition, ai_report->'disagreements' as gaps, created_at
from analyses
where jsonb_array_length(ai_report->'disagreements') > 0
order by created_at desc;
```

No admin UI for disagreement review is in scope for this item. The raw DB query (or a future review
packet export) is the consumption path.

---

## Dependencies and order

Both 3.3 and 3.5 depend on **A0 `logAnalysis` being wired** (SPEC-recognizer-analysis.md A0) —
without an `analyses` row being written, the persistence tier of 3.3 has nothing to query, and 3.5
has nowhere to log disagreements. A0 is marked Effort S and is a prerequisite.

Within this spec, **3.3 can ship independently** before 3.5. 3.5 builds on 3.3's cache shape
(adding the `disagreements` field to the same `ai_report` payload). Suggested order:

1. `reportCache.js` helper (key, FNV, stableStringify) — pure module, testable immediately.
2. Session cache in `AIReportPanel.jsx` (Tier 1) — no DB dependency.
3. `parseTopicResponse` in `ai-bridge.mjs` + `CONFIDENCE:` line in topic prompts.
4. Confidence meter in `TopicCard`.
5. `effectClaim` extraction + `EFFECT_CLAIM:` line in the `effect` topic prompt.
6. `detectDisagreement` + badge + logging.
7. Supabase persistence tier (Tier 2) + `findCachedReport`.

---

## Phasing and effort

| Step | What ships | Effort |
|---|---|---|
| 3.3a — `reportCache.js` + session cache (Tier 1) | Instant re-analysis within session; "cached · this session" label; Regenerate | S |
| 3.3b — Supabase persistence (Tier 2) | Cross-session cache hit; "cached · N h ago" label | S |
| 3.5a — `CONFIDENCE:` prompt line + `parseTopicResponse` + meter | Per-topic confidence meters in all cards | S |
| 3.5b — `EFFECT_CLAIM:` extraction + `detectDisagreement` + badge | "AI disagrees with engine" badge on `effect` card | S |
| 3.5c — Disagreement logging | Gap candidates recorded in `analyses.ai_report` | S |

All five steps are individually small (S). The combined scope is M. No migrations required.

---

## Acceptance criteria

### 3.3 — Cache

- Re-analyzing an **unchanged** composition with the same topic selection returns instantly (< 50 ms)
  from the session cache and shows "cached · this session". No bridge request is made.
- **Editing** the composition (any symbol change, dye change, ring open/close) busts the hash: the
  next Analyze shows the "Ask AI" button again and a fresh run is required.
- **Changing topic selection** (check/uncheck any topic) busts the hash.
- **Regenerate** bypasses both cache tiers, runs the stream, and updates both caches with the fresh
  result.
- If Supabase is unconfigured or `findCachedReport` throws, the session falls through to a live run
  silently (no error shown to the user).
- After a live run, re-opening the same session re-analyzes the same composition: Tier 1 hits (no DB
  call needed again within the same session).
- After re-opening the app (new session), if the DB row exists, Tier 2 hits and shows "cached · {age}".
- `compositionHash` is a pure function: same composition + same topics always produces the same key.
  Covered by a `node --test` unit test.
- `REPORT_VERSION` bump causes all previously cached reports to miss (new key), triggering fresh runs.

### 3.5 — Confidence and disagreement

- Every `TopicCard` that receives a `confidence` value (not `null`) renders a small meter — no card
  shows an empty or 0% meter due to a parse failure.
- Confidence is a numeric value `0..1`, not prose adjectives ("high", "moderate"). Verified by
  inspecting the `cards` state in React DevTools.
- The `effect` card that disagrees with the engine (element or direction mismatch) shows the "AI
  disagrees with engine" badge. An agreeing `effect` card does not show the badge.
- A disagreement event is written to `analyses.ai_report.disagreements` in the DB row for that
  analysis session (verifiable via the Supabase Table Editor or the SQL query in §3.5.6).
- Cards that do not emit a confidence line (old bridge, Claude skip) degrade gracefully — no meter,
  no badge, no JS error.
- Disagreement check is **element-level**, not prose-comparison: swapping an identical composition's
  core from a fire sigil to an earth sigil and re-analyzing (with a freshly seeded AI) triggers a
  disagreement if the AI picks up on the earth substance while the engine is still reading fire (or
  vice versa from a cold test).

---

## Testing notes

- `reportCache.js` is pure (no JSON imports, no DOM): add `test/reportCache.test.js` covering
  `compositionHash` stability (same input → same key), key change on composition edit, key change on
  topic set change, and key change on `REPORT_VERSION` bump.
- `parseTopicResponse` is a pure string function: add a unit test in `test/aibridge.test.js` (or
  inline) covering: well-formed `CONFIDENCE:` line extracted, missing line returns `confidence: null`,
  malformed float clamped to `[0, 1]`, `EFFECT_CLAIM:` JSON parsed correctly, malformed JSON returns
  `null` without throwing.
- `detectDisagreement` is a pure predicate: test in `test/` with: same element + same direction →
  false; different element → true; both directions `null` → false; one direction `none` → false;
  different non-null non-`none` directions → true.
- Supabase integration (`findCachedReport`, extended `logAnalysis`) follows the pattern of the
  existing data-services tests: they no-op when `hasSupabase()` is false, so they won't block the
  `node --test` suite.
- The bridge's `parseTopicResponse` change is the only modification to `tools/` that could affect the
  AI output. Test manually: run `npm run ai`, analyze any known spell, and confirm that (a) each
  topic card shows a meter, and (b) the raw SSE stream (visible in browser DevTools Network panel)
  has `"confidence": <float>` in each `topic` event payload.
