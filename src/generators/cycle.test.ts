import { describe, expect, it } from "vitest";
import {
  cycleAnswerIsCount,
  cycleChoices,
  cycleMistake,
  cycleSlips,
  divide,
  itemAt,
  itemsUpTo,
  makeCycleQuestion,
  minimalPeriod,
  SYMBOLS,
  type CycleQuestion,
  type Level,
} from "./cycle";

const LEVELS: Level[] = [1, 2, 3];

/**
 * Every way to read the shown row as "some start, then a block repeating",
 * where the block is seen whole at least twice. Brute force, independent of
 * how the question was built.
 */
function readings(row: number[]) {
  const out: { p: number; L: number }[] = [];
  for (let p = 0; p < row.length; p++)
    for (let L = 1; 2 * L <= row.length - p; L++) {
      let ok = true;
      for (let k = p + L; k < row.length && ok; k++) ok = row[k] === row[k - L];
      if (ok) out.push({ p, L });
    }
  return out;
}
const predict = (row: number[], p: number, L: number, pos: number) => (pos <= row.length ? row[pos - 1] : row[p + ((pos - 1 - p) % L)]);

/** Counting one by one, up to N. */
function countSlowly(q: CycleQuestion) {
  let c = 0;
  for (let pos = 1; pos <= q.n; pos++) if (itemAt(q, pos) === q.target) c++;
  return c;
}

const DAYS_IN_ORDER = [0, 1, 2, 3, 4, 5, 6];

function problems(q: CycleQuestion, level: Level): string[] {
  const bad: string[] = [];
  const need = (ok: boolean, what: string) => {
    if (!ok) bad.push(`${what}: ${JSON.stringify(q)}`);
  };
  const L = q.cycle.length;
  const p = q.prefix.length;
  const row = itemsUpTo(q, q.shown);
  const ids = SYMBOLS[q.set].length;
  need(q.type === "cycle" && q.level === level, "type and level");
  need([...q.prefix, ...q.cycle].every((s) => Number.isInteger(s) && s >= 0 && s < ids), "symbols in the set");
  need(q.shown >= p + 2 * L || q.variant === "week", "two whole cycles shown");
  need(q.n > q.shown, "the asked place is past the row");
  need(minimalPeriod([...q.cycle, ...q.cycle]) === L, "no shorter cycle");

  if (q.variant === "week") {
    // The days go in order; day 1 is the first day of the cycle.
    need(q.set === "days" && L === 7 && q.cycle.every((d, k) => d === DAYS_IN_ORDER[(q.cycle[0] + k) % 7]), "days of the week in order");
    need(q.answer === (q.cycle[0] + q.n - 1) % 7, "day N by counting on");
  } else {
    // The intended reading is the simplest one, and every reading with no longer a start agrees.
    const rs = readings(row);
    need(
      rs.some((r) => r.p === p && r.L === L),
      "intended reading fits",
    );
    const best = Math.min(...rs.map((r) => r.p + r.L));
    need(rs.filter((r) => r.p + r.L === best).every((r) => r.p === p && r.L === L), "simplest reading is the intended one");
    if (q.variant === "count") {
      need(q.answer === countSlowly(q), "count by counting");
      for (const r of rs.filter((r) => r.p <= p)) {
        let c = 0;
        for (let pos = 1; pos <= q.n; pos++) if (predict(row, r.p, r.L, pos) === q.target) c++;
        need(c === q.answer, "every reading gives the same count");
      }
    } else {
      need(q.answer === itemAt(q, q.n), "answer is item N");
      for (const r of rs.filter((r) => r.p <= p)) need(predict(row, r.p, r.L, q.n) === q.answer, "every reading gives the same item");
      need(cycleChoices(q).includes(q.answer), "answer is a choice");
    }
  }

  need(cycleMistake(q, q.answer) === "right", "answer counts as right");
  need(
    cycleSlips(q).every(([, v]) => v === q.answer || cycleMistake(q, v) !== "other"),
    "every slip is named",
  );
  if (cycleAnswerIsCount(q)) need(Number.isInteger(q.answer) && q.answer > 0 && q.answer < 1000, "count fits the pad");

  // What each level asks for.
  if (level === 1) need(q.variant === "nth" && L === 3 && new Set(q.cycle).size === 3 && q.n <= 30, "level 1: three different items, N ≤ 30");
  if (level === 2) need(q.variant === "nth" && L >= 4 && L <= 6 && q.n >= 40 && q.n <= 400, "level 2: cycle of 4 to 6, N in the hundreds");
  if (level === 3) {
    need(q.variant !== "nth", "level 3: count, start or week");
    if (q.variant === "count") need(q.cycle.filter((s) => s === q.target).length >= 2, "counted symbol twice a cycle");
    if (q.variant === "prefix") {
      need(p >= 1 && p < L, "a short start");
      need(cycleMistake(q, itemAt({ prefix: [], cycle: q.cycle }, q.n)) === "prefix", "forgetting the start is its own slip");
    }
  }
  return bad;
}

describe("cycle arithmetic", () => {
  const q: CycleQuestion = { type: "cycle", level: 1, seed: 0, variant: "nth", set: "letters", prefix: [], cycle: [0, 1, 2], shown: 6, n: 100, target: -1, answer: 0 };

  it("reads item N off the cycle", () => {
    // ا ب پ ا ب پ …: 100 = 33 × 3 + 1, so the 100th is ا.
    expect(divide(q)).toEqual({ cycles: 33, rem: 1, L: 3, m: 100 });
    expect(itemAt(q, 100)).toBe(0);
    expect(itemAt(q, 99)).toBe(2);
    expect(itemsUpTo(q, 7)).toEqual([0, 1, 2, 0, 1, 2, 0]);
    // After a start of two: x y | a b c a b c …
    const pre = { prefix: [5, 4], cycle: [0, 1, 2] };
    expect(itemsUpTo(pre, 8)).toEqual([5, 4, 0, 1, 2, 0, 1, 2]);
    expect(itemAt(pre, 12)).toBe(0);
  });

  it("finds the shortest period", () => {
    expect(minimalPeriod([0, 1, 0, 1, 0, 1])).toBe(2);
    expect(minimalPeriod([0, 0, 1, 0, 0, 1])).toBe(3);
    expect(minimalPeriod([0, 1, 2, 3])).toBe(4);
  });

  it("names the usual slips", () => {
    // 99 = 33 × 3 + 0: the last item (پ), not the first.
    const z = { ...q, n: 99, answer: 2 };
    expect(cycleMistake(z, 2)).toBe("right");
    expect(cycleMistake(z, 0)).toBe("zeroFirst");
    expect(cycleMistake(z, 1)).toBe("offByOne");
    // 100: r = 1 is ا; ب is one too far.
    expect(cycleMistake(q, 1)).toBe("offByOne");
    // ● ▲ ■ ◆ ★, N = 52: 52 = 10 × 5 + 2 → ▲; the quotient 10 → 10 mod 5 = 0 → ★.
    const five: CycleQuestion = { ...q, level: 2, set: "shapes", cycle: [0, 1, 2, 3, 4], shown: 10, n: 52, answer: 1 };
    expect(cycleMistake(five, 4)).toBe("quotient");
    expect(cycleMistake(five, 2)).toBe("offByOne");
    // Start x y, then a b c: 20 − 2 = 18 = 6 × 3 + 0 → c; forgetting the start: 20 = 6 × 3 + 2 → b.
    const pre: CycleQuestion = { ...q, level: 3, variant: "prefix", prefix: [5, 4], cycle: [0, 1, 2], shown: 8, n: 20, answer: 2 };
    expect(cycleMistake(pre, 1)).toBe("prefix");
    // ● ▲ ▲ ■ among the first 30: 30 = 7 × 4 + 2 → 7 × 2 + 1 = 15 triangles.
    const cnt: CycleQuestion = { ...q, level: 3, variant: "count", set: "shapes", cycle: [0, 1, 1, 2], shown: 8, n: 30, target: 1, answer: 15 };
    expect(countSlowly(cnt)).toBe(15);
    expect(cycleMistake(cnt, 7)).toBe("cycles");
    expect(cycleMistake(cnt, 14)).toBe("noRemainder");
    expect(cycleMistake(cnt, 16)).toBe("wholeCycle");
    expect(cycleMistake(cnt, 15)).toBe("right");
  });
});

describe("cycle questions", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeCycleQuestion(l, 42)).toEqual(makeCycleQuestion(l, 42));
  });

  it("gives a sound question with one answer for 10,000 seeds of every level", () => {
    const bad: string[] = [];
    const variants = new Set<string>();
    let zero = 0;
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeCycleQuestion(level, seed);
        variants.add(`${level}-${q.variant}`);
        if (divide(q).rem === 0) zero++;
        bad.push(...problems(q, level));
      }
    expect(bad.slice(0, 5)).toEqual([]);
    expect([...variants].sort()).toEqual(["1-nth", "2-nth", "3-count", "3-prefix", "3-week"]);
    // A remainder of 0 comes up often enough to be practised.
    expect(zero).toBeGreaterThan(3000);
  }, 240_000);
});
