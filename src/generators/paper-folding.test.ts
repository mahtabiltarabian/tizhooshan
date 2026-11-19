import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  area,
  centroid,
  countPieces,
  creaseSpots,
  creases,
  facets,
  foldedPoly,
  holeCells,
  inside,
  makePaperQuestion,
  maskKey,
  orderSteps,
  reflect,
  shapes,
  square,
  symmetryLines,
  unfoldPoints,
  unfoldSegments,
  type Fold,
  type Level,
  type PaperQuestionType,
} from "./paper-folding";

const level = fc.constantFrom<Level>(1, 2, 3);
const seed = fc.integer({ min: 0, max: 1_000_000 });

describe("geometry", () => {
  it("a square has four mirror lines; a 2×4 rectangle has two", () => {
    expect(symmetryLines(square(4)).map((l) => l.kind).sort()).toEqual(["a", "d", "h", "v"]);
    const rect = shapes(4, [{ line: { kind: "v", c: 2 }, moving: -1 }]).at(-1)!;
    expect(symmetryLines(rect).map((l) => l.kind).sort()).toEqual(["h", "v"]);
  });

  it("reflects across each kind of line", () => {
    expect(reflect([1, 3], { kind: "v", c: 2 })).toEqual([3, 3]);
    expect(reflect([1, 3], { kind: "h", c: 2 })).toEqual([1, 1]);
    expect(reflect([1, 3], { kind: "d", c: 0 })).toEqual([3, 1]);
    expect(reflect([1, 0], { kind: "a", c: 4 })).toEqual([4, 3]);
  });

  it("folding a square in half twice leaves a quarter", () => {
    const folds: Fold[] = [
      { line: { kind: "v", c: 2 }, moving: -1 },
      { line: { kind: "h", c: 2 }, moving: 1 },
    ];
    const final = shapes(4, folds).at(-1)!;
    expect(area(final)).toBe(4);
    expect(inside([3, 1], final)).toBe(true);
  });

  it("one hole in paper folded twice unfolds into four mirrored holes", () => {
    const folds: Fold[] = [
      { line: { kind: "v", c: 2 }, moving: -1 },
      { line: { kind: "h", c: 2 }, moving: 1 },
    ];
    expect(holeCells(unfoldPoints([[2.5, 0.5]], folds))).toEqual(["1,0", "1,3", "2,0", "2,3"]);
  });
});

describe("holes on a fold line", () => {
  it("a hole on the crease of one fold unfolds to one hole on the crease, not two", () => {
    const folds: Fold[] = [{ line: { kind: "v", c: 2 }, moving: 1 }];
    expect(unfoldPoints([[2, 1.5]], folds)).toEqual([[2, 1.5]]);
    // Next to it, off the line, it still doubles.
    expect(unfoldPoints([[1.5, 1.5]], folds)).toHaveLength(2);
  });

  it("folded twice, a hole on the last crease makes 2 holes; on both creases (the corner), 1", () => {
    const folds: Fold[] = [
      { line: { kind: "v", c: 2 }, moving: 1 },
      { line: { kind: "h", c: 2 }, moving: 1 },
    ];
    expect(unfoldPoints([[0.5, 2]], folds).sort()).toEqual([[0.5, 2], [3.5, 2]]);
    expect(unfoldPoints([[2, 2]], folds)).toEqual([[2, 2]]);
  });

  it("on a diagonal fold, a cell centre on the crease stays one hole", () => {
    const folds: Fold[] = [{ line: { kind: "d", c: 0 }, moving: 1 }];
    expect(unfoldPoints([[1.5, 1.5]], folds)).toEqual([[1.5, 1.5]]);
  });

  it("crease spots lie on the folded edge, never on the sheet's own edge, and unfold to fewer holes", () => {
    expect(creaseSpots(4, [])).toEqual([]);
    const one: Fold[] = [{ line: { kind: "v", c: 2 }, moving: 1 }];
    expect(creaseSpots(4, one)).toEqual([[2, 0.5], [2, 1.5], [2, 2.5], [2, 3.5]]);
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makePaperQuestion("holes", l, s);
        const spots = creaseSpots(q.S, q.folds);
        expect(spots.length).toBeGreaterThan(0);
        for (const p of spots) {
          const open = unfoldPoints([p], q.folds);
          expect(open.length).toBeLessThan(2 ** q.folds.length);
          expect(open.every(([x, y]) => x > 0 && y > 0 && x < q.S && y < q.S)).toBe(true);
          // It is on (at least) one fold line once the paper is folded back up to that fold.
          expect(open.some((o) => q.folds.some((f) => Math.abs(reflect(o, f.line)[0] - o[0]) + Math.abs(reflect(o, f.line)[1] - o[1]) < 1e-6))).toBe(true);
        }
      }),
      { numRuns: 150 },
    );
  });
});

describe("creases", () => {
  it("folding in half twice leaves one crease across and two half creases", () => {
    const folds: Fold[] = [
      { line: { kind: "v", c: 2 }, moving: -1 },
      { line: { kind: "h", c: 2 }, moving: 1 },
    ];
    const all = creases(4, folds);
    expect(all).toHaveLength(3);
    const len = (s: [[number, number], [number, number]]) => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
    expect(all.map(len).sort()).toEqual([2, 2, 4]);
    // Still folded once: only the second fold's crease shows, on the half that is left.
    const [only, ...rest] = creases(4, folds, 1);
    expect(rest).toHaveLength(0);
    expect([...only].sort((a, b) => a[0] - b[0])).toEqual([[2, 2], [4, 2]]);
  });
});

describe("pieces", () => {
  it("one straight cut across flat paper makes 2 pieces", () => {
    expect(countPieces(4, [[[0, 1.5], [4, 1.5]]])).toBe(2);
  });

  it("folded once, a cut parallel to the fold makes 3 pieces; across the fold, 2", () => {
    const folds: Fold[] = [{ line: { kind: "v", c: 2 }, moving: -1 }];
    expect(countPieces(4, unfoldSegments([[[3, 0], [3, 4]]], folds))).toBe(3);
    expect(countPieces(4, unfoldSegments([[[2, 1.5], [4, 1.5]]], folds))).toBe(2);
  });
});

describe("facets (3D layers)", () => {
  it("cover the paper exactly, 2^k panels, all landing on the folded shape", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makePaperQuestion("holes", l, s);
        const fs = facets(q.S, q.folds);
        expect(fs).toHaveLength(2 ** q.folds.length);
        expect(fs.reduce((a, f) => a + area(f.poly), 0)).toBeCloseTo(q.S * q.S, 6);
        const final = shapes(q.S, q.folds).at(-1)!;
        for (const f of fs) {
          const folded = foldedPoly(f, q.folds);
          // Folding moves a panel rigidly, and every panel ends up inside the folded shape.
          expect(area(folded)).toBeCloseTo(area(f.poly), 6);
          expect(inside(centroid(folded), final)).toBe(true);
        }
      }),
      { numRuns: 120 },
    );
  });
});

describe("makePaperQuestion", () => {
  const types: PaperQuestionType[] = ["holes", "holesChoice", "cutChoice", "pieces", "foldedShape", "order"];

  it("is deterministic for a seed", () => {
    for (const t of types) expect(makePaperQuestion(t, 3, 7)).toEqual(makePaperQuestion(t, 3, 7));
  });

  it("holes: answer has (holes × 2^folds) cells, all on the paper, symmetric about the first fold", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makePaperQuestion("holes", l, s);
        if (q.type !== "holes") throw new Error("type");
        expect(q.answer).toHaveLength(q.punches.length * 2 ** q.folds.length);
        for (const key of q.answer) {
          const [i, j] = key.split(",").map(Number);
          expect(i >= 0 && j >= 0 && i < q.S && j < q.S).toBe(true);
          const m = reflect([i + 0.5, j + 0.5], q.folds[0].line);
          expect(q.answer).toContain(`${Math.floor(m[0])},${Math.floor(m[1])}`);
        }
        if (l === 3) expect(q.folds.some((f) => f.line.kind === "d" || f.line.kind === "a")).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("holesChoice: exactly one option is the true pattern; options differ", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makePaperQuestion("holesChoice", l, s);
        if (q.type !== "holesChoice") throw new Error("type");
        const truth = holeCells(unfoldPoints(q.punches, q.folds)).join(";");
        const keys = q.options.map((o) => holeCells(o).join(";"));
        expect(keys.filter((k) => k === truth)).toHaveLength(1);
        expect(keys[q.answer]).toBe(truth);
        expect(new Set(keys).size).toBe(keys.length);
        expect(q.options.length).toBe(4);
      }),
      { numRuns: 200 },
    );
  });

  it("cutChoice: four different pictures, one correct", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makePaperQuestion("cutChoice", l, s);
        if (q.type !== "cutChoice") throw new Error("type");
        const keys = q.options.map((o) => maskKey(q.S, o));
        expect(new Set(keys).size).toBe(4);
        expect(q.mistakes[q.answer]).toBeNull();
      }),
      { numRuns: 150 },
    );
  });

  it("pieces: the answer matches counting the unfolded paper", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makePaperQuestion("pieces", l, s);
        if (q.type !== "pieces") throw new Error("type");
        expect(q.options[q.answer]).toBe(countPieces(q.S, unfoldSegments([q.segment], q.folds)));
        expect(q.options[q.answer]).toBeGreaterThanOrEqual(2);
        expect(new Set(q.options).size).toBe(q.options.length);
      }),
      { numRuns: 60 },
    );
  });

  it("foldedShape: exactly one option is the folded paper", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makePaperQuestion("foldedShape", l, s);
        if (q.type !== "foldedShape") throw new Error("type");
        const truth = maskKey(q.S, [shapes(q.S, q.folds).at(-1)!], 4);
        const keys = q.options.map((o) => maskKey(q.S, [o], 4));
        expect(keys.filter((k) => k === truth)).toHaveLength(1);
        expect(keys[q.answer]).toBe(truth);
        expect(q.options.length).toBeGreaterThanOrEqual(3);
      }),
      { numRuns: 150 },
    );
  });

  it("order: level 1 has one fold, levels 2 and 3 have two and three; steps are shown out of order", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makePaperQuestion("order", l, s);
        if (q.type !== "order") throw new Error("type");
        expect(q.folds).toHaveLength(l);
        const n = orderSteps(q.folds);
        expect([...q.shown].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
        expect(q.shown.some((v, i) => v !== i)).toBe(true);
        if (l === 1) {
          // One fold: put fold → punch → open in order; the hole is off the fold, so it doubles.
          expect(n).toBe(3);
          expect(q.punches).toHaveLength(1);
          expect(unfoldPoints(q.punches, q.folds)).toHaveLength(2);
        } else {
          expect(n).toBe(l);
          expect(q.punches).toEqual([]);
        }
      }),
    );
  });
});
