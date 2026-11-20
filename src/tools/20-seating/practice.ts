// Tool 20 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { SeatTag } from "@/generators/seating";
import type { PracticeInfo } from "@/practice/adapter";

export const SEATING_PRACTICE: PracticeInfo = {
  tool: "seating",
  id: 20,
  href: "/tools/seating/",
  types: [
    { key: "queue", label: "صف" },
    { key: "rank", label: "رتبه‌بندی" },
    { key: "floors", label: "طبقه‌ها" },
    { key: "round", label: "میز گرد" },
    { key: "rect", label: "میز مستطیل" },
    { key: "family", label: "شجره‌نامه" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    flipped: "ترتیب را برعکس می‌گیرد (اول و آخر، یا راست و چپ)",
    sideFlip: "راست و چپ کسی را از نگاه خود او نمی‌بیند",
    opposite: "کنارِ روبه‌رو را به جای خودِ روبه‌رو می‌گیرد",
    apartCount: "در «چند جا فاصله» یکی کم یا زیاد می‌شمارد",
    offByOne: "یک جا جلوتر یا عقب‌تر را می‌گوید",
    frontBack: "«درست جلوی» و «درست پشتِ» را جابه‌جا می‌گیرد",
    side: "طرف پدری و مادری را جابه‌جا می‌گیرد (مثلاً عمو به جای دایی)",
    gender: "مرد و زن را جابه‌جا می‌گیرد (مثلاً عمو به جای عمه)",
    generation: "یک نسل را جابه‌جا می‌گیرد (مثلاً پدربزرگ به جای پدر)",
    inverse: "نسبت را برعکس می‌خواند (مثلاً نوه به جای پدربزرگ)",
    other: "جواب دیگری داد",
  } satisfies Record<SeatTag, string>,
};
