"""Client tối giản cho API tương thích OpenAI Chat Completions.

Chạy được với mlx_lm.server, vLLM, Ollama, LM Studio... — chỉ dùng thư viện chuẩn,
không cần cài thêm gì. Đây là "bộ não" (LLM) trong công thức Agent = LLM + Context + Tools.

Cấu hình bằng biến môi trường:
    AGENT_BASE_URL  (mặc định http://127.0.0.1:8080/v1; có thể ghi vào file agent-lab/.env)
    AGENT_MODEL     (mặc định Qwen3-4B; đổi sang model lớn hơn, vd mlx-community/Qwen3.8-27B-4bit)
    AGENT_THINKING  (1 = bật chế độ suy nghĩ cho model Qwen3 lai; model "Instruct-2507" không có)
    AGENT_MOCK=1    (dùng mô hình giả lập, không cần server — chỉ để xem luồng chạy)

Liệt kê model server đang có:  python3 -m miniagent.llm
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from typing import Callable

DEFAULT_BASE_URL = "http://127.0.0.1:8080/v1"


def _load_dotenv() -> None:
    """Đọc agent-lab/.env (KEY=VALUE) nếu có; file này bị .gitignore để không lộ địa chỉ server."""
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()
DEFAULT_MODEL = "mlx-community/Qwen3-4B-Instruct-2507-4bit"
# Tham số lấy mẫu khuyến nghị cho Qwen3 Instruct
SAMPLING = {"top_p": 0.8, "top_k": 20, "min_p": 0}
# Một số proxy (vd Cloudflare) chặn User-Agent mặc định "Python-urllib" bằng lỗi 403
HEADERS = {"Content-Type": "application/json", "User-Agent": "miniagent/0.1"}

THINK_RE = re.compile(r"<think>(.*?)</think>", re.DOTALL)
# Một số server (hoặc model nhỏ) trả lệnh gọi công cụ dạng văn bản kiểu Qwen thay vì trường tool_calls
TEXT_TOOL_CALL_RE = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.DOTALL)


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class Reply:
    content: str
    reasoning: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    usage: dict = field(default_factory=dict)
    latency: float = 0.0

    def to_message(self) -> dict:
        """Chuyển phản hồi thành tin nhắn assistant chuẩn để nối vào trajectory."""
        msg: dict = {"role": "assistant", "content": self.content or ""}
        if self.tool_calls:
            msg["tool_calls"] = [
                {
                    "id": c.id,
                    "type": "function",
                    "function": {"name": c.name, "arguments": json.dumps(c.arguments, ensure_ascii=False)},
                }
                for c in self.tool_calls
            ]
        return msg


def _new_call_id() -> str:
    return "call_" + uuid.uuid4().hex[:8]


def _parse_arguments(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    try:
        value = json.loads(raw or "{}")
        return value if isinstance(value, dict) else {"value": value}
    except json.JSONDecodeError:
        return {"_raw": raw}


def parse_message(message: dict) -> tuple[str, str, list[ToolCall]]:
    """Tách content, reasoning và tool_calls từ message mà server trả về."""
    content = message.get("content") or ""
    reasoning = message.get("reasoning_content") or message.get("reasoning") or ""

    # Model kiểu Qwen3 có thể để suy nghĩ trong <think>...</think> ngay trong content
    thinks = THINK_RE.findall(content)
    if thinks:
        reasoning = (reasoning + "\n" + "\n".join(t.strip() for t in thinks)).strip()
        content = THINK_RE.sub("", content)
    if "</think>" in content:  # trường hợp thẻ mở đã bị template nuốt mất
        head, content = content.split("</think>", 1)
        reasoning = (reasoning + "\n" + head.strip()).strip()

    calls = [
        ToolCall(
            id=tc.get("id") or _new_call_id(),
            name=tc["function"]["name"],
            arguments=_parse_arguments(tc["function"].get("arguments")),
        )
        for tc in message.get("tool_calls") or []
    ]
    if not calls:
        for raw in TEXT_TOOL_CALL_RE.findall(content):
            try:
                obj = json.loads(raw)
            except json.JSONDecodeError:
                continue
            calls.append(ToolCall(_new_call_id(), obj.get("name", ""), _parse_arguments(obj.get("arguments"))))
        if calls:
            content = TEXT_TOOL_CALL_RE.sub("", content)

    return content.strip(), reasoning, calls


class LLM:
    """Gọi API /chat/completions. Mỗi lần gọi là KHÔNG TRẠNG THÁI: phải gửi lại toàn bộ messages."""

    def __init__(self, base_url: str | None = None, model: str | None = None,
                 temperature: float = 0.2, max_tokens: int = 2048, timeout: float = 600):
        self.base_url = (base_url or os.environ.get("AGENT_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.model = model or os.environ.get("AGENT_MODEL") or DEFAULT_MODEL
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.thinking = os.environ.get("AGENT_THINKING") == "1"

    def chat(self, messages: list[dict], tools: list[dict] | None = None, max_tokens: int | None = None) -> Reply:
        body: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": max_tokens or self.max_tokens,
            "chat_template_kwargs": {"enable_thinking": self.thinking},
            **SAMPLING,
        }
        if tools:
            body["tools"] = tools
        req = urllib.request.Request(
            self.base_url + "/chat/completions",
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers=HEADERS,
        )
        start = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as e:
            raise SystemExit(
                f"\n[LỖI] Không kết nối được tới {self.base_url} ({e}).\n"
                "  • Kiểm tra AGENT_BASE_URL, hoặc chạy server local: mlx_lm.server --model <model> --port 8080\n"
                "  • Hoặc chạy thử không cần model: thêm cờ --mock\n"
            ) from e
        latency = time.perf_counter() - start
        content, reasoning, calls = parse_message(data["choices"][0]["message"])
        return Reply(content, reasoning, calls, data.get("usage") or {}, latency)


Policy = Callable[[list[dict], list[dict] | None], Reply]


class MockLLM:
    """Mô hình GIẢ LẬP theo kịch bản viết tay — dùng để xem luồng chạy khi chưa có server.

    Kết quả của MockLLM không nói lên điều gì về năng lực mô hình thật.
    """

    def __init__(self, policy: Policy):
        self.policy = policy
        self.model = "mock"

    def chat(self, messages: list[dict], tools: list[dict] | None = None, max_tokens: int | None = None) -> Reply:
        start = time.perf_counter()
        reply = self.policy(messages, tools)
        reply.latency = time.perf_counter() - start
        return reply


def make_llm(mock: bool, policy: Policy | None = None, **kwargs):
    if mock or os.environ.get("AGENT_MOCK") == "1":
        if policy is None:
            raise SystemExit("Bài này chưa có kịch bản --mock, hãy chạy với model thật.")
        print("⚠️  Đang dùng MockLLM (giả lập theo kịch bản) — chỉ để xem luồng chạy.\n")
        return MockLLM(policy)
    return LLM(**kwargs)


def call(name: str, **arguments) -> ToolCall:
    """Tiện ích cho kịch bản mock: tạo một lệnh gọi công cụ."""
    return ToolCall(_new_call_id(), name, arguments)


if __name__ == "__main__":
    base = (os.environ.get("AGENT_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
    with urllib.request.urlopen(urllib.request.Request(base + "/models", headers=HEADERS), timeout=30) as resp:
        models = [m["id"] for m in json.loads(resp.read())["data"]]
    current = os.environ.get("AGENT_MODEL") or DEFAULT_MODEL
    print(f"Server: {base}")
    for m in models:
        print(("  ▶ " if m == current else "    ") + m)
    print("\nĐổi model:  export AGENT_MODEL=<tên ở trên>")
