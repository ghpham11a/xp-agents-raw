import uuid
import sqlite3

from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# ── Conversations ──────────────────────────────────────────

def create_conversation(db: sqlite3.Connection, title: str) -> str:
    """Create a conversation and return its id."""
    conversation_id = _new_id()
    now = _now()
    db.execute(
        "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (conversation_id, title, now, now),
    )
    db.commit()
    return conversation_id


def list_conversations(db: sqlite3.Connection) -> list[dict]:
    rows = db.execute(
        "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def get_conversation(db: sqlite3.Connection, conversation_id: str) -> dict | None:
    row = db.execute(
        "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
        (conversation_id,),
    ).fetchone()
    return dict(row) if row else None


def update_conversation_timestamp(db: sqlite3.Connection, conversation_id: str):
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


def delete_conversation(db: sqlite3.Connection, conversation_id: str):
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
) -> str:
    """Add a message and return its id."""
    message_id = _new_id()
    db.execute(
        "INSERT INTO messages (id, conversation_id, role, content, run_id, token_count, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (message_id, conversation_id, role, content, run_id, token_count, _now()),
    )
    db.commit()
    update_conversation_timestamp(db, conversation_id)
    return message_id


def get_messages(db: sqlite3.Connection, conversation_id: str) -> list[dict]:
    rows = db.execute(
        "SELECT id, conversation_id, role, content, run_id, token_count, created_at "
        "FROM messages WHERE conversation_id = ? ORDER BY created_at",
        (conversation_id,),
    ).fetchall()
    return [dict(r) for r in rows]
