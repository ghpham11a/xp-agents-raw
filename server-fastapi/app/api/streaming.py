import json

from typing import AsyncGenerator


def format_sse(event: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(event)}\n\n"


async def sse_generator(events: AsyncGenerator[dict, None]) -> AsyncGenerator[str, None]:
    """Wrap an event generator into SSE-formatted strings."""
    async for event in events:
        yield format_sse(event)
