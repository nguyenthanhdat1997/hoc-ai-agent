import { useEffect, useState } from "react";
import { CHAPTERS, TIERS, chapterById } from "./content/chapters";
import { href, useRoute } from "./lib/router";
import { getPref, setPref, useProgress } from "./lib/storage";
import { ChapterPage } from "./components/ChapterPage";
import { Home, chapterProgress } from "./pages/Home";
import { Glossary } from "./pages/Glossary";
import { Review } from "./pages/Review";

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState(() => getPref("theme") ?? "auto");
  useEffect(() => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const cycle = () => {
    const next = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
    setPref("theme", next);
    setTheme(next);
  };
  return [theme, cycle];
}

export function App() {
  const route = useRoute();
  const progress = useProgress();
  const [open, setOpen] = useState(false);
  const [theme, cycleTheme] = useTheme();

  useEffect(() => setOpen(false), [route]);

  const chapter = route.page === "chapter" ? chapterById(route.id) : undefined;
  useEffect(() => {
    document.title = chapter ? `Ch.${chapter.id} · ${chapter.short} — Học AI Agent` : "Học AI Agent";
  }, [chapter]);

  const sidebar = (
    <aside className={"sidebar" + (open ? " open" : "")}>
      <a className="brand" href={href.home}>
        <span className="brand-mark">AI</span>
        <span>Học AI Agent</span>
      </a>
      <a className={"nav-item" + (route.page === "home" ? " active" : "")} href={href.home}>🏠 Tổng quan</a>
      <a className={"nav-item" + (route.page === "review" ? " active" : "")} href={href.review}>🧠 Ôn tập hằng ngày</a>
      <a className={"nav-item" + (route.page === "glossary" ? " active" : "")} href={href.glossary}>📚 Thuật ngữ</a>
      {TIERS.map((tier) => (
        <div key={tier}>
          <div className="nav-group">{tier}</div>
          {CHAPTERS.filter((c) => c.tier === tier).map((c) => {
            const active = route.page === "chapter" && route.id === c.id;
            const pct = Math.round(chapterProgress(c, progress) * 100);
            return (
              <a key={c.id} href={href.chapter(c.id)} className={"nav-item" + (active ? " active" : "") + (c.ready ? "" : " soon")}>
                <span className="nav-num">{c.id}</span>
                <span>{c.short}</span>
                <span className="nav-ring">{c.ready ? (pct ? `${pct}%` : "") : "—"}</span>
              </a>
            );
          })}
        </div>
      ))}
      <div className="sidebar-footer">
        <button className="btn small" onClick={cycleTheme}>
          {theme === "auto" ? "🌓 Tự động" : theme === "light" ? "☀️ Sáng" : "🌙 Tối"}
        </button>
        <p className="small muted" style={{ margin: "8px 0 0" }}>
          Ghi chú học tập dựa trên sách “AI Agents in Depth” của Li Bojie (
          <a href="https://github.com/bojieli/ai-agent-book" target="_blank" rel="noreferrer">mã nguồn gốc</a>).
          Không thay thế bản gốc.
        </p>
      </div>
    </aside>
  );

  return (
    <div className="app">
      {sidebar}
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <div className="topbar">
          <button className="btn small" onClick={() => setOpen(true)} aria-label="Mở menu">☰</button>
          <b>Học AI Agent</b>
        </div>
        <main className="content">
          {route.page === "home" && <Home />}
          {route.page === "glossary" && <Glossary />}
          {route.page === "review" && <Review />}
          {route.page === "chapter" &&
            (chapter ? <ChapterPage ch={chapter} tab={route.tab} /> : <p>Không tìm thấy chương. <a href={href.home}>Về trang chủ</a></p>)}
        </main>
      </div>
    </div>
  );
}
