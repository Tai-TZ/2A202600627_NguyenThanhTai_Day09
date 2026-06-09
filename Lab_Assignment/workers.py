"""Worker nodes — mỗi worker một chuyên môn, được Supervisor điều phối."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from common.llm import get_llm
from common.rag.search import search_legal_knowledge

STATUTE_LIMITS = {
    "contract": "4 năm (UCC § 2-725)",
    "tort": "2-3 năm tùy bang",
    "property": "5 năm",
}


def _detect_case_type(question: str) -> str:
    q = question.lower()
    if any(kw in q for kw in ("contract", "hợp đồng", "breach", "nda", "ucc")):
        return "contract"
    if any(kw in q for kw in ("tort", "negligence", "liability")):
        return "tort"
    if any(kw in q for kw in ("property", "real estate", "tài sản")):
        return "property"
    return "contract"


async def rag_worker(state: dict) -> dict:
    """Worker 1: Hybrid RAG retrieval (Day08 pipeline)."""
    question = state["question"]
    context = search_legal_knowledge(question, top_k=4)
    case_type = _detect_case_type(question)
    statute = STATUTE_LIMITS.get(case_type, "Không xác định")

    return {
        "rag_context": context,
        "statute_info": f"Loại vụ án: {case_type} — Thời hiệu: {statute}",
    }


async def contract_worker(state: dict) -> dict:
    """Worker 2: Phân tích hợp đồng, trách nhiệm dân sự, lao động."""
    llm = get_llm()
    prompt = f"""Bạn là luật sư chuyên hợp đồng và trách nhiệm dân sự.

Câu hỏi: {state['question']}

Ngữ cảnh RAG (Day08 knowledge base):
{state.get('rag_context', 'N/A')}

Thời hiệu khởi kiện: {state.get('statute_info', 'N/A')}

Phân tích ngắn gọn: vi phạm, bồi thường, remedies, rủi ro pháp lý."""

    result = await llm.ainvoke([HumanMessage(content=prompt)])
    return {"contract_analysis": result.content}


async def compliance_worker(state: dict) -> dict:
    """Worker 3: Phân tích thuế, SEC, GDPR, SOX, AML."""
    llm = get_llm()
    prompt = f"""Bạn là chuyên gia compliance và thuế doanh nghiệp.

Câu hỏi: {state['question']}

Ngữ cảnh RAG (Day08 knowledge base):
{state.get('rag_context', 'N/A')}

Phân tích ngắn gọn: nghĩa vụ tuân thủ, mức phạt, cơ quan giám sát (IRS, SEC, FTC)."""

    result = await llm.ainvoke([
        SystemMessage(content="Trả lời súc tích, dùng bullet points khi liệt kê penalties."),
        HumanMessage(content=prompt),
    ])
    return {"compliance_analysis": result.content}
