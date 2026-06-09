# Lab Solution — Day 09

---

## Phần 1: Direct LLM Calling

### Bài 1.1 — Thay đổi câu hỏi

**File:** `stages/stage_1_direct_llm/main.py`

```python
QUESTION = "Hậu quả pháp lý khi công ty vi phạm hợp đồng lao động và sa thải nhân viên không đúng quy trình?"
```

**Chạy:**

```powershell
uv run python stages/stage_1_direct_llm/main.py
```

### Bài 1.2 — Temperature control

**File:** `common/llm.py`

```python
"temperature": 0.3,
```

Giúp output ổn định hơn, giảm hallucination ngẫu nhiên.

---

## Phần 2: LLM + RAG & Tools

### Bài 2.1 — Thêm knowledge base (luật lao động)

**File:** `data/legal/labor_law.md`

Đã thêm corpus markdown với keywords `lao động`, `sa thải`, `hợp đồng lao động`. RAG hybrid (Day08) index file này qua:

```powershell
uv run python scripts/build_rag_index.py
```

Stage 2 dùng `common/rag/search.py` → `search_legal_database()` thay cho `LEGAL_KNOWLEDGE` dict tĩnh.

### Bài 2.2 — Tool `check_statute_of_limitations`

**Files:** `stages/stage_2_rag_tools/main.py`, `exercises/exercise_2_tools.py`

```python
@tool
def check_statute_of_limitations(case_type: str) -> str:
    limits = {
        "contract": "4 năm (UCC § 2-725)",
        "tort": "2-3 năm tùy bang",
        "property": "5 năm",
    }
    return limits.get(case_type.lower(), "Không xác định")
```

**Chạy exercise:**

```powershell
uv run python exercises/exercise_2_tools.py
```

---

## Phần 3: Single Agent (ReAct)

### Bài 3.1 — Tool `search_case_law`

**File:** `stages/stage_3_single_agent/main.py`

```python
@tool
def search_case_law(keywords: str) -> str:
    cases = {
        "breach": "Hadley v. Baxendale (1854) - Consequential damages",
        "negligence": "Donoghue v. Stevenson (1932) - Duty of care",
        "contract": "Carlill v. Carbolic Smoke Ball Co (1893) - Unilateral contract",
    }
    ...
```

Đã thêm vào `TOOLS` list.

### Bài 3.2 — Debug agent reasoning

**File:** `stages/stage_3_single_agent/main.py`

```python
graph = create_react_agent(model=llm, tools=TOOLS, prompt=SYSTEM_PROMPT, debug=True)
```

LangGraph dùng `debug=True` thay cho `verbose=True` của LangChain cũ.

**Chạy:**

```powershell
uv run python stages/stage_3_single_agent/main.py
```

---

## Phần 4: Multi-Agent In-Process

### Bài 4.1 — Privacy Agent

**Files:** `exercises/exercise_4_multiagent.py`, `stages/stage_4_milti_agent/main.py`

- Thêm node `privacy_agent` / `call_privacy_specialist`
- State field: `privacy_analysis` / `privacy_result`
- Aggregate gộp thêm section Privacy & GDPR

### Bài 4.2 — Conditional routing

**File:** `exercises/exercise_4_multiagent.py`

```python
def check_routing(state: State) -> list[Send]:
    question_lower = state["question"].lower()
    tasks = []
    if any(kw in question_lower for kw in ["tax", "irs", "thuế"]):
        tasks.append(Send("tax_agent", state))
    if any(kw in question_lower for kw in ["compliance", "sec", "regulation"]):
        tasks.append(Send("compliance_agent", state))
    if any(kw in question_lower for kw in ["data", "privacy", "gdpr", "dữ liệu"]):
        tasks.append(Send("privacy_agent", state))
    return tasks if tasks else [Send("aggregate_results", state)]
```

Dùng `add_conditional_edges` với `Send` API để chạy song song.

**Chạy:**

```powershell
uv run python exercises/exercise_4_multiagent.py
uv run python stages/stage_4_milti_agent/main.py
```

---

## Phần 5: Distributed A2A System

### Khởi động & test

```powershell
.\start_all.ps1
uv run python test_client.py
```

### Bài 5.1 — Trace request flow

Trong log các agent, tìm `trace_id` (UUID) xuất hiện xuyên suốt:

```
CustomerAgent executing | trace=<uuid>
Law Agent ... | trace=<uuid>
Tax Agent ... | trace=<uuid>
```

Sequence diagram ghi trong [LATENCY_REPORT.md](LATENCY_REPORT.md) §5.

### Bài 5.2 — Test dynamic discovery / agent shutdown

1. Dừng Tax Agent (Ctrl+C)
2. Chạy `test_client.py` hoặc gửi câu hỏi qua UI
3. Hệ thống trả **degraded response** — thiếu phần Tax, có message:
  `[Tax analysis unavailable: ...]`

Chi tiết: [LATENCY_REPORT.md](LATENCY_REPORT.md) §6.

### Bài 5.3 — Modify Tax Agent prompt

**File:** `tax_agent/graph.py`

```python
Keep your response concise — under 150 words. Use bullet points when listing penalties.
```

Restart Tax Agent sau khi sửa prompt.

---

## Bài Tập Cộng Điểm

### 1. UI demo Agent flow (Stage 5)

**Folder:** `ui/` — A2A Flow Demo tại `http://localhost:5173`

```powershell
.\start_ui.ps1
```

Hiển thị: topology graph, message log, Agent Results, health check.

### 2. Latency report

**File:** [LATENCY_REPORT.md](LATENCY_REPORT.md)


| Mode      | Latency                   |
| --------- | ------------------------- |
| Baseline  | ~60–68s                   |
| Optimized | **42.17s** (~30–38% giảm) |


3 tối ưu: Fast delegate, Keyword routing, `max_tokens=800`.