import { useState } from "react";

type Mode = "static" | "append_only" | "evolving";
const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "static", label: "static", desc: "Không lưu feedback" },
  { id: "append_only", label: "append_only", desc: "Nhớ bản đầu tiên, không giải quyết xung đột" },
  { id: "evolving", label: "evolving", desc: "Có version, thay luật cũ bằng bằng chứng mới" },
];

const STREAM: { stage: string; topic: string; label: string; correct: string }[] = [
  { stage: "learning", topic: "refund", label: "Hạn hoàn tiền?", correct: "30 ngày" },
  { stage: "learning", topic: "id", label: "Xác minh danh tính bằng gì?", correct: "4 số cuối thẻ" },
  { stage: "learning", topic: "bag", label: "Hạn mức hành lý ký gửi?", correct: "20 kg" },
  { stage: "learning", topic: "refund", label: "Khách hỏi hoàn vé sau 3 tuần", correct: "30 ngày" },
  { stage: "transfer", topic: "id", label: "Khách khác, đổi email tài khoản", correct: "4 số cuối thẻ" },
  { stage: "transfer", topic: "bag", label: "Vali 19 kg có phải trả thêm?", correct: "20 kg" },
  { stage: "transfer", topic: "refund", label: "Hủy chuyến đã đặt 25 ngày trước", correct: "30 ngày" },
  { stage: "rule change", topic: "bag", label: "⚠ Luật mới: hạn mức hành lý", correct: "23 kg" },
  { stage: "rule change", topic: "bag", label: "Vali 22 kg có phải trả thêm?", correct: "23 kg" },
  { stage: "rule change", topic: "bag", label: "Hạn mức hành lý hiện tại?", correct: "23 kg" },
  { stage: "retention", topic: "refund", label: "Hạn hoàn tiền?", correct: "30 ngày" },
  { stage: "retention", topic: "id", label: "Xác minh để đổi số điện thoại", correct: "4 số cuối thẻ" },
  { stage: "retention", topic: "bag", label: "Hạn mức hành lý?", correct: "23 kg" },
  { stage: "retention", topic: "id", label: "Xác minh để hủy thẻ", correct: "4 số cuối thẻ" },
];

type Mem = Record<string, { v: string; ver: number }>;

function simulate(upTo: number) {
  const mems: Record<Mode, Mem> = { static: {}, append_only: {}, evolving: {} };
  const results: Record<Mode, boolean[]> = { static: [], append_only: [], evolving: [] };
  for (let i = 0; i < upTo; i++) {
    const t = STREAM[i];
    for (const m of MODES) {
      const mem = mems[m.id];
      results[m.id].push(mem[t.topic]?.v === t.correct);
      // feedback chỉ đến SAU khi task kết thúc
      if (m.id === "static") continue;
      if (!mem[t.topic]) mem[t.topic] = { v: t.correct, ver: 1 };
      else if (mem[t.topic].v !== t.correct && m.id === "evolving") mem[t.topic] = { v: t.correct, ver: mem[t.topic].ver + 1 };
    }
  }
  return { mems, results };
}

export function EvolutionStream() {
  const [n, setN] = useState(0);
  const { mems, results } = simulate(n);
  const next = STREAM[n];
  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small primary" disabled={n >= STREAM.length} onClick={() => setN(n + 1)}>Task tiếp theo →</button>
        <button className="btn small" onClick={() => setN(STREAM.length)}>Chạy hết</button>
        <button className="btn small" onClick={() => setN(0)}>Làm lại</button>
        <span className="small muted">{n}/{STREAM.length} task</span>
      </div>
      {next && (
        <div className="callout">
          <b>Task {n + 1}</b> <span className="pill accent">{next.stage}</span> {next.label}
        </div>
      )}
      <div className="grid two" style={{ marginTop: 10 }}>
        {MODES.map((m) => {
          const r = results[m.id];
          const acc = r.length ? r.filter(Boolean).length : 0;
          return (
            <div key={m.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b>{m.label}</b>
                <span className="small">{acc}/{r.length} đúng</span>
              </div>
              <div className="small muted">{m.desc}</div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", margin: "8px 0" }}>
                {r.map((ok, i) => (
                  <span key={i} title={`${STREAM[i].stage}: ${STREAM[i].label}`}
                    style={{ width: 18, height: 18, borderRadius: 4, fontSize: 11, display: "grid", placeItems: "center",
                      background: ok ? "var(--ok-soft)" : "var(--bad-soft)", color: ok ? "var(--ok)" : "var(--bad)" }}>
                    {ok ? "✓" : "✗"}
                  </span>
                ))}
              </div>
              <div className="small">
                {Object.keys(mems[m.id]).length === 0 ? <span className="muted">(bộ nhớ trống)</span> :
                  Object.entries(mems[m.id]).map(([k, v]) => (
                    <div key={k}><code>{k}</code>: {v.v} <span className="muted">v{v.ver}</span></div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="small muted">
        Feedback chỉ được ghi sau khi task kết thúc — không lộ đáp án trước. Chú ý giai đoạn “rule change”: append_only vẫn tự tin trả lời
        20 kg. Đạt điểm cao cuối cùng chưa đủ: nếu còn trích luật đã hết hiệu lực, hoặc quên năng lực cũ, thì chưa phải tiến hóa liên tục.
      </p>
    </div>
  );
}

const CANDIDATES = [
  { id: "ask", label: "Thiếu tham số → hỏi user trong hội thoại, không nhét câu hỏi vào tool", fixes: 4, breaks: 0, trust: false },
  { id: "guide", label: "SIM/APN thuộc thiết bị user → hướng dẫn user tự làm", fixes: 3, breaks: 0, trust: false },
  { id: "esc", label: "Gọi tool lỗi 3 lần liên tiếp → chuyển người", fixes: 0, breaks: 2, trust: false },
  { id: "thr", label: "Hạ ngưỡng release từ +1 xuống −5 “cho nhanh”", fixes: 0, breaks: 0, trust: true },
];

export function ReleaseGate() {
  const [on, setOn] = useState<Record<string, boolean>>({ ask: true, guide: true, esc: true });
  const sel = CANDIDATES.filter((c) => on[c.id]);
  const fixes = sel.reduce((a, c) => a + c.fixes, 0);
  const breaks = sel.reduce((a, c) => a + c.breaks, 0);
  const trust = sel.some((c) => c.trust);
  const checks = [
    { ok: fixes > 0, label: `Boundary set cải thiện (0/7 → ${fixes}/7)` },
    { ok: breaks === 0, label: `Retention set không hỏng (${breaks} task từng pass nay fail)` },
    { ok: !trust, label: "Không đụng trust root (validator, test, ngưỡng release, audit log)" },
  ];
  const pass = checks.every((c) => c.ok);
  return (
    <div>
      <p className="small muted">Model rút luật từ 19 trajectory thất bại của τ²-bench telecom. Chọn các luật đưa vào bản vá:</p>
      {CANDIDATES.map((c) => (
        <label key={c.id} className="row" style={{ gap: 8, margin: "6px 0", cursor: "pointer", flexWrap: "nowrap" }}>
          <input type="checkbox" checked={!!on[c.id]} onChange={() => setOn({ ...on, [c.id]: !on[c.id] })} />
          <span>{c.label}</span>
        </label>
      ))}
      <div style={{ margin: "10px 0" }}>
        {checks.map((c) => (
          <div key={c.label} className="small"><span className={"pill " + (c.ok ? "ok" : "bad")}>{c.ok ? "✓" : "✗"}</span> {c.label}</div>
        ))}
      </div>
      <div className={"callout " + (pass ? "ok" : "bad")}>
        {pass ? "release_to_canary — vào canary, theo dõi, sẵn sàng rollback." : "reject_candidate — lý do bị từ chối được lưu cho vòng sinh ứng viên sau."}
      </div>
      <p className="small muted">
        Luật “chuyển người sau 3 lần lỗi” trông hợp lý vì chuyển người xuất hiện nhiều trong trajectory — model coi hành vi quan sát được là
        hành vi nên có. Nhưng nó làm hỏng các task lỗi tạm thời vốn tự hồi phục khi retry. Sản phẩm do model rút ra phải qua kiểm chứng độc lập.
      </p>
    </div>
  );
}
