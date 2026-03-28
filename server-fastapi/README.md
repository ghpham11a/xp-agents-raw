┌─────────────────────────────────────────────────────────────┐
│ IN-CONTEXT (short-term)                                     │
│   The messages[] list — exists only for this LLM call       │
│   Lost when the context window is full or the run ends      │
├─────────────────────────────────────────────────────────────┤
│ EXTERNAL (long-term)                                        │
│   What we called shared_memory/ — persists across runs      │
│   The agent explicitly reads/writes this                    │
├─────────────────────────────────────────────────────────────┤
│ IN-WEIGHTS (parametric)                                     │
│   What Claude already knows from training                   │
│   The agent can't change this at runtime                    │
├─────────────────────────────────────────────────────────────┤
│ IN-CACHE (KV cache)                                         │
│   Anthropic's prompt caching — reuses computation           │
│   Mostly invisible to you, but relevant for cost            │
└─────────────────────────────────────────────────────────────┘

```python
# What each thing actually is — named to match its purpose

class Scratchpad:
    """
    Per-run working space. Temporary.
    notes/, research/, output/, scratch/
    The agent WORKS here.
    """

class AgentMemory:
    """
    Cross-run persistent storage. Long-term.
    shared_memory/
    The agent REMEMBERS here.
    """

class AgentState:
    """
    Operational metadata. Current run only.
    state.json
    The infrastructure TRACKS the agent here.
    """
```