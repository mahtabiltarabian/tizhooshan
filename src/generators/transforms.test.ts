import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  applyNamed,
  applyOp,
  bounds,
  cellKey,
  chiralCells,
  isFlipMat,
  makeTransformQuestion,
  moveAll,
  moveFigure,
  ORIENTS,
  opAt,
  paintMistake,
  paintOps,
  placeKey,
  shapeKey,
  stagedOps,
  type Figure,
  type Level,
  type Mat,
  type PaintMistake,
  type PaintQuestion,
  type Pt,
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
  const types: TransformQuestionType[] = ["mirror", "water", "rotate", "shift", "draw", "sequence", "combo", "which"];

  it("is deterministic for a seed", () => {
    for (const t of types) expect(makeTransformQuestion(t, 2, 11)).toEqual(makeTransformQuestion(t, 2, 11));
  });

  it("choice questions: four different pictures, exactly the answer is right", () => {
    fc.assert(
      fc.property(fc.constantFrom<TransformQuestionType>("mirror", "water", "rotate", "combo", "sequence"), level, seed, (t, l, s) => {
        const q = makeTransformQuestion(t, l, s);
        if (q.type === "draw" || q.type === "which" || q.type === "shift") throw new Error("type");
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

/** The matrix of a list of board moves (cells on cells, so whole numbers). */
const matOf = (ops: ReturnType<typeof paintOps>): Mat =>
  ops.reduce<Mat>((m, op) => {
    const a = opAt(op).m.map((v) => Math.round(v)) as Mat;
    return [a[0] * m[0] + a[1] * m[2], a[0] * m[1] + a[1] * m[3], a[2] * m[0] + a[3] * m[2], a[2] * m[1] + a[3] * m[3]].map((v) => v || 0) as Mat;
  }, [1, 0, 0, 1]);
const same = (p: Mat, q: Mat) => p.every((v, i) => v === q[i]);
const keys = (cells: Pt[]) => cells.map(cellKey).sort();

/** The figure turned or flipped by m, put where the answer is (same lower-left corner). */
function orientedAtAnswer(q: PaintQuestion, m: Mat): string[] {
  const turned: Figure = { cells: q.figure.cells.map(([x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y] as Pt) };
  const at = bounds({ cells: q.answer.map((k) => k.split(",").map((v) => Number(v) + 0.5) as Pt) });
  const b = bounds(turned);
  return keys(moveFigure(turned, { kind: "shift", by: [at.minX - b.minX, at.minY - b.minY] }).cells);
}

/** What a picture of the figure in orientation m should be called (when it is not a known slip). */
function expectedTag(q: PaintQuestion, m: Mat): PaintMistake {
  const right = matOf(paintOps(q));
  if (same(m, right)) return "place";
  if (same(right, [1, 0, 0, 1])) return "notSlid";
  if (same(m, [1, 0, 0, 1])) return "unchanged";
  if (isFlipMat(right) !== isFlipMat(m)) return isFlipMat(right) ? "turnForFlip" : "flipForTurn";
  return isFlipMat(right) ? "otherReflection" : "otherTurn";
}

/** Every wrong orientation of the figure, coloured where the answer is, is named for the move it really is. */
function checkOrientations(q: PaintQuestion, fail: (why: string) => void) {
  for (const m of ORIENTS) {
    const cells = orientedAtAnswer(q, m);
    const slip = q.type === "shift" ? q.slips.find((s) => s.cells.join(";") === cells.join(";")) : undefined;
    const want: PaintMistake = cells.join(";") === q.answer.join(";") ? "right" : (slip?.mistake ?? expectedTag(q, m));
    const got = paintMistake(q, cells);
    if (got !== want) fail(`orientation ${m.join(",")}: ${got}, wanted ${want}`);
  }
}

describe("coloured answers name the mistake", () => {
  const onBoard = (q: { w: number; h: number }, ks: string[]) =>
    ks.every((k) => {
      const [i, j] = k.split(",").map(Number);
      return i >= 0 && j >= 0 && i < q.w && j < q.h;
    });

  it("slide questions are sound for 10,000 seeds of each level", () => {
    const problems: string[] = [];
    for (const l of [1, 2, 3] as Level[])
      for (let s = 0; s < 10_000; s++) {
        const q = makeTransformQuestion("shift", l, s);
        const fail = (why: string) => problems.length < 20 && problems.push(`shift ${l} ${s}: ${why}`);
        if (q.type !== "shift") {
          fail("type");
          continue;
        }
        if (!chiralCells(q.figure.cells)) fail("figure has a symmetry");
        if (l > 1 && !q.figure.mark) fail("no letter");
        const [dx, dy] = q.vec;
        if (q.form === "vector") {
          if (l !== 3) fail("vector below level 3");
          if (!dx || !dy) fail("vector not in two parts");
          const truth = placeKey(q.image);
          if (placeKey(moveFigure(q.figure, { kind: "shift", by: q.vec })) !== truth) fail("image is not the slide");
          const hits = q.options.filter((v) => placeKey(moveFigure(q.figure, { kind: "shift", by: v })) === truth);
          if (hits.length !== 1 || hits[0] !== q.options[q.answer]) fail("not one right vector");
          if (new Set(q.options.map((v) => v.join())).size !== 4) fail("options repeat");
          if (q.options.some((v) => !v[0] && !v[1])) fail("zero slide");
          q.mistakes.forEach((m, i) => (m === null) !== (i === q.answer) && fail("mistakes"));
          if (!onBoard(q, keys(q.figure.cells)) || !onBoard(q, keys(q.image.cells))) fail("off the board");
          const own = new Set(keys(q.figure.cells));
          if (q.image.cells.some((p) => own.has(cellKey(p)))) fail("overlap");
          continue;
        }
        // Drawn: the answer is the board moves' image, on the board and apart from the figure.
        const end = moveAll(q.figure, q.ops);
        if (keys(end.cells).join(";") !== q.answer.join(";")) fail("answer");
        if (!onBoard(q, q.answer) || !onBoard(q, keys(q.figure.cells))) fail("off the board");
        const own = new Set(keys(q.figure.cells));
        if (q.answer.some((k) => own.has(k))) fail("overlap");
        const slide = q.ops.filter((o) => o.kind === "shift").reduce<Pt>((v, o) => (o.kind === "shift" ? [v[0] + o.by[0], v[1] + o.by[1]] : v), [0, 0]);
        if (slide.join() !== q.vec.join()) fail("legs do not add up");
        const reflects = q.ops.filter((o) => o.kind === "reflect").length;
        if (l === 1 && (reflects || (dx !== 0) === (dy !== 0))) fail("level 1 is one direction");
        if (l === 2 && (reflects || !dx || !dy)) fail("level 2 is two directions");
        if (l === 3 && (reflects !== 1 || q.ops[q.ops.length - 1].kind !== "reflect")) fail("level 3 is a slide then a reflection");
        // Slips: distinct pictures, never the answer, each named as itself.
        const seen = new Set<string>();
        for (const slip of q.slips) {
          const k = slip.cells.join(";");
          if (k === q.answer.join(";") || seen.has(k)) fail("slip repeats or is the answer");
          seen.add(k);
          if (!onBoard(q, slip.cells)) fail("slip off the board");
          if (paintMistake(q, slip.cells) !== slip.mistake) fail(`slip ${slip.mistake} named ${paintMistake(q, slip.cells)}`);
        }
        // A slide one cell short always fits between the figure and the image.
        if (l < 3 && !q.slips.some((x) => x.mistake === "offByOne")) fail("no off-by-one slip");
        if (l === 3 && !q.slips.some((x) => x.mistake === "onlyMoved")) fail("no only-moved slip");
        if (paintMistake(q, q.answer) !== "right") fail("answer not right");
        if (paintMistake(q, q.answer.slice(1)) !== "count") fail("count");
        checkOrientations(q, fail);
      }
    expect(problems).toEqual([]);
  }, 240_000);

  it("draw questions from level 2 use a lettered figure with no symmetry, so flips and turns are told apart (10,000 seeds)", () => {
    const problems: string[] = [];
    for (const l of [1, 2, 3] as Level[])
      for (let s = 0; s < 10_000; s++) {
        const q = makeTransformQuestion("draw", l, s);
        const fail = (why: string) => problems.length < 20 && problems.push(`draw ${l} ${s}: ${why}`);
        if (q.type !== "draw") {
          fail("type");
          continue;
        }
        if (!chiralCells(q.figure.cells)) fail("figure has a symmetry");
        if (l > 1 && !q.figure.mark) fail("no letter");
        if (paintMistake(q, q.answer) !== "right") fail("answer not right");
        // Only moved, never flipped or turned.
        const moved = orientedAtAnswer(q, [1, 0, 0, 1]);
        if (paintMistake(q, moved) !== "unchanged") fail("only moved");
        checkOrientations(q, fail);
      }
    expect(problems).toEqual([]);
  }, 240_000);

  it("a slide question: its slips by hand", () => {
    const q = makeTransformQuestion("shift", 2, 7);
    if (q.type !== "shift" || q.form !== "draw") throw new Error("type");
    const at = (by: Pt) => keys(moveFigure(q.figure, { kind: "shift", by }).cells);
    const [dx, dy] = q.vec;
    const tag = (cells: string[]) => paintMistake(q, cells);
    const onB = (cells: string[]) => onBoard(q, cells);
    if (onB(at([-dx, -dy]))) expect(tag(at([-dx, -dy]))).toBe("wrongWay");
    expect(tag(at([dx, 0]))).toBe("oneDirection");
    expect(tag(at([0, dy]))).toBe("oneDirection");
    expect(tag(at([dx - Math.sign(dx), dy]))).toBe("offByOne");
    // Flipped instead of slid.
    const mirrored = moveFigure(q.figure, { kind: "reflect", line: { kind: "v", c: 0 } });
    const b = bounds(mirrored);
    const a = bounds({ cells: q.answer.map((k) => k.split(",").map((v) => Number(v) + 0.5) as Pt) });
    expect(tag(keys(moveFigure(mirrored, { kind: "shift", by: [a.minX - b.minX, a.minY - b.minY] }).cells))).toBe("notSlid");
  });
});
