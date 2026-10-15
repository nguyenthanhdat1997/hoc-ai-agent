import type { Chapter } from "../lib/types";
import { Callout, Formula, Table } from "../components/ui";
import { Classifier } from "../demos/Classifier";
import { EvolutionStream, ReleaseGate } from "../demos/EvolveDemos";
import { LabSetup } from "./labSetup";
import evolvePy from "../../../agent-lab/ch09/evolve_loop.py?raw";

function MediumDemo() {
  return (
    <Classifier
      options={["Knowledge", "Prompt / Skill", "Program / Harness", "Parameters"]}
      items={[
        { text: "Hãng bay X yêu cầu đặt suất ăn đặc biệt trước 24 giờ", answer: "Knowledge", why: "Dữ kiện/kinh nghiệm có nguồn, cần cập nhật và truy xuất khi cần → experience knowledge base." },
        { text: "Tranh chấp phí đổi vé thông thường: tra policy, giải thích, tìm phương án hợp lệ — chỉ chuyển người khi khách yêu cầu rõ hoặc có vấn đề an toàn", answer: "Prompt / Skill", why: "Nguyên tắc phán đoán cần hiểu ngữ cảnh và ngoại lệ, nhưng diễn đạt được bằng lời." },
        { text: "Tool trả lỗi retryable=false mà Agent vẫn gọi lại 5 lần", answer: "Program / Harness", why: "Ràng buộc tất định → sửa retry_policy / circuit breaker, không phải thêm một câu vào Prompt." },
        { text: "Gửi email qua web mail: lần nào cũng cùng các bước, chỉ khác người nhận và nội dung", answer: "Program / Harness", why: "Biên dịch trajectory thành workflow có tham số và state check (PreAct: nhanh hơn 8,5–13 lần)." },
        { text: "Văn bản sinh ra vẫn có “giọng AI” khuôn mẫu", answer: "Parameters", why: "Năng lực nhiều chiều, khó nén thành vài luật → post-training." },
        { text: "Nhận diện tổn thương trên ảnh từ máy chụp mới", answer: "Parameters", why: "Nhận thức nhiều chiều; domain shift vẫn cần LoRA dù domain thay đổi liên tục." },
      ]}
    />
  );
}

function LayerDemo() {
  return (
    <Classifier
      options={["Outcome", "Process", "Quality"]}
      items={[
        { text: "Đơn hàng đã thực sự được hoàn đủ 450.000đ trong database", answer: "Outcome", why: "Đọc trạng thái thật của môi trường — lớp nền, dựng đầu tiên." },
        { text: "Agent hứa “sẽ hoàn tiền trong 7 ngày” nhưng không hề gọi tool hoàn tiền", answer: "Process", why: "Promise–action consistency: so câu trả lời với tool log, kiểm được bằng code." },
        { text: "Agent đọc số CCCD đầy đủ của khách cho người gọi chưa xác minh", answer: "Process", why: "Privacy boundary: rule, quyền, quy trình bắt buộc." },
        { text: "Câu trả lời dài dòng, lặp lại, đậm văn mẫu", answer: "Quality", why: "Expression quality — LLM Rubric, phải trích bằng chứng." },
        { text: "Phương án ban đầu bất khả thi; Agent có tìm được cách hợp lệ khác không?", answer: "Quality", why: "Compliant alternatives — lớp chất lượng phục vụ." },
      ]}
    />
  );
}

export const ch9: Chapter = {
  id: 9,
  title: "Continual Evolution of Agents",
  short: "Continual Evolution",
  tier: "Đánh giá & cải tiến",
  minutes: 40,
  ready: true,
  oneLiner: "Model chưa tự học liên tục được, nên ta dựng một hệ thống học quanh nó: ghi bằng chứng → rút tín hiệu → đề xuất bản cập nhật → kiểm chứng → phát hành hoặc hoàn tác.",
  keyIdeas: [
    "Giữ lại kinh nghiệm ≠ học từ kinh nghiệm. Học chỉ xảy ra khi hệ thống đánh giá, so sánh, khái quát và kiểm chứng bằng chứng — không phải khi log được ghi xuống đĩa.",
    "Tín hiệu học đến từ trajectory verification ba lớp: outcome (xong chưa?), process (làm đúng cách chưa?), quality (phục vụ tốt chưa?). Đầu ra phải có: kết quả, phán quyết từng chiều, vị trí bằng chứng, nhãn lỗi — và được phép từ chối chấm.",
    "Bốn nơi ghi kinh nghiệm theo cách năng lực được biểu diễn: Knowledge (dữ kiện, kinh nghiệm) · Prompt/Skill (nguyên tắc nói ra được) · Program/Harness (quy trình tất định, ràng buộc cứng) · Parameters (nhận thức, phong cách, chiến lược ngầm).",
    "Mỗi thay đổi là minimal diff có provenance, kiểm trên boundary set (phải tốt lên) VÀ retention set (không được tệ đi). Sản phẩm model tự rút ra phải qua kiểm chứng độc lập.",
    "Hai vòng: online chỉ làm việc và ghi bằng chứng, không tự sửa mình; offline gom, chẩn đoán, sinh ứng viên, regression, canary, rollback.",
    "Harness updating ≠ Harness benefit: Skill viết đúng nhưng Agent không nạp đúng lúc thì điểm vẫn không tăng. Đo riêng: candidate validity, activation rate, adherence rate, held-out gain.",
    "Ba ranh giới an toàn: tách bằng chứng khỏi chỉ thị; tách ứng viên khỏi production; cơ chế an toàn (validator, test, ngưỡng, audit log) không được tự sửa.",
    "Sleep learning: hợp nhất offline theo chu kỳ — trigger, orient, gom & hợp nhất, kiểm & duyệt, tỉa & đánh chỉ mục. Tiến hóa không có nghĩa là phình to vô hạn.",
  ],
  sections: [
    {
      id: "why",
      title: "Vì sao cần “tiến hóa liên tục”",
      body: (
        <>
          <p>
            Nghịch lý hiện nay: Agent giải được task phức tạp chưa từng thấy, nhưng sau mười nghìn task tương tự vẫn có thể lặp lại lỗi của
            ngày đầu. In-context learning chỉ sống trong task hiện tại; context kết thúc là mất. Lưu hội thoại vào memory cũng không phải học hành vi mới.
          </p>
          <p>
            Vì sao không để model tự train sau mỗi task? Production hiếm khi có tín hiệu sạch: khách hài lòng không có nghĩa là tuân thủ; cập nhật
            tham số cục bộ gây quên, trôi policy, suy giảm an toàn; feedback chưa kiểm chứng và Prompt injection có thể cắm rễ rồi khuếch đại.
          </p>
          <Formula>Thực thi task → ghi trajectory → hình thành tín hiệu → sinh ứng viên (Knowledge · Instructions · Programs · Parameters) → kiểm chứng & phát hành → vòng tiếp theo</Formula>
          <Callout title="Continual learning vs continual evolution">
            <b>Continual learning</b> là ở mức weight của model — chưa làm được tin cậy. <b>Continual evolution</b> (cách gọi của sách) là một hệ
            thống quanh model: chỉ những cập nhật làm thay đổi hành vi sau đó VÀ qua kiểm chứng mới được tính là tiến hóa.
          </Callout>
        </>
      ),
    },
    {
      id: "signals",
      title: "Rút tín hiệu học từ trajectory vận hành",
      body: (
        <>
          <Table
            head={["Lớp", "Câu hỏi", "Kiểm bằng"]}
            rows={[
              ["Outcome verifier", "Task có thật sự xong không?", "Test, trạng thái DB, số tiền, kết quả tool — tin hơn lời model tự kể"],
              ["Process verifier", "Có xong theo cách được phép không?", "Policy store, bảng quyền, action trace — kiểm bằng code"],
              ["Quality (LLM Rubric)", "Người dùng có được phục vụ tốt không?", "Rubric định trước, chấm từng mục, trích bằng chứng"],
            ]}
          />
          <p>
            Agent CSKH có 7 chiều: task outcome; rule compliance, privacy boundaries, promise–action consistency (process); expression quality,
            compliant alternatives (quality); factual reliability vắt qua hai lớp — phần khớp được với tool return thì code kiểm, phần còn lại Rubric chấm.
          </p>
          <Callout kind="warn" title="Một điểm tổng không dạy được gì">
            Một con số chỉ cho biết lần chạy tốt cỡ nào, không nói nên sửa gì. Đầu ra học được cần bốn thứ: thành công/một phần/thất bại · phán quyết
            từng chiều · vị trí bằng chứng (lượt nào, tool call nào) · nhãn loại lỗi. Bằng chứng mỏng thì verifier từ chối chấm, case bị loại khỏi tập học.
          </Callout>
        </>
      ),
    },
    {
      id: "four",
      title: "Bốn cách ghi kinh nghiệm",
      body: (
        <>
          <Table
            head={["Cách cập nhật", "Hợp với", "Ưu", "Hạn chế"]}
            rows={[
              ["Experience knowledge base", "Dữ kiện, mẫu hình kinh nghiệm, ngoại lệ, nguồn", "Cập nhật nhanh, truy được nguồn, nạp khi cần", "Phụ thuộc retrieval và model áp dụng đúng"],
              ["Prompt & Skill", "Nguyên tắc cần hiểu ngữ cảnh nhưng nói ra được", "Dễ hiểu, phạm vi kiểm soát được", "Dễ phình, xung đột, bị bỏ qua"],
              ["Program & Harness", "Quy trình tất định, tool, ràng buộc cứng", "Test được, ổn định, rẻ khi chạy", "Tốn công phát triển và bảo trì"],
              ["Model parameters", "Nhận thức nhiều chiều, phong cách, chiến lược ngầm", "Tổng quát hóa mạnh, rẻ khi suy luận", "Cập nhật và regression đắt"],
            ]}
          />
          <p>
            Câu hỏi đầu tiên không phải “kinh nghiệm tồn tại bao lâu” mà là <b>năng lực có diễn đạt đầy đủ được bằng dữ kiện, luật bằng lời hay
            chương trình không</b>. Một năng lực có thể dùng nhiều nơi: Agent ảnh y khoa dùng tham số để nhận diện, knowledge base cho guideline mới,
            code để tính chỉ số rủi ro.
          </p>
          <h4>Kinh nghiệm → Knowledge</h4>
          <p>
            Chương 3 rút “người dùng và thế giới thế nào”; chương này rút “điều kiện nào thì làm gì”. Ba lớp dữ liệu: raw trajectory bất biến (audit)
            → phân tích từng lần chạy → so sánh, gom cụm nhiều trajectory thành tài liệu Markdown (phạm vi áp dụng, chiến lược, điều cấm, ngoại lệ,
            nguồn, thời điểm kiểm chứng gần nhất). Năm bước: giữ trajectory → phân tích từng run → bảng bằng chứng ủng hộ/phản bác → chỉ promote khi
            vượt ngưỡng → đo transfer trên task mới. Reflection của Reflexion giúp sinh bài học ứng viên, nhưng <b>reflection không phải bằng chứng</b>.
          </p>
          <h4>Kinh nghiệm → Prompt / Skill</h4>
          <p>
            System Prompt áp cho mọi task; Skill chỉ nạp khi domain/tool khớp; Harness ép quyền và ràng buộc cứng. Karpathy gọi đây là{" "}
            <b>System Prompt Learning</b>. DSPy, OPRO, GEPA hợp tối ưu offline theo lô; production cần minimal diff có provenance, rollback nhanh.
          </p>
          <Callout title="Ví dụ τ²-bench telecom">
            Model yếu: tool lỗi → retry → chuyển người; 19/20 task tập rút luật kết thúc như vậy. Cho model tự rút luật từ 19 trajectory, nối vào cuối
            policy → transfer set từ 12,3% lên 19,3%, không task cũ nào hỏng. Bằng chứng đưa vào quyết định luật rút ra: chỉ có log lỗi → “đừng gọi mãi
            một tool lỗi giống nhau”; thêm danh sách tool nào của Agent, tool nào của user → “SIM, APN thuộc thiết bị user, hãy hướng dẫn user”. Lỗi gốc
            hóa ra rất đơn giản: Agent nhét câu “Xin cung cấp số điện thoại” vào tham số tool, 5 lần liền. Và hai luật model tự rút (“chuyển người sau 3
            lần lỗi”) lại viết thất bại vào specification — nên phải kiểm chứng độc lập.
          </Callout>
          <h4>Kinh nghiệm → Program</h4>
          <p>
            Thao tác ổn định, lặp lại, kiểm được thì biên dịch thành workflow/tool/Harness. Vòng đời workflow trình duyệt: capture → parameterize
            (<code>{"{recipient}"}</code>, <code>{"{subject}"}</code>) → state check trước/sau mỗi hành động và trạng thái cuối → validate bằng replay
            trong sandbox đã reset → match & replay không cần LLM → <b>invalidate & relearn</b> khi trang đổi. Thiếu state check sẽ có ảo giác nguy
            hiểm: replay 100%, nút nào cũng bấm, nhưng một trường trống và việc chưa hề xong.
          </p>
          <p>
            Agent sửa code của chính mình ≠ process đang chạy tự ghi đè. Tạo nhánh ứng viên từ bản stable, sinh patch nhỏ, chạy static check, unit test,
            security scan, replay trajectory lỗi, regression → canary. Mỗi yêu cầu sửa là một <b>falsifiable change contract</b>: bằng chứng lỗi, nguyên
            nhân suy ra, thành phần chịu trách nhiệm, thay đổi, hành vi kỳ vọng tốt lên, hành vi có thể hỏng, test cho cả hai. Self-Harness còn đưa
            vào hành vi thành công phải giữ và các thay đổi từng bị từ chối.
          </p>
          <h4>Kinh nghiệm → Parameters</h4>
          <p>
            Khi năng lực không nén được thành luật (ảnh y khoa, ngữ điệu giọng nói, bỏ “giọng AI”, kế hoạch dài hơi). Trajectory đã đánh giá thành dữ
            liệu Chương 8: demo tốt → SFT, preference → cặp DPO, môi trường có reward tin cậy → RL. Bỏ thông tin riêng tư, lọc trajectory sai, giữ
            regression set độc lập, kiểm quên sau train.
          </p>
        </>
      ),
    },
    {
      id: "meta",
      title: "Từ cập nhật artifact đến cập nhật “cách cập nhật”",
      body: (
        <>
          <Formula>rule / memory → structured context → workflow → Harness code → optimizer code sinh ứng viên</Formula>
          <ul>
            <li><b>Mặc định sửa nội dung artifact</b> (bán kính ảnh hưởng nhỏ, dễ quy trách nhiệm, dễ rollback). Viết lại cả Prompt nhiều lần sẽ dần xóa chi tiết hiếm mà quan trọng — ACE giữ context thành các mục có ID ổn định, merge tăng dần bằng logic tất định.</li>
            <li><b>Meta Context Engineering:</b> vòng trong tối ưu context, vòng ngoài sửa chính các thao tác quản lý context (search, chọn, lọc, format).</li>
            <li><b>AFlow, Meta-Harness:</b> tìm kiếm trên đồ thị workflow / mã Harness bằng execution feedback.</li>
            <li><b>Dream-RSI:</b> lưu quá trình khám phá thành cây; dùng cây làm replay simulator để thử exploration policy mới mà không chạy lại Agent. Chỉ đảm bảo trong phạm vi lịch sử đã có.</li>
          </ul>
          <p className="small muted">
            Thí nghiệm “Đưa cuốn sách này cho Hermes”: Hermes tự nhận ra trajectory lưu thiếu bằng chứng có cấu trúc, tự sửa code và thêm test; ba lần
            reviewer độc lập từ chối, lần thứ tư chấp nhận. Từ chối không phải kết thúc mà là một phần vòng cải tiến.
          </p>
        </>
      ),
    },
    {
      id: "loop",
      title: "Vòng khép kín cho vận hành dài hạn",
      body: (
        <>
          <Table
            head={["Vòng", "Làm gì", "Không được làm gì"]}
            rows={[
              ["Online execution", "Agent stable xử lý task thật, ghi trajectory và feedback vào experience log có version", "Tự sửa bản đang chạy"],
              ["Offline evolution", "Gom, chẩn đoán nguyên nhân chung, sinh ứng viên, regression & safety check, canary, rollback", "Sửa root of trust (quyền, audit, verifier, rollback)"],
            ]}
          />
          <p>
            <b>Voyager</b> (Minecraft) là ví dụ khá đủ: automatic curriculum chọn mục tiêu vừa sức, skill library lưu code đã kiểm chứng và ghép được,
            iterative prompting đưa lỗi và quan sát vào vòng sinh code tiếp theo. Thiếu một trong ba là gãy.
          </p>
          <Table
            head={["Metric", "Trả lời câu hỏi"]}
            rows={[
              ["Candidate-change validity", "Updater có đề xuất thay đổi hữu ích không?"],
              ["Artifact activation rate", "Agent có nạp Skill/memory/tool mới đúng lúc không?"],
              ["Successful adherence rate", "Nạp rồi có làm theo không?"],
              ["Held-out task gain", "Hệ thống có tốt lên trên task không dùng để tiến hóa không?"],
            ]}
          />
          <p>
            Theo dõi đồng thời năm thứ: <b>regression</b>, <b>generalization</b>, <b>token efficiency</b>, <b>safety</b>, <b>chất lượng kỹ thuật dài
            hạn</b> (độ phức tạp bảo trì, nhất quán kiến trúc, tương thích ngược). Sửa được case hiện tại mà làm hỏng case cũ thì không phải tiến hóa.
          </p>
          <Callout kind="warn" title="Khi “xong” không có nghĩa là “tiến bộ”">
            Nghiên cứu mở: 3/4 lần thử tự động từ ý tưởng đến paper thất bại. Ba kiểu lỗi: <b>implementation drift</b> (khó thì lùi về cách quen
            thuộc, không còn kiểm giả thuyết gốc), <b>epistemic over-optimism</b> (tín hiệu còn là nhiễu đã giải thích và tuyên bố phát hiện),{" "}
            <b>thiếu phán đoán ngầm</b> (baseline nào quan trọng, khi nào bỏ giả thuyết). Cách xử lý: tách claim khỏi evidence, giữ kết quả âm,
            giữ đa dạng tìm kiếm, đưa con người lên tầng định nghĩa vấn đề và tiêu chí.
          </Callout>
        </>
      ),
    },
    {
      id: "safety",
      title: "Ranh giới an toàn và sleep learning",
      body: (
        <>
          <ol>
            <li><b>Tách bằng chứng khỏi chỉ thị:</b> web, tool output và cả bản tóm tắt LLM của chúng là bằng chứng không tin cậy — tóm tắt không phải bước khử độc. Trích claim, vị trí nguồn, thời điểm vào schema cố định; không bao giờ thực thi chuỗi trích ra như lệnh. Confidence do model tự đưa không phải cổng duyệt.</li>
            <li><b>Tách ứng viên khỏi production:</b> năng lực mới vào vùng ứng viên không phục vụ traffic thật; code và dependency mới qua sandbox, permission review, supply-chain scan.</li>
            <li><b>Cơ chế an toàn không tự sửa được:</b> Agent được sửa Prompt, Skill, knowledge, tool — nhưng không được sửa validator, test, ngưỡng release, audit log, bản backup stable. Nếu không, chỉ cần hạ ngưỡng là regression thành “tiến bộ”.</li>
          </ol>
          <h4>Sleep learning: hợp nhất, quên, bảo trì</h4>
          <Formula>Trigger → Orient → Collect & consolidate → Validate & approve → Prune & index</Formula>
          <p>
            Online chỉ hoàn thành task và append bằng chứng; tiến trình nền đọc lô kinh nghiệm mới khi rảnh, so kết luận cũ–mới, gộp trùng, giải xung
            đột, đề xuất ứng viên, chạy regression. Claude Code auto memory dùng chỉ mục <code>MEMORY.md</code> + file chi tiết theo chủ đề, nạp phần
            đầu chỉ mục, đọc phần còn lại khi cần. Hermes có Curator theo dõi mức dùng của Skill, lưu snapshot trước khi gộp để rollback được.
          </p>
          <ul>
            <li>Gộp kinh nghiệm trùng, giữ provenance và version.</li>
            <li>Chuyển luật cục bộ từ global Prompt sang Skill theo domain — Prompt như cẩm nang nhân viên mới, không phải “99 điều luật sắt”.</li>
            <li>Kiểm lại tool lâu không dùng; xóa kiến thức bị bằng chứng mới bác bỏ; train lại LoRA từ base model gốc.</li>
          </ul>
        </>
      ),
    },
  ],
  pitfalls: [
    { wrong: "Ghi mọi hội thoại vào memory và gọi đó là học.", right: "Học = đánh giá, so sánh nhiều trajectory, khái quát, kiểm chứng; raw log chỉ là bằng chứng." },
    { wrong: "Một lần thành công là tóm tắt chiến lược rồi vector hóa ngay.", right: "Verifier gán nhãn, so sánh nhiều đường cùng họ task, chỉ promote khi vượt ngưỡng ủng hộ và có transfer." },
    { wrong: "Dùng mức hài lòng của khách làm tín hiệu học duy nhất.", right: "Hài lòng ≠ tuân thủ; dùng verification ba lớp và guardrail metric." },
    { wrong: "Để model viết lại toàn bộ Prompt mỗi vòng.", right: "Minimal diff có provenance; kiểm boundary set + retention set; rollback nhanh." },
    { wrong: "Thêm một câu vào Prompt để Agent đừng retry lỗi không thể retry.", right: "Ràng buộc tất định thuộc về code (retry policy, circuit breaker)." },
    { wrong: "Workflow replay xong mọi bước là coi như thành công.", right: "State check trước/sau và trạng thái cuối đọc từ trang/backend thật; trang đổi thì vô hiệu hóa và học lại." },
    { wrong: "Cho Agent quyền sửa cả validator và ngưỡng release.", right: "Trust root nằm ngoài vòng tiến hóa." },
    { wrong: "Thấy điểm end-to-end không tăng thì kết luận updater kém.", right: "Đo riêng candidate validity, activation rate, adherence rate." },
  ],
  demos: [
    { id: "stream", title: "Agent có thật sự tiến hóa?", component: EvolutionStream, desc: "Chạy dòng 14 task với ba kiểu bộ nhớ, có một lần đổi luật hành lý 20 → 23 kg." },
    { id: "gate", title: "Release gate cho bản vá Prompt", component: ReleaseGate, desc: "Chọn luật đưa vào bản vá và xem cổng phát hành quyết định thế nào." },
    { id: "medium", title: "Ghi kinh nghiệm vào đâu?", component: MediumDemo, desc: "Knowledge, Prompt/Skill, Program/Harness hay Parameters?" },
    { id: "layers", title: "Ba lớp trajectory verification", component: LayerDemo, desc: "Mỗi kiểm tra thuộc lớp outcome, process hay quality?" },
  ],
  lab: {
    intro: (<><LabSetup /><p>Bài lab chương này không cần model: mô phỏng ba cổng mà kinh nghiệm phải đi qua trước khi được thay đổi Agent.</p></>),
    steps: [
      {
        id: "evolve_loop", title: "Bảng bằng chứng, release gate và đánh giá dài hạn", file: "ch09/evolve_loop.py", code: evolvePy,
        run: ["python3 ch09/evolve_loop.py"],
        observe: (
          <ul>
            <li>Phần 1: vì sao mẫu hình <code>/v1/fare</code> được ủng hộ 3 lần vẫn không được promote? Nên làm gì với nó — xóa, hay thu hẹp điều kiện “chỉ khi API v1”?</li>
            <li>Phần 2: bỏ task <code>transient_error</code> khỏi retention set rồi chạy lại. Ứng viên A có lọt qua không? Bài học về độ phủ của retention set?</li>
            <li>Phần 3: vì sao cả ba đều sai task đầu của mỗi chủ đề? (Gợi ý: feedback chỉ đến sau khi task kết thúc.)</li>
          </ul>
        ),
        result: (
          <p className="small">
            Phần 1: 1 PROMOTE, 1 candidate, 1 CONFLICT. Phần 2: A bị reject (hỏng 2 task retention), B release_to_canary, C bị reject vì đụng trust
            root. Phần 3: static 0/14; append_only rule_change 0/3 và vẫn trích luật 20 kg; evolving rule_change 2/3, retention 4/4.
          </p>
        ),
      },
    ],
  },
  apply: [
    {
      title: "Thiết kế verifier ba lớp cho Agent của bạn",
      prompt: <p>Liệt kê các chiều đánh giá theo outcome / process / quality. Mỗi chiều: kiểm bằng code hay Rubric, bằng chứng chính lấy từ đâu, khi nào verifier được phép từ chối chấm?</p>,
      hint: <p>Bắt đầu từ lớp outcome đọc trạng thái thật — đó là lớp tin cậy nhất và nên dựng trước.</p>,
    },
    {
      title: "Viết một change contract",
      prompt: <p>Chọn một lỗi lặp lại của Agent. Viết: bằng chứng lỗi (trajectory nào), nguyên nhân suy ra, thành phần chịu trách nhiệm, nơi sửa (Knowledge/Skill/Program/Parameters) và lý do, hành vi kỳ vọng tốt lên, hành vi có thể hỏng, test cho cả hai, phiên bản rollback.</p>,
      hint: <p>Nếu có thể kiểm bằng code thì sửa ở code, đừng thêm câu vào Prompt.</p>,
    },
    {
      title: "Thiết kế chu kỳ sleep learning",
      prompt: <p>Cho Agent của bạn (hoặc chính memory Claude Code của bạn): trigger là gì, những gì được gộp/tỉa, bộ kiểm nào phải pass, việc gì cần người duyệt, rollback thế nào?</p>,
      hint: <p>Luôn lưu snapshot trước khi gộp; mọi kết luận bị loại vẫn giữ provenance.</p>,
    },
  ],
  glossary: [
    { en: "Continual learning", vi: "Học liên tục", note: "Ở mức weight model — chưa làm được tin cậy." },
    { en: "Continual evolution", vi: "Tiến hóa liên tục", note: "Hệ thống quanh model: bằng chứng → ứng viên → kiểm chứng → phát hành." },
    { en: "Outcome / process verifier", vi: "Bộ kiểm kết quả / quá trình", note: "Xong chưa / xong đúng cách chưa." },
    { en: "Promise–action consistency", vi: "Lời hứa khớp hành động", note: "Hành động tuyên bố đã làm có thật xảy ra không." },
    { en: "Experience knowledge base", vi: "Kho tri thức kinh nghiệm", note: "“Điều kiện nào thì làm gì”, rút từ trajectory." },
    { en: "System Prompt Learning", vi: "Học bằng system prompt", note: "Để lại một câu rõ ràng nhắc bản thân sau này." },
    { en: "Boundary set / retention set", vi: "Tập biên / tập giữ lại", note: "Phải tốt lên / không được tệ đi." },
    { en: "Change contract", vi: "Hợp đồng thay đổi", note: "Thay đổi kiểm chứng được, có dự đoán tác động." },
    { en: "Release gate / canary", vi: "Cổng phát hành / triển khai thử", note: "release_to_canary hoặc reject_candidate." },
    { en: "Trust root", vi: "Gốc tin cậy", note: "Validator, test, ngưỡng, audit log — ngoài tầm sửa của Agent." },
    { en: "Harness updating vs benefit", vi: "Cập nhật vs hưởng lợi từ Harness", note: "Viết đúng chưa chắc được nạp và làm theo." },
    { en: "Artifact activation rate", vi: "Tỷ lệ kích hoạt", note: "Agent có nạp đúng artifact mới đúng lúc không." },
    { en: "Sleep learning", vi: "Học khi ngủ", note: "Hợp nhất offline theo chu kỳ." },
    { en: "Skill library / automatic curriculum", vi: "Thư viện kỹ năng / giáo trình tự động", note: "Hai cơ chế cốt lõi của Voyager." },
    { en: "Implementation drift", vi: "Trôi cách triển khai", note: "Khó thì lùi về cách quen thuộc, không còn kiểm giả thuyết gốc." },
  ],
  quiz: [
    { q: "Lưu 100 trajectory vào vector store có phải là Agent đã học không?", options: ["Có", "Không — học cần đánh giá, so sánh, khái quát, kiểm chứng", "Có nếu dùng embedding tốt", "Có nếu lưu đủ lâu"], answer: 1, explain: "Giữ lại kinh nghiệm ≠ học từ kinh nghiệm." },
    { q: "Lớp verification nào nên dựng trước tiên?", options: ["LLM Rubric", "Outcome verifier đọc trạng thái thật", "Process verifier", "Khảo sát người dùng"], answer: 1, explain: "Tín hiệu từ môi trường thật tin cậy hơn lời model tự kể." },
    { q: "Tool trả retryable=false nhưng Agent vẫn retry 5 lần. Sửa ở đâu?", options: ["Thêm câu vào Prompt", "Retry policy / circuit breaker trong code", "Fine-tune", "Knowledge base"], answer: 1, explain: "Ràng buộc tất định thuộc về program/Harness." },
    { q: "Bản vá Prompt làm boundary set tốt lên nhưng 2 task retention hỏng. Gate quyết định?", options: ["release_to_canary", "reject_candidate", "Phát hành toàn bộ", "Bỏ qua retention"], answer: 1, explain: "Phải tốt lên ở boundary VÀ không tệ đi ở retention." },
    { q: "Vì sao luật “chuyển người sau 3 lần lỗi” do model tự rút ra lại có hại?", options: ["Quá dài", "Model coi hành vi hay thấy là hành vi nên có, viết thất bại vào specification", "Sai chính tả", "Không có hại"], answer: 1, explain: "Sản phẩm do model rút ra phải qua kiểm chứng độc lập." },
    { q: "Workflow replay bấm đủ mọi nút nhưng một trường để trống. Thiếu gì?", options: ["LLM mạnh hơn", "State check trước/sau và kiểm trạng thái cuối", "Tốc độ", "Selector khác"], answer: 1, explain: "Hành động chạy xong ≠ task hoàn thành." },
    { q: "Skill mới viết đúng nhưng điểm không tăng. Nên đo thêm gì?", options: ["Không cần", "Activation rate và adherence rate", "Độ dài Skill", "Số token"], answer: 1, explain: "Harness updating ≠ Harness benefit." },
    { q: "Agent được phép sửa thứ nào sau đây?", options: ["Validator", "Ngưỡng release", "Skill của domain", "Audit log"], answer: 2, explain: "Cơ chế an toàn không được tự sửa." },
    { q: "Luật hành lý đổi 20 → 23 kg. Kiểu bộ nhớ nào vẫn trả lời 20 kg?", options: ["evolving", "append_only", "Cả hai", "Không cái nào"], answer: 1, explain: "append_only nhớ bản đầu, không giải quyết xung đột." },
    { q: "Tóm tắt một trang web bằng LLM có làm nội dung đó an toàn để thành Skill không?", options: ["Có", "Không — tóm tắt không phải bước khử độc", "Có nếu model mạnh", "Có nếu ngắn"], answer: 1, explain: "Bằng chứng không tin cậy; trích vào schema, không thực thi như lệnh." },
  ],
  cards: [
    { front: "Continual learning vs continual evolution?", back: "Mức weight (chưa tin cậy) vs hệ thống quanh model có kiểm chứng." },
    { front: "3 lớp trajectory verification?", back: "Outcome (xong chưa) · Process (đúng cách chưa) · Quality (phục vụ tốt chưa)." },
    { front: "4 thứ đầu ra verifier phải có để học được?", back: "Kết quả · phán quyết từng chiều · vị trí bằng chứng · nhãn lỗi (và được từ chối chấm)." },
    { front: "4 nơi ghi kinh nghiệm?", back: "Knowledge · Prompt/Skill · Program/Harness · Parameters — chọn theo cách năng lực được biểu diễn." },
    { front: "5 bước experience → knowledge?", back: "Giữ trajectory → phân tích từng run → bảng ủng hộ/phản bác → promote khi vượt ngưỡng → đo transfer." },
    { front: "Vòng đời workflow trình duyệt?", back: "Capture → parameterize → state check → validate (reset + replay) → match & replay → invalidate & relearn." },
    { front: "Change contract gồm gì?", back: "Bằng chứng, nguyên nhân, thành phần, thay đổi, hành vi kỳ vọng tốt lên, hành vi có thể hỏng, test cho cả hai." },
    { front: "Hai vòng của tiến hóa?", back: "Online: làm việc + ghi bằng chứng. Offline: chẩn đoán, ứng viên, regression, canary, rollback." },
    { front: "4 metric tách lớp?", back: "Candidate validity · activation rate · adherence rate · held-out gain." },
    { front: "3 ranh giới an toàn?", back: "Bằng chứng ≠ chỉ thị · ứng viên ≠ production · trust root không tự sửa." },
    { front: "5 bước sleep learning?", back: "Trigger → orient → collect & consolidate → validate & approve → prune & index." },
    { front: "3 cơ chế của Voyager?", back: "Automatic curriculum · skill library · iterative prompting." },
  ],
};
