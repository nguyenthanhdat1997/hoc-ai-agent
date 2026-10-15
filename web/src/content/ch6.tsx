import type { Chapter } from "../lib/types";
import { Callout, Code, Table } from "../components/ui";
import { Classifier } from "../demos/Classifier";
import { LabSetup } from "./labSetup";
import eventLoopPy from "../../../agent-lab/ch06/event_loop.py?raw";

function EventStrategyDemo() {
  return (
    <Classifier
      options={["Cancellation", "Queued", "Parallel"]}
      items={[
        { text: "Người dùng gõ “Dừng! Tôi nói nhầm rồi” khi Agent sắp thực hiện thao tác", answer: "Cancellation",
          why: "Sự kiện khẩn: hủy streaming/tool đang chạy, gom queue, nối vào trajectory, gọi lại LLM ngay." },
        { text: "Trong lúc chờ kết quả search, người dùng thêm “chỉ lấy dữ liệu tháng gần nhất”", answer: "Queued",
          why: "Bổ sung thường: vào queue, khi tool trả về thì đưa cả hai cho LLM một lượt." },
        { text: "Đang phân tích dữ liệu dài, người dùng hỏi “hôm nay thời tiết thế nào?”", answer: "Parallel",
          why: "Độc lập, nhẹ, cần trả lời nhanh: chạy session song song, đánh dấu [Parallel with main task]." },
        { text: "Hệ thống báo thanh toán thất bại", answer: "Cancellation", why: "External trigger gắn nhãn khẩn." },
        { text: "Timer báo cáo hằng ngày kích hoạt", answer: "Queued", why: "timer.trigger là sự kiện không khẩn." },
      ]}
    />
  );
}

export const ch6: Chapter = {
  id: 6,
  title: "Interaction: mở rộng observation space và action space",
  short: "Interaction",
  tier: "Xây dựng Agent",
  minutes: 35,
  ready: true,
  oneLiner: "Bỏ giả định “Agent và thế giới lần lượt nói”: mở rộng theo hai trục modality (text → voice → màn hình → robot) và timing (Agent tự lấy → thế giới đẩy tới, hành động xuyên lượt, bị ngắt, bị chen ngang).",
  keyIdeas: [
    "Hai trục: modality (dạng quan sát/hành động) và timing (nhịp). Turn-taking là quy ước của model/giao diện, không phải tính chất của môi trường.",
    "Async & event-driven: mọi input (user, tool result, callback, timer) thành event stream; event-triggered tools (set_timer, monitor_shell, connect_channel) và user communication tools.",
    "Ba chiến lược xử lý sự kiện: cancellation (khẩn), queued (thường), parallel (độc lập, nhẹ). Dùng một LLM nhẹ làm event router.",
    "Không có native async thì dùng placeholder cho tool chưa xong để giữ cặp tool call/result; tool khởi tạo nên tên rõ nghĩa “initiate_…” trả task ID. GPT-6 Astra có async tool calling và mid-turn steering.",
    "Voice: cascaded (VAD→ASR→LLM→TTS, ~0,9–2,3s) → Omni end-to-end (vẫn turn-based) → full-duplex. Tách fast thinking (giao tiếp) và slow thinking (suy luận) giúp thay model nền dễ dàng.",
    "Computer Use: vòng perceive–think–act; visual grounding bằng DOM/accessibility indexing (Set-of-Mark), visual annotation hoặc coordinate prediction (phải scale tọa độ theo độ phân giải huấn luyện).",
    "Robot: planner dài hạn → skill (pick/place/verify) → VLA → điều khiển tầng thấp; action chunking đổi độ mượt lấy khả năng phản ứng; world model dự đoán hậu quả; hoàn thành vẫn phải xác nhận bằng quan sát mới.",
    "Bộ nguyên thủy chung: wake-up, safe point, cancellation, preemption, fast/slow separation.",
  ],
  sections: [
    {
      id: "axes",
      title: "Hai trục: modality và timing",
      body: (
        <Table
          head={["Kịch bản", "Thang thời gian", "Phía quan sát", "Phía hành động"]}
          rows={[
            ["Async & event-driven", "giây → ngày", "Thế giới đánh thức Agent (mail, timer, callback)", "Bắt đầu bây giờ, hoàn tất bằng sự kiện sau"],
            ["Voice", "10 ms → 1 s", "Nghe trong lúc nói, không chờ hết câu", "Nghĩ trong lúc nói, bị ngắt, sửa giữa chừng"],
            ["Computer Use", "dưới 1 s → vài giây", "Màn hình đổi liên tục giữa các frame", "Sau mỗi hành động phải xác nhận lại thực tế"],
            ["Robot", "mili giây", "Cảm biến đổ về liên tục", "Hành động theo chunk, có thể bị chen ngang"],
          ]}
        />
      ),
    },
    {
      id: "async",
      title: "Async và event-driven: khi thế giới tự tìm đến",
      body: (
        <>
          <p>Agent đồng bộ như một quầy thu ngân; trợ lý thật như thư ký xử lý nhiều việc theo độ khẩn, có thể dừng để chuyển việc gấp hơn. OpenClaw có Hooks, Cron, Heartbeat — nhưng sự kiện bên thứ ba (email, callback) chỉ được thấy ở lần tick sau. PineClaw (gọi điện thay người dùng) cần Channel đẩy sự kiện tức thì: nhân viên tổng đài đòi mã OTP thì không thể chờ heartbeat.</p>
          <Table
            head={["Loại", "Tool", "Ví dụ"]}
            rows={[
              ["Event-triggered", "set_timer", "Thứ Bảy được nhờ “gọi ngân hàng” → hẹn 10:00 thứ Hai"],
              ["", "monitor_shell", "Theo dõi output lệnh chạy nền thay vì poll tốn token"],
              ["", "connect_channel", "Email mới, API callback, IM đẩy tới tức thì"],
              ["User communication", "reply_to_user, send_card…", "Nhắn bất đồng bộ đa kênh như thư ký; chọn kênh theo độ khẩn và thói quen người dùng"],
            ]}
          />
          <p><b>Virtual identity + môi trường cách ly:</b> cho Agent tài khoản, máy ảo, điện thoại ảo riêng như thư ký có điện thoại công ty; đăng nhập tài khoản thật thì người dùng tự login qua VNC (HITL). Trao đổi dữ liệu bằng đường dẫn trong thư mục chia sẻ, không chép vào context.</p>
          <p><b>Structured event:</b> source (ai), channel (kênh), content (gì, khẩn không), context (liên quan việc nào) — giúp không nhầm tool result chứa chỉ thị ẩn với lệnh của người dùng.</p>
          <Code lang="json">{`{"source": {"type": "email", "sender": "client@example.com"},
 "channel": "gmail_webhook",
 "content": {"subject": "Refund Request", "body": "Order #12345 ..."},
 "context": {"priority": "high", "customer_tier": "vip"}}`}</Code>
          <Callout title="Khi model không có native async">
            Năm luật: ghi assistant message ngay; chỉ ghi tool result khi xong; bị ngắt giữa chừng thì sinh <b>placeholder</b> (“tool đang chạy nền, hãy ưu tiên sự kiện mới”) để cặp call/result hợp lệ; hủy generation dở rồi gửi request mới; sự kiện không khẩn gom lô. Thiết kế tool có ngữ nghĩa async: <code>initiate_phone_call</code> trả task ID, tiến độ đến qua sự kiện. Khi gom lô, model hay chỉ trả lời sự kiện cuối → đánh dấu “[Unprocessed Event 1/4] …” kèm tóm tắt.
          </Callout>
          <p>Native async (GPT-6 Astra): async tool calling — tiếp tục việc không phụ thuộc trong lúc chờ; mid-turn steering — người dùng sửa yêu cầu giữa chừng. Nhưng đổi kế hoạch không tự dừng tool đang chạy; runtime vẫn chịu trách nhiệm hủy và trạng thái.</p>
        </>
      ),
    },
    {
      id: "voice",
      title: "Voice: giao diện tự nhiên nhất",
      body: (
        <>
          <Table
            head={["Paradigm", "Cấu trúc", "Ưu", "Hạn chế"]}
            rows={[
              ["Cascaded", "VAD → ASR → LLM → TTS", "Module rõ, dễ thay, dễ debug", "Độ trễ cộng dồn (~0,9–2,3s lý tưởng), mất cảm xúc/âm thanh nền"],
              ["End-to-end Omni", "Audio vào–ra trong một model, vẫn theo lượt", "Trễ thấp, giữ ngữ điệu", "Vẫn dựa VAD: dừng giữa lúc đọc số dễ bị tưởng hết lượt"],
              ["Full-duplex", "Nghe–nói liên tục, tự quyết khi nào nói/dừng", "Nói chồng, ngắt lời tự nhiên", "Huấn luyện, kiểm soát, đánh giá phức tạp"],
            ]}
          />
          <p>Tối ưu cascaded bằng <b>streaming perception</b>: streaming ASR, LLM speculative execution trên bản nháp transcript, gửi câu đầu tiên cho TTS ngay, TTS từng đoạn. Hàng đợi production (ρ = 0,5–0,8) làm trễ thực tế gấp 2–5 lần lúc rảnh.</p>
          <Callout title="Cognitive timing: fast vs slow thinking">
            Fast model giữ cuộc nói chuyện, slow model suy luận ở nền và gửi lời khuyên (qua Status Bar). Ưu điểm lớn: model suy luận mạnh hơn ra đời thì chỉ thay model nền. Pine AI (kiến trúc tách) đứng đầu τ³-Voice Leaderboard (8/2026). Hướng khác: hợp nhất trong một model (Step-Audio R1: MGRD + MPS “hai bộ não”). TTS giống người hơn nhờ control token (THINKING, EMO:happy, SPEED:0.8x).
          </Callout>
        </>
      ),
    },
    {
      id: "computer-use",
      title: "Computer Use",
      body: (
        <>
          <p>Vòng: chụp màn hình → model ra thought + action → thực thi (xdotool/Playwright) → chờ giao diện ổn định → chụp lại. Hiểu giao diện ≠ hoàn thành nhiệm vụ: sau mỗi bước phải xác nhận thực tế vẫn khớp kế hoạch. Mỗi hành động 2–5s, chậm 3–5 lần người.</p>
          <Table
            head={["Visual grounding", "Cách làm", "Khi nào"]}
            rows={[
              ["DOM / accessibility indexing", "Đánh số phần tử tương tác qua CDP, model chỉ chọn ID (browser-use)", "Có cấu trúc (web) — chính xác, ổn định nhất"],
              ["Set-of-Mark (visual)", "Model phân đoạn đánh số vùng trên ảnh", "Desktop native, canvas, game — hợp model tổng quát"],
              ["Coordinate prediction", "Model nói thẳng tọa độ (Claude, SeeClick)", "Model được huấn luyện riêng; phải scale ảnh về độ phân giải huấn luyện (vd 2560×1440 → 1366×768) rồi nhân ngược tọa độ"],
            ]}
          />
          <p><b>AOI</b> (observation interface): chụp keyframe khi màn hình đổi đáng kể, gate âm lượng để chép lời, mô tả ảnh thành text giữ lại trong context. <b>World model</b> cho phép “speculative execution”: dự đoán trạng thái sau hành động, chỉ dừng lại quan sát khi lệch dự đoán (Photon-1). Mobile: rào cản lớn nhất là hệ sinh thái — Agent bỏ qua quảng cáo nên đụng mô hình kinh doanh của nền tảng.</p>
        </>
      ),
    },
    {
      id: "robot",
      title: "Robot: dọn bàn với XLeRobot",
      body: (
        <>
          <p>Teleoperation cho thấy cánh tay vài trăm đô làm được việc → nút thắt là thuật toán, không phải phần cứng (“cố định phần cứng, đổi người điều khiển”).</p>
          <Table
            head={["Tầng", "Câu hỏi", "Đầu ra", "Nhịp"]}
            rows={[
              ["Mục tiêu", "Người muốn gì", "“Cất cốc và giấy”", "phút"],
              ["Long-horizon planning", "Làm gì trước", "Cốc → giấy → kiểm tra", "giây–phút"],
              ["Basic skills", "Thay đổi trạng thái nào", "pick(red_cup), place(red_cup, tray)", "1–3 s"],
              ["VLA", "Skill này chuyển động ra sao", "Quỹ đạo kẹp", "1–10 Hz"],
              ["Điều khiển thấp + an toàn", "Thực thi ổn định", "Lệnh khớp, giới hạn tốc độ, dừng khẩn", "50–1000 Hz"],
            ]}
          />
          <ul>
            <li>Model chỉ chọn skill có giới hạn (pick, place, verify_state, stop), không xuất góc khớp tùy ý; sau mỗi skill phải quan sát lại.</li>
            <li><b>Action chunking:</b> sinh một đoạn hành động, luồng điều khiển chạy nhanh hơn — đoạn càng dài càng mượt nhưng càng ít thấy frame mới.</li>
            <li><b>Giới hạn VLA:</b> ít dữ liệu, bắt chước không hiểu hậu quả, robot khác nhau, quan sát bị cũ.</li>
            <li><b>World model</b> dự đoán hậu quả để chọn hành động ít rủi ro, so dự đoán với thực tế khi chạy; nhưng camera thật vẫn là sự thật cuối cùng. Sim2Real cần domain randomization (nền, ánh sáng, nhiễu).</li>
          </ul>
          <Code lang="text">{`liên tục cảm nhận → đánh giá trạng thái và thời điểm → chọn trả lời/hành động
→ đưa vào môi trường → quan sát phản hồi → tiếp tục / sửa / thử lại / dừng / lập lại kế hoạch`}</Code>
        </>
      ),
    },
  ],
  pitfalls: [
    { wrong: "Chỉ dùng heartbeat/poll để biết có sự kiện mới.", right: "Channel đẩy sự kiện tức thì cho việc cần phản hồi trong giây (OTP, cuộc gọi)." },
    { wrong: "Bị ngắt giữa lúc tool chạy thì bỏ tool call không có result, hoặc giả kết quả thành công.", right: "Placeholder ghi rõ “chưa xong”; kết quả thật đến sau như một sự kiện có task ID." },
    { wrong: "Tool tên phone_call nhưng thực ra chỉ khởi động cuộc gọi.", right: "initiate_phone_call trả task ID; tiến độ đến qua sự kiện." },
    { wrong: "Gửi ảnh 2560×1440 thẳng cho model dự đoán tọa độ.", right: "Scale về độ phân giải huấn luyện đúng tỉ lệ khung, rồi nhân ngược tọa độ." },
    { wrong: "Robot báo xong vì model nói “done”.", right: "Hoàn thành phải được xác nhận bằng một lần verify_state quan sát mới." },
  ],
  demos: [
    { id: "events", title: "Sự kiện này xử lý theo chiến lược nào?", component: EventStrategyDemo,
      desc: "Cancellation, queued hay parallel — dựa vào ngữ nghĩa và độ khẩn của sự kiện." },
  ],
  lab: {
    intro: (<><LabSetup /><p>Bài lab chương này không cần model: một runtime hướng sự kiện thu nhỏ bằng asyncio, cho thấy ba chiến lược xử lý sự kiện và cách giữ trajectory hợp lệ khi bị ngắt.</p></>),
    steps: [
      {
        id: "event_loop", title: "Event-driven runtime: cancellation, queued, parallel", file: "ch06/event_loop.py", code: eventLoopPy,
        run: ["python3 ch06/event_loop.py"],
        observe: (
          <ul>
            <li>Kịch bản “queued”: câu hỏi thời tiết được trả lời ở giây thứ mấy, trong khi search vẫn chạy? Vì sao nó không vào trajectory chính?</li>
            <li>Kịch bản “cancel”: xóa dòng ghi placeholder rồi chạy lại — bước kiểm tra cặp tool call/result báo gì? Nhiều API sẽ từ chối request như vậy.</li>
            <li>Vì sao gom cả sự kiện thường lẫn sự kiện khẩn vào một lượt, có đánh số [Unprocessed Event i/n]?</li>
          </ul>
        ),
        result: (
          <p className="small">
            Queued: tool xong ở giây 5, đưa tool result + 2 sự kiện cho LLM một lượt; thời tiết được trả lời ở giây ~3,7 bằng session song song.
            Cancel: sự kiện khẩn ở giây 2 hủy search, placeholder “[ĐÃ HỦY]” giữ trajectory hợp lệ. Màn hình 2560×1440 → 1280×720, điểm (1100, 650) → click (2200, 1300).
          </p>
        ),
      },
    ],
  },
  apply: [
    {
      title: "Sự kiện nào nên đánh thức Agent của bạn?",
      prompt: <p>Liệt kê các nguồn sự kiện (email, webhook, timer, cảnh báo) Agent của bạn cần phản ứng. Mỗi loại: khẩn hay không, chiến lược xử lý, payload cần chứa gì để Agent khỏi phải hỏi thêm.</p>,
      hint: <p>Định nghĩa điều kiện kích hoạt và bộ lọc rõ ràng để sự kiện không liên quan không đánh thức Agent vô ích.</p>,
    },
  ],
  glossary: [
    { en: "Event-driven architecture", vi: "Kiến trúc hướng sự kiện", note: "Mọi input thành event stream, event loop xử lý." },
    { en: "Safe point", vi: "Điểm an toàn", note: "Ranh giới có thể tiêu thụ sự kiện mới mà không hỏng trạng thái." },
    { en: "Mid-turn steering", vi: "Điều hướng giữa lượt", note: "Người dùng bổ sung yêu cầu khi model đang chạy." },
    { en: "Full-duplex", vi: "Song công toàn phần", note: "Nghe và nói đồng thời, không chia lượt." },
    { en: "VAD / ASR / TTS", vi: "Phát hiện giọng / nhận dạng / tổng hợp", note: "Các khối của voice pipeline cascaded." },
    { en: "Visual grounding", vi: "Định vị thị giác", note: "Tìm phần tử mục tiêu trên ảnh chụp màn hình." },
    { en: "Set-of-Mark", vi: "Đánh dấu tập phần tử", note: "Đánh số phần tử để model chỉ chọn ID." },
    { en: "VLA", vi: "Vision-Language-Action", note: "Model từ ảnh + chỉ dẫn skill ra hành động robot." },
    { en: "Action chunking", vi: "Chia khúc hành động", note: "Sinh một đoạn hành động, chạy ở tần số cao hơn." },
    { en: "World model", vi: "Mô hình thế giới", note: "Dự đoán trạng thái tiếp theo sau một hành động." },
  ],
  quiz: [
    { q: "Hai trục mở rộng trong chương này là gì?", options: ["Content và size", "Modality và timing", "Speed và cost", "Text và image"], answer: 1,
      explain: "Chương 2–5 mở rộng nội dung; chương 6 mở rộng hình thức và nhịp." },
    { q: "Người dùng thêm “chỉ lấy tháng gần nhất” trong lúc tool search đang chạy. Chiến lược?", options: ["Cancellation", "Queued", "Parallel", "Bỏ qua"], answer: 1,
      explain: "Bổ sung không khẩn: vào queue, đưa cùng tool result cho LLM một lượt." },
    { q: "Vì sao cần placeholder khi bị ngắt giữa lúc tool chạy (giao diện đồng bộ)?", options: ["Để tiết kiệm token", "Để giữ cặp tool call/result hợp lệ mà không giả kết quả", "Để hủy tool", "Để log"], answer: 1,
      explain: "Placeholder ghi rõ “chưa xong”; kết quả thật đến sau như sự kiện mới." },
    { q: "Lợi ích chính của tách fast/slow thinking trong voice Agent?", options: ["Rẻ hơn", "Thay model suy luận mạnh hơn mà không phải huấn luyện lại hệ voice", "Không cần TTS", "Không cần VAD"], answer: 1,
      explain: "Khả năng tương tác và trần trí tuệ tiến hóa độc lập." },
    { q: "Với web có DOM, cách visual grounding nào nên ưu tiên?", options: ["Coordinate prediction", "DOM/accessibility indexing", "OCR", "Đoán"], answer: 1,
      explain: "Chính xác và ổn định nhất khi có cấu trúc." },
    { q: "Action chunking đánh đổi gì?", options: ["Chi phí và chất lượng", "Độ mượt và khả năng phản ứng với thay đổi", "Bộ nhớ và tốc độ", "Không đánh đổi gì"], answer: 1,
      explain: "Đoạn càng dài càng mượt nhưng càng ít thấy frame mới." },
  ],
  cards: [
    { front: "Ba chiến lược xử lý sự kiện?", back: "Cancellation (khẩn) · Queued (thường) · Parallel (độc lập, nhẹ)." },
    { front: "Ba loại event-triggered tool?", back: "set_timer · monitor_shell · connect_channel." },
    { front: "Structured event gồm?", back: "Source · channel · content · context." },
    { front: "Ba paradigm voice?", back: "Cascaded (VAD→ASR→LLM→TTS) · Omni end-to-end (vẫn theo lượt) · Full-duplex." },
    { front: "Ba cách visual grounding?", back: "DOM/accessibility indexing · Set-of-Mark visual · coordinate prediction." },
    { front: "Các tầng điều khiển robot?", back: "Mục tiêu → long-horizon planning → skill → VLA → điều khiển thấp + an toàn." },
    { front: "Bộ nguyên thủy chung của chương?", back: "Wake-up · safe point · cancellation · preemption · fast/slow separation." },
  ],
};
