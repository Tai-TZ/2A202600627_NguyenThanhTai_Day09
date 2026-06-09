"""High-level search API for LangChain tools."""

from __future__ import annotations

from common.rag.retrieval import retrieve


def search_legal_knowledge(query: str, top_k: int = 3) -> str:
    """Search legal knowledge base using hybrid RAG (semantic + BM25).

    Args:
        query: Natural language search query.
        top_k: Number of chunks to return.
    """
    try:
        results = retrieve(query, top_k=top_k)
    except FileNotFoundError:
        return "Knowledge base chưa được index. Chạy: uv run python scripts/build_rag_index.py"

    if not results:
        return "Không tìm thấy thông tin liên quan."

    parts = []
    for i, item in enumerate(results, 1):
        source = item.get("metadata", {}).get("source", "unknown")
        score = item.get("score", 0.0)
        parts.append(f"[{i}] ({source}, score={score:.3f})\n{item['content']}")

    return "\n\n---\n\n".join(parts)
