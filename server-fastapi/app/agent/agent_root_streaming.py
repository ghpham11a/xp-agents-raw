import asyncio
import logging
import json
import time
import uuid

from typing import Optional, AsyncGenerator

import anthropic

from agent.agent_config import AgentConfig
from agent.agent_state import AgentState
from agent.agent_planner import Plan, load_plan, run_planner_async
from agent.agent_memory import AgentMemory, MEMORY_TOOL_DEFINITIONS
from agent.agent_scratchpad import AgentScratchpad, SCRATCHPAD_TOOL_DEFINITIONS
from agent.agent_guardrails import (
    InputGuardrails, OutputGuardrails, ToolGuardrails,
    GuardrailAction, AgentLoopError, check_limits,
)
from agent.agent_events import EventType
from agent.agent_utils import build_system_prompt, format_tool_result, check_tool_guardrail

logger = logging.getLogger(__name__)

# ============================================================
# HUMAN-IN-THE-LOOP — pending approval queues
# ============================================================

# Maps run_id → asyncio.Queue for passing approval decisions
_pending_approvals: dict[str, asyncio.Queue] = {}


def submit_approval(run_id: str, approved: bool) -> bool:
    """Submit a human approval decision for a pending tool call.
    Returns True if there was a pending approval for this run."""
    queue = _pending_approvals.get(run_id)
    if queue is None:
        return False
    queue.put_nowait(approved)
    return True


# ============================================================
# STREAMING AGENT LOOP
# ============================================================

async def run_agent_streaming(
    task: str,
    config: Optional[AgentConfig] = None,
    tool_definitions: list = None,
    tools: dict = None,
    resume_run_id: Optional[str] = None,
    base_dir: str = "./agent_runs",
) -> AsyncGenerator[dict, None]:
    """
    Async streaming version of run_agent().
    Yields event dicts instead of returning a single result.

    Same logic as run_agent(), but:
    1. Uses AsyncAnthropic (non-blocking)
    2. Uses client.messages.stream() for token-by-token output
    3. Yields events at key moments for the UI to consume
    """
    tool_definitions = tool_definitions or []
    tools = tools or {}

    client = anthropic.AsyncAnthropic()
    config = config or AgentConfig()
    memory = AgentMemory(base_dir=base_dir)
    input_guard = InputGuardrails()
    output_guard = OutputGuardrails()
    tool_guard = ToolGuardrails()

    # ----------------------------------------------------------
    # INPUT GUARDRAILS
    # ----------------------------------------------------------
    guard_result = input_guard.check(task)
    if guard_result.action == GuardrailAction.BLOCK:
        logger.warning(f"Input blocked: {guard_result.reason}")
        yield {
            "type": EventType.ERROR,
            "data": {"message": f"Request blocked: {guard_result.reason}"},
        }
        return
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

        plan = await run_planner_async(task, scratchpad, client)
        yield {
            "type": EventType.PLAN,
            "data": {
                "goal": plan.goal,
                "steps": plan.steps,
                "done_when": plan.done_when,
                "output_files": plan.output_files,
            },
        }

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

            # --------------------------------------------------
            # STREAM the Claude response
            # --------------------------------------------------
            try:
                async with client.messages.stream(
                    model="claude-opus-4-5",
                    max_tokens=16384,
                    system=system_prompt,
                    tools=all_tool_definitions,
                    messages=state.messages,
                ) as stream:
                    async for event in stream:
                        if event.type == "content_block_delta":
                            if event.delta.type == "text_delta":
                                yield {
                                    "type": EventType.TEXT_DELTA,
                                    "data": {"content": event.delta.text},
                                }

                    response = await stream.get_final_message()
            except anthropic.APIError as e:
                state.consecutive_errors += 1
                logger.warning(f"API error: {e}")
                yield {"type": EventType.ERROR, "data": {"message": str(e)}}
                if state.consecutive_errors < config.max_consecutive_errors:
                    continue
                else:
                    return

            state.total_tokens += response.usage.input_tokens + response.usage.output_tokens

            # --------------------------------------------------
            # MAX TOKENS — truncated, continue
            # --------------------------------------------------
            if response.stop_reason == "max_tokens":
                state.messages.append({"role": "assistant", "content": response.content})
                state.messages.append({"role": "user", "content": "Continue from where you left off."})
                state.save(scratchpad)
                continue

            # --------------------------------------------------
            # END TURN — output guardrails, then done
            # --------------------------------------------------
            if response.stop_reason == "end_turn":
                final_text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        final_text = block.text
                        break

                out_result = output_guard.check(final_text)
                if out_result.action == GuardrailAction.BLOCK:
                    logger.warning("Output blocked by guardrail")
                    yield {
                        "type": EventType.ERROR,
                        "data": {"message": "Response blocked by output policy."},
                    }
                    return
                if out_result.action == GuardrailAction.MODIFY:
                    logger.info(f"Output modified: {out_result.reason}")
                    final_text = out_result.modified_content

                state.status = "complete"
                state.save(scratchpad)

                yield {
                    "type": EventType.DONE,
                    "data": {
                        "run_id": state.run_id,
                        "iterations": state.iterations,
                        "total_tokens": state.total_tokens,
                        "final_text": final_text,
                    },
                }
                return

            # --------------------------------------------------
            # TOOL EXECUTION
            # --------------------------------------------------
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
                    approval_queue = asyncio.Queue()
                    _pending_approvals[state.run_id] = approval_queue

                    yield {
                        "type": EventType.APPROVAL_REQUEST,
                        "data": {
                            "run_id": state.run_id,
                            "tool": block.name,
                            "input": block.input,
                        },
                    }

                    try:
                        approved = await approval_queue.get()
                    finally:
                        _pending_approvals.pop(state.run_id, None)

                    if not approved:
                        tool_results.append(format_tool_result(
                            block.id,
                            "Human rejected this action. Try a different approach.",
                            is_error=True,
                        ))
                        continue

                # Execute the tool
                try:
                    result = all_tools[block.name](**block.input)
                    state.consecutive_errors = 0

                    tool_results.append(format_tool_result(block.id, str(result)))

                    # Yield tool_call event for the UI
                    yield {
                        "type": EventType.TOOL_CALL,
                        "data": {
                            "tool": block.name,
                            "input": block.input,
                            "result": str(result),
                        },
                    }

                    # If a file was written/updated, yield file_update with content
                    if block.name in ("write_file", "append_file"):
                        file_path = block.input.get("path", "")
                        yield {
                            "type": EventType.FILE_UPDATE,
                            "data": {
                                "path": file_path,
                                "action": "created" if block.name == "write_file" else "updated",
                                "content": scratchpad.read_file(file_path),
                            },
                        }
                    elif block.name == "delete_file":
                        yield {
                            "type": EventType.FILE_UPDATE,
                            "data": {"path": block.input.get("path", ""), "action": "deleted"},
                        }
                    elif block.name == "move_file":
                        dst_path = block.input.get("dst", "")
                        yield {
                            "type": EventType.FILE_UPDATE,
                            "data": {
                                "path": dst_path,
                                "action": "created",
                                "content": scratchpad.read_file(dst_path),
                            },
                        }

                except Exception as e:
                    state.consecutive_errors += 1
                    tool_results.append(format_tool_result(block.id, f"Error: {e}", is_error=True))

            state.messages.append({"role": "assistant", "content": response.content})
            state.messages.append({"role": "user", "content": tool_results})
            state.save(scratchpad)

    except AgentLoopError as e:
        state.status = "failed"
        state.save(scratchpad)
        yield {"type": EventType.ERROR, "data": {"message": f"Agent stopped: {e}"}}
    finally:
        elapsed = time.time() - state.start_time
        logger.info(
            f"[{state.run_id}] Done. Iterations: {state.iterations} "
            f"| Tokens: {state.total_tokens} | Time: {elapsed:.1f}s"
        )
