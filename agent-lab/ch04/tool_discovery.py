"""Bài 4.1 — Quá nhiều tool: full injection vs proactive tool discovery (Chương 4 · mục 4.4, Experiment 4-1).

Có 60 tool giả lập (thời tiết, chứng khoán, GitHub, arXiv, lịch, email...).
  • full:     nhồi schema của cả 60 tool vào request → context dài, model nhỏ dễ chọn nhầm
  • discover: chỉ có 1 meta-tool `discover_tools(need)`; tool tìm được bằng BM25 trên mô tả,
              schema đầy đủ được NỐI VÀO CUỐI trajectory (giữ static prefix ổn định cho KV Cache)

Chạy:  python3 ch04/tool_discovery.py --mode full|discover [--mock]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from miniagent.llm import Reply, call, make_llm  # noqa: E402
from miniagent.retrieval import BM25, Doc  # noqa: E402

DOMAINS = {
    "weather": ["get_current_weather|Thời tiết hiện tại của một thành phố", "get_forecast|Dự báo thời tiết 7 ngày",
                "get_air_quality|Chỉ số chất lượng không khí AQI"],
    "finance": ["get_stock_quote|Giá cổ phiếu hiện tại theo mã chứng khoán (vd NVDA, AAPL)", "get_stock_history|Lịch sử giá cổ phiếu",
                "get_exchange_rate|Tỷ giá ngoại tệ", "get_company_profile|Hồ sơ doanh nghiệp niêm yết"],
    "github": ["search_repositories|Tìm repository GitHub", "list_contributors|Danh sách contributor của một repo GitHub",
               "get_repo_stats|Số sao, fork, issue của repo GitHub", "create_issue|Tạo issue mới trên GitHub",
               "get_commit_history|Lịch sử commit của repo"],
    "arxiv": ["search_papers|Tìm bài báo khoa học trên arXiv", "download_paper|Tải PDF bài báo arXiv"],
    "calendar": ["list_events|Liệt kê sự kiện trong lịch", "create_event|Tạo sự kiện lịch", "delete_event|Xóa sự kiện lịch"],
    "email": ["send_email|Gửi email", "search_email|Tìm email trong hộp thư", "read_email|Đọc nội dung một email"],
    "files": ["read_file|Đọc tệp", "write_file|Ghi tệp", "list_dir|Liệt kê thư mục", "grep_file|Tìm chuỗi trong tệp"],
    "maps": ["geocode|Đổi địa chỉ thành tọa độ", "route|Chỉ đường giữa hai điểm", "nearby_places|Tìm địa điểm gần đây"],
}
TOOLS = []
for domain, items in DOMAINS.items():
    for item in items:
        name, desc = item.split("|")
        TOOLS.append({"type": "function", "function": {"name": name, "description": f"[{domain}] {desc}",
                      "parameters": {"type": "object", "properties": {"query": {"type": "string"}}}}})
# thêm tool "nhiễu" để đủ 60 — trong thực tế là hàng trăm tool từ nhiều MCP server
while len(TOOLS) < 60:
    i = len(TOOLS)
    TOOLS.append({"type": "function", "function": {"name": f"legacy_tool_{i}", "description": f"Tool nội bộ cũ số {i}, ít dùng",
                  "parameters": {"type": "object", "properties": {"query": {"type": "string"}}}}})

TASKS = [("Giá cổ phiếu NVDA hiện tại là bao nhiêu?", "get_stock_quote"),
         ("Repo openclaw/openclaw có những contributor nào?", "list_contributors"),
         ("Ngày mai ở Đà Nẵng có mưa không?", "get_forecast"),
         ("Tìm bài báo mới về transformer trên arXiv", "search_papers")]

INDEX = BM25([Doc(t["function"]["name"], t["function"]["name"].replace("_", " ") + " " + t["function"]["description"]) for t in TOOLS])
DISCOVER = {"type": "function", "function": {
    "name": "discover_tools",
    "description": "Dùng khi bạn cần một năng lực chưa có trong danh sách tool. Mô tả nhu cầu bằng ngôn ngữ tự nhiên; "
                   "trả về tối đa 3 tool phù hợp kèm schema đầy đủ.",
    "parameters": {"type": "object", "properties": {"need": {"type": "string", "description": "vd: 'tra giá cổ phiếu'"}},
                   "required": ["need"]}}}


def discover(need: str) -> list[dict]:
    names = [d.id for d, _ in INDEX.search(need, top_k=3)]
    return [t for t in TOOLS if t["function"]["name"] in names]


def mock_policy(messages, tools) -> Reply:
    task = messages[1]["content"]
    gold = dict(TASKS)[task]
    names = [t["function"]["name"] for t in tools or []]
    if names == ["discover_tools"] and not any(m["role"] == "tool" for m in messages):
        return Reply("", "Chưa có tool phù hợp, tìm thêm.", [call("discover_tools", need=task)])
    found = " ".join(m["content"] for m in messages if m["role"] == "tool")
    if len(names) > 30 and TASKS.index((task, gold)) % 2:
        # giả lập model nhỏ "lạc" giữa 60 schema: chọn tool gần nghĩa nhưng sai
        return Reply("", "", [call("search_repositories" if "Repo" in task else "get_current_weather", query=task)])
    if gold in names or gold in found:
        return Reply("", "", [call(gold, query=task)])
    return Reply("", "", [call("search_email", query=task)])  # chọn nhầm khi danh sách quá dài


def run(llm, task: str, mode: str) -> tuple[str | None, int]:
    messages = [{"role": "system", "content": "Bạn là trợ lý. Hãy gọi đúng MỘT tool phù hợp nhất cho yêu cầu."},
                {"role": "user", "content": task}]
    tools = TOOLS if mode == "full" else [DISCOVER]
    size = len(json.dumps(tools, ensure_ascii=False))
    for _ in range(3):
        reply = llm.chat(messages, tools, max_tokens=300)
        if not reply.tool_calls:
            return None, size
        c = reply.tool_calls[0]
        if c.name != "discover_tools":
            return c.name, size
        found = discover(c.arguments.get("need", task))
        messages.append(reply.to_message())
        # schema mới được nối vào CUỐI trajectory dưới dạng tool result → static prefix không đổi
        messages.append({"role": "tool", "tool_call_id": c.id, "content": json.dumps(found, ensure_ascii=False)})
        tools = [DISCOVER] + found
    return None, size


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mode", choices=["full", "discover"], default="discover")
    parser.add_argument("--mock", action="store_true")
    args = parser.parse_args()
    llm = make_llm(args.mock, mock_policy)

    correct = 0
    for task, gold in TASKS:
        chosen, size = run(llm, task, args.mode)
        ok = chosen == gold
        correct += ok
        print(f"{'✓' if ok else '✗'} {task}\n   chọn: {chosen}  (đúng: {gold}) · tool schema ban đầu ~{size:,} ký tự")
    print(f"\nChế độ {args.mode}: chọn đúng {correct}/{len(TASKS)}")


if __name__ == "__main__":
    main()
