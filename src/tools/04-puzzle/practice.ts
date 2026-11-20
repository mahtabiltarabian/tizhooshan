// Tool 4 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { PracticeInfo } from "@/practice/adapter";

export const PUZZLE_PRACTICE: PracticeInfo = {
  tool: "puzzle",
  id: 4,
  href: "/tools/puzzle/",
  types: [
    { key: "build", label: "ساختن سایه" },
    { key: "overlay", label: "روی‌هم‌گذاری" },
    { key: "combine", label: "ترکیب دو شکل" },
    { key: "split", label: "تجزیه شکل" },
    { key: "extra", label: "قطعه اضافه" },
    { key: "complete", label: "کامل‌کردن شکل" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    crooked: "قطعه را کج می‌گذارد و صاف روی خط‌ها نمی‌نشاند",
    outside: "قطعه‌ای را بیرون از سایه جا می‌گذارد",
    overlap: "قطعه‌ها را روی هم می‌گذارد",
    sticking: "قسمتی از قطعه از سایه بیرون می‌زند",
    gap: "جای خالی در سایه می‌ماند",
    noTurn: "یادش می‌رود کاغذ دوم را اول بچرخاند یا برگرداند",
    otherTurn: "کاغذ را در جهت دیگر می‌چرخاند یا برمی‌گرداند",
    overlapOnly: "فقط خانه‌هایی را می‌گیرد که در هر دو کاغذ سیاه‌اند",
    xor: "خیال می‌کند سیاه روی سیاه پاک می‌شود",
    missed: "یک خانه سیاه را جا می‌اندازد",
    notMade: "شکلی را انتخاب می‌کند که این قطعه‌ها نمی‌سازند",
    shape: "اندازه را درست می‌بیند ولی شکل قطعه‌ها جور نمی‌شود",
    size: "قطعه‌ای با اندازه دیگر انتخاب می‌کند",
    mirror: "قطعه برگردانده (قرینه) را انتخاب می‌کند، که فقط با چرخاندن جا نمی‌شود",
    used: "قطعه‌ای را بیش از یک بار به کار می‌برد",
    notExtra: "قطعه‌ای را اضافه می‌داند که لازم است",
    other: "جواب دیگری داد",
  },
};
