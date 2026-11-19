import { describe, expect, it } from "vitest";
import { areaOf, makePuzzleQuestion, simpleFigures, tangramFigures, type Level, type PuzzleQuestion, type PuzzleQuestionType } from "@/generators/puzzle";
import { PUZZLE_GUIDE } from "./guide";

// The hand-picked scenes in the teacher guide, rebuilt the way the tool's
// hash reader builds them (PuzzleTool: #try=type&level&seed, #show=puzzle-n | simple-n | sheets, #f=x).
const TYPES: PuzzleQuestionType[] = ["build", "overlay", "combine", "split", "extra", "complete"];

const examples = PUZZLE_GUIDE.examples ?? [];
const build = (hash: string): PuzzleQuestion => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as PuzzleQuestionType;
  expect(TYPES).toContain(type);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makePuzzleQuestion(type, level, Number(p.get("seed")));
};
const byFor = (i: number) => examples.find((ex) => ex.for === i)!.hash;

describe("puzzle guide examples", () => {
  it("every link opens a real scene", () => {
    for (const ex of examples) {
      const p = new URLSearchParams(ex.hash);
      if (p.has("try")) {
        expect(() => build(ex.hash)).not.toThrow();
        continue;
      }
      const [kind, n] = (p.get("show") ?? "").split("-");
      if (kind === "sheets") continue;
      expect(["puzzle", "simple"]).toContain(kind);
      const figures = kind === "simple" ? simpleFigures() : tangramFigures();
      expect(Number(n)).toBeLessThan(figures.length);
    }
  });

  it("area only: every set of pieces has the shadow's area", () => {
    const q = build(byFor(0));
    if (q.type !== "split") throw new Error("expected split");
    for (const set of q.options) expect(set.reduce((s, k) => s + areaOf(k), 0)).toBe(q.target.length);
  });

  it("black on black: the sheets share a cell and option 3 wipes it out", () => {
    const q = build(byFor(1));
    if (q.type !== "overlay") throw new Error("expected overlay");
    expect(q.a.some((c) => q.b.includes(c))).toBe(true);
    expect(q.tags[2]).toBe("xor");
  });

  it("turn sheet 2 first: option 1 is not turned, option 3 is turned the other way", () => {
    const q = build(byFor(2));
    if (q.type !== "overlay") throw new Error("expected overlay");
    expect(q.move).toBe("turn");
    expect(q.tags[0]).toBe("noTurn");
    expect(q.tags[2]).toBe("otherTurn");
  });

  it("turn or flip: option 4 is the mirror of the right piece", () => {
    const q = build(byFor(3));
    if (q.type !== "complete") throw new Error("expected complete");
    expect(q.tags[3]).toBe("mirror");
    expect(q.options[3].kind).toBe(q.options[q.answer].kind);
    expect(q.options[3].flip).toBe(true);
  });

  it("the other scenes show what their notes say", () => {
    const b1 = build("try=build&level=1&seed=1");
    expect(b1.type === "build" && b1.kinds).toContain("trap");
    const combine = build("try=combine&level=1&seed=1");
    expect(combine.type === "combine" && combine.pieces).toEqual(["half", "midTri"]);
    const extra = build("try=extra&level=2&seed=1");
    expect(extra.type === "extra" && extra.pieces.filter((k) => k === "ell")).toHaveLength(2);
    const boat = build("try=build&level=3&seed=4");
    expect(boat.type === "build" && boat.name).toBe("قایق");
  });
});
