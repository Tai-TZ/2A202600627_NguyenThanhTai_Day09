"""Benchmark Stage 5 latency — baseline vs optimized.

Restart agents between modes so env vars take effect:

  # Baseline (slow path)
  $env:USE_FAST_DELEGATE = "false"
  $env:USE_KEYWORD_ROUTING = "false"
  .\\start_all.ps1
  uv run python scripts/benchmark_latency.py --mode baseline

  # Optimized (default)
  $env:USE_FAST_DELEGATE = "true"
  $env:USE_KEYWORD_ROUTING = "true"
  .\\start_all.ps1
  uv run python scripts/benchmark_latency.py --mode optimized
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time

import httpx
from dotenv import load_dotenv

load_dotenv()

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)

CUSTOMER_AGENT_URL = os.getenv("CUSTOMER_AGENT_URL", "http://localhost:10100")
QUESTION = (
    "If a company breaks a contract and avoids taxes, "
    "what are the legal and regulatory consequences?"
)


async def measure_once() -> float:
    async with httpx.AsyncClient(timeout=300.0) as http_client:
        card_url = f"{CUSTOMER_AGENT_URL}/.well-known/agent.json"
        card_resp = await http_client.get(card_url)
        card_resp.raise_for_status()

        from a2a.types import AgentCard, Message, Part, Role, TextPart, SendMessageRequest, MessageSendParams
        from a2a.client import A2AClient
        from uuid import uuid4

        agent_card = AgentCard.model_validate(card_resp.json())
        client = A2AClient(httpx_client=http_client, agent_card=agent_card)

        message = Message(
            role=Role.user,
            parts=[Part(root=TextPart(text=QUESTION))],
            message_id=str(uuid4()),
        )
        request = SendMessageRequest(id=str(uuid4()), params=MessageSendParams(message=message))

        start = time.perf_counter()
        await client.send_message(request)
        return time.perf_counter() - start


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["baseline", "optimized"], default="optimized")
    args = parser.parse_args()

    fast = os.getenv("USE_FAST_DELEGATE", "true").lower() == "true"
    keyword = os.getenv("USE_KEYWORD_ROUTING", "true").lower() == "true"

    print("=" * 60)
    print(f"LATENCY BENCHMARK — {args.mode.upper()}")
    print("=" * 60)
    print(f"USE_FAST_DELEGATE   = {fast}")
    print(f"USE_KEYWORD_ROUTING = {keyword}")
    print(f"OPENROUTER_MODEL    = {os.getenv('OPENROUTER_MODEL', 'default')}")
    print(f"Question: {QUESTION[:60]}...")
    print("-" * 60)

    latency = await measure_once()
    print(f"\nLatency: {latency:.2f} giây")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
