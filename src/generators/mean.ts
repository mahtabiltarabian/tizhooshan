// Tool 12, «میانگین»: the average as levelling. Columns of blocks are made
// the same height by moving blocks from tall columns to short ones; the
// common height is the average, and it is always total ÷ count.
//
// Level 1 (plain):   the average of 3 or 4 numbers (a whole number).
// Level 2 (missing): one number is missing; the average of all is known.
// Level 3 (join / leave / groups): someone joins and the average changes (how
//          many does the newcomer have?); someone leaves (new average?); or two
//          groups of different sizes with their averages (average of all?).
//
// Every question keeps its answer and the usual slips (wrong count, forgot
// to multiply back, averaged the averages, ...), so feedback can name them.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type MeanVariant = "plain" | "missing" | "join" | "leave" | "groups";

/** What is counted: "در تابستان، علی ۴ و سارا ۷ کتاب خوانده‌اند". */
export const MEAN_CONTEXTS = [
  { noun: "کتاب", where: "در تابستان", did: "خوانده‌اند", didOne: "خوانده است" },
  { noun: "امتیاز", where: "در مسابقه‌ی پرتاب توپ", did: "گرفته‌اند", didOne: "گرفته است" },
  { noun: "گل", where: "در باغچه‌ی مدرسه", did: "کاشته‌اند", didOne: "کاشته است" },
  { noun: "سیب", where: "در باغ", did: "چیده‌اند", didOne: "چیده است" },
] as const;

export const MEAN_NAMES = ["علی", "سارا", "نیما", "مریم", "رضا", "زهرا", "پارسا", "یاسمن", "امیر", "نازنین", "حسین", "ریحانه"] as const;

export interface MeanQuestion {
  type: "mean";
  level: Level;
  seed: number;
  variant: MeanVariant;
  /** Index into MEAN_CONTEXTS. */
  context: number;
  /** plain / missing: one name per value. join / leave: the one who comes or goes. */
  names: string[];
  /** plain / missing: every value (the missing one included). */
  values: number[];
  /** missing: index of the missing value. */
  miss: number;
  /** join / leave: people before; groups: people in group 1. */
  n: number;
  /** missing: the given average; join / leave: the average before; groups: group 1's average. */
  a: number;
  /** join / leave: the average after; groups: group 2's average. */
  b: number;
  /** join: the newcomer's value; leave: the leaver's value; groups: people in group 2. */
  x: number;
  answer: number;
}

/** Wrong answers with a known cause. */
export type MeanTag =
  | "right"
  /** plain: total, not divided. */
  | "noDivide"
  /** Divided by the wrong count (one too many or too few). */
  | "wrongCount"
  /** missing: took the average for the total (did not multiply back). */
  | "noMultiply"
  /** missing / join: the new total (average × count), the known values not taken away. */
  | "noSubtract"
  /** missing / join: gave the average itself. */
  | "gaveAverage"
  /** join: only the share given to the others (b − a) × n, without the newcomer's own b. */
  | "onlyShare"
  /** join / leave: worked as if there were only two numbers. */
  | "twoNumbers"
  /** leave: did not take the leaver's value away. */
  | "noTakeAway"
  /** groups: the average of the two averages. */
  | "avgOfAvgs"
  /** groups: divided the total by 2 (the number of groups). */
  | "byGroups"
  /** plain: the middle of the biggest and smallest. */
  | "midRange"
  | "other";

export interface MeanSlip {
  tag: MeanTag;
  value: number;
}

const sum = (v: readonly number[]) => v.reduce((t, x) => t + x, 0);

function base(level: Level, seed: number, variant: MeanVariant, context: number) {
  return { type: "mean" as const, level, seed, variant, context, names: [] as string[], values: [] as number[], miss: -1, n: 0, a: 0, b: 0, x: 0 };
}

function plain(rng: Rng, level: Level, seed: number, context: number): MeanQuestion {
  for (;;) {
    const n = 3 + randInt(rng, 2);
    const values = Array.from({ length: n }, () => 1 + randInt(rng, 12));
    const s = sum(values);
    const m = s / n;
    if (!Number.isInteger(m) || m < 2 || m > 10) continue;
    // Not level already, and some real moving to do.
    const moved = values.reduce((t, v) => t + Math.max(0, v - m), 0);
    if (moved < 2 || moved > 8) continue;
    const names = shuffle(rng, MEAN_NAMES).slice(0, n);
    return { ...base(level, seed, "plain", context), names, values, answer: m };
  }
}

function missing(rng: Rng, level: Level, seed: number, context: number): MeanQuestion {
  for (;;) {
    const n = 3 + randInt(rng, 3);
    const a = 3 + randInt(rng, 9);
    const values = Array.from({ length: n - 1 }, () => 1 + randInt(rng, 14));
    const last = a * n - sum(values);
    if (last < 1 || last > 18 || last === a) continue;
    const miss = randInt(rng, n);
    values.splice(miss, 0, last);
    const names = shuffle(rng, MEAN_NAMES).slice(0, n);
    return { ...base(level, seed, "missing", context), names, values, miss, a, answer: last };
  }
}

function join(rng: Rng, level: Level, seed: number, context: number): MeanQuestion {
  for (;;) {
    const n = 3 + randInt(rng, 4);
    const a = 3 + randInt(rng, 10);
    const d = 1 + randInt(rng, 3);
    const b = rng() < 0.75 ? a + d : a - d;
    const x = (n + 1) * b - n * a;
    if (b < 2 || x < 1 || x > 24 || x === b) continue;
    return { ...base(level, seed, "join", context), names: [pick(rng, MEAN_NAMES)], n, a, b, x, answer: x };
  }
}

function leave(rng: Rng, level: Level, seed: number, context: number): MeanQuestion {
  for (;;) {
    const n = 4 + randInt(rng, 3);
    const a = 4 + randInt(rng, 11);
    // The leaver moves the others' average by a whole step: x − a = (n − 1)(a − b).
    const step = 1 + randInt(rng, 3);
    const b = rng() < 0.65 ? a - step : a + step;
    const x = a - (n - 1) * (b - a);
    if (b < 1 || x < 1 || x > 24) continue;
    return { ...base(level, seed, "leave", context), names: [pick(rng, MEAN_NAMES)], n, a, b, x, answer: b };
  }
}

function groups(rng: Rng, level: Level, seed: number, context: number): MeanQuestion {
  const evenOnly = rng() < 0.7;
  for (;;) {
    const n1 = 2 + randInt(rng, 4);
    const n2 = 2 + randInt(rng, 4);
    const a1 = 2 + randInt(rng, 13);
    const a2 = 2 + randInt(rng, 13);
    if (n1 === n2 || a1 === a2 || n1 + n2 > 8) continue;
    const t = n1 * a1 + n2 * a2;
    if (t % (n1 + n2) !== 0) continue;
    // Mostly the tempting "average of averages" is a whole number, so it can be named.
    if (evenOnly && (a1 + a2) % 2 !== 0) continue;
    return { ...base(level, seed, "groups", context), n: n1, a: a1, x: n2, b: a2, answer: t / (n1 + n2) };
  }
}

export function makeMeanQuestion(level: Level, seed: number): MeanQuestion {
  const rng = mulberry32(seed * 13 + level * 211 + 7);
  const context = randInt(rng, MEAN_CONTEXTS.length);
  if (level === 1) return plain(rng, level, seed, context);
  if (level === 2) return missing(rng, level, seed, context);
  const v = randInt(rng, 3);
  return v === 0 ? join(rng, level, seed, context) : v === 1 ? leave(rng, level, seed, context) : groups(rng, level, seed, context);
}

/** Wrong answers with a known cause, in the order they are checked. */
export function meanSlips(q: MeanQuestion): MeanSlip[] {
  const out: MeanSlip[] = [];
  const add = (tag: MeanTag, value: number) => out.push({ tag, value });
  switch (q.variant) {
    case "plain": {
      const s = sum(q.values);
      const n = q.values.length;
      add("wrongCount", s / (n - 1));
      add("wrongCount", s / (n + 1));
      add("midRange", (Math.max(...q.values) + Math.min(...q.values)) / 2);
      add("noDivide", s);
      break;
    }
    case "missing": {
      const n = q.values.length;
      const known = sum(q.values) - q.answer;
      add("noMultiply", q.a - known);
      add("wrongCount", q.a * (n - 1) - known);
      add("gaveAverage", q.a);
      add("noSubtract", q.a * n);
      break;
    }
    case "join": {
      add("gaveAverage", q.b);
      add("onlyShare", q.n * (q.b - q.a));
      add("twoNumbers", 2 * q.b - q.a);
      add("noSubtract", (q.n + 1) * q.b);
      break;
    }
    case "leave": {
      const t = q.n * q.a - q.x;
      add("wrongCount", t / q.n);
      add("twoNumbers", 2 * q.a - q.x);
      add("noTakeAway", (q.n * q.a) / (q.n - 1));
      break;
    }
    case "groups": {
      const t = q.n * q.a + q.x * q.b;
      add("avgOfAvgs", (q.a + q.b) / 2);
      add("byGroups", t / 2);
      break;
    }
  }
  return out.filter((s) => Number.isInteger(s.value) && s.value > 0);
}

/** Which slip an answer is, if any. */
export function meanMistake(q: MeanQuestion, value: number): MeanTag {
  if (value === q.answer) return "right";
  for (const s of meanSlips(q)) if (s.value !== q.answer && s.value === value) return s.tag;
  return "other";
}

// ── Levelling ───────────────────────────────────────────────────────────

/** Move `count` blocks from column `from` to column `to`. */
export interface Transfer {
  from: number;
  to: number;
  count: number;
}

/**
 * Transfers that make every column `m` high (the total must be m × columns):
 * the tallest column gives to the shortest until both reach m, again and again.
 */
export function levelTransfers(heights: readonly number[], m: number): Transfer[] {
  const h = [...heights];
  const out: Transfer[] = [];
  for (let guard = 0; guard < 100; guard++) {
    let hi = -1;
    let lo = -1;
    h.forEach((v, i) => {
      if (v > m && (hi < 0 || v > h[hi])) hi = i;
      if (v < m && (lo < 0 || v < h[lo])) lo = i;
    });
    if (hi < 0 || lo < 0) break;
    const count = Math.min(h[hi] - m, m - h[lo]);
    h[hi] -= count;
    h[lo] += count;
    out.push({ from: hi, to: lo, count });
  }
  return out;
}

/** The heights of the columns the question shows first (before any working). */
export function meanColumns(q: MeanQuestion): number[] {
  switch (q.variant) {
    case "plain":
    case "missing":
      return q.values;
    case "join":
    case "leave":
      return Array<number>(q.n).fill(q.a);
    case "groups":
      return [...Array<number>(q.n).fill(q.a), ...Array<number>(q.x).fill(q.b)];
  }
}
