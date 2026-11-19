// Tool 13, five more topics: LCM and GCD in stories, cryptarithms (letters
// for digits), putting signs between numbers, digits of page numbers, and
// the units digit of products and powers. As in digits.ts, every question
// has one right answer, and a mistake function names the usual slip so the
// feedback can say what went wrong.
//
// Only types come from digits.ts, so the two modules do not load each other.

import type { Level } from "./digits";
import { pick, randInt, shuffle, type Rng } from "./random";

interface Base {
  level: Level;
  seed: number;
}

export type MoreTag =
  | "right"
  | "product"
  | "swapped"
  | "pairOnly"
  | "notLeast"
  | "notGreatest"
  | "pieceLength"
  | "oneRibbon"
  | "forgotStart"
  | "badTime"
  | "repeatedDigit"
  | "leadingZero"
  | "noCarry"
  | "column"
  | "notSum"
  | "leftToRight"
  | "ignoreParens"
  | "wrongValue"
  | "noOnes"
  | "tensAsOne"
  | "allSame"
  | "divideAll"
  | "rangeOnly"
  | "offByOne"
  | "numbersOnly"
  | "onesOnly"
  | "noHundreds"
  | "addedUnits"
  | "missedFactor"
  | "multipliedExp"
  | "cyclePos"
  | "baseOnly"
  | "wrongOp"
  | "other";

// ── 1. LCM and GCD in stories ────────────────────────────────────────────

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
export const gcdAll = (xs: number[]) => xs.reduce(gcd);
export const lcmAll = (xs: number[]) => xs.reduce(lcm);

/**
 * lcm: when together again · gcd: longest equal piece, most equal packs ·
 * pieces: how many pieces in all · clock: at what time together again.
 */
export type LcmAsk = "lcm" | "gcd" | "pieces" | "clock";

export interface LcmQuestion extends Base {
  type: "lcm";
  ask: LcmAsk;
  /** Which story the text tells (see LCM_STORIES in the tool). */
  story: number;
  nums: number[];
  /** Clock questions: the start, in minutes after midnight (0 otherwise). */
  start: number;
  /** A number; for a clock question the time typed as digits (8:12 → 812). */
  answer: number;
}

/** Stories per ask; lcm stories 0–2 take two numbers, 3–4 take three. */
export const LCM_STORY_COUNT = { lcm: 5, gcd: 3, pieces: 1, clock: 1 } as const;

/** A time as typed: 8:12 → 812. */
export const clockKey = (min: number) => Math.floor(min / 60) * 100 + (min % 60);
/** A typed time back to minutes, or null if it is not a time (8:75). */
export function clockMinutes(key: number): number | null {
  const h = Math.floor(key / 100);
  const m = key % 100;
  if (m > 59 || h < 1 || h > 23) return null;
  return h * 60 + m;
}

const divides = (a: number, b: number) => b % a === 0;

/** Two numbers with a common factor, neither dividing the other. */
function pairFor(rng: Rng, lo: number, hi: number, maxLcm: number): number[] {
  for (;;) {
    const a = lo + randInt(rng, hi - lo + 1);
    const b = lo + randInt(rng, hi - lo + 1);
    if (a === b || divides(a, b) || divides(b, a) || gcd(a, b) === 1 || lcm(a, b) > maxLcm) continue;
    return a < b ? [a, b] : [b, a];
  }
}

function lcmQuestion(rng: Rng, level: Level, seed: number): LcmQuestion {
  const base = { type: "lcm" as const, level, seed, start: 0 };
  if (level === 1) {
    const nums = pairFor(rng, 2, 15, 60);
    const ask = rng() < 0.55 ? "lcm" : "gcd";
    return { ...base, ask, story: randInt(rng, 3), nums, answer: ask === "lcm" ? lcmAll(nums) : gcdAll(nums) };
  }
  if (level === 2) {
    const nums = pairFor(rng, 6, 40, 200);
    const r = rng();
    const ask: LcmAsk = r < 0.4 ? "lcm" : r < 0.75 ? "gcd" : "pieces";
    const g = gcdAll(nums);
    const answer = ask === "lcm" ? lcmAll(nums) : ask === "gcd" ? g : nums[0] / g + nums[1] / g;
    return { ...base, ask, story: ask === "pieces" ? 0 : randInt(rng, 3), nums, answer };
  }
  if (rng() < 0.55) {
    // Buses from a start time; the time of day comes out before noon.
    for (;;) {
      const nums = pairFor(rng, 6, 30, 150);
      const start = 6 * 60 + 15 * randInt(rng, 16);
      const L = lcmAll(nums);
      if (start + L >= 12 * 60) continue;
      return { ...base, ask: "clock", story: 0, nums, start, answer: clockKey(start + L) };
    }
  }
  // Three numbers: the third must matter (it is no pair's LCM, nor a divisor of one).
  for (;;) {
    const nums = shuffle(rng, [2, 3, 4, 5, 6, 8, 9, 10, 12, 15]).slice(0, 3).sort((a, b) => a - b);
    const L = lcmAll(nums);
    if (L > 180 || L === product(nums)) continue;
    if (nums.some((x, i) => nums.some((y, j) => i !== j && divides(x, y)))) continue;
    if ([lcm(nums[0], nums[1]), lcm(nums[0], nums[2]), lcm(nums[1], nums[2])].includes(L)) continue;
    return { ...base, ask: "lcm", story: 3 + randInt(rng, 2), nums, answer: L };
  }
}

const product = (xs: number[]) => xs.reduce((p, x) => p * x, 1);

export function lcmSlips(q: LcmQuestion): [MoreTag, number][] {
  const L = lcmAll(q.nums);
  const G = gcdAll(q.nums);
  const P = product(q.nums);
  switch (q.ask) {
    case "lcm":
      return [
        ["product", P],
        ...(G > 1 ? [["swapped", G]] : []),
        ...(q.nums.length === 3
          ? [
              ["pairOnly", lcm(q.nums[0], q.nums[1])],
              ["pairOnly", lcm(q.nums[0], q.nums[2])],
              ["pairOnly", lcm(q.nums[1], q.nums[2])],
            ]
          : []),
      ] as [MoreTag, number][];
    case "gcd":
      return [["swapped", L]];
    case "pieces":
      return [
        ["pieceLength", G],
        ["oneRibbon", q.nums[0] / G],
        ["oneRibbon", q.nums[1] / G],
      ];
    case "clock":
      return [
        ["forgotStart", L],
        ["product", clockKey(q.start + P)],
        ["swapped", clockKey(q.start + G)],
      ];
  }
}

function lcmMistake(q: LcmQuestion, v: number): MoreTag {
  for (const [tag, s] of lcmSlips(q)) if (s !== q.answer && v === s) return tag;
  if (q.ask === "lcm" && v > q.answer && q.nums.every((x) => divides(x, v))) return "notLeast";
  if (q.ask === "gcd" && v < q.answer && v > 0 && q.nums.every((x) => divides(v, x))) return "notGreatest";
  if (q.ask === "clock") {
    const m = clockMinutes(v);
    if (m === null) return "badTime";
    const after = m - q.start;
    if (after > 0 && q.nums.every((x) => divides(x, after))) return "notLeast";
  }
  return "other";
}

// ── 2. Cryptarithms ──────────────────────────────────────────────────────

/** Cells of a cryptarithm: 0–9 a written digit, LETTER + i the letter i. */
export const LETTER = 10;
/** Persian letters used (Persian names, as written in puzzle books). */
export const LETTER_POOL = ["الف", "ب", "پ", "ت", "ج", "د", "ر", "س", "م", "ن"];

export interface CryptQuestion extends Base {
  type: "crypt";
  letters: string[];
  /** Cells left to right. */
  top: number[];
  bottom: number[];
  sum: number[];
  /** The digit of each letter: the one solution. */
  solution: number[];
}

type Puzzle = Pick<CryptQuestion, "top" | "bottom" | "sum" | "solution">;

/** The number a row of cells says, with letter values `vals`. */
export const rowValue = (cells: number[], vals: number[]) => cells.reduce((n, c) => n * 10 + (c >= LETTER ? vals[c - LETTER] : c), 0);
/** The digit in a cell. */
export const cellDigit = (c: number, vals: number[]) => (c >= LETTER ? vals[c - LETTER] : c);

/** Does some number start with a letter that is 0? */
export function cryptLeadZero(q: Pick<CryptQuestion, "top" | "bottom" | "sum">, vals: number[]) {
  return [q.top, q.bottom, q.sum].some((r) => r.length > 1 && r[0] >= LETTER && vals[r[0] - LETTER] === 0);
}

/** Every assignment of different digits to the letters that makes the sum true (stops after `limit`). */
export function cryptSolutions(q: Pick<CryptQuestion, "top" | "bottom" | "sum">, k: number, limit = 1e9): number[][] {
  const out: number[][] = [];
  const vals: number[] = [];
  const walk = () => {
    if (out.length >= limit) return;
    if (vals.length === k) {
      if (!cryptLeadZero(q, vals) && rowValue(q.top, vals) + rowValue(q.bottom, vals) === rowValue(q.sum, vals)) out.push([...vals]);
      return;
    }
    for (let d = 0; d <= 9; d++)
      if (!vals.includes(d)) {
        vals.push(d);
        walk();
        vals.pop();
      }
  };
  walk();
  return out;
}

/** Digits of n as cells; every digit that is a letter's value is written as that letter. */
function lettered(n: number, vals: number[]) {
  return String(n)
    .split("")
    .map(Number)
    .map((d) => (vals.includes(d) ? LETTER + vals.indexOf(d) : d));
}

/** A pattern: letter index (≥ 0) or −1 for a written digit. */
type Pat = number[];

const CRYPT_PATTERNS: Record<Level, [Pat, Pat][]> = {
  // One letter, once or twice, in the numbers added.
  1: [
    [[0, -1], [-1, -1]],
    [[-1, 0], [-1, -1]],
    [[-1, 0], [0, -1]],
    [[0, -1], [-1, 0]],
    [[-1, 0], [-1, 0]],
  ],
  // Two letters; the first is «الف ب + ب الف».
  2: [
    [[0, 1], [1, 0]],
    [[0, 1], [0, 1]],
    [[0, 1], [1, 1]],
    [[0, 1], [1, -1]],
    [[0, 1], [-1, 0]],
    [[0, 1], [-1, 1]],
    [[0, -1], [1, 0]],
  ],
  // Three letters, a carry out of the ones.
  3: [
    [[0, 1], [1, 0]],
    [[0, 1], [1, 2]],
    [[0, 1], [2, 1]],
    [[0, 1], [2, 0]],
    [[0, 1], [2, 2]],
    [[0, 0], [1, 2]],
    [[0, 1], [2, -1]],
    [[0, 1], [-1, 2]],
    [[0, -1], [1, 2]],
  ],
};

const cryptPools = new Map<string, Puzzle[]>();

/**
 * Every puzzle of a pattern: the letters take different digits, written
 * digits are none of them, the sum is written with the letters wherever its
 * digit is a letter's, and exactly one assignment makes it true. Built once.
 */
export function cryptPool(level: Level, p: number): Puzzle[] {
  const key = `${level}-${p}`;
  const hit = cryptPools.get(key);
  if (hit) return hit;
  const [tp, bp] = CRYPT_PATTERNS[level][p];
  const k = level;
  const out: Puzzle[] = [];
  const vals: number[] = [];
  const free = [...tp, ...bp].filter((x) => x < 0).length;
  const fill = (frees: number[]) => {
    if (frees.length < free) {
      for (let d = 0; d <= 9; d++) if (!vals.includes(d)) fill([...frees, d]);
      return;
    }
    let i = 0;
    const cells = (pat: Pat) => pat.map((x) => (x < 0 ? frees[i++] : LETTER + x));
    const top = cells(tp);
    const bottom = cells(bp);
    if (cellDigit(top[0], vals) === 0 || cellDigit(bottom[0], vals) === 0) return;
    if (level === 3 && cellDigit(top[1], vals) + cellDigit(bottom[1], vals) < 10) return;
    const sum = lettered(rowValue(top, vals) + rowValue(bottom, vals), vals);
    if (new Set([...top, ...bottom, ...sum].filter((c) => c >= LETTER)).size < k) return;
    const puzzle = { top, bottom, sum };
    const sols = cryptSolutions(puzzle, k, 2);
    if (sols.length === 1) out.push({ ...puzzle, solution: sols[0] });
  };
  const walk = () => {
    if (vals.length === k) return fill([]);
    for (let d = 0; d <= 9; d++)
      if (!vals.includes(d)) {
        vals.push(d);
        walk();
        vals.pop();
      }
  };
  walk();
  cryptPools.set(key, out);
  return out;
}

export const cryptPatternCount = (level: Level) => CRYPT_PATTERNS[level].length;

function cryptQuestion(rng: Rng, level: Level, seed: number): CryptQuestion {
  // Level 2: «الف ب + ب الف» a third of the time, other two-letter sums otherwise.
  const n = CRYPT_PATTERNS[level].length;
  const p = level === 2 && rng() < 0.35 ? 0 : level === 2 ? 1 + randInt(rng, n - 1) : randInt(rng, n);
  const pool = cryptPool(level, p);
  const puzzle = pool[randInt(rng, pool.length)];
  const letters = level === 2 ? ["الف", "ب"] : level === 1 ? [pick(rng, LETTER_POOL)] : shuffle(rng, LETTER_POOL).slice(0, 3);
  return { type: "crypt", level, seed, letters, ...puzzle };
}

/** Columns from the right: [top digit, bottom digit, carry in, sum digit]; missing digits are 0. */
export function cryptColumns(q: Pick<CryptQuestion, "top" | "bottom" | "sum">, vals: number[]) {
  const at = (r: number[], i: number) => (i < r.length ? cellDigit(r[r.length - 1 - i], vals) : 0);
  const cols: { t: number; b: number; carry: number; s: number; ok: boolean }[] = [];
  let carry = 0;
  for (let i = 0; i < q.sum.length; i++) {
    const t = at(q.top, i);
    const b = at(q.bottom, i);
    const s = at(q.sum, i);
    const total = t + b + carry;
    cols.push({ t, b, carry, s, ok: total % 10 === s });
    carry = Math.floor(total / 10);
  }
  return cols;
}

function cryptMistake(q: CryptQuestion, value: string): MoreTag {
  if (!/^\d+$/.test(value) || value.length !== q.letters.length) return "other";
  const vals = value.split("").map(Number);
  if (new Set(vals).size < vals.length) return "repeatedDigit";
  if (cryptLeadZero(q, vals)) return "leadingZero";
  // Carries forgotten: every column right as if nothing were carried.
  const width = Math.max(q.top.length, q.bottom.length);
  const at = (r: number[], i: number) => (i < r.length ? cellDigit(r[r.length - 1 - i], vals) : 0);
  const noCarry = Array.from({ length: width }, (_, i) => (at(q.top, i) + at(q.bottom, i)) % 10 === at(q.sum, i)).every(Boolean);
  if (noCarry && q.sum.length === width) return "noCarry";
  const cols = cryptColumns(q, vals);
  if (cols[0].ok) return "column";
  return "notSum";
}

// ── 3. Signs between numbers ─────────────────────────────────────────────

/** + − × ÷ as 0 … 3; an answer writes them 1 … 4. */
export const OPS = ["+", "−", "×", "÷"] as const;
type Frac = [number, number];

const norm = ([n, d]: Frac): Frac => {
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  return d < 0 ? [-n / g, -d / g] : [n / g, d / g];
};

/** a op b exactly, or null (division by zero; or, strict, a fraction or a negative). */
function apply(a: Frac, op: number, b: Frac, strict: boolean): Frac | null {
  let r: Frac;
  if (op === 0) r = [a[0] * b[1] + b[0] * a[1], a[1] * b[1]];
  else if (op === 1) r = [a[0] * b[1] - b[0] * a[1], a[1] * b[1]];
  else if (op === 2) r = [a[0] * b[0], a[1] * b[1]];
  else {
    if (b[0] === 0) return null;
    r = [a[0] * b[1], a[1] * b[0]];
  }
  r = norm(r);
  if (strict && (r[1] !== 1 || r[0] < 0)) return null;
  return r;
}

/** Value of a flat expression: × and ÷ first (rules), or plainly left to right. */
function flat(vals: Frac[], ops: number[], rules: boolean, strict: boolean): Frac | null {
  if (!rules) {
    let acc: Frac | null = vals[0];
    for (let i = 0; i < ops.length && acc; i++) acc = apply(acc, ops[i], vals[i + 1], strict);
    return acc;
  }
  const terms: Frac[] = [vals[0]];
  const adds: number[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] >= 2) {
      const t = apply(terms[terms.length - 1], ops[i], vals[i + 1], strict);
      if (!t) return null;
      terms[terms.length - 1] = t;
    } else {
      adds.push(ops[i]);
      terms.push(vals[i + 1]);
    }
  }
  return flat(terms, adds, false, strict);
}

export interface EvalWay {
  /** × and ÷ before + and −. */
  rules: boolean;
  /** Brackets first. */
  parens: boolean;
}
export const BY_RULES: EvalWay = { rules: true, parens: true };

/** An expression's value as a fraction [numerator, denominator], or null. */
export function signsValue(nums: number[], ops: number[], paren: [number, number] | null, way: EvalWay = BY_RULES, strict = false): Frac | null {
  let vals: Frac[] = nums.map((n) => [n, 1]);
  let o = [...ops];
  if (paren && way.parens) {
    const [i, j] = paren;
    const inner = flat(vals.slice(i, j + 1), o.slice(i, j), way.rules, strict);
    if (!inner) return null;
    vals = [...vals.slice(0, i), inner, ...vals.slice(j + 1)];
    o = [...o.slice(0, i), ...o.slice(j)];
  }
  return flat(vals, o, way.rules, strict);
}

export interface SignsQuestion extends Base {
  type: "signs";
  nums: number[];
  /** Level 3: the numbers from i to j are in brackets. */
  paren: [number, number] | null;
  target: number;
  /** The one choice of signs (0 … 3 each) that makes the target. */
  ops: number[];
}

/** Every choice of k signs. */
export function allOps(k: number): number[][] {
  if (k === 0) return [[]];
  return allOps(k - 1).flatMap((o) => [0, 1, 2, 3].map((x) => [...o, x]));
}

const hits = (f: Frac | null, t: number) => !!f && f[1] === 1 && f[0] === t;

const PARENS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 2],
  [1, 3],
];

function signsQuestion(rng: Rng, level: Level, seed: number): SignsQuestion {
  const k = level === 1 ? 3 : 4;
  for (;;) {
    const nums = Array.from({ length: k }, () => 1 + randInt(rng, level === 1 ? 9 : 12));
    const ops = Array.from({ length: k - 1 }, () => randInt(rng, 4));
    const paren = level === 3 ? pick(rng, PARENS) : null;
    // Every step of the right answer stays a whole number, not below zero.
    const v = signsValue(nums, ops, paren, BY_RULES, true);
    if (!v || v[0] > 99) continue;
    const mixed = ops.some((o) => o >= 2) && ops.some((o) => o < 2);
    if (level > 1 && !mixed) continue;
    if (level === 1 && !mixed && rng() < 0.7) continue;
    // Brackets must change the answer.
    if (paren && hits(signsValue(nums, ops, null), v[0])) continue;
    if (allOps(k - 1).filter((o) => hits(signsValue(nums, o, paren), v[0])).length !== 1) continue;
    return { type: "signs", level, seed, nums, paren, target: v[0], ops };
  }
}

function signsMistake(q: SignsQuestion, value: string): MoreTag {
  if (!/^[1-4]+$/.test(value) || value.length !== q.ops.length) return "other";
  const ops = value.split("").map((d) => Number(d) - 1);
  if (q.paren && hits(signsValue(q.nums, ops, null), q.target)) return "ignoreParens";
  if (hits(signsValue(q.nums, ops, q.paren, { rules: false, parens: true }), q.target)) return "leftToRight";
  if (q.paren && hits(signsValue(q.nums, ops, q.paren, { rules: false, parens: false }), q.target)) return "leftToRight";
  return "wrongValue";
}

// ── 4. Digits of page numbers ────────────────────────────────────────────

export const numLen = (n: number) => String(n).length;

/** Digits written to number pages a … b. */
export function pageDigits(a: number, b: number): number {
  let s = 0;
  for (let len = 1, lo = 1; lo <= b; len++, lo *= 10) {
    const x = Math.max(a, lo);
    const y = Math.min(b, lo * 10 - 1);
    if (y >= x) s += (y - x + 1) * len;
  }
  return s;
}

/** How many times digit d is written in a … b, by place (ones first). */
export function rangePlaces(d: number, a: number, b: number): number[] {
  const out = [0, 0, 0, 0];
  for (let k = a; k <= b; k++) for (let m = k, p = 0; m > 0; p++, m = Math.floor(m / 10)) if (m % 10 === d) out[p]++;
  return out;
}
export const rangeCount = (d: number, a: number, b: number) => rangePlaces(d, a, b).reduce((s, x) => s + x, 0);

/** digits: for pages 1 … to · pages: how many pages from `digits` · ones: times digit 1 in from … to. */
export type PagesAsk = "digits" | "pages" | "ones";

export interface PagesQuestion extends Base {
  type: "pages";
  ask: PagesAsk;
  from: number;
  to: number;
  /** Pages questions: the digits used. */
  digits: number;
  answer: number;
}

function pagesQuestion(rng: Rng, level: Level, seed: number): PagesQuestion {
  const base = { type: "pages" as const, level, seed };
  if (level === 1) {
    const to = 12 + randInt(rng, 88);
    return { ...base, ask: "digits", from: 1, to, digits: 0, answer: pageDigits(1, to) };
  }
  if (level === 2) {
    if (rng() < 0.4) {
      const to = 100 + randInt(rng, 301);
      return { ...base, ask: "digits", from: 1, to, digits: 0, answer: pageDigits(1, to) };
    }
    const to = rng() < 0.25 ? 20 + randInt(rng, 80) : 100 + randInt(rng, 900);
    return { ...base, ask: "pages", from: 1, to, digits: pageDigits(1, to), answer: to };
  }
  if (rng() < 0.4) {
    const to = 100 + randInt(rng, 500);
    return { ...base, ask: "ones", from: 1, to, digits: 0, answer: rangeCount(1, 1, to) };
  }
  // A chapter: sometimes starting or ending on a page with a 1, so the ends matter.
  const from = rng() < 0.5 ? pick(rng, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 31, 41, 51, 61, 71, 81, 91]) : 20 + randInt(rng, 130);
  const to = from + 40 + randInt(rng, 260);
  return { ...base, ask: "ones", from, to, digits: 0, answer: rangeCount(1, from, to) };
}

/** The pages for which a (wrong) way of counting gives D digits, if any. */
function invert(count: (n: number) => number, D: number): number | null {
  for (let n = 1; n <= 3000; n++) if (count(n) === D) return n;
  return null;
}

const twoDigitPages = (n: number) => Math.max(0, Math.min(n, 99) - 9);
/** Wrong ways of counting the digits of pages 1 … n. */
const WRONG_COUNTS = {
  noOnes: (n: number) => pageDigits(1, n) - Math.min(n, 9),
  tensAsOne: (n: number) => pageDigits(1, n) - twoDigitPages(n),
};

export function pagesSlips(q: PagesQuestion): [MoreTag, number][] {
  const out: [MoreTag, number][] = [];
  const add = (t: MoreTag, v: number | null) => {
    if (v !== null && Number.isInteger(v) && v >= 0) out.push([t, v]);
  };
  if (q.ask === "digits") {
    const n = q.to;
    const F = q.answer;
    const len = numLen(n);
    add("noOnes", WRONG_COUNTS.noOnes(n));
    if (n >= 10) add("tensAsOne", WRONG_COUNTS.tensAsOne(n));
    add("allSame", n * len);
    add("offByOne", F - len);
    add("offByOne", F + len);
    if (n >= 100) {
      add("offByOne", F - 2);
      add("offByOne", F + 2);
    }
  } else if (q.ask === "pages") {
    const n = q.to;
    const len = numLen(n);
    const before = pageDigits(1, 10 ** (len - 1) - 1);
    add("noOnes", invert(WRONG_COUNTS.noOnes, q.digits));
    add("tensAsOne", invert(WRONG_COUNTS.tensAsOne, q.digits));
    if (q.digits % len === 0) add("divideAll", q.digits / len);
    if (len > 1) add("rangeOnly", (q.digits - before) / len);
    add("offByOne", n + 1);
    add("offByOne", n - 1);
  } else {
    const [ones, tens, hundreds] = rangePlaces(1, q.from, q.to);
    let numbers = 0;
    for (let k = q.from; k <= q.to; k++) if (String(k).includes("1")) numbers++;
    add("numbersOnly", numbers);
    add("onesOnly", ones);
    if (hundreds) add("noHundreds", ones + tens);
    if (q.from > 1) {
      add("offByOne", rangeCount(1, q.from + 1, q.to));
      add("offByOne", rangeCount(1, q.from, q.to - 1));
    }
  }
  return out;
}

// ── 5. Units digit ───────────────────────────────────────────────────────

/** Units digits of b¹, b², … until they repeat: 2 → 2, 4, 8, 6. */
export function unitCycle(b: number): number[] {
  const u = b % 10;
  const out = [u];
  for (let x = (u * u) % 10; x !== u; x = (x * u) % 10) out.push(x);
  return out;
}
/** Units digit of b to the power n (n ≥ 1). */
export function powerUnit(b: number, n: number) {
  const c = unitCycle(b);
  return c[(n - 1) % c.length];
}

/** product: of the factors · power: b^n · sum, times: of two powers. */
export type UnitsKind = "product" | "power" | "sum" | "times";

export interface UnitsQuestion extends Base {
  type: "units";
  kind: UnitsKind;
  factors: number[];
  /** [base, exponent] pairs. */
  powers: [number, number][];
  answer: number;
}

/** Bases whose units digits cycle (not 0, 1, 5, 6). */
const CYCLING = [2, 3, 4, 7, 8, 9, 12, 13, 14, 17, 18, 19, 22, 23, 27, 28, 33, 37];

function exponent(rng: Rng, base: number, lo: number, span: number) {
  // A third of the time the remainder is 0, the place most often missed.
  const L = unitCycle(base).length;
  const n = lo + randInt(rng, span);
  return rng() < 0.35 ? n - (n % L) + (n % L === 0 ? 0 : L) : n;
}

function unitsQuestion(rng: Rng, level: Level, seed: number): UnitsQuestion {
  const base = { type: "units" as const, level, seed };
  if (level === 1) {
    for (;;) {
      const k = rng() < 0.5 ? 2 : 3;
      const factors = Array.from({ length: k }, () => 11 + randInt(rng, 89));
      if (factors.some((f) => [0, 1, 5].includes(f % 10))) continue;
      const answer = factors.reduce((p, f) => (p * f) % 10, 1);
      return { ...base, kind: "product", factors, powers: [], answer };
    }
  }
  if (level === 2) {
    const b = pick(rng, CYCLING);
    const n = exponent(rng, b, 10, 51);
    return { ...base, kind: "power", factors: [], powers: [[b, n]], answer: powerUnit(b, n) };
  }
  const kind: UnitsKind = rng() < 0.5 ? "sum" : "times";
  const [b1, b2] = shuffle(rng, [2, 3, 4, 7, 8, 9]).slice(0, 2);
  const powers: [number, number][] = [
    [b1, exponent(rng, b1, 10, 90)],
    [b2, exponent(rng, b2, 10, 90)],
  ];
  const [u1, u2] = powers.map(([b, n]) => powerUnit(b, n));
  const answer = kind === "sum" ? (u1 + u2) % 10 : (u1 * u2) % 10;
  return { ...base, kind, factors: [], powers, answer };
}

export function unitsSlips(q: UnitsQuestion): [MoreTag, number][] {
  if (q.kind === "product") {
    const us = q.factors.map((f) => f % 10);
    return [
      ["addedUnits", us.reduce((s, u) => s + u, 0) % 10],
      ...(q.factors.length === 3 ? [["missedFactor", (us[0] * us[1]) % 10] as [MoreTag, number]] : []),
    ];
  }
  const mult = q.powers.map(([b, n]) => ((b % 10) * n) % 10);
  const shifted = q.powers.map(([b, n]) => unitCycle(b)[n % unitCycle(b).length]);
  const right = q.powers.map(([b, n]) => powerUnit(b, n));
  if (q.kind === "power")
    return [
      ["multipliedExp", mult[0]],
      ["cyclePos", shifted[0]],
      ["baseOnly", q.powers[0][0] % 10],
    ];
  const join = (a: number, b: number) => (q.kind === "sum" ? a + b : a * b) % 10;
  return [
    ["multipliedExp", join(mult[0], mult[1])],
    ["cyclePos", join(shifted[0], shifted[1])],
    ["cyclePos", join(shifted[0], right[1])],
    ["cyclePos", join(right[0], shifted[1])],
    ["wrongOp", q.kind === "sum" ? (right[0] * right[1]) % 10 : (right[0] + right[1]) % 10],
  ];
}

// ── Together ─────────────────────────────────────────────────────────────

export type MoreQuestion = LcmQuestion | CryptQuestion | SignsQuestion | PagesQuestion | UnitsQuestion;
export type MoreType = MoreQuestion["type"];
export const MORE_TYPES: MoreType[] = ["lcm", "crypt", "signs", "pages", "units"];
export const isMoreType = (t: string): t is MoreType => (MORE_TYPES as string[]).includes(t);

export function makeMoreQuestion(type: MoreType, rng: Rng, level: Level, seed: number): MoreQuestion {
  switch (type) {
    case "lcm":
      return lcmQuestion(rng, level, seed);
    case "crypt":
      return cryptQuestion(rng, level, seed);
    case "signs":
      return signsQuestion(rng, level, seed);
    case "pages":
      return pagesQuestion(rng, level, seed);
    case "units":
      return unitsQuestion(rng, level, seed);
  }
}

/** A question's answer as checked (and written in a link): digits only. */
export function moreAnswerKey(q: MoreQuestion): string {
  if (q.type === "crypt") return q.solution.join("");
  if (q.type === "signs") return q.ops.map((o) => o + 1).join("");
  return String(q.answer);
}

/** Wrong numbers with a known cause (for number answers). */
export function moreSlips(q: MoreQuestion): [MoreTag, number][] {
  if (q.type === "lcm") return lcmSlips(q);
  if (q.type === "pages") return pagesSlips(q);
  if (q.type === "units") return unitsSlips(q);
  return [];
}

export function moreMistake(q: MoreQuestion, value: string): MoreTag {
  if (value === moreAnswerKey(q)) return "right";
  if (q.type === "crypt") return cryptMistake(q, value);
  if (q.type === "signs") return signsMistake(q, value);
  if (!/^\d+$/.test(value)) return "other";
  const v = Number(value);
  if (q.type === "lcm") return lcmMistake(q, v);
  for (const [tag, s] of moreSlips(q)) if (s !== q.answer && v === s) return tag;
  return "other";
}
