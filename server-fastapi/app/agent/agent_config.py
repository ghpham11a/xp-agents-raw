from dataclasses import dataclass, field 

@dataclass
class AgentConfig:
    """Safety limits and policy knobs for a single agent run.

    Defaults are conservative for interactive use: 20 iterations keeps
    cost and latency bounded, 120s timeout prevents runaways, and the
    50k token budget caps spend at roughly $0.50 per run on Opus.
    """

    max_iterations: int = 20
    max_time_seconds: float = 120.0
    max_tokens_total: int = 50_000
    max_consecutive_errors: int = 3
    require_human_approval_for: list = field(default_factory=lambda: ["delete", "send_email", "deploy"])
    use_llm_input_guard: bool = False  # opt-in — costs tokens

