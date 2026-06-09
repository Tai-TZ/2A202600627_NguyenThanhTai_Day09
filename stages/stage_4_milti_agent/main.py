"""Stage 4: Multi-Agent System (In-Process)

Multiple specialised agents collaborate on a complex legal question.
This mirrors Stage 5's architecture (law_agent/graph.py) but runs
entirely in-process — no HTTP, no A2A protocol, no separate servers.

Graph: analyze_law -> route (keyword) -> parallel [tax, compliance, privacy] -> aggregate -> END
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from common.llm import get_llm
from common.routing import detect_specialists

# ---------------------------------------------------------------------------
# Tools for specialist sub-agents
# ---------------------------------------------------------------------------

@tool
def search_tax_law(query: str) -> str:
    """Search tax law knowledge base for relevant statutes and penalties.

    Args:
        query: Natural language query about tax law.
    """
    knowledge = [
        (
            ["tax", "evasion", "fraud", "irs"],
            "Tax evasion (26 U.S.C. § 7201): felony, up to $250K fine and 5 years prison. "
            "Civil fraud penalty: 75% of underpayment (IRC § 6663). Failure to file: up to "
            "$25K fine and 1 year prison.",
        ),
        (
            ["offshore", "overseas", "foreign", "fbar", "fatca"],
            "FBAR penalties: up to $100K or 50% of account balance per violation. "
            "FATCA non-compliance: 30% withholding on US-source payments. "
            "Willful violations may trigger criminal prosecution.",
        ),
        (
            ["transfer", "pricing", "corporate"],
            "Transfer pricing violations (IRC § 482): IRS can reallocate income between "
            "related entities. Penalties: 20-40% of underpayment for substantial/gross "
            "valuation misstatements.",
        ),
    ]
    query_lower = query.lower()
    results = []
    for keywords, text in knowledge:
        if any(kw in query_lower for kw in keywords):
            results.append(text)
    return "\n\n".join(results) if results else "No specific tax law matches found."


@tool
def search_compliance_law(query: str) -> str:
    """Search regulatory compliance knowledge base for applicable frameworks.

    Args:
        query: Natural language query about regulatory compliance.
    """
    knowledge = [
        (
            ["data", "privacy", "gdpr", "ccpa", "consent", "user"],
            "CCPA: fines up to $7,500 per intentional violation. GDPR: up to 4% of global "
            "revenue or EUR 20M. FTC Act Section 5 for unfair/deceptive practices. "
            "Class action exposure under state privacy laws ($100-$750 per consumer).",
        ),
        (
            ["sox", "sarbanes", "financial", "sec", "reporting"],
            "SOX § 906: false certification — up to $5M fine, 20 years prison. "
            "§ 802: record destruction — up to 20 years. § 1107: whistleblower "
            "retaliation — up to 10 years. SEC officer/director bars.",
        ),
        (
            ["fcpa", "bribery", "corruption", "foreign"],
            "FCPA anti-bribery: up to $250K fine per violation (individuals), "
            "$2M (corporations). Criminal penalties: up to 5 years prison. "
            "Books and records provisions apply to all SEC-reporting companies.",
        ),
    ]
    query_lower = query.lower()
    results = []
    for keywords, text in knowledge:
        if any(kw in query_lower for kw in keywords):
            results.append(text)
    return "\n\n".join(results) if results else "No specific compliance matches found."


# ---------------------------------------------------------------------------
# State definition (mirrors law_agent/graph.py)
# ---------------------------------------------------------------------------

from typing import Annotated, TypedDict

from langgraph.constants import Send
from langgraph.graph import END, StateGraph


def _last_wins(a: str, b: str) -> str:
    """Reducer: keep the most recently written value."""
    return b if b else a


class LegalState(TypedDict):
    question: str
    law_analysis: str
    tax_result: Annotated[str, _last_wins]
    compliance_result: Annotated[str, _last_wins]
    privacy_result: Annotated[str, _last_wins]
    final_answer: str


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------

async def analyze_law(state: LegalState) -> dict:
    """Lead attorney analyses the legal aspects of the question."""
    print("\n  [Node: analyze_law] Lead attorney analysing legal aspects...")
    llm = get_llm()
    messages = [
        SystemMessage(
            content=(
                "You are a senior corporate litigation attorney specialising in contract law, "
                "tort law, and general business law. Analyse the legal aspects of the question "
                "thoroughly. Keep your analysis under 200 words."
            )
        ),
        HumanMessage(content=state["question"]),
    ]
    result = await llm.ainvoke(messages)
    print(f"  [Node: analyze_law] Done ({len(result.content)} chars)")
    return {"law_analysis": result.content}


def route_to_specialists(state: LegalState) -> list[Send]:
    """Keyword routing — dispatch parallel Send objects (CODELAB 4.2)."""
    flags = detect_specialists(state["question"])
    sends: list[Send] = []

    if flags["needs_tax"]:
        sends.append(Send("call_tax_specialist", state))
    if flags["needs_compliance"]:
        sends.append(Send("call_compliance_specialist", state))
    if flags["needs_privacy"]:
        sends.append(Send("call_privacy_specialist", state))

    print(
        "\n  [Route] tax=%s compliance=%s privacy=%s"
        % (flags["needs_tax"], flags["needs_compliance"], flags["needs_privacy"])
    )
    return sends if sends else [Send("aggregate", state)]


async def call_tax_specialist(state: LegalState) -> dict:
    """Tax specialist — single LLM call with grounded tool context."""
    print("\n  [Node: call_tax_specialist] Tax specialist agent starting...")
    llm = get_llm()
    context = search_tax_law.invoke({"query": state["question"]})
    messages = [
        SystemMessage(
            content=(
                "You are a specialist tax attorney. Use the reference material below. "
                "Keep your response under 150 words."
            )
        ),
        HumanMessage(content=f"Question: {state['question']}\n\nReference:\n{context}"),
    ]
    result = await llm.ainvoke(messages)
    print(f"  [Node: call_tax_specialist] Done ({len(result.content)} chars)")
    return {"tax_result": result.content}


async def call_compliance_specialist(state: LegalState) -> dict:
    """Compliance specialist — single LLM call with grounded tool context."""
    print("\n  [Node: call_compliance_specialist] Compliance specialist agent starting...")
    llm = get_llm()
    context = search_compliance_law.invoke({"query": state["question"]})
    messages = [
        SystemMessage(
            content=(
                "You are a senior regulatory compliance officer. Use the reference material below. "
                "Keep your response under 150 words."
            )
        ),
        HumanMessage(content=f"Question: {state['question']}\n\nReference:\n{context}"),
    ]
    result = await llm.ainvoke(messages)
    print(f"  [Node: call_compliance_specialist] Done ({len(result.content)} chars)")
    return {"compliance_result": result.content}


async def call_privacy_specialist(state: LegalState) -> dict:
    """Privacy specialist — CODELAB 4.1 privacy_agent."""
    print("\n  [Node: call_privacy_specialist] Privacy specialist agent starting...")
    llm = get_llm()
    messages = [
        SystemMessage(
            content=(
                "You are a GDPR and data-privacy specialist. Analyse privacy and data-protection "
                "issues. Keep your response under 150 words."
            )
        ),
        HumanMessage(
            content=(
                f"Question: {state['question']}\n"
                f"Legal context: {state.get('law_analysis', 'N/A')}"
            )
        ),
    ]
    result = await llm.ainvoke(messages)
    print(f"  [Node: call_privacy_specialist] Done ({len(result.content)} chars)")
    return {"privacy_result": result.content}


async def aggregate(state: LegalState) -> dict:
    """Combine all specialist analyses into a final comprehensive answer."""
    print("\n  [Node: aggregate] Combining all specialist analyses...")
    llm = get_llm()

    sections: list[str] = []
    if state.get("law_analysis"):
        sections.append(f"## Legal Analysis\n{state['law_analysis']}")
    if state.get("tax_result"):
        sections.append(f"## Tax Analysis\n{state['tax_result']}")
    if state.get("compliance_result"):
        sections.append(f"## Regulatory Compliance Analysis\n{state['compliance_result']}")
    if state.get("privacy_result"):
        sections.append(f"## Privacy & GDPR Analysis\n{state['privacy_result']}")

    combined = "\n\n---\n\n".join(sections)

    messages = [
        SystemMessage(
            content=(
                "You are a senior legal counsel synthesising specialist analyses into a "
                "comprehensive, well-structured response. Combine the following analyses "
                "into a cohesive answer with clear sections. Avoid redundancy. "
                "Keep your response under 500 words."
            )
        ),
        HumanMessage(content=combined),
    ]
    result = await llm.ainvoke(messages)
    print(f"  [Node: aggregate] Done ({len(result.content)} chars)")
    return {"final_answer": result.content}


# ---------------------------------------------------------------------------
# Graph construction (mirrors law_agent/graph.py topology)
# ---------------------------------------------------------------------------

def create_graph():
    """Build and compile the multi-agent StateGraph."""
    graph = StateGraph(LegalState)

    graph.add_node("analyze_law", analyze_law)
    graph.add_node("call_tax_specialist", call_tax_specialist)
    graph.add_node("call_compliance_specialist", call_compliance_specialist)
    graph.add_node("call_privacy_specialist", call_privacy_specialist)
    graph.add_node("aggregate", aggregate)

    graph.set_entry_point("analyze_law")
    graph.add_conditional_edges(
        "analyze_law",
        route_to_specialists,
        [
            "call_tax_specialist",
            "call_compliance_specialist",
            "call_privacy_specialist",
            "aggregate",
        ],
    )
    graph.add_edge("call_tax_specialist", "aggregate")
    graph.add_edge("call_compliance_specialist", "aggregate")
    graph.add_edge("call_privacy_specialist", "aggregate")
    graph.add_edge("aggregate", END)

    return graph.compile()


QUESTION = "If a company breaks a contract and avoids taxes, what are the legal and regulatory consequences?"


async def main():
    print("=" * 70)
    print("STAGE 4: Multi-Agent System (In-Process)")
    print("=" * 70)
    print()
    print("[How it works]")
    print("  1. Lead attorney agent analyses the question")
    print("  2. Keyword router decides which specialist agents are needed")
    print("  3. Tax + Compliance + Privacy specialists run IN PARALLEL (Send API)")
    print("  4. Aggregator combines all analyses into a final answer")
    print()
    print("[Graph topology]")
    print("  analyze_law -> route -> [tax + compliance + privacy] -> aggregate -> END")
    print()
    print(f"Question: {QUESTION}")
    print("-" * 70)

    graph = create_graph()

    result = await graph.ainvoke({
        "question": QUESTION,
        "law_analysis": "",
        "tax_result": "",
        "compliance_result": "",
        "privacy_result": "",
        "final_answer": "",
    })

    print("\n" + "=" * 70)
    print("FINAL ANSWER")
    print("=" * 70)
    print(result["final_answer"])

    print()
    print("-" * 70)
    print("[Improvements over Stage 3]")
    print("  + Specialisation: each agent has domain-specific expertise")
    print("  + Parallel execution: tax + compliance agents run concurrently")
    print("  + Better quality: specialist prompts produce deeper analysis")
    print("  + Structured flow: explicit graph topology with routing logic")
    print()
    print("[Stage 4 (Monolith) vs Stage 5 (Distributed A2A)]")
    print("  +---------------------------+-------------------------------+")
    print("  | Stage 4 (In-Process)      | Stage 5 (A2A Protocol)        |")
    print("  +---------------------------+-------------------------------+")
    print("  | Single process            | Multiple services (ports)     |")
    print("  | Direct function calls     | HTTP-based A2A protocol       |")
    print("  | Shared memory             | Message passing               |")
    print("  | Simple deployment         | Independent scaling           |")
    print("  | Tight coupling            | Loose coupling                |")
    print("  | Easy to debug             | Service discovery + registry  |")
    print("  | Good for small teams      | Good for large organisations  |")
    print("  +---------------------------+-------------------------------+")
    print()
    print("Stage 5 (this repo's main project) takes this same graph topology")
    print("and deploys each agent as an independent A2A service. Run it with:")
    print("  ./start_all.sh && python test_client.py")
    print("=" * 70)


if __name__ == "__main__":
    load_dotenv()
    asyncio.run(main())