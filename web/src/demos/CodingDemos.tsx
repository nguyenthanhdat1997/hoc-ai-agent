import { useState } from "react";
import { Code } from "../components/ui";

// ── So sánh các cách edit file (mục 5.1.8) ─────────────────────────────────
const FILE = `def foo(x):
    return x


def bar(y):
    return foo(y) * 2


def baz(z):
    return foo(z) + 1`;

const SCHEMES = [
  {
    id: "oldnew", name: "Old String → New String (Claude Code)",
    payload: `old_string: "def foo(x):\\n    return x"\nnew_string: "def foo(x, y=0):\\n    return x + y"`,
    note: "Dễ đoán, không mơ hồ: khớp duy nhất thì thành công, không thì báo lỗi. Xóa khối lớn phải chép lại toàn bộ khối; lệch 1 ký tự là fail.",
  },
  {
    id: "lines", name: "Line Number Targeting",
    payload: "delete lines 1–2, insert:\ndef foo(x, y=0):\n    return x + y",
    note: "Xóa khối lớn chỉ cần 2 số dòng. Nhưng mỗi lần sửa làm dịch số dòng phía sau — nhiều edit một lượt phải dùng số dòng GỐC như diff.",
  },
  {
    id: "headtail", name: "Head–tail matching",
    payload: `start: "def foo(x):"\nend:   "    return x"\nnew:   "def foo(x, y=0):\\n    return x + y"`,
    note: "Chỉ cần ranh giới đầu/cuối, không phải chép phần giữa — hợp với xóa khối lớn. Cặp ranh giới phải duy nhất trong tệp.",
  },
  {
    id: "diff", name: "Diff + Apply model (Cursor)",
    payload: "def foo(x, y=0):\n    return x + y\n# ... existing code ...",
    note: "Model chính viết skeleton có dấu “giữ nguyên”; một model nhỏ fast-apply ghép vào tệp (speculative decoding, hàng nghìn token/s). Lệch nhỏ có thể ghép nhầm chỗ.",
  },
  {
    id: "vim", name: "Vim-like commands",
    payload: "1G  cw  ... dd  yy/p",
    note: "Giỏi di chuyển/tổ chức lại code. Nhưng model yếu sai nhiều, và số dòng đổi sau mỗi lệnh — Vim thiết kế cho người làm từng bước nhỏ, không cho model làm một loạt thao tác.",
  },
];

export function EditSchemes() {
  const [id, setId] = useState("oldnew");
  const [test, setTest] = useState("foo");
  const s = SCHEMES.find((x) => x.id === id)!;
  // thử nghiệm: old_string "return foo(" khớp 2 chỗ → lỗi không duy nhất
  const count = FILE.split(test).length - 1;
  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        {SCHEMES.map((x) => (
          <button key={x.id} className={"btn small" + (id === x.id ? " on" : "")} onClick={() => setId(x.id)}>{x.name}</button>
        ))}
      </div>
      <div className="demo-split">
        <div>
          <div className="label">Tệp gốc</div>
          <Code>{FILE}</Code>
        </div>
        <div>
          <div className="label">Model gửi gì để sửa foo thành foo(x, y=0)</div>
          <Code>{s.payload}</Code>
          <p className="small">{s.note}</p>
        </div>
      </div>
      <div className="label">Thử độ duy nhất của old_string</div>
      <input value={test} onChange={(e) => setTest(e.target.value)}
        style={{ width: "100%", padding: "8px 10px", font: "inherit", fontFamily: "var(--mono)", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }} />
      <div className={"callout " + (count === 1 ? "ok" : "bad")} style={{ marginTop: 8 }}>
        {count === 0 && "Không khớp chỗ nào → edit_file trả lỗi “old_string không khớp”. Hãy read_file lại và chép chính xác."}
        {count === 1 && "Khớp đúng 1 chỗ → edit thành công, không mơ hồ."}
        {count > 1 && `Khớp ${count} chỗ → edit_file từ chối. Thêm ngữ cảnh xung quanh (vd "def foo(x):") để khớp duy nhất.`}
      </div>
      <p className="small muted">Gõ thử: <code>foo</code>, <code>return foo(</code>, <code>def foo(x):</code>.</p>
    </div>
  );
}

// ── Lỗi này có nên retry không? (mục 5.1.5) ─────────────────────────────────
const ERRORS = [
  { e: "HTTP 429 rate limit", layer: "API", retry: true, how: "Silent retry: exponential backoff + jitter, tôn trọng thời gian chờ server gợi ý." },
  { e: "Output bị cắt ở giới hạn token", layer: "API", retry: true, how: "Degrade & continue: tăng max output; vẫn thiếu thì thêm meta-instruction để model viết tiếp từ chỗ đứt." },
  { e: "Gọi tool không tồn tại (hallucinated call)", layer: "Tool", retry: false, how: "Không kết thúc phiên: trả lỗi có cấu trúc “no such tool” làm tool result để model tự sửa." },
  { e: "Tool trả cùng một lỗi, model gọi lại y hệt", layer: "Tool", retry: false, how: "Fingerprint (tool + arguments) lặp → dấu hiệu vòng lặp không tiến triển; ép đổi chiến lược." },
  { e: "Tool call thiếu tool result đi kèm trong trajectory", layer: "Context", retry: false, how: "Sửa cặp trước khi inject context (production); chế độ thu dữ liệu huấn luyện thì từ chối sửa." },
  { e: "Kết nối streaming “im lặng” — không lỗi nhưng không có data", layer: "API", retry: true, how: "Idle watchdog: không có output mới sau X giây thì kill stream và retry. Mọi kết nối dài cần liveness signal." },
  { e: "Model chính quá tải kéo dài", layer: "API", retry: true, how: "Fallback sang model khác: bỏ credential của reasoning, giữ text; lưu trajectory ở định dạng trung lập." },
  { e: "Stop hook gọi LLM viết commit message khi đang tràn context", layer: "Control flow", retry: false, how: "Death spiral: tắt mọi side effect gọi model trên đường xử lý lỗi + bộ đếm độ sâu đệ quy." },
];

export function ErrorTriage() {
  const [shown, setShown] = useState<Record<number, boolean>>({});
  return (
    <div>
      <p className="small">Câu hỏi đầu tiên khi có lỗi không phải “có retry không?” mà là “retry có giúp không?”. Đoán trước khi bấm.</p>
      {ERRORS.map((x, i) => (
        <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span><span className="pill">{x.layer}</span> {x.e}</span>
            <button className="btn small" onClick={() => setShown({ ...shown, [i]: !shown[i] })}>{shown[i] ? "Ẩn" : "Xem cách xử lý"}</button>
          </div>
          {shown[i] && (
            <div className="small" style={{ marginTop: 6 }}>
              <span className={"pill " + (x.retry ? "ok" : "bad")}>{x.retry ? "retry có ích" : "retry nguyên trạng vô ích"}</span> {x.how}
            </div>
          )}
        </div>
      ))}
      <p className="small muted">
        Thứ tự leo thang: silent retry → degrade & continue → báo người dùng. Đơn vị xử lý lỗi là cả recovery loop: giữ lỗi lại, khôi phục được
        thì người dùng không bao giờ thấy. Mọi đường khôi phục cần trần — Claude Code dừng nén sau 3 lần fail liên tiếp (một phiên từng fail
        hơn 3.000 lần liền, tốn ~250.000 API call/ngày toàn cầu).
      </p>
    </div>
  );
}

// ── Code as thinking tool (mục 5.2.1) ──────────────────────────────────────
export function MathByCode() {
  const [n, setN] = useState(40);
  const [m, setM] = useState(60);
  const [p, setP] = useState(45);
  const [b, setB] = useState(25);
  const math = Math.floor((n * m) / 100), phys = Math.floor((n * p) / 100), both = Math.floor((n * b) / 100);
  return (
    <div>
      <p className="small">
        Lớp {n} học sinh: {m}% học Toán, {p}% học Lý, {b}% học cả hai. Bao nhiêu em <b>chỉ học Lý</b>?
      </p>
      <div className="grid two">
        <label className="small">Sĩ số: {n}<input type="range" min={20} max={100} step={10} value={n} onChange={(e) => setN(+e.target.value)} /></label>
        <label className="small">% Toán: {m}<input type="range" min={10} max={90} step={5} value={m} onChange={(e) => setM(+e.target.value)} /></label>
        <label className="small">% Lý: {p}<input type="range" min={10} max={90} step={5} value={p} onChange={(e) => setP(+e.target.value)} /></label>
        <label className="small">% cả hai: {b}<input type="range" min={0} max={Math.min(m, p)} step={5} value={Math.min(b, m, p)} onChange={(e) => setB(+e.target.value)} /></label>
      </div>
      <div className="demo-split">
        <div>
          <div className="label">Lập luận bằng lời (dễ sai)</div>
          <div className="callout bad small">“Toán = {math}, Lý = {phys}, cả hai = {both} → chỉ Lý = {math} − {both} = <b>{math - both}</b>” — trừ nhầm vào số học Toán.</div>
        </div>
        <div>
          <div className="label">Viết code rồi chạy (chính xác)</div>
          <Code lang="python">{`phys = int(${n} * ${p / 100})   # ${phys}\nboth = int(${n} * ${b / 100})   # ${both}\nprint(phys - both)        # ${phys - both} ✓`}</Code>
        </div>
      </div>
      <p className="small muted">LLM hiểu đề và viết code; code interpreter (SymPy, constraint solver) tính chính xác. Model càng yếu, lợi ích của code càng lớn — cùng một Harness có thể cho kết luận ngược nhau với model mạnh/yếu.</p>
    </div>
  );
}
