// Tool 9 in practice sessions, without the generators: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { PracticeInfo } from "@/practice/adapter";

export const SEQUENCE_PRACTICE: PracticeInfo = {
  tool: "sequence",
  id: 9,
  href: "/tools/sequence/",
  types: [
    { key: "mixed", label: "به ترتیب سطح" },
    { key: "arithmetic", label: "حسابی" },
    { key: "geometric", label: "هندسی" },
    { key: "alternate", label: "یکی‌درمیان" },
    { key: "second", label: "اختلاف دوم" },
    { key: "additive", label: "جمع دو قبلی" },
    { key: "letters", label: "حرفی" },
    { key: "cycle", label: "تکرار و باقیمانده" },
    { key: "nth", label: "جمله nام" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    offByOne: "یکی کم یا زیاد می‌شمارد (یک حرف، یک خانه یا یک جهش)",
    // The rule of a sequence
    wrongWay: "جهت دنباله را برعکس می‌گیرد",
    extraStep: "یک گام زیادی جلو می‌رود",
    addFactor: "به‌جای ضرب یا تقسیم، جمع یا تفریق می‌کند",
    wrongStrand: "در دنباله یکی‌درمیان، گام دنباله کناری را به کار می‌برد",
    double: "به‌جای جمع دو جمله قبلی، جمله قبلی را دو برابر می‌کند",
    secondOff: "اختلاف بعدی را یک گام اشتباه می‌گیرد",
    sameDiff: "هر دنباله‌ای را با اختلاف ثابت ادامه می‌دهد",
    // Repeating patterns
    zeroFirst: "باقیمانده صفر را خانه اول دور می‌گیرد، نه خانه آخر",
    prefix: "خانه‌های اولِ تکرارنشدنی را فراموش می‌کند",
    quotient: "به‌جای باقیمانده، خارج‌قسمت را به کار می‌برد",
    cycles: "به‌جای تعداد خانه‌ها، تعداد دورها را می‌گوید",
    noRemainder: "خانه‌های دور آخرِ ناقص را نمی‌شمارد",
    wholeCycle: "دور آخرِ ناقص را کامل حساب می‌کند",
    // The nth term
    nJumps: "از جمله اول تا جمله n، به‌جای n − ۱ جهش، n جهش می‌رود",
    timesFirst: "شماره جمله را در جمله اول ضرب می‌کند",
    timesStep: "شماره جمله را در گام ضرب می‌کند و جمله اول را فراموش می‌کند",
    noStart: "جمله اول را به حساب نمی‌آورد",
    reverseOff: "به‌جای شماره جمله، تعداد جهش‌ها را می‌گوید",
    swapped: "در قانون جمله nام، جای دو عدد را عوض می‌کند",
    value: "به‌جای شماره جمله، خود عدد مشترک را می‌گوید",
    constant: "گام را درست می‌گیرد ولی عدد ثابت قانون را اشتباه حساب می‌کند",
    other: "جواب دیگری داد",
  },
};
