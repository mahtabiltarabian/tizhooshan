import { describe, expect, it } from "vitest";
import { levelTransfers, makeMeanQuestion, meanColumns, meanMistake, meanSlips, type Level, type MeanQuestion } from "./mean";

const LEVELS: Level[] = [1, 2, 3];
const sum = (v: number[]) => v.reduce((t, x) => t + x, 0);

/** Apply transfers to heights. */
function apply(h: number[], m: number) {
  const out = [...h];
  for (const t of levelTransfers(h, m)) {
    out[t.from] -= t.count;
    out[t.to] += t.count;
  }
  return out;
}

/** The whole numbers 0 … 200 that fit the question's conditions as the unknown. */
function fits(q: MeanQuestion): number[] {
  const out: number[] = [];
  for (let v = 0; v <= 200; v++) {
    let ok = false;
    switch (q.variant) {
      case "plain":
        ok = sum(q.values) === v * q.values.length;
        break;
      case "missing": {
        const vs = q.values.map((x, i) => (i === q.miss ? v : x));
        ok = sum(vs) === q.a * vs.length;
        break;
      }
      case "join":
        ok = q.n * q.a + v === (q.n + 1) * q.b;
        break;
      case "leave":
        ok = q.n * q.a - q.x === (q.n - 1) * v;
        break;
      case "groups":
        ok = q.n * q.a + q.x * q.b === (q.n + q.x) * v;
        break;
    }
    if (ok) out.push(v);
  }
  return out;
}

describe("levelling", () => {
  it("moves blocks from tall columns to short ones until all are level", () => {
    expect(apply([2, 9, 4, 5], 5)).toEqual([5, 5, 5, 5]);
    expect(levelTransfers([2, 9, 4, 5], 5)[0]).toEqual({ from: 1, to: 0, count: 3 });
    expect(levelTransfers([4, 4, 4], 4)).toEqual([]);
  });
});

describe("mean questions", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeMeanQuestion(l, 42)).toEqual(makeMeanQuestion(l, 42));
  });

  for (const level of LEVELS)
    it(`gives a sound mean question for 10,000 seeds at level ${level}`, () => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeMeanQuestion(level, seed);
        const ok = (cond: boolean, what: string) => {
          if (!cond) throw new Error(`mean level ${level} seed ${seed}: ${what}\n${JSON.stringify(q)}`);
        };
        seen.add(q.variant);
        ok(Number.isInteger(q.answer) && q.answer > 0, "answer is a positive whole number");
        ok(meanMistake(q, q.answer) === "right", "answer is right");
        // Exactly one whole number fits the conditions, and it is the answer.
        const f = fits(q);
        ok(f.length === 1 && f[0] === q.answer, "unique answer");
        for (const s of meanSlips(q)) if (s.value !== q.answer) ok(meanMistake(q, s.value) !== "other", `slip ${s.value} is named`);
        // The picture levels out at a whole height.
        const cols = meanColumns(q);
        ok(cols.every((h) => Number.isInteger(h) && h >= 1 && h <= 24), "columns fit the board");
        switch (q.variant) {
          case "plain":
            ok(level === 1 && (q.values.length === 3 || q.values.length === 4), "level 1: 3–4 numbers");
            ok(apply(q.values, q.answer).every((h) => h === q.answer), "levels to the answer");
            ok(new Set(q.values).size > 1, "not level already");
            ok(q.names.length === q.values.length && new Set(q.names).size === q.names.length, "a name each");
            break;
          case "missing":
            ok(level === 2 && q.miss >= 0 && q.miss < q.values.length && q.answer === q.values[q.miss], "level 2: missing value");
            ok(q.answer !== q.a, "missing is not the average itself");
            ok(apply(q.values, q.a).every((h) => h === q.a), "levels to the average");
            break;
          case "join":
            ok(level === 3 && q.x === q.answer && q.b !== q.a && q.x !== q.b, "join");
            ok(apply([...cols, q.x], q.b).every((h) => h === q.b), "newcomer levels to the new average");
            break;
          case "leave":
            ok(level === 3 && q.b === q.answer && q.b !== q.a && q.x !== q.a, "leave");
            break;
          case "groups":
            ok(level === 3 && q.n !== q.x && q.a !== q.b && q.n + q.x <= 8, "groups of different sizes and averages");
            ok(q.answer * 2 !== q.a + q.b, "not the average of the averages");
            ok(apply(cols, q.answer).every((h) => h === q.answer), "groups level to the answer");
            break;
        }
      }
      if (level === 3) expect([...seen].sort()).toEqual(["groups", "join", "leave"]);
    }, 240_000);

  it("names the usual slips", () => {
    // 2, 9, 4, 5: average 5.
    const plain = makeMeanQuestion(1, 0);
    const p: MeanQuestion = { ...plain, variant: "plain", values: [2, 9, 4, 5], answer: 5 };
    expect(meanMistake(p, 20)).toBe("noDivide");
    expect(meanMistake(p, 4)).toBe("wrongCount");
    expect(meanMistake(p, 7)).toBe("other");
    // 4, ?, 7 average 6: missing 7.
    const m: MeanQuestion = { ...p, variant: "missing", values: [4, 7, 7], miss: 1, a: 6, answer: 7 };
    expect(meanMistake(m, 18)).toBe("noSubtract");
    expect(meanMistake(m, 1)).toBe("wrongCount");
    expect(meanMistake(m, 6)).toBe("gaveAverage");
    // 4 people average 6; one joins, average 7: newcomer 11.
    const j: MeanQuestion = { ...p, variant: "join", n: 4, a: 6, b: 7, x: 11, answer: 11 };
    expect(meanMistake(j, 7)).toBe("gaveAverage");
    expect(meanMistake(j, 4)).toBe("onlyShare");
    expect(meanMistake(j, 8)).toBe("twoNumbers");
    // 5 people average 10; one with 14 leaves: 36 / 4 = 9.
    const l: MeanQuestion = { ...p, variant: "leave", n: 5, a: 10, x: 14, b: 9, answer: 9 };
    expect(meanMistake(l, 6)).toBe("twoNumbers");
    expect(meanMistake(l, 12)).toBe("other");
    // 2 people average 10, 6 people average 2: (20 + 12) / 8 = 4; average of averages 6.
    const g: MeanQuestion = { ...p, variant: "groups", n: 2, a: 10, x: 6, b: 2, answer: 4 };
    expect(meanMistake(g, 6)).toBe("avgOfAvgs");
    expect(meanMistake(g, 16)).toBe("byGroups");
  });
});
