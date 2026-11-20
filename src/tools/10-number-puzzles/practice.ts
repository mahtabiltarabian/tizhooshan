// Tool 10 in practice sessions, without the generators: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { PracticeInfo } from "@/practice/adapter";

export const NUMBER_PUZZLES_PRACTICE: PracticeInfo = {
  tool: "number-puzzles",
  id: 10,
  href: "/tools/number-puzzles/",
  types: [
    { key: "magic", label: "مربع جادویی" },
    { key: "pyramid", label: "هرم عددی" },
    { key: "grid", label: "جدول جمع" },
    { key: "star", label: "مثلث جادویی" },
    { key: "ring", label: "دایره و ستاره عددی" },
    { key: "shape", label: "عدد داخل شکل" },
    { key: "matrix", label: "ماتریس عددی" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    notInSet: "عددی می‌گذارد که جزو عددهای معما نیست",
    repeat: "یک عدد را دو بار به کار می‌برد",
    addedDown: "برای خانه پایینی یا یک جزء، به‌جای کم کردن جمع می‌کند",
    sumHabit: "از روی عادت گوشه‌ها را جمع می‌کند، بی‌آنکه قانون را امتحان کند",
    oneExample: "قانونی را به کار می‌برد که فقط با یکی از نمونه‌ها جور است",
    reversed: "سطر جدول را از چپ می‌خواند و جای دو عدد اول را عوض می‌کند",
    diagonal: "سطرها و ستون‌ها را درست می‌کند ولی قطرها را فراموش می‌کند",
    crossing: "خانه‌ای را که روی دو خط است فقط با یکی از آن خط‌ها جور می‌کند",
    lines: "بعضی خط‌ها جمع درست را ندارند",
    other: "جواب دیگری داد",
  },
};
