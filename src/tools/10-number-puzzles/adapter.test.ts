// The practice adapter against the tool's own generator and slip function.

import { describe, expect, it } from "vitest";
import { blankCells, cellSlips, makeNumberPuzzle, PUZZLE_TYPES, puzzleMistake, type NumberPuzzle } from "@/generators/number-puzzles";
import { fa } from "@/tools/registry";
import { NUMBER_PUZZLES_ADAPTER as A } from "./adapter";
import { NUMBER_PUZZLES_PRACTICE } from "./practice";
import { PUZZLE_TYPE_LABEL } from "./PuzzleTryPanel";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const LEVELS = [1, 2, 3] as const;
const tokens = (s: string) => s.match(/[۰-۹]+/g) ?? [];
const solution = (q: NumberPuzzle) => q.cells.map((c) => c.value);
/** The tag the tool's own feedback gives (a second valid fill counts as right). */
const toolTag = (q: NumberPuzzle, vals: (number | null)[]) => {
  const t = puzzleMistake(q, vals).tag;
  return t === "anyValid" ? "right" : t;
};

describe("number puzzles adapter", () => {
  it("agrees with practice.ts and the try panel", () => {
    expect(A.types).toEqual(NUMBER_PUZZLES_PRACTICE.types);
    expect(A.levels).toEqual(NUMBER_PUZZLES_PRACTICE.levels);
    expect(A.tags).toEqual(NUMBER_PUZZLES_PRACTICE.tags);
    expect(A.version).toBe("number-puzzles@1");
    expect(Object.fromEntries(A.types.map((t) => [t.key, t.label]))).toEqual(PUZZLE_TYPE_LABEL);
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of PUZZLE_TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeNumberPuzzle(type, level, seed);
          const sol = solution(q);
          expect(A.grade(type, level, seed, sol)).toBe("right");
          const blanks = blankCells(q);
          const tries: (number | null)[][] = cellSlips(q).map(([c, , x]) => sol.map((v, i) => (i === c ? x : v)));
          // One blank off by one, two blanks swapped, a number used twice.
          tries.push(sol.map((v, i) => (i === blanks[0] ? v + 1 : v)));
          if (blanks.length > 1) {
            const [a, b] = blanks;
            tries.push(sol.map((v, i) => (i === a ? sol[b] : i === b ? sol[a] : v)));
            tries.push(sol.map((v, i) => (i === a ? sol[b] : v)));
          }
          for (const vals of tries) {
            const tag = A.grade(type, level, seed, vals);
            expect(tag).toBe(toolTag(q, vals));
            expect(A.tags[tag]).toBeTruthy();
          }
          for (const [c, tag, x] of cellSlips(q)) expect(A.grade(type, level, seed, sol.map((v, i) => (i === c ? x : v)))).toBe(tag);
        }
    expect(A.grade("magic", 1, 1, 5)).toBe("other");
    expect(A.grade("magic", 1, 1, [1, 2])).toBe("other");
  });

  it("gives three hints that never show a one-blank answer", () => {
    for (const { key } of A.types)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = A.hints(key, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // A puzzle with several blanks has no one-number answer; its hints never compute a cell.
          const q = makeNumberPuzzle(key as NumberPuzzle["type"], level, seed);
          const blanks = blankCells(q);
          if (blanks.length === 1) for (const line of h) expect(tokens(line)).not.toContain(fa(q.cells[blanks[0]].value));
        }
  });
});
