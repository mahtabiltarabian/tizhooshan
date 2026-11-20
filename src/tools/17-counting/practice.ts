// Tool 17 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { CountingTag } from "@/generators/counting";
import type { PracticeInfo } from "@/practice/adapter";

export const COUNTING_PRACTICE: PracticeInfo = {
  tool: "counting",
  id: 17,
  href: "/tools/counting/",
  types: [
    { key: "tree", label: "درخت حالت‌ها" },
    { key: "arrange", label: "چیدن در ردیف" },
    { key: "choose", label: "انتخاب گروه" },
    { key: "handshake", label: "دست‌دادن" },
    { key: "grid", label: "مسیر در شبکه" },
    { key: "pigeonhole", label: "لانه کبوتری" },
    { key: "probability", label: "احتمال" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    unordered: "ترتیب را نادیده می‌گیرد، جایی که ترتیب مهم است",
    ordered: "ترتیب را هم می‌شمارد، جایی که ترتیب مهم نیست (هر گروه را چند بار می‌شمارد)",
    added: "جمع می‌کند جایی که باید ضرب کند",
    multiplied: "ضرب می‌کند جایی که باید جمع کند",
    repeated: "تکرار را مجاز می‌گیرد (یک چیز را دو بار به کار می‌برد)",
    forgotCondition: "شرط سؤال را فراموش می‌کند و همه حالت‌ها را می‌شمارد",
    complement: "حالت‌های برعکسِ خواسته‌شده را می‌شمارد",
    doubleCounted: "هر دست‌دادن را دو بار می‌شمارد",
    square: "هر نفر را با خودش هم می‌شمارد و هر دست‌دادن را دو بار",
    perPerson: "فقط دست‌دادن‌های یک نفر را می‌شمارد",
    addedParts: "راه‌های دو تکه مسیر را جمع می‌کند به جای ضرب",
    offByOne: "یکی کم یا زیاد می‌شمارد",
    lucky: "خوش‌شانس‌ترین حالت را در نظر می‌گیرد، نه بدترین را",
    tooMany: "بیشتر از لازم برمی‌دارد",
    forgotLimit: "فراموش می‌کند که از بعضی رنگ‌ها تعداد کمی هست",
    odds: "حالت‌های خوب را بر حالت‌های بد تقسیم می‌کند، نه بر همه حالت‌ها",
    other: "جواب دیگری داد",
  } satisfies Record<CountingTag, string>,
};
