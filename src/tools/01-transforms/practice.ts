// Tool 1 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { PracticeInfo } from "@/practice/adapter";

export const TRANSFORMS_PRACTICE: PracticeInfo = {
  tool: "transforms",
  id: 1,
  href: "/tools/transforms/",
  types: [
    { key: "mirror", label: "تصویر در آینه" },
    { key: "water", label: "تصویر در آب" },
    { key: "rotate", label: "دوران" },
    { key: "shift", label: "انتقال" },
    { key: "draw", label: "رسم روی شبکه" },
    { key: "sequence", label: "دنباله چرخشی" },
    { key: "combo", label: "چند تبدیل پشت‌سرهم" },
    { key: "which", label: "کدام تبدیل؟" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    otherReflection: "آینه و آب را با هم اشتباه می‌کند (قرینه را نسبت به خط دیگر می‌گیرد)",
    otherTurn: "اندازه یا جهت چرخش را اشتباه می‌گیرد",
    turnForFlip: "به جای قرینه کردن، شکل را می‌چرخاند",
    flipForTurn: "به جای چرخاندن، شکل را برعکس (قرینه) می‌کند",
    wrongOrder: "تبدیل‌ها را به ترتیب دیگری انجام می‌دهد",
    oneStep: "یکی از چند تبدیل را جا می‌اندازد یا عوض می‌کند",
    unchanged: "شکل را همان‌طور نگه می‌دارد و نمی‌چرخاند یا برعکس نمی‌کند",
    wrongWay: "در انتقال، جهت را برعکس می‌رود",
    offByOne: "در شمردن خانه‌ها یکی کم یا زیاد می‌شمارد",
    gap: "به جای اندازه جابه‌جایی، خانه‌های خالی بین دو شکل را می‌شمارد",
    swapped: "عدد حرکت افقی و عمودی را جابه‌جا می‌کند",
    oneDirection: "فقط یکی از دو حرکت (افقی یا عمودی) را انجام می‌دهد",
    onlyMoved: "شکل را جابه‌جا می‌کند ولی قرینه نمی‌کند",
    onlyReflected: "شکل را قرینه می‌کند ولی جابه‌جا نمی‌کند",
    count: "تعداد خانه‌هایی که رنگ می‌کند با شکل فرق دارد",
    place: "شکل درست است ولی جایش روی شبکه نه",
    notSlid: "در انتقال، شکل را می‌چرخاند یا برعکس می‌کند",
    shape: "شکلی که رنگ می‌کند با شکل اصلی فرق دارد",
    other: "جواب دیگری داد",
  },
};
