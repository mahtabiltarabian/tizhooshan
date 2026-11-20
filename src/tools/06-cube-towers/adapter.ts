// Tool 6 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks: for the one-tap questions (count,
// views, complete, paint, solid) the index of the picked option in the
// generated question's options; for "build" the child's column heights,
// one row per board row as the tower stores them (h[y][x]).

import { makeTowerQuestion, matchesViews, maxHeight, type Level, type TowerQuestion, type TowerQuestionType } from "@/generators/cube-towers";
import { solidMistake, solidName, type SolidQuestion } from "@/generators/solids";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { CUBE_TOWERS_PRACTICE } from "./practice";
import { PART_NAME, PART_PLURAL } from "./solidText";

const make = (type: string, level: number, seed: number) => makeTowerQuestion(type as TowerQuestionType, level as Level, seed);

/** Column heights from JSON, shaped like the question's board, or null. */
function asHeights(r: unknown, w: number, d: number): number[][] | null {
  if (!Array.isArray(r) || r.length !== d) return null;
  const ok = r.every((row) => Array.isArray(row) && row.length === w && row.every((h) => Number.isInteger(h) && h >= 0));
  return ok ? (r as number[][]) : null;
}

function grade(type: string, level: number, seed: number, response: unknown): string {
  const q = make(type, level, seed);
  if (q.type === "build") {
    const h = asHeights(response, q.tower.w, q.tower.d);
    if (!h) return "other";
    return matchesViews({ w: q.tower.w, d: q.tower.d, h }, q.views) ? "right" : "notMatching";
  }
  if (typeof response !== "number" || !Number.isInteger(response) || response < 0 || response >= q.options.length) return "other";
  if (q.type === "solid") return solidMistake(q, q.options[response]);
  return response === q.answer ? "right" : (q.mistakes[response] ?? "other");
}

const NUDGE: Record<TowerQuestionType, string> = {
  count: "لایه به لایه بشمار، از پایین به بالا.",
  top: "تصور کن از بالای برج، رو به پایین نگاه می‌کنی.",
  front: "تصور کن روبروی برج ایستاده‌ای و فقط از جلو نگاه می‌کنی.",
  side: "تصور کن کنار برج، در سمت راستش، ایستاده‌ای.",
  build: "نماها را یکی‌یکی امتحان کن؛ برج باید با همه آن‌ها جور باشد.",
  complete: "اول ببین مکعب بزرگِ کامل چند مکعب کوچک دارد.",
  paint: "به جای هر مکعب کوچک در مکعب بزرگ فکر کن: گوشه، لبه، وسط یک وجه، یا درون.",
  solid: "دسته‌دسته بشمار: آنچه بالاست، آنچه پایین است و آنچه در کناره‌هاست.",
};

const RULE: Record<TowerQuestionType, string> = {
  count: "مکعب‌ها روی هوا نمی‌ایستند: زیر هر مکعب بالایی، مکعب‌های دیگری هست، حتی اگر دیده نشوند.",
  top: "در نمای بالا، هر جای صفحه که دست‌کم یک مکعب دارد پر دیده می‌شود؛ بلندی برج‌ها دیده نمی‌شود. ردیف جلو پایین تصویر است.",
  front: "در نمای روبرو، هر ستون از چپ به راست به بلندی بلندترین برجِ همان ستون است.",
  side: "در نمای کنار، هر ستون به بلندی بلندترین برجِ یک ردیف است؛ ردیف جلو سمت چپ تصویر می‌افتد.",
  build: "هر ستون نمای روبرو بلندترین برجِ یک ستون است و هر ستون نمای کنار بلندترین برجِ یک ردیف؛ نمای بالا می‌گوید کجا مکعب هست.",
  complete: "تعداد لازم = تعداد مکعب‌های مکعب کامل، منهای مکعب‌هایی که الان هست.",
  paint: "مکعب‌های گوشه سه وجه رنگی دارند، مکعب‌های روی لبه (نه گوشه) دو وجه، وسط هر وجه یک وجه، و مکعب‌های درون هیچ.",
  solid: "منشور دو قاعده دارد و هرم یک قاعده و یک سر. در همه این جسم‌ها: رأس منهای یال به‌علاوه وجه، برابر دو است.",
};

const PAINT_STEP = [
  "گام اول: لایه بیرونی را از هر طرف کنار بگذار؛ مکعب‌های درون یک مکعب کوچک‌تر می‌سازند. ضلعش چند مکعب است؟",
  "گام اول: روی یک وجه، لبه‌ها را کنار بگذار؛ چند مکعب در وسط آن وجه می‌ماند؟ بعد یادت باشد مکعب چند وجه دارد.",
  "گام اول: روی یک لبه، دو گوشه را کنار بگذار؛ چند مکعب می‌ماند؟ بعد یادت باشد مکعب چند لبه دارد.",
  "گام اول: مکعب‌هایی که سه وجه رنگی دارند در گوشه‌ها هستند؛ مکعب بزرگ چند گوشه دارد؟",
];

function solidStep(q: SolidQuestion): string {
  const what = PART_PLURAL[q.part];
  switch (q.kind) {
    case "count":
      return `گام اول: قاعده این ${solidName(q.solid)} ${fa(q.solid.n)} ضلع دارد؛ ${what} را دسته‌دسته بشمار.`;
    case "combine":
      return `گام اول: اول فقط ببین ${solidName(q.solids[0])} چند ${PART_NAME[q.part]} دارد.`;
    case "reverse":
      return `گام اول: از ${fa(q.givenValue)} ${PART_NAME[q.given]} شروع کن و تعداد ضلع‌های قاعده را پیدا کن.`;
    case "euler":
      return "گام اول: دو عدد داده‌شده را در رابطه «رأس منهای یال به‌علاوه وجه برابر دو» جای خودشان بگذار.";
  }
}

function firstStep(q: TowerQuestion): string {
  switch (q.type) {
    case "count":
      return `گام اول: این برج ${fa(maxHeight(q.tower))} لایه دارد؛ اول مکعب‌های لایه پایین را بشمار.`;
    case "top":
      return "گام اول: از بالا، ردیف جلو را نگاه کن: کدام خانه‌هایش دست‌کم یک مکعب دارند؟";
    case "front":
      return "گام اول: بلندترین برجِ ستون سمت چپ را پیدا کن؛ ستون اول نمای روبرو همین‌قدر بلند است.";
    case "side":
      return "گام اول: بلندترین برجِ ردیف جلو را پیدا کن؛ ستون اول نمای کنار همین‌قدر بلند است.";
    case "build":
      return q.views.top
        ? "گام اول: روی نمای بالا، در هر خانه پر دست‌کم یک مکعب بگذار و خانه‌های خالی را خالی بگذار."
        : "گام اول: بلندترین ستون نمای روبرو را پیدا کن؛ در آن ستون برجی به همان بلندی لازم است.";
    case "complete":
      return `گام اول: مکعب کامل ${fa(q.n ** 3)} مکعب کوچک دارد؛ حالا مکعب‌هایی را که الان هست بشمار.`;
    case "paint":
      return PAINT_STEP[q.k];
    case "solid":
      return solidStep(q);
  }
}

/** Used when a number of this question's first step happens to equal the answer. */
const PLAIN_STEP: Record<TowerQuestionType, string> = {
  count: "گام اول: اول فقط مکعب‌های لایه پایین را بشمار.",
  top: "گام اول: از بالا، ردیف جلو را نگاه کن: کدام خانه‌هایش دست‌کم یک مکعب دارند؟",
  front: "گام اول: بلندترین برجِ ستون سمت چپ را پیدا کن.",
  side: "گام اول: بلندترین برجِ ردیف جلو را پیدا کن.",
  build: "گام اول: با نمای روبرو شروع کن و ستون‌ها را یکی‌یکی بساز.",
  complete: "گام اول: حساب کن مکعب کامل چند مکعب کوچک دارد.",
  paint: "گام اول: ببین این مکعب‌های کوچک کجای مکعب بزرگ‌اند.",
  solid: "گام اول: تعداد ضلع‌های قاعده را پیدا کن.",
};

/** The answer when it is one number a hint must not show, else null (views and built towers). */
function numberAnswer(q: TowerQuestion): number | null {
  if (q.type === "count" || q.type === "complete" || q.type === "paint" || q.type === "solid") return q.options[q.answer];
  return null;
}

const showsNumber = (s: string, v: number) => (s.match(/[۰-۹]+/g) ?? ([] as string[])).includes(fa(Math.abs(v)));

function hints(type: string, level: number, seed: number): [string, string, string] {
  const q = make(type, level, seed);
  const step = firstStep(q);
  const answer = numberAnswer(q);
  return [NUDGE[q.type], RULE[q.type], answer !== null && showsNumber(step, answer) ? PLAIN_STEP[q.type] : step];
}

export const CUBE_TOWERS_ADAPTER: ToolAdapter = {
  ...CUBE_TOWERS_PRACTICE,
  version: "cube-towers@1",
  grade,
  hints,
};
