import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  countCubes,
  cubeRange,
  emptyTower,
  frontView,
  hiddenCount,
  isHidden,
  layerCounts,
  makeTowerQuestion,
  matchesViews,
  paintedCount,
  paintedFaces,
  sideView,
  topView,
  type Level,
  type TowerQuestionType,
} from "./cube-towers";

const level = fc.constantFrom<Level>(1, 2, 3);
const seed = fc.integer({ min: 0, max: 1_000_000 });

describe("views", () => {
  it("front = tallest in each column x, side = tallest in each row y, top = footprint", () => {
    const t = { w: 3, d: 2, h: [
      [1, 0, 2],
      [3, 1, 0],
    ] };
    expect(frontView(t)).toEqual([3, 1, 2]);
    expect(sideView(t)).toEqual([2, 3]);
    expect(topView(t)).toEqual([
      [true, false, true],
      [true, true, false],
    ]);
    expect(countCubes(t)).toBe(7);
    expect(layerCounts(t)).toEqual([4, 2, 1]);
  });
});

describe("hidden cubes", () => {
  it("finds the cube under the middle of a 3×3 block two high", () => {
    const t = emptyTower(3, 3);
    t.h = [
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2],
    ];
    expect(isHidden(t, 1, 1, 0)).toBe(true);
    expect(hiddenCount(t)).toBe(1);
  });

  it("a cube with a lower neighbour is visible", () => {
    const t = { w: 2, d: 1, h: [[2, 1]] };
    expect(hiddenCount(t)).toBe(0);
  });
});

describe("painted cube", () => {
  it("formula matches counting every small cube, for n = 2..5", () => {
    for (let n = 2; n <= 5; n++) {
      const tally = [0, 0, 0, 0];
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) tally[paintedFaces(n, x, y, z)]++;
      expect([0, 1, 2, 3].map((k) => paintedCount(n, k))).toEqual(tally);
      expect(tally.reduce((a, b) => a + b, 0)).toBe(n ** 3);
    }
  });
});

describe("cubeRange", () => {
  it("a 2×2 block one high seen only from front and side allows 2 to 4 cubes", () => {
    const r = cubeRange(2, 2, { front: [1, 1], side: [1, 1] });
    expect(r.min).toBe(2);
    expect(r.max).toBe(4);
  });
});

describe("makeTowerQuestion", () => {
  const types: TowerQuestionType[] = ["count", "top", "front", "side", "build", "complete", "paint", "solid"];

  it("is deterministic for a seed", () => {
    for (const t of types) expect(makeTowerQuestion(t, 2, 99)).toEqual(makeTowerQuestion(t, 2, 99));
  });

  it("count: answer is the number of cubes; level 1 has no hidden cubes, levels 2-3 have some", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeTowerQuestion("count", l, s);
        if (q.type !== "count") throw new Error("type");
        expect(q.options[q.answer]).toBe(countCubes(q.tower));
        expect(new Set(q.options).size).toBe(4);
        expect(q.hidden).toBe(hiddenCount(q.tower));
        if (l === 1) expect(q.hidden).toBe(0);
        else expect(q.hidden).toBeGreaterThan(0);
        if (q.hidden) expect(q.options).toContain(countCubes(q.tower) - q.hidden);
      }),
      { numRuns: 150 },
    );
  });

  it("views: exactly one option is the true view, and options are all different", () => {
    fc.assert(
      fc.property(level, seed, fc.constantFrom<"top" | "front" | "side">("top", "front", "side"), (l, s, ty) => {
        const q = makeTowerQuestion(ty, l, s);
        if (q.type !== ty) throw new Error("type");
        const truth = ty === "top" ? JSON.stringify(topView(q.tower)) : JSON.stringify(ty === "front" ? frontView(q.tower) : sideView(q.tower));
        const keys = q.options.map((o) => JSON.stringify(o.kind === "top" ? o.cells : o.heights));
        expect(keys.filter((k) => k === truth)).toHaveLength(1);
        expect(keys[q.answer]).toBe(truth);
        expect(new Set(keys).size).toBe(q.options.length);
        expect(q.options.length).toBe(4);
      }),
      { numRuns: 150 },
    );
  });

  it("build: the hidden tower matches the views and lies within the reported range", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeTowerQuestion("build", l, s);
        if (q.type !== "build") throw new Error("type");
        expect(matchesViews(q.tower, q.views)).toBe(true);
        const n = countCubes(q.tower);
        expect(q.min).toBeLessThanOrEqual(n);
        expect(q.max).toBeGreaterThanOrEqual(n);
        expect(q.solutions).toBeGreaterThanOrEqual(1);
        if (l === 3) expect(q.views.top).toBeUndefined();
      }),
      { numRuns: 80 },
    );
  });

  it("complete: answer is the cubes still needed for the full n×n×n cube", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeTowerQuestion("complete", l, s);
        if (q.type !== "complete") throw new Error("type");
        expect(q.tower.w).toBe(q.n);
        expect(Math.max(...q.tower.h.flat())).toBeLessThanOrEqual(q.n);
        expect(q.options[q.answer]).toBe(q.n ** 3 - countCubes(q.tower));
        expect(q.options[q.answer]).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it("paint: answer follows the formula; options differ", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeTowerQuestion("paint", l, s);
        if (q.type !== "paint") throw new Error("type");
        expect(q.options[q.answer]).toBe(paintedCount(q.n, q.k));
        expect(new Set(q.options).size).toBe(4);
      }),
    );
  });
});
