# Multi-Agent Handoffs & Eval Harness

Implementation plans for two features built on top of the existing agent loop in `app/agent/`.

---

## Part 1: Multi-Agent Handoffs

### The Idea

Instead of one agent doing everything, a **coordinator** agent receives the task and delegates subtasks to **specialist** agents (researcher, writer, coder, etc.). Each specialist has its own system prompt, tools, and model — scoped to what it's good at.

### Architecture

```
User Task
    |
    v
+------------------+
|   Coordinator    |  claude-sonnet-4-6 (cheap, fast)
|   (orchestrator) |  tools: handoff_to_researcher, handoff_to_writer, handoff_to_coder
+------------------+
    |         |         |
    v         v         v
+--------+ +--------+ +--------+
|Research| | Writer | | Coder  |
| Agent  | | Agent  | | Agent  |
+--------+ +--------+ +--------+
  tools:     tools:     tools:
  web_search write_file write_file
  read_file  read_file  read_file
  save_memory            execute_code
```

### How to Build It

#### 1. Define specialist agent profiles

Create a new file `app/agent/agent_specialists.py`:

```python
from dataclasses import dataclass

@dataclass
class AgentProfile:
    name: str
    model: str
    system_prompt: str
    tool_names: list[str]          # subset of tools this agent can use
    max_iterations: int = 10
    max_tokens_total: int = 30_000

SPECIALISTS = {
    "researcher": AgentProfile(
        name="researcher",
        model="claude-sonnet-4-6",
        system_prompt=(
            "You are a research specialist. Your job is to gather information "
            "and save structured findings to research/ files on the scratchpad. "
            "Do NOT write final output — just collect facts."
        ),
        tool_names=["web_search", "read_file", "write_file", "append_file"],
    ),
    "writer": AgentProfile(
        name="writer",
        model="claude-sonnet-4-6",
        system_prompt=(
            "You are a writing specialist. Read research from the scratchpad "
            "and produce polished output in output/ files. "
            "Do NOT do research — work only with what's already gathered."
        ),
        tool_names=["read_file", "write_file", "list_files"],
    ),
    "coder": AgentProfile(
        name="coder",
        model="claude-sonnet-4-6",
        system_prompt=(
            "You are a coding specialist. Write, test, and debug code. "
            "Save working code to output/ files."
        ),
        tool_names=["read_file", "write_file", "execute_code"],
    ),
}
```

#### 2. Build a `run_specialist` function

This is a slimmed-down version of `run_agent` that:
- Takes an `AgentProfile` and a subtask string
- Uses the **same scratchpad** as the coordinator (so agents share files)
- Has its own message history (isolated conversation)
- Returns a text summary when done

```python
def run_specialist(
    profile: AgentProfile,
    subtask: str,
    scratchpad: AgentScratchpad,
    memory: AgentMemory,
    client: anthropic.Anthropic,
) -> str:
    """Run a specialist agent loop. Returns its final text response."""
    # Filter tool_definitions and tool_map to only what this specialist can use
    specialist_tools = {k: v for k, v in all_tools.items() if k in profile.tool_names}
    specialist_defs = [d for d in all_tool_defs if d["name"] in profile.tool_names]

    messages = [{"role": "user", "content": subtask}]
    # ... run a mini agent loop with profile.model, profile.system_prompt
    # ... return the final text response
```

#### 3. Expose handoffs as tools for the coordinator

The coordinator doesn't call specialists directly — it uses **handoff tools**. This is the key pattern: handoffs are just tool calls.

```python
def make_handoff_tools(scratchpad, memory, client):
    """Create handoff tool definitions + implementations."""

    def handoff(specialist_name: str, subtask: str) -> str:
        profile = SPECIALISTS[specialist_name]
        return run_specialist(profile, subtask, scratchpad, memory, client)

    tool_def = {
        "name": "handoff",
        "description": (
            "Delegate a subtask to a specialist agent. "
            "Specialists: researcher, writer, coder. "
            "The specialist works on the shared scratchpad and returns a summary."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "specialist_name": {
                    "type": "string",
                    "enum": ["researcher", "writer", "coder"],
                },
                "subtask": {
                    "type": "string",
                    "description": "Clear description of what this specialist should do",
                },
            },
            "required": ["specialist_name", "subtask"],
        },
    }

    return {"handoff": handoff}, [tool_def]
```

#### 4. Wire it into `run_agent`

In the coordinator's setup, merge the handoff tools into `all_tools` and `all_tool_definitions`. The coordinator's system prompt tells it to break tasks into subtasks and delegate:

```python
# In run_agent, after creating scratchpad/memory/client:
handoff_tools, handoff_defs = make_handoff_tools(scratchpad, memory, client)
all_tools = {**tools, **scratchpad.get_tool_map(), **memory.get_tool_map(), **handoff_tools}
all_tool_definitions = tool_definitions + SCRATCHPAD_TOOL_DEFINITIONS + MEMORY_TOOL_DEFINITIONS + handoff_defs
```

Update the system prompt:

```python
system_prompt = (
    "You are a coordinator agent. Break complex tasks into subtasks "
    "and delegate them to specialists using the handoff tool.\n\n"
    "Available specialists:\n"
    "- researcher: gathers information, saves to research/ files\n"
    "- writer: reads research and produces polished output\n"
    "- coder: writes and debugs code\n\n"
    "Coordinate their work. Review their output. Produce the final result.\n\n"
    # ... rest of existing prompt
)
```

#### 5. Things to watch out for

- **Shared scratchpad conflicts**: Two specialists writing to the same file. Use a naming convention like `research/topic_1.md`, `research/topic_2.md`.
- **Token budget**: Each specialist burns tokens. Track total across all agents in the coordinator's `AgentState`.
- **Runaway delegation**: A coordinator that keeps handing off forever. Add a max handoff depth or count to `AgentConfig`.
- **Error propagation**: If a specialist fails, the coordinator gets an error string back and can retry or try a different approach.

---

## Part 2: Eval Harness

### The Idea

You can't improve what you can't measure. An eval harness runs the agent against a set of test cases and scores the results, so you can tell whether changes to prompts, tools, or logic actually help.

### Structure

```
server-fastapi/
  evals/
    cases/
      summarize_article.yaml
      write_python_function.yaml
      multi_step_research.yaml
    scorers/
      contains.py
      llm_judge.py
      file_exists.py
    runner.py
    report.py
```

### Step 1: Define eval cases

Each case is a YAML file with: a task, expected behavior, and scoring criteria.

```yaml
# evals/cases/summarize_article.yaml
name: summarize_article
task: "Summarize the key points of this article: [article text here]"
expected:
  output_files: ["output/summary.md"]
  output_contains:
    - "key point 1 keyword"
    - "key point 2 keyword"
  max_iterations: 5
  max_tokens: 20000
scoring:
  - scorer: file_exists
    args: { path: "output/summary.md" }
    weight: 1.0
  - scorer: contains
    args: { file: "output/summary.md", keywords: ["keyword1", "keyword2"] }
    weight: 2.0
  - scorer: llm_judge
    args:
      criteria: "Is the summary accurate and concise? Does it capture the main points?"
    weight: 3.0
tags: ["writing", "single-step"]
```

### Step 2: Build scorers

Scorers are simple functions that take the agent's output + scratchpad and return a 0.0-1.0 score.

```python
# evals/scorers/contains.py
def score(scratchpad_root: Path, agent_output: str, args: dict) -> float:
    """Check if output file contains expected keywords."""
    file_path = scratchpad_root / args["file"]
    if not file_path.exists():
        return 0.0
    content = file_path.read_text().lower()
    keywords = args["keywords"]
    found = sum(1 for kw in keywords if kw.lower() in content)
    return found / len(keywords)
```

```python
# evals/scorers/llm_judge.py
def score(scratchpad_root: Path, agent_output: str, args: dict) -> float:
    """Use an LLM to judge output quality on a 0-1 scale."""
    client = anthropic.Anthropic()

    # Gather all output files
    output_dir = scratchpad_root / "output"
    files_content = ""
    if output_dir.exists():
        for f in output_dir.rglob("*"):
            if f.is_file():
                files_content += f"\n--- {f.name} ---\n{f.read_text()}\n"

    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": (
                f"Rate this agent output on a scale of 0.0 to 1.0.\n\n"
                f"Criteria: {args['criteria']}\n\n"
                f"Agent's final response:\n{agent_output}\n\n"
                f"Files produced:\n{files_content}\n\n"
                "Respond with ONLY a number between 0.0 and 1.0."
            ),
        }],
    )
    try:
        return float(response.content[0].text.strip())
    except ValueError:
        return 0.0
```

```python
# evals/scorers/file_exists.py
def score(scratchpad_root: Path, agent_output: str, args: dict) -> float:
    """Check if expected output file was created."""
    return 1.0 if (scratchpad_root / args["path"]).exists() else 0.0
```

### Step 3: Build the runner

```python
# evals/runner.py
import yaml
import importlib
from pathlib import Path
from agent.agent import run_agent
from agent.agent_config import AgentConfig

SCORERS_DIR = Path(__file__).parent / "scorers"
CASES_DIR = Path(__file__).parent / "cases"

def load_scorer(name: str):
    """Dynamically import a scorer module."""
    module = importlib.import_module(f"evals.scorers.{name}")
    return module.score

def run_eval(case_path: Path, base_dir: str = "./eval_runs") -> dict:
    case = yaml.safe_load(case_path.read_text())

    config = AgentConfig(
        max_iterations=case.get("expected", {}).get("max_iterations", 20),
        max_tokens_total=case.get("expected", {}).get("max_tokens", 50_000),
    )

    result = run_agent(
        task=case["task"],
        config=config,
        base_dir=base_dir,
    )

    # Find the scratchpad directory (most recent run)
    runs = sorted(Path(base_dir).iterdir(), key=lambda p: p.stat().st_mtime)
    scratchpad_root = runs[-1] if runs else Path(base_dir)

    # Score
    scores = []
    for scoring_rule in case.get("scoring", []):
        scorer_fn = load_scorer(scoring_rule["scorer"])
        raw_score = scorer_fn(scratchpad_root, result, scoring_rule.get("args", {}))
        weight = scoring_rule.get("weight", 1.0)
        scores.append({
            "scorer": scoring_rule["scorer"],
            "raw_score": raw_score,
            "weight": weight,
            "weighted": raw_score * weight,
        })

    total_weight = sum(s["weight"] for s in scores)
    final_score = sum(s["weighted"] for s in scores) / total_weight if total_weight else 0.0

    return {
        "case": case["name"],
        "tags": case.get("tags", []),
        "final_score": round(final_score, 3),
        "scores": scores,
        "agent_output": result,
    }

def run_all_evals():
    results = []
    for case_file in sorted(CASES_DIR.glob("*.yaml")):
        print(f"Running: {case_file.stem}...")
        result = run_eval(case_file)
        print(f"  Score: {result['final_score']}")
        results.append(result)
    return results
```

### Step 4: Build a report

```python
# evals/report.py
import json
from datetime import datetime

def print_report(results: list[dict]):
    print("\n" + "=" * 60)
    print("EVAL REPORT")
    print(f"Date: {datetime.now().isoformat()}")
    print(f"Cases: {len(results)}")
    print("=" * 60)

    for r in results:
        status = "PASS" if r["final_score"] >= 0.7 else "FAIL"
        print(f"\n[{status}] {r['case']}  —  {r['final_score']:.1%}")
        for s in r["scores"]:
            print(f"       {s['scorer']}: {s['raw_score']:.2f} (weight {s['weight']})")

    avg = sum(r["final_score"] for r in results) / len(results) if results else 0
    print(f"\nOverall: {avg:.1%}")
    print("=" * 60)

    # Save to JSON for diffing across runs
    with open("eval_results.json", "w") as f:
        json.dump(results, f, indent=2)
```

### Step 5: Use it

```bash
# Run all evals
uv run -m evals.runner

# Compare before/after a change
cp eval_results.json eval_before.json
# ... make your changes ...
uv run -m evals.runner
diff eval_before.json eval_results.json
```

### What makes a good eval case

| Quality | Bad | Good |
|---------|-----|------|
| Specificity | "Write something about AI" | "Write a 3-paragraph summary of transformer architecture covering attention, positional encoding, and layer normalization" |
| Measurability | "Make it good" | File exists + contains keywords + LLM judge scores > 0.7 |
| Isolation | Depends on external APIs | Self-contained task with inline data |
| Coverage | 1 test case | 10+ cases across different task types |

### Iteration workflow

1. Write 5-10 eval cases covering your main use cases
2. Run evals to get a baseline score
3. Make a change (prompt tweak, new tool, different model)
4. Run evals again
5. Compare scores — did it actually help?
6. Keep the change only if scores improve (or hold steady with other benefits)

---

## Part 3: Reflection / Self-Critique

### The Idea

Before returning a final answer to the user, run the agent's output through a **critic pass** — a second LLM call that reviews the work and either approves it or sends it back for revision. This catches mistakes, hallucinations, and incomplete answers that the agent wouldn't notice on its own.

### Architecture

```
Agent loop produces final output
    |
    v
+------------------+
|   Critic Pass    |  claude-haiku-4-5 (cheap, fast)
|                  |  "Review this output against the original task"
+------------------+
    |            |
    v            v
  APPROVED    NEEDS REVISION
  (return)    (feed critique back into agent loop)
```

### How to Build It

#### 1. Create the critic module

New file `app/agent/agent_critic.py`:

```python
import anthropic
import json
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

@dataclass
class CritiqueResult:
    approved: bool
    issues: list[str]
    suggestions: list[str]
    revised_output: Optional[str] = None

CRITIC_SYSTEM_PROMPT = """You are a strict quality reviewer. Given an original task and the agent's output, evaluate whether the output fully and correctly addresses the task.

Respond with ONLY valid JSON:
{
    "approved": true/false,
    "issues": ["list of problems found, empty if approved"],
    "suggestions": ["specific improvements needed, empty if approved"]
}

Be critical but fair. Approve if the output is good enough, not perfect. Flag:
- Factual errors or hallucinations
- Missing parts of the task that weren't addressed
- Vague or hand-wavy answers where specifics were requested
- Logical inconsistencies"""


def critique(
    task: str,
    agent_output: str,
    scratchpad_files: str,
    client: anthropic.Anthropic,
) -> CritiqueResult:
    """Run a critic pass on the agent's output."""

    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1024,
        system=CRITIC_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": (
                f"## Original Task\n{task}\n\n"
                f"## Agent Output\n{agent_output}\n\n"
                f"## Files Produced\n{scratchpad_files}\n\n"
                "Review this and respond with JSON."
            ),
        }],
    )

    try:
        data = json.loads(response.content[0].text)
        return CritiqueResult(
            approved=data["approved"],
            issues=data.get("issues", []),
            suggestions=data.get("suggestions", []),
        )
    except (json.JSONDecodeError, KeyError):
        # If critic response is unparseable, approve by default
        logger.warning("Critic response unparseable, approving by default")
        return CritiqueResult(approved=True, issues=[], suggestions=[])
```

#### 2. Wire it into the agent loop's exit path

In `agent.py`, the `end_turn` block currently returns immediately. Add a critique gate:

```python
# In agent.py, replace the end_turn block:

if response.stop_reason == "end_turn":
    final = next(b.text for b in response.content if hasattr(b, "text"))

    # Output guardrails (existing)
    out_result = output_guard.check(final)
    if out_result.action == GuardrailAction.BLOCK:
        return "Response blocked by output policy."
    if out_result.action == GuardrailAction.MODIFY:
        final = out_result.modified_content

    # Reflection / self-critique
    if config.enable_critique and state.critique_rounds < config.max_critique_rounds:
        files_listing = scratchpad.list_files()
        result = critique(task, final, files_listing, client)

        if not result.approved:
            state.critique_rounds += 1
            logger.info(f"Critique round {state.critique_rounds}: {result.issues}")

            # Feed the critique back into the conversation
            critique_msg = (
                "A reviewer found issues with your response:\n"
                f"Issues: {', '.join(result.issues)}\n"
                f"Suggestions: {', '.join(result.suggestions)}\n\n"
                "Please revise your work and try again."
            )
            state.messages.append({"role": "assistant", "content": response.content})
            state.messages.append({"role": "user", "content": critique_msg})
            state.save(scratchpad)
            continue  # Back to the top of the while loop

    state.status = "complete"
    state.save(scratchpad)
    return final
```

#### 3. Add config fields

In `agent_config.py`:

```python
@dataclass
class AgentConfig:
    # ... existing fields ...
    enable_critique: bool = True
    max_critique_rounds: int = 2  # prevent infinite revision loops
```

And add `critique_rounds: int = 0` to `AgentState`.

#### 4. Things to watch out for

- **Cost**: Each critique round adds a Haiku call + a full agent iteration. With `max_critique_rounds=2`, worst case is 2 extra rounds per task. Haiku is cheap but the agent re-run is not.
- **Infinite loops**: The agent revises, critic rejects, agent revises again. The `max_critique_rounds` cap prevents this, but set it low (1-2).
- **Critic hallucinations**: The critic itself can hallucinate problems that don't exist. Using a structured JSON response and specific criteria helps. If the critic can't parse, approve by default.
- **When to skip**: For simple tasks (one-line answers), critique is overhead. You could add a token threshold — only critique if the agent used more than N iterations or produced more than M tokens of output.

### Advanced: Self-Critique Without a Second Call

A cheaper alternative is to bake reflection into the agent's own system prompt:

```python
system_prompt += (
    "\n\n## Before finishing\n"
    "Before giving your final answer, review your own work:\n"
    "1. Re-read the original task\n"
    "2. Check each requirement is addressed\n"
    "3. Look for factual errors\n"
    "4. If you find issues, fix them before responding\n"
    "Write your self-review in scratch/review.md, then give your final answer."
)
```

This is free (no extra API call) but less reliable — the model reviewing its own output is weaker than an independent judge.

---

## Part 4: Context Window Management

### The Problem

Your agent's `state.messages` list grows every iteration. Each message is sent back to the API on every call. Eventually you hit the model's context window limit and the API returns an error — or, before that, performance degrades as the model struggles with a massive conversation.

With `claude-sonnet-4-6` at 200k tokens, a research agent that does 15 iterations of tool calls can easily hit 100k+ tokens, most of which is stale intermediate work.

### Strategy Overview

```
Iteration 1-5:    Full messages (all fit in context)
Iteration 6-10:   Summarize iterations 1-3, keep 4-10 in full
Iteration 11-15:  Summarize iterations 1-8, keep 9-15 in full
...
Always keep:      System prompt + first user message + last N messages
```

### How to Build It

#### 1. Create the context manager module

New file `app/agent/agent_context.py`:

```python
import anthropic
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ContextConfig:
    max_context_tokens: int = 150_000   # leave headroom below 200k limit
    summary_trigger_tokens: int = 100_000  # start summarizing at this threshold
    keep_recent_messages: int = 10  # always keep the last N messages in full
    summary_model: str = "claude-haiku-4-5"


def estimate_tokens(messages: list) -> int:
    """Rough token estimate: ~4 chars per token for English text."""
    total_chars = 0
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            total_chars += len(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    total_chars += len(str(block))
                else:
                    # Anthropic SDK objects
                    total_chars += len(str(block))
    return total_chars // 4


def summarize_messages(
    messages: list,
    client: anthropic.Anthropic,
    model: str = "claude-haiku-4-5",
) -> str:
    """Compress a list of messages into a prose summary."""

    # Format messages into readable text
    formatted = []
    for msg in messages:
        role = msg["role"]
        content = msg.get("content", "")
        if isinstance(content, list):
            # tool results or content blocks
            parts = []
            for block in content:
                if isinstance(block, dict):
                    if block.get("type") == "tool_result":
                        parts.append(f"[Tool result: {block.get('content', '')[:200]}]")
                    else:
                        parts.append(str(block)[:200])
                elif hasattr(block, "text"):
                    parts.append(block.text[:500])
                elif hasattr(block, "name"):
                    parts.append(f"[Tool call: {block.name}({block.input})]")
            content = "\n".join(parts)
        formatted.append(f"{role}: {content}")

    conversation_text = "\n\n".join(formatted)

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                "Summarize this agent conversation history. Preserve:\n"
                "- Key decisions made and why\n"
                "- Important facts discovered\n"
                "- Files created/modified and their contents\n"
                "- Current state of the task\n"
                "- Any errors encountered and how they were resolved\n\n"
                "Be concise but don't lose critical details.\n\n"
                f"Conversation:\n{conversation_text}"
            ),
        }],
    )
    return response.content[0].text


def compact_messages(
    messages: list,
    client: anthropic.Anthropic,
    context_config: ContextConfig = None,
) -> list:
    """Compress message history if it exceeds the token threshold.

    Returns a new messages list with older messages summarized.
    """
    config = context_config or ContextConfig()
    estimated = estimate_tokens(messages)

    if estimated < config.summary_trigger_tokens:
        return messages  # No compaction needed

    logger.info(
        f"Context compaction triggered: ~{estimated} tokens "
        f"(threshold: {config.summary_trigger_tokens})"
    )

    # Always preserve: first user message + last N messages
    first_message = messages[0]  # original task
    recent_messages = messages[-config.keep_recent_messages:]
    middle_messages = messages[1:-config.keep_recent_messages]

    if not middle_messages:
        return messages  # Nothing to compress

    # Summarize the middle section
    summary = summarize_messages(middle_messages, client, config.summary_model)

    # Reconstruct: original task -> summary -> recent messages
    compacted = [
        first_message,
        {
            "role": "user",
            "content": (
                f"[CONTEXT SUMMARY - The following summarizes your earlier work "
                f"in this conversation. {len(middle_messages)} messages were "
                f"compressed into this summary.]\n\n{summary}"
            ),
        },
        # Need an assistant acknowledgment to maintain valid message alternation
        {
            "role": "assistant",
            "content": (
                "Understood. I've reviewed the summary of my earlier work. "
                "Continuing from where I left off."
            ),
        },
        *recent_messages,
    ]

    new_estimate = estimate_tokens(compacted)
    logger.info(
        f"Compacted: ~{estimated} -> ~{new_estimate} tokens "
        f"({len(messages)} -> {len(compacted)} messages)"
    )

    return compacted
```

#### 2. Wire it into the agent loop

In `agent.py`, call `compact_messages` before each API call:

```python
from agent.agent_context import compact_messages, ContextConfig

# Inside run_agent, before the while loop:
context_config = ContextConfig()

# Inside the while loop, right before client.messages.create:
state.messages = compact_messages(state.messages, client, context_config)

response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=16384,
    system=system_prompt,
    tools=all_tool_definitions,
    messages=state.messages,
)
```

#### 3. Add to AgentConfig

```python
@dataclass
class AgentConfig:
    # ... existing fields ...
    max_context_tokens: int = 150_000
    summary_trigger_tokens: int = 100_000
    keep_recent_messages: int = 10
```

#### 4. Message alternation fix

The Anthropic API requires strict `user` / `assistant` alternation. After compaction, make sure the messages alternate correctly. The `compact_messages` function above handles this with the assistant acknowledgment message, but edge cases can break it.

Add a validation helper:

```python
def validate_alternation(messages: list) -> list:
    """Ensure messages alternate between user and assistant roles."""
    if not messages:
        return messages

    fixed = [messages[0]]
    for msg in messages[1:]:
        if msg["role"] == fixed[-1]["role"]:
            # Same role twice in a row — merge or insert a placeholder
            if msg["role"] == "user":
                fixed.append({"role": "assistant", "content": "Continuing."})
            else:
                fixed.append({"role": "user", "content": "Continue."})
        fixed.append(msg)
    return fixed
```

Call this after compaction: `state.messages = validate_alternation(compacted)`.

#### 5. Things to watch out for

- **Summary quality**: Haiku is fast but can miss details. If the agent starts "forgetting" important context after compaction, try Sonnet for summaries or increase `keep_recent_messages`.
- **Token estimation**: The `len // 4` heuristic is rough. For precise counts, use `client.count_tokens()` (available in newer SDK versions) or the `tiktoken` library. The heuristic is fine for triggering compaction but don't rely on it for hard limits.
- **Tool result references**: If the model refers back to a tool result that's been summarized away, it may hallucinate the details. The summary should capture key tool outputs explicitly.
- **Cost tradeoff**: Each compaction costs one Haiku call. But it saves money on subsequent iterations by reducing input tokens on every future API call. For agents that run 10+ iterations, compaction pays for itself quickly.
- **When NOT to compact**: Short conversations (< 5 iterations) don't need it. Tasks where exact details matter (code generation, data analysis) may lose fidelity. Consider making it opt-in per task type.

### Advanced: Sliding Window (No LLM Call)

If you want zero-cost context management, skip the summarization and just drop old messages:

```python
def sliding_window(messages: list, max_messages: int = 20) -> list:
    """Keep first message + last N messages. No LLM call needed."""
    if len(messages) <= max_messages:
        return messages
    return [messages[0]] + messages[-(max_messages - 1):]
```

This is crude but effective for tasks where recent context matters most. Combine both: use sliding window as a fallback if the summarization call fails.
