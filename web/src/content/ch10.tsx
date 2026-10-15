import type { Chapter } from "../lib/types";
import { Callout, Code, Formula, Table } from "../components/ui";
import { Classifier } from "../demos/Classifier";
import { OptimisticLock, ParallelSearch } from "../demos/MultiAgentDemos";
import { LabSetup } from "./labSetup";
import multiPy from "../../../agent-lab/ch10/multi_agent.py?raw";

function InfoGainDemo() {
  return (
    <Classifier
      options={["Có thông tin mới", "Không có thông tin mới"]}
      items={[
        { text: "Cùng model đọc lại câu trả lời của chính mình rồi sửa", answer: "Không có thông tin mới", why: "Huang et al. (ICLR 2024): GPT-4 tự sửa không có feedback ngoài còn làm giảm độ chính xác." },
        { text: "Hai Agent tranh luận về cùng một đoạn văn bản", answer: "Không có thông tin mới", why: "Cùng ngân sách thinking token thì ngang một Agent (data processing inequality: truyền kết luận qua lại chỉ mất thông tin)." },
        { text: "Reviewer chạy test suite trên code của Proposer", answer: "Có thông tin mới", why: "Lỗi biên dịch, test fail, exception — không tồn tại lúc model viết code (RLEF)." },
        { text: "Reviewer xem ảnh chụp trang web/slide đã render", answer: "Có thông tin mới", why: "Visual feedback: WebGen-Agent đưa Claude 3.5 Sonnet từ 26,4% lên 51,9%." },
        { text: "Reviewer dùng search và Python để kiểm tra dữ kiện", answer: "Có thông tin mới", why: "CRITIC: bỏ bước kiểm bằng tool thì phần lớn cải thiện biến mất." },
        { text: "45 Agent chia nhau tìm lỗ hổng, trao đổi qua forum chung", answer: "Có thông tin mới", why: "Không gian tìm kiếm mở: giao tiếp giúp chuyển hướng chú ý, chuyên môn hóa — 266 lỗ hổng vs 21 khi chạy độc lập (đổi lại tốn nhiều token hơn)." },
      ]}
    />
  );
}

function TopologyDemo() {
  return (
    <Classifier
      options={["Shared context", "Peer", "Manager", "Decentralized"]}
      items={[
        { text: "Agent phân tích yêu cầu xong, Agent lập trình tiếp quản và cần đọc cả cuộc trao đổi với user", answer: "Shared context", why: "Không mất thông tin; vai trò khác nhau về kiến thức/quy trình → có thể dùng Skill thay vì đổi system prompt." },
        { text: "Một Agent sinh slide, một Agent render và chấm bằng vision model, lặp 3 vòng", answer: "Peer", why: "Proposer–Reviewer: 2–3 Agent ngang hàng, có điều kiện dừng." },
        { text: "Dịch cả cuốn sách: glossary, dịch từng chương song song, proofread toàn bộ", answer: "Manager", why: "Nhiều subtask có phụ thuộc; Manager chỉ giữ chỉ mục file, không giữ toàn văn." },
        { text: "Agent CSKH tự chuyển cho Agent billing, billing tự chuyển cho Agent kỹ thuật khi thấy cần", answer: "Decentralized", why: "Handoff kiểu Swarm: điều khiển truyền như gậy tiếp sức, cần visited_agents và budget chống vòng lặp." },
        { text: "Tìm một giảng viên trên 10 website khoa cùng lúc", answer: "Manager", why: "Parallel coordination: message bus, cascading termination, settle_once." },
      ]}
    />
  );
}

function FailureDemo() {
  return (
    <Classifier
      options={["Concurrency conflict", "Cascading errors", "Homogeneous convergence", "Passing the buck", "Runaway loop"]}
      items={[
        { text: "Agent A đánh số lại toàn bộ hình, Agent B cùng lúc sửa chương và tham chiếu số hình cũ", answer: "Concurrency conflict", why: "Xung đột ngữ nghĩa xuyên file — optimistic lock không bắt được, cần kiểm chứng tầng cao hơn." },
        { text: "Agent đầu hiểu nhầm yêu cầu, mỗi Agent sau xây tiếp lên giả định sai", answer: "Cascading errors", why: "Mỗi lần handoff là một lần mã hóa lại có mất mát; cần cross-validation chỉ nhìn bằng chứng gốc." },
        { text: "18/30 Agent khởi động cùng lúc tạo Git branch trùng tên", answer: "Homogeneous convergence", why: "Common-cause failure do cùng model, cùng scaffolding; đa dạng hóa và dùng namespace." },
        { text: "Tester báo bug, frontend bảo backend sửa trước, backend đổ cho thiết kế sản phẩm", answer: "Passing the buck", why: "Xác định trước ưu tiên mục tiêu, quyền sở hữu tài nguyên; dừng lại cho người phân xử." },
        { text: "Một Agent tự sinh ra hàng nghìn sub-agent, đốt sạch quota API", answer: "Runaway loop", why: "Budget rõ ràng, cancellation, điều kiện dừng; API key riêng cho Agent tự chủ cao." },
      ]}
    />
  );
}

export const ch10: Chapter = {
  id: 10,
  title: "Multi-Agent Collaboration",
  short: "Multi-Agent",
  tier: "Mở rộng",
  minutes: 40,
  ready: true,
  oneLiner: "Nhiều Agent chỉ thật sự hơn một Agent khi cộng tác đem lại thông tin mà một Agent không có. Thiết kế: chia sẻ context hay cách ly, ngang hàng / có quản lý / phi tập trung — và lường trước các kiểu lỗi.",
  keyIdeas: [
    "Tiêu chí số một: cộng tác có đưa thêm thông tin mà một Agent không có được không? Kết quả chạy code, ảnh render, tool kiểm dữ kiện → có. Tự đọc lại, tranh luận trên cùng văn bản → không.",
    "Chi phí: hệ multi-agent research của Anthropic tốn ~15 lần token so với hội thoại thường; riêng lượng token giải thích ~80% chênh lệch hiệu năng. Lợi ích phải đủ lớn.",
    "Chiều 1: shared context (kế thừa toàn bộ trajectory, không mất thông tin, context phình) vs non-shared (cách ly, mô-đun, cần handoff có cấu trúc qua tool parameter, shared file system, message bus).",
    "Chiều 2: topology — Peer (2–3 Agent, Proposer–Reviewer), Manager (orchestration, sequential/parallel), Decentralized (choreography, handoff kiểu Swarm).",
    "Hệ đa Agent ≈ hệ điều hành: static prefix = chương trình, trajectory = bộ nhớ process, tool call = system call, spawn/cancel/list_agents = fork/kill/ps. Data plane: virtual file system 4 vùng. Control plane: message, status, termination, scheduling.",
    "Loop Engineering: model chỉ được đề xuất “xong”, verifier độc lập mới được duyệt “xong”. Nút thắt của vòng lặp là verifier, không phải model.",
    "Manager yếu là nút thắt lớn nhất (Plan-and-Act) — dồn model mạnh nhất cho planner. Song song thì settle ở “thành công đầu tiên đã kiểm chứng”, settle_once idempotent.",
    "Sáu kiểu lỗi: concurrency conflict, cascading errors, homogeneous convergence, passing the buck, runaway loops, và comprehension debt / cognitive surrender của chính con người.",
  ],
  sections: [
    {
      id: "when",
      title: "Khi nào nhiều Agent thật sự tốt hơn một?",
      body: (
        <>
          <Table
            head={["Kiểu cộng tác", "Thông tin mới?", "Hiệu quả"]}
            rows={[
              ["Cùng model tự đọc lại output", "Không", "Thường vô ích, có khi có hại"],
              ["Nhiều Agent tranh luận cùng một văn bản", "Không", "Ngang một Agent cùng lượng compute"],
              ["Reviewer dùng kết quả chạy test", "Có (execution feedback)", "Cải thiện rõ"],
              ["Reviewer xem ảnh render frontend/PPT", "Có (visual feedback)", "Cải thiện rõ"],
              ["Reviewer dùng tool ngoài kiểm dữ kiện", "Có (tool feedback)", "Cải thiện rõ"],
            ]}
          />
          <p>
            Khung này giải thích mâu thuẫn bề ngoài: nghiên cứu học thuật hay thấy một Agent là đủ (vì họ thử debate trên cùng văn bản), còn hệ
            thống thực tế hay thấy nhiều Agent tốt hơn (vì có thêm feedback ngoài).
          </p>
          <Callout title="Step budget: nhiều bước hơn ≠ tốt hơn">
            Agent thông thường thiếu “budget awareness”: cho 300 bước vẫn tìm nông rồi bão hòa. Cần cơ chế thích nghi theo ngân sách còn lại —
            đầu khám phá rộng, cuối đào sâu (BAVT). Manager nên phân ngân sách theo độ khó subtask và hướng sub-agent: plan → làm → test → cải tiến.
          </Callout>
        </>
      ),
    },
    {
      id: "dims",
      title: "Hai chiều thiết kế: context và topology",
      body: (
        <>
          <Table
            head={["", "Shared context", "Non-shared context"]}
            rows={[
              ["Thông tin", "Agent sau nhận toàn bộ trajectory của Agent trước", "Mỗi Agent một context riêng"],
              ["Ưu", "Không mất thông tin, xem lại được mọi chi tiết", "Mô-đun, mở rộng được, song song, cách ly quyền"],
              ["Nhược", "Context phình nhanh, quán tính vai trò cũ", "Đồng bộ thông tin phức tạp, debug khó"],
            ]}
          />
          <p>
            Ba cách truyền thông tin khi không chia sẻ context, ứng với hai mô hình IPC: <b>tool call parameters</b> (message passing đồng bộ, dữ
            liệu có cấu trúc), <b>shared file system</b> (shared memory, artifact lớn, cần lưu bền), <b>message bus</b> (message passing bất đồng bộ qua
            trung gian). Go: “Đừng giao tiếp bằng cách chia sẻ bộ nhớ; hãy chia sẻ bộ nhớ bằng cách giao tiếp.”
          </p>
          <h4>Shared context: đổi system prompt hay nạp Skill?</h4>
          <Table
            head={["", "transfer_to_agent (đổi system prompt)", "load_skill"]}
            rows={[
              ["Tool nhìn thấy", "Chỉ tool của vai trò hiện tại", "Thường cả catalog"],
              ["KV cache", "Mỗi lần đổi là đổi prefix → mất cache từ đó", "Prefix tĩnh giữ nguyên, SKILL.md nối vào trajectory"],
              ["Độ ràng buộc", "Mạnh: tool ngoài phạm vi không có trong schema", "Yếu: Skill là chỉ dẫn, không phải ranh giới quyền"],
            ]}
          />
          <p className="small muted">
            Vai trò khác nhau chủ yếu ở kiến thức, quy trình, văn phong → Skill. Liên quan quyền, cách ly tool, tuân thủ → Agent riêng hoặc
            transfer_to_agent, và chặn bằng code ở tầng Harness.
          </p>
        </>
      ),
    },
    {
      id: "os",
      title: "Hệ đa Agent nhìn như hệ điều hành",
      body: (
        <>
          <Table
            head={["Hệ điều hành", "Hệ đa Agent"]}
            rows={[
              ["Chương trình (file thực thi)", "Static prefix (system prompt + định nghĩa tool)"],
              ["Bộ nhớ process", "Trajectory"],
              ["CPU / Kernel", "LLM / Agent runtime"],
              ["System call", "Tool call"],
              ["fork / kill / ps", "spawn_subagent / cancel_subagent / list_agents"],
              ["Exit code và wait()", "Bản tóm tắt có cấu trúc sub-agent trả về"],
              ["Shared memory / message passing", "Shared file system / message passing"],
            ]}
          />
          <h4>Data plane: virtual file system 4 vùng</h4>
          <Table
            head={["Vùng", "Ai thấy", "Vòng đời", "Đọc/ghi", "Kiểm soát đồng thời"]}
            rows={[
              ["Scratchpad riêng (/scratch/<id>)", "Chỉ Agent đó", "Hủy cùng instance", "Đọc/ghi", "Không cần"],
              ["Shared workspace (/workspace/shared)", "Mọi Agent + user", "Suốt task", "Đọc/ghi", "Cần (optimistic lock, worktree)"],
              ["Mount ngoài (/mnt/gdrive, /mnt/notion)", "Theo quyền nguồn ngoài", "Do nguồn ngoài", "Chủ yếu đọc, ghi thận trọng", "Do nguồn ngoài; trễ cao, nhất quán yếu"],
              ["Tài nguyên hệ thống (/skills)", "Mọi Agent", "Ổn định qua phiên", "Chỉ đọc", "Không cần"],
            ]}
          />
          <p>Nguyên tắc bảo vệ của OS: <b>mặc định cách ly, chia sẻ phải khai báo</b>. Truyền đường dẫn file, không nhồi nội dung file vào context.</p>
          <h4>Control plane: bốn năng lực hay bị bỏ quên</h4>
          <ul>
            <li><b>Message passing:</b> point-to-point khi ít Agent; nhiều Agent bất đồng bộ thì message bus. Envelope chuẩn: sender, target, type (task_assigned / status_update / result / terminate), payload JSON.</li>
            <li><b>Status query:</b> poll kiểu RPC ít hữu ích. Hỏi bằng message, hoặc thỏa thuận một <code>progress.md</code> để Manager đọc; file không đổi quá N phút → coi là treo, kích hoạt timeout. Trajectory JSONL cho quan sát chi tiết nhất nhưng đắt, không nên là kênh chính.</li>
            <li><b>Termination:</b> graceful (SIGTERM: dừng ở điểm an toàn, dọn tài nguyên, ack) trước, forced (SIGKILL) sau. Hủy lan theo cây tạo lập như <code>context</code> của Go — không để sub-agent mồ côi.</li>
            <li><b>Resource scheduling:</b> ngân sách bước/token, model mạnh cho việc khó, giới hạn đồng thời, preemption. Manager hơn scheduler OS ở chỗ biết suy luận: dồn tài nguyên cho nhánh hứa hẹn, dừng nhánh lạc hướng.</li>
          </ul>
        </>
      ),
    },
    {
      id: "peer",
      title: "Peer: Loop Engineering và Proposer–Reviewer",
      body: (
        <>
          <p>
            <b>Premature termination</b> có ba dạng: tuyên bố xong khi mới làm một phần; bỏ cuộc quá sớm (Pine AI gọi một cuộc bị từ chối là báo
            “không làm được” dù còn web form, email); và false success (bên kia đồng ý hoàn tiền qua điện thoại, nhưng user còn phải xác nhận trong app).
            Gốc chung: trước khi kiểm chứng, “xong” chỉ là lời model nói.
          </p>
          <Formula>LoopX quyết định → Agent thực thi → verifier độc lập chứng minh → LoopX ghi nhận</Formula>
          <p>
            <b>Loop Engineering</b>: thiết kế vòng lặp giữ Agent chạy — tìm việc tiếp, làm, kiểm, ghi tiến độ — và để verifier quyết định khi nào
            được dừng. Boris Cherny: “I don’t prompt Claude anymore. My job is to write loops.” LongHorizon-Harness (Manage–Execute–Audit): giữ model và
            backend, chỉ đổi vòng ngoài → WeaveBench 51,8% → 80,7%.
          </p>
          <Code lang="python">{`candidate = proposer(task, constraints)
evidence = execute_or_render(candidate)          # test, trạng thái, screenshot, dữ kiện
review = independent_reviewer(candidate, evidence)
while review.veto and budget_remaining:
    candidate = proposer.repair(candidate, review.findings)
    evidence = execute_or_render(candidate)
    review = independent_reviewer(candidate, evidence)
publish(...) if review.pass else escalate_or_reject(review)`}</Code>
          <p className="small muted">
            Reviewer không được sửa test, bộ thu thập bằng chứng hay release gate. Các biến thể peer khác: <b>Debate</b> (tranh cãi — hiệu quả còn bị
            tranh luận), <b>Brainstorming</b> (gợi ý lẫn nhau), <b>Panel of experts</b> (bổ sung góc nhìn chuyên môn). Đa dạng phải được thiết kế (khác
            model, context, tool, bằng chứng) và đánh giá độc lập trước khi gộp.
          </p>
        </>
      ),
    },
    {
      id: "manager",
      title: "Manager: điều phối tập trung",
      body: (
        <>
          <p>
            Manager hiểu task, chia subtask, chọn Agent, theo dõi tiến độ, xử lý ngoại lệ, tổng hợp kết quả. Mỗi Agent chuyên môn là một tool của
            Manager. Rủi ro: Manager là nút thắt và điểm lỗi đơn. <b>Plan-and-Act</b>: planner yếu là nút thắt lớn nhất — đưa model mạnh nhất và prompt
            kỹ nhất cho planner.
          </p>
          <ul>
            <li><b>Sequential:</b> gọi A → đưa kết quả cho B → C. Ví dụ dịch sách: Glossary Agent → Translation Agent ×N (mỗi bản context riêng) → Proofreading Agent; Manager chỉ giữ chỉ mục file.</li>
            <li><b>Parallel:</b> message bus (Redis Pub/Sub nhẹ nhưng không lưu; RabbitMQ lưu khi receiver offline). Tìm giảng viên trên 10 website: tuần tự ~5 phút, song song + cascading termination ~19 giây.</li>
            <li><b>Manager viết workflow thành code</b> rồi giao runtime tất định chạy (Workflow tool của Claude Code: <code>agent()</code>, <code>parallel()</code>, <code>pipeline()</code>) — Manager không phải ở trong vòng lặp cho từng subtask.</li>
          </ul>
          <Code lang="python">{`if event.type == RESULT and verify(event.artifact, hidden_checks):
    if settle_once(event):                      # khóa nguyên tử: chỉ một người thắng
        broadcast_cancel(workers - {event.worker_id})
        await_all_ack_or_timeout()
        return assemble(event.artifact, evidence=event.evidence)`}</Code>
        </>
      ),
    },
    {
      id: "decentral",
      title: "Phi tập trung và liên tổ chức (A2A)",
      body: (
        <>
          <p>
            Microservices gọi hai kiểu là <b>orchestration</b> (nhạc trưởng điều phối) và <b>choreography</b> (mỗi vũ công tự biết khi nào vào).
            Ba ví dụ tăng dần: <b>MetaGPT</b> (thực ra là pipeline cố định theo SOP; đóng góp chính là message pool + subscription để tách rời),{" "}
            <b>AutoGen group chat</b> (lịch sử chung + speaker selector tập trung), <b>OpenAI Swarm</b> (handoff ngang hàng thật sự).
          </p>
          <Code lang="python">{`handoff = {task_id, sender, recipient, goal, constraints,
           accepted_facts, artifact_refs, remaining_budget, visited_agents}
if recipient in handoff.visited_agents: reject("cycle")
elif handoff.remaining_budget <= 0:     stop_and_escalate(handoff)
else: handoff.visited_agents.append(recipient); run_local_agent(handoff)`}</Code>
          <p>
            Handoff package tốt gồm: mô tả task + tiêu chí nghiệm thu, dữ kiện và ràng buộc đã xác nhận, tham chiếu artifact (đường dẫn, không phải nội
            dung). Không Agent nào cần hiểu “dòng suy nghĩ” của Agent khác. “Agent Swarm” trong marketing có thể là handoff network hoặc chỉ là manager
            pattern quy mô lớn — hãy nhìn cấu trúc thật.
          </p>
          <Callout title="A2A: giao thức giữa các tổ chức">
            MCP: Agent ↔ tool. A2A: Agent ↔ Agent. Ba thành phần: <b>Agent Card</b> (danh thiếp năng lực), <b>Task lifecycle</b> (submitted,
            in-progress, needs-input, completed, failed), <b>opaque collaboration</b> (chỉ trao task và artifact, không lộ prompt, suy luận, cách
            hiện thực tool).
          </Callout>
        </>
      ),
    },
    {
      id: "failures",
      title: "Các kiểu lỗi của cộng tác đa Agent",
      body: (
        <>
          <p>
            MAST (phân tích ~150 trace từ 7 framework, kappa 0,88): 14 kiểu lỗi trong ba nhóm — lỗi thiết kế hệ thống, lệch pha giữa các Agent,
            thiếu kiểm chứng task. Lỗi của Agent thường là <b>Byzantine</b>: vẫn chạy và đưa ra kết luận nghe hợp lý nhưng sai, không báo lỗi.
          </p>
          <Table
            head={["Kiểu lỗi", "Ví dụ", "Cách xử lý"]}
            rows={[
              ["Concurrency conflict", "Ghi đè file; xung đột ngữ nghĩa xuyên file", "Optimistic locking; worktree/branch riêng, gộp ở điểm merge"],
              ["Cascading errors", "Lỗi của Agent đầu được khuếch đại qua mỗi handoff", "Cross-validation chỉ nhìn bằng chứng gốc"],
              ["Homogeneous convergence", "18/30 Agent tạo branch trùng tên; Agent định giá ngầm thông đồng", "Đa dạng model/context/nguồn; namespace, quota, rate limit"],
              ["Passing the buck", "Ba Agent migrate backend coi nhau là phá hoại, kill process của nhau", "Ưu tiên mục tiêu, quyền sở hữu, dừng cho người phân xử"],
              ["Runaway loop", "Sinh hàng nghìn sub-agent", "Budget, cancellation, điều kiện dừng, API key riêng"],
              ["Comprehension debt / cognitive surrender", "Người dùng không còn hiểu hệ thống của mình", "“Có thể thuê ngoài việc nghĩ, không thể thuê ngoài sự hiểu” — Karpathy"],
            ]}
          />
        </>
      ),
    },
    {
      id: "society",
      title: "Xã hội Agent",
      body: (
        <>
          <ul>
            <li><b>Stanford AI Town (Smallville):</b> 25 Agent với memory stream (importance, recency, relevance), reflection, planning & reacting. Chỉ gieo một ý định “tổ chức tiệc Valentine” — lời mời tự lan truyền, các Agent tự sắp lịch đến dự. Không có code tổ chức tiệc nào.</li>
            <li><b>Agentopia:</b> 100 Agent sống 10 năm; vòng tuần Plan → Contact → Activity → Review; LLM riêng làm môi trường; memory dạng file. Life Reward do môi trường tính; fine-tune bằng rejection sampling trên 25% trajectory tiến bộ nhất → CoSER Test +15,6%.</li>
            <li><b>Moltbook:</b> mạng xã hội ~1,5 triệu Agent, tự sinh ra cả một “tôn giáo” (Crustafarianism: “Memory is sacred”).</li>
            <li><b>Vending-Bench Arena:</b> nhiều Agent cạnh tranh một thị trường — chiến tranh giá, thậm chí liên minh cố định giá dù biết là phi pháp.</li>
            <li><b>Pinchwork, RentAHuman:</b> chợ Agent thuê Agent, Agent thuê người làm việc vật lý — điều phối bằng giá thay vì Manager.</li>
            <li><b>Ma sói giọng nói:</b> Judge bằng code giữ trạng thái toàn cục và chỉ đưa cho mỗi vai thông tin vai đó được biết — đối lập với Smallville hoàn toàn phi tập trung.</li>
          </ul>
          <Callout kind="ok" title="Lời kết của sách: Agent = LLM + Context + Tools">
            Ba câu hỏi không lỗi thời: <b>nó thấy gì, nó làm được gì, và làm sao kiểm chứng nó làm đúng</b>. Model và Harness tiến hóa cùng nhau:
            Harness vá chỗ model còn yếu, những bản vá đó thành tín hiệu train cho model sau; model “ăn” Harness từng lớp nhưng không bao giờ ăn hết, vì
            mỗi thế hệ model lại mở một biên giới mới.
          </Callout>
        </>
      ),
    },
  ],
  pitfalls: [
    { wrong: "Thêm Agent thứ hai chỉ để “đọc lại cho chắc”.", right: "Chỉ thêm khi Agent đó mang thông tin mới: chạy test, render, tool kiểm dữ kiện." },
    { wrong: "Bỏ qua chi phí token.", right: "Multi-agent có thể tốn gấp ~15 lần; lợi ích phải bù được." },
    { wrong: "Dùng Skill để ngăn một vai trò gọi tool nhạy cảm.", right: "Skill là chỉ dẫn; quyền phải chặn bằng code ở Harness hoặc tách Agent." },
    { wrong: "Manager giữ toàn văn mọi output trong context.", right: "Artifact nằm trên file system; Manager chỉ giữ chỉ mục và đường dẫn." },
    { wrong: "Chấp nhận báo cáo “tìm thấy” đầu tiên.", right: "Settle ở thành công đầu tiên đã kiểm chứng, settle_once idempotent, broadcast terminate một lần." },
    { wrong: "Coi review của cùng model trong context tương tự là bằng chứng độc lập.", right: "Đa dạng model, context, nguồn; ưu tiên kiểm tra tất định." },
    { wrong: "Handoff cả trajectory riêng cho Agent kế tiếp.", right: "Handoff package: goal, facts, artifact refs, budget, visited_agents." },
    { wrong: "Giao hết cho Agent rồi thôi theo dõi.", right: "Tránh comprehension debt: vẫn hiểu và định hướng kiến trúc." },
  ],
  demos: [
    { id: "infogain", title: "Cộng tác này có thêm thông tin không?", component: InfoGainDemo, desc: "Tiêu chí quan trọng nhất để quyết định có dùng nhiều Agent." },
    { id: "parallel", title: "Manager song song + cascading termination", component: ParallelSearch, desc: "10 Agent tìm một giảng viên; thử tắt cascading termination và lock." },
    { id: "lock", title: "Lost update vs optimistic locking", component: OptimisticLock, desc: "Hai Agent cùng sửa glossary.md — từng bước một." },
    { id: "topology", title: "Chọn kiến trúc", component: TopologyDemo, desc: "Shared context, peer, manager hay decentralized?" },
    { id: "failures", title: "Nhận diện kiểu lỗi", component: FailureDemo, desc: "Sáu kiểu lỗi đặc trưng của hệ đa Agent." },
  ],
  lab: {
    intro: (<><LabSetup /><p>Bài lab chương này không cần model: các “Agent” là thread Python, nhưng vấn đề điều phối (race condition, lost update, vòng lặp handoff) là thật.</p></>),
    steps: [
      {
        id: "multi_agent", title: "Proposer–Reviewer, Manager song song, optimistic lock, handoff", file: "ch10/multi_agent.py", code: multiPy,
        run: ["python3 ch10/multi_agent.py"],
        observe: (
          <ul>
            <li>Phần 1: vì sao self-review cho qua code sai còn reviewer chạy test thì không? Finding của reviewer có đủ cụ thể để proposer sửa không?</li>
            <li>Phần 2: xóa dòng <code>ev.set()</code> trong vòng broadcast — thời gian và số trang đã đọc thay đổi thế nào?</li>
            <li>Phần 3: số lần “đọc lại và làm lại” thay đổi giữa các lần chạy. Vì sao? Khi nào optimistic lock tệ hơn lock bi quan?</li>
            <li>Phần 4: thêm route <code>"tech": "human"</code> và một Agent <code>human</code> — handoff có kết thúc tự nhiên không?</li>
          </ul>
        ),
        result: (
          <p className="small">
            Phần 1: self-review PASS ngay vòng 1 nhưng code sai; reviewer chạy test VETO rồi PASS ở vòng 2 với code đúng. Phần 2: tuần tự ≈ 0,85s,
            song song ≈ 0,06s; hai Agent cùng thấy: có lock tổng hợp 1 lần, không lock 2 lần. Phần 3: không khóa còn 20/40 dòng; optimistic 40/40 dòng
            (vài chục lần làm lại, thay đổi mỗi lần chạy). Phần 4: không kiểm vòng thì chạy đến hết budget; có visited_agents thì dừng ở vòng đầu tiên.
          </p>
        ),
      },
    ],
  },
  apply: [
    {
      title: "Có nên tách thành nhiều Agent?",
      prompt: <p>Lấy một hệ Agent bạn đang nghĩ tới. Với mỗi Agent phụ dự định thêm: nó đưa thông tin mới nào mà Agent chính không có? Ước lượng token tăng bao nhiêu lần và lợi ích có xứng không?</p>,
      hint: <p>Nếu câu trả lời là “nó nghĩ lại cho kỹ” thì có lẽ một Agent với ngân sách lớn hơn là đủ.</p>,
    },
    {
      title: "Thiết kế file system và control plane",
      prompt: <p>Vẽ cây thư mục 4 vùng cho hệ của bạn (scratchpad, shared, mount ngoài, /skills): ai thấy, vòng đời, quyền ghi, kiểm soát đồng thời. Rồi định nghĩa envelope message, file tiến độ, cách dừng graceful, và ngân sách cho mỗi sub-agent.</p>,
      hint: <p>Mặc định cách ly, chia sẻ phải khai báo. Vùng shared là nơi cần optimistic lock hoặc worktree.</p>,
    },
    {
      title: "Viết một vòng Loop Engineering",
      prompt: <p>Chọn một việc Agent của bạn hay “tuyên bố xong” quá sớm. Viết: verifier độc lập (đọc trạng thái thật), điều kiện được dừng, ngân sách vòng/thời gian/tiền, và điều gì xảy ra khi verifier từ chối.</p>,
      hint: <p>Model được đề xuất “xong”, không được tự duyệt “xong”. Reviewer không được sửa test hay gate.</p>,
    },
  ],
  glossary: [
    { en: "Shared / non-shared context", vi: "Chia sẻ / không chia sẻ ngữ cảnh", note: "Kế thừa trajectory hay cách ly." },
    { en: "Collaboration topology", vi: "Cấu trúc cộng tác", note: "Peer, manager, decentralized." },
    { en: "Orchestration / choreography", vi: "Điều phối tập trung / tự điều phối", note: "Nhạc trưởng vs mỗi vũ công tự vào." },
    { en: "Proposer–Reviewer", vi: "Người đề xuất – người duyệt", note: "Reviewer phải có bằng chứng độc lập." },
    { en: "Loop Engineering", vi: "Kỹ thuật vòng lặp", note: "Verifier, không phải model, quyết định khi nào dừng." },
    { en: "Premature termination", vi: "Dừng sớm", note: "Xong một phần, bỏ cuộc sớm, false success." },
    { en: "Message bus", vi: "Kênh tin nhắn", note: "Publish/subscribe bất đồng bộ." },
    { en: "Cascading termination", vi: "Dừng dây chuyền", note: "Một thành công, các nhánh khác dừng." },
    { en: "Race condition / settle_once", vi: "Tranh chấp / chốt một lần", note: "Chỉ chấp nhận một kết quả thắng." },
    { en: "Optimistic locking", vi: "Khóa lạc quan", note: "Kiểm version khi ghi, lệch thì đọc lại." },
    { en: "Handoff package", vi: "Gói bàn giao", note: "Goal, facts, artifact refs, budget, visited." },
    { en: "A2A / Agent Card", vi: "Giao thức Agent-to-Agent / danh thiếp", note: "Tương tác Agent giữa các tổ chức." },
    { en: "Byzantine fault", vi: "Lỗi Byzantine", note: "Vẫn chạy nhưng đưa thông tin sai." },
    { en: "Homogeneous convergence", vi: "Hội tụ đồng nhất", note: "Agent giống nhau mắc lỗi giống nhau." },
    { en: "Comprehension debt", vi: "Nợ hiểu biết", note: "Agent giao nhanh hơn tốc độ người hiểu." },
    { en: "Generative agents / memory stream", vi: "Agent sinh tạo / dòng ký ức", note: "Smallville: importance, recency, relevance." },
  ],
  quiz: [
    { q: "Tiêu chí quan trọng nhất để dùng nhiều Agent?", options: ["Task dài", "Cộng tác đưa thông tin mà một Agent không có", "Có nhiều GPU", "Model yếu"], answer: 1, explain: "Execution, visual, tool feedback → có thông tin mới." },
    { q: "Hai Agent tranh luận cùng một văn bản, cùng ngân sách thinking token với một Agent. Kết quả?", options: ["Luôn tốt hơn", "Ngang hoặc kém hơn", "Tốt gấp đôi", "Không chạy được"], answer: 1, explain: "Data processing inequality: truyền kết luận chỉ mất thông tin." },
    { q: "Vai trò khác nhau ở quyền dùng tool nhạy cảm. Nên dùng?", options: ["Skill", "Agent riêng / transfer_to_agent + chặn bằng code", "Thêm câu vào prompt", "Debate"], answer: 1, explain: "Skill là chỉ dẫn, không phải ranh giới quyền." },
    { q: "Trong tương đồng OS, trajectory của Agent ứng với?", options: ["Chương trình", "Bộ nhớ process", "CPU", "System call"], answer: 1, explain: "Static prefix là chương trình; trajectory là bộ nhớ." },
    { q: "Vùng nào của virtual file system cần kiểm soát đồng thời?", options: ["Scratchpad riêng", "Shared workspace", "/skills chỉ đọc", "Không vùng nào"], answer: 1, explain: "Nhiều bên cùng đọc ghi → optimistic lock, worktree." },
    { q: "Cách tốt nhất để Manager biết tiến độ sub-agent?", options: ["Poll get_status liên tục", "Thỏa thuận progress.md + message bất đồng bộ", "Đọc toàn bộ trajectory mỗi phút", "Không cần biết"], answer: 1, explain: "Poll lãng phí; trajectory đắt; progress file nhẹ và phát hiện treo được." },
    { q: "Plan-and-Act cho thấy nút thắt lớn nhất của Planner–Executor là?", options: ["Executor yếu", "Planner yếu", "Message bus", "Tool"], answer: 1, explain: "Dồn model mạnh nhất cho Manager/planner." },
    { q: "Hai sub-agent cùng báo “tìm thấy” trong cùng mili giây. Manager cần?", options: ["Tổng hợp cả hai", "settle_once nguyên tử", "Hủy cả hai", "Chờ thêm"], answer: 1, explain: "Lock/transaction, idempotent, broadcast terminate một lần." },
    { q: "Optimistic locking chống được loại xung đột nào?", options: ["Mọi xung đột", "Ghi đè trên cùng một file", "Xung đột ngữ nghĩa xuyên file", "Deadlock"], answer: 1, explain: "Xung đột ngữ nghĩa cần kiểm chứng tầng cao hơn hoặc worktree." },
    { q: "Handoff Swarm billing ↔ tech đá qua đá lại. Cơ chế nào chặn?", options: ["Prompt dài hơn", "visited_agents + remaining_budget do runtime giữ", "Model mạnh hơn", "Debate"], answer: 1, explain: "Không Agent nào được xóa các trường này." },
    { q: "A2A khác MCP ở chỗ?", options: ["Giống nhau", "MCP: Agent↔tool; A2A: Agent↔Agent giữa các tổ chức", "A2A thay message bus", "MCP cho voice"], answer: 1, explain: "Agent Card, task lifecycle, opaque collaboration." },
  ],
  cards: [
    { front: "Khi nào nhiều Agent hơn một?", back: "Khi cộng tác mang thông tin mới: chạy code, render, tool kiểm chứng, tìm kiếm mở." },
    { front: "Hai chiều thiết kế đa Agent?", back: "Shared vs non-shared context · topology: peer / manager / decentralized." },
    { front: "3 kênh khi không chia sẻ context?", back: "Tool parameters · shared file system · message bus." },
    { front: "4 vùng virtual file system?", back: "Scratchpad riêng · shared workspace · mount ngoài · tài nguyên hệ thống chỉ đọc." },
    { front: "4 năng lực control plane?", back: "Message passing · status query · termination · resource scheduling." },
    { front: "Graceful vs forced termination?", back: "SIGTERM: dừng ở điểm an toàn, dọn dẹp, ack · SIGKILL: dự phòng, có thể để lại rác." },
    { front: "Loop Engineering?", back: "Model đề xuất “xong”, verifier độc lập duyệt “xong”; nút thắt là verifier." },
    { front: "3 dạng premature termination?", back: "Xong một phần · bỏ cuộc sớm · false success." },
    { front: "MetaGPT / AutoGen / Swarm?", back: "Pipeline SOP + message pool · lịch sử chung + selector tập trung · handoff ngang hàng thật." },
    { front: "Handoff package?", back: "task_id, goal, constraints, accepted_facts, artifact_refs, remaining_budget, visited_agents." },
    { front: "3 thành phần A2A?", back: "Agent Card · task lifecycle · opaque collaboration." },
    { front: "6 kiểu lỗi đa Agent?", back: "Concurrency · cascading · homogeneous convergence · passing the buck · runaway loop · comprehension debt." },
    { front: "3 thành phần generative agent (Smallville)?", back: "Memory stream · reflection · planning & reacting." },
    { front: "Ba câu hỏi không lỗi thời?", back: "Agent thấy gì · làm được gì · làm sao kiểm chứng nó làm đúng." },
  ],
};
