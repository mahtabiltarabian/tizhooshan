// Tool 14: fractions, ratio, percent and work problems, all worked with the
// bar model (one block = one equal share). Every answer is a whole number,
// a count of parts to shade, a choice, or a fraction (where any equivalent
// fraction counts). Each question keeps its answer and the usual slips, so the
// feedback can say which slip a wrong answer was.

import { mulberry32, pick, randInt, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type RatioQuestionType = "shade" | "partOf" | "compare" | "ratio" | "divide" | "percent" | "work";
export type Shape = "bar" | "circle";

export interface Frac {
  n: number;
  d: number;
}

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
export const lcmAll = (xs: number[]) => xs.reduce(lcm, 1);

export function simplest(f: Frac): Frac {
  const g = gcd(f.n, f.d) || 1;
  return { n: f.n / g, d: f.d / g };
}

/** Same value: 2/4 and 1/2 are the same fraction. */
export const sameFrac = (a: Frac, b: Frac) => a.d > 0 && b.d > 0 && a.n * b.d === b.n * a.d;

/** 1 if a > b, -1 if a < b, 0 if equal. */
export const cmpFrac = (a: Frac, b: Frac) => Math.sign(a.n * b.d - b.n * a.d);

export type Answer = number | Frac;
export const isFrac = (v: Answer): v is Frac => typeof v === "object";

/** How many blocks a percent bar has: each block is a round percent (50, 25, 20, 10 or 5). */
export const percentBlocks = (pct: number) => (pct % 50 === 0 ? 2 : pct % 25 === 0 ? 4 : pct % 20 === 0 ? 5 : pct % 10 === 0 ? 10 : 20);

interface Base {
  level: Level;
  seed: number;
}

/** Shade a fraction of a bar or circle cut into `parts` equal parts. */
export interface ShadeQuestion extends Base {
  type: "shade";
  shape: Shape;
  parts: number;
  frac: Frac;
  /** How many parts to shade. */
  answer: number;
}

/**
 * of: frac of `whole`; rest: what is left after taking frac of `whole`;
 * whole: frac of a number is `part`, find the number.
 */
export interface PartOfQuestion extends Base {
  type: "partOf";
  variant: "of" | "rest" | "whole";
  frac: Frac;
  whole: number;
  /** frac × whole. */
  part: number;
  /** One block: whole ÷ frac.d. */
  unit: number;
  /** Which story (rest). */
  item: number;
  answer: number;
}

/** Which is bigger: 0 = the first, 1 = the second, 2 = they are equal. */
export interface CompareQuestion extends Base {
  type: "compare";
  fracs: [Frac, Frac];
  answer: 0 | 1 | 2;
}

/**
 * Two things in the ratio a : b, one block = k.
 * other: given the first (a·k), find the second; total: given the first, find both together;
 * diff: given how many more the second has ((b − a)·k), find the first.
 */
export interface RatioPairQuestion extends Base {
  type: "ratio";
  variant: "other" | "total" | "diff";
  ratio: [number, number];
  k: number;
  things: number;
  answer: number;
}

/** Share `total` in the ratio `ratio` (two or three people); find share number `ask`. */
export interface DivideQuestion extends Base {
  type: "divide";
  ratio: number[];
  k: number;
  total: number;
  ask: number;
  item: number;
  answer: number;
}

/**
 * of: pct% of `whole`; off: `whole` less pct%; up: `whole` plus pct%;
 * whole: pct% of a number is `part`, find it; what: `part` is what percent of `whole`.
 */
export interface PercentQuestion extends Base {
  type: "percent";
  variant: "of" | "off" | "up" | "whole" | "what";
  pct: number;
  whole: number;
  part: number;
  item: number;
  answer: number;
}

/**
 * single: one tap (or worker) takes times[0] hours; what fraction after `hours`?
 * pairFraction: two taps; what fraction fills in one hour together?
 * pair / three: how long together? drain: times[0] fills, times[1] empties.
 * crew: crew[0] workers take crew[1] days; how long for crew[2] workers?
 */
export interface WorkQuestion extends Base {
  type: "work";
  variant: "single" | "pairFraction" | "pair" | "three" | "drain" | "crew";
  ctx: "tap" | "worker";
  times: number[];
  hours: number;
  crew: number[];
  answer: number | Frac;
}

export type RatioQuestion = ShadeQuestion | PartOfQuestion | CompareQuestion | RatioPairQuestion | DivideQuestion | PercentQuestion | WorkQuestion;

/** What kind of answer a question wants. */
export function answerKind(q: RatioQuestion): "shade" | "choice" | "fraction" | "number" {
  if (q.type === "shade") return "shade";
  if (q.type === "compare") return "choice";
  return isFrac(q.answer) ? "fraction" : "number";
}

// ── Questions ────────────────────────────────────────────────────────────

const between = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

/** A proper fraction n/d in simplest form, d in lo … hi. */
function properFrac(rng: Rng, lo: number, hi: number, unit = false): Frac {
  for (;;) {
    const d = between(rng, lo, hi);
    const n = unit ? 1 : between(rng, 1, d - 1);
    if (gcd(n, d) === 1) return { n, d };
  }
}

function shadeQuestion(rng: Rng, level: Level, seed: number): ShadeQuestion {
  const shape: Shape = rng() < 0.5 ? "bar" : "circle";
  if (level === 1) {
    const frac = properFrac(rng, 2, 8);
    return { type: "shade", level, seed, shape, parts: frac.d, frac, answer: frac.n };
  }
  for (;;) {
    if (level === 2 || rng() < 0.5) {
      // More parts than the denominator: 2/3 of a bar in 6 parts is 4 parts.
      const frac = properFrac(rng, 2, level === 2 ? 6 : 8);
      const k = between(rng, 2, level === 2 ? 3 : 4);
      const parts = frac.d * k;
      if (parts > (level === 2 ? 12 : 16)) continue;
      return { type: "shade", level, seed, shape, parts, frac, answer: frac.n * k };
    }
    // Fewer parts than the denominator: 6/9 of a bar in 3 parts is 2 parts.
    const parts = between(rng, 2, 6);
    const m = between(rng, 2, 3);
    const j = between(rng, 1, parts - 1);
    return { type: "shade", level, seed, shape, parts, frac: { n: j * m, d: parts * m }, answer: j };
  }
}

function partOfQuestion(rng: Rng, level: Level, seed: number): PartOfQuestion {
  const item = randInt(rng, 3);
  const make = (variant: PartOfQuestion["variant"], frac: Frac, unit: number): PartOfQuestion => {
    const whole = frac.d * unit;
    const part = frac.n * unit;
    const answer = variant === "of" ? part : variant === "rest" ? whole - part : whole;
    return { type: "partOf", level, seed, variant, frac, whole, part, unit, item, answer };
  };
  if (level === 1) return make("of", properFrac(rng, 2, 6, true), between(rng, 2, 10));
  if (level === 2) {
    const frac = properFrac(rng, 3, 8);
    if (frac.n === 1) return partOfQuestion(rng, level, seed);
    return make(rng() < 0.4 ? "rest" : "of", frac, between(rng, 2, 10));
  }
  const frac = properFrac(rng, 3, 10);
  if (frac.n === 1) return partOfQuestion(rng, level, seed);
  return make(rng() < 0.6 ? "whole" : "of", frac, between(rng, 2, 12));
}

function compareQuestion(rng: Rng, level: Level, seed: number): CompareQuestion {
  let f: Frac;
  let g: Frac;
  for (;;) {
    if (level === 1) {
      if (rng() < 0.5) {
        const d = between(rng, 3, 10);
        f = { n: between(rng, 1, d - 1), d };
        g = { n: between(rng, 1, d - 1), d };
      } else {
        const n = between(rng, 1, 4);
        f = { n, d: between(rng, n + 1, 10) };
        g = { n, d: between(rng, n + 1, 10) };
      }
      if (cmpFrac(f, g) === 0) continue;
    } else if (level === 2) {
      // One denominator a multiple of the other; sometimes equal fractions.
      f = properFrac(rng, 2, 6);
      const k = between(rng, 2, 3);
      if (f.d * k > 12) continue;
      g = rng() < 0.25 ? { n: f.n * k, d: f.d * k } : { n: between(rng, 1, f.d * k - 1), d: f.d * k };
    } else {
      // Unrelated denominators, close together.
      f = properFrac(rng, 3, 9);
      g = properFrac(rng, 3, 9);
      if (f.d % g.d === 0 || g.d % f.d === 0) continue;
      const gap = Math.abs(f.n * g.d - g.n * f.d);
      if (gap === 0 || gap > Math.min(f.d, g.d) || f.n === g.n) continue;
      // Mostly pick pairs where "more pieces shaded" points the wrong way.
      const bigger = cmpFrac(f, g) > 0 ? f : g;
      const smaller = bigger === f ? g : f;
      if (bigger.n > smaller.n && rng() < 0.6) continue;
    }
    break;
  }
  const fracs: [Frac, Frac] = rng() < 0.5 ? [f, g] : [g, f];
  const c = cmpFrac(fracs[0], fracs[1]);
  return { type: "compare", level, seed, fracs, answer: c > 0 ? 0 : c < 0 ? 1 : 2 };
}

/** Two different numbers lo … hi with no common factor. */
function coprimePair(rng: Rng, lo: number, hi: number): [number, number] {
  for (;;) {
    const a = between(rng, lo, hi);
    const b = between(rng, lo, hi);
    if (a !== b && gcd(a, b) === 1) return [a, b];
  }
}

function ratioQuestion(rng: Rng, level: Level, seed: number): RatioPairQuestion {
  const things = randInt(rng, 4);
  if (level === 1) {
    const ratio = coprimePair(rng, 1, 4);
    const k = between(rng, 2, 6);
    return { type: "ratio", level, seed, variant: "other", ratio, k, things, answer: ratio[1] * k };
  }
  if (level === 2) {
    const ratio = coprimePair(rng, 1, 5);
    const k = between(rng, 2, 10);
    const variant = rng() < 0.6 ? "total" : "other";
    return { type: "ratio", level, seed, variant, ratio, k, things, answer: variant === "total" ? (ratio[0] + ratio[1]) * k : ratio[1] * k };
  }
  const [x, y] = coprimePair(rng, 1, 7);
  const ratio: [number, number] = [Math.min(x, y), Math.max(x, y)];
  const k = between(rng, 2, 8);
  return { type: "ratio", level, seed, variant: "diff", ratio, k, things, answer: ratio[0] * k };
}

function divideQuestion(rng: Rng, level: Level, seed: number): DivideQuestion {
  const item = randInt(rng, 3);
  let ratio: number[];
  let k: number;
  for (;;) {
    if (level === 1) {
      const m = between(rng, 2, 4);
      ratio = rng() < 0.5 ? [1, m] : [m, 1];
      k = between(rng, 2, 8);
    } else if (level === 2) {
      ratio = coprimePair(rng, 1, 6);
      k = between(rng, 2, 10);
      if (ratio[0] + ratio[1] > 10 || ratio.includes(1)) continue;
    } else {
      ratio = [between(rng, 1, 5), between(rng, 1, 5), between(rng, 1, 5)];
      k = between(rng, 2, 10);
      const sum = ratio[0] + ratio[1] + ratio[2];
      if (sum > 12 || gcd(gcd(ratio[0], ratio[1]), ratio[2]) !== 1 || new Set(ratio).size < 2) continue;
    }
    break;
  }
  const total = ratio.reduce((s, r) => s + r, 0) * k;
  const ask = randInt(rng, ratio.length);
  return { type: "divide", level, seed, ratio, k, total, ask, item, answer: ratio[ask] * k };
}

/** A whole that splits into whole blocks for this percent, lo … hi. */
function wholeFor(rng: Rng, pct: number, lo: number, hi: number) {
  const m = percentBlocks(pct);
  const options = [];
  for (let n = m; n <= hi; n += m) if (n >= lo) options.push(n);
  return pick(rng, options);
}

function percentQuestion(rng: Rng, level: Level, seed: number): PercentQuestion {
  const item = randInt(rng, 2);
  const make = (variant: PercentQuestion["variant"], pct: number, whole: number): PercentQuestion => {
    const part = (whole * pct) / 100;
    const answer = variant === "of" ? part : variant === "off" ? whole - part : variant === "up" ? whole + part : variant === "whole" ? whole : pct;
    return { type: "percent", level, seed, variant, pct, whole, part, item, answer };
  };
  if (level === 1) {
    const pct = pick(rng, [50, 25, 75, 10, 20]);
    return make("of", pct, wholeFor(rng, pct, 12, 100));
  }
  const fives = Array.from({ length: 19 }, (_, i) => 5 * (i + 1)).filter((p) => p !== 50);
  if (level === 2) {
    const pct = pick(rng, fives);
    return make(rng() < 0.5 ? "of" : "off", pct, wholeFor(rng, pct, 20, 200));
  }
  const r = rng();
  if (r < 0.35) {
    const pct = pick(rng, fives);
    return make("whole", pct, wholeFor(rng, pct, 20, 200));
  }
  if (r < 0.7) {
    const pct = pick(rng, fives);
    return make("what", pct, wholeFor(rng, pct, 20, 200));
  }
  const pct = pick(rng, [10, 20, 25, 50]);
  return make("up", pct, wholeFor(rng, pct, 20, 150));
}

// Work problems: the tank is cut into lcm(times) cells, so every tap fills a
// whole number of cells an hour. Keep that at most 24 cells, to draw.
const MAX_CELLS = 24;

function search<T>(make: (out: T[]) => void) {
  const out: T[] = [];
  make(out);
  return out;
}

/** Two taps that fill together in a whole number of hours. */
export const WORK_PAIRS = search<number[]>((out) => {
  // Two equal taps are fine once or twice, not a dozen times.
  for (let a = 3; a <= 24; a++) for (let b = a; b <= 24; b++) if ((a * b) % (a + b) === 0 && lcm(a, b) <= MAX_CELLS && (a !== b || a <= 8)) out.push([a, b]);
});

/** Three taps that fill together in a whole number of hours. */
export const WORK_THREES = search<number[]>((out) => {
  for (let a = 2; a <= 24; a++)
    for (let b = a; b <= 24; b++)
      for (let c = b; c <= 24; c++) {
        const s = a * b + b * c + c * a;
        if (a !== c && (a * b * c) % s === 0 && lcmAll([a, b, c]) <= MAX_CELLS) out.push([a, b, c]);
      }
});

/** A filling tap and a slower drain: the tank still fills, in a whole number of hours (at most 12). */
export const WORK_DRAINS = search<number[]>((out) => {
  for (let a = 2; a <= 24; a++)
    for (let b = a + 1; b <= 24; b++) if ((a * b) % (b - a) === 0 && lcm(a, b) <= MAX_CELLS && (a * b) / (b - a) <= 12) out.push([a, b]);
});

function workQuestion(rng: Rng, level: Level, seed: number): WorkQuestion {
  const base = { type: "work" as const, level, seed, times: [] as number[], hours: 0, crew: [] as number[] };
  const ctx = rng() < 0.6 ? ("tap" as const) : ("worker" as const);
  if (level === 1) {
    const T = between(rng, 3, 10);
    const t = between(rng, 1, T - 1);
    return { ...base, variant: "single", ctx, times: [T], hours: t, answer: { n: t, d: T } };
  }
  const r = rng();
  if (level === 2 && r < 0.3) {
    for (;;) {
      const a = between(rng, 2, 8);
      const b = between(rng, 2, 8);
      if (a >= b || lcm(a, b) > MAX_CELLS) continue;
      return { ...base, variant: "pairFraction", ctx, times: [a, b], answer: { n: a + b, d: a * b } };
    }
  }
  if (level === 2 && r < 0.6) {
    for (;;) {
      const w1 = between(rng, 2, 8);
      const d = between(rng, 2, 12);
      const w2 = between(rng, 2, 8);
      if (w1 === w2 || (w1 * d) % w2 !== 0 || w1 * d > 48 || (w1 * d) / w2 > 30) continue;
      return { ...base, variant: "crew", ctx: "worker", crew: [w1, d, w2], answer: (w1 * d) / w2 };
    }
  }
  if (level === 2) {
    const [a, b] = pick(rng, WORK_PAIRS);
    const times = rng() < 0.5 ? [a, b] : [b, a];
    return { ...base, variant: "pair", ctx, times, answer: (a * b) / (a + b) };
  }
  if (r < 0.5) {
    const [a, b] = pick(rng, WORK_DRAINS);
    return { ...base, variant: "drain", ctx: "tap", times: [a, b], answer: (a * b) / (b - a) };
  }
  const [a, b, c] = pick(rng, WORK_THREES);
  return { ...base, variant: "three", ctx: "tap", times: [a, b, c], answer: (a * b * c) / (a * b + b * c + c * a) };
}

export function makeRatioQuestion(type: RatioQuestionType, level: Level, seed: number): RatioQuestion {
  const rng = mulberry32(seed * 7 + level * 101 + type.length * 13 + type.charCodeAt(0));
  switch (type) {
    case "shade":
      return shadeQuestion(rng, level, seed);
    case "partOf":
      return partOfQuestion(rng, level, seed);
    case "compare":
      return compareQuestion(rng, level, seed);
    case "ratio":
      return ratioQuestion(rng, level, seed);
    case "divide":
      return divideQuestion(rng, level, seed);
    case "percent":
      return percentQuestion(rng, level, seed);
    case "work":
      return workQuestion(rng, level, seed);
  }
}

// ── Slips ────────────────────────────────────────────────────────────────

export type RatioTag =
  | "right"
  | "numeratorOnly"
  | "denominator"
  | "complement"
  | "onePart"
  | "usedPart"
  | "forward"
  | "restOnly"
  | "notEqual"
  | "biggerDenominator"
  | "biggerNumerator"
  | "gap"
  | "addDifference"
  | "swapped"
  | "otherPart"
  | "givenPart"
  | "total"
  | "usedDifference"
  | "equalSplit"
  | "dividedByPart"
  | "percentAsNumber"
  | "subtractedPercent"
  | "addedPercent"
  | "partAsPercent"
  | "oneUnit"
  | "inverted"
  | "addedParts"
  | "addedTimes"
  | "averaged"
  | "addedRates"
  | "subtractedTimes"
  | "direct"
  | "additive"
  | "other";

/** Wrong answers with a known cause, in the order they are checked. Some are not whole numbers; those are dropped. */
export function slips(q: RatioQuestion): [RatioTag, Answer][] {
  switch (q.type) {
    case "shade":
      return [
        ["numeratorOnly", q.frac.n],
        ["complement", q.parts - q.answer],
        ["denominator", q.frac.d],
      ];
    case "partOf": {
      const { frac: f, unit: u, whole, part } = q;
      if (q.variant === "of")
        return [
          ["onePart", u],
          ["complement", whole - part],
        ];
      if (q.variant === "rest")
        return [
          ["usedPart", part],
          ["onePart", u],
        ];
      return [
        ["onePart", u],
        ["forward", (part * f.n) / f.d],
        ["restOnly", (f.d - f.n) * u],
      ];
    }
    case "compare": {
      const [f, g] = q.fracs;
      const out: [RatioTag, Answer][] = [];
      if (q.answer === 2) out.push(["notEqual", 0], ["notEqual", 1]);
      if (f.d !== g.d) out.push(["biggerDenominator", f.d > g.d ? 0 : 1]);
      if (f.n !== g.n) out.push(["biggerNumerator", f.n > g.n ? 0 : 1]);
      const gf = f.d - f.n;
      const gg = g.d - g.n;
      out.push(["gap", gf === gg ? 2 : gf < gg ? 0 : 1]);
      return out;
    }
    case "ratio": {
      const [a, b] = q.ratio;
      const k = q.k;
      if (q.variant === "other")
        return [
          ["addDifference", a * k + (b - a)],
          ["swapped", (a * k * a) / b],
          ["onePart", k],
        ];
      if (q.variant === "total")
        return [
          ["otherPart", b * k],
          ["givenPart", a * k],
          ["onePart", k],
        ];
      return [
        ["onePart", k],
        ["otherPart", b * k],
        ["total", (a + b) * k],
        ["usedDifference", (b - a) * k],
      ];
    }
    case "divide": {
      const others = q.ratio.map((r, i) => [i, r * q.k] as const).filter(([i]) => i !== q.ask);
      return [
        ["onePart", q.k],
        ["equalSplit", q.total / q.ratio.length],
        ["dividedByPart", q.total / q.ratio[q.ask]],
        ...others.map(([, v]) => ["otherPart", v] as [RatioTag, Answer]),
      ];
    }
    case "percent": {
      const { whole, part, pct } = q;
      switch (q.variant) {
        case "of":
          return [
            ["complement", whole - part],
            ["percentAsNumber", pct],
          ];
        case "off":
          return [
            ["usedPart", part],
            ["subtractedPercent", whole - pct],
          ];
        case "up":
          return [
            ["usedPart", part],
            ["addedPercent", whole + pct],
          ];
        case "whole":
          return [
            ["forward", (part * pct) / 100],
            ["onePart", part / (pct / (100 / percentBlocks(pct)))],
            ["percentAsNumber", pct],
          ];
        case "what":
          return [
            ["partAsPercent", part],
            ["swapped", (100 * whole) / part],
          ];
      }
      break;
    }
    case "work": {
      const t = q.times;
      switch (q.variant) {
        case "single":
          return [
            ["oneUnit", { n: 1, d: t[0] }],
            ["complement", { n: t[0] - q.hours, d: t[0] }],
            ["inverted", { n: t[0], d: q.hours }],
          ];
        case "pairFraction":
          return [
            ["addedParts", { n: 2, d: t[0] + t[1] }],
            ["addedTimes", { n: 1, d: t[0] + t[1] }],
          ];
        case "pair":
        case "three": {
          const sum = t.reduce((s, x) => s + x, 0);
          return [
            ["addedTimes", sum],
            ["averaged", sum / t.length],
          ];
        }
        case "drain":
          return [
            ["addedRates", (t[0] * t[1]) / (t[0] + t[1])],
            ["subtractedTimes", t[1] - t[0]],
          ];
        case "crew": {
          const [w1, d, w2] = q.crew;
          return [
            ["direct", (d * w2) / w1],
            ["additive", d - (w1 - w2)],
          ];
        }
      }
    }
  }
  return [];
}

/** A value a child could enter: a positive whole number, or a fraction of positive whole numbers. */
export const enterable = (v: Answer) => (isFrac(v) ? Number.isInteger(v.n) && Number.isInteger(v.d) && v.n > 0 && v.d > 0 : Number.isInteger(v) && v >= 0);

export function sameAnswer(a: Answer, b: Answer) {
  if (isFrac(a) && isFrac(b)) return sameFrac(a, b);
  if (!isFrac(a) && !isFrac(b)) return a === b;
  return false;
}

/** Which slip an answer is, if any. */
export function ratioMistake(q: RatioQuestion, value: Answer): RatioTag {
  if (sameAnswer(value, q.answer)) return "right";
  for (const [tag, v] of slips(q)) if (enterable(v) && !sameAnswer(v, q.answer) && sameAnswer(value, v)) return tag;
  return "other";
}
