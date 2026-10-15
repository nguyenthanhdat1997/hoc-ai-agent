"""Bài 3.2 — RAG thường vs RAG có tính tác tử, và vấn đề "ranh giới" (Chương 3 · mục 3.3, Thí nghiệm 3-8).

Kho tri thức: các phiếu hỗ trợ khách hàng của nhà mạng HƯ CẤU "NetViet" về chương trình giảm giá.
Mỗi phiếu chỉ ghi kết luận của MỘT trường hợp; không phiếu nào nêu phạm vi đủ điều kiện của chính sách,
và KHÔNG có phiếu nào về y tá — mô hình phải suy từ các trường hợp "gần giống".

Câu hỏi: "Tôi là y tá, tôi có được giảm giá không?"
  • RAG thường:   truy xuất 1 lần theo câu hỏi → trả lời (dễ mắc thiên lệch láng giềng gần nhất)
  • RAG tác tử:   Agent tự gọi knowledge_base_search nhiều lần, đổi từ khóa, tự đánh giá đã đủ chưa
  • --rule-card:  thêm một "thẻ quy tắc" đã được chắt lọc ngoại tuyến từ toàn bộ phiếu (cách sửa của sách)

Đáp án đúng: y tá CÓ đủ điều kiện (chuyên gia y tế có giấy phép); giáo viên thì KHÔNG.

Chạy:  python3 ch03/agentic_rag.py --mode plain|agentic [--rule-card] [--mock]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from miniagent.agent import Agent  # noqa: E402
from miniagent.llm import Reply, call, make_llm  # noqa: E402
from miniagent.retrieval import BM25, Doc  # noqa: E402
from miniagent.tools import Tool, ToolRegistry  # noqa: E402

TICKETS = [
    "Phiếu #101: Khách hàng Minh, cựu chiến binh, xin giảm giá gói internet. Kết quả: ĐƯỢC DUYỆT giảm 15%.",
    "Phiếu #102: Khách hàng Lan, bác sĩ đa khoa có chứng chỉ hành nghề, hỏi chương trình ưu đãi. Kết quả: ĐƯỢC giảm 15%.",
    "Phiếu #103: Khách hàng Hùng, giáo viên tiểu học, xin giảm giá theo nghề nghiệp. Kết quả: KHÔNG đủ điều kiện.",
    "Phiếu #104: Khách hàng Tú, quân nhân tại ngũ. Kết quả: ĐƯỢC DUYỆT giảm 15%.",
    "Phiếu #106: Khách hàng Nam, kỹ sư phần mềm, hỏi ưu đãi nghề nghiệp. Kết quả: KHÔNG đủ điều kiện.",
    "Phiếu #107: Khách hàng Mai, dược sĩ có giấy phép, xin giảm giá. Kết quả: ĐƯỢC giảm 15%.",
    "Phiếu #108: Khách hàng Bình, giảng viên đại học, xin ưu đãi. Kết quả: KHÔNG đủ điều kiện.",
    "Phiếu #109: Khách hàng Đức hỏi về tốc độ mạng chậm buổi tối. Kết quả: đã reset modem.",
    "Phiếu #110: Khách hàng Thu hỏi cách đổi mật khẩu wifi. Kết quả: hướng dẫn qua ứng dụng.",
]
RULE_CARD = ("Thẻ quy tắc (chắt lọc từ toàn bộ phiếu): Chương trình giảm 15% của NetViet CHỈ áp dụng cho quân nhân "
             "tại ngũ, cựu chiến binh và chuyên gia y tế có giấy phép (bác sĩ, y tá, dược sĩ). Mọi nghề khác như "
             "giáo viên, giảng viên, kỹ sư đều KHÔNG đủ điều kiện.")

QUESTION = "Tôi là y tá, tôi có được giảm giá gói internet không? Nếu không thì vì sao?"
SYSTEM = "Bạn là nhân viên CSKH của NetViet. Chỉ trả lời dựa trên tri thức truy xuất được; nói rõ căn cứ (số phiếu)."


def make_index(rule_card: bool) -> BM25:
    docs = [Doc(f"t{i}", t) for i, t in enumerate(TICKETS)]
    if rule_card:
        docs.append(Doc("rule", RULE_CARD))
    return BM25(docs)


def plain_rag(llm, index: BM25, top_k: int) -> str:
    hits = index.search(QUESTION, top_k=top_k)
    context = "\n".join(d.text for d, _ in hits)
    print("Đoạn được truy xuất (1 lần):\n  " + "\n  ".join(d.text[:90] for d, _ in hits))
    return llm.chat([{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": f"Tri thức:\n{context}\n\nCâu hỏi: {QUESTION}"}]).content


def mock_policy(messages, tools) -> Reply:
    text = " ".join(m["content"] for m in messages if m["role"] in ("user", "tool"))
    if tools:  # chế độ tác tử
        searched = sum(1 for m in messages for _ in m.get("tool_calls") or [])
        if searched == 0:
            return Reply("", "Tìm trường hợp y tá trước.", [call("knowledge_base_search", query="y tá giảm giá")])
        if searched == 1:
            return Reply("", "Cần biết phạm vi chính sách, tìm thêm nghề khác.",
                         [call("knowledge_base_search", query="chuyên gia y tế giấy phép đủ điều kiện")])
    if "Thẻ quy tắc" in text:
        return Reply("Có. Theo thẻ quy tắc, chuyên gia y tế có giấy phép (bác sĩ, y tá, dược sĩ) được giảm 15%.")
    if "giáo viên" in text and "bác sĩ" not in text:
        return Reply("Không. Phiếu #103 cho thấy ưu đãi nghề nghiệp không được duyệt.")
    if "bác sĩ" in text and "ĐƯỢC" in text:
        return Reply("Có lẽ có, vì bác sĩ được giảm 15% (phiếu #102) và y tá cũng là nghề y — nhưng tôi đang suy đoán.")
    return Reply("Tôi không chắc, không thấy trường hợp tương tự.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mode", choices=["plain", "agentic"], default="plain")
    parser.add_argument("--rule-card", action="store_true", help="thêm thẻ quy tắc đã chắt lọc vào kho")
    parser.add_argument("--top-k", type=int, default=2)
    parser.add_argument("--mock", action="store_true")
    args = parser.parse_args()

    llm = make_llm(args.mock, mock_policy)
    index = make_index(args.rule_card)
    print(f"Chế độ: {args.mode} · thẻ quy tắc: {'có' if args.rule_card else 'không'} · top_k={args.top_k}\n")

    if args.mode == "plain":
        answer = plain_rag(llm, index, args.top_k)
        print(f"\n🤖 {answer}")
    else:
        def knowledge_base_search(query: str) -> str:
            return "\n".join(d.text for d, _ in index.search(query, top_k=args.top_k)) or "(không có kết quả)"

        tool = Tool("knowledge_base_search", "Tìm trong kho phiếu hỗ trợ và quy tắc của NetViet. Có thể gọi nhiều lần "
                    "với từ khóa khác nhau cho đến khi đủ thông tin.",
                    {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
                    knowledge_base_search)
        agent = Agent(llm, SYSTEM + " Hãy tìm kiếm nhiều lần nếu cần, kể cả để xác nhận PHẠM VI của chính sách.",
                      ToolRegistry([tool]), max_iterations=6)
        agent.run(QUESTION)

    print("\nĐáp án đúng: CÓ — y tá có giấy phép thuộc nhóm chuyên gia y tế được giảm 15%.")


if __name__ == "__main__":
    main()
