import logging
import json

from dataclasses import dataclass
from typing import Optional

import anthropic

from agent.agent_memory import AgentMemory
from agent.agent_scratchpad import AgentScratchpad

logger = logging.getLogger(__name__)

@dataclass
class Plan:
    goal: str
    steps: list[str]
    done_when: str
    output_files: list[str]


# ============================================================
# SHARED PLANNER HELPERS
# ============================================================

_JSON_EXAMPLE = json.dumps(
    {
        "goal": "one sentence goal",
        "steps": ["step 1", "step 2", "step 3"],
        "done_when": "clear completion condition referencing output files",
        "output_files": ["output/filename.md"],
    },
    indent=4,
)

_PLANNER_SYSTEM_PROMPT = (
    f"You are a planning agent. Given a task, return ONLY valid JSON with no preamble:\n{_JSON_EXAMPLE}\n"
    "No preamble, no markdown, just the JSON object."
)


def _parse_planner_response(response, task: str) -> Plan:
    """Parse the planner's JSON response into a Plan, with a fallback."""
    try:
        data = json.loads(response.content[0].text)
        return Plan(**data)
    except (json.JSONDecodeError, TypeError):
        return Plan(
            goal=task,
            steps=["Research the topic", "Write findings", "Save to output/report.md"],
            done_when="output/report.md exists with complete content",
            output_files=["output/report.md"],
        )


def _save_plan_to_scratchpad(plan: Plan, scratchpad: AgentScratchpad) -> None:
    """Write the plan as markdown to the scratchpad."""
    steps_md = "\n".join(f"- [ ] {s}" for s in plan.steps)
    files_md = "\n".join(f"- {f}" for f in plan.output_files)
    plan_md = (
        "# Plan\n\n"
        f"## Goal\n{plan.goal}\n\n"
        f"## Steps\n{steps_md}\n\n"
        f"## Done When\n{plan.done_when}\n\n"
        f"## Expected Output Files\n{files_md}"
    )
    scratchpad.write_file("notes/plan.md", plan_md)
    logger.info("Plan written to scratchpad.")


# ============================================================
# PLANNER AGENT — sync + async thin wrappers
# ============================================================

def run_planner(task: str, scratchpad: AgentScratchpad, client: anthropic.Anthropic) -> Plan:
    logger.info("Running planner...")
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=800,
        system=_PLANNER_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Plan this task: {task}"}],
    )
    plan = _parse_planner_response(response, task)
    _save_plan_to_scratchpad(plan, scratchpad)
    return plan


async def run_planner_async(
    task: str,
    scratchpad: AgentScratchpad,
    client: anthropic.AsyncAnthropic,
) -> Plan:
    logger.info("Running planner...")
    response = await client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=800,
        system=_PLANNER_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Plan this task: {task}"}],
    )
    plan = _parse_planner_response(response, task)
    _save_plan_to_scratchpad(plan, scratchpad)
    return plan


# ============================================================
# HELPERS
# ============================================================

def parse_plan_md(content: str) -> Plan:
    lines = content.splitlines()
    goal, steps, done_when, out_files, section = "", [], "", [], None
    for line in lines:
        if line.startswith("## Goal"):       section = "goal"
        elif line.startswith("## Steps"):    section = "steps"
        elif line.startswith("## Done"):     section = "done"
        elif line.startswith("## Expected"): section = "files"
        elif line.strip() and section == "goal":              goal = line.strip()
        elif line.startswith("- [") and section == "steps":   steps.append(line[6:].strip())
        elif line.strip() and section == "done":              done_when = line.strip()
        elif line.startswith("- ") and section == "files":    out_files.append(line[2:].strip())
    return Plan(goal=goal, steps=steps, done_when=done_when, output_files=out_files)


def load_plan(scratchpad: AgentScratchpad) -> Plan:
    content = scratchpad.read_file("notes/plan.md")
    return parse_plan_md(content)
