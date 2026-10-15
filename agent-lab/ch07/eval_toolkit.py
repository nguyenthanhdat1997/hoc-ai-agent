"""Bài 7.1 — Bộ công cụ thống kê cho đánh giá Agent (Chương 7 · mục 7.2, 7.5.4, 7.7). Không cần model.

  1. Pass@k vs Pass^k: cùng success rate một lần p, hai câu hỏi rất khác nhau
  2. Standard error & khoảng tin cậy 95%: 73% vs 70% trên 100 case có đáng để đổi model không?
  3. Paired analysis (McNemar + paired bootstrap) trên CÙNG một bộ task
  4. Elo từ dữ liệu so sánh từng cặp, có hoán đổi vị trí để khử position bias
  5. Rubric aggregation có trọng số và veto (hallucination → 0 điểm)

Chạy:  python3 ch07/eval_toolkit.py
"""

from __future__ import annotations

import math
import random


# ── 1. Pass@k vs Pass^k ─────────────────────────────────────────────────────
def pass_at_k(p: float, k: int) -> float:
    return 1 - (1 - p) ** k  # ít nhất 1 lần thành công trong k lần — trần năng lực


def pass_hat_k(p: float, k: int) -> float:
    return p ** k  # thành công cả k lần liên tiếp — độ tin cậy nghiệp vụ


# ── 2. Standard error ───────────────────────────────────────────────────────
def ci95(p: float, n: int) -> tuple[float, float]:
    se = math.sqrt(p * (1 - p) / n)
    return p - 1.96 * se, p + 1.96 * se


# ── 3. Paired analysis ──────────────────────────────────────────────────────
def mcnemar(a: list[bool], b: list[bool]) -> float:
    """Chỉ những task mà hai cấu hình KHÁC kết quả mới mang thông tin. Trả về p-value (xấp xỉ chi-square, có hiệu chỉnh)."""
    only_a = sum(x and not y for x, y in zip(a, b))
    only_b = sum(y and not x for x, y in zip(a, b))
    if only_a + only_b == 0:
        return 1.0
    stat = (abs(only_a - only_b) - 1) ** 2 / (only_a + only_b)
    return math.erfc(math.sqrt(stat / 2))  # p-value của chi-square 1 bậc tự do


def paired_bootstrap(a: list[bool], b: list[bool], iters: int = 5000, seed: int = 0) -> tuple[float, float]:
    rng = random.Random(seed)
    deltas = [int(y) - int(x) for x, y in zip(a, b)]
    means = sorted(sum(rng.choice(deltas) for _ in deltas) / len(deltas) for _ in range(iters))
    return means[int(0.025 * iters)], means[int(0.975 * iters)]


# ── 4. Elo ──────────────────────────────────────────────────────────────────
def elo(matches: list[tuple[str, str, float]], k: float = 16) -> dict[str, float]:
    """matches: (model_a, model_b, score_a) với score_a = 1 thắng, 0 thua, 0.5 hòa."""
    r: dict[str, float] = {}
    for a, b, s in matches:
        ra, rb = r.setdefault(a, 1000), r.setdefault(b, 1000)
        expected = 1 / (1 + 10 ** ((rb - ra) / 400))
        r[a] = ra + k * (s - expected)
        r[b] = rb - k * (s - expected)  # thắng bất ngờ → điều chỉnh lớn hơn
    return dict(sorted(r.items(), key=lambda x: -x[1]))


def judge_pair_debiased(judge, x: str, y: str) -> float:
    """Chấm hai lần có hoán đổi vị trí; chỉ tính khi hai lần nhất quán, không thì hòa."""
    first = judge(x, y)          # 1 nếu ứng viên ở vị trí đầu tốt hơn
    second = 1 - judge(y, x)
    return first if first == second else 0.5


# ── 5. Rubric có veto ───────────────────────────────────────────────────────
WEIGHTS = {"essential": 3, "important": 2, "optional": 1}


def rubric_score(scores: dict[str, tuple[str, int]], veto_failed: bool) -> float:
    """scores: tên chiều → (mức trọng số, điểm 1–4). Veto (vd hallucination) fail thì tổng = 0."""
    if veto_failed:
        return 0.0
    total = sum(WEIGHTS[w] * s for w, s in scores.values())
    return total / sum(WEIGHTS[w] * 4 for w, _ in scores.values())


def main() -> None:
    print("1) Pass@k vs Pass^k (p = 0.6)")
    for k in (1, 3, 5, 10):
        print(f"   k={k:<2}  Pass@k = {pass_at_k(0.6, k):6.1%}   Pass^k = {pass_hat_k(0.6, k):6.1%}")

    print("\n2) Khoảng tin cậy 95%")
    for p, n in ((0.70, 100), (0.73, 100), (0.70, 1000)):
        lo, hi = ci95(p, n)
        print(f"   p={p:.0%}, n={n:<5} → [{lo:.1%}, {hi:.1%}]")
    print("   → 73% vs 70% trên 100 case: hai khoảng chồng lên nhau, CHƯA đủ để đổi model.")

    print("\n3) Paired analysis trên cùng 200 task")
    rng = random.Random(42)
    difficulty = [rng.random() for _ in range(200)]
    a = [d < 0.70 for d in difficulty]                                  # cấu hình A: ~70%
    b = [d < 0.70 or (d < 0.78 and rng.random() < 0.6) for d in difficulty]  # B sửa được một số task khó hơn
    print(f"   A = {sum(a)/200:.1%}, B = {sum(b)/200:.1%}")
    print(f"   McNemar p-value = {mcnemar(a, b):.4f}")
    lo, hi = paired_bootstrap(a, b)
    print(f"   Paired bootstrap 95% CI của (B − A) = [{lo:+.1%}, {hi:+.1%}]  {'→ B tốt hơn thật' if lo > 0 else '→ chưa chắc'}")

    print("\n4) Elo từ so sánh từng cặp (ground truth: X > Y > Z)")
    strength = {"X": 0.75, "Y": 0.6, "Z": 0.45}
    rng = random.Random(1)
    biased_judge = lambda p, q: 1 if rng.random() < 0.15 else int(strength[p] + rng.gauss(0, 0.1) > strength[q])  # noqa: E731
    matches = []
    for _ in range(600):
        p, q = rng.sample(list(strength), 2)
        matches.append((p, q, judge_pair_debiased(biased_judge, p, q)))
    print("   " + "  ".join(f"{m}: {r:.0f}" for m, r in elo(matches).items()))
    print("   Gợi ý: chênh 200 điểm Elo ≈ 76% xác suất thắng.")

    print("\n5) Rubric có veto (câu hỏi “Bác sĩ nhi của con gái tôi là ai?”)")
    dims = {"Factual Correctness": ("essential", 4), "Completeness": ("important", 3),
            "Reasoning Correctness": ("important", 4)}
    print(f"   Không bịa thông tin   → {rubric_score(dims, veto_failed=False):.0%}")
    print(f"   Bịa ngày khám (veto)  → {rubric_score(dims, veto_failed=True):.0%}")


if __name__ == "__main__":
    main()
