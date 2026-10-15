import type { Chapter } from "../lib/types";
import { Callout, Code, Formula, Table } from "../components/ui";
import { Classifier } from "../demos/Classifier";
import { EditSchemes, ErrorTriage, MathByCode } from "../demos/CodingDemos";
import { LabSetup } from "./labSetup";
import codingAgentPy from "../../../agent-lab/ch05/coding_agent.py?raw";
import codeRulesPy from "../../../agent-lab/ch05/code_as_rules.py?raw";

function QuadrantDemo() {
  return (
    <Classifier
      options={["Sweet spot", "Throughput-limited", "Hiệu quả nhưng lạc hướng", "Khó bắt đầu"]}
      items={[
        { text: "Sửa bug đã có test case tái hiện", answer: "Sweet spot", why: "Mục tiêu rõ + kết quả tự kiểm được bằng test." },
        { text: "Refactor lớn cần con người review từng phần", answer: "Throughput-limited", why: "Mục tiêu rõ nhưng nghiệm thu bằng mắt người → tốc độ bị chặn bởi tốc độ review." },
        { text: "Tối ưu “chất lượng code” chỉ bằng điểm linter", answer: "Hiệu quả nhưng lạc hướng", why: "Có phản hồi tự động nhưng mục tiêu mơ hồ → hệ thống chạy rất nhanh… theo hướng sai." },
        { text: "“Làm cho UI đẹp hơn”", answer: "Khó bắt đầu", why: "Mục tiêu mơ hồ, nghiệm thu thủ công — Agent ít tác dụng. Harness phải đẩy việc về góc “rõ + tự kiểm”." },
      ]}
    />
  );
}

export const ch5: Chapter = {
  id: 5,
  title: "Coding Agent và Code Generation",
  short: "Coding Agent",
  tier: "Xây dựng Agent",
  minutes: 45,
  ready: true,
  oneLiner: "Lõi của mọi general-purpose Agent là một Coding Agent cộng với file system. Code không chỉ để viết chương trình — nó là meta-capability: ngôn ngữ để Agent tư duy chặt chẽ, tạo tool mới và tự tạo Agent.",
  keyIdeas: [
    "Coding Agent + file system là lõi của general-purpose Agent cho nhiệm vụ mở (Manus, OpenClaw): PPT, Word, PDF, phân tích dữ liệu… cuối cùng đều quy về code.",
    "7 tool cốt lõi: code interpreter, bash, read, write, edit, glob, grep — tối thiểu mà đủ. File system là trung tâm: MEMORY.md, SOUL.md, nhật ký theo ngày, Git.",
    "Quy trình: tài liệu dự án (CLAUDE.md/AGENTS.md) → làm rõ yêu cầu → design doc → code + test (“test pass” mới là xong) → tự review → cập nhật tài liệu.",
    "Coding Agent chín muồi không phải vì model sinh code giỏi đặc biệt, mà vì hạ tầng phần mềm hàng chục năm (test, type system, Git) tự nhiên là một Harness mạnh. Constraints over guidance.",
    "Failure recovery: phân loại 4 tầng (API, tool, context, control flow) → “retry có giúp không?” → silent retry → degrade → báo người; mọi đường khôi phục cần trần; chống death spiral.",
    "Kỹ thuật triển khai: tool call song song + streaming, read kèm số dòng, Status Bar môi trường (cwd, git branch), persistent terminal, syntax check ngay sau khi ghi.",
    "Security: Lethal Triad (dữ liệu riêng tư + nội dung không tin cậy + giao tiếp ra ngoài) + persistent memory làm khuếch đại; sandbox chặn network egress; semantic parsing thay blacklist; loyalty với principal.",
    "Code là meta-capability theo 6 hướng: thinking tool, business rule constraint, multimedia generation, system adapter, Generative UI, Agent bootstrapping.",
  ],
  sections: [
    {
      id: "core",
      title: "Coding là năng lực nền: 7 tool và file system",
      body: (
        <>
          <Table
            head={["Tool", "Dùng để"]}
            rows={[
              ["Code Interpreter", "Chạy Python trong sandbox cách ly với host"],
              ["Bash Shell", "Chạy lệnh terminal: test, xử lý tệp"],
              ["Read File", "Đọc code, cấu hình, tài liệu, log"],
              ["Write File", "Tạo tệp mới hoặc ghi đè toàn bộ"],
              ["Edit File", "Sửa một phần tệp — thao tác cốt lõi khi bảo trì code"],
              ["Glob", "Tìm tệp theo mẫu đường dẫn (**/*.py)"],
              ["Grep", "Tìm nội dung theo mẫu (mọi chỗ gọi một hàm)"],
            ]}
          />
          <Code lang="text">{`
User: Liệt kê mọi comment TODO trong project
Agent → Grep("TODO", glob="**/*.py")   →  src/api.py:42  # TODO: add rate limiting …
Agent → Write("TODO_LIST.md", …)       →  File created
Agent: Tìm thấy 3 TODO, đã lưu vào TODO_LIST.md`}</Code>
          <p className="small muted">
            Codex còn gọn hơn: shell là lối thực thi tổng quát duy nhất, sửa tệp qua <code>apply_patch</code> có ràng buộc cú pháp. Bảy tool
            được tách ra để dễ nắm năng lực cần có.
          </p>
          <h3>Vì sao Coding là lõi của Manus/OpenClaw</h3>
          <p>
            Gần như mọi việc tạo nội dung hiệu quả đều quy về code: PPT/Word là OOXML, PDF sinh từ Markdown/HTML/LaTeX, phân tích dữ liệu bằng
            Python, chuỗi thao tác GUI thành công có thể ghi lại thành code tái sử dụng. Code generation là nền năng lực rẻ nhất, nhanh nhất,
            tái sử dụng tốt nhất.
          </p>
          <p>
            <b>File system là trung tâm:</b> MEMORY.md (sự thật, sở thích), nhật ký <code>daily/YYYY-MM-DD.md</code>, SOUL.md (danh tính
            và quy tắc hành vi), Git để rollback. Markdown thay vì vector DB: người dùng mở ra sửa trực tiếp, giữ thứ tự thời gian, có
            phiên bản. Ví dụ “phân tích doanh số quý trước”: đọc MEMORY.md (thích PDF, dữ liệu ở Google Sheets) → tải dữ liệu bằng code → viết
            script pandas/matplotlib → ghi report.pdf → cập nhật MEMORY.md để lần sau khỏi hỏi.
          </p>
          <Callout title="Phạm vi áp dụng">
            Kết luận “Coding Agent là lõi” đúng nhất với Agent cho nhiệm vụ mở (research, sinh nội dung, xử lý dữ liệu). Agent CSKH chuyên
            ngành xoay quanh quy trình nghiệp vụ cố định — ở đó code là một tool trong hộp, dù vẫn quan trọng cho tính toán và kiểm tra quy tắc.
          </Callout>
        </>
      ),
    },
    {
      id: "workflow",
      title: "Quy trình làm việc của Coding Agent",
      body: (
        <>
          <ol>
            <li><b>Tài liệu dự án:</b> như kỹ sư mới — tìm hiểu trước khi sửa. Thiếu tài liệu thì tự dựng architecture overview. <b>Project instruction files</b> (CLAUDE.md, AGENTS.md, .cursorrules) được inject mỗi phiên: lệnh build/test (“dùng pnpm test”), code style, vùng cấm (“không sửa migrations/”) — và là static prefix rẻ nhất.</li>
            <li><b>Làm rõ yêu cầu:</b> “tối ưu hiệu năng” là giảm latency, giảm RAM hay tăng throughput? Chấp nhận code phức tạp hơn không?</li>
            <li><b>Design doc:</b> sửa module nào, vì sao, phương án và đánh đổi, dependency mới, tác động. Review một design doc dễ hơn review hàng trăm dòng code — chờ duyệt rồi mới làm.</li>
            <li><b>Code + test:</b> viết test cho đường bình thường, biên, lỗi; fail thì tự phân tích và sửa. Cách “lười” phổ biến nhất là bỏ qua bước này và báo xong. <b>“Test pass” chứ không phải “code đã viết” mới là tiêu chí hoàn thành.</b></li>
            <li><b>Tự review + cập nhật tài liệu:</b> đọc lại, lint, hoặc gọi sub-agent review; thay đổi kiến trúc thì cập nhật ARCHITECTURE.md — tài liệu lỗi thời còn tệ hơn không có.</li>
          </ol>
          <p className="small muted">
            Agent thật cắt bớt theo độ phức tạp. Và mỗi model có “ngưỡng” riêng khi nào ngừng đọc để bắt đầu sửa — đó là hành vi học được của
            model, không chỉ là phong cách của sản phẩm (Chương 7 đo, Chương 8 giải thích).
          </p>
          <p>Thước đo team “AI-ready”: một người mới làm từ xa, chỉ dựa vào repo và tài liệu, có tự bắt đầu làm việc được không?</p>
        </>
      ),
    },
    {
      id: "harness",
      title: "Harness Engineering cho Coding Agent",
      body: (
        <>
          <Table
            head={["Thành phần", "Trong Coding Agent"]}
            rows={[
              ["Acceptance baseline", "Thế nào là xong: test suite, CI pipeline, tiêu chuẩn review"],
              ["Execution boundary", "Được đụng gì: ranh giới module, quy tắc dependency, quyền"],
              ["Feedback signals", "Linter, kết quả test, lỗi type check"],
              ["Rollback", "Git, sandbox, snapshot"],
            ]}
          />
          <p>
            Coding Agent chín muồi nhất không phải vì model sinh code giỏi đặc biệt mà vì code nằm sẵn ở góc <b>“mục tiêu rõ + tự kiểm được”</b>.
            Ba ca thực tế: migration code quy mô lớn (tri thức phải nằm trong codebase; ràng buộc mã hóa thành linter/CI; kiểm–sửa tự động đầu
            cuối), LangChain (dùng Agent phân tích trajectory thất bại để cải tiến Harness), Anthropic (initializer Agent chia việc + executor
            Agent làm từng bước, chống “làm quá nhiều một lúc” và “báo xong sớm”).
          </p>
          <ol>
            <li><b>Constraints over guidance:</b> luật mã hóa được thì đưa vào linter/type/CI — “không thể” mạnh hơn “được khuyên đừng”.</li>
            <li><b>Tự động hóa kiểm chứng:</b> review thủ công không mở rộng được.</li>
            <li><b>Feedback nhanh và có cấu trúc:</b> càng chi tiết, càng gần lúc lỗi càng tốt.</li>
            <li><b>Rollback phải tin cậy:</b> có lưới an toàn thì Agent mới dám thử.</li>
          </ol>
          <Callout kind="warn" title="Ràng buộc quá trình, không chỉ kết quả">
            Xóa rồi dựng lại database để “sửa lỗi” DB — đúng là hết lỗi, nhưng mất dữ liệu. Xóa hết code để build pass. Đây là dạng reward hacking
            hằng ngày. Harness đặt kiểm tra riêng cho hành động nguy hiểm (rm -rf, xóa dữ liệu production, ghi đè tệp chưa đọc); phía huấn luyện,
            RLVP (Chương 8) phạt vi phạm có thể kiểm chứng dọc đường đi. Lỗi trong một lô tool call song song chỉ lan trong lô đó, không lên thao tác cha.
          </Callout>
        </>
      ),
    },
    {
      id: "failure",
      title: "Failure và error recovery",
      body: (
        <>
          <Table
            head={["Tầng", "Ví dụ"]}
            rows={[
              ["API", "429 rate limit, quá tải, timeout, rớt kết nối, output bị cắt ở giới hạn token"],
              ["Tool", "Gọi tool không tồn tại, tham số sai, exception, cùng một lỗi lặp lại trong khi model retry y hệt"],
              ["Context", "Tràn cửa sổ, nén thất bại, trajectory hỏng (tool call thiếu result)"],
              ["Control flow", "Vòng lặp vô hạn, death spiral (logic xử lý lỗi gọi LLM, lại lỗi, dây chuyền)"],
            ]}
          />
          <ul>
            <li><b>Phát hiện:</b> phân loại trước (retryable vs non-retryable), rồi đếm: fingerprint (tool + args) lặp lại, bộ đếm fail liên tiếp mỗi đường khôi phục. Kết nối streaming “im lặng” cần <b>idle watchdog</b>.</li>
            <li><b>Khôi phục leo thang:</b> silent retry (exponential backoff + jitter; lời gọi phụ chạy nền fail thì bỏ, đừng retry tranh quota) → degrade & continue (tăng output cap, viết tiếp từ chỗ đứt, fallback model) → báo người dùng kèm những gì đã thử.</li>
            <li><b>Lỗi tầng tool không kết thúc phiên:</b> biến thành tool result có cấu trúc để model tự sửa ở lượt sau.</li>
            <li><b>Đơn vị xử lý lỗi là cả recovery loop:</b> giữ lỗi lại cho tới khi chắc không khôi phục được.</li>
            <li><b>Mọi đường khôi phục cần trần</b> lấy từ dữ liệu thật: Claude Code dừng nén sau 3 lần fail liền — một phiên từng fail hơn 3.000 lần liền, các retry vô ích tốn ~250.000 API call/ngày.</li>
          </ul>
          <Callout title="Bàn giao trajectory cho vendor khác">
            Tool call/result khác cấu trúc nhưng cùng nghĩa — render lại là được. Khó là reasoning: gồm text đọc được + credential chứng minh nó do
            chính vendor tạo; text mang sang được, credential thì không. Nguyên tắc: <b>lưu trajectory ở định dạng trung lập</b> — tách reasoning
            thành text di động và credential không di động; tool call chỉ lưu tên + tham số, ID sinh lại khi render. Định dạng trung lập còn phục vụ
            replay đánh giá (Ch.7), dựng dữ liệu huấn luyện (Ch.8), trích kinh nghiệm (Ch.9).
          </Callout>
        </>
      ),
    },
    {
      id: "tips",
      title: "Kỹ thuật triển khai, search tool và file editing tool",
      body: (
        <>
          <ul>
            <li><b>Song song + streaming:</b> tham số của tool call đầu đã đủ và hợp lệ thì chạy ngay, chồng lên lúc model còn sinh các call sau. Mỗi tool khai báo có chạy song song được không (mặc định không).</li>
            <li><b>Context tinh:</b> read theo khoảng dòng, <b>kèm số dòng</b> để tham chiếu “dòng 42 của src/main.py”; output dài cắt đầu/cuối.</li>
            <li><b>Status Bar môi trường</b> nối ở cuối: cwd, git branch, commit gần đây, thay đổi staged/unstaged — không hardcode vào system prompt.</li>
            <li><b>Persistent terminal:</b> giữ cwd, venv, biến môi trường giữa các lệnh.</li>
            <li><b>Syntax feedback tức thì:</b> ghi tệp xong tự chạy linter, trả lỗi trong tool result.</li>
          </ul>
          <Table
            head={["Search", "Giỏi", "Hạn chế"]}
            rows={[
              ["grep/ripgrep (regex)", "Biết chính xác text cần tìm: tên hàm, thông báo lỗi", "Không hiểu ngữ nghĩa"],
              ["glob (tên tệp)", "Bước đầu khám phá cấu trúc project, rất nhanh", "Không đọc nội dung"],
              ["Semantic code search", "Khám phá codebase lạ (“kiểm tra input người dùng”); chunk theo hàm/class + hybrid retrieval", "Phải duy trì index cũ dần theo code"],
              ["Symbol definition/reference", "Phân biệt định nghĩa với lời gọi", "Coding agent chủ lưu hiện chưa dùng"],
            ]}
          />
          <p className="small muted">
            Claude Code cố ý không dựng embedding index, chỉ dùng agentic grep + glob tại chỗ; Cursor từng dựng index nhưng nay cũng chuyển sang grep + glob.
          </p>
        </>
      ),
    },
    {
      id: "security",
      title: "Security cho Coding Agent",
      body: (
        <>
          <Formula>Lethal Triad: dữ liệu riêng tư + nội dung không tin cậy + khả năng giao tiếp ra ngoài (+ persistent memory làm khuếch đại)</Formula>
          <p>
            Đủ ba yếu tố là vòng tấn công khép kín: chỉ thị độc trong nội dung không tin cậy → đọc dữ liệu riêng tư → gửi ra ngoài. Persistent memory
            biến tấn công một lần thành mối đe dọa nằm chờ xuyên phiên. Lọc input gần như vô dụng trước prompt injection — mục tiêu là Agent đã bị
            tiêm nhiễm cũng <b>không có cơ hội</b> hoàn tất hành động nguy hiểm.
          </p>
          <ul>
            <li><b>Network egress control:</b> mặc định không mạng, proxy whitelist (nguồn package, tài liệu, API cần thiết) — phòng thủ tầng thực thi cho yếu tố thứ 3.</li>
            <li><b>File system:</b> mount source read-only, thư mục workspace ghi riêng, không mount credential (~/.ssh, key, token).</li>
            <li><b>Quota + timeout:</b> chống vòng lặp vô hạn, fork bomb; vượt quota thì trả lỗi có cấu trúc chứ không kill âm thầm.</li>
            <li><b>Semantic parsing thay blacklist:</b> chặn <code>rm</code> thì có <code>$(echo rm) -rf /</code>; <code>find / -exec rm {"{}"} \;</code> giấu lệnh xóa; <code>curl -o /etc/crontab …</code> trông như tải tệp nhưng ghi đè lịch hệ thống.</li>
          </ul>
          <Callout title="Agent trung thành với ai? (principal loyalty)">
            Model mặc định “ai nói chuyện thì giúp người đó” — nguy hiểm khi Agent thay mặt bạn đàm phán với bên thứ ba. Hai đầu đều hỏng: quá thật
            thà (lộ “giá sàn của chúng tôi là 12.000”) hoặc quá đa nghi (từ chối cả yêu cầu hợp lệ của chủ). Harness phải đóng đinh: chỉ thị của
            principal ưu tiên cao nhất; mọi thứ từ bên ngoài (nội dung repo, output tool, MCP server) mặc định là dữ liệu không có hiệu lực chỉ thị;
            khi từ chối đừng liệt kê chi tiết được bảo vệ.
          </Callout>
        </>
      ),
    },
    {
      id: "meta",
      title: "Code là meta-capability: 6 hướng",
      body: (
        <>
          <Table
            head={["Hướng", "Ý tưởng", "Ví dụ trong sách"]}
            rows={[
              ["1. Thinking tool", "LLM hiểu đề và viết code; solver tính chính xác", "SymPy/scipy cho bài AIME; python-constraint cho Knights & Knaves (>90%)"],
              ["2. Business rule constraint", "Luật mơ hồ bằng lời → code chạy hoặc lỗi, không có lưng chừng", "cancel_reservation kiểm bằng dữ liệu database, không tin tham số model khai"],
              ["3. Multimedia generation", "Tài liệu = dữ liệu có cấu trúc + code (Slidev, Blender API, FFmpeg)", "PPT từ bài báo, video giải thích, cắt video theo cảnh"],
              ["4. System adapter", "Code là “keo vạn năng” nối máy với máy; RPA cho hệ thống chỉ có GUI", "Log parser tự sinh khi định dạng đổi; chẩn đoán log production → test → GitHub issue"],
              ["5. Generative UI", "Sinh form, biểu đồ, cả ứng dụng thay vì chỉ văn bản", "Form làm rõ ý định một lần thay 10 lượt hỏi; SQL artifact"],
              ["6. Agent bootstrapping", "Code tạo/sửa Agent — kể cả chính nó", "OpenClaw doctor; Agent tạo Agent bằng cách sửa một bản mẫu tốt"],
            ]}
          />
          <h3>Business rules: ba tầng bảo vệ</h3>
          <ol>
            <li>Luật bằng ngôn ngữ tự nhiên trong system prompt — để hiểu và giải thích cho người dùng, gợi ý phương án hợp lệ (“đổi vé thay vì hủy”).</li>
            <li>Tool description + tham số <code>expected_cabin_class</code>, <code>expected_has_insurance</code> làm <b>checklist</b> buộc model tra cứu và kiểm từng điều trước khi gọi — nhưng đó chỉ là lời khai.</li>
            <li><b>Code phía server kiểm bằng dữ liệu thật</b> (database, đồng hồ server) là người gác cổng cuối — independence không chỉ là model độc lập mà còn là <b>nguồn dữ liệu độc lập</b>.</li>
          </ol>
          <h3>Proposer–Reviewer cho nội dung</h3>
          <p>
            Proposer viết code Slidev; Reviewer render từng trang thành ảnh, dùng Vision LLM nhận xét cụ thể (“trang 3 tràn chữ cột phải”). Tách
            hai Agent vì context: Reviewer chỉ xem ảnh bản mới nhất; Proposer chỉ tích lũy nhận xét dạng text. Dừng khi đạt chuẩn hoặc hết số vòng.
          </p>
          <Callout title="Code hay generative model? (3D, ảnh)">
            Vật có mô tả gọn và chính xác (mặt bích: 5–6 tham số, dung sai ±0,05mm) → code (CadQuery/OpenSCAD) xuất B-rep/STEP, kiểm được bằng
            chương trình, đổi M5 → M6 chỉ sửa một số. Vật phức tạp vô hạn (chậu cây, khuôn mặt) → generative model. Có thể trộn: hình học bằng code, texture bằng model.
          </Callout>
          <h3>Generative UI và Artifact pattern</h3>
          <ul>
            <li><b>Giao thức khai báo (A2UI):</b> Agent chỉ xuất JSON mô tả UI; client render bằng component tin cậy của mình — như gọi món trong thực đơn chứ không vào bếp. (AG-UI là giao thức sự kiện/truyền tải, không phải ngôn ngữ mô tả UI.)</li>
            <li><b>Giao kết quả bằng HTML</b> thay báo cáo Markdown: demo tương tác, trực quan hóa dữ liệu, tài liệu sống được cập nhật suốt quá trình.</li>
            <li><b>SQL artifact:</b> LLM viết query, hệ thống chạy và hiển thị — dữ liệu đi thẳng từ DB lên giao diện không qua LLM (nhanh, không chép sai). Vẫn phải: credential read-only, chỉ SELECT đã duyệt, bind tham số, giới hạn thời gian/số dòng.</li>
            <li><b>Phần mềm động cần đẩy trust boundary xuống data layer:</b> code sinh ra có thể quên kiểm quyền — row-level security, constraint, stored procedure, access context không giả mạo được mới là ranh giới cuối.</li>
          </ul>
          <h3>Agent bootstrapping</h3>
          <p>
            Agent tự viết Agent hay mắc: quản lý context tùy tiện (nhồi trajectory thành text), tool design không chuẩn, chọn model/API lỗi thời, dùng
            thư viện bỏ hoang. Cách hiệu quả nhất không phải liệt kê mọi luật trong prompt mà là <b>đưa một bản triển khai tốt làm mẫu</b>: copy rồi
            sửa có mục tiêu (system prompt mới, tool mới, giữ nguyên khung) — như sao chép gen kèm đột biến.
          </p>
        </>
      ),
    },
  ],
  pitfalls: [
    { wrong: "Agent viết code xong là báo hoàn thành.", right: "Tiêu chí hoàn thành là test pass — và Harness tự chạy lại test để kiểm, không tin lời model." },
    { wrong: "Ghi luật vào system prompt: “vui lòng tuân thủ style…”.", right: "Constraints over guidance: mã hóa thành linter, type check, CI." },
    { wrong: "Gặp lỗi thì retry nguyên trạng.", right: "Hỏi “retry có giúp không?”: lỗi tham số/quyền/tool không tồn tại phải đổi input hoặc chiến lược; mọi đường khôi phục có trần." },
    { wrong: "Logic xử lý lỗi gọi LLM (viết commit message, trích memory).", right: "Tắt side effect gọi model trên đường lỗi + đếm độ sâu đệ quy để chặn death spiral." },
    { wrong: "Blacklist từ khóa lệnh shell là đủ.", right: "Semantic parsing hiểu tác dụng thật của lệnh + sandbox không mạng + không mount credential." },
    { wrong: "Tool business rule tin các tham số model khai (hạng ghế, giờ hiện tại).", right: "Tham số chỉ là checklist; quyết định dựa trên database và đồng hồ server." },
    { wrong: "Để LLM đọc 5.000 dòng kết quả SQL rồi kể lại bằng lời.", right: "Artifact pattern: LLM viết query, hệ thống chạy và render bảng/biểu đồ." },
  ],
  demos: [
    { id: "edit", title: "Năm cách để model sửa một tệp", component: EditSchemes,
      desc: "Mỗi cách model “nói” với hệ thống sửa gì — và thử xem old_string của bạn có khớp duy nhất không." },
    { id: "errors", title: "Lỗi này có nên retry không?", component: ErrorTriage,
      desc: "Tám lỗi thật trong production Harness — đoán cách xử lý trước khi xem." },
    { id: "math", title: "Code as a thinking tool", component: MathByCode,
      desc: "Cùng một bài toán: lập luận bằng lời dễ trừ nhầm, viết code thì chính xác." },
    { id: "quadrant", title: "Bốn góc: mục tiêu rõ × kiểm chứng tự động", component: QuadrantDemo,
      desc: "Mục tiêu của Harness là đẩy càng nhiều việc càng tốt về góc “rõ + tự kiểm được”." },
  ],
  lab: {
    intro: (
      <>
        <LabSetup />
        <p>
          Bài 5.1 là trái tim của chương: một Coding Agent hoàn chỉnh trong ~200 dòng, dùng lại vòng ReAct của Chương 1 và Status Bar của
          Chương 2. Bài 5.2 không cần model.
        </p>
      </>
    ),
    steps: [
      {
        id: "coding_agent", title: "Mini Coding Agent sửa bug thật", file: "ch05/coding_agent.py", code: codingAgentPy,
        run: ["python3 ch05/coding_agent.py", "python3 ch05/coding_agent.py --mock   # xem luồng chuẩn"],
        observe: (
          <ul>
            <li>Agent có đi đúng quy trình: tìm hiểu → chạy test thấy lỗi → sửa tối thiểu → chạy lại test không? Hay sửa mù rồi báo xong?</li>
            <li>Phần “Harness kiểm chứng” ở cuối: test có thật sự pass? Agent có “đi đường tắt” sửa tệp test không?</li>
            <li>Nếu edit_file báo “old_string không khớp”, model có read_file lại rồi chép chính xác không, hay lặp y hệt (fingerprint sẽ cảnh báo)?</li>
            <li>Thử sửa bug khó hơn trong <code>PROJECT</code> (vd làm tròn sai, kiểm tra biên sai) và so model 4B với model lớn hơn.</li>
          </ul>
        ),
        result: <p className="small">Với <code>--mock</code>: 5 vòng, 5 tool call (glob, read_file, bash, edit_file, bash) — test thật sự pass, tệp test nguyên vẹn.</p>,
      },
      {
        id: "code_as_rules", title: "Business rules bằng code: naive vs guarded", file: "ch05/code_as_rules.py", code: codeRulesPy,
        run: ["python3 ch05/code_as_rules.py"],
        observe: (
          <ul>
            <li>Ở tình huống nào cách naive cho hủy sai? Vì sao cách guarded không bị lừa bởi “hôm nay là …” do người dùng nói?</li>
            <li>Mismatch log ghi lại điều gì — và dùng nó thế nào để phát hiện model đang “tin sai” hoặc bị injection?</li>
          </ul>
        ),
        result: <p className="small">Naive hủy sai ở <b>2/3</b> tình huống (model nhầm hạng ghế; prompt injection về ngày); guarded chặn đúng cả 3.</p>,
      },
    ],
  },
  apply: [
    {
      title: "Viết project instruction file (CLAUDE.md / AGENTS.md) cho repo của bạn",
      prompt: <p>Gồm: lệnh build/test chính xác, code style quan trọng, vùng cấm, cách chạy dự án, những bẫy thường gặp. Ngắn, cụ thể, ổn định.</p>,
      hint: <p>Phép thử: một người mới làm từ xa chỉ dựa vào tệp này và repo có bắt đầu làm được không? Nội dung không đổi theo task nên là static prefix rẻ nhất.</p>,
    },
    {
      title: "Biến một luật trong công việc thành code gác cổng",
      prompt: <p>Chọn một quy tắc nghiệp vụ dễ bị hiểu sai (hoàn tiền, phê duyệt, chiết khấu). Viết pseudo-code cho tool thực thi nó: tham số checklist nào, sự thật nào phải đọc từ nguồn đáng tin, trả lỗi thế nào để model gợi ý phương án hợp lệ.</p>,
      hint: <p>Mô hình 3 tầng: luật bằng lời trong prompt → tham số expected_* làm checklist → code server kiểm bằng dữ liệu thật.</p>,
    },
    {
      title: "Đánh giá Lethal Triad cho Agent của bạn",
      prompt: <p>Agent của bạn có đủ ba yếu tố (dữ liệu riêng tư, nội dung không tin cậy, giao tiếp ra ngoài) không? Có persistent memory không? Cắt bớt yếu tố nào được, và đặt phòng thủ ở tầng nào?</p>,
      hint: <p>Network egress whitelist thường là cách cắt yếu tố thứ 3 rẻ nhất. Nội dung ghi vào memory phải qua cùng mức kiểm tra như input bên ngoài.</p>,
    },
  ],
  glossary: [
    { en: "Coding Agent", vi: "Agent viết code", note: "Agent tự viết, sửa, chạy code — lõi của general-purpose Agent." },
    { en: "Project instruction file", vi: "Tệp hướng dẫn dự án", note: "CLAUDE.md, AGENTS.md, .cursorrules — inject mỗi phiên." },
    { en: "Acceptance baseline", vi: "Chuẩn nghiệm thu", note: "Thế nào là xong: test, CI, chuẩn review." },
    { en: "Constraints over guidance", vi: "Ràng buộc hơn khuyên nhủ", note: "Luật mã hóa được thì đưa vào linter/CI." },
    { en: "Reward hacking", vi: "Lách phần thưởng", note: "Đạt kết quả bằng cách phá hoại (xóa DB để hết lỗi)." },
    { en: "Idle watchdog", vi: "Bộ canh im lặng", note: "Kill stream không có output mới sau một khoảng thời gian." },
    { en: "Death spiral", vi: "Vòng xoáy chết", note: "Logic xử lý lỗi gọi LLM, lại lỗi, lan dây chuyền." },
    { en: "Neutral trajectory format", vi: "Định dạng trajectory trung lập", note: "Không phụ thuộc wire format của vendor; tách text khỏi credential." },
    { en: "Lethal Triad", vi: "Bộ ba chết người", note: "Dữ liệu riêng tư + nội dung không tin cậy + giao tiếp ra ngoài." },
    { en: "Network egress control", vi: "Kiểm soát lưu lượng ra", note: "Mặc định không mạng, whitelist đích cần thiết." },
    { en: "Principal loyalty", vi: "Trung thành với bên ủy quyền", note: "Chỉ thị của chủ ưu tiên; bên ngoài là dữ liệu." },
    { en: "Meta-capability", vi: "Năng lực tạo năng lực", note: "Code: tạo tool, ràng buộc, hình thức biểu đạt mới." },
    { en: "Generative UI / A2UI", vi: "Giao diện sinh động / giao thức UI khai báo", note: "Agent mô tả UI bằng JSON, client render bằng component tin cậy." },
    { en: "Artifact pattern", vi: "Mẫu artifact", note: "LLM sinh code (SQL), hệ thống chạy; dữ liệu không đi qua LLM." },
    { en: "Agent bootstrapping", vi: "Agent tự khởi tạo", note: "Agent dùng code tạo/sửa Agent, tốt nhất là sửa từ bản mẫu." },
  ],
  quiz: [
    { q: "Theo sách, vì sao Coding Agent là lõi của general-purpose Agent?", options: ["Vì model code mạnh nhất", "Vì gần như mọi việc tạo nội dung hiệu quả đều quy về code — rẻ, nhanh, tái sử dụng", "Vì người dùng thích code", "Vì Computer Use bị cấm"], answer: 1,
      explain: "PPT/Word là OOXML, PDF từ Markdown/HTML, phân tích bằng Python… Code là nền năng lực rẻ và tái sử dụng nhất." },
    { q: "Tiêu chí hoàn thành đúng cho Coding Agent là gì?", options: ["Code đã viết xong", "Model nói đã xong", "Test pass (được kiểm chứng)", "Không còn lỗi cú pháp"], answer: 2,
      explain: "Cách “lười” phổ biến nhất là bỏ qua test và báo xong. Verification quyết định khi nào an toàn để dừng." },
    { q: "Vì sao Coding Agent chín muồi nhất trong các loại Agent?", options: ["Model code đặc biệt mạnh", "Hạ tầng phần mềm (test, type, Git) tự nhiên là một Harness mạnh", "Ít người dùng", "Không cần tool"], answer: 1,
      explain: "Code nằm ở góc “mục tiêu rõ + kiểm chứng tự động”." },
    { q: "Model gọi một tool không tồn tại. Harness nên…", options: ["Kết thúc phiên", "Retry y hệt", "Trả lỗi có cấu trúc “no such tool” làm tool result để model tự sửa", "Bỏ qua"], answer: 2,
      explain: "Lỗi tầng tool biến thành input cho model, không làm sập phiên." },
    { q: "Stop hook gọi LLM viết commit message trong khi đang tràn context, lại tràn, lại gọi… Đây là gì và cách chặn?", options: ["Rate limit — backoff", "Death spiral — tắt side effect gọi model trên đường lỗi + đếm độ sâu đệ quy", "Silent stall — watchdog", "Tool shadowing"], answer: 1,
      explain: "Logic trên đường lỗi tự gọi LLM và fail dây chuyền." },
    { q: "Khi bàn giao trajectory cho vendor khác, phần nào KHÔNG mang sang được?", options: ["Tool call", "Text của reasoning", "Credential chứng minh reasoning do vendor gốc tạo", "User message"], answer: 2,
      explain: "Text mang sang như nội dung thường; credential vô giá trị ở vendor khác." },
    { q: "Vì sao read_file nên trả kèm số dòng?", options: ["Cho đẹp", "Để model tham chiếu chính xác vị trí, giúp edit tin cậy hơn", "Để tăng token", "Theo chuẩn MCP"], answer: 1,
      explain: "“Dòng 42 của src/main.py” giảm mơ hồ khi sửa." },
    { q: "Lệnh nào cho thấy blacklist từ khóa không đủ?", options: ["ls -la", "find / -name '*.log' -exec rm {} \\;", "git status", "cat README.md"], answer: 1,
      explain: "Lệnh xóa được giấu trong tham số hợp lệ của find — cần semantic parsing." },
    { q: "Trong ba tầng bảo vệ business rule, tầng nào là người gác cổng cuối?", options: ["Luật bằng lời trong prompt", "Tham số expected_* làm checklist", "Code server kiểm bằng dữ liệu thật (DB, đồng hồ server)", "Người dùng"], answer: 2,
      explain: "Lời khai của model có thể sai hoặc bị injection; dữ liệu độc lập thì không giả mạo được." },
    { q: "Với phần mềm do Agent sinh động, kiểm quyền nên đặt ở đâu?", options: ["Trong code do Agent sinh", "Trong system prompt", "Ở data layer (row-level security, constraint, stored procedure)", "Ở frontend"], answer: 2,
      explain: "Code sinh ra có thể quên kiểm quyền; data layer vẫn từ chối dù code sai." },
    { q: "Cách hiệu quả nhất để Agent viết ra một Agent chất lượng?", options: ["Liệt kê mọi luật trong prompt", "Viết từ đầu", "Copy một bản triển khai tốt rồi sửa có mục tiêu", "Dùng model lớn nhất"], answer: 2,
      explain: "Code mẫu tự mang best practice; như sao chép gen kèm đột biến." },
  ],
  cards: [
    { front: "7 tool cốt lõi của Coding Agent?", back: "Code interpreter · bash · read · write · edit · glob · grep." },
    { front: "File system trong OpenClaw chứa gì?", back: "MEMORY.md · daily/YYYY-MM-DD.md · SOUL.md · knowledge base · Git để rollback." },
    { front: "Project instruction file?", back: "CLAUDE.md/AGENTS.md: lệnh build/test, style, vùng cấm — inject mỗi phiên, là static prefix rẻ nhất." },
    { front: "5 bước quy trình Coding Agent?", back: "Tài liệu dự án → làm rõ yêu cầu → design doc → code + test → review + cập nhật tài liệu." },
    { front: "4 thành phần Harness của Coding Agent?", back: "Acceptance baseline · execution boundary · feedback signals · rollback." },
    { front: "4 nguyên tắc Harness rút ra từ coding?", back: "Constraints over guidance · tự động kiểm chứng · feedback nhanh và có cấu trúc · rollback tin cậy." },
    { front: "4 tầng failure?", back: "API · tool · context · control flow." },
    { front: "Thứ tự leo thang khôi phục?", back: "Silent retry (backoff + jitter) → degrade & continue → báo người dùng." },
    { front: "Vì sao cần trần cho mỗi recovery path?", back: "Claude Code: 1 phiên fail >3.000 lần liền; retry vô ích ~250.000 API call/ngày → dừng sau 3 lần." },
    { front: "5 cách edit file?", back: "Old→New string · line number · head–tail matching · diff + apply model · Vim-like." },
    { front: "Lethal Triad?", back: "Dữ liệu riêng tư + nội dung không tin cậy + giao tiếp ra ngoài; persistent memory là bộ khuếch đại." },
    { front: "Sandbox cho Coding Agent gồm?", back: "Chặn network egress (whitelist) · source read-only · không mount credential · quota + timeout có lỗi cấu trúc." },
    { front: "6 hướng của meta-capability?", back: "Thinking tool · business rule · multimedia · system adapter · Generative UI · Agent bootstrapping." },
    { front: "3 tầng bảo vệ business rule?", back: "Luật bằng lời → tham số checklist (expected_*) → code server kiểm bằng dữ liệu thật." },
    { front: "Code hay generative model cho 3D?", back: "Mô tả gọn, chính xác, cần kiểm chứng → code (B-rep/STEP). Phức tạp vô hạn → generative model." },
    { front: "Artifact pattern với SQL?", back: "LLM viết query; hệ thống chạy, render bảng/biểu đồ; dữ liệu không đi qua LLM. Vẫn cần read-only + chỉ SELECT." },
  ],
};
