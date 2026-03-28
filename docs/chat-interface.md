# Chat Bot Interface — Implementation Plan

> A streaming chat UI for the agent in `server-fastapi/`, with a live plan
> panel, file output viewer, and conversation history persisted in SQLite.

---

## 1. What We're Building

A two-panel web interface:

```
┌──────────────────────────────────┬──────────────────────────┐
│                                  │  PLAN PANEL              │
│  CHAT PANEL                      │  ┌──────────────────────┐│
│                                  │  │ Goal: ...            ││
│  ┌────────────────────────────┐  │  │ Steps:               ││
│  │ User: Summarize this PDF   │  │  │  [x] Parse document  ││
│  │                            │  │  │  [~] Extract themes  ││
│  │ Agent: I'll start by...    │  │  │  [ ] Write summary   ││
│  │ ██ (streaming cursor)      │  │  │ Done when: ...       ││
│  └────────────────────────────┘  │  └──────────────────────┘│
│                                  │                          │
│                                  │  OUTPUT FILES            │
│                                  │  ┌──────────────────────┐│
│                                  │  │  report.md           ││
│  ┌────────────────────────────┐  │  │  notes.md            ││
│  │ Type a message...    [Send]│  │  └──────────────────────┘│
│  └────────────────────────────┘  │                          │
└──────────────────────────────────┴──────────────────────────┘
```

**Left panel — Chat:** Conversation thread with streamed agent text responses.
**Right panel — Plan:** The agent's plan (goal, steps, completion criteria) streamed live as it's generated. Below that, a file browser showing the agent's output files, viewable inline.

---

## 2. Why These Technology Choices

| Choice | Why |
|--------|-----|
| **FastAPI + SSE** | FastAPI is already a dependency. Server-Sent Events are the simplest streaming protocol — one-directional, works over plain HTTP, no WebSocket complexity. Perfect for "server pushes tokens to client." |
| **SQLite** | Zero-config, single-file database. Great for learning (you can inspect it with any SQLite browser). Production-ready for single-server apps. |
| **Next.js (existing)** | Already in the repo. React 19 + Server Components give us a modern frontend with good streaming support. |
| **Filesystem for agent runs** | Already how the agent works — scratchpad dirs under `agent_runs/`. We keep this as-is and just add SQLite for conversation metadata. |

### What goes where

```
SQLite (structured metadata)          Filesystem (agent artifacts)
─────────────────────────             ──────────────────────────
• conversations                       • agent_runs/{run_id}/
• messages (user + assistant)           ├── notes/plan.md
• run references (run_id per msg)       ├── output/report.md
• timestamps, token counts              ├── research/
                                        ├── scratch/
                                        └── state.json
```

**Rule of thumb:** SQLite holds *what happened* (conversation history, metadata).
The filesystem holds *what the agent produced* (files, plan, state).

---

## 3. Backend — FastAPI Endpoints

### 3.1 Data Models (SQLite via raw `sqlite3`)

We use Python's built-in `sqlite3` module — no ORM. This keeps the code
transparent: every query is visible, every table is obvious. For a learning
project, seeing `SELECT * FROM messages WHERE conversation_id = ?` teaches
more than `session.query(Message).filter_by(...)`.

```sql
-- Schema: server-fastapi/app/db/schema.sql

CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,   -- UUID
    title       TEXT NOT NULL,      -- Auto-generated from first message
    created_at  TEXT NOT NULL,      -- ISO 8601
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,   -- UUID
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role            TEXT NOT NULL,      -- 'user' | 'assistant'
    content         TEXT NOT NULL,      -- The message text
    run_id          TEXT,              -- Links to agent_runs/{run_id}/ (NULL for user msgs)
    token_count     INTEGER,           -- Tokens used for this response
    created_at      TEXT NOT NULL,

    -- Index for fast conversation lookups
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, created_at);
```

Why raw SQL instead of an ORM:
- You can copy-paste queries into a SQLite browser to debug
- No "magic" — every database interaction is explicit
- The schema file *is* the documentation
- For 2 tables, an ORM adds complexity without value

### 3.2 Database Module

```
server-fastapi/app/db/
├── schema.sql          -- The CREATE TABLE statements above
├── database.py         -- Connection management + migration runner
└── queries.py          -- All SQL queries as named functions
```

**`database.py`** — Handles connection lifecycle:
- `get_db() -> sqlite3.Connection` — Returns a connection with WAL mode enabled
  and `row_factory = sqlite3.Row` (so rows behave like dicts).
- `init_db()` — Reads `schema.sql` and executes it. Called once at startup.
- Uses `contextmanager` pattern so connections auto-close.

**`queries.py`** — Every database operation is a simple function:
- `create_conversation(db, title) -> conversation_id`
- `list_conversations(db) -> list[dict]`
- `get_conversation(db, conversation_id) -> dict`
- `add_message(db, conversation_id, role, content, run_id=None) -> message_id`
- `get_messages(db, conversation_id) -> list[dict]`
- `delete_conversation(db, conversation_id)`

Each function takes a `db` connection as its first argument. No global state.

### 3.3 Streaming Architecture

This is the most important section. Here's how tokens flow from Claude's API
to the user's browser:

```
Claude API           FastAPI              Browser
─────────            ───────              ───────
stream chunk ──►  async generator ──►  SSE event
stream chunk ──►  async generator ──►  SSE event
stream chunk ──►  async generator ──►  SSE event
   ...                  ...                ...
[end]        ──►  final event     ──►  SSE: done
```

**Step by step:**

1. User sends a message via `POST /api/conversations/{id}/messages`
2. FastAPI saves the user message to SQLite
3. FastAPI calls `run_agent_streaming()` — a new generator version of `run_agent()`
4. The agent loop yields **events** instead of only returning a final result
5. FastAPI wraps these events in SSE format and streams them to the client
6. When the agent finishes, the assistant message is saved to SQLite

#### SSE Event Types

Each event is a JSON object sent as an SSE `data:` line:

```jsonc
// Agent's plan was generated or updated
{
  "type": "plan",
  "data": {
    "goal": "Summarize the document",
    "steps": ["Parse document", "Extract themes", "Write summary"],
    "done_when": "A 3-paragraph summary exists in output/summary.md",
    "output_files": ["output/summary.md"]
  }
}

// A chunk of the agent's text response (streamed token-by-token)
{
  "type": "text_delta",
  "data": { "content": "I'll start by" }
}

// The agent called a tool
{
  "type": "tool_call",
  "data": {
    "tool": "write_file",
    "input": { "path": "output/summary.md", "content": "..." },
    "result": "File written successfully"
  }
}

// A file was created or updated in the scratchpad
{
  "type": "file_update",
  "data": {
    "path": "output/summary.md",
    "action": "created"   // or "updated" | "deleted"
  }
}

// Agent finished
{
  "type": "done",
  "data": {
    "run_id": "f503498c",
    "iterations": 4,
    "total_tokens": 12340
  }
}

// Something went wrong
{
  "type": "error",
  "data": { "message": "Token budget exceeded" }
}
```

### 3.4 API Endpoints

```
server-fastapi/app/api/
├── router.py           -- FastAPI router, all endpoints
└── streaming.py        -- SSE streaming helpers
```

#### Conversations

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/conversations` | List all conversations (id, title, updated_at) |
| `POST` | `/api/conversations` | Create a new conversation → returns `{ id, title }` |
| `GET` | `/api/conversations/{id}` | Get conversation with all messages |
| `DELETE` | `/api/conversations/{id}` | Delete conversation and its agent runs |

#### Messages & Streaming

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/conversations/{id}/messages` | Send user message, returns SSE stream of agent response |

The POST endpoint is the core of the system. It:
1. Accepts `{ "content": "user's message" }`
2. Returns `Content-Type: text/event-stream`
3. Streams SSE events as the agent works

#### Agent Run Files

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/runs/{run_id}/files` | List files in the agent's scratchpad |
| `GET` | `/api/runs/{run_id}/files/{path}` | Read a specific file's content |
| `GET` | `/api/runs/{run_id}/plan` | Get the current plan (reads `notes/plan.md`) |

These let the frontend fetch file contents when the user clicks on a file
in the output panel.

### 3.5 Making `run_agent()` Streamable

The current `run_agent()` in `agent.py` runs synchronously and returns a
final result. We need a streaming version. Here's the approach:

**New file: `server-fastapi/app/agent/agent_streaming.py`**

```python
async def run_agent_streaming(
    task: str,
    config: AgentConfig | None = None,
    resume_run_id: str | None = None,
    # ... same params as run_agent
) -> AsyncGenerator[dict, None]:
    """
    Same logic as run_agent(), but yields event dicts instead of
    returning a single result.

    This is a separate function (not a modification of run_agent)
    so you can read both side-by-side and understand the differences.
    """
```

Key differences from `run_agent()`:

1. **Uses `anthropic.AsyncAnthropic`** — The async client, so we don't block
   the FastAPI event loop.

2. **Uses `client.messages.stream()`** — The Anthropic SDK's streaming
   interface. Instead of getting the full response at once, we get individual
   `content_block_delta` events with partial text.

3. **Yields events at key moments:**
   - After plan generation → `yield {"type": "plan", ...}`
   - On each text delta → `yield {"type": "text_delta", ...}`
   - After each tool call → `yield {"type": "tool_call", ...}`
   - When a scratchpad file changes → `yield {"type": "file_update", ...}`
   - On completion → `yield {"type": "done", ...}`

4. **Accumulates the full response** alongside streaming — we still need the
   complete text to save to SQLite after streaming finishes.

The non-streaming `run_agent()` stays unchanged. Both versions exist so you
can compare synchronous vs async patterns.

#### How streaming works with the Anthropic SDK

```python
# Non-streaming (current code):
response = client.messages.create(model=..., messages=..., tools=...)
# Returns complete response. Simple but no live updates.

# Streaming (new code):
async with client.messages.stream(model=..., messages=..., tools=...) as stream:
    async for event in stream:
        if event.type == "content_block_delta":
            if event.delta.type == "text_delta":
                yield {"type": "text_delta", "data": {"content": event.delta.text}}
            elif event.delta.type == "input_json_delta":
                # Tool input being constructed (partial JSON)
                pass
        elif event.type == "message_stop":
            # Stream complete
            pass
    # stream.get_final_message() gives the complete response
    final = stream.get_final_message()
```

### 3.6 Planner Streaming

The current `AgentPlanner.create_plan()` calls `claude-haiku-4-5` and waits
for the full plan. For the UI, we want to stream the plan as it's generated:

```python
async def create_plan_streaming(self, task, ...) -> AsyncGenerator[dict, None]:
    async with client.messages.stream(...) as stream:
        async for event in stream:
            # Yield partial plan JSON as it arrives
            yield {"type": "plan_delta", "data": {"content": event.delta.text}}

    # Parse the final plan
    plan = parse_plan(stream.get_final_message())
    yield {"type": "plan", "data": plan.to_dict()}
```

The frontend gets `plan_delta` events during generation (to show streaming
text), then a final `plan` event with the structured plan object.

---

## 4. Frontend — Next.js Chat UI

### 4.1 File Structure

```
client-nextjs/
├── src/
│   ├── app/
│   │   ├── layout.tsx              -- Root layout, sidebar
│   │   ├── page.tsx                -- Redirect to /chat or landing
│   │   └── chat/
│   │       ├── page.tsx            -- New conversation page
│   │       └── [conversationId]/
│   │           └── page.tsx        -- Conversation view (main UI)
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx       -- Left panel: message thread + input
│   │   │   ├── MessageBubble.tsx   -- Single message (user or assistant)
│   │   │   ├── MessageInput.tsx    -- Text input + send button
│   │   │   └── StreamingText.tsx   -- Text that animates in token-by-token
│   │   ├── plan/
│   │   │   ├── PlanPanel.tsx       -- Right panel: plan + files
│   │   │   ├── PlanView.tsx        -- Renders the structured plan
│   │   │   └── FileViewer.tsx      -- Shows file contents in a code block
│   │   └── sidebar/
│   │       └── ConversationList.tsx -- List of past conversations
│   ├── hooks/
│   │   ├── useSSE.ts               -- Core hook: connects to SSE endpoint
│   │   ├── useConversation.ts      -- Manages conversation state
│   │   └── useAgentStream.ts       -- Processes SSE events into UI state
│   └── lib/
│       ├── api.ts                  -- Fetch wrappers for REST endpoints
│       └── types.ts                -- TypeScript types matching backend models
```

### 4.2 The SSE Hook — `useSSE.ts`

This is the most important frontend code. It connects to the streaming
endpoint and dispatches events:

```typescript
// Simplified — the real version needs error handling and reconnection

function useSSE(url: string | null) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!url) return;

    setIsStreaming(true);

    // EventSource is the browser's built-in SSE client.
    // It automatically reconnects on disconnect.
    const source = new EventSource(url);

    source.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      setEvents(prev => [...prev, parsed]);

      if (parsed.type === "done" || parsed.type === "error") {
        source.close();
        setIsStreaming(false);
      }
    };

    source.onerror = () => {
      source.close();
      setIsStreaming(false);
    };

    return () => source.close();
  }, [url]);

  return { events, isStreaming };
}
```

**Why EventSource and not fetch?** `EventSource` is purpose-built for SSE. It
handles reconnection, parsing the SSE wire format, and dispatching events.
However, it only supports GET requests. Since our streaming endpoint is a POST,
we'll use `fetch` with a ReadableStream instead:

```typescript
async function* streamPost(url: string, body: object): AsyncGenerator<SSEEvent> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE format: each event is "data: {...}\n\n"
    const lines = buffer.split("\n\n");
    buffer = lines.pop()!; // Keep incomplete chunk in buffer

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        yield JSON.parse(line.slice(6));
      }
    }
  }
}
```

### 4.3 The Agent Stream Hook — `useAgentStream.ts`

Transforms raw SSE events into structured UI state:

```typescript
interface AgentStreamState {
  // Chat panel
  streamingText: string;       // Current assistant message being streamed
  isStreaming: boolean;

  // Plan panel
  plan: Plan | null;           // Structured plan (after generation)
  planStreamText: string;      // Raw plan text during streaming

  // Files panel
  files: FileInfo[];           // List of files in agent scratchpad
  selectedFile: string | null; // Currently viewed file

  // Metadata
  toolCalls: ToolCall[];       // History of tool calls for this response
  runId: string | null;
}
```

The hook processes each event type:
- `plan_delta` → append to `planStreamText`
- `plan` → set `plan` (structured), clear `planStreamText`
- `text_delta` → append to `streamingText`
- `tool_call` → append to `toolCalls`
- `file_update` → update `files` list
- `done` → set `isStreaming = false`, finalize message

### 4.4 Component Behavior

**`ChatPanel`**
- Scrolls to bottom on new content
- Shows a typing indicator while streaming
- Disables input while agent is working
- Renders markdown in assistant messages (use `react-markdown`)

**`PlanPanel`**
- During plan generation: shows streaming text with a cursor
- After plan is ready: renders structured plan with checkboxes
- Steps update to checked as the agent completes them (via `plan_update` events)
- Below the plan: file list, clickable to view contents

**`FileViewer`**
- Fetches file content from `GET /api/runs/{run_id}/files/{path}`
- Syntax highlights based on file extension
- Updates live when a `file_update` event arrives for the viewed file

**`ConversationList`** (sidebar)
- Lists conversations from `GET /api/conversations`
- Click to load, shows title and last-updated time
- "New conversation" button at top

---

## 5. Implementation Order

Ordered so each step produces something you can test and see working:

### Phase 1 — Backend Foundation
> Goal: A working API you can test with curl.

**Step 1: SQLite database module**
- Files: `app/db/schema.sql`, `app/db/database.py`, `app/db/queries.py`
- Test: Run `init_db()`, inspect the `.db` file with a SQLite browser

**Step 2: REST endpoints (non-streaming)**
- File: `app/api/router.py`
- Wire up FastAPI app in `main.py` with `uvicorn`
- Endpoints: CRUD for conversations, list messages, get run files
- Test: `curl http://localhost:8000/api/conversations`

**Step 3: Streaming agent function**
- File: `app/agent/agent_streaming.py`
- Port `run_agent()` to async generator
- Test: Run it directly in a script, print yielded events

**Step 4: SSE streaming endpoint**
- File: `app/api/streaming.py`
- `POST /api/conversations/{id}/messages` → SSE stream
- Test: `curl -N -X POST ... | cat` to see streaming events

### Phase 2 — Frontend Shell
> Goal: A functional chat UI connected to the real backend.

**Step 5: API client and types**
- Files: `lib/api.ts`, `lib/types.ts`
- Fetch wrappers for all REST endpoints + SSE stream parser

**Step 6: Chat page layout**
- Files: `app/chat/[conversationId]/page.tsx`, all components
- Two-panel layout, conversation sidebar
- Wire up `useAgentStream` to display streamed text

**Step 7: Plan panel**
- Files: `components/plan/PlanPanel.tsx`, `PlanView.tsx`
- Stream plan text, then render structured plan
- File list with viewer

### Phase 3 — Polish
> Goal: A complete, pleasant experience.

**Step 8: Conversation management**
- New conversation flow, delete, title generation
- Persist sidebar state

**Step 9: Error handling and edge cases**
- Network disconnects (show reconnecting state)
- Agent errors (show error in chat)
- Long messages (virtualized scrolling if needed)

**Step 10: Styling and UX**
- Loading states, transitions, responsive layout
- Dark mode (Tailwind `dark:` classes)

---

## 6. Key Design Decisions Explained

### Why SSE over WebSockets?

WebSockets are bidirectional — the client can send data *and* the server can
push data, over a single persistent connection. SSE is simpler: the server
pushes data, and the client sends data via normal HTTP requests.

For our use case, the client sends a message (one HTTP POST), then the server
streams back events. That's a perfect fit for SSE. WebSockets would add:
- Connection management (heartbeats, reconnection)
- A message protocol (SSE has one built-in)
- More complex server code (WebSocket handlers vs regular endpoints)

We'd use WebSockets if we needed the client to send data *while* the server
is streaming (e.g., cancelling mid-stream). We could add that later — the
event format stays the same.

### Why keep `run_agent()` and add `run_agent_streaming()` separately?

1. **Readability** — You can read the simple synchronous version first to
   understand the logic, then see how the async version adds streaming.
2. **Testability** — The sync version is easier to test in isolation.
3. **Flexibility** — CLI usage can stay simple. Not everything needs streaming.

### Why raw `sqlite3` instead of SQLAlchemy?

For 2 tables and ~6 queries, an ORM would add more code than it saves. Raw
SQL is also more transferable knowledge — you'll use SQL everywhere, but
SQLAlchemy is Python-specific. Every query in `queries.py` is copy-pasteable
into a SQLite shell for debugging.

### Why filesystem + SQLite instead of just one?

The agent *already* writes files to its scratchpad — that's how it works.
Forcing everything into SQLite would mean serializing files as BLOBs or
base64, which is worse for debugging (you can't just `cat` a file). SQLite
handles what it's good at: structured queries over metadata.

---

## 7. Sequence Diagram — Full Request Flow

```
User            Browser           FastAPI            Agent             Claude API
 │                │                  │                 │                   │
 │  types msg     │                  │                 │                   │
 │───────────────>│                  │                 │                   │
 │                │  POST /messages  │                 │                   │
 │                │─────────────────>│                 │                   │
 │                │                  │  save user msg  │                   │
 │                │                  │  to SQLite      │                   │
 │                │                  │                 │                   │
 │                │  SSE stream open │                 │                   │
 │                │<─────────────────│                 │                   │
 │                │                  │  run_agent_     │                   │
 │                │                  │  streaming()    │                   │
 │                │                  │────────────────>│                   │
 │                │                  │                 │  create plan      │
 │                │                  │                 │──────────────────>│
 │                │                  │                 │  plan stream      │
 │                │  SSE: plan_delta │                 │<──────────────────│
 │                │<─────────────────│<────────────────│                   │
 │  plan appears  │                  │                 │                   │
 │<───────────────│                  │                 │                   │
 │                │                  │                 │  plan complete    │
 │                │  SSE: plan       │                 │<──────────────────│
 │                │<─────────────────│<────────────────│                   │
 │                │                  │                 │                   │
 │                │                  │                 │  agent loop       │
 │                │                  │                 │──────────────────>│
 │                │                  │                 │  text stream      │
 │                │  SSE: text_delta │                 │<──────────────────│
 │                │<─────────────────│<────────────────│ (repeated)        │
 │  text streams  │                  │                 │                   │
 │<───────────────│                  │                 │                   │
 │                │                  │                 │  tool_use         │
 │                │                  │                 │<──────────────────│
 │                │                  │                 │  execute tool     │
 │                │  SSE: tool_call  │                 │                   │
 │                │<─────────────────│<────────────────│                   │
 │                │  SSE: file_update│                 │  (if file write)  │
 │                │<─────────────────│<────────────────│                   │
 │                │                  │                 │                   │
 │                │                  │                 │  ... more loops   │
 │                │                  │                 │                   │
 │                │                  │                 │  end_turn         │
 │                │                  │                 │<──────────────────│
 │                │  SSE: done       │  save assistant │                   │
 │                │<─────────────────│  msg to SQLite  │                   │
 │  complete      │                  │                 │                   │
 │<───────────────│                  │                 │                   │
```

---

## 8. File Tree — Final State

```
server-fastapi/
├── app/
│   ├── main.py                     # FastAPI app startup + uvicorn
│   ├── db/
│   │   ├── schema.sql              # Table definitions
│   │   ├── database.py             # Connection management
│   │   └── queries.py              # All SQL queries
│   ├── api/
│   │   ├── router.py               # All HTTP endpoints
│   │   └── streaming.py            # SSE formatting helpers
│   └── agent/
│       ├── agent.py                # Original sync agent (unchanged)
│       ├── agent_streaming.py      # NEW: async streaming agent
│       ├── agent_config.py         # (unchanged)
│       ├── agent_state.py          # (unchanged)
│       ├── agent_scratchpad.py     # (unchanged)
│       ├── agent_memory.py         # (unchanged)
│       ├── agent_planner.py        # Add streaming plan method
│       ├── agent_guardrails.py     # (unchanged)
│       └── agent_utils.py          # (unchanged)

client-nextjs/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── chat/
│   │       ├── page.tsx
│   │       └── [conversationId]/
│   │           └── page.tsx
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── StreamingText.tsx
│   │   ├── plan/
│   │   │   ├── PlanPanel.tsx
│   │   │   ├── PlanView.tsx
│   │   │   └── FileViewer.tsx
│   │   └── sidebar/
│   │       └── ConversationList.tsx
│   ├── hooks/
│   │   ├── useSSE.ts
│   │   ├── useConversation.ts
│   │   └── useAgentStream.ts
│   └── lib/
│       ├── api.ts
│       └── types.ts
```

---

## 9. CORS and Dev Setup

During development, the frontend (Next.js on port 3000) and backend (FastAPI
on port 8000) run on different ports. FastAPI needs CORS middleware:

```python
# In main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

For production, you'd put both behind a reverse proxy on the same domain,
eliminating the CORS issue entirely.

---

## 10. What This Plan Does NOT Cover (Future Work)

These are intentionally out of scope to keep the first version simple:

- **Authentication** — No login, single-user. Add auth when you need multi-user.
- **Cancellation** — Can't stop the agent mid-run. Would need WebSockets or a cancel endpoint.
- **Multi-agent** — Uses the existing single agent. Multi-agent handoffs are specced in `docs/multi-agent-and-eval.md`.
- **File upload** — User can't upload files for the agent to process. Would need a `POST /upload` endpoint + scratchpad integration.
- **Mobile responsive** — Desktop-first. Responsive layout is a polish task.
