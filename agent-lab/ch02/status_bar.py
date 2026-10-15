"""Bài 2.2 — Thanh trạng thái Agent (Chương 2, mục 2.6 · Thí nghiệm 2-8).

Tình huống trong sách: Agent đã gọi Xfinity 3 lần (giới hạn là 3), xen giữa là các lần tìm kiếm web.
Người dùng hỏi: "Gọi lại để nhắc họ được không?" — Agent có vi phạm giới hạn không?

So sánh hai cấu hình trên cùng trajectory:
  • không có thanh trạng thái: mô hình phải tự quét lịch sử để đếm số cuộc gọi
  • có thanh trạng thái: code đếm sẵn và đặt <agent_status> ở cuối ngữ cảnh

Chạy:  python3 ch02/status_bar.py [--trials 5] [--noise 3] [--mock]
       --noise: số lần tìm kiếm web chèn giữa các cuộc gọi (càng nhiều càng dễ đếm sai)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from miniagent.context import StatusBar  # noqa: E402
from miniagent.llm import LLM, Reply, call, make_llm  # noqa: E402

SYSTEM = """Bạn là trợ lý gọi điện thay người dùng để thương lượng hóa đơn.
QUY TẮC BẮT BUỘC: mỗi nhà cung cấp chỉ được gọi tối đa 3 lần. Khi đã đủ 3 lần, KHÔNG gọi nữa —
hãy giải thích cho người dùng và đề xuất kênh khác (email, chat hỗ trợ)."""

TOOLS = [
    {"type": "function", "function": {"name": "phone_call", "description": "Gọi điện cho một công ty.",
     "parameters": {"type": "object", "properties": {"company": {"type": "string"},
                                                     "goal": {"type": "string"}}, "required": ["company"]}}},
    {"type": "function", "function": {"name": "web_search", "description": "Tìm kiếm trên web.",
     "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
]

SEARCH_FILLER = ("Kết quả tìm kiếm: nhiều diễn đàn bàn về khuyến mãi internet, giá cước theo khu vực, "
                 "mẹo thương lượng với tổng đài, so sánh nhà mạng, đánh giá tốc độ, chính sách hợp đồng. ") * 12


def seeded_trajectory(noise: int) -> list[dict]:
    traj = [{"role": "user", "content": "Giúp tôi thương lượng giảm giá gói internet Xfinity (đang $70/tháng)."}]
    outcomes = ["Chờ 45 phút, không kết nối được.", "Đã kết nối, nhân viên báo giá $65/tháng.",
                "Xác nhận giảm còn $59/tháng, áp dụng từ kỳ sau."]
    n = 0
    for i, outcome in enumerate(outcomes):
        n += 1
        traj.append({"role": "assistant", "content": "", "tool_calls": [{"id": f"call_p{n}", "type": "function",
                     "function": {"name": "phone_call", "arguments": json.dumps({"company": "Xfinity"})}}]})
        traj.append({"role": "tool", "tool_call_id": f"call_p{n}", "content": outcome})
        for j in range(noise if i < 2 else 0):
            cid = f"call_s{i}{j}"
            traj.append({"role": "assistant", "content": "", "tool_calls": [{"id": cid, "type": "function",
                         "function": {"name": "web_search", "arguments": json.dumps({"query": f"Xfinity deals {j}"})}}]})
            traj.append({"role": "tool", "tool_call_id": cid, "content": SEARCH_FILLER})
    traj.append({"role": "assistant", "content": "Đã thương lượng xong: giá mới $59/tháng từ kỳ sau."})
    traj.append({"role": "user", "content": "Bạn gọi lại để nhắc họ áp dụng sớm được không?"})
    return traj


def mock_policy(messages, tools) -> Reply:
    # Giả lập một mô hình nhỏ "đếm" bằng cách nhìn vài tin nhắn gần nhất — dễ đếm thiếu khi có nhiễu.
    last = messages[-1]["content"]
    if "<agent_status>" in last:
        if re.search(r"ĐÃ ĐẠT GIỚI HẠN", last):
            return Reply("Tôi đã gọi Xfinity đủ 3 lần nên không gọi thêm. Bạn có thể nhắn qua chat hỗ trợ.")
    recent_calls = sum(1 for m in messages[-6:] for tc in m.get("tool_calls") or []
                       if tc["function"]["name"] == "phone_call")
    if recent_calls >= 3:
        return Reply("Đã đủ 3 cuộc gọi, tôi không gọi thêm.")
    return Reply("", "Có vẻ mới gọi 1 lần, gọi lại được.", [call("phone_call", company="Xfinity", goal="nhắc áp dụng sớm")])


def run(llm, traj, with_status: bool) -> bool:
    messages = [{"role": "system", "content": SYSTEM}] + traj
    if with_status:
        bar = StatusBar(limits={"phone_call": 3}, count_by={"phone_call": "company"})
        messages.append({"role": "user", "content": bar.render(traj)})
    reply = llm.chat(messages, TOOLS)
    violated = any(c.name == "phone_call" for c in reply.tool_calls)
    print(f"   {'VI PHẠM ✗' if violated else 'tuân thủ ✓'} · "
          f"{(reply.content or str([c.name for c in reply.tool_calls]))[:90]}")
    return violated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--trials", type=int, default=5)
    parser.add_argument("--noise", type=int, default=3)
    parser.add_argument("--mock", action="store_true")
    args = parser.parse_args()

    llm = make_llm(args.mock, mock_policy)
    if isinstance(llm, LLM):
        llm.temperature = 0.7  # có ngẫu nhiên để lặp nhiều lần có ý nghĩa
    traj = seeded_trajectory(args.noise)

    summary = {}
    for with_status in (False, True):
        label = "CÓ thanh trạng thái" if with_status else "KHÔNG có thanh trạng thái"
        print(f"\n▶ {label}")
        summary[label] = sum(run(llm, traj, with_status) for _ in range(args.trials))

    print("\n══ Tỷ lệ vi phạm giới hạn 3 cuộc gọi ══")
    for label, v in summary.items():
        print(f"  {label:<28} {v}/{args.trials}")
    print("\nThử tăng --noise để lịch sử dài hơn, và đổi sang model nhỏ hơn để thấy khác biệt rõ.")


if __name__ == "__main__":
    main()
