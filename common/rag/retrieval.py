"""Hybrid retrieval: semantic + BM25 + RRF + rerank (from Day08 Tasks 5–7, 9)."""

from __future__ import annotations

from functools import lru_cache

import numpy as np
from rank_bm25 import BM25Okapi

from common.rag.index import embed_query, ensure_local_index, get_embedding_model, search_by_embedding

DEFAULT_TOP_K = 5


def _tokenize(text: str) -> list[str]:
    return text.lower().split()


def semantic_search(query: str, top_k: int = 10) -> list[dict]:
    return search_by_embedding(embed_query(query), top_k=top_k)


@lru_cache(maxsize=1)
def _get_bm25():
    corpus = ensure_local_index()
    tokenized = [_tokenize(doc["content"]) for doc in corpus]
    return BM25Okapi(tokenized), corpus


def lexical_search(query: str, top_k: int = 10) -> list[dict]:
    if not query.strip() or top_k <= 0:
        return []

    bm25, corpus = _get_bm25()
    if not corpus:
        return []

    scores = bm25.get_scores(_tokenize(query))
    results = []
    for idx in np.argsort(scores)[::-1][:top_k]:
        score = float(scores[idx])
        if score <= 0:
            continue
        doc = corpus[int(idx)]
        results.append({
            "content": doc["content"],
            "score": score,
            "metadata": doc.get("metadata", {}),
        })
    return results


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def rerank_rrf(ranked_lists: list[list[dict]], top_k: int = 5, k: int = 60) -> list[dict]:
    rrf_scores: dict[str, float] = {}
    content_map: dict[str, dict] = {}

    for ranked_list in ranked_lists:
        for rank, item in enumerate(ranked_list, 1):
            key = item["content"]
            rrf_scores[key] = rrf_scores.get(key, 0.0) + 1.0 / (k + rank)
            content_map[key] = item

    results = []
    for content, score in sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]:
        item = content_map[content].copy()
        item["score"] = score
        results.append(item)
    return results


def rerank_cross_encoder(query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
    if not candidates:
        return []

    model = get_embedding_model()
    query_embedding = model.encode(query, normalize_embeddings=True).tolist()

    scored = []
    for candidate in candidates:
        doc_embedding = model.encode(
            candidate["content"], normalize_embeddings=True
        ).tolist()
        item = candidate.copy()
        item["score"] = _cosine_similarity(query_embedding, doc_embedding)
        scored.append(item)

    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:top_k]


def retrieve(query: str, top_k: int = DEFAULT_TOP_K) -> list[dict]:
    """Hybrid retrieval pipeline: dense + BM25 → RRF → cross-encoder rerank."""
    dense_results = semantic_search(query, top_k=top_k * 2)
    sparse_results = lexical_search(query, top_k=top_k * 2)

    merged = rerank_rrf([dense_results, sparse_results], top_k=top_k * 2)
    if merged:
        return rerank_cross_encoder(query, merged, top_k=top_k)
    return merged
