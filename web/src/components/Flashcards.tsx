import { useMemo, useState } from "react";
import type { Flashcard } from "../lib/types";
import { update, useProgress } from "../lib/storage";

// Lặp lại ngắt quãng kiểu hộp Leitner: nhớ → lên hộp, quên → về hộp 0.
const INTERVAL_DAYS = [0, 1, 3, 7, 16, 35];
const DAY = 86_400_000;

export type DeckCard = Flashcard & { key: string; chapter: number };

export function Flashcards({ cards, onlyDue = false }: { cards: DeckCard[]; onlyDue?: boolean }) {
  const progress = useProgress();
  const [flipped, setFlipped] = useState(false);
  const [pos, setPos] = useState(0);
  const [sessionDone, setSessionDone] = useState<Set<string>>(new Set());

  const queue = useMemo(() => {
    const now = Date.now();
    const list = cards.filter((c) => !sessionDone.has(c.key) && (!onlyDue || (progress.cards[c.key]?.due ?? 0) <= now));
    // thẻ đến hạn / thẻ mới trước
    return list.sort((a, b) => (progress.cards[a.key]?.due ?? 0) - (progress.cards[b.key]?.due ?? 0));
  }, [cards, sessionDone, onlyDue, progress.cards]);

  const learned = cards.filter((c) => (progress.cards[c.key]?.box ?? 0) >= 2).length;

  if (queue.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Xong lượt ôn này 🎉</h3>
        <p className="muted">
          Đã thuộc {learned}/{cards.length} thẻ (ở hộp ≥ 2). Thẻ sẽ quay lại theo lịch: 1, 3, 7, 16, 35 ngày.
        </p>
        <button className="btn" onClick={() => setSessionDone(new Set())}>
          Ôn lại từ đầu
        </button>
      </div>
    );
  }

  const card = queue[Math.min(pos, queue.length - 1)];
  const state = progress.cards[card.key] ?? { box: 0, due: 0 };

  function grade(remembered: boolean) {
    const box = remembered ? Math.min(state.box + 1, INTERVAL_DAYS.length - 1) : 0;
    update((p) => ({ ...p, cards: { ...p.cards, [card.key]: { box, due: Date.now() + INTERVAL_DAYS[box] * DAY } } }));
    setSessionDone((s) => new Set(s).add(card.key));
    setFlipped(false);
    setPos(0);
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="muted small">
          Còn {queue.length} thẻ trong lượt · đã thuộc {learned}/{cards.length}
        </span>
        <span className="pill">Hộp {state.box}</span>
      </div>
      <div className="card flash" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setFlipped((f) => !f)}>
        <div>
          <div className="side">{flipped ? "Mặt sau" : "Mặt trước · bấm để lật"}</div>
          <div>{flipped ? card.back : card.front}</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12, justifyContent: "center" }}>
        {flipped ? (
          <>
            <button className="btn" onClick={() => grade(false)}>
              ✗ Chưa nhớ
            </button>
            <button className="btn primary" onClick={() => grade(true)}>
              ✓ Đã nhớ
            </button>
          </>
        ) : (
          <button className="btn primary" onClick={() => setFlipped(true)}>
            Lật thẻ
          </button>
        )}
      </div>
    </div>
  );
}
