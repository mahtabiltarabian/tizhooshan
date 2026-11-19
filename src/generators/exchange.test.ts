import { describe, expect, it } from "vitest";
import { batchTrade, chainPrice, exchangeMistake, exchangeSlips, makeExchangeQuestion, pathCounts, type ExchangeQuestion, type Level } from "./exchange";

const LEVELS: Level[] = [1, 2, 3];

/**
 * Values that fit every exchange: whole numbers for each good in the chain
 * (cheapest first) up to `max`. The answer must be the same for all of them.
 */
function valuings(q: ExchangeQuestion, max: number): number[][] {
  const out: number[][] = [];
  const k = q.goods.length;
  const rec = (v: number[]) => {
    if (v.length === k) return out.push([...v]);
    for (let x = 1; x <= max; x++) {
      const i = v.length - 1;
      // p of goods[i] = q of goods[i + 1]
      if (q.rates[i].p * v[i] !== q.rates[i].q * x) continue;
      rec([...v, x]);
    }
  };
  for (let x = 1; x <= max; x++) rec([x]);
  return out;
}

/** Leftover: every state reachable by whole-batch exchanges (both ways); the most of the dearest good. */
function bestByBatches(q: ExchangeQuestion): number {
  const start = [q.count, 0, 0];
  const key = (s: number[]) => s.join(",");
  const seen = new Set([key(start)]);
  const todo = [start];
  let best = 0;
  while (todo.length) {
    const s = todo.pop()!;
    best = Math.max(best, s[2]);
    for (let i = 0; i < 2; i++) {
      const { p, q: r } = q.rates[i];
      const moves = [
        [i, p, i + 1, r],
        [i + 1, r, i, p],
      ];
      for (const [a, pa, b, pb] of moves) {
        if (s[a] < pa) continue;
        const n = [...s];
        n[a] -= pa;
        n[b] += pb;
        if (!seen.has(key(n))) {
          seen.add(key(n));
          todo.push(n);
        }
      }
    }
  }
  return best;
}

/** Compare: cheapest number of goods[0] for `count` of goods[2], buying m from the seller and the rest through the chain. */
function cheapest(q: ExchangeQuestion): number {
  let best = Infinity;
  for (let m = 0; m <= q.count; m++) {
    const viaChain = q.count - m;
    // Middle goods needed, then whole batches of the first exchange to get at least that many.
    const mid = viaChain * q.rates[1].p;
    const batches = Math.ceil(mid / q.rates[0].q);
    best = Math.min(best, m * q.offer + batches * q.rates[0].p);
  }
  return best;
}

describe("exchange questions", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeExchangeQuestion(l, 42)).toEqual(makeExchangeQuestion(l, 42));
  });

  for (const level of LEVELS)
    it(`gives a sound exchange question for 10,000 seeds at level ${level}`, () => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeExchangeQuestion(level, seed);
        const ok = (cond: boolean, what: string) => {
          if (!cond) throw new Error(`exchange level ${level} seed ${seed}: ${what}\n${JSON.stringify(q)}`);
        };
        seen.add(q.variant);
        ok(Number.isInteger(q.answer) && q.answer > 0, "answer is a positive whole number");
        ok(exchangeMistake(q, q.answer) === "right", "answer is right");
        for (const s of exchangeSlips(q)) if (s.value !== q.answer) ok(exchangeMistake(q, s.value) !== "other", `slip ${s.value} is named`);
        ok(q.goods.length === q.rates.length + 1 && q.goods.every((g, i) => i === 0 || g > q.goods[i - 1]), "goods cheap to dear, all different");
        ok(q.rates.every((r) => r.p > r.q && r.q >= 1 && r.p <= 6), "small exchanges, the cheaper good in more");
        ok([...q.order].sort().join() === q.rates.map((_, i) => i).join(), "order lists every exchange once");
        switch (q.variant) {
          case "one":
          case "chain": {
            ok(q.variant === "one" ? level === 1 && q.rates.length === 1 : level === 2 && q.rates.length === 2, "level");
            ok(Math.abs(q.to - q.from) === q.rates.length, "from one end of the chain to the other");
            // Every valuing that fits the exchanges gives the same count: the answer.
            const vs = valuings(q, 60);
            ok(vs.length > 0, "some valuing fits");
            for (const v of vs) ok(q.count * v[q.from] === q.answer * v[q.to], "every valuing gives the answer");
            ok(pathCounts(q).every((c) => Number.isInteger(c) && c <= 40), "whole counts along the way");
            ok(q.count <= 40 && q.answer <= 40 && q.answer !== q.count, "small, and something changes");
            break;
          }
          case "leftover": {
            ok(level === 3 && q.from === 0 && q.to === 2 && q.rates[1].q === 1, "leftover shape");
            ok(bestByBatches(q) === q.answer, "no way of trading gives more than the answer");
            const { left } = batchTrade(q);
            ok(left[0] + left[1] > 0, "something is left over");
            break;
          }
          case "compare": {
            ok(level === 3 && q.offer !== chainPrice(q) && Number.isInteger(chainPrice(q)), "two different prices");
            ok(cheapest(q) === q.answer, "no mix of the two ways is cheaper");
            ok(q.count >= 2, "more than one wanted");
            break;
          }
        }
      }
      if (level === 3) expect([...seen].sort()).toEqual(["compare", "leftover"]);
    }, 240_000);

  it("names the usual slips", () => {
    const q0 = makeExchangeQuestion(2, 0);
    // 3 apples = 2 pears, 4 pears = 1 melon: 1 melon = 6 apples.
    const c: ExchangeQuestion = { ...q0, variant: "chain", goods: [0, 1, 3], rates: [{ p: 3, q: 2 }, { p: 4, q: 1 }], order: [0, 1], from: 2, to: 0, count: 1, answer: 6 };
    expect(pathCounts(c)).toEqual([1, 4, 6]);
    expect(exchangeMistake(c, 6)).toBe("right");
    expect(exchangeMistake(c, 7)).toBe("added");
    expect(exchangeMistake(c, 4)).toBe("skipLink");
    expect(exchangeMistake(c, 12)).toBe("perOne");
    // 12 apples with 3 apples = 2 pears: 8 pears.
    const o: ExchangeQuestion = { ...c, variant: "one", goods: [0, 1], rates: [{ p: 3, q: 2 }], order: [0], from: 0, to: 1, count: 12, answer: 8 };
    expect(exchangeMistake(o, 18)).toBe("inverted");
    expect(exchangeMistake(o, 11)).toBe("added");
    expect(exchangeMistake(o, 24)).toBe("perOne");
    // 20 apples: 6 batches → 12 pears → 3 melons, 2 apples over.
    const l: ExchangeQuestion = { ...c, variant: "leftover", from: 0, to: 2, count: 20, answer: 3 };
    expect(batchTrade(l)).toEqual({ got: [20, 12, 3], left: [2, 0, 3] });
    expect(exchangeMistake(l, 4)).toBe("roundUp");
    expect(exchangeMistake(l, 12)).toBe("skipLink");
    // 3 melons: the chain costs 6 apples each, the seller 7.
    const m: ExchangeQuestion = { ...c, variant: "compare", from: 0, to: 2, count: 3, offer: 7, answer: 18 };
    expect(exchangeMistake(m, 21)).toBe("dearer");
    expect(exchangeMistake(m, 6)).toBe("forgotCount");
    expect(exchangeMistake(m, 3)).toBe("saving");
  });
});
