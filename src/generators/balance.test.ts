import { describe, expect, it } from "vitest";
import {
  balanceMistake,
  blocksFor,
  coinWeighings,
  determinant,
  isBalanced,
  makeBalanceQuestion,
  minWeighings,
  panWeight,
  slips,
  solutions,
  solveSteps,
  stagesOf,
  symCount,
  type AgeQuestion,
  type BalanceQuestion,
  type BalanceQuestionType,
  type FillQuestion,
  type Level,
  type Pan,
  type Scale,
} from "./balance";

const TYPES: BalanceQuestionType[] = ["balance", "fill", "coin", "age"];
const LEVELS: Level[] = [1, 2, 3];
const pan = (s: number[], k = 0): Pan => ({ s, k });
const scale = (left: Pan, right: Pan): Scale => ({ left, right });

/** Every positive weighing in a small range that fits the scales gives the same value. */
function determined(scales: Scale[], n: number, value: (w: number[]) => number, max: number) {
  const sols = solutions(scales, n, max);
  return sols.length > 0 && sols.every((w) => value(w) === value(sols[0])) ? value(sols[0]) : null;
}

describe("balance arithmetic", () => {
  it("weighs pans and checks balance", () => {
    const sc = scale(pan([3], 2), pan([1], 10));
    expect(panWeight(sc.left, [4])).toBe(14);
    expect(isBalanced(sc, [4])).toBe(true);
    expect(isBalanced(sc, [5])).toBe(false);
    expect(solutions([sc], 1, 20)).toEqual([[4]]);
  });

  it("finds the determinant of 1, 2 and 3 scales", () => {
    expect(determinant([scale(pan([3]), pan([1], 8))], 1)).toBe(2);
    expect(determinant([scale(pan([0, 1]), pan([2, 0])), scale(pan([1, 1]), pan([0, 0], 12))], 2)).toBe(-3);
    const three = [scale(pan([0, 1, 0]), pan([2, 0, 0])), scale(pan([0, 0, 1]), pan([0, 1, 0], 1)), scale(pan([1, 1, 1]), pan([0, 0, 0], 21))];
    expect(determinant(three, 3)).not.toBe(0);
    expect(solutions(three, 3, 20)).toEqual([[4, 8, 9]]);
  });

  it("solves step by step: take off both pans, split, substitute", () => {
    // ●●● + 2 = ● + 10  →  ●● = 8  →  ● = 4
    const r = solveSteps([scale(pan([3], 2), pan([1], 10))], 1, (_, k) => k[0] !== null);
    expect(r.stages.map((s) => s.step.op)).toEqual(["remove", "divide"]);
    expect(r.known[0]).toBe(4);
    // ▲ = ●●, ▲ + ● = 12  →  ●●● = 12  →  ● = 4, ▲ = 8
    const two = solveSteps([scale(pan([0, 1]), pan([2, 0])), scale(pan([1, 1]), pan([0, 0], 12))], 2, (_, k) => k[1] !== null);
    expect(two.stages[0].step.op).toBe("define");
    expect(two.known).toEqual([4, 8]);
  });

  it("splits groups of coins into three", () => {
    expect(minWeighings(3)).toBe(1);
    expect(minWeighings(4)).toBe(2);
    expect(minWeighings(9)).toBe(2);
    expect(minWeighings(10)).toBe(3);
    expect(minWeighings(27)).toBe(3);
    expect(minWeighings(28)).toBe(4);
    // 8 coins, the light one is coin 7: 3 v 3, then 1 v 1.
    const w = coinWeighings(8, 7, false);
    expect(w).toHaveLength(2);
    expect(w[0].tilt).toBe(0);
    expect(w[1].tilt).toBe(-1);
  });

  it("makes blocks for a total", () => {
    expect(blocksFor(18)).toEqual([10, 5, 2, 1]);
    expect(blocksFor(0)).toEqual([]);
  });
});

describe("balance questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makeBalanceQuestion(t, l, 42)).toEqual(makeBalanceQuestion(t, l, 42));
  });

  // Plain checks, not expect(): the sweep makes millions of them.
  for (const type of TYPES)
    for (const level of LEVELS)
      it(`gives a sound ${type} question for 10,000 seeds at level ${level}`, () => {
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makeBalanceQuestion(type, level, seed);
          const ok = (cond: boolean, what: string) => {
            if (!cond) throw new Error(`${type} level ${level} seed ${seed}: ${what}
${JSON.stringify(q)}`);
          };
          ok(balanceMistake(q, q.answer) === "right", "answer is right");
          ok(Number.isInteger(q.answer) && q.answer > 0, "answer is a positive whole number");
          // No slip may be the right answer and still count as a slip.
          for (const [, v] of slips(q)) if (v !== q.answer) ok(balanceMistake(q, v) !== "other", `slip ${v} is named`);

          switch (q.type) {
            case "balance":
              checkBalance(q, ok);
              break;
            case "fill":
              checkFill(q, ok);
              break;
            case "coin": {
              ok(q.answer === (q.variant === "min" ? minWeighings(q.n) : 3 ** q.k), "coin answer");
              if (q.variant === "min") {
                if (level === 1) ok(q.n >= 3 && q.n <= 9 && !q.heavy, "level 1: up to 9 coins, a light fake");
                ok(q.answer <= 5, "small answer");
              } else ok(level === 3, "max only at level 3");
              // The strategy never needs more than k weighings, and some coin needs all k.
              const k = q.variant === "min" ? q.answer : q.k;
              let worst = 0;
              for (let f = 0; f < q.n; f++) {
                const path = coinWeighings(q.n, f, q.heavy);
                worst = Math.max(worst, path.length);
                // Following the tilts ends on the fake.
                const last = path[path.length - 1];
                const [lo, hi] = last.tilt === 0 ? last.c : (last.tilt === 1) === q.heavy ? last.b : last.a;
                ok(lo === f && hi === f + 1, `strategy finds coin ${f}`);
              }
              ok(worst === k, "worst case is the answer");
              break;
            }
            case "age":
              checkAge(q, ok);
              break;
          }
        }
      }, 120_000);

  it("names the usual slips", () => {
    // ●●● + 2 = ● + 10: ● = 4.
    const one: BalanceQuestion = { type: "balance", level: 1, seed: 0, n: 1, scales: [scale(pan([3], 2), pan([1], 10))], weights: [4], ask: 0, answer: 4 };
    expect(balanceMistake(one, 4)).toBe("right");
    expect(balanceMistake(one, 5)).toBe("noSubtract");
    expect(balanceMistake(one, 8)).toBe("noDivide");
    expect(balanceMistake(one, 7)).toBe("other");
    // ●●● = ● + 12: forgetting the ● on the other pan gives 12 / 3.
    const both2: BalanceQuestion = { ...one, scales: [scale(pan([3], 0), pan([1], 12))], weights: [6], answer: 6 };
    expect(balanceMistake(both2, 4)).toBe("oneSide");

    const fill: FillQuestion = {
      type: "fill",
      level: 2,
      seed: 0,
      n: 2,
      scales: [scale(pan([0, 1]), pan([3, 0]))],
      weights: [1, 3],
      target: pan([1, 2]),
      fillWith: 0,
      answer: 7,
    };
    expect(balanceMistake(fill, 3)).toBe("count");
    expect(balanceMistake(fill, 6)).toBe("forgotOnes");

    const coin = { type: "coin", level: 2, seed: 0, variant: "min", n: 27, heavy: false, k: 3, fake: 0, answer: 3 } as const;
    expect(balanceMistake(coin, 5)).toBe("halves");
    expect(balanceMistake(coin, 4)).toBe("boundary");
    expect(balanceMistake(coin, 13)).toBe("pairs");
    expect(balanceMistake({ ...coin, variant: "max", n: 27, answer: 27 }, 8)).toBe("halves");
    expect(balanceMistake({ ...coin, variant: "max", n: 27, answer: 27 }, 9)).toBe("times");

    const age: AgeQuestion = { type: "age", level: 1, seed: 0, variant: "sumDiff", older: "a", younger: "b", young: 8, old: 12, times: 1, laterTimes: 1, years: 0, askOlder: false, answer: 8 };
    expect(balanceMistake(age, 12)).toBe("otherPerson");
    expect(balanceMistake(age, 10)).toBe("half");
    expect(balanceMistake(age, 16)).toBe("noHalf");
    const later: AgeQuestion = { ...age, level: 3, variant: "later", young: 12, old: 48, times: 4, laterTimes: 3, years: 6, answer: 12 };
    expect(balanceMistake(later, 18)).toBe("later");
  });
});

type Ok = (cond: boolean, what: string) => void;

function checkBalance(q: BalanceQuestion, ok: Ok) {
  ok(q.scales.length === q.level && q.n === q.level, "level = scales = unknowns");
  for (const sc of q.scales) {
    ok(isBalanced(sc, q.weights), "every scale balances");
    for (const p of [sc.left, sc.right]) ok(symCount(p) <= 6 && p.k >= 0 && p.k <= 40 && symCount(p) + p.k > 0, "pan fits");
  }
  ok(determinant(q.scales, q.n) !== 0, "unique over all numbers");
  // Enumeration: only one weighing in 1 … 15 fits, and it is ours.
  const sols = solutions(q.scales, q.n, 15);
  ok(sols.length === 1 && sols[0].every((v, i) => v === q.weights[i]), "enumeration finds exactly our weights");
  ok(q.answer <= 15 && new Set(q.weights).size === q.n, "small, different weights");
  // The step solver gets there.
  ok(stagesOf(q).known[q.ask] === q.answer, "solver reaches the answer");
}

function checkFill(q: FillQuestion, ok: Ok) {
  for (const sc of q.scales) ok(isBalanced(sc, q.weights), "every scale balances");
  if (q.fillWith === null) {
    ok(q.scales.length === q.level, "level = scales");
    ok(q.answer === panWeight(q.target, q.weights) && q.answer <= 40, "answer is the target's weight");
    ok(determined(q.scales, q.n, (w) => panWeight(q.target, w), 15) === q.answer, "enumeration: the target weight is fixed");
  } else {
    // Symbols only: the scales fix the ratio, so the count of circles is the same for every weighing.
    ok(q.level > 1 && q.scales.length === q.level - 1, "symbolic: level − 1 scales");
    ok(q.scales.every((sc) => sc.left.k === 0 && sc.right.k === 0) && q.target.k === 0, "no numbers");
    const f = q.fillWith;
    ok(determined(q.scales, q.n, (w) => panWeight(q.target, w) / w[f], 12) === q.answer, "enumeration: the count is fixed");
    ok(q.answer <= 14, "small count");
  }
  const r = stagesOf(q);
  const last = r.scales[r.scales.length - 1].left;
  if (q.fillWith === null) ok(symCount(last) === 0 && last.k === q.answer, "solver reaches the total");
  else ok(last.k === 0 && last.s.every((c, j) => (j === q.fillWith ? c === q.answer : c === 0)), "solver reaches the count");
}

function checkAge(q: AgeQuestion, ok: Ok) {
  ok(q.old > q.young && q.young > 0, "ages");
  // Enumerate the younger age now: the conditions in the question fit only one.
  const fits = (y: number) => {
    switch (q.variant) {
      case "sumDiff":
        return 2 * y + (q.old - q.young) === q.old + q.young;
      case "timesSum":
        return q.times * y + y === q.old + q.young;
      case "timesDiff":
        return q.times * y - y === q.old - q.young;
      case "later":
        return q.times * y + q.years === q.laterTimes * (y + q.years);
    }
  };
  const ys = Array.from({ length: 120 }, (_, i) => i + 1).filter(fits);
  ok(ys.length === 1 && ys[0] === q.young, "one age fits");
  ok(q.answer === (q.askOlder ? q.old : q.young), "answer is the asked age");
  if (q.level === 1) ok(q.variant === "sumDiff", "level 1 variant");
  if (q.level === 2) ok(q.variant === "timesSum" || q.variant === "timesDiff", "level 2 variant");
  if (q.level === 3) ok(q.variant === "later" && q.old + q.years === q.laterTimes * (q.young + q.years), "level 3 variant");
}
