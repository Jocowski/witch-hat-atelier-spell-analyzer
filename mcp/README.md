# MCP

This folder documents the **Model Context Protocol (MCP) integration** for the Witch Hat Atelier Spell Analyzer.

> The MCP configuration file (`.mcp.json`) lives at the **repo root**, where the Claude Code toolchain expects it. This folder only documents it — do not move `.mcp.json` here.

---

## What is configured

One MCP server is registered:

| Key | Value |
|-----|-------|
| Name | `supabase` |
| Transport | HTTP |
| URL | `https://mcp.supabase.com/mcp` |
| Project ref | `qgabhkzeejiuprsdoint` |
| Features | `docs`, `account`, `database`, `debugging`, `development`, `functions`, `branching`, `storage` |

The full URL with query string, as it appears in `.mcp.json`:

```
https://mcp.supabase.com/mcp?project_ref=qgabhkzeejiuprsdoint&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cstorage
```

---

## Purpose and scope

The Supabase MCP server is an **author-time developer tool**. Claude Code is the MCP client; it uses the server to inspect and manage the hosted Supabase backend (the production instance backing the published web app) without leaving the editor.

Enabled feature flags and what they cover:

| Feature | What it exposes to Claude |
|---------|--------------------------|
| `docs` | Supabase platform documentation |
| `account` | Org/project management |
| `database` | Schema inspection, query execution, migrations |
| `debugging` | Logs, error traces |
| `development` | Local dev tooling guidance |
| `functions` | Edge function management |
| `branching` | Supabase branching workflows |
| `storage` | Bucket/object management |

---

## What this MCP integration is NOT

- **Not used by the application at runtime.** The browser app talks to Supabase directly through the standard Supabase JavaScript client (`src/data-services/supabase.js` / target: `src/services/supabase/`) using the public anon key. MCP is never invoked from user-facing code.
- **Not a locally hosted MCP server.** This repo does not define or run an MCP server. The endpoint is the remote Supabase-managed MCP service.
- **Not a tool available to the AI bridge.** `tools/ai-bridge.mjs` shells out to `claude -p` with `--allowedTools Read,Glob,Grep` only. MCP tools are not in that allowed set.

---

## Authentication

Authentication to the MCP server is handled separately by Claude Code (via OAuth or a stored token in the developer environment). No credentials are stored in this repository. The `project_ref` in `.mcp.json` identifies the hosted project but is not a secret.

---

## Local Supabase stack

For local development, a separate local Supabase stack is managed via the `supabase` CLI (`npx supabase start`), not via MCP. The local stack uses its own URLs and keys sourced from `.env` (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`). The MCP server connects to the **hosted** project only.
