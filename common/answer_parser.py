"""Parse aggregated legal response into per-agent output sections."""

from __future__ import annotations

import re

# (agent_id, header keywords — case insensitive)
SECTION_AGENTS: list[tuple[str, list[str]]] = [
    ("law", ["legal analysis", "phân tích pháp lý"]),
    ("tax", ["tax analysis", "phân tích thuế"]),
    ("compliance", [
        "regulatory compliance analysis",
        "compliance analysis",
        "phân tích tuân thủ",
        "regulatory compliance",
    ]),
]

UNAVAILABLE_PATTERNS: dict[str, list[str]] = {
    "tax": ["tax analysis unavailable"],
    "compliance": ["compliance analysis unavailable"],
    "law": ["law agent unavailable"],
}


def parse_agent_outputs(answer: str) -> list[dict]:
    """Split markdown answer into per-agent artifacts for UI logging."""
    if not answer.strip():
        return []

    results: list[dict] = []
    text = answer.strip()
    parts = re.split(r"(?=^#{1,2}\s+)", text, flags=re.MULTILINE)

    if len(parts) <= 1 and not re.match(r"^#{1,2}\s+", text):
        results.extend(_heuristic_split(text))
        if not results:
            agent = "law" if "law agent unavailable" not in text.lower() else "customer"
            results.append(_entry(agent, "Full Response", text))
        results.append(_entry("customer", "Delivered to User", f"Packaged {len(text)} chars.", status="ok"))
        return results

    for part in parts:
        part = part.strip()
        if not part:
            continue
        lines = part.split("\n", 1)
        header = lines[0].lstrip("#").strip()
        body = lines[1].strip() if len(lines) > 1 else ""
        agent_id = _match_agent(header, body)
        status = "error" if _is_unavailable(agent_id, body) else "ok"
        preview = body[:500] + ("…" if len(body) > 500 else "")
        results.append(_entry(agent_id, header, body, preview, status))

    if not results:
        results.append(_entry("customer", "Final Answer", answer.strip()))

    # Customer always delivers the packaged response
    results.append(
        _entry(
            "customer",
            "Delivered to User",
            f"Packaged {len(answer)} chars from orchestrator pipeline.",
            status="ok",
        )
    )
    return results


def _entry(
    agent_id: str,
    title: str,
    content: str,
    preview: str | None = None,
    status: str = "ok",
) -> dict:
    text = content or ""
    return {
        "agent_id": agent_id,
        "title": title,
        "content": text,
        "preview": preview if preview is not None else text[:500],
        "chars": len(text),
        "status": status,
    }


def _match_agent(header: str, body: str) -> str:
    h = header.lower()
    b = body.lower()
    for agent_id, keywords in SECTION_AGENTS:
        if any(kw in h for kw in keywords):
            return agent_id
    if "unavailable" in b:
        for agent_id, patterns in UNAVAILABLE_PATTERNS.items():
            if any(p in b for p in patterns):
                return agent_id
    if "law agent unavailable" in b:
        return "law"
    return "law"


def _heuristic_split(text: str) -> list[dict]:
    """Fallback when LLM drops ## headers — split by known section titles."""
    results: list[dict] = []
    patterns = [
        ("law", r"(?i)(legal analysis|phân tích pháp lý)"),
        ("tax", r"(?i)(tax analysis|phân tích thuế|tax implications)"),
        ("compliance", r"(?i)(regulatory compliance|compliance analysis|tuân thủ)"),
    ]
    for agent_id, pattern in patterns:
        m = re.search(pattern, text)
        if m:
            start = m.start()
            chunk = text[start : start + 1200].strip()
            title = m.group(0).title()
            status = "error" if _is_unavailable(agent_id, chunk) else "ok"
            results.append(_entry(agent_id, title, chunk, status=status))
    return results


def _is_unavailable(agent_id: str, body: str) -> bool:
    b = body.lower()
    for pattern in UNAVAILABLE_PATTERNS.get(agent_id, []):
        if pattern in b:
            return True
    return "unavailable" in b and agent_id in ("tax", "compliance", "law")
