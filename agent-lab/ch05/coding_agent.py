"""Bài 5.1 — Mini Coding Agent với 7 tool cốt lõi (Chương 5 · mục 5.1).

Workspace tạm chứa một project nhỏ có BUG và một test đang fail. Nhiệm vụ: sửa bug để test pass.
7 tool: code_interpreter, bash, read_file (kèm số dòng), write_file (tự chạy syntax check), edit_file
(old_string → new_string, phải khớp DUY NHẤT), glob, grep.

Harness áp dụng các bài học của chương:
  • tiêu chí hoàn thành = "test pass" do HARNESS chạy lại kiểm tra, không tin lời model
  • lỗi tool trả về thành input có cấu trúc cho model, không làm sập vòng lặp
  • phát hiện vòng lặp không tiến triển bằng fingerprint (tool + arguments)
  • output dài được cắt đầu/cuối có thông báo; bash giữ cwd giữa các lệnh (persistent session)
  • Status Bar ở cuối context: cwd, số lần gọi tool, các tệp đã sửa

Chạy:  python3 ch05/coding_agent.py [--mock]
"""

from __future__ import annotations

import argparse
import glob as globlib
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from miniagent.agent import Agent  # noqa: E402
from miniagent.llm import Reply, call, make_llm  # noqa: E402
from miniagent.tools import Tool, ToolRegistry  # noqa: E402

PROJECT = {
    "README.md": "# pricing\nTính giá sau giảm. Chạy test: `python3 -m unittest -q`\n",
    "pricing.py": '''def apply_discount(price, percent):
    """Trả về giá sau khi giảm `percent` phần trăm, làm tròn 2 chữ số."""
    if not 0 <= percent <= 100:
        raise ValueError("percent phải trong [0, 100]")
    return round(price * percent / 100, 2)
''',
    "test_pricing.py": '''import unittest
from pricing import apply_discount


class TestDiscount(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(apply_discount(200, 25), 150.0)

    def test_zero(self):
        self.assertEqual(apply_discount(99.99, 0), 99.99)

    def test_invalid(self):
        with self.assertRaises(ValueError):
            apply_discount(10, 120)
''',
}
TEST_CMD = "python3 -m unittest -q"


class Workspace:
    def __init__(self):
        self.root = Path(tempfile.mkdtemp(prefix="coding_ws_"))
        for name, content in PROJECT.items():
            (self.root / name).write_text(content)
        self.cwd = self.root
        self.edited: set[str] = set()

    def path(self, p: str) -> Path:
        full = (self.cwd / p).resolve()
        if self.root.resolve() not in full.parents and full != self.root.resolve():
            raise PermissionError(f"'{p}' nằm ngoài workspace")
        return full


def truncate(text: str, head: int = 20, tail: int = 20) -> str:
    lines = text.splitlines()
    if len(lines) <= head + tail:
        return text
    return "\n".join(lines[:head] + [f"... [{len(lines) - head - tail} dòng bị lược] ..."] + lines[-tail:])


def make_tools(ws: Workspace) -> list[Tool]:
    def read_file(path: str, offset: int = 1, limit: int = 200) -> str:
        lines = ws.path(path).read_text().splitlines()
        chunk = lines[offset - 1: offset - 1 + limit]
        body = "\n".join(f"{i:>4}\t{line}" for i, line in enumerate(chunk, start=offset))  # kèm số dòng
        more = f"\n(Hiển thị dòng {offset}–{offset + len(chunk) - 1} / {len(lines)}; dùng offset để đọc tiếp)" if len(lines) > limit else ""
        return body + more

    def syntax_check(p: Path) -> str:
        if p.suffix != ".py":
            return ""
        r = subprocess.run([sys.executable, "-m", "py_compile", str(p)], capture_output=True, text=True)
        return "" if r.returncode == 0 else "\nSYNTAX ERROR:\n" + r.stderr.strip()

    def write_file(path: str, content: str) -> str:
        p = ws.path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
        ws.edited.add(path)
        return f"Đã ghi {path} ({len(content)} ký tự)." + syntax_check(p)  # execute → validate → feedback

    def edit_file(path: str, old_string: str, new_string: str) -> str:
        p = ws.path(path)
        text = p.read_text()
        n = text.count(old_string)
        if n == 0:
            raise ValueError("old_string không khớp nội dung tệp — hãy read_file lại và chép chính xác (kể cả khoảng trắng)")
        if n > 1:
            raise ValueError(f"old_string khớp {n} chỗ — thêm ngữ cảnh xung quanh để khớp duy nhất")
        p.write_text(text.replace(old_string, new_string))
        ws.edited.add(path)
        return f"Đã sửa {path}." + syntax_check(p)

    def glob(pattern: str) -> str:
        hits = sorted(str(Path(h).relative_to(ws.root)) for h in globlib.glob(str(ws.root / pattern), recursive=True))
        return "\n".join(hits) or "(không có tệp nào khớp)"

    def grep(pattern: str, glob_pattern: str = "**/*") -> str:
        out = []
        for f in globlib.glob(str(ws.root / glob_pattern), recursive=True):
            if Path(f).is_file():
                for i, line in enumerate(Path(f).read_text(errors="ignore").splitlines(), 1):
                    if re.search(pattern, line):
                        out.append(f"{Path(f).relative_to(ws.root)}:{i}: {line.strip()}")
        return truncate("\n".join(out)) or "(không có dòng nào khớp)"

    def bash(command: str, timeout: int = 60) -> str:
        if re.search(r"\brm\s+-rf\b|\bsudo\b|curl[^|]*\|\s*(sh|bash)", command):
            raise PermissionError("lệnh nguy hiểm bị chặn — cần người dùng xác nhận")
        if command.startswith("cd "):  # persistent session: giữ cwd giữa các lệnh
            ws.cwd = ws.path(command[3:].strip())
            return f"cwd = {ws.cwd.relative_to(ws.root) or '.'}"
        r = subprocess.run(command, shell=True, cwd=ws.cwd, capture_output=True, text=True, timeout=timeout)
        return truncate(f"exit={r.returncode}\n{r.stdout}{r.stderr}".strip())

    def code_interpreter(code: str) -> str:
        r = subprocess.run([sys.executable, "-c", code], cwd=ws.cwd, capture_output=True, text=True, timeout=30)
        return truncate((r.stdout + r.stderr).strip() or "(không có output)")

    S = lambda props, req: {"type": "object", "properties": props, "required": req}  # noqa: E731
    s = {"type": "string"}
    return [
        Tool("code_interpreter", "Chạy một đoạn Python trong workspace và trả về stdout/stderr. Dùng cho tính toán, thử nhanh.",
             S({"code": s}, ["code"]), code_interpreter),
        Tool("bash", f"Chạy lệnh shell trong workspace (giữ cwd giữa các lệnh). Chạy test: `{TEST_CMD}`.",
             S({"command": s}, ["command"]), bash),
        Tool("read_file", "Đọc tệp, mỗi dòng kèm số dòng. Dùng offset/limit cho tệp lớn. Luôn đọc trước khi sửa.",
             S({"path": s, "offset": {"type": "integer"}, "limit": {"type": "integer"}}, ["path"]), read_file),
        Tool("write_file", "Tạo tệp mới hoặc GHI ĐÈ toàn bộ tệp. Sửa một phần thì dùng edit_file. Tự kiểm cú pháp .py.",
             S({"path": s, "content": s}, ["path", "content"]), write_file),
        Tool("edit_file", "Thay old_string bằng new_string. old_string phải khớp CHÍNH XÁC và DUY NHẤT (chép từ read_file, bỏ số dòng).",
             S({"path": s, "old_string": s, "new_string": s}, ["path", "old_string", "new_string"]), edit_file),
        Tool("glob", "Tìm tệp theo TÊN/đường dẫn (vd **/*.py). KHÔNG tìm nội dung.", S({"pattern": s}, ["pattern"]), glob),
        Tool("grep", "Tìm dòng theo regex trong NỘI DUNG tệp; trả về path:line: text.",
             S({"pattern": s, "glob_pattern": s}, ["pattern"]), grep),
    ]


SYSTEM = f"""Bạn là Coding Agent làm việc trong một repository. Quy trình:
1. Tìm hiểu project (README, glob, read_file) trước khi sửa.
2. Chạy test để thấy lỗi: `{TEST_CMD}`.
3. Sửa tối thiểu bằng edit_file (đọc tệp trước khi sửa).
4. CHẠY LẠI TEST. Chỉ báo xong khi test pass. Không sửa test để làm nó pass.
Trả lời cuối ngắn gọn: đã sửa gì, vì sao."""


class CodingAgent(Agent):
    def __init__(self, *args, ws: Workspace, **kwargs):
        super().__init__(*args, **kwargs)
        self.ws = ws
        self.fingerprints: Counter[str] = Counter()

    def build_messages(self):
        status = (f"<agent_status>\ncwd: {self.ws.cwd.relative_to(self.ws.root) or '.'}\n"
                  f"tool calls: {dict(self.tools.call_counts)}\nedited files: {sorted(self.ws.edited) or 'none'}\n</agent_status>")
        return super().build_messages() + [{"role": "user", "content": status}]

    def observe(self, call, result):
        fp = hashlib.sha1(f"{call.name}{json.dumps(call.arguments, sort_keys=True)}".encode()).hexdigest()
        self.fingerprints[fp] += 1
        if self.fingerprints[fp] >= 3:  # cùng tool + cùng tham số lần thứ 3 → không tiến triển
            result += "\n⚠️ Bạn đã gọi y hệt lệnh này 3 lần. Đổi cách tiếp cận thay vì lặp lại."
        super().observe(call, result)


def mock_policy(messages, tools) -> Reply:
    done = [tc["function"]["name"] for m in messages for tc in m.get("tool_calls") or []]
    results = [m["content"] for m in messages if m["role"] == "tool"]
    if "read_file" not in done:
        return Reply("", "Đọc mã nguồn trước.", [call("glob", pattern="**/*.py"), call("read_file", path="pricing.py")])
    if done.count("bash") == 0:
        return Reply("", "Chạy test để thấy lỗi.", [call("bash", command=TEST_CMD)])
    if "edit_file" not in done:
        return Reply("", "Công thức đang trả về phần được giảm, không phải giá sau giảm.",
                     [call("edit_file", path="pricing.py", old_string="return round(price * percent / 100, 2)",
                           new_string="return round(price * (100 - percent) / 100, 2)")])
    if done.count("bash") == 1:
        return Reply("", "Chạy lại test để xác minh.", [call("bash", command=TEST_CMD)])
    return Reply("Đã sửa apply_discount: trả về price*(100-percent)/100 thay vì phần được giảm. Test pass." if "exit=0" in results[-1]
                 else "Test vẫn fail.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mock", action="store_true")
    parser.add_argument("--max-iterations", type=int, default=15)
    args = parser.parse_args()

    ws = Workspace()
    llm = make_llm(args.mock, mock_policy)
    agent = CodingAgent(llm, SYSTEM, ToolRegistry(make_tools(ws)), max_iterations=args.max_iterations, ws=ws)
    print(f"Workspace: {ws.root}\n")
    agent.run("Test của project đang fail. Hãy tìm và sửa bug.")

    # Harness tự kiểm chứng — không tin câu "test pass" của model
    r = subprocess.run(TEST_CMD, shell=True, cwd=ws.root, capture_output=True, text=True)
    test_untouched = (ws.root / "test_pricing.py").read_text() == PROJECT["test_pricing.py"]
    print("\n══ Harness kiểm chứng ══")
    print(f"Test thực sự pass   : {'✓' if r.returncode == 0 else '✗'}")
    print(f"Không sửa tệp test  : {'✓' if test_untouched else '✗ (đi đường tắt!)'}")
    print(f"Số vòng / lần gọi   : {agent.rounds} / {dict(agent.tools.call_counts)}")


if __name__ == "__main__":
    main()
