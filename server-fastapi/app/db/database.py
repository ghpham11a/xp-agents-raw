import sqlite3
import logging

from pathlib import Path
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent.parent / "chat.db"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def get_db() -> sqlite3.Connection:
    """Return a connection with WAL mode and dict-like rows."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db_connection():
    """Context manager that auto-closes the connection."""
    conn = get_db()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Read schema.sql and execute it, then run migrations. Called once at startup."""
    schema = SCHEMA_PATH.read_text()
    with get_db_connection() as conn:
        conn.executescript(schema)
        _migrate(conn)
        _seed_default_agent(conn)
    logger.info(f"Database initialized at {DB_PATH}")


def _migrate(conn: sqlite3.Connection):
    """Add columns/tables that may be missing from older databases."""
    # messages.tool_calls
    msg_columns = {row[1] for row in conn.execute("PRAGMA table_info(messages)").fetchall()}
    if "tool_calls" not in msg_columns:
        conn.execute("ALTER TABLE messages ADD COLUMN tool_calls TEXT")
        logger.info("Migration: added tool_calls column to messages")

    # conversations.agent_id
    conv_columns = {row[1] for row in conn.execute("PRAGMA table_info(conversations)").fetchall()}
    if "agent_id" not in conv_columns:
        conn.execute("ALTER TABLE conversations ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'default'")
        logger.info("Migration: added agent_id column to conversations")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id)")


def _seed_default_agent(conn: sqlite3.Connection):
    """Ensure the default agent exists."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT OR IGNORE INTO agents (id, name, description, model, system_prompt, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("default", "Default Agent", "General-purpose assistant agent", "claude-opus-4-5", "", now, now),
    )
