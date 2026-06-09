"""Chunking, embedding, and local vector index (from Day08 Task 4 + local_index)."""

from __future__ import annotations

import pickle
from functools import lru_cache
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
LEGAL_DATA_DIR = PROJECT_ROOT / "data" / "legal"
INDEX_DIR = PROJECT_ROOT / "data" / "index"
INDEX_PATH = INDEX_DIR / "chunks.pkl"

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def load_documents() -> list[dict]:
    """Load markdown legal documents from data/legal/."""
    documents = []
    if not LEGAL_DATA_DIR.exists():
        return documents

    for md_file in sorted(LEGAL_DATA_DIR.rglob("*.md")):
        content = md_file.read_text(encoding="utf-8").strip()
        if not content:
            continue
        documents.append({
            "content": content,
            "metadata": {
                "source": md_file.stem,
                "type": "legal",
                "path": str(md_file.relative_to(LEGAL_DATA_DIR)),
            },
        })
    return documents


def chunk_documents(documents: list[dict]) -> list[dict]:
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = []
    for doc in documents:
        for i, chunk_text in enumerate(splitter.split_text(doc["content"])):
            if not chunk_text.strip():
                continue
            chunks.append({
                "content": chunk_text,
                "metadata": {**doc["metadata"], "chunk_index": i},
            })
    return chunks


@lru_cache(maxsize=1)
def get_embedding_model():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(EMBEDDING_MODEL)


def embed_chunks(chunks: list[dict]) -> list[dict]:
    if not chunks:
        return chunks

    model = get_embedding_model()
    texts = [c["content"] for c in chunks]
    embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
    for chunk, emb in zip(chunks, embeddings):
        chunk["embedding"] = emb.tolist()
    return chunks


def save_local_index(chunks: list[dict]) -> None:
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    with INDEX_PATH.open("wb") as f:
        pickle.dump(chunks, f)


def load_local_index() -> list[dict] | None:
    if not INDEX_PATH.exists():
        return None
    with INDEX_PATH.open("rb") as f:
        return pickle.load(f)


def build_index() -> list[dict]:
    """Load docs → chunk → embed → save. Returns indexed chunks."""
    docs = load_documents()
    if not docs:
        raise FileNotFoundError(f"No markdown files found in {LEGAL_DATA_DIR}")

    chunks = embed_chunks(chunk_documents(docs))
    save_local_index(chunks)
    return chunks


def ensure_local_index() -> list[dict]:
    cached = load_local_index()
    if cached:
        return cached
    return build_index()


def embed_query(query: str) -> list[float]:
    model = get_embedding_model()
    return model.encode(query, normalize_embeddings=True).tolist()


def search_by_embedding(query_embedding: list[float], top_k: int = 10) -> list[dict]:
    chunks = ensure_local_index()
    if not chunks:
        return []

    matrix = np.array([c["embedding"] for c in chunks], dtype=np.float32)
    query = np.array(query_embedding, dtype=np.float32)
    scores = matrix @ query

    results = []
    for idx in np.argsort(scores)[::-1][:top_k]:
        chunk = chunks[int(idx)]
        results.append({
            "content": chunk["content"],
            "score": float(scores[idx]),
            "metadata": chunk.get("metadata", {}),
        })
    return results
