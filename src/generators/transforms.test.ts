import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  applyNamed,
  applyOp,
  cellKey,
  makeTransformQuestion,
  moveAll,
  moveFigure,
  placeKey,
  shapeKey,
  stagedOps,
  type Figure,
  type Level,
  type TransformQuestionType,
} from "./transforms";

const level = fc.constantFrom<Level>(1, 2, 3);
const seed = fc.integer({ min: 0, max: 1_000_000 });

// An L of three cells with an F in the corner cell.
const L: Figure = {
  cells: [
    [0.5, 0.5],
    [0.5, 1.5],
    [1.5, 0.5],
  ],
  mark: { at: [0.5, 0.5], symbol: "F", m: [1, 0, 0, 1] },
};

describe("moves", () => {
  it("four quarter turns, or two mirrors, give the figure back", () => {
    expect(shapeKey(applyNamed(L, ["cw90", "cw90", "cw90", "cw90"]))).toBe(shapeKey(L));
    expect(shapeKey(applyNamed(L, ["mirror", "mirror"]))).toBe(shapeKey(L));
    expect(shapeKey(applyNamed(L, ["cw90", "ccw90"]))).toBe(shapeKey(L));
  });

  it("mirror then water is a half turn; mirror then a quarter turn depends on the order", () => {
    expect(shapeKey(applyNamed(L, ["mirror", "water"]))).toBe(shapeKey(applyNamed(L, ["r180"])));
    expect(shapeKey(applyNamed(L, ["mirror", "cw90"]))).not.toBe(shapeKey(applyNamed(L, ["cw90", "mirror"])));
  });

  it("turns clockwise: the cell to the right of the corner goes below it", () => {
    expect(applyOp({ kind: "rotate", deg: 90, about: [0, 0] }, [1, 0])).toEqual([0, -1]);
  });

  it("a half-done move is between the start and the end", () => {
    const op = { kind: "reflect" as const, line: { kind: "v" as const, c: 2 } };
    expect(applyOp(op, [1, 3], 0.5)).toEqual([2, 3]);
    expect(applyOp(op, [1, 3], 1)).toEqual([3, 3]);
  });

  it("staged moves land on the same picture as the named moves, cells on cells", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeTransformQuestion("combo", l, s);
        if (q.type !== "combo") throw new Error("type");
        const staged = moveAll(q.figure, stagedOps(q.figure, q.moves));
        expect(shapeKey(staged)).toBe(shapeKey(applyNamed(q.figure, q.moves)));
        for (const [x, y] of staged.cells) expect([x % 1, y % 1].map((v) => Math.abs(v))).toEqual([0.5, 0.5]);
      }),
      { numRuns: 200 },
    );
  });
});

describe("makeTransformQuestion", () => {
  const types: TransformQuestionType[] = ["mirror", "water", "rotate", "draw", "sequence", "combo", "which"];

  it("is deterministic for a seed", () => {
    for (const t of types) expect(makeTransformQuestion(t, 2, 11)).toEqual(makeTransformQuestion(t, 2, 11));
  });

  it("choice questions: four different pictures, exactly the answer is right", () => {
    fc.assert(
      fc.property(fc.constantFrom<TransformQuestionType>("mirror", "water", "rotate", "combo", "sequence"), level, seed, (t, l, s) => {
        const q = makeTransformQuestion(t, l, s);
        if (q.type === "draw" || q.type === "which") throw new Error("type");
        const keys = q.options.map(shapeKey);
        expect(new Set(keys).size).toBe(4);
        const truth =
          q.type === "sequence"
            ? shapeKey(applyNamed(q.figure, Array(q.frames.indexOf(null)).fill(q.step)))
            : shapeKey(applyNamed(q.figure, q.moves));
        expect(keys.filter((k) => k === truth)).toHaveLength(1);
        expect(keys[q.answer]).toBe(truth);
        expect(q.mistakes[q.answer]).toBeNull();
        if (l > 1) expect(q.figure.mark).toBeDefined();
      }),
      { numRuns: 400 },
    );
  });

  it("which: only the answer's move makes the image", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeTransformQuestion("which", l, s);
        if (q.type !== "which") throw new Error("type");
        const hits = q.options.filter((m) => shapeKey(applyNamed(q.figure, [m])) === shapeKey(q.image));
        expect(hits).toEqual([q.options[q.answer]]);
      }),
      { numRuns: 200 },
    );
  });

  it("draw: the image is on the board, apart from the figure, and is the move's image", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeTransformQuestion("draw", l, s);
        if (q.type !== "draw") throw new Error("type");
        const image = moveFigure(q.figure, q.op);
        expect(q.answer).toEqual(image.cells.map(cellKey).sort());
        const own = new Set(q.figure.cells.map(cellKey));
        for (const key of q.answer) {
          const [i, j] = key.split(",").map(Number);
          expect(i >= 0 && j >= 0 && i < q.w && j < q.h).toBe(true);
          expect(own.has(key)).toBe(false);
        }
        // A mirror or a half turn done twice gives the figure back.
        if (q.op.kind === "reflect" || (q.op.kind === "rotate" && q.op.deg === 180)) expect(placeKey(moveFigure(image, q.op))).toBe(placeKey(q.figure));
      }),
      { numRuns: 300 },
    );
  });
});
