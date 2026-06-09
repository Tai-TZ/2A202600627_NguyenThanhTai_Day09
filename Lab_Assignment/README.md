# Lab Assignment — Cải tiến Agent Day08 với Supervisor–Workers

**Sinh viên:** NguyenThanhTai (2A202600627)

## Bối cảnh

**Day08 (trước):** Một agent đơn lẻ gọi RAG hybrid (semantic + BM25 + RRF) rồi LLM trả lời — tất cả trong một luồng tuần tự.

**Day09 Lab Assignment (sau):** Tách thành **Supervisor** điều phối **3 Workers** chuyên môn:

```
User Question
      │
      ▼
┌─────────────┐
│  SUPERVISOR │  keyword routing → chọn workers
└──────┬──────┘
       │
       ├──► RAG Worker        (luôn chạy — hybrid retrieval Day08)
       │
       ├──► Contract Worker   (song song) — phân tích hợp đồng/trách nhiệm
       │
       └──► Compliance Worker (song song) — thuế, SEC, GDPR, SOX
       │
       ▼
┌─────────────┐
│  SUPERVISOR │  aggregate → báo cáo cuối
│  (synthesis)│
└─────────────┘
```

## Cấu trúc thư mục

```
Lab_Assignment/
├── README.md           # Tài liệu này
├── main.py             # Entry point
├── supervisor_graph.py # LangGraph StateGraph
├── workers.py          # 3 worker nodes
└── routing.py          # Keyword routing cho supervisor
```

## Yêu cầu

- Python 3.11+, `uv sync`
- File `.env` với `OPENROUTER_API_KEY`
- RAG index đã build: `uv run python scripts/build_rag_index.py`

## Chạy

```powershell
cd "C:\Users\Tai\Desktop\AI-in-Action\Lesson PDF Daily\Day 9\Project Demo\2A202600627_NguyenThanhTai_Day09"
uv run python Lab_Assignment/main.py
```

## So sánh Day08 vs Supervisor–Workers

| Tiêu chí | Day08 (single agent) | Lab Assignment |
|----------|---------------------|----------------|
| Kiến trúc | 1 agent, 1 luồng | Supervisor + 3 workers |
| RAG | Gọi trực tiếp trong agent | **RAG Worker** riêng |
| Phân tích pháp lý | LLM tổng hợp mọi thứ | **Contract Worker** chuyên sâu |
| Compliance/Thuế | Trộn trong prompt | **Compliance Worker** song song |
| Mở rộng | Khó thêm domain mới | Thêm worker + routing keyword |
| Parallel | Không | `Send` API — workers chạy đồng thời |

## Pattern Supervisor–Workers

- **Supervisor** (`supervisor_route`, `supervisor_aggregate`): quyết định gọi worker nào và tổng hợp kết quả.
- **Workers** (`rag_worker`, `contract_worker`, `compliance_worker`): mỗi worker một nhiệm vụ, không biết workers khác.
- **Routing** (`routing.py`): keyword-based, không cần thêm LLM call → nhanh hơn Day08 single-agent loop.
