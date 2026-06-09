"""Supervisor–Workers graph — cải tiến Day08 RAG agent.

Topology:
    supervisor_route → rag_worker → dispatch_workers → [contract_worker, compliance_worker] (parallel)
    → supervisor_aggregate → END
"""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.constants import Send
from langgraph.graph import END, START, StateGraph

from common.llm import get_llm

from Lab_Assignment.routing import detect_workers
from Lab_Assignment.workers import compliance_worker, contract_worker, rag_worker


def _last_wins(left: str | None, right: str | None) -> str:
    return right if right is not None else (left or "")


class SupervisorState(TypedDict):
    question: str
    needs_contract: bool
    needs_compliance: bool
    rag_context: str
    statute_info: str
    contract_analysis: Annotated[str, _last_wins]
    compliance_analysis: Annotated[str, _last_wins]
    final_answer: str


async def supervisor_route(state: SupervisorState) -> dict:
    """Supervisor: phân tích câu hỏi, quyết định workers cần gọi."""
    flags = detect_workers(state["question"])
    return {
        "needs_contract": flags["needs_contract"],
        "needs_compliance": flags["needs_compliance"],
    }


def dispatch_workers(state: SupervisorState) -> list[Send]:
    """Sau RAG worker, supervisor dispatch contract/compliance song song."""
    sends: list[Send] = []
    if state.get("needs_contract"):
        sends.append(Send("contract_worker", state))
    if state.get("needs_compliance"):
        sends.append(Send("compliance_worker", state))
    if not sends:
        sends.append(Send("supervisor_aggregate", state))
    return sends


async def supervisor_aggregate(state: SupervisorState) -> dict:
    """Supervisor: tổng hợp kết quả từ tất cả workers."""
    llm = get_llm()

    sections = []
    if state.get("rag_context"):
        sections.append(f"## RAG Context (Day08)\n{state['rag_context']}")
    if state.get("statute_info"):
        sections.append(f"## Thời hiệu khởi kiện\n{state['statute_info']}")
    if state.get("contract_analysis"):
        sections.append(f"## Phân tích hợp đồng & trách nhiệm\n{state['contract_analysis']}")
    if state.get("compliance_analysis"):
        sections.append(f"## Phân tích tuân thủ & thuế\n{state['compliance_analysis']}")

    combined = "\n\n".join(sections)
    messages = [
        SystemMessage(
            content=(
                "Bạn là Supervisor tổng hợp báo cáo pháp lý từ các workers. "
                "Giữ cấu trúc rõ ràng, tránh lặp. Kết thúc bằng disclaimer giáo dục."
            )
        ),
        HumanMessage(
            content=f"Câu hỏi gốc: {state['question']}\n\n{combined}"
        ),
    ]
    result = await llm.ainvoke(messages)
    return {"final_answer": result.content}


def build_graph():
    graph = StateGraph(SupervisorState)

    graph.add_node("supervisor_route", supervisor_route)
    graph.add_node("rag_worker", rag_worker)
    graph.add_node("contract_worker", contract_worker)
    graph.add_node("compliance_worker", compliance_worker)
    graph.add_node("supervisor_aggregate", supervisor_aggregate)

    graph.add_edge(START, "supervisor_route")
    graph.add_edge("supervisor_route", "rag_worker")
    graph.add_conditional_edges(
        "rag_worker",
        dispatch_workers,
        ["contract_worker", "compliance_worker", "supervisor_aggregate"],
    )
    graph.add_edge("contract_worker", "supervisor_aggregate")
    graph.add_edge("compliance_worker", "supervisor_aggregate")
    graph.add_edge("supervisor_aggregate", END)

    return graph.compile()
