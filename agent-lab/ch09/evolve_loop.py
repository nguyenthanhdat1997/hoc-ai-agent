"""Bài 9.1 — Vòng tiến hóa liên tục, thu nhỏ (Chương 9 · mục 9.1–9.3). Không cần model.

Ba phần, mỗi phần là một "cổng" mà kinh nghiệm phải đi qua trước khi được thay đổi Agent:

  1. Experience → knowledge: chỉ mẫu hình được NHIỀU trajectory ủng hộ (và không bị phản bác) mới vào tài liệu chính thức
  2. Release gate: bản vá Prompt phải cải thiện boundary set VÀ không làm hỏng retention set
     (luật "chuyển người sau 3 lần lỗi" do model tự rút ra trông hợp lý nhưng bị gate chặn)
  3. Đánh giá dài hạn (Thí nghiệm 9-9): static vs append_only vs evolving trên dòng task có đổi luật
     (hạn mức hành lý 20 kg → 23 kg)

Chạy:  python3 ch09/evolve_loop.py
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass, field


# ── 1. Experience → knowledge ───────────────────────────────────────────────
@dataclass
class RunAnalysis:
    """Phân tích của MỘT lần chạy (đã có verifier chấm). Raw trajectory giữ nguyên ở nơi khác để audit."""
    run_id: str
    task_family: str
    outcome: str                 # success | partial | failure | unscored (verifier từ chối chấm khi thiếu bằng chứng)
    supports: list[str]          # mẫu hình hành động quan sát được trong lần chạy này
    api_version: str = "v2"


def distill(runs: list[RunAnalysis], min_support: int = 3) -> dict[str, dict]:
    """Bảng bằng chứng: mẫu hình nào được run thành công ủng hộ, run thất bại phản bác."""
    table: dict[str, dict] = defaultdict(lambda: {"support": [], "contradict": [], "versions": set()})
    for r in runs:
        if r.outcome == "unscored":
            continue  # bằng chứng mỏng → không đưa vào tập học
        for pattern in r.supports:
            row = table[pattern]
            (row["support"] if r.outcome == "success" else row["contradict"]).append(r.run_id)
            row["versions"].add(r.api_version)
    promoted = {}
    for pattern, row in table.items():
        ok = len(row["support"]) >= min_support and not row["contradict"]
        status = "PROMOTE" if ok else ("CONFLICT" if row["contradict"] else "candidate")
        promoted[pattern] = {"status": status, "support": len(row["support"]),
                             "contradict": len(row["contradict"]), "versions": sorted(row["versions"])}
    return promoted


# ── 2. Release gate cho bản vá Prompt ───────────────────────────────────────
@dataclass
class Task:
    kind: str     # missing_param | user_device | transient_error | asks_human
    id: str


def run_agent(rules: set[str], task: Task) -> bool:
    """Agent giả lập kiểu τ²-bench telecom: rule nào có trong policy thì hành vi tương ứng xảy ra."""
    if task.kind == "missing_param":
        # baseline: nhét "Xin cung cấp số điện thoại" vào tham số tool 5 lần → lỗi → chuyển người (fail)
        return "ask_user_for_missing_param" in rules
    if task.kind == "user_device":
        # SIM/APN là thiết bị của user: phải hướng dẫn user làm, không tự gọi tool
        return "guide_user_for_user_side_tools" in rules
    if task.kind == "transient_error":
        # tool timeout 3 lần rồi thành công ở lần 4 — baseline retry nên pass
        return "escalate_after_3_failures" not in rules
    if task.kind == "asks_human":
        return True  # user yêu cầu rõ ràng → chuyển người là đúng
    raise ValueError(task.kind)


PROTECTED = {"validators.py": "def check(...): ...", "release_thresholds.json": '{"min_gain": 1}'}


def digest(files: dict[str, str]) -> str:
    return hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()[:12]


def release_gate(stable: set[str], candidate: set[str], boundary: list[Task], retention: list[Task],
                 touched_files: set[str], protected_hash: str) -> dict:
    score = lambda rules, tasks: sum(run_agent(rules, t) for t in tasks)  # noqa: E731
    b0, b1 = score(stable, boundary), score(candidate, boundary)
    broken = [t.id for t in retention if run_agent(stable, t) and not run_agent(candidate, t)]
    checks = {
        "boundary_improves": b1 > b0,
        "retention_no_regression": not broken,
        "does_not_touch_trust_root": not (touched_files & PROTECTED.keys()) and digest(PROTECTED) == protected_hash,
    }
    decision = "release_to_canary" if all(checks.values()) else "reject_candidate"
    return {"decision": decision, "boundary": f"{b0}/{len(boundary)} → {b1}/{len(boundary)}",
            "broken_retention": broken, "checks": checks, "diff": sorted(candidate - stable)}


# ── 3. Đánh giá dài hạn: static / append_only / evolving ─────────────────────
@dataclass
class Memory:
    mode: str
    rules: dict[str, tuple[str, int]] = field(default_factory=dict)   # topic → (giá trị, version)
    retired: list[tuple[str, str]] = field(default_factory=list)

    def answer(self, topic: str) -> str | None:
        return self.rules.get(topic, (None, 0))[0]

    def feedback(self, topic: str, correct: str) -> None:
        """Chỉ gọi SAU khi task kết thúc — không lộ đáp án cho task hiện tại."""
        if self.mode == "static":
            return
        if topic not in self.rules:
            self.rules[topic] = (correct, 1)
        elif self.rules[topic][0] != correct and self.mode == "evolving":
            old, ver = self.rules[topic]
            self.retired.append((topic, old))                 # giữ provenance, không xóa mất dấu
            self.rules[topic] = (correct, ver + 1)
        # append_only: đã có thì giữ bản đầu tiên, không giải quyết xung đột


STREAM = [
    ("learning", "refund_window", "30 ngày"), ("learning", "id_check", "4 số cuối thẻ"),
    ("learning", "baggage_limit", "20 kg"), ("learning", "refund_window", "30 ngày"),
    ("transfer", "id_check", "4 số cuối thẻ"), ("transfer", "baggage_limit", "20 kg"),
    ("transfer", "refund_window", "30 ngày"),
    ("rule_change", "baggage_limit", "23 kg"), ("rule_change", "baggage_limit", "23 kg"),
    ("rule_change", "baggage_limit", "23 kg"),
    ("retention", "refund_window", "30 ngày"), ("retention", "id_check", "4 số cuối thẻ"),
    ("retention", "baggage_limit", "23 kg"), ("retention", "id_check", "4 số cuối thẻ"),
]


def long_term_eval(mode: str) -> dict[str, str]:
    mem, per_stage = Memory(mode), defaultdict(lambda: [0, 0])
    for stage, topic, correct in STREAM:
        ok = mem.answer(topic) == correct
        per_stage[stage][0] += ok
        per_stage[stage][1] += 1
        mem.feedback(topic, correct)
    out = {s: f"{a}/{n}" for s, (a, n) in per_stage.items()}
    out["cites_retired"] = str(mem.answer("baggage_limit") == "20 kg")
    return out


def main() -> None:
    print("1) Experience → knowledge (ngưỡng ủng hộ = 3, không có phản bác)")
    runs = [
        RunAnalysis("r1", "booking", "success", ["kiểm hạn đặt suất ăn đặc biệt trước khi thanh toán"]),
        RunAnalysis("r2", "booking", "success", ["kiểm hạn đặt suất ăn đặc biệt trước khi thanh toán", "gọi search 2 lần"]),
        RunAnalysis("r3", "booking", "success", ["kiểm hạn đặt suất ăn đặc biệt trước khi thanh toán"]),
        RunAnalysis("r4", "booking", "success", ["dùng endpoint /v1/fare cũ"], api_version="v1"),
        RunAnalysis("r5", "booking", "success", ["dùng endpoint /v1/fare cũ"], api_version="v1"),
        RunAnalysis("r6", "booking", "success", ["dùng endpoint /v1/fare cũ"], api_version="v1"),
        RunAnalysis("r7", "booking", "failure", ["dùng endpoint /v1/fare cũ"], api_version="v2"),
        RunAnalysis("r8", "booking", "unscored", ["bỏ qua bước xác minh danh tính"]),
    ]
    for pattern, row in distill(runs).items():
        print(f"   [{row['status']:<9}] {pattern}  (ủng hộ {row['support']}, phản bác {row['contradict']}, API {row['versions']})")
    print("   → mẫu hình /v1 từng đúng 3 lần nhưng thất bại ở API v2: cần thu hẹp điều kiện áp dụng, không promote.")

    print("\n2) Release gate cho bản vá Prompt (τ²-bench telecom, rút từ 19 trajectory thất bại)")
    boundary = [Task("missing_param", f"b{i}") for i in range(4)] + [Task("user_device", f"b{i}") for i in range(4, 7)]
    retention = [Task("transient_error", "k1"), Task("transient_error", "k2"), Task("asks_human", "k3")]
    stable: set[str] = set()
    trust_hash = digest(PROTECTED)
    cand_a = {"ask_user_for_missing_param", "guide_user_for_user_side_tools", "escalate_after_3_failures"}
    cand_b = {"ask_user_for_missing_param", "guide_user_for_user_side_tools"}
    for name, cand, touched in (("A (model tự rút, có luật chuyển người)", cand_a, {"policy.md"}),
                                ("B (bỏ luật chuyển người)", cand_b, {"policy.md"}),
                                ("C (B + tự hạ ngưỡng release)", cand_b, {"policy.md", "release_thresholds.json"})):
        res = release_gate(stable, cand, boundary, retention, touched, trust_hash)
        print(f"   Ứng viên {name}: {res['decision']}")
        print(f"      boundary {res['boundary']}, retention bị hỏng: {res['broken_retention'] or 'không'}, checks: "
              + ", ".join(f"{k}={'✓' if v else '✗'}" for k, v in res["checks"].items()))

    print("\n3) Đánh giá dài hạn (14 task: learning → transfer → rule_change 20→23 kg → retention)")
    for mode in ("static", "append_only", "evolving"):
        r = long_term_eval(mode)
        print(f"   {mode:<12} learning {r['learning']}  transfer {r['transfer']}  rule_change {r['rule_change']}  "
              f"retention {r['retention']}  còn trích luật cũ: {r['cites_retired']}")
    print("   → chỉ 'evolving' thay luật cũ bằng bằng chứng mới; append_only nhớ mãi bản đầu tiên.")


if __name__ == "__main__":
    main()
