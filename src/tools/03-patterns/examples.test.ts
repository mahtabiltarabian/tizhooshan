import { describe, expect, it } from "vitest";
import { makePatternQuestion, tileKey, type GridQuestion, type Level, type PatternQuestion, type PatternQuestionType } from "@/generators/patterns";
import { PATTERNS_GUIDE } from "./guide";

// The hand-picked scenes in the teacher guide, rebuilt the way the tool's
// hash reader builds them (PatternsTool: #try=type&level&seed, #show, #f=x).
const TYPES: PatternQuestionType[] = ["matrix2", "matrix3", "sequence", "rotation", "combine", "sides", "missing", "odd"];

const examples = PATTERNS_GUIDE.examples ?? [];
const build = (hash: string): PatternQuestion => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as PatternQuestionType;
  expect(TYPES).toContain(type);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makePatternQuestion(type, level, Number(p.get("seed")));
};
const grid = (hash: string): GridQuestion => {
  const q = build(hash);
  if (q.type === "missing" || q.type === "odd") throw new Error("expected a grid question");
  return q;
};
const byFor = (i: number) => examples.find((ex) => ex.for === i)!.hash;

describe("patterns guide examples", () => {
  it("every link opens a real scene", () => {
    for (const ex of examples) {
      const p = new URLSearchParams(ex.hash);
      if (p.has("try")) expect(() => build(ex.hash)).not.toThrow();
      else {
        expect(p.has("show")).toBe(true);
        const f = Number(p.get("f") ?? 1);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });

  it("one rule only: two options each break exactly one of the two rules", () => {
    const q = grid(byFor(0));
    expect(q.rules?.map((r) => r.kind).sort()).toEqual(["count", "fill"]);
    expect(q.tags[1]).toBe("fill");
    expect(q.tags[3]).toBe("count");
  });

  it("copy: option 3 is the cell next to the blank", () => {
    const q = grid(byFor(1));
    expect(q.tags[2]).toBe("copy");
    expect(tileKey(q.options[2])).toBe(tileKey(q.cells[q.blank - 1]));
  });

  it("columns: the show link stops part-way, after the rows", () => {
    // Explore's starter pattern is read in 7 steps: 3 rows, 3 columns, the answer; 0.6 lands on column 2.
    expect(Math.floor(Number(new URLSearchParams(byFor(2)).get("f")) * 7)).toBe(4);
  });

  it("odd one out: all turned, one flipped", () => {
    const q = build(byFor(3));
    if (q.type !== "odd") throw new Error("expected odd");
    expect(q.level).toBe(2);
    q.tiles.forEach((t, i) => expect(!!t.flip).toBe(i === q.answer));
  });

  it("the other scenes show what their notes say", () => {
    const shapes = grid("try=matrix3&level=1&seed=1");
    expect(shapes.rules?.[0]).toMatchObject({ kind: "shape", set: ["star", "diamond", "square"] });
    expect(grid("try=sequence&level=1&seed=1").rules?.[0]).toMatchObject({ kind: "count", step: 1 });
    expect(grid("try=combine&level=2&seed=1").tags).toContain("otherOp");
    const three = grid("try=matrix3&level=3&seed=4");
    expect(three.options).toHaveLength(6);
    expect(three.rules?.map((r) => r.kind).sort()).toEqual(["count", "fill", "shape"]);
    const missing = build("try=missing&level=2&seed=2");
    if (missing.type !== "missing") throw new Error("expected missing");
    expect(missing.tags).toContain("patchShift");
    expect(missing.tags).toContain("patchMirror");
  });
});
