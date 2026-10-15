"""Bài 2.1 — Đo tác động của KV Cache (Chương 2, mục 2.3 · Thí nghiệm 2-3).

Gửi cùng một loạt câu hỏi theo 4 cách dựng ngữ cảnh và đo thời gian xử lý prompt:
  A. stable          system prompt + tools cố định, câu hỏi nối ở cuối           (đúng)
  B. time_in_system  chèn "Thời gian hiện tại: ...µs" vào ĐẦU system prompt       (lỗi kinh điển)
  C. time_at_end     thời gian nối vào cuối tin nhắn user                        (cách sửa)
  D. shuffle_tools   đổi thứ tự danh sách công cụ mỗi lần                         (lỗi ẩn)

mlx_lm.server giữ cache của prompt trước đó và tái sử dụng phần TIỀN TỐ chung,
nên khác biệt về độ trễ đo được là thật. Cột "tiền tố dùng lại" là ước tính độc lập:
tỷ lệ ký tự đầu tiên của prompt giống hệt prompt liền trước.

Chạy:  python3 ch02/cache_lab.py [--rounds 5] [--mock]
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from miniagent.llm import Reply, make_llm  # noqa: E402

RULES = "\n".join(
    f"{i}. Quy tắc nghiệp vụ số {i}: khi khách hỏi về gói cước loại {i}, kiểm tra hợp đồng, "
    f"xác minh danh tính, rồi mới tra cứu lịch sử thanh toán và đề xuất phương án phù hợp."
    for i in range(1, 41)
)
BASE_SYSTEM = f"Bạn là nhân viên chăm sóc khách hàng viễn thông. Trả lời ngắn gọn.\n\n# Quy tắc\n{RULES}"

TOOLS = [
    {"type": "function", "function": {
        "name": f"tool_{name}", "description": f"Công cụ {name}: tra cứu và xử lý nghiệp vụ {name} cho khách hàng.",
        "parameters": {"type": "object", "properties": {
            "customer_id": {"type": "string", "description": "Mã khách hàng"},
            "detail": {"type": "string", "description": f"Chi tiết yêu cầu liên quan đến {name}"}}}}}
    for name in ["billing", "contract", "plan", "refund", "usage", "device", "roaming", "support"]
]

QUESTIONS = ["Gói cước của tôi còn bao lâu?", "Tôi muốn hủy gói.", "Sao hóa đơn tháng này cao?",
             "Đổi sang gói rẻ hơn được không?", "Tôi đang ở nước ngoài, có roaming không?",
             "Máy tôi bị lỗi mạng.", "Kiểm tra lượng data còn lại.", "Tôi muốn hoàn tiền."]


def build(variant: str, question: str, rng: random.Random):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
    system, tools, user = BASE_SYSTEM, TOOLS, question
    if variant == "time_in_system":
        system = f"Thời gian hiện tại: {now}\n" + BASE_SYSTEM
    elif variant == "time_at_end":
        user = f"{question}\n[thời gian: {now}]"
    elif variant == "shuffle_tools":
        tools = TOOLS[:]
        rng.shuffle(tools)
    return [{"role": "system", "content": system}, {"role": "user", "content": user}], tools


def rendered(messages, tools) -> str:
    # Gần đúng cách chat template ghép: system → tools → các tin nhắn
    return messages[0]["content"] + json.dumps(tools, ensure_ascii=False) + messages[1]["content"]


def common_prefix(a: str, b: str) -> int:
    n = min(len(a), len(b))
    i = 0
    while i < n and a[i] == b[i]:
        i += 1
    return i


def mock_policy_factory():
    state = {"prev": ""}

    def policy(messages, tools) -> Reply:
        # Mô phỏng: chi phí ∝ số ký tự KHÔNG nằm trong tiền tố chung với prompt trước
        text = rendered(messages, tools or [])
        new_chars = len(text) - common_prefix(state["prev"], text)
        state["prev"] = text
        time.sleep(new_chars / 40000)
        return Reply("ok")

    return policy


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rounds", type=int, default=5)
    parser.add_argument("--mock", action="store_true")
    args = parser.parse_args()

    llm = make_llm(args.mock, mock_policy_factory())
    rng = random.Random(0)
    results = []
    for variant in ["stable", "time_in_system", "time_at_end", "shuffle_tools"]:
        prev, latencies, reuse = "", [], []
        llm.chat(*build(variant, "Xin chào", rng), max_tokens=1)  # khởi động: nạp tiền tố của biến thể này
        prev = rendered(*build(variant, "Xin chào", rng))
        for i in range(args.rounds):
            messages, tools = build(variant, QUESTIONS[i % len(QUESTIONS)], rng)
            text = rendered(messages, tools)
            reuse.append(common_prefix(prev, text) / len(text))
            prev = text
            reply = llm.chat(messages, tools, max_tokens=1)
            latencies.append(reply.latency)
        results.append((variant, statistics.mean(latencies), statistics.mean(reuse)))
        print(f"  {variant:<15} xong")

    base = results[0][1]
    print(f"\n{'biến thể':<16}{'độ trễ TB':>12}{'so với stable':>15}{'tiền tố dùng lại':>18}")
    for variant, lat, reuse in results:
        print(f"{variant:<16}{lat:>10.3f}s{lat / base:>14.1f}×{reuse:>17.0%}")
    print("\nKết luận cần thấy: B và D chậm hơn rõ rệt vì tiền tố bị đổi; C nhanh gần bằng A.")


if __name__ == "__main__":
    main()
