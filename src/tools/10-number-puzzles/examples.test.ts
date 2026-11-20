import { describe, expect, it } from "vitest";
import {
  blankCells,
  cellSlips,
  givenValues,
  makeNumberPuzzle,
  puzzleMistake,
  remaining,
  type Level,
  type NumberPuzzle,
  type PuzzleTag,
  type PuzzleType,
} from "@/generators/number-puzzles";
import { PUZZLES_GUIDE } from "./guide";
import { PUZZLE_TYPE_LABEL } from "./PuzzleTryPanel";

// Rebuilds every hand-picked example the way the tool's hash reader does.
const examples = PUZZLES_GUIDE.examples ?? [];
const build = (hash: string) => {
  const p = new URLSearchParams(hash);
  const type = (p.get("try") ?? p.get("show")) as PuzzleType;
  expect(type in PUZZLE_TYPE_LABEL).toBe(true);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makeNumberPuzzle(type, level, Number(p.get("seed")), p.get("big") === "1");
};
const byFor = (i: number) => build(examples.find((ex) => ex.for === i)!.hash);

const perms = <T,>(a: T[]): T[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));

/** Some way of placing the remaining numbers in the blanks gets this feedback. */
function reachable(q: NumberPuzzle, tag: PuzzleTag) {
  const blanks = blankCells(q);
  return perms(remaining(q.set!, givenValues(q))).some((p) => {
    const vals = givenValues(q);
    blanks.forEach((c, i) => (vals[c] = p[i]));
    return puzzleMistake(q, vals).tag === tag;
  });
}

describe("number puzzles hand-picked examples", () => {
  it("every try and show link builds its puzzle", () => {
    for (const ex of examples.filter((e) => !e.hash.startsWith("explore="))) expect(build(ex.hash).cells.length).toBeGreaterThan(0);
  });

  it("explore links name a known area", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("explore="))) {
      expect(["square", "triangle", "ring", "pyramid"]).toContain(new URLSearchParams(ex.hash).get("explore"));
    }
  });

  it("the picked scenes carry the targeted slip", () => {
    const pyramid = byFor(0);
    expect(cellSlips(pyramid).some(([, tag]) => tag === "addedDown")).toBe(true);
    const magic = byFor(1);
    expect(magic.type).toBe("magic");
    expect(reachable(magic, "diagonal")).toBe(true);
    const shape = byFor(2);
    const tags = cellSlips(shape).map(([, tag]) => tag);
    expect(tags).toEqual(expect.arrayContaining(["oneExample", "sumHabit"]));
    const ring = byFor(3);
    expect(ring.type).toBe("ring");
    expect(reachable(ring, "crossing")).toBe(true);
    const star = byFor(4);
    expect(star.type === "star" && star.anyFill).toBe(true);
    const matrix = byFor(5);
    expect(matrix.type).toBe("matrix");
    expect(cellSlips(matrix).map(([, tag]) => tag)).toContain("reversed");
  });
});
