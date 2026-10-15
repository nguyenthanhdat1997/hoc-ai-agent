"""Bài 6.1 — Event-driven Agent runtime, thu nhỏ (Chương 6 · mục Async và event-driven). Không cần model.

Agent đang chạy một tool chậm (search) thì thế giới gửi tới các sự kiện. Runtime phải chọn chiến lược:

  Cancellation  sự kiện khẩn → hủy tool đang chạy, ghi PLACEHOLDER cho tool call dở, gọi lại LLM ngay
  Queued        bổ sung thường → xếp hàng, khi tool xong thì đưa tool result + cả lô sự kiện cho LLM một lượt
                (đánh dấu [Unprocessed Event i/n] để model không chỉ trả lời sự kiện cuối)
  Parallel      câu hỏi độc lập, nhẹ → session song song trả lời ngay, không chạm vào task chính

Cuối bài kiểm tra trajectory hợp lệ: mọi tool call đều có đúng một tool result (không bỏ trống, không giả “thành công”).
Phần 2: scale ảnh chụp màn hình về độ phân giải model và nhân ngược tọa độ.

Chạy:  python3 ch06/event_loop.py
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

TICK = 0.02  # 1 "giây" mô phỏng


@dataclass
class Event:
    at: float          # thời điểm đến (giây mô phỏng)
    source: str        # ai gửi
    channel: str       # kênh nào
    content: str       # nội dung
    priority: str      # urgent | normal | independent


SCENARIOS = {
    "queued": [
        Event(1, "user", "chat", "chỉ lấy dữ liệu tháng gần nhất", "normal"),
        Event(2, "system", "timer", "đến giờ báo cáo hằng ngày", "normal"),
        Event(3, "user", "chat", "hôm nay thời tiết thế nào?", "independent"),
    ],
    "cancel": [
        Event(1, "user", "chat", "chỉ lấy dữ liệu tháng gần nhất", "normal"),
        Event(2, "user", "chat", "Dừng! Tôi nói nhầm công ty rồi", "urgent"),
    ],
}


class Runtime:
    def __init__(self, events: list[Event]) -> None:
        self.events = events
        self.trajectory: list[dict] = [{"role": "user", "content": "Tổng hợp doanh thu quý của công ty ACME"}]
        self.queue: list[Event] = []
        self.urgent = asyncio.Event()
        self.t0 = 0.0

    def now(self) -> str:
        return f"t={(asyncio.get_event_loop().time() - self.t0) / TICK:4.1f}s"

    def log(self, msg: str) -> None:
        print(f"   [{self.now()}] {msg}")

    async def producer(self) -> None:
        """Thế giới bên ngoài: đẩy sự kiện tới theo thời gian (Channel, không phải heartbeat)."""
        for ev in self.events:
            await asyncio.sleep(max(0.0, self.t0 + ev.at * TICK - asyncio.get_event_loop().time()))
            self.log(f"sự kiện {ev.priority:<11} từ {ev.source}/{ev.channel}: “{ev.content}”")
            if ev.priority == "independent":
                asyncio.create_task(self.parallel_session(ev))
            else:
                self.queue.append(ev)
                if ev.priority == "urgent":
                    self.urgent.set()

    async def parallel_session(self, ev: Event) -> None:
        await asyncio.sleep(0.5 * TICK)
        self.log(f"session song song trả lời: “Trời nắng, 31°C.” [Parallel with main task] (task chính không bị chạm tới)")

    async def tool_search(self) -> str:
        await asyncio.sleep(5 * TICK)  # tool chậm
        return "doanh thu Q1–Q4 của ACME: 12 / 15 / 14 / 18 tỷ"

    def batch_message(self, events: list[Event]) -> str:
        n = len(events)
        return "\n".join(f"[Unprocessed Event {i}/{n}] {json.dumps({'source': e.source, 'channel': e.channel, 'content': e.content}, ensure_ascii=False)}"
                         for i, e in enumerate(events, 1))

    async def run(self) -> None:
        self.t0 = asyncio.get_event_loop().time()
        asyncio.create_task(self.producer())
        call = {"id": "call_1", "name": "search", "arguments": {"q": "ACME doanh thu quý"}}
        self.trajectory.append({"role": "assistant", "tool_calls": [call]})   # ghi assistant message NGAY
        self.log("LLM gọi tool search (chạy nền, mất 5s)")
        tool = asyncio.create_task(self.tool_search())
        waiter = asyncio.create_task(self.urgent.wait())
        done, _ = await asyncio.wait({tool, waiter}, return_when=asyncio.FIRST_COMPLETED)

        if tool in done:  # tool xong trước: safe point → tiêu thụ queue theo lô
            waiter.cancel()
            self.trajectory.append({"role": "tool", "tool_call_id": "call_1", "content": tool.result()})
            batch, self.queue = self.queue, []
            self.log(f"tool xong → safe point, đưa tool result + {len(batch)} sự kiện xếp hàng cho LLM một lượt")
            if batch:
                self.trajectory.append({"role": "user", "content": self.batch_message(batch)})
        else:             # sự kiện khẩn: hủy tool, placeholder giữ cặp call/result hợp lệ
            tool.cancel()
            self.trajectory.append({"role": "tool", "tool_call_id": "call_1",
                                    "content": "[ĐÃ HỦY] search bị ngắt bởi sự kiện khẩn — KHÔNG có kết quả, đừng giả định đã xong"})
            batch, self.queue = self.queue, []
            self.log(f"sự kiện khẩn → hủy search, ghi placeholder, gom {len(batch)} sự kiện, gọi lại LLM ngay")
            self.trajectory.append({"role": "user", "content": self.batch_message(batch)})
        await asyncio.sleep(1 * TICK)  # để session song song (nếu có) kịp in


def validate(trajectory: list[dict]) -> str:
    calls = [c["id"] for m in trajectory if m["role"] == "assistant" for c in m.get("tool_calls", [])]
    results = [m["tool_call_id"] for m in trajectory if m["role"] == "tool"]
    return "hợp lệ ✓" if sorted(calls) == sorted(results) else f"LỖI: calls={calls}, results={results}"


# ── Phần 2: tọa độ Computer Use ─────────────────────────────────────────────
def to_model(screen: tuple[int, int], max_side: int = 1280) -> tuple[tuple[int, int], float]:
    w, h = screen
    scale = min(1.0, max_side / max(w, h))   # giữ đúng tỉ lệ khung
    return (round(w * scale), round(h * scale)), scale


def to_screen(xy: tuple[int, int], scale: float) -> tuple[int, int]:
    return round(xy[0] / scale), round(xy[1] / scale)


def main() -> None:
    for name, events in SCENARIOS.items():
        print(f"\n1{'a' if name == 'queued' else 'b'}) Kịch bản “{name}”")
        rt = Runtime(events)
        asyncio.run(rt.run())
        print("   Trajectory cuối:")
        for m in rt.trajectory:
            body = m.get("content") or json.dumps(m.get("tool_calls"), ensure_ascii=False)
            for i, line in enumerate(body.splitlines()):
                print(f"     {m['role'] if i == 0 else '':<9} {line}")
        print(f"   Kiểm tra cặp tool call/result: {validate(rt.trajectory)}")

    print("\n2) Scale ảnh chụp màn hình cho Computer Use")
    size, s = to_model((2560, 1440))
    print(f"   Màn hình 2560×1440 → gửi model {size[0]}×{size[1]} (scale {s:.2f})")
    print(f"   Model chỉ vào nút Gửi ở (1100, 650) trên ảnh nhỏ → click thật tại {to_screen((1100, 650), s)}")
    print("   Gửi thẳng ảnh 2560×1440 thì model dự đoán theo độ phân giải nó được train → click lệch.")


if __name__ == "__main__":
    main()
