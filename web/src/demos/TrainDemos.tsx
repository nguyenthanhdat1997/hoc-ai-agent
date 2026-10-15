import { useState } from "react";
import { Stat } from "../components/ui";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function advantage(r: number[]) {
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length);
  return sd < 1e-8 ? r.map(() => 0) : r.map((x) => (x - m) / sd);
}

// 16 rollout của cùng một đề: bấm để đổi pass/fail và vi phạm, xem relative advantage của GRPO.
export function GRPOGroup() {
  const [pass, setPass] = useState<boolean[]>(Array.from({ length: 16 }, (_, i) => i < 4));
  const [vio, setVio] = useState<boolean[]>(Array.from({ length: 16 }, (_, i) => i === 1 || i === 9));
  const [beta, setBeta] = useState(0);
  const rewards = pass.map((p, i) => (p ? 1 : 0) - beta * (vio[i] ? 1 : 0));
  const adv = advantage(rewards);
  const flat = adv.every((a) => a === 0);
  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small" onClick={() => setPass(pass.map(() => false))}>Cả nhóm fail</button>
        <button className="btn small" onClick={() => setPass(pass.map(() => true))}>Cả nhóm pass</button>
        <button className="btn small" onClick={() => setPass(pass.map((_, i) => i < 4))}>4/16 pass</button>
      </div>
      <label className="small">β (path penalty, RLVP) = <b>{beta.toFixed(1)}</b>
        <input type="range" min={0} max={1} step={0.1} value={beta} onChange={(e) => setBeta(+e.target.value)} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 6, margin: "10px 0" }}>
        {pass.map((p, i) => (
          <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 6, textAlign: "center", background: p ? "var(--ok-soft)" : "var(--surface-2)" }}>
            <div className="small muted">#{i + 1}</div>
            <button className="btn small" style={{ padding: "2px 6px" }} onClick={() => setPass(pass.map((x, j) => (j === i ? !x : x)))}>{p ? "✓" : "✗"}</button>
            <button className="btn small" style={{ padding: "2px 6px", marginTop: 4 }} title="vi phạm đường đi" onClick={() => setVio(vio.map((x, j) => (j === i ? !x : x)))}>{vio[i] ? "⚠" : "·"}</button>
            <div className="small" style={{ fontWeight: 600, color: adv[i] > 0 ? "var(--ok)" : adv[i] < 0 ? "var(--bad)" : "var(--muted)" }}>
              {adv[i] >= 0 ? "+" : ""}{adv[i].toFixed(2)}
            </div>
          </div>
        ))}
      </div>
      <div className={"callout " + (flat ? "warn" : "ok")}>
        {flat
          ? "Mọi reward bằng nhau → advantage = 0 → không có gradient. Thêm path signal (β > 0 và vài ⚠) hoặc partial reward để khôi phục chênh lệch."
          : "Rollout trên trung bình nhóm được đẩy xác suất lên, dưới trung bình bị kéo xuống. Không cần value network."}
      </div>
      <p className="small muted">✓/✗ = hidden test pass/fail · ⚠ = vi phạm (xóa test, lệnh phá hoại) do rule tất định phát hiện. R = O − β·violation, A = (R − mean)/std.</p>
    </div>
  );
}

type S = { name: string; p: number; v: boolean };
const BUGFIX: S[] = [
  { name: "tái hiện → sửa → chạy test", p: 0.6, v: false },
  { name: "sửa nhanh + xóa test fail", p: 0.6, v: true },
  { name: "nuốt exception", p: 0.1, v: false },
  { name: "báo bất khả thi", p: 0, v: false },
];

function softmax(l: number[]) {
  const mx = Math.max(...l);
  const e = l.map((x) => Math.exp(x - mx));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mini GRPO chạy ngay trong trình duyệt: cùng thuật toán với agent-lab/ch08/grpo_toy.py.
export function MiniRL() {
  const [beta, setBeta] = useState(0);
  const [steps, setSteps] = useState(0);
  const [logits, setLogits] = useState([0, 0, 0, 0]);
  const [seed, setSeed] = useState(1);

  const run = (n: number) => {
    const rnd = mulberry(seed * 7919 + steps);
    let l = [...logits];
    for (let s = 0; s < n; s++) {
      const pr = softmax(l);
      const picks = Array.from({ length: 16 }, () => {
        let u = rnd(), k = 0;
        while (k < pr.length - 1 && u > pr[k]) { u -= pr[k]; k++; }
        return k;
      });
      const r = picks.map((a) => (rnd() < BUGFIX[a].p ? 1 : 0) - beta * (BUGFIX[a].v ? 1 : 0));
      const A = advantage(r);
      const g = pr.map(() => 0);
      picks.forEach((a, i) => pr.forEach((p, j) => (g[j] += (A[i] * ((j === a ? 1 : 0) - p)) / 16)));
      l = l.map((x, j) => x + 0.3 * g[j]);
    }
    setLogits(l);
    setSteps(steps + n);
  };
  const reset = () => { setLogits([0, 0, 0, 0]); setSteps(0); setSeed(seed + 1); };
  const pr = softmax(logits);
  const ok = pr.reduce((a, p, i) => a + p * BUGFIX[i].p, 0);
  const vio = pr.reduce((a, p, i) => a + (BUGFIX[i].v ? p : 0), 0);

  return (
    <div>
      <label className="small">β (path penalty) = <b>{beta.toFixed(1)}</b> {beta === 0 ? "— chỉ thưởng outcome" : "— RLVP"}
        <input type="range" min={0} max={1} step={0.1} value={beta} onChange={(e) => setBeta(+e.target.value)} />
      </label>
      <div className="row" style={{ margin: "8px 0" }}>
        <button className="btn small primary" onClick={() => run(10)}>+10 step</button>
        <button className="btn small" onClick={() => run(50)}>+50 step</button>
        <button className="btn small" onClick={reset}>Làm lại</button>
        <span className="small muted">step {steps} · 16 rollout/step</span>
      </div>
      {BUGFIX.map((s, i) => (
        <div key={s.name} className="row" style={{ flexWrap: "nowrap", gap: 8, margin: "4px 0" }}>
          <span className="small" style={{ width: 190, flexShrink: 0 }}>{s.v ? "⚠ " : ""}{s.name} <span className="muted">({Math.round(s.p * 100)}%)</span></span>
          <div className="meter" style={{ flex: 1 }}>
            <div className="fill" style={{ width: `${pr[i] * 100}%`, background: s.v ? "var(--bad)" : "var(--accent)", opacity: 0.75 }} />
          </div>
          <span className="small" style={{ width: 44, textAlign: "right" }}>{Math.round(pr[i] * 100)}%</span>
        </div>
      ))}
      <div className="stats">
        <Stat v={pct(ok)} k="Success rate kỳ vọng" />
        <Stat v={<span style={{ color: vio > 0.2 ? "var(--bad)" : "var(--ok)" }}>{pct(vio)}</span>} k="Tỷ lệ hành vi vi phạm" />
      </div>
      <p className="small muted">
        Thử β = 0 rồi β = 0,5. Hai chiến lược đầu pass test như nhau, nên reward chỉ dựa vào outcome không phân biệt được chúng —
        RL củng cố cả hành vi xóa test. Path penalty là thứ verifier phát hiện rẻ và chắc chắn.
      </p>
    </div>
  );
}

export function RatioDrift() {
  const [len, setLen] = useState(4000);
  const [exp, setExp] = useState(-3);
  const d = 10 ** exp;
  const rho = Math.exp(len * d);
  return (
    <div>
      <div className="grid two">
        <label className="small">Độ dài trajectory = <b>{len}</b> token
          <input type="range" min={100} max={20000} step={100} value={len} onChange={(e) => setLen(+e.target.value)} />
        </label>
        <label className="small">Lệch log-prob mỗi token = <b>{d.toExponential(0)}</b>
          <input type="range" min={-5} max={-2} step={0.5} value={exp} onChange={(e) => setExp(+e.target.value)} />
        </label>
      </div>
      <div className="stats">
        <Stat v={<span style={{ color: rho > 1.2 ? "var(--bad)" : "var(--ok)" }}>{rho > 1e6 ? rho.toExponential(1) : rho.toFixed(2)}</span>} k="Trajectory ratio ρ = e^(n·δ) (đáng lẽ = 1)" />
      </div>
      <p className="small muted">
        Sampler (vLLM/SGLang) và trainer (FSDP/Megatron) cùng weight nhưng khác precision, thứ tự cộng, kernel → log-prob lệch chút ít.
        Trên chuỗi dài, sai số nhỏ cộng dồn thành ratio khổng lồ: on-policy trên danh nghĩa thành off-policy. Đo ρ trước mỗi update.
      </p>
    </div>
  );
}
