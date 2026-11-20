// Tool 21 in practice sessions, without the generator.

import type { PracticeInfo } from "@/practice/adapter";

export const SPEED_TYPE_LABEL = {
  find: "همه را پیدا کن",
  count: "بشمار",
  differ: "کدام فرق دارد؟",
} as const;

export const SPEED_PRACTICE: PracticeInfo = {
  tool: "speed",
  id: 21,
  href: "/tools/speed/",
  types: (Object.keys(SPEED_TYPE_LABEL) as (keyof typeof SPEED_TYPE_LABEL)[]).map((key) => ({ key, label: SPEED_TYPE_LABEL[key] })),
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    mirror: "شکل آینه‌ای (برعکس) را با شکل اصلی یکی می‌گیرد",
    rotated: "شکل چرخیده را با شکل اصلی یکی می‌گیرد",
    missed: "بعضی شکل‌ها را جا می‌اندازد (ردیف به ردیف نمی‌گردد)",
    careless: "از عجله روی شکل‌های کاملاً دیگر هم می‌زند",
    offByOne: "در شمردن یکی کم یا زیاد می‌شمارد",
    other: "جواب دیگری داد",
  },
};
