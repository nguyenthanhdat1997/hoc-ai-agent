import { useState } from "react";

// Bài tập phân loại dùng chung: mỗi mục chọn 1 đáp án, bấm "Chấm" để xem giải thích.
export type ClassifyItem = { text: string; answer: string; why: string };

export function Classifier({ options, items }: { options: string[]; items: ClassifyItem[] }) {
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const score = items.filter((it, i) => picks[i] === it.answer).length;

  return (
    <div>
      {items.map((it, i) => {
        const ok = picks[i] === it.answer;
        return (
          <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ marginBottom: 6 }}>{it.text}</div>
            <div className="row">
              {options.map((o) => (
                <button key={o} className={"btn small" + (picks[i] === o ? " on" : "")} disabled={checked}
                  onClick={() => setPicks({ ...picks, [i]: o })}>
                  {o}
                </button>
              ))}
              {checked && <span className={"pill " + (ok ? "ok" : "bad")}>{ok ? "✓ đúng" : `✗ đáp án: ${it.answer}`}</span>}
            </div>
            {checked && <div className="small muted" style={{ marginTop: 6 }}>{it.why}</div>}
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 14 }}>
        {!checked ? (
          <button className="btn primary" disabled={Object.keys(picks).length < items.length} onClick={() => setChecked(true)}>
            Chấm ({Object.keys(picks).length}/{items.length})
          </button>
        ) : (
          <>
            <b>Đúng {score}/{items.length}</b>
            <button className="btn" onClick={() => { setPicks({}); setChecked(false); }}>Làm lại</button>
          </>
        )}
      </div>
    </div>
  );
}
