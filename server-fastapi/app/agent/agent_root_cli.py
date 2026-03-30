import logging
import json
import time
import uuid

from typing import Optional

import anthropic

from agent.agent_config import AgentConfig
from agent.agent_state import AgentState
from agent.agent_planner import run_planner, Plan, load_plan
from agent.agent_memory import AgentMemory, MEMORY_TOOL_DEFINITIONS
from agent.agent_scratchpad import AgentScratchpad, SCRATCHPAD_TOOL_DEFINITIONS
from agent.agent_guardrails import InputGuardrails, OutputGuardrails, ToolGuardrails, GuardrailAction, AgentLoopError, check_limits
from agent.agent_utils import print_summary, build_system_prompt, format_tool_result, check_tool_guardrail

logger = logging.getLogger(__name__)

# ============================================================
# HUMAN-IN-THE-LOOP
# ============================================================

def request_human_approval(tool_name: str, tool_input: dict) -> bool:
    print(f"\nAgent wants to call: {tool_name}")
    print(f"   Input: {json.dumps(tool_input, indent=2)}")
    return input("   Approve? (y/n): ").strip().lower() == "y"

# ============================================================
# CORE AGENT LOOP
# ============================================================

def run_agent(
    task: str,
    config: Optional[AgentConfig] = None,
    tool_definitions: list = None,
    tools: dict = None,
    resume_run_id: Optional[str] = None,
    base_dir: str = "./agent_runs",
):

    tool_definitions = tool_definitions or []
    tools = tools or {}

    client = anthropic.Anthropic()
    config = config or AgentConfig()
    memory = AgentMemory(base_dir=base_dir)
    input_guard = InputGuardrails()
    output_guard = OutputGuardrails()
    tool_guard = ToolGuardrails()

    # ----------------------------------------------------------
    # INPUT GUARDRAILS — before anything else runs
    # ----------------------------------------------------------
    guard_result = input_guard.check(task)
    if guard_result.action == GuardrailAction.BLOCK:
        logger.warning(f"Input blocked: {guard_result.reason}")
        return f"Request blocked: {guard_result.reason}"
    if guard_result.action == GuardrailAction.MODIFY:
        logger.info(f"Input modified: {guard_result.reason}")
        task = guard_result.modified_content

    # ----------------------------------------------------------
    # SETUP — scratchpad, state, plan
    # ----------------------------------------------------------
    if resume_run_id:
        scratchpad = AgentScratchpad(run_id=resume_run_id, base_dir=base_dir)
        state = AgentState.load(scratchpad)
        plan = load_plan(scratchpad)
        logger.info(f"Resuming run {state.run_id}")
    else:
        scratchpad = AgentScratchpad(run_id=str(uuid.uuid4())[:8], base_dir=base_dir)
        state = AgentState(run_id=scratchpad.run_id)
        plan = run_planner(task, scratchpad, client)

    all_tools = {
        **tools,
        **scratchpad.get_tool_map(),
        **memory.get_tool_map(),
    }
    all_tool_definitions = (
        tool_definitions
        + SCRATCHPAD_TOOL_DEFINITIONS
        + MEMORY_TOOL_DEFINITIONS
    )

    system_prompt = build_system_prompt(plan, memory.list())

    if not state.messages:
        state.messages = [{"role": "user", "content": task}]

    try:
        while True:
            check_limits(state, config)
            state.iterations += 1
            logger.info(f"[{state.run_id}] Iteration {state.iterations}")

            try:
                response = client.messages.create(
                    model="claude-opus-4-5",
                    max_tokens=16384,
                    system=system_prompt,
                    tools=all_tool_definitions,
                    messages=state.messages
                )
            except anthropic.APIError as e:
                state.consecutive_errors += 1
                logger.warning(f"API error: {e}")
                time.sleep(2 ** state.consecutive_errors)
                continue

            state.total_tokens += response.usage.input_tokens + response.usage.output_tokens

            # ------------------------------------------------------
            # MAX TOKENS — response was truncated, feed it back to continue
            # ------------------------------------------------------
            if response.stop_reason == "max_tokens":
                logger.warning("Response truncated (max_tokens). Continuing generation.")
                state.messages.append({"role": "assistant", "content": response.content})
                state.messages.append({"role": "user", "content": "Continue from where you left off."})
                state.save(scratchpad)
                continue

            # ------------------------------------------------------
            # EXIT — output guardrails before returning to user
            # ------------------------------------------------------
            if response.stop_reason == "end_turn":
                final = next(b.text for b in response.content if hasattr(b, "text"))

                out_result = output_guard.check(final)
                if out_result.action == GuardrailAction.BLOCK:
                    logger.warning("Output blocked by guardrail")
                    return "Response blocked by output policy."
                if out_result.action == GuardrailAction.MODIFY:
                    logger.info(f"Output modified: {out_result.reason}")
                    final = out_result.modified_content

                state.status = "complete"
                state.save(scratchpad)
                print_summary(state, scratchpad, memory, plan)
                return final

            # ------------------------------------------------------
            # TOOL EXECUTION — tool guardrails + HITL before each call
            # ------------------------------------------------------
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                state.tool_call_counts[block.name] = (
                    state.tool_call_counts.get(block.name, 0) + 1
                )

                # Tool guardrail
                block_reason = check_tool_guardrail(tool_guard, block.name, block.input)
                if block_reason:
                    logger.warning(f"Tool blocked: {block_reason}")
                    tool_results.append(format_tool_result(block.id, block_reason, is_error=True))
                    continue

                # Human-in-the-loop
                if block.name in config.require_human_approval_for:
                    approved = request_human_approval(block.name, block.input)
                    if not approved:
                        tool_results.append(format_tool_result(
                            block.id,
                            "Human rejected this action. Try a different approach.",
                            is_error=True,
                        ))
                        continue

                # Execute
                try:
                    result = all_tools[block.name](**block.input)
                    state.consecutive_errors = 0
                    tool_results.append(format_tool_result(block.id, str(result)))
                except Exception as e:
                    state.consecutive_errors += 1
                    tool_results.append(format_tool_result(block.id, f"Error: {e}", is_error=True))

            state.messages.append({"role": "assistant", "content": response.content})
            state.messages.append({"role": "user", "content": tool_results})
            state.save(scratchpad)

    except AgentLoopError as e:
        state.status = "failed"
        state.save(scratchpad)
        return f"Agent stopped: {e}"
    finally:
        elapsed = time.time() - state.start_time
        logger.info(f"[{state.run_id}] Done. Iterations: {state.iterations} | Tokens: {state.total_tokens} | Time: {elapsed:.1f}s")
