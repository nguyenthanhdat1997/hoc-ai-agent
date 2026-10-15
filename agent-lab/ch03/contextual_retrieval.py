"""Bài 3.1 — BM25 viết tay và truy xuất theo ngữ cảnh (Chương 3 · Thí nghiệm 3-5, 3-10).

Kho tri thức: báo cáo quý của hai công ty HƯ CẤU (ACME, Globex) đã bị chia đoạn.
Nhiều đoạn rất mơ hồ khi tách khỏi tài liệu gốc: "Doanh thu quý hai tăng 3%" — công ty nào? năm nào?

So sánh hai chỉ mục:
  • thường:       đoạn văn gốc
  • theo ngữ cảnh: trước khi lập chỉ mục, LLM viết một câu "tiền tố ngữ cảnh" cho mỗi đoạn
                   (dựa trên toàn bộ tài liệu) rồi ghép vào đầu đoạn

Chạy:  python3 ch03/contextual_retrieval.py [--explain] [--mock]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from miniagent.llm import Reply, make_llm  # noqa: E402
from miniagent.retrieval import BM25, Doc  # noqa: E402

REPORTS = {
    "ACME — Báo cáo tài chính Q2/2025": [
        "Doanh thu quý hai tăng 3%, chủ yếu nhờ dòng sản phẩm máy lọc nước mới.",
        "Biên lợi nhuận gộp giảm nhẹ do chi phí linh kiện nhập khẩu tăng.",
        "Công ty dự kiến mở thêm hai nhà máy tại miền Trung trong năm tới.",
    ],
    "Globex — Báo cáo tài chính Q2/2025": [
        "Doanh thu quý hai giảm 5% vì thị trường xuất khẩu chậm lại.",
        "Chi phí marketing được cắt giảm 20% so với cùng kỳ.",
        "Công ty đang đàm phán mua lại một hãng phần mềm logistics.",
    ],
    "ACME — Báo cáo tài chính Q1/2025": [
        "Doanh thu quý một đi ngang so với cùng kỳ năm trước.",
        "Công ty ra mắt thử nghiệm máy lọc nước thế hệ mới tại Hà Nội.",
    ],
    "Sao Mai — Báo cáo tài chính Q2/2025": [
        "Doanh thu quý hai tăng 12% nhờ mảng du lịch phục hồi.",
        "Công ty mở thêm ba khách sạn ven biển.",
    ],
    "Hồng Hà — Báo cáo tài chính Q2/2025": [
        "Doanh thu quý hai thay đổi không đáng kể.",
        "Biên lợi nhuận cải thiện nhờ tự động hóa dây chuyền.",
    ],
    "Phương Nam — Báo cáo tài chính Q2/2024": [
        "Doanh thu quý hai tăng 3% so với cùng kỳ.",
        "Công ty có kế hoạch mua lại một chuỗi bán lẻ.",
    ],
}

# (câu hỏi, id đoạn đúng)
QUERIES = [
    ("Doanh thu quý hai của ACME thay đổi thế nào?", "ACME — Báo cáo tài chính Q2/2025#0"),
    ("Globex làm ăn quý hai ra sao, doanh thu tăng hay giảm?", "Globex — Báo cáo tài chính Q2/2025#0"),
    ("ACME có kế hoạch mở nhà máy không?", "ACME — Báo cáo tài chính Q2/2025#2"),
    ("Globex định mua lại công ty nào?", "Globex — Báo cáo tài chính Q2/2025#2"),
    ("Biên lợi nhuận của ACME quý 2 năm 2025", "ACME — Báo cáo tài chính Q2/2025#1"),
]

PREFIX_PROMPT = """Đây là toàn bộ tài liệu:
<document title="{title}">
{doc}
</document>
Đây là một đoạn trong tài liệu:
<chunk>{chunk}</chunk>
Viết MỘT câu ngắn đặt đoạn này vào ngữ cảnh của tài liệu (tên công ty, kỳ báo cáo, chủ đề) để giúp
tìm kiếm đoạn này. Chỉ trả về câu đó."""


def mock_policy(messages, tools) -> Reply:
    title = messages[-1]["content"].split('title="', 1)[1].split('"', 1)[0]
    company, period = title.split(" — ")[0], title.split("Q")[-1]
    return Reply(f"Đoạn trích từ báo cáo tài chính quý {period} của công ty {company}.")


def build_docs(llm, contextual: bool) -> list[Doc]:
    docs = []
    for title, chunks in REPORTS.items():
        whole = "\n".join(chunks)
        for i, chunk in enumerate(chunks):
            text = chunk
            if contextual:
                # Mỗi lời gọi lặp lại cùng tài liệu → với prompt caching chỉ tốn ~1/10 (Chương 2)
                prefix = llm.chat([{"role": "user", "content": PREFIX_PROMPT.format(title=title, doc=whole, chunk=chunk)}],
                                  max_tokens=80).content.strip()
                text = f"{prefix} {chunk}"
            docs.append(Doc(f"{title}#{i}", text))
    return docs


def evaluate(name: str, docs: list[Doc], explain: bool) -> None:
    index = BM25(docs)
    hit1 = hit3 = 0
    print(f"\n▶ Chỉ mục {name}")
    for q, gold in QUERIES:
        results = index.search(q, top_k=3)
        ids = [d.id for d, _ in results]
        hit1 += ids[:1] == [gold]
        hit3 += gold in ids
        mark = "✓" if ids[:1] == [gold] else ("~" if gold in ids else "✗")
        print(f"  {mark} {q}\n      top1: {ids[0] if ids else '(không có)'}")
        if explain and results:
            i = docs.index(results[0][0])
            parts = ", ".join(f"{t}(tf={tf}, idf={index.idf(t):.2f}) → {s:.2f}" for t, tf, s in index.explain(q, i))
            print(f"      BM25: {parts}")
    n = len(QUERIES)
    print(f"  hit@1 = {hit1}/{n}   hit@3 = {hit3}/{n}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--explain", action="store_true", help="in cách tính điểm BM25 của kết quả top1")
    parser.add_argument("--mock", action="store_true")
    args = parser.parse_args()

    llm = make_llm(args.mock, mock_policy)
    evaluate("thường (đoạn gốc)", build_docs(llm, contextual=False), args.explain)
    docs = build_docs(llm, contextual=True)
    print("\nVí dụ đoạn sau khi thêm tiền tố ngữ cảnh:\n  " + docs[0].text)
    evaluate("theo ngữ cảnh", docs, args.explain)


if __name__ == "__main__":
    main()
