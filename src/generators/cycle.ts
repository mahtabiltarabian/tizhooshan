// Tool 9: repeating patterns and remainders. A cycle of letters, shapes or
// coloured beads (each bead also carries a letter, so colour is never the only
// cue) repeats over and over; what is item N, or how many of one symbol are
// there among the first N? At level 3 the cycle may start after a few items
// that do not repeat, or the cycle is the days of the week. Every question
// shows at least two whole cycles, so the cycle can be read off the row; the
// generator rejects rows that a shorter cycle (or a shorter start) would also
// explain. Each question keeps the usual slips, so the feedback can say which
// slip a wrong answer was.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type CycleSet = "letters" | "shapes" | "beads" | "days";
/** nth: item N; count: how many of one symbol among the first N; prefix: item N after a start that does not repeat; week: day N of the year. */
export type CycleVariant = "nth" | "count" | "prefix" | "week";

/** Symbols of each set, by id. */
export const SYMBOLS: Record<CycleSet, string[]> = {
  letters: ["ا", "ب", "پ", "ت", "ج", "د", "ر", "س"],
  shapes: ["●", "▲", "■", "◆", "★", "♥"],
  beads: ["ق", "آ", "س", "ز", "ب", "ن"],
  days: ["ش", "ی", "د", "س", "چ", "پ", "ج"],
};

/** Each symbol in words. */
export const SYMBOL_NAMES: Record<CycleSet, string[]> = {
  letters: SYMBOLS.letters,
  shapes: ["دایره", "مثلث", "مربع", "لوزی", "ستاره", "قلب"],
  beads: ["قرمز", "آبی", "سبز", "زرد", "بنفش", "نارنجی"],
  days: ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"],
};

export interface CycleQuestion {
  type: "cycle";
  level: Level;
  seed: number;
  variant: CycleVariant;
  set: CycleSet;
  /** Items before the repeating part (prefix questions only). */
  prefix: number[];
  /** One cycle, as symbol ids. */
  cycle: number[];
  /** How many items the row shows from the start. */
  shown: number;
  /** The position asked (1 = the first item), or the N of "the first N". */
  n: number;
  /** The symbol counted (count questions), or −1. */
  target: number;
  /** A symbol id, or the count (count questions). */
  answer: number;
}

/** Item at position `pos` (1 = first). */
export function itemAt(q: Pick<CycleQuestion, "prefix" | "cycle">, pos: number) {
  const p = q.prefix.length;
  if (pos <= p) return q.prefix[pos - 1];
  return q.cycle[(pos - p - 1) % q.cycle.length];
}

/** The first `n` items. */
export const itemsUpTo = (q: Pick<CycleQuestion, "prefix" | "cycle">, n: number) => Array.from({ length: n }, (_, k) => itemAt(q, k + 1));

/** N − prefix = q × cycle + r (r = 0 … cycle − 1; r = 0 means the last item of a cycle). */
export function divide(q: Pick<CycleQuestion, "prefix" | "cycle" | "n">) {
  const L = q.cycle.length;
  const m = q.n - q.prefix.length;
  return { cycles: Math.floor(m / L), rem: m % L, L, m };
}

/** Item at place r of the cycle (1 … L; 0 and L are both the last item). */
const byRem = (cycle: number[], r: number) => cycle[(((r - 1) % cycle.length) + cycle.length) % cycle.length];

/** How many of `target` in the first `r` items of the cycle. */
const countIn = (cycle: number[], target: number, r: number) => cycle.slice(0, r).filter((s) => s === target).length;

/** Smallest period of a row. */
export function minimalPeriod(items: number[]) {
  for (let L = 1; L < items.length; L++) if (items.every((v, k) => k < L || v === items[k - L])) return L;
  return items.length;
}

/** The answer kind: a symbol to pick, or a count. */
export const cycleAnswerIsCount = (q: CycleQuestion) => q.variant === "count";

/** Symbols to choose from, in the order they first appear (all seven days for the week). */
export function cycleChoices(q: CycleQuestion): number[] {
  if (q.variant === "week") return [0, 1, 2, 3, 4, 5, 6];
  const out: number[] = [];
  for (const s of [...q.prefix, ...q.cycle]) if (!out.includes(s)) out.push(s);
  return out;
}

// ── Building questions ──────────────────────────────────────────────────

const between = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

/** A cycle of length L using k different symbols, each at least once, with no shorter period. */
function makeCycle(rng: Rng, set: CycleSet, L: number, k: number): number[] {
  const ids = shuffle(rng, SYMBOLS[set].map((_, i) => i)).slice(0, k);
  for (;;) {
    const c = [...ids, ...Array.from({ length: L - k }, () => pick(rng, ids))];
    const cyc = shuffle(rng, c);
    if (minimalPeriod([...cyc, ...cyc]) === L) return cyc;
  }
}

const symbolSet = (rng: Rng): CycleSet => pick(rng, ["letters", "shapes", "beads"] as const);

function nthQuestion(rng: Rng, level: 1 | 2, seed: number): CycleQuestion {
  const set = symbolSet(rng);
  const L = level === 1 ? 3 : between(rng, 4, 6);
  const k = level === 1 ? 3 : between(rng, Math.max(2, L - 2), Math.min(L, SYMBOLS[set].length));
  const cycle = makeCycle(rng, set, L, k);
  const shown = 2 * L;
  let n: number;
  if (level === 1) n = between(rng, 10, 30);
  // Level 2: a remainder of 0 a third of the time, the case most often missed.
  else n = rng() < 0.3 ? L * between(rng, Math.ceil(40 / L), Math.floor(400 / L)) : between(rng, 40, 400);
  const q: CycleQuestion = { type: "cycle", level, seed, variant: "nth", set, prefix: [], cycle, shown, n, target: -1, answer: 0 };
  q.answer = itemAt(q, n);
  return q;
}

function countQuestion(rng: Rng, seed: number): CycleQuestion {
  const set = symbolSet(rng);
  for (;;) {
    const L = between(rng, 3, 5);
    const cycle = makeCycle(rng, set, L, between(rng, 2, L - 1));
    // The counted symbol appears at least twice in a cycle, so "cycles" and "items" differ.
    const counts = cycle.map((s) => cycle.filter((t) => t === s).length);
    const target = cycle[counts.findIndex((c) => c >= 2)];
    if (target === undefined) continue;
    const n = between(rng, 20, 200);
    const q: CycleQuestion = { type: "cycle", level: 3, seed, variant: "count", set, prefix: [], cycle, shown: 2 * L, n, target, answer: 0 };
    const { cycles, rem } = divide(q);
    q.answer = cycles * counts[cycle.indexOf(target)] + countIn(cycle, target, rem);
    return q;
  }
}

function prefixQuestion(rng: Rng, seed: number): CycleQuestion {
  const set = symbolSet(rng);
  for (;;) {
    const L = between(rng, 3, 5);
    const p = between(rng, 1, Math.min(3, L - 1));
    const cycle = makeCycle(rng, set, L, between(rng, Math.max(2, L - 1), Math.min(L, SYMBOLS[set].length)));
    const prefix = Array.from({ length: p }, () => randInt(rng, SYMBOLS[set].length));
    // The start must not be part of the cycle: its last item differs from the cycle's last.
    if (prefix[p - 1] === cycle[L - 1]) continue;
    const n = rng() < 0.3 ? p + L * between(rng, Math.ceil(30 / L), Math.floor(300 / L)) : between(rng, 30, 300);
    const q: CycleQuestion = { type: "cycle", level: 3, seed, variant: "prefix", set, prefix, cycle, shown: p + 2 * L, n, target: -1, answer: 0 };
    q.answer = itemAt(q, n);
    // "Forgot the start" must land somewhere of its own, so the feedback can name it.
    if (cycleMistake(q, byRem(cycle, n % L)) !== "prefix") continue;
    return q;
  }
}

function weekQuestion(rng: Rng, seed: number): CycleQuestion {
  const start = randInt(rng, 7);
  const cycle = Array.from({ length: 7 }, (_, k) => (start + k) % 7);
  const n = between(rng, 30, 365);
  const q: CycleQuestion = { type: "cycle", level: 3, seed, variant: "week", set: "days", prefix: [], cycle, shown: 7, n, target: -1, answer: 0 };
  q.answer = itemAt(q, n);
  return q;
}

export function makeCycleQuestion(level: Level, seed: number): CycleQuestion {
  const rng = mulberry32(seed * 7 + level * 101 + 977);
  if (level < 3) return nthQuestion(rng, level as 1 | 2, seed);
  const r = rng();
  return r < 0.34 ? countQuestion(rng, seed) : r < 0.67 ? prefixQuestion(rng, seed) : weekQuestion(rng, seed);
}

// ── Slips ───────────────────────────────────────────────────────────────

export type CycleTag = "right" | "zeroFirst" | "prefix" | "offByOne" | "quotient" | "cycles" | "noRemainder" | "wholeCycle" | "other";

/** Wrong answers with a known cause, in the order they are checked. */
export function cycleSlips(q: CycleQuestion): [CycleTag, number][] {
  const { cycles, rem, L } = divide(q);
  const c = q.cycle;
  if (q.variant === "count") {
    const per = countIn(c, q.target, L);
    const out: [CycleTag, number][] = [
      ["cycles", cycles],
      ["noRemainder", cycles * per],
      ["wholeCycle", (cycles + 1) * per],
      ["offByOne", cycles * per + countIn(c, q.target, rem + 1)],
    ];
    if (rem > 0) out.push(["offByOne", cycles * per + countIn(c, q.target, rem - 1)]);
    return out;
  }
  const out: [CycleTag, number][] = [];
  if (rem === 0) out.push(["zeroFirst", c[0]]);
  if (q.prefix.length) out.push(["prefix", byRem(c, q.n % L)]);
  out.push(["offByOne", byRem(c, rem + 1)], ["offByOne", byRem(c, rem - 1)], ["quotient", byRem(c, cycles % L)]);
  return out;
}

/** Which slip an answer is, if any. */
export function cycleMistake(q: CycleQuestion, value: number): CycleTag {
  if (value === q.answer) return "right";
  for (const [tag, v] of cycleSlips(q)) if (v !== q.answer && v === value) return tag;
  return "other";
}
