"""UI Gateway — port 10200.

Proxies browser requests to the Customer Agent via A2A protocol.
Run alongside agents: uv run python -m gateway
"""

from __future__ import annotations

import os
import time
from uuid import uuid4

import httpx
import uvicorn
from dotenv import load_dotenv
import asyncio
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

from common.agent_errors import detect_degraded_agents
from common.answer_parser import parse_agent_outputs

CUSTOMER_AGENT_URL = os.getenv("CUSTOMER_AGENT_URL", "http://localhost:10100")
REGISTRY_URL = os.getenv("REGISTRY_URL", "http://localhost:10000")
PORT = int(os.getenv("GATEWAY_PORT", "10200"))

AGENT_STATUS_TARGETS = [
    {"id": "registry", "url": REGISTRY_URL, "path": "/health"},
    {"id": "customer", "url": CUSTOMER_AGENT_URL, "path": "/.well-known/agent.json"},
    {"id": "law", "url": "http://localhost:10101", "path": "/.well-known/agent.json"},
    {"id": "tax", "url": "http://localhost:10102", "path": "/.well-known/agent.json"},
    {"id": "compliance", "url": "http://localhost:10103", "path": "/.well-known/agent.json"},
]

app = FastAPI(title="Legal Multi-Agent UI Gateway", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str
    latency_ms: float
    agent_name: str


FLOW_PREFIX: list[dict] = [
    {
        "id": "s1",
        "from": "user",
        "to": "customer",
        "label": "POST /api/chat/stream",
        "protocol": "HTTP",
        "detail": "Browser sends legal question to UI Gateway",
        "delay": 0.0,
    },
    {
        "id": "s2",
        "from": "customer",
        "to": "registry",
        "label": "discover(legal_question)",
        "protocol": "HTTP",
        "detail": "Customer Agent queries Registry for Law Agent endpoint",
        "delay": 0.4,
    },
    {
        "id": "s3",
        "from": "customer",
        "to": "law",
        "label": "A2A SendMessage (Task)",
        "protocol": "A2A",
        "detail": "delegate_to_legal_agent — JSON-RPC over HTTP",
        "delay": 0.8,
    },
    {
        "id": "s4",
        "from": "law",
        "to": "law",
        "label": "analyze_law",
        "protocol": "A2A",
        "detail": "Law Agent LLM analyses contract & liability aspects",
        "delay": 1.2,
    },
    {
        "id": "s5",
        "from": "law",
        "to": "law",
        "label": "check_routing (keyword)",
        "protocol": "A2A",
        "detail": "Decide which specialists to invoke",
        "delay": 0.3,
    },
    {
        "id": "s6a",
        "from": "law",
        "to": "tax",
        "label": "A2A parallel dispatch",
        "protocol": "A2A",
        "detail": "Send API → Tax Agent (port 10102)",
        "delay": 0.5,
        "parallel": True,
    },
    {
        "id": "s6b",
        "from": "law",
        "to": "compliance",
        "label": "A2A parallel dispatch",
        "protocol": "A2A",
        "detail": "Send API → Compliance Agent (port 10103)",
        "delay": 0.0,
        "parallel": True,
    },
]

FLOW_SUFFIX: list[dict] = [
    {
        "id": "s7a",
        "from": "tax",
        "to": "law",
        "label": "Tax Artifact",
        "protocol": "A2A",
        "detail": "Specialist analysis returned to orchestrator",
        "delay": 0.1,
    },
    {
        "id": "s7b",
        "from": "compliance",
        "to": "law",
        "label": "Compliance Artifact",
        "protocol": "A2A",
        "detail": "Specialist analysis returned to orchestrator",
        "delay": 0.0,
        "parallel": True,
    },
    {
        "id": "s8",
        "from": "law",
        "to": "law",
        "label": "aggregate",
        "protocol": "A2A",
        "detail": "Synthesise legal + tax + compliance into final answer",
        "delay": 0.2,
    },
    {
        "id": "s9",
        "from": "law",
        "to": "customer",
        "label": "A2A Task completed",
        "protocol": "A2A",
        "detail": "Comprehensive legal analysis artifact",
        "delay": 0.15,
    },
    {
        "id": "s10",
        "from": "customer",
        "to": "user",
        "label": "Response delivered",
        "protocol": "HTTP",
        "detail": "Final answer streamed to browser",
        "delay": 0.1,
    },
]


async def _run_a2a_chat(message: str) -> tuple[str, float, str]:
    """Execute real A2A call to Customer Agent; return answer, latency_ms, agent_name."""
    from a2a.client import A2AClient
    from a2a.types import AgentCard, Message, Part, Role, SendMessageRequest, TextPart
    from a2a.types import MessageSendParams

    start = time.perf_counter()
    async with httpx.AsyncClient(timeout=300.0) as http_client:
        card_resp = await http_client.get(f"{CUSTOMER_AGENT_URL}/.well-known/agent.json")
        card_resp.raise_for_status()
        agent_card = AgentCard.model_validate(card_resp.json())
        client = A2AClient(httpx_client=http_client, agent_card=agent_card)

        a2a_message = Message(
            role=Role.user,
            parts=[Part(root=TextPart(text=message.strip()))],
            message_id=str(uuid4()),
        )
        request = SendMessageRequest(
            id=str(uuid4()),
            params=MessageSendParams(message=a2a_message),
        )
        response = await client.send_message(request)

    answer = _extract_text(response)
    if not answer:
        raise RuntimeError("No text response from Customer Agent")

    latency_ms = (time.perf_counter() - start) * 1000
    return answer, latency_ms, agent_card.name


def _extract_text(response) -> str:
    """Parse A2A send_message response (mirrors test_client.py)."""
    if not hasattr(response, "root"):
        return ""
    root = response.root
    if not hasattr(root, "result"):
        return ""
    result = root.result
    parts: list[str] = []

    if hasattr(result, "artifacts") and result.artifacts:
        for artifact in result.artifacts:
            for part in artifact.parts:
                p = part.root if hasattr(part, "root") else part
                if hasattr(p, "text"):
                    parts.append(p.text)
    elif hasattr(result, "parts") and result.parts:
        for part in result.parts:
            p = part.root if hasattr(part, "root") else part
            if hasattr(p, "text"):
                parts.append(p.text)

    return "".join(parts)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "customer_agent": CUSTOMER_AGENT_URL}


@app.get("/api/agent-card")
async def agent_card() -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(f"{CUSTOMER_AGENT_URL}/.well-known/agent.json")
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            raise HTTPException(503, f"Customer Agent unavailable: {exc}") from exc


@app.get("/api/agents")
async def list_agents() -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(f"{REGISTRY_URL}/agents")
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return {"agents": {}}


@app.get("/api/agents/status")
async def agents_status() -> dict:
    """Ping each agent HTTP endpoint — detect shutdown before/at runtime."""
    results: dict[str, str] = {}

    async with httpx.AsyncClient(timeout=3.0) as client:
        for target in AGENT_STATUS_TARGETS:
            url = f"{target['url'].rstrip('/')}{target['path']}"
            try:
                resp = await client.get(url)
                results[target["id"]] = "online" if resp.status_code < 500 else "offline"
            except Exception:
                results[target["id"]] = "offline"

    return {"agents": results, "all_online": all(v == "online" for v in results.values())}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    if not req.message.strip():
        raise HTTPException(400, "Message cannot be empty")

    try:
        answer, latency_ms, agent_name = await _run_a2a_chat(req.message)
    except httpx.HTTPError as exc:
        raise HTTPException(
            503,
            f"Cannot reach Customer Agent at {CUSTOMER_AGENT_URL}. Run start_all.ps1 first.",
        ) from exc
    except Exception as exc:
        raise HTTPException(502, f"A2A request failed: {exc}") from exc

    return ChatResponse(
        answer=answer,
        latency_ms=round(latency_ms, 1),
        agent_name=agent_name,
    )


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    """SSE stream: emit A2A flow steps while running the real Stage 5 pipeline."""
    if not req.message.strip():
        raise HTTPException(400, "Message cannot be empty")

    trace_id = str(uuid4())

    async def _emit_step(step: dict) -> str:
        payload = {
            "type": "step",
            "trace_id": trace_id,
            "step": {
                "id": step["id"],
                "from": step["from"],
                "to": step["to"],
                "label": step["label"],
                "protocol": step["protocol"],
                "detail": step.get("detail", ""),
                "parallel": step.get("parallel", False),
            },
        }
        return f"data: {json.dumps(payload)}\n\n"

    async def event_generator():
        a2a_task = asyncio.create_task(_run_a2a_chat(req.message))

        try:
            for step in FLOW_PREFIX:
                delay = step.get("delay", 0)
                if delay > 0:
                    await asyncio.sleep(delay)
                yield await _emit_step(step)

            pulse = 0
            while not a2a_task.done():
                pulse += 1
                yield await _emit_step(
                    {
                        "id": f"pulse-{pulse}",
                        "from": "law",
                        "to": "tax",
                        "label": "Tax ∥ Compliance LLM running…",
                        "protocol": "A2A",
                        "detail": "Parallel specialist agents processing",
                    }
                )
                await asyncio.sleep(2.5)

            answer, latency_ms, agent_name = a2a_task.result()
            failed_agents = detect_degraded_agents(answer)

            for agent_id in failed_agents:
                yield f"data: {json.dumps({'type': 'agent_error', 'trace_id': trace_id, 'agent_id': agent_id, 'message': f'{agent_id} agent offline or unreachable'})}\n\n"

            agent_outputs = parse_agent_outputs(answer)
            for output in agent_outputs:
                yield f"data: {json.dumps({'type': 'agent_result', 'trace_id': trace_id, **output})}\n\n"
                await asyncio.sleep(0.08)

            for step in FLOW_SUFFIX:
                if step["from"] in failed_agents or step["to"] in failed_agents:
                    step = {**step, "label": f"{step['label']} (failed)"}
                delay = step.get("delay", 0)
                if delay > 0:
                    await asyncio.sleep(delay)
                yield await _emit_step(step)

            done_payload = {
                "type": "done",
                "trace_id": trace_id,
                "answer": answer,
                "latency_ms": round(latency_ms, 1),
                "agent_name": agent_name,
                "failed_agents": failed_agents,
                "degraded": len(failed_agents) > 0,
                "agent_outputs": agent_outputs,
            }
            yield f"data: {json.dumps(done_payload)}\n\n"

        except Exception as exc:
            if not a2a_task.done():
                a2a_task.cancel()
            msg = str(exc)
            failed: list[str] = []
            if "Customer Agent" in msg or "10100" in msg:
                failed = ["customer"]
            elif "Law Agent" in msg or "10101" in msg:
                failed = ["law"]
            for agent_id in failed:
                yield f"data: {json.dumps({'type': 'agent_error', 'trace_id': trace_id, 'agent_id': agent_id, 'message': msg})}\n\n"
            err = {"type": "error", "message": msg, "trace_id": trace_id, "failed_agents": failed}
            yield f"data: {json.dumps(err)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def main() -> None:
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")


if __name__ == "__main__":
    main()
