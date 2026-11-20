// Tool 3 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { PracticeInfo } from "@/practice/adapter";

export const PATTERNS_PRACTICE: PracticeInfo = {
  tool: "patterns",
  id: 3,
  href: "/tools/patterns/",
  types: [
    { key: "matrix2", label: "ماتریس ۲×۲" },
    { key: "matrix3", label: "ماتریس ۳×۳" },
    { key: "sequence", label: "دنباله تصویری" },
    { key: "rotation", label: "الگوی چرخشی" },
    { key: "combine", label: "جمع و تفریق شکل" },
    { key: "sides", label: "ضلع و نقطه" },
    { key: "missing", label: "قطعه گمشده" },
    { key: "odd", label: "شکل متفاوت" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    turn: "چرخش شکل را درست دنبال نمی‌کند",
    count: "تعداد شکل‌ها را درست دنبال نمی‌کند",
    shape: "نوع شکل را درست دنبال نمی‌کند",
    fill: "رنگ و نقش را درست دنبال نمی‌کند",
    lines: "خط‌ها را درست روی هم نمی‌گذارد",
    otherOp: "جمع و تفریق شکل را با هم اشتباه می‌کند (خط‌های مشترک)",
    copy: "خانه کناری را تکرار می‌کند و تغییر الگو را نمی‌بیند",
    marks: "جای نشانه‌های دور قاب را درست جلو نمی‌برد",
    arrow: "جهت پیکان را درست دنبال نمی‌کند",
    sides: "تعداد ضلع‌ها را درست دنبال نمی‌کند",
    dots: "تعداد نقطه‌ها را درست دنبال نمی‌کند",
    patchShift: "تکه‌ای از جای دیگر تصویر را برمی‌دارد",
    patchMirror: "خانه‌های درست را جابه‌جا می‌چیند",
    patchTile: "یکی از خانه‌های تکه را اشتباه می‌گیرد",
    notOdd: "شکلی را که با بقیه فرق دارد پیدا نمی‌کند",
    other: "جواب دیگری داد",
  },
};
