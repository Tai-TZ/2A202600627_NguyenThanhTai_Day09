"""Shared helpers for agent-unavailable / shutdown scenarios."""

from __future__ import annotations

import httpx


class AgentUnavailableError(Exception):
    """Raised when a target agent cannot be reached or is shut down."""

    def __init__(self, agent: str, reason: str) -> None:
        self.agent = agent
        self.reason = reason
        super().__init__(f"{agent} unavailable: {reason}")


def wrap_connection_error(agent: str, endpoint: str, exc: Exception) -> AgentUnavailableError:
    """Turn httpx / connection failures into a clear unavailable error."""
    if isinstance(exc, httpx.ConnectError):
        reason = f"connection refused — {agent} may be shut down ({endpoint})"
    elif isinstance(exc, httpx.TimeoutException):
        reason = f"timed out waiting for {agent} ({endpoint})"
    elif isinstance(exc, httpx.HTTPStatusError):
        reason = f"HTTP {exc.response.status_code} from {agent} ({endpoint})"
    else:
        reason = str(exc)
    return AgentUnavailableError(agent, reason)


def unavailable_section(agent_label: str, reason: str) -> str:
    """Standard markdown snippet embedded in a partial response."""
    return f"[{agent_label} analysis unavailable: {reason}]"


def detect_degraded_agents(text: str) -> list[str]:
    """Parse final answer text for agents that failed gracefully."""
    markers: dict[str, list[str]] = {
        "tax": ["Tax analysis unavailable", "[Tax analysis unavailable"],
        "compliance": ["Compliance analysis unavailable", "[Compliance analysis unavailable"],
        "law": ["Law Agent unavailable", "Could not reach the Law Agent"],
        "customer": ["Customer Agent unavailable", "Cannot reach Customer Agent"],
    }
    found: list[str] = []
    lower = text.lower()
    for agent_id, phrases in markers.items():
        if any(p.lower() in lower for p in phrases):
            found.append(agent_id)
    return found
