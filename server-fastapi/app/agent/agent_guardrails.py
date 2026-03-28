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


def check_limits(state: AgentState, config: AgentConfig):
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

