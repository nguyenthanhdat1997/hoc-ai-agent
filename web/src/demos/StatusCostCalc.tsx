import { useState } from "react";
import { Formula, Stat } from "../components/ui";

function Slider({ label, value, min, max, step, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <label className="small" style={{ display: "block", margin: "6px 0" }}>
      {label}: <b>{fmt ? fmt(value) : value}</b>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function StatusCostCalc() {
  const [S, setS] = useState(150);
  const [R, setR] = useState(800);
  const [N, setN] = useState(20);
  const [a, setA] = useState(0.1);

  const replace = (N - 1) * (1 - a) * R;
  const append = (a * S * N * (N - 1)) / 2;
  const better = append < replace ? "append" : "replace";

  return (
    <div>
      <div className="grid two">
        <div>
          <Slider label="S — token mỗi bản trạng thái" value={S} min={30} max={1500} step={10} onChange={setS} />
          <Slider label="R — token thêm vào giữa hai lần cập nhật" value={R} min={50} max={5000} step={50} onChange={setR} />
        </div>
        <div>
          <Slider label="N — số lần cập nhật dự kiến" value={N} min={2} max={100} step={1} onChange={setN} />
          <Slider label="α — giá đọc cache / giá đầu vào thường" value={a} min={0.05} max={0.5} step={0.01} onChange={setA} fmt={(v) => v.toFixed(2)} />
        </div>
      </div>
      <Formula>
        C<sub>thay thế</sub> ≈ (N−1)(1−α)R &nbsp;&nbsp;·&nbsp;&nbsp; C<sub>nối thêm</sub> ≈ αSN(N−1)/2
      </Formula>
      <div className="stats">
        <Stat v={Math.round(replace).toLocaleString("vi")} k="chi phí phụ: thay thế mỗi vòng" />
        <Stat v={Math.round(append).toLocaleString("vi")} k="chi phí phụ: nối thêm mãi" />
        <Stat v={better === "append" ? "Nối thêm" : "Thay thế"} k="nên chọn (theo ước tính)" />
      </div>
      <p className="small muted">
        <b>Thay thế</b>: xóa trạng thái cũ → phần đã thêm sau nó (R token) phải tính lại ở mỗi lần cập nhật. <b>Nối thêm</b>
        (như <code>&lt;system-reminder&gt;</code> của Claude Code): không phá cache nhưng trạng thái cũ tích lũy và vẫn phải đọc lại.
        Trạng thái nhỏ + nhiều nội dung giữa các lần cập nhật + session ngắn → nối thêm. Trạng thái lớn, cập nhật dày, session dài → thay
        thế. Ước tính chưa tính phần context bị chiếm và sự nhầm lẫn từ trạng thái cũ.
      </p>
    </div>
  );
}
