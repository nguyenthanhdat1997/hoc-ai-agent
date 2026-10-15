import { useMemo, useState } from "react";
import { Stat } from "../components/ui";

type Strategy = "none" | "eager" | "adaptive";
const WINDOW = 128_000;
const PREFIX = 3_000;
const ROUNDS = 10;
const VARIATION = [1.0, 0.4, 1.6, 0.7, 1.3, 0.5, 1.8, 0.9, 1.2, 0.6];

type Row = { prefix: number; compressed: number; raw: number; total: number; event?: string; overflow?: boolean };

function simulate(strategy: Strategy, avg: number) {
  const rows: Row[] = [];
  const results: { size: number; compressed: boolean }[] = [];
  let summarizeCalls = 0, rebuilds = 0, overflowAt: number | null = null;
  for (let r = 0; r < ROUNDS; r++) {
    const size = Math.round(avg * VARIATION[r]);
    results.push({ size, compressed: false });
    let event: string | undefined;
    if (strategy === "eager") {
      results[r].compressed = true; // nén ngay, riêng lẻ: ~10% (không biết nhiệm vụ cần gì)
      summarizeCalls++;
    }
    const total = () =>
      PREFIX + results.reduce((a, x) => a + 200 + (x.compressed ? Math.round(x.size * (strategy === "eager" ? 0.1 : 0.03)) : x.size), 0);
    if (strategy === "adaptive" && total() > 0.8 * WINDOW) {
      const n = results.filter((x) => !x.compressed).length;
      results.forEach((x) => (x.compressed = true)); // nén cả lô, theo context nhiệm vụ: ~3%
      summarizeCalls += n;
      rebuilds++;
      event = `chạm 80% → nén lô ${n} kết quả`;
    }
    const compressed = results.filter((x) => x.compressed).reduce((a, x) => a + 200 + Math.round(x.size * (strategy === "eager" ? 0.1 : 0.03)), 0);
    const raw = results.filter((x) => !x.compressed).reduce((a, x) => a + 200 + x.size, 0);
    const t = PREFIX + compressed + raw;
    const overflow = t > WINDOW;
    if (overflow && overflowAt === null) overflowAt = r + 1;
    rows.push({ prefix: PREFIX, compressed, raw, total: t, event, overflow });
    if (overflow) break;
  }
  return { rows, summarizeCalls, rebuilds, overflowAt };
}

export function ContextBudgetSim() {
  const [strategy, setStrategy] = useState<Strategy>("adaptive");
  const [avg, setAvg] = useState(15_000);
  const sim = useMemo(() => simulate(strategy, avg), [strategy, avg]);
  const pct = (n: number) => `${Math.min((n / WINDOW) * 100, 100)}%`;

  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        {(
          [
            ["none", "Không nén"],
            ["eager", "Nén từng kết quả ngay"],
            ["adaptive", "Thích ứng (80% · theo nhiệm vụ)"],
          ] as [Strategy, string][]
        ).map(([id, label]) => (
          <button key={id} className={"btn small" + (strategy === id ? " on" : "")} onClick={() => setStrategy(id)}>
            {label}
          </button>
        ))}
      </div>
      <label className="small">
        Kết quả mỗi lần tìm kiếm trung bình: <b>{avg.toLocaleString("vi")} token</b> (sách: ~52K ký tự ≈ 15K token)
        <input type="range" min={3000} max={30000} step={1000} value={avg} onChange={(e) => setAvg(Number(e.target.value))} />
      </label>

      <div className="label">Context ở mỗi vòng (cửa sổ 128K, vạch cam = 80%)</div>
      {sim.rows.map((r, i) => (
        <div key={i} className="row" style={{ flexWrap: "nowrap", gap: 8, margin: "4px 0" }}>
          <span className="small muted" style={{ width: 52, flexShrink: 0 }}>Vòng {i + 1}</span>
          <div className="meter" style={{ flex: 1 }}>
            <div className="fill" style={{ width: pct(r.total) }}>
              <div style={{ width: `${(r.prefix / r.total) * 100}%`, background: "var(--c-system)" }} />
              <div style={{ width: `${(r.compressed / r.total) * 100}%`, background: "var(--c-tool-soft)", borderLeft: "1px solid var(--c-tool)" }} />
              <div style={{ width: `${(r.raw / r.total) * 100}%`, background: "var(--c-tool)" }} />
            </div>
            <div className="mark" style={{ left: "80%" }} />
          </div>
          <span className="small" style={{ width: 150, flexShrink: 0, color: r.overflow ? "var(--bad)" : undefined }}>
            {r.overflow ? "✗ TRÀN — nhiệm vụ thất bại" : r.event ? `↓ ${r.event}` : `${Math.round(r.total / 1000)}K`}
          </span>
        </div>
      ))}
      <div className="legend">
        <span><i style={{ background: "var(--c-system)" }} />static prefix</span>
        <span><i style={{ background: "var(--c-tool)" }} />kết quả gốc (đầy đủ chi tiết)</span>
        <span><i style={{ background: "var(--c-tool-soft)", border: "1px solid var(--c-tool)" }} />kết quả đã nén</span>
      </div>
      <div className="stats">
        <Stat v={sim.overflowAt ? `vòng ${sim.overflowAt}` : "không"} k="tràn context" />
        <Stat v={sim.summarizeCalls} k="lần gọi LLM để tóm tắt" />
        <Stat v={sim.rebuilds} k="lần phá cache giữa trajectory" />
      </div>
      <p className="small muted">
        Mô phỏng theo Thí nghiệm 2-10. <b>Nén từng kết quả ngay</b> tốn một lần gọi LLM cho mỗi kết quả và tóm tắt mà không biết
        nhiệm vụ cần gì (~10%, sách đo được: 12 vòng, nhiều token nhất vì thông tin bị phân mảnh). <b>Thích ứng</b> giữ nguyên văn
        bản gốc lúc đầu, chỉ nén cả lô khi chạm 80%, và nén có mục tiêu (~3%) → ít lần phá cache.
      </p>
    </div>
  );
}
