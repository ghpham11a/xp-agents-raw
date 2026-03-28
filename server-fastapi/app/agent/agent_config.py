from dataclasses import dataclass, field 

@dataclass
class AgentConfig:
    max_iterations: int = 20 
    max_time_seconds: float = 120.0
    max_tokens_total: int = 50_000 
    max_consecutive_errors: int = 3 
    require_human_approval_for: list = field(default_factory=lambda: ["delete", "send_email", "deploy"])
    use_llm_input_guard: bool   = False   # opt-in — costs tokens

