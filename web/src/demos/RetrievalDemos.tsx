import { useMemo, useState } from "react";
import { Msg, Stat, Table } from "../components/ui";

// ── BM25 viết tay (giống agent-lab/miniagent/retrieval.py) ─────────────────
const STOP = new Set(["của", "và", "là", "có", "được", "cho", "các", "những", "một", "trong", "với", "này", "đã"]);
const tokenize = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => !STOP.has(w));

type Doc = { id: string; title: string; text: string };

function bm25(docs: Doc[], query: string, k1 = 1.5, b = 0.75) {
  const tfs = docs.map((d) => {
    const m = new Map<string, number>();
    tokenize(d.text).forEach((w) => m.set(w, (m.get(w) ?? 0) + 1));
    return m;
  });
  const lens = tfs.map((m) => [...m.values()].reduce((a, c) => a + c, 0));
  const avgdl = lens.reduce((a, c) => a + c, 0) / docs.length;
  const df = new Map<string, number>();
  tfs.forEach((m) => m.forEach((_, w) => df.set(w, (df.get(w) ?? 0) + 1)));
  const idf = (w: string) => Math.max(Math.log((docs.length - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5)), 0);
  const q = [...new Set(tokenize(query))];
  return docs
    .map((d, i) => {
      const parts = q
        .filter((w) => tfs[i].get(w))
        .map((w) => {
          const tf = tfs[i].get(w)!;
          const s = (idf(w) * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * lens[i]) / avgdl));
          return { w, tf, idf: idf(w), s };
        });
      return { doc: d, score: parts.reduce((a, p) => a + p.s, 0), parts };
    })
    .filter((r) => r.score > 0)
    .sort((a, b2) => b2.score - a.score);
}

const REPORTS: [string, string[]][] = [
  ["ACME · BCTC Q2/2025", ["Doanh thu quý hai tăng 3%, chủ yếu nhờ dòng sản phẩm máy lọc nước mới.", "Biên lợi nhuận gộp giảm nhẹ do chi phí linh kiện nhập khẩu tăng.", "Công ty dự kiến mở thêm hai nhà máy tại miền Trung trong năm tới."]],
  ["Globex · BCTC Q2/2025", ["Doanh thu quý hai giảm 5% vì thị trường xuất khẩu chậm lại.", "Chi phí marketing được cắt giảm 20% so với cùng kỳ.", "Công ty đang đàm phán mua lại một hãng phần mềm logistics."]],
  ["ACME · BCTC Q1/2025", ["Doanh thu quý một đi ngang so với cùng kỳ năm trước.", "Công ty ra mắt thử nghiệm máy lọc nước thế hệ mới tại Hà Nội."]],
  ["Sao Mai · BCTC Q2/2025", ["Doanh thu quý hai tăng 12% nhờ mảng du lịch phục hồi.", "Công ty mở thêm ba khách sạn ven biển."]],
  ["Hồng Hà · BCTC Q2/2025", ["Doanh thu quý hai thay đổi không đáng kể.", "Biên lợi nhuận cải thiện nhờ tự động hóa dây chuyền."]],
  ["Phương Nam · BCTC Q2/2024", ["Doanh thu quý hai tăng 3% so với cùng kỳ.", "Công ty có kế hoạch mua lại một chuỗi bán lẻ."]],
];
const PRESETS = [
  "Doanh thu quý hai của ACME thay đổi thế nào?",
  "Globex định mua lại công ty nào?",
  "ACME có kế hoạch mở nhà máy không?",
  "Biên lợi nhuận của ACME quý 2 năm 2025",
];

export function BM25Lab() {
  const [query, setQuery] = useState(PRESETS[0]);
  const [contextual, setContextual] = useState(false);
  const docs: Doc[] = useMemo(
    () =>
      REPORTS.flatMap(([title, chunks]) =>
        chunks.map((c, i) => {
          const [company, period] = title.split(" · ");
          const prefix = `[Trích ${period.replace("BCTC", "báo cáo tài chính")} của công ty ${company}] `;
          return { id: `${title}#${i}`, title, text: (contextual ? prefix : "") + c };
        }),
      ),
    [contextual],
  );
  const results = bm25(docs, query).slice(0, 4);

  return (
    <div>
      <div className="label">Câu hỏi</div>
      <input value={query} onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", padding: "8px 10px", font: "inherit", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }} />
      <div className="row" style={{ marginTop: 6 }}>
        {PRESETS.map((p) => (
          <button key={p} className={"btn small" + (query === p ? " on" : "")} onClick={() => setQuery(p)}>{p}</button>
        ))}
      </div>
      <label className="row" style={{ gap: 8, margin: "12px 0", cursor: "pointer" }}>
        <input type="checkbox" className="check" checked={contextual} onChange={(e) => setContextual(e.target.checked)} />
        <b>Contextual Retrieval:</b>&nbsp;ghép prefix “[Trích báo cáo … của công ty …]” vào mỗi đoạn trước khi indexing
      </label>
      <div className="label">Top 4 theo BM25 (kho có {docs.length} đoạn từ 6 báo cáo)</div>
      {results.length === 0 && <p className="muted">Không đoạn nào chứa từ khóa của câu hỏi.</p>}
      {results.map((r, i) => (
        <div key={r.doc.id} className={"msg " + (i === 0 ? "tool" : "tools")}>
          <span className="role">#{i + 1} · {r.score.toFixed(2)} · {r.doc.title}</span>
          {r.doc.text}
          <div className="small muted" style={{ fontFamily: "var(--font)", marginTop: 4 }}>
            {r.parts.map((p) => `${p.w} (tf=${p.tf}, idf=${p.idf.toFixed(2)}) → ${p.s.toFixed(2)}`).join(" · ")}
          </div>
        </div>
      ))}
      <p className="small muted">
        Không có prefix, “Doanh thu quý hai tăng 3%” không hề chứa chữ “ACME” — BM25 không thể biết đoạn này thuộc công ty nào.
        Với prefix, tên công ty và kỳ báo cáo trở thành từ khóa khớp được. Để ý: từ xuất hiện trong quá nửa số đoạn
        (như “doanh”, “quý”) có IDF bị chặn về 0 — gần như không giúp phân biệt.
      </p>
    </div>
  );
}

// ── RRF: hợp nhất thứ hạng dense + sparse (Hình 3-9) ───────────────────────
const DENSE = ["doc3 · feline habits and cat play", "doc7 · cat grooming patterns", "doc1 · pet care basics"];
const SPARSE = ["doc5 · kitty litter training", "doc9 · kitty adoption guide", "doc2 · kitten health tips", "doc7 · cat grooming patterns"];

export function RRFDemo() {
  const [k, setK] = useState(60);
  const scores = new Map<string, { s: number; parts: string[] }>();
  [["dense", DENSE], ["BM25", SPARSE]].forEach(([name, list]) =>
    (list as string[]).forEach((d, i) => {
      const cur = scores.get(d) ?? { s: 0, parts: [] };
      cur.s += 1 / (k + i + 1);
      cur.parts.push(`${name} hạng ${i + 1}`);
      scores.set(d, cur);
    }),
  );
  const fused = [...scores.entries()].sort((a, b) => b[1].s - a[1].s);
  return (
    <div>
      <p className="small">Truy vấn: <code>kitty behavior</code>. Dense hiểu “kitty ≈ cat”; BM25 khớp đúng chữ “kitty”.</p>
      <div className="demo-split">
        <div>
          <div className="label">Nhánh dense (cosine)</div>
          {DENSE.map((d, i) => <Msg key={d} kind="tools">{`${i + 1}. ${d}`}</Msg>)}
          <div className="label">Nhánh sparse (BM25)</div>
          {SPARSE.map((d, i) => <Msg key={d} kind="user">{`${i + 1}. ${d}`}</Msg>)}
        </div>
        <div>
          <label className="small">k (hằng số làm trơn): <b>{k}</b>
            <input type="range" min={1} max={100} value={k} onChange={(e) => setK(Number(e.target.value))} />
          </label>
          <div className="label">Sau RRF: score = Σ 1/(k + hạng)</div>
          {fused.map(([d, v], i) => (
            <Msg key={d} kind={v.parts.length > 1 ? "tool" : "assistant"}>
              {`${i + 1}. ${d}\n   ${v.s.toFixed(4)} ← ${v.parts.join(" + ")}`}
            </Msg>
          ))}
          <p className="small muted">
            RRF bỏ hẳn điểm gốc (cosine 0–1 và BM25 0–hàng chục không so được), chỉ dùng thứ hạng. Tài liệu được CẢ HAI nhánh tìm
            thấy (doc7) được đẩy lên. Bước sau, cross-encoder sẽ chấm lại kỹ top-N.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Bài toán đếm mèo: top-k không thay được tổng hợp (mục 3.3) ─────────────
function seeded(n: number) {
  let x = n * 9301 + 49297;
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
}

export function CatCountDemo() {
  const [k, setK] = useState(20);
  const [summary, setSummary] = useState(false);
  const [seed, setSeed] = useState(1);
  const cats = useMemo(() => Array.from({ length: 100 }, (_, i) => (i % 10 === 3 ? "trắng" : "đen")), []);
  const sample = useMemo(() => {
    const r = seeded(seed);
    // giả lập truy xuất: mọi tài liệu "giống" câu hỏi gần như nhau → top-k gần như ngẫu nhiên, hơi thiên lệch
    return cats.map((c, i) => ({ c, i, s: r() + (c === "trắng" ? 0.08 : 0) })).sort((a, b) => b.s - a.s).slice(0, k);
  }, [cats, k, seed]);
  const white = sample.filter((x) => x.c === "trắng").length;

  return (
    <div>
      <p className="small">Kho có <b>100 hồ sơ</b> riêng lẻ: 90 mèo đen, 10 mèo trắng. Người dùng hỏi: “Tỷ lệ mèo trắng là bao nhiêu?”</p>
      <div className="grid two">
        <label className="small">top-k: <b>{k}</b>
          <input type="range" min={5} max={60} step={5} value={k} onChange={(e) => setK(Number(e.target.value))} />
        </label>
        <div className="row">
          <label className="row" style={{ gap: 6, cursor: "pointer" }}>
            <input type="checkbox" className="check" checked={summary} onChange={(e) => setSummary(e.target.checked)} />
            Thêm bản tóm tắt đã indexing
          </label>
          <button className="btn small" onClick={() => setSeed(seed + 1)}>↻ Hỏi lại</button>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, margin: "12px 0" }}>
        {cats.map((c, i) => {
          const got = sample.some((x) => x.i === i);
          return <span key={i} title={`hồ sơ ${i + 1}: mèo ${c}`} style={{
            width: 14, height: 14, borderRadius: 3, display: "inline-block",
            background: c === "trắng" ? "#f4f4f4" : "#1c1c1c",
            border: got ? "2px solid var(--accent)" : "1px solid var(--border)", opacity: got ? 1 : 0.35,
          }} />;
        })}
      </div>
      {summary ? (
        <div className="callout ok">
          Truy xuất trúng ngay thẻ tóm tắt: <b>“100 con mèo: 90 đen (90%), 10 trắng (10%)”</b> → model trả lời đúng <b>10%</b>, mỗi lần đều như nhau.
        </div>
      ) : (
        <div className="callout bad">
          Model chỉ thấy {k} hồ sơ được tô viền, trong đó {white} con trắng → trả lời <b>“khoảng {Math.round((white / k) * 100)}%”</b>.
          Bấm “Hỏi lại” vài lần: con số nhảy lung tung, và model không có tín hiệu nào cho biết nó chưa thấy hết.
        </div>
      )}
      <p className="small muted">
        Attention là truy xuất mềm theo độ tương đồng, không phải cỗ máy tổng hợp. Phải đầu tư tính toán ở <b>giai đoạn indexing</b>:
        chắt lọc 100 trường hợp thành bản thống kê, chắt lọc hàng trăm phiếu thành một quy tắc có nêu rõ ranh giới.
      </p>
    </div>
  );
}

// ── Mem0 v2 (đối chiếu lúc ghi) vs v3 (chỉ thêm, xử lý lúc truy xuất) ──────
const EVENTS = [
  { t: "01/2024", text: "“Tôi sống ở Hà Nội.”" },
  { t: "06/2025", text: "“Tôi đã chuyển vào Đà Nẵng.”" },
  { t: "08/2025", text: "“Tôi thích ghế cạnh cửa sổ.”" },
];

export function Mem0Demo() {
  const [step, setStep] = useState(0);
  const v2: string[] = [];
  const v3: string[] = [];
  EVENTS.slice(0, step).forEach((e, i) => {
    if (i === 0) v2.push("Sống ở Hà Nội");
    if (i === 1) v2[0] = "Sống ở Đà Nẵng  (UPDATE — bản cũ bị ghi đè)";
    if (i === 2) v2.push("Thích ghế cạnh cửa sổ");
    v3.push(`[${e.t}] ${e.text.replace(/[“”]/g, "").replace("Tôi", "Người dùng")}`);
  });
  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>← Lùi</button>
        <button className="btn primary" disabled={step === EVENTS.length} onClick={() => setStep(step + 1)}>Session tiếp theo →</button>
        <span className="muted small">{step}/{EVENTS.length} session</span>
      </div>
      {step > 0 && <Msg kind="user">{`Session ${EVENTS[step - 1].t}: ${EVENTS[step - 1].text}`}</Msg>}
      <div className="demo-split">
        <div>
          <div className="label">Mem0 v2 · trích xuất → đối chiếu → ADD/UPDATE/DELETE/NOOP</div>
          {v2.length ? v2.map((m) => <Msg key={m} kind="tool">{m}</Msg>) : <p className="muted small">(trống)</p>}
        </div>
        <div>
          <div className="label">Mem0 v3 · chỉ ADD, kèm thời gian; xử lý xung đột lúc truy xuất</div>
          {v3.length ? v3.map((m) => <Msg key={m} kind="tool">{m}</Msg>) : <p className="muted small">(trống)</p>}
        </div>
      </div>
      {step === EVENTS.length && (
        <Table
          head={["Câu hỏi", "v2", "v3"]}
          rows={[
            ["“Tôi đang sống ở đâu?”", "✓ Đà Nẵng", "✓ Đà Nẵng (mới nhất theo thời gian)"],
            ["“Trước khi vào Đà Nẵng tôi sống ở đâu?”", "✗ Không còn dữ liệu — lịch sử đã bị ghi đè", "✓ Hà Nội"],
            ["Chi phí ghi", "Mỗi sự kiện: truy hồi + một lần LLM phán đoán", "Một lần LLM trích xuất"],
          ]}
        />
      )}
      {step === EVENTS.length && (
        <div className="stats">
          <Stat v="71,4 → 92,5" k="LoCoMo (v2 → v3)" />
          <Stat v="67,8 → 94,4" k="LongMemEval (v2 → v3)" />
        </div>
      )}
    </div>
  );
}
