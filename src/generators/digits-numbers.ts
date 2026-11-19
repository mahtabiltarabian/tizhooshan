// Tool 13, two number-sense topics: primes and divisors, and reasoning with
// odd and even. As in digits-more.ts, every question has one right answer and
// every usual slip has a tag, so the feedback can name what went wrong.
//
// Some answers are a choice, written as a digit: 1 = «بله» or «زوج»,
// 2 = «نه» or «فرد». A prime factorisation is written as its primes, smallest
// first, joined by dots: 2.2.3.7.
//
// Only types come from digits.ts, so the modules do not load each other.

import type { Level } from "./digits";
import { pick, randInt, type Rng } from "./random";

interface Base {
  level: Level;
  seed: number;
}

export type NumberTag =
  // primes and divisors
  | "oneIsPrime"
  | "twoEven"
  | "primeNo"
  | "missedDivisor"
  | "stoppedEarly"
  | "noEnds"
  | "oneEnd"
  | "rootTwice"
  | "halfOnly"
  | "expProduct"
  | "expSum"
  | "noSelf"
  | "noOne"
  | "countNotSum"
  | "primePower"
  | "notSmallest"
  | "countIs"
  | "productWrong"
  | "notPrimeFactor"
  // odd and even
  | "oddPlusOdd"
  | "evenPlusOdd"
  | "evenPlusEven"
  | "timesEven"
  | "oddTimesOdd"
  | "ignoredCount"
  | "oddSumOdd"
  | "countedAll"
  | "lastOnly"
  | "handshakeOdd"
  | "dominoOdd"
  | "sameColour"
  | "cupsOdd"
  | "signsParity"
  | "notImpossible";

/** Choice answers. */
export const YES = 1;
export const NO = 2;
export const EVEN = 1;
export const ODD = 2;

// ── Number helpers ───────────────────────────────────────────────────────

export const divisors = (n: number) => {
  const small: number[] = [];
  const big: number[] = [];
  for (let d = 1; d * d <= n; d++)
    if (n % d === 0) {
      small.push(d);
      if (d * d !== n) big.unshift(n / d);
    }
  return [...small, ...big];
};
export const divisorCount = (n: number) => divisors(n).length;
export const divisorSum = (n: number) => divisors(n).reduce((s, d) => s + d, 0);
export const isPrime = (n: number) => n > 1 && divisorCount(n) === 2;
export const isSquare = (n: number) => Number.isInteger(Math.sqrt(n));
/** The largest whole number whose square is at most n. */
export const rootFloor = (n: number) => Math.floor(Math.sqrt(n) + 1e-9);

/** Prime factors, smallest first, with repeats: 84 → 2, 2, 3, 7. */
export function primeFactors(n: number): number[] {
  const out: number[] = [];
  for (let p = 2, m = n; m > 1; p++) while (m % p === 0) {
    out.push(p);
    m /= p;
  }
  return out;
}
/** [prime, exponent] pairs: 84 → [2, 2], [3, 1], [7, 1]. */
export function primePowers(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (const p of primeFactors(n)) {
    const last = out[out.length - 1];
    if (last && last[0] === p) last[1]++;
    else out.push([p, 1]);
  }
  return out;
}
export const smallestFactor = (n: number) => primeFactors(n)[0];
/** The smallest number with exactly k divisors. */
export function smallestWith(k: number) {
  for (let n = 1; ; n++) if (divisorCount(n) === k) return n;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ── 1. Primes and divisors ──────────────────────────────────────────────

/**
 * isPrime: is n prime (a choice) · count: how many divisors · smallest: the
 * smallest number with k divisors · factor: n as a product of primes ·
 * sum: the sum of the divisors.
 */
export type PrimeAsk = "isPrime" | "count" | "smallest" | "factor" | "sum";

export interface PrimeQuestion extends Base {
  type: "prime";
  ask: PrimeAsk;
  /** The number asked about (smallest: the answer). */
  n: number;
  /** smallest: the number of divisors wanted (0 otherwise). */
  k: number;
  /** A number; isPrime: YES or NO; factor: n. */
  answer: number;
}

/** Odd numbers that are not prime and have no factor 2, 3 or 5 (from `lo` to `hi`). */
const hardComposites = (lo: number, hi: number, minFactor: number) => range(lo, hi).filter((n) => n % 2 && !isPrime(n) && smallestFactor(n) >= minFactor);

const L1_PRIMES = range(3, 59).filter(isPrime);
const L1_ODD_COMPOSITES = range(9, 59).filter((n) => n % 2 && !isPrime(n));
const L2_PRIMES = range(61, 199).filter(isPrime);
const L2_HARD = hardComposites(61, 199, 7);
const L2_THREES = range(61, 199).filter((n) => n % 2 && n % 3 === 0 && n % 5 !== 0);
const L3_PRIMES = range(200, 400).filter(isPrime);
const L3_HARD = hardComposites(200, 400, 7);

function isPrimeQuestion(rng: Rng, level: Level, seed: number): PrimeQuestion {
  let n: number;
  const r = rng();
  if (level === 1) n = r < 0.08 ? 1 : r < 0.16 ? 2 : r < 0.55 ? pick(rng, L1_PRIMES) : pick(rng, L1_ODD_COMPOSITES);
  else if (level === 2) n = r < 0.45 ? pick(rng, L2_PRIMES) : r < 0.78 ? pick(rng, L2_HARD) : pick(rng, L2_THREES);
  else n = r < 0.45 ? pick(rng, L3_PRIMES) : pick(rng, L3_HARD);
  return { type: "prime", level, seed, ask: "isPrime", n, k: 0, answer: isPrime(n) ? YES : NO };
}

const L2_SQUARES = [36, 64, 81, 100];

function countQuestion(rng: Rng, level: Level, seed: number): PrimeQuestion {
  const base = { type: "prime" as const, level, seed, ask: "count" as const, k: 0 };
  if (level === 1) {
    for (;;) {
      const n = 12 + randInt(rng, 37);
      if (divisorCount(n) >= 4) return { ...base, n, answer: divisorCount(n) };
    }
  }
  if (level === 2) {
    if (rng() < 0.3) {
      const n = pick(rng, L2_SQUARES);
      return { ...base, n, answer: divisorCount(n) };
    }
    for (;;) {
      const n = 40 + randInt(rng, 61);
      if (divisorCount(n) >= 6 && !isSquare(n)) return { ...base, n, answer: divisorCount(n) };
    }
  }
  // Level 3: a bigger number made of 2, 3, 5 and 7, counted from its factors.
  for (;;) {
    const n = 2 ** randInt(rng, 5) * 3 ** randInt(rng, 4) * 5 ** randInt(rng, 3) * 7 ** randInt(rng, 2);
    if (n < 100 || n > 500 || primePowers(n).length < 2 || divisorCount(n) < 8) continue;
    return { ...base, n, answer: divisorCount(n) };
  }
}

/** Divisor counts asked for, with their smallest numbers small enough to list. */
const SMALLEST_K: Record<2 | 3, number[]> = { 2: [3, 4, 5, 6, 8], 3: [7, 9, 10, 12] };

function smallestQuestion(rng: Rng, level: 2 | 3, seed: number): PrimeQuestion {
  const k = pick(rng, SMALLEST_K[level]);
  const n = smallestWith(k);
  return { type: "prime", level, seed, ask: "smallest", n, k, answer: n };
}

const FACTOR_POOL = [2, 2, 2, 3, 3, 3, 5, 5, 7, 7, 11, 13];

function factorQuestion(rng: Rng, seed: number): PrimeQuestion {
  for (;;) {
    const k = 3 + randInt(rng, 3);
    const fs = Array.from({ length: k }, () => pick(rng, FACTOR_POOL)).sort((a, b) => a - b);
    const n = fs.reduce((p, x) => p * x, 1);
    if (n < 60 || n > 700 || new Set(fs).size === fs.length || new Set(fs).size === 1) continue;
    return { type: "prime", level: 3, seed, ask: "factor", n, k: 0, answer: n };
  }
}

function sumQuestion(rng: Rng, seed: number): PrimeQuestion {
  const base = { type: "prime" as const, level: 3 as const, seed, ask: "sum" as const, k: 0 };
  if (rng() < 0.3) {
    const n = pick(rng, [16, 36, 49, 64, 81, 100]);
    return { ...base, n, answer: divisorSum(n) };
  }
  for (;;) {
    const n = 12 + randInt(rng, 89);
    if (divisorCount(n) >= 4 && !isSquare(n)) return { ...base, n, answer: divisorSum(n) };
  }
}

function primeQuestion(rng: Rng, level: Level, seed: number): PrimeQuestion {
  const r = rng();
  if (level === 1) return r < 0.5 ? isPrimeQuestion(rng, 1, seed) : countQuestion(rng, 1, seed);
  if (level === 2) return r < 0.3 ? isPrimeQuestion(rng, 2, seed) : r < 0.65 ? countQuestion(rng, 2, seed) : smallestQuestion(rng, 2, seed);
  if (r < 0.3) return factorQuestion(rng, seed);
  if (r < 0.5) return sumQuestion(rng, seed);
  if (r < 0.65) return countQuestion(rng, 3, seed);
  if (r < 0.82) return smallestQuestion(rng, 3, seed);
  return isPrimeQuestion(rng, 3, seed);
}

/** Wrong answers with a known cause, first cause first; a value already named, or the answer, is left out. */
function dedupe(q: { answer: number }, xs: [NumberTag, number][]): [NumberTag, number][] {
  const seen = new Set<number>([q.answer]);
  return xs.filter(([, v]) => {
    if (v < 0 || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

export function primeSlips(q: PrimeQuestion): [NumberTag, number][] {
  const n = q.n;
  switch (q.ask) {
    case "isPrime":
      if (n === 1) return [["oneIsPrime", YES]];
      if (n === 2) return [["twoEven", NO]];
      if (isPrime(n)) return [["primeNo", NO]];
      return [[smallestFactor(n) >= 7 ? "stoppedEarly" : "missedDivisor", YES]];
    case "count": {
      const c = q.answer;
      const pw = primePowers(n);
      // Level 3 is counted from the factors, so those slips come first.
      const fromFactors: [NumberTag, number][] =
        q.level === 3
          ? [
              ["expProduct", pw.reduce((p, [, e]) => p * e, 1)],
              ["expSum", pw.reduce((s, [, e]) => s + e + 1, 0)],
            ]
          : [];
      return dedupe(q, [
        ...(isSquare(n) ? [["rootTwice", c + 1] as [NumberTag, number]] : []),
        ...fromFactors,
        ["noEnds", c - 2],
        ["oneEnd", c - 1],
        ["halfOnly", divisors(n).filter((d) => d * d <= n).length],
      ]);
    }
    case "sum": {
      const s = q.answer;
      return dedupe(q, [
        ...(isSquare(n) ? [["rootTwice", s + Math.sqrt(n)] as [NumberTag, number]] : []),
        ["noSelf", s - n],
        ["noOne", s - 1],
        ["noEnds", s - 1 - n],
        ["countNotSum", divisorCount(n)],
      ]);
    }
    case "smallest":
      return dedupe(q, [["primePower", 2 ** (q.k - 1)]]);
    case "factor":
      return [];
  }
}

/** A written factorisation ("2.2.3.7", any order) as numbers, or null. */
export const readFactors = (v: string) => (/^\d+(\.\d+)*$/.test(v) ? v.split(".").map(Number) : null);

function primeMistake(q: PrimeQuestion, value: string): NumberTag | "right" | "other" {
  if (q.ask === "factor") {
    const fs = readFactors(value);
    if (!fs) return "other";
    if (fs.slice().sort((a, b) => a - b).join(".") === primeFactors(q.n).join(".")) return "right";
    if (fs.reduce((p, x) => p * x, 1) !== q.n) return "productWrong";
    if (fs.includes(1)) return "oneIsPrime";
    if (fs.some((x) => !isPrime(x))) return "notPrimeFactor";
    return "other";
  }
  if (!/^\d+$/.test(value)) return "other";
  const v = Number(value);
  if (v === q.answer) return "right";
  for (const [tag, s] of primeSlips(q)) if (v === s) return tag;
  if (q.ask === "smallest" && v > 0 && v <= 100_000) return divisorCount(v) === q.k ? "notSmallest" : "countIs";
  return "other";
}

// ── 2. Odd and even ──────────────────────────────────────────────────────

/**
 * expr: is a + b (a − b, a × b) even or odd · rule: the same with only "odd"
 * and "even" given · oddSum: can k odd numbers add up to T · mixed: a odd
 * and b even numbers added · seq: the parity of a run of numbers added ·
 * handshake, domino, cups, signs: is it possible at all?
 */
export type ParityAsk = "expr" | "rule" | "oddSum" | "mixed" | "seq" | "handshake" | "domino" | "cups" | "signs";

export interface ParityQuestion extends Base {
  type: "parity";
  ask: ParityAsk;
  /**
   * expr: the numbers · rule: 0 even, 1 odd, per term · oddSum: [k] ·
   * mixed: [odd numbers, even numbers] · seq: [first, last, step] ·
   * handshake: [people, each] · domino: [rows, columns] · cups: [cups, upright] · signs: [n].
   */
  nums: number[];
  /** expr, rule: 0 +, 1 −, 2 ×. */
  op: number;
  /** oddSum, signs: the total asked for. */
  target: number;
  /** oddSum, handshake: the story · domino: 0 whole board, 1 a corner cut, 2 two opposite corners cut. */
  variant: number;
  /** EVEN or ODD; YES or NO. */
  answer: number;
  /** signs, when possible: a sign before each number from the second (0 +, 1 −). */
  witness: number[];
}

/** A parity question asks "even or odd?" or "possible?". */
export const parityChoice = (q: ParityQuestion): "parity" | "yesno" => (["expr", "rule", "mixed", "seq"].includes(q.ask) ? "parity" : "yesno");

/** The terms of a run: first, first + step, … up to last. */
export const seqTerms = (q: ParityQuestion) => {
  const [a, b, st] = q.nums;
  return Array.from({ length: (b - a) / st + 1 }, (_, i) => a + i * st);
};

const parityOf = (n: number) => (n % 2 === 0 ? EVEN : ODD);
const other = (c: number) => 3 - c;

function exprValue(nums: number[], op: number) {
  return op === 0 ? nums.reduce((s, x) => s + x, 0) : op === 1 ? nums[0] - nums[1] : nums.reduce((p, x) => p * x, 1);
}

function parityQuestion(rng: Rng, level: Level, seed: number): ParityQuestion {
  const base = { type: "parity" as const, level, seed, op: 0, target: 0, variant: 0, witness: [] as number[] };
  const r = rng();
  if (level === 1) {
    if (r < 0.5) {
      const op = randInt(rng, 3);
      for (;;) {
        const nums = [10 + randInt(rng, 90), 10 + randInt(rng, 90)];
        if (op === 1 && nums[0] <= nums[1]) continue;
        if (nums[0] === nums[1]) continue;
        return { ...base, ask: "expr", nums, op, answer: parityOf(exprValue(nums, op)) };
      }
    }
    // Words only: «الف فرد و ب زوج است».
    const op = randInt(rng, 3);
    const k = op !== 1 && rng() < 0.3 ? 3 : 2;
    const nums = Array.from({ length: k }, () => randInt(rng, 2));
    const odd = nums.filter((x) => x === 1).length;
    const answer = op === 2 ? (odd === k ? ODD : EVEN) : odd % 2 ? ODD : EVEN;
    return { ...base, ask: "rule", nums, op, answer };
  }
  if (level === 2) {
    if (r < 0.35) {
      const k = 3 + randInt(rng, 7);
      const yes = rng() < 0.45;
      for (;;) {
        const target = Math.max(k + 1, 10) + randInt(rng, 50);
        if ((target % 2 === k % 2) !== yes) continue;
        return { ...base, ask: "oddSum", nums: [k], target, variant: randInt(rng, 3), answer: yes ? YES : NO };
      }
    }
    if (r < 0.6) {
      const nums = [2 + randInt(rng, 11), 1 + randInt(rng, 9)];
      return { ...base, ask: "mixed", nums, answer: parityOf(nums[0]) };
    }
    const v = randInt(rng, 3);
    const nums = v === 0 ? [1, 8 + randInt(rng, 33), 1] : v === 1 ? (() => {
      const a = 5 + randInt(rng, 26);
      return [a, a + 5 + randInt(rng, 20), 1];
    })() : [1, 2 * (5 + randInt(rng, 16)) - 1, 2];
    const q = { ...base, ask: "seq" as const, nums, variant: v, answer: EVEN };
    return { ...q, answer: parityOf(seqTerms(q).reduce((s, x) => s + x, 0)) };
  }
  // Level 3: is it possible?
  const no = rng() < 0.55;
  if (r < 0.25) {
    for (;;) {
      const n = 5 + randInt(rng, 7);
      const k = 1 + randInt(rng, n - 1);
      if (((n * k) % 2 === 1) !== no || (!no && k < 2)) continue;
      return { ...base, ask: "handshake", nums: [n, k], variant: randInt(rng, 2), answer: no ? NO : YES };
    }
  }
  if (r < 0.5) {
    for (;;) {
      const a = 3 + randInt(rng, 5);
      const b = a + randInt(rng, 9 - a);
      const variant = randInt(rng, 3);
      const cells = a * b - variant;
      // Two opposite corners have the same colour only when both sides are even.
      if (variant === 2 && (a % 2 || b % 2)) continue;
      const possible = variant !== 2 && cells % 2 === 0;
      if (possible === no) continue;
      return { ...base, ask: "domino", nums: [a, b], variant, answer: possible ? YES : NO };
    }
  }
  if (r < 0.75) {
    const n = 5 + randInt(rng, 8);
    for (;;) {
      const u = 1 + randInt(rng, n);
      if ((u % 2 === 1) !== no) continue;
      return { ...base, ask: "cups", nums: [n, u], answer: no ? NO : YES };
    }
  }
  const n = 4 + randInt(rng, 6);
  const S = (n * (n + 1)) / 2;
  const reach = signsReach(n);
  for (;;) {
    const target = randInt(rng, S - 1);
    if ((target % 2 !== S % 2) !== no) continue;
    if (!no && !reach.has(target)) continue;
    return { ...base, ask: "signs", nums: [n], target, answer: no ? NO : YES, witness: no ? [] : reach.get(target)! };
  }
}

/** Every total of 1 ± 2 ± … ± n, with the first way (signs before 2 … n) found. */
export function signsReach(n: number): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (let m = 0; m < 2 ** (n - 1); m++) {
    const signs = Array.from({ length: n - 1 }, (_, i) => (m >> (n - 2 - i)) & 1);
    const t = signs.reduce((s, x, i) => s + (x ? -(i + 2) : i + 2), 1);
    if (!out.has(t)) out.set(t, signs);
  }
  return out;
}

/** The tag of the one wrong choice. */
export function parityWrongTag(q: ParityQuestion): NumberTag {
  switch (q.ask) {
    case "expr":
    case "rule": {
      const odd = q.ask === "rule" ? q.nums.filter((x) => x === 1).length : q.nums.filter((x) => x % 2).length;
      const k = q.nums.length;
      if (q.op === 2) return odd === k ? "oddTimesOdd" : "timesEven";
      if (k > 2) return "ignoredCount";
      return odd === 2 ? "oddPlusOdd" : odd === 1 ? "evenPlusOdd" : "evenPlusEven";
    }
    case "oddSum":
      return q.answer === NO ? "ignoredCount" : "oddSumOdd";
    case "mixed":
      // Counting every number, not only the odd ones, gives the other answer when the evens are odd in number.
      return q.nums[1] % 2 ? "countedAll" : "ignoredCount";
    case "seq": {
      const t = seqTerms(q);
      const wrong = other(q.answer);
      if (parityOf(t[t.length - 1]) === wrong) return "lastOnly";
      if (parityOf(t.length) === wrong) return "countedAll";
      return "ignoredCount";
    }
    case "handshake":
      return q.answer === NO ? "handshakeOdd" : "notImpossible";
    case "domino":
      return q.answer === YES ? "notImpossible" : q.variant === 2 ? "sameColour" : "dominoOdd";
    case "cups":
      return q.answer === NO ? "cupsOdd" : "notImpossible";
    case "signs":
      return q.answer === NO ? "signsParity" : "notImpossible";
  }
}

export const paritySlips = (q: ParityQuestion): [NumberTag, number][] => [[parityWrongTag(q), other(q.answer)]];

function parityMistake(q: ParityQuestion, value: string): NumberTag | "right" | "other" {
  if (value === String(q.answer)) return "right";
  if (value === String(other(q.answer))) return parityWrongTag(q);
  return "other";
}

// ── Together ─────────────────────────────────────────────────────────────

export type NumberQuestion = PrimeQuestion | ParityQuestion;
export type NumberType = NumberQuestion["type"];
export const NUMBER_TYPES: NumberType[] = ["prime", "parity"];

export function makeNumberQuestion(type: NumberType, rng: Rng, level: Level, seed: number): NumberQuestion {
  return type === "prime" ? primeQuestion(rng, level, seed) : parityQuestion(rng, level, seed);
}

/** How the answer is given: a number, a choice of two, or a product of primes. */
export function numberAnswerKind(q: NumberQuestion): "number" | "choice" | "factors" {
  if (q.type === "parity") return "choice";
  return q.ask === "isPrime" ? "choice" : q.ask === "factor" ? "factors" : "number";
}

export const numberAnswerKey = (q: NumberQuestion) => (q.type === "prime" && q.ask === "factor" ? primeFactors(q.n).join(".") : String(q.answer));

export const numberSlips = (q: NumberQuestion) => (q.type === "prime" ? primeSlips(q) : paritySlips(q));

export const numberMistake = (q: NumberQuestion, value: string) => (q.type === "prime" ? primeMistake(q, value) : parityMistake(q, value));

/** The two choices' words, for a choice answer: [choice 1, choice 2]. */
export function choiceWords(q: NumberQuestion): [string, string] {
  if (q.type === "prime") return ["بله، اول است", "نه، اول نیست"];
  return parityChoice(q) === "parity" ? ["زوج", "فرد"] : ["بله، ممکن است", "نه، ممکن نیست"];
}
