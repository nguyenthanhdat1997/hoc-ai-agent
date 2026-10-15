# Học “Hiểu sâu về AI Agent” bằng cách làm

Dự án học tập cho cuốn *Hiểu sâu về AI Agent: Nguyên lý thiết kế và thực hành kỹ thuật* (Lý Bác Kiệt, bản tiếng Việt —
`AI-Agents-in-Depth-vi (1).pdf`). Thay vì đọc tuần tự 425 trang, mỗi chương được chuyển thành:

| Phần | Nội dung |
|---|---|
| 📖 Đọc nhanh | Ý chính, các mục cô đọng (viết lại từ sách, kèm thuật ngữ Anh–Việt), lỗi thường gặp |
| 🧪 Minh họa | Mô phỏng tương tác chạy trong trình duyệt (ReAct, KV Cache, nén ngữ cảnh, Skills…) |
| 💻 Code thực hành | Một mini-agent Python lớn dần qua từng chương, chạy với mô hình local (MLX) |
| 🛠️ Áp dụng | Bài tập áp vào công việc của bạn, ghi chú lưu trong trình duyệt |
| 🧠 Ôn tập | Quiz có giải thích + flashcard lặp lại ngắt quãng (1, 3, 7, 16, 35 ngày) |

Đã có đủ **10 chương**. Từ Chương 6 trở đi, bài lab chạy hoàn toàn không cần model (mô phỏng thuật toán, thống kê, điều phối).

## Cấu trúc

```
web/        Website học (Vite + React + TypeScript)
agent-lab/  Mini-agent Python (chỉ dùng thư viện chuẩn)
  miniagent/  llm.py · tools.py · agent.py · printer.py · context.py · retrieval.py
  ch01/       react_loop.py — vòng ReAct + thí nghiệm cắt bỏ
  ch02/       cache_lab.py · status_bar.py · compression.py · injection.py
  ch03/       contextual_retrieval.py · agentic_rag.py · user_memory.py
  ch04/       tool_discovery.py · safe_exec.py
  ch05/       coding_agent.py · code_as_rules.py
  ch06/       event_loop.py — cancellation / queued / parallel, placeholder       (không cần model)
  ch07/       eval_toolkit.py — Pass@k, Pass^k, McNemar, bootstrap, Elo, Rubric  (không cần model)
  ch08/       grpo_toy.py — GRPO thu nhỏ, cold start, RLVP                       (không cần model)
  ch09/       evolve_loop.py — bảng bằng chứng, release gate, đánh giá dài hạn  (không cần model)
  ch10/       multi_agent.py — Proposer–Reviewer, cascading termination, lock    (không cần model)
```

## Chạy website

```bash
cd web
npm install
npm run dev          # mở http://localhost:5173
```

## Chạy code thực hành với MLX

Mặc định gọi `http://127.0.0.1:8080/v1` với `mlx-community/Qwen3-4B-Instruct-2507-4bit`.
Dùng server khác thì tạo file `agent-lab/.env` (đã bị .gitignore, không lên GitHub):

```
AGENT_BASE_URL=https://<server-của-bạn>/v1
```

```bash
cd agent-lab
python3 -m miniagent.llm                              # xem model server đang có
export AGENT_MODEL=mlx-community/Qwen3.8-27B-4bit     # đổi model nếu muốn
python3 ch01/react_loop.py
python3 ch01/react_loop.py --ablate tools
python3 ch02/cache_lab.py
```

Biến môi trường: `AGENT_BASE_URL`, `AGENT_MODEL`, `AGENT_THINKING=1` (bật suy nghĩ cho model Qwen3 lai). Server local: `mlx_lm.server --model <model> --port 8080` rồi `export AGENT_BASE_URL=http://127.0.0.1:8080/v1`.
Chưa có model? Thêm `--mock` để chạy với mô hình giả lập theo kịch bản — chỉ để xem luồng chạy, không phản ánh năng lực mô hình thật.

Mã gốc đi kèm sách: https://github.com/bojieli/ai-agent-book
