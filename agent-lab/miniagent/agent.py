"""Vòng lặp ReAct — trái tim của mọi Agent (Chương 1, mục 1.1.5; Chương 2, mục 2.2.4).

    trajectory = [user_request]
    repeat:
        context  = stable_prefix + trajectory
        decision = Model(context)
        trajectory.append(decision)
        if decision has no tool call: return answer
        for call in decision.tool_calls:
            observation = execute(call)
            trajectory.append(observation)
"""

from __future__ import annotations

from .llm import Reply
from .printer import Printer
from .tools import ToolRegistry


class Agent:
    def __init__(self, llm, system_prompt: str, tools: ToolRegistry, max_iterations: int = 8,
                 printer: Printer | None = None):
        self.llm = llm
        self.system_prompt = system_prompt
        self.tools = tools
        self.max_iterations = max_iterations  # điều kiện dừng bắt buộc — không có nó Agent có thể lặp mãi
        self.printer = printer or Printer()
        self.trajectory: list[dict] = []  # lịch sử động: user / assistant / tool
        self.rounds = 0

    # ── Ngữ cảnh: tiền tố tĩnh + trajectory ───────────────────────────────
    def build_messages(self) -> list[dict]:
        """Ghép ngữ cảnh cho một lần gọi. Các chương sau ghi đè hàm này (thanh trạng thái, nén...)."""
        return [{"role": "system", "content": self.system_prompt}] + self.trajectory

    def tool_schemas(self) -> list[dict] | None:
        return self.tools.schemas() or None

    def observe(self, call, result: str) -> None:
        self.trajectory.append({"role": "tool", "tool_call_id": call.id, "content": result})

    # ── Vòng lặp ──────────────────────────────────────────────────────────
    def run(self, user_input: str) -> str:
        self.trajectory.append({"role": "user", "content": user_input})
        self.printer.user(user_input)
        for _ in range(self.max_iterations):
            self.rounds += 1
            messages = self.build_messages()
            reply: Reply = self.llm.chat(messages, self.tool_schemas())
            self.printer.assistant(self.rounds, reply, messages)
            self.trajectory.append(reply.to_message())

            if not reply.tool_calls:  # không gọi công cụ → mô hình coi như đã xong
                return reply.content

            for call in reply.tool_calls:  # các lệnh gọi độc lập có thể chạy song song
                result = self.tools.execute(call)
                self.printer.tool(call, result)
                self.observe(call, result)

        self.printer.stop(f"Dừng: đã chạm giới hạn {self.max_iterations} vòng (max_iterations).")
        return ""
