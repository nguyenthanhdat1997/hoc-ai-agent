import { useEffect, useRef, useState } from "react";
import { Stat } from "../components/ui";

type AgentState = "searching" | "not_found" | "found" | "terminated";
const SITES = [9, 6, 11, 4, 12, 7, 10, 8, 5, 9]; // số trang mỗi website khoa
const TARGET = { site: 3, page: 3 };
const TARGET2 = { site: 7, page: 3 };

// Manager song song: 10 agent tìm giảng viên, ai thấy trước thì broadcast terminate.
export function ParallelSearch() {
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [cascade, setCascade] = useState(true);
  const [twoHits, setTwoHits] = useState(false);
  const [lock, setLock] = useState(true);
  const timer = useRef<number | null>(null);

  const hits = twoHits ? [TARGET, TARGET2] : [TARGET];
  const firstHit = Math.min(...hits.map((h) => h.page + 1));
  const stopAt = cascade ? firstHit + 1 : Infinity; // 1 tick để broadcast terminate + ack

  const stateOf = (i: number): { s: AgentState; page: number } => {
    const hit = hits.find((h) => h.site === i);
    const end = hit ? hit.page + 1 : SITES[i];
    if (tick >= end) return { s: hit ? "found" : "not_found", page: end };
    if (tick >= stopAt) return { s: "terminated", page: stopAt };
    return { s: "searching", page: tick };
  };
  const states = SITES.map((_, i) => stateOf(i));
  const done = states.every((x) => x.s !== "searching");
  const pagesUsed = states.reduce((a, x) => a + x.page, 0);
  const found = states.filter((x) => x.s === "found").length;
  const aggregations = lock ? Math.min(found, 1) : found;

  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(() => setTick((t) => t + 1), 350);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [running]);
  useEffect(() => { if (done && running) setRunning(false); }, [done, running]);

  const reset = () => { setRunning(false); setTick(0); };
  const color: Record<AgentState, string> = { searching: "var(--accent)", not_found: "var(--muted)", found: "var(--ok)", terminated: "var(--warn)" };
  const label: Record<AgentState, string> = { searching: "đang tìm", not_found: "không thấy", found: "TÌM THẤY", terminated: "đã dừng" };

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small primary" disabled={running || done} onClick={() => setRunning(true)}>▶ Chạy</button>
        <button className="btn small" onClick={reset}>Làm lại</button>
        <label className="small row" style={{ gap: 4 }}><input type="checkbox" checked={cascade} onChange={(e) => { setCascade(e.target.checked); reset(); }} /> cascading termination</label>
        <label className="small row" style={{ gap: 4 }}><input type="checkbox" checked={twoHits} onChange={(e) => { setTwoHits(e.target.checked); reset(); }} /> 2 agent cùng thấy</label>
        <label className="small row" style={{ gap: 4 }}><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /> settle_once (lock)</label>
      </div>
      {SITES.map((n, i) => {
        const st = states[i];
        return (
          <div key={i} className="row" style={{ flexWrap: "nowrap", gap: 8, margin: "3px 0" }}>
            <span className="small" style={{ width: 62, flexShrink: 0 }}>agent_{i}</span>
            <div className="meter" style={{ flex: 1, height: 18 }}>
              <div className="fill" style={{ width: `${(st.page / 12) * 100}%`, background: color[st.s], opacity: 0.6 }} />
              <div className="mark" style={{ left: `${(n / 12) * 100}%`, background: "var(--border)" }} />
            </div>
            <span className="small" style={{ width: 86, color: color[st.s], fontWeight: st.s === "found" ? 700 : 400 }}>{label[st.s]}</span>
          </div>
        );
      })}
      <div className="stats">
        <Stat v={tick} k="Thời gian (tick)" />
        <Stat v={pagesUsed} k="Tổng số trang đã đọc (≈ token tiêu tốn)" />
        <Stat v={<span style={{ color: aggregations > 1 ? "var(--bad)" : undefined }}>{done ? aggregations : "…"}</span>} k="Số lần Manager tổng hợp kết quả" />
      </div>
      <p className="small muted">
        Tuần tự phải đọc {SITES.reduce((a, b) => a + b, 0)} trang. Bật “2 agent cùng thấy” và tắt lock: Manager tổng hợp hai lần — race condition.
        settle_once phải idempotent (lock hoặc transaction): chấp nhận “thành công đầu tiên ĐÃ KIỂM CHỨNG”, không phải “lời tuyên bố đầu tiên”.
      </p>
    </div>
  );
}

// Hai agent cùng sửa một file: lost update vs optimistic locking.
type Step = { who: "A" | "B"; op: "read" | "write"; add?: string };
const SCHEDULE: Step[] = [
  { who: "A", op: "read" }, { who: "B", op: "read" },
  { who: "A", op: "write", add: "attention → chú ý" }, { who: "B", op: "write", add: "embedding → nhúng" },
];

export function OptimisticLock() {
  const [optimistic, setOptimistic] = useState(false);
  const [n, setN] = useState(0);

  // mô phỏng tới bước n
  let file = { lines: ["agent → Agent"], ver: 1 };
  const seen: Record<string, { lines: string[]; ver: number }> = {};
  const log: string[] = [];
  const steps = [...SCHEDULE];
  if (optimistic) steps.push({ who: "B", op: "read" }, { who: "B", op: "write", add: "embedding → nhúng" });
  for (let i = 0; i < Math.min(n, steps.length); i++) {
    const s = steps[i];
    if (s.op === "read") {
      seen[s.who] = { lines: [...file.lines], ver: file.ver };
      log.push(`${s.who} đọc (version ${file.ver})`);
    } else {
      const base = seen[s.who];
      if (optimistic && base.ver !== file.ver) {
        log.push(`${s.who} ghi thất bại: đọc v${base.ver} nhưng file đã là v${file.ver} → đọc lại`);
        continue;
      }
      file = { lines: [...base.lines, s.add!], ver: file.ver + 1 };
      log.push(`${s.who} ghi “${s.add}” → version ${file.ver}`);
    }
  }
  const total = steps.length;
  const lost = n >= total && !file.lines.includes("attention → chú ý");

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <label className="small row" style={{ gap: 4 }}><input type="checkbox" checked={optimistic} onChange={(e) => { setOptimistic(e.target.checked); setN(0); }} /> optimistic locking</label>
        <button className="btn small primary" disabled={n >= total} onClick={() => setN(n + 1)}>Bước tiếp →</button>
        <button className="btn small" onClick={() => setN(0)}>Làm lại</button>
      </div>
      <div className="grid two">
        <div>
          <div className="small muted">Nhật ký</div>
          <ol className="small" style={{ margin: "4px 0", paddingLeft: 20 }}>{log.map((l, i) => <li key={i}>{l}</li>)}</ol>
        </div>
        <div>
          <div className="small muted">/workspace/shared/glossary.md (v{file.ver})</div>
          <pre className="small" style={{ margin: "4px 0", padding: 8, background: "var(--surface-2)", borderRadius: 8 }}>{file.lines.join("\n")}</pre>
        </div>
      </div>
      {n >= total && (
        <div className={"callout " + (lost ? "bad" : "ok")}>
          {lost ? "Lost update: B ghi đè bằng bản B đã đọc từ trước — thuật ngữ của A biến mất mà không ai báo lỗi." : "Đủ cả hai thuật ngữ. Cái giá: B phải đọc lại và làm lại một lần."}
        </div>
      )}
      <p className="small muted">
        Optimistic locking chỉ chống xung đột trên cùng một file. Xung đột ngữ nghĩa xuyên file (A đánh số lại hình, B vẫn tham chiếu số cũ)
        cần kiểm chứng ở tầng cao hơn; với code thì mỗi Agent một worktree/branch, gộp ở điểm merge.
      </p>
    </div>
  );
}
