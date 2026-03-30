"""
Guardrails and loop-limit enforcement for the agent.

Error conventions used across the agent subsystem:

- **Tool functions** (AgentMemory, AgentScratchpad) return plain strings
  on both success and failure. These strings are fed back to Claude as
  tool results, so raising would break the conversation loop.

- **Database queries** (db/queries.py) return ``None`` for "not found".
  The API router converts ``None`` into an HTTP 404.

- **Guardrails and loop limits** (this module) raise typed exceptions
  (subclasses of ``AgentLoopError``). The agent loop catches these at
  the top level and translates them into error SSE events or CLI output.
"""

import re
import time

from enum import Enum
from typing import Optional
from dataclasses import dataclass

from agent.agent_config import AgentConfig
from agent.agent_state import AgentState

# ============================================================
# GUARDRAILS
# ============================================================

class GuardrailAction(Enum):
    ALLOW = "allow"
    BLOCK = "block"
    MODIFY = "modify"

@dataclass 
class GuardrailResult:
    action: GuardrailAction
    reason: Optional[str] = None
    modified_content: Optional[str] = None

class InputGuardrails:

    BLOCKED_PATTERNS = [
        r"ignore (all |your )?(previous |prior )?instructions",
        r"you are now",
        r"jailbreak",
    ]
    PII_PATTERNS = {
        "ssn":         r"\b\d{3}-\d{2}-\d{4}\b",
        "credit_card": r"\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b",
        "api_key":     r"\b(sk|pk|api)[-_][a-zA-Z0-9]{20,}\b",
    }

    def check(self, text: str) -> GuardrailResult:
        """Screen user input for prompt-injection patterns and PII.

        Returns BLOCK if injection is detected, MODIFY with redacted
        text if PII is found, or ALLOW otherwise.
        """
        for pattern in self.BLOCKED_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return GuardrailResult(GuardrailAction.BLOCK, "Prompt injection detected")
            
        modified = text 
        found_pii = []
        for pii_type, pattern in self.PII_PATTERNS.items():
            if re.search(pattern, modified):
                found_pii.append(pii_type)
                modified = re.sub(pattern, f"[REDACTED_{pii_type.upper()}]", modified)

        if found_pii:
            return GuardrailResult(GuardrailAction.MODIFY, f"PII scrubbed: {found_pii}", modified)
        
        return GuardrailResult(GuardrailAction.ALLOW)
    
class OutputGuardrails:
    """Scrub sensitive data from the agent's final response before it reaches the user."""

    SENSITIVE_PATTERNS = {
        "internal_path": r"(/home|/var|/etc)/\S+",
        "stack_trace":   r"Traceback \(most recent call last\)",
        "api_key":       r"\b(sk|pk|api)[-_][a-zA-Z0-9]{20,}\b",
    }

    def check(self, text: str) -> GuardrailResult:
        modified = text
        found = []
        for leak_type, pattern in self.SENSITIVE_PATTERNS.items():
            if re.search(pattern, modified):
                found.append(leak_type)
                modified = re.sub(pattern, "[REDACTED]", modified)

        if found:
            return GuardrailResult(GuardrailAction.MODIFY, f"Sensitive data scrubbed: {found}", modified)

        return GuardrailResult(GuardrailAction.ALLOW)
    
class ToolGuardrails:
    """Policy-based gate that runs before each tool call.

    TOOL_POLICIES maps tool names to path allowlists/blocklists.
    Tools not listed in the policy dict are allowed by default.
    """

    TOOL_POLICIES = {
        "read_file": {
            "allowed_paths": ["/data/", "/reports/"],
            "blocked_paths": ["/etc/", "/home/"]
        },
        "execute_code": {
            "allowed": False,
            "reason": "Code execution not permitted"
        }
    }

    def check(self, tool_name: str, tool_input: dict) -> GuardrailResult:
        policy = self.TOOL_POLICIES.get(tool_name)
        if not policy:
            return GuardrailResult(GuardrailAction.ALLOW)

        if not policy.get("allowed", True):
            return GuardrailResult(GuardrailAction.BLOCK, policy.get("reason"))

        if "allowed_paths" in policy:
            path = tool_input.get("path", "")
            if not any(path.startswith(p) for p in policy["allowed_paths"]):
                return GuardrailResult(GuardrailAction.BLOCK, f"Path '{path}' not permitted")

        return GuardrailResult(GuardrailAction.ALLOW)
    

# ============================================================
# LOOP LIMIT CHECKS
# ============================================================

class AgentLoopError(Exception): pass
class MaxIterationsExceeded(AgentLoopError): pass
class TimeoutExceeded(AgentLoopError): pass
class TokenBudgetExceeded(AgentLoopError): pass
class ConsecutiveErrorLimit(AgentLoopError): pass
class SuspectedLoop(AgentLoopError): pass


def check_limits(state: AgentState, config: AgentConfig) -> None:
    """Raise an AgentLoopError subclass if any safety limit is exceeded."""
    if state.iterations >= config.max_iterations:
        raise MaxIterationsExceeded(f"Reached {state.iterations} iterations")

    elapsed = time.time() - state.start_time
    if elapsed > config.max_time_seconds:
        raise TimeoutExceeded(f"Ran for {elapsed:.1f}s")

    if state.total_tokens >= config.max_tokens_total:
        raise TokenBudgetExceeded(f"Used {state.total_tokens} tokens")

    if state.consecutive_errors >= config.max_consecutive_errors:
        raise ConsecutiveErrorLimit(f"{state.consecutive_errors} consecutive errors")

    for tool_name, count in state.tool_call_counts.items():
        if count > config.max_iterations // 2:
            raise SuspectedLoop(f"Tool '{tool_name}' called {count} times")

