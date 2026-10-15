import type { Chapter } from "../lib/types";
import { Callout, Code, Formula, Table } from "../components/ui";
import { Classifier } from "../demos/Classifier";
import { GRPOGroup, MiniRL, RatioDrift } from "../demos/TrainDemos";
import { LabSetup } from "./labSetup";
import grpoPy from "../../../agent-lab/ch08/grpo_toy.py?raw";

function StageDemo() {
  return (
    <Classifier
      options={["Không train", "Mid-training", "SFT", "RL"]}
      items={[
        { text: "Agent hay trả lời sai giá sản phẩm vì bảng giá đổi mỗi tuần", answer: "Không train", why: "Dữ kiện thay đổi, cần trích dẫn, cần xóa được → RAG. Đừng nhét vào tham số." },
        { text: "Model không biết thuật ngữ y khoa tiếng Việt; lấy mẫu 64 lần vẫn không lần nào đúng (pass@64 ≈ 0)", answer: "Mid-training", why: "Kiến thức nằm ngoài effective support của base model. RL trên rollout toàn 0 chỉ đốt ngân sách." },
        { text: "Model làm đúng ý nhưng 30% output JSON không parse được", answer: "SFT", why: "Thiếu protocol, không thiếu năng lực. SFT (hoặc constrained decoding) ổn định format để reward tính được." },
        { text: "Pass@1 = 20%, pass@16 = 85%, verifier tin cậy, nhưng gặp tình huống mới vẫn yếu", answer: "RL", why: "Chiến lược đúng đã có trong phân phối nhưng xác suất thấp — RL dồn xác suất về đó và tổng quát hóa tốt hơn." },
        { text: "Agent quên kiểm tra số dư trước khi chuyển tiền — một quy tắc cố định, ổn định nhiều năm", answer: "Không train", why: "Ràng buộc tất định nên được code đảm bảo, không để model nhớ." },
        { text: "Có vài nghìn hội thoại mẫu chất lượng cao, chưa có môi trường tương tác", answer: "SFT", why: "Có dữ liệu bắt chước, không có online feedback → SFT/RFT/offline preference; dựng baseline trước rồi mới tính dựng môi trường RL." },
      ]}
    />
  );
}

function RewardDemo() {
  return (
    <Classifier
      options={["Outcome reward", "Process reward", "Path penalty (RLVP)", "Generative reward"]}
      items={[
        { text: "Robot chưa ai biết cách làm tối ưu; chỉ biết thành công hay thất bại", answer: "Outcome reward", why: "SimpleVLA-RL: chỉ thưởng kết quả để giữ không gian khám phá — tìm ra động tác “pushcut” chưa từng có trong demo." },
        { text: "Điều hướng phố: mỗi ngã rẽ đúng/sai kiểm được ngay", answer: "Process reward", why: "V-IRL: tín hiệu dày giúp credit assignment trên chuỗi dài, đổi lại có thể bó hẹp đường đi." },
        { text: "Agent pass test nhưng đôi khi sửa luôn file test hoặc chạy lệnh xóa thư mục", answer: "Path penalty (RLVP)", why: "Vi phạm phát hiện rẻ và chắc bằng rule; giữ outcome reward, trừ điểm hành động cụ thể." },
        { text: "Đánh giá chất lượng bản tóm tắt nghiên cứu dài, không có đáp án", answer: "Generative reward", why: "GRM đưa ra chẩn đoán bằng lời; cần fact-check và người duyệt mẫu để giám khảo không lệch." },
        { text: "Bài toán có đáp án số chính xác", answer: "Outcome reward", why: "Có đáp án/test xác định → binary scalar (RLVR) là rẻ, tái lập được, khó gian lận nhất." },
      ]}
    />
  );
}

export const ch8: Chapter = {
  id: 8,
  title: "Model Post-Training",
  short: "Post-Training",
  tier: "Đánh giá & cải tiến",
  minutes: 60,
  ready: true,
  oneLiner: "Khi prompt, tool và code không đủ: viết năng lực vào tham số. Mid-training sửa nền móng, SFT dạy protocol, RL tối ưu chiến lược — và dữ liệu, môi trường quan trọng hơn thuật toán.",
  keyIdeas: [
    "Bốn giai đoạn: Pre-training (đoán token tiếp theo trên dữ liệu internet) → Mid-training (tiếp tục đoán token trên phân phối đích, lấp lỗ hổng kiến thức/ngôn ngữ) → SFT (vẫn đoán token, nhưng chỉ tính loss trên phần trả lời) → RL (tối đa hóa reward kỳ vọng).",
    "Trước khi train: loại trừ cách không đụng tham số (prompt, tool, code, RAG). Rồi đo pass@k: ≈ 0 → Mid-training; parse lỗi → SFT; có reward variance → RL.",
    "SFT: bắt chước, mass-covering, rẻ, ổn định, dễ overfit demo. RL: tối đa reward, mode-seeking, đắt gấp 10–100 lần, tổng quát hóa tốt hơn trong các thí nghiệm (GeneralPoints: SFT −8,1 vs RL +3,5 điểm trên rule OOD).",
    "GRPO: 16 rollout cùng đề → reward → relative advantage (R − mean)/std → policy gradient. Cả nhóm cùng điểm → advantage = 0 → không học.",
    "On-policy: dữ liệu sinh từ chính policy đang train. Sampler/trainer lệch số học vài phần nghìn mỗi token đã đủ biến on-policy thành off-policy và làm sụp training.",
    "Môi trường là điều kiện tiên quyết của RL: sát thực tế, reset được, song song được. Không dựng được thì cho LLM đóng vai môi trường — nhưng thiên lệch của simulator là trần của training.",
    "Reward: nguồn (rule / preference / model), thời điểm (outcome vs process), lượng thông tin (scalar / vector / generative). RLVP: reward the outcome, penalize the path.",
    "On-Policy Distillation: student tự đi, teacher chấm từng token → một rollout cho T tín hiệu thay vì một số 0/1. Không có teacher mạnh hơn → OPSD: chính model, có thêm đáp án đặc quyền.",
  ],
  sections: [
    {
      id: "stages",
      title: "Bốn giai đoạn hình thành năng lực model",
      body: (
        <>
          <Table
            head={["Giai đoạn", "Dữ liệu", "Mục tiêu tối ưu", "Học được gì", "Chi phí"]}
            rows={[
              ["Pre-training", "Văn bản internet khổng lồ", "Đoán token tiếp theo", "Quy luật ngôn ngữ, kiến thức thế giới, suy luận cơ bản", "Rất cao (triệu–chục triệu USD)"],
              ["Mid-training", "Corpus ngôn ngữ/domain đích + retention data", "Tiếp tục next-token, loss trên mọi token", "Lấp lỗ hổng kiến thức, ngôn ngữ, năng lực nền", "Trung bình–cao"],
              ["SFT", "Vài nghìn–vài chục nghìn cặp input–output", "Next-token, loss chỉ trên phần response", "Làm theo chỉ dẫn, format, style, quy trình", "Thấp (giờ–ngày)"],
              ["RL", "Task + môi trường + reward", "Tối đa hóa reward kỳ vọng", "Chiến lược ra quyết định, lời giải mới", "Cao (gấp hàng chục–trăm lần SFT)"],
            ]}
          />
          <p>
            Điểm dễ bị bỏ qua: <b>SFT về bản chất vẫn là “đoán token tiếp theo”</b>, chỉ khác dữ liệu và <b>loss masking</b> — phần prompt không
            tính loss, model chỉ học cách trả lời. <b>LoRA</b> đóng băng weight gốc, chỉ học hai ma trận hạng thấp: rẻ, ít quên hơn
            full fine-tuning (nhưng không miễn nhiễm). Learning rate của LoRA thường cao hơn khoảng 10 lần; rank 64–256 cho SFT, 8–32 cho RL là đủ
            vì RL mang ít bit thông tin mỗi episode.
          </p>
          <Callout title="Mid-training: sửa nền móng">
            Khi model không biết ngôn ngữ, khái niệm domain hay thao tác cơ bản, SFT và RL không cứu được. Mid-training tiếp tục pre-train trên
            phân phối đích, trộn thêm dữ liệu cũ để không quên (ví dụ học tiếng Hàn trên Mistral: khoảng 80% dữ liệu mới / 20% dữ liệu giữ lại).
            Dữ liệu cần lọc, khử trùng lặp, cân bằng và có retention set để đo forgetting.
          </Callout>
        </>
      ),
    },
    {
      id: "choose",
      title: "Chọn Mid-training, SFT hay RL",
      body: (
        <>
          <p>
            RL không bắt chước token mẫu mà chấm những gì model tự sinh ra. Muốn học được cần hai điều kiện: <b>format support</b> (output phải
            parse được thì reward mới tính được) và <b>capability support</b> (policy hiện tại thỉnh thoảng phải làm đúng).
          </p>
          <Formula>pass@k = 1 − (1 − p)^k &nbsp;·&nbsp; pass@1 thấp nhưng pass@k tăng rõ theo k → RL có cái để khuếch đại</Formula>
          <Table
            head={["Hiện tượng", "Thiếu gì", "Cách ưu tiên", "Điều kiện chuyển bước"]}
            rows={[
              ["Không biết khái niệm/ngôn ngữ; pass@k ≈ 0", "Kiến thức, năng lực nền", "Mid-training (RAG cho dữ kiện động)", "Bắt đầu có trajectory đúng/đúng một phần; general retention ổn"],
              ["Thỉnh thoảng đúng nhưng format, schema, giọng điệu không ổn định", "Protocol hành vi", "SFT hoặc constrained decoding", "Parse ổn định; verifier chấm được hành động then chốt"],
              ["Success > 0, reward tin cậy, nhưng chiến lược tốt có xác suất thấp, OOD yếu", "Phân bổ xác suất, chiến lược", "RL", "Reward khớp mục tiêu thật, nhóm rollout có chênh lệch, test độc lập tăng"],
              ["Có vài demo tốt, không có môi trường tương tác", "Online feedback", "SFT / RFT / offline preference", "Dựng baseline và evaluation trước, rồi mới tính dựng môi trường RL"],
            ]}
          />
          <ol>
            <li><b>Loại trừ cách không đổi weight trước:</b> prompt, tool, code, context management. Dữ kiện cần cập nhật/trích dẫn/xóa → RAG.</li>
            <li><b>Đo capability support</b> trên held-out set: pass@1, pass@k, partial-progress rate, parse rate, đọc tay lý do thất bại.</li>
            <li><b>SFT để dựng protocol</b>, không phải để nhét knowledge base.</li>
            <li><b>RL chỉ khi có gì để khám phá.</b> GRPO trên rollout toàn 0 điểm chỉ đốt ngân sách sampling.</li>
          </ol>
          <p className="small muted">
            “SFT trước, RL sau” chỉ đúng khi format chưa ổn định. Base model đủ mạnh có thể vào thẳng RL (DeepSeek-R1-Zero); cold-start SFT sau đó
            chủ yếu cải thiện khả năng đọc và nhất quán ngôn ngữ.
          </p>
        </>
      ),
    },
    {
      id: "sft-rl",
      title: "SFT vs RL — bảng quan trọng nhất chương",
      body: (
        <>
          <Table
            head={["", "SFT", "RL"]}
            rows={[
              ["Mục tiêu", "Tối đa xác suất câu trả lời mẫu (maximum likelihood)", "Tối đa reward kỳ vọng"],
              ["Tín hiệu", "Giám sát từng token trên response có nhãn", "Response do policy tự sinh + reward vô hướng"],
              ["Áp lực tối ưu", "Bắt chước ánh xạ và protocol trong demo", "Củng cố hành vi kiếm được reward"],
              ["Khi phân phối dịch chuyển", "Phụ thuộc độ phủ demo; ít demo → overfit", "Phụ thuộc reward, môi trường, khám phá; chuyển giao tốt hơn trong thí nghiệm"],
              ["Hiệu quả mẫu / ổn định", "Cao / hội tụ nhanh", "Thấp (gấp 10–100 lần) / dễ dao động"],
              ["Hợp với", "Cố định format/style/quy trình", "Cần tổng quát hóa, khám phá chiến lược tối ưu"],
            ]}
          />
          <p>
            Nhìn theo phân phối: SFT có xu hướng <b>mass-covering</b> (phủ mọi “mode” xuất hiện trong demo), RL với reverse-KL có xu hướng{" "}
            <b>mode-seeking</b> (dồn xác suất vào vài mode reward cao). Post-training còn quyết định <b>ngưỡng hành động</b>: model đọc thêm file
            hay sửa ngay rồi dùng test để chỉnh — đó là policy nằm trong tham số, không phải “tính cách”.
          </p>
          <Callout title="Thí nghiệm: nhớ hay tổng quát hóa?">
            <b>GeneralPoints</b> (tính 24 từ 4 lá bài): demo hạn chế dạy J/Q/K = 10; đổi luật khi test → SFT −8,1 điểm, RL +3,5 điểm (rule OOD); đổi
            giao diện hình ảnh → SFT −9,9, RL +17,6. <b>AdaptThink</b>: RL dạy model tự chọn nghĩ hay không nghĩ — MATH500 0,81 → 0,818 trong khi độ
            dài trả lời giảm 67,9%.
          </Callout>
        </>
      ),
    },
    {
      id: "data",
      title: "Dữ liệu SFT: từ demo đến trajectory huấn luyện được",
      body: (
        <>
          <Formula>production data → task blueprint → synthetic task → nhiều candidate trajectory → task verification + trajectory verification → SFT data</Formula>
          <ul>
            <li><b>Seed của người + teacher model + verifier:</b> người định nghĩa format và ranh giới, teacher nhân rộng, rule/spot check giữ chất lượng.</li>
            <li><b>Rejection sampling fine-tuning (RFT):</b> sinh nhiều ứng viên cho cùng đề, chỉ giữ những cái qua verification.</li>
            <li><b>Không replay log production:</b> rút ra cấu trúc nhiệm vụ (ý định, trạng thái đầu, tool, ràng buộc, kiểu thất bại, điều kiện thành công), bỏ thông tin định danh, sinh lại người/đơn hàng/file hư cấu.</li>
            <li><b>Trajectory thất bại không phải demo đúng:</b> dùng làm preference pair (DPO), để lộ lỗ hổng phủ, hoặc thêm vào sau khi đã chẩn đoán và sửa.</li>
            <li><b>Quan trọng là coverage, diversity, accuracy — không phải số lượng.</b> Chia train/eval theo template, khách hàng hoặc thời gian; hidden test không được lọt vào model.</li>
          </ul>
          <p className="small muted">
            Các thí nghiệm SFT trong sách: voice SFT (từ nhái giọng đến ngữ điệu), multilingual thinking, <b>prompt distillation</b> (học thuộc
            một system prompt dài để rẻ hơn khi chạy), <b>CoT distillation</b> (học chuỗi suy luận của teacher).
          </p>
        </>
      ),
    },
    {
      id: "grpo",
      title: "GRPO: từ 16 rollout đến một lần cập nhật tham số",
      body: (
        <>
          <ol>
            <li><b>Rollout:</b> cùng một task (vd một issue SWE-bench), policy hiện tại chạy 16 lần song song.</li>
            <li><b>Reward:</b> hidden test chấm từng rollout, vd 4/16 pass.</li>
            <li><b>Relative advantage:</b> so với trung bình nhóm — không cần value network.</li>
            <li><b>Gradient descent:</b> tăng xác suất các lựa chọn trong trajectory advantage dương, giảm ở trajectory âm. Không học thuộc patch nào, mà dịch dần cả policy.</li>
          </ol>
          <Formula>A_i = (R_i − mean(R)) / std(R) &nbsp;·&nbsp; L = −E[min(r(θ)·A, clip(r(θ), 1−ε, 1+ε)·A)], ε = 0,2</Formula>
          <p>
            Ví dụ 24 game: R = [0, 1, 0, 0] → A = [−0,58, +1,73, −0,58, −0,58]. Cả 16 fail hoặc cả 16 pass → A = 0, không học gì — đó là lý do
            cần partial reward, process reward, path signal. Một step với Agent phức tạp có thể mất ~2.000 giây rollout (chờ rollout chậm nhất) +
            600 giây update ≈ 43 phút; 100 step ≈ 72 giờ.
          </p>
          <p>
            <b>PPO</b> train thêm một value model ước lượng “bình thường làm tốt đến đâu” ở từng bước — hợp với trajectory dài cần credit
            assignment tinh. <b>DPO</b> thì học offline từ cặp “tốt hơn — tệ hơn”, không rollout online.
          </p>
          <Callout kind="warn" title="On-policy và lệch số học sampler/trainer">
            Rollout sinh bằng vLLM/SGLang, gradient tính bằng FSDP/Megatron. Cùng weight nhưng khác precision, thứ tự cộng, kernel → log-prob lệch
            chút ít. Ratio ρ = π_θ/μ đáng lẽ bằng 1 lại trôi đi: 4.000 token lệch 10⁻³ cùng chiều → e⁴ ≈ 54,6. Đo ρ (mean, quantile, max, KL xấp xỉ,
            clip fraction) trước mỗi update như một unit test; đồng bộ cả LoRA adapter, tokenizer, chat template; lưu behavior log-prob lúc sinh.
          </Callout>
        </>
      ),
    },
    {
      id: "env",
      title: "Môi trường RL: từ evaluation đến simulation",
      body: (
        <>
          <p>
            Nút thắt của RL thường không phải thuật toán mà là môi trường: <b>sát thực tế, reset được, song song được</b>. Môi trường méo mó
            đảm bảo policy vô dụng — như ôn thi trong phòng khác hẳn phòng thi. Dựng môi trường tốt thường đắt hơn chính việc train.
          </p>
          <ul>
            <li><b>Không dựng được?</b> Để LLM đóng vai môi trường. ZeroSearch: LLM giả làm search engine, ban đầu trả tài liệu tốt rồi dần trộn nhiễu (curriculum). DreamGym: experience model suy luận chuyển trạng thái. Customer service: LLM đóng vai user (τ-bench).</li>
            <li><b>Rủi ro:</b> hiểu biết của simulator là trần, thiên lệch của nó được policy hấp thụ nguyên vẹn, và RL sẽ chủ động tìm lỗ hổng của simulator (reward hacking). Trộn thêm tương tác thật để hiệu chỉnh định kỳ.</li>
            <li><b>Thứ tự kỹ thuật:</b> task blueprint → simulator reset được → verifier tất định → cách ly train/eval (dùng chung generator và verifier, không dùng chung task) → hiệu chỉnh bằng ít tương tác thật.</li>
            <li>Verifier tất định “rẻ” không có nghĩa là miễn phí: chạy test trong container có thể chậm hơn GPU sinh token — throughput do số verifier worker quyết định.</li>
          </ul>
        </>
      ),
    },
    {
      id: "multiturn",
      title: "Multi-turn, credit assignment và tool calling",
      body: (
        <>
          <p>
            Từ một lượt sang nhiều lượt là bước nhảy về độ phức tạp: trạng thái xuyên bước, reward đến muộn, khám phá tốn cả trajectory 10–50
            bước. <b>Credit assignment</b>: Agent CSKH mất 10 lượt rồi được đánh giá tốt — công thuộc về câu hỏi chính xác ở lượt 2 hay lời giải
            thích kiên nhẫn ở lượt 7?
          </p>
          <Table
            head={["", "Process reward (V-IRL)", "Outcome reward (SimpleVLA-RL)"]}
            rows={[
              ["Phản hồi", "Mỗi bước đúng +1 / sai −1", "Chỉ cuối: thành công 1 / thất bại 0"],
              ["Ưu", "Dễ credit assignment, hội tụ nhanh", "Tự do khám phá tối đa (17,3% → 91,7%, tìm ra “pushcut”)"],
              ["Nhược", "Có thể bó hẹp đường đi theo ý người thiết kế", "Train khó hơn"],
            ]}
          />
          <Callout title="Chi tiết then chốt khi train tool calling">
            Token do môi trường trả về (kết quả tool) không do policy sinh ra → phải <b>mask</b> khi tính policy gradient, chỉ lan gradient qua
            phần suy nghĩ và tham số tool call của model. Nếu không, model học đoán output sandbox thay vì học dùng tool. ReTool (code interpreter
            xen kẽ suy luận, PPO): AIME 2024 từ 25% lên 67% sau 400 step (~9 ngày, so với SFT ~1 giờ).
          </Callout>
        </>
      ),
    },
    {
      id: "reward",
      title: "Reward design: biến mục tiêu thành tín hiệu học",
      body: (
        <>
          <Table
            head={["Câu hỏi", "Lựa chọn"]}
            rows={[
              ["Reward từ đâu?", "Verifiable reward (RLVR: test, assertion DB, state diff) → ưu tiên · RLHF (reward model từ preference + KL penalty) · DPO · Generative reward model (chẩn đoán bằng lời)"],
              ["Khi nào cho?", "Outcome (ORM, cuối episode, tự do khám phá) · Process (PRM, từng bước, giảm khó credit assignment)"],
              ["Bao nhiêu thông tin?", "Có đáp án → binary scalar · nhiều mục tiêu độc lập → vector · mở → generative diagnosis + fact-check"],
            ]}
          />
          <p>
            <b>Reward hacking</b> = khai thác lỗ hổng rule để được điểm cao. <b>Reward seeking</b> = model đoán grader sẽ nhìn gì rồi chiều theo:
            tự đặt một bài kiểm tra nông, qua là dừng. “Qua grader” không đồng nghĩa “xong việc”. Phán quyết “đã xong” phải giao cho hidden test,
            state assertion hoặc termination hook model không viết được — không bao giờ tin lời model tự nhận.
          </p>
          <Formula>RLVP: R = normalize(O) + β · normalize(Φ) — O: outcome từ trạng thái cuối · Φ: path signal tính bằng rule tất định mỗi hành động</Formula>
          <ul>
            <li>Môi trường thật là <b>verifier bất đối xứng</b>: phát hiện “làm điều xấu” thì rẻ và chắc; chứng minh “bước này tiến gần mục tiêu” thì khó.</li>
            <li>Bốn nguyên tắc: phạt hành động cụ thể (không phạt “thiếu cố gắng”); luôn giữ outcome reward (kẻo model học cách không làm gì); mỗi hình phạt đi kèm đường tuân thủ với tới được; rule tất định, khó lách.</li>
            <li>TerminalBench: vi phạm 3,71 → 0,66, success gần như không đổi. miniF2F: partial reward giảm số vòng đạt 0,9 từ 7,0 xuống 4,4. Sửa phần mềm khi không rollout nào pass test: progress signal không với tới được → không lợi gì.</li>
          </ul>
          <Code lang="python">{`outcome = verify_final_state(trajectory)        # kết quả thật, không phải lời tự nhận
path_signal = sum(deterministic_path_signal(step) for step in trajectory)
reward = normalize(outcome) + beta * normalize(path_signal)`}</Code>
        </>
      ),
    },
    {
      id: "distill",
      title: "Distillation: tăng sample efficiency",
      body: (
        <>
          <p>
            RL kém hiệu quả mẫu vì phản hồi quá thưa: một rollout dài chỉ cho một số 0/1. Kịch bản CSKH ghi “cần 4 số cuối thẻ” — người nghe
            một lần là nhớ, model có thể mất hàng trăm lần thử.
          </p>
          <Table
            head={["Phương pháp", "Ai sinh trajectory?", "Giám sát chính"]}
            rows={[
              ["SFT / off-policy distillation", "Người hoặc teacher", "Dày, từng token, từ đáp án mẫu"],
              ["On-policy RL", "Student hiện tại", "Thưa: outcome/process reward"],
              ["On-Policy Distillation", "Student hiện tại", "Dày: phân phối token của teacher trên prefix của student"],
            ]}
          />
          <Code lang="python">{`trajectory = rollout(student, task)
loss = sum(KL(student_logits(s), teacher(s)) for s in trajectory)
update_student(loss)`}</Code>
          <p>
            Student quyết định đi đâu, teacher chấm từng bước ở chính chỗ student đã đến → bám lỗi thật của student hơn SFT, dày hơn RL (toán:
            khoảng 1/10 số step so với RL thuần). Không tạo năng lực từ hư không: student phải vào được trạng thái teacher sửa được.
          </p>
          <Callout title="Không có teacher mạnh hơn? OPSD">
            On-Policy Self-Distillation: cùng một model, bản “teacher” thấy thêm <b>thông tin đặc quyền</b> (đáp án đã kiểm chứng, demo, tài liệu),
            bản “student” chỉ thấy đề và học theo phân phối của teacher trên trajectory tự sinh. Thông tin đặc quyền chỉ tồn tại phía train, không
            được lọt vào Agent triển khai; cần regularizer để không mất phong cách suy luận cũ.
          </Callout>
        </>
      ),
    },
    {
      id: "badcases",
      title: "Từ bad case đến post-training",
      body: (
        <>
          <Table
            head={["Dữ liệu đánh giá (Ch7)", "Dùng để train (Ch8)"]}
            rows={[
              ["End-to-end regression task có verifier", "RL rollout + verifiable reward; pool cho RFT"],
              ["Trajectory-prefix regression task", "Cặp preference cho DPO, demo SFT tại ranh giới quyết định, trạng thái cho On-Policy Distillation"],
              ["Failure attribution (bước lỗi đầu, loại lỗi)", "Nhãn âm cho PRM; rule cho path penalty RLVP"],
              ["Rubric nhiều chiều + gold set của người", "Chiều của vector reward; dữ liệu cho GRM"],
            ]}
          />
          <ul>
            <li>
              <b>Premature completion</b> (Coding Agent tuyên bố xong khi chưa chạy test): cắt prefix ngay trước lúc “sắp tuyên bố xong”; rejected =
              tuyên bố sớm, chosen = chạy test, kiểm từng điều kiện nghiệm thu rồi mới kết luận → DPO + LoRA, trộn tỷ lệ nhỏ với dữ liệu chung.
              Đánh giá bằng cả <b>boundary set</b> (chưa xong thì tiếp tục kiểm) lẫn <b>retention set</b> (xong thật thì dám kết thúc) — chỉ nhìn cái
              đầu sẽ được một model không bao giờ dám xong.
            </li>
            <li>
              <b>Dấu ngoặc kép tiếng Trung:</b> “đổi ngoặc thẳng thành ngoặc cong” không phải rule train được. Viết thành Skill nhạy phạm vi: văn xuôi
              thì đổi, code/JSON/path/inline code thì giữ nguyên, không chắc thì không đụng → SFT trên dữ liệu tổng hợp có cả ví dụ âm.
            </li>
            <li>
              <b>edit_file thất bại:</b> truy từng lớp bytes file → tool → Harness serialize → context → token → decode → parse JSON → match. Chỉ khi
              context model nhận đúng nguyên văn mà output model là chỗ lệch đầu tiên mới quy cho model. Exact-copy SFT: byte-exact 37,5% → 78,9%,
              nhưng tokenizer round-trip cũng chỉ 80,1% — đó là trần.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "practice",
      title: "Kinh nghiệm thực hành và phối hợp với RAG, ICL, code",
      body: (
        <>
          <Table
            head={["Cơ chế", "Đặt vào đâu"]}
            rows={[
              ["ICL (in-context learning)", "Ví dụ, rule, trạng thái hiện tại — thích nghi tức thì, không đổi tham số, nhưng context dài thì đắt"],
              ["RAG", "Dữ kiện và bằng chứng cần cập nhật, trích dẫn, phân quyền, xóa"],
              ["Code", "Quy trình tất định, ràng buộc cứng (rule duyệt chuyển tiền)"],
              ["Mid-training", "Kiến thức domain ổn định, năng lực nền"],
              ["SFT + RL", "Hành vi mà rule bên ngoài không diễn đạt hết: nhận diện ảnh y khoa, giọng nói tự nhiên, policy ra quyết định"],
              ["Distillation", "Chuyển hành vi của model lớn sang model nhỏ rẻ hơn"],
            ]}
          />
          <Callout kind="ok" title="Nguyên tắc cốt lõi">
            Kiểm chứng giả định bằng thí nghiệm nhỏ trước khi đổ tài nguyên lớn: corpus Mid-training nhỏ để xem đường cong kiến thức và
            forgetting; tập SFT nhỏ để thử độ ổn định format; batch rollout nhỏ để xem pass@k, reward variance và độ khớp sampler/trainer. Thất bại
            nhanh dễ chấp nhận hơn thất bại ở quy mô lớn.
          </Callout>
        </>
      ),
    },
  ],
  pitfalls: [
    { wrong: "Nhét knowledge base vào SFT.", right: "Kiến thức ổn định → Mid-training; dữ kiện cần cập nhật/trích dẫn/xóa → RAG. SFT dạy cách truy cập và diễn đạt." },
    { wrong: "Chạy RL khi format còn chưa ổn định.", right: "Ổn định output bằng SFT hoặc constrained decoding trước, đặt ngưỡng parse bằng đánh giá nhỏ." },
    { wrong: "Chạy RL khi pass@k ≈ 0.", right: "Rollout toàn 0 thì GRPO mất advantage. Mid-training, SFT/distillation, hoặc curriculum + partial reward trước." },
    { wrong: "Coi context window danh nghĩa là context hiệu dụng.", right: "Qua cổng năng lực ở độ dài hiện tại rồi mới mở rộng; giữ dữ liệu ngắn; kiểm bằng ma trận năng lực × độ dài." },
    { wrong: "Thưởng một proxy trung gian.", right: "Đánh giá mục tiêu cuối bằng hidden test; thêm path penalty cho hành vi vi phạm phát hiện được." },
    { wrong: "Bỏ qua độ trung thực của môi trường mô phỏng.", right: "Môi trường méo → policy vô dụng; trộn tương tác thật để hiệu chỉnh simulator." },
    { wrong: "Coi lệch số học sampler/trainer là nhiễu vô hại.", right: "Theo dõi log-prob diff, KL xấp xỉ, clip fraction, policy staleness." },
    { wrong: "Train quá lâu vì loss train vẫn giảm.", right: "Retention set độc lập + early stopping cho cả Mid-training, SFT và RL." },
    { wrong: "Đánh giá thấp chi phí RL.", right: "RL có thể tốn gấp 10–100 lần SFT; test giống train thì SFT có thể đã đủ." },
  ],
  demos: [
    { id: "stage", title: "Có nên train không? Train kiểu gì?", component: StageDemo, desc: "Chọn cách xử lý cho từng tình huống: không train, Mid-training, SFT hay RL." },
    { id: "grpo", title: "Relative advantage của GRPO", component: GRPOGroup, desc: "Bật/tắt pass/fail và vi phạm của 16 rollout — khi nào có tín hiệu học, khi nào không." },
    { id: "minirl", title: "Mini RL: outcome-only vs RLVP", component: MiniRL, desc: "Chạy GRPO thật (thu nhỏ) ngay trong trình duyệt và xem policy dịch chuyển." },
    { id: "ratio", title: "Lệch số học cộng dồn", component: RatioDrift, desc: "Sai số log-prob nhỏ mỗi token biến thành ratio khổng lồ trên chuỗi dài." },
    { id: "reward", title: "Chọn loại reward", component: RewardDemo, desc: "Outcome, process, path penalty hay generative?" },
  ],
  lab: {
    intro: (
      <>
        <LabSetup />
        <p>
          Bài lab chương này không cần model hay GPU. “Policy” là vài logit chọn giữa các chiến lược sửa bug, nhưng vòng lặp
          rollout → reward → advantage → gradient giống hệt GRPO thật.
        </p>
      </>
    ),
    steps: [
      {
        id: "grpo_toy", title: "GRPO thu nhỏ: pass@k ≈ 0, cold start và RLVP", file: "ch08/grpo_toy.py", code: grpoPy,
        run: ["python3 ch08/grpo_toy.py"],
        observe: (
          <ul>
            <li>Phần 3: vì sao 40 step đầu policy không nhúc nhích? Điều gì thay đổi sau “SFT cold start”?</li>
            <li>Phần 4a: success tăng nhưng chiến lược “xóa test fail” chiếm ưu thế — vì sao outcome reward không thấy được vấn đề?</li>
            <li>Đổi <code>beta</code> ở phần 4b thành 2.0: có chiến lược nào bị phạt oan không? Vì sao sách khuyên normalize hai kênh?</li>
            <li>Đổi <code>group</code> từ 16 xuống 4: học có chậm và nhiễu hơn không?</li>
          </ul>
        ),
        result: (
          <p className="small">
            Phần 3: 40 step vẫn 0% success; sau cold start: 14% → 87%. Phần 4a (β = 0): success ≈ 56%, violation tăng lên ≈ 62%. Phần 4b (β = 0,5):
            success ≈ 57%, violation giảm còn ≈ 2,5%. Phần 5: 4.000 token × 10⁻³ → ρ ≈ 54,6.
          </p>
        ),
      },
    ],
  },
  apply: [
    {
      title: "Chẩn đoán trước khi train",
      prompt: <p>Chọn một hành vi Agent của bạn đang làm chưa tốt. Đi qua 4 bước: có cách không đổi weight không? pass@1, pass@k (k = 8), parse rate là bao nhiêu? Thiếu nền, thiếu protocol hay thiếu chiến lược?</p>,
      hint: <p>Đa số trường hợp dừng ở bước 1: sửa prompt, tool description, thêm rule bằng code, hoặc RAG.</p>,
    },
    {
      title: "Thiết kế reward cho một task",
      prompt: <p>Với task “Agent sửa bug trong repo”: viết outcome O (dựa vào gì, model có viết được không?), 3 path penalty Φ phát hiện được bằng rule, và một partial reward có thể với tới. Hành vi reward seeking nào có thể xuất hiện?</p>,
      hint: <p>Ví dụ Φ: sửa file trong tests/, chạy lệnh rm -rf ngoài workspace, tuyên bố “đã chạy test” khi log không có lệnh test.</p>,
    },
    {
      title: "Biến bad case thành dữ liệu",
      prompt: <p>Lấy một lỗi bạn đã quy trách nhiệm ở Chương 7. Thiết kế: trajectory-prefix, chosen/rejected, cách sinh thêm biến thể, boundary set và retention set để đánh giá sau train.</p>,
      hint: <p>Nhớ kiểm tra lỗi có thật sự do model không (tokenizer, Harness serialize, tool) trước khi đưa vào post-training.</p>,
    },
  ],
  glossary: [
    { en: "Pre-training", vi: "Tiền huấn luyện", note: "Đoán token tiếp theo trên dữ liệu khổng lồ." },
    { en: "Mid-training", vi: "Huấn luyện giữa kỳ", note: "Tiếp tục pre-train trên phân phối đích để lấp lỗ hổng nền." },
    { en: "SFT (Supervised Fine-Tuning)", vi: "Tinh chỉnh có giám sát", note: "Next-token với loss chỉ trên response." },
    { en: "Loss masking", vi: "Che loss", note: "Không tính loss cho prompt hoặc token do môi trường trả về." },
    { en: "LoRA", vi: "Thích nghi hạng thấp", note: "Đóng băng weight gốc, học hai ma trận nhỏ." },
    { en: "Catastrophic forgetting", vi: "Quên thảm họa", note: "Train task mới làm hỏng năng lực chung." },
    { en: "RFT (Rejection sampling fine-tuning)", vi: "Tinh chỉnh bằng lấy mẫu loại bỏ", note: "Sinh nhiều ứng viên, giữ cái qua verifier." },
    { en: "RL / policy / rollout", vi: "Học tăng cường / chính sách / lần chạy thử", note: "Policy tự sinh trajectory, reward chấm." },
    { en: "GRPO", vi: "Tối ưu chính sách theo nhóm", note: "Advantage tương đối trong nhóm rollout, không cần value network." },
    { en: "PPO", vi: "Tối ưu chính sách gần kề", note: "Có value model, clip ratio để cập nhật không quá lớn." },
    { en: "DPO", vi: "Tối ưu theo preference trực tiếp", note: "Học offline từ cặp tốt hơn/tệ hơn." },
    { en: "Advantage", vi: "Lợi thế", note: "Rollout tốt hơn kỳ vọng bao nhiêu." },
    { en: "On-policy / off-policy", vi: "Dữ liệu từ chính / policy khác", note: "Dữ liệu cũ hoặc sampler lệch → off-policy." },
    { en: "Importance ratio", vi: "Tỷ số quan trọng", note: "π_θ/μ; on-policy thật thì = 1 trước update." },
    { en: "Credit assignment", vi: "Phân bổ công trạng", note: "Reward cuối thuộc về bước nào." },
    { en: "ORM / PRM", vi: "Reward kết quả / quá trình", note: "Chấm cuối episode vs từng bước." },
    { en: "RLVR", vi: "RL với reward kiểm chứng được", note: "Test, assertion, state diff." },
    { en: "RLVP", vi: "RL với hình phạt kiểm chứng được", note: "Reward the outcome, penalize the path." },
    { en: "Reward hacking / reward seeking", vi: "Lách reward / chiều grader", note: "Khai thác lỗ hổng vs đoán grader nhìn gì rồi làm nông." },
    { en: "Mass-covering / mode-seeking", vi: "Phủ mọi mode / dồn vào mode tốt", note: "Xu hướng của SFT vs RL." },
    { en: "On-Policy Distillation", vi: "Chưng cất on-policy", note: "Teacher chấm từng token trên trajectory của student." },
    { en: "OPSD", vi: "Tự chưng cất on-policy", note: "Chính model làm teacher khi có thông tin đặc quyền." },
    { en: "User / environment simulator", vi: "Bộ mô phỏng", note: "LLM đóng vai người dùng hoặc môi trường." },
  ],
  quiz: [
    { q: "SFT khác pre-training ở điểm cốt lõi nào?", options: ["Thuật toán hoàn toàn khác", "Vẫn đoán token tiếp theo, nhưng dữ liệu khác và loss chỉ tính trên response", "Dùng reward", "Không cần GPU"], answer: 1, explain: "SFT = next-token + loss masking trên dữ liệu demo." },
    { q: "Pass@64 ≈ 0 trên task đích. Nên làm gì trước?", options: ["GRPO với nhiều rollout hơn", "Mid-training / mở rộng support trước", "DPO", "Tăng temperature"], answer: 1, explain: "Rollout toàn 0 → advantage = 0 → RL không học gì; phải sửa nền trước." },
    { q: "R = [0, 1, 0, 0]. Advantage của rollout đúng?", options: ["+1", "+0,25", "+1,73", "0"], answer: 2, explain: "(1 − 0,25)/0,433 ≈ +1,73." },
    { q: "16 rollout đều pass. Chuyện gì xảy ra với GRPO?", options: ["Học rất nhanh", "Advantage = 0, không có gradient", "Overfit", "Policy sụp"], answer: 1, explain: "Không phân biệt được rollout nào tốt hơn." },
    { q: "Vì sao phải mask token do tool trả về khi train tool calling?", options: ["Tiết kiệm bộ nhớ", "Chúng không do policy sinh; không mask thì model học đoán output sandbox", "Để nhanh hơn", "Bắt buộc của PPO"], answer: 1, explain: "Gradient chỉ qua suy nghĩ và tham số tool call của model." },
    { q: "Agent pass test nhưng thỉnh thoảng sửa file test. Theo RLVP nên làm gì?", options: ["Bỏ outcome reward", "Giữ outcome, thêm path penalty tất định cho hành động sửa test", "Phạt “thiếu cố gắng”", "Tăng learning rate"], answer: 1, explain: "Reward the outcome, penalize the path — và luôn giữ outcome." },
    { q: "Ưu điểm chính của On-Policy Distillation so với RL?", options: ["Không cần teacher", "Một rollout cho tín hiệu dày từng token thay vì một số 0/1", "Không cần rollout", "Luôn tạo năng lực mới"], answer: 1, explain: "Toán: khoảng 1/10 số step so với RL thuần." },
    { q: "Lệch log-prob 10⁻³ mỗi token, cùng chiều, trên 4.000 token. Ratio ρ?", options: ["≈ 1,004", "≈ 4", "≈ 54,6", "≈ 0"], answer: 2, explain: "e^4 ≈ 54,6 — on-policy danh nghĩa thành off-policy." },
    { q: "Rủi ro lớn nhất khi dùng LLM giả làm môi trường?", options: ["Chậm", "Thiên lệch/lỗ hổng simulator thành trần và bị RL khai thác", "Đắt hơn môi trường thật", "Không reset được"], answer: 1, explain: "Trộn tương tác thật để hiệu chỉnh định kỳ." },
    { q: "Sửa lỗi premature completion bằng DPO; đánh giá cần gì?", options: ["Chỉ boundary set", "Boundary set + retention set", "Chỉ loss", "Chỉ public benchmark"], answer: 1, explain: "Không có retention set sẽ được model không bao giờ dám kết thúc." },
    { q: "Rule duyệt chuyển tiền ổn định nhiều năm nên đặt ở đâu?", options: ["SFT", "RL", "Code", "Mid-training"], answer: 2, explain: "Ràng buộc tất định → code đảm bảo, không để model nhớ." },
  ],
  cards: [
    { front: "4 giai đoạn năng lực model?", back: "Pre-training → Mid-training → SFT → RL." },
    { front: "Mid-training dùng khi nào?", back: "Thiếu kiến thức/ngôn ngữ/năng lực nền; pass@k ≈ 0. Trộn retention data để không quên." },
    { front: "Hai điều kiện để RL học được?", back: "Format support (reward tính được) và capability support (thỉnh thoảng đúng)." },
    { front: "SFT vs RL trên phân phối?", back: "SFT mass-covering (bắt chước mọi mode) · RL mode-seeking (dồn vào mode reward cao)." },
    { front: "4 bước một step GRPO?", back: "Rollout nhóm → reward → relative advantage (R−mean)/std → gradient update." },
    { front: "Khi nào GRPO không học?", back: "Cả nhóm cùng reward (toàn pass hoặc toàn fail) → advantage = 0." },
    { front: "PPO khác GRPO?", back: "PPO có value model ước lượng kỳ vọng từng bước; GRPO so trong nhóm, không cần value model." },
    { front: "Unit test on-policy?", back: "So log-prob sampler vs trainer trên cùng batch trước update: mean/max ρ, KL, clip fraction." },
    { front: "Thứ tự dựng môi trường RL?", back: "Task blueprint → simulator reset được → verifier tất định → cách ly train/eval → hiệu chỉnh bằng tương tác thật." },
    { front: "Outcome vs process reward?", back: "Thưa, tự do khám phá vs dày, dễ credit assignment nhưng bó đường đi." },
    { front: "4 nguyên tắc RLVP?", back: "Phạt hành động cụ thể · giữ outcome reward · có đường tuân thủ với tới được · rule tất định khó lách." },
    { front: "Reward hacking vs reward seeking?", back: "Khai thác lỗ hổng rule vs đoán grader nhìn gì rồi làm nông, dừng sớm." },
    { front: "On-Policy Distillation?", back: "Student tự rollout, teacher cho phân phối token ở từng trạng thái → giám sát dày." },
    { front: "OPSD?", back: "Cùng model; bản teacher thấy đáp án đặc quyền, bản student chỉ thấy đề." },
    { front: "ICL / RAG / code / post-training đặt gì?", back: "Ví dụ tức thời · dữ kiện động · ràng buộc cứng · hành vi khó diễn đạt bằng rule." },
  ],
};
