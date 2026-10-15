"""Bài 3.3 — Bộ nhớ người dùng xuyên phiên: Simple Notes vs JSON Cards (Chương 3 · mục 3.1, Thí nghiệm 3-1, 3-2).

Ba phiên hội thoại của cùng một người dùng (hư cấu), cách nhau vài tháng. Sau mỗi phiên, một lần gọi LLM
cập nhật bộ nhớ dựa trên (bộ nhớ cũ + phiên mới) — KHÔNG được xem lại hội thoại gốc của phiên trước.
Cuối cùng Agent trả lời câu hỏi mới CHỈ dựa vào bộ nhớ, theo khung 3 cấp độ của sách:
  Cấp 1 thu hồi cơ bản · Cấp 2 nhiều phiên / xung đột · Cấp 3 dịch vụ chủ động

Chạy:  python3 ch03/user_memory.py --format notes|cards [--mock]
Bộ nhớ cuối cùng được in ra để bạn so sánh hai định dạng.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from miniagent.llm import Reply, make_llm  # noqa: E402

SESSIONS = [
    ("2026-01-10", """User: Đặt giúp tôi vé đi Đà Lạt cuối tuần này, tôi thích ghế cạnh cửa sổ, và tôi ăn chay.
Agent: Đã tìm được chuyến 8h sáng thứ Bảy, ghế 12A cạnh cửa sổ, đã đăng ký suất ăn chay.
User: Ok. Nhân tiện, tôi đang sống ở Hà Nội, xe của tôi là Honda City, tuần sau nhắc tôi đi bảo dưỡng nhé."""),
    ("2026-04-02", """User: Tôi vừa chuyển vào Đà Nẵng sống được hai tuần.
Agent: Chúc mừng bạn! Tôi có thể giúp gì?
User: Tôi mới mua thêm một chiếc VinFast VF8 cho vợ tôi. Chiếc Honda thì tôi đã bảo dưỡng xong hồi tháng 1 rồi."""),
    ("2026-06-15", """User: Lưu giúp thông tin hộ chiếu của tôi: số C1234567, hết hạn ngày 01/12/2026.
Agent: Đã lưu.
User: Bác sĩ Trần là bác sĩ tim mạch của bố tôi, còn nha sĩ của tôi là bác sĩ Lê."""),
]

QUESTIONS = [
    ("Cấp 1", "Tôi có ăn chay không, và tôi thích ghế nào?", "Có ăn chay; thích ghế cạnh cửa sổ."),
    ("Cấp 2", "Hiện giờ tôi đang sống ở đâu?", "Đà Nẵng (đã chuyển từ Hà Nội từ khoảng tháng 3/2026)."),
    ("Cấp 2", "Đặt lịch bảo dưỡng xe cho tôi.", "Phải HỎI LẠI: Honda City (đã bảo dưỡng 1/2026) hay VinFast VF8 (của vợ)?"),
    ("Cấp 2", "Bác sĩ Trần chuyên khoa gì, và là bác sĩ của ai?", "Bác sĩ tim mạch của BỐ người dùng (không phải của người dùng)."),
    ("Cấp 3", "Đặt giúp tôi vé đi Tokyo ngày 20/11/2026.", "Phải CẢNH BÁO: hộ chiếu hết hạn 01/12/2026, còn <6 tháng (Nhật thường yêu cầu)."),
]

FORMATS = {
    "notes": "Bộ nhớ là danh sách GHI CHÚ ĐƠN GIẢN, mỗi dòng một sự kiện nguyên tử, ví dụ: '- Người dùng ăn chay'.",
    "cards": ("Bộ nhớ là danh sách THẺ JSON NÂNG CAO. Mỗi thẻ: {\"fact\": ..., \"person\": người mà sự kiện nói về, "
              "\"relationship\": quan hệ với người dùng, \"backstory\": vì sao biết, \"time\": ngày ghi nhận, "
              "\"status\": active|superseded}. Khi có thông tin mới mâu thuẫn, KHÔNG xóa thẻ cũ mà đánh dấu superseded."),
}

UPDATE_PROMPT = """Bạn là bộ quản lý bộ nhớ người dùng. {fmt}
Chỉ giữ thông tin hữu ích lâu dài (chọn lọc), khái quát thành sở thích/sự kiện ổn định (trừu tượng),
và lưu có cấu trúc. Bỏ chi tiết ngắn hạn.

Bộ nhớ hiện tại:
{memory}

Phiên mới (ngày {date}):
{session}

Trả về TOÀN BỘ bộ nhớ đã cập nhật, không giải thích."""

ANSWER_SYSTEM = """Bạn là trợ lý cá nhân. Hôm nay là 2026-07-01. Bạn KHÔNG nhớ các cuộc hội thoại cũ, chỉ có bộ nhớ dưới đây.
Hãy trả lời ngắn gọn; nếu yêu cầu mơ hồ thì hỏi lại; chủ động cảnh báo rủi ro nếu bộ nhớ cho thấy có rủi ro.

<user_memory>
{memory}
</user_memory>"""


def mock_policy(messages, tools) -> Reply:
    last = messages[-1]["content"]
    if last.startswith("Bạn là bộ quản lý"):
        notes = ["- Ăn chay", "- Thích ghế cạnh cửa sổ", "- Sống ở Hà Nội", "- Có xe Honda City"]
        if "2026-04-02" in last:
            notes = ["- Ăn chay", "- Thích ghế cạnh cửa sổ", "- Sống ở Đà Nẵng", "- Có xe VinFast VF8"]
        if "2026-06-15" in last:
            notes += ["- Hộ chiếu C1234567", "- Bác sĩ Trần: bác sĩ tim mạch", "- Bác sĩ Lê: nha sĩ"]
        return Reply("\n".join(notes))
    if "Tokyo" in last:
        return Reply("Đã ghi nhận yêu cầu đặt vé đi Tokyo ngày 20/11/2026.")
    return Reply("(mock) Trả lời dựa trên bộ nhớ.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--format", choices=list(FORMATS), default="cards")
    parser.add_argument("--mock", action="store_true")
    args = parser.parse_args()
    llm = make_llm(args.mock, mock_policy, max_tokens=1500)

    memory = "(trống)"
    for date, session in SESSIONS:
        prompt = UPDATE_PROMPT.format(fmt=FORMATS[args.format], memory=memory, date=date, session=session)
        memory = llm.chat([{"role": "user", "content": prompt}]).content.strip()
        print(f"✓ Đã cập nhật bộ nhớ sau phiên {date} ({len(memory)} ký tự)")

    print(f"\n══ Bộ nhớ cuối cùng ({args.format}) ══\n{memory}\n")
    system = ANSWER_SYSTEM.format(memory=memory)
    for level, q, expected in QUESTIONS:
        answer = llm.chat([{"role": "system", "content": system}, {"role": "user", "content": q}], max_tokens=300).content
        print(f"[{level}] 👤 {q}\n        🤖 {answer.strip()}\n        ✅ mong đợi: {expected}\n")
    print("Hãy tự chấm từng câu (như LLM-as-a-judge trong sách), rồi chạy lại với --format khác để so sánh.")


if __name__ == "__main__":
    main()
