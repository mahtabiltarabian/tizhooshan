import { describe, expect, it } from "vitest";
import { NAMED, oddPoints, type NamedFigure } from "@/generators/one-stroke";
import { countMistake, countOf, isCountQuestion, makeShapeQuestion, type CountQuestion, type Level, type ShapeQuestion, type ShapeQuestionType } from "@/generators/shape-count";
import { SHAPE_COUNTER_GUIDE } from "./guide";

// The hand-picked scenes in the teacher guide, rebuilt the way the tool's hash
// reader builds them (ShapeCounterTool: #try=type&level&seed, #show=family-a-b-kind, #show=stroke-name).
const TYPES: ShapeQuestionType[] = ["triangle", "square", "rectangle", "segment", "angle", "growing", "hidden", "stroke"];

const examples = SHAPE_COUNTER_GUIDE.examples ?? [];
const build = (hash: string): ShapeQuestion => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as ShapeQuestionType;
  expect(TYPES).toContain(type);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makeShapeQuestion(type, level, Number(p.get("seed")));
};
const counting = (hash: string): CountQuestion => {
  const q = build(hash);
  if (!isCountQuestion(q)) throw new Error("expected a counting question");
  return q;
};
const byFor = (i: number) => examples.find((ex) => ex.for === i)!.hash;
/** The counts that get a named slip's feedback. */
const slip = (q: CountQuestion, mistake: string) => Array.from({ length: q.answer + 20 }, (_, n) => n).filter((n) => countMistake(q, n) === mistake);

describe("shape counter guide examples", () => {
  it("every link opens a real scene", () => {
    for (const ex of examples) {
      const p = new URLSearchParams(ex.hash);
      if (p.has("try")) expect(() => build(ex.hash)).not.toThrow();
      else expect(p.get("show")).toMatch(/^(grid|stroke)-/);
    }
  });

  it("show links: the grid has 18 rectangles, the house is a named figure with 2 odd points", () => {
    expect(countOf({ family: "grid", a: 3, b: 2 }, "rectangle")).toBe(18);
    const name = "house" as NamedFigure;
    expect(examples.some((ex) => ex.hash === `show=stroke-${name}`)).toBe(true);
    expect(oddPoints(NAMED[name]())).toHaveLength(2);
  });

  it("singles: only 2 of the 6 triangles are one piece", () => {
    const q = counting(byFor(0));
    expect(q.answer).toBe(6);
    expect(slip(q, "singles")).toEqual([2]);
  });

  it("no squares: 6 without the 4 squares", () => {
    const q = counting(byFor(1));
    expect(q.answer).toBe(10);
    expect(slip(q, "noSquares")).toEqual([6]);
  });

  it("straight angle: the rays stand on a straight line", () => {
    const q = counting(byFor(2));
    expect(q.type === "angle" && q.spec.b).toBe(1);
    expect(slip(q, "straight")).toEqual([q.answer + 1]);
  });

  it("growing: adding 3 each time gives 12, not 15", () => {
    const q = counting(byFor(3));
    if (q.type !== "growing") throw new Error("expected growing");
    expect(q.counts).toEqual([1, 3, 6]);
    expect(q.answer).toBe(15);
    expect(slip(q, "linear")).toEqual([12]);
  });

  it("hidden: a turned and a bigger copy are offered", () => {
    const q = build(byFor(4));
    if (q.type !== "hidden") throw new Error("expected hidden");
    expect(q.mistakes).toContain("rotated");
    expect(q.mistakes).toContain("size");
  });

  it("hidden: an option is one side short", () => {
    const q = build(byFor(5));
    if (q.type !== "hidden") throw new Error("expected hidden");
    expect(q.mistakes).toContain("nearMiss");
  });

  it("stroke degrees: the wrong figures are the ones that look drawable when lines through a point count once", () => {
    const q = build(byFor(6));
    if (q.type !== "stroke" || q.ask !== "which") throw new Error("expected a which-figure stroke question");
    q.mistakes.forEach((m, i) => expect(m).toBe(i === q.answer ? null : "countLines"));
  });

  it("stroke: figures with 4 odd points are offered", () => {
    const q = build(byFor(7));
    if (q.type !== "stroke" || q.ask !== "which") throw new Error("expected a which-figure stroke question");
    expect(q.mistakes).toContain("fourOdd");
    expect(oddPoints(q.options[q.answer]).length).toBeLessThanOrEqual(2);
  });

  it("the other scenes show what their notes say", () => {
    expect(counting("try=segment&level=2&seed=5").answer).toBe(10);
    const fan = counting("try=triangle&level=3&seed=4");
    expect(fan.type === "triangle" && fan.spec).toMatchObject({ family: "fan", b: 3 });
    expect(fan.answer).toBe(30);
  });
});
