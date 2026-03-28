import time
import uuid
import json
import logging

from dataclasses import dataclass, field, asdict
from typing import Literal

from agent.agent_scratchpad import AgentScratchpad

logger = logging.getLogger(__name__)

# ============================================================
# AGENT STATE — operational metadata only
# ============================================================

@dataclass
class AgentState:
    """
    Operational metadata for one run.
    Tracks what the infrastructure needs to know:
    is it running, how far along, how many tokens used.
    NOT the work product, NOT what the agent remembers.
    """
    run_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    status: Literal["running", "paused", "complete", "failed"] = "running"
    iterations: int = 0
    total_tokens: int = 0
    consecutive_errors: int = 0
    start_time: float = field(default_factory=time.time)
    tool_call_counts: dict = field(default_factory=dict)
    messages: list = field(default_factory=list)

    @staticmethod
    def _serialize(obj):
        """Handle Anthropic SDK objects (TextBlock, ToolUseBlock, etc.)."""
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        if hasattr(obj, "__dict__"):
            return obj.__dict__
        raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

    def save(self, scratchpad: AgentScratchpad):
        path = scratchpad.root / "state.json"
        with open(path, "w") as f:
            json.dump(asdict(self), f, indent=2, default=self._serialize)

    @classmethod
    def load(cls, scratchpad: AgentScratchpad):
        path = scratchpad.root / "state.json"
        with open(path) as f:
            return cls(**json.load(f))