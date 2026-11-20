// Tool 18 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { BinaryTag } from "@/generators/binary-code";
import type { CodeTag } from "@/generators/codes";
import type { PracticeInfo } from "@/practice/adapter";

export const CODES_PRACTICE: PracticeInfo = {
  tool: "codes",
  id: 18,
  href: "/tools/codes/",
  types: [
    { key: "shift", label: "جابه‌جایی حروف" },
    { key: "number", label: "رمز عددی" },
    { key: "shape", label: "رمز شکلی" },
    { key: "sentence", label: "رمزگشایی جمله" },
    { key: "binary", label: "کد دودویی" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    // letter, number and shape codes
    wrongWay: "جهت قانون را برعکس می‌رود (جلو به جای عقب یا برعکس)",
    offByOne: "یکی کم یا زیاد می‌شمارد (خود حرف را هم می‌شمارد)",
    arabic: "حرف‌های پ، چ، ژ، گ را در الفبا جا می‌اندازد",
    wrap: "سر آخر الفبا اشتباه می‌کند (بعد از ی دوباره ا می‌آید)",
    oneExample: "قانونی را می‌گیرد که فقط با یکی از مثال‌ها جور است",
    reversed: "ترتیب حرف‌ها را برعکس می‌نویسد",
    partial: "قانون را فقط روی بعضی حرف‌ها اجرا می‌کند",
    // binary code
    rtl: "کد دودویی را از راست به چپ می‌خواند، مثل متن فارسی",
    positions: "شماره جای کارت‌ها را جمع می‌زند، نه ارزششان را",
    pow10: "صفر و یک‌ها را مثل عدد معمولی (یکان، دهگان …) می‌خواند",
    pow2: "فراموش می‌کند که بزرگ‌ترین عدد با چند کارت، یکی کمتر از ارزش کارت بعدی است",
    count: "تعداد کارت‌ها را می‌شمارد، نه ارزششان را",
    biggest: "فقط ارزش بزرگ‌ترین کارت را می‌گوید",
    perNumber: "برای هر عدد یک لامپ جدا لازم می‌داند",
    noCarry: "در «یکی بیشتر»، کارت‌های کوچک‌تر را خاموش نمی‌کند",
    zeroBased: "حرف ا را صفر می‌گیرد، نه یک",
    other: "جواب دیگری داد",
  } satisfies Record<CodeTag | BinaryTag, string>,
};
