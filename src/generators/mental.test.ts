import { describe, expect, it } from "vitest";
import { evaluate, itemSlips, leftToRight, makeMentalQuestion, MENTAL_ITEMS, mentalMistake, noBorrow, type Level } from "./mental";

const LEVELS: Level[] = [1, 2, 3];

describe("mental arithmetic generator", () => {
  it("same seed, same card", () => {
    for (const level of LEVELS) expect(makeMentalQuestion(level, 42)).toEqual(makeMentalQuestion(level, 42));
  });

  it("works × and ÷ before + and −", () => {
    expect(evaluate([3, 4, 5], ["+", "×"])).toBe(23);
    expect(leftToRight([3, 4, 5], ["+", "×"])).toBe(35);
    expect(evaluate([20, 12, 4], ["−", "÷"])).toBe(17);
    expect(evaluate([4, 5, 6, 7], ["×", "+", "×"])).toBe(62);
    expect(noBorrow(83, 29)).toBe(66);
    expect(noBorrow(432, 57)).toBe(425);
  });

  it("gives six sound sums for 10,000 seeds of every level", () => {
    // Problems are collected and checked once: millions of expect() calls are slow.
    const problems: string[] = [];
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeMentalQuestion(level, seed);
        const fail = (why: string) => problems.length < 20 && problems.push(`${level} ${seed}: ${why}`);
        if (q.items.length !== MENTAL_ITEMS) fail("size");
        if (new Set(q.items.map((it) => `${it.nums}${it.signs}`)).size !== MENTAL_ITEMS) fail("repeat");
        for (const it of q.items) {
          // A whole answer that fits the three-digit pad, and numbers that fit the card.
          if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer > 999) fail(`answer ${it.answer}`);
          if (it.answer !== evaluate(it.nums, it.signs)) fail("stored answer");
          if (it.nums.some((n) => !Number.isInteger(n) || n < 1 || n > 999)) fail("number");
          if (it.signs.length !== it.nums.length - 1) fail("signs");
          // No slip is the answer, and no two slips share a value.
          const slips = itemSlips(it);
          if (slips.some(([, v]) => v === it.answer || v < 0)) fail("slip is the answer");
          if (new Set(slips.map(([, v]) => v)).size !== slips.length) fail("slip twice");
          // Order of operations matters in every mixed sum.
          if (it.op === "mix" && !slips.some(([t]) => t === "order")) fail("mix without trap");
          if (level === 1 && it.op === "mix") fail("mix at level 1");
        }
        // Level 2 has carrying and borrowing in its plain sums.
        if (level === 2) {
          const add = q.items.find((it) => it.op === "add")!;
          const sub = q.items.find((it) => it.op === "sub")!;
          if ((add.nums[0] % 10) + (add.nums[1] % 10) < 10) fail("no carry");
          if (sub.nums[0] % 10 >= sub.nums[1] % 10) fail("no borrow");
        }
        if (mentalMistake(q, q.items.map((it) => it.answer)) !== "right") fail("answer not right");
      }
    expect(problems).toEqual([]);
  }, 120_000);

  it("names the first known slip on the card", () => {
    for (let seed = 0; seed < 300; seed++) {
      const q = makeMentalQuestion(2, seed);
      const answers = q.items.map((it) => it.answer);
      expect(mentalMistake(q, answers)).toBe("right");
      q.items.forEach((it, i) => {
        for (const [tag, v] of itemSlips(it)) expect(mentalMistake(q, answers.map((a, j) => (j === i ? v : a)))).toBe(tag);
      });
      const mix = q.items.findIndex((it) => it.op === "mix");
      expect(mentalMistake(q, answers.map((a, j) => (j === mix ? leftToRight(q.items[mix].nums, q.items[mix].signs) : a)))).toBe("order");
      // An empty box or a wrong shape of answer.
      expect(mentalMistake(q, answers.map((a, j) => (j === 0 ? null : a)))).toBe("other");
      expect(mentalMistake(q, answers.slice(1))).toBe("other");
      expect(mentalMistake(q, 5)).toBe("other");
    }
  });
});
