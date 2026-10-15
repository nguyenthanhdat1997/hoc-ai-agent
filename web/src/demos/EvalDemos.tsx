import { useState } from "react";
import { Stat } from "../components/ui";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function PassKCalc() {
  const [p, setP] = useState(0.6);
  const [k, setK] = useState(5);
  const at = 1 - (1 - p) ** k;
  const hat = p ** k;
  return (
    <div>
      <div className="grid two">
        <label className="small">Success rate một lần p = <b>{pct(p)}</b>
          <input type="range" min={0.05} max={0.99} step={0.01} value={p} onChange={(e) => setP(+e.target.value)} />
        </label>
        <label className="small">Số lần chạy k = <b>{k}</b>
          <input type="range" min={1} max={20} value={k} onChange={(e) => setK(+e.target.value)} />
        </label>
      </div>
      <div className="stats">
        <Stat v={pct(at)} k="Pass@k = 1 − (1 − p)^k · ít nhất 1 lần đúng (trần năng lực)" />
        <Stat v={<span style={{ color: hat < 0.5 ? "var(--bad)" : "var(--ok)" }}>{pct(hat)}</span>} k="Pass^k = p^k · đúng cả k lần (độ tin cậy nghiệp vụ)" />
      </div>
      <p className="small muted">
        “Technical wonder” (C compiler sau một tuần, tìm lỗ hổng bảo mật) chỉ cần Pass@k: một lần thành công đã chứng minh khả thi.
        Hoàn tiền, thanh toán, đổi quyền cần Pass^k. Với p = 60%, k = 5: Pass@5 ≈ 99% nhưng Pass^5 chỉ ≈ 7,8%.
      </p>
    </div>
  );
}

export function SignificanceCalc() {
  const [n, setN] = useState(100);
  const [pa, setPa] = useState(0.7);
  const [pb, setPb] = useState(0.73);
  const ci = (p: number) => 1.96 * Math.sqrt((p * (1 - p)) / n);
  const overlap = pa + ci(pa) > pb - ci(pb) && pb + ci(pb) > pa - ci(pa);
  const Bar = ({ p, label }: { p: number; label: string }) => (
    <div className="row" style={{ flexWrap: "nowrap", gap: 8, margin: "6px 0" }}>
      <span className="small" style={{ width: 70 }}>{label}</span>
      <div className="meter" style={{ flex: 1 }}>
        <div style={{ position: "absolute", left: `${Math.max(p - ci(p), 0) * 100}%`, width: `${Math.min(2 * ci(p), 1) * 100}%`, top: 4, bottom: 4, background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: 4 }} />
        <div className="mark" style={{ left: `${p * 100}%`, background: "var(--accent)" }} />
      </div>
      <span className="small" style={{ width: 120 }}>{pct(p)} ± {(ci(p) * 100).toFixed(1)}</span>
    </div>
  );
  return (
    <div>
      <div className="grid two">
        <label className="small">Số task n = <b>{n}</b><input type="range" min={20} max={2000} step={20} value={n} onChange={(e) => setN(+e.target.value)} /></label>
        <div>
          <label className="small">Model cũ: <b>{pct(pa)}</b><input type="range" min={0.3} max={0.95} step={0.01} value={pa} onChange={(e) => setPa(+e.target.value)} /></label>
          <label className="small">Model mới: <b>{pct(pb)}</b><input type="range" min={0.3} max={0.95} step={0.01} value={pb} onChange={(e) => setPb(+e.target.value)} /></label>
        </div>
      </div>
      <Bar p={pa} label="Cũ" />
      <Bar p={pb} label="Mới" />
      <div className={"callout " + (overlap ? "warn" : "ok")}>
        {overlap
          ? "Hai khoảng tin cậy 95% chồng lên nhau — chênh lệch có thể chỉ là nhiễu lấy mẫu. Tăng số task hoặc dùng paired analysis (McNemar / paired bootstrap) trên cùng bộ task."
          : "Hai khoảng không chồng nhau — chênh lệch nhiều khả năng là thật. Vẫn nên chạy lại độc lập trước khi quyết định."}
      </div>
      <p className="small muted">SE(p) ≈ √(p(1−p)/n), co lại theo 1/√n. Chạy mỗi cấu hình 3–5 seed và báo cả trung bình lẫn độ phân tán.</p>
    </div>
  );
}

export function EloCalc() {
  const [ra, setRa] = useState(1200);
  const [rb, setRb] = useState(1000);
  const [K, setK] = useState(32);
  const ea = 1 / (1 + 10 ** ((rb - ra) / 400));
  const winA = ra + K * (1 - ea), loseA = ra + K * (0 - ea);
  return (
    <div>
      <div className="grid two">
        <label className="small">Elo A = <b>{ra}</b><input type="range" min={800} max={1600} step={10} value={ra} onChange={(e) => setRa(+e.target.value)} /></label>
        <label className="small">Elo B = <b>{rb}</b><input type="range" min={800} max={1600} step={10} value={rb} onChange={(e) => setRb(+e.target.value)} /></label>
      </div>
      <label className="small">K-factor = <b>{K}</b><input type="range" min={4} max={64} step={4} value={K} onChange={(e) => setK(+e.target.value)} /></label>
      <div className="stats">
        <Stat v={pct(ea)} k="Xác suất A thắng E_A = 1/(1+10^((R_B−R_A)/400))" />
        <Stat v={`${winA.toFixed(0)} (+${(winA - ra).toFixed(1)})`} k="Elo A nếu A thắng (đúng kỳ vọng → điều chỉnh nhỏ)" />
        <Stat v={`${loseA.toFixed(0)} (${(loseA - ra).toFixed(1)})`} k="Elo A nếu A thua (bất ngờ → điều chỉnh lớn)" />
      </div>
      <p className="small muted">
        Elo là dạng cập nhật online của mô hình Bradley-Terry. Khi LLM làm giám khảo so cặp, phải chấm hai lần có <b>hoán đổi vị trí</b>{" "}
        để khử position bias; chỉ tính khi hai lần nhất quán.
      </p>
    </div>
  );
}
