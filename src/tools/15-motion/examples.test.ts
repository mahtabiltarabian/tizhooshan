import { describe, expect, it } from "vitest";
import { makeMotionQuestion, motionMistake, type Level, type MotionQuestionType } from "@/generators/motion";
import { MOTION_GUIDE } from "./guide";
import { MOTION_TYPE_LABEL } from "./MotionTryPanel";

// The hand-picked scenes of the teacher guide, rebuilt the way MotionTool reads its link.
const examples = MOTION_GUIDE.examples ?? [];

function tryQuestion(hash: string) {
  const p = new URLSearchParams(hash);
  return makeMotionQuestion(p.get("try") as MotionQuestionType, Number(p.get("level")) as Level, Number(p.get("seed")));
}

describe("motion: hand-picked examples", () => {
  it("every try link names a real type, level and seed and builds", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("try="))) {
      const p = new URLSearchParams(ex.hash);
      expect(Object.keys(MOTION_TYPE_LABEL)).toContain(p.get("try"));
      expect([1, 2, 3]).toContain(Number(p.get("level")));
      expect(tryQuestion(ex.hash)).toBeTruthy();
    }
  });

  it("show links stay inside the ranges the reader keeps", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("show="))) {
      const [kind, ...rest] = new URLSearchParams(ex.hash).get("show")!.split("-");
      if (kind === "gears") {
        const teeth = rest[0].split(".").map(Number);
        expect(teeth.length).toBeGreaterThanOrEqual(2);
        for (const t of teeth) expect(t >= 6 && t <= 40).toBe(true);
      } else {
        expect(kind).toBe("track");
        const [mode, L, a, b, g] = rest;
        expect(["one", "meet", "chase"]).toContain(mode);
        expect(Number(L) >= 60 && Number(L) <= 600 && Number(a) >= 10 && Number(a) <= 120 && Number(b) >= 10 && Number(b) <= 120 && Number(g) >= 0 && Number(g) <= 300).toBe(true);
      }
    }
  });

  it("each misconception scene holds its trap", () => {
    const cases: [string, number, number, string][] = [
      // [link, misconception, wrong answer, its tag]; gear direction 0 = clockwise, 1 = anticlockwise; compass 0 N, 1 E, 2 S, 3 W.
      ["try=gearDir&level=2&seed=8", 0, 0, "alwaysOpposite"],
      ["try=gearTurns&level=2&seed=2", 1, 4, "inverted"],
      ["try=gearTurns&level=2&seed=2", 1, 3, "middleOnly"],
      ["try=trip&level=2&seed=1", 2, 140, "half"],
      ["try=orient&level=2&seed=3", 3, 3, "aroundSwap"],
      ["try=spacing&level=1&seed=6", 4, 100, "postsAsGaps"],
      ["try=spacing&level=2&seed=6", 5, 6, "cutsAsPieces"],
      ["try=map&level=1&seed=6", 6, 9, "fewestRoads"],
      ["try=map&level=1&seed=6", 6, 15, "greedy"],
    ];
    for (const [hash, i, value, tag] of cases) {
      expect(examples.find((e) => e.for === i)?.hash).toBe(hash);
      expect(motionMistake(tryQuestion(hash), value), `${hash} ${value}`).toBe(tag);
    }
  });

  it("the answers the notes quote", () => {
    const answers: [string, number][] = [
      ["try=gearDir&level=2&seed=8", 1],
      ["try=gearTurns&level=2&seed=2", 1],
      ["try=trip&level=2&seed=1", 180],
      ["try=chase&level=1&seed=4", 2],
      ["try=orient&level=2&seed=3", 1],
      ["try=spacing&level=1&seed=6", 90],
      ["try=spacing&level=2&seed=6", 5],
      ["try=map&level=1&seed=6", 8],
      ["try=map&level=3&seed=2", 31],
    ];
    for (const [hash, a] of answers) expect(tryQuestion(hash).answer, hash).toBe(a);
  });
});
