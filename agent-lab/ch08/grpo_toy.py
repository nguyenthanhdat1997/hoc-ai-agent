"""Bài 8.1 — GRPO thu nhỏ: thấy tận mắt RL học từ đâu (Chương 8 · mục 8.1, 8.9, 8.12.4). Không cần model, không cần GPU.

"Model" ở đây là một policy rất nhỏ: chọn 1 trong vài chiến lược sửa bug, mỗi chiến lược có xác suất pass test
riêng. Thay vì cập nhật hàng tỷ tham số, ta cập nhật vài logit — nhưng vòng lặp y hệt trong sách:

  rollout 16 lần → chấm reward → relative advantage (so trong nhóm) → policy gradient → lặp lại

  1. Advantage của Hình 8-13: 1/4 đúng → A = +1.73 / −0.58; cả nhóm cùng điểm → A = 0 (không có gradient)
  2. Chọn giai đoạn: pass@k ≈ 0 → Mid-training; parse fail → SFT; có reward variance → RL
  3. Pass@k ≈ 0: GRPO giậm chân tại chỗ; "SFT cold start" mở đường rồi RL mới học được
  4. RLVP: chỉ thưởng outcome thì hành vi vi phạm vẫn được củng cố; thêm path penalty → vi phạm biến mất
  5. Sampler/trainer mismatch: lệch 0.001 mỗi token × 4.000 token → ratio ≈ e^4 ≈ 54.6

Chạy:  python3 ch08/grpo_toy.py
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass


# ── 1. Relative advantage ───────────────────────────────────────────────────
def group_advantage(rewards: list[float]) -> list[float]:
    """A_i = (R_i − mean) / std. Không cần value network: so với chính các rollout cùng đề."""
    m = sum(rewards) / len(rewards)
    std = math.sqrt(sum((r - m) ** 2 for r in rewards) / len(rewards))
    if std < 1e-8:
        return [0.0] * len(rewards)  # cả nhóm cùng điểm → không phân biệt được → không học
    return [(r - m) / std for r in rewards]


# ── 2. Chọn giai đoạn huấn luyện (Bảng 8-4, rút gọn) ─────────────────────────
def choose_stage(pass_at_k: float, parse_rate: float, reward_variance: bool) -> str:
    if pass_at_k < 0.01:
        return "Mid-training (hoặc SFT/distillation để mở rộng support) — RL chưa có trajectory dương nào để học"
    if parse_rate < 0.9:
        return "SFT ổn định format trước — reward không tính được trên output parse lỗi"
    if not reward_variance:
        return "Thiết kế lại reward (partial progress / path signal) — nhóm toàn đúng hoặc toàn sai thì A = 0"
    return "RL (GRPO/PPO) — đã có trajectory chấm được và reward có chênh lệch trong nhóm"


# ── 3–4. Policy nhỏ + GRPO ──────────────────────────────────────────────────
@dataclass
class Strategy:
    name: str
    p_pass: float        # xác suất hidden test pass
    violation: bool      # vi phạm đường đi (sửa test, chạy lệnh phá hoại...) — verifier phát hiện được, rẻ


class Policy:
    def __init__(self, strategies: list[Strategy], logits: list[float]):
        self.s, self.logits = strategies, list(logits)

    def probs(self) -> list[float]:
        mx = max(self.logits)
        e = [math.exp(x - mx) for x in self.logits]
        return [x / sum(e) for x in e]

    def sample(self, rng: random.Random) -> int:
        return rng.choices(range(len(self.s)), weights=self.probs())[0]


def grpo(policy: Policy, steps: int, group: int = 16, lr: float = 0.3, beta: float = 0.0,
         seed: int = 0, log_every: int = 10) -> None:
    rng = random.Random(seed)
    for step in range(steps + 1):
        if step % log_every == 0:
            pr = policy.probs()
            ok = sum(p * s.p_pass for p, s in zip(pr, policy.s))
            vio = sum(p for p, s in zip(pr, policy.s) if s.violation)
            top = max(range(len(pr)), key=pr.__getitem__)
            print(f"   step {step:>3}  success ≈ {ok:5.1%}  violation ≈ {vio:5.1%}  "
                  f"hay chọn nhất: {policy.s[top].name} ({pr[top]:.0%})")
        if step == steps:
            break
        # Bước 1: rollout cả nhóm bằng policy HIỆN TẠI (on-policy)
        picks = [policy.sample(rng) for _ in range(group)]
        # Bước 2: reward R = O + β·Φ (outcome từ hidden test, path signal từ rule tất định)
        rewards = [float(rng.random() < policy.s[a].p_pass) - beta * policy.s[a].violation for a in picks]
        # Bước 3: relative advantage trong nhóm
        adv = group_advantage(rewards)
        # Bước 4: policy gradient cho softmax: ∂log π(a)/∂logit_j = 1[j=a] − π_j
        pr = policy.probs()
        grad = [0.0] * len(pr)
        for a, A in zip(picks, adv):
            for j in range(len(pr)):
                grad[j] += A * ((j == a) - pr[j]) / group
        policy.logits = [x + lr * g for x, g in zip(policy.logits, grad)]


BUGFIX = [
    Strategy("tái hiện→sửa→chạy test", 0.6, False),
    Strategy("sửa nhanh + xóa test fail", 0.6, True),
    Strategy("nuốt exception", 0.1, False),
    Strategy("báo bất khả thi", 0.0, False),
]

HARD = [
    Strategy("thử đại", 0.0, False),
    Strategy("đọc docs sai phiên bản", 0.0, False),
    Strategy("gọi API nội bộ đúng cách", 0.9, False),
]


def main() -> None:
    print("1) Relative advantage (Hình 8-13: 24 game, 1 trong 4 rollout đúng)")
    print("   R = [0, 1, 0, 0] → A =", [f"{a:+.2f}" for a in group_advantage([0, 1, 0, 0])])
    print("   16 rollout, 4 pass →", f"A(pass) = {group_advantage([1]*4 + [0]*12)[0]:+.2f}, A(fail) = {group_advantage([1]*4 + [0]*12)[-1]:+.2f}")
    print("   16/16 fail →", set(group_advantage([0] * 16)), " 16/16 pass →", set(group_advantage([1] * 16)), " (không có tín hiệu)")

    print("\n2) Chọn giai đoạn huấn luyện")
    for args in ((0.0, 0.95, False), (0.3, 0.6, True), (0.98, 0.99, False), (0.4, 0.97, True)):
        print(f"   pass@k={args[0]:.2f}, parse={args[1]:.0%}, variance={args[2]!s:<5} → {choose_stage(*args)}")

    print("\n3) Pass@k ≈ 0: chiến lược đúng gần như không bao giờ được lấy mẫu (logit −9)")
    pol = Policy(HARD, [0, 0, -9])
    grpo(pol, steps=40, log_every=20)
    print("   → nhóm 16 rollout toàn 0 điểm, advantage = 0, RL không học được gì.")
    print("   Sau 'SFT cold start' (vài demonstration đẩy logit lên −1):")
    pol.logits[2] = -1
    grpo(pol, steps=40, log_every=20)

    print("\n4a) Chỉ thưởng outcome (β = 0): hai chiến lược pass ngang nhau đều được củng cố")
    grpo(Policy(BUGFIX, [0, 0, 0, 0]), steps=60, beta=0.0, log_every=20)
    print("\n4b) RLVP: R = O − β·violation (β = 0.5): reward the outcome, penalize the path")
    grpo(Policy(BUGFIX, [0, 0, 0, 0]), steps=60, beta=0.5, log_every=20)
    print("   → success gần như không đổi, violation giảm mạnh (giống TerminalBench: 3.71 → 0.66).")

    print("\n5) Vì sao lệch số học giữa sampler và trainer nguy hiểm")
    for n, d in ((100, 1e-3), (4000, 1e-3), (4000, 1e-4)):
        print(f"   {n:>5} token, lệch log-prob {d:g}/token cùng chiều → ratio ρ = e^{n*d:g} ≈ {math.exp(n*d):.2f}")
    print("   On-policy thật thì ρ = 1 trước khi update. Hãy đo ρ (mean, max, clip fraction) như một unit test.")


if __name__ == "__main__":
    main()
