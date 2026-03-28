import logging
import shutil

from pathlib import Path

logger = logging.getLogger(__name__)

# ============================================================
# AGENT MEMORY — cross-run, persistent, what the agent knows
# ============================================================

class AgentMemory:
    """
    Long-term memory. Persists across ALL runs.
    The agent explicitly reads and writes this.
    Analogous to a human's long-term memory or a notebook
    they carry between jobs.
    """

    def __init__(self, base_dir: str = "./agent_runs"):
        self.memory_dir = Path(base_dir) / "shared_memory"
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"AgentMemory at: {self.memory_dir}")

    def _resolve(self, key: str) -> Path:
        safe_key = "".join(c for c in key if c.isalnum() or c in "-_")
        return self.memory_dir / f"{safe_key}.md"

    def save(self, key: str, content: str) -> str:
        self._resolve(key).write_text(content)
        logger.info(f"[memory] saved: {key}")
        return f"Saved to memory: '{key}'"

    def load(self, key: str) -> str:
        target = self._resolve(key)
        if not target.exists():
            return f"No memory found for '{key}'."
        return target.read_text()

    def list(self) -> str:
        files = sorted(self.memory_dir.glob("*.md"))
        if not files:
            return "No memories stored yet."
        return "\n".join(f"- {f.stem}" for f in files)

    def delete(self, key: str) -> str:
        target = self._resolve(key)
        if not target.exists():
            return f"No memory found for '{key}'."
        target.unlink()
        return f"Deleted memory: '{key}'"

    def get_tool_map(self) -> dict:
        return {
            "save_memory":   self.save,
            "load_memory":   self.load,
            "list_memories": lambda: self.list(),
            "delete_memory": self.delete,
        }


MEMORY_TOOL_DEFINITIONS = [
    {
        "name": "save_memory",
        "description": "Save something to long-term memory. Persists across runs. Use for user preferences, important facts, or summaries you'll need next time.",
        "input_schema": {
            "type": "object",
            "properties": {
                "key":     {"type": "string", "description": "Short identifier e.g. 'user_preferences'"},
                "content": {"type": "string", "description": "What to remember"}
            },
            "required": ["key", "content"]
        }
    },
    {
        "name": "load_memory",
        "description": "Load a specific memory by key.",
        "input_schema": {
            "type": "object",
            "properties": {"key": {"type": "string"}},
            "required": ["key"]
        }
    },
    {
        "name": "list_memories",
        "description": "List all available memory keys.",
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "delete_memory",
        "description": "Delete a memory by key.",
        "input_schema": {
            "type": "object",
            "properties": {"key": {"type": "string"}},
            "required": ["key"]
        }
    }
]