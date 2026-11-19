// Tool 12, «مبادله»: exchange and substitution. "3 apples = 2 pears" is a
// balanced scale; to trade, replace things on a pan with what an exchange
// says they equal. Goods form a chain from cheap to dear: rate i says
// p of goods[i] = q of goods[i + 1].
//
// Level 1 (one):      one exchange, many times over: 12 apples = ? pears.
// Level 2 (chain):    two exchanges in a row: 1 melon = ? apples.
// Level 3 (leftover): only whole batches can be traded; at most how many of
//                     the dearest can you get (something is left over)?
//         (compare):  the chain against a seller's direct offer; the
//                     cheaper way, in the cheapest good.
//
// Every question keeps its answer and the usual slips (added instead of
// multiplied, turned an exchange round, skipped a link), so feedback can name them.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type ExchangeVariant = "one" | "chain" | "leftover" | "compare";

/** Goods, cheap to dear. Each has its own shape in the pictures. */
export const GOODS = [{ name: "سیب" }, { name: "گلابی" }, { name: "انار" }, { name: "خربزه" }] as const;

export const TRADERS = ["علی", "سارا", "نیما", "مریم", "رضا", "زهرا", "پارسا", "یاسمن"] as const;

/** p of goods[i] = q of goods[i + 1] (p > q: the cheaper good comes in more). */
export interface Rate {
  p: number;
  q: number;
}

export interface ExchangeQuestion {
  type: "exchange";
  level: Level;
  seed: number;
  variant: ExchangeVariant;
  /** Indices into GOODS, cheap to dear (2 or 3 of them). */
  goods: number[];
  /** rates[i] links goods[i] and goods[i + 1]. */
  rates: Rate[];
  /** The order the exchanges are told in (indices into rates). */
  order: number[];
  /** Position in `goods` of what we start with, and of what is asked. */
  from: number;
  to: number;
  /** How many of goods[from] (one / chain / leftover), or of goods[2] wanted (compare). */
  count: number;
  /** compare: a seller gives one goods[2] for this many goods[0]. */
  offer: number;
  /** The person (levels 3). */
  name: string;
  answer: number;
}

export type ExchangeTag =
  | "right"
  /** Added or subtracted the numbers instead of multiplying and dividing. */
  | "added"
  /** Used an exchange the wrong way round. */
  | "inverted"
  /** Stopped at the middle good, or used only one of the two exchanges. */
  | "skipLink"
  /** Every one (not every group) was exchanged: multiplied but did not divide. */
  | "perOne"
  /** Gave the exchange for one group only. */
  | "oneGroup"
  /** leftover: counted a last one that there is not enough for. */
  | "roundUp"
  /** compare: chose the dearer way. */
  | "dearer"
  /** compare: the price of one, not of all of them. */
  | "forgotCount"
  /** compare: gave the saving, not the price. */
  | "saving"
  | "other";

export interface ExchangeSlip {
  tag: ExchangeTag;
  value: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** A rate p > q ≥ 1 with no common factor. */
function rate(rng: Rng, maxP: number, qOne = false): Rate {
  for (;;) {
    const p = 2 + randInt(rng, maxP - 1);
    const q = qOne ? 1 : 1 + randInt(rng, p - 1);
    if (gcd(p, q) === 1) return { p, q };
  }
}

/** Goods in order: `k` different ones, cheap to dear. */
const goodsOf = (rng: Rng, k: number) =>
  shuffle(
    rng,
    GOODS.map((_, i) => i),
  )
    .slice(0, k)
    .sort((a, b) => a - b);

/** One step along the chain, from position i to i ± 1: how many per how many. */
export function linkFactor(q: ExchangeQuestion, i: number, j: number): { mul: number; div: number } {
  const r = q.rates[Math.min(i, j)];
  // Going dearer: p cheap → q dear. Going cheaper: q dear → p cheap.
  return j > i ? { mul: r.q, div: r.p } : { mul: r.p, div: r.q };
}

/** Counts along the way from goods[from] to goods[to], exchanging all (the value). */
export function pathCounts(q: ExchangeQuestion, start = q.count): number[] {
  const out = [start];
  const dir = q.to > q.from ? 1 : -1;
  for (let i = q.from; i !== q.to; i += dir) {
    const { mul, div } = linkFactor(q, i, i + dir);
    out.push((out[out.length - 1] * mul) / div);
  }
  return out;
}

/** Leftover: trading whole batches only, along the chain. Counts kept and left over at each good. */
export function batchTrade(q: ExchangeQuestion): { got: number[]; left: number[] } {
  const got = [q.count];
  const left: number[] = [];
  for (let i = 0; i < q.rates.length; i++) {
    const { p, q: r } = q.rates[i];
    const have = got[i];
    const batches = Math.floor(have / p);
    left.push(have - batches * p);
    got.push(batches * r);
  }
  left.push(got[got.length - 1]);
  return { got, left };
}

/** Price of one goods[2] in goods[0], through goods[1]. */
export const chainPrice = (q: ExchangeQuestion) => (q.rates[0].p * q.rates[1].p) / (q.rates[0].q * q.rates[1].q);

function base(level: Level, seed: number, variant: ExchangeVariant) {
  return { type: "exchange" as const, level, seed, variant, offer: 0, name: "" };
}

function one(rng: Rng, level: Level, seed: number): ExchangeQuestion {
  for (;;) {
    const r = rate(rng, 6);
    const t = 2 + randInt(rng, 4);
    const up = rng() < 0.5;
    const count = up ? r.p * t : r.q * t;
    const answer = up ? r.q * t : r.p * t;
    if (count > 30 || answer > 30) continue;
    return { ...base(level, seed, "one"), goods: goodsOf(rng, 2), rates: [r], order: [0], from: up ? 0 : 1, to: up ? 1 : 0, count, answer };
  }
}

function chain(rng: Rng, level: Level, seed: number): ExchangeQuestion {
  for (;;) {
    const r0 = rate(rng, 5);
    const r1 = rate(rng, 5, rng() < 0.7);
    const down = rng() < 0.65;
    const count = down ? 1 + randInt(rng, 3) : 2 + randInt(rng, 30);
    const q: ExchangeQuestion = {
      ...base(level, seed, "chain"),
      goods: goodsOf(rng, 3),
      rates: [r0, r1],
      order: shuffle(rng, [0, 1]),
      from: down ? 2 : 0,
      to: down ? 0 : 2,
      count,
      answer: 0,
    };
    const path = pathCounts(q);
    if (!path.every((c) => Number.isInteger(c) && c >= 1 && c <= 40)) continue;
    // Something to multiply: the answer is not the start again.
    if (path[2] === count || path[1] === count) continue;
    return { ...q, answer: path[2] };
  }
}

function leftover(rng: Rng, level: Level, seed: number): ExchangeQuestion {
  for (;;) {
    const r0 = rate(rng, 5);
    const r1 = { p: 2 + randInt(rng, 4), q: 1 };
    const count = 8 + randInt(rng, 33);
    const q: ExchangeQuestion = {
      ...base(level, seed, "leftover"),
      goods: goodsOf(rng, 3),
      rates: [r0, r1],
      order: [0, 1],
      from: 0,
      to: 2,
      count,
      name: pick(rng, TRADERS),
      answer: 0,
    };
    const { got, left } = batchTrade(q);
    const answer = got[2];
    // Whole batches give the same as the value would (rounded down), and something is left over.
    const ideal = Math.floor((count * r0.q) / (r0.p * r1.p));
    if (answer < 1 || answer > 6 || answer !== ideal) continue;
    if (left[0] + left[1] === 0) continue;
    return { ...q, answer };
  }
}

function compare(rng: Rng, level: Level, seed: number): ExchangeQuestion {
  for (;;) {
    const r0 = rate(rng, 5);
    const r1 = { p: 2 + randInt(rng, 4), q: 1 };
    const count = 2 + randInt(rng, 3);
    const q: ExchangeQuestion = {
      ...base(level, seed, "compare"),
      goods: goodsOf(rng, 3),
      rates: [r0, r1],
      order: shuffle(rng, [0, 1]),
      from: 0,
      to: 2,
      count,
      name: pick(rng, TRADERS),
      answer: 0,
    };
    const price = chainPrice(q);
    // Whole batches: count × r1.p of the middle good must come in whole batches of r0.q.
    if (!Number.isInteger(price) || (count * r1.p) % r0.q !== 0 || price > 15) continue;
    const d = 1 + randInt(rng, 3);
    const offer = rng() < 0.5 ? price + d : price - d;
    if (offer < 2) continue;
    const answer = count * Math.min(price, offer);
    if (answer > 60) continue;
    return { ...q, offer, answer };
  }
}

export function makeExchangeQuestion(level: Level, seed: number): ExchangeQuestion {
  const rng = mulberry32(seed * 17 + level * 307 + 3);
  if (level === 1) return one(rng, level, seed);
  if (level === 2) return chain(rng, level, seed);
  return rng() < 0.5 ? leftover(rng, level, seed) : compare(rng, level, seed);
}

/** Wrong answers with a known cause, in the order they are checked. */
export function exchangeSlips(q: ExchangeQuestion): ExchangeSlip[] {
  const out: ExchangeSlip[] = [];
  const add = (tag: ExchangeTag, value: number) => out.push({ tag, value });
  switch (q.variant) {
    case "one": {
      const { mul, div } = linkFactor(q, q.from, q.to);
      add("inverted", (q.count * div) / mul);
      add("added", q.count + mul - div);
      add("perOne", q.count * mul);
      add("oneGroup", mul);
      break;
    }
    case "chain": {
      const dir = q.to > q.from ? 1 : -1;
      const l1 = linkFactor(q, q.from, q.from + dir);
      const l2 = linkFactor(q, q.from + dir, q.to);
      const mid = (q.count * l1.mul) / l1.div;
      add("skipLink", mid);
      add("skipLink", (q.count * l2.mul) / l2.div);
      add("inverted", (mid * l2.div) / l2.mul);
      add("inverted", (((q.count * l1.div) / l1.mul) * l2.mul) / l2.div);
      add("added", mid + l2.mul);
      add("added", l1.mul + l2.mul);
      add("perOne", mid * l2.mul);
      add("perOne", q.count * l1.mul * l2.mul);
      break;
    }
    case "leftover": {
      const { got } = batchTrade(q);
      add("roundUp", q.answer + 1);
      add("skipLink", got[1]);
      add("inverted", (q.count * q.rates[0].p) / q.rates[0].q);
      add("perOne", Math.floor((q.count * q.rates[0].q) / q.rates[1].p));
      break;
    }
    case "compare": {
      const price = chainPrice(q);
      add("dearer", q.count * Math.max(price, q.offer));
      add("forgotCount", Math.min(price, q.offer));
      add("saving", q.count * Math.abs(price - q.offer));
      break;
    }
  }
  return out.filter((s) => Number.isInteger(s.value) && s.value > 0);
}

/** Which slip an answer is, if any. */
export function exchangeMistake(q: ExchangeQuestion, value: number): ExchangeTag {
  if (value === q.answer) return "right";
  for (const s of exchangeSlips(q)) if (s.value !== q.answer && s.value === value) return s.tag;
  return "other";
}
