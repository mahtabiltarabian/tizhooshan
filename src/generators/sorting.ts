// Tool 11, «مرتب‌سازی و الگوریتم» (Bebras-style step following).
//
// Level 1: follow a short program with a loop ("repeat 3 times: +2, ×2") and
// give the result; or a robot on a number line ("repeat 3 times: 4 forward,
// 1 back") and give its square.
// Level 2: a row of boxes and the rule "compare neighbours left to right and
// swap when the left one is bigger" (one pass of bubble sort): what is the row
// after one pass, or how many swaps happen in one pass?
// Level 3: how many passes until the row is sorted; the least number of
// neighbour swaps that sorts the row (the number of inversions); or which of
// four programs turns the start number into the target.
//
// Every question keeps the answers its usual slips give, so the feedback can
// name the slip. The generator rejects examples where two slips (or a slip
// and the answer) give the same value, so a wrong answer has one meaning.

import { applyStep, type Step } from "./number-machine";
import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type SortVariant = "loop" | "pass" | "swaps" | "passes" | "minSwaps" | "program";

/** "repeat `times` times: body[0], body[1]". */
export interface Program {
  times: number;
  body: Step[];
}

export type SortTag =
  | "right"
  /** Sorted the whole row instead of doing one pass. */
  | "fullSort"
  /** Swapped two boxes that are not neighbours (the biggest straight to the end). */
  | "nonNeighbour"
  /** Swapped when the left box was smaller (the other direction). */
  | "direction"
  /** Stopped the pass after the first swap. */
  | "stopFirst"
  /** Counted comparisons instead of swaps. */
  | "comparisons"
  /** The loop ran one time too many. */
  | "loopMore"
  /** The loop ran one time too few. */
  | "loopLess"
  /** Did the steps inside the loop in the other order. */
  | "order"
  /** Did the first step every time, then the second step every time. */
  | "grouped"
  /** Robot: left out one instruction of the loop. */
  | "skipStep"
  /** Counted the last pass that only checks (no swap) as well. */
  | "extraPass"
  /** Counted swaps instead of passes. */
  | "swapsNotPasses"
  /** Counted only the swaps of the first pass. */
  | "onePass"
  /** Program: one number of a step is different. */
  | "otherStep"
  | "other";

interface Base {
  type: "sort";
  level: Level;
  seed: number;
}

/** Level 1: run a program with a loop. */
export interface LoopQuestion extends Base {
  variant: "loop";
  /** number: a number goes through the program; robot: a robot walks a number line (+ forward, − back). */
  theme: "number" | "robot";
  start: number;
  program: Program;
  answer: number;
  slips: [SortTag, number][];
}

/** Level 2: the row after one pass (four rows to choose from). */
export interface PassQuestion extends Base {
  variant: "pass";
  row: number[];
  options: number[][];
  /** What each option is: "right" for the answer. */
  tags: SortTag[];
  answer: number;
}

/** A number about sorting the row: swaps in one pass, passes until sorted, least neighbour swaps. */
export interface CountQuestion extends Base {
  variant: "swaps" | "passes" | "minSwaps";
  row: number[];
  answer: number;
  slips: [SortTag, number][];
}

/** Level 3: which of four programs turns `start` into `target`? */
export interface ProgramQuestion extends Base {
  variant: "program";
  start: number;
  target: number;
  options: Program[];
  tags: SortTag[];
  answer: number;
}

export type SortQuestion = LoopQuestion | PassQuestion | CountQuestion | ProgramQuestion;

/** The answer is the number of an option (else a number to type). */
export const isChoice = (q: SortQuestion): q is PassQuestion | ProgramQuestion => q.variant === "pass" || q.variant === "program";

/** Largest value in a program's run. */
const MAX = 999;
const whole = (v: number) => Number.isInteger(v) && v >= 0 && v <= MAX;

// ── Programs ─────────────────────────────────────────────────────────────

/** The start and the value after every step of every round. */
export function runProgram(start: number, p: Program): number[] {
  const out = [start];
  for (let r = 0; r < p.times; r++) for (const s of p.body) out.push(applyStep(out[out.length - 1], s));
  return out;
}

export const programResult = (start: number, p: Program) => runProgram(start, p)[p.times * p.body.length];

/** Values after every step of every round, as rounds: [[after step 1, after step 2], …]. */
export function programRounds(start: number, p: Program): number[][] {
  const t = runProgram(start, p);
  return Array.from({ length: p.times }, (_, r) => t.slice(1 + r * p.body.length, 1 + (r + 1) * p.body.length));
}

/** All of step 1 first (every round), then all of step 2. */
export function groupedResult(start: number, p: Program): number {
  let x = start;
  for (const s of p.body) for (let r = 0; r < p.times; r++) x = applyStep(x, s);
  return x;
}

const cleanRun = (start: number, p: Program) => runProgram(start, p).every(whole);

// ── Rows ─────────────────────────────────────────────────────────────────

export const isSorted = (row: readonly number[]) => row.every((v, i) => i === 0 || row[i - 1] <= v);
export const sortedRow = (row: readonly number[]) => [...row].sort((a, b) => a - b);

/** One comparison of a pass: the pair (i, i + 1), whether it swapped, and the row after it. */
export interface Compare {
  i: number;
  swap: boolean;
  row: number[];
}

/**
 * One pass, left to right: compare each pair of neighbours and swap when the
 * left one is bigger (or smaller, with `smallerFirst`, the slip "direction").
 */
export function passSteps(row: readonly number[], smallerFirst = false): Compare[] {
  const r = [...row];
  const out: Compare[] = [];
  for (let i = 0; i + 1 < r.length; i++) {
    const swap = smallerFirst ? r[i] < r[i + 1] : r[i] > r[i + 1];
    if (swap) [r[i], r[i + 1]] = [r[i + 1], r[i]];
    out.push({ i, swap, row: [...r] });
  }
  return out;
}

export function onePass(row: readonly number[]): { row: number[]; swaps: number } {
  const st = passSteps(row);
  return { row: st.length ? st[st.length - 1].row : [...row], swaps: st.filter((s) => s.swap).length };
}

/** Passes until the row is sorted for the first time (a last pass that only checks is not counted). */
export function sortPasses(row: readonly number[]): Compare[][] {
  const passes: Compare[][] = [];
  let r = [...row];
  while (!isSorted(r) && passes.length < 50) {
    const st = passSteps(r);
    passes.push(st);
    r = st[st.length - 1].row;
  }
  return passes;
}

/** Pairs in the wrong order: the least number of neighbour swaps that sorts the row. */
export function inversions(row: readonly number[]): number {
  let n = 0;
  for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) if (row[i] > row[j]) n++;
  return n;
}

/** The least number of swaps of any two boxes (not only neighbours): boxes − cycles. */
export function minAnySwaps(row: readonly number[]): number {
  const target = sortedRow(row);
  const seen = row.map(() => false);
  let cycles = 0;
  for (let i = 0; i < row.length; i++) {
    if (seen[i]) continue;
    cycles++;
    for (let j = i; !seen[j]; j = target.indexOf(row[j])) seen[j] = true;
  }
  return row.length - cycles;
}

/** Slip: the biggest box swapped straight with the last box. */
export function jumpBiggest(row: readonly number[]): number[] {
  const r = [...row];
  const m = r.indexOf(Math.max(...r));
  [r[m], r[r.length - 1]] = [r[r.length - 1], r[m]];
  return r;
}

/** Slip: the pass stopped after its first swap. */
export function stopAtFirst(row: readonly number[]): number[] {
  const first = passSteps(row).find((s) => s.swap);
  return first ? first.row : [...row];
}

const sameRow = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

// ── Makers ───────────────────────────────────────────────────────────────

/** A row of n different numbers 1 … hi. */
const makeRow = (rng: Rng, n: number, hi: number) => shuffle(rng, Array.from({ length: hi }, (_, i) => i + 1)).slice(0, n);

/** Two steps that do not commute: an adding step and ×2 or ×3, in either order. */
function numberBody(rng: Rng): Step[] {
  const add: Step = { op: rng() < 0.7 ? "+" : "-", n: 1 + randInt(rng, 5) };
  const mult: Step = { op: "×", n: rng() < 0.75 ? 2 : 3 };
  return rng() < 0.5 ? [add, mult] : [mult, add];
}

/** Keeps the slips whose value is whole and new; null when one equals the answer or another slip. */
function distinctSlips(answer: number, slips: [SortTag, number][]): [SortTag, number][] | null {
  const seen = new Set([answer]);
  for (const [, v] of slips) {
    if (!whole(v) || seen.has(v)) return null;
    seen.add(v);
  }
  return slips;
}

function loopQuestion(rng: Rng, seed: number): LoopQuestion {
  const base = { type: "sort" as const, level: 1 as const, seed, variant: "loop" as const };
  for (;;) {
    if (rng() < 0.6) {
      const program: Program = { times: rng() < 0.5 ? 2 : 3, body: numberBody(rng) };
      const start = 1 + randInt(rng, 6);
      if (!cleanRun(start, program)) continue;
      const more = { ...program, times: program.times + 1 };
      const less = { ...program, times: program.times - 1 };
      const rev = { ...program, body: [...program.body].reverse() };
      const answer = programResult(start, program);
      if (answer > 200 || !cleanRun(start, more) || !cleanRun(start, rev)) continue;
      const slips = distinctSlips(answer, [
        ["loopMore", programResult(start, more)],
        ["loopLess", programResult(start, less)],
        ["order", programResult(start, rev)],
        ["grouped", groupedResult(start, program)],
      ]);
      if (slips) return { ...base, theme: "number", start, program, answer, slips };
    } else {
      const fwd = 2 + randInt(rng, 4);
      const back = 1 + randInt(rng, fwd - 1);
      const program: Program = { times: 3 + randInt(rng, 2), body: [{ op: "+", n: fwd }, { op: "-", n: back }] };
      const start = randInt(rng, 5);
      const answer = programResult(start, program);
      const slips = distinctSlips(answer, [
        ["loopMore", answer + fwd - back],
        ["loopLess", answer - fwd + back],
        ["skipStep", start + program.times * fwd],
      ]);
      if (slips) return { ...base, theme: "robot", start, program, answer, slips };
    }
  }
}

function passQuestion(rng: Rng, seed: number, level: Level): PassQuestion {
  for (;;) {
    const row = makeRow(rng, rng() < 0.5 ? 5 : 6, 20);
    const after = onePass(row).row;
    if (isSorted(after) || onePass(row).swaps < 2) continue;
    const cands: [SortTag, number[]][] = [
      ["fullSort", sortedRow(row)],
      ["nonNeighbour", jumpBiggest(row)],
      ["direction", passSteps(row, true)[row.length - 2].row],
      ["stopFirst", stopAtFirst(row)],
    ];
    const kept: [SortTag, number[]][] = [["right", after]];
    for (const c of cands) if (!kept.some(([, r]) => sameRow(r, c[1]))) kept.push(c);
    if (kept.length < 4) continue;
    // Full sort and the non-neighbour swap are always among the choices.
    if (kept[1][0] !== "fullSort" || kept[2][0] !== "nonNeighbour") continue;
    const order = shuffle(rng, [0, 1, 2, 3]);
    return { type: "sort", level, seed, variant: "pass", row, options: order.map((k) => kept[k][1]), tags: order.map((k) => kept[k][0]), answer: order.indexOf(0) };
  }
}

function swapsQuestion(rng: Rng, seed: number, level: Level): CountQuestion {
  for (;;) {
    const row = makeRow(rng, rng() < 0.5 ? 5 : 6, 20);
    const answer = onePass(row).swaps;
    if (answer < 1) continue;
    const slips = distinctSlips(answer, [
      ["comparisons", row.length - 1],
      ["fullSort", inversions(row)],
    ]);
    if (slips) return { type: "sort", level, seed, variant: "swaps", row, answer, slips };
  }
}

function passesQuestion(rng: Rng, seed: number, level: Level): CountQuestion {
  for (;;) {
    const row = makeRow(rng, rng() < 0.5 ? 5 : 6, 20);
    const answer = sortPasses(row).length;
    if (answer < 2) continue;
    const slips = distinctSlips(answer, [
      ["extraPass", answer + 1],
      ["swapsNotPasses", inversions(row)],
    ]);
    if (slips) return { type: "sort", level, seed, variant: "passes", row, answer, slips };
  }
}

function minSwapsQuestion(rng: Rng, seed: number, level: Level): CountQuestion {
  for (;;) {
    const row = makeRow(rng, rng() < 0.5 ? 5 : 6, 20);
    const answer = inversions(row);
    if (answer < 3 || answer > 12) continue;
    const passes = sortPasses(row);
    const slips = distinctSlips(answer, [
      ["nonNeighbour", minAnySwaps(row)],
      ["onePass", onePass(row).swaps],
      ["comparisons", passes.length * (row.length - 1)],
    ]);
    if (slips) return { type: "sort", level, seed, variant: "minSwaps", row, answer, slips };
  }
}

function programQuestion(rng: Rng, seed: number, level: Level): ProgramQuestion {
  for (;;) {
    const right: Program = { times: rng() < 0.5 ? 2 : 3, body: numberBody(rng) };
    const start = 1 + randInt(rng, 6);
    const target = programResult(start, right);
    if (!cleanRun(start, right) || target > 200) continue;
    const longer = rng() < 0.5;
    const other = randInt(rng, 2);
    const cands: [SortTag, Program][] = [
      ["right", right],
      [longer ? "loopMore" : "loopLess", { ...right, times: right.times + (longer ? 1 : -1) }],
      ["order", { ...right, body: [...right.body].reverse() }],
      ["otherStep", { ...right, body: right.body.map((s, i) => (i === other ? { ...s, n: s.n + (s.op === "×" ? 1 : pick(rng, [1, 2])) } : s)) }],
    ];
    if (!cands.every(([, p]) => cleanRun(start, p))) continue;
    // Exactly one program reaches the target.
    if (cands.slice(1).some(([, p]) => programResult(start, p) === target)) continue;
    const order = shuffle(rng, [0, 1, 2, 3]);
    return { type: "sort", level, seed, variant: "program", start, target, options: order.map((k) => cands[k][1]), tags: order.map((k) => cands[k][0]), answer: order.indexOf(0) };
  }
}

export function makeSortQuestion(level: Level, seed: number): SortQuestion {
  const rng = mulberry32(seed * 13 + level * 977 + 4049);
  if (level === 1) return loopQuestion(rng, seed);
  if (level === 2) return rng() < 0.5 ? passQuestion(rng, seed, level) : swapsQuestion(rng, seed, level);
  const v = randInt(rng, 3);
  return v === 0 ? passesQuestion(rng, seed, level) : v === 1 ? minSwapsQuestion(rng, seed, level) : programQuestion(rng, seed, level);
}

/** Which slip an answer is (a number, or the number of the chosen option). */
export function sortMistake(q: SortQuestion, value: number): SortTag {
  if (value === q.answer) return "right";
  if (isChoice(q)) return q.tags[value] ?? "other";
  return q.slips.find(([, v]) => v === value)?.[0] ?? "other";
}

/** A random row for explore: n different numbers 1 … 20, not already sorted. */
export function exploreRow(n: number, seed: number): number[] {
  const rng = mulberry32(seed * 7 + n);
  for (;;) {
    const row = makeRow(rng, n, 20);
    if (!isSorted(row)) return row;
  }
}
