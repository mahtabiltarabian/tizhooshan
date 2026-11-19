import { describe, expect, it } from "vitest";
import { holeCells, makePaperQuestion, unfoldPoints, type Level, type PaperQuestion, type PaperQuestionType } from "@/generators/paper-folding";
import { PAPER_GUIDE } from "./guide";

// The hand-picked scenes in the teacher guide, rebuilt the way the tool's
// hash reader builds them (PaperTool: #try=type&level&seed, #show(&step=n), #f=x).
const TYPES: PaperQuestionType[] = ["holes", "holesChoice", "cutChoice", "pieces", "foldedShape", "order"];

const examples = PAPER_GUIDE.examples ?? [];
const build = (hash: string): PaperQuestion => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as PaperQuestionType;
  expect(TYPES).toContain(type);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makePaperQuestion(type, level, Number(p.get("seed")));
};
const byFor = (i: number) => examples.find((ex) => ex.for === i)!.hash;

describe("paper guide examples", () => {
  it("every link opens a real scene", () => {
    for (const ex of examples) {
      const p = new URLSearchParams(ex.hash);
      if (p.has("try")) expect(() => build(ex.hash)).not.toThrow();
      else {
        expect(p.has("show")).toBe(true);
        // The show link sets the paper's fold state itself (the reader does not derive it from step).
        const f = Number(p.get("f"));
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });

  it("show links: the sample's folding matches the step (f = (K − step) / K)", () => {
    const K = makePaperQuestion("holes", 2, 2207).folds.length;
    for (const ex of examples.filter((e) => e.hash.startsWith("show"))) {
      const p = new URLSearchParams(ex.hash);
      const step = Number(p.get("step") ?? 0);
      expect(Number(p.get("f"))).toBeCloseTo((K - step) / K);
    }
  });

  it("missing fold: option 4 opens only the last fold", () => {
    const q = build(byFor(0));
    if (q.type !== "holesChoice") throw new Error("expected holesChoice");
    expect(q.mistakes[3]).toBe("missingFold");
    expect(q.options[3]).toHaveLength(2);
    expect(q.options[q.answer]).toHaveLength(4);
  });

  it("shifted: option 2 moves the hole instead of mirroring it", () => {
    const q = build(byFor(1));
    if (q.type !== "holesChoice") throw new Error("expected holesChoice");
    expect(q.mistakes[1]).toBe("shifted");
  });

  it("wrong axis: option 1 mirrors in the other line", () => {
    const q = build(byFor(2));
    if (q.type !== "cutChoice") throw new Error("expected cutChoice");
    expect(q.mistakes[0]).toBe("wrongAxis");
  });

  it("pieces: the number of layers is offered and is not the answer", () => {
    const q = build(byFor(3));
    if (q.type !== "pieces") throw new Error("expected pieces");
    const layers = 2 ** q.folds.length;
    expect(layers).toBe(4);
    expect(q.options).toContain(layers);
    expect(q.options[q.answer]).not.toBe(layers);
  });

  it("the hole counts in the notes", () => {
    const count = (hash: string) => {
      const q = build(hash);
      if (q.type !== "holes") throw new Error("expected holes");
      return holeCells(unfoldPoints(q.punches, q.folds)).length;
    };
    expect(count("try=holes&level=1&seed=4")).toBe(2);
    expect(count("try=holes&level=2&seed=2")).toBe(4);
    expect(count("try=holes&level=3&seed=7")).toBe(8);
    const shape = build("try=foldedShape&level=2&seed=2");
    expect(shape.type === "foldedShape" && shape.mistakes.filter((m) => m === "otherSide")).toHaveLength(2);
  });
});
