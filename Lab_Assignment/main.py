"""Lab Assignment — Day08 RAG agent nâng cấp Supervisor–Workers.

Chạy:
    uv run python Lab_Assignment/main.py
"""

from __future__ import annotations

import asyncio
import os
import sys

# Project root on sys.path
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from dotenv import load_dotenv

from Lab_Assignment.supervisor_graph import build_graph

QUESTION = (
    "Công ty vi phạm NDA và trốn thuế, đồng thời rò rỉ dữ liệu khách hàng — "
    "hậu quả pháp lý và thời hiệu khởi kiện là gì?"
)


async def main() -> None:
    load_dotenv()

    print("=" * 70)
    print("LAB ASSIGNMENT: Day08 RAG → Supervisor–Workers (3 workers)")
    print("=" * 70)
    print()
    print("Workers:")
    print("  1. RAG Worker        — hybrid retrieval (Day08)")
    print("  2. Contract Worker   — hợp đồng, trách nhiệm, thời hiệu")
    print("  3. Compliance Worker — thuế, SEC, GDPR (song song)")
    print()
    print(f"Câu hỏi: {QUESTION}")
    print()
    print("Đang xử lý...\n")

    graph = build_graph()
    result = await graph.ainvoke({
        "question": QUESTION,
        "needs_contract": False,
        "needs_compliance": False,
        "rag_context": "",
        "statute_info": "",
        "contract_analysis": "",
        "compliance_analysis": "",
        "final_answer": "",
    })

    print("=" * 70)
    print("KẾT QUẢ (Supervisor aggregate)")
    print("=" * 70)
    print(result["final_answer"])
    print()
    print("—" * 70)
    print("Worker outputs:")
    if result.get("rag_context"):
        print(f"\n[RAG Worker] {len(result['rag_context'])} chars retrieved")
    if result.get("contract_analysis"):
        print(f"[Contract Worker] {len(result['contract_analysis'])} chars")
    if result.get("compliance_analysis"):
        print(f"[Compliance Worker] {len(result['compliance_analysis'])} chars")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
