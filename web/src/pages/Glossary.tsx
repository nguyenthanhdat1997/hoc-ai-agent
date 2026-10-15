import { useState } from "react";
import { CHAPTERS } from "../content/chapters";
import { href } from "../lib/router";

export function Glossary() {
  const [q, setQ] = useState("");
  const terms = CHAPTERS.flatMap((c) => (c.glossary ?? []).map((t) => ({ ...t, ch: c.id })));
  const needle = q.trim().toLowerCase();
  const shown = terms
    .filter((t) => !needle || `${t.en} ${t.vi} ${t.note}`.toLowerCase().includes(needle))
    .sort((a, b) => a.en.localeCompare(b.en));

  return (
    <>
      <h1>Thuật ngữ Anh – Việt</h1>
      <p className="oneliner">Bản dịch tiếng Việt của sách có nhiều chỗ dịch máy khó hiểu — tra nhanh ở đây.</p>
      <input
        type="search"
        placeholder="Tìm thuật ngữ… (vd: cache, harness, skill)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", font: "inherit", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
      />
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr><th>Thuật ngữ (giữ tiếng Anh)</th><th>Nghĩa tiếng Việt</th><th>Giải thích</th><th>Ch.</th></tr>
          </thead>
          <tbody>
            {shown.map((t, i) => (
              <tr key={i}>
                <td><b>{t.en}</b></td>
                <td>{t.vi}</td>
                <td>{t.note}</td>
                <td><a href={href.chapter(t.ch)}>{t.ch}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="muted">Không tìm thấy.</p>}
    </>
  );
}
