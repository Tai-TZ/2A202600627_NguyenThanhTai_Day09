"""Supervisor routing — chọn workers cần gọi dựa trên từ khóa câu hỏi."""

from __future__ import annotations

CONTRACT_KEYWORDS = (
    "contract",
    "breach",
    "hợp đồng",
    "vi phạm",
    "nda",
    "damages",
    "ucc",
    "lao động",
    "sa thải",
    "termination",
)

COMPLIANCE_KEYWORDS = (
    "tax",
    "irs",
    "thuế",
    "compliance",
    "sec",
    "sox",
    "fcpa",
    "gdpr",
    "privacy",
    "data",
    "dữ liệu",
    "regulation",
    "aml",
)


def detect_workers(question: str) -> dict[str, bool]:
    """Supervisor quyết định workers nào cần chạy (ngoài RAG worker luôn chạy)."""
    q = question.lower()
    needs_contract = any(kw in q for kw in CONTRACT_KEYWORDS)
    needs_compliance = any(kw in q for kw in COMPLIANCE_KEYWORDS)

    # Câu hỏi chung chung → gọi cả hai workers
    if not needs_contract and not needs_compliance:
        needs_contract = True
        needs_compliance = True

    return {
        "needs_contract": needs_contract,
        "needs_compliance": needs_compliance,
    }
