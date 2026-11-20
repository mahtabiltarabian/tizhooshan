// Tool 21, timed mental arithmetic (حساب ذهنی). One question is a card of
// six short sums, written left to right as in the textbook. The clock counts
// up and never runs out, like the rest of the tool.
//
// Level 1: two-digit and one-digit sums and the times table. Level 2: carrying
// and borrowing, two-digit by one-digit products, and order of operations.
// Level 3: shortcuts with round numbers (99 + n, 25 × n, 11 × n), three-digit
// sums, and two products in one expression. Every answer is 0 … 999, so it
// fits the three-digit number pad.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type MentalOp = "add" | "sub" | "mul" | "div" | "mix";
export type Sign = "+" | "−" | "×" | "÷";

export interface MentalItem {
  op: MentalOp;
  /** The numbers, left to right. */
  nums: number[];
  /** The signs between them. */
  signs: Sign[];
  answer: number;
}

export interface MentalQuestion {
  type: "mental";
  level: Level;
  seed: number;
  items: MentalItem[];
}

export const MENTAL_ITEMS = 6;

const between = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

const apply = (a: number, s: Sign, b: number) => (s === "+" ? a + b : s === "−" ? a - b : s === "×" ? a * b : a / b);

/** The value with × and ÷ first, as it should be. */
export function evaluate(nums: readonly number[], signs: readonly Sign[]): number {
  const terms: number[] = [nums[0]];
  const adds: Sign[] = [];
  signs.forEach((s, i) => {
    if (s === "×" || s === "÷") terms[terms.length - 1] = apply(terms[terms.length - 1], s, nums[i + 1]);
    else {
      adds.push(s);
      terms.push(nums[i + 1]);
    }
  });
  return adds.reduce((v, s, i) => apply(v, s, terms[i + 1]), terms[0]);
}

/** The value worked strictly left to right (the order-of-operations slip). */
export const leftToRight = (nums: readonly number[], signs: readonly Sign[]) => signs.reduce((v, s, i) => apply(v, s, nums[i + 1]), nums[0]);

const item = (op: MentalOp, nums: number[], signs: Sign[]): MentalItem => ({ op, nums, signs, answer: evaluate(nums, signs) });

function add(rng: Rng, level: Level): MentalItem {
  if (level === 1) return item("add", [between(rng, 11, 89), between(rng, 2, 9)], ["+"]);
  if (level === 2) {
    // Two two-digit numbers whose ones carry.
    for (;;) {
      const [a, b] = [between(rng, 12, 79), between(rng, 12, 79)];
      if ((a % 10) + (b % 10) >= 10) return item("add", [a, b], ["+"]);
    }
  }
  // Near a hundred, or three digits and two.
  if (rng() < 0.5) return item("add", [pick(rng, [99, 98, 199, 198, 299]), between(rng, 23, 89)], ["+"]);
  for (;;) {
    const [a, b] = [between(rng, 120, 860), between(rng, 23, 89)];
    if ((a % 10) + (b % 10) >= 10) return item("add", [a, b], ["+"]);
  }
}

function sub(rng: Rng, level: Level): MentalItem {
  if (level === 1) {
    const a = between(rng, 20, 99);
    return item("sub", [a, between(rng, 2, 9)], ["−"]);
  }
  if (level === 2) {
    // Two digits from two digits, with borrowing.
    for (;;) {
      const a = between(rng, 31, 98);
      const b = between(rng, 12, a - 10);
      if (a % 10 < b % 10) return item("sub", [a, b], ["−"]);
    }
  }
  if (rng() < 0.5) return item("sub", [between(rng, 210, 940), pick(rng, [99, 98, 199])], ["−"]);
  for (;;) {
    const a = between(rng, 300, 999);
    const b = between(rng, 23, 89);
    if (a % 10 < b % 10) return item("sub", [a, b], ["−"]);
  }
}

function mul(rng: Rng, level: Level): MentalItem {
  if (level === 1) return item("mul", [between(rng, 2, 9), between(rng, 2, 9)], ["×"]);
  if (level === 2) return item("mul", [between(rng, 12, 29), between(rng, 3, 9)], ["×"]);
  switch (randInt(rng, 4)) {
    case 0:
      return item("mul", [25, pick(rng, [8, 12, 16, 24, 28, 36])], ["×"]);
    case 1:
      return item("mul", [11, between(rng, 12, 45)], ["×"]);
    case 2:
      return item("mul", [between(rng, 7, 49) * 2, 5], ["×"]);
    default:
      return item("mul", [99, between(rng, 2, 9)], ["×"]);
  }
}

function div(rng: Rng, level: Level): MentalItem {
  if (level === 1) {
    const [q, d] = [between(rng, 2, 9), between(rng, 2, 9)];
    return item("div", [q * d, d], ["÷"]);
  }
  if (level === 2) {
    for (;;) {
      const [q, d] = [between(rng, 11, 25), between(rng, 2, 6)];
      if (q * d <= 150) return item("div", [q * d, d], ["÷"]);
    }
  }
  for (;;) {
    const [q, d] = [between(rng, 21, 99), between(rng, 3, 9)];
    if (q * d >= 100 && q * d <= 999) return item("div", [q * d, d], ["÷"]);
  }
}

function mix(rng: Rng, level: Level): MentalItem {
  // Forms where the order of operations changes the answer.
  for (;;) {
    let it: MentalItem;
    const form = level === 2 ? randInt(rng, 3) : randInt(rng, 4);
    const [b, c] = [between(rng, 2, 9), between(rng, 2, 9)];
    if (form === 0) it = item("mix", [between(rng, 2, level === 2 ? 20 : 60), b, c], ["+", "×"]);
    else if (form === 1) it = item("mix", [between(rng, b * c + 1, b * c + (level === 2 ? 30 : 80)), b, c], ["−", "×"]);
    else if (form === 2) it = item("mix", [between(rng, 2, 40), b * c, c], ["+", "÷"]);
    else it = item("mix", [b, c, between(rng, 2, 9), between(rng, 2, 9)], ["×", "+", "×"]);
    const slip = leftToRight(it.nums, it.signs);
    if (it.answer >= 0 && it.answer <= 999 && slip !== it.answer && Number.isInteger(slip) && slip >= 0) return it;
  }
}

const MAKERS = { add, sub, mul, div, mix };
const PLAN: Record<Level, MentalOp[]> = {
  1: ["add", "sub", "mul", "div", "add", "sub"],
  2: ["add", "sub", "mul", "div", "mix", "mix"],
  3: ["add", "sub", "mul", "div", "mix", "mix"],
};

export function makeMentalQuestion(level: Level, seed: number): MentalQuestion {
  const rng = mulberry32(seed * 53 + level * 997 + 4_201);
  const items: MentalItem[] = [];
  const seen = new Set<string>();
  for (const op of PLAN[level]) {
    for (;;) {
      const it = MAKERS[op](rng, level);
      const key = `${it.nums.join()}${it.signs.join()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(it);
      break;
    }
  }
  // The same kinds every time, in a new order.
  return { type: "mental", level, seed, items: shuffle(rng, items) };
}

export type MentalTag = "right" | "carry" | "borrow" | "times" | "partial" | "order" | "other";

/** Digit by digit, the smaller taken from the larger (no borrowing). */
export function noBorrow(a: number, b: number): number {
  let out = 0;
  for (let p = 1; a >= p || b >= p; p *= 10) out += Math.abs((Math.floor(a / p) % 10) - (Math.floor(b / p) % 10)) * p;
  return out;
}

/** Wrong answers with a known cause, in the order they are checked. */
export function itemSlips(it: MentalItem): [MentalTag, number][] {
  const [a, b] = it.nums;
  const out: [MentalTag, number][] = [];
  switch (it.op) {
    case "add":
      if ((a % 10) + (b % 10) >= 10) out.push(["carry", a + b - 10]);
      break;
    case "sub":
      if (a % 10 < b % 10) out.push(["borrow", noBorrow(a, b)]);
      break;
    case "mul": {
      const [big, small] = a >= b ? [a, b] : [b, a];
      if (big >= 10 && big % 10) out.push(["partial", (big - (big % 10)) * small + (big % 10)]);
      if (big < 10) out.push(["times", (a + 1) * b], ["times", (a - 1) * b], ["times", a * (b + 1)], ["times", a * (b - 1)]);
      break;
    }
    case "div":
      out.push(["times", it.answer + 1], ["times", it.answer - 1]);
      break;
    case "mix":
      out.push(["order", leftToRight(it.nums, it.signs)]);
      break;
  }
  return out.filter(([, v], i) => Number.isInteger(v) && v >= 0 && v !== it.answer && out.findIndex(([, w]) => w === v) === i);
}

/** Grades one card: right when every answer is right; otherwise the first known slip, in card order. */
export function mentalMistake(q: MentalQuestion, response: unknown): MentalTag {
  if (!Array.isArray(response) || response.length !== q.items.length) return "other";
  const wrong = q.items.map((it, i) => [it, response[i]] as const).filter(([it, v]) => v !== it.answer);
  if (!wrong.length) return "right";
  for (const [it, v] of wrong) {
    const slip = itemSlips(it).find(([, x]) => x === v);
    if (slip) return slip[0];
  }
  return "other";
}

/** Which items are right, for the ✓ and ✗ marks. */
export const itemsRight = (q: MentalQuestion, response: readonly (number | null)[]) => q.items.map((it, i) => response[i] === it.answer);
