import { describe, expect, it } from "vitest";
import { geometryMistake, makeGeometryQuestion, slips, type GeometryQuestion, type GeometryQuestionType, type Level } from "@/generators/geometry";
import { GEOMETRY_TYPE_LABEL } from "./GeometryTryPanel";
import { GEOMETRY_GUIDE } from "./guide";
import { CIRCLE_R, SLICES } from "./MeasurePictures";
import { PHI_RANGE } from "./ParallelPictures";

// The hand-picked scenes in the teacher guide, rebuilt the way GeometryTool's
// hash reader builds them (#try=type&level&seed, #show=kind&level&seed, #explore=…).
const TYPES = Object.keys(GEOMETRY_TYPE_LABEL) as GeometryQuestionType[];
const examples = GEOMETRY_GUIDE.examples ?? [];

const build = (hash: string): GeometryQuestion => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as GeometryQuestionType;
  expect(TYPES).toContain(type);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makeGeometryQuestion(type, level, Number(p.get("seed")));
};
const byFor = (i: number) => build(examples.find((ex) => ex.for === i)!.hash);
/** The slip is offered and a pupil typing its value gets that slip's feedback. */
const trap = (q: GeometryQuestion, tag: string) => {
  const hit = slips(q).find(([t]) => t === tag);
  expect(hit, tag).toBeDefined();
  expect(hit![1]).not.toBe(q.answer);
  expect(geometryMistake(q, hit![1])).toBe(tag);
};

describe("geometry guide examples", () => {
  it("every link opens a real scene", () => {
    for (const ex of examples) {
      const p = new URLSearchParams(ex.hash);
      if (p.has("try")) expect(() => build(ex.hash)).not.toThrow();
      else if (p.has("show")) {
        expect(["sample", "circle", "composite", "parallel"]).toContain(p.get("show"));
        expect([1, 2, 3]).toContain(Number(p.get("level")));
        const kind = p.get("show") === "sample" ? "area" : (p.get("show") as GeometryQuestionType);
        expect(() => makeGeometryQuestion(kind, Number(p.get("level")) as Level, Number(p.get("seed")))).not.toThrow();
      } else {
        expect(["circle", "parallel", "composite"]).toContain(p.get("explore"));
        if (p.has("r")) expect(CIRCLE_R).toContain(Number(p.get("r")));
        if (p.has("k")) expect(SLICES).toContain(Number(p.get("k")));
        if (p.has("phi")) expect(Number(p.get("phi"))).toBeGreaterThanOrEqual(PHI_RANGE[0]);
      }
    }
  });

  it("pegs for gaps: counting pegs is a named slip on a 3 × 2 rectangle", () => {
    const q = byFor(0);
    expect(q.type).toBe("perimeter");
    trap(q, "dots");
  });

  it("area or perimeter: the perimeter is a named slip", () => {
    const q = byFor(1);
    expect(q.type).toBe("area");
    trap(q, "perimeter");
  });

  it("halves: a triangle where halves-as-whole and no ÷ 2 both trap", () => {
    const q = byFor(2);
    if (q.type !== "area") throw new Error("expected an area question");
    expect(q.poly).toHaveLength(3);
    trap(q, "halfAsWhole");
    trap(q, "noHalf");
  });

  it("angle sum: a pentagon where n × 180 traps", () => {
    const q = byFor(3);
    if (q.type !== "angle") throw new Error("expected an angle question");
    expect(q.variant).toBe("polygon");
    expect(q.angles).toHaveLength(5);
    trap(q, "nTimes180");
  });

  it("radius or diameter: the diameter is given and the area asked", () => {
    const q = byFor(4);
    if (q.type !== "circle") throw new Error("expected a circle question");
    expect(q.given).toBe("d");
    expect(q.asks).toBe("A");
    trap(q, "dAsR");
    trap(q, "circForArea");
  });

  it("semicircle perimeter: the show scene is a semicircle whose curve alone is a slip", () => {
    const ex = examples.find((e) => e.for === 5)!;
    const p = new URLSearchParams(ex.hash);
    expect(p.get("show")).toBe("circle");
    const q = makeGeometryQuestion("circle", Number(p.get("level")) as Level, Number(p.get("seed")));
    if (q.type !== "circle") throw new Error("expected a circle question");
    expect(q.variant).toBe("semiP");
    trap(q, "noStraight");
  });

  it("composite: an L with the double-counted corner and a missing length", () => {
    const q = byFor(6);
    expect(q.type).toBe("composite");
    trap(q, "overlapTwice");
    trap(q, "missingLength");
  });

  it("parallel lines: equal for supplementary traps", () => {
    const q = byFor(7);
    expect(q.type).toBe("parallel");
    trap(q, "equalNotSupp");
  });

  it("not parallel: three lines, one without arrows", () => {
    const q = byFor(8);
    if (q.type !== "parallel") throw new Error("expected a parallel question");
    expect(q.variant).toBe("decoy");
    trap(q, "notParallel");
  });
});
