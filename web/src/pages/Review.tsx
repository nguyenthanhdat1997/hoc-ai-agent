import { useState } from "react";
import { CHAPTERS } from "../content/chapters";
import { Flashcards, type DeckCard } from "../components/Flashcards";
import { resetProgress, useProgress } from "../lib/storage";

export function Review() {
  const p = useProgress();
  const [onlyDue, setOnlyDue] = useState(true);
  const cards: DeckCard[] = CHAPTERS.flatMap((c) => (c.cards ?? []).map((card, i) => ({ ...card, key: `ch${c.id}:${i}`, chapter: c.id })));
  const due = cards.filter((c) => (p.cards[c.key]?.due ?? 0) <= Date.now()).length;

  return (
    <>
      <h1>Ôn tập hằng ngày</h1>
      <p className="oneliner">
        Flashcard của mọi chương đã học, theo lịch lặp lại ngắt quãng. Mỗi ngày 5 phút là đủ để không quên.
      </p>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className={"btn small" + (onlyDue ? " on" : "")} onClick={() => setOnlyDue(true)}>Chỉ thẻ đến hạn ({due})</button>
        <button className={"btn small" + (!onlyDue ? " on" : "")} onClick={() => setOnlyDue(false)}>Tất cả ({cards.length})</button>
      </div>
      <Flashcards key={String(onlyDue)} cards={cards} onlyDue={onlyDue} />
      <div style={{ marginTop: 40 }}>
        <button className="btn small" onClick={() => confirm("Xóa toàn bộ tiến độ học, điểm quiz và ghi chú?") && resetProgress()}>
          Xóa tiến độ học
        </button>
      </div>
    </>
  );
}
