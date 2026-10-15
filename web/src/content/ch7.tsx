import type { Chapter } from "../lib/types";
import { Callout, Code, Formula, Table } from "../components/ui";
import { Classifier } from "../demos/Classifier";
import { EloCalc, PassKCalc, SignificanceCalc } from "../demos/EvalDemos";
import { LabSetup } from "./labSetup";
import toolkitPy from "../../../agent-lab/ch07/eval_toolkit.py?raw";

function SpectrumDemo() {
  return (
    <Classifier
      options={["Deterministic", "Checklist", "Rubric + LLM", "Pairwise"]}
      items={[
        { text: "Bug fix: chạy test suite (FAIL_TO_PASS + PASS_TO_PASS)", answer: "Deterministic", why: "Trạng thái cuối duy nhất, kiểm bằng code — rẻ, tái lập được, đưa vào CI." },
        { text: "Hỗ trợ viễn thông: kiểm mobile data bật, speed test ≥ 200 Mbps, ai đã bật roaming", answer: "Checklist", why: "Nhiều kiểm tra tất định gộp theo reward_basis khai báo (τ²-bench)." },
        { text: "Câu trả lời khiếu nại có lời lẽ phù hợp, đủ thông tin, không bịa", answer: "Rubric + LLM", why: "Có chiều đánh giá nhưng không viết được thành assertion." },
        { text: "Model nào viết câu trả lời “hay hơn” cho câu hỏi mở", answer: "Pairwise", why: "Đến chiều đánh giá cũng khó nêu — chỉ hỏi A hay B tốt hơn (Chatbot Arena)." },
        { text: "Báo cáo nghiên cứu có bỏ sót thông tin then chốt không", answer: "Rubric + LLM", why: "Không có trạng thái cuối để truy vấn, cần giám khảo theo Rubric." },
      ]}
    />
  );
}

function AttributionDemo() {
  return (
    <Classifier
      options={["Hiểu yêu cầu", "Tool-call error", "Hack verification", "Báo cáo sai", "Dừng quá sớm"]}
      items={[
        { text: "Repo có hai tệp config cùng tên, Agent chọn đại một tệp, không hỏi, không ghi chú", answer: "Hiểu yêu cầu", why: "Mơ hồ không được làm rõ — trong trajectory-prefix regression, “hỏi lại trước” là hành động chấp nhận được." },
        { text: "edit_file báo old_string không khớp, Agent thử lại y hệt 3 lần rồi bỏ cuộc", answer: "Tool-call error", why: "Nguyên nhân gốc là lần edit đầu; 3 lần retry là HẬU QUẢ, không phải 3 nguyên nhân độc lập." },
        { text: "Agent thêm @skip vào test đang fail rồi báo “tests pass”", answer: "Hack verification", why: "Rule lọc trước: diff có đụng assertion/skip không, lời tuyên bố có khớp lệnh thực sự đã chạy không." },
        { text: "Mọi tool call và trạng thái đều đúng, nhưng Agent nói với khách số tiền hoàn sai", answer: "Báo cáo sai", why: "“Right actions, wrong report” — τ²-bench: 1/3 số thất bại có trạng thái đúng nhưng báo cáo sai." },
        { text: "Nhiệm vụ 3 mục tiêu, Agent làm xong 2 rồi tuyên bố cái thứ 3 bất khả thi khi chưa thử hết", answer: "Dừng quá sớm", why: "Ghi lại quyết định đầu tiên bỏ mục tiêu, tách khỏi lỗi verification cuối." },
      ]}
    />
  );
}

export const ch7: Chapter = {
  id: 7,
  title: "Evaluating Agents",
  short: "Evaluation",
  tier: "Đánh giá & cải tiến",
  minutes: 45,
  ready: true,
  oneLiner: "Làm sao biết Agent thật sự tốt lên hay xấu đi? Bốn khâu: thế nào là thành công, task lấy từ đâu, ai kiểm chứng, và biến điểm số thành quyết định.",
  keyIdeas: [
    "Đối tượng đánh giá là model + Harness. Model swap experiment (giữ Harness, đổi model) cho biết nút thắt nằm ở model hay ở Harness; ablation cho biết thành phần nào trong Harness quan trọng.",
    "Pass@k đo trần năng lực (technical wonder); Pass^k đo độ tin cậy nghiệp vụ. p = 60%, k = 5: Pass@5 ≈ 99%, Pass^5 ≈ 7,8%.",
    "Năm thành phần của evaluation environment: dataset, environment state (reset được), tools (atomic), rubric, interaction protocol. τ²-bench thêm user simulator có known_info, behavioral spec, grounding, và dual-control.",
    "Verifier phải kiểm sự thật máy kiểm được, không tin lời Agent: FAIL_TO_PASS + PASS_TO_PASS; chống contamination bằng template tham số hóa, canary GUID.",
    "Ba nguồn evaluation set: public benchmark (sàng model, học kỹ thuật), business set tự dựng (quyết định thật), production trajectory feedback (đắt nhất, chính xác nhất).",
    "Phổ verification: deterministic → checklist → Rubric + LLM-as-a-Judge → pairwise. Cái gì viết được thành assertion thì giữ là assertion. Rubric: expert-guided, đủ chiều, có trọng số và veto, tự chứa.",
    "Failure attribution tìm LỖI ĐẦU TIÊN, tách nguyên nhân khỏi hậu quả; rồi biến thành end-to-end và trajectory-prefix regression task (đáp án là tập hành động chấp nhận được).",
    "Quyết định cần thống kê: SE ≈ √(p(1−p)/n), paired analysis (McNemar, bootstrap), nhiều seed. Khi điểm tụt, kiểm tra hệ đánh giá trước, rồi mới đến Agent.",
  ],
  sections: [
    {
      id: "why",
      title: "Vì sao cần đánh giá — và đánh giá cái gì",
      body: (
        <>
          <p>
            Model nào, tool nào, knowledge base tổ chức ra sao, Harness cần ràng buộc gì — những câu hỏi này không có đáp án hiển nhiên.
            Đánh giá đặt chúng lên nền khoa học bằng thí nghiệm so sánh (đổi một biến mỗi lần) và ablation (tắt một thành phần mỗi lần).
            <i> You can’t improve what you don’t measure.</i>
          </p>
          <Callout title="Model swap experiment">
            Giữ nguyên Harness, thay model mạnh hơn/yếu hơn. Model mạnh hơn mà điểm không tăng → nút thắt ở Harness. Model yếu hơn làm
            điểm sụp mạnh → hiệu năng đang do model chi phối. Model mới cao điểm trên benchmark công khai chưa chắc tốt hơn trên việc của
            bạn — có bộ đánh giá riêng thì thậm chí có thể “xây sản phẩm cho model tương lai”: làm xong sản phẩm, theo dõi từng model mới,
            ra mắt khi có model vượt ngưỡng.
          </Callout>
          <Formula>① Thành công là gì → ② Task từ đâu → ③ Kiểm chứng thế nào → ④ Điểm số thành quyết định</Formula>
        </>
      ),
    },
    {
      id: "anatomy",
      title: "Mổ xẻ một task: telecom domain của τ²-bench",
      body: (
        <>
          <Code lang="json">{`
"ticket": "User không lên mạng được, thanh trạng thái báo 'No Service'. John Smith, 555-123-2002, đang ở Pháp…",
"user_scenario": { "known_info": "tên, số điện thoại, đang ở Pháp",
  "task_instructions": "…bực nhẹ sau lần thử đầu thất bại. Chỉ coi là xong khi speed test = excellent.
                        Luôn trả lời dựa trên kết quả tool call. Never make up the results of tool calls." },
"initial_state": [turn_airplane_mode_on (user), turn_roaming_off (user), enable_roaming (assistant)],
"evaluation_criteria": { "env_assertions": [mobile data on, speed ≥ 200 excellent], "reward_basis": ["ENV_ASSERTION"] }`}</Code>
          <ul>
            <li><b>Ranh giới hiểu biết của user được mô hình hóa:</b> user không biết nguyên nhân thật (airplane mode bật, roaming tắt) nên Agent phải hỏi và hướng dẫn kiểm tra.</li>
            <li><b>Simulator nhận behavioral spec, không phải kịch bản thoại:</b> cảm xúc, tiêu chí nghiệm thu, và <b>grounding</b> — thiếu nó, user giả sẽ xuôi theo Agent và đánh giá thành hai model gật gù với nhau.</li>
            <li><b>Initial state chia theo bên kiểm soát (dual-control):</b> lỗi nằm ở phía mà database nhìn không thấy; user tự có tool (toggle_airplane_mode…), Agent phải gọi lại tool để thấy kết quả.</li>
            <li><b>Scoring 4 lớp</b> (env_assertions, actions, communicate_info, nl_assertions), mỗi task khai báo lớp nào tính điểm.</li>
          </ul>
          <p className="small muted">
            Một lần chạy đạt điểm tối đa vẫn vi phạm policy “mỗi lần chỉ gọi một tool” mà verifier không bắt — cái giá của binary reward. Lần chạy
            thất bại: tool đã trả về đúng số của line L1001 là 555-123-2001, Agent đọc rồi mà không sửa kết luận — bằng chứng đã nằm trong context.
          </p>
        </>
      ),
    },
    {
      id: "metrics",
      title: "Thành công là gì: Pass@k và Pass^k",
      body: (
        <>
          <Formula>Pass@k = 1 − (1 − p)^k &nbsp;&nbsp;·&nbsp;&nbsp; Pass^k = p^k</Formula>
          <p>
            <b>Technical wonder</b> (Agent tự viết C compiler trong một tuần, tìm lỗ hổng tồn tại hàng chục năm) chỉ cần một trajectory đột
            phá — Pass@k, Best@k. Manus, OpenClaw nổi lên nhờ chính những “kỳ tích” lan trên mạng dù tỷ lệ thành công ban đầu không cao.
            <b> Business reliability</b> cần Pass^k: k lần liên tiếp đều đúng và không vi phạm tiêu chí tự động thất bại (an toàn, tuân thủ, bịa đặt).
            Báo cáo phải nói rõ k lần là gì; thao tác có side effect thì lấy mẫu trong sandbox.
          </p>
        </>
      ),
    },
    {
      id: "environment",
      title: "Evaluation environment và thiết kế dataset",
      body: (
        <>
          <Table
            head={["Thành phần", "Trong task telecom"]}
            rows={[
              ["Dataset", "Mỗi bản ghi task = một test case"],
              ["Environment state", "Database + trạng thái thiết bị; reset được bằng initialization_actions"],
              ["Tools", "Hai phía, đều là thao tác atomic — không có “giải quyết vấn đề kết nối” (sẽ biến thành test một function call)"],
              ["Rubric", "4 lớp kiểm tra + reward_basis"],
              ["Interaction protocol", "###STOP###, giới hạn lượt; user giả có thể bỏ đi khi hết kiên nhẫn"],
            ]}
          />
          <p>Task không có người đối thoại (code, phân tích dữ liệu) bỏ user simulator. Verifiers framework: SingleTurnEnv, ToolEnv, StatefulToolEnv, SandboxEnv.</p>
          <h3>Học từ các benchmark</h3>
          <ul>
            <li><b>Verifier:</b> SWE-bench Verified tách “đã sửa” (FAIL_TO_PASS) và “không làm hỏng gì” (PASS_TO_PASS); OSWorld có 134 hàm kiểm tra truy cập cả DB, DOM, cookie; Terminal-Bench bắt build kernel thật để thấy printk trong boot log.</li>
            <li><b>Độ khó phân tầng:</b> GAIA 3 level (con người 94% / 92% / 87% vs GPT-4 30% / 10% / 0%) — mỗi level chỉ ra một hướng cải tiến khác. τ²-bench có trap task (user nói “đã được duyệt hủy”).</li>
            <li><b>Chống contamination:</b> GAIA cần kết hợp nhiều nguồn + tệp đính kèm riêng; AndroidWorld sinh instance từ template tham số; Terminal-Bench nhúng canary GUID để phát hiện rò rỉ.</li>
            <li><b>Bảo trì:</b> τ-bench → τ²-bench sửa 5 chỗ; SWE-bench Verified loại 71% task gốc (93 developer review, còn 500); OSWorld lộ hơn 300 lỗi trong 15 tháng.</li>
          </ul>
          <Table
            head={["Nguồn evaluation set", "Dùng cho"]}
            rows={[
              ["Public benchmark", "Sàng model thô, học kỹ thuật thiết kế — không dùng cho quyết định sản phẩm"],
              ["Business set tự dựng", "Phân phối task thật; cơ sở chọn model và thiết kế Harness (τ²-bench làm khung, thay data và tool của bạn)"],
              ["Production trajectory feedback", "Người dùng sửa, thumbs-down, kiểm tra sau phát hiện lỗi → failure attribution → regression case. Đắt nhất, chính xác nhất"],
            ]}
          />
        </>
      ),
    },
    {
      id: "judge",
      title: "LLM-as-a-Judge và Rubric",
      body: (
        <>
          <p>Deterministic verification rẻ, tái lập, nhưng chỉ nói đúng/sai — không nói sai ở đâu, và nhiều phán đoán không viết được thành assertion. Hai công cụ bên phải của phổ là Rubric và LLM-as-a-Judge.</p>
          <ol>
            <li><b>Expert-guided:</b> phản ánh tri thức chuyên môn, không chỉ độ trôi chảy.</li>
            <li><b>Comprehensive:</b> đúng sự thật, mạch lạc, đầy đủ, an toàn + các <b>Pitfall</b>.</li>
            <li><b>Trọng số chuẩn:</b> Essential / Important / Optional / Pitfall, hỗ trợ <b>veto</b> (bịa đặt → 0 điểm; chống keyword stuffing).</li>
            <li><b>Self-contained:</b> mỗi tiêu chí tự kiểm được — “trích ít nhất hai lý thuyết và giải thích đúng” thay cho “thể hiện hiểu biết sâu”.</li>
          </ol>
          <Code lang="yaml">{`
- name: Factual Correctness      # weight: essential
  4_Excellent: "Trả lời đúng Dr. Chen VÀ liên kết với con gái Lily"
  1_Fail: "Sai tên bác sĩ hoặc trả lời 'không biết'"
- name: Hallucination Detection  # weight: veto
  fail: "Bịa thông tin không có trong hội thoại (ngày khám, chẩn đoán)"
edge_cases:
  - "Nếu có nhiều con gái khám các bác sĩ khác nhau → phải hỏi lại"`}</Code>
          <Callout kind="warn" title="Thiên lệch của giám khảo">
            <b>Length bias:</b> chấm cao câu dài hơn — phạt dài dòng trong Rubric, cân độ dài khi so cặp, theo dõi tương quan điểm–độ dài.
            <b> Same-family problem / Goodhart’s Law:</b> Agent và giám khảo cùng họ model thì Agent học khai thác điểm mù của giám khảo →
            multi-source judging (Agent chạy Claude thì chấm bằng GPT và Gemini). <b>Position bias</b> khi so cặp → chấm hai lần có hoán vị.
          </Callout>
          <p className="small">
            Thí nghiệm 7-4 (60 câu hỏi bộ nhớ): Advanced JSON Cards 68,3%, RAG 48,3% (chỉ 15% ở câu liên kết ẩn xuyên phiên), Hybrid 66,7% —
            <b> hybrid không mặc nhiên thắng</b>. Veto bịa đặt kích hoạt 28/180 lần. Multimodal judge cho TTS/ASR/UI/video; chọn audio tham chiếu
            là một phần thiết kế đánh giá, không trung lập.
          </p>
        </>
      ),
    },
    {
      id: "attribution",
      title: "Failure attribution và regression task",
      body: (
        <>
          <p>
            Với mỗi trajectory thất bại: ghi loại lỗi chính, <b>bước đầu tiên</b> xuất hiện hành vi không chấp nhận được, tool call/output liên
            quan, bằng chứng kiểm toán được. Lỗi sau thường là phản ứng dây chuyền. LLM giúp được nhưng không thay được việc người xem kỹ — vì
            attribution hay lộ ra vấn đề sản phẩm. Bản ghi phải có cấu trúc (JSON/YAML), tách nguyên nhân khỏi hậu quả, có độ tin cậy; lưu kèm
            task, trạng thái môi trường, phiên bản Agent và toolset. <b>Rule trước, LLM sau</b>.
          </p>
          <Callout title="“Right actions, wrong report” và kênh quan sát bị thiếu">
            AndroidWorld: Agent nhập 4 khoản chi tiêu bịa từ <code>expenses.jpg</code> qua 32 bước không lỗi nào. Bước 8 nó đã viết “tôi không
            thấy nội dung ảnh”. Nguyên nhân gốc không phải “model không OCR được” mà là T3A chỉ nhận element tree, <b>không có kênh hình ảnh</b> và
            không có lối ra hợp lệ “không có thông tin”. Xếp sai thành lỗi năng lực model thì bước tiếp theo sẽ là đổi model — sửa sai chỗ.
          </Callout>
          <ul>
            <li><b>Scope-sensitive errors:</b> “sửa dấu ngoặc kép” không phải thay toàn cục — phân biệt văn xuôi tiếng Trung, trích dẫn tiếng Anh, inline code, code block, JSON.</li>
            <li><b>Exact-copy errors:</b> old_string fail — so byte, code point, token ID dọc chuỗi tệp → tool return → serialization → context → output → parsing để tìm chỗ lệch đầu tiên trước khi đổ lỗi cho model.</li>
          </ul>
          <Table
            head={["Regression task", "Cách làm", "Khi nào"]}
            rows={[
              ["End-to-end", "Chạy từ trạng thái đầu + yêu cầu, kiểm trạng thái cuối, output, an toàn", "Đảm bảo năng lực từng miền không thụt lùi (OSWorld, AndroidWorld, τ-bench)"],
              ["Trajectory-prefix", "Đóng băng context ngay trước lỗi đầu, chỉ kiểm 1–vài hành động kế tiếp; đáp án là TẬP hành động chấp nhận được + hành động cấm", "Rẻ, cô lập một ranh giới quyết định — thường quan trọng hơn với Agent cần độ tin cậy cao"],
            ]}
          />
        </>
      ),
    },
    {
      id: "selection",
      title: "Model selection, chi phí và thống kê",
      body: (
        <>
          <ul>
            <li><b>Prefill → TTFT</b> (độ nhạy), <b>decode → tốc độ sinh</b> (50 token/s × 2.000 thinking token = 40 giây). Dùng p95 tail latency thay trung bình.</li>
            <li><b>Chi phí theo task</b>, không theo giá token: model rẻ mà hay fail phải retry có thể đắt hơn.</li>
            <li><b>Budget–capability curve:</b> RE-Bench — với 2 giờ, Agent tốt nhất gấp ~4 lần chuyên gia; 8 giờ người nhỉnh hơn; 32 giờ người gấp ~2. Dẫn đầu ở ngân sách ngắn không ngoại suy được sang việc dài.</li>
            <li><b>Model behavior:</b> “ngưỡng hành động” — đọc nhiều rồi mới sửa hay sửa sớm rồi dựa test — là chính sách hành vi học được từ post-training.</li>
          </ul>
          <Table
            head={["8 lượt workflow hoàn tiền", "Input token", "Cached", "Chi phí", "Tiết kiệm"]}
            rows={[
              ["Không cache, không nén", "20.700", "0", "$0,003776", "—"],
              ["Chỉ stable prefix", "20.386", "13.568", "$0,002707", "28,3%"],
              ["Chỉ nén lịch sử", "16.177", "0", "$0,003115", "17,5%"],
              ["Cả hai", "16.035", "6.144", "$0,002643", <b>30,0% (không phải 45,8%)</b>],
            ]}
          />
          <p className="small muted">Lợi ích không cộng dồn: nén lịch sử làm ngắn phần prefix dùng lại được cache. Luôn đo cả workflow khi kết hợp tối ưu.</p>
          <Code lang="python">{`
for task in paired_tasks:          # cùng task, cùng seed cho cả hai cấu hình
    for seed in fixed_seeds:
        record_paired_delta(verifier(run(A, task, seed)), verifier(run(B, task, seed)))
return paired_bootstrap_or_mcnemar(all_deltas)`}</Code>
          <p>100 case, 70% → khoảng tin cậy 95% là ±9 điểm phần trăm; “73% vs 70%” chưa đủ để đổi model. Nhiều giả thuyết song song thì siết ngưỡng hoặc chạy lại độc lập.</p>
        </>
      ),
    },
    {
      id: "loop",
      title: "Observability và từ báo cáo đến cải tiến",
      body: (
        <>
          <p>
            Trace = một task; span = mỗi LLM call, tool call, retrieval (input/output, thời gian, token, lỗi) → cây thực thi. Chuẩn OpenTelemetry +
            OpenInference; nền tảng LangSmith, Langfuse, Arize Phoenix. Giá trị lớn nhất: biến trace production thành tài sản đánh giá — lấy case
            lỗi → ẩn danh → test case và regression test.
          </p>
          <Callout kind="warn" title="Điểm tụt: kiểm tra hệ đánh giá trước">
            Môi trường hết tài nguyên kill process (lỗi ngẫu nhiên), verifier có bug, test case lệch khỏi production — trên con số tổng, tất cả trông
            y như model thụt lùi.
          </Callout>
          <Table
            head={["AndroidWorld Wi-Fi slice", "Chỉ đổi", "Success", "Token", "Bước tiếp"]}
            rows={[
              ["H1", "Thêm hướng dẫn điều hướng", "25% → 25%", "0,47×", "Prompt không phải nút thắt"],
              ["H5", "Accessibility feed → UIAutomator tree", "25% → 100%", "2,498×", "Đúng cơ chế nhưng quá đắt"],
              ["H5C", "Nén cây UIAutomator (bỏ node rỗng)", "100% → 100%", "0,506×", "Đủ điều kiện chạy lại toàn bộ 116 task × 5 seed"],
            ]}
          />
          <p>
            Hướng dẫn chi tiết hơn không bù được thông tin Agent không hề nhận — điều tra lỗi quan sát trước khi viết thêm prompt. Bằng chứng của
            một vòng chỉ cho phép hành động tiếp theo trong phạm vi của nó: 4/4 trên slice không được báo cáo là 100% toàn hệ thống.
          </p>
          <h3>Đánh giá nội bộ trong sản phẩm</h3>
          <ul>
            <li><b>Ablation infrastructure:</b> mỗi tính năng lớn tắt độc lập được; chạy định kỳ để phát hiện “feature debt”.</li>
            <li><b>A/B testing:</b> nhiều biến thể (dose-response), tách mechanism metric (độ dài plan) khỏi target metric (chi phí phiên), guardrail metric không được thụt lùi.</li>
            <li><b>Feature flag hai lớp:</b> compile-time (xóa hẳn code) và runtime (cấu hình từ server, ghi exposure một lần mỗi phiên).</li>
            <li><b>Prompt sensitivity:</b> system prompt render tất định, có snapshot theo phiên bản, mọi thay đổi chạy regression như CI.</li>
            <li><b>Privacy-aware analytics</b> ép bằng type system.</li>
          </ul>
          <p>
            <b>Simulation environment</b> là cầu sang post-training: Rubric/verifier chính là reward function cho RLVR; nhưng training cần reset
            tất định qua hàng triệu episode và throughput cao (AWorld 7.695s → 525s; RoboTwin2; domain randomization).
          </p>
        </>
      ),
    },
  ],
  pitfalls: [
    { wrong: "Đánh giá model một mình rồi kết luận.", right: "Đánh giá model + Harness; dùng model swap để biết nút thắt ở đâu." },
    { wrong: "Báo cáo Pass@k cho nghiệp vụ hoàn tiền.", right: "Nghiệp vụ cần Pass^k; nói rõ k lần là gì, side effect thì lấy mẫu trong sandbox." },
    { wrong: "Tin lời Agent “đã hoàn thành” hoặc chỉ kiểm test mục tiêu.", right: "Verifier kiểm sự thật độc lập: FAIL_TO_PASS + PASS_TO_PASS, trạng thái thật trong DB/DOM." },
    { wrong: "Dùng LLM judge cho mọi thứ, cùng họ model với Agent.", right: "Giữ assertion cho phần kiểm được bằng code; giám khảo đa nguồn khác họ; Rubric có veto." },
    { wrong: "Đổi model vì 73% > 70% trên 100 task.", right: "Paired analysis trên cùng task, nhiều seed; hành động khi vượt nhiễu và tái lập được." },
    { wrong: "Điểm tụt thì sửa Agent ngay.", right: "Kiểm hệ đánh giá trước: tài nguyên, bug verifier, test lệch production." },
    { wrong: "Cộng các mức tiết kiệm đo riêng lẻ.", right: "Lợi ích không cộng dồn — đo cả workflow với mọi tổ hợp công tắc." },
  ],
  demos: [
    { id: "passk", title: "Pass@k vs Pass^k", component: PassKCalc, desc: "Kéo p và k để thấy “kỳ tích kỹ thuật” khác “độ tin cậy nghiệp vụ” thế nào." },
    { id: "signif", title: "Chênh lệch này có thật không?", component: SignificanceCalc, desc: "So hai model với số task khác nhau — khi nào khoảng tin cậy hết chồng lên nhau?" },
    { id: "elo", title: "Elo từ so sánh từng cặp", component: EloCalc, desc: "Thắng đúng kỳ vọng thì cộng ít, thắng bất ngờ thì cộng nhiều." },
    { id: "spectrum", title: "Kiểm chứng bằng cách nào?", component: SpectrumDemo, desc: "Xếp mỗi nhiệm vụ vào phổ verification từ tất định đến so cặp." },
    { id: "attribution", title: "Failure attribution", component: AttributionDemo, desc: "Lỗi đầu tiên thuộc loại nào?" },
  ],
  lab: {
    intro: (<><LabSetup /><p>Bài lab chương này không cần model: các công cụ thống kê bạn sẽ dùng mỗi khi so sánh hai cấu hình Agent.</p></>),
    steps: [
      {
        id: "eval_toolkit", title: "Bộ công cụ thống kê đánh giá", file: "ch07/eval_toolkit.py", code: toolkitPy,
        run: ["python3 ch07/eval_toolkit.py"],
        observe: (
          <ul>
            <li>Pass^k tụt nhanh thế nào khi k tăng? Với nghiệp vụ của bạn, k nên là bao nhiêu?</li>
            <li>Vì sao McNemar chỉ dùng các task mà hai cấu hình cho kết quả KHÁC nhau?</li>
            <li>Sửa giám khảo trong phần Elo cho thiên lệch vị trí mạnh hơn: hoán vị có giữ được thứ tự X &gt; Y &gt; Z không?</li>
          </ul>
        ),
        result: <p className="small">Pass^5 (p = 0,6) = 7,8%; B 76% vs A 72,5% trên cùng 200 task: McNemar p ≈ 0,02, bootstrap CI [+1%, +6%] → khác biệt thật; Elo khôi phục đúng thứ tự X &gt; Y &gt; Z.</p>,
      },
    ],
  },
  apply: [
    {
      title: "Dựng evaluation set đầu tiên cho Agent của bạn",
      prompt: <p>Viết 10 task theo 5 thành phần: dataset (ticket), environment state + cách reset, tools atomic, rubric (lớp nào tính điểm), interaction protocol. Có user giả không? known_info của họ là gì?</p>,
      hint: <p>Dùng τ²-bench làm khung. Thêm ít nhất một trap task (người dùng gây áp lực) và một task cần hỏi lại.</p>,
    },
    {
      title: "Viết Rubric có veto",
      prompt: <p>Chọn một đầu ra mở của Agent bạn (email trả lời khách, báo cáo). Viết Rubric 3–5 chiều theo 4 nguyên tắc, mức 1–4 cụ thể, một chiều veto, 2 edge case.</p>,
      hint: <p>Mỗi mức phải tự kiểm được: “nêu số tiền hoàn và thời gian về tài khoản” chứ không phải “trả lời đầy đủ”.</p>,
    },
    {
      title: "Taxonomy failure attribution",
      prompt: <p>Lấy 5 lần Agent của bạn làm sai gần đây. Mỗi lần: bước lỗi đầu tiên, loại lỗi, nguyên nhân hay hậu quả, rồi viết thành một trajectory-prefix regression task với tập hành động chấp nhận được và hành động cấm.</p>,
      hint: <p>Hỏi: lỗi này do thiếu kênh quan sát, thiếu lối ra hợp lệ, hay thật sự do năng lực model?</p>,
    },
  ],
  glossary: [
    { en: "Model swap experiment", vi: "Thí nghiệm đổi model", note: "Giữ Harness, đổi model để biết nút thắt." },
    { en: "Pass@k / Best@k", vi: "Đúng ít nhất 1 trong k", note: "Trần năng lực." },
    { en: "Pass^k", vi: "Đúng cả k lần liên tiếp", note: "Độ tin cậy nghiệp vụ, = p^k nếu độc lập." },
    { en: "User simulator", vi: "Người dùng giả lập", note: "LLM đóng vai user theo known_info và behavioral spec." },
    { en: "Dual-control environment", vi: "Môi trường hai bên điều khiển", note: "Cả user và Agent đều đổi được trạng thái." },
    { en: "FAIL_TO_PASS / PASS_TO_PASS", vi: "Kiểm sửa được / không làm hỏng", note: "Hai mệnh đề của SWE-bench Verified." },
    { en: "Data contamination", vi: "Rò rỉ dữ liệu đánh giá", note: "Benchmark lọt vào dữ liệu huấn luyện; canary GUID để phát hiện." },
    { en: "LLM-as-a-Judge", vi: "LLM làm giám khảo", note: "Chấm theo Rubric khi không có đáp án tất định." },
    { en: "Rubric", vi: "Bảng tiêu chí chấm", note: "Nhiều chiều, có trọng số, veto." },
    { en: "Goodhart's Law", vi: "Định luật Goodhart", note: "Chỉ số thành mục tiêu thì hết là chỉ số tốt." },
    { en: "Position / length bias", vi: "Thiên lệch vị trí / độ dài", note: "Giám khảo ưu ái vị trí đầu / câu dài." },
    { en: "Failure attribution", vi: "Quy trách nhiệm lỗi", note: "Tìm lỗi đầu tiên, tách nguyên nhân khỏi hậu quả." },
    { en: "Trajectory-prefix regression", vi: "Hồi quy theo tiền tố quỹ đạo", note: "Đóng băng context trước lỗi, kiểm hành động tiếp theo." },
    { en: "Elo / Bradley-Terry", vi: "Xếp hạng từ so cặp", note: "Điểm sức mạnh ẩn từ kết quả đối đầu." },
    { en: "McNemar / paired bootstrap", vi: "Kiểm định cặp", note: "So hai cấu hình trên cùng bộ task." },
    { en: "Observability (trace, span)", vi: "Khả năng quan sát", note: "Cây thực thi từ log, metric, trace." },
    { en: "Feature flag", vi: "Công tắc tính năng", note: "Bật/tắt từ xa để thí nghiệm, rollout, ngắt khẩn." },
  ],
  quiz: [
    { q: "Thay model mạnh hơn mà điểm không tăng. Kết luận hợp lý nhất?", options: ["Model mới tệ", "Nút thắt nằm ở Harness", "Cần nhiều task hơn", "Benchmark sai"], answer: 1, explain: "Model swap experiment: giữ Harness, model mạnh hơn không giúp → Harness là nút thắt." },
    { q: "p = 60%, k = 5. Pass^5 xấp xỉ?", options: ["99%", "60%", "7,8%", "40%"], answer: 2, explain: "0,6^5 ≈ 7,8%, trong khi Pass@5 ≈ 99%." },
    { q: "Vì sao user simulator của τ²-bench cần ràng buộc grounding?", options: ["Để nhanh hơn", "Để không xuôi theo Agent và xác nhận vấn đề đã được sửa khi chưa", "Để tiết kiệm token", "Để có cảm xúc"], answer: 1, explain: "Thiếu grounding, đánh giá thành hai model gật gù với nhau." },
    { q: "SWE-bench Verified kiểm cả FAIL_TO_PASS và PASS_TO_PASS để làm gì?", options: ["Tăng số test", "Chứng minh vừa sửa được vấn đề vừa không làm hỏng gì", "Đo tốc độ", "Chống contamination"], answer: 1, explain: "Chỉ kiểm cái đầu thì Agent có thể xóa assertion để lách." },
    { q: "Nguồn evaluation set nào đắt nhất nhưng chính xác nhất?", options: ["Public benchmark", "Business set tự viết", "Production trajectory feedback", "Dữ liệu tổng hợp"], answer: 2, explain: "Đến thẳng từ những gì người dùng thật gặp phải." },
    { q: "Rubric có chiều veto “hallucination”. Câu trả lời đúng mọi chiều khác nhưng bịa một ngày khám thì…", options: ["Trừ một ít điểm", "Tổng điểm = 0", "Bỏ qua", "Cần người chấm"], answer: 1, explain: "Veto đặt đáy; cũng chống keyword stuffing." },
    { q: "Agent và giám khảo cùng họ model gây rủi ro gì?", options: ["Chậm hơn", "Agent học khai thác điểm mù của giám khảo (Goodhart)", "Đắt hơn", "Không rủi ro"], answer: 1, explain: "Dùng giám khảo đa nguồn khác họ." },
    { q: "edit_file fail, Agent retry y hệt 3 lần rồi bỏ cuộc. Nguyên nhân gốc là?", options: ["Ba lần retry", "Lần edit đầu tiên lỗi", "Model mệt", "Thiếu token"], answer: 1, explain: "Retry là hậu quả; ghi lỗi đầu tiên." },
    { q: "Đáp án của trajectory-prefix regression task nên là…", options: ["Một hành động chuẩn duy nhất", "Tập hành động chấp nhận được + hành động cấm", "Văn bản tham chiếu", "Điểm số"], answer: 1, explain: "Ví dụ “hỏi lại người dùng trước” hoặc “từ chối thao tác nguy hiểm” đều có thể chấp nhận." },
    { q: "Stable prefix tiết kiệm 28,3%, nén tiết kiệm 17,5%. Kết hợp thì?", options: ["45,8%", "Đúng 30% như đo được — không cộng dồn", "17,5%", "Không đổi"], answer: 1, explain: "Nén làm ngắn phần prefix dùng lại cache." },
    { q: "AndroidWorld: thêm hướng dẫn điều hướng (H1) không cải thiện, đổi cây UI (H5) lên 100%. Bài học?", options: ["Prompt luôn vô dụng", "Hướng dẫn không bù được thông tin Agent không hề nhận — điều tra quan sát trước", "Cần model lớn hơn", "Tăng số bước"], answer: 1, explain: "Rồi H5C nén cây để giữ thành công và giảm nửa token." },
  ],
  cards: [
    { front: "4 khâu của hệ đánh giá?", back: "Thành công là gì → task từ đâu → kiểm chứng thế nào → điểm thành quyết định." },
    { front: "Model swap vs ablation?", back: "Đổi model giữ Harness (nút thắt ở đâu) vs tắt thành phần Harness (thành phần nào quan trọng)." },
    { front: "Pass@k vs Pass^k?", back: "1−(1−p)^k: trần năng lực · p^k: độ tin cậy nghiệp vụ." },
    { front: "5 thành phần evaluation environment?", back: "Dataset · environment state (reset được) · tools atomic · rubric · interaction protocol." },
    { front: "3 nguồn evaluation set?", back: "Public benchmark · business set tự dựng · production trajectory feedback." },
    { front: "Phổ verification?", back: "Deterministic → checklist → Rubric + LLM → pairwise." },
    { front: "4 nguyên tắc Rubric?", back: "Expert-guided · comprehensive (có pitfall) · trọng số chuẩn + veto · self-contained." },
    { front: "3 thiên lệch của LLM judge?", back: "Length bias · same-family/Goodhart · position bias." },
    { front: "Failure attribution ghi gì?", back: "Loại lỗi, bước lỗi đầu tiên, tool call/output liên quan, bằng chứng; tách nguyên nhân khỏi hậu quả; rule trước LLM sau." },
    { front: "End-to-end vs trajectory-prefix regression?", back: "Chạy cả nhiệm vụ kiểm trạng thái cuối vs đóng băng trước lỗi, kiểm tập hành động chấp nhận được." },
    { front: "SE của success rate?", back: "≈ √(p(1−p)/n); 100 task, 70% → ±9 điểm %." },
    { front: "Khi điểm tụt, kiểm gì trước?", back: "Hệ đánh giá: tài nguyên môi trường, bug verifier, test lệch production." },
    { front: "5 thành phần đánh giá nội bộ?", back: "Ablation infra · A/B testing · feature flag hai lớp · prompt sensitivity · privacy-aware analytics." },
    { front: "Mechanism metric vs target metric?", back: "Cái bạn trực tiếp thay đổi (độ dài plan) vs cái bạn thật sự quan tâm (chi phí phiên)." },
  ],
};
