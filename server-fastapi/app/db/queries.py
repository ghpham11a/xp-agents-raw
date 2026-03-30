import json
import uuid
import sqlite3

from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


def _to_json(data: dict | list | None) -> str | None:
    """Serialize a dict/list to a JSON string for storage in SQLite."""
    return json.dumps(data) if data else None


def _from_json(text: str | None) -> dict | list | None:
    """Deserialize a JSON string from SQLite back into a dict/list."""
    return json.loads(text) if text else None


# ── Agents ────────────────────────────────────────────────

def create_agent(
    db: sqlite3.Connection,
    agent_id: str,
    name: str,
    description: str = "",
    model: str = "claude-opus-4-5",
    system_prompt: str = "",
    config_json: dict | None = None,
) -> str:
    """Insert a new agent and return its id."""
    now = _now()
    db.execute(
        "INSERT INTO agents (id, name, description, model, system_prompt, config_json, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (agent_id, name, description, model, system_prompt, _to_json(config_json), now, now),
    )
    db.commit()
    return agent_id


def get_agent(db: sqlite3.Connection, agent_id: str) -> dict | None:
    """Fetch an agent by id, or None if not found."""
    row = db.execute(
        "SELECT id, name, description, model, system_prompt, config_json, created_at, updated_at FROM agents WHERE id = ?",
        (agent_id,),
    ).fetchone()
    if not row:
        return None
    d = dict(row)
    d["config_json"] = _from_json(d["config_json"])
    return d


def list_agents(db: sqlite3.Connection) -> list[dict]:
    """Return all agents ordered by creation date."""
    rows = db.execute(
        "SELECT id, name, description, model, system_prompt, config_json, created_at, updated_at FROM agents ORDER BY created_at"
    ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["config_json"] = _from_json(d["config_json"])
        results.append(d)
    return results


def update_agent(
    db: sqlite3.Connection,
    agent_id: str,
    **fields,
) -> bool:
    """Update allowed fields on an agent. Returns False if nothing changed."""
    allowed = {"name", "description", "model", "system_prompt", "config_json"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return False
    if "config_json" in updates and isinstance(updates["config_json"], dict):
        updates["config_json"] = _to_json(updates["config_json"])
    updates["updated_at"] = _now()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    db.execute(
        f"UPDATE agents SET {set_clause} WHERE id = ?",
        (*updates.values(), agent_id),
    )
    db.commit()
    return True


def delete_agent(db: sqlite3.Connection, agent_id: str) -> None:
    # Delete all conversations and their messages first
    conv_ids = [r["id"] for r in db.execute(
        "SELECT id FROM conversations WHERE agent_id = ?", (agent_id,)
    ).fetchall()]
    for cid in conv_ids:
        db.execute("DELETE FROM messages WHERE conversation_id = ?", (cid,))
    db.execute("DELETE FROM conversations WHERE agent_id = ?", (agent_id,))
    db.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
    db.commit()


# ── Conversations ──────────────────────────────────────────

def create_conversation(db: sqlite3.Connection, title: str, agent_id: str = "default") -> str:
    """Create a conversation and return its id."""
    conversation_id = _new_id()
    now = _now()
    db.execute(
        "INSERT INTO conversations (id, agent_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (conversation_id, agent_id, title, now, now),
    )
    db.commit()
    return conversation_id


def list_conversations(db: sqlite3.Connection, agent_id: str | None = None) -> list[dict]:
    """Return conversations, optionally filtered by agent, newest first."""
    if agent_id:
        rows = db.execute(
            "SELECT id, agent_id, title, created_at, updated_at FROM conversations WHERE agent_id = ? ORDER BY updated_at DESC",
            (agent_id,),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT id, agent_id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_conversation(db: sqlite3.Connection, conversation_id: str) -> dict | None:
    """Fetch a conversation by id, or None if not found."""
    row = db.execute(
        "SELECT id, agent_id, title, created_at, updated_at FROM conversations WHERE id = ?",
        (conversation_id,),
    ).fetchone()
    return dict(row) if row else None


def update_conversation_timestamp(db: sqlite3.Connection, conversation_id: str) -> None:
    """Bump a conversation's updated_at to now (called after adding messages)."""
    db.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?",
        (_now(), conversation_id),
    )
    db.commit()


def get_run_ids(db: sqlite3.Connection, conversation_id: str) -> list[str]:
    """Return all non-null run_ids for a conversation's messages."""
    rows = db.execute(
        "SELECT DISTINCT run_id FROM messages WHERE conversation_id = ? AND run_id IS NOT NULL",
        (conversation_id,),
    ).fetchall()
    return [row["run_id"] for row in rows]


def delete_conversation(db: sqlite3.Connection, conversation_id: str) -> None:
    """Delete a conversation and all its messages."""
    db.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
    db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    db.commit()


# ── Messages ───────────────────────────────────────────────

def add_message(
    db: sqlite3.Connection,
    conversation_id: str,
    role: str,
    content: str,
    run_id: str | None = None,
    token_count: int | None = None,
    tool_calls: list[dict] | None = None,
) -> str:
    """Add a message and return its id."""
    message_id = _new_id()
    tool_calls_json = _to_json(tool_calls)
    db.execute(
        "INSERT INTO messages (id, conversation_id, role, content, run_id, token_count, tool_calls, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (message_id, conversation_id, role, content, run_id, token_count, tool_calls_json, _now()),
    )
    db.commit()
    update_conversation_timestamp(db, conversation_id)
    return message_id


def get_messages(db: sqlite3.Connection, conversation_id: str) -> list[dict]:
    """Return all messages for a conversation, oldest first."""
    rows = db.execute(
        "SELECT id, conversation_id, role, content, run_id, token_count, tool_calls, created_at "
        "FROM messages WHERE conversation_id = ? ORDER BY created_at",
        (conversation_id,),
    ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["tool_calls"] = _from_json(d["tool_calls"])
        results.append(d)
    return results
