# SSE Event Contract

The streaming endpoint `POST /api/conversations/{id}/messages` returns a Server-Sent Events stream. Each event is a JSON object on a `data:` line, with the shape `{ "type": "<event_type>", "data": { ... } }`.

This document is the single source of truth for the event schema. Both the backend (`agent_events.py`, `agent_root_streaming.py`) and the frontend (`types.ts`, `useAgentStream.ts`) must stay in sync with it.

---

## Event Types

### `plan`

Emitted once after the planner finishes, before the agentic loop begins.

```json
{
  "type": "plan",
  "data": {
    "goal": "string — one-sentence goal",
    "steps": ["string — step 1", "string — step 2"],
    "done_when": "string — completion condition",
    "output_files": ["output/report.md"]
  }
}
```

### `text_delta`

Emitted for each text token streamed from Claude. Consumers should buffer and batch these (e.g. per animation frame) to avoid excessive re-renders.

```json
{
  "type": "text_delta",
  "data": {
    "content": "string — one or more characters"
  }
}
```

### `tool_call`

Emitted after a tool executes successfully.

```json
{
  "type": "tool_call",
  "data": {
    "tool": "string — tool name (e.g. write_file)",
    "input": { "...": "tool-specific input object" },
    "result": "string — tool return value"
  }
}
```

### `file_update`

Emitted when a scratchpad file is created, updated, or deleted. Allows the frontend to show live file contents without polling.

```json
{
  "type": "file_update",
  "data": {
    "path": "string — relative path within the run directory",
    "action": "created | updated | deleted",
    "content": "string | undefined — file contents (omitted on delete)"
  }
}
```

### `approval_request`

Emitted when the agent wants to call a tool that requires human approval (configured in `AgentConfig.require_human_approval_for`). The stream pauses until the frontend submits a decision via `POST /api/runs/{run_id}/approval`.

```json
{
  "type": "approval_request",
  "data": {
    "run_id": "string — the current run ID",
    "tool": "string — tool name requiring approval",
    "input": { "...": "tool-specific input object" }
  }
}
```

### `done`

Emitted once when the agent finishes successfully. Always the last event in a successful stream.

```json
{
  "type": "done",
  "data": {
    "run_id": "string — the run ID for fetching artifacts later",
    "iterations": "number — how many agent loop iterations ran",
    "total_tokens": "number — total input + output tokens used",
    "final_text": "string | undefined — the guardrail-scrubbed final response"
  }
}
```

### `error`

Emitted when the agent encounters a fatal error (guardrail block, loop limit exceeded, API failure). Always the last event in an error stream.

```json
{
  "type": "error",
  "data": {
    "message": "string — human-readable error description"
  }
}
```

---

## Constants

Backend constants are defined in `agent/agent_events.py` as `EventType.*`. Frontend types are defined in `client-nextjs/src/lib/types.ts` as the `SSEEvent` discriminated union.

When adding a new event type:
1. Add it to `EventType` in `agent_events.py`
2. Add a corresponding interface and union member in `types.ts`
3. Handle it in `useAgentStream.ts` → `processEvent()`
4. Update this document
