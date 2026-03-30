"""
SSE event type constants.

Both the agent loop and the API router reference these when
building or inspecting event dicts. Using constants instead of
bare strings means a typo becomes an AttributeError at import
time rather than a silent mismatch at runtime.
"""


class EventType:
    PLAN = "plan"
    TEXT_DELTA = "text_delta"
    TOOL_CALL = "tool_call"
    FILE_UPDATE = "file_update"
    DONE = "done"
    ERROR = "error"
    APPROVAL_REQUEST = "approval_request"
