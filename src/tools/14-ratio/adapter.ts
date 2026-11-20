// Tool 14 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks: a whole number, a fraction
// { n, d } (any equal fraction is right), the number of parts shaded, or for
// «مقایسه کسرها» the choice: 0 the first fraction, 1 the second, 2 equal.

import { isFrac, lcm, makeRatioQuestion, percentBlocks, ratioMistake, simplest, type Answer, type Frac, type Level, type RatioQuestion, type RatioQuestionType } from "@/generators/ratio";
import type { ToolAdapter } from "@/practice/adapter";
import { ltr } from "@/practice/text";
import { fa } from "@/tools/registry";
import { RATIO_PRACTICE } from "./practice";
import { DIVIDE_ITEMS, isFracView, PEOPLE, RATIO_THINGS, ratioHow, ratioSteps, type FracView, type Seg } from "./text";

const make = (type: string, level: number, seed: number) => makeRatioQuestion(type as RatioQuestionType, level as Level, seed);

/** A number, or a fraction of two numbers, as the panel sends it; null for anything else. */
function answerOf(r: unknown): Answer | null {
  if (typeof r === "number") return Number.isFinite(r) ? r : null;
  if (typeof r === "object" && r !== null && "n" in r && "d" in r) {
    const { n, d } = r as { n: unknown; d: unknown };
    if (typeof n === "number" && typeof d === "number" && Number.isFinite(n) && Number.isFinite(d) && d > 0) return { n, d };
  }
  return null;
}

function grade(type: string, level: number, seed: number, response: unknown): string {
  const v = answerOf(response);
  return v === null ? "other" : ratioMistake(make(type, level, seed), v);
}

const NUDGE: Record<RatioQuestionType, string> = {
  shade: "قسمت‌های شکل همه هم‌اندازه‌اند؛ مخرج کسر می‌گوید شکل به چند قسمت برابر تقسیم شود.",
  partOf: "عدد را نوار بکش و به اندازه‌ی مخرج، بلوک‌های برابر کن.",
  compare: "کسرهایی را می‌شود مقایسه کرد که قسمت‌هایشان هم‌اندازه باشند.",
  ratio: "در نسبت، همه‌ی بلوک‌ها هم‌اندازه‌اند؛ اول بپرس: یک بلوک چند است؟",
  divide: "هر نفر به اندازه‌ی عدد نسبتش بلوک دارد و همه‌ی بلوک‌ها هم‌اندازه‌اند.",
  percent: "درصد یعنی چند از هر ۱۰۰؛ کل همیشه ۱۰۰ درصد است.",
  work: "کار هر نفر (یا هر شیر) در یک ساعت یا یک روز را پیدا کن.",
};

const RULE: Record<RatioQuestionType, string> = {
  shade: "اگر شکل بیشتر از مخرج قسمت دارد، ببین هر یک قسمتِ کسر چند قسمتِ شکل است، و آن را در صورت ضرب کن.",
  partOf: "یک بلوک = عدد ÷ مخرج؛ کسر = چند بلوک (صورت). اگر کسری از عدد داده شده، از همان بلوک‌ها به کل برگرد.",
  compare: "دو کسر را هم‌مخرج کن؛ بعد هر کدام صورت بزرگ‌تری دارد بزرگ‌تر است.",
  ratio: "عدد داده‌شده را بر تعداد بلوک‌هایش تقسیم کن تا یک بلوک به دست بیاید، بعد در تعداد بلوک‌های خواسته‌شده ضرب کن.",
  divide: "کل را بر جمع عددهای نسبت تقسیم کن تا یک بلوک به دست بیاید، بعد در عدد نسبتِ آن نفر ضرب کن.",
  percent: "نوار ۱۰۰ درصد را به بلوک‌های برابر تقسیم کن؛ ببین هر بلوک چند درصد و چند واحد است.",
  work: "کارها در یک ساعت (یا روز) جمع می‌شوند، نه زمان‌ها. در مسئله‌ی کارگر، کل کار = کارگر × روز ثابت می‌ماند.",
};

function firstStep(type: string, level: number, seed: number): string {
  const q = make(type, level, seed);
  switch (q.type) {
    case "shade":
      return `گام اول: شکل ${fa(q.parts)} قسمت دارد و مخرج کسر ${fa(q.frac.d)} است؛ این قسمت‌ها را به ${fa(q.frac.d)} دسته‌ی برابر تقسیم کن.`;
    case "partOf":
      if (q.variant === "whole") return `گام اول: ${fa(q.part)} برابر ${fa(q.frac.n)} بلوک است؛ یک بلوک چند است؟`;
      return `گام اول: ${fa(q.whole)} را به ${fa(q.frac.d)} بلوک برابر تقسیم کن.`;
    case "compare": {
      const [f, g] = q.fracs;
      return `گام اول: مخرج مشترک ${fa(f.d)} و ${fa(g.d)} را پیدا کن: ${fa(lcm(f.d, g.d))}. هر دو کسر را با این مخرج بنویس.`;
    }
    case "ratio": {
      const [a, b] = q.ratio;
      return q.variant === "diff"
        ? `گام اول: اختلاف ${fa(b)} بلوک و ${fa(a)} بلوک را پیدا کن؛ این اختلاف همان عدد بیشتر بودن است.`
        : `گام اول: ${fa(a * q.k)} برابر ${fa(a)} بلوک است؛ یک بلوک چند است؟`;
    }
    case "divide":
      return `گام اول: عددهای نسبت را جمع کن تا ببینی ${fa(q.total)} روی هم چند بلوک است.`;
    case "percent": {
      const m = percentBlocks(q.pct);
      const step = `نوار ۱۰۰ درصد را ${fa(m)} بلوک برابر کن`;
      switch (q.variant) {
        case "of":
        case "off":
        case "up":
          return `گام اول: ${step}. ${fa(q.whole)} را هم به ${fa(m)} قسمت برابر تقسیم کن.`;
        case "whole":
          return `گام اول: ${fa(q.part)} برابر ${fa(q.pct)} درصد است. نوار ۱۰۰ درصد را بکش و ${fa(q.pct)} درصد را روی آن جدا کن؛ آن تکه را به بلوک‌های برابرِ کوچک‌تر تقسیم کن تا ببینی هر بلوک چند است و ۱۰۰ درصد چند بلوک دارد.`;
        case "what":
          return `گام اول: ${fa(q.part)} چه کسری از ${fa(q.whole)} است؟ آن کسر را با مخرج ۱۰۰ بنویس.`;
      }
      break;
    }
    case "work": {
      const unit = q.ctx === "tap" ? "ساعت" : "روز";
      if (q.variant === "crew") return `گام اول: کل کار را حساب کن: ${fa(q.crew[0])} کارگر × ${fa(q.crew[1])} روز.`;
      if (q.variant === "single") return `گام اول: در هر ${unit}، ۱ قسمت از ${fa(q.times[0])} قسمت کار انجام می‌شود.`;
      if (q.variant === "drain") return `گام اول: در هر ساعت شیر چه کسری را پر و سوراخ چه کسری را خالی می‌کند؟ کار یک ساعت = پرشده منهای خالی‌شده.`;
      return `گام اول: کار ${q.ctx === "tap" ? "هر شیر" : "هر نفر"} را در یک ${unit} بنویس و آن‌ها را با مخرج مشترک ${fa(q.times.reduce(lcm, 1))} جمع کن.`;
    }
  }
  return "گام اول: داده‌ها را روی نوار بکش.";
}

// ── Solution (report card after an exam) ─────────────────────────────────

/** A fraction written on one line, left to right: "۳/۴". */
export const fracFa = (f: Frac | FracView) => ltr(`${typeof f.n === "number" ? fa(f.n) : f.n}/${typeof f.d === "number" ? fa(f.d) : f.d}`);

/** The tool's segments as one line of text: fractions as "۳/۴", equations kept left to right. */
function plain(segs: Seg[]): string {
  return segs
    .map((s) => (typeof s === "string" ? s : isFracView(s) ? fracFa(s) : ltr(s.eq.map((p) => (typeof p === "string" ? p : `${typeof p.n === "number" ? fa(p.n) : p.n}/${typeof p.d === "number" ? fa(p.d) : p.d}`)).join(""))))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

const ORDER = ["اول", "دوم", "سوم"];

/** The answer named so it reads without the question: a number with what it counts, a fraction of what, or the option. */
function answerPhrase(q: RatioQuestion): string {
  const num = (v: number) => fa(v);
  switch (q.type) {
    case "shade":
      return `${num(q.answer)} قسمت از ${num(q.parts)} قسمتِ ${q.shape === "bar" ? "نوار" : "دایره"} رنگ می‌شود`;
    case "partOf":
      if (q.variant === "rest") return `${num(q.answer)} ${["شیرینی", "صفحه", "مهره"][q.item] ?? "تا"} می‌ماند`;
      return q.variant === "whole" ? `آن عدد ${num(q.answer)} است` : `${fracFa(q.frac)} از ${num(q.whole)} می‌شود ${num(q.answer)}`;
    case "compare":
      return q.answer === 2
        ? `«برابرند»؛ ${fracFa(q.fracs[0])} و ${fracFa(q.fracs[1])} با هم برابرند`
        : `کسر ${ORDER[q.answer]}، ${fracFa(q.fracs[q.answer])}، بزرگ‌تر است`;
    case "ratio": {
      const t = RATIO_THINGS[q.things];
      const who = q.variant === "other" ? t.b : q.variant === "total" ? t.all : t.a;
      return `${who} ${num(q.answer)} ${t.unit} هستند`;
    }
    case "divide":
      return `سهم ${PEOPLE[q.ask]} ${num(q.answer)} ${DIVIDE_ITEMS[q.item]} است`;
    case "percent":
      switch (q.variant) {
        case "of":
          return `${fa(q.pct)} درصد از ${num(q.whole)} می‌شود ${num(q.answer)}`;
        case "off":
          return q.item === 0 ? `قیمت تازه ${num(q.answer)} هزار تومان است` : `${num(q.answer)} نفر حاضرند`;
        case "up":
          return q.item === 0 ? `گیاه حالا ${num(q.answer)} سانتی‌متر است` : `قیمت تازه ${num(q.answer)} هزار تومان است`;
        case "whole":
          return `آن عدد ${num(q.answer)} است`;
        case "what":
          return `${num(q.part)}، ${num(q.answer)} درصدِ ${num(q.whole)} است`;
      }
      break;
    case "work": {
      const thing = q.ctx === "tap" ? "مخزن" : "دیوار";
      const time = q.ctx === "tap" ? "ساعت" : "روز";
      const done = q.ctx === "tap" ? "پر می‌شود" : "رنگ می‌شود";
      if (isFrac(q.answer)) return `در ${q.variant === "pairFraction" ? "یک" : fa(q.hours)} ${time}، ${fracFa(simplest(q.answer))} ${thing} ${done}`;
      if (q.variant === "crew") return `${fa(q.crew[2])} کارگر آن را در ${num(q.answer)} روز می‌سازند`;
      return `${num(q.answer)} ${time} طول می‌کشد تا ${thing} ${q.ctx === "tap" ? "پر شود" : "رنگ شود"}`;
    }
  }
  return "";
}

/** The answer as written in the report card (and in the test): simplest fraction, the number, or the option's fraction. */
export function answerToken(q: RatioQuestion): string {
  if (q.type === "compare") return q.answer === 2 ? "برابرند" : fracFa(q.fracs[q.answer]);
  return isFrac(q.answer) ? fracFa(simplest(q.answer)) : fa(q.answer);
}

const MAX = 300;

function solution(type: string, level: number, seed: number): string {
  const q = make(type, level, seed);
  const head = `جواب: ${answerPhrase(q)}.`;
  // The tool's own working («نشانم بده»), shortened to its last step when the whole is too long.
  const steps = ratioSteps(q);
  // A shade question's last step only repeats the answer; its middle step is the reason.
  const whole = q.type === "shade" ? steps[1] : ratioHow(q);
  for (const why of [plain(whole), plain(steps[steps.length - 1])]) {
    const s = `${head} ${why}${/[.!؟]$/.test(why) ? "" : "."}`;
    if (s.length <= MAX) return s;
  }
  return head;
}

export const RATIO_ADAPTER: ToolAdapter = {
  ...RATIO_PRACTICE,
  version: "ratio@1",
  grade,
  solution,
  hints: (type, level, seed) => [NUDGE[type as RatioQuestionType], RULE[type as RatioQuestionType], firstStep(type, level, seed)],
};
