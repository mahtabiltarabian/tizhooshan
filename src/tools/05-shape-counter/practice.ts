// Tool 5 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { PracticeInfo } from "@/practice/adapter";

export const SHAPE_COUNTER_PRACTICE: PracticeInfo = {
  tool: "shape-counter",
  id: 5,
  href: "/tools/shape-counter/",
  types: [
    { key: "triangle", label: "شمارش مثلث" },
    { key: "square", label: "شمارش مربع" },
    { key: "rectangle", label: "شمارش مستطیل" },
    { key: "segment", label: "شمارش پاره‌خط" },
    { key: "angle", label: "شمارش زاویه" },
    { key: "growing", label: "الگوی رشدکننده" },
    { key: "hidden", label: "شکل پنهان" },
    { key: "stroke", label: "رسم با یک خط" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    singles: "فقط شکل‌های کوچک (یک‌تکه) را می‌شمارد، نه شکل‌های ساخته‌شده از چند تکه",
    noSquares: "مربع‌ها را مستطیل حساب نمی‌کند",
    straight: "دو پرتوی روی یک خط راست (۱۸۰ درجه) را هم زاویه می‌شمارد",
    linear: "خیال می‌کند الگو هر بار به یک اندازه زیاد می‌شود",
    fewMissed: "چند شکل را جا می‌اندازد",
    under: "خیلی کمتر از تعداد واقعی می‌شمارد",
    over: "بیشتر از تعداد واقعی می‌شمارد (شکلی را دو بار می‌شمارد)",
    rotated: "شکل چرخیده را همان شکل می‌گیرد",
    flipped: "شکل وارونه (آینه‌ای) را همان شکل می‌گیرد",
    size: "شکل بزرگ‌تر را همان شکل می‌گیرد",
    nearMiss: "شکلی را می‌پذیرد که یک ضلعش روی خط‌ها نیست",
    notHidden: "شکلی را انتخاب می‌کند که شکل پنهان در آن نیست",
    fourOdd: "شکلِ با ۴ رأس فرد را یک‌خطی می‌داند",
    manyOdd: "شکلِ با رأس‌های فرد زیاد را یک‌خطی می‌داند",
    countLines: "درجه رأس را با شمردن خط‌ها می‌گیرد، نه سرهای خط",
    evenStart: "از رأس زوج شروع می‌کند",
    evenEnd: "خیال می‌کند کار در رأس زوج تمام می‌شود",
    backToStart: "خیال می‌کند قلم به جای شروع برمی‌گردد",
    countedEven: "رأس‌های زوج را به جای فرد می‌شمارد",
    countedAll: "همه رأس‌ها را می‌شمارد، نه فقط رأس‌های فرد",
    oddMiscount: "رأس‌های فرد را اشتباه می‌شمارد",
    other: "جواب دیگری داد",
  },
};
