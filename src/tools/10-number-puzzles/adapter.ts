// Tool 10 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is the child's whole board when «بررسی» is pressed: one
// entry per cell of the puzzle (givens included, null for an empty cell),
// in the order of the puzzle's cells. Practice questions use small numbers.

import { blankCells, cornersOf, makeNumberPuzzle, rowOf, puzzleMistake, solveSteps, type Level, type NumberPuzzle, type PuzzleType } from "@/generators/number-puzzles";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { NUMBER_PUZZLES_PRACTICE } from "./practice";

const make = (type: string, level: number, seed: number) => makeNumberPuzzle(type as PuzzleType, level as Level, seed);

function grade(type: string, level: number, seed: number, response: unknown): string {
  if (!Array.isArray(response)) return "other";
  const q = make(type, level, seed);
  if (response.length !== q.cells.length) return "other";
  // Givens come from the question, so only the child's own cells count.
  const vals = q.cells.map((c, i) => (c.given ? c.value : typeof response[i] === "number" && Number.isFinite(response[i]) ? (response[i] as number) : null));
  const { tag } = puzzleMistake(q, vals);
  // Puzzles with several answers: any valid fill is right, as the tool says.
  return tag === "anyValid" ? "right" : tag;
}

const NUDGE: Record<PuzzleType, string> = {
  magic: "هر عدد فقط یک بار می‌آید و جمع همه سطرها، ستون‌ها و قطرها یکی است.",
  pyramid: "هر آجر جمع دو آجر زیرش است.",
  grid: "جمع هر سطر و هر ستون در خانه «جمع» آن نوشته شده.",
  star: "گوشه‌های مثلث هر کدام در دو ضلع هستند.",
  ring: "هر دایره روی بیش از یک خط است؛ عددش باید با همه آن خط‌ها جور باشد.",
  shape: "قانون باید در شکل اول و شکل دوم هر دو درست باشد.",
  matrix: "قانون باید در سطر اول و سطر دوم هر دو درست باشد. هر سطر از راست خوانده می‌شود.",
};

const RULE: Record<PuzzleType, string> = {
  magic: "سه سطر با هم همه عددها را می‌گیرند؛ پس جمع هر خط، یک‌سوم جمع همه عددهاست.",
  pyramid: "آجر بالا = جمع دو آجر زیرش؛ پس آجر پایینی = آجر بالا منهای آجر کناری.",
  grid: "یک خانه خالی = جمع آن سطر یا ستون، منهای بقیه خانه‌هایش.",
  star: "جمع سه ضلع با هم = جمع همه عددها + جمع سه گوشه، چون هر گوشه دو بار شمرده می‌شود.",
  ring: "خطی را پیدا کن که فقط یک خانه خالی دارد: آن خانه = جمع خط منهای بقیه.",
  shape: "قانون‌های ساده را امتحان کن (جمع، تفریق یا ضرب گوشه‌ها) تا یکی در هر دو شکل درست شود؛ بعد همان را در شکل سوم به کار ببر.",
  matrix: "قانون‌های ساده را امتحان کن (جمع، تفریق، ضرب، یا گام ثابت مثل دنباله) تا یکی در هر دو سطر درست شود؛ بعد همان را در سطر سوم به کار ببر.",
};

const sumOf = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

function firstStep(q: NumberPuzzle): string {
  if (q.type === "shape") {
    const v = q.cells.map((c) => c.value);
    const [t, l, r] = cornersOf(v, 0).map((x) => fa(x));
    return `گام اول: در شکل اول، عدد وسط ${fa(v[3])} است و گوشه‌ها ${t}، ${l} و ${r}. جمعشان، تفاضلشان یا ضربشان کدام ${fa(v[3])} می‌شود؟`;
  }
  if (q.type === "matrix") {
    const [a, b, c] = rowOf(q.cells.map((x) => x.value), 0).map((x) => fa(x));
    return `گام اول: در سطر اول، از راست، دو عدد اول ${a} و ${b} هستند و عدد سوم ${c}. جمعشان، تفاضلشان یا ضربشان کدام ${c} می‌شود؟`;
  }
  const first = solveSteps(q)?.[0];
  switch (first?.kind) {
    case "sum":
      return q.type === "ring"
        ? `گام اول: همه عددها را جمع کن (${fa(sumOf(q.set!))})؛ هر دایره روی دو خط است، پس این جمع دو بار در همه خط‌ها هست.`
        : `گام اول: همه عددها را جمع کن (${fa(sumOf(q.set!))}) و بر تعداد سطرها تقسیم کن.`;
    case "cornerSum":
      return `گام اول: جمع سه گوشه را پیدا کن: سه برابر جمع هر ضلع (${fa(q.target!)})، منهای جمع همه عددها.`;
    case "line": {
      const line = q.lines[first.line];
      if (q.type === "pyramid") return "گام اول: آجری را پیدا کن که از خودش و دو آجر زیرش، فقط یکی خالی است.";
      return `گام اول: «${line.name}» فقط یک خانه خالی دارد؛ از آن شروع کن.`;
    }
    case "only":
      return "گام اول: هیچ خطی فقط یک خانه خالی ندارد؛ برای هر خانه خالی ببین کدام عددهای باقی‌مانده با همه خط‌هایش جور درمی‌آیند.";
    default:
      return "گام اول: خطی را پیدا کن که کمترین خانه خالی را دارد.";
  }
}

/** Used when a number of this question's first step happens to equal its one blank. */
const PLAIN_STEP: Record<PuzzleType, string> = {
  magic: "گام اول: اول جمع هر خط را پیدا کن.",
  pyramid: "گام اول: آجری را پیدا کن که از خودش و دو آجر زیرش، فقط یکی خالی است.",
  grid: "گام اول: سطر یا ستونی را پیدا کن که فقط یک خانه خالی دارد.",
  star: "گام اول: ضلعی را پیدا کن که فقط یک خانه خالی دارد.",
  ring: "گام اول: خطی را پیدا کن که فقط یک خانه خالی دارد.",
  shape: "گام اول: روی شکل اول، جمع سه گوشه را با عدد وسط مقایسه کن؛ اگر جور نیست، ضرب را امتحان کن.",
  matrix: "گام اول: روی سطر اول، جمع دو عدد اول را با عدد سوم مقایسه کن؛ اگر جور نیست، تفریق و ضرب را امتحان کن.",
};

const showsNumber = (s: string, v: number) => (s.match(/[۰-۹]+/g) ?? ([] as string[])).includes(fa(Math.abs(v)));

function hints(type: string, level: number, seed: number): [string, string, string] {
  const q = make(type, level, seed);
  const t = q.type;
  const step = firstStep(q);
  // A puzzle with one blank has a one-number answer: no hint may show it.
  const blanks = blankCells(q);
  const one = blanks.length === 1 ? q.cells[blanks[0]].value : null;
  return [NUDGE[t], RULE[t], one !== null && showsNumber(step, one) ? PLAIN_STEP[t] : step];
}

export const NUMBER_PUZZLES_ADAPTER: ToolAdapter = {
  ...NUMBER_PUZZLES_PRACTICE,
  version: "number-puzzles@1",
  grade,
  hints,
};
