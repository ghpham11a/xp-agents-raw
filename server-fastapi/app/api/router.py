import logging
import os
import shutil
import sqlite3

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from db.database import get_db
from db import queries
from api.streaming import sse_generator
from agent.agent_root_streaming import run_agent_streaming, submit_approval
from agent.agent_events import EventType
from schema import (
    CreateConversationRequest, SendMessageRequest, ApprovalRequest,
    CreateAgentRequest, UpdateAgentRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "app", "agent_runs")


def _agent_base_dir(agent_id: str) -> str:
    """Return the agent-scoped run directory: agent_runs/{agent_id}/"""
    return os.path.join(BASE_DIR, agent_id)


# ── DB Dependency ─────────────────────────────────────────
# FastAPI calls get_db_dep() once per request, yielding a
# connection. The finally block guarantees it closes even if
# the route handler raises. Routes receive `db` as a param.

def get_db_dep():
    db = get_db()
    try:
        yield db
    finally:
        db.close()


DB = Annotated[sqlite3.Connection, Depends(get_db_dep)]


# ── Agents ─────────────────────────────────────────────────

@router.get("/agents", summary="List all agents")
def list_agents(db: DB):
    return queries.list_agents(db)


@router.post("/agents", summary="Create an agent")
def create_agent(req: CreateAgentRequest, db: DB):
    aid = queries.create_agent(
        db, req.id, req.name,
        description=req.description,
        model=req.model,
        system_prompt=req.system_prompt,
        config_json=req.config_json,
    )
    return {"id": aid, "name": req.name}


@router.get("/agents/{agent_id}", summary="Get an agent by ID")
def get_agent(agent_id: str, db: DB):
    agent = queries.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/agents/{agent_id}", summary="Update an agent")
def update_agent(agent_id: str, req: UpdateAgentRequest, db: DB):
    agent = queries.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    queries.update_agent(db, agent_id, **req.model_dump(exclude_none=True))
    return {"ok": True}


@router.delete("/agents/{agent_id}", summary="Delete an agent and its data")
def delete_agent(agent_id: str, db: DB):
    if agent_id == "default":
        raise HTTPException(status_code=400, detail="Cannot delete the default agent")
    agent = queries.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    queries.delete_agent(db, agent_id)

    # Clean up agent_runs/{agent_id}/ directory
    agent_dir = Path(_agent_base_dir(agent_id))
    if agent_dir.exists():
        shutil.rmtree(agent_dir)
        logger.info(f"Deleted agent directory: {agent_id}")

    return {"ok": True}


# ── Conversations ─────────────────────────────────────────

@router.get("/conversations", summary="List conversations")
def list_conversations(agent_id: str | None = None, db: DB = None):
    return queries.list_conversations(db, agent_id=agent_id)


@router.post("/conversations", summary="Create a conversation")
def create_conversation(req: CreateConversationRequest, db: DB):
    agent = queries.get_agent(db, req.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    cid = queries.create_conversation(db, req.title, agent_id=req.agent_id)
    return {"id": cid, "title": req.title, "agent_id": req.agent_id}


@router.get("/conversations/{conversation_id}", summary="Get conversation with messages")
def get_conversation(conversation_id: str, db: DB):
    conv = queries.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = queries.get_messages(db, conversation_id)
    return {**conv, "messages": messages}


@router.delete("/conversations/{conversation_id}", summary="Delete a conversation")
def delete_conversation(conversation_id: str, db: DB):
    conv = queries.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    agent_id = conv["agent_id"]
    run_ids = queries.get_run_ids(db, conversation_id)
    queries.delete_conversation(db, conversation_id)

    # Clean up agent_runs/{agent_id}/{run_id}/ directories
    for run_id in run_ids:
        run_dir = Path(_agent_base_dir(agent_id)) / run_id
        if run_dir.exists():
            shutil.rmtree(run_dir)
            logger.info(f"Deleted agent run directory: {agent_id}/{run_id}")

    return {"ok": True}


# ── Messages & Streaming ─────────────────────────────────

@router.post(
    "/conversations/{conversation_id}/messages",
    summary="Send a message and stream the agent response",
    description="Saves the user message, runs the agent loop, and returns an SSE stream. See docs/sse-events.md for the event schema.",
)
async def send_message(conversation_id: str, req: SendMessageRequest, db: DB):
    """Save the user message, then stream the agent's response as SSE events."""
    conv = queries.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    agent_id = conv["agent_id"]
    queries.add_message(db, conversation_id, "user", req.content)

    task = req.content
    agent_dir = _agent_base_dir(agent_id)

    async def stream_and_save():
        """Wrap the agent stream — save the final assistant message after streaming."""
        final_text = ""
        run_id = None
        total_tokens = None
        tool_calls = []

        async for event in run_agent_streaming(task=task, base_dir=agent_dir):
            yield event

            if event["type"] == EventType.TEXT_DELTA:
                final_text += event["data"]["content"]
            elif event["type"] == EventType.TOOL_CALL:
                tool_calls.append(event["data"])
            elif event["type"] == EventType.DONE:
                run_id = event["data"].get("run_id")
                total_tokens = event["data"].get("total_tokens")
                if event["data"].get("final_text"):
                    final_text = event["data"]["final_text"]

        # Save assistant message to DB
        if final_text:
            save_db = get_db()
            try:
                queries.add_message(
                    save_db, conversation_id, "assistant", final_text,
                    run_id=run_id, token_count=total_tokens,
                    tool_calls=tool_calls or None,
                )
            finally:
                save_db.close()

    return StreamingResponse(
        sse_generator(stream_and_save()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Human-in-the-loop Approval ────────────────────────────

@router.post("/runs/{run_id}/approval", summary="Submit human-in-the-loop approval")
async def handle_approval(run_id: str, req: ApprovalRequest):
    """Submit a human approval decision for a pending tool call."""
    if not submit_approval(run_id, req.approved):
        raise HTTPException(status_code=404, detail="No pending approval for this run")
    return {"ok": True}


# ── Agent Run Files ───────────────────────────────────────

def _find_run_dir(run_id: str) -> Path | None:
    """Search all agent directories for a run_id. Returns the path if found."""
    base = Path(BASE_DIR)
    if not base.exists():
        return None
    for agent_dir in base.iterdir():
        if agent_dir.is_dir():
            candidate = agent_dir / run_id
            if candidate.is_dir():
                return candidate
    return None


@router.get("/runs/{run_id}/files", summary="List files in an agent run")
def list_run_files(run_id: str):
    run_dir = _find_run_dir(run_id)
    if not run_dir:
        raise HTTPException(status_code=404, detail="Run not found")

    files = []
    for p in sorted(run_dir.rglob("*")):
        if p.is_file() and p.name != "state.json":
            rel = str(p.relative_to(run_dir)).replace("\\", "/")
            files.append({"path": rel, "size": p.stat().st_size})
    return files


@router.get("/runs/{run_id}/files/{file_path:path}", summary="Read a file from an agent run")
def read_run_file(run_id: str, file_path: str):
    run_dir = _find_run_dir(run_id)
    if not run_dir:
        raise HTTPException(status_code=404, detail="Run not found")
    target = (run_dir / file_path).resolve()

    # Prevent path traversal
    if not str(target).startswith(str(run_dir.resolve())):
        raise HTTPException(status_code=403, detail="Path not allowed")
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return {"path": file_path, "content": target.read_text()}


@router.get("/runs/{run_id}/plan", summary="Get the plan for an agent run")
def get_run_plan(run_id: str):
    run_dir = _find_run_dir(run_id)
    if not run_dir:
        raise HTTPException(status_code=404, detail="Run not found")
    plan_path = run_dir / "notes" / "plan.md"
    if not plan_path.exists():
        raise HTTPException(status_code=404, detail="Plan not found")

    from agent.agent_planner import parse_plan_md
    plan = parse_plan_md(plan_path.read_text())
    return {
        "goal": plan.goal,
        "steps": plan.steps,
        "done_when": plan.done_when,
        "output_files": plan.output_files,
    }
