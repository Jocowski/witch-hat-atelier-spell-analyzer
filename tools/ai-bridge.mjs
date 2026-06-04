#!/usr/bin/env node
// ai-bridge — a tiny LOCAL server that runs the AI spell analysis through the `claude` CLI
// (Claude Code in headless mode), so the app gets a first-principles AI reading WITHOUT paying
// for the Anthropic API per token: `claude -p` runs under your existing Claude Code auth and has
// the whole repo (docs/CORE.md, docs/lexicon/, the engine) on hand.
//
// Flow:  browser  ->  POST /analyze {composition}  ->  spell-engine-cli --facts  ->  claude -p  ->  analysis text
//        browser  ->  GET  /health                 ->  { ok, claude: <version|null> }
//
// This is a DEV / personal convenience. A public multi-user app can't funnel strangers through one
// subscription — there, use the Anthropic API (paid) or user-provided keys. See docs/app/DRAWING-APP.md.
//
// Usage:
//   npm run ai                 # starts on http://localhost:8787
//   PORT=9000 npm run ai       # custom port
//
// No dependencies (node:http + node:child_process only).

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const PORT = Number(process.env.PORT) || 8787
const CLAUDE_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 180_000
const REPORT_CONCURRENCY = Number(process.env.REPORT_CONCURRENCY) || 3

// Load the topic catalog once at startup
const TOPICS = JSON.parse(readFileSync(resolve(here, 'report-topics.json'), 'utf8'))

// ---- small helpers ----------------------------------------------------------
// Run a command, feed `input` to stdin, resolve with {code, stdout, stderr}. Rejects on timeout.
function run(cmd, args, { input = null, cwd = root, timeout = 0 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { cwd, shell: process.platform === 'win32' })
    let stdout = '', stderr = ''
    let timer = null
    if (timeout) timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`${cmd} timed out after ${timeout}ms`)) }, timeout)
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e) => { if (timer) clearTimeout(timer); reject(e) })
    child.on('close', (code) => { if (timer) clearTimeout(timer); resolvePromise({ code, stdout, stderr }) })
    if (input != null) { child.stdin.write(input); child.stdin.end() }
  })
}

function send(res, status, body, type = 'application/json') {
  const payload = type === 'application/json' ? JSON.stringify(body) : body
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',            // the Vite dev app (5173) calls this
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolvePromise) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolvePromise(data))
  })
}

// ---- the prompt --------------------------------------------------------------
// We hand Claude the engine FACTS (ground-truth observations) and let it reason the EFFECT from the
// repo's first-principles docs. Claude Code reads CORE.md / lexicon itself, so we keep this short.
function buildPrompt(factsJson, heuristicText, spellName) {
  return `You are the AI reasoner for the Witch Hat Atelier Spell Analyzer.

Reason the effect of this spell FROM FIRST PRINCIPLES using docs/CORE.md and docs/lexicon/ in this
repo. The engine has already extracted ground-truth FACTS (parts present, operator kinds, geometry,
zones, catalog neighbours). Trust the FACTS for *what is present*; the heuristic summary is a
non-authoritative scaffold — do not just repeat it.

Spell name: ${spellName || '(unnamed)'}

ENGINE FACTS (authoritative observations):
\`\`\`json
${factsJson}
\`\`\`

ENGINE HEURISTIC READOUT (scaffold, not ground truth):
${heuristicText}

Produce a concise analysis with these sections (markdown):
- **Effect** — what the spell most plausibly does, reasoned from the substances + operators + geometry.
- **Why** — the first-principles chain (substance → operators → geometry) that yields that effect.
- **Confidence & unknowns** — how sure you are and what is ambiguous.
- **Closest canon** — the nearest catalog spell from the FACTS and how this differs.
Keep it tight. Do not invent symbols that aren't in the FACTS.`
}

// ---- report streaming helpers -----------------------------------------------
// Shared preamble injected into every per-topic prompt so Claude has the facts.
function buildReportPreamble(factsJson, heuristicText, spellName) {
  return `You are the AI reasoner for the Witch Hat Atelier Spell Analyzer.
You have access to the repo's docs (docs/CORE.md, docs/lexicon/, docs/spells/, etc.) via Read/Glob/Grep.
Reason from first principles: substance semantics, operator preconditions, and geometry as defined in
docs/CORE.md and the per-symbol dossiers in docs/lexicon/. Trust the ENGINE FACTS for what is present.
Do NOT invent symbols that are not listed in the FACTS.

Spell name: ${spellName || '(unnamed)'}

ENGINE FACTS (authoritative observations — trust these for what sigils/signs/geometry are present):
\`\`\`json
${factsJson}
\`\`\`

ENGINE HEURISTIC READOUT (scaffold only — do not simply repeat this):
${heuristicText}

`
}

// Run up to `limit` promises at a time from a factory array.
async function concurrentMap(items, limit, asyncFn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await asyncFn(items[i], i)
    }
  }
  const pool = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(pool)
  return results
}

// ---- request handling --------------------------------------------------------
async function getFacts(composition) {
  const { code, stdout, stderr } = await run('node', [resolve(root, 'tools/spell-engine-cli.mjs'), '--facts'], { input: composition })
  if (code !== 0) throw new Error('engine (--facts) failed: ' + (stderr || `exit ${code}`))
  return stdout
}
async function getText(composition) {
  const { stdout } = await run('node', [resolve(root, 'tools/spell-engine-cli.mjs'), '--text'], { input: composition })
  return stdout
}
async function callClaude(prompt) {
  // --output-format json gives a JSON envelope with a `result` field; read-only tools let Claude
  // consult the docs. We pipe the prompt via stdin to avoid arg-length limits.
  const { code, stdout, stderr } = await run('claude', ['-p', '--output-format', 'json', '--allowedTools', 'Read,Glob,Grep'], { input: prompt, timeout: CLAUDE_TIMEOUT_MS })
  if (code !== 0) throw new Error('claude failed: ' + (stderr || `exit ${code}`))
  try { const env = JSON.parse(stdout); return env.result ?? env.text ?? stdout } catch { return stdout }
}

async function claudeVersion() {
  try { const { code, stdout } = await run('claude', ['--version']); return code === 0 ? stdout.trim() : null } catch { return null }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '')
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true, claude: await claudeVersion(), port: PORT })
  }

  if (req.method === 'POST' && url.pathname === '/analyze') {
    try {
      const raw = await readBody(req)
      const parsed = JSON.parse(raw)
      const composition = JSON.stringify(parsed.composition || parsed)
      const name = parsed.name || parsed.composition?.name || ''
      const [facts, text] = await Promise.all([getFacts(composition), getText(composition)])
      const prompt = buildPrompt(facts, text, name)
      const t0 = Date.now()
      const analysis = await callClaude(prompt)
      return send(res, 200, { ok: true, analysis, facts: JSON.parse(facts), tookMs: Date.now() - t0 })
    } catch (e) {
      return send(res, 500, { ok: false, error: String(e.message || e) })
    }
  }

  // ---- GET /report/topics → the topic catalog (so the browser client can load it) ----
  if (req.method === 'GET' && url.pathname === '/report/topics') {
    return send(res, 200, TOPICS)
  }

  // ---- POST /report/stream → SSE, one event per topic as each completes ----
  if (req.method === 'POST' && url.pathname === '/report/stream') {
    // Set SSE headers; write them immediately so the client sees the stream open.
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })

    // Helper: write one SSE frame.
    const emit = (eventName, data) => {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
      const raw = await readBody(req)
      const parsed = JSON.parse(raw)
      const composition = JSON.stringify(parsed.composition || parsed)
      const name = parsed.name || parsed.composition?.name || ''

      // Resolve which topics to run (default: all).
      const requestedIds = Array.isArray(parsed.topics) && parsed.topics.length > 0
        ? parsed.topics
        : TOPICS.map((t) => t.id)
      const requested = requestedIds
        .map((id) => TOPICS.find((t) => t.id === id))
        .filter(Boolean)

      // Compute facts + heuristic ONCE, in parallel.
      const [factsRaw, heuristicText] = await Promise.all([
        getFacts(composition),
        getText(composition),
      ])

      const preamble = buildReportPreamble(factsRaw, heuristicText, name)

      // Run requested topics with a concurrency cap; emit each result as it arrives.
      await concurrentMap(requested, REPORT_CONCURRENCY, async (topic) => {
        const fullPrompt = preamble + topic.prompt
        try {
          const markdown = await callClaude(fullPrompt)
          emit('topic', { id: topic.id, title: topic.title, markdown })
        } catch (err) {
          emit('topic', { id: topic.id, title: topic.title, error: String(err.message || err) })
        }
      })
    } catch (err) {
      emit('error', { error: String(err.message || err) })
    }

    emit('done', {})
    res.end()
    return
  }

  return send(res, 404, { ok: false, error: 'not found' })
})

server.listen(PORT, () => {
  console.log(`✦ AI bridge on http://localhost:${PORT}`)
  console.log(`  GET  /health          → liveness + claude version`)
  console.log(`  POST /analyze         → { composition }  ->  AI spell analysis (via claude -p)`)
  console.log(`  GET  /report/topics   → topic catalog (${TOPICS.length} topics)`)
  console.log(`  POST /report/stream   → { composition, topics[] }  ->  SSE topic cards (concurrency: ${REPORT_CONCURRENCY})`)
  claudeVersion().then((v) => console.log(v ? `  claude CLI: ${v}` : '  ⚠ claude CLI not found on PATH — /analyze will fail.'))
})
