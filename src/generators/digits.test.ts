import { describe, expect, it } from "vitest";
import {
  answerKey,
  answerKind,
  bitCount,
  countDigit,
  DIGIT_STICKS,
  digitsMistake,
  digitSum,
  digitSumAnswer,
  EQUALS,
  extremes,
  fillers,
  glyphOf,
  makeDigitsQuestion,
  matchPool,
  meets,
  MINUS,
  numbersWith,
  placeCounts,
  PLUS,
  readEquation,
  slips,
  slotKinds,
  stickDiff,
  type DigitsQuestion,
  type DigitsQuestionType,
  type Level,
} from "./digits";

const TYPES: DigitsQuestionType[] = ["extreme", "condition", "count", "digitSum", "divisible", "match"];
const LEVELS: Level[] = [1, 2, 3];

/** Every number with `use` digits whose digits come from the cards — by counting, not arranging. */
const built = new Map<string, number[]>();
function bruteBuilt(cards: number[], use: number) {
  const key = `${[...cards].sort().join("")}-${use}`;
  const hit = built.get(key);
  if (hit) return hit;
  const out: number[] = [];
  for (let n = use === 1 ? 0 : 10 ** (use - 1); n < 10 ** use; n++) {
    const left = [...cards];
    if (String(n).split("").every((ch) => {
      const i = left.indexOf(Number(ch));
      if (i < 0) return false;
      left.splice(i, 1);
      return true;
    }))
      out.push(n);
  }
  built.set(key, out);
  return out;
}

/**
 * Every arrangement one or two moves away, stick by stick: lift k sticks
 * from anywhere (the "=" too) and lay them on k empty spots, any of the 7
 * spots of any slot. Two single moves that chain or undo each other are one
 * move or none, so lifting k and placing k covers exactly the k-move results.
 */
function bruteMoves(start: number[], k: 1 | 2) {
  const spots: [number, number][] = [];
  start.forEach((_, i) => {
    for (let b = 0; b < 7; b++) spots.push([i, 1 << b]);
  });
  const full = spots.filter(([i, bit]) => start[i] & bit);
  const empty = spots.filter(([i, bit]) => !(start[i] & bit));
  const groups = (list: [number, number][]) => (k === 1 ? list.map((x) => [x]) : list.flatMap((x, i) => list.slice(i + 1).map((y) => [x, y])));
  const out: number[][] = [];
  for (const lift of groups(full))
    for (const put of groups(empty)) {
      const m = [...start];
      for (const [i, bit] of lift) m[i] &= ~bit;
      for (const [i, bit] of put) m[i] |= bit;
      out.push(m);
    }
  return out;
}

describe("digit helpers", () => {
  it("counts a digit place by place", () => {
    // 1 … 100: ones 10, tens 10, hundreds 1 → 21 ones.
    expect(placeCounts(1, 100)).toEqual([10, 10, 1, 0]);
    expect(countDigit(1, 100)).toBe(21);
    expect(countDigit(7, 1000)).toBe(300);
    expect(countDigit(1, 1000)).toBe(301);
    // 11 holds two 1s but is one number.
    expect(countDigit(1, 11)).toBe(4);
    expect(numbersWith(1, 11)).toBe(3);
    // Checked against writing the numbers out.
    for (let n = 1; n <= 300; n += 7)
      for (let d = 1; d <= 9; d++) expect(countDigit(d, n)).toBe(Array.from({ length: n }, (_, i) => String(i + 1)).join("").split(String(d)).length - 1);
  });

  it("builds the largest and smallest numbers without a leading zero", () => {
    expect(extremes([3, 0, 7, 1])).toEqual({ max: 7310, min: 1037, zeroFirst: "0137" });
    expect(extremes([5, 2, 9])).toEqual({ max: 952, min: 259, zeroFirst: "259" });
  });

  it("finds digit-sum answers that brute force agrees with", () => {
    for (let s = 1; s <= 45; s++) {
      let n = 1;
      while (digitSum(n) !== s) n++;
      expect(digitSumAnswer("min", s)).toBe(n);
    }
    // Smallest with distinct digits: any set of distinct digits with this sum, arranged smallest.
    for (let s = 16; s <= 30; s++) {
      let best = Infinity;
      for (let set = 1; set < 1024; set++) {
        const ds = Array.from({ length: 10 }, (_, d) => d).filter((d) => set & (1 << d));
        if (ds.reduce((a, b) => a + b, 0) !== s) continue;
        best = Math.min(best, extremes(ds).min);
      }
      expect(digitSumAnswer("minDistinct", s)).toBe(best);
    }
    expect(digitSumAnswer("min4", 10)).toBe(1009);
    expect(digitSumAnswer("max4distinct", 20)).toBe(9830);
  });

  it("knows the seven-segment digits", () => {
    expect(DIGIT_STICKS.map(bitCount)).toEqual([6, 2, 5, 5, 4, 5, 6, 3, 7, 6]);
    expect(new Set(DIGIT_STICKS).size).toBe(10);
    expect(glyphOf("lead", DIGIT_STICKS[0])).toBeNull();
    expect(glyphOf("sign", PLUS)).toBe("+");
    expect(glyphOf("sign", MINUS)).toBe("−");
    const lens: [number, number, number] = [1, 1, 1];
    const s = (n: number) => DIGIT_STICKS[n];
    expect(readEquation(lens, [s(6), PLUS, s(3), EQUALS, s(9)])).toMatchObject({ holds: true, value: 9 });
    expect(readEquation(lens, [s(6), MINUS, s(3), EQUALS, s(9)])).toMatchObject({ holds: false, value: 3 });
  });
});

describe("matchstick puzzles", () => {
  it("each pool puzzle has exactly one true equation, checked stick by stick", () => {
    const shapes: [[number, number, number], 1 | 2][] = [
      [[1, 1, 1], 1],
      [[2, 1, 1], 1],
      [[1, 1, 2], 1],
      [[1, 1, 1], 2],
    ];
    for (const [lens, moves] of shapes) {
      const pool = matchPool(lens, moves);
      expect(pool.length).toBeGreaterThan(5);
      for (const { start, answer } of pool) {
        expect(readEquation(lens, start)?.holds).toBe(false);
        const sols = bruteMoves(start, moves).filter((m) => readEquation(lens, m)?.holds);
        expect(sols.map((m) => m.join("."))).toEqual([answer.join(".")]);
        if (moves === 2) expect(bruteMoves(start, 1).some((m) => readEquation(lens, m)?.holds)).toBe(false);
        // "=" never moves.
        expect(start[slotKinds(lens).indexOf("equals")]).toBe(EQUALS);
        expect(answer[slotKinds(lens).indexOf("equals")]).toBe(EQUALS);
      }
    }
  }, 200_000);
});

describe("digit questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makeDigitsQuestion(t, l, 42)).toEqual(makeDigitsQuestion(t, l, 42));
  });

  it("gives a sound question with one answer for 10,000 seeds of every type and level", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makeDigitsQuestion(type, level, seed);
          expect(digitsMistake(q, answerKey(q))).toBe("right");
          for (const [, v] of slips(q)) if (v !== Number(answerKey(q))) expect(digitsMistake(q, String(v))).not.toBe("other");
          check(q);
        }
  }, 240_000);

  it("names the usual slips", () => {
    const base = { level: 2, seed: 0 } as const;
    const min: DigitsQuestion = { ...base, type: "extreme", cards: [3, 0, 7, 1], want: "min", answer: 1037 };
    expect(digitsMistake(min, "0137")).toBe("leadingZero");
    expect(digitsMistake(min, "7310")).toBe("wrongWay");
    expect(digitsMistake(min, "1307")).toBe("order");
    const diff: DigitsQuestion = { ...min, level: 3, want: "diff", answer: 7310 - 1037 };
    expect(digitsMistake(diff, String(7310 - 137))).toBe("leadingZero");

    // Largest even from 3, 5, 8: 538, not 853.
    const even: DigitsQuestion = { ...base, level: 1, type: "condition", cards: [3, 5, 8], use: 3, want: "max", cond: "even", answer: 538 };
    expect(digitsMistake(even, "853")).toBe("noCondition");
    expect(digitsMistake(even, "358")).toBe("wrongWay");
    const div3: DigitsQuestion = { ...base, level: 3, type: "condition", cards: [1, 2, 4, 5, 9], use: 4, want: "max", cond: "div3", answer: 5421 };
    expect(digitsMistake(div3, "9542")).toBe("noCondition");
    expect(digitsMistake(div3, "5412")).toBe("notBest");

    const count: DigitsQuestion = { ...base, level: 1, type: "count", digit: 1, n: 20, answer: 12 };
    expect(digitsMistake(count, "11")).toBe("numbersOnly");
    expect(digitsMistake(count, "2")).toBe("onesOnly");
    const count3: DigitsQuestion = { ...base, level: 3, type: "count", digit: 2, n: 300, answer: countDigit(2, 300) };
    expect(digitsMistake(count3, String(60))).toBe("noHundreds");

    const sum: DigitsQuestion = { ...base, level: 1, type: "digitSum", variant: "min", sum: 13, answer: 49 };
    expect(digitsMistake(sum, "94")).toBe("reversed");
    expect(digitsMistake(sum, "58")).toBe("notBest");
    expect(digitsMistake(sum, "48")).toBe("wrongSum");
    const sum4: DigitsQuestion = { ...base, type: "digitSum", variant: "max4distinct", sum: 20, answer: 9830 };
    expect(digitsMistake(sum4, "9920")).toBe("repeated");
    const min4: DigitsQuestion = { ...base, type: "digitSum", variant: "min4", sum: 10, answer: 1009 };
    expect(digitsMistake(min4, "19")).toBe("notFour");

    // 4□5 ÷ 9: 0 and 9 work; 3 and 6 give multiples of 3 only.
    const nine: DigitsQuestion = { ...base, level: 1, type: "divisible", digits: [4, null, 5], divisor: 9, want: "max", valid: [0, 9], answer: 9 };
    expect(digitsMistake(nine, "3")).toBe("only3");
    // □13 ÷ 3: 2, 5, 8 work; 0 would be a leading zero.
    const lead: DigitsQuestion = { ...base, level: 1, type: "divisible", digits: [null, 1, 3], divisor: 3, want: "max", valid: [2, 5, 8], answer: 8 };
    expect(digitsMistake(lead, "5")).toBe("otherValid");
    // 32□ ÷ 6: 1, 4, 7 make a multiple of 3, but only 4 is also even.
    const six: DigitsQuestion = { ...base, type: "divisible", digits: [3, 2, null], divisor: 6, want: "max", valid: [4], answer: 4 };
    expect(digitsMistake(six, "1")).toBe("partial");

    const s = (n: number) => DIGIT_STICKS[n];
    // 6 + 4 = 4 → 0 + 4 = 4 (the middle stick of 6 to the top-right).
    const match: DigitsQuestion = { ...base, level: 1, type: "match", lens: [1, 1, 1], moves: 1, start: [s(6), PLUS, s(4), EQUALS, s(4)], answer: [s(0), PLUS, s(4), EQUALS, s(4)] };
    expect(digitsMistake(match, [s(5), PLUS, s(4), EQUALS, s(4)].join("."))).toBe("moves");
    expect(digitsMistake(match, [s(6), MINUS, s(4), EQUALS, s(4) | 1].join("."))).toBe("unreadable");
    expect(digitsMistake(match, [s(9), PLUS, s(4), EQUALS, s(4)].join("."))).toBe("notTrue");
  });
});

/** Questions already brute-forced (the same count or sum comes up often). */
const seen = new Set<string>();

function check(q: DigitsQuestion) {
  const kind = answerKind(q);
  switch (q.type) {
    case "extreme": {
      expect(q.cards.length).toBe(q.level === 1 ? 3 : 4);
      if (q.level > 1) expect(q.cards).toContain(0);
      const all = bruteBuilt(q.cards, q.cards.length);
      const want = q.want === "max" ? Math.max(...all) : q.want === "min" ? Math.min(...all) : Math.max(...all) - Math.min(...all);
      expect(q.answer).toBe(want);
      expect(kind).toBe(q.level === 3 ? "number" : "cards");
      break;
    }
    case "condition": {
      expect(q.cards.length).toBe(q.level + 2);
      expect(new Set(q.cards).size).toBe(q.cards.length);
      const all = bruteBuilt(q.cards, q.use);
      const ok = all.filter((n) => meets(n, q.cond));
      // One number is the largest (smallest): unique by definition, but it must exist and the condition must matter.
      expect(ok.length).toBeGreaterThan(0);
      const best = q.want === "max" ? Math.max(...ok) : Math.min(...ok);
      expect(q.answer).toBe(best);
      expect(best).not.toBe(q.want === "max" ? Math.max(...all) : Math.min(...all));
      expect(String(q.answer).length).toBe(q.use);
      break;
    }
    case "count":
      if (seen.has(`c${q.digit}-${q.n}`)) break;
      seen.add(`c${q.digit}-${q.n}`);
      expect(q.n).toBeLessThanOrEqual(q.level === 1 ? 100 : q.level === 2 ? 500 : 1000);
      if (q.level === 1) expect(q.n).toBeGreaterThanOrEqual(11 * q.digit);
      expect(q.answer).toBe(Array.from({ length: q.n }, (_, i) => String(i + 1)).join("").split(String(q.digit)).length - 1);
      break;
    case "digitSum": {
      expect(digitSum(q.answer)).toBe(q.sum);
      if (seen.has(`s${q.variant}-${q.sum}`)) break;
      seen.add(`s${q.variant}-${q.sum}`);
      // Nothing better meets the same conditions (by brute force over the range).
      const okFor = (n: number) =>
        digitSum(n) === q.sum && (q.variant === "min" || q.variant === "minDistinct" || (n >= 1000 && n <= 9999)) && (q.variant === "min" || q.variant === "min4" || new Set(String(n)).size === String(n).length);
      if (q.variant === "max4distinct") for (let n = q.answer + 1; n <= 9999; n++) expect(okFor(n)).toBe(false);
      else for (let n = q.variant === "min4" ? 1000 : 1; n < q.answer; n++) if (okFor(n)) expect.fail(`${n} beats ${q.answer}`);
      break;
    }
    case "divisible": {
      const valid: number[] = [];
      for (let d = 0; d <= 9; d++) {
        const s = q.digits.map((x) => x ?? d).join("");
        if (s[0] !== "0" && Number(s) % q.divisor === 0) valid.push(d);
      }
      expect(valid).toEqual(q.valid);
      expect(fillers(q.digits, q.divisor)).toEqual(valid);
      expect(q.answer).toBe(q.want === "min" ? valid[0] : valid[valid.length - 1]);
      if (q.want === "only") expect(valid.length).toBe(1);
      expect(q.digits.filter((x) => x === null).length).toBe(1);
      break;
    }
    case "match": {
      expect(q.moves).toBe(q.level === 3 ? 2 : 1);
      expect(readEquation(q.lens, q.answer)?.holds).toBe(true);
      expect(readEquation(q.lens, q.start)?.holds).not.toBe(true);
      const { removed, added } = stickDiff(q.start, q.answer);
      expect([removed, added]).toEqual([q.moves, q.moves]);
      break;
    }
  }
}
