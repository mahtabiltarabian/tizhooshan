// Tool 21 in practice sessions: grading and three-step hints. The response
// is the tapped cells (find), a number (count) or one cell (differ).

import { inRow, makeSpeedQuestion, speedMistake, type Level, type SpeedQuestionType } from "@/generators/speed";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { SPEED_PRACTICE } from "./practice";

const make = (type: string, level: number, seed: number) => makeSpeedQuestion(type as SpeedQuestionType, level as Level, seed);

const NUDGE: Record<SpeedQuestionType, string> = {
  find: "ردیف به ردیف جلو برو، از راست به چپ؛ هیچ ردیفی را جا نینداز.",
  count: "ردیف به ردیف بشمار و عدد هر ردیف را کنار بگذار.",
  differ: "به جای نگاه به همه، دو شکل کنار هم را با هم مقایسه کن و جلو برو.",
};

function rule(type: string, level: number) {
  if (level === 1) return type === "differ" ? "یک شکل از بقیه فرق دارد؛ به شکل کلی‌اش نگاه کن." : "فقط شکل‌هایی که درست مثل هدف‌اند حساب می‌شوند.";
  const trap = level === 2 ? "شکل چرخیده" : "شکل چرخیده یا آینه‌ای (برعکس)";
  return type === "differ"
    ? `همه شکل‌ها یکی‌اند جز یکی که ${trap} است. به کوتاه‌ترین بازوی شکل نگاه کن: به کدام طرف است؟`
    : `${trap} همان شکل نیست. به کوتاه‌ترین بازوی شکل نگاه کن: باید همان طرفِ هدف باشد.`;
}

function firstStep(type: string, level: number, seed: number) {
  const q = make(type, level, seed);
  if (q.type === "differ") {
    const row = Math.floor((q.answer as number) / q.cols);
    return `گام اول: شکل متفاوت در نیمه ${row < q.rows / 2 ? "بالایی" : "پایینی"} است.`;
  }
  const n = inRow(q, 0);
  return n === 0 ? "گام اول: در ردیف اول هیچ شکلی درست مثل هدف نیست؛ برو سراغ ردیف دوم." : `گام اول: در ردیف اول ${fa(n)} شکل درست مثل هدف هست؛ پیدایشان کن و برو ردیف بعد.`;
}

export const SPEED_ADAPTER: ToolAdapter = {
  ...SPEED_PRACTICE,
  version: "speed@1",
  grade: (type, level, seed, response) => speedMistake(make(type, level, seed), response),
  hints: (type, level, seed) => [NUDGE[type as SpeedQuestionType], rule(type, level), firstStep(type, level, seed)],
};
