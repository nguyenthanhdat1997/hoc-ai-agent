import { CHAPTERS, TIERS } from "../content/chapters";
import { href } from "../lib/router";
import { useProgress, type Progress } from "../lib/storage";
import type { Chapter } from "../lib/types";
import { Formula } from "../components/ui";

export function chapterProgress(ch: Chapter, p: Progress): number {
  if (!ch.ready) return 0;
  const parts: number[] = [];
  const secs = ch.sections ?? [];
  parts.push(secs.filter((s) => p.read[`ch${ch.id}:${s.id}`]).length / Math.max(secs.length, 1));
  const demos = ch.demos ?? [];
  parts.push(demos.filter((d) => p.demos[`ch${ch.id}:${d.id}`]).length / Math.max(demos.length, 1));
  const labs = ch.lab?.steps ?? [];
  parts.push(labs.filter((l) => p.labs[`ch${ch.id}:${l.id}`]).length / Math.max(labs.length, 1));
  parts.push(p.quiz[ch.id] ?? 0);
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function Home() {
  const p = useProgress();
  const ready = CHAPTERS.filter((c) => c.ready);
  const overall = ready.reduce((a, c) => a + chapterProgress(c, p), 0) / CHAPTERS.length;
  const resume = ready.find((c) => chapterProgress(c, p) < 1) ?? ready[0];

  return (
    <>
      <div className="hero">
        <div className="ch-eyebrow">Học nhanh “Hiểu sâu về AI Agent” · Lý Bác Kiệt</div>
        <h1>Hiểu AI Agent bằng cách làm, không chỉ đọc</h1>
        <p className="oneliner">
          Mỗi chương gồm: ý chính, minh họa tương tác, code Python chạy với model local (MLX), bài tập áp dụng vào việc của bạn và
          quiz/flashcard để nhớ lâu.
        </p>
        <Formula>Agent = LLM + Context + Tools &nbsp;·&nbsp; não + mắt + tay chân</Formula>
        <div className="row" style={{ gap: 14 }}>
          <a className="btn primary" href={href.chapter(resume.id)}>
            {overall > 0 ? `Học tiếp: Chương ${resume.id} →` : "Bắt đầu Chương 1 →"}
          </a>
          <div style={{ flex: "1 1 200px", maxWidth: 320 }}>
            <div className="small muted">Tiến độ toàn sách: {Math.round(overall * 100)}%</div>
            <div className="progress-bar"><div style={{ width: `${overall * 100}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Cách học mỗi chương (~1–2 giờ)</h3>
        <ol style={{ margin: 0 }}>
          <li><b>📖 Đọc nhanh</b> — đọc “Ý chính” trước, rồi từng mục; đánh dấu “Đã hiểu”.</li>
          <li><b>🧪 Minh họa</b> — đoán kết quả trước khi bấm. Sai thì càng nhớ lâu.</li>
          <li><b>💻 Code</b> — chạy bài lab với model MLX của bạn, đọc trajectory in ra, sửa thử một dòng.</li>
          <li><b>🛠️ Áp dụng</b> — viết câu trả lời cho công việc thật của bạn.</li>
          <li><b>🧠 Ôn tập</b> — quiz ngay, flashcard ôn lại sau 1, 3, 7 ngày.</li>
        </ol>
      </div>

      {TIERS.map((tier) => (
        <div className="tier" key={tier}>
          <div className="tier-title">{tier}</div>
          <div className="grid two">
            {CHAPTERS.filter((c) => c.tier === tier).map((c) => {
              const prog = chapterProgress(c, p);
              return (
                <a key={c.id} href={href.chapter(c.id)} className={"card ch-card" + (c.ready ? "" : " soon")}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="pill">Chương {c.id}</span>
                    {c.ready ? <span className="pill accent">{Math.round(prog * 100)}%</span> : <span className="pill">sắp có</span>}
                  </div>
                  <h3>{c.title}</h3>
                  <div className="small muted">{c.oneLiner}</div>
                  {c.ready && (
                    <div className="progress-bar" style={{ marginTop: 10 }}>
                      <div style={{ width: `${prog * 100}%` }} />
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
