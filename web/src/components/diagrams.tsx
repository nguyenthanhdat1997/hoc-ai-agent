// Sơ đồ SVG dùng biến màu CSS nên tự đổi theo giao diện sáng/tối.
const s = (fill: string, stroke: string) => ({ fill: `var(${fill})`, stroke: `var(${stroke})`, strokeWidth: 1.5 });
const t = (fill = "--text") => ({ fill: `var(${fill})` });

export function AgentEnvDiagram() {
  const chips = ["Context", "Tool", "Ràng buộc", "Xác minh", "Sửa lỗi"];
  return (
    <svg className="diagram" viewBox="0 0 720 280" role="img" aria-label="Loop Agent và Môi trường">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: "var(--muted)" }} />
        </marker>
      </defs>
      <rect x="10" y="10" width="440" height="260" rx="14" style={{ ...s("--surface", "--border") }} />
      <text x="28" y="38" fontWeight="700" fontSize="15" style={t()}>Agent</text>

      <rect x="30" y="52" width="400" height="62" rx="10" style={s("--c-assistant-soft", "--c-assistant")} />
      <text x="48" y="78" fontWeight="700" fontSize="14" style={t()}>Model (LLM) — “bộ não” · Policy</text>
      <text x="48" y="99" fontSize="12.5" style={t("--muted")}>hiểu · suy nghĩ · chọn hành động tiếp theo</text>

      <rect x="30" y="128" width="400" height="126" rx="10" style={s("--accent-soft", "--accent")} />
      <text x="48" y="153" fontWeight="700" fontSize="14" style={t()}>Harness — lớp chạy &amp; quản trị</text>
      {chips.map((c, i) => (
        <g key={c}>
          <rect x={48 + (i % 3) * 124} y={166 + Math.floor(i / 3) * 40} width="114" height="30" rx="7"
            style={s(i < 2 ? "--surface" : "--surface-2", "--border")} />
          <text x={105 + (i % 3) * 124} y={186 + Math.floor(i / 3) * 40} fontSize="12.5" textAnchor="middle" style={t()}>{c}</text>
        </g>
      ))}
      <text x="296" y="236" fontSize="11" style={t("--muted")}>2 ô đầu = Harness tối thiểu</text>

      <rect x="520" y="40" width="190" height="200" rx="14" style={s("--c-tool-soft", "--c-tool")} />
      <text x="540" y="68" fontWeight="700" fontSize="15" style={t()}>Môi trường</text>
      {["hệ thống tệp · CSDL", "web · API · ứng dụng", "người dùng · Agent khác", "thế giới vật lý / mô phỏng"].map((x, i) => (
        <text key={x} x="540" y={100 + i * 30} fontSize="12.5" style={t()}>{x}</text>
      ))}

      <path d="M430 175 C 480 175, 480 120, 518 120" fill="none" style={{ stroke: "var(--muted)", strokeWidth: 1.6 }} markerEnd="url(#arr)" />
      <text x="452" y="112" fontSize="12" style={t("--muted")}>hành động</text>
      <path d="M520 190 C 480 190, 480 215, 432 215" fill="none" style={{ stroke: "var(--muted)", strokeWidth: 1.6 }} markerEnd="url(#arr)" />
      <text x="456" y="236" fontSize="12" style={t("--muted")}>quan sát</text>
    </svg>
  );
}

export function ContextLayoutDiagram() {
  const blocks: [string, string, number][] = [
    ["system", "System prompt", 120],
    ["tools", "Tool definitions", 110],
    ["user", "user", 54],
    ["assistant", "assistant", 70],
    ["tool", "tool result", 74],
    ["assistant", "assistant", 70],
    ["tool", "tool result", 74],
    ["status", "status", 62],
  ];
  let x = 10;
  const pos = blocks.map(([, , w]) => {
    const p = x;
    x += w + 4;
    return p;
  });
  return (
    <svg className="diagram" viewBox="0 0 680 150" role="img" aria-label="Bố cục context: static prefix và trajectory">
      {blocks.map(([k, label, w], i) => (
        <g key={i}>
          <rect x={pos[i]} y="50" width={w} height="44" rx="7" style={s(`--c-${k}-soft`, `--c-${k}`)} />
          <text x={pos[i] + w / 2} y="77" fontSize="11.5" textAnchor="middle" style={t()}>{label}</text>
        </g>
      ))}
      <path d="M10 40 h230" style={{ stroke: "var(--c-system)", strokeWidth: 2 }} />
      <text x="10" y="30" fontSize="12.5" fontWeight="600" style={t()}>Static prefix — không bao giờ sửa (KV Cache)</text>
      <path d="M244 112 h426" style={{ stroke: "var(--c-user)", strokeWidth: 2 }} />
      <text x="244" y="130" fontSize="12.5" fontWeight="600" style={t()}>Trajectory — chỉ nối thêm vào cuối, có thể nén</text>
      <text x="612" y="146" fontSize="11" textAnchor="middle" style={t("--muted")}>động ở cuối</text>
    </svg>
  );
}
