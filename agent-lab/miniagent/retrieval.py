"""Truy xuất — Chương 3. BM25 viết tay (truy xuất thưa) + hợp nhất RRF.

Không cần thư viện ngoài. Truy xuất dày đặc (embedding) cần một mô hình embedding riêng
nên ở đây chỉ minh họa phần thưa; cách hợp nhất RRF thì giống hệt khi có cả hai nhánh.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field

STOPWORDS = {"của", "và", "là", "có", "được", "cho", "các", "những", "một", "trong", "với", "này", "đã",
             "the", "of", "a", "an", "to", "in", "is", "and"}


def tokenize(text: str) -> list[str]:
    words = re.findall(r"\w+", text.lower())
    return [w for w in words if w not in STOPWORDS]


@dataclass
class Doc:
    id: str
    text: str
    meta: dict = field(default_factory=dict)


class BM25:
    """Score(Q,D) = Σ IDF(q) · TF·(k1+1) / (TF + k1·(1 − b + b·|D|/avgdl))"""

    def __init__(self, docs: list[Doc], k1: float = 1.5, b: float = 0.75):
        self.docs = docs
        self.k1, self.b = k1, b
        self.tf = [Counter(tokenize(d.text)) for d in docs]
        self.len = [sum(c.values()) for c in self.tf]
        self.avgdl = sum(self.len) / max(len(docs), 1)
        self.df: Counter = Counter()
        for c in self.tf:
            self.df.update(c.keys())  # chỉ mục đảo thu gọn: từ → số tài liệu chứa nó

    def idf(self, term: str) -> float:
        n, df = len(self.docs), self.df[term]
        return max(math.log((n - df + 0.5) / (df + 0.5)), 0.0)  # chặn dưới ở 0 cho từ quá phổ biến

    def explain(self, query: str, i: int) -> list[tuple[str, int, float]]:
        out = []
        for q in tokenize(query):
            tf = self.tf[i][q]
            if tf:
                norm = tf * (self.k1 + 1) / (tf + self.k1 * (1 - self.b + self.b * self.len[i] / self.avgdl))
                out.append((q, tf, self.idf(q) * norm))
        return out

    def search(self, query: str, top_k: int = 3) -> list[tuple[Doc, float]]:
        scored = [(d, sum(s for _, _, s in self.explain(query, i))) for i, d in enumerate(self.docs)]
        scored = [x for x in scored if x[1] > 0]
        return sorted(scored, key=lambda x: -x[1])[:top_k]


def rrf(rankings: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    """Reciprocal Rank Fusion: bỏ điểm gốc, chỉ dùng thứ hạng — score = Σ 1/(k + rank)."""
    scores: Counter = Counter()
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] += 1 / (k + rank)
    return scores.most_common()
