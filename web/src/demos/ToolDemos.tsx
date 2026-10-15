import { useState } from "react";
import { Stat } from "../components/ui";

// ── Tool description linter: kiểm các tiêu chí của mục 4.2.2 ────────────────
const CHECKS: { label: string; test: (s: string) => boolean; tip: string }[] = [
  { label: "Nói KHI NÀO dùng (không chỉ “làm được gì”)", test: (s) => /(dùng khi|use when|khi cần|khi bạn cần)/i.test(s), tip: "Thêm “Dùng khi …” để model ra quyết định gọi." },
  { label: "Nêu ranh giới / KHÔNG làm được gì", test: (s) => /(không |not |only|chỉ )/i.test(s), tip: "Thêm câu phủ định: tool này KHÔNG tìm nội dung tệp, chỉ khớp tên…" },
  { label: "Có ví dụ tham số cụ thể", test: (s) => /(vd|ví dụ|e\.g\.|example)[:\s]/i.test(s), tip: "Ví dụ: “timestamp: RFC3339, vd 2024-03-15T14:30:00Z”." },
  { label: "Mô tả giá trị trả về", test: (s) => /(trả về|returns?)/i.test(s), tip: "Ví dụ: “Trả về mảng JSON, mỗi phần tử có title, url, snippet”." },
  { label: "Ghi chú chi phí / thời gian (nếu tool chậm)", test: (s) => /(giây|seconds?|chậm|slow|cost|tốn)/i.test(s), tip: "Ví dụ: “tải cả trang, 5–10 giây; nếu chỉ cần metadata dùng get_page_metadata”." },
];
const BAD = "Tìm kiếm nội dung liên quan.";
const GOOD = "Dùng khi cần thông tin thời gian thực hoặc sự kiện bạn chưa biết. KHÔNG dùng để đọc một URL đã biết (dùng fetch_url). Tham số query: từ khóa ngắn, vd \"giá vàng hôm nay\". Trả về mảng JSON tối đa 10 kết quả, mỗi phần tử có title, url, snippet. Mất khoảng 1–2 giây.";

export function ToolDescLinter() {
  const [text, setText] = useState(BAD);
  const results = CHECKS.map((c) => ({ ...c, ok: c.test(text) }));
  const score = results.filter((r) => r.ok).length;
  return (
    <div>
      <div className="label">Mô tả của tool <code>web_search</code> — sửa thử</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row" style={{ margin: "8px 0" }}>
        <button className="btn small" onClick={() => setText(BAD)}>Mô tả tệ</button>
        <button className="btn small" onClick={() => setText(GOOD)}>Mô tả tốt</button>
        <span className={"pill " + (score >= 4 ? "ok" : score >= 2 ? "warn" : "bad")}>{score}/{CHECKS.length} tiêu chí</span>
      </div>
      {results.map((r) => (
        <div key={r.label} className="small" style={{ margin: "4px 0" }}>
          {r.ok ? "✅" : "⬜"} <b>{r.label}</b>{!r.ok && <span className="muted"> — {r.tip}</span>}
        </div>
      ))}
      <p className="small muted">
        Bộ kiểm tra này chỉ dò từ khóa cho vui — nhưng các tiêu chí là thật. Theo sách: khi Agent liên tục chọn sai tool, hãy kiểm tra
        description trước khi nghi ngờ model; thêm 1–5 ví dụ gọi thật có thể nâng độ chính xác gọi tool từ ~72% lên ~90%.
      </p>
    </div>
  );
}

// ── Có bao nhiêu tool thì nên lộ bao nhiêu? (mục 4.4) ───────────────────────
export function ToolLoadingCalc() {
  const [servers, setServers] = useState(5);
  const [toolsPer, setToolsPer] = useState(20);
  const PER_SCHEMA = 550; // token mỗi schema đầy đủ (ước lượng)
  const PER_INDEX = 25; // token mỗi dòng index tên + mô tả ngắn
  const PER_SKILL = 40;
  const n = servers * toolsPer;
  const full = n * PER_SCHEMA;
  const index = n * PER_INDEX + 3 * PER_SCHEMA;
  const meta = 200 + 3 * PER_SCHEMA;
  const skills = n * PER_SKILL;
  const pct = (x: number) => `${((x / 200_000) * 100).toFixed(1)}%`;
  return (
    <div>
      <div className="grid two">
        <label className="small">Số MCP server: <b>{servers}</b>
          <input type="range" min={1} max={30} value={servers} onChange={(e) => setServers(+e.target.value)} />
        </label>
        <label className="small">Tool mỗi server: <b>{toolsPer}</b>
          <input type="range" min={5} max={60} step={5} value={toolsPer} onChange={(e) => setToolsPer(+e.target.value)} />
        </label>
      </div>
      <p className="small">Tổng cộng <b>{n}</b> tool. Token “thường trú” trước khi hội thoại bắt đầu (cửa sổ 200K):</p>
      <div className="stats">
        <Stat v={`${full.toLocaleString("vi")} · ${pct(full)}`} k="Full injection: mọi schema vào context" />
        <Stat v={`${index.toLocaleString("vi")} · ${pct(index)}`} k="Chỉ index tên, nạp schema khi cần (Cursor: −46,9% token)" />
        <Stat v={`${meta.toLocaleString("vi")} · ${pct(meta)}`} k="Proactive discovery: 1 meta-tool + schema tìm được" />
        <Stat v={`${skills.toLocaleString("vi")} · ${pct(skills)}`} k="Skills: chỉ catalog tên + mô tả" />
      </div>
      {n > 100 && <div className="callout warn">Hơn 100 tool: ngay cả model mạnh nhất cũng bắt đầu chọn nhầm. Retrieval pre-filtering đưa Opus 4 từ 49% lên 74% trên benchmark tool use.</div>}
      <p className="small muted">
        Sách: chỉ 5 MCP server có thể tốn hàng chục nghìn token, gần 30% cửa sổ 200K. Schema tìm được phải được <b>nối vào cuối</b>
        trajectory (tool_search_output / tool_reference) để static prefix không đổi; không bao giờ xóa hay đổi thứ tự tool đã nạp.
      </p>
    </div>
  );
}
