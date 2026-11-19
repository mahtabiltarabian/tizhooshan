import { describe, expect, it } from "vitest";
import {
  makeNthQuestion,
  nthMistake,
  nthSlips,
  patternCount,
  patternShape,
  PATTERNS,
  ruleParts,
  ruleValue,
  termAt,
  type Level,
  type NthQuestion,
  type PatternKind,
} from "./nth-term";

const LEVELS: Level[] = [1, 2, 3];

/** Term n by adding the step again and again, independent of the formula. */
function slowTerm(first: number, step: number, n: number) {
  let t = first;
  for (let k = 1; k < n; k++) t += step;
  return t;
}

function problems(q: NthQuestion, level: Level): string[] {
  const bad: string[] = [];
  const need = (ok: boolean, what: string) => {
    if (!ok) bad.push(`${what}: ${JSON.stringify(q)}`);
  };
  need(q.type === "nth" && q.level === level, "type and level");
  need(q.step > 0 && q.first > 0, "positive first term and step");

  switch (q.variant) {
    case "far":
    case "pattern":
      need(q.answer === slowTerm(q.first, q.step, q.n), "answer by adding step by step");
      need(q.n > q.shown + 5, "the asked term is far past the row");
      if (q.pattern) {
        need(q.first === PATTERNS[q.pattern].first && q.step === PATTERNS[q.pattern].step, "pattern numbers");
        for (let k = 1; k <= q.shown; k++) need(patternCount(q.pattern, k) === slowTerm(q.first, q.step, k), "drawn shapes have the stated counts");
        need(patternCount(q.pattern, q.n) === q.answer, "shape n, drawn, has the answer's count");
      }
      break;
    case "which": {
      // Only one place holds the value.
      const places = Array.from({ length: 500 }, (_, k) => k + 1).filter((k) => slowTerm(q.first, q.step, k) === q.value);
      need(places.length === 1 && places[0] === q.answer, "one place holds the value");
      need(q.answer > q.shown + 5, "the place is far past the row");
      break;
    }
    case "meet": {
      const places = Array.from({ length: 500 }, (_, k) => k + 1).filter((k) => slowTerm(q.first, q.step, k) === slowTerm(q.first2, q.step2, k));
      need(places.length === 1 && places[0] === q.answer, "the two sequences meet at one place only");
      need(q.answer > q.shown, "they do not meet inside the row shown");
      need(q.value === slowTerm(q.first, q.step, q.answer), "common value");
      need(q.first2 > q.first && q.step > q.step2 && q.step2 > 0, "▲ starts higher, ● catches up");
      break;
    }
    case "rule": {
      const { coef, constant } = ruleParts(q.answer);
      for (let k = 1; k <= 60; k++) need(coef * k + constant === slowTerm(q.first, q.step, k), "rule gives every term");
      // Brute force over every pair of boxes that fits the pad: one pair matches the terms shown.
      let fits = 0;
      for (let c = 0; c <= 99; c++) for (let e = 0; e <= 99; e++) if (Array.from({ length: q.shown }, (_, k) => k + 1).every((k) => c * k + e === slowTerm(q.first, q.step, k))) fits++;
      need(fits === 1, "one rule fits the terms shown");
      need(coef >= 2 && coef <= 9 && constant >= 1 && constant <= 12, "small boxes");
      break;
    }
  }

  if (q.variant !== "rule") need(Number.isInteger(q.answer) && q.answer > 0 && q.answer < 1000, "answer fits the pad");
  need(nthMistake(q, q.answer) === "right", "answer counts as right");
  const slips = nthSlips(q);
  need(
    slips.every(([tag, v]) => v !== q.answer && nthMistake(q, v) === tag),
    "every slip is its own number and is named",
  );

  if (level === 1) need(q.variant === "far" && q.n >= 10 && q.n <= 30 && q.first !== q.step, "level 1: far term, n 10 … 30");
  if (level === 2) need(q.variant === "which" || q.variant === "pattern", "level 2: which term, or a pattern");
  if (level === 3) need(q.variant === "rule" || q.variant === "meet", "level 3: rule or meet");
  return bad;
}

describe("nth term arithmetic", () => {
  it("counts n − 1 jumps", () => {
    // 3, 7, 11, …: term 20 = 3 + 19 × 4 = 79.
    expect(termAt(3, 4, 20)).toBe(79);
    expect(termAt(3, 4, 1)).toBe(3);
    expect(ruleParts(ruleValue(4, 12))).toEqual({ coef: 4, constant: 12 });
  });

  it("draws each pattern with the stated number of sticks or tiles", () => {
    for (const kind of Object.keys(PATTERNS) as PatternKind[]) {
      const { first, step, tiles } = PATTERNS[kind];
      for (let k = 1; k <= 30; k++) {
        const s = patternShape(kind, k);
        expect(patternCount(kind, k)).toBe(first + (k - 1) * step);
        expect(tiles ? s.sticks.length : s.tiles.length).toBe(0);
        // Everything lies inside the stated box.
        for (const st of s.sticks) {
          for (const v of [st[0], st[2]]) expect(v >= 0 && v <= s.width + 1e-9).toBe(true);
          for (const v of [st[1], st[3]]) expect(v >= 0 && v <= s.height + 1e-9).toBe(true);
        }
        for (const [x, y] of s.tiles) expect(x >= 0 && x < s.width && y >= 0 && y < s.height).toBe(true);
        // No tile twice.
        expect(new Set(s.tiles.map((t) => t.join())).size).toBe(s.tiles.length);
      }
    }
  });

  it("names the usual slips", () => {
    const far: NthQuestion = { type: "nth", level: 1, seed: 0, variant: "far", first: 3, step: 4, first2: 0, step2: 0, pattern: null, shown: 4, n: 20, value: 0, answer: 79 };
    expect(nthMistake(far, 79)).toBe("right");
    expect(nthMistake(far, 83)).toBe("nJumps");
    expect(nthMistake(far, 75)).toBe("offByOne");
    expect(nthMistake(far, 60)).toBe("timesFirst");
    expect(nthMistake(far, 80)).toBe("timesStep");
    expect(nthMistake(far, 76)).toBe("noStart");
    expect(nthMistake(far, 50)).toBe("other");
    // 5, 8, 11, …: 95 is term 31; (95 − 5) ÷ 3 = 30 forgets the +1.
    const which: NthQuestion = { ...far, level: 2, variant: "which", first: 5, step: 3, n: 31, value: 95, answer: 31 };
    expect(nthMistake(which, 30)).toBe("reverseOff");
    expect(nthMistake(which, 32)).toBe("offByOne");
    // 7, 10, 13, …: 3 × n + 4.
    const rule: NthQuestion = { ...far, level: 3, variant: "rule", first: 7, step: 3, n: 0, answer: ruleValue(3, 4) };
    expect(nthMistake(rule, ruleValue(3, 4))).toBe("right");
    expect(nthMistake(rule, ruleValue(3, 7))).toBe("nJumps");
    expect(nthMistake(rule, ruleValue(3, 0))).toBe("noStart");
    expect(nthMistake(rule, ruleValue(7, 0))).toBe("timesFirst");
    expect(nthMistake(rule, ruleValue(7, 2))).toBe("timesFirst");
    expect(nthMistake(rule, ruleValue(4, 3))).toBe("swapped");
    expect(nthMistake(rule, ruleValue(3, 5))).toBe("constant");
    // ● 2, 8, 14 … and ▲ 22, 26, 30 …: equal at term 11 (62).
    const meet: NthQuestion = { ...far, level: 3, variant: "meet", first: 2, step: 6, first2: 22, step2: 4, shown: 3, n: 11, value: 62, answer: 11 };
    expect(nthMistake(meet, 10)).toBe("reverseOff");
    expect(nthMistake(meet, 62)).toBe("value");
  });
});

describe("nth term questions", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeNthQuestion(l, 42)).toEqual(makeNthQuestion(l, 42));
  });

  it("gives a sound question with one answer for 10,000 seeds of every level", () => {
    const bad: string[] = [];
    const seen = new Map<string, number>();
    const patterns = new Set<string>();
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeNthQuestion(level, seed);
        const key = `${level}-${q.variant}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
        if (q.pattern) patterns.add(q.pattern);
        bad.push(...problems(q, level));
      }
    expect(bad.slice(0, 5)).toEqual([]);
    expect([...seen.keys()].sort()).toEqual(["1-far", "2-pattern", "2-which", "3-meet", "3-rule"]);
    // Each variant of a level comes up often enough to be practised.
    for (const [key, count] of seen) if (!key.startsWith("1-")) expect(count).toBeGreaterThan(3500);
    expect(patterns.size).toBe(Object.keys(PATTERNS).length);
  }, 240_000);
});
