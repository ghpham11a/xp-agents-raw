import time

from agent.agent_state import AgentState
from agent.agent_planner import Plan
from agent.agent_memory import AgentMemory
from agent.agent_scratchpad import AgentScratchpad
from agent.agent_guardrails import GuardrailAction, ToolGuardrails

# ============================================================
# SHARED HELPERS — used by both CLI and streaming agent loops
# ============================================================


def build_system_prompt(plan: Plan, existing_memories: str) -> str:
    """Build the system prompt shared by both agent loop implementations.

    Centralises the prompt text so changes only need to happen in one place.
    """
    return (
        "You are a helpful agent.\n\n"
        f"## Goal\n{plan.goal}\n\n"
        "## Plan\n"
        "Read notes/plan.md for your step-by-step plan.\n\n"
        "## Memory vs Scratchpad\n"
        "- save_memory / load_memory  → long-term, survives across runs\n"
        "- write_file / read_file     → this run only, working notes and drafts\n\n"
        "## Memories from prior runs\n"
        f"{existing_memories}\n"
        "Load any that seem relevant with load_memory before starting work.\n"
        "Save anything worth keeping with save_memory before you finish.\n\n"
        "## Done When\n"
        f"{plan.done_when}\n"
        f"Expected output files: {', '.join(plan.output_files)}"
    )


def format_tool_result(tool_use_id: str, content: str, is_error: bool = False) -> dict:
    """Build a tool_result dict for the Anthropic messages API."""
    result = {
        "type": "tool_result",
        "tool_use_id": tool_use_id,
        "content": content,
    }
    if is_error:
        result["is_error"] = True
    return result


def check_tool_guardrail(tool_guard: ToolGuardrails, tool_name: str, tool_input: dict) -> str | None:
    """Run tool guardrails. Returns an error message if blocked, else None."""
    tool_check = tool_guard.check(tool_name, tool_input)
    if tool_check.action == GuardrailAction.BLOCK:
        return f"Blocked by policy: {tool_check.reason}"
    return None


# ============================================================
# CLI SUMMARY PRINTER
# ============================================================

def print_summary(state: AgentState, scratchpad: AgentScratchpad, memory: AgentMemory, plan: Plan):
    elapsed = time.time() - state.start_time
    print(f"\n{'='*55}")
    print(f"Run {state.run_id} complete")
    print(f"Iterations: {state.iterations} | Tokens: {state.total_tokens} | Time: {elapsed:.1f}s")
    print(f"\nScratchpad (this run):\n{scratchpad.list_files()}")
    print(f"\nLong-term memories:\n{memory.list()}")
    print(f"\nOutputs:")
    for f in plan.output_files:
        content = scratchpad.read_file(f)
        exists  = "+" if not content.startswith("File not found") else "-"
        print(f"  {exists} {f}")
    print('='*55)
