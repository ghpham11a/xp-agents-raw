import time

from agent.agent_state import AgentState
from agent.agent_planner import Plan
from agent.agent_memory import AgentMemory
from agent.agent_scratchpad import AgentScratchpad

# ============================================================
# HELPERS
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
        exists  = "✓" if not content.startswith("File not found") else "✗"
        print(f"  {exists} {f}")
    print('='*55)