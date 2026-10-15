import { useState } from "react";
import { Msg, Stat } from "../components/ui";

type Skill = { name: string; desc: string; vague: string; body: number; docs: [string, number][] };

const SKILLS: Skill[] = [
  { name: "pdf", desc: "Dùng khi cần đọc, trích văn bản/bảng/hình từ tệp PDF. Không dùng để tạo slide.", vague: "Trợ giúp về tài liệu.", body: 2000, docs: [["forms.md", 1200]] },
  { name: "pptx", desc: "Dùng khi cần TẠO hoặc sửa bài thuyết trình PowerPoint.", vague: "Trợ giúp về tài liệu.", body: 2200, docs: [["html2pptx.md", 1500], ["reference.md", 1800]] },
  { name: "docx", desc: "Dùng khi cần tạo/sửa tệp Word .docx. Không dùng cho email.", vague: "Trợ giúp về tài liệu.", body: 1900, docs: [["ooxml.md", 1600]] },
  { name: "xlsx", desc: "Dùng khi cần tạo/sửa bảng tính Excel, công thức, biểu đồ.", vague: "Trợ giúp về dữ liệu.", body: 1700, docs: [] },
  { name: "brand-voice", desc: "Dùng khi viết nội dung marketing theo giọng thương hiệu.", vague: "Trợ giúp viết.", body: 900, docs: [] },
];
const META = 60; // token mỗi dòng siêu dữ liệu

type Task = { label: string; good: [string, string[]][]; vague: [string, string[]][] };
const TASKS: Task[] = [
  { label: "Tạo bài thuyết trình 12 slide từ bài báo PDF", good: [["pptx", ["html2pptx.md"]]], vague: [["pdf", []], ["pptx", ["html2pptx.md"]], ["docx", []]] },
  { label: "Trích bảng số liệu trong PDF sang Excel", good: [["pdf", []], ["xlsx", []]], vague: [["pdf", []], ["pptx", []], ["docx", []], ["xlsx", []]] },
  { label: "Viết email xin nghỉ phép 2 ngày", good: [], vague: [["docx", []], ["brand-voice", []]] },
];

export function SkillsDisclosure() {
  const [task, setTask] = useState(0);
  const [vague, setVague] = useState(false);
  const loads = (vague ? TASKS[task].vague : TASKS[task].good).map(([n, docs]) => ({ skill: SKILLS.find((s) => s.name === n)!, docs }));

  const listing = SKILLS.length * META;
  const loaded = loads.reduce((a, l) => a + l.skill.body + l.docs.reduce((b, d) => b + (l.skill.docs.find((x) => x[0] === d)?.[1] ?? 0), 0), 0);
  const stuffAll = SKILLS.reduce((a, s) => a + s.body + s.docs.reduce((b, d) => b + d[1], 0), 0);

  return (
    <div>
      <div className="label">Nhiệm vụ</div>
      <div className="row">
        {TASKS.map((t, i) => (
          <button key={i} className={"btn small" + (task === i ? " on" : "")} onClick={() => setTask(i)}>{t.label}</button>
        ))}
      </div>
      <label className="row" style={{ gap: 8, margin: "10px 0", cursor: "pointer" }}>
        <input type="checkbox" className="check" checked={vague} onChange={(e) => setVague(e.target.checked)} />
        Dùng mô tả mơ hồ (“Trợ giúp về tài liệu”) thay vì điều kiện định tuyến rõ ràng
      </label>

      <div className="demo-split">
        <div>
          <div className="label">Context</div>
          <Msg kind="system">System prompt (cố định)</Msg>
          <Msg kind="tools">tools: Skill, Read, Bash, Write… (cố định)</Msg>
          <Msg kind="user">{TASKS[task].label}</Msg>
          <Msg kind="status">
            {"Tầng 1 · danh mục Skill (~" + listing + " token, luôn có):\n"}
            {SKILLS.map((s) => `• ${s.name}: ${vague ? s.vague : s.desc}`).join("\n")}
          </Msg>
          {loads.length === 0 && <div className="small muted">→ Không Skill nào khớp: không nạp thêm gì.</div>}
          {loads.map((l) => (
            <div key={l.skill.name}>
              <Msg kind="assistant">🔧 Skill(skill: "{l.skill.name}")</Msg>
              <Msg kind="user" fresh>{`Tầng 2 · ${l.skill.name}/SKILL.md (${l.skill.body} token) — nối vào CUỐI`}</Msg>
              {l.docs.map((d) => (
                <Msg kind="tool" key={d} fresh>{`Tầng 3 · đọc ${d} khi cần chi tiết`}</Msg>
              ))}
            </div>
          ))}
        </div>
        <div>
          <div className="stats">
            <Stat v={(listing + loaded).toLocaleString("vi")} k="token Skill trong context" />
            <Stat v={stuffAll.toLocaleString("vi")} k="nếu nhồi tất cả vào system prompt" />
          </div>
          <div className="callout ok">
            Static prefix <b>không đổi</b>: danh mục và nội dung Skill đều được <b>nối vào cuối</b> (emit-once), nên cache phía trước
            vẫn dùng lại được ở mọi vòng sau.
          </div>
          {vague && (
            <div className="callout bad">
              Mô tả mơ hồ khiến model nạp nhầm Skill không liên quan (tốn token, loãng chú ý), thậm chí kích hoạt ở tác vụ không
              cần (email). Mô tả tốt là <b>điều kiện định tuyến</b>: “Dùng khi… / Không dùng khi…”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
