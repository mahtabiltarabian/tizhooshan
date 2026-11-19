import { describe, expect, it } from "vitest";
import { exploreRow, isChoice, makeSortQuestion, minAnySwaps, sortMistake, sortPasses, type Level, type Program, type SortQuestion, type SortVariant } from "./sorting";

const LEVELS: Level[] = [1, 2, 3];
const SEEDS = 10_000;
const whole = (v: number) => Number.isInteger(v) && v >= 0 && v <= 999;

// ── Independent simulations (written from the rules, not from the generator) ──

/** Runs a program step by step; every value along the way. */
function simulate(start: number, p: Program): number[] {
  const vals = [start];
  let x = start;
  for (let r = 0; r < p.times; r++)
    for (const s of p.body) {
      if (s.op === "+") x += s.n;
      else if (s.op === "-") x -= s.n;
      else if (s.op === "×") x *= s.n;
      else x /= s.n;
      vals.push(x);
    }
  return vals;
}
const result = (start: number, p: Program) => simulate(start, p).at(-1)!;

/** One pass: compare neighbours left to right, swap when the left is bigger. */
function bubblePass(row: number[]): { row: number[]; swaps: number } {
  const r = [...row];
  let swaps = 0;
  for (let i = 0; i < r.length - 1; i++)
    if (r[i] > r[i + 1]) {
      const t = r[i];
      r[i] = r[i + 1];
      r[i + 1] = t;
      swaps++;
    }
  return { row: r, swaps };
}
const sorted = (row: number[]) => row.every((v, i) => !i || row[i - 1] < v);
function passesUntilSorted(row: number[]): number {
  let r = row;
  let n = 0;
  while (!sorted(r)) {
    r = bubblePass(r).row;
    n++;
  }
  return n;
}

/** Breadth-first search over neighbour swaps: the true least number of swaps for every order of 0 … n−1. */
const DIST = new Map<number, Map<string, number>>();
function bfs(n: number): Map<string, number> {
  const start = Array.from({ length: n }, (_, i) => i);
  const dist = new Map([[start.join(","), 0]]);
  let frontier = [start];
  while (frontier.length) {
    const next: number[][] = [];
    for (const p of frontier) {
      const d = dist.get(p.join(","))!;
      for (let i = 0; i + 1 < n; i++) {
        const q = [...p];
        [q[i], q[i + 1]] = [q[i + 1], q[i]];
        const k = q.join(",");
        if (!dist.has(k)) {
          dist.set(k, d + 1);
          next.push(q);
        }
      }
    }
    frontier = next;
  }
  return dist;
}
function leastNeighbourSwaps(row: number[]): number {
  if (!DIST.has(row.length)) DIST.set(row.length, bfs(row.length));
  const ranks = row.map((v) => row.filter((w) => w < v).length);
  return DIST.get(row.length)!.get(ranks.join(","))!;
}

/** Least swaps of any two boxes, by brute force (BFS over all swaps). */
function leastAnySwaps(row: number[]): number {
  const target = [...row].sort((a, b) => a - b).join(",");
  const dist = new Map([[row.join(","), 0]]);
  let frontier = [row];
  for (let d = 0; ; d++) {
    if (frontier.some((p) => p.join(",") === target)) return d;
    const next: number[][] = [];
    for (const p of frontier)
      for (let i = 0; i < p.length; i++)
        for (let j = i + 1; j < p.length; j++) {
          const q = [...p];
          [q[i], q[j]] = [q[j], q[i]];
          if (!dist.has(q.join(","))) {
            dist.set(q.join(","), d + 1);
            next.push(q);
          }
        }
    frontier = next;
  }
}

const each = (level: Level, f: (q: SortQuestion) => void) => {
  for (let seed = 0; seed < SEEDS; seed++) f(makeSortQuestion(level, seed));
};

describe("sorting questions", () => {
  it("are the same for the same seed", () => {
    for (const level of LEVELS) for (const seed of [0, 7, 999, 123456]) expect(makeSortQuestion(level, seed)).toEqual(makeSortQuestion(level, seed));
  });

  it("use the right variants at each level", () => {
    const seen: Record<Level, Set<SortVariant>> = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (const level of LEVELS) for (let seed = 0; seed < 300; seed++) seen[level].add(makeSortQuestion(level, seed).variant);
    expect([...seen[1]].sort()).toEqual(["loop"]);
    expect([...seen[2]].sort()).toEqual(["pass", "swaps"]);
    expect([...seen[3]].sort()).toEqual(["minSwaps", "passes", "program"]);
    const themes = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const q = makeSortQuestion(1, seed);
      if (q.variant === "loop") themes.add(q.theme);
    }
    expect([...themes].sort()).toEqual(["number", "robot"]);
  });

  it(
    "have one right answer, checked by simulation, and slips with one meaning each",
    () => {
      for (const level of LEVELS)
        each(level, (q) => {
          expect(q.level).toBe(level);
          if (isChoice(q)) {
            expect(q.options).toHaveLength(4);
            expect(q.tags.filter((t) => t === "right")).toHaveLength(1);
            expect(q.tags[q.answer]).toBe("right");
            q.tags.forEach((t, i) => expect(sortMistake(q, i)).toBe(t));
            expect(new Set(q.tags).size).toBe(4);
          }
          switch (q.variant) {
            case "loop": {
              const vals = simulate(q.start, q.program);
              expect(vals.every(whole)).toBe(true);
              expect(q.answer).toBe(vals.at(-1));
              if (q.theme === "robot") expect(q.program.body.map((s) => s.op)).toEqual(["+", "-"]);
              else expect(result(q.start, { ...q.program, body: [...q.program.body].reverse() })).not.toBe(q.answer);
              const values = q.slips.map(([, v]) => v);
              expect(new Set([q.answer, ...values]).size).toBe(values.length + 1);
              for (const [tag, v] of q.slips) {
                expect(whole(v)).toBe(true);
                expect(sortMistake(q, v)).toBe(tag);
                if (tag === "loopMore") expect(v).toBe(result(q.start, { ...q.program, times: q.program.times + 1 }));
                if (tag === "loopLess") expect(v).toBe(result(q.start, { ...q.program, times: q.program.times - 1 }));
                if (tag === "order") expect(v).toBe(result(q.start, { ...q.program, body: [...q.program.body].reverse() }));
              }
              break;
            }
            case "pass": {
              expect(new Set(q.row).size).toBe(q.row.length);
              const right = bubblePass(q.row).row;
              const keys = q.options.map((o) => o.join(","));
              expect(new Set(keys).size).toBe(4);
              expect(keys.filter((k) => k === right.join(","))).toHaveLength(1);
              expect(keys[q.answer]).toBe(right.join(","));
              // Every option keeps the same boxes.
              for (const o of q.options) expect([...o].sort((a, b) => a - b)).toEqual([...q.row].sort((a, b) => a - b));
              const full = q.tags.indexOf("fullSort");
              expect(sorted(q.options[full])).toBe(true);
              expect(sorted(right)).toBe(false);
              break;
            }
            case "swaps":
            case "passes":
            case "minSwaps": {
              expect(new Set(q.row).size).toBe(q.row.length);
              const truth = q.variant === "swaps" ? bubblePass(q.row).swaps : q.variant === "passes" ? passesUntilSorted(q.row) : leastNeighbourSwaps(q.row);
              expect(q.answer).toBe(truth);
              expect(q.answer).toBeGreaterThan(0);
              const values = q.slips.map(([, v]) => v);
              expect(new Set([q.answer, ...values]).size).toBe(values.length + 1);
              for (const [tag, v] of q.slips) {
                expect(sortMistake(q, v)).toBe(tag);
                if (tag === "comparisons" && q.variant === "swaps") expect(v).toBe(q.row.length - 1);
                if (tag === "fullSort" || tag === "swapsNotPasses") expect(v).toBe(leastNeighbourSwaps(q.row));
                if (tag === "onePass") expect(v).toBe(bubblePass(q.row).swaps);
              }
              break;
            }
            case "program": {
              const reach = q.options.filter((p) => simulate(q.start, p).every(whole) && result(q.start, p) === q.target);
              expect(reach).toHaveLength(1);
              expect(result(q.start, q.options[q.answer])).toBe(q.target);
              for (const p of q.options) expect(simulate(q.start, p).every(whole)).toBe(true);
              break;
            }
          }
          expect(sortMistake(q, 9999)).toBe("other");
        });
    },
    240_000,
  );

  it("count passes and swaps of any kind like brute force", () => {
    for (let seed = 0; seed < 400; seed++) {
      const row = exploreRow(4 + (seed % 4), seed);
      expect(sorted(row)).toBe(false);
      expect(sortPasses(row)).toHaveLength(passesUntilSorted(row));
      expect(minAnySwaps(row)).toBe(leastAnySwaps(row));
    }
  }, 240_000);
});
