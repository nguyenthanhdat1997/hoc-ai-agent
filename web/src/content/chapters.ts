import type { Chapter } from "../lib/types";
import { ch1 } from "./ch1";
import { ch2 } from "./ch2";
import { ch3 } from "./ch3";
import { ch4 } from "./ch4";
import { ch5 } from "./ch5";
import { ch6 } from "./ch6";
import { ch7 } from "./ch7";
import { ch8 } from "./ch8";
import { ch9 } from "./ch9";
import { ch10 } from "./ch10";

export const TIERS = ["Nền tảng", "Xây dựng Agent", "Đánh giá & cải tiến", "Mở rộng"];

export const CHAPTERS: Chapter[] = [
  ch1,
  ch2,
  ch3,
  ch4,
  ch5,
  ch6,
  ch7,
  ch8,
  ch9,
  ch10,
];

export const chapterById = (id: number) => CHAPTERS.find((c) => c.id === id);
