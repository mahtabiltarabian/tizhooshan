// Tool 10 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is the child's whole board when «بررسی» is pressed: one
// entry per cell of the puzzle (givens included, null for an empty cell),
// in the order of the puzzle's cells. Practice questions use small numbers.

import { blankCells, cornersOf, makeNumberPuzzle, rowOf, puzzleMistake, solveSteps, type Level, type NumberPuzzle, type PuzzleType } from "@/generators/number-puzzles";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { NUMBER_PUZZLES_PRACTICE } from "./practice";
import { stepText } from "./PuzzleTryPanel";

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

// ── Solution for the report card ─────────────────────────────────────────
// The puzzle is not on the paper, so every blank is named by its place on
// the figure (as the tool's own line names do: "سطر بالا", "ضلع چپ"); the
// square and the pyramid are written out whole, row by row from the right.

const SQUARE_ROW = ["بالا", "وسط", "پایین"];
const TRIANGLE_CELL = ["گوشه بالا", "گوشه پایین چپ", "گوشه پایین راست", "وسط ضلع چپ", "وسط ضلع پایین", "وسط ضلع راست"];
/** Wheel: the centre, then the six circles from the top, clockwise. */
const WHEEL_CELL = ["وسط", "بالا", "بالا راست", "پایین راست", "پایین", "پایین چپ", "بالا چپ"];
/** Six-pointed star: the tips from the top, clockwise, then the inner circles from the upper right, clockwise. */
const STAR_TIP = ["بالا", "بالا راست", "پایین راست", "پایین", "پایین چپ", "بالا چپ"];
const STAR_INNER = ["بالا راست", "راست", "پایین راست", "پایین چپ", "چپ", "بالا چپ"];
const SHAPE_CELL = ["گوشه بالا", "گوشه پایین چپ", "گوشه پایین راست", "عدد وسط"];
const PLACE = ["اول", "دوم", "سوم"];

function cellName(q: NumberPuzzle, i: number): string {
  switch (q.type) {
    case "grid": {
      const r = Math.floor(i / 4);
      const c = i % 4;
      if (r === 3) return c === 3 ? "جمع کل" : `جمع ستون ${fa(c + 1)}`;
      return c === 3 ? `جمع سطر ${fa(r + 1)}` : `سطر ${fa(r + 1)} ستون ${fa(c + 1)}`;
    }
    case "star":
      return TRIANGLE_CELL[i];
    case "ring":
      if (q.cells.length === 7) return `دایره ${WHEEL_CELL[i]}`;
      return i < 6 ? `نوک ${STAR_TIP[i]}` : `دایره داخلی ${STAR_INNER[i - 6]}`;
    case "shape":
      return `${SHAPE_CELL[i % 4]} شکل ${fa(Math.floor(i / 4) + 1)}`;
    case "matrix":
      return `عدد ${PLACE[i % 3]} سطر ${fa(Math.floor(i / 3) + 1)} (از راست)`;
    default:
      return "";
  }
}

/** The whole answer: the figure row by row, or each blank by its place, in the order the solver fills them. */
function answerList(q: NumberPuzzle, steps: ReturnType<typeof solveSteps>): string {
  const v = q.cells.map((c) => c.value);
  if (q.type === "magic") return `جدول کامل، هر سطر از راست به چپ: ${SQUARE_ROW.map((n, r) => `${n} ${[2, 1, 0].map((c) => fa(v[3 * r + c])).join("، ")}`).join("؛ ")}.`;
  if (q.type === "pyramid") {
    const rows = Math.round((Math.sqrt(8 * v.length + 1) - 1) / 2);
    const lines = Array.from({ length: rows }, (_, r) => Array.from({ length: r + 1 }, (_, i) => fa(v[r * (r + 1) / 2 + r - i])).join("، "));
    return `هرم کامل از بالا به پایین، هر ردیف از راست به چپ: ${lines.join("؛ ")}.`;
  }
  // Solver order when it has one, else the cells in order.
  const order: number[] = [];
  for (const s of steps ?? []) {
    if (s.kind === "pick") order.push(...s.cells);
    else if ((s.kind === "line" || s.kind === "only" || s.kind === "apply" || s.kind === "centre") && !order.includes(s.cell)) order.push(s.cell);
  }
  for (const i of blankCells(q)) if (!order.includes(i)) order.push(i);
  return `${order.filter((i) => !q.cells[i].given).map((i) => `${cellName(q, i)}: ${fa(v[i])}`).join("، ")}.`;
}

function solution(type: string, level: number, seed: number): string {
  const q = make(type, level, seed);
  const steps = solveSteps(q);
  const head = `جواب: ${answerList(q, steps)}`;
  const tail = q.anyFill ? " چینش‌های دیگری هم درست‌اند (مثلاً چرخاندن مثلث)." : "";
  // The key line: for number in shape and the matrix, the rule on a finished one and on the blank; else the solver's first step.
  const keys = !steps?.length ? [] : q.type === "shape" || q.type === "matrix" ? [steps[0], steps[steps.length - 1]] : [steps[0]];
  // A step about "this cell" names it, and a rule tried on a finished shape ends with a full stop, not a tick.
  const key = keys
    .map((s) => {
      const name = s.kind === "only" ? cellName(q, s.cell) : "";
      if (s.kind === "only" && name) return `برای ${name}، از عددهای باقی‌مانده (${s.rest.map(fa).join("، ")}) فقط ${fa(s.value)} با همه خط‌هایش جور درمی‌آید.`;
      return stepText(q, s).replace(/ ✓$/, ".");
    })
    .join(" ");
  for (const s of [`${head}${tail} ${key}`, `${head}${tail}`]) if (s.length <= 300) return s;
  return head;
}

export const NUMBER_PUZZLES_ADAPTER: ToolAdapter = {
  ...NUMBER_PUZZLES_PRACTICE,
  version: "number-puzzles@1",
  grade,
  hints,
  solution,
};
