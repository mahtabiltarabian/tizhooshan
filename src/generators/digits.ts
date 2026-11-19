// Tool 13: digits. Numbers built from digit cards, counting a digit from 1 to
// n, digit sums, divisibility and matchstick equations. Each question keeps
// its one right answer, and a mistake function names the usual slip (a
// leading zero, a forgotten condition, 11 counted once…) so the feedback can.
//
// Matchsticks: digits are the Western seven-segment shapes that Iranian
// puzzle books use for matchstick puzzles (Persian digit shapes do not fit
// seven segments: ۲, ۳, ۴ and ۶ have no stick form). Segments are bits:
//
//    a            a = 1, b = 2, c = 4, d = 8, e = 16, f = 32, g = 64
//  f   b
//    g            6 has its top stick and 9 its bottom stick (6 sticks each);
//  e   c          7 is three sticks (a, b, c), as in the books.
//    d
//
// "+" is two sticks (h = 1, v = 2), "−" is one (h). "=" is two sticks that
// never move, so an equation always reads A ± B = C. Every slot must stay a
// digit or a sign: no digit may vanish and no new slot appears.

import { isMoreType, makeMoreQuestion, moreAnswerKey, moreMistake, moreSlips, type MoreQuestion, type MoreTag, type MoreType } from "./digits-more";
import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type DigitsQuestionType = "extreme" | "condition" | "count" | "digitSum" | "divisible" | "match" | MoreType;

// ── Small number helpers ─────────────────────────────────────────────────

export const digitsOf = (n: number) => String(n).split("").map(Number);
export const digitSum = (n: number) => digitsOf(n).reduce((s, d) => s + d, 0);
const distinct = (n: number) => new Set(String(n)).size === String(n).length;

/** Place names from the right: ones, tens, hundreds, … */
export const PLACE_NAMES = ["یکان", "دهگان", "صدگان", "هزارگان", "ده‌هزارگان"];

/** How many times digit d is written in 1, 2, …, n, by place (ones first). */
export function placeCounts(d: number, n: number): number[] {
  const out = [0, 0, 0, 0];
  for (let k = 1; k <= n; k++) {
    let m = k;
    for (let p = 0; m > 0; p++, m = Math.floor(m / 10)) if (m % 10 === d) out[p]++;
  }
  return out;
}

export const countDigit = (d: number, n: number) => placeCounts(d, n).reduce((s, x) => s + x, 0);

/** How many of 1 … n contain d at least once (the "counted 11 once" slip). */
export function numbersWith(d: number, n: number) {
  let c = 0;
  for (let k = 1; k <= n; k++) if (String(k).includes(String(d))) c++;
  return c;
}

// ── Conditions ───────────────────────────────────────────────────────────

export type Cond = "even" | "odd" | "div3" | "div4" | "div5" | "div6" | "div9";

export function meets(n: number, c: Cond) {
  switch (c) {
    case "even":
      return n % 2 === 0;
    case "odd":
      return n % 2 === 1;
    case "div3":
      return n % 3 === 0;
    case "div4":
      return n % 4 === 0;
    case "div5":
      return n % 5 === 0;
    case "div6":
      return n % 6 === 0;
    case "div9":
      return n % 9 === 0;
  }
}

/** Every number made from `use` of the cards (each card once, no leading zero). */
export function buildAll(cards: number[], use: number): number[] {
  const out = new Set<number>();
  const used = cards.map(() => false);
  const walk = (s: string) => {
    if (s.length === use) return void out.add(Number(s));
    cards.forEach((c, i) => {
      if (used[i] || (s === "" && c === 0 && use > 1)) return;
      used[i] = true;
      walk(s + c);
      used[i] = false;
    });
  };
  walk("");
  return [...out];
}

/** Largest and smallest number from all the cards; `zeroFirst` is the smallest if a leading zero were allowed. */
export function extremes(cards: number[]) {
  const down = [...cards].sort((a, b) => b - a);
  const up = [...cards].sort((a, b) => a - b);
  const max = Number(down.join(""));
  const firstNonZero = up.findIndex((d) => d !== 0);
  const minDigits = [up[firstNonZero], ...up.slice(0, firstNonZero), ...up.slice(firstNonZero + 1)];
  return { max, min: Number(minDigits.join("")), zeroFirst: up.join("") };
}

// ── Questions ────────────────────────────────────────────────────────────

interface Base {
  level: Level;
  seed: number;
}

/** Build the largest or smallest number from the cards, or (level 3) their difference. */
export interface ExtremeQuestion extends Base {
  type: "extreme";
  cards: number[];
  want: "max" | "min" | "diff";
  answer: number;
}

/** Largest or smallest number from `use` of the cards that meets a condition. */
export interface ConditionQuestion extends Base {
  type: "condition";
  cards: number[];
  use: number;
  want: "max" | "min";
  cond: Cond;
  answer: number;
}

export interface CountQuestion extends Base {
  type: "count";
  digit: number;
  n: number;
  answer: number;
}

/**
 * min: smallest number with digit sum s · min4: smallest four-digit one ·
 * max4distinct: largest four-digit one with no digit repeated · minDistinct: smallest with no digit repeated.
 */
export interface DigitSumQuestion extends Base {
  type: "digitSum";
  variant: "min" | "min4" | "max4distinct" | "minDistinct";
  sum: number;
  answer: number;
}

/** A number with one box; which digit (or the largest or smallest one) makes it divisible? */
export interface DivisibleQuestion extends Base {
  type: "divisible";
  /** Digits left to right; null is the box. */
  digits: (number | null)[];
  divisor: number;
  want: "only" | "max" | "min";
  /** Every digit that works. */
  valid: number[];
  answer: number;
}

export interface MatchQuestion extends Base {
  type: "match";
  /** Digits in A, B and C. */
  lens: [number, number, number];
  moves: 1 | 2;
  /** Sticks of each slot (A digits, sign, B digits, "=", C digits). */
  start: number[];
  /** The one true equation `moves` moves away. */
  answer: number[];
}

export type DigitsQuestion = ExtremeQuestion | ConditionQuestion | CountQuestion | DigitSumQuestion | DivisibleQuestion | MatchQuestion | MoreQuestion;

/** One of the five later topics (digits-more.ts)? */
export const isMore = (q: DigitsQuestion): q is MoreQuestion => isMoreType(q.type);

/** How a question is answered: arranging the cards, a number on the pad, moving matchsticks, a digit for each letter, or a sign in each gap. */
export function answerKind(q: DigitsQuestion): "cards" | "number" | "match" | "letters" | "ops" {
  if (q.type === "match") return "match";
  if (q.type === "crypt") return "letters";
  if (q.type === "signs") return "ops";
  if (q.type === "condition" || (q.type === "extreme" && q.want !== "diff")) return "cards";
  return "number";
}

/** A question's answer as the string an answer is checked in (and written in a link). */
export const answerKey = (q: DigitsQuestion) => (isMore(q) ? moreAnswerKey(q) : q.type === "match" ? q.answer.join(".") : String(q.answer));

/** Distinct digits, avoiding `not`. */
function distinctDigits(rng: Rng, k: number, from: number[]) {
  return shuffle(rng, from).slice(0, k);
}

function extremeQuestion(rng: Rng, level: Level, seed: number): ExtremeQuestion {
  if (level === 1) {
    const cards = distinctDigits(rng, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const want = rng() < 0.5 ? "max" : "min";
    const e = extremes(cards);
    return { type: "extreme", level, seed, cards, want, answer: want === "max" ? e.max : e.min };
  }
  // A zero among the cards: the smallest number cannot start with it.
  const cards = shuffle(rng, [0, ...distinctDigits(rng, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9])]);
  const e = extremes(cards);
  if (level === 2) {
    const want = rng() < 0.65 ? "min" : "max";
    return { type: "extreme", level, seed, cards, want, answer: want === "max" ? e.max : e.min };
  }
  return { type: "extreme", level, seed, cards, want: "diff", answer: e.max - e.min };
}

const CONDS: Record<Level, Cond[]> = { 1: ["even", "odd"], 2: ["even", "odd", "div5", "div4"], 3: ["div3", "div9", "div6", "div4"] };

/** Best number for a condition question, by trying every arrangement. */
export function bestBuilt(cards: number[], use: number, cond: Cond | null, want: "max" | "min") {
  const ok = buildAll(cards, use).filter((n) => cond === null || meets(n, cond));
  if (!ok.length) return null;
  return want === "max" ? Math.max(...ok) : Math.min(...ok);
}

function conditionQuestion(rng: Rng, level: Level, seed: number): ConditionQuestion {
  for (;;) {
    const k = level === 1 ? 3 : level === 2 ? 4 : 5;
    const use = level === 3 ? 4 : k;
    const zero = level > 1 && rng() < 0.5;
    const cards = shuffle(rng, zero ? [0, ...distinctDigits(rng, k - 1, [1, 2, 3, 4, 5, 6, 7, 8, 9])] : distinctDigits(rng, k, [1, 2, 3, 4, 5, 6, 7, 8, 9]));
    const cond = pick(rng, CONDS[level]);
    const want = rng() < 0.55 ? "max" : "min";
    const answer = bestBuilt(cards, use, cond, want);
    // The condition must matter: plain largest (smallest) is not the answer.
    if (answer === null || answer === bestBuilt(cards, use, null, want)) continue;
    return { type: "condition", level, seed, cards, use, want, cond, answer };
  }
}

function countQuestion(rng: Rng, level: Level, seed: number): CountQuestion {
  const digit = 1 + randInt(rng, 9);
  let n: number;
  // Level 1 reaches dd (11, 22, …) so a number holds the digit twice.
  if (level === 1) n = 11 * digit + randInt(rng, 101 - 11 * digit);
  else if (level === 2) n = 100 + randInt(rng, 401);
  else n = rng() < 0.25 ? 1000 : 500 + randInt(rng, 500);
  return { type: "count", level, seed, digit, n, answer: countDigit(digit, n) };
}

// Answers found by trying numbers in order; worked out once per sum.
const cache = new Map<string, number>();
function firstFrom(key: string, from: number, to: number, step: number, ok: (n: number) => boolean) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  for (let n = from; n !== to; n += step)
    if (ok(n)) {
      cache.set(key, n);
      return n;
    }
  return -1;
}

export function digitSumAnswer(variant: DigitSumQuestion["variant"], s: number): number {
  switch (variant) {
    case "min": {
      // Fewest digits, the 9s at the end: the first digit takes what is left.
      const k = Math.ceil(s / 9);
      return Number(String(s - 9 * (k - 1)) + "9".repeat(k - 1));
    }
    case "min4":
      return firstFrom(`min4-${s}`, 1000, 10000, 1, (n) => digitSum(n) === s);
    case "max4distinct":
      return firstFrom(`max4d-${s}`, 9999, 999, -1, (n) => digitSum(n) === s && distinct(n));
    case "minDistinct":
      return firstFrom(`mind-${s}`, 1, 1_000_000, 1, (n) => digitSum(n) === s && distinct(n));
  }
}

function digitSumQuestion(rng: Rng, level: Level, seed: number): DigitSumQuestion {
  let variant: DigitSumQuestion["variant"];
  let sum: number;
  if (level === 1) [variant, sum] = ["min", 10 + randInt(rng, 9)];
  else if (level === 2) [variant, sum] = rng() < 0.5 ? ["min4", 5 + randInt(rng, 26)] : ["max4distinct", 8 + randInt(rng, 23)];
  else [variant, sum] = ["minDistinct", 16 + randInt(rng, 15)];
  return { type: "digitSum", level, seed, variant, sum, answer: digitSumAnswer(variant, sum) };
}

const DIVISORS: Record<Level, number[]> = { 1: [3, 9], 2: [4, 6, 9], 3: [12, 15, 18, 36] };

/** Digits that fill the box so the number is divisible (no leading zero). */
export function fillers(digits: (number | null)[], divisor: number) {
  const out: number[] = [];
  for (let d = 0; d <= 9; d++) {
    if (d === 0 && digits[0] === null) continue;
    if (Number(digits.map((x) => x ?? d).join("")) % divisor === 0) out.push(d);
  }
  return out;
}

function divisibleQuestion(rng: Rng, level: Level, seed: number): DivisibleQuestion {
  for (;;) {
    const len = level === 1 ? 3 : level === 2 ? 4 : 4 + randInt(rng, 2);
    const divisor = pick(rng, DIVISORS[level]);
    const digits: (number | null)[] = Array.from({ length: len }, (_, i) => (i === 0 ? 1 + randInt(rng, 9) : randInt(rng, 10)));
    // For 4, only the last two digits matter: keep the box there.
    const box = divisor % 4 === 0 ? len - 1 - randInt(rng, 2) : randInt(rng, len);
    digits[box] = null;
    const valid = fillers(digits, divisor);
    if (!valid.length) continue;
    const want = valid.length === 1 ? "only" : rng() < 0.6 ? "max" : "min";
    return { type: "divisible", level, seed, digits, divisor, want, valid, answer: want === "min" ? valid[0] : valid[valid.length - 1] };
  }
}

// ── Matchsticks ──────────────────────────────────────────────────────────

export const SEG = { a: 1, b: 2, c: 4, d: 8, e: 16, f: 32, g: 64 } as const;
export const DIGIT_STICKS = [63, 6, 91, 79, 102, 109, 125, 7, 127, 111];
export const PLUS = 3;
export const MINUS = 1;
export const EQUALS = 3;

export type SlotKind = "digit" | "lead" | "sign" | "equals";

/** Slot kinds of an equation with A, B, C of the given lengths; "lead" is a first digit that cannot be 0. */
export function slotKinds(lens: [number, number, number]): SlotKind[] {
  const num = (k: number): SlotKind[] => Array.from({ length: k }, (_, i) => (i === 0 && k > 1 ? "lead" : "digit"));
  return [...num(lens[0]), "sign", ...num(lens[1]), "equals", ...num(lens[2])];
}

export const bitCount = (m: number) => {
  let c = 0;
  for (let x = m; x; x &= x - 1) c++;
  return c;
};

/** The digit (or sign) a slot shows, or null if its sticks are no digit. */
export function glyphOf(kind: SlotKind, mask: number): string | null {
  if (kind === "equals") return mask === EQUALS ? "=" : null;
  if (kind === "sign") return mask === PLUS ? "+" : mask === MINUS ? "−" : null;
  const d = DIGIT_STICKS.indexOf(mask);
  if (d < 0 || (kind === "lead" && d === 0)) return null;
  return String(d);
}

/** What the sticks say: the numbers and sign, or null if some slot is no digit or sign. */
export function readEquation(lens: [number, number, number], masks: number[]) {
  const kinds = slotKinds(lens);
  const g = kinds.map((k, i) => glyphOf(k, masks[i]));
  if (g.some((x) => x === null)) return null;
  const a = Number(g.slice(0, lens[0]).join(""));
  const sign = g[lens[0]] as "+" | "−";
  const b = Number(g.slice(lens[0] + 1, lens[0] + 1 + lens[1]).join(""));
  const c = Number(g.slice(lens[0] + lens[1] + 2).join(""));
  const value = sign === "+" ? a + b : a - b;
  return { a, sign, b, c, value, holds: value === c };
}

/** Sticks taken away from `from` and added to make `to`, over all slots. */
export function stickDiff(from: number[], to: number[]) {
  let removed = 0;
  let added = 0;
  from.forEach((m, i) => {
    removed += bitCount(m & ~to[i]);
    added += bitCount(to[i] & ~m);
  });
  return { removed, added };
}

/** Every stick shape a slot may take. */
function shapesFor(kind: SlotKind): number[] {
  if (kind === "equals") return [EQUALS];
  if (kind === "sign") return [PLUS, MINUS];
  return DIGIT_STICKS.filter((_, d) => !(kind === "lead" && d === 0));
}

/** Every readable arrangement exactly k moves away (k sticks lifted, k put down elsewhere). */
export function movesAway(lens: [number, number, number], masks: number[], k: number): number[][] {
  const kinds = slotKinds(lens);
  const out: number[][] = [];
  const cur: number[] = [];
  const walk = (i: number, r: number, a: number) => {
    if (i === kinds.length) {
      if (r === k && a === k) out.push([...cur]);
      return;
    }
    for (const m of shapesFor(kinds[i])) {
      const rr = r + bitCount(masks[i] & ~m);
      const aa = a + bitCount(m & ~masks[i]);
      if (rr > k || aa > k) continue;
      cur.push(m);
      walk(i + 1, rr, aa);
      cur.pop();
    }
  };
  walk(0, 0, 0);
  return out;
}

const holds = (lens: [number, number, number], masks: number[]) => readEquation(lens, masks)?.holds === true;

/** True equations of a shape: A ± B = C, numbers without a leading zero. */
function trueEquations(lens: [number, number, number]): number[][] {
  const range = (k: number) => (k === 1 ? [0, 9] : [10, 99]);
  const sticks = (n: number) => digitsOf(n).map((d) => DIGIT_STICKS[d]);
  const out: number[][] = [];
  const [alo, ahi] = range(lens[0]);
  const [blo, bhi] = range(lens[1]);
  const [clo, chi] = range(lens[2]);
  for (let a = alo; a <= ahi; a++)
    for (let b = blo; b <= bhi; b++)
      for (const [sign, c] of [
        [PLUS, a + b],
        [MINUS, a - b],
      ])
        if (c >= clo && c <= chi) out.push([...sticks(a), sign, ...sticks(b), EQUALS, ...sticks(c)]);
  return out;
}

const MATCH_SHAPES: Record<Level, [number, number, number][]> = {
  1: [[1, 1, 1]],
  // (A two-digit A and C, as in 12 + 5 = 17, gives 17,000 puzzles and takes seconds to sort: left out.)
  2: [
    [2, 1, 1],
    [1, 1, 2],
  ],
  3: [[1, 1, 1]],
};

const pools = new Map<string, { start: number[]; answer: number[] }[]>();

/**
 * Every puzzle of a shape: a false equation with exactly one true equation
 * `moves` moves away (and, for two moves, none one move away). Found by
 * moving sticks backwards from every true equation; built once per shape.
 */
export function matchPool(lens: [number, number, number], moves: 1 | 2) {
  const key = `${lens.join("")}-${moves}`;
  const hit = pools.get(key);
  if (hit) return hit;
  const out: { start: number[]; answer: number[] }[] = [];
  const seen = new Set<string>();
  for (const answer of trueEquations(lens))
    for (const start of movesAway(lens, answer, moves)) {
      const id = start.join(".");
      if (seen.has(id) || holds(lens, start)) continue;
      seen.add(id);
      const sols = movesAway(lens, start, moves).filter((m) => holds(lens, m));
      if (sols.length !== 1) continue;
      if (moves === 2 && movesAway(lens, start, 1).some((m) => holds(lens, m))) continue;
      out.push({ start, answer: sols[0] });
    }
  pools.set(key, out);
  return out;
}

function matchQuestion(rng: Rng, level: Level, seed: number): MatchQuestion {
  const lens = pick(rng, MATCH_SHAPES[level]);
  const moves = level === 3 ? 2 : 1;
  const pool = matchPool(lens, moves);
  const { start, answer } = pool[randInt(rng, pool.length)];
  return { type: "match", level, seed, lens, moves, start, answer };
}

export function makeDigitsQuestion(type: DigitsQuestionType, level: Level, seed: number): DigitsQuestion {
  const rng = mulberry32(seed * 7 + level * 101 + type.length * 13);
  switch (type) {
    case "extreme":
      return extremeQuestion(rng, level, seed);
    case "condition":
      return conditionQuestion(rng, level, seed);
    case "count":
      return countQuestion(rng, level, seed);
    case "digitSum":
      return digitSumQuestion(rng, level, seed);
    case "divisible":
      return divisibleQuestion(rng, level, seed);
    case "match":
      return matchQuestion(rng, level, seed);
    default:
      return makeMoreQuestion(type, rng, level, seed);
  }
}

// ── Mistakes ─────────────────────────────────────────────────────────────

export type DigitsTag =
  | "right"
  | "leadingZero"
  | "wrongWay"
  | "order"
  | "noCondition"
  | "notBest"
  | "numbersOnly"
  | "onesOnly"
  | "noHundreds"
  | "wrongSum"
  | "reversed"
  | "repeated"
  | "notFour"
  | "otherValid"
  | "only3"
  | "partial"
  | "unreadable"
  | "notTrue"
  | "moves"
  | MoreTag;

/** Uses each card exactly once? */
const fromCards = (s: string, cards: number[], use: number) => {
  if (s.length !== use) return false;
  const left = [...cards];
  for (const ch of s) {
    const i = left.indexOf(Number(ch));
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
};

/** Divisibility rules a number passes, as the divisors they test. */
export const RULES: Record<number, number[]> = { 3: [3], 9: [9], 4: [4], 6: [2, 3], 12: [4, 3], 15: [5, 3], 18: [2, 9], 36: [4, 9] };

/** Wrong answers with a known cause that are numbers (for count and diff), checked in order. */
export function slips(q: DigitsQuestion): [DigitsTag, number][] {
  if (isMore(q)) return moreSlips(q);
  if (q.type === "count") {
    const [ones, tens, hundreds] = placeCounts(q.digit, q.n);
    return [
      ["numbersOnly", numbersWith(q.digit, q.n)],
      ["onesOnly", ones],
      ...(hundreds ? [["noHundreds", ones + tens] as [DigitsTag, number]] : []),
    ];
  }
  if (q.type === "extreme" && q.want === "diff") {
    const e = extremes(q.cards);
    return [["leadingZero", e.max - Number(e.zeroFirst)]];
  }
  return [];
}

/** Which slip an answer (as a string of digits, or of stick masks for a matchstick question) is. */
export function digitsMistake(q: DigitsQuestion, value: string): DigitsTag {
  if (value === answerKey(q)) return "right";
  if (isMore(q)) return moreMistake(q, value);
  switch (q.type) {
    case "match": {
      const masks = value.split(".").map(Number);
      if (masks.length !== q.start.length) return "other";
      const { removed, added } = stickDiff(q.start, masks);
      if (removed !== added || removed !== q.moves) return "moves";
      const kinds = slotKinds(q.lens);
      if (kinds.some((k, i) => k === "lead" && masks[i] === DIGIT_STICKS[0])) return "leadingZero";
      const eq = readEquation(q.lens, masks);
      if (!eq) return "unreadable";
      return eq.holds ? "other" : "notTrue";
    }
    case "extreme":
    case "condition": {
      if (!/^\d+$/.test(value)) return "other";
      if (q.type === "extreme" && q.want === "diff") break;
      const use = q.type === "condition" ? q.use : q.cards.length;
      if (!fromCards(value, q.cards, use)) return "other";
      if (value.length > 1 && value[0] === "0") return "leadingZero";
      const n = Number(value);
      if (q.type === "extreme") {
        const e = extremes(q.cards);
        return n === (q.want === "max" ? e.min : e.max) ? "wrongWay" : "order";
      }
      if (!meets(n, q.cond)) return "noCondition";
      return n === bestBuilt(q.cards, q.use, q.cond, q.want === "max" ? "min" : "max") ? "wrongWay" : "notBest";
    }
    case "digitSum": {
      const n = Number(value);
      if (!/^\d+$/.test(value) || n <= 0) return "other";
      if (digitSum(n) !== q.sum) return "wrongSum";
      if ((q.variant === "min4" || q.variant === "max4distinct") && (n < 1000 || n > 9999)) return "notFour";
      if ((q.variant === "max4distinct" || q.variant === "minDistinct") && !distinct(n)) return "repeated";
      if (String(n).split("").reverse().join("") === String(q.answer)) return "reversed";
      return "notBest";
    }
    case "divisible": {
      const d = Number(value);
      if (!/^\d$/.test(value)) return "other";
      if (q.valid.includes(d)) return "otherValid";
      if (d === 0 && q.digits[0] === null) return "leadingZero";
      const n = Number(q.digits.map((x) => x ?? d).join(""));
      if (RULES[q.divisor].includes(9) && n % 3 === 0 && RULES[q.divisor].every((r) => r === 9 || n % r === 0)) return "only3";
      if (RULES[q.divisor].length > 1 && RULES[q.divisor].some((r) => n % r === 0)) return "partial";
      return "other";
    }
  }
  const v = Number(value);
  for (const [tag, s] of slips(q)) if (s !== Number(answerKey(q)) && v === s) return tag;
  return "other";
}
