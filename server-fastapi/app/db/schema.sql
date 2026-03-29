-- Schema: server-fastapi/app/db/schema.sql

CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,   -- UUID
    title       TEXT NOT NULL,      -- Auto-generated from first message
    created_at  TEXT NOT NULL,      -- ISO 8601
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,   -- UUID
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role            TEXT NOT NULL,      -- 'user' | 'assistant'
    content         TEXT NOT NULL,      -- The message text
    run_id          TEXT,              -- Links to agent_runs/{run_id}/ (NULL for user msgs)
    token_count     INTEGER,           -- Tokens used for this response
    tool_calls      TEXT,              -- JSON array of tool calls (NULL for user msgs)
    created_at      TEXT NOT NULL,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, created_at);
