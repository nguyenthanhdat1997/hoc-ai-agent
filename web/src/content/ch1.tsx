import type { Chapter } from "../lib/types";
import { Callout, Code, Formula, Table } from "../components/ui";
import { AgentEnvDiagram } from "../components/diagrams";
import { ReActStepper } from "../demos/ReActStepper";
import { Classifier } from "../demos/Classifier";
import { LabSetup } from "./labSetup";
import reactLoopPy from "../../../agent-lab/ch01/react_loop.py?raw";
import agentPy from "../../../agent-lab/miniagent/agent.py?raw";

function GuardrailDemo() {
  return (
    <Classifier
      options={["Context layer", "Execution layer", "Data layer"]}
      items={[
        { text: "Bọc nội dung trang web trong thẻ <external_content source=\"web\">", answer: "Context layer",
          why: "Can thiệp vào thứ model NHÌN THẤY. Chỉ giảm xác suất bị tiêm nhiễm, không bảo đảm." },
        { text: "Câu “Tuyệt đối không xóa dữ liệu của khách” trong system prompt", answer: "Context layer",
          why: "Vẫn là lời dặn trong context — một Agent đã bị prompt injection có thể bỏ qua nó." },
        { text: "Chuyển khoản trên 10 triệu phải được người dùng bấm xác nhận", answer: "Execution layer",
          why: "Kiểm định trước khi hành động có hiệu lực, do cơ chế NGOÀI context đảm nhiệm (HITL)." },
        { text: "Mã do Agent sinh ra chạy trong sandbox không có mạng, giới hạn CPU/RAM", answer: "Execution layer",
          why: "Giới hạn cái Agent ĐƯỢC LÀM. Sandbox không phụ thuộc vào việc model có bị lừa hay không." },
        { text: "Lọc số căn cước, số điện thoại ra khỏi câu trả lời trước khi gửi", answer: "Execution layer",
          why: "Sách xếp câu trả lời gửi người dùng cũng là một hành động, nên kiểm tra đầu ra thuộc execution layer." },
        { text: "Row-level security: tài khoản của Agent chỉ đọc được đơn hàng của chính khách đang chat", answer: "Data layer",
          why: "Dù prompt injection thành công hay mã quên kiểm tra quyền, truy vấn vượt quyền vẫn bị CSDL từ chối." },
        { text: "Stored procedure hoàn tiền chỉ cho phép số tiền ≤ giá trị đơn hàng", answer: "Data layer",
          why: "Ràng buộc nằm trong cơ chế dữ liệu đã được con người thẩm định — tầng khó vượt qua nhất." },
      ]}
    />
  );
}

function OrchestrationDemo() {
  return (
    <Classifier
      options={["1 lần gọi LLM", "Workflow", "autonomous Agent", "Kết hợp"]}
      items={[
        { text: "Dịch mô tả sản phẩm từ tiếng Việt sang tiếng Anh", answer: "1 lần gọi LLM",
          why: "Nếu prompt tốt + vài ví dụ đã giải quyết được thì đừng dựng Agent (nguyên tắc “từ đơn giản đến phức tạp”)." },
        { text: "Đặt vé: xác thực → tìm chuyến → thanh toán → giữ chỗ, không được đổi thứ tự", answer: "Workflow",
          why: "Đường đi cố định, quy tắc “không đặt chỗ trước khi thanh toán” được thực thi bằng mã, bề mặt tấn công giới hạn trong từng nút." },
        { text: "Sửa một issue GitHub chưa rõ nguyên nhân trong codebase lạ", answer: "autonomous Agent",
          why: "Bài toán mở, không đoán trước số bước — đúng chỗ của ReAct loop (như SWE-bench)." },
        { text: "Chăm sóc khách hàng: trò chuyện linh hoạt, nhưng hoàn tiền phải qua các bước bắt buộc", answer: "Kết hợp",
          why: "Phần tuân thủ nghiêm ngặt dùng workflow, phần cần linh hoạt giao cho Agent (như cách n8n trộn hai loại nút)." },
        { text: "Viết lại lời nói đời thường thành prompt kiểu Stable Diffusion rồi sinh ảnh", answer: "Workflow",
          why: "Hai nút cố định: viết lại prompt → sinh ảnh. Nút viết lại là “adaptation layer” — sẽ biến mất khi dùng model sinh ảnh gốc." },
      ]}
    />
  );
}

export const ch1: Chapter = {
  id: 1,
  title: "Bắt đầu với AI Agent",
  short: "Bắt đầu với AI Agent",
  tier: "Nền tảng",
  minutes: 25,
  ready: true,
  oneLiner: "Agent = LLM + Context + Tools. Model ngày càng giống nhau — khác biệt thật nằm ở Harness bao quanh nó.",
  keyIdeas: [
    "Agent = LLM (bộ não · Policy) + Context (đôi mắt · Observation) + Tool (tay chân · Action). Môi trường nằm NGOÀI Agent.",
    "Giữ nguyên model, đòn bẩy lớn nhất là mở rộng observation space và action space — tức là thêm context và tool. Nhiều việc tưởng cần “model thông minh hơn” thực ra là vấn đề giao diện.",
    "Context = static prefix (system prompt + tool definition) + trajectory (user, assistant, tool result). ReAct loop đẩy nhiệm vụ đi bằng cách liên tục nối thêm vào trajectory.",
    "Agent = Model + Harness; Harness = quản lý context + giao diện tool + ràng buộc + xác minh + sửa lỗi. Trong hệ thống sản xuất, phần lớn mã là ràng buộc, xác minh và sửa lỗi.",
    "Đi từ đơn giản: một lần gọi LLM → workflow → autonomous Agent. Harness quan trọng không có nghĩa là càng phức tạp càng tốt (“Less structure, more intelligence”).",
    "An toàn là vấn đề kiến trúc, chia 3 tầng guardrail: context layer → execution layer → data layer (tầng càng dưới càng khó vượt qua).",
  ],
  sections: [
    {
      id: "formula",
      title: "Công thức cốt lõi: não + mắt + tay chân",
      body: (
        <>
          <Formula>Agent = LLM + Context + Tools</Formula>
          <p>
            Ba thành phần này được hiểu ở ba tầng. Cùng một đối tượng, chỉ khác cách diễn đạt:
          </p>
          <Table
            head={["Trực quan", "Thành phần triển khai", "Khái niệm học thuật (RL)", "Ý nghĩa"]}
            rows={[
              ["🧠 Bộ não", "LLM", "Policy (chính sách)", "Nhìn thông tin hiện có, quyết định “làm gì tiếp theo”"],
              ["👀 Đôi mắt", "Xây dựng context", "Quan sát + lịch sử", "Tổ chức quan sát và lịch sử thành thông tin cần cho quyết định hiện tại"],
              ["🖐️ Tay chân", "Giao diện tool", "Giao diện quan sát/hành động", "Agent đọc được gì, gửi được hành động nào, định dạng ra sao"],
            ]}
          />
          <AgentEnvDiagram />
          <p>
            Hình trên có hai tầng. <b>Bên ngoài</b> là vòng tương tác Agent ↔ Môi trường (tệp, CSDL, web, người dùng, thế giới
            thật). <b>Bên trong</b> Agent là cặp Model–Harness: Model chỉ đưa ra quyết định; Harness dựng context, cung cấp tool,
            duy trì loop và áp dụng quyền hạn, xác minh, sửa lỗi. Harness có thể tạo hoặc cô lập môi trường (ví dụ sandbox),
            nhưng không chứa trạng thái của môi trường.
          </p>
          <Callout title="Lưu ý về phép ẩn dụ “đôi mắt”">
            Context không chỉ là thông tin môi trường và lịch sử hội thoại — nó còn chứa cả tool definition. Tức là thứ Agent
            “nhìn thấy” bao gồm cả “tay chân mình đang có gì”. Context = <b>mọi thông tin model nhận thức được</b> tại thời điểm quyết định.
          </Callout>
        </>
      ),
    },
    {
      id: "spaces",
      title: "Observation space & action space: giao diện giữa model và thế giới",
      body: (
        <>
          <p>
            Thông tin không đi vào observation space thì <b>gần như không tồn tại</b> với model. Một thao tác không nằm trong
            action space thì model chỉ có thể <i>nói</i> nên làm gì, dù biết chính xác cần làm gì.
          </p>
          <Callout kind="ok" title="Đòn bẩy chính khi giữ nguyên model">
            Định nghĩa lại hoặc mở rộng observation space và action space — tức mở rộng <b>context</b> và <b>tool</b> — thường
            biến một nhiệm vụ “không thể giải” thành “giải được”.
          </Callout>
          <ul>
            <li>
              <b>Manus</b> hợp nhất ba hướng vốn tách rời: Deep Research, Coding và Computer Use. Trình duyệt ảo mở rộng quan sát; hệ
              thống tệp, thực thi mã, dòng lệnh mở rộng hành động. Nó trở thành Agent đa dụng không phải nhờ thay model mạnh hơn.
            </li>
            <li>
              <b>OpenClaw</b> đẩy xa hơn: nhận việc qua WhatsApp, Telegram, Slack…; gateway cục bộ nối Google Drive, Notion và tệp trên
              máy — với sự cho phép rõ ràng của người dùng. Về sau Manus cũng thêm connector và truy cập tệp cục bộ.
            </li>
          </ul>
          <p>
            Bài học: <b>sự tiến hóa của sản phẩm Agent thường chính là sự mở rộng observation space và action space</b> — và việc mở
            rộng phải đi kèm quyền truy cập cùng cơ chế xác minh.
          </p>
          <Table
            head={["Sản phẩm", "Mắt (nhận thức)", "Tay chân (hành động)", "Chiến lược"]}
            rows={[
              ["Cursor / Coding Agent", "Yêu cầu, codebase, terminal", "Tìm mã, đọc/ghi tệp, chạy lệnh", "Hiểu → tìm → sửa → kiểm thử → gỡ lỗi"],
              ["Deep Research", "Internet, CSDL học thuật, tệp", "Tìm kiếm, đọc trang, viết tóm tắt", "Đào sâu dần, đổi hướng tìm theo cái đã biết"],
              ["Browser Use / Computer Use", "Màn hình, trang web, tệp", "Click, gõ, cuộn, chụp màn hình", "Nhìn → xác định phần tử → thao tác → xác minh"],
              ["Agent điện thoại", "Màn hình, ứng dụng cài sẵn", "Chạm, vuốt, nhập, mở app", "Hiểu ý → tìm app → thao tác → xác nhận"],
              ["Pine AI (dịch vụ)", "Hồ sơ, hóa đơn, tri thức nhà cung cấp", "Gọi điện, email, điền form", "Thu thập → chiến lược → liên hệ → đàm phán → báo cáo"],
            ]}
          />
          <p className="muted small">
            Điểm chung: action space <b>mở</b> (sinh ngôn ngữ và mã tùy ý), có <b>suy nghĩ nội tâm</b> trước khi làm, và
            <b> tương tác liên tục</b> để điều chỉnh theo phản hồi.
          </p>
        </>
      ),
    },
    {
      id: "tools",
      title: "Tool: tay chân của Agent",
      body: (
        <>
          <p>Tool được chia thành 5 loại theo hướng Agent tương tác với thế giới:</p>
          <Table
            head={["Loại", "Vai trò", "Ví dụ"]}
            rows={[
              ["Nhận thức", "Lấy thông tin", "Tìm kiếm web, đọc tệp, gọi API/CSDL"],
              ["Thực thi", "Thay đổi thế giới", "Chạy mã, sửa tệp, lệnh hệ thống, gọi API bên ngoài"],
              ["Cộng tác", "Làm việc với Agent/người khác", "Giao việc cho sub-agent, xin con người xác nhận"],
              ["Kích hoạt sự kiện", "Thế giới gọi Agent dậy (Agent không chủ động gọi)", "Email mới, hẹn giờ, webhook"],
              ["Giao tiếp người dùng", "Agent chủ động liên lạc", "Tin nhắn, cuộc gọi, email báo tiến độ"],
            ]}
          />
          <h3>Gọi tool diễn ra trong 4 bước</h3>
          <ol>
            <li>Khai báo trong context: có những tool nào (tên, công dụng, tham số).</li>
            <li>Model <b>tự quyết định</b>: có gọi không, gọi cái nào, truyền tham số gì.</li>
            <li>Harness thực thi rồi <b>nối kết quả</b> vào context.</li>
            <li>Model quyết định bước tiếp theo dựa trên kết quả.</li>
          </ol>
          <Code lang="json">{`
// Bước 1: khai báo            // Bước 2: model quyết định
tools: [{ name: "get_weather",   assistant: { tool_calls: [{
  parameters: { city: string }}]   function: "get_weather", arguments: {city: "Hà Nội"} }]}

// Bước 3: nối kết quả          // Bước 4: model trả lời
tool: { tool_call_id: "call_1",  assistant: { content: "Hôm nay Hà Nội 28°C, trời quang." }
  content: '{"temp":28,"sky":"quang"}' }`}</Code>
          <Callout title="Nguyên tắc thiết kế: đa dụng để khám phá, chuyên dụng để kiểm soát">
            Bắt đầu từ năng lực hẹp nhất nhiệm vụ cần, mở rộng dần. Trình thông dịch Python (có sandbox, không mạng, giới hạn
            CPU/RAM/thời gian) linh hoạt hơn hàng chục tool nhỏ. Nhưng thao tác <b>rủi ro cao</b> — thanh toán, xóa dữ liệu, gửi
            email, deploy production — phải là tool chuyên dụng với tham số rõ ràng, quyền tối thiểu, có kiểm toán và khi cần
            thì có bước xem trước + xác nhận của con người.
          </Callout>
        </>
      ),
    },
    {
      id: "llm",
      title: "LLM: bộ não — và ba con đường để Agent học",
      body: (
        <>
          <p>
            LLM phân tích ý định thật (người dùng nói chưa chắc là điều họ muốn), chia việc mơ hồ thành các bước, rồi liên tục phán
            đoán: làm gì tiếp, gọi tool nào, với tham số gì. Năng lực đặc biệt là <b>suy nghĩ nội tâm</b> — lập kế hoạch trước khi
            hành động mà không làm thay đổi môi trường. Khác với Agent RL truyền thống thăm dò ngẫu nhiên, Agent dựa trên LLM suy luận
            trên tri thức có cấu trúc học được từ pre-training.
          </p>
          <h3>“Model là Agent” — nhưng Harness càng quan trọng hơn</h3>
          <p>
            Model mới nội hóa việc gọi tool qua Reinforcement Learning: <i>khi nào gọi, gọi gì, tham số gì</i> do model tự quyết.
            Cần phân biệt rõ: RL dạy model <b>chiến lược quyết định</b>, còn bản thân tool và việc thực thi (web_search,
            sandbox chạy mã) vẫn nằm ở hạ tầng ngoài model. Loop orchestration không biến mất — nó chỉ chuyển từ client sang
            server. Model càng tự chủ thì khi sai, hậu quả càng lớn → càng cần ràng buộc, xác minh, sửa lỗi.
          </p>
          <Callout title="Lập trường về “Bài học cay đắng” (Rich Sutton)">
            Đồng thuận về <b>hướng đi</b>: model sẽ dần “nuốt” Harness (gọi tool, lập kế hoạch dài hạn từng cần orchestration bên
            ngoài, nay đã là năng lực gốc). Nhưng thực dụng về <b>nhịp độ</b>: việc nuốt chậm hơn trực giác nhiều. Ranh giới năng lực
            của model lúc này chính là giá trị của Harness lúc này — model nội hóa thêm một lớp thì Harness tháo một lớp và chuyển
            sang đỡ biên giới mới.
          </Callout>
          <h3>Ba con đường thay đổi hành vi Agent</h3>
          <Table
            head={["", "In-context adaptation", "Cập nhật sản phẩm bên ngoài", "Cập nhật tham số (post-training)"]}
            rows={[
              ["Ở đâu", "Context của nhiệm vụ hiện tại", "Tài liệu tri thức, Prompt, Skill, mã, Harness", "Trọng số model (SFT, RL)"],
              ["Tốc độ", "Tức thì (mili giây)", "Nhanh, kiểm soát được", "Chậm (tuần)"],
              ["Tồn tại", "Mất khi hết session", "Bền, kiểm toán và hoàn tác được", "Bền, khái quát rộng"],
              ["Ví dụ", "Học định dạng mới từ 3 ví dụ", "Đóng quy trình thành một tool mã", "Học “khi nào nên gọi tool”"],
              ["Chương", "2", "3 – 5, 9", "8"],
            ]}
          />
        </>
      ),
    },
    {
      id: "context",
      title: "Context: đôi mắt — và ablation study",
      body: (
        <>
          <p>Mỗi lần gọi LLM, context gồm 5 phần:</p>
          <Table
            head={["Thành phần", "Là gì", "Tĩnh / động"]}
            rows={[
              ["System prompt", "“Mô tả công việc”: danh tính, quyền hạn, quy tắc; có thể kèm user memory", "Tĩnh"],
              ["Tool definitions", "Tên, mô tả, tham số các tool", "Tĩnh"],
              ["User messages", "Đầu vào người dùng (có thể kèm tài liệu truy xuất qua RAG)", "Động"],
              ["Assistant messages", "Phản hồi trước của model: reasoning, content, tool_calls", "Động"],
              ["Tool results", "Kết quả Harness thực thi tool", "Động"],
            ]}
          />
          <Formula>Context = static prefix (system + tools) + trajectory (user + assistant + tool)</Formula>
          <h3>Thí nghiệm 1-1: bỏ từng thành phần để xem vai trò</h3>
          <Table
            head={["Bỏ đi", "Hệ quả quan sát được"]}
            rows={[
              ["Tool definition", <>✗ Không gọi được tool — nhưng <b>không im lặng</b>: trả lời trơn tru, chắc nịch bằng số liệu “nhớ” từ huấn luyện, trông y như câu trả lời thật.</>],
              ["Tool result", "✗ Loop mù: thử lại liên tục đến khi cạn ngân sách loop."],
              ["Lịch sử", "△ Lặp lại thao tác đã làm, mắc lại lỗi cũ."],
              ["Quá trình suy nghĩ", "△ Quyết định kém mạch lạc — nhưng nếu suy nghĩ dựng lại được từ tool result thì bỏ đi gần như không tốn gì."],
            ]}
          />
          <Callout kind="warn" title="Bài học quan trọng nhất cho thực hành">
            “Đã đưa ra câu trả lời” ≠ “đã hoàn thành nhiệm vụ”. Khi thiếu một thành phần context, kiểu thất bại điển hình không phải
            là báo lỗi, mà là <b>một câu trả lời trông không có chỗ nào sơ hở</b>. Và các thành phần không quan trọng như nhau — thước
            đo là thông tin đó có dựng lại được từ chỗ khác không. Hãy đo, đừng đoán.
          </Callout>
        </>
      ),
    },
    {
      id: "react",
      title: "ReAct loop: nghĩ → làm → nhìn",
      body: (
        <>
          <p>
            ReAct (Reasoning + Acting) gồm 3 khâu lặp lại cho tới khi xong: model <b>suy nghĩ</b> nên làm gì → <b>gọi tool</b>
            → <b>quan sát</b> kết quả → suy nghĩ tiếp. Trajectory là lịch sử tin nhắn tích lũy; mỗi lần gọi, model thấy toàn bộ nó.
          </p>
          <Code lang="python">{`
trajectory = [user_request]
repeat:
    context  = stable_prefix + trajectory      # Harness ráp context
    decision = Model(context)                  # Model chỉ quyết định bước kế tiếp
    trajectory.append(decision)
    if decision has no tool call:
        return decision.answer                 # không gọi tool → xong
    for call in decision.tool_calls:           # các lệnh độc lập có thể chạy song song
        validated = Harness.validate(call)
        observation = Environment.execute(validated)
        trajectory.append(observation)`}</Code>
          <p>
            Ví dụ trong sách (tổng doanh thu 4 quý ở 4 loại tiền): vòng 1 gọi song song 3 lệnh quy đổi → vòng 2 gọi trình thông dịch
            mã để tính tổng → vòng 3 trả lời. <b>3 vòng, 4 lần gọi tool.</b> Bạn có thể bấm từng bước ở tab <i>Minh họa</i>.
          </p>
          <p className="muted small">
            Các model “Agent gốc” (Kimi K3, GPT-5.6 trong sách) nội hóa quyết định gọi tool; Kimi K3 giữ mạch suy nghĩ ổn định
            qua 200–300 lệnh gọi liên tiếp. Với Responses API, vòng tìm kiếm–đọc–phân tích chạy khép kín ở máy chủ; GPT-5.6 còn hỏi
            lại để làm rõ ý định trước khi nghiên cứu.
          </p>
        </>
      ),
    },
    {
      id: "harness",
      title: "Harness Engineering: năng lực vượt xa model",
      body: (
        <>
          <Formula>
            Agent = Model + Harness
            <br />
            Harness = quản lý context + giao diện tool + ràng buộc + xác minh + sửa lỗi
          </Formula>
          <p>
            Demo chạy được và sản phẩm đáng tin cậy cách nhau rất xa: model có thể ảo giác (bịa tool/tham số), chọn sai tool,
            hoặc không tự phục hồi khi lỗi. Context + tool giúp Agent <b>“làm được việc”</b>; ràng buộc + xác minh + sửa lỗi giúp
            Agent <b>“không làm sai”</b>.
          </p>
          <Table
            head={["Yếu tố", "Nguyên tắc cốt lõi", "Ví dụ", "Chương"]}
            rows={[
              ["Context", "Đủ thông tin tại mỗi điểm quyết định", "System prompt, knowledge base, Status Bar", "2, 3"],
              ["Tool", "Giao diện rõ: tên trực quan, ví dụ tham số, mô tả ranh giới", "MCP, code interpreter, tìm kiếm", "4"],
              ["Ràng buộc", "Mặc định là không an toàn: mọi thứ tắt, phải bật rõ ràng", "Claude Code xin phép trước khi chạy tool", "4"],
              ["Xác minh", "Chỉ kiểm tra dữ liệu có cấu trúc, không tin văn bản model tự viết", "Linter, hệ thống kiểu, kiểm tra kết quả gọi tool", "5, 6"],
              ["Sửa lỗi", "Chưa chắc không khôi phục được thì đừng lộ trạng thái dở dang", "Thử lại âm thầm, circuit breaker, trao lại cho người", "2, 5"],
            ]}
          />
          <p>
            Ví dụ Claude Code: bản thân tool (đọc/ghi tệp, chạy lệnh, tìm kiếm) chỉ là phần nhỏ; phần lớn mã Harness là cơ chế bảo
            vệ: quản lý trạng thái quy trình, context compression nhiều lớp, phân cấp quyền, <b>circuit breaker</b> (ngắt khi lỗi liên tục,
            như cầu chì), khôi phục lỗi (bắt ngoại lệ, quay về trạng thái ổn định, thử lại hoặc trao cho người).
          </p>
          <h3>Các làn sóng kỹ thuật — lớp sau bao lớp trước</h3>
          <p>
            <b>Prompt Engineering</b> ⊂ <b>Context Engineering</b> ⊂ <b>Harness Engineering</b> ⊂ <b>Loop Engineering</b> (vận hành tự
            chủ liên tục qua nhiều lượt). Từ 7/2026 ngành còn dùng <b>Graph Engineering</b> cho góc nhìn orchestration cao hơn: tổ chức
            loop Agent, chương trình tất định và bước duyệt của người thành đồ thị thực thi tường minh.
          </p>
          <Callout kind="ok" title="Bằng chứng: chỉ đổi Harness, không đổi model">
            Coding Agent của LangChain trên Terminal Bench 2.0 tăng từ <b>52,8% lên 66,5%</b> (từ hạng 30 lên top 5) nhờ để Agent tự
            kiểm tra kết quả, phát hiện khi bị kẹt trong loop và tối ưu chiến lược suy nghĩ.
          </Callout>
          <h3>3 nguyên tắc xây Agent hiệu quả (theo Anthropic)</h3>
          <ol>
            <li><b>Giữ đơn giản</b> — gọi API trực tiếp tốt hơn framework phức tạp; mỗi lớp trừu tượng là một điểm mù khi gỡ lỗi.</li>
            <li><b>Minh bạch</b> — hiện rõ kế hoạch, nhật ký, quyết định. Lỗi trong hộp đen thì không ai sửa được.</li>
            <li>
              <b>Thiết kế ACI</b> (Agent-Computer Interface) — giao diện tool nhìn từ phía Agent. Áp dụng <i>poka-yoke</i> (chống lỗi
              bằng thiết kế, như góc vát thẻ SIM chỉ cắm được một chiều): giao diện mơ hồ sẽ bị model khuếch đại thành lỗi hệ thống.
            </li>
          </ol>
          <h3>Chọn model</h3>
          <ul>
            <li>Đánh giá trên <b>chính nhiệm vụ của bạn</b>, đừng chỉ nhìn bảng xếp hạng (Chương 7). Khoảng cách nguồn mở – nguồn đóng hiện chưa tới 6 tháng; nguồn mở rẻ, tự triển khai, tinh chỉnh được.</li>
            <li>Agent cần model <b>có khả năng suy nghĩ</b> (trừ tác vụ một bước rất đơn giản).</li>
            <li>Để ý <b>tốc độ token đầu ra</b>: 20 vòng × 2 giây = thêm 40 giây chờ. Và năng lực đa phương thức nếu cần.</li>
            <li>Kiểm tra <b>ranh giới chính sách</b>: model làm được chưa chắc sản phẩm/API cho phép. Chuẩn bị phương án dự phòng.</li>
          </ul>
        </>
      ),
    },
    {
      id: "orchestration",
      title: "Workflow hay autonomous Agent?",
      body: (
        <>
          <p>
            Thứ tự thực dụng: <b>tối ưu prompt trước → cân nhắc workflow → cuối cùng mới đưa autonomous Agent vào</b>. Agent đổi độ trễ
            và chi phí lấy hiệu quả — hãy chắc rằng đáng đổi.
          </p>
          <Table
            head={["", "Workflow (orchestration tất định)", "autonomous Agent"]}
            rows={[
              ["Đường đi", "Viết cứng bằng mã; LLM chỉ hiểu/sinh trong từng nút", "Model tự quyết theo phản hồi môi trường"],
              ["Mạnh ở", "Tuân thủ quy trình, bảo mật (tấn công chỉ ảnh hưởng 1 nút)", "Bài toán mở, không đoán trước số bước"],
              ["Yếu ở", "Cứng nhắc khi gặp tình huống ngoài kịch bản", "Chi phí cao hơn, lỗi phức tạp hơn"],
              ["Ví dụ", "Đặt vé 4 bước cố định; viết lại prompt → sinh ảnh", "Sửa issue GitHub, Computer Use, nghiên cứu sâu"],
            ]}
          />
          <p>
            <b>Điều kiện dừng là bắt buộc</b> với autonomous Agent: hoàn thành nhiệm vụ, gọi tool trả lời cuối, không gọi tool nào,
            vượt giới hạn lỗi, hoặc đạt số vòng tối đa. Có thể <b>kết hợp</b>: phần tuân thủ dùng workflow, phần linh hoạt dùng Agent
            (n8n trộn cả hai loại nút); hoặc để Agent <i>viết ra</i> workflow rồi workflow thực thi.
          </p>
          <Callout kind="bad" title="Phản ví dụ: pipeline đa Agent dựng sẵn quá phức tạp">
            Được giao “trích ký ức cá nhân từ một triệu tin nhắn”, model dễ vẽ ra pipeline: chunking → Agent trích xuất → kiểm chứng
            → phân giải danh tính → sắp xếp → rà soát → đồ thị dữ kiện… Từng phần có vẻ hợp lý, ghép lại thành hệ thống kém hiệu quả.
            Mỗi ngoại lệ mới lại thêm một node; những phán đoán model tự làm được bị viết cứng. Chỉ viết cứng những <b>ranh giới
            luôn phải giữ</b> (quyền hạn, không ghi đè bản gốc, xuất bản nguyên tử).
          </Callout>
          <Callout title="Adaptation layer sẽ bị model “ăn” dần">
            Nút “viết lại prompt cho Stable Diffusion” tồn tại vì model sinh ảnh không hiểu lời người. Với model sinh ảnh gốc
            (GPT-Image 2, Nano Banana 2), nút đó thừa. Tương tự: few-shot, “hãy nghĩ từng bước”, sửa JSON hỏng… đều đã bị nội hóa. Các
            framework thay đổi nhanh — hãy chọn framework có lớp trừu tượng <b>đủ mỏng</b>.
          </Callout>
        </>
      ),
    },
    {
      id: "guardrails",
      title: "Guardrails: an toàn theo 3 tầng",
      body: (
        <>
          <p>
            Guardrails là cách hiện thực “ràng buộc – xác minh – sửa lỗi”. Một lớp đơn lẻ không đủ; kết hợp nhiều lớp mới bền. Và
            đánh giá guardrail phải kiểm tra cả hai chiều: chặn được yêu cầu xấu <b>và</b> không từ chối nhầm việc hợp lệ.
          </p>
          <Table
            head={["Tầng", "Quản cái gì", "Cơ chế", "Độ chắc chắn"]}
            rows={[
              ["Context", "Model được NHÌN gì", "Phân loại độ liên quan, phát hiện jailbreak/prompt injection, kiểm duyệt nội dung, quy tắc (regex, danh sách đen), gắn nhãn nguồn", "Chỉ giảm xác suất — Agent khó tự biết mình đã bị tiêm nhiễm"],
              ["Thực thi", "Model được LÀM gì", "Xếp hạng rủi ro tool (thấp/trung/cao), duyệt độc lập, quyền tối thiểu, sandbox, người trong loop, lọc PII đầu ra", "Mạnh — nếu cơ chế duyệt nằm NGOÀI context"],
              ["Dữ liệu", "Thế giới có thể bị đổi thành gì", "Row-level security, ràng buộc CSDL, view có kiểm soát, stored procedure, context truy cập không giả mạo được", "Mạnh nhất — không phụ thuộc hai tầng trên"],
            ]}
          />
          <p>
            <b>Jailbreak</b> là chính người dùng tìm cách vượt giới hạn; <b>prompt injection</b> là kẻ tấn công thao túng gián tiếp qua
            dữ liệu bên ngoài (trang web, tài liệu). Ví dụ công nghiệp: <i>Constitutional Classifiers</i> của Anthropic — sinh dữ liệu
            huấn luyện từ quy tắc ngôn ngữ tự nhiên, xét câu hỏi và câu trả lời cùng nhau, sàng lọc hai tầng (probe siêu nhẹ → classifier mạnh).
          </p>
          <h3>Human in the loop (HITL)</h3>
          <p>
            Agent phải biết <b>trao quyền điều khiển một cách nhẹ nhàng</b>. Hai tình huống kích hoạt: vượt ngưỡng thất bại (quá số lần
            thử lại) và thao tác rủi ro cao/không thể đảo ngược (hoàn tiền, thanh toán lớn) — ít nhất cho tới khi đủ tin tưởng.
          </p>
        </>
      ),
    },
    {
      id: "patterns",
      title: "5 mẫu thiết kế dùng xuyên suốt cuốn sách",
      body: (
        <>
          <Table
            head={["Mẫu", "Ý tưởng", "Xuất hiện ở"]}
            rows={[
              ["Proposer–Reviewer", "Tạo ra và phán xét do hai vai KHÔNG chung context; bên phán xét nhìn sản phẩm (kết quả, test, tham số), không nhìn suy luận. Tự thẩm định không đáng tin.", "Ch.3, 4 (Sidecar), 5, 7, 9, 10"],
              ["Progressive Disclosure", "Đưa mục lục trước, nạp chi tiết khi cần → tiết kiệm context và chọn chính xác hơn.", "Skills (Ch.2), truy hồi phân tầng (Ch.3), khám phá tool (Ch.4)"],
              ["Append-only", "Trạng thái tiến bằng cách nối thêm; đổi lại được cache, phát lại, kiểm toán.", "KV Cache (Ch.2), bộ nhớ sự kiện (Ch.3)"],
              ["Boundary Set + Retention Set", "Mọi thay đổi phải kiểm trên nhóm “phải đổi” VÀ nhóm “không được ảnh hưởng”.", "Hồi quy (Ch.7), tách train/eval (Ch.8), Ch.9"],
              ["Minimal Diff + Reversible", "Sửa nhỏ nhất có thể, kèm nguồn gốc, hoàn tác riêng lẻ → truy được lỗi do lần sửa nào.", "Ch.3, 5, 9"],
            ]}
          />
        </>
      ),
    },
  ],
  pitfalls: [
    { wrong: "Agent làm sai → nghĩ ngay phải đổi sang model mạnh hơn.", right: "Kiểm tra trước: Agent đã NHÌN THẤY dữ liệu cần thiết chưa? Có CÔNG CỤ để làm việc đó chưa? Phần lớn là vấn đề giao diện." },
    { wrong: "Thấy câu trả lời trơn tru, tự tin → tin là đúng.", right: "Thiếu tool/kết quả, model vẫn trả lời rất chắc nịch bằng số bịa. Phải xác minh bằng dữ liệu có cấu trúc." },
    { wrong: "Loop while True không giới hạn.", right: "Luôn có max_iterations, giới hạn lỗi và circuit breaker; dừng hẳn khi lỗi liên tục." },
    { wrong: "Dựng ngay pipeline đa Agent nhiều node cho bài toán mới.", right: "Bắt đầu từ 1 lần gọi LLM → workflow → Agent. Chỉ viết cứng ranh giới phải luôn giữ." },
    { wrong: "Bảo mật bằng câu “đừng bao giờ làm X” trong prompt.", right: "Đó chỉ là context layer. Thao tác rủi ro cao cần execution layer (duyệt ngoài context) và data layer." },
    { wrong: "Để chính Agent đó tự kiểm tra kết quả của mình.", right: "Proposer–Reviewer: người thẩm định không chung context, nhìn vào sản phẩm chứ không nhìn lập luận." },
  ],
  demos: [
    { id: "react", title: "Bấm từng bước ReAct loop + ablation study", component: ReActStepper,
      desc: "Chọn một biến thể rồi bấm “Bước tiếp” để xem context lớn dần và Agent hỏng ra sao khi thiếu từng thành phần (Thí nghiệm 1-1)." },
    { id: "orchestration", title: "Chọn orchestration pattern", component: OrchestrationDemo,
      desc: "Với mỗi tình huống, bạn sẽ chọn một lần gọi LLM, workflow, autonomous Agent hay kết hợp?" },
    { id: "guardrails", title: "Xếp guardrail vào đúng tầng", component: GuardrailDemo,
      desc: "Mỗi biện pháp thuộc context layer, thực thi hay dữ liệu? Tầng càng dưới càng khó bị vượt qua." },
  ],
  lab: {
    intro: (
      <>
        <LabSetup />
        <h2>Agent đầu tiên của bạn</h2>
        <p>
          Toàn bộ Agent nằm trong một vòng <code>for</code> ở <code>miniagent/agent.py</code> — đọc nó trước, chỉ khoảng 40 dòng:
        </p>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Xem <code>miniagent/agent.py</code></summary>
          <Code lang="python">{agentPy}</Code>
        </details>
      </>
    ),
    steps: [
      {
        id: "react_loop",
        title: "ReAct loop và ablation study",
        file: "ch01/react_loop.py",
        code: reactLoopPy,
        run: [
          "python3 ch01/react_loop.py                   # baseline",
          "python3 ch01/react_loop.py --ablate tools    # bỏ tool definition",
          "python3 ch01/react_loop.py --ablate results  # bỏ tool result",
          "python3 ch01/react_loop.py --ablate history  # bỏ lịch sử",
          "# chưa có model? thêm --mock vào cuối mỗi lệnh",
        ],
        observe: (
          <ul>
            <li><b>Baseline:</b> có đúng 3 vòng / 4 lần gọi tool như sách? Đáp án có khớp 9.602.895,73 USD?</li>
            <li><b>--ablate tools:</b> model có từ chối không, hay bịa số liệu một cách tự tin? Sai lệch bao nhiêu?</li>
            <li><b>--ablate results / history:</b> có rơi vào loop lặp lại cho tới max_iterations không? Bao nhiêu lần gọi tool bị lãng phí?</li>
            <li>Đổi sang model nhỏ hơn/lớn hơn: kết luận có thay đổi không? (Sách nhấn mạnh: kết quả cắt bỏ phải <i>đo</i>, và có thể khác giữa các model.)</li>
          </ul>
        ),
        result: (
          <>
            <Table
              head={["Biến thể", "Qwen3-4B-Instruct-2507 trả lời", "Đánh giá"]}
              rows={[
                ["Đầy đủ context", "Tổng 96.600.000 USD", <>✗ Gọi <code>calculator</code> CÙNG LÚC với các lệnh quy đổi → cộng 380 triệu JPY như USD</>],
                ["Bỏ tool definition", "Tổng 9.542.000 USD", "✗ Tự tin bịa tỷ giá từ trí nhớ, lệch ~60.000 USD"],
                ["Bỏ tool result", "Tổng 10.710.000 USD", "✗ Không thấy kết quả nên tự bịa tỷ giá"],
                ["Bỏ lịch sử", "(không có)", "✗ Lặp lại thao tác 6 vòng, 30 lần gọi tool"],
              ]}
            />
            <Callout kind="warn" title="Bài học từ lần chạy thật">
              Ngay cả với đủ context, model nhỏ vẫn mắc lỗi <b>phụ thuộc giữa các tool</b>: sách nói rõ (mục 2.2.3) tool nào cần
              kết quả của tool khác thì phải gọi ở vòng sau. Đây là việc của Harness: thử thêm vào <code>SYSTEM_PROMPT</code> câu
              “Chỉ gọi calculator SAU KHI đã nhận đủ kết quả quy đổi” rồi chạy lại — không cần đổi model.
            </Callout>
          </>
        ),
      },
    ],
  },
  apply: [
    {
      title: "Mổ xẻ một sản phẩm AI bạn dùng hằng ngày",
      prompt: <p>Chọn một sản phẩm (ChatGPT, Cursor, trợ lý ngân hàng…). Mô tả nó theo 3 chiều: <b>mắt</b> (nó nhìn thấy gì), <b>tay chân</b> (nó làm được gì), <b>chiến lược</b> (nó đi qua các bước nào). Nếu bạn thiết kế, sẽ mở rộng observation space/hành động ở đâu?</p>,
      hint: <p>Dùng bảng “Sản phẩm – Mắt – Tay chân – Chiến lược” trong mục 2 làm khuôn. Hỏi: có việc nào nó “biết nên làm” nhưng không làm được vì thiếu tool?</p>,
    },
    {
      title: "Workflow hay Agent cho công việc của bạn?",
      prompt: <p>Lấy một quy trình thật trong công việc của bạn mà bạn muốn tự động hóa. Phần nào phải tuân thủ cứng (→ workflow)? Phần nào cần linh hoạt (→ Agent)? Điều kiện dừng là gì?</p>,
      hint: <p>Viết ra: các bước bắt buộc theo thứ tự; các tình huống ngoại lệ thường gặp; khi nào phải trao cho con người (HITL).</p>,
    },
    {
      title: "Xếp hạng rủi ro tool",
      prompt: <p>Liệt kê 5–8 tool mà Agent của bạn sẽ cần. Gán mỗi tool mức rủi ro thấp / trung bình / cao theo: có đảo ngược được không, quyền hạn, ảnh hưởng tài chính. Tool nào cần người xác nhận? Tool nào nên có ràng buộc ở data layer?</p>,
      hint: <p>Câu hỏi tư duy ★★★ của sách: một tool thường rủi ro thấp (delete_file với tệp tạm) nhưng thành rủi ro cao với tham số đặc biệt (tệp hệ thống). Bạn sẽ đánh giá rủi ro <i>động</i> theo tham số thế nào?</p>,
    },
  ],
  glossary: [
    { en: "Agent", vi: "Agent", note: "Hệ thống AI tự lập kế hoạch, gọi công cụ và lặp theo kết quả quan sát." },
    { en: "Harness", vi: "Harness (không dịch)", note: "Lớp hạ tầng trong ranh giới Agent nhưng ngoài mô hình: ngữ cảnh, công cụ, ràng buộc, xác minh, sửa lỗi." },
    { en: "Policy", vi: "Chính sách", note: "Trong RL: ánh xạ từ quan sát sang hành động — vai trò của LLM." },
    { en: "Observation / Action Space", vi: "Không gian quan sát / hành động", note: "Những gì Agent nhìn được / làm được." },
    { en: "Trajectory", vi: "Quỹ đạo", note: "Chuỗi user message, phản hồi mô hình, tool call, tool result tích lũy trong lúc chạy." },
    { en: "ReAct", vi: "ReAct", note: "Reasoning + Acting: nghĩ → làm → nhìn, lặp lại." },
    { en: "Tool calling", vi: "Gọi công cụ", note: "Mô hình xuất lệnh gọi có cấu trúc; Harness thực thi." },
    { en: "Ablation study", vi: "Thí nghiệm cắt bỏ", note: "Bỏ từng thành phần để đo đóng góp của nó." },
    { en: "ACI", vi: "Giao diện Agent–Máy tính", note: "Thiết kế giao diện công cụ nhìn từ phía Agent." },
    { en: "Poka-yoke", vi: "Chống lỗi bằng thiết kế", note: "Làm cho việc dùng sai trở nên không thể." },
    { en: "Guardrails", vi: "Rào chắn an toàn", note: "Các lớp kiểm soát, ràng buộc, xác minh, chặn rủi ro." },
    { en: "HITL", vi: "Con người trong vòng lặp", note: "Người xác nhận/phê duyệt ở điểm quan trọng." },
    { en: "Circuit breaker", vi: "Cầu dao ngắt mạch", note: "Tự dừng thử lại khi lỗi liên tục." },
    { en: "Jailbreak / Prompt injection", vi: "Bẻ khóa / Tiêm chỉ thị", note: "Người dùng tự vượt giới hạn / kẻ tấn công cài chỉ thị qua dữ liệu bên ngoài." },
  ],
  quiz: [
    { q: "Trong công thức Agent = LLM + Context + Tools, thành phần nào tương ứng với “Policy” trong Reinforcement Learning?",
      options: ["Context", "LLM", "Tools", "Môi trường"], answer: 1,
      explain: "LLM là bộ não ra quyết định — tương ứng Policy. Context ~ quan sát + lịch sử, Tools ~ giao diện hành động. Môi trường nằm ngoài Agent." },
    { q: "Giữ nguyên model, theo sách, đòn bẩy chính để Agent giải được nhiều việc hơn là gì?",
      options: ["Viết prompt dài hơn", "Tăng temperature", "Mở rộng observation space và action space (context + tool)", "Thêm nhiều Agent"], answer: 2,
      explain: "Manus và OpenClaw trở nên đa dụng nhờ mở rộng ranh giới giao diện, không phải nhờ model mạnh hơn." },
    { q: "Ablation study: khi bỏ ĐỊNH NGHĨA CÔNG CỤ, hiện tượng điển hình là gì?",
      options: ["Agent báo lỗi và dừng", "Agent im lặng", "Agent trả lời trơn tru, tự tin bằng số liệu bịa từ bộ nhớ tham số", "Agent lặp vô hạn"], answer: 2,
      explain: "Thất bại điển hình không phải là thoát kèm lỗi mà là một câu trả lời trông không có sơ hở. “Đã trả lời” ≠ “đã hoàn thành”." },
    { q: "Khi bỏ KẾT QUẢ CÔNG CỤ khỏi context, Agent thường…",
      options: ["Trả lời đúng nhưng chậm hơn", "Thử lại liên tục đến khi cạn ngân sách loop (loop mù)", "Từ chối làm", "Gọi tool khác"], answer: 1,
      explain: "Tool result là chìa khóa khép vòng điều khiển. Thiếu nó, Agent hành động “mù”." },
    { q: "Context mỗi lần gọi LLM gồm static prefix và trajectory. Static prefix gồm những gì?",
      options: ["User message + tool result", "System prompt + tool definition", "Chỉ system prompt", "Toàn bộ lịch sử"], answer: 1,
      explain: "System prompt + tool definitions không đổi trong cuộc hội thoại; user/assistant/tool là trajectory động." },
    { q: "Trong hệ thống Agent cấp sản xuất như Claude Code, phần lớn mã Harness dành cho…",
      options: ["Tool definition", "Ràng buộc, xác minh và sửa lỗi", "Giao diện người dùng", "Gọi API model"], answer: 1,
      explain: "Tool chỉ là phần nhỏ; cơ chế bảo vệ (quyền, nén, circuit breaker, khôi phục lỗi) mới là cốt lõi." },
    { q: "LangChain tăng điểm Terminal Bench 2.0 từ 52,8% lên 66,5% bằng cách nào?",
      options: ["Đổi sang model lớn hơn", "Fine-tune model", "Cải tiến Harness (tự kiểm tra, phát hiện loop…)", "Thêm dữ liệu huấn luyện"], answer: 2,
      explain: "Không đổi model — chỉ đổi Harness. Bằng chứng cho luận điểm “Harness là năng lực cạnh tranh”." },
    { q: "Thứ tự thực dụng nhất khi xây ứng dụng LLM là?",
      options: ["autonomous Agent → workflow → prompt", "Đa Agent ngay từ đầu", "Tối ưu prompt → workflow → autonomous Agent", "Workflow → fine-tune → Agent"], answer: 2,
      explain: "Đi từ đơn giản đến phức tạp; Agent đổi độ trễ và chi phí lấy hiệu quả nên chỉ dùng khi thật cần." },
    { q: "Guardrail tầng nào KHÔNG phụ thuộc vào việc model có bị prompt injection hay không, và khó vượt qua nhất?",
      options: ["Context layer", "Execution layer", "Data layer", "System prompt"], answer: 2,
      explain: "Data layer (row-level security, ràng buộc CSDL…) vẫn từ chối thao tác vượt quyền dù hai tầng trên đã thất thủ." },
    { q: "Mẫu Proposer–Reviewer yêu cầu điều gì?",
      options: ["Cùng một Agent tạo rồi tự kiểm tra", "Hai vai không chung context; người thẩm định nhìn vào sản phẩm", "Người thẩm định đọc Chain-of-Thought của người tạo", "Luôn cần con người"], answer: 1,
      explain: "Tự thẩm định không đáng tin: trong cùng context, model không nghĩ ra điều nó đã không nghĩ ra và khó biết mình bị tiêm nhiễm." },
  ],
  cards: [
    { front: "Công thức cốt lõi của Agent?", back: "Agent = LLM + Context + Tools (não + mắt + tay chân · Policy + Observation + Action)." },
    { front: "Agent = Model + ?", back: "Harness = quản lý context + giao diện tool + ràng buộc + xác minh + sửa lỗi." },
    { front: "Context gồm 5 phần nào?", back: "System prompt, tool definitions (tĩnh) · user messages, assistant messages, tool results (động)." },
    { front: "ReAct gồm 3 khâu nào?", back: "Suy nghĩ (reasoning) → hành động (gọi tool) → quan sát (kết quả), lặp tới khi xong." },
    { front: "Bỏ tool definition thì sao?", back: "Không gọi được tool, nhưng vẫn trả lời tự tin bằng số liệu bịa — trông như thật." },
    { front: "Bỏ tool result thì sao?", back: "Loop mù: thử lại liên tục đến khi cạn max_iterations." },
    { front: "Đòn bẩy chính khi giữ nguyên model?", back: "Mở rộng observation space & hành động = thêm context + tool (Manus, OpenClaw)." },
    { front: "Năm loại tool?", back: "Nhận thức · Thực thi · Cộng tác · Kích hoạt sự kiện · Giao tiếp người dùng." },
    { front: "Ba con đường thay đổi hành vi Agent?", back: "In-context adaptation (nhanh, tạm) · cập nhật sản phẩm bên ngoài (Prompt/Skill/mã) · cập nhật tham số (post-training)." },
    { front: "Ba nguyên tắc xây Agent (Anthropic)?", back: "Giữ đơn giản · Minh bạch · Thiết kế giao diện tool ACI (poka-yoke)." },
    { front: "Ba tầng guardrail?", back: "Context (nhìn gì) → Thực thi (làm gì) → Dữ liệu (đổi được gì). Càng dưới càng khó vượt." },
    { front: "Các điều kiện thoát của autonomous Agent?", back: "Xong việc · gọi final_answer · không gọi tool · vượt giới hạn lỗi · đạt số vòng tối đa." },
    { front: "5 mẫu thiết kế xuyên suốt sách?", back: "Proposer–Reviewer · Progressive Disclosure · Append-only · Boundary Set + Retention Set · Diff tối thiểu + hoàn tác." },
    { front: "Các làn sóng kỹ thuật (lớp sau bao lớp trước)?", back: "Prompt ⊂ Context ⊂ Harness ⊂ Loop Engineering (và gần đây: Graph Engineering)." },
  ],
};
