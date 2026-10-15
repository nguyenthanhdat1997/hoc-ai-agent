// Tiến độ học lưu trong trình duyệt (localStorage). Mọi truy cập đều bọc try/catch:
// ở chế độ riêng tư hoặc khi bị chặn, trang vẫn chạy bình thường, chỉ là không nhớ tiến độ.
import { useCallback, useEffect, useState } from "react";

export type CardState = { box: number; due: number };
export type Progress = {
  read: Record<string, boolean>; // "ch1:s1"
  demos: Record<string, boolean>; // "ch1:react"
  labs: Record<string, boolean>; // "ch1:react_loop"
  quiz: Record<number, number>; // chapter -> best score (0..1)
  cards: Record<string, CardState>; // "ch1:3"
  notes: Record<string, string>; // "ch1:apply0"
};

const KEY = "agentbook.progress.v1";
const empty: Progress = { read: {}, demos: {}, labs: {}, quiz: {}, cards: {}, notes: {} };

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* bỏ qua */
  }
}

let state: Progress = load();
const listeners = new Set<() => void>();

export function update(fn: (p: Progress) => Progress) {
  state = fn(state);
  save(state);
  listeners.forEach((l) => l());
}

export function useProgress(): Progress {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

export function useFlag(group: "read" | "demos" | "labs", key: string): [boolean, (v: boolean) => void] {
  const p = useProgress();
  const set = useCallback(
    (v: boolean) => update((s) => ({ ...s, [group]: { ...s[group], [key]: v } })),
    [group, key],
  );
  return [!!p[group][key], set];
}

export function getPref(key: string): string | null {
  try {
    return localStorage.getItem("agentbook.pref." + key);
  } catch {
    return null;
  }
}

export function setPref(key: string, value: string) {
  try {
    localStorage.setItem("agentbook.pref." + key, value);
  } catch {
    /* bỏ qua */
  }
}

export function resetProgress() {
  update(() => empty);
}
