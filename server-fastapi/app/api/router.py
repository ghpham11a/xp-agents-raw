import logging
import os

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db.database import get_db
from db import queries
from api.streaming import sse_generator
from agent.agent_streaming import run_agent_streaming

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "app", "agent_runs")


# ── Request / Response models ─────────────────────────────

class CreateConversationRequest(BaseModel):
    title: str = "New conversation"

class SendMessageRequest(BaseModel):
    content: str


# ── Conversations ─────────────────────────────────────────

@router.get("/conversations")
def list_conversations():
    db = get_db()
    try:
        return queries.list_conversations(db)
    finally:
        db.close()


@router.post("/conversations")
def create_conversation(req: CreateConversationRequest):
    db = get_db()
    try:
        cid = queries.create_conversation(db, req.title)
        return {"id": cid, "title": req.title}
    finally:
        db.close()


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    db = get_db()
    try:
        conv = queries.get_conversation(db, conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        messages = queries.get_messages(db, conversation_id)
        return {**conv, "messages": messages}
    finally:
        db.close()


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    db = get_db()
    try:
        queries.delete_conversation(db, conversation_id)
        return {"ok": True}
    finally:
        db.close()


# ── Messages & Streaming ─────────────────────────────────

@router.post("/conversations/{conversation_id}/messages")
async def send_message(conversation_id: str, req: SendMessageRequest):
    """
    Save the user message, then stream the agent's response as SSE events.
    """
    db = get_db()
    try:
        conv = queries.get_conversation(db, conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        queries.add_message(db, conversation_id, "user", req.content)
    finally:
        db.close()

    # Build conversation history for the agent
    db = get_db()
    try:
        messages = queries.get_messages(db, conversation_id)
    finally:
        db.close()

    # Use the latest user message as the task
    task = req.content

    async def stream_and_save():
        """Wrap the agent stream — save the final assistant message after streaming."""
        final_text = ""
        run_id = None
        total_tokens = None

        async for event in run_agent_streaming(task=task, base_dir=BASE_DIR):
            yield event

            if event["type"] == "text_delta":
                final_text += event["data"]["content"]
            elif event["type"] == "done":
                run_id = event["data"].get("run_id")
                total_tokens = event["data"].get("total_tokens")
                # Use final_text from done event if available (guardrail-processed)
                if event["data"].get("final_text"):
                    final_text = event["data"]["final_text"]

        # Save assistant message to DB
        if final_text:
            db = get_db()
            try:
                queries.add_message(
                    db, conversation_id, "assistant", final_text,
                    run_id=run_id, token_count=total_tokens,
                )
            finally:
                db.close()

    return StreamingResponse(
        sse_generator(stream_and_save()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Agent Run Files ───────────────────────────────────────

@router.get("/runs/{run_id}/files")
def list_run_files(run_id: str):
    run_dir = Path(BASE_DIR) / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail="Run not found")

    files = []
    for p in sorted(run_dir.rglob("*")):
        if p.is_file() and p.name != "state.json":
            rel = str(p.relative_to(run_dir)).replace("\\", "/")
            files.append({"path": rel, "size": p.stat().st_size})
    return files


@router.get("/runs/{run_id}/files/{file_path:path}")
def read_run_file(run_id: str, file_path: str):
    run_dir = Path(BASE_DIR) / run_id
    target = (run_dir / file_path).resolve()

    # Prevent path traversal
    if not str(target).startswith(str(run_dir.resolve())):
        raise HTTPException(status_code=403, detail="Path not allowed")
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return {"path": file_path, "content": target.read_text()}


@router.get("/runs/{run_id}/plan")
def get_run_plan(run_id: str):
    plan_path = Path(BASE_DIR) / run_id / "notes" / "plan.md"
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
