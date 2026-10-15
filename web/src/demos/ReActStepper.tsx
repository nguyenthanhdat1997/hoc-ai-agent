import { useMemo, useState } from "react";
import { Msg, type MsgKind } from "../components/ui";

type Item = { kind: MsgKind; text: string; hidden?: boolean };
type Step = { items: Item[]; note: string; outcome?: "ok" | "bad" | "stop"; round: number; calls: number };
type Variant = "baseline" | "tools" | "results" | "history";

const USER = "Q1 2,5 triệu USD · Q2 2,1 triệu EUR · Q3 1,8 triệu GBP · Q4 380 triệu JPY. Tính tổng năm và trung bình quý (USD).";
const CONVERT =
  "💭 Cần quy đổi EUR, GBP, JPY sang USD trước.\n🔧 convert_currency(2100000, EUR)\n🔧 convert_currency(1800000, GBP)\n🔧 convert_currency(380000000, JPY)";
const RESULTS = ["EUR→USD: 2,282,608.70", "GBP→USD: 2,278,481.01", "JPY→USD: 2,541,806.02"];
const CALC = "💭 Đã có tỷ giá, tính tổng bằng tool.\n🔧 calculator(2500000 + 2282608.70 + 2278481.01 + 2541806.02)";
const FINAL = "Tổng doanh thu năm: 9.602.895,73 USD. Trung bình mỗi quý: 2.400.723,93 USD.";

const VARIANTS: { id: Variant; label: string }[] = [
  { id: "baseline", label: "Đầy đủ context" },
  { id: "tools", label: "Bỏ tool definition" },
  { id: "results", label: "Bỏ tool result" },
  { id: "history", label: "Bỏ lịch sử" },
];

function buildSteps(v: Variant): Step[] {
  const steps: Step[] = [];
  const traj: Item[] = [{ kind: "user", text: USER }];
  const push = (note: string, round: number, calls: number, outcome?: Step["outcome"]) =>
    steps.push({ items: traj.map((x) => ({ ...x })), note, round, calls, outcome });

  push("Harness ghép static prefix (system + tools) với trajectory hiện có rồi gọi model.", 0, 0);

  if (v === "tools") {
    traj.push({ kind: "assistant", text: "Tổng doanh thu năm khoảng 9.450.000 USD, trung bình khoảng 2.362.500 USD." });
    push(
      "Không thấy tool nào, model KHÔNG im lặng mà trả lời rất tự tin bằng tỷ giá “nhớ” từ dữ liệu huấn luyện. Sai ~150.000 USD, nhưng trông như thật.",
      1, 0, "bad",
    );
    return steps;
  }

  if (v === "baseline") {
    traj.push({ kind: "assistant", text: CONVERT });
    push("Vòng 1: model quyết định gọi 3 tool song song (chúng không phụ thuộc nhau). Model chỉ RA QUYẾT ĐỊNH, chưa chạy gì cả.", 1, 0);
    RESULTS.forEach((r) => traj.push({ kind: "tool", text: r }));
    push("Harness thực thi 3 tool và NỐI kết quả vào cuối trajectory.", 1, 3);
    traj.push({ kind: "assistant", text: CALC });
    push("Vòng 2: model nhìn thấy toàn bộ lịch sử, gồm cả kết quả quy đổi, rồi gọi calculator thay vì tính nhẩm.", 2, 3);
    traj.push({ kind: "tool", text: "result: 9,602,895.73" });
    push("Harness chạy calculator, nối kết quả.", 2, 4);
    traj.push({ kind: "assistant", text: FINAL });
    push("Vòng 3: không còn tool call → loop kết thúc. 3 vòng, 4 lần gọi tool.", 3, 4, "ok");
    return steps;
  }

  // results / history: lặp mù cho tới khi chạm max_iterations
  let calls = 0;
  for (let round = 1; round <= 3; round++) {
    if (v === "history") traj.forEach((x) => x.kind !== "user" && (x.hidden = true));
    traj.push({ kind: "assistant", text: CONVERT });
    push(
      round === 1
        ? "Vòng 1: model gọi 3 lệnh quy đổi như bình thường."
        : v === "results"
          ? `Vòng ${round}: các lệnh gọi trước còn đó, nhưng KẾT QUẢ không được gửi → model không biết chuyện gì đã xảy ra, gọi lại y hệt.`
          : `Vòng ${round}: mỗi lần gọi chỉ gửi system + câu hỏi gốc → model như mới bắt đầu, lặp lại đúng thao tác cũ.`,
      round, calls,
    );
    calls += 3;
    RESULTS.forEach((r) => traj.push({ kind: "tool", text: r, hidden: v === "results" || undefined }));
    push(
      v === "results"
        ? "Harness vẫn chạy tool, nhưng kết quả bị cắt khỏi context (gạch ngang = không gửi cho model)."
        : "Harness chạy tool và nối kết quả — nhưng vòng sau chúng sẽ không được gửi đi.",
      round, calls,
    );
  }
  push("… cứ thế đến vòng 6: chạm max_iterations, Harness dừng. 18 lần gọi tool, không có câu trả lời. Đây là “loop mù”.", 6, 18, "stop");
  return steps;
}

export function ReActStepper() {
  const [variant, setVariant] = useState<Variant>("baseline");
  const [i, setI] = useState(0);
  const steps = useMemo(() => buildSteps(variant), [variant]);
  const step = steps[Math.min(i, steps.length - 1)];
  const prevLen = i > 0 ? steps[i - 1].items.length : 0;

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        {VARIANTS.map((v) => (
          <button key={v.id} className={"btn small" + (variant === v.id ? " on" : "")}
            onClick={() => { setVariant(v.id); setI(0); }}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="demo-split">
        <div>
          <div className="label">Context gửi cho model ở bước này</div>
          <Msg kind="system">Bạn là trợ lý tài chính. Luôn dùng tool để quy đổi và tính toán…</Msg>
          <Msg kind="tools" ghost={variant === "tools"}>convert_currency(amount, from, to) · calculator(expression)</Msg>
          {step.items.map((it, k) => (
            <Msg key={k} kind={it.kind} ghost={it.hidden} fresh={k >= prevLen && i > 0}>
              {it.text}
            </Msg>
          ))}
        </div>
        <div>
          <div className="label">Chuyện gì đang xảy ra</div>
          <div className={"callout " + (step.outcome === "ok" ? "ok" : step.outcome ? "bad" : "")}>
            {step.note}
          </div>
          <div className="stats">
            <div className="stat"><div className="v">{step.round}</div><div className="k">vòng gọi model</div></div>
            <div className="stat"><div className="v">{step.calls}</div><div className="k">lần gọi tool</div></div>
          </div>
          <div className="row">
            <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>← Lùi</button>
            <button className="btn primary" disabled={i >= steps.length - 1} onClick={() => setI(i + 1)}>Bước tiếp →</button>
            <span className="muted small">{i + 1}/{steps.length}</span>
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>
            Đáp án đúng: tổng <b>9.602.895,73 USD</b>. Khung viền xanh là tin nhắn vừa được nối vào; gạch ngang là phần bị cắt khỏi context.
          </p>
        </div>
      </div>
    </div>
  );
}
