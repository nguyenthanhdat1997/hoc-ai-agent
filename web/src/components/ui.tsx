import type { ReactNode } from "react";

export function Callout({ kind, title, children }: { kind?: "ok" | "warn" | "bad"; title?: string; children: ReactNode }) {
  return (
    <div className={"callout " + (kind ?? "")}>
      {title && <div className="callout-title">{title}</div>}
      {children}
    </div>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return <div className="formula">{children}</div>;
}

export function Code({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre className="code" data-lang={lang}>
      <code>{children.replace(/^\n/, "").replace(/\s+$/, "")}</code>
    </pre>
  );
}

export function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type MsgKind = "system" | "tools" | "user" | "assistant" | "tool" | "status";
const ROLE_LABEL: Record<MsgKind, string> = {
  system: "system",
  tools: "tools",
  user: "user",
  assistant: "assistant",
  tool: "tool",
  status: "user · status",
};

export function Msg({ kind, children, ghost, fresh }: { kind: MsgKind; children: ReactNode; ghost?: boolean; fresh?: boolean }) {
  return (
    <div className={`msg ${kind}${ghost ? " ghost" : ""}${fresh ? " new" : ""}`}>
      <span className="role">{ROLE_LABEL[kind]}</span>
      {children}
    </div>
  );
}

export function Stat({ v, k }: { v: ReactNode; k: ReactNode }) {
  return (
    <div className="stat">
      <div className="v">{v}</div>
      <div className="k">{k}</div>
    </div>
  );
}
