# Refactoring Opportunities

A comprehensive audit of the full stack — both `client-nextjs/` and `server-fastapi/` — with every opportunity framed around making this codebase as **readable, explainable, and learnable** as possible.

---

## Table of Contents

1. [Frontend: Layout Duplication](#1-frontend-layout-duplication)
2. [Frontend: Repeated Collapsible Sections](#2-frontend-repeated-collapsible-sections)
3. [Frontend: Inline SVG Icons Scattered Everywhere](#3-frontend-inline-svg-icons-scattered-everywhere)
4. [Frontend: Data Fetching Mixed Into Components](#4-frontend-data-fetching-mixed-into-components)
5. [Frontend: Missing Error Handling in Hooks](#5-frontend-missing-error-handling-in-hooks)
6. [Frontend: Inconsistent Navigation (useRouter vs pushState)](#6-frontend-inconsistent-navigation-userouter-vs-pushstate)
7. [Frontend: Hardcoded API Base URL](#7-frontend-hardcoded-api-base-url)
8. [Frontend: Types Defined in the Wrong Place](#8-frontend-types-defined-in-the-wrong-place)
9. [Backend: Sync/Async Agent Loop Duplication](#9-backend-syncasync-agent-loop-duplication)
10. [Backend: Sync/Async Planner Duplication](#10-backend-syncasync-planner-duplication)
11. [Backend: Database Boilerplate in Every Route](#11-backend-database-boilerplate-in-every-route)
12. [Backend: Magic Strings for SSE Event Types](#12-backend-magic-strings-for-sse-event-types)
13. [Backend: Hardcoded Configuration Everywhere](#13-backend-hardcoded-configuration-everywhere)
14. [Backend: Global Mutable State for HITL Approvals](#14-backend-global-mutable-state-for-hitl-approvals)
15. [Backend: Undefined Method Called at Runtime](#15-backend-undefined-method-called-at-runtime)
16. [Backend: Inconsistent Error Conventions](#16-backend-inconsistent-error-conventions)
17. [Backend: Manual JSON Serialization in Queries](#17-backend-manual-json-serialization-in-queries)
18. [Backend: Dead Code in Streaming Agent](#18-backend-dead-code-in-streaming-agent)
19. [Full Stack: No Shared Event Contract](#19-full-stack-no-shared-event-contract)
20. [Full Stack: Documentation Gaps](#20-full-stack-documentation-gaps)

---

## 1. Frontend: Layout Duplication

**Where:** `app/chat/page.tsx` and `app/chat/[conversationId]/page.tsx`

**The problem:** Both pages render the same shell — title bar, activity bar, sidebar with conversation list, and a main content area. Roughly 150 lines of JSX are copy-pasted between them. If you change the sidebar layout, you have to change it in two places and hope you don't forget one.

**Why this hurts readability:** A newcomer sees two large page files that look almost identical and has to mentally diff them to understand what's actually different (the content area). The *real* logic — streaming, message handling — is buried inside the duplicate scaffolding.

**What to do:**
- Extract a `<ChatLayout>` component that owns the title bar, activity bar, sidebar, and main content slot.
- Each page becomes tiny: it renders `<ChatLayout>` and passes its unique content as children.
- The layout component takes props like `sidebarCollapsed`, `onNewChat`, `conversations`, etc.

**Learning value:** This is a textbook example of the "Extract Layout" pattern in React. It teaches component composition, the `children` prop, and the DRY principle applied to page scaffolding.

---

## 2. Frontend: Repeated Collapsible Sections

**Where:** `InlinePlan.tsx` and `WorkspacePanel.tsx`

**The problem:** Both components render collapsible sections (Plan, Tool Calls, Output Files) using the same pattern: a button with a rotating chevron, an `expanded` state, and conditionally rendered children. This pattern appears **5+ times** across these two files.

**Why this hurts readability:** Every collapsible section is 15-20 lines of nearly identical JSX. A reader has to re-parse the same rotate-transform logic each time to confirm "yes, this is another collapsible section."

**What to do:**
- Create a `<Collapsible>` component:
  ```tsx
  function Collapsible({ title, defaultOpen, children }) {
    const [expanded, setExpanded] = useState(defaultOpen);
    return (
      <div>
        <button onClick={() => setExpanded(!expanded)}>
          <ChevronIcon className={expanded ? "rotate-90" : ""} />
          {title}
        </button>
        {expanded && children}
      </div>
    );
  }
  ```
- Replace every hand-rolled collapsible with `<Collapsible title="Plan">...</Collapsible>`.

**Learning value:** Teaches the "Extract Component" refactor — recognizing repeated UI patterns and lifting them into a reusable abstraction.

---

## 3. Frontend: Inline SVG Icons Scattered Everywhere

**Where:** `ChatPanel.tsx`, `ConversationList.tsx`, `WorkspacePanel.tsx`, both page files

**The problem:** SVG icons are hardcoded inline in 6+ places. The same chat-bubble icon, file icon, and trash icon are copy-pasted as raw `<svg>` markup.

**Why this hurts readability:** SVG markup is dense and noisy. When you're scanning JSX to understand a component's structure, a 4-line `<svg>` block is visual clutter that obscures the actual logic.

**What to do:**
- Create `src/components/icons/` with named exports: `ChatIcon`, `FileIcon`, `TrashIcon`, `ChevronIcon`, etc.
- Each is a tiny component that returns an `<svg>` and accepts `className` for sizing/color.
- Replace all inline SVGs with icon components.

**Learning value:** Demonstrates the "Extract to Named Component" pattern for non-logic elements. Also introduces the convention of an `icons/` directory, which is standard in production codebases.

---

## 4. Frontend: Data Fetching Mixed Into Components

**Where:** `InlinePlan.tsx` (fetches plan + files in a `useEffect`), `WorkspacePanel.tsx` (same fetch logic duplicated)

**The problem:** Both components contain `useEffect` blocks that call `getRunPlan()` and `getRunFiles()` with `Promise.all()`. The fetching logic, loading state, and error handling are all tangled into the rendering component.

**Why this hurts readability:** A reader opening `InlinePlan.tsx` has to context-switch between "what does this component render?" and "how does it get its data?" Two concerns in one file.

**What to do:**
- Extract a `useRunData(runId)` hook that returns `{ plan, files, loading }`.
- Both components import the hook and focus purely on rendering.

**Learning value:** Teaches the "Custom Hook for Data Fetching" pattern — one of the most important React patterns to understand. The hook encapsulates the async lifecycle, the component stays declarative.

---

## 5. Frontend: Missing Error Handling in Hooks

**Where:** `useConversation.ts` — `loadConversation()`, `refresh()`, `createConversation()`

**The problem:** None of the async functions in this hook have try/catch blocks. If the API is down or returns an error, the promise rejects silently. The UI shows nothing — no error message, no retry button, just a blank screen.

**Why this hurts readability:** When a learner reads this hook, they see the "happy path" only. They might assume this is the right way to write async code. It also makes debugging harder — network errors produce no visible feedback.

**What to do:**
- Add an `error` state to the hook.
- Wrap each async call in try/catch, set the error state on failure.
- Expose `error` from the hook so components can render an error banner.
- Optionally add a `retry()` function.

**Learning value:** Teaches error state management in hooks — a critical production skill that's often skipped in tutorials.

---

## 6. Frontend: Inconsistent Navigation (useRouter vs pushState)

**Where:** `app/chat/page.tsx` uses `useRouter().push()`, `app/chat/[conversationId]/page.tsx` uses `window.history.pushState()`

**The problem:** Two different navigation mechanisms in the same app. `useRouter()` integrates with Next.js navigation (prefetching, layout persistence). `history.pushState()` is a raw browser API that bypasses Next.js entirely.

**Why this hurts readability:** A learner sees two approaches and doesn't know which is "correct." They might copy the wrong one for their use case.

**What to do:** Pick one. `useRouter()` is the Next.js-idiomatic choice. Use it everywhere unless you have a specific reason for `pushState` (e.g., avoiding a full page remount — if so, document why).

**Learning value:** Teaches the importance of consistency and understanding the framework's navigation model.

---

## 7. Frontend: Hardcoded API Base URL

**Where:** `src/lib/api.ts` line 3 — `const API_BASE = "http://localhost:8005/api"`

**The problem:** The API URL is a hardcoded string. Can't switch between dev/staging/prod without editing source code. Also inconsistent with CLAUDE.md which references port 8001.

**What to do:**
```ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8005/api";
```

**Learning value:** Teaches environment-based configuration — a fundamental practice in any deployable application.

---

## 8. Frontend: Types Defined in the Wrong Place

**Where:** `useAgentStream.ts` locally defines `ToolCall` and `PendingApproval` interfaces (lines 7-17)

**The problem:** These types are used by both the hook and the components that consume it, but they're defined inside the hook file. If another component needs to type-check a tool call, it has to import from a hook file or redefine the type.

**What to do:** Move `ToolCall` and `PendingApproval` to `src/lib/types.ts` alongside the other shared types.

**Learning value:** Teaches the principle of colocating types by *domain* (shared types file), not by *first usage* (wherever they were first needed).

---

## 9. Backend: Sync/Async Agent Loop Duplication

**Where:** `agent_root_cli.py` and `agent_root_streaming.py`

**The problem:** These two files implement the same agent loop — input guardrails, planner, agentic iteration, tool execution, output guardrails — but one is synchronous (for CLI) and the other is async (for the API). Roughly **80% of the logic is identical**: system prompt construction, loop limit checking, guardrail application, tool result formatting.

**Why this hurts readability:** A learner who reads one file and then opens the other thinks "wait, didn't I just read this?" They have to carefully spot the 20% that differs (async/await, SSE yields, HITL via queue vs stdin). The actual differences are obscured by the ocean of sameness.

**What to do:**
- Extract shared logic into pure functions in `agent_utils.py`:
  - `build_system_prompt(plan, memory, config) -> str`
  - `check_and_apply_guardrails(tool_name, tool_input, guardrails, config) -> GuardrailResult`
  - `format_tool_result(tool_name, result, is_error) -> dict`
  - `handle_max_tokens_response(state) -> message`
- Each agent loop imports these helpers and adds only its unique behavior (sync vs async client calls, SSE yielding, HITL mechanism).

**Learning value:** This is the most impactful refactor in the codebase. It teaches how to factor out shared logic from two parallel implementations — a pattern that comes up constantly when supporting sync + async Python.

---

## 10. Backend: Sync/Async Planner Duplication

**Where:** `agent_planner.py` — `run_planner()` and `run_planner_async()` are 95% identical

**The problem:** Same system prompt, same JSON example, same fallback logic, same markdown generation. The only difference is `client.messages.create()` vs `await client.messages.create()`.

**What to do:**
- Extract prompt construction, JSON parsing, fallback, and markdown generation into shared helper functions.
- Each entry point becomes a thin wrapper:
  ```python
  def run_planner(task, client):
      prompt = _build_planner_prompt(task)
      response = client.messages.create(**prompt)
      return _parse_planner_response(response, task)

  async def run_planner_async(task, client):
      prompt = _build_planner_prompt(task)
      response = await client.messages.create(**prompt)
      return _parse_planner_response(response, task)
  ```

**Learning value:** Shows how to minimize duplication in sync/async pairs — a very common Python pattern.

---

## 11. Backend: Database Boilerplate in Every Route

**Where:** `api/router.py` — every route handler

**The problem:** Every single route follows this pattern:
```python
db = get_db()
try:
    # do query
finally:
    db.close()
```

This is repeated 15+ times. It's noisy and error-prone (forgetting the `finally` block means a leaked connection).

**What to do:** Use FastAPI's dependency injection:
```python
def get_db_dep():
    db = get_db()
    try:
        yield db
    finally:
        db.close()

@router.get("/agents")
def list_agents(db = Depends(get_db_dep)):
    return list_agents_query(db)
```

Every route drops the try/finally and gets `db` as a parameter. The framework handles cleanup.

**Learning value:** Teaches FastAPI dependency injection — one of the framework's most powerful features, and the idiomatic way to manage resources.

---

## 12. Backend: Magic Strings for SSE Event Types

**Where:** Throughout `agent_root_streaming.py` and consumed by `api/router.py` and the frontend

**The problem:** Event types like `"plan"`, `"text_delta"`, `"tool_call"`, `"done"`, `"error"` are bare string literals. They appear in the backend when yielding events and in the frontend when parsing them. A typo in any of these strings silently breaks the connection between backend and frontend.

**What to do:**
- Define constants (or an enum) in the backend:
  ```python
  class EventType:
      PLAN = "plan"
      TEXT_DELTA = "text_delta"
      TOOL_CALL = "tool_call"
      FILE_UPDATE = "file_update"
      DONE = "done"
      ERROR = "error"
      APPROVAL_REQUEST = "approval_request"
  ```
- Use these everywhere instead of string literals.
- On the frontend, mirror them in `types.ts` (they're already partially there as discriminated union tags — just make them constants too).

**Learning value:** Teaches the "Replace Magic String with Named Constant" refactoring — one of the simplest and most impactful code quality improvements.

---

## 13. Backend: Hardcoded Configuration Everywhere

**Where:**
- `main.py:39` — CORS origin hardcoded to `localhost:3005`
- `agent_guardrails.py` — regex patterns, tool policies, path allowlists all hardcoded
- `agent_config.py` — approval list (`["delete", "send_email", "deploy"]`) hardcoded
- Ports and paths hardcoded in multiple files

**The problem:** Nothing is configurable without editing source code. The guardrail tool policies even reference paths like `/data/` and `/reports/` that don't exist in this project — likely copied from somewhere else.

**What to do:**
- Move CORS origins, ports, and feature flags to environment variables.
- Make guardrail patterns loadable from a config file or at least from `AgentConfig`.
- Remove or update the tool policies to match the actual tools in this system.

**Learning value:** Teaches the "Externalize Configuration" principle — code should define *behavior*, config should define *policy*.

---

## 14. Backend: Global Mutable State for HITL Approvals

**Where:** `agent_root_streaming.py` line 28 — `_pending_approvals: dict[str, asyncio.Queue] = {}`

**The problem:** This module-level dictionary grows every time an approval is requested but is never cleaned up. If a client disconnects while waiting for approval, the queue stays in memory forever.

**What to do:**
- Clean up the queue entry in a `finally` block after the approval is received or the stream ends.
- Add a timeout so approvals don't hang indefinitely.
- Consider scoping this state to a class rather than a module global, making the lifecycle explicit.

**Learning value:** Teaches the importance of resource cleanup for stateful async systems and the dangers of unbounded global state.

---

## 15. Backend: Undefined Method Called at Runtime

**Where:** `agent_root_cli.py` line 64 — `input_guard.llm_check(task)`

**The problem:** `InputGuardrails` has `check()` and `redact_pii()` methods, but no `llm_check()` method. If `config.use_llm_input_guard` is `True`, the code crashes with `AttributeError`.

**What to do:** Either implement `llm_check()` or remove the call and the `use_llm_input_guard` config field. Don't leave dead references — they confuse readers who think the feature works.

**Learning value:** A concrete example of why you should run your code before shipping. Also demonstrates why linters and type checkers (mypy) are valuable — they catch this statically.

---

## 16. Backend: Inconsistent Error Conventions

**Where:** Across the agent modules

**The problem:** Different modules handle "not found" differently:
- `agent_memory.py` returns a string: `"No memory found for key: 'x'"`
- `agent_scratchpad.py` returns a string: `"File not found: path"`
- `db/queries.py` returns `None`
- `agent_guardrails.py` raises exceptions (`MaxIterationsExceeded`, etc.)

A reader can't predict what a function returns on failure without reading its implementation.

**What to do:** Pick a convention and apply it consistently:
- **For tool functions** (memory, scratchpad): return strings, since these get fed back to Claude as tool results. This is already mostly consistent — just document it.
- **For internal functions** (DB queries, guardrails): raise exceptions or return `None` — pick one and document it.

**Learning value:** Teaches the importance of consistent error conventions across a codebase. When conventions are consistent, readers can predict behavior without reading implementation.

---

## 17. Backend: Manual JSON Serialization in Queries

**Where:** `db/queries.py` — `json.dumps()` on save, `json.loads()` on load, repeated for `config_json` and `tool_calls`

**The problem:** Every query function that touches a JSON column manually serializes/deserializes. This is easy to forget when adding new queries, leading to bugs where raw JSON strings end up in the UI.

**What to do:** Create small helpers:
```python
def _to_json(data: dict | list | None) -> str | None:
    return json.dumps(data) if data else None

def _from_json(text: str | None) -> dict | list | None:
    return json.loads(text) if text else None
```

Or, better yet, use SQLite's built-in JSON support with `json_extract()` for queries.

**Learning value:** Teaches the "Extract Helper" refactoring for repeated mechanical operations.

---

## 18. Backend: Dead Code in Streaming Agent

**Where:** `agent_root_streaming.py` line 156 — `accumulated_text = ""`

**The problem:** This variable accumulates all streamed text tokens but is never read. The final text is taken from the response object, not from the accumulator. This is dead code that confuses readers into thinking it's used somewhere.

**What to do:** Remove it.

**Learning value:** Dead code is worse than no code — it implies intent that doesn't exist. Teaches the value of cleaning up as you go.

---

## 19. Full Stack: No Shared Event Contract

**Where:** Backend SSE events in `agent_root_streaming.py`, frontend parsing in `useAgentStream.ts` and `types.ts`

**The problem:** The SSE event schema is defined implicitly — the backend yields dicts with certain keys, and the frontend has TypeScript types that must match. There's no single source of truth. If you add a field to a backend event, nothing tells you to update the frontend type.

**What to do (for a learning project):** Document the event contract explicitly. Add a `docs/sse-events.md` that lists every event type with its exact payload shape. Both backend and frontend reference this doc. The frontend `types.ts` discriminated unions already serve as a partial contract — just make sure they stay in sync with what the backend actually sends.

**Learning value:** Teaches the concept of API contracts and why schema-first design prevents drift between client and server.

---

## 20. Full Stack: Documentation Gaps

**Where:** Across the entire codebase

**The problem:** For a project whose purpose is learning:
- No docstrings on most Python functions
- No JSDoc on TypeScript functions
- No explanation of *why* defaults are chosen (e.g., why max_iterations=20? why 50k token budget?)
- No architecture diagram showing data flow
- API routes have no OpenAPI descriptions (FastAPI generates docs from these automatically)

**What to do:**
- Add docstrings to every public function in the backend. Focus on *why*, not *what* — the code shows what it does.
- Add brief JSDoc to exported functions in the frontend.
- Add OpenAPI `summary` and `description` to FastAPI route decorators — this gives you auto-generated API docs for free.
- Consider an architecture diagram (even ASCII art in a markdown file) showing: User -> Next.js -> SSE -> FastAPI -> Claude API -> Tools -> SSE back.

**Learning value:** Self-documenting code is a myth. Real codebases need strategic documentation, especially at boundaries (API contracts, module interfaces, non-obvious defaults).

---

## Priority Matrix

Sorted by impact on readability and learnability:

| Priority | Refactoring | Effort | Impact | Status |
|----------|------------|--------|--------|--------|
| 1 | Sync/Async agent loop dedup (#9) | High | Highest | ✅ Done — extracted `build_system_prompt`, `format_tool_result`, `check_tool_guardrail` into `agent_utils.py` |
| 2 | Extract `<ChatLayout>` (#1) | Medium | High | ✅ Done — `components/layout/ChatLayout.tsx`, both pages now ~50% smaller |
| 3 | DB dependency injection (#11) | Low | High | ✅ Done — `get_db_dep()` + `DB = Annotated[...]` in `router.py` |
| 4 | SSE event constants (#12) | Low | High | ✅ Done — `agent_events.py` with `EventType` class, used in streaming + router |
| 5 | Collapsible component (#2) | Low | Medium | ✅ Done — `components/ui/Collapsible.tsx`, used in `WorkspacePanel` |
| 6 | Icon components (#3) | Low | Medium | ✅ Done — `components/icons/index.tsx` with 9 icon components |
| 7 | Data fetching hooks (#4) | Medium | Medium | ✅ Done — `useRunData` hook in `hooks/useRunData.ts`, `InlinePlan` now uses hook + `Collapsible` |
| 8 | Planner dedup (#10) | Low | Medium | ✅ Done — shared `_parse_planner_response`, `_save_plan_to_scratchpad`, single prompt constant |
| 9 | Error handling in hooks (#5) | Medium | Medium | ✅ Done — `useConversation` now exposes `error` + `clearError`, all async ops wrapped in try/catch |
| 10 | Fix undefined method (#15) | Trivial | Medium | ✅ Done — removed `llm_check()` call from both agent loops |
| 11 | Environment config (#7, #13) | Low | Medium | ✅ Done — `NEXT_PUBLIC_API_BASE` env var, `CORS_ORIGINS` env var |
| 12 | Shared types (#8) | Trivial | Low | ✅ Done — `ToolCall` + `PendingApproval` moved to `types.ts` |
| 13 | Remove dead code (#18) | Trivial | Low | ✅ Done — removed unused `accumulated_text` variable |
| 14 | Navigation consistency (#6) | Low | Low | ✅ Done — both pages now use `router.push()` |
| 15 | JSON helpers (#17) | Low | Low | ✅ Done — `_to_json`/`_from_json` helpers in `queries.py`, all inline `json.dumps`/`json.loads` replaced |
| 16 | HITL cleanup (#14) | Medium | Low | ✅ Done — added `finally` block for `_pending_approvals` cleanup |
| 17 | Error conventions (#16) | Medium | Low | ✅ Done — documented conventions in `agent_guardrails.py` module docstring (tools→strings, DB→None, guardrails→exceptions) |
| 18 | Event contract docs (#19) | Medium | Medium | ✅ Done — `server-fastapi/docs/sse-events.md` documents all 7 event types with exact payload shapes |
| 19 | Docstrings & docs (#20) | High | High | ✅ Done — docstrings on all public functions in queries, guardrails, planner, config, agent loops, utils; OpenAPI summaries on all routes |
