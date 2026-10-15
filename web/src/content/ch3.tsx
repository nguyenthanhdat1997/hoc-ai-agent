import type { Chapter } from "../lib/types";
import { Callout, Code, Formula, Table } from "../components/ui";
import { Classifier } from "../demos/Classifier";
import { BM25Lab, CatCountDemo, Mem0Demo, RRFDemo } from "../demos/RetrievalDemos";
import { LabSetup } from "./labSetup";
import contextualPy from "../../../agent-lab/ch03/contextual_retrieval.py?raw";
import agenticRagPy from "../../../agent-lab/ch03/agentic_rag.py?raw";
import userMemoryPy from "../../../agent-lab/ch03/user_memory.py?raw";
import retrievalPy from "../../../agent-lab/miniagent/retrieval.py?raw";

function MemoryTypeDemo() {
  return (
    <Classifier
      options={["Episodic", "Semantic", "Procedural"]}
      items={[
        { text: "“Người dùng đã đặt chuyến ANA đi Tokyo vào thứ Sáu tới.”", answer: "Episodic",
          why: "Một sự kiện cụ thể có thời gian, đối tượng, chi tiết." },
        { text: "“Người dùng ăn chay.”", answer: "Semantic",
          why: "Đặc điểm ổn định được rút ra, không phải bản ghi của một cuộc trò chuyện cụ thể." },
        { text: "“Khi đặt vé: tìm chuyến bay thẳng → xác nhận ghế cửa sổ → nhập số hội viên → đặt suất ăn.”", answer: "Procedural",
          why: "Quy trình hành vi học được qua nhiều lần lặp lại." },
        { text: "“Lần cuối chúng ta bàn về ngân sách là thứ Ba tuần trước.”", answer: "Episodic",
          why: "Câu hỏi kiểu này cần chuỗi sự kiện có dấu thời gian (bộ nhớ sự kiện của Memobase)." },
        { text: "“Người dùng thích sản phẩm giá hợp lý và rất chú ý đánh giá của người mua.”", answer: "Semantic",
          why: "Kết quả của bước trừu tượng hóa nhiều cuộc mua sắm thành một quy luật chung." },
      ]}
    />
  );
}

export const ch3: Chapter = {
  id: 3,
  title: "User Memory và Knowledge Base",
  short: "User Memory & Knowledge",
  tier: "Xây dựng Agent",
  minutes: 45,
  ready: true,
  oneLiner: "Từ context trong một session sang tri thức bền vững: “trợ lý hiểu bạn” (bộ nhớ cá nhân) và “chuyên gia miền” (knowledge base dùng chung) — cùng một bộ kỹ thuật truy xuất.",
  keyIdeas: [
    "Hai thang đo của cùng một vấn đề: user memory (một người) và knowledge base (mọi người). Chung kỹ thuật (truy xuất, nén) và chung rắc rối: xung đột, hết hạn, truy xuất sai.",
    "Bộ nhớ tốt = chọn lọc + trừu tượng + có cấu trúc. Đánh giá theo 3 cấp: Basic Recall → Multi-Session Retrieval → Proactive Service.",
    "Thiết kế bộ nhớ có 3 chiều trực giao: lưu ở đâu (trajectory / long-term memory), lưu thế nào (Simple Notes → Advanced JSON Cards), lưu cái gì (episodic / semantic / procedural).",
    "RAG = chunking → dense + sparse retrieval (BM25) → hợp nhất RRF → rerank bằng cross-encoder → sinh câu trả lời; đo bằng recall@k, MRR, nDCG.",
    "Attention là truy xuất mềm, không phải cỗ máy tổng hợp: “nhồi” trường hợp thô vào kho là chưa đủ. Phải đầu tư ở giai đoạn indexing: tóm tắt thống kê, rule card có ranh giới, RAPTOR, GraphRAG.",
    "Contextual Retrieval: thêm prefix mô tả nguồn cho mỗi đoạn trước khi indexing → giảm 49% (kèm BM25) đến 67% (kèm rerank) tỷ lệ truy xuất thất bại.",
    "Agentic RAG: truy xuất thành một tool, Agent tự tìm nhiều vòng tới khi đủ — đổi tốc độ lấy độ tin cậy với câu hỏi phức tạp.",
    "Kiến trúc bộ nhớ hai lớp: Advanced JSON Cards thường trú (tổng quan) + Contextual Retrieval lấy chi tiết khi cần. Cập nhật tri thức như Pull Request: Proposer–Reviewer, có bằng chứng, hoàn tác được.",
  ],
  sections: [
    {
      id: "two-scales",
      title: "Hai thang đo: trợ lý hiểu bạn và chuyên gia miền",
      body: (
        <>
          <p>
            Chương 2 quản lý context <i>trong</i> một nhiệm vụ. Chương này hỏi: làm sao Agent vẫn nhớ người dùng và tri thức{" "}
            <b>sau khi cuộc trò chuyện kết thúc</b>?
          </p>
          <Table
            head={["", "User memory", "Knowledge base"]}
            rows={[
              ["Phục vụ", "Một cá nhân", "Mọi người dùng (nhóm)"],
              ["Nội dung", "Sở thích, thói quen, hồ sơ, sự kiện cá nhân", "Quy định ngành, quy trình nội bộ, tài liệu chuyên môn"],
              ["Biến Agent thành", "“Trợ lý hiểu bạn”", "“Chuyên gia miền”"],
              ["Rắc rối chung", "Xung đột thông tin · tri thức hết hạn · truy xuất không chính xác", "(giống bên trái)"],
            ]}
          />
          <h3>Bộ nhớ được tạo ra thế nào</h3>
          <p>
            Không lưu từng câu hội thoại. Sau khi session kết thúc, framework dùng <b>thêm một lần gọi LLM</b> để trích xuất, nén và soát
            lại những gì đáng nhớ lâu dài:
          </p>
          <Code lang="text">{`
User: Đặt giúp tôi vé đi Tokyo thứ Sáu tới. Tôi thích ghế cửa sổ và tôi ăn chay.
Agent: [gọi flight_search, trả về 3 lựa chọn] … Đặt chuyến ANA bay thẳng nhé?
User: Ừ, dùng số hội viên United MileagePlus 12345678.

→ Bộ nhớ trích xuất:
- Thích ghế cạnh cửa sổ (sở thích)
- Ăn chay, cần suất ăn đặc biệt trên máy bay (hạn chế ăn uống)
- Số United MileagePlus: 12345678 (chương trình khách hàng thân thiết)
- Có kế hoạch đi Tokyo (hoạt động gần đây)`}</Code>
          <p>
            Ba quy tắc: <b>chọn lọc</b> (bỏ “tìm kiếm trả về 3 lựa chọn”), <b>trừu tượng</b> (ghế cửa sổ lần này → sở thích lâu dài),{" "}
            <b>có cấu trúc</b> (lưu vào trường truy hồi được).
          </p>
        </>
      ),
    },
    {
      id: "eval",
      title: "Thế nào là bộ nhớ tốt: khung đánh giá 3 cấp",
      body: (
        <>
          <p>
            Tham chiếu benchmark LoCoMo (hội thoại ~300 lượt, tới 35 session), tác giả tóm 8 năng lực: lưu thông tin cá nhân, theo dõi sở
            thích, chuyển context, cập nhật bộ nhớ, liên tục nhiều session, tư duy phức hợp (dị ứng đậu phộng + gợi ý đồ Thái → nhắc
            thành phần đậu phộng), nhận thức thời gian, giải quyết xung đột. Rồi gom thành 3 cấp:
          </p>
          <Table
            head={["Cấp", "Yêu cầu", "Ví dụ"]}
            rows={[
              ["1 · Basic Recall", "Lưu và trả lại chính xác thông tin người dùng cung cấp rõ ràng", "“Mã hội viên của tôi là 12345” → sau này trả đúng số đó"],
              ["2 · Multi-Session Retrieval", "Gom thông tin rải rác qua nhiều session, nhiều kênh; suy luận và hỏi lại khi mơ hồ", "Có 2 xe, “đặt lịch bảo dưỡng xe” → hỏi xe nào; hủy “chuyến đi LA” → hủy cả vé máy bay lẫn khách sạn"],
              ["3 · Proactive Service", "Nối các ký ức tưởng không liên quan, chủ động cảnh báo/đề xuất", "Đặt vé quốc tế → nhắc hộ chiếu (lưu từ vài tháng trước) sắp hết hạn; điện thoại hỏng → liệt kê đủ bảo hành hãng, bảo hiểm thẻ tín dụng, bảo hiểm nhà mạng"],
            ]}
          />
          <p className="muted small">
            Thí nghiệm 3-1: 20 ca mỗi cấp; Agent tạo bộ nhớ từ session đầu, cập nhật qua các session sau (chỉ được đọc bộ nhớ, không được
            xem lại hội thoại cũ), rồi trả lời câu hỏi mới; một LLM khác làm giám khảo so với đáp án tham chiếu.
          </p>
        </>
      ),
    },
    {
      id: "where-how",
      title: "Lưu ở đâu và lưu thế nào",
      body: (
        <>
          <h3>Phân cấp bộ nhớ (lưu ở đâu)</h3>
          <ul>
            <li><b>Trajectory:</b> bản ghi gốc của một session, theo thời gian, Append-only — như một <i>sổ cái</i>. Trả lời “tôi vừa nói gì, tool vừa trả gì”.</li>
            <li><b>Long-term memory của người dùng:</b> thông tin ổn định xuyên session, gắn với ID người dùng, được viết lại, hợp nhất, loại bỏ nhiều lần — như một <i>hồ sơ</i>. Agent đọc/ghi qua tool.</li>
            <li><b>Trạng thái nghiệp vụ</b> (tùy chọn): “cần làm rõ”, “đang chờ thanh toán”… — quan trọng với kiến trúc hướng sự kiện (Chương 6).</li>
          </ul>
          <h3>Bốn định dạng lưu trữ (lưu thế nào)</h3>
          <Table
            head={["Định dạng", "Ví dụ", "Ưu", "Nhược"]}
            rows={[
              ["Simple Notes", "“Email: john@x.com”", "Rẻ, thao tác O(1)", "Mất liên kết: “kỹ sư cấp cao ở TechCorp làm hệ khuyến nghị” bị xé thành 3 mảnh"],
              ["Enhanced Notes", "Một đoạn văn đủ context về công việc", "Ngữ nghĩa đầy đủ", "Dư thừa, đổi một thuộc tính phải sửa nhiều đoạn"],
              ["JSON Cards", "work.position.title = …", "Cập nhật từng phần, dự đoán được", "Phân loại cứng: “code Python cuối tuần” thuộc mục nào?"],
              ["Advanced JSON Cards", "+ backstory, person, relationship, thời gian", "Phân biệt “bác sĩ Zhang” là nha sĩ của bạn hay bác sĩ tim mạch của bố bạn", "Tạo và bảo trì đắt"],
            ]}
          />
          <p>
            Thực tế dùng <b>kết hợp</b>: Advanced JSON Cards cho dữ liệu quan trọng và ít (sở thích, quan hệ với người chủ chốt); Simple
            Notes cho sự kiện hội thoại nhiều mà ít quan trọng. Thí nghiệm 3-2: Simple Notes qua được hầu hết ca cấp 1 với chi phí thấp
            nhất nhưng mất điểm ở cấp 2–3; Advanced JSON Cards tốt nhất ở phân định và liên kết xuyên session.
          </p>
          <Callout title="Xa hơn: bộ nhớ là mã chạy được (User as Code)">
            Biến trạng thái người dùng thành đối tượng có kiểu, và quy tắc thành hàm — để tổng hợp, phát hiện xung đột, thực thi ràng
            buộc là việc của code tất định chứ không phải “nhẩm trong đầu” của LLM. Dữ kiện được ghi vào nhật ký chỉ-thêm, định kỳ dựng
            lại trạng thái.
          </Callout>
          <Code lang="python">{`
def check():                              # chạy mỗi khi trạng thái được cập nhật
    for trip in state.trips:
        if trip.is_international:
            days = date_difference(state.passport.expiry_date, trip.departure_date)
            if days < 180:
                alert("passport expires too soon", trip, days)`}</Code>
        </>
      ),
    },
    {
      id: "what",
      title: "Lưu cái gì: ba loại trí nhớ theo khoa học nhận thức",
      body: (
        <>
          <Table
            head={["Loại", "Con người", "Agent"]}
            rows={[
              ["Làm việc (working)", "Thứ đang nghĩ trong đầu", "Context window: trajectory + ký ức dài hạn được kích hoạt"],
              ["Episodic", "“Thứ Tư tuần trước ăn tối ở nhà hàng Ý với đồng nghiệp”", "“Người dùng đã đặt chuyến ANA đi Tokyo thứ Sáu tới”"],
              ["Semantic", "“Thủ đô Ý là Rome”", "“Người dùng ăn chay”, “thích ghế cửa sổ”"],
              ["Procedural", "Biết đi xe đạp", "“Tìm chuyến bay thẳng → xác nhận ghế → số hội viên → suất ăn”"],
            ]}
          />
          <Callout title="Ba hệ phân loại là trực giao — kết hợp tự do">
            <b>Lưu ở đâu</b> (trajectory / dài hạn / trạng thái nghiệp vụ) × <b>lưu thế nào</b> (4 định dạng) × <b>lưu cái gì</b> (phân
            đoạn / ngữ nghĩa / thủ tục). Ví dụ: “thích ghế cửa sổ” là semantic memory, lưu dài hạn dạng Simple Notes; quy trình đặt vé
            là procedural memory, lưu dạng Advanced JSON Cards.
          </Callout>
          <p>
            Trajectory là chuỗi sự kiện đầy đủ, bất biến; bộ nhớ làm việc là tập con động đã được lọc và kích hoạt theo mức liên quan.
            Framework thực tế thường chỉ làm một hai loại — chọn theo nhu cầu, đừng đuổi theo “to và đủ”.
          </p>
        </>
      ),
    },
    {
      id: "frameworks",
      title: "Khung bộ nhớ thực tế, nén bộ nhớ và quyền riêng tư",
      body: (
        <>
          <h3>Mem0: từ xử lý xung đột lúc ghi sang lúc truy xuất</h3>
          <Table
            head={["", "v2 / bài báo 2025", "v3 (04/2026)"]}
            rows={[
              ["Ghi", "LLM trích xuất → tìm ký ức gần giống → LLM chọn ADD / UPDATE / DELETE / NOOP", "Một lần LLM trích xuất, chỉ ADD (kèm thời gian)"],
              ["Xung đột", "“Sống ở Bắc Kinh” bị UPDATE thành “Thượng Hải” ngay lúc ghi", "Hai sự kiện cùng tồn tại; truy xuất lai (ngữ nghĩa + BM25 + thực thể + thời gian) chọn cái đang hiệu lực"],
              ["Rủi ro / chi phí", "Cập nhật/xóa sai là mất lịch sử vĩnh viễn; mỗi sự kiện tốn thêm truy hồi + phán đoán", "Ít lời gọi LLM hơn, giữ lịch sử"],
              ["Kết quả", "LoCoMo 71,4 · LongMemEval 67,8", <b>LoCoMo 92,5 · LongMemEval 94,4</b>],
            ]}
          />
          <p>
            <b>Memobase</b> đi hướng khác: <i>hồ sơ người dùng</i> (các ô do nhà phát triển cấu hình theo chủ đề → chủ đề con) + <i>bộ nhớ
            sự kiện</i> theo dòng thời gian; gom hội thoại vào cache rồi xử lý theo lô để giảm lời gọi LLM, phía truy vấn chỉ đọc nên độ trễ thấp.
          </p>
          <h3>Nén bộ nhớ đa cấp</h3>
          <ol>
            <li><b>Lọc theo điểm quan trọng:</b> tần suất truy cập, suy giảm theo thời gian, cường độ cảm xúc, tính độc đáo.</li>
            <li><b>Phân cụm:</b> gom ký ức giống nhau, viết bản tóm tắt đại diện (“hay hỏi thời tiết, đặc biệt quan tâm lượng mưa”).</li>
            <li><b>Trừu tượng hóa:</b> từ ký ức phân đoạn rút ra quy luật ngữ nghĩa/thủ tục.</li>
          </ol>
          <h3>Quyền riêng tư: khử nhạy cảm nhật ký bằng model cục bộ</h3>
          <p>
            Thí nghiệm 3-3 dùng Qwen3-0.6B chạy <b>cục bộ</b> (gửi nhật ký lên cloud để khử nhạy cảm là đi ngược mục đích) để phát hiện PII:
            số CMND, thẻ ngân hàng, địa chỉ, và cả câu tự nhiên như “mật khẩu của tôi là abc123”. Recall &gt;95%, ít dương tính giả hơn
            regex. Thông lượng cao: regex lọc nhanh mẫu rõ ràng, LLM phân tích phần còn lại.
          </p>
        </>
      ),
    },
    {
      id: "rag-basics",
      title: "RAG cơ bản: chunking và hai kiểu truy xuất",
      body: (
        <>
          <Formula>Truy xuất đoạn liên quan → chèn vào context → LLM sinh câu trả lời dựa trên đó</Formula>
          <h3>Chunking</h3>
          <Table
            head={["Chiến lược", "Cách làm", "Đánh đổi"]}
            rows={[
              ["Kích thước cố định", "Cắt theo số token (vd 512), chồng lấn 50–100 token", "Đơn giản nhưng có thể cắt ngang đoạn văn, khối mã, bảng"],
              ["Đệ quy / theo cấu trúc", "Cắt theo tiêu đề → đoạn → câu, hạ cấp khi còn quá dài", "Mặc định phổ biến nhất trong sản xuất"],
              ["Theo ngữ nghĩa", "Cắt ở chỗ độ tương đồng giữa các câu kề nhau tụt mạnh", "Chất lượng cao hơn, tốn thêm tính embedding"],
            ]}
          />
          <p>
            Khởi điểm thực tế: <b>256–1024 token mỗi đoạn, chồng lấn 10–20%</b>, rồi tinh chỉnh theo đo đạc. Quá nhỏ → mơ hồ (“doanh thu
            tăng 3%” — công ty nào?); quá lớn → trộn nhiều chủ đề, vector bị loãng.
          </p>
          <h3>Dense embedding — hiểu ngữ nghĩa</h3>
          <p>
            Biến văn bản thành vector sao cho nghĩa gần thì vector gần, đo bằng <b>cosine</b> (quan tâm hướng chứ không phải độ dài). Ví
            dụ tay: “cách nuôi mèo” vs “hướng dẫn nuôi mèo” ≈ 0,99; vs “chiến lược đầu tư chứng khoán” ≈ 0,25. Word2Vec (vector tĩnh,
            “bank” chỉ có một nghĩa) → BERT/BGE-M3 (nhận biết context, đa ngôn ngữ, văn bản dài). Kho lớn cần index ANN:
          </p>
          <Table
            head={["", "ANNOY (cây)", "HNSW (đồ thị)"]}
            rows={[
              ["Xây dựng / bộ nhớ", "Nhanh / thấp", "Chậm / cao"],
              ["Cập nhật gia tăng", "Không — phải dựng lại", "Có (nên dựng lại định kỳ)"],
              ["Độ chính xác", "Cao", "Rất cao"],
              ["Hợp với", "Dữ liệu tĩnh", "Dữ liệu cập nhật liên tục"],
            ]}
          />
          <h3>Sparse retrieval (BM25) — khớp từ khóa chính xác</h3>
          <Formula>Score(Q,D) = Σ IDF(q) · TF·(k₁+1) / (TF + k₁·(1 − b + b·|D|/avgdl))</Formula>
          <ul>
            <li><b>IDF</b> = ln((N − df + 0,5)/(df + 0,5)): từ càng hiếm càng nặng ký (“chưng cất” &gt;&gt; “model”). Từ có trong quá nửa số tài liệu bị chặn về 0.</li>
            <li><b>k₁</b> (thường 1,2–2): bão hòa tần suất — xuất hiện 10 lần không đáng gấp đôi 5 lần.</li>
            <li><b>b</b> (thường 0,75): chuẩn hóa độ dài — tránh thiên vị tài liệu dài.</li>
          </ul>
          <p className="small muted">
            Ví dụ sách: truy vấn “model chưng cất”, doc_1 có “chưng cất” tf=3 (idf 1,22) đóng góp 2,15 &gt; “model” tf=5 (idf 0,76) đóng
            góp 1,52 → tổng 3,67, xếp đầu. BM25 cực tốt với mã kỹ thuật, tên riêng; nhưng không hiểu từ đồng nghĩa (“kitty” không tìm ra “cat”).
          </p>
        </>
      ),
    },
    {
      id: "hybrid",
      title: "Hybrid retrieval, rerank và đo chất lượng",
      body: (
        <>
          <p>
            Dense có thể bỏ sót từ khóa (“HTTP-403” ra bài chung về lỗi máy chủ); thưa không hiểu đồng nghĩa. Giải pháp ba giai đoạn:
          </p>
          <ol>
            <li><b>Truy xuất song song</b> ở cả hai nhánh.</li>
            <li><b>Hợp nhất bằng RRF</b>: score = Σ 1/(k + hạng), k thường = 60 — bỏ điểm gốc vì cosine (0–1) và BM25 (0–hàng chục) không cùng thang.</li>
            <li>
              <b>Rerank bằng cross-encoder</b> (vd bge-reranker-v2-m3) cho top-N (vd 50). Bi-encoder = nhà tuyển dụng lướt CV (nhanh,
              mã hóa riêng rẽ); cross-encoder = người phỏng vấn nói chuyện với từng ứng viên (ghép truy vấn + tài liệu, chậm mà chính xác).
            </li>
          </ol>
          <Table
            head={["Chỉ số", "Trả lời câu hỏi"]}
            rows={[
              ["recall@k (sách dùng nghĩa “hit rate”)", "Tài liệu chứa đáp án có nằm trong k kết quả đầu không? — gần nhất với nhu cầu RAG"],
              ["MRR", "Có tìm thấy đủ CAO không? Hạng 1 = 1 điểm, hạng 10 = 0,1"],
              ["nDCG", "Chất lượng của cả danh sách xếp hạng"],
            ]}
          />
          <Callout kind="ok" title="Kết luận Thí nghiệm 3-6">
            Không có chiến lược truy xuất đơn lẻ nào đáng tin trong mọi tình huống. Dense + sparse + rerank là cấu hình phù hợp cho
            RAG cấp sản xuất; reranker thường kéo lên đầu những tài liệu mà một nhánh đơn lẻ xếp thấp.
          </Callout>
        </>
      ),
    },
    {
      id: "beyond-flat",
      title: "Vì sao RAG “phẳng” chưa đủ: structured index",
      body: (
        <>
          <Callout kind="bad" title="Hai ca thất bại kinh điển">
            <p style={{ margin: "0 0 6px" }}>
              <b>Đếm mèo:</b> 100 hồ sơ riêng lẻ (90 đen, 10 trắng), hỏi tỷ lệ. Top-k = 20 chỉ cho thấy một mẫu (vd 15 đen, 3 trắng) →
              kết luận sai. Có sẵn bản tóm tắt “90 đen (90%), 10 trắng (10%)” thì một lần truy xuất là đúng.
            </p>
            <b>Ranh giới chiết khấu:</b> vài trăm phiếu hỗ trợ, mỗi phiếu một kết luận (cựu chiến binh được, bác sĩ được, giáo viên không).
            Y tá hỏi “tôi có đủ điều kiện?” → (1) <i>thiên lệch láng giềng gần nhất</i>: “y tá” gần “bác sĩ” nên đoán có — phiếu giáo viên
            xếp trên thì đoán không; (2) <i>thiếu ngữ nghĩa ranh giới</i>: câu “chỉ… còn lại đều không” không nằm trong phiếu nào — tăng k
            cũng vô ích; (3) <i>thiếu tín hiệu đầy đủ</i>: model không biết mình chưa thấy hết nên không hỏi lại.
          </Callout>
          <p>
            Cách sửa nằm ở <b>giai đoạn indexing</b>: đọc toàn bộ ngoại tuyến, chắt lọc thành tóm tắt thống kê và <b>rule card có
            nêu ranh giới</b>. Đó là ý tưởng của structured index — tốn tính toán hơn để đổi lấy truy xuất tốt hơn:
          </p>
          <Table
            head={["", "RAPTOR (cây)", "GraphRAG (đồ thị)"]}
            rows={[
              ["Cách xây", "Đoạn lá → phân cụm → LLM tóm tắt cụm → lặp lên tới gốc", "LLM trích thực thể + quan hệ (bộ ba chủ thể–quan hệ–đối tượng) → phát hiện cộng đồng → tóm tắt"],
              ["Giỏi", "Đi từ khái niệm tổng quát xuống chi tiết (“tập lệnh SIMD” → SSE4.1)", "Suy luận nhiều bước nhảy (người dùng → nha sĩ → bệnh viện → địa chỉ); phân định thực thể cùng tên"],
              ["Hạn chế", "Tốn LLM khi dựng và khi truy vấn", "Bộ ba làm mất logic điều kiện/thời gian (“nếu tuần sau mưa thì hủy đi biển…”); trích sai → ô nhiễm tri thức"],
            ]}
          />
          <p>
            Khuyến nghị: lưu thông tin cốt lõi bằng <b>ngôn ngữ tự nhiên đầy đủ</b> + siêu dữ liệu có cấu trúc để indexing; chỉ thêm đồ
            thị cho miền cần suy luận nhiều bước (y tế, pháp lý, quan hệ gia đình). Nếu truy vấn chủ yếu là “tìm đoạn chứa thông tin X” thì
            hybrid retrieval là đủ.
          </p>
          <h3>Filesystem paradigm (OpenViking)</h3>
          <p>
            Mọi context — tài nguyên, ký ức người dùng, kỹ năng của Agent — là thư mục/tệp trong một hệ thống tệp ảo{" "}
            <code>viking://</code>, mỗi thư mục có tóm tắt 3 tầng: <b>L0</b> (~100 token, một câu), <b>L1</b> (~2.000 token tổng quan),{" "}
            <b>L2</b> (toàn văn, chỉ nạp khi cần) — đúng tinh thần Progressive Disclosure của Skills. Dùng Markdown + Git: người đọc/sửa được, có
            session bản, Agent tự ghi chép được. Nhưng phải có <b>liên kết ngang kiểu Wikipedia</b> giữa các tệp, và phải yêu cầu rõ trong
            prompt “khi thêm mục mới, liên kết với mục liên quan và cập nhật trang index” — nhiều model không tự làm.
          </p>
        </>
      ),
    },
    {
      id: "update",
      title: "Cập nhật tri thức: coi mỗi thay đổi như một Pull Request",
      body: (
        <>
          <h3>Cập nhật gia tăng (khi có bằng chứng mới)</h3>
          <ol>
            <li><b>Proposer Agent</b> truy xuất tri thức liên quan, đề xuất <i>diff nhỏ nhất nhưng đủ</i> trên nhánh làm việc, kèm trích dẫn bằng chứng, giữ liên kết và siêu dữ liệu thời gian.</li>
            <li><b>Reviewer Agent</b> kiểm độc lập: đối chiếu từng khẳng định với bằng chứng thô, tìm điều kiện bị bỏ sót, xung đột với tệp khác, xóa/viết lại quá tay. Từ chối thì chỉ rõ dòng và bằng chứng.</li>
            <li><b>Lặp tới khi hội tụ</b>, có giới hạn vòng/ngân sách; quá giới hạn thì chuyển người duyệt — không mặc nhiên cho qua.</li>
            <li><b>Chỉ phát hành sau khi hợp nhất:</b> CI kiểm định dạng, liên kết, quyền; rồi mới dựng lại index bị ảnh hưởng. Index là sản phẩm dẫn xuất; Git là nguồn chuẩn.</li>
          </ol>
          <Table
            head={["Lớp", "Chứa gì", "Tính chất"]}
            rows={[
              ["Bằng chứng thô", "Hội thoại, trajectory, tài liệu gốc", "Chỉ thêm"],
              ["Tri thức", "Markdown / mã đã tinh lọc", "Sửa được lâu dài qua PR"],
              ["Phục vụ", "Index truy xuất từ một session bản đã hợp nhất", "Dựng lại được bất cứ lúc nào"],
            ]}
          />
          <Callout title="Hai Agent, hai họ model">
            Proposer và Reviewer phải là <b>Agent</b> (có tool tìm tệp, so session bản, chạy kiểm thử), không phải hai lời gọi API cố định.
            Nên dùng model năng lực tương đương nhưng <b>khác họ</b> (Claude ↔ GPT, DeepSeek ↔ Kimi) để giảm khả năng cùng sai một chỗ.
            Quyền tách cứng: Proposer chỉ ghi nhánh; Reviewer chỉ đọc và gửi kết luận; chỉ quy trình hợp nhất mới đụng nhánh chính.
          </Callout>
          <h3>Tái tổ chức định kỳ (“học trong khi ngủ”)</h3>
          <ol>
            <li><b>Khử trùng lặp, bỏ nội dung cũ, hợp nhất;</b> dựng lại liên kết và index, tách/gộp tệp.</li>
            <li><b>Quay về dữ liệu gốc để xác minh</b> — đừng viết lại qua lại giữa các bản tóm tắt (sai sót truyền qua nhiều thế hệ). Giữ danh sách bao phủ.</li>
            <li><b>Giải quyết xung đột bằng giới hạn phạm vi</b>: hai phát biểu có thể cùng đúng ở thời điểm/đối tượng khác nhau; chưa đủ bằng chứng thì giữ trạng thái xung đột, đừng ép kết luận.</li>
          </ol>
          <p>
            Thêm: gắn session bản và thời gian hiệu lực để lọc chính sách đã bị thay thế; <b>lọc quyền ngay ở lớp truy xuất</b> và cách ly
            index giữa các tenant — nội dung nhạy cảm đã vào context thì rất khó bảo đảm không rò ra câu trả lời.
          </p>
        </>
      ),
    },
    {
      id: "agentic",
      title: "Agentic RAG: truy xuất trở thành một tool",
      body: (
        <>
          <Table
            head={["", "RAG thường", "Agentic RAG"]}
            rows={[
              ["Luồng", "Truy vấn → truy xuất 1 lần → sinh", "Suy nghĩ → gọi knowledge_base_search → quan sát → đủ chưa? → lặp"],
              ["Ví von", "Tra thư viện một lần rồi viết báo cáo ngay", "Nhà nghiên cứu đi lại nhiều kệ sách, đổi chiến lược, kiểm chéo"],
              ["Câu hỏi đơn giản (“định nghĩa tự vệ?”)", "Nhanh, chất lượng gần bằng", "Chậm hơn, không lợi hơn nhiều"],
              ["Câu hỏi phức tạp (say rượu + vô ý gây thương tích nặng + tiền án trộm cắp)", "Từ khóa lần đầu lệch, thiếu thông tin, có thể sai sự thật", "Tách vấn đề, tìm song song, phát hiện mắt xích còn thiếu (“tái phạm”), tìm lần hai, tổng hợp có căn cứ"],
            ]}
          />
          <p>
            Áp vào user memory (Thí nghiệm 3-9): coi toàn bộ lịch sử chat là knowledge base, tool <code>search_user_memory</code>.
            “Đặt lịch bảo dưỡng xe” → tìm lần 1 ra Honda → thấy người dùng từng nhắc Tesla → tìm lần 2 → hỏi lại “Honda đã có lịch thứ Sáu
            hay Tesla chưa có lịch?”. Nhưng với chỉ thị chuyển tiền mâu thuẫn (vợ đặt, chồng sửa, vợ sửa lại) thì các đoạn hội thoại bị
            cô lập không cho biết cái nào có hiệu lực cuối cùng.
          </p>
          <Callout kind="warn" title="Ranh giới an toàn của RAG">
            Tài liệu truy xuất là vật mang điển hình của prompt injection gián tiếp; “đầu độc knowledge base” là ô nhiễm trước khi lập chỉ
            mục. Hai lớp: đánh dấu nguồn (“tài liệu tham khảo, không phải mệnh lệnh”), và không để nội dung truy xuất tự kích hoạt hành
            động có tác dụng phụ (chuyển tiền, xóa, gửi thư) — phải qua phán đoán ủy quyền độc lập.
          </Callout>
        </>
      ),
    },
    {
      id: "contextual",
      title: "Contextual Retrieval và kiến trúc bộ nhớ hai lớp",
      body: (
        <>
          <p>
            Chunking luôn cắt đứt đoạn khỏi context gốc. Anthropic đề xuất <b>Contextual Retrieval</b>: trước khi indexing, dùng LLM
            (xem cả tài liệu) viết một câu prefix cho mỗi đoạn, ví dụ{" "}
            <i>“[Đoạn này trích từ phần ‘Các chỉ số hiệu suất chính’ trong Báo cáo tài chính Q2/2025 của ACME]”</i>, rồi ghép vào đoạn.
            Prefix giúp cả hai nhánh: thêm từ khóa chính xác cho BM25, thêm ngữ nghĩa cho embedding.
          </p>
          <Table
            head={["Kết hợp", "Giảm tỷ lệ truy xuất thất bại (Anthropic)"]}
            rows={[["Contextual + BM25", "−49%"], ["Contextual + BM25 + reranker", "−67%"]]}
          />
          <p className="small muted">
            Chi phí: một lời gọi LLM mỗi đoạn lúc indexing — với prompt caching (cùng tài liệu lặp lại) khoảng 1 USD / 1 triệu token tài
            liệu. Đừng nhầm với “context-aware compression” ở Chương 2: cái này là <b>phép cộng</b> lúc indexing (thêm context cho đoạn),
            cái kia là <b>phép trừ</b> lúc chạy (bỏ phần thừa trong lịch sử).
          </p>
          <Callout kind="ok" title="Kiến trúc bộ nhớ hai lớp — nơi hai mạch của chương hội tụ">
            <b>Lớp 1 · Tổng quan thường trú:</b> một số ít sự kiện quan trọng dạng Advanced JSON Cards luôn nằm trong context (“Hộ chiếu
            của Jessica hết hạn 18/02/2025”). <b>Lớp 2 · Chi tiết theo yêu cầu:</b> Contextual Retrieval trên hội thoại gốc. Chỉ có
            context thường trú thì thiếu chi tiết; chỉ có truy xuất thì không thấy được mối liên hệ ẩn xuyên session. Ghép cả hai mới đạt
            cấp 3: thấy chuyến Tokyo tháng 1 và hộ chiếu hết hạn tháng 2 → truy chi tiết xác nhận → chủ động khuyên gia hạn gấp.
          </Callout>
        </>
      ),
    },
    {
      id: "deep",
      title: "Khám phá tri thức từ dữ liệu, và bộ nhớ đa phương thức",
      body: (
        <>
          <p>
            Nhiều tri thức chuyên môn ẩn trong dữ liệu ca thực tế (như “linh cảm” của bác sĩ lâu năm). Thí nghiệm 3-12 với bộ án hình sự
            CAIL2018: từ <b>truy xuất thông tin</b> sang <b>khám phá tri thức</b>.
          </p>
          <ol>
            <li><b>Trích xuất và cấu trúc hóa:</b> LLM đọc hàng trăm ca mẫu, tự liệt kê yếu tố ảnh hưởng (từ dưới lên) → lược đồ mô-đun: lõi chung (đầu thú, bồi thường…) + mở rộng theo tội danh (số tiền, mức thương tích).</li>
            <li><b>Phân tích nhân tố:</b> mã hóa one-hot (trộm = [1,0,0], cướp = [0,1,0] — không dùng 1, 2, 3 vì thuật toán sẽ hiểu “lừa đảo nặng gấp 3 trộm”), phân cụm KMeans tìm “nguyên mẫu vụ án”, rồi xây model tầm quan trọng của yếu tố.</li>
            <li><b>Ứng dụng:</b> Agent hỏi người dùng theo thứ tự tầm quan trọng của yếu tố, tìm nguyên mẫu gần nhất, giải thích dựa trên thống kê của nguyên mẫu — không phải hộp đen.</li>
          </ol>
          <h3>Bộ nhớ đa phương thức (tiên phong)</h3>
          <Table
            head={["Cách", "Làm thế nào", "Đánh đổi"]}
            rows={[
              ["1. Dữ liệu gốc + mô tả chữ", "Cắt khuôn mặt, lưu ảnh, mô tả và indexing bằng chữ; khi cần thì đọc lại ảnh gốc để so", "Vẫn phụ thuộc mô tả chữ"],
              ["2. Embedding trong context", "Mỗi khuôn mặt/giọng = 1 embedding = 1 token; 1.000 token chứa 1.000 khuôn mặt; chú ý tự tìm cái gần nhất", "Hiệu quả, nhưng chiếm context"],
              ["3. Embedding trong tham số", "Không huấn luyện LoRA (nhắc lại được nhưng không dùng được khi suy luận gián tiếp) mà ghi vào ô hash N-gram của model Engram", "Mở rộng tốt hơn, cần model hỗ trợ Engram"],
            ]}
          />
        </>
      ),
    },
  ],
  pitfalls: [
    { wrong: "Lưu nguyên văn mọi câu hội thoại làm “bộ nhớ”.", right: "Một lần gọi LLM sau session để trích xuất: chọn lọc, trừu tượng, có cấu trúc." },
    { wrong: "Khi có thông tin mới mâu thuẫn, ghi đè thẳng bản cũ.", right: "Giữ lịch sử kèm thời gian (chỉ thêm), xử lý xung đột lúc truy xuất hoặc ghi rõ phạm vi áp dụng của từng phát biểu." },
    { wrong: "Đổ toàn bộ phiếu/ca thô vào kho vector rồi tin rằng RAG sẽ tự tổng hợp.", right: "Đầu tư ở giai đoạn indexing: tóm tắt thống kê, rule card nêu rõ ranh giới, structured index." },
    { wrong: "Chỉ dùng dense retrieval (hoặc chỉ BM25).", right: "Kết hợp cả hai + RRF + reranker; đo bằng recall@k, MRR trên bộ câu hỏi có đáp án." },
    { wrong: "Chunking rồi indexing ngay, đoạn “doanh thu tăng 3%” không biết của ai.", right: "Contextual Retrieval: thêm prefix nguồn (công ty, kỳ, mục) cho mỗi đoạn." },
    { wrong: "Để một LLM tự sửa thẳng knowledge base/bộ nhớ trên nhánh chính.", right: "PR + Proposer–Reviewer khác họ model, có bằng chứng, CI, hoàn tác được; index dựng lại từ session bản đã hợp nhất." },
    { wrong: "Lọc quyền sau khi đã đưa tài liệu vào context.", right: "Lọc quyền ngay ở lớp truy xuất; cách ly index theo tenant." },
  ],
  demos: [
    { id: "bm25", title: "Phòng thí nghiệm BM25 và Contextual Retrieval", component: BM25Lab,
      desc: "Gõ câu hỏi, xem từng từ đóng góp bao nhiêu điểm; bật prefix context để thấy kết quả đổi ra sao." },
    { id: "rrf", title: "Hợp nhất dense + sparse bằng RRF", component: RRFDemo,
      desc: "Hai nhánh truy xuất cho hai danh sách khác nhau — RRF gộp chúng chỉ bằng thứ hạng." },
    { id: "cats", title: "Bài toán đếm mèo: vì sao top-k không thay được tổng hợp", component: CatCountDemo,
      desc: "Kéo top-k, bấm hỏi lại nhiều lần, rồi bật bản tóm tắt đã indexing." },
    { id: "mem0", title: "Mem0 v2 vs v3: ghi đè hay chỉ thêm?", component: Mem0Demo,
      desc: "Đi qua 3 session hội thoại và xem hai kiểu kho bộ nhớ khác nhau thế nào." },
    { id: "memtype", title: "Đây là loại trí nhớ nào?", component: MemoryTypeDemo,
      desc: "Phân loại theo khoa học nhận thức: phân đoạn, ngữ nghĩa hay thủ tục." },
  ],
  lab: {
    intro: (
      <>
        <LabSetup />
        <p>
          Chương này thêm <code>miniagent/retrieval.py</code>: BM25 viết tay (~50 dòng, không cần thư viện) và hàm hợp nhất RRF. Truy
          xuất dense cần model embedding riêng nên bài lab tập trung vào nhánh sparse — cách hợp nhất thì y hệt.
        </p>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Xem <code>miniagent/retrieval.py</code></summary>
          <Code lang="python">{retrievalPy}</Code>
        </details>
      </>
    ),
    steps: [
      {
        id: "contextual", title: "BM25 và Contextual Retrieval", file: "ch03/contextual_retrieval.py", code: contextualPy,
        run: ["python3 ch03/contextual_retrieval.py --explain"],
        observe: (
          <ul>
            <li>hit@1 của index thường và index theo context khác nhau bao nhiêu?</li>
            <li>Đọc dòng <code>BM25:</code> — vì sao “doanh”, “quý” có IDF = 0? (gợi ý: xuất hiện trong quá nửa số đoạn)</li>
            <li>Prefix do model của bạn viết có nêu đủ tên công ty và kỳ báo cáo không?</li>
          </ul>
        ),
        result: <p className="small">Chạy với <code>--mock</code> (prefix viết sẵn theo tiêu đề): hit@1 tăng từ <b>1/5 lên 3/5</b>, hit@3 từ 4/5 lên 5/5.</p>,
      },
      {
        id: "agentic_rag", title: "RAG thường, Agentic RAG và rule card", file: "ch03/agentic_rag.py", code: agenticRagPy,
        run: [
          "python3 ch03/agentic_rag.py --mode plain",
          "python3 ch03/agentic_rag.py --mode plain --rule-card",
          "python3 ch03/agentic_rag.py --mode agentic",
        ],
        observe: (
          <ul>
            <li>Kho không có phiếu nào về y tá. RAG thường lấy được phiếu nào, và kết luận dựa trên “láng giềng” nào?</li>
            <li>Agent ở chế độ tác tử có tự tìm thêm để xác định <i>phạm vi</i> chính sách không, hay dừng sau lần tìm đầu?</li>
            <li>Thêm <code>--rule-card</code>: câu trả lời có ổn định và đúng không? Đó là bài học “đầu tư ở giai đoạn indexing”.</li>
          </ul>
        ),
        result: <p className="small">Với <code>--mock</code>: RAG thường lấy phiếu giáo viên làm láng giềng gần nhất và <b>tự tin trả lời “Không”</b> (sai); thêm rule card thì trả lời đúng.</p>,
      },
      {
        id: "user_memory", title: "User memory: Simple Notes vs JSON Cards", file: "ch03/user_memory.py", code: userMemoryPy,
        run: ["python3 ch03/user_memory.py --format notes", "python3 ch03/user_memory.py --format cards"],
        observe: (
          <ul>
            <li>So bộ nhớ cuối cùng của hai định dạng: định dạng nào còn giữ được “bác sĩ Trần là bác sĩ của <b>bố</b>”?</li>
            <li>Câu “đang sống ở đâu?”: bộ nhớ có xử lý đúng việc chuyển nhà không, có còn biết trước đây sống ở Hà Nội không?</li>
            <li>Câu cấp 3 (vé Tokyo 20/11/2026): Agent có chủ động cảnh báo hộ chiếu hết hạn 01/12/2026 không? Nếu không, bạn sẽ sửa Harness thế nào (gợi ý: User as Code — hàm <code>check()</code>)?</li>
          </ul>
        ),
      },
    ],
  },
  apply: [
    {
      title: "Thiết kế bộ nhớ cho Agent của bạn",
      prompt: <p>Agent của bạn cần nhớ gì về người dùng? Liệt kê 8–10 loại thông tin, rồi với mỗi loại chọn: lưu ở đâu (trajectory / dài hạn / trạng thái nghiệp vụ), định dạng (Simple Notes / Advanced JSON Cards), loại trí nhớ (episodic / semantic / procedural). Viết 2 câu hỏi kiểm tra cho mỗi cấp của khung 3 cấp.</p>,
      hint: <p>Ưu tiên Advanced JSON Cards cho thứ ít mà quan trọng và dễ nhầm người (người thân, bác sĩ, tài khoản). Câu hỏi cấp 3 nên là kiểu “chủ động cảnh báo” — thứ người dùng không hỏi nhưng cần biết.</p>,
    },
    {
      title: "Tìm “bài toán đếm mèo” trong kho tài liệu của bạn",
      prompt: <p>Trong tài liệu công ty/nhóm bạn, có câu hỏi nào cần <b>tổng hợp</b> nhiều tài liệu (thống kê, quy tắc có ranh giới “chỉ… còn lại thì không”) mà RAG thường sẽ trả lời sai? Viết thẻ tóm tắt / rule card mà bạn sẽ chắt lọc sẵn để indexing.</p>,
      hint: <p>Dấu hiệu: câu trả lời đúng không nằm trong bất kỳ tài liệu đơn lẻ nào, hoặc cần biết “đã thấy hết chưa”. Rule card tốt nêu rõ cả phạm vi áp dụng lẫn ngoại lệ.</p>,
    },
    {
      title: "Quy trình cập nhật tri thức an toàn",
      prompt: <p>Nếu Agent được phép tự cập nhật tài liệu/quy trình nội bộ, bạn sẽ thiết kế luồng PR thế nào? Ai (model nào) là Proposer, ai là Reviewer, bằng chứng thô lưu ở đâu, CI kiểm gì, khi nào phải có người duyệt?</p>,
      hint: <p>Câu hỏi tư duy ★★★ của sách: nếu Reviewer và Proposer dùng cùng model và Reviewer chỉ được xem đoạn hội thoại do Proposer chọn, lỗi nào vẫn lọt? Cải thiện theo 3 hướng: độc lập model, độ bao phủ bằng chứng, quyền dùng tool.</p>,
    },
  ],
  glossary: [
    { en: "User memory", vi: "Bộ nhớ người dùng", note: "Thông tin cá nhân hóa bền vững xuyên phiên, gắn với một người." },
    { en: "Knowledge base", vi: "Cơ sở tri thức", note: "Tri thức dùng chung cho mọi người dùng." },
    { en: "Episodic / Semantic / Procedural memory", vi: "Trí nhớ phân đoạn / ngữ nghĩa / thủ tục", note: "Sự kiện cụ thể / tri thức khái quát / quy trình hành vi." },
    { en: "Working memory", vi: "Trí nhớ làm việc", note: "Tập con đã lọc và kích hoạt trong cửa sổ ngữ cảnh hiện tại." },
    { en: "JSON Cards (advanced)", vi: "Thẻ JSON nâng cao", note: "Sự kiện + backstory, person, relationship, thời gian." },
    { en: "RAG", vi: "Sinh có tăng cường truy xuất", note: "Truy xuất đoạn liên quan rồi đưa vào ngữ cảnh để sinh câu trả lời." },
    { en: "Chunking", vi: "Chia đoạn", note: "Cắt tài liệu thành đoạn để truy xuất độc lập; 256–1024 token, chồng lấn 10–20%." },
    { en: "Dense embedding", vi: "Nhúng dense", note: "Vector ngữ nghĩa; đo gần nhau bằng cosine." },
    { en: "Sparse / BM25", vi: "Truy xuất thưa", note: "Khớp từ khóa có trọng số IDF, bão hòa tần suất (k₁), chuẩn hóa độ dài (b)." },
    { en: "ANN (ANNOY, HNSW)", vi: "Tìm láng giềng gần đúng", note: "Chỉ mục để tìm vector gần nhất nhanh trong kho lớn." },
    { en: "RRF", vi: "Hợp nhất thứ hạng nghịch đảo", note: "score = Σ 1/(k + hạng), k ≈ 60." },
    { en: "Cross-encoder reranker", vi: "Bộ xếp hạng lại", note: "Ghép truy vấn + tài liệu để chấm kỹ top-N; chậm mà chính xác." },
    { en: "recall@k · MRR · nDCG", vi: "Chỉ số truy xuất", note: "Có tìm thấy không · có ở hạng cao không · chất lượng cả danh sách." },
    { en: "RAPTOR", vi: "Chỉ mục cây", note: "Phân cụm + tóm tắt đệ quy từ lá lên gốc." },
    { en: "GraphRAG", vi: "RAG trên đồ thị tri thức", note: "Thực thể + quan hệ; suy luận nhiều bước, phân định thực thể." },
    { en: "Agentic RAG", vi: "Agentic RAG", note: "Truy xuất là công cụ; Agent tự tìm nhiều vòng." },
    { en: "Contextual Retrieval", vi: "Truy xuất theo ngữ cảnh", note: "Thêm tiền tố nguồn cho mỗi đoạn trước khi lập chỉ mục." },
    { en: "PII sanitization", vi: "Khử thông tin định danh", note: "Phát hiện và che dữ liệu nhạy cảm, nên chạy bằng mô hình cục bộ." },
  ],
  quiz: [
    { q: "Ba quy tắc khi trích xuất user memory sau một session là gì?",
      options: ["Đầy đủ, nguyên văn, theo thời gian", "Chọn lọc, trừu tượng, có cấu trúc", "Nhanh, rẻ, nhiều", "Mã hóa, nén, sao lưu"], answer: 1,
      explain: "Bỏ chi tiết ngắn hạn, khái quát thành sở thích lâu dài, lưu vào trường truy hồi được." },
    { q: "Người dùng có hai xe, nói “đặt lịch bảo dưỡng xe cho tôi”. Hành vi đúng thuộc cấp nào và là gì?",
      options: ["Cấp 1 — đặt cho xe đầu tiên", "Cấp 2 — tìm thông tin cả hai xe và hỏi lại xe nào", "Cấp 3 — đặt cả hai", "Không cần bộ nhớ"], answer: 1,
      explain: "Multi-Session Retrieval: gom đủ thông tin rồi hỏi lại thay vì đoán." },
    { q: "Định dạng bộ nhớ nào phân biệt được “bác sĩ Zhang là nha sĩ của tôi” với “bác sĩ Zhang là bác sĩ tim mạch của bố tôi”?",
      options: ["Simple Notes", "Enhanced Notes", "JSON Cards", "Advanced JSON Cards (person, relationship, backstory)"], answer: 3,
      explain: "Các trường person/relationship cho biết thông tin “cho ai”, backstory cho biết “vì sao”." },
    { q: "Điểm khác cốt lõi giữa Mem0 v2 và v3?",
      options: ["v3 dùng đồ thị", "v2 xử lý xung đột lúc ghi (UPDATE/DELETE), v3 chỉ ADD và xử lý lúc truy xuất", "v3 bỏ LLM", "v2 nhanh hơn"], answer: 1,
      explain: "v3 giữ lịch sử, giảm lời gọi LLM, và tăng LoCoMo 71,4 → 92,5." },
    { q: "Vì sao hybrid retrieval dùng RRF thay vì cộng điểm cosine với điểm BM25?",
      options: ["RRF nhanh hơn", "Hai loại điểm khác thang đo và phân phối, không so trực tiếp được", "BM25 luôn sai", "Cosine luôn âm"], answer: 1,
      explain: "Cosine thường 0–1, BM25 0–hàng chục. RRF chỉ dùng thứ hạng: Σ 1/(k + hạng)." },
    { q: "Trong BM25, tham số b điều khiển gì?",
      options: ["Độ bão hòa tần suất", "Cường độ chuẩn hóa theo độ dài tài liệu", "Số kết quả trả về", "Trọng số IDF"], answer: 1,
      explain: "b = 0 không xét độ dài, b = 1 chuẩn hóa hoàn toàn; k₁ mới điều khiển bão hòa tần suất." },
    { q: "Cross-encoder khác bi-encoder thế nào?",
      options: ["Cross-encoder mã hóa truy vấn và tài liệu riêng rẽ", "Cross-encoder ghép truy vấn + tài liệu vào cùng một lần chấm — chậm hơn nhưng chính xác hơn", "Không khác", "Bi-encoder chính xác hơn"], answer: 1,
      explain: "Bi-encoder để sàng lọc nhanh ở quy mô lớn; cross-encoder để rerank top-N." },
    { q: "Kho có 100 hồ sơ mèo riêng lẻ (90 đen, 10 trắng). Hỏi tỷ lệ. Cách khắc phục đúng là?",
      options: ["Tăng top-k lên 50", "Dùng model lớn hơn", "Tạo sẵn bản tóm tắt thống kê và indexing nó", "Dùng GraphRAG"], answer: 2,
      explain: "Attention là truy xuất mềm, không tự tổng hợp. Đầu tư ở giai đoạn indexing." },
    { q: "Vì sao tăng k KHÔNG giải quyết được câu hỏi “y tá có được giảm giá không” khi kho chỉ có các phiếu ca riêng lẻ?",
      options: ["Vì k bị giới hạn", "Vì câu nêu ranh giới “chỉ… còn lại đều không” không tồn tại trong bất kỳ phiếu nào", "Vì y tá không có trong từ điển", "Vì BM25 lỗi"], answer: 1,
      explain: "Thiếu ngữ nghĩa ranh giới; cần rule card chắt lọc từ toàn bộ phiếu." },
    { q: "RAPTOR phù hợp nhất với kiểu truy vấn nào?",
      options: ["Quan hệ giữa A và B", "Đi từ khái niệm tổng quát xuống chi tiết", "Khớp mã lỗi chính xác", "Đếm số lượng"], answer: 1,
      explain: "Cây tóm tắt nhiều tầng: tổng quan ở gốc, chi tiết ở lá. GraphRAG mới giỏi quan hệ nhiều bước." },
    { q: "Contextual Retrieval làm gì?",
      options: ["Nén lịch sử hội thoại lúc chạy", "Thêm prefix mô tả nguồn cho mỗi đoạn trước khi indexing", "Rerank kết quả", "Tạo knowledge graph"], answer: 1,
      explain: "Phép cộng lúc indexing; giảm 49% (BM25) – 67% (+rerank) tỷ lệ truy xuất thất bại." },
    { q: "Kiến trúc bộ nhớ hai lớp để đạt “Proactive Service” gồm những gì?",
      options: ["Hai cơ sở dữ liệu vector", "Advanced JSON Cards thường trú (tổng quan) + Contextual Retrieval lấy chi tiết", "Trajectory + system prompt", "Simple Notes + GraphRAG"], answer: 1,
      explain: "Thường trú cho tầm nhìn toàn cục, truy xuất cho chi tiết chính xác." },
    { q: "Theo sách, Proposer và Reviewer khi cập nhật tri thức nên…",
      options: ["Dùng cùng một model cho nhất quán", "Là hai lời gọi API cố định", "Là Agent có tool, dùng model năng lực tương đương nhưng khác họ", "Reviewer chỉ đọc tóm tắt của Proposer"], answer: 2,
      explain: "Khác họ để giảm cùng sai một chỗ; Reviewer phải đối chiếu với bằng chứng thô." },
  ],
  cards: [
    { front: "User memory vs knowledge base?", back: "Một người (“trợ lý hiểu bạn”) vs mọi người (“chuyên gia miền”). Chung kỹ thuật truy xuất, chung rắc rối: xung đột, hết hạn, truy xuất sai." },
    { front: "3 quy tắc trích xuất bộ nhớ?", back: "Chọn lọc · trừu tượng · có cấu trúc." },
    { front: "Khung đánh giá bộ nhớ 3 cấp?", back: "Basic Recall → Multi-Session Retrieval → Proactive Service." },
    { front: "4 định dạng lưu bộ nhớ?", back: "Simple Notes · Enhanced Notes · JSON Cards · Advanced JSON Cards (+backstory, person, relationship)." },
    { front: "3 hệ phân loại bộ nhớ trực giao?", back: "Lưu ở đâu (trajectory/long-term memory/business state) × lưu thế nào (4 định dạng) × lưu cái gì (episodic/semantic/procedural)." },
    { front: "Mem0 v3 khác v2?", back: "Chỉ ADD kèm thời gian, xử lý xung đột lúc truy xuất (lai: ngữ nghĩa + BM25 + thực thể + thời gian). LoCoMo 71,4 → 92,5." },
    { front: "Kích thước đoạn khởi điểm?", back: "256–1024 token, chồng lấn 10–20%, rồi tinh chỉnh theo đo đạc." },
    { front: "IDF trong BM25?", back: "ln((N − df + 0,5)/(df + 0,5)) — từ hiếm nặng ký; từ có trong quá nửa tài liệu bị chặn về 0." },
    { front: "k₁ và b trong BM25?", back: "k₁: bão hòa tần suất. b: chuẩn hóa theo độ dài tài liệu." },
    { front: "RRF?", back: "score = Σ 1/(k + hạng), k ≈ 60. Bỏ điểm gốc, chỉ dùng thứ hạng." },
    { front: "Bi-encoder vs cross-encoder?", back: "Lướt CV (nhanh, mã hóa riêng) vs phỏng vấn từng ứng viên (ghép truy vấn+tài liệu, chính xác)." },
    { front: "Vì sao RAG phẳng thất bại ở “đếm mèo” và “ranh giới”?", back: "Chú ý/truy xuất là tra cứu mềm, không tổng hợp; thiếu ngữ nghĩa ranh giới; không biết mình chưa thấy hết." },
    { front: "RAPTOR vs GraphRAG?", back: "Cây tóm tắt (tổng quát → chi tiết) vs đồ thị thực thể–quan hệ (nhiều bước nhảy, phân định thực thể)." },
    { front: "OpenViking L0/L1/L2?", back: "Tóm tắt ~100 token · tổng quan ~2K token · toàn văn khi cần. Cần thêm liên kết ngang kiểu Wikipedia." },
    { front: "Cập nhật tri thức gia tăng?", back: "PR: Proposer đề xuất diff + bằng chứng → Reviewer khác họ kiểm → lặp có giới hạn → CI → hợp nhất → dựng lại index." },
    { front: "3 lớp dữ liệu tri thức?", back: "Bằng chứng thô (chỉ thêm) · tri thức (sửa qua PR) · phục vụ (index dựng lại được)." },
    { front: "Contextual Retrieval hiệu quả bao nhiêu?", back: "Giảm tỷ lệ truy xuất thất bại 49% (+BM25), 67% (+reranker); ~1 USD/1M token với prompt caching." },
    { front: "Kiến trúc bộ nhớ hai lớp?", back: "Advanced JSON Cards thường trú (tổng quan) + Contextual Retrieval (chi tiết theo yêu cầu) → Proactive Service." },
  ],
};
