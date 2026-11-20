// Tool 14 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks: a whole number, a fraction
// { n, d } (any equal fraction is right), the number of parts shaded, or for
// «مقایسه کسرها» the choice: 0 the first fraction, 1 the second, 2 equal.

import { lcm, makeRatioQuestion, percentBlocks, ratioMistake, type Answer, type Level, type RatioQuestionType } from "@/generators/ratio";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { RATIO_PRACTICE } from "./practice";

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

export const RATIO_ADAPTER: ToolAdapter = {
  ...RATIO_PRACTICE,
  version: "ratio@1",
  grade,
  hints: (type, level, seed) => [NUDGE[type as RatioQuestionType], RULE[type as RatioQuestionType], firstStep(type, level, seed)],
};
