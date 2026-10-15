import type { Chapter } from "../lib/types";
import { href } from "../lib/router";
import { update, useFlag, useProgress } from "../lib/storage";
import { Code, Table } from "./ui";
import { Quiz } from "./Quiz";
import { Flashcards } from "./Flashcards";

const TABS = [
  { id: "read", label: "📖 Đọc nhanh" },
  { id: "demo", label: "🧪 Minh họa" },
  { id: "lab", label: "💻 Code thực hành" },
  { id: "apply", label: "🛠️ Áp dụng" },
  { id: "review", label: "🧠 Ôn tập" },
];

export function ChapterPage({ ch, tab }: { ch: Chapter; tab: string }) {
  return (
    <>
      <div className="ch-eyebrow">
        Chương {ch.id} · {ch.tier} · ~{ch.minutes} phút
      </div>
      <h1>{ch.title}</h1>
      <p className="oneliner">{ch.oneLiner}</p>

      {!ch.ready ? (
        <div className="callout warn">
          <div className="callout-title">Chương này chưa được soạn</div>
          Hiện đã có Chương 1–3. Các chương tiếp theo sẽ được thêm theo cùng cấu trúc.
        </div>
      ) : (
        <>
          <nav className="tabs">
            {TABS.map((t) => (
              <a key={t.id} href={href.chapter(ch.id, t.id)} className={"tab" + (tab === t.id ? " active" : "")}>
                {t.label}
              </a>
            ))}
          </nav>
          {tab === "read" && <ReadTab ch={ch} />}
          {tab === "demo" && <DemoTab ch={ch} />}
          {tab === "lab" && <LabTab ch={ch} />}
          {tab === "apply" && <ApplyTab ch={ch} />}
          {tab === "review" && <ReviewTab ch={ch} />}
          <NextPrev ch={ch} tab={tab} />
        </>
      )}
    </>
  );
}

function NextPrev({ ch, tab }: { ch: Chapter; tab: string }) {
  const i = TABS.findIndex((t) => t.id === tab);
  const next = TABS[i + 1];
  return (
    <div className="row" style={{ justifyContent: "flex-end", marginTop: 36 }}>
      {next ? (
        <a className="btn primary" href={href.chapter(ch.id, next.id)}>
          Tiếp: {next.label} →
        </a>
      ) : (
        <a className="btn primary" href={href.chapter(ch.id + 1)}>
          Sang Chương {ch.id + 1} →
        </a>
      )}
    </div>
  );
}

function ReadToggle({ id }: { id: string }) {
  const [done, set] = useFlag("read", id);
  return (
    <label className="read-toggle small muted row" style={{ gap: 6, cursor: "pointer" }}>
      <input type="checkbox" className="check" checked={done} onChange={(e) => set(e.target.checked)} />
      Đã hiểu
    </label>
  );
}

function ReadTab({ ch }: { ch: Chapter }) {
  const progress = useProgress();
  const sections = ch.sections ?? [];
  const readCount = sections.filter((s) => progress.read[`ch${ch.id}:${s.id}`]).length;
  return (
    <>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Ý chính của chương</h3>
        <ol className="key-ideas">
          {ch.keyIdeas?.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ol>
      </div>

      <div className="row" style={{ margin: "22px 0 4px", justifyContent: "space-between" }}>
        <div className="small muted">
          Đã đánh dấu hiểu {readCount}/{sections.length} mục
        </div>
        <div style={{ flex: "0 0 160px" }} className="progress-bar">
          <div style={{ width: `${(readCount / Math.max(sections.length, 1)) * 100}%` }} />
        </div>
      </div>

      {sections.map((s, i) => (
        <section key={s.id} className="section" id={s.id}>
          <div className="section-head">
            <h2>
              {i + 1}. {s.title}
            </h2>
            <ReadToggle id={`ch${ch.id}:${s.id}`} />
          </div>
          {s.body}
        </section>
      ))}

      {ch.pitfalls && (
        <section className="section">
          <h2>Lỗi thường gặp</h2>
          {ch.pitfalls.map((p, i) => (
            <div className="pitfall" key={i}>
              <div className="wrong">
                <b>✗ Sai</b>
                {p.wrong}
              </div>
              <div className="right">
                <b>✓ Đúng</b>
                {p.right}
              </div>
            </div>
          ))}
        </section>
      )}

      {ch.glossary && (
        <section className="section">
          <h2>Thuật ngữ của chương</h2>
          <Table head={["Thuật ngữ (giữ tiếng Anh)", "Nghĩa tiếng Việt", "Giải thích ngắn"]} rows={ch.glossary.map((t) => [<b>{t.en}</b>, t.vi, t.note])} />
        </section>
      )}
    </>
  );
}

function DemoTab({ ch }: { ch: Chapter }) {
  return (
    <>
      <p className="muted">
        Các minh họa chạy ngay trong trình duyệt, không cần model. Hãy bấm, kéo, bật/tắt và đoán kết quả trước khi xem.
      </p>
      {ch.demos?.map((d) => <DemoBlock key={d.id} chapter={ch.id} demo={d} />)}
    </>
  );
}

function DemoBlock({ chapter, demo }: { chapter: number; demo: NonNullable<Chapter["demos"]>[number] }) {
  const [seen, set] = useFlag("demos", `ch${chapter}:${demo.id}`);
  const C = demo.component;
  return (
    <section>
      <div className="section-head">
        <h2>{demo.title}</h2>
        <label className="small muted row" style={{ gap: 6, cursor: "pointer" }}>
          <input type="checkbox" className="check" checked={seen} onChange={(e) => set(e.target.checked)} />
          Đã thử
        </label>
      </div>
      <p className="muted">{demo.desc}</p>
      <div className="demo-box">
        <C />
      </div>
    </section>
  );
}

function LabTab({ ch }: { ch: Chapter }) {
  if (!ch.lab) return null;
  return (
    <>
      {ch.lab.intro}
      {ch.lab.steps.map((s, i) => (
        <LabStepView key={s.id} chapter={ch.id} index={i} step={s} />
      ))}
    </>
  );
}

function LabStepView({ chapter, index, step }: { chapter: number; index: number; step: NonNullable<Chapter["lab"]>["steps"][number] }) {
  const [done, set] = useFlag("labs", `ch${chapter}:${step.id}`);
  return (
    <section className="section">
      <div className="section-head">
        <h2>
          Bài {chapter}.{index + 1} — {step.title}
        </h2>
        <label className="small muted row" style={{ gap: 6, cursor: "pointer" }}>
          <input type="checkbox" className="check" checked={done} onChange={(e) => set(e.target.checked)} />
          Đã chạy
        </label>
      </div>
      <div className="label">Chạy (trong thư mục agent-lab)</div>
      <Code lang="bash">{step.run.join("\n")}</Code>
      <div className="label">Cần quan sát</div>
      {step.observe}
      {step.result && (
        <>
          <div className="label">Kết quả chạy thật (tham khảo)</div>
          {step.result}
        </>
      )}
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Xem mã nguồn <code>{step.file}</code>
        </summary>
        <Code lang="python">{step.code}</Code>
      </details>
    </section>
  );
}

function ApplyTab({ ch }: { ch: Chapter }) {
  const progress = useProgress();
  return (
    <>
      <p className="muted">
        Kiến thức chỉ thật sự “vào” khi bạn áp vào việc của mình. Ghi câu trả lời ngay dưới mỗi bài — nội dung được lưu trong
        trình duyệt này. Khi muốn, hãy gửi cho Claude để được góp ý hoặc sinh ví dụ sát với lĩnh vực của bạn.
      </p>
      {ch.apply?.map((a, i) => {
        const key = `ch${ch.id}:apply${i}`;
        return (
          <div className="card" key={i}>
            <h3 style={{ marginTop: 0 }}>{a.title}</h3>
            {a.prompt}
            <details>
              <summary style={{ cursor: "pointer" }} className="muted">
                Gợi ý
              </summary>
              {a.hint}
            </details>
            <textarea
              placeholder="Câu trả lời / ghi chú của bạn…"
              value={progress.notes[key] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                update((p) => ({ ...p, notes: { ...p.notes, [key]: v } }));
              }}
              style={{ marginTop: 10 }}
            />
          </div>
        );
      })}
    </>
  );
}

function ReviewTab({ ch }: { ch: Chapter }) {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Trắc nghiệm</h2>
      {ch.quiz && <Quiz chapter={ch.id} questions={ch.quiz} />}
      <h2>Flashcard</h2>
      <p className="muted small">Lật thẻ, tự trả lời trong đầu, rồi chấm “Đã nhớ” hoặc “Chưa nhớ”. Thẻ nhớ rồi sẽ quay lại sau vài ngày.</p>
      {ch.cards && <Flashcards cards={ch.cards.map((c, i) => ({ ...c, key: `ch${ch.id}:${i}`, chapter: ch.id }))} />}
    </>
  );
}
