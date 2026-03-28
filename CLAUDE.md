# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An agentic chat system with a Python backend (FastAPI) and a React frontend (Next.js). The backend runs an autonomous agent loop powered by the Anthropic API — the agent plans tasks, uses tools (scratchpad files, long-term memory), applies guardrails, and streams results to the UI via SSE.

## Repository Layout

- `server-fastapi/` — Python backend (FastAPI + Anthropic SDK)
- `client-nextjs/` — TypeScript frontend (Next.js 16, React 19, Tailwind v4)

## Development Commands

### Backend (server-fastapi/)

```bash
cd server-fastapi
uv run python -m app.main           # Start API server on :8001
uv run python -m app.main --cli     # Run agent in CLI mode (no server)
```

Requires `ANTHROPIC_API_KEY` in `server-fastapi/.env` (see `.env.example`). Python 3.12, managed with `uv`.

### Frontend (client-nextjs/)

```bash
cd client-nextjs
npm install
npm run dev       # Dev server on :3000
npm run build     # Production build
npm run lint      # ESLint
```

## Architecture

### Agent Loop (backend core)

Two parallel implementations exist:
- `agent/agent.py` — synchronous CLI version (`run_agent`)
- `agent/agent_streaming.py` — async streaming version (`run_agent_streaming`) used by the API

Both follow the same flow:
1. **Input guardrails** check/modify the user's message
2. **Planner** (Haiku) generates a structured `Plan` (goal, steps, done_when, output_files)
3. **Agentic loop** (Opus) iterates: call Claude → execute tools → feed results back, until `end_turn`
4. **Output guardrails** scrub sensitive data from the final response
5. **Loop limits** enforce max iterations/tokens/time/errors

Key modules:
- `agent_config.py` — `AgentConfig` dataclass with limits and HITL approval list
- `agent_state.py` — `AgentState` tracks run metadata (iterations, tokens, messages); serialized to `state.json`
- `agent_scratchpad.py` — per-run file workspace (`notes/`, `research/`, `output/`, `scratch/`); path-traversal protected
- `agent_memory.py` — cross-run persistent memory in `shared_memory/` directory; key-value `.md` files
- `agent_planner.py` — `Plan` dataclass + planner invocation + plan markdown parser
- `agent_guardrails.py` — input (prompt injection, PII), output (sensitive data), tool policy checks; loop limit exceptions

### Streaming & SSE

The API endpoint `POST /api/conversations/{id}/messages` returns an SSE stream. Event types: `plan_delta`, `plan`, `text_delta`, `tool_call`, `file_update`, `done`, `error`. The frontend consumes these in `useAgentStream` hook via an async generator in `lib/api.ts`.

### Data Layer

SQLite database (`chat.db`) with WAL mode. Two tables: `conversations` and `messages`. Messages link to agent runs via `run_id`. Schema in `app/db/schema.sql`, queries in `app/db/queries.py`. DB is initialized on FastAPI startup via lifespan handler.

Agent run artifacts are stored on disk at `server-fastapi/app/agent_runs/{run_id}/` with subdirectories for notes, research, output, scratch. The API exposes run files and plans via `/api/runs/{run_id}/files` and `/api/runs/{run_id}/plan`.

### Frontend Structure

- `src/lib/types.ts` — shared TypeScript types matching backend models and SSE events
- `src/lib/api.ts` — REST + SSE client functions (API_BASE = `localhost:8001`)
- `src/hooks/useAgentStream.ts` — React hook managing streaming state (plan, text, tools, files)
- `src/hooks/useConversation.ts` — conversation CRUD hook
- `src/components/chat/` — ChatPanel, MessageBubble, MessageInput, StreamingText, InlinePlan
- `src/components/plan/` — PlanPanel, PlanView, FileViewer
- `src/components/sidebar/` — ConversationList
- `src/app/chat/` — chat routes (new chat + `[conversationId]`)

### Tool System

The agent has two sets of tools registered at runtime:
- **Scratchpad tools**: `write_file`, `read_file`, `append_file`, `list_files`, `delete_file`, `move_file` — scoped to the run directory
- **Memory tools**: `save_memory`, `load_memory`, `list_memories`, `delete_memory` — scoped to `shared_memory/`

Custom tools can be injected via the `tools` and `tool_definitions` parameters of `run_agent`/`run_agent_streaming`.
