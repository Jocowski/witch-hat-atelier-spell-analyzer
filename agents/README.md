# Agents

This folder documents the **author-time agent ecosystem** for the Witch Hat Atelier Spell Analyzer.

> **There are NO runtime agents inside the application.** The app ships no agent orchestration, no LLM calls at startup, and no agent loop embedded in any bundle. Every agent described here is an author-time or developer-facing construct, never executed by an end-user's browser.

---

## Agent inventory

| Agent | Kind | Where | Role |
|-------|------|-------|------|
| Claude Code (interactive) | CLI assistant | developer machine | builds, maintains, and refactors the repo |
| AI-bridge reasoner | `claude -p` headless subprocess | `tools/ai-bridge.mjs` | reasons spell effects from first principles per `docs/CORE.md`; one subprocess per topic at concurrency 3 |
| spell-analyzer | Claude skill | `.claude/skills/spell-analyzer/` | full end-to-end analysis of an existing spell; archives to `docs/spells/` |
| spell-creator | Claude skill | `.claude/skills/spell-creator/` | design a new spell from a desired effect; validate via the real engine |
| spell-idea | Claude skill | `.claude/skills/spell-idea/` | brainstorm new spell concepts from outside inspiration |

---

## 1. The AI-bridge reasoner (`tools/ai-bridge.mjs`)

The bridge is a **local Node HTTP server** (`npm run ai`, port 8787) that connects the browser app to Claude during development. It is never part of the published build.

### What it does

1. The browser sends the composition JSON to `POST /analyze` or `POST /report/stream`.
2. The bridge calls `tools/spell-engine-cli.mjs --facts` to extract **authoritative, deterministic observations** about the composition (parts present, operator kinds, geometry, catalog neighbors). This is the ground truth.
3. It also runs `--text` to get the engine's heuristic readout (used as a non-authoritative scaffold — Claude is explicitly told not to just repeat it).
4. It assembles a prompt that includes both outputs and instructs Claude to reason the spell's effect from first principles using `docs/CORE.md` and `docs/lexicon/`.
5. It shells out to `claude -p --output-format json --allowedTools Read,Glob,Grep` — Claude Code running headlessly with read-only access to the repo docs.
6. For the streaming report path (`/report/stream`), topics from `tools/report-topics.json` are dispatched concurrently (default concurrency 3) and each resolved topic is emitted as an SSE event to the browser.

### Key design decisions

- **Claude is the reasoner; the engine is the compiler.** The `--facts` output is labeled "authoritative" in the prompt; the heuristic readout is labeled "scaffold, not ground truth." Claude is forbidden from inventing symbols not present in the facts.
- **No Anthropic API token cost.** `claude -p` runs under the developer's existing Claude Code subscription.
- **Allowed tools are read-only** (`Read`, `Glob`, `Grep` over repo docs only). Claude cannot write files or run commands during a bridge call.
- **CONFIDENCE and EFFECT_CLAIM** are structured lines Claude appends to each topic response; `parseTopicResponse` strips them from the visible markdown and returns them as typed fields for the UI's confidence meter and disagreement checker.

### Runtime counterpart

The **in-app AI client** lives at `src/ai/` (target: `src/services/ai/` per the refactor plan). It is the browser-side SSE consumer that talks to this bridge. It is gated by `import.meta.env.VITE_AI_ENABLED === '1'` and tree-shaken out of the published (Pages) build.

---

## 2. Skill-to-agent map

The three project skills are author-time agents driven by Claude Code. They are invoked interactively by the developer via `/spell-analyzer`, `/spell-creator`, and `/spell-idea`.

```
Developer <-> Claude Code
   |
   +-- /spell-idea     -> brainstorm concepts (no recipe, no feasibility call)
   |                      hands off to ->
   +-- /spell-creator  -> feasibility check + build recipe + validate via engine
   |                      hands off to ->
   +-- /spell-analyzer -> full analysis of existing spell -> write docs/spells/*.md
```

Each skill reads `docs/CORE.md` and `docs/lexicon/` for reasoning grounding and uses `tools/spell-engine-cli.mjs` (`--facts` / `--text`) as its fact extractor. They mirror the same "AI reasons, engine compiles" contract as the bridge, applied to interactive author-time work rather than live browser sessions.

See `.claude/skills/README.md` for the full skill index.

---

## 3. What is NOT here

- No runtime agent loop, orchestration graph, or multi-agent framework is embedded in the app.
- The `src/services/ai/` layer is a thin SSE client, not an agent.
- MCP is a developer tool (Supabase management); see `mcp/README.md`.
