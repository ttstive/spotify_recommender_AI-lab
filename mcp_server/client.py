import os
from typing import Any

import httpx

API_BASE_URL = os.environ.get("MUSIC_API_BASE_URL", "http://localhost:8000/api")


async def api_get(path: str, params: dict[str, Any] | None = None) -> Any:
    """Reusable GET helper for every tool in this server."""
    async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=30.0) as client:
        response = await client.get(path, params=params)
        response.raise_for_status()
        return response.json()


def format_api_error(exc: Exception, *, not_found_hint: str) -> str:
    """Consistent, actionable error formatting across all tools."""
    if isinstance(exc, httpx.HTTPStatusError):
        if exc.response.status_code == 404:
            return f"Error: {not_found_hint}"
        return f"Error: API request failed with status {exc.response.status_code}"
    if isinstance(exc, httpx.ConnectError):
        return (
            f"Error: could not reach the Music Recommender API at {API_BASE_URL}. "
            "Is it running? Start it with `uv run python main.py`."
        )
    if isinstance(exc, httpx.TimeoutException):
        return "Error: request to the Music Recommender API timed out. Please try again."
    return f"Error: unexpected error occurred: {type(exc).__name__}: {exc}"
