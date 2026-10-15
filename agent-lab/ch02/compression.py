"""Bài 2.3 — Nén ngữ cảnh (Chương 2, mục 2.7 · Thí nghiệm 2-10, phiên bản thu nhỏ).

Nhiệm vụ nghiên cứu (công ty HƯ CẤU để kết quả không phụ thuộc kiến thức của mô hình):
tìm 3 nhà sáng lập của NovaMind và vị trí hiện tại của từng người.
Công cụ search trả về những trang rất dài, thông tin quan trọng nằm lẫn giữa nhiều đoạn nhiễu.

Ba chiến lược:
  none      giữ nguyên mọi kết quả → tràn ngân sách ngữ cảnh
  eager     nén mỗi kết quả ngay khi về (phá cache mỗi vòng)
  adaptive  chỉ nén khi chạm 80% ngân sách, nén cả lô, nén theo nhiệm vụ (khuyến nghị)

Chạy:  python3 ch02/compression.py --strategy adaptive [--budget 7000] [--mock]
"""

from __future__ import annotations

import argparse
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from miniagent.context import COMPRESSED_TAG, Compressor, ContextAgent, ContextOverflow  # noqa: E402
from miniagent.llm import Reply, call, make_llm  # noqa: E402
from miniagent.tools import Tool, ToolRegistry  # noqa: E402

FACTS = {
    "nhà sáng lập": ["NovaMind được thành lập năm 2019 bởi ba người: Lê Minh An, Trần Hà Vy và Phạm Quốc Bảo."],
    "Lê Minh An": ["Tháng 3/2025, Lê Minh An rời NovaMind và sáng lập phòng nghiên cứu Orbis Lab."],
    "Trần Hà Vy": ["Trần Hà Vy giữ chức CEO của NovaMind từ năm 2022 đến nay."],
    "Phạm Quốc Bảo": ["Từ tháng 8/2024, Phạm Quốc Bảo làm giám đốc kỹ thuật tại Helix Robotics."],
}
FILLER = [
    "Trang tin công nghệ tổng hợp nhiều bình luận về xu hướng trí tuệ nhân tạo trong khu vực.",
    "Phần điều hướng: Trang chủ · Tin tức · Sự kiện · Liên hệ · Đăng nhập · Đăng ký nhận bản tin.",
    "Quảng cáo: khóa học lập trình ưu đãi, đăng ký ngay để nhận quà tặng hấp dẫn.",
    "Nhiều chuyên gia cho rằng thị trường còn nhiều biến động và cần quan sát thêm.",
    "Bài viết liên quan: những điều cần biết khi khởi nghiệp, kinh nghiệm gọi vốn, văn hóa doanh nghiệp.",
]


def search(query: str) -> str:
    rng = random.Random(query)
    key = next((k for k in FACTS if k.lower() in query.lower()), None)
    paras = [rng.choice(FILLER) for _ in range(60)]
    for fact in FACTS.get(key, []):
        paras.insert(rng.randint(15, 45), fact)  # thông tin quan trọng bị chôn giữa trang
    url = "https://news.example/" + re.sub(r"\W+", "-", query.lower()).strip("-")
    return f"Nguồn: {url}\n" + " ".join(paras)


SEARCH = Tool("search", "Tìm kiếm trên web, trả về nội dung trang (có thể rất dài).",
              {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}, search)

SYSTEM = """Bạn là Agent nghiên cứu. Dùng công cụ search để tìm thông tin, mỗi lần một truy vấn cụ thể.
Khi đủ thông tin, trả lời bằng danh sách: tên — vị trí hiện tại — nguồn."""

TASK = "Tìm 3 nhà sáng lập công ty NovaMind và vị trí công việc hiện tại của từng người."


def mock_policy(messages, tools) -> Reply:
    if messages[0]["content"].startswith("Bạn là bộ nén"):
        # Bộ nén giả lập: giữ câu có chữ số hoặc tên riêng của nhiệm vụ, và giữ nguồn
        text = messages[-1]["content"].split("Kết quả công cụ cần nén:\n", 1)[1]
        keep = [s.strip() for s in re.split(r"(?<=\.)\s", text)
                if re.search(r"\d|Nguồn", s) and "Quảng cáo" not in s]
        return Reply("\n".join(f"- {k}" for k in dict.fromkeys(keep)))
    seen = " ".join(m["content"] for m in messages if m["role"] == "tool")
    for key in FACTS:  # tìm lần lượt; nếu sự kiện đã mất khỏi ngữ cảnh thì phải tìm lại
        if not any(f in seen for f in FACTS[key]):
            q = "NovaMind nhà sáng lập" if key == "nhà sáng lập" else f"{key} hiện tại"
            return Reply("", f"Chưa biết về '{key}', tìm tiếp.", [call("search", query=q)])
    facts = [f for k, v in FACTS.items() if k != "nhà sáng lập" for f in v]
    return Reply("Kết quả:\n" + "\n".join(f"- {f}" for f in facts))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--strategy", choices=["none", "eager", "adaptive"], default="adaptive")
    parser.add_argument("--budget", type=int, default=7000, help="ngân sách ngữ cảnh (token ước lượng)")
    parser.add_argument("--mock", action="store_true")
    args = parser.parse_args()

    llm = make_llm(args.mock, mock_policy)
    compressor = None if args.strategy == "none" else Compressor(llm, args.budget, mode=args.strategy)
    agent = ContextAgent(llm, SYSTEM, ToolRegistry([SEARCH]), max_iterations=10,
                         compressor=compressor, budget_tokens=args.budget)
    try:
        answer = agent.run(TASK)
    except ContextOverflow as e:
        agent.printer.stop(f"TRÀN NGỮ CẢNH: {e}")
        answer = ""

    print("\n══ Tổng kết ══")
    print(f"Chiến lược          : {args.strategy}")
    print(f"Kích thước ngữ cảnh : {' → '.join(f'{s:,}' for s in agent.context_sizes)} (token ước lượng mỗi vòng)")
    print(f"Số lần nén          : {compressor.compressions if compressor else 0}")
    kept = sum(1 for v in FACTS.values() for f in v
               if any(f in m['content'] for m in agent.trajectory if m['role'] == 'tool'))
    print(f"Sự kiện còn trong ngữ cảnh: {kept}/4 · kết quả đã nén: "
          f"{sum(m['content'].startswith(COMPRESSED_TAG) for m in agent.trajectory if m['role'] == 'tool')}")
    print(f"Câu trả lời         :\n{answer or '(không có)'}")


if __name__ == "__main__":
    main()
