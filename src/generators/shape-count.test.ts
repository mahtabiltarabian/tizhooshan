import { describe, expect, it } from "vitest";
import {
  countMistake,
  countOf,
  figureOf,
  figuresFor,
  listShapes,
  makeCountQuestion,
  makeShapeQuestion,
  shapeFromTaps,
  type CountQuestionType,
  type Level,
} from "./shape-count";

const C2 = (n: number) => (n * (n - 1)) / 2;

describe("counting shapes", () => {
  it("counts squares and rectangles in a grid", () => {
    expect(countOf({ family: "grid", a: 2, b: 2 }, "square")).toBe(5);
    expect(countOf({ family: "grid", a: 3, b: 3 }, "square")).toBe(14);
    expect(countOf({ family: "grid", a: 2, b: 2 }, "rectangle")).toBe(9);
    expect(countOf({ family: "grid", a: 4, b: 3 }, "rectangle")).toBe(C2(5) * C2(4));
  });

  it("counts triangles in the classic figures", () => {
    expect([1, 2, 3, 4].map((n) => countOf({ family: "triGrid", a: n, b: 0 }, "triangle"))).toEqual([1, 5, 13, 27]);
    expect(countOf({ family: "star", a: 0, b: 0 }, "triangle")).toBe(10);
    expect(countOf({ family: "star", a: 1, b: 0 }, "triangle")).toBe(35);
    expect(countOf({ family: "envelope", a: 0, b: 0 }, "triangle")).toBe(8);
    for (let a = 1; a <= 5; a++) for (let b = 1; b <= 3; b++) expect(countOf({ family: "fan", a, b }, "triangle")).toBe(C2(a + 1) * b);
  });

  it("counts segments and angles", () => {
    for (let a = 2; a <= 8; a++) expect(countOf({ family: "line", a, b: 0 }, "segment")).toBe(C2(a));
    for (let a = 2; a <= 8; a++) expect(countOf({ family: "rays", a, b: 0 }, "angle")).toBe(C2(a));
    // On a straight line the 180° pair is not an angle.
    for (let a = 1; a <= 6; a++) expect(countOf({ family: "rays", a, b: 1 }, "angle")).toBe(C2(a + 2) - 1);
  });

  it("finds the smallest pieces and how many each shape covers", () => {
    expect(figureOf({ family: "grid", a: 3, b: 2 }).faces).toHaveLength(6);
    expect(figureOf({ family: "triGrid", a: 3, b: 0 }).faces).toHaveLength(9);
    const squares = listShapes(figureOf({ family: "grid", a: 3, b: 3 }), "square");
    expect(squares.map((s) => s.pieces)).toEqual([...Array(9).fill(1), ...Array(4).fill(4), 9]);
    const tris = listShapes(figureOf({ family: "triGrid", a: 2, b: 0 }), "triangle");
    expect(tris.filter((s) => s.pieces === 1)).toHaveLength(4);
    expect(tris[tris.length - 1].pieces).toBe(4);
  });

  it("recognises tapped shapes in any order", () => {
    const fig = figureOf({ family: "grid", a: 2, b: 1 });
    const at = (x: number, y: number) => fig.pts.findIndex((p) => p[0] === x && p[1] === y);
    expect(shapeFromTaps(fig, "rectangle", [at(2, 1), at(0, 0), at(0, 1), at(2, 0)])).not.toBeNull();
    expect(shapeFromTaps(fig, "square", [at(2, 1), at(0, 0), at(0, 1), at(2, 0)])).toBeNull();
    const rays = figureOf({ family: "rays", a: 3, b: 0 });
    const tips = rays.pts.map((_, i) => i).filter((i) => i !== rays.origin);
    expect(shapeFromTaps(rays, "angle", [tips[0], tips[2]])?.pieces).toBe(2);
  });
});

describe("count questions", () => {
  const types: CountQuestionType[] = ["triangle", "square", "rectangle", "segment", "angle", "growing"];
  const levels: Level[] = [1, 2, 3];

  it("has figures for every type and level, inside the level's range", () => {
    const ranges = { 1: [3, 8], 2: [9, 20], 3: [21, 60] } as const;
    for (const t of types)
      for (const l of levels) {
        if (t === "growing") continue;
        const list = figuresFor(t, l);
        expect(list.length, `${t} ${l}`).toBeGreaterThan(0);
        for (const s of list) {
          const n = countOf(s, t);
          expect(n).toBeGreaterThanOrEqual(ranges[l][0]);
          expect(n).toBeLessThanOrEqual(ranges[l][1]);
        }
      }
  });

  it("is the same for the same seed, and builds for 10,000 seeds", () => {
    for (const t of types)
      for (const l of levels) {
        expect(makeCountQuestion(t, l, 42)).toEqual(makeCountQuestion(t, l, 42));
        let bad = 0;
        for (let s = 0; s < 10_000; s++) if (!(makeCountQuestion(t, l, s).answer > 0)) bad++;
        expect(bad, `${t} ${l}`).toBe(0);
      }
  }, 240_000);

  it("growing patterns give the known sequences", () => {
    const q = makeCountQuestion("growing", 2, 3);
    expect(q.type).toBe("growing");
    if (q.type !== "growing") return;
    const known: Record<string, number[]> = {
      fanTriangles: [1, 3, 6],
      stripRects: [1, 3, 6],
      raysAngles: [1, 3, 6],
      gridSquares: [1, 5, 14],
      triGridTriangles: [1, 5, 13],
    };
    expect(q.counts).toEqual(known[q.pattern]);
  });

  it("names the usual miscounts", () => {
    const rect = { type: "rectangle", level: 2, seed: 0, spec: { family: "grid", a: 2, b: 2 }, kind: "rectangle", answer: 9 } as const;
    expect(countMistake(rect, 9)).toBe("right");
    expect(countMistake(rect, 4)).toBe("singles");
    expect(countMistake(rect, 8)).toBe("fewMissed");
    expect(countMistake(rect, 12)).toBe("over");
    const strip = { ...rect, spec: { family: "grid", a: 3, b: 2 } as const, answer: 18 };
    expect(countMistake(strip, 18 - 8)).toBe("noSquares");
    const angles = { type: "angle", level: 1, seed: 0, spec: { family: "rays", a: 2, b: 1 }, kind: "angle", answer: 5 } as const;
    expect(countMistake(angles, 6)).toBe("straight");
  });
});

describe("all shape questions", () => {
  it("hands hidden-figure and one-stroke questions to their makers", () => {
    for (const l of [1, 2, 3] as Level[]) {
      expect(makeShapeQuestion("hidden", l, 9).type).toBe("hidden");
      expect(makeShapeQuestion("stroke", l, 9).type).toBe("stroke");
      expect(makeShapeQuestion("square", l, 9)).toEqual(makeCountQuestion("square", l, 9));
    }
  });
});
