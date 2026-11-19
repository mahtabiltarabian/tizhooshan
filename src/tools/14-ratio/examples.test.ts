import { describe, expect, it } from "vitest";
import { makeRatioQuestion, ratioMistake, type Answer, type Level, type RatioQuestionType } from "@/generators/ratio";
import { RATIO_GUIDE } from "./guide";
import { RATIO_TYPE_LABEL } from "./text";

// The hand-picked scenes of the teacher guide, rebuilt the way RatioTool reads its link.
const examples = RATIO_GUIDE.examples ?? [];

function question(hash: string) {
  const p = new URLSearchParams(hash);
  return makeRatioQuestion((p.get("try") ?? p.get("show")) as RatioQuestionType, Number(p.get("level")) as Level, Number(p.get("seed")));
}

describe("ratio: hand-picked examples", () => {
  it("every try and show link names a real type, level and seed and builds", () => {
    for (const ex of examples.filter((e) => !e.hash.startsWith("explore="))) {
      const p = new URLSearchParams(ex.hash);
      expect(Object.keys(RATIO_TYPE_LABEL)).toContain(p.get("try") ?? p.get("show"));
      expect([1, 2, 3]).toContain(Number(p.get("level")));
      expect(question(ex.hash)).toBeTruthy();
    }
  });

  it("explore links name an area the tool reads", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("explore="))) expect(["bar", "circle", "compare", "blocks"]).toContain(new URLSearchParams(ex.hash).get("explore"));
  });

  it("each misconception scene holds its trap", () => {
    const cases: [string, number, Answer, string][] = [
      // [link, misconception, wrong answer, its tag]; compare answers are 0 = first, 1 = second.
      ["try=compare&level=1&seed=9", 0, 1, "biggerDenominator"],
      ["try=ratio&level=1&seed=10", 1, 10, "addDifference"],
      ["try=divide&level=2&seed=4", 2, 36, "equalSplit"],
      ["try=divide&level=2&seed=4", 2, 24, "dividedByPart"],
      ["try=work&level=2&seed=1", 3, 18, "addedTimes"],
      ["try=work&level=2&seed=1", 3, 9, "averaged"],
    ];
    for (const [hash, i, value, tag] of cases) {
      expect(examples.find((e) => e.for === i)?.hash).toBe(hash);
      expect(ratioMistake(question(hash), value), `${hash} ${JSON.stringify(value)}`).toBe(tag);
    }
  });

  it("the answers the notes quote", () => {
    const answers: [string, Answer][] = [
      ["try=shade&level=1&seed=1", 5],
      ["try=shade&level=2&seed=1", 8],
      ["try=compare&level=1&seed=9", 0],
      ["try=partOf&level=2&seed=4", 3],
      ["try=ratio&level=1&seed=10", 12],
      ["show=divide&level=3&seed=2", 12],
      ["try=divide&level=2&seed=4", 27],
      ["try=percent&level=2&seed=2", 72],
      ["try=work&level=2&seed=1", 4],
    ];
    for (const [hash, a] of answers) expect(question(hash).answer, hash).toEqual(a);
  });
});
