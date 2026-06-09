# Day08 RAG — Đã tích hợp vào project chính

Pipeline RAG từ Day08 đã được chuyển sang:

- `common/rag/` — chunking, embedding, hybrid retrieval (semantic + BM25 + RRF)
- `data/legal/` — corpus pháp lý (markdown)
- `scripts/build_rag_index.py` — build vector index

Chạy index lần đầu:

```bash
uv sync
uv run python scripts/build_rag_index.py
```

Thư mục gốc Day08 (`src/`, `group_project/`, `tests/`, UI React, v.v.) đã được xóa vì không còn cần thiết.
