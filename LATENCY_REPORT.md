# Báo Cáo Latency — Stage 5 (Bài Tập Cộng Điểm)

**Sinh viên:** NguyenThanhTai (2A202600627)  
**Model:** `openai/gpt-4o-mini` (OpenRouter)

## 1. Latency baseline (trước tối ưu)

| Metric | Giá trị |
|--------|---------|
| Tổng thời gian 1 câu hỏi | **~60–68 giây** |
| Công cụ đo | `uv run python test_client.py` |

**Chuỗi LLM calls (baseline):**

```
User → Customer ReAct (1 LLM) → delegate
     → Law analyze_law (1 LLM)
     → Law check_routing LLM (1 LLM)
     → Tax + Compliance song song (2 LLM)
     → Law aggregate (1 LLM)
≈ 6 round-trips tuần tự (+ 1 song song)
```

## 2. Phương án giảm latency đã áp dụng

| # | Tối ưu | File | Tiết kiệm ước tính |
|---|--------|------|-------------------|
| 1 | **Fast delegate** — Customer Agent gọi thẳng Law Agent, bỏ ReAct loop | `customer_agent/agent_executor.py` | ~8–15s |
| 2 | **Keyword routing** — bỏ LLM routing call ở Law Agent | `law_agent/graph.py`, `common/routing.py` | ~8–12s |
| 3 | **max_tokens=800** — giới hạn độ dài response | `common/llm.py` | ~5–10s |

**Env vars:**

```powershell
$env:USE_FAST_DELEGATE = "true"      # mặc định: true
$env:USE_KEYWORD_ROUTING = "true"    # mặc định: true
```

## 3. Cách đo lại (demo before/after)

```powershell
cd "C:\Users\Tai\Desktop\AI-in-Action\Lesson PDF Daily\Day 9\Project Demo\2A202600627_NguyenThanhTai_Day09"
$env:PYTHONIOENCODING = "utf-8"

# --- BASELINE ---
$env:USE_FAST_DELEGATE = "false"
$env:USE_KEYWORD_ROUTING = "false"
.\start_all.ps1
uv run python scripts/benchmark_latency.py --mode baseline

# --- OPTIMIZED ---
$env:USE_FAST_DELEGATE = "true"
$env:USE_KEYWORD_ROUTING = "true"
.\start_all.ps1
uv run python scripts/benchmark_latency.py --mode optimized
```

## 4. Kết quả sau tối ưu

| Mode | Latency | Giảm |
|------|---------|------|
| Baseline | ~60–68s | — |
| **Optimized** | **42.17s** (đo 09/06/2026) | **~30–38%** |

Đo bằng: `uv run python scripts/benchmark_latency.py --mode optimized`

## 5. Trace request flow (Bài tập 5.1)

Trong log các agent, tìm `trace_id` (UUID) xuất hiện ở mọi service:

```
CustomerAgent executing | trace=<uuid>
Customer delegate_to_legal_agent | trace=<uuid>
Law Agent ... | trace=<uuid>
Tax Agent ... | trace=<uuid>
```

**Sequence diagram:**

```
User → Customer (10100) → Law (10101) → Tax (10102) ─┐
                              │                        ├ parallel
                              └────────→ Compliance (10103) ─┘
                              → aggregate → response
```

## 6. Test dynamic discovery / agent shutdown (Bài tập 5.2)

1. Dừng Tax Agent (Ctrl+C terminal tax agent)
2. UI sẽ hiện **Tax offline** (đỏ) trên graph — `GET /api/agents/status`
3. Chạy `uv run python test_client.py` hoặc gửi câu hỏi trên UI
4. Kết quả: **degraded response** — Law vẫn trả lời, thiếu phần Tax:
   `[Tax analysis unavailable: connection refused — Tax Agent may be shut down]`
5. Tương tự nếu dừng Law Agent → Customer trả `Law Agent Unavailable`
