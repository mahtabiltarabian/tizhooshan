// Tool 21 in practice sessions: grading and three-step hints. The response
// is the tapped cells (find), a number (count), one cell (differ), or the
// six answers of a mental arithmetic card, in card order (mental).

import { inRow, makeSpeedQuestion, speedMistake, type Level, type SpeedQuestionType } from "@/generators/speed";
import { makeMentalQuestion, mentalMistake, type Level as MentalLevel } from "@/generators/mental";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { itemText, ltr } from "./mentalText";
import { SPEED_PRACTICE } from "./practice";

const make = (type: string, level: number, seed: number) => makeSpeedQuestion(type as SpeedQuestionType, level as Level, seed);

const NUDGE: Record<SpeedQuestionType | "mental", string> = {
  mental: "هر حساب را به دو قسمت آسان بشکن؛ اول ضرب و تقسیم، بعد جمع و تفریق.",
  find: "ردیف به ردیف جلو برو، از راست به چپ؛ هیچ ردیفی را جا نینداز.",
  count: "ردیف به ردیف بشمار و عدد هر ردیف را کنار بگذار.",
  differ: "به جای نگاه به همه، دو شکل کنار هم را با هم مقایسه کن و جلو برو.",
};

const MENTAL_RULE: Record<MentalLevel, string> = {
  1: "در جمع و تفریق، اول تا ده بعدی (یا قبلی) برو و بعد باقی‌اش را حساب کن. ضرب و تقسیم را از جدول ضرب بیاور.",
  2: "ده‌تایی‌ها را با هم و یکی‌ها را با هم حساب کن. در عبارتی که هم جمع دارد هم ضرب، اول ضرب را حساب کن.",
  3: "از عددهای گرد کمک بگیر: عدد نزدیک صد را صد بگیر و بعد درستش کن؛ چهار تا بیست‌وپنج صد می‌شود.",
};

/** A way into the first sum of the card, without its answer or any other answer on the card. */
function mentalFirstStep(level: number, seed: number) {
  const q = makeMentalQuestion(level as MentalLevel, seed);
  const it = q.items[0];
  const [a, b] = it.nums;
  let text: string;
  if (it.op === "mix") text = `گام اول: در «${ltr(itemText(it))}» اول قسمت ضرب یا تقسیم را حساب کن، بعد جمع یا تفریق را.`;
  else if ((it.op === "add" || it.op === "sub") && b >= 10) text = `گام اول: در «${ltr(itemText(it))}» اول ${fa(b - (b % 10))} را ${it.op === "add" ? "اضافه" : "کم"} کن، بعد ${fa(b % 10)} را.`;
  else if (it.op === "mul" && a >= 10 && a % 10) text = `گام اول: در «${ltr(itemText(it))}» اول ${fa(a - (a % 10))} را در ${fa(b)} ضرب کن، بعد ${fa(a % 10)} را.`;
  else text = `گام اول: از «${ltr(itemText(it))}» شروع کن و آن را به دو قسمت آسان بشکن.`;
  // No hint may show an answer of the card.
  const tokens = text.match(/[۰-۹]+/g) ?? [];
  const answers = q.items.map((x) => fa(x.answer));
  return tokens.some((t) => answers.includes(t)) ? "گام اول: از اولین حساب شروع کن و آن را به دو قسمت آسان بشکن (مثلاً ده‌تایی‌ها و یکی‌ها)." : text;
}

function rule(type: string, level: number) {
  if (type === "mental") return MENTAL_RULE[level as MentalLevel];
  if (level === 1) return type === "differ" ? "یک شکل از بقیه فرق دارد؛ به شکل کلی‌اش نگاه کن." : "فقط شکل‌هایی که درست مثل هدف‌اند حساب می‌شوند.";
  const trap = level === 2 ? "شکل چرخیده" : "شکل چرخیده یا آینه‌ای (برعکس)";
  return type === "differ"
    ? `همه شکل‌ها یکی‌اند جز یکی که ${trap} است. به کوتاه‌ترین بازوی شکل نگاه کن: به کدام طرف است؟`
    : `${trap} همان شکل نیست. به کوتاه‌ترین بازوی شکل نگاه کن: باید همان طرفِ هدف باشد.`;
}

function firstStep(type: string, level: number, seed: number) {
  if (type === "mental") return mentalFirstStep(level, seed);
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
  grade: (type, level, seed, response) => (type === "mental" ? mentalMistake(makeMentalQuestion(level as MentalLevel, seed), response) : speedMistake(make(type, level, seed), response)),
  hints: (type, level, seed) => [NUDGE[type as SpeedQuestionType | "mental"], rule(type, level), firstStep(type, level, seed)],
};
