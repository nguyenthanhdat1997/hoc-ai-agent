"""Bài 10.1 — Hạ tầng đa Agent, thu nhỏ (Chương 10 · mục 10.2, 10.4, 10.5). Không cần model.

"Agent" ở đây là các thread Python giả lập — nhưng các vấn đề điều phối là thật:

  1. Proposer–Reviewer: reviewer tự đọc lại (không có thông tin mới) vs reviewer chạy test (có execution feedback)
  2. Manager song song + message bus: cascading termination, settle_once chống race condition
  3. Shared file system: lost update khi không khóa vs optimistic locking (version check + retry)
  4. Handoff kiểu Swarm: task package, visited_agents chống vòng lặp, remaining_budget

Chạy:  python3 ch10/multi_agent.py
"""

from __future__ import annotations

import queue
import random
import threading
import time
from dataclasses import dataclass, field


# ── 1. Proposer–Reviewer ────────────────────────────────────────────────────
CANDIDATES = [
    "def median(xs): return sorted(xs)[len(xs) // 2]",
    "def median(xs):\n    s = sorted(xs); n = len(s)\n    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2",
]
TESTS = [([3, 1, 2], 2), ([4, 1, 3, 2], 2.5), ([5], 5)]


def self_review(code: str) -> list[str]:
    """Cùng model đọc lại chính output của mình: không có thông tin mới → thường thấy “ổn”."""
    return [] if "sorted" in code else ["chưa sắp xếp"]


def execution_review(code: str) -> list[str]:
    """Reviewer chạy test: bằng chứng độc lập mà proposer không có lúc viết code."""
    ns: dict = {}
    exec(code, ns)  # noqa: S102 — code mẫu cố định trong bài lab
    return [f"median({xs}) = {ns['median'](xs)}, kỳ vọng {want}" for xs, want in TESTS if ns["median"](xs) != want]


def proposer_reviewer(review, max_rounds: int = 3) -> None:
    for rnd in range(max_rounds):
        code = CANDIDATES[min(rnd, len(CANDIDATES) - 1)]   # proposer sửa khi nhận findings cụ thể
        findings = review(code)
        print(f"   vòng {rnd + 1}: {'PASS' if not findings else 'VETO → ' + '; '.join(findings)}")
        if not findings:
            ok = not execution_review(code)
            print(f"   → publish. Kiểm độc lập sau cùng: {'đúng' if ok else 'SAI — self-review đã cho qua code lỗi'}")
            return
    print("   → hết ngân sách, escalate")


# ── 2. Manager song song: cascading termination + settle_once ───────────────
@dataclass
class Msg:
    sender: str
    type: str          # status_update | target_found | not_found | ack
    payload: dict = field(default_factory=dict)


class Manager:
    def __init__(self) -> None:
        self.bus: queue.Queue[Msg] = queue.Queue()
        self._lock = threading.Lock()
        self.winner: str | None = None
        self.aggregations = 0

    def settle_once(self, agent_id: str) -> bool:
        """Nguyên tử: chỉ một báo cáo thành công được chấp nhận."""
        with self._lock:
            if self.winner is not None:
                return False
            self.winner = agent_id
            return True


def search_worker(agent_id: str, site: dict, target: str, bus: queue.Queue, stop: threading.Event, unit: float) -> None:
    bus.put(Msg(agent_id, "status_update", {"state": "loading"}))
    for step in range(site["pages"]):
        if stop.is_set():                       # kiểm tín hiệu dừng ở điểm an toàn (graceful)
            bus.put(Msg(agent_id, "ack", {"stopped_at_page": step}))
            return
        time.sleep(unit)
        if target in site["staff"] and step == site["staff"].index(target):
            bus.put(Msg(agent_id, "target_found", {"site": site["name"], "page": step}))
            stop.wait()                          # chờ manager quyết, rồi ack
            bus.put(Msg(agent_id, "ack", {}))
            return
    bus.put(Msg(agent_id, "not_found", {}))


def parallel_search(sites: list[dict], target: str, unit: float = 0.01, use_lock: bool = True) -> tuple[str, float, int]:
    mgr, t0 = Manager(), time.time()
    stops = {f"agent_{i}": threading.Event() for i in range(len(sites))}
    for (aid, ev), site in zip(stops.items(), sites):
        threading.Thread(target=search_worker, args=(aid, site, target, mgr.bus, ev, unit), daemon=True).start()
    running, result = set(stops), "không tìm thấy"
    while running:
        m = mgr.bus.get(timeout=5)
        if m.type == "target_found":
            accepted = mgr.settle_once(m.sender) if use_lock else True
            if accepted:
                mgr.aggregations += 1
                result = f"{m.sender} tìm thấy ở {m.payload['site']}"
                for aid, ev in stops.items():
                    ev.set()                     # broadcast terminate
        elif m.type in ("not_found", "ack"):
            running.discard(m.sender)
    return result, time.time() - t0, mgr.aggregations


def serial_time(sites: list[dict], unit: float) -> float:
    return sum(s["pages"] for s in sites) * unit


# ── 3. Shared file system: optimistic locking ───────────────────────────────
class SharedFS:
    def __init__(self) -> None:
        self.files: dict[str, tuple[str, int]] = {}
        self._lock = threading.Lock()

    def read(self, path: str) -> tuple[str, int]:
        return self.files.get(path, ("", 0))

    def write(self, path: str, content: str, expected_version: int | None = None) -> bool:
        with self._lock:
            _, ver = self.files.get(path, ("", 0))
            if expected_version is not None and ver != expected_version:
                return False                     # có người sửa sau khi mình đọc → đọc lại, làm lại
            self.files[path] = (content, ver + 1)
            return True


def add_terms(fs: SharedFS, agent: str, terms: list[str], optimistic: bool, retries: list[int]) -> None:
    for term in terms:
        while True:
            content, ver = fs.read("glossary.md")
            time.sleep(random.uniform(0, 0.002))            # "suy nghĩ" giữa lúc đọc và ghi
            new = content + f"{term}\n"
            if fs.write("glossary.md", new, ver if optimistic else None):
                break
            retries[0] += 1


def glossary_race(optimistic: bool) -> tuple[int, int]:
    random.seed(7)
    fs, retries = SharedFS(), [0]
    a = threading.Thread(target=add_terms, args=(fs, "A", [f"term_a{i}" for i in range(20)], optimistic, retries))
    b = threading.Thread(target=add_terms, args=(fs, "B", [f"term_b{i}" for i in range(20)], optimistic, retries))
    a.start(); b.start(); a.join(); b.join()
    return len(fs.read("glossary.md")[0].splitlines()), retries[0]


# ── 4. Handoff kiểu Swarm ──────────────────────────────────────────────────
ROUTES = {"triage": "billing", "billing": "tech", "tech": "billing"}   # billing ↔ tech đá qua đá lại


def handoff_run(start: str, budget: int, cycle_check: bool) -> list[str]:
    package = {"task_id": "T42", "goal": "hoàn phí bị trừ 2 lần", "accepted_facts": ["mã đơn 8812"],
               "artifact_refs": ["/workspace/shared/invoice_8812.pdf"], "remaining_budget": budget,
               "visited_agents": [start]}
    log, agent = [start], start
    while True:
        nxt = ROUTES[agent]
        if cycle_check and nxt in package["visited_agents"]:
            log.append(f"reject('cycle': {agent}→{nxt}) → escalate cho người")
            return log
        if package["remaining_budget"] <= 0:
            log.append("hết budget → stop_and_escalate")
            return log
        package["remaining_budget"] -= 1
        package["visited_agents"].append(nxt)
        log.append(nxt)
        agent = nxt


def main() -> None:
    print("1) Proposer–Reviewer: review có thêm thông tin mới hay không?")
    print("   a) Self-review (đọc lại chính mình):")
    proposer_reviewer(self_review)
    print("   b) Reviewer chạy test (execution feedback):")
    proposer_reviewer(execution_review)

    print("\n2) Manager song song tìm giảng viên “Zhang Wei” trên 10 trang khoa")
    rng = random.Random(3)
    sites = [{"name": f"khoa_{i}.edu", "pages": rng.randint(5, 12), "staff": []} for i in range(10)]
    sites[3]["staff"] = ["x", "y", "Zhang Wei"]
    print(f"   Tuần tự ≈ {serial_time(sites, 0.01):.2f}s")
    res, dt, agg = parallel_search(sites, "Zhang Wei")
    print(f"   Song song + cascading termination: {res}, {dt:.2f}s, số lần tổng hợp kết quả = {agg}")
    sites[7]["staff"] = ["x", "y", "Zhang Wei"]   # hai agent tìm thấy gần như cùng lúc
    _, _, agg_lock = parallel_search(sites, "Zhang Wei", use_lock=True)
    _, _, agg_nolock = parallel_search(sites, "Zhang Wei", use_lock=False)
    print(f"   Hai agent cùng tìm thấy: có settle_once → tổng hợp {agg_lock} lần; không khóa → {agg_nolock} lần (race condition)")

    print("\n3) Hai agent cùng thêm 20 thuật ngữ vào glossary.md")
    n, _ = glossary_race(optimistic=False)
    print(f"   Không khóa: còn {n}/40 dòng (lost update — bản ghi sau đè bản ghi trước)")
    n, r = glossary_race(optimistic=True)
    print(f"   Optimistic locking: {n}/40 dòng, {r} lần phải đọc lại và làm lại")

    print("\n4) Handoff kiểu Swarm (billing ↔ tech đá qua đá lại)")
    print("   Không kiểm vòng, budget 6:", " → ".join(handoff_run("triage", 6, cycle_check=False)))
    print("   Có visited_agents:       ", " → ".join(handoff_run("triage", 6, cycle_check=True)))


if __name__ == "__main__":
    main()
