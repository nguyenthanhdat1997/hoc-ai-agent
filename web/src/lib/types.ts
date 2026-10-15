import type { ComponentType, ReactNode } from "react";

export type QuizQuestion = { q: string; options: string[]; answer: number; explain: string };
export type Flashcard = { front: string; back: string };
export type Term = { en: string; vi: string; note: string };
export type Section = { id: string; title: string; body: ReactNode };
export type Pitfall = { wrong: string; right: string };
export type Demo = { id: string; title: string; desc: string; component: ComponentType };
export type LabStep = {
  id: string;
  title: string;
  file: string; // đường dẫn trong agent-lab
  code: string; // nội dung file (import ?raw)
  run: string[]; // lệnh chạy
  observe: ReactNode; // cần quan sát gì
  result?: ReactNode; // kết quả chạy thật đã ghi lại
};
export type ApplyTask = { title: string; prompt: ReactNode; hint: ReactNode };

export type Chapter = {
  id: number;
  title: string;
  short: string;
  tier: string;
  minutes: number;
  ready: boolean;
  oneLiner: string;
  keyIdeas?: string[];
  sections?: Section[];
  pitfalls?: Pitfall[];
  demos?: Demo[];
  lab?: { intro: ReactNode; steps: LabStep[] };
  apply?: ApplyTask[];
  glossary?: Term[];
  quiz?: QuizQuestion[];
  cards?: Flashcard[];
};
