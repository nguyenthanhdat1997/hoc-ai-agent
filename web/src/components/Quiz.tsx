import { useState } from "react";
import type { QuizQuestion } from "../lib/types";
import { update, useProgress } from "../lib/storage";

export function Quiz({ chapter, questions }: { chapter: number; questions: QuizQuestion[] }) {
  const progress = useProgress();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const best = progress.quiz[chapter];

  const q = questions[idx];

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answer) setScore((s) => s + 1);
  }

  function next() {
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      setPicked(null);
      return;
    }
    const final = score / questions.length;
    update((p) => ({ ...p, quiz: { ...p.quiz, [chapter]: Math.max(p.quiz[chapter] ?? 0, final) } }));
    setDone(true);
  }

  function restart() {
    setIdx(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          Kết quả: {score}/{questions.length} ({pct}%)
        </h3>
        <p className="muted">
          {pct >= 80
            ? "Rất tốt — bạn đã nắm chắc ý chính của chương."
            : pct >= 50
              ? "Khá — xem lại các phần bạn trả lời sai ở tab Đọc nhanh."
              : "Nên đọc lại tab Đọc nhanh, đặc biệt phần Ý chính và Lỗi thường gặp."}
        </p>
        <button className="btn primary" onClick={restart}>
          Làm lại
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="muted small">
          Câu {idx + 1}/{questions.length}
        </span>
        {best !== undefined && <span className="pill accent">Tốt nhất: {Math.round(best * 100)}%</span>}
      </div>
      <div className="progress-bar" style={{ margin: "8px 0 14px" }}>
        <div style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>
      <p style={{ fontWeight: 600 }}>{q.q}</p>
      {q.options.map((o, i) => {
        const cls = picked === null ? "" : i === q.answer ? "correct" : i === picked ? "wrong" : "";
        return (
          <button key={i} className={"quiz-opt " + cls} disabled={picked !== null} onClick={() => pick(i)}>
            {String.fromCharCode(65 + i)}. {o}
          </button>
        );
      })}
      {picked !== null && (
        <>
          <div className={"callout " + (picked === q.answer ? "ok" : "bad")}>
            <div className="callout-title">{picked === q.answer ? "Chính xác" : "Chưa đúng"}</div>
            {q.explain}
          </div>
          <button className="btn primary" onClick={next}>
            {idx + 1 < questions.length ? "Câu tiếp →" : "Xem kết quả"}
          </button>
        </>
      )}
    </div>
  );
}
