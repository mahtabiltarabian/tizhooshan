// Tool 11 in practice sessions, without the generators: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { PracticeInfo } from "@/practice/adapter";

export const NUMBER_MACHINE_PRACTICE: PracticeInfo = {
  tool: "number-machine",
  id: 11,
  href: "/tools/number-machine/",
  types: [
    { key: "run", label: "خروجی چیست؟" },
    { key: "reverse", label: "ورودی چه بود؟" },
    { key: "guess", label: "قانون پنهان" },
    { key: "build", label: "ماشین را بساز" },
    { key: "operator", label: "عملگر ★" },
    { key: "sort", label: "مرتب‌سازی و الگوریتم" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    // Machine and operator
    order: "مرحله‌ها یا دستورها را به ترتیب دیگری انجام می‌دهد",
    stopEarly: "یک مرحله را جا می‌اندازد و زود دست می‌کشد",
    wrongOp: "علامت را اشتباه می‌خواند (جمع را ضرب می‌کند یا برعکس)",
    noInvert: "برای پیدا کردن ورودی، ماشین را رو به جلو راه می‌اندازد",
    sameOps: "از آخر شروع می‌کند ولی کارها را برعکس نمی‌کند",
    keepOrder: "کارها را برعکس می‌کند ولی از مرحله اول شروع می‌کند، نه آخر",
    addOnly: "قانون را فقط از روی یک مثال حدس می‌زند (با جمع)",
    timesOnly: "قانون را فقط از روی یک مثال حدس می‌زند (با ضرب)",
    sequence: "خروجی‌های جدول را مثل دنباله ادامه می‌دهد",
    swapped: "جای a و b، یا عددهای کنارشان، را عوض می‌کند",
    noCoef: "عددهای کنار a و b را فراموش می‌کند",
    precedence: "پیش از حساب کردن پرانتز ضرب می‌کند",
    nestOrder: "در دو ★ پشت سر هم، پرانتز را جای اشتباه می‌گذارد",
    noDivide: "تفریق را درست می‌کند ولی تقسیم آخر را فراموش می‌کند",
    fitsSome: "ماشینی می‌سازد که فقط با بعضی از مثال‌ها جور است",
    // Sorting and algorithms
    fullSort: "به‌جای یک دور، کل ردیف را مرتب می‌کند",
    nonNeighbour: "جعبه‌هایی را که همسایه نیستند جابه‌جا می‌کند",
    direction: "جهت مقایسه را برعکس می‌گیرد",
    stopFirst: "دور را بعد از اولین جابه‌جایی رها می‌کند",
    comparisons: "به‌جای جابه‌جایی‌ها، مقایسه‌ها را می‌شمارد",
    loopMore: "حلقه را یک بار بیشتر اجرا می‌کند",
    loopLess: "حلقه را یک بار کمتر اجرا می‌کند",
    grouped: "اول دستور اول را همه بارها انجام می‌دهد، بعد دستور دوم را",
    skipStep: "یکی از دستورهای داخل حلقه را جا می‌اندازد",
    extraPass: "دور آخر را هم که فقط بررسی است و جابه‌جایی ندارد می‌شمارد",
    swapsNotPasses: "به‌جای دورها، جابه‌جایی‌ها را می‌شمارد",
    onePass: "فقط جابه‌جایی‌های دور اول را می‌شمارد",
    otherStep: "برنامه‌ای را برمی‌دارد که یکی از عددهایش فرق دارد",
    other: "جواب دیگری داد",
  },
};
