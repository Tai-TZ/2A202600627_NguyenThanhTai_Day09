"""Registry client helpers.

Provides `discover(task)` to look up an agent endpoint from the registry,
and `register(agent_info)` for agents to self-register on startup.
"""

import os

import httpx

from common.agent_errors import AgentUnavailableError, wrap_connection_error

REGISTRY_URL = os.getenv("REGISTRY_URL", "http://localhost:10000")


async def discover(task: str) -> str:
    """Return the endpoint URL of the agent that handles the given task.

    Args:
        task: The task identifier (e.g. "legal_question", "tax_question").

    Returns:
        The HTTP endpoint base URL of the matching agent.

    Raises:
        httpx.HTTPStatusError: If no agent is found or the registry is unreachable.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{REGISTRY_URL}/discover/{task}")
            if resp.status_code == 404:
                raise AgentUnavailableError(
                    "Registry",
                    f"no agent registered for task '{task}' — specialist may be shut down",
                )
            resp.raise_for_status()
            return resp.json()["endpoint"]
    except AgentUnavailableError:
        raise
    except Exception as exc:
        raise wrap_connection_error("Registry", REGISTRY_URL, exc) from exc


async def ping_endpoint(endpoint: str, path: str = "/.well-known/agent.json") -> bool:
    """Return True if the agent HTTP endpoint responds."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{endpoint.rstrip('/')}{path}")
            return resp.status_code < 500
    except Exception:
        return False


async def register(agent_info: dict) -> None:
    """Register an agent with the registry.

    Args:
        agent_info: Dict with keys: agent_name, version, description,
                    tasks, endpoint, tags.

    Raises:
        httpx.HTTPStatusError: If registration fails.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(f"{REGISTRY_URL}/register", json=agent_info)
        resp.raise_for_status()