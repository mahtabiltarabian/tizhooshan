// Tool 12 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is the number the panel checks: a weight, a count, an age, an
// average or a number of goods; for «کفه خالی» what is on the empty pan (kilos,
// or how many of the shape).

import { balanceMistake, stagesOf, SYMBOLS, type BalanceQuestion, type FillQuestion, type Level, type Pan } from "@/generators/balance";
import { exchangeMistake, GOODS, linkFactor } from "@/generators/exchange";
import { meanMistake } from "@/generators/mean";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { BALANCE_PRACTICE } from "./practice";
import { makeTryQuestion, type TryType } from "./questions";

const make = (type: string, level: number, seed: number) => makeTryQuestion(type as TryType, level as Level, seed);

// The mean generator's "noSubtract" is another slip than the scales' one.
const MEAN_TAG: Record<string, string> = { noSubtract: "meanNoSubtract" };

function grade(type: string, level: number, seed: number, response: unknown): string {
  if (typeof response !== "number" || !Number.isFinite(response)) return "other";
  const q = make(type, level, seed);
  if (q.type === "mean") {
    const t = meanMistake(q, response);
    return MEAN_TAG[t] ?? t;
  }
  if (q.type === "exchange") return exchangeMistake(q, response);
  return balanceMistake(q, response);
}

const NUDGE: Record<TryType, string> = {
  balance: "ترازوی متعادل یعنی دو کفه هم‌وزن‌اند؛ هر کاری با یک کفه بکنی، با کفه‌ی دیگر هم بکن.",
  fill: "اول وزن هر شکل را از ترازوهای متعادل پیدا کن، بعد سراغ ترازوی پرسش برو.",
  coin: "هر وزن‌کشی سه جواب دارد: کفه‌ی چپ پایین، کفه‌ی راست پایین، یا تعادل.",
  age: "سن‌ها را نوار بکش: سن کوچک‌تر یک تکه است.",
  mean: "میانگین یعنی اگر همه به یک اندازه داشتند، هر نفر چقدر داشت.",
  exchange: "هر مبادله مثل یک ترازوی متعادل است: دو طرفش یک ارزش دارند.",
};

const RULE: Record<TryType, string> = {
  balance: "شکل‌ها یا وزنه‌های یکسان را از هر دو کفه بردار؛ وقتی چند شکل یکسان تنها ماندند، کفه‌ی دیگر را بر تعدادشان تقسیم کن.",
  fill: "به جای هر شکل وزنش (یا هم‌ارزش) را بگذار؛ هر وزنه‌ای که از اول روی کفه است هم حساب می‌شود.",
  coin: "سکه‌ها را سه گروه تقریباً برابر کن و دو گروه را وزن کن؛ هر وزن‌کشی گروه مشکوک را یک‌سوم می‌کند.",
  age: "اختلاف سن هیچ‌وقت عوض نمی‌شود. جمع یا اختلاف را به تعداد تکه‌های برابر تقسیم کن.",
  mean: "جمع همه = میانگین × تعداد نفرها. اول جمع‌ها را پیدا کن، بعد مقایسه یا تقسیم کن.",
  exchange: "تعداد را به دسته‌های هم‌اندازه‌ی مبادله تقسیم کن و هر دسته را عوض کن؛ مبادله‌ها را یکی پس از دیگری برو.",
};

const glyph = (j: number) => SYMBOLS[j].glyph;

/** "●● + ۵" */
function panFa(p: Pan) {
  const parts = p.s.map((c, j) => (c ? glyph(j).repeat(c) : "")).filter(Boolean);
  if (p.k) parts.push(fa(p.k));
  return `⁦${parts.join(" + ")}⁩`;
}

/** The first stage of the child's way to solve the scales, without its result. */
function scalesStep(q: BalanceQuestion | FillQuestion): string {
  const open = q.type === "fill" ? q.scales.length : -1;
  const name = (i: number) => (i === open ? "ترازوی پرسش" : q.scales.length === 1 && q.type === "balance" ? "ترازو" : `ترازوی ${fa(i + 1)}`);
  const first = stagesOf(q).stages[0]?.step;
  if (!first) return `گام اول: به جای هر شکلِ ${name(open)}، وزنش را بگذار.`;
  switch (first.op) {
    case "remove":
      return `گام اول: از هر دو کفه‌ی ${name(first.focus)}، ${panFa(first.removed)} را بردار؛ ترازو متعادل می‌ماند.`;
    case "divide":
      return `گام اول: در ${name(first.focus)} فقط ${fa(first.times)} تا ${glyph(first.sym)} مانده؛ کفه‌ی دیگر را به همین تعداد قسمت برابر کن.`;
    case "value":
      return `گام اول: وزن ${glyph(first.sym)} را که پیدا کردی، در ترازوهای دیگر به جای هر ${glyph(first.sym)} بگذار.`;
    case "define":
      return `گام اول: ${name(first.from)} می‌گوید ${glyph(first.sym)} با چه چیزی هم‌وزن است؛ آن را در ${name(first.focus)} به جای ${glyph(first.sym)} بگذار.`;
  }
}

const good = (i: number) => GOODS[i].name;

function firstStep(type: string, level: number, seed: number): string {
  const q = make(type, level, seed);
  switch (q.type) {
    case "balance":
    case "fill":
      return scalesStep(q);
    case "coin":
      return q.variant === "min"
        ? `گام اول: ${fa(q.n)} سکه را سه گروه تقریباً برابر کن. بدترین حالت این است که تقلبی در بزرگ‌ترین گروه باشد.`
        : `گام اول: با یک وزن‌کشی، تقلبی را از میان ۳ سکه پیدا می‌کنی. هر وزن‌کشی بیشتر، تعداد سکه‌ها را چند برابر می‌کند؟`;
    case "age": {
      const diff = q.old - q.young;
      switch (q.variant) {
        case "sumDiff":
          return `گام اول: اختلاف ${fa(diff)} سال را از جمع ${fa(q.old + q.young)} سال کنار بگذار؛ آنچه می‌ماند دو تکه‌ی برابر است.`;
        case "timesSum":
          return `گام اول: سن ${q.younger} را یک تکه بگیر؛ سن ${q.older} ${fa(q.times)} تکه است. جمع ${fa(q.old + q.young)} سال روی هم چند تکه است؟`;
        case "timesDiff":
          return `گام اول: سن ${q.younger} را یک تکه بگیر؛ سن ${q.older} ${fa(q.times)} تکه است. اختلاف ${fa(diff)} سال چند تکه است؟`;
        case "later":
          return `گام اول: سن ${q.younger} را یک تکه بگیر. ${fa(q.years)} سال بعد، به نوار هر دو نفر ${fa(q.years)} سال اضافه می‌شود.`;
      }
      break;
    }
    case "mean":
      switch (q.variant) {
        case "plain":
          return "گام اول: همه‌ی عددها را با هم جمع کن و بشمار چند نفرند.";
        case "missing":
          return `گام اول: جمع همه‌ی ${fa(q.values.length)} نفر را پیدا کن: میانگین ${fa(q.a)} ضرب در تعداد نفرها.`;
        case "join":
          return `گام اول: جمعِ ${fa(q.n)} نفرِ اول را پیدا کن (${fa(q.n)} ضرب در ${fa(q.a)}) و جمعِ بعد از آمدن تازه‌وارد را هم.`;
        case "leave":
          return `گام اول: جمعِ ${fa(q.n)} نفر را پیدا کن (${fa(q.n)} ضرب در ${fa(q.a)})، بعد سهم کسی را که رفت از آن کم کن.`;
        case "groups":
          return `گام اول: جمع هر گروه را جدا پیدا کن: گروه اول ${fa(q.n)} ضرب در ${fa(q.a)}، گروه دوم ${fa(q.x)} ضرب در ${fa(q.b)}.`;
      }
      break;
    case "exchange": {
      if (q.variant === "compare") return `گام اول: حساب کن یک ${good(q.goods[2])} از راه بازار چند ${good(q.goods[0])} می‌شود، و آن را با پیشنهاد فروشنده مقایسه کن.`;
      const dir = q.to > q.from ? 1 : -1;
      const { mul, div } = linkFactor(q, q.from, q.from + dir);
      const A = good(q.goods[q.from]);
      const B = good(q.goods[q.from + dir]);
      return div === 1
        ? `گام اول: هر ${A} با ${fa(mul)} ${B} عوض می‌شود؛ ${fa(q.count)} ${A} را به ${B} تبدیل کن.`
        : `گام اول: ${fa(q.count)} ${A} را دسته‌های ${fa(div)}تایی کن؛ هر دسته با ${fa(mul)} ${B} عوض می‌شود.${q.variant === "leftover" ? " دسته‌ی ناقص عوض نمی‌شود." : ""}`;
    }
  }
  return "گام اول: داده‌های پرسش را روی ترازو بچین.";
}

export const BALANCE_ADAPTER: ToolAdapter = {
  ...BALANCE_PRACTICE,
  version: "balance@1",
  grade,
  hints: (type, level, seed) => [NUDGE[type as TryType], RULE[type as TryType], firstStep(type, level, seed)],
};
