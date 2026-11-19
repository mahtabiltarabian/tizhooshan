import { describe, expect, it } from "vitest";
import {
  anglePolygon,
  answerKind,
  area2,
  areaMethod,
  areaOf,
  bandPegs,
  bandProblem,
  BOARD,
  borderCells,
  boundaryPegs,
  boxOf,
  boxPieces,
  cellCover,
  checkBuild,
  checkCut,
  cornerAngles,
  cutAreas,
  geometryMistake,
  halvingCuts,
  insidePegs,
  isConvex,
  isRectilinear,
  isSquare,
  makeGeometryQuestion,
  perimeterOf,
  ptsFromParam,
  ptsToParam,
  simplify,
  slips,
  squareCount,
  type BuildQuestion,
  type DivideQuestion,
  type GeometryQuestion,
  type GeometryQuestionType,
  type Level,
  type Pt,
} from "./geometry";

const TYPES: GeometryQuestionType[] = ["area", "perimeter", "angle", "classify", "build", "divide"];
const LEVELS: Level[] = [1, 2, 3];
const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Area by counting: every grid square's covered part, added up. */
const countedArea = (poly: Pt[]) => cellCover(poly).reduce((s, c) => s + c.c, 0);

describe("geoboard maths", () => {
  it("finds areas by shoelace, Pick's theorem and counting squares", () => {
    const shapes: Pt[][] = [
      rect(0, 0, 3, 4),
      [[0, 0], [4, 0], [0, 3]],
      [[1, 0], [3, 1], [2, 3], [0, 2]],
      [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]],
      [[0, 2], [2, 0], [4, 2], [4, 4], [0, 4]],
    ];
    const areas = [12, 6, 5, 6, 12];
    shapes.forEach((s, i) => {
      expect(areaOf(s)).toBe(areas[i]);
      expect(insidePegs(s) + boundaryPegs(s) / 2 - 1).toBe(areas[i]);
      expect(countedArea(s)).toBeCloseTo(areas[i], 9);
    });
  });

  it("measures perimeters only along the grid", () => {
    expect(perimeterOf(rect(1, 1, 3, 2))).toBe(10);
    // An L shape has the same perimeter as its bounding rectangle.
    expect(perimeterOf([[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]])).toBe(14);
    expect(perimeterOf([[0, 0], [2, 1], [0, 2]])).toBeNull();
    expect(borderCells(rect(0, 0, 4, 3))).toBe(10);
  });

  it("counts whole and half squares", () => {
    const tri: Pt[] = [[0, 2], [4, 2], [2, 0]];
    const { whole, half, other } = squareCount(tri);
    expect([whole.length, half.length, other.length]).toEqual([2, 4, 0]);
    expect(areaMethod(tri)).toBe("squares");
  });

  it("takes corner triangles off the bounding rectangle", () => {
    const sq: Pt[] = [[1, 0], [3, 1], [2, 3], [0, 2]];
    const pieces = boxPieces(sq)!;
    expect(pieces.map((p) => (p.a * p.b) / 2)).toEqual([1, 1, 1, 1]);
    expect(areaMethod(sq)).toBe("box");
    // A triangle with a corner of the rectangle, either way round.
    for (const t of [[[0, 0], [5, 2], [3, 4]], [[3, 4], [5, 2], [0, 0]]] as Pt[][]) {
      const ps = boxPieces(t)!;
      expect(20 - ps.reduce((s, p) => s + (p.a * p.b) / 2, 0)).toBe(areaOf(t));
    }
    // A peg inside the rectangle: the method does not fit.
    expect(boxPieces([[0, 0], [4, 1], [2, 2], [1, 4]])).toBeNull();
  });

  it("knows proper bands", () => {
    expect(bandProblem([[0, 0], [1, 0]])).toBe("few");
    expect(bandProblem([[0, 0], [1, 1], [2, 2]])).toBe("flat");
    expect(bandProblem([[0, 0], [3, 2], [3, 0], [0, 3]])).toBe("crossing");
    expect(bandProblem([[0, 0], [2, 0], [1, 0], [1, 2]])).toBe("crossing");
    expect(bandProblem(rect(0, 0, 2, 2))).toBeNull();
    expect(simplify([[0, 0], [1, 0], [2, 0], [2, 2], [0, 2]])).toHaveLength(4);
  });

  it("measures and names angles", () => {
    const a = cornerAngles([[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]]);
    expect(a.map((x) => Math.round(x.deg))).toEqual([90, 90, 90, 270, 90, 90]);
    expect(a[3].kind).toBe("reflex");
    const t = cornerAngles([[0, 0], [2, 1], [1, 3]]);
    expect(t[1].kind).toBe("right");
    expect(Math.round(t.reduce((s, x) => s + x.deg, 0))).toBe(180);
    expect(isSquare([[1, 0], [3, 1], [2, 3], [0, 2]])).toBe(true);
  });

  it("draws polygons with given angles", () => {
    for (const angles of [[60, 60, 60], [30, 40, 110], [90, 90, 90, 90], [100, 80, 120, 60], [108, 108, 108, 108, 108], [170, 100, 90, 120, 60]]) {
      const pts = anglePolygon(angles)!;
      expect(pts).not.toBeNull();
      const got = cornerAngles(pts as Pt[]).map((x) => x.deg);
      // Corners are rounded to 1e-4 for the SVG, so angles are within a few hundredths.
      got.forEach((d, i) => expect(Math.abs(d - angles[i])).toBeLessThan(0.05));
    }
  });

  it("cuts a shape with a band", () => {
    const r = rect(0, 0, 4, 2);
    expect(cutAreas(r, [2, 0], [2, 2])).toEqual([4, 4]);
    expect(cutAreas(r, [0, 0], [4, 2])).toEqual([4, 4]);
    expect(cutAreas(r, [1, 0], [3, 0])).toBeNull();
    expect(cutAreas(r, [1, 0], [3, 2])).toEqual([4, 4]);
    expect(cutAreas(r, [1, 0], [1, 2])).toEqual([6, 2]);
    expect(halvingCuts(r).length).toBeGreaterThanOrEqual(3);
  });

  it("round-trips pegs in links", () => {
    const p: Pt[] = [[0, 1], [5, 3]];
    expect(ptsFromParam(ptsToParam(p), 6)).toEqual(p);
    expect(ptsFromParam("0-1_9-3", 6)).toBeNull();
  });
});

/** Everything that must hold for one question; returns what failed. */
function problems(q: GeometryQuestion): string[] {
  const bad: string[] = [];
  const ok = (c: boolean, what: string) => {
    if (!c) bad.push(what);
  };
  const n = BOARD[q.level];
  const fits = (ps: Pt[]) => ps.every(([x, y]) => x >= 0 && y >= 0 && x < n && y < n);
  // Circle and composite questions have their own tests (circle.test.ts, composite-area.test.ts).
  if (q.type === "circle" || q.type === "composite") return ["not a geoboard question"];
  ok(q.n === n, "board");
  const known = slips(q);
  ok(geometryMistake(q, q.answer, known) === "right", "answer is right");
  // No slip may equal the answer and still count, and every slip is named.
  for (const [, v] of known) if (v !== q.answer) ok(geometryMistake(q, v, known) !== "other", "slip named");

  switch (q.type) {
    case "area": {
      ok(fits(q.poly) && bandProblem(q.poly) === null, "proper shape");
      ok(Number.isInteger(2 * q.answer) && q.answer > 0, "whole or half");
      ok(Math.abs(Math.abs(area2(q.poly)) / 2 - q.answer) < 1e-9, "shoelace");
      ok(insidePegs(q.poly) + boundaryPegs(q.poly) / 2 - 1 === q.answer, "Pick");
      const method = areaMethod(q.poly);
      if (q.level === 1) ok(q.poly.length === 4 && isRectilinear(q.poly), "rectangle");
      if (q.level === 3) ok(method === "box" && !isRectilinear(q.poly), "slanted, by the rectangle");
      ok(method !== null, "show me can count it");
      if (method === "squares") {
        const { whole, half, other } = squareCount(q.poly);
        ok(other.length === 0 && whole.length + half.length / 2 === q.answer, "whole and half squares");
      } else if (method === "box") {
        const b = boxOf(q.poly);
        const pieces = boxPieces(q.poly)!;
        ok(b.w * b.h - pieces.reduce((s, p) => s + (p.a * p.b) / 2, 0) === q.answer, "rectangle minus corners");
      }
      break;
    }
    case "perimeter": {
      ok(fits(q.poly) && bandProblem(q.poly) === null, "proper shape");
      ok(isRectilinear(q.poly) && perimeterOf(q.poly) === q.answer, "along the grid");
      ok(boundaryPegs(q.poly) === q.answer, "one unit per peg gap");
      ok(q.answer !== areaOf(q.poly), "area differs");
      if (q.level === 1) ok(q.poly.length === 4, "rectangle");
      else ok(q.poly.length > 4, "not a rectangle");
      break;
    }
    case "angle": {
      ok(Number.isInteger(q.answer) && q.answer > 0 && q.answer < 360, "whole angle");
      const sum = q.angles.reduce((s, a) => s + a, 0);
      if (q.variant === "geo") {
        ok(fits(q.arms) && [45, 90, 135].includes(q.answer), "geoboard angle");
        const [p, v, r] = q.arms;
        const d = (Math.atan2(Math.abs((p[0] - v[0]) * (r[1] - v[1]) - (p[1] - v[1]) * (r[0] - v[0])), (p[0] - v[0]) * (r[0] - v[0]) + (p[1] - v[1]) * (r[1] - v[1])) * 180) / Math.PI;
        ok(Math.abs(d - q.answer) < 1e-9, "arms make the angle");
      } else {
        ok(sum === (q.angles.length - 2) * 180, "angle sum");
        ok(q.angles.every((a) => a > 0 && a < 180), "convex");
        ok(!q.given.includes(q.ask) || q.variant === "exterior", "asked angle hidden");
        const pts = anglePolygon(q.angles);
        ok(pts !== null, "drawable");
        if (pts) cornerAngles(pts as Pt[]).forEach((x, i) => ok(Math.abs(x.deg - q.angles[i]) < 0.05, "drawn angles"));
        if (q.variant === "exterior") ok(q.answer === 180 - q.angles[2], "exterior");
        else if (q.variant === "regular") ok(q.angles.every((a) => a === q.answer), "regular");
        else ok(q.answer === q.angles[q.ask], "asked angle");
        if (q.level === 2) ok(q.angles.length === 3, "triangle");
        if (q.variant === "polygon") ok(q.given.length === q.angles.length - 1, "all but one given");
      }
      break;
    }
    case "classify": {
      ok(fits(q.poly) && [0, 1, 2].includes(q.answer), "fits");
      if (q.level === 1) ok(q.corner === 1, "corner");
      else {
        ok(bandProblem(q.poly) === null && q.poly.length === 3, "triangle");
        const a = cornerAngles(q.poly);
        ok(a.every((x) => a[q.corner].deg >= x.deg - 1e-9), "largest corner");
        ok(a[q.corner].kind === ["acute", "right", "obtuse"][q.answer], "kind");
        ok(a.every((x) => x.deg >= 15), "not needle-thin");
        if (q.level === 3) ok(q.poly.every((p, i) => { const r = q.poly[(i + 1) % 3]; return p[0] !== r[0] && p[1] !== r[1]; }), "no side along the grid");
      }
      break;
    }
    case "build": {
      ok(fits(q.example) && checkBuild(q, q.example).tag === "right", "example works");
      ok((q.area ?? 1) > 0 && (q.perimeter ?? 1) > 0, "positive");
      const expected = q.level === 1 ? ["rectArea", "rectPerim"] : q.level === 2 ? ["triArea", "gridPerim"] : ["tiltSquare", "areaPerim"];
      ok(expected.includes(q.variant), "variant by level");
      ok(q.answer === (q.variant === "rectPerim" || q.variant === "gridPerim" ? q.perimeter : q.area), "answer");
      break;
    }
    case "divide": {
      ok(fits(q.poly) && bandProblem(q.poly) === null && isConvex(q.poly), "convex shape");
      ok(checkCut(q, ...q.example).tag === "right" && q.ways >= 1, "example halves it");
      if (q.level === 1) ok(q.poly.length === 4 && isRectilinear(q.poly), "rectangle");
      if (q.level === 3) ok(!isRectilinear(q.poly), "slanted");
      break;
    }
  }
  return bad;
}

describe("geometry questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makeGeometryQuestion(t, l, 42)).toEqual(makeGeometryQuestion(t, l, 42));
  });

  it("gives a sound question for 10,000 seeds of every type and level", () => {
    const failures: string[] = [];
    for (const type of TYPES)
      for (const level of LEVELS) {
        const answers = new Set<number>();
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makeGeometryQuestion(type, level, seed);
          if (q.type !== type || q.level !== level || q.seed !== seed) failures.push(`${type}/${level}/${seed}: header`);
          answers.add(q.type === "build" ? answers.size : q.answer);
          for (const p of problems(q)) if (failures.length < 30) failures.push(`${type}/${level}/${seed}: ${p}`);
        }
        // Variety: not one answer over and over.
        if (type !== "divide" && answers.size < (type === "classify" || (type === "angle" && level === 1) ? 3 : 4)) failures.push(`${type}/${level}: only ${answers.size} answers`);
      }
    expect(failures).toEqual([]);
  }, 240_000);

  it("gives every kind of answer per level", () => {
    for (const l of LEVELS) {
      const kinds = new Set(Array.from({ length: 200 }, (_, s) => makeGeometryQuestion("classify", l, s).answer));
      expect(kinds.size).toBe(3);
      expect(answerKind("classify")).toBe("choice");
    }
  });
});

describe("slips", () => {
  const base = { level: 1 as Level, seed: 0, n: 6 };

  it("names area slips", () => {
    const r = { ...base, type: "area" as const, poly: rect(0, 0, 3, 4), answer: 12 };
    expect(geometryMistake(r, 14)).toBe("perimeter");
    expect(geometryMistake(r, 20)).toBe("dots");
    const tri = { ...base, level: 2 as Level, type: "area" as const, poly: [[0, 2], [4, 2], [2, 0]] as Pt[], answer: 4 };
    expect(geometryMistake(tri, 6)).toBe("halfAsWhole");
    expect(geometryMistake(tri, 2)).toBe("noHalves");
    expect(geometryMistake(tri, 8)).toBe("noHalf");
    const sq = { ...base, level: 3 as Level, type: "area" as const, poly: [[2, 0], [5, 2], [3, 5], [0, 3]] as Pt[], answer: 13 };
    expect(geometryMistake(sq, 25)).toBe("box");
    expect(geometryMistake(sq, 1)).toBe("noHalf");
  });

  it("names perimeter slips", () => {
    const r = { ...base, type: "perimeter" as const, poly: rect(0, 0, 3, 4), answer: 14 };
    expect(geometryMistake(r, 12)).toBe("area");
    expect(geometryMistake(r, 18)).toBe("dots");
    expect(geometryMistake(r, 10)).toBe("cells");
    expect(geometryMistake(r, 7)).toBe("halfP");
    const notch = { ...base, level: 3 as Level, type: "perimeter" as const, poly: [[0, 0], [1, 0], [1, 2], [3, 2], [3, 0], [5, 0], [5, 4], [0, 4]] as Pt[], answer: 22 };
    expect(geometryMistake(notch, 18)).toBe("box");
  });

  it("names angle slips", () => {
    const a = { ...base, type: "angle" as const, arms: [] as Pt[], given: [0, 1], ask: 2 };
    expect(geometryMistake({ ...a, variant: "triangle", angles: [50, 60, 70], answer: 70 }, 250)).toBe("sum360");
    expect(geometryMistake({ ...a, variant: "triangle", angles: [50, 60, 70], answer: 70 }, 110)).toBe("noSubtract");
    expect(geometryMistake({ ...a, variant: "exterior", angles: [50, 60, 70], answer: 110 }, 70)).toBe("interior");
    expect(geometryMistake({ ...a, variant: "isosceles", angles: [40, 70, 70], given: [0], ask: 1, answer: 70 }, 140)).toBe("noHalf");
    expect(geometryMistake({ ...a, variant: "regular", angles: [108, 108, 108, 108, 108], given: [], ask: 0, answer: 108 }, 72)).toBe("exterior");
    expect(geometryMistake({ ...a, variant: "regular", angles: [108, 108, 108, 108, 108], given: [], ask: 0, answer: 108 }, 540)).toBe("total");
    const poly = { ...a, variant: "polygon" as const, angles: [100, 80, 120, 60], given: [0, 1, 2], ask: 3, answer: 60 };
    expect(geometryMistake(poly, 420)).toBe("nTimes180");
    expect(geometryMistake({ ...a, variant: "geo", arms: [[2, 0], [0, 0], [2, 2]], angles: [45], given: [], ask: 1, answer: 45 }, 135)).toBe("supplement");
  });

  it("names classify slips", () => {
    const right = { ...base, level: 3 as Level, type: "classify" as const, poly: [[0, 0], [2, 1], [1, 3]] as Pt[], corner: 1, answer: 1 };
    expect(geometryMistake(right, 0)).toBe("slantRight");
    const obtuse = { ...base, level: 2 as Level, type: "classify" as const, poly: [[0, 0], [4, 0], [5, 3]] as Pt[], corner: 1, answer: 2 };
    expect(geometryMistake(obtuse, 0)).toBe("smallAngle");
  });

  it("accepts any shape that fits a build request", () => {
    const q: BuildQuestion = { ...base, type: "build", variant: "rectArea", area: 12, perimeter: null, example: rect(0, 0, 3, 4), answer: 12 };
    expect(checkBuild(q, rect(1, 1, 4, 3)).tag).toBe("right");
    expect(checkBuild(q, rect(0, 0, 2, 5)).tag).toBe("wrongValue");
    expect(checkBuild(q, rect(0, 0, 2, 4)).tag).toBe("confused");
    expect(checkBuild(q, [[0, 0], [1, 0], [2, 0], [2, 6], [0, 6]]).tag).toBe("right");
    expect(checkBuild(q, [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]]).tag).toBe("notRect");
    expect(checkBuild(q, [[0, 0], [1, 0]]).tag).toBe("few");
    const tilt: BuildQuestion = { ...base, level: 3, type: "build", variant: "tiltSquare", area: 5, perimeter: null, example: [], answer: 5 };
    expect(checkBuild(tilt, [[1, 0], [3, 1], [2, 3], [0, 2]]).tag).toBe("right");
    expect(checkBuild(tilt, rect(0, 0, 2, 2)).tag).toBe("notSlanted");
    const tri: BuildQuestion = { ...base, level: 2, type: "build", variant: "triArea", area: 3, perimeter: null, example: [], answer: 3 };
    expect(checkBuild(tri, [[0, 0], [3, 0], [0, 2]]).tag).toBe("right");
    expect(checkBuild(tri, [[0, 0], [3, 0], [5, 2]]).tag).toBe("right");
    expect(checkBuild(tri, [[0, 0], [3, 0], [0, 4]]).tag).toBe("noHalf");
    const lp: BuildQuestion = { ...base, level: 3, type: "build", variant: "areaPerim", area: 11, perimeter: 14, example: [], answer: 11 };
    expect(checkBuild(lp, [[0, 0], [3, 0], [3, 1], [4, 1], [4, 3], [0, 3]]).tag).toBe("right");
    expect(checkBuild(lp, rect(0, 0, 3, 4)).tag).toBe("perimOnly");
  });

  it("checks cuts", () => {
    const q: DivideQuestion = { ...base, type: "divide", poly: rect(0, 0, 4, 2), example: [[2, 0], [2, 2]], ways: 0, answer: 0 };
    expect(checkCut(q, [0, 0], [4, 2]).tag).toBe("right");
    expect(checkCut(q, [1, 0], [1, 2]).tag).toBe("unequal");
    expect(checkCut(q, [0, 0], [3, 0]).tag).toBe("alongEdge");
    expect(checkCut(q, [1, 1], [3, 1]).tag).toBe("notEdge");
    expect(bandPegs(q.poly)).toHaveLength(12);
  });
});
