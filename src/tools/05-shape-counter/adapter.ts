// Tool 5 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is a number in every type: the count typed in (the counting
// types and a «رسم با یک خط» question that asks how many odd points), or
// the index of the picked option (شکل پنهان, and the other one-stroke
// questions: which figure, or which of the named points).

import { makeHiddenQuestion, normal, SHAPE_NAME } from "@/generators/hidden-figure";
import { countSlip, makeStrokeQuestion, pointNames } from "@/generators/one-stroke";
import { countMistake, figureOf, listShapes, makeCountQuestion, type CountQuestionType, type Kind, type Level, type ShapeQuestionType } from "@/generators/shape-count";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { SHAPE_COUNTER_PRACTICE } from "./practice";

const isIndex = (r: number, n: number) => Number.isInteger(r) && r >= 0 && r < n;

function grade(type: string, level: number, seed: number, response: unknown): string {
  if (typeof response !== "number" || !Number.isFinite(response)) return "other";
  const lv = level as Level;
  if (type === "hidden") {
    const q = makeHiddenQuestion(lv, seed);
    if (!isIndex(response, q.options.length)) return "other";
    return response === q.answer ? "right" : (q.mistakes[response] ?? "notHidden");
  }
  if (type === "stroke") {
    const q = makeStrokeQuestion(lv, seed);
    if (q.ask === "count") return response === q.answer ? "right" : (countSlip(q, response) ?? "oddMiscount");
    const n = q.ask === "which" ? q.options.length : q.choices.length;
    if (!isIndex(response, n)) return "other";
    return response === q.answer ? "right" : (q.mistakes[response] ?? "other");
  }
  return countMistake(makeCountQuestion(type as CountQuestionType, lv, seed), response);
}

const KIND_NAME: Record<Kind, string> = { triangle: "مثلث", square: "مربع", rectangle: "مستطیل", segment: "پاره‌خط", angle: "زاویه" };
const PIECE_WORD: Record<Kind, string> = { triangle: "قطعه", square: "خانه", rectangle: "خانه", segment: "تکه", angle: "زاویه کوچک" };

const NUDGE: Record<ShapeQuestionType, string> = {
  triangle: "با نظم بشمار: اول کوچک‌ها، بعد بزرگ‌ترها؛ هر مثلث را فقط یک بار.",
  square: "مربع‌های بزرگ‌تر هم هستند؛ فقط خانه‌های کوچک را نشمار.",
  rectangle: "مستطیل‌های بزرگ‌تر هم هستند؛ و هر مربع هم یک مستطیل است.",
  segment: "هر دو نقطه‌ای که روی یک خط‌اند، یک پاره‌خط می‌سازند؛ فقط تکه‌های کوتاه نیستند.",
  angle: "هر دو پرتو یک زاویه می‌سازند؛ فقط زاویه‌های کوچک نیستند.",
  growing: "مرحله‌ها را با هم مقایسه کن: هر بار چند تا اضافه می‌شود؟",
  hidden: "شکل پنهان باید همان اندازه و همان جهت را داشته باشد.",
  stroke: "در هر رأس بشمار چند سر خط به آن می‌رسد.",
};

const RULE: Record<ShapeQuestionType, string> = {
  triangle: "شکل‌ها را بر اساس تعداد قطعه‌ها دسته کن: یک‌قطعه‌ای، دوقطعه‌ای، … و تعداد هر دسته را جمع بزن.",
  square: "اول مربع‌های ۱×۱، بعد ۲×۲، بعد ۳×۳ و همین‌طور تا بزرگ‌ترین؛ تعدادها را جمع بزن.",
  rectangle: "هر مستطیل با یک جفت خط افقی و یک جفت خط عمودی ساخته می‌شود؛ مستطیل‌ها را بر اساس تعداد خانه‌ها دسته کن.",
  segment: "اول تکه‌های کوتاه، بعد آن‌هایی که از ۲ تکه ساخته شده‌اند و همین‌طور تا بلندترین.",
  angle: "اول زاویه‌های کوچک، بعد آن‌هایی که از ۲ زاویه کوچک ساخته شده‌اند و همین‌طور؛ زاویه ۱۸۰ درجه حساب نمی‌شود.",
  growing: "اگر اضافه‌شده‌ها هر بار بیشتر می‌شوند، الگو را با همان قانون تا مرحله خواسته‌شده جلو ببر؛ ضرب کردن کافی نیست.",
  hidden: "چرخیده، وارونه یا بزرگ‌تر قبول نیست؛ همه ضلع‌های شکل باید روی خط‌های شکل بزرگ باشند.",
  stroke: "رأسی که تعداد فردی سر خط دارد فرد است. شکل فقط با ۰ یا ۲ رأس فرد یک‌خطی کشیده می‌شود؛ با ۲ رأس فرد، از یکی شروع و به دیگری ختم می‌شود.",
};

/** A question that asks how many odd points gets the rule without "0 or 2", which could be its answer. */
const ODD_RULE = "رأسی که تعداد سرهای خطش فرد است، رأس فرد است. خطی که از وسط یک نقطه رد می‌شود، برای آن نقطه دو سر حساب می‌شود.";
const ruleFor = (type: string, level: Level, seed: number) => (type === "stroke" && makeStrokeQuestion(level, seed).ask === "count" ? ODD_RULE : RULE[type as ShapeQuestionType]);

function firstStep(type: string, level: Level, seed: number): string {
  if (type === "hidden") {
    const q = makeHiddenQuestion(level, seed);
    return `گام اول: ${SHAPE_NAME[q.shapeName]} ${fa(normal(q.shape).length)} ضلع دارد. ضلع پایینش را به خاطر بسپار و در هر شکل بزرگ، جایی پیدا کن که همان ضلع با همان اندازه روی خط باشد.`;
  }
  if (type === "stroke") {
    const q = makeStrokeQuestion(level, seed);
    if (q.ask === "which") return "گام اول: در هر شکل، رأس‌ها را یکی‌یکی ببین و رأس‌هایی را که تعداد فردی سر خط دارند علامت بزن.";
    if (q.ask === "count") return "گام اول: از یک گوشه شروع کن و کنار هر رأس عدد سرهای خطش را بگذار؛ جایی که خطی از وسط نقطه رد می‌شود، دو سر حساب می‌شود.";
    const names = pointNames(q);
    const listed = q.choices.map((v) => `«${names.get(v)}»`).join("، ");
    return q.ask === "start"
      ? `گام اول: برای هر یک از نقطه‌های ${listed} بشمار چند سر خط به آن می‌رسد.`
      : `گام اول: کار از «الف» شروع می‌شود. برای هر یک از نقطه‌های ${listed} بشمار چند سر خط به آن می‌رسد.`;
  }
  const q = makeCountQuestion(type as CountQuestionType, level, seed);
  const name = KIND_NAME[q.kind];
  if (q.type === "growing") {
    const [c1, c2, c3] = q.counts;
    return `گام اول: از مرحله ۱ به ۲، ${fa(c2 - c1)} ${name} اضافه شده و از ۲ به ۳، ${fa(c3 - c2)} ${name}. از ۳ به ۴ چند تا اضافه می‌شود؟`;
  }
  const singles = listShapes(figureOf(q.spec), q.kind).filter((s) => s.pieces === 1).length;
  // Saying how many small ones there are would be the answer when every shape is a small one.
  if (singles === q.answer) return `گام اول: اول ${name}‌هایی را بشمار که فقط از یک ${PIECE_WORD[q.kind]} ساخته شده‌اند؛ بعد ببین ${name} بزرگ‌تری هم هست یا نه.`;
  return `گام اول: ${name}‌هایی که فقط از یک ${PIECE_WORD[q.kind]} ساخته شده‌اند ${fa(singles)} تا هستند. حالا آن‌هایی را بشمار که از ۲ ${PIECE_WORD[q.kind]} ساخته شده‌اند.`;
}

export const SHAPE_COUNTER_ADAPTER: ToolAdapter = {
  ...SHAPE_COUNTER_PRACTICE,
  version: "shape-counter@1",
  grade,
  hints: (type, level, seed) => [NUDGE[type as ShapeQuestionType], ruleFor(type, level as Level, seed), firstStep(type, level as Level, seed)],
};
