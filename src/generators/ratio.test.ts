import { describe, expect, it } from "vitest";
import {
  answerKind,
  cmpFrac,
  enterable,
  gcd,
  isFrac,
  lcm,
  makeRatioQuestion,
  percentBlocks,
  ratioMistake,
  sameFrac,
  simplest,
  slips,
  WORK_DRAINS,
  WORK_PAIRS,
  WORK_THREES,
  type Level,
  type RatioQuestion,
  type RatioQuestionType,
} from "./ratio";

const TYPES: RatioQuestionType[] = ["shade", "partOf", "compare", "ratio", "divide", "percent", "work"];
const LEVELS: Level[] = [1, 2, 3];
const whole = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v > 0;

describe("fraction arithmetic", () => {
  it("finds common factors and multiples", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 5)).toBe(1);
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(3, 9)).toBe(9);
  });

  it("simplifies and compares", () => {
    expect(simplest({ n: 6, d: 9 })).toEqual({ n: 2, d: 3 });
    expect(sameFrac({ n: 2, d: 4 }, { n: 1, d: 2 })).toBe(true);
    expect(sameFrac({ n: 2, d: 3 }, { n: 3, d: 4 })).toBe(false);
    expect(cmpFrac({ n: 3, d: 4 }, { n: 5, d: 7 })).toBe(1);
    expect(cmpFrac({ n: 2, d: 5 }, { n: 1, d: 2 })).toBe(-1);
    expect(cmpFrac({ n: 4, d: 6 }, { n: 2, d: 3 })).toBe(0);
  });

  it("cuts a percent bar into round blocks", () => {
    expect(percentBlocks(50)).toBe(2);
    expect(percentBlocks(75)).toBe(4);
    expect(percentBlocks(40)).toBe(5);
    expect(percentBlocks(30)).toBe(10);
    expect(percentBlocks(35)).toBe(20);
  });

  it("has work problems with whole hours and tanks of at most 24 cells", () => {
    expect(WORK_PAIRS).toContainEqual([3, 6]);
    expect(WORK_THREES).toContainEqual([2, 3, 6]);
    expect(WORK_DRAINS).toContainEqual([3, 4]);
    for (const [a, b] of WORK_PAIRS) expect(((a * b) / (a + b)) % 1).toBe(0);
    for (const [a, b] of WORK_DRAINS) expect(((a * b) / (b - a)) % 1).toBe(0);
    for (const [a, b, c] of WORK_THREES) expect(((a * b * c) / (a * b + b * c + c * a)) % 1).toBe(0);
  });
});

/** A plain check: the sweep makes millions of them, too many for expect(). */
function must(ok: boolean, what: string): asserts ok {
  if (!ok) throw new Error(what);
}

/** Solve each question again the slow way, block by block or hour by hour. */
function check(q: RatioQuestion) {
  switch (q.type) {
    case "shade": {
      must(q.parts >= 2, "q.parts >= 2");
      must(q.parts <= 16, "q.parts <= 16");
      must(q.answer > 0, "q.answer > 0");
      must(q.answer < q.parts, "q.answer < q.parts");
      must(sameFrac({ n: q.answer, d: q.parts }, q.frac) === true, "sameFrac({ n: q.answer, d: q.parts }, q.frac) === true");
      if (q.level === 1) must(q.parts === q.frac.d, "q.parts === q.frac.d");
      if (q.level === 2) must(q.parts % q.frac.d === 0, "q.parts % q.frac.d === 0");
      if (q.level > 1) must(q.parts !== q.frac.d, "q.parts !== q.frac.d");
      break;
    }
    case "partOf": {
      const { frac: f } = q;
      must(f.n < f.d, "f.n < f.d");
      must(gcd(f.n, f.d) === 1, "gcd(f.n, f.d) === 1");
      must(q.whole === f.d * q.unit, "q.whole === f.d * q.unit");
      must(q.part * f.d === q.whole * f.n, "q.part * f.d === q.whole * f.n");
      must(q.whole <= 120, "q.whole <= 120");
      if (q.level === 1) must(f.n === 1, "f.n === 1");
      if (q.variant === "rest") must(q.answer === q.whole - q.part, "q.answer === q.whole - q.part");
      if (q.variant === "whole") must(q.answer === q.whole, "q.answer === q.whole");
      break;
    }
    case "compare": {
      const [f, g] = q.fracs;
      for (const x of [f, g]) {
        must(x.n > 0, "x.n > 0");
        must(x.n < x.d, "x.n < x.d");
        must(x.d <= 12, "x.d <= 12");
      }
      must((f.n / f.d > g.n / g.d ? 0 : f.n / f.d < g.n / g.d ? 1 : 2) === q.answer, "bigger fraction");
      if (q.level === 1) must(f.n === g.n || f.d === g.d, "same top or bottom");
      if (q.level === 1 || q.level === 3) must(q.answer !== 2, "q.answer !== 2");
      if (q.level === 2) must(Math.max(f.d, g.d) % Math.min(f.d, g.d) === 0, "Math.max(f.d, g.d) % Math.min(f.d, g.d) === 0");
      if (q.level === 3) must(Boolean(f.d % g.d && g.d % f.d) && f.n !== g.n, "level 3: unrelated bottoms, different tops");
      break;
    }
    case "ratio": {
      const [a, b] = q.ratio;
      must(a !== b, "a !== b");
      must(gcd(a, b) === 1, "gcd(a, b) === 1");
      // Count block by block.
      let first = 0;
      let second = 0;
      for (let i = 0; i < q.k; i++) [first, second] = [first + a, second + b];
      must(q.answer === (q.variant === "other" ? second : q.variant === "total" ? first + second : first), "ratio answer");
      if (q.variant === "diff") must(b > a, "b > a");
      must(q.variant === (q.level === 1 ? "other" : q.level === 3 ? "diff" : q.variant), "ratio variant");
      must(q.answer <= 120, "q.answer <= 120");
      break;
    }
    case "divide": {
      must(q.ratio.length === (q.level === 3 ? 3 : 2), "people");
      // Deal out the total one round at a time.
      const shares = q.ratio.map(() => 0);
      let left = q.total;
      while (left > 0) q.ratio.forEach((r, i) => ((shares[i] += r), (left -= r)));
      must(left === 0, "left === 0");
      must(shares[q.ask] === q.answer, "shares[q.ask] === q.answer");
      must(q.total <= 120, "q.total <= 120");
      break;
    }
    case "percent": {
      must(q.pct % 5 === 0, "q.pct % 5 === 0");
      must(q.pct > 0, "q.pct > 0");
      must(q.pct < 100, "q.pct < 100");
      must(q.part * 100 === q.whole * q.pct, "q.part * 100 === q.whole * q.pct");
      must(whole(q.part) === true, "whole(q.part) === true");
      // Each block of the bar is a whole number.
      must(q.whole % percentBlocks(q.pct) === 0, "q.whole % percentBlocks(q.pct) === 0");
      must(q.whole <= 200, "q.whole <= 200");
      if (q.level === 1) must([50, 25, 75, 10, 20].includes(q.pct), "[50, 25, 75, 10, 20] has q.pct");
      if (q.level === 1) must(q.variant === "of", "percent of");
      if (q.level === 3) must(["whole", "what", "up"].includes(q.variant), "percent level 3");
      break;
    }
    case "work": {
      const t = q.times;
      if (q.variant === "single") {
        must(q.level === 1, "q.level === 1");
        must(q.hours < t[0], "q.hours < t[0]");
        must(JSON.stringify(q.answer) === JSON.stringify({ n: q.hours, d: t[0] }), "q.answer equals { n: q.hours, d: t[0] }");
      } else if (q.variant === "crew") {
        const [w1, d, w2] = q.crew;
        must(w1 * d === (q.answer as number) * w2, "w1 * d === (q.answer as number) * w2");
        must(w1 !== w2, "w1 !== w2");
      } else {
        // Fill hour by hour in cells of a tank of lcm(times) cells.
        const cells = t.reduce(lcm, 1);
        must(cells <= 24, "cells <= 24");
        const perHour = t.map((x) => cells / x);
        const net = q.variant === "drain" ? perHour[0] - perHour[1] : perHour.reduce((s, x) => s + x, 0);
        must(net > 0, "net > 0");
        if (q.variant === "pairFraction") must(sameFrac(q.answer as { n: number; d: number }, { n: net, d: cells }) === true, "sameFrac(q.answer as { n: number; d: number }, { n: net, d: cells }) === true");
        else {
          let filled = 0;
          let hours = 0;
          while (filled < cells) [filled, hours] = [filled + net, hours + 1];
          must(filled === cells, "filled === cells");
          must(hours === q.answer, "hours === q.answer");
        }
      }
      if (q.level === 3) must(["drain", "three"].includes(q.variant), "work level 3");
      break;
    }
  }
}

/** A hand-made question, typed (keeps "compare" a literal, tuples mutable). */
const Q = <T extends RatioQuestion>(q: T) => q;

describe("ratio questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makeRatioQuestion(t, l, 42)).toEqual(makeRatioQuestion(t, l, 42));
  });

  it("gives a sound question for 10,000 seeds of every type and level", () => {
    for (const type of TYPES)
      for (const level of LEVELS) {
        const seen = new Set<string>();
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makeRatioQuestion(type, level, seed);
          try {
            must(q.type === type && q.level === level, "type and level");
            must(ratioMistake(q, q.answer) === "right", "answer is right");
            // Answers a child can enter: whole numbers up to 3 digits, or a fraction with 2-digit parts.
            const kind = answerKind(q);
            if (kind === "fraction") {
              must(isFrac(q.answer) && enterable(q.answer) && q.answer.n < 100 && q.answer.d < 100, "fraction answer");
            } else {
              must(!isFrac(q.answer) && (whole(q.answer) || (kind === "choice" && q.answer === 0)) && q.answer < 1000, "whole answer");
            }
            // No slip may be the right answer and still count as a slip.
            for (const [, v] of slips(q)) if (enterable(v) && ratioMistake(q, v) !== "right") must(ratioMistake(q, v) !== "other", "slip is named");
            check(q);
          } catch (e) {
            throw new Error(`${(e as Error).message}: ${JSON.stringify(q)}`);
          }
          seen.add(JSON.stringify({ ...q, seed: 0 }));
        }
        // Plenty of different questions.
        expect(seen.size).toBeGreaterThan(type === "shade" && level === 1 ? 15 : 20);
      }
  }, 120_000);

  it("names the usual slips", () => {
    const shade = Q({ type: "shade", level: 2, seed: 0, shape: "bar", parts: 8, frac: { n: 3, d: 4 }, answer: 6 });
    expect(ratioMistake(shade, 3)).toBe("numeratorOnly");
    expect(ratioMistake(shade, 2)).toBe("complement");
    expect(ratioMistake(shade, 4)).toBe("denominator");

    const of = Q({ type: "partOf", level: 2, seed: 0, variant: "of", frac: { n: 3, d: 4 }, whole: 20, part: 15, unit: 5, item: 0, answer: 15 });
    expect(ratioMistake(of, 5)).toBe("onePart");
    expect(ratioMistake(of, 5 + 1)).toBe("other");
    const rest = Q({ ...of, variant: "rest", answer: 5 });
    expect(ratioMistake(rest, 15)).toBe("usedPart");
    // 3/5 of a number is 18: the number is 30, not 18 × 3/5 or 6 or 12.
    const back = Q({ type: "partOf", level: 3, seed: 0, variant: "whole", frac: { n: 3, d: 5 }, whole: 30, part: 18, unit: 6, item: 0, answer: 30 });
    expect(ratioMistake(back, 6)).toBe("onePart");
    expect(ratioMistake(back, 12)).toBe("restOnly");

    // 1/3 against 1/5: the bigger denominator is the smaller fraction.
    const cmp = Q({ type: "compare", level: 1, seed: 0, fracs: [{ n: 1, d: 3 }, { n: 1, d: 5 }], answer: 0 });
    expect(ratioMistake(cmp, 1)).toBe("biggerDenominator");
    // 3/4 against 4/7: more pieces is not more.
    const cmp3 = Q({ type: "compare", level: 3, seed: 0, fracs: [{ n: 3, d: 4 }, { n: 4, d: 7 }], answer: 0 });
    expect(ratioMistake(cmp3, 1)).toBe("biggerDenominator");
    // 2/3 against 4/5: one piece missing from each, but not equal.
    const cmpGap = Q({ type: "compare", level: 3, seed: 0, fracs: [{ n: 2, d: 3 }, { n: 4, d: 5 }], answer: 1 });
    expect(ratioMistake(cmpGap, 2)).toBe("gap");
    const cmpEq = Q({ type: "compare", level: 2, seed: 0, fracs: [{ n: 2, d: 3 }, { n: 4, d: 6 }], answer: 2 });
    expect(ratioMistake(cmpEq, 1)).toBe("notEqual");

    // 2 : 3 and 8 of the first: 12, not 9 (adding the difference).
    const ratio = Q({ type: "ratio", level: 1, seed: 0, variant: "other", ratio: [2, 3], k: 4, things: 0, answer: 12 });
    expect(ratioMistake(ratio, 9)).toBe("addDifference");
    expect(ratioMistake(ratio, 4)).toBe("onePart");
    const diff = Q({ ...ratio, level: 3, variant: "diff", ratio: [2, 5], k: 3, answer: 6 });
    expect(ratioMistake(diff, 3)).toBe("onePart");
    expect(ratioMistake(diff, 15)).toBe("otherPart");
    expect(ratioMistake(diff, 21)).toBe("total");
    expect(ratioMistake(diff, 9)).toBe("usedDifference");

    const divide = Q({ type: "divide", level: 2, seed: 0, ratio: [2, 3], k: 6, total: 30, ask: 1, item: 0, answer: 18 });
    expect(ratioMistake(divide, 15)).toBe("equalSplit");
    expect(ratioMistake(divide, 12)).toBe("otherPart");
    expect(ratioMistake(divide, 10)).toBe("dividedByPart");

    const off = Q({ type: "percent", level: 2, seed: 0, variant: "off", pct: 25, whole: 80, part: 20, item: 0, answer: 60 });
    expect(ratioMistake(off, 20)).toBe("usedPart");
    expect(ratioMistake(off, 55)).toBe("subtractedPercent");
    const what = Q({ type: "percent", level: 3, seed: 0, variant: "what", pct: 25, whole: 48, part: 12, item: 0, answer: 25 });
    expect(ratioMistake(what, 12)).toBe("partAsPercent");
    expect(ratioMistake(what, 400)).toBe("swapped");

    const base = { type: "work" as const, seed: 0, ctx: "tap" as const, hours: 0, times: [] as number[], crew: [] as number[] };
    // 1/3 + 1/6 = 1/2, not 2/9 (adding tops and bottoms) or 1/9.
    const frac = Q({ ...base, level: 2, variant: "pairFraction", times: [3, 6], answer: { n: 9, d: 18 } });
    expect(ratioMistake(frac, { n: 1, d: 2 })).toBe("right");
    expect(ratioMistake(frac, { n: 3, d: 6 })).toBe("right");
    expect(ratioMistake(frac, { n: 2, d: 9 })).toBe("addedParts");
    expect(ratioMistake(frac, { n: 1, d: 9 })).toBe("addedTimes");
    const pair = Q({ ...base, level: 2, variant: "pair", times: [3, 6], answer: 2 });
    expect(ratioMistake(pair, 9)).toBe("addedTimes");
    const drain = Q({ ...base, level: 3, variant: "drain", times: [3, 4], answer: 12 });
    expect(ratioMistake(drain, 1)).toBe("subtractedTimes");
    const crew = Q({ ...base, level: 2, variant: "crew", ctx: "worker", crew: [6, 10, 4], answer: 15 });
    expect(ratioMistake(crew, 8)).toBe("additive");
    // 6 workers take 10 days, so 4 take 15: not "2 fewer workers, 2 fewer days". With 2 → 3 workers, 6 × 3 ÷ 2 = 9 treats it as direct.
    const crew2 = Q({ ...crew, crew: [2, 6, 3], answer: 4 });
    expect(ratioMistake(crew2, 9)).toBe("direct");
  });
});
