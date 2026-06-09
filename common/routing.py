"""Keyword-based specialist routing — faster than an extra LLM routing call."""

from __future__ import annotations

TAX_KEYWORDS = ("tax", "irs", "thuế", "evasion", "fbar", "fatca", "vat")
COMPLIANCE_KEYWORDS = (
    "compliance",
    "sec",
    "regulation",
    "sox",
    "fcpa",
    "aml",
    "regulatory",
    "tuân thủ",
)
PRIVACY_KEYWORDS = ("data", "privacy", "gdpr", "dữ liệu", "breach", "leak", "ccpa")


def detect_specialists(question: str) -> dict[str, bool]:
    """Return which specialist agents are needed for a question."""
    q = question.lower()
    return {
        "needs_tax": any(kw in q for kw in TAX_KEYWORDS),
        "needs_compliance": any(kw in q for kw in COMPLIANCE_KEYWORDS),
        "needs_privacy": any(kw in q for kw in PRIVACY_KEYWORDS),
    }
