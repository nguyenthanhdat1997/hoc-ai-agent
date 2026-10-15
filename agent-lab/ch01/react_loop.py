"""Bài 1 — Vòng lặp ReAct và thí nghiệm cắt bỏ ngữ cảnh (Chương 1: Thí nghiệm 1-1, Hình 1-4).

Nhiệm vụ: tính tổng doanh thu năm từ 4 quý ở 4 loại tiền khác nhau.
Agent phải: quy đổi tiền tệ (công cụ) → tính tổng (công cụ) → trả lời.

Chạy:
    python3 ch01/react_loop.py                    # đầy đủ ngữ cảnh (baseline)
    python3 ch01/react_loop.py --ablate tools     # bỏ định nghĩa công cụ
    python3 ch01/react_loop.py --ablate results   # bỏ kết quả công cụ khỏi ngữ cảnh
    python3 ch01/react_loop.py --ablate history   # mỗi vòng chỉ gửi system + câu hỏi gốc
    thêm --mock để chạy với mô hình giả lập (không cần server)

Quan sát: ở mỗi biến thể, Agent hỏng theo kiểu gì? Có "trả lời trơn tru nhưng sai" không?
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from miniagent.agent import Agent  # noqa: E402
from miniagent.llm import Reply, call, make_llm  # noqa: E402
from miniagent.tools import CALCULATOR, CONVERT_CURRENCY, ToolRegistry  # noqa: E402

SYSTEM_PROMPT = """Bạn là trợ lý tài chính. Luôn dùng công cụ để quy đổi tiền tệ và tính toán,
không tự ước lượng tỷ giá hay tính nhẩm. Khi đủ thông tin, trả lời ngắn gọn bằng tiếng Việt."""

TASK = ("Doanh thu các quý của công ty: Q1 2.500.000 USD, Q2 2.100.000 EUR, Q3 1.800.000 GBP, "
        "Q4 380.000.000 JPY. Tính tổng doanh thu cả năm và doanh thu trung bình mỗi quý, quy ra USD.")


class AblatedAgent(Agent):
    """Agent bị cắt bớt một thành phần ngữ cảnh — để thấy vai trò của từng thành phần."""

    def __init__(self, *args, ablate: str | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.ablate = ablate

    def tool_schemas(self):
        if self.ablate == "tools":
            return None  # mô hình không còn biết mình có công cụ
        return super().tool_schemas()

    def build_messages(self):
        system = {"role": "system", "content": self.system_prompt}
        if self.ablate == "results":
            # vẫn gửi quyết định gọi công cụ, nhưng không bao giờ cho mô hình thấy kết quả
            return [system] + [m for m in self.trajectory if m["role"] != "tool"]
        if self.ablate == "history":
            first_user = next(m for m in self.trajectory if m["role"] == "user")
            return [system, first_user]
        return super().build_messages()


# ── Kịch bản cho MockLLM: bắt chước một mô hình biết dùng công cụ ───────────
def mock_policy(messages, tools) -> Reply:
    tool_results = [json.loads(m["content"]) for m in messages if m["role"] == "tool"]
    converted = [r for r in tool_results if "from" in r]
    totals = [r for r in tool_results if "expression" in r]

    if tools is None:
        # Không có công cụ: mô hình vẫn trả lời rất tự tin — bằng tỷ giá "nhớ" từ dữ liệu huấn luyện
        return Reply("Tổng doanh thu năm khoảng 9.450.000 USD, trung bình mỗi quý khoảng 2.362.500 USD.",
                     reasoning="Không có công cụ, tôi ước lượng tỷ giá EUR≈1.08, GBP≈1.25, JPY≈0.0065.")
    if not converted:
        return Reply("", "Cần quy đổi EUR, GBP, JPY sang USD trước.", [
            call("convert_currency", amount=2100000, from_currency="EUR", to_currency="USD"),
            call("convert_currency", amount=1800000, from_currency="GBP", to_currency="USD"),
            call("convert_currency", amount=380000000, from_currency="JPY", to_currency="USD"),
        ])
    if not totals:
        expr = " + ".join(["2500000"] + [str(r["result"]) for r in converted])
        return Reply("", "Đã có tỷ giá, giờ tính tổng bằng calculator.", [call("calculator", expression=expr)])
    total = totals[-1]["result"]
    return Reply(f"Tổng doanh thu năm: {total:,.2f} USD. Trung bình mỗi quý: {total / 4:,.2f} USD.",
                 reasoning="Đã đủ dữ liệu, tổng hợp câu trả lời.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ablate", choices=["tools", "results", "history"], help="thành phần ngữ cảnh bị cắt bỏ")
    parser.add_argument("--mock", action="store_true", help="dùng mô hình giả lập")
    parser.add_argument("--max-iterations", type=int, default=6)
    args = parser.parse_args()

    llm = make_llm(args.mock, mock_policy)
    tools = ToolRegistry([CONVERT_CURRENCY, CALCULATOR])
    agent = AblatedAgent(llm, SYSTEM_PROMPT, tools, max_iterations=args.max_iterations, ablate=args.ablate)

    print(f"Biến thể: {args.ablate or 'baseline (đầy đủ ngữ cảnh)'}\n")
    answer = agent.run(TASK)

    print("\n══ Tổng kết ══")
    print(f"Số vòng gọi mô hình : {agent.rounds}")
    print(f"Số lần gọi công cụ  : {dict(tools.call_counts) or 0}")
    print("Đáp án đúng         : tổng 9,602,895.73 USD · trung bình 2,400,723.93 USD")
    print(f"Agent trả lời       : {answer or '(không có — bị dừng)'}")


if __name__ == "__main__":
    main()
