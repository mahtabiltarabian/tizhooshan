import { describe, expect, it } from "vitest";
import {
  areaOf,
  FIGURES,
  SIMPLE_FIGURES,
  SIMPLE_SET,
  simpleFigures,
  isSolid,
  keyOf,
  makePuzzleQuestion,
  moveCells,
  normalize,
  optionTris,
  orients,
  outline,
  placedTris,
  polyTris,
  shapeKey,
  solve,
  solveOnce,
  TANGRAM,
  tangramFigures,
  turnTris,
  unionOf,
  type Level,
  type PuzzleQuestionType,
} from "./puzzle";

const TYPES: PuzzleQuestionType[] = ["build", "overlay", "combine", "split", "extra", "complete"];
const LEVELS: Level[] = [1, 2, 3];
const norm = (ids: number[]) => keyOf(normalize(ids).tris);

/** Does the drawn piece fill the hole by sliding and turning only? */
const fitsDrawn = (drawn: number[], hole: number[]) => [0, 1, 2, 3].some((k) => norm(turnTris(drawn, k, false)) === norm(hole));

describe("the lattice", () => {
  it("measures the tangram: a 4×4 square of 64 tris", () => {
    expect(TANGRAM.reduce((s, k) => s + areaOf(k), 0)).toBe(64);
    expect(areaOf("smallTri")).toBe(4);
    expect(areaOf("bigTri")).toBe(16);
    expect(polyTris([[0, 0], [4, 0], [4, 4], [0, 4]])).toHaveLength(64);
  });

  it("knows how many ways each piece can lie", () => {
    expect(orients("square", true)).toHaveLength(1);
    expect(orients("unit", true)).toHaveLength(1);
    expect(orients("smallTri", true)).toHaveLength(4);
    expect(orients("domino", true)).toHaveLength(2);
    expect(orients("para", false)).toHaveLength(2);
    expect(orients("para", true)).toHaveLength(4);
  });

  it("draws outlines with straight runs merged", () => {
    const square = polyTris([[0, 0], [4, 0], [4, 4], [0, 4]]);
    expect(outline(square)).toHaveLength(1);
    expect(outline(square)[0]).toHaveLength(4);
    expect(outline(polyTris([[0, 2], [2, 0], [4, 0], [6, 2], [4, 4], [2, 4]]))[0]).toHaveLength(6);
  });

  it("finds holes", () => {
    const ring = polyTris([[0, 0], [3, 0], [3, 3], [0, 3]]).filter((id) => !polyTris([[1, 1], [2, 1], [2, 2], [1, 2]]).includes(id));
    expect(isSolid(ring)).toBe(false);
    expect(isSolid(polyTris([[0, 0], [3, 0], [3, 3], [0, 3]]))).toBe(true);
  });

  it("tiles every tangram figure, and a placement covers what the solver said", () => {
    expect(tangramFigures()).toHaveLength(FIGURES.length);
    for (const f of FIGURES) {
      const target = polyTris(f.poly);
      const s = solveOnce(target, TANGRAM, true)!;
      expect(norm(unionOf(s))).toBe(norm(target));
      expect(keyOf(unionOf(s))).toBe(keyOf(target));
    }
    // The simple set (explore and show-me) makes each of its figures with every piece.
    expect(SIMPLE_SET.reduce((s, k) => s + areaOf(k), 0)).toBe(40);
    expect(simpleFigures()).toHaveLength(SIMPLE_FIGURES.length);
    for (const f of SIMPLE_FIGURES) {
      const target = polyTris(f.poly);
      const s = solveOnce(target, SIMPLE_SET, true)!;
      expect(s.map((p) => p.kind).sort()).toEqual([...SIMPLE_SET].sort());
      expect(keyOf(unionOf(s))).toBe(keyOf(target));
    }
    // Two small triangles make the tangram square, and the medium triangle.
    const square = polyTris([[1, 0], [2, 1], [1, 2], [0, 1]]);
    expect(solve(square, ["smallTri", "smallTri"], false, 5).length).toBeGreaterThan(0);
    expect(shapeKey(polyTris([[0, 0], [2, 0], [0, 2]]))).toBe(shapeKey(polyTris([[0, 0], [2, 0], [2, 2]])));
  });

  it("turns and flips overlay sheets", () => {
    // 3×3: the top-left cell goes top-right on a quarter turn, and top-right on a flip.
    expect(moveCells([0], 3, "turn")).toEqual([2]);
    expect(moveCells([0], 3, "flip")).toEqual([2]);
    expect(moveCells([1], 3, "turn")).toEqual([5]);
    expect(moveCells(moveCells([1, 3, 8], 4, "turn"), 4, "turnBack")).toEqual([1, 3, 8]);
  });
});

describe("puzzle questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makePuzzleQuestion(t, l, 9)).toEqual(makePuzzleQuestion(t, l, 9));
  });

  it("gives exactly one right answer for 10,000 seeds of every type and level", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makePuzzleQuestion(type, level, seed);
          switch (q.type) {
            case "build":
              expect(keyOf(unionOf(q.solution))).toBe(keyOf(q.target));
              expect([...q.solution.map((p) => p.kind)].sort()).toEqual([...q.kinds].sort());
              expect(q.kinds).toHaveLength(level === 1 ? 3 : level === 2 ? 5 : 7);
              expect(isSolid(q.target)).toBe(true);
              break;
            case "overlay": {
              const keys = q.options.map((o) => o.join());
              expect(new Set(keys).size).toBe(4);
              const right = [...new Set([...q.a, ...moveCells(q.b, q.n, q.move)])].sort((x, y) => x - y).join();
              expect(keys.filter((k) => k === right)).toHaveLength(1);
              expect(keys[q.answer]).toBe(right);
              break;
            }
            case "combine": {
              expect(new Set(q.options.map((o) => shapeKey(o))).size).toBe(4);
              expect(norm(unionOf(q.solution))).toBe(norm(q.options[q.answer]));
              // The drawn pieces sit exactly on the right option.
              expect(keyOf(unionOf(q.solution))).toBe(keyOf(q.options[q.answer]));
              q.options.forEach((o, i) => expect(solveOnce(o, q.pieces, true) !== null).toBe(i === q.answer));
              break;
            }
            case "split":
              q.options.forEach((ks, i) => expect(solveOnce(q.target, ks, true) !== null).toBe(i === q.answer));
              expect(keyOf(unionOf(q.solution))).toBe(keyOf(q.target));
              break;
            case "extra":
              q.pieces.forEach((_, i) => expect(solveOnce(q.target, q.pieces.filter((_, j) => j !== i), true) !== null).toBe(i === q.answer));
              expect(keyOf(unionOf(q.solution))).toBe(keyOf(q.target));
              break;
            case "complete": {
              expect(keyOf(placedTris(q.fill).sort((a, b) => a - b))).toBe(keyOf(q.hole));
              expect(q.options).toHaveLength(4);
              q.options.forEach((o, i) => expect(fitsDrawn(optionTris(o), q.hole)).toBe(i === q.answer));
              expect(isSolid(q.target.filter((id) => !q.hole.includes(id)))).toBe(true);
              break;
            }
          }
        }
  }, 600_000);
});
