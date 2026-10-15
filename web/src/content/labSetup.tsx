import { Callout, Code } from "../components/ui";

export function LabSetup() {
  return (
    <details className="card" style={{ marginBottom: 18 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>⚙️ Chuẩn bị môi trường (làm một lần)</summary>
      <p>
        Mã thực hành nằm ở thư mục <code>agent-lab/</code> trong repo, chỉ dùng thư viện chuẩn của Python — không cần{" "}
        <code>pip install</code> gì cho bản thân Agent. Model chạy cục bộ bằng <b>MLX</b> trên máy Mac chip Apple, qua server
        tương thích OpenAI.
      </p>
      <div className="label">1. Dùng server MLX của bạn (đã đặt làm mặc định)</div>
      <Code lang="bash">{`
cd agent-lab
python3 -m miniagent.llm          # liệt kê model server đang có, ▶ là model đang dùng
export AGENT_MODEL=mlx-community/Qwen3.8-27B-4bit   # đổi model (mặc định: Qwen3-4B-Instruct-2507-4bit)
export AGENT_THINKING=1           # bật suy nghĩ cho model Qwen3 lai (vd Qwen3-8B); bản Instruct-2507 không có`}</Code>
      <div className="label">2. Hoặc chạy server local trên máy Mac</div>
      <Code lang="bash">{`
python3 -m pip install mlx-lm
mlx_lm.server --model mlx-community/Qwen3-4B-Instruct-2507-4bit --port 8080
export AGENT_BASE_URL=http://127.0.0.1:8080/v1`}</Code>
      <div className="label">3. Chưa có model? Chạy bằng model giả lập</div>
      <Code lang="bash">{`python3 ch01/react_loop.py --mock`}</Code>
      <Callout kind="warn" title="Về --mock">
        MockLLM trả lời theo kịch bản viết tay để bạn xem luồng chạy của Harness. Con số nó tạo ra <b>không</b> nói gì về năng lực
        model thật — muốn kết luận, hãy chạy với model MLX.
      </Callout>
      <p className="small muted">
        Gợi ý: chạy mỗi bài với một model nhỏ (4B) và một model lớn (27B) rồi so sánh — sách nhấn mạnh hiệu quả của Harness phụ
        thuộc cỡ model. Lần đầu gọi một model khác, server phải nạp model vào bộ nhớ nên có thể chậm hoặc hết thời gian chờ. Agent tự hiểu cả <code>tool_calls</code> chuẩn lẫn dạng văn bản{" "}
        <code>&lt;tool_call&gt;…&lt;/tool_call&gt;</code> và tách phần <code>&lt;think&gt;</code>.
      </p>
    </details>
  );
}
