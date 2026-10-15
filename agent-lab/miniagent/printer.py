"""In trajectory ra terminal cho dễ quan sát (minh bạch — nguyên tắc thứ 2 của Anthropic, Chương 1)."""

from __future__ import annotations

import json
import os
import sys

_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _COLOR else text


def _short(text: str, limit: int) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


class Printer:
    def __init__(self, verbose: bool = True, limit: int = 220):
        self.verbose = verbose
        self.limit = limit

    def user(self, text: str) -> None:
        if self.verbose:
            print(_c("1;36", "👤 user: ") + _short(text, self.limit))

    def assistant(self, round_no: int, reply, messages: list[dict]) -> None:
        if not self.verbose:
            return
        chars = sum(len(json.dumps(m, ensure_ascii=False)) for m in messages)
        print(_c("2", f"\n── Vòng {round_no} · ngữ cảnh gửi đi: {len(messages)} tin nhắn, ~{chars:,} ký tự"
                     f" · {reply.latency:.2f}s ──"))
        if reply.reasoning:
            print(_c("35", "💭 reasoning: ") + _short(reply.reasoning, self.limit))
        for c in reply.tool_calls:
            print(_c("33", "🔧 tool_call: ") + f"{c.name}({json.dumps(c.arguments, ensure_ascii=False)})")
        if reply.content and not reply.tool_calls:
            print(_c("1;32", "🤖 trả lời: ") + reply.content)
        elif reply.content:
            print(_c("32", "🤖 content: ") + _short(reply.content, self.limit))

    def tool(self, call, result: str) -> None:
        if self.verbose:
            print(_c("34", f"   ↳ {call.name} → ") + _short(result, self.limit))

    def note(self, text: str) -> None:
        if self.verbose:
            print(_c("2;3", "   · " + text))

    def stop(self, text: str) -> None:
        print(_c("1;31", "⛔ " + text))
