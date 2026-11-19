import { describe, expect, it } from "vitest";
import {
  BASIC_SOLIDS,
  counts,
  dot,
  makeSolidQuestion,
  PARTS,
  PICTURE_VIEW,
  solidMistake,
  solidModel,
  solidPicture,
  solidSlips,
  type Level,
  type Solid,
} from "./solids";

const LEVELS: Level[] = [1, 2, 3];
const ALL: Solid[] = [
  ...BASIC_SOLIDS,
  ...Array.from({ length: 10 }, (_, i): Solid => ({ family: "prism", n: 3 + i })),
  ...Array.from({ length: 10 }, (_, i): Solid => ({ family: "pyramid", n: 3 + i })),
];

describe("solid models", () => {
  it("the real geometry has the counts the formulas give, and V − E + F = 2", () => {
    for (const s of ALL) {
      const m = solidModel(s);
      const c = counts(s);
      expect(m.faces.length).toBe(c.faces);
      expect(m.edges.length).toBe(c.edges);
      expect(m.vertices.length).toBe(c.vertices);
      expect(c.vertices - c.edges + c.faces).toBe(2);
      // Every edge lies on exactly two faces, every face edge is a listed edge.
      for (const [a, b] of m.edges) {
        const on = m.faces.filter((f) => f.some((v, i) => (v === a && f[(i + 1) % f.length] === b) || (v === b && f[(i + 1) % f.length] === a)));
        expect(on).toHaveLength(2);
      }
      const faceEdges = m.faces.reduce((sum, f) => sum + f.length, 0);
      expect(faceEdges).toBe(2 * c.edges);
      // Normals point outward: away from the centre of the solid.
      const centre = [0, 1, 2].map((k) => m.vertices.reduce((a, v) => a + v[k], 0) / m.vertices.length) as [number, number, number];
      m.faces.forEach((f, i) => {
        const p = m.vertices[f[0]];
        expect(dot(m.normals[i], [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]])).toBeGreaterThan(0);
      });
    }
  });

  it("pictures never show a face edge-on, and hide some edges", () => {
    for (const s of BASIC_SOLIDS) {
      const m = solidModel(s);
      for (const nv of m.normals) expect(Math.abs(dot(nv, PICTURE_VIEW))).toBeGreaterThan(0.08);
      const pic = solidPicture(s);
      expect(pic.edges.some((e) => e.hidden)).toBe(true);
      expect(pic.visible.faces).toBeLessThan(counts(s).faces);
    }
    // The classic cube picture: 3 faces, 9 edges and 7 vertices can be seen.
    expect(solidPicture(BASIC_SOLIDS[0]).visible).toEqual({ faces: 3, edges: 9, vertices: 7 });
  });
});

describe("solid questions", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeSolidQuestion(l, 42)).toEqual(makeSolidQuestion(l, 42));
  });

  it("gives a sound question with one right option for 10,000 seeds of every level", () => {
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeSolidQuestion(level, seed);
        expect(q.level).toBe(level);

        // Recompute the answer from the geometry, not from the formulas.
        const real = (s: Solid) => {
          const m = solidModel(s);
          return { faces: m.faces.length, edges: m.edges.length, vertices: m.vertices.length };
        };
        let truth: number;
        switch (q.kind) {
          case "count":
            expect(level).toBe(1);
            truth = real(q.solid)[q.part];
            break;
          case "combine": {
            expect(level).toBe(2);
            const [a, b] = q.solids.map((s) => real(s)[q.part]);
            expect(q.solids[0]).not.toEqual(q.solids[1]);
            truth = q.op === "sum" ? a + b : a - b;
            break;
          }
          case "reverse": {
            expect(level).toBe(3);
            expect(q.given).not.toBe(q.part);
            if (q.solid.family === "pyramid") expect([q.given, q.part].sort()).not.toEqual(["faces", "vertices"]);
            // Only one solid of this family has the given count.
            const matches = Array.from({ length: 40 }, (_, i) => ({ family: q.solid.family, n: 3 + i })).filter((s) => real(s)[q.given] === q.givenValue);
            expect(matches).toHaveLength(1);
            truth = real(matches[0])[q.part];
            break;
          }
          case "euler": {
            expect(level).toBe(3);
            expect(q.given.map(([p]) => p)).not.toContain(q.part);
            const g = Object.fromEntries(q.given);
            truth = q.part === "faces" ? 2 - g.vertices + g.edges : q.part === "vertices" ? 2 - g.faces + g.edges : g.vertices + g.faces - 2;
            break;
          }
        }
        expect(truth).toBeGreaterThan(0);
        expect(q.value).toBe(truth);
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.options.filter((v) => v === truth)).toHaveLength(1);
        expect(q.options[q.answer]).toBe(truth);
        q.options.forEach((v, i) => {
          expect(v).toBeGreaterThan(0);
          const tag = solidMistake(q, v);
          if (i === q.answer) expect(tag).toBe("right");
          else expect(tag).toBe(q.mistakes[i] ?? "other");
        });
        // No slip may equal the right answer and still be reported as a slip.
        for (const [, v] of solidSlips(q)) if (v === truth) expect(solidMistake(q, v)).toBe("right");
        expect(PARTS).toContain(q.part);
      }
  }, 240_000);

  it("level 1 offers the 'forgot the hidden ones' slip whenever the picture hides some", () => {
    for (let seed = 0; seed < 2000; seed++) {
      const q = makeSolidQuestion(1, seed);
      if (q.kind !== "count") throw new Error("kind");
      const seen = solidPicture(q.solid).visible[q.part];
      if (seen !== q.value) expect(q.mistakes).toContain("visibleOnly");
    }
  });
});
