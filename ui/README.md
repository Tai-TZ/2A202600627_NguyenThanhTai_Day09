# A2A Agent Flow Demo (Stage 5)

Giao diện Vite demo **tương tác giữa các agents** trong hệ thống phân tán Stage 5.

## Tính năng

- **Topology graph** — SVG hiển thị User, Registry, Customer, Law, Tax, Compliance
- **Animated edges** — packet chạy dọc đường khi message đang truyền (HTTP / A2A)
- **A2A message log** — log thời gian thực từng bước giao tiếp
- **Chat thật** — gọi pipeline Stage 5 qua Gateway, hiển thị latency + câu trả lời

## Chạy

**Terminal 1** — Agents + Gateway:

```powershell
.\start_all.ps1
```

**Terminal 2** — UI:

```powershell
.\start_ui.ps1
```

Mở **http://localhost:5173/** → nhấn **Send & visualize**.

## Kiến trúc

```
Browser ──HTTP──► Gateway :10200 ──SSE /api/chat/stream──►
                        │
                        └──A2A──► Customer :10100
                                      │
                                      ├──HTTP──► Registry :10000
                                      └──A2A──► Law :10101
                                                    ├──A2A──► Tax :10102  (parallel)
                                                    └──A2A──► Compliance :10103
```

## API

| Endpoint | Mô tả |
|----------|--------|
| `POST /api/chat/stream` | SSE — emit từng bước A2A + kết quả cuối |
| `POST /api/chat` | Chat đồng bộ (legacy) |
| `GET /api/health` | Health check |
