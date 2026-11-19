import { describe, expect, it } from "vitest";
import {
  applyNamed,
  bounds,
  cellKey,
  makeTransformQuestion,
  moveFigure,
  paintMistake,
  shapeKey,
  type Level,
  type TransformQuestion,
  type TransformQuestionType,
} from "@/generators/transforms";
import { TRANSFORMS_GUIDE } from "./guide";

// The hand-picked scenes in the teacher guide, rebuilt the way the tool's
// hash reader builds them (TransformsTool: #try=type&level&seed, #show=key).
const TYPES: TransformQuestionType[] = ["mirror", "water", "rotate", "shift", "draw", "sequence", "combo", "which"];
const SHOW_KEYS = ["mirror", "water", "cw90", "r180", "ccw90", "combo", "shift"];

const examples = TRANSFORMS_GUIDE.examples ?? [];
const build = (hash: string): TransformQuestion => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as TransformQuestionType;
  expect(TYPES).toContain(type);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makeTransformQuestion(type, level, Number(p.get("seed")));
};
const byFor = (i: number) => examples.find((ex) => ex.for === i)!.hash;

describe("transforms guide examples", () => {
  it("every link opens a real scene", () => {
    for (const ex of examples) {
      const p = new URLSearchParams(ex.hash);
      if (p.has("try")) expect(() => build(ex.hash)).not.toThrow();
      else expect(SHOW_KEYS).toContain(p.get("show"));
    }
  });

  it("mirror or water: option 2 is the water picture", () => {
    const q = build(byFor(0));
    if (q.type !== "mirror") throw new Error("expected a mirror question");
    expect(q.mistakes[1]).toBe("otherReflection");
  });

  it("turn for flip: the figure carries a letter and a turned option is offered", () => {
    const q = build(byFor(1));
    if (q.type !== "water") throw new Error("expected a water question");
    expect(q.figure.mark).toBeDefined();
    expect(q.mistakes).toContain("turnForFlip");
  });

  it("clockwise or not: the anticlockwise picture is an option", () => {
    const q = build(byFor(2));
    if (q.type !== "rotate") throw new Error("expected a rotate question");
    expect(q.moves).toEqual(["cw90"]);
    const ccw = shapeKey(applyNamed(q.figure, ["ccw90"]));
    const i = q.options.findIndex((o) => shapeKey(o) === ccw);
    expect(q.mistakes[i]).toBe("otherTurn");
  });

  it("draw: the figure slid unchanged across the line is caught", () => {
    const q = build(byFor(3));
    if (q.type !== "draw") throw new Error("expected a draw question");
    const image = moveFigure(q.figure, q.op);
    const dx = bounds(image).minX - bounds(q.figure).minX;
    const dy = bounds(image).minY - bounds(q.figure).minY;
    const slid = moveFigure(q.figure, { kind: "shift", by: [dx, dy] }).cells.map(cellKey);
    expect(slid.sort()).not.toEqual(q.answer);
    expect(paintMistake(q, slid)).toBe("unchanged");
  });

  it("the other scenes show what their notes say", () => {
    const shift2 = build("try=shift&level=2&seed=7");
    expect(shift2.type === "shift" && shift2.vec).toEqual([-2, -1]);
    const seq = build("try=sequence&level=3&seed=1");
    expect(seq.type === "sequence" && seq.frames[2]).toBeNull();
    const combo = build("try=combo&level=3&seed=3");
    if (combo.type !== "combo") throw new Error("expected a combo question");
    expect(combo.moves).toEqual(["cw90", "water"]);
    expect(combo.mistakes).toContain("wrongOrder");
  });
});
