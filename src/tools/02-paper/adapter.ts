// Tool 2 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is what the panel checks: the index of the picked option
// (holesChoice, cutChoice, pieces, foldedShape), the tapped hole cells as
// "i,j" keys (holes), or the pictures' positions in the order tapped (order).

import { centroid, holeCells, makePaperQuestion, perpendicular, shapes, unfoldPoints, type Level, type PaperQuestion, type PaperQuestionType } from "@/generators/paper-folding";
import type { ToolAdapter } from "@/practice/adapter";
import { ltr } from "@/practice/text";
import { fa } from "@/tools/registry";
import { orderNames } from "./orderText";
import { PAPER_PRACTICE } from "./practice";

const make = (type: string, level: number, seed: number) => makePaperQuestion(type as PaperQuestionType, level as Level, seed);

const isIndex = (r: unknown, n: number): r is number => typeof r === "number" && Number.isInteger(r) && r >= 0 && r < n;

/** Tapped holes, the same tests in the same order as the panel's feedback. */
export function holesTag(q: Extract<PaperQuestion, { type: "holes" }>, mine: readonly string[]): string {
  const key = [...new Set(mine)].sort().join(";");
  const k = q.folds.length;
  if (key === q.answer.join(";")) return "right";
  for (let j = 1; j <= k; j++) if (key === holeCells(unfoldPoints(q.punches, q.folds.slice(j))).join(";")) return "missingFold";
  for (let i = 0; i < k; i++) {
    const wrong = q.folds.map((f, j) => (j === i ? { ...f, line: perpendicular(f.line, q.S) } : f));
    if (key === holeCells(unfoldPoints(q.punches, wrong)).join(";")) return "wrongAxis";
  }
  return mine.length !== q.answer.length ? "holeCount" : "holePlace";
}

/** `seq[n]`: the position of the picture tapped n-th, as the panel's order feedback reads it. */
export function orderTag(q: Extract<PaperQuestion, { type: "order" }>, seq: readonly number[]): string {
  const n = q.shown.length;
  if (seq.length !== n || new Set(seq).size !== n || !seq.every((v) => isIndex(v, n))) return "other";
  const steps = seq.map((pos) => q.shown[pos]);
  if (steps.every((st, i) => st === i)) return "right";
  // One fold: steps are 0 fold, 1 punch the folded paper, 2 open.
  if (q.folds.length === 1) return steps.indexOf(2) < steps.indexOf(1) ? "orderOpen" : "orderPunch";
  return steps[0] !== 0 ? "orderStart" : "orderMixed";
}

function grade(type: string, level: number, seed: number, response: unknown): string {
  const q = make(type, level, seed);
  if (q.type === "holes") return Array.isArray(response) && response.every((c) => typeof c === "string") ? holesTag(q, response) : "other";
  if (q.type === "order") return Array.isArray(response) ? orderTag(q, response) : "other";
  if (!isIndex(response, q.options.length)) return "other";
  if (response === q.answer) return "right";
  // The panel names "the number of layers" apart from the other near misses.
  if (q.type === "pieces" && q.options[response] === 2 ** q.folds.length) return "layers";
  return q.mistakes[response] ?? "other";
}

const NUDGE: Record<PaperQuestionType, string> = {
  holes: "کاغذ را در ذهنت تا به تا باز کن؛ از تای آخر شروع کن.",
  holesChoice: "کاغذ را در ذهنت تا به تا باز کن؛ از تای آخر شروع کن.",
  cutChoice: "برش از همه لایه‌های کاغذ تاشده رد می‌شود.",
  pieces: "برش از همه لایه‌ها رد می‌شود؛ ولی بعضی تکه‌ها در خط تا به هم وصل می‌مانند.",
  foldedShape: "تا به تا جلو برو؛ بعد از هر تا، کاغذ نصف می‌شود.",
  order: "هر مرحله روی کاغذی انجام می‌شود که مرحله قبل درست کرده.",
};

const RULE: Record<PaperQuestionType, string> = {
  holes: "هر خط تا مثل آینه است: هر سوراخ و قرینه‌اش تا خط تا یک فاصله دارند. هر لایه کاغذ یک سوراخ می‌خورد.",
  holesChoice: "هر خط تا مثل آینه است: هر سوراخ و قرینه‌اش تا خط تا یک فاصله دارند. هر لایه کاغذ یک سوراخ می‌خورد.",
  cutChoice: "وقتی کاغذ را باز کنی، برش دور هر خط تا قرینه می‌شود.",
  pieces: "هر تا تعداد لایه‌ها را دو برابر می‌کند؛ بعد از باز کردن، هر لایه یک خط برش دارد.",
  foldedShape: "در هر تا، نیمه‌ای که فلش دارد بلند می‌شود و روی نیمه دیگر می‌آید.",
  order: "شکل هر مرحله نصف شکل مرحله قبل است؛ کاغذ کامل (مربع) اول است.",
};

function firstStep(q: PaperQuestion): string {
  switch (q.type) {
    case "holes":
    case "holesChoice":
      return `گام اول: کاغذ ${fa(q.folds.length)} بار تا شده، پس ${fa(2 ** q.folds.length)} لایه دارد. فقط تای آخر را باز کن و برای هر سوراخ، قرینه‌اش را نسبت به خط همان تا پیدا کن.`;
    case "cutChoice":
      return "گام اول: گوشه بریده را در کاغذ تاشده پیدا کن و فقط تای آخر را باز کن: برش کجا قرینه می‌شود؟";
    case "pieces":
      return "گام اول: ببین خط برش قرمز به لبه تاخورده کاغذ می‌رسد یا نه؛ تکه‌هایی که در لبه تاخورده به هم وصل‌اند، یک تکه می‌مانند.";
    case "foldedShape":
      return "گام اول: فقط تای اول را انجام بده: نیمه‌ای که فلش دارد روی نیمه دیگر می‌آید؛ کدام نیمه از کاغذ می‌ماند؟";
    case "order":
      return q.folds.length === 1
        ? "گام اول: شکلی را پیدا کن که کاغذ در آن تا شده ولی هنوز سوراخ ندارد."
        : "گام اول: شکلی را پیدا کن که تایش روی کاغذ کامل (مربع) زده شده است.";
  }
}


/** A hole cell "i,j" (i from the left, j from the bottom) in words: row from the top, column from the right. */
const cellWords = (key: string, S: number) => {
  const [i, j] = key.split(",").map(Number);
  return `سطر ${fa(S - j)} ستون ${fa(S - i)}`;
};

/** Hole cells top row first, each row from the right. */
const byRow = (keys: readonly string[]) =>
  [...keys].sort((a, b) => {
    const [ai, aj] = a.split(",").map(Number);
    const [bi, bj] = b.split(",").map(Number);
    return bj - aj || bi - ai;
  });

/** The folded paper in the end, in words: «یک مستطیل در طرف راست کاغذ». */
function foldedWords(q: PaperQuestion): string {
  const end = shapes(q.S, q.folds).at(-1)!;
  const side = (k: number) => Math.hypot(end[k][0] - end[(k + 1) % end.length][0], end[k][1] - end[(k + 1) % end.length][1]);
  const name = end.length === 3 ? "مثلث" : end.length === 4 ? (Math.abs(side(0) - side(1)) < 1e-6 ? "مربع" : "مستطیل") : "شکل";
  const [cx, cy] = centroid(end);
  const h = q.S / 2;
  const where = [cy > h + 1e-6 ? "بالا" : cy < h - 1e-6 ? "پایین" : "", cx > h + 1e-6 ? "راست" : cx < h - 1e-6 ? "چپ" : ""].filter(Boolean);
  return `یک ${name} ${where.length ? `در طرف ${where.join(" و ")} کاغذ` : "وسط کاغذ"}`;
}

/** The answer and why, for the report card after an exam. */
function solution(type: string, level: number, seed: number): string {
  const q = make(type, level, seed);
  const k = q.folds.length;
  const L = 2 ** k;
  const option = (i: number) => `جواب: گزینه ${fa(i + 1)}`;
  switch (q.type) {
    case "holes": {
      const total = q.answer.length;
      const count = `${ltr(`${fa(q.punches.length)} × ${fa(L)} = ${fa(total)}`)} (سوراخ × لایه)`;
      if (total <= 4) return `جواب: ${fa(total)} سوراخ، در ${byRow(q.answer).map((c) => cellWords(c, q.S)).join("، ")} (سطر از بالا، ستون از راست). ${count}؛ هر خط تا مثل آینه است.`;
      return `جواب: ${fa(total)} سوراخ؛ خط‌های تا کاغذ باز را ${fa(L)} بخش می‌کنند و در هر بخش ${fa(q.punches.length)} سوراخ است. ${count}؛ هر سوراخ و قرینه‌اش تا خط تا یک فاصله دارند.`;
    }
    case "holesChoice":
      return `${option(q.answer)}. ${fa(q.punches.length)} سوراخ در ${fa(L)} لایه کاغذ، یعنی ${fa(q.options[q.answer].length)} سوراخ؛ هر خط تا مثل آینه است.`;
    case "cutChoice":
      return `${option(q.answer)}. برش از همه ${fa(L)} لایه رد می‌شود؛ باز که کنی، دور هر خط تا قرینه می‌شود.`;
    case "pieces": {
      const n = q.options[q.answer];
      const joined = n < L + 1 ? " بعضی تکه‌ها در خط تا به هم وصل می‌مانند." : "";
      return `جواب: ${fa(n)} تکه. کاغذ تاشده ${fa(L)} لایه دارد، پس باز که کنیم ${fa(L)} خط برش داریم و کاغذ ${fa(n)} تکه می‌شود.${joined}`;
    }
    case "foldedShape":
      return `${option(q.answer)}: ${foldedWords(q)}. در هر تا، نیمه‌ای که فلش دارد روی نیمه دیگر می‌آید و کاغذ نصف می‌شود.`;
    case "order":
      return k === 1
        ? `جواب: به ترتیب شکل ${orderNames(q)}. اول تا می‌کنیم، بعد کاغذ تاشده را سوراخ می‌کنیم، بعد باز می‌کنیم و سوراخ دو تا می‌شود.`
        : `جواب: به ترتیب شکل ${orderNames(q)}. تای اول روی کاغذ کامل (مربع) است و هر تا روی شکلِ تای قبلی؛ شکل هر مرحله نصف شکل قبلی است.`;
  }
}

export const PAPER_ADAPTER: ToolAdapter = {
  ...PAPER_PRACTICE,
  version: "paper@1",
  grade,
  hints: (type, level, seed) => [NUDGE[type as PaperQuestionType], RULE[type as PaperQuestionType], firstStep(make(type, level, seed))],
  solution,
};
