// Tool 2 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { PracticeInfo } from "@/practice/adapter";

export const PAPER_PRACTICE: PracticeInfo = {
  tool: "paper",
  id: 2,
  href: "/tools/paper/",
  types: [
    { key: "holes", label: "سوراخ‌ها روی شبکه" },
    { key: "holesChoice", label: "سوراخ‌ها (گزینه‌ای)" },
    { key: "cutChoice", label: "برش گوشه" },
    { key: "pieces", label: "چند تکه؟" },
    { key: "foldedShape", label: "شکل تاشده" },
    { key: "order", label: "ترتیب تاها" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    missingFold: "یکی از تاها را باز نمی‌کند (سوراخ یا برش کمتری می‌بیند)",
    wrongAxis: "قرینه را نسبت به خط تای دیگری می‌کشد",
    shifted: "جای سوراخ‌ها را جابه‌جا می‌گذارد",
    otherSide: "طرف دیگر کاغذ را تا می‌کند",
    otherCorner: "گوشه دیگری از کاغذ را بریده می‌بیند",
    layers: "تعداد لایه‌ها را به جای تعداد تکه‌ها می‌گوید",
    offByOne: "تکه‌ها را یکی‌دو تا کم یا زیاد می‌شمارد",
    holeCount: "تعداد سوراخ‌ها را اشتباه می‌گیرد (هر لایه یک سوراخ دارد)",
    holePlace: "تعداد سوراخ‌ها درست است ولی جایشان نه",
    orderOpen: "کاغذ باز با سوراخ‌ها را زودتر از سوراخ کردن می‌گذارد",
    orderPunch: "سوراخ کردن را پیش از تا کردن می‌گذارد",
    orderStart: "از کاغذ کامل شروع نمی‌کند",
    orderMixed: "ترتیب تاها را به هم می‌ریزد",
    other: "جواب دیگری داد",
  },
};
