// Tool 21 in practice sessions: grading and three-step hints. The response
// is the tapped cells (find), a number (count), one cell (differ), or the
// six answers of a mental arithmetic card, in card order (mental).

import { inRow, makeSpeedQuestion, relation, speedMistake, type Glyph, type Level, type SpeedQuestion, type SpeedQuestionType } from "@/generators/speed";
import { makeMentalQuestion, mentalMistake, type Level as MentalLevel } from "@/generators/mental";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { itemText, ltr, worked } from "./mentalText";
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

// --- Solution (report card after an exam) ---

const MAX = 300;
const fit = (...texts: string[]) => texts.find((t) => t.length <= MAX) ?? texts[texts.length - 1];

/** Shapes 0 … 7 (speed.ts); the grid cells run right to left, top to bottom (Pictures.tsx). */
const SHAPE_NAME = ["دایره", "مربع", "مثلث", "ستاره", "به‌علاوه (+)", "لوزی", "حلقه", "پرچم"];

/** How the odd shape differs from the others. */
function oddWords(odd: Glyph, target: Glyph): string {
  const r = relation(odd, target);
  if (r === "other") return `همه شکل‌ها ${SHAPE_NAME[target.shape]} هستند و این یکی ${SHAPE_NAME[odd.shape]} است`;
  if (r === "mirror") return "همه پرچم‌ها یکی‌اند و این یکی آینه‌ای (برعکس) است: بازوی کوتاهش طرف دیگر است";
  const turn = (((odd.rot - target.rot) % 4) + 4) % 4;
  const how = turn === 2 ? "نیم دور چرخیده (سر و ته)" : `یک ربع دور ${turn === 1 ? "در جهت" : "خلاف جهت"} عقربه‌های ساعت چرخیده`;
  return `همه پرچم‌ها یکی‌اند و این یکی ${how} است`;
}

function lookAlikes(q: SpeedQuestion): string {
  if (q.level === 1) return "فقط شکل‌هایی که درست مثل هدف‌اند حساب می‌شوند.";
  const kinds = q.grid.map((g) => relation(g, q.target));
  const mirrors = kinds.filter((k) => k === "mirror").length;
  const turned = kinds.filter((k) => k === "rotated").length;
  const parts = [turned ? `${fa(turned)} پرچم چرخیده` : "", mirrors ? `${fa(mirrors)} پرچم آینه‌ای (برعکس)` : ""].filter(Boolean);
  return parts.length ? `${parts.join(" و ")} هم هست که حساب نمی‌شوند؛ فقط جهتِ درست قبول است.` : "شکل‌های چرخیده یا آینه‌ای حساب نمی‌شوند.";
}

function solution(type: string, level: number, seed: number): string {
  if (type === "mental") {
    const q = makeMentalQuestion(level as MentalLevel, seed);
    const head = `جواب: ${q.items.map((it) => fa(it.answer)).join("، ")} (به ترتیب کارت).`;
    // One worked shortcut that fits: the longest, which is usually the hardest sum.
    const ways = q.items
      .map((it) => `${head} مثلاً «${ltr(itemText(it))}»: ${worked(it)}`)
      .sort((a, b) => b.length - a.length);
    return fit(...ways, head);
  }
  const q = make(type, level, seed);
  if (q.type === "differ") {
    const at = q.answer as number;
    const where = `ردیف ${fa(Math.floor(at / q.cols) + 1)}، خانه ${fa((at % q.cols) + 1)} از راست`;
    return `جواب: ${where}. ${oddWords(q.grid[at], q.target)}.`;
  }
  const total = q.type === "find" ? (q.answer as number[]).length : (q.answer as number);
  const head = `جواب: ${fa(total)} شکل درست مثل هدف.`;
  const rows = `ردیف به ردیف از بالا: ${Array.from({ length: q.rows }, (_, r) => fa(inRow(q, r))).join("، ")}.`;
  return fit(`${head} ${lookAlikes(q)} ${rows}`, `${head} ${lookAlikes(q)}`, head);
}

export const SPEED_ADAPTER: ToolAdapter = {
  ...SPEED_PRACTICE,
  version: "speed@1",
  grade: (type, level, seed, response) => (type === "mental" ? mentalMistake(makeMentalQuestion(level as MentalLevel, seed), response) : speedMistake(make(type, level, seed), response)),
  hints: (type, level, seed) => [NUDGE[type as SpeedQuestionType | "mental"], rule(type, level), firstStep(type, level, seed)],
  solution,
};
