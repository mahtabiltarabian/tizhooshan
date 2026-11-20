// Tool 1 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks: the index of the picked option
// (mirror, water, rotate, combo, sequence, which, and a "which slide?"
// shift), or the coloured cells as "x,y" keys (draw, and a shift drawn on
// the grid).

import { makeTransformQuestion, paintMistake, type Level, type MoveName, type Pt, type TransformQuestion, type TransformQuestionType } from "@/generators/transforms";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { TRANSFORMS_PRACTICE } from "./practice";

const make = (type: string, level: number, seed: number) => makeTransformQuestion(type as TransformQuestionType, level as Level, seed);

const isFlip = (m: MoveName) => m === "mirror" || m === "water";

/** "which": the tool's own "close" test, named by the kind of mix-up. */
function whichSlip(right: MoveName, chosen: MoveName): string {
  if (isFlip(right)) return isFlip(chosen) ? "otherReflection" : "turnForFlip";
  return isFlip(chosen) ? "flipForTurn" : "otherTurn";
}

const isIndex = (r: unknown, n: number): r is number => typeof r === "number" && Number.isInteger(r) && r >= 0 && r < n;

function grade(type: string, level: number, seed: number, response: unknown): string {
  const q = make(type, level, seed);
  if (q.type === "draw" || (q.type === "shift" && q.form === "draw")) {
    if (!Array.isArray(response) || !response.every((k) => typeof k === "string")) return "other";
    return paintMistake(q, response);
  }
  if (!isIndex(response, q.options.length)) return "other";
  if (response === q.answer) return "right";
  if (q.type === "which") return whichSlip(q.options[q.answer], q.options[response]);
  return q.mistakes[response] ?? "other";
}

const NUDGE: Record<TransformQuestionType, string> = {
  mirror: "یک خانه از شکل را که به آینه نزدیک‌تر است پیدا کن؛ در تصویر هم باید نزدیک آینه باشد.",
  water: "یک خانه از شکل را که به آب نزدیک‌تر است پیدا کن؛ در تصویر هم باید نزدیک آب باشد.",
  rotate: "کاغذ را در ذهنت بچرخان؛ شکل فقط می‌چرخد و برعکس نمی‌شود.",
  shift: "در انتقال شکل فقط سُر می‌خورد؛ نه می‌چرخد و نه برعکس می‌شود.",
  draw: "یک خانه را انتخاب کن و فقط همان را جابه‌جا کن؛ بعد خانه بعدی.",
  sequence: "دو شکل پشت‌سرهم را با هم مقایسه کن: چه چیزی عوض شده؟",
  combo: "تبدیل‌ها را یکی‌یکی و به همان ترتیب انجام بده.",
  which: "اول ببین شکل برعکس شده یا نه.",
};

const RULE: Record<TransformQuestionType, string> = {
  mirror: "در آینه چپ و راست جابه‌جا می‌شود، بالا و پایین همان می‌ماند.",
  water: "در آب بالا و پایین جابه‌جا می‌شود، چپ و راست همان می‌ماند.",
  rotate: "در چرخش ۹۰ درجه ساعتگرد، بالای شکل به راست می‌رود؛ در پادساعتگرد به چپ؛ در نیم‌دور سر و ته می‌شود.",
  shift: "هر خانه شکل به یک اندازه و یک جهت می‌رود. از یک خانه شکل تا همان خانه در تصویر بشمار؛ خود خانه شروع را نشمار.",
  draw: "در قرینه، هر خانه عمود بر خط و به همان فاصله آن طرف می‌رود؛ در چرخش، فاصله هر خانه تا نقطه چرخش همان می‌ماند.",
  sequence: "در هر مرحله شکل به یک اندازه و یک جهت می‌چرخد؛ همان چرخش را یک بار دیگر انجام بده.",
  combo: "ترتیب مهم است: با ترتیب دیگر، شکل آخر فرق می‌کند.",
  which: "اگر شکل برعکس شده، قرینه است (آینه یا آب)؛ اگر نه، چرخیده است.",
};

const LEG: Record<MoveName, string> = {
  mirror: "در آینه ببری",
  water: "در آب ببری",
  cw90: "۹۰ درجه ساعتگرد بچرخانی",
  r180: "۱۸۰ درجه بچرخانی",
  ccw90: "۹۰ درجه پادساعتگرد بچرخانی",
};

const dirText = (v: number, pos: string, neg: string) => `${fa(Math.abs(v))} خانه به ${v > 0 ? pos : neg}`;

function firstStep(q: TransformQuestion): string {
  const letter = q.figure.mark ? ` به حرف «${q.figure.mark.symbol}» نگاه کن: کدام طرفش باز است؟` : "";
  switch (q.type) {
    case "mirror":
    case "water":
    case "rotate":
      return `گام اول: فقط به خانه گوشه بالای شکل فکر کن؛ وقتی شکل را ${LEG[q.moves[0]]}، آن خانه کجا می‌رود؟${letter}`;
    case "combo":
      return `گام اول: فقط تبدیل اول را انجام بده: شکل را ${LEG[q.moves[0]]} و تصویرش را در ذهنت نگه دار؛ ${fa(q.moves.length - 1)} تبدیل دیگر می‌ماند.`;
    case "sequence":
      // The gap is always the third or fourth frame, so the first two are there.
      return `گام اول: شکل اول را با شکل دوم مقایسه کن و ببین یک مرحله چقدر و به کدام طرف چرخیده؛ بعد همان را روی شکل ${q.frames.indexOf(null) === 2 ? "دوم" : "سوم"} انجام بده.`;
    case "which":
      return `گام اول: یک خانه گوشه شکل زرد را پیدا کن و ببین در شکل کناری کجا رفته: بالا و پایین جابه‌جا شده، یا چپ و راست، یا هیچ‌کدام؟${letter}`;
    case "draw":
      return q.op.kind === "reflect"
        ? "گام اول: نزدیک‌ترین خانه شکل به خط‌چین را پیدا کن؛ تصویرش درست آن طرف خط و به همان فاصله است. اول همان یک خانه را رنگ کن."
        : "گام اول: نزدیک‌ترین خانه شکل به نقطه قرمز را پیدا کن و فقط همان را دور نقطه بچرخان. اول همان یک خانه را رنگ کن.";
    case "shift": {
      if (q.form === "vector") return "گام اول: یک خانه شکل زرد و همان خانه در شکل راه‌راه را پیدا کن؛ اول فقط پرش‌های چپ و راست بین آن دو را بشمار.";
      const [dx, dy]: Pt = q.vec;
      const first = dx ? dirText(dx, "راست", "چپ") : dirText(dy, "بالا", "پایین");
      return `گام اول: فقط یک خانه شکل را انتخاب کن و آن را ${first} ببر؛ بعد بقیه حرکت را.`;
    }
  }
}

export const TRANSFORMS_ADAPTER: ToolAdapter = {
  ...TRANSFORMS_PRACTICE,
  version: "transforms@1",
  grade,
  hints: (type, level, seed) => [NUDGE[type as TransformQuestionType], RULE[type as TransformQuestionType], firstStep(make(type, level, seed))],
};
