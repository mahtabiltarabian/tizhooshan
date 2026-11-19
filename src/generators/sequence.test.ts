import { describe, expect, it } from "vitest";
import {
  ALPHABET,
  candidates,
  diffsOf,
  isAdditive,
  isAlternate,
  isArithmetic,
  isGeometric,
  isSecondOrder,
  letterAt,
  makeSequenceQuestion,
  sequenceMistake,
  slips,
  termsOf,
  type BlankChoice,
  type Level,
  type SequenceQuestion,
  type SequenceQuestionType,
} from "./sequence";

const TYPES: SequenceQuestionType[] = ["arithmetic", "geometric", "alternate", "second", "additive", "letters", "mixed"];
const LEVELS: Level[] = [1, 2, 3];

describe("sequence arithmetic", () => {
  it("builds terms from each kind of rule", () => {
    expect(termsOf({ kind: "step", start: 3, op: "+", by: 4 }, 5)).toEqual([3, 7, 11, 15, 19]);
    expect(termsOf({ kind: "step", start: 50, op: "+", by: -7 }, 4)).toEqual([50, 43, 36, 29]);
    expect(termsOf({ kind: "step", start: 2, op: "×", by: 3 }, 5)).toEqual([2, 6, 18, 54, 162]);
    expect(termsOf({ kind: "step", start: 96, op: "÷", by: 2 }, 6)).toEqual([96, 48, 24, 12, 6, 3]);
    expect(termsOf({ kind: "grow", start: 1, first: 1, growth: 1 }, 6)).toEqual([1, 2, 4, 7, 11, 16]);
    expect(termsOf({ kind: "grow", start: 1, first: 3, growth: 2 }, 5)).toEqual([1, 4, 9, 16, 25]);
    expect(termsOf({ kind: "sum2", a: 1, b: 1 }, 7)).toEqual([1, 1, 2, 3, 5, 8, 13]);
    expect(
      termsOf(
        {
          kind: "alt",
          a: { start: 1, op: "+", by: 2 },
          b: { start: 20, op: "+", by: -3 },
        },
        8,
      ),
    ).toEqual([1, 20, 3, 17, 5, 14, 7, 11]);
    expect(diffsOf([1, 2, 4, 7, 11])).toEqual([1, 2, 3, 4]);
  });

  it("knows the families", () => {
    expect(isArithmetic([5, 8, 11, 14])).toBe(true);
    expect(isArithmetic([2, 4, 8])).toBe(false);
    expect(isGeometric([2, 4, 8, 16])).toBe(true);
    expect(isGeometric([81, 27, 9, 3])).toBe(true);
    expect(isGeometric([3, 3, 3])).toBe(false);
    expect(isSecondOrder([1, 4, 9, 16, 25])).toBe(true);
    expect(isSecondOrder([1, 2, 4, 8, 16])).toBe(false);
    expect(isAdditive([2, 3, 5, 8, 13])).toBe(true);
    expect(isAdditive([2, 4, 6, 8])).toBe(false);
    expect(isAlternate([1, 20, 3, 17, 5, 14, 7, 11])).toBe(true);
    expect(isAlternate([1, 20, 3, 17, 5, 14])).toBe(false);
  });

  it("fills a gap only with what fits every term", () => {
    expect(candidates([3, 7, 11, 15, 19], 4)).toEqual([19]);
    expect(candidates([3, 7, 11, 15, 19], 2)).toEqual([11]);
    expect(candidates([2, 6, 18, 54, 162], 4)).toEqual([162]);
    expect(candidates([1, 1, 2, 3, 5, 8], 1)).toEqual([1]);
    // 2, 4, ?: adding 2 and doubling both fit, so a question shows at least four terms.
    expect(candidates([2, 4, 6], 2)).toEqual([6, 8]);
    expect(candidates([2, 4, 8, 16], 3)).toEqual([16]);
    // Two strands read as arithmetic or geometric: ×2 and +2 differ on the fourth term.
    expect(candidates([1, 30, 2, 27, 4, 24, 8, 21], 6)).toEqual([8]);
  });

  it("numbers the alphabet from ا = ۱ to ی = ۳۲", () => {
    expect(ALPHABET.length).toBe(32);
    expect(new Set(ALPHABET).size).toBe(32);
    expect(letterAt(1)).toBe("ا");
    expect(letterAt(3)).toBe("پ");
    expect(letterAt(32)).toBe("ی");
  });
});

/**
 * Every check a generated question must pass, as a list of what is wrong
 * (plain checks: a million expect() calls are too slow for the sweep).
 */
function problems(q: SequenceQuestion, type: SequenceQuestionType, level: Level, blank: BlankChoice, big: boolean): string[] {
  const bad: string[] = [];
  const need = (ok: boolean, what: string) => {
    if (!ok) bad.push(`${what}: ${JSON.stringify(q)}`);
  };
  const n = q.terms.length;
  need(JSON.stringify(q.terms) === JSON.stringify(termsOf(q.rule, n)), "terms follow the rule");
  need(q.answer === q.terms[q.blank], "answer is the hidden term");
  need(q.blank > 0 && q.blank < n, "gap inside, never first");
  if (blank === "last") need(q.blank === n - 1, "gap last");
  if (blank === "mid") need(q.blank < n - 1, "gap in the middle");
  need(n >= 5, "five terms or more");
  // One answer only, among every family the tool teaches.
  const c = candidates(q.terms, q.blank);
  need(c.length === 1 && c[0] === q.answer, "one answer only");
  const cap = q.letters ? 32 : big ? 9999 : level === 1 ? 200 : level === 2 ? 1000 : 3000;
  need(
    q.terms.every((t) => Number.isInteger(t) && t >= 1 && t <= cap),
    "whole terms in range",
  );
  need(sequenceMistake(q, q.answer) === "right", "answer counts as right");
  need(
    slips(q).every(([, v]) => v === q.answer || sequenceMistake(q, v) !== "other"),
    "every slip is named",
  );

  if (type === "mixed") {
    const allowed = level === 1 ? ["arithmetic", "letters"] : level === 2 ? ["geometric", "alternate", "letters"] : ["second", "additive"];
    need(allowed.includes(q.type), "mixed follows the levels");
  } else need(q.type === type, "type kept");
  need(q.letters === (q.type === "letters"), "letters only in letter questions");

  const r = q.rule;
  switch (q.type) {
    case "arithmetic":
      need(r.kind === "step" && r.op === "+" && r.by !== 0 && isArithmetic(q.terms), "arithmetic");
      if (level === 1) need(diffsOf(q.terms)[0] > 0, "level 1 goes up");
      break;
    case "geometric":
      need(r.kind === "step" && r.op !== "+" && isGeometric(q.terms), "geometric");
      if (level === 1) need(r.kind === "step" && r.op === "×", "level 1 multiplies");
      break;
    case "alternate":
      // Not one plain sequence in disguise.
      need(r.kind === "alt" && n === 8 && isAlternate(q.terms) && !isArithmetic(q.terms) && !isGeometric(q.terms), "two woven strands");
      break;
    case "second":
      need(r.kind === "grow" && r.growth > 0 && isSecondOrder(q.terms) && !isArithmetic(q.terms), "second-order");
      break;
    case "additive":
      need(r.kind === "sum2" && isAdditive(q.terms), "additive");
      break;
    case "letters":
      need(r.kind === "alt" || r.kind === "grow" || (r.kind === "step" && r.op === "+"), "letter rule");
      if (level < 3) need(r.kind === "step", "plain steps below level 3");
      break;
  }
  return bad;
}

describe("sequence questions", () => {
  it("is the same for the same seed and options", () => {
    for (const t of TYPES)
      for (const l of LEVELS) {
        expect(makeSequenceQuestion(t, l, 42)).toEqual(makeSequenceQuestion(t, l, 42));
        expect(makeSequenceQuestion(t, l, 42, { blank: "mid", big: true })).toEqual(makeSequenceQuestion(t, l, 42, { blank: "mid", big: true }));
      }
  });

  it("gives a sound question for 10,000 seeds of every type and level", () => {
    const bad: string[] = [];
    for (const type of TYPES)
      for (const level of LEVELS)
        for (let seed = 0; seed < 10_000; seed++) bad.push(...problems(makeSequenceQuestion(type, level, seed), type, level, "auto", false));
    expect(bad.slice(0, 5)).toEqual([]);
  }, 120_000);

  it("keeps the gap where it is asked for, with small and big numbers", () => {
    const bad: string[] = [];
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const blank of ["last", "mid"] as BlankChoice[])
          for (const big of [false, true])
            for (let seed = 0; seed < 2_000; seed++) bad.push(...problems(makeSequenceQuestion(type, level, seed, { blank, big }), type, level, blank, big));
    expect(bad.slice(0, 5)).toEqual([]);
  }, 120_000);

  it("puts the last term in the gap at level 1 unless asked", () => {
    for (let seed = 0; seed < 500; seed++) {
      const q = makeSequenceQuestion("arithmetic", 1, seed);
      expect(q.blank).toBe(q.terms.length - 1);
    }
  });

  it("names the usual slips", () => {
    const base = { level: 2, seed: 0, letters: false } as const;

    // 50, 43, 36, 29, ? (−7): 29 + 7 goes the wrong way; 15 takes two steps.
    const down: SequenceQuestion = { ...base, type: "arithmetic", rule: { kind: "step", start: 50, op: "+", by: -7 }, terms: [50, 43, 36, 29, 22], blank: 4, answer: 22 };
    expect(sequenceMistake(down, 36)).toBe("wrongWay");
    expect(sequenceMistake(down, 15)).toBe("extraStep");

    // 2, 6, 18, 54, ?: +36 again is 90; +3 is 57.
    const geo: SequenceQuestion = { ...base, type: "geometric", rule: { kind: "step", start: 2, op: "×", by: 3 }, terms: [2, 6, 18, 54, 162], blank: 4, answer: 162 };
    expect(sequenceMistake(geo, 90)).toBe("sameDiff");
    expect(sequenceMistake(geo, 57)).toBe("addFactor");
    // In the middle: halfway between 6 and 54 is 30.
    expect(sequenceMistake({ ...geo, blank: 2, answer: 18 }, 30)).toBe("sameDiff");

    // 1, 2, 4, 7, 11, ?: the last difference again gives 15; one growth off gives 15 too, but 17 is one too many.
    const grow: SequenceQuestion = { ...base, type: "second", rule: { kind: "grow", start: 1, first: 1, growth: 1 }, terms: [1, 2, 4, 7, 11, 16], blank: 5, answer: 16 };
    expect(sequenceMistake(grow, 17)).toBe("secondOff");
    expect(sequenceMistake(grow, 15)).toBe("secondOff");

    // 2, 3, 5, 8, 13, ?: doubling 13 is 26.
    const fib: SequenceQuestion = { ...base, type: "additive", rule: { kind: "sum2", a: 2, b: 3 }, terms: [2, 3, 5, 8, 13, 21], blank: 5, answer: 21 };
    expect(sequenceMistake(fib, 26)).toBe("double");
    expect(sequenceMistake(fib, 18)).toBe("sameDiff");

    // 1, 20, 3, 17, 5, 14, 7, ?: 7 + 2 = 9 carries the wrong strand on.
    const alt: SequenceQuestion = {
      ...base,
      type: "alternate",
      rule: { kind: "alt", a: { start: 1, op: "+", by: 2 }, b: { start: 20, op: "+", by: -3 } },
      terms: [1, 20, 3, 17, 5, 14, 7, 11],
      blank: 7,
      answer: 11,
    };
    expect(sequenceMistake(alt, 9)).toBe("wrongStrand");
    expect(sequenceMistake(alt, 0)).toBe("sameDiff"); // 7 − (14 − 7)
    expect(sequenceMistake(alt, 12)).toBe("other");

    // ا ب پ ت ? (+1): ج is one letter too far.
    const abc: SequenceQuestion = { ...base, type: "letters", letters: true, rule: { kind: "step", start: 1, op: "+", by: 1 }, terms: [1, 2, 3, 4, 5], blank: 4, answer: 5 };
    expect(sequenceMistake(abc, 6)).toBe("offByOne");
    expect(sequenceMistake(abc, 4)).toBe("offByOne");
    expect(sequenceMistake(abc, 5)).toBe("right");
  });
});
