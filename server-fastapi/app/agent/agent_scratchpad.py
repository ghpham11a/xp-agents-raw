import logging
import shutil

from pathlib import Path

logger = logging.getLogger(__name__)

# ============================================================
# SCRATCHPAD — per-run working space, temporary
# ============================================================

class AgentScratchpad:
    """
    Per-run working space. Temporary.
    The agent WORKS here — takes notes, drafts, organizes research.
    Analogous to a whiteboard or legal pad the agent uses for one job,
    then leaves behind.
    """

    def __init__(self, run_id: str, base_dir: str = "./agent_runs"):
        self.run_id = run_id
        self.root   = Path(base_dir) / run_id
        self.root.mkdir(parents=True, exist_ok=True)
        for d in ["notes", "research", "output", "scratch"]:
            (self.root / d).mkdir(exist_ok=True)
        logger.info(f"Scratchpad at: {self.root}")

    def _resolve(self, relative_path: str) -> Path:
        resolved = (self.root / relative_path).resolve()
        if not str(resolved).startswith(str(self.root.resolve())):
            raise PermissionError(f"Path escape attempt: '{relative_path}'")
        return resolved

    def write_file(self, path: str, content: str) -> str:
        target = self._resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        return f"Written: {path}"

    def read_file(self, path: str) -> str:
        target = self._resolve(path)
        if not target.exists():
            return f"File not found: {path}"
        return target.read_text()

    def append_file(self, path: str, content: str) -> str:
        target = self._resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "a") as f:
            f.write(content)
        return f"Appended to: {path}"

    def list_files(self, directory: str = "") -> str:
        target = self._resolve(directory) if directory else self.root
        if not target.exists():
            return f"Directory not found: {directory}"
        files = []
        for p in sorted(target.rglob("*")):
            if p.is_file() and p.name != "state.json":
                rel  = p.relative_to(self.root)
                size = p.stat().st_size
                files.append(f"{rel}  ({size} bytes)")
        return "\n".join(files) if files else "Scratchpad is empty."

    def delete_file(self, path: str) -> str:
        target = self._resolve(path)
        if not target.exists():
            return f"File not found: {path}"
        target.unlink()
        return f"Deleted: {path}"

    def move_file(self, src: str, dst: str) -> str:
        source = self._resolve(src)
        dest   = self._resolve(dst)
        if not source.exists():
            return f"Source not found: {src}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(dest))
        return f"Moved: {src} -> {dst}"

    def get_tool_map(self) -> dict:
        return {
            "write_file":  self.write_file,
            "read_file":   self.read_file,
            "append_file": self.append_file,
            "list_files":  self.list_files,
            "delete_file": self.delete_file,
            "move_file":   self.move_file,
        }


SCRATCHPAD_TOOL_DEFINITIONS = [
    {
        "name": "write_file",
        "description": "Write content to a working file. Use notes/ for drafts, research/ for gathered facts, output/ for final deliverables.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path":    {"type": "string"},
                "content": {"type": "string"}
            },
            "required": ["path", "content"]
        }
    },
    {
        "name": "read_file",
        "description": "Read a working file from the scratchpad.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"]
        }
    },
    {
        "name": "append_file",
        "description": "Append text to an existing file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path":    {"type": "string"},
                "content": {"type": "string"}
            },
            "required": ["path", "content"]
        }
    },
    {
        "name": "list_files",
        "description": "List all working files in the scratchpad.",
        "input_schema": {
            "type": "object",
            "properties": {"directory": {"type": "string"}}
        }
    },
    {
        "name": "delete_file",
        "description": "Delete a working file.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"]
        }
    },
    {
        "name": "move_file",
        "description": "Move or rename a working file. Use to promote a draft from notes/ to output/ when done.",
        "input_schema": {
            "type": "object",
            "properties": {
                "src": {"type": "string"},
                "dst": {"type": "string"}
            },
            "required": ["src", "dst"]
        }
    }
]