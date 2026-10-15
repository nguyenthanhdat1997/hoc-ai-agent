import { useMemo, useState } from "react";
import { Stat } from "../components/ui";

type Seg = { key: string; label: string; tokens: number };
type Cell = Seg & { state: "hit" | "miss" | "new" };
type Status = "none" | "replace" | "append";

const REQUESTS = 6;
const CACHE_PRICE = 0.1; // đọc cache ≈ 1/10 giá (Anthropic, DeepSeek, GPT-5 theo sách)

function build(i: number, o: { timeInSystem: boolean; shuffle: boolean; sliding: boolean; status: Status }): Seg[] {
  const head: Seg[] = [];
  if (o.timeInSystem) head.push({ key: `time@${i}`, label: "⏱", tokens: 25 });
  head.push({ key: "sys", label: "system", tokens: 1200 });
  head.push({ key: o.shuffle ? `tools@${i}` : "tools", label: "tools", tokens: 800 });

  let conv: Seg[] = [{ key: "u", label: "user", tokens: 60 }];
  for (let r = 1; r < i; r++) {
    if (o.status === "append") conv.push({ key: `st${r}`, label: "st", tokens: 80 });
    conv.push({ key: `a${r}`, label: "asst", tokens: 150 });
    conv.push({ key: `t${r}`, label: "tool", tokens: 400 });
  }
  if (o.sliding) conv = conv.slice(-6); // chỉ giữ 6 tin nhắn gần nhất
  if (o.status !== "none") conv.push({ key: `st${i}`, label: "st", tokens: 80 });
  return [...head, ...conv];
}

function diff(prev: Seg[] | null, cur: Seg[]): Cell[] {
  if (!prev) return cur.map((s) => ({ ...s, state: "new" }));
  let d = 0;
  while (d < Math.min(prev.length, cur.length) && prev[d].key === cur[d].key) d++;
  const prevKeys = new Set(prev.map((s) => s.key));
  return cur.map((s, i) => ({ ...s, state: i < d ? "hit" : prevKeys.has(s.key) ? "miss" : "new" }));
}

const OPTIONS = [
  { k: "timeInSystem", label: "Chèn thời gian vào đầu system prompt", bad: true },
  { k: "shuffle", label: "Đổi thứ tự tool mỗi lần gọi", bad: true },
  { k: "sliding", label: "Cửa sổ trượt: chỉ giữ 6 tin nhắn gần nhất", bad: true },
] as const;

export function KVCacheLab() {
  const [o, setO] = useState({ timeInSystem: false, shuffle: false, sliding: false, status: "none" as Status });

  const rows = useMemo(() => {
    const out: Cell[][] = [];
    let prev: Seg[] | null = null;
    for (let i = 1; i <= REQUESTS; i++) {
      const cur = build(i, o);
      out.push(diff(prev, cur));
      // phản hồi model sinh ra ở lần gọi này cũng nằm trong KV Cache, ngay sau prompt
      prev = [...cur, { key: `a${i}`, label: "asst", tokens: 150 }];
    }
    return out;
  }, [o]);

  const max = Math.max(...rows.map((r) => r.reduce((a, c) => a + c.tokens, 0)));
  const tail = rows.slice(1); // bỏ yêu cầu đầu (cache lạnh)
  const sum = (st: Cell["state"]) => tail.flat().filter((c) => c.state === st).reduce((a, c) => a + c.tokens, 0);
  const hit = sum("hit"), miss = sum("miss"), fresh = sum("new");
  const cost = hit * CACHE_PRICE + miss + fresh;
  const ideal = (hit + miss) * CACHE_PRICE + fresh;

  return (
    <div>
      <div className="grid two" style={{ marginBottom: 10 }}>
        <div>
          <div className="label">Thử bật các “lỗi kinh điển”</div>
          {OPTIONS.map((opt) => (
            <label key={opt.k} className="row" style={{ gap: 8, cursor: "pointer", margin: "4px 0" }}>
              <input type="checkbox" className="check" checked={o[opt.k]} onChange={(e) => setO({ ...o, [opt.k]: e.target.checked })} />
              {opt.label}
            </label>
          ))}
        </div>
        <div>
          <div className="label">Status Bar ở cuối context</div>
          {(["none", "replace", "append"] as Status[]).map((s) => (
            <label key={s} className="row" style={{ gap: 8, cursor: "pointer", margin: "4px 0" }}>
              <input type="radio" name="status" className="check" checked={o.status === s} onChange={() => setO({ ...o, status: s })} />
              {s === "none" ? "Không dùng" : s === "replace" ? "Thay thế mỗi vòng (chỉ giữ bản mới)" : "Nối thêm mãi (append-only)"}
            </label>
          ))}
        </div>
      </div>

      <div className="label">6 lần gọi API liên tiếp của một Agent — mỗi hàng là toàn bộ prompt gửi đi</div>
      {rows.map((row, i) => (
        <div key={i} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <span className="small muted" style={{ width: 34, flexShrink: 0 }}>#{i + 1}</span>
          <div className="cache-row" style={{ flex: 1, minWidth: 0 }}>
            {row.map((c, j) => {
              const w = (c.tokens / max) * 100;
              return (
                <div key={j} className={"cache-seg " + c.state} title={`${c.label} · ${c.tokens} token · ${c.state}`}
                  style={{ width: `${w}%`, minWidth: 4, padding: w > 5 ? undefined : 0 }}>
                  {w > 5 ? c.label : ""}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="legend">
        <span><i style={{ background: "var(--ok)" }} />HIT: dùng lại cache</span>
        <span><i style={{ background: "var(--bad)" }} />MISS: đã từng tính nhưng phải tính lại</span>
        <span><i style={{ background: "var(--warn)" }} />NEW: nội dung mới, tính lần đầu</span>
      </div>

      <div className="stats">
        <Stat v={hit.toLocaleString("vi")} k="token dùng lại (yêu cầu 2–6)" />
        <Stat v={<span style={{ color: miss ? "var(--bad)" : undefined }}>{miss.toLocaleString("vi")}</span>} k="token phải tính lại" />
        <Stat v={`${(cost / ideal).toFixed(1)}×`} k="chi phí so với append-only lý tưởng" />
      </div>
      <p className="small muted">
        Quy tắc: cache chỉ dùng lại được tới <b>token khác nhau đầu tiên</b>; mọi thứ phía sau phải tính lại dù nội dung giống hệt.
        Giá đọc cache tính ≈ 1/10 giá đầu vào thường. Hãy thử: chỉ bật “thời gian vào system prompt” — vì nó nằm ở ĐẦU nên toàn bộ
        prompt bị tính lại mỗi lần (đây là câu chuyện TTFT từ 0,5s lên 3–5s trong sách).
      </p>
    </div>
  );
}
