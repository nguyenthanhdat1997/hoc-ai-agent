"""Công cụ — "tay chân" của Agent.

Một công cụ gồm hai phần tách biệt:
  • schema (tên, mô tả, tham số) — đi vào NGỮ CẢNH để mô hình biết mình làm được gì
  • hàm Python thực thi — do HARNESS chạy, mô hình không tự chạy được gì cả
"""

from __future__ import annotations

import ast
import json
import operator
import traceback
from collections import Counter
from dataclasses import dataclass
from typing import Callable

from .llm import ToolCall


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    fn: Callable[..., object]
    risk: str = "low"  # low / medium / high — dùng cho guardrail tầng thực thi (Chương 1)

    def schema(self) -> dict:
        return {
            "type": "function",
            "function": {"name": self.name, "description": self.description, "parameters": self.parameters},
        }


class ToolRegistry:
    def __init__(self, tools: list[Tool] | None = None, detailed_errors: bool = True,
                 approver: Callable[[ToolCall], bool] | None = None):
        self.tools: dict[str, Tool] = {}
        self.call_counts: Counter[str] = Counter()
        self.detailed_errors = detailed_errors
        # Guardrail tầng thực thi: công cụ rủi ro cao phải được một cơ chế NGOÀI ngữ cảnh phê duyệt
        self.approver = approver
        self.blocked: list[ToolCall] = []
        for t in tools or []:
            self.add(t)

    def add(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def schemas(self) -> list[dict]:
        # Thứ tự CỐ ĐỊNH theo lúc đăng ký — đổi thứ tự công cụ sẽ phá KV Cache (Chương 2)
        return [t.schema() for t in self.tools.values()]

    def execute(self, call: ToolCall) -> str:
        self.call_counts[call.name] += 1
        tool = self.tools.get(call.name)
        if tool is None:
            return json.dumps({"error": f"Không có công cụ '{call.name}'", "available": list(self.tools)},
                              ensure_ascii=False)
        if tool.risk == "high" and self.approver is not None and not self.approver(call):
            self.blocked.append(call)
            return json.dumps({"error": "BLOCKED", "message": "Thao tác rủi ro cao chưa được người dùng xác nhận."},
                              ensure_ascii=False)
        try:
            result = tool.fn(**call.arguments)
        except Exception as e:  # lỗi công cụ phải quay lại thành quan sát, không được làm sập vòng lặp
            if not self.detailed_errors:
                return "Error"
            # "Thông tin lỗi chi tiết" (Thí nghiệm 2-9): loại lỗi + tham số + vị trí + gợi ý sửa
            return json.dumps({
                "error_type": type(e).__name__,
                "message": str(e),
                "arguments": call.arguments,
                "where": traceback.format_exc(limit=1).strip().splitlines()[-1],
                "hint": _hint_for(e),
            }, ensure_ascii=False)
        return result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)


def _hint_for(e: Exception) -> str:
    if isinstance(e, TypeError):
        return "Kiểm tra lại tên và kiểu tham số theo schema của công cụ."
    if isinstance(e, KeyError):
        return "Giá trị không nằm trong danh sách hỗ trợ; xem lại tham số."
    if isinstance(e, FileNotFoundError):
        return "Xác minh đường dẫn, liệt kê thư mục làm việc, dùng đường dẫn tuyệt đối."
    return "Đọc thông báo lỗi, sửa tham số rồi thử lại; đừng lặp lại y hệt lệnh gọi cũ."


# ── Công cụ dùng chung cho các bài thực hành ────────────────────────────────

# Tỷ giá cố định để kết quả khớp với ví dụ trong sách (Hình 1-4)
RATES_TO_USD = {"USD": 1.0, "EUR": 1 / 0.92, "GBP": 1 / 0.79, "JPY": 1 / 149.5}


def convert_currency(amount: float, from_currency: str, to_currency: str = "USD") -> dict:
    src, dst = from_currency.upper(), to_currency.upper()
    value = float(amount) * RATES_TO_USD[src] / RATES_TO_USD[dst]
    return {"amount": amount, "from": src, "to": dst, "result": round(value, 2)}


CONVERT_CURRENCY = Tool(
    name="convert_currency",
    description="Quy đổi một số tiền giữa các loại tiền tệ (USD, EUR, GBP, JPY) theo tỷ giá hiện hành.",
    parameters={
        "type": "object",
        "properties": {
            "amount": {"type": "number", "description": "Số tiền cần quy đổi, ví dụ 2100000"},
            "from_currency": {"type": "string", "enum": list(RATES_TO_USD), "description": "Mã tiền nguồn"},
            "to_currency": {"type": "string", "enum": list(RATES_TO_USD), "description": "Mã tiền đích, mặc định USD"},
        },
        "required": ["amount", "from_currency"],
    },
    fn=convert_currency,
)

_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Pow: operator.pow, ast.USub: operator.neg, ast.UAdd: operator.pos}


def _safe_eval(node):
    if isinstance(node, ast.Expression):
        return _safe_eval(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_safe_eval(node.operand))
    raise ValueError("Chỉ hỗ trợ số và các phép + - * / **")


def calculator(expression: str) -> dict:
    # Không dùng eval(): công cụ đa dụng phải bị giới hạn (Chương 1, mục 1.1.2)
    value = _safe_eval(ast.parse(expression.replace(",", ""), mode="eval"))
    return {"expression": expression, "result": round(value, 2)}


CALCULATOR = Tool(
    name="calculator",
    description="Tính một biểu thức số học. Dùng cho mọi phép tính thay vì tự tính nhẩm.",
    parameters={
        "type": "object",
        "properties": {"expression": {"type": "string", "description": "Ví dụ: (2500000 + 2282608.7) / 4"}},
        "required": ["expression"],
    },
    fn=calculator,
)
