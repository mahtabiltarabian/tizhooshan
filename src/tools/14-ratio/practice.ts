// Tool 14 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { RatioTag } from "@/generators/ratio";
import type { PracticeInfo } from "@/practice/adapter";

/** Every tag of the ratio generator; the type keeps the list complete. */
const TAGS: Record<RatioTag, string> = {
  right: "درست",
  // Fractions
  numeratorOnly: "به اندازه‌ی صورت رنگ می‌کند، بی‌توجه به تعداد قسمت‌های شکل",
  denominator: "به اندازه‌ی مخرج رنگ می‌کند",
  complement: "بخش باقی‌مانده را به جای خود کسر می‌گوید",
  onePart: "فقط یک قسمت (یک بلوک) را می‌گوید",
  usedPart: "قسمت برداشته‌شده یا افزوده‌شده را به جای جواب می‌گوید",
  forward: "به جای پیدا کردن کل، از عدد داده‌شده کسر می‌گیرد (برعکس می‌رود)",
  restOnly: "فقط قسمت‌های دیگر را می‌گوید، نه کل را",
  notEqual: "دو کسر برابر را نابرابر می‌داند",
  biggerDenominator: "کسرِ با مخرج بزرگ‌تر را بزرگ‌تر می‌داند",
  biggerNumerator: "فقط صورت‌ها را مقایسه می‌کند و مخرج را نادیده می‌گیرد",
  gap: "«چند قسمت کم دارد» را مقایسه می‌کند، بی‌توجه به اندازه‌ی قسمت‌ها",
  // Ratio and sharing
  addDifference: "به جای ضرب، اختلاف را اضافه می‌کند",
  swapped: "نسبت یا تقسیم را برعکس می‌خواند",
  otherPart: "سهمِ چیز یا نفر دیگر را می‌گوید",
  givenPart: "همان عدد داده‌شده را دوباره می‌گوید",
  total: "جمع هر دو را به جای یکی می‌گوید",
  usedDifference: "اختلاف را به جای جواب می‌گوید",
  equalSplit: "مساوی تقسیم می‌کند، نه به نسبت",
  dividedByPart: "کل را بر عدد نسبتِ یک نفر تقسیم می‌کند، نه بر جمع نسبت‌ها",
  // Percent
  percentAsNumber: "خود عدد درصد را جواب می‌گیرد",
  subtractedPercent: "عدد درصد را مستقیم از عدد کم می‌کند",
  addedPercent: "عدد درصد را مستقیم به عدد اضافه می‌کند",
  partAsPercent: "خود جزء را درصد می‌گیرد",
  // Work
  oneUnit: "کار یک ساعت (یا یک روز) را می‌گوید، نه کار همه‌ی زمان را",
  inverted: "کسر کار را برعکس می‌نویسد",
  addedParts: "صورت‌ها را با هم و مخرج‌ها را با هم جمع می‌کند",
  addedTimes: "زمان‌ها را جمع می‌کند، در حالی که با هم کار کردن تندتر است",
  averaged: "میانگین زمان‌ها را می‌گیرد",
  addedRates: "کار سوراخ را به کار شیر اضافه می‌کند، نه کم",
  subtractedTimes: "خود زمان‌ها را از هم کم می‌کند، نه کار هر ساعت را",
  direct: "کارگر بیشتر را روز بیشتر می‌گیرد (تناسب معکوس را مستقیم می‌گیرد)",
  additive: "کارگر و روز را یکی‌یکی با هم کم و زیاد می‌کند",
  other: "جواب دیگری داد",
};

export const RATIO_PRACTICE: PracticeInfo = {
  tool: "ratio",
  id: 14,
  href: "/tools/ratio/",
  types: [
    { key: "shade", label: "کسر روی شکل" },
    { key: "partOf", label: "کسری از عدد" },
    { key: "compare", label: "مقایسه کسرها" },
    { key: "ratio", label: "نسبت" },
    { key: "divide", label: "تقسیم به نسبت" },
    { key: "percent", label: "درصد" },
    { key: "work", label: "مسئله کار" },
  ],
  levels: [1, 2, 3],
  tags: TAGS,
};
