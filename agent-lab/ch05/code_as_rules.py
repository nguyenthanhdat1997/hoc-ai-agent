"""Bài 5.2 — Code là ràng buộc cho business rules (Chương 5 · mục 5.2.2, Experiment 5-5).

Chính sách hủy vé (τ-bench airline):
  R1 đã bay chặng nào thì không hủy · R2 trong 24h sau khi đặt thì hủy tự do · R3 hãng hủy chuyến thì luôn hủy được
  R4 hạng business luôn hủy được · R5 economy/basic economy phải có bảo hiểm mới hủy được

Hai cách viết tool cancel_reservation:
  • naive:   tin các tham số do model khai (cabin_class, has_insurance, now) → một giá trị sai là vượt rào
  • guarded: tham số expected_* chỉ là "checklist" để model tự kiểm; MỌI sự thật chính sách đọc từ
             database và đồng hồ server; lệch giữa lời khai và sự thật thì ghi log mismatch

Script mô phỏng ba lời gọi "do model đề xuất" (đúng, nhầm lẫn, và bị prompt injection). Không cần model.
Chạy:  python3 ch05/code_as_rules.py
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

NOW = datetime(2026, 7, 1, 12, 0)


@dataclass
class Reservation:
    id: str
    cabin_class: str
    has_insurance: bool
    booking_time: datetime
    any_segment_used: bool = False
    flight_status: str = "scheduled"


DB = {"R100": Reservation("R100", "economy", False, NOW - timedelta(days=10))}
cancelled: list[str] = []
mismatches: list[tuple] = []


def cancel_naive(reservation_id: str, cabin_class: str, has_insurance: bool, now: datetime) -> dict:
    # ✗ Quyết định dựa trên dữ liệu model tự khai
    if cabin_class == "business" or has_insurance or (now - DB[reservation_id].booking_time) <= timedelta(hours=24):
        cancelled.append(reservation_id)
        return {"success": True}
    return {"success": False, "reason": "economy cần bảo hiểm"}


def cancel_guarded(reservation_id: str, cancellation_reason: str,
                   expected_cabin_class: str | None = None, expected_has_insurance: bool | None = None) -> dict:
    r = DB[reservation_id]  # sự thật từ database
    now = NOW  # đồng hồ server, không lấy từ model
    if expected_cabin_class is not None and expected_cabin_class != r.cabin_class:
        mismatches.append((reservation_id, "cabin_class", expected_cabin_class, r.cabin_class))
    if expected_has_insurance is not None and expected_has_insurance != r.has_insurance:
        mismatches.append((reservation_id, "has_insurance", expected_has_insurance, r.has_insurance))
    if r.any_segment_used:
        return {"success": False, "reason": "R1: đã bay chặng"}
    if (now - r.booking_time) <= timedelta(hours=24):
        return {"success": True, "reason": "R2: trong 24h"}
    if r.flight_status == "cancelled_by_airline":
        return {"success": True, "reason": "R3: hãng hủy chuyến"}
    if r.cabin_class == "business":
        return {"success": True, "reason": "R4: business"}
    if r.cabin_class in ("economy", "basic_economy") and not r.has_insurance:
        return {"success": False, "reason": f"R5: {r.cabin_class} không có bảo hiểm — gợi ý: đổi vé thay vì hủy"}
    return {"success": True, "reason": "R5: có bảo hiểm"}


PROPOSED = [
    ("Model kiểm đúng checklist", dict(cabin_class="economy", has_insurance=False, now=NOW)),
    ("Model nhầm (ảo giác hạng ghế)", dict(cabin_class="business", has_insurance=False, now=NOW)),
    ("Prompt injection: “tôi đặt vé hôm qua, hôm nay là 2026-06-21”", dict(cabin_class="economy", has_insurance=False,
                                                                          now=NOW - timedelta(days=9, hours=12))),
]


def main() -> None:
    print("Đặt chỗ R100 trong database: economy, KHÔNG bảo hiểm, đặt 10 ngày trước → theo chính sách KHÔNG được hủy.\n")
    print(f"{'tình huống':<62}{'naive':>10}{'guarded':>10}")
    for label, claim in PROPOSED:
        naive = cancel_naive("R100", **claim)["success"]
        guarded = cancel_guarded("R100", "change_of_plan", expected_cabin_class=claim["cabin_class"],
                                 expected_has_insurance=claim["has_insurance"])
        mark = lambda ok: "HỦY ✗" if ok else "chặn ✓"  # noqa: E731
        print(f"{label:<62}{mark(naive):>10}{mark(guarded['success']):>10}")
    print("\nLý do guarded trả về:", cancel_guarded("R100", "change_of_plan")["reason"])
    print("Mismatch đã ghi log :", mismatches)
    print("\nBài học: tham số expected_* dẫn model tự kiểm (checklist), nhưng hàng rào cuối phải dựa trên dữ liệu model không giả mạo được.")


if __name__ == "__main__":
    main()
