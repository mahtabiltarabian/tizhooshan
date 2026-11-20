import { describe, expect, it } from "vitest";
import { answerKind, isFrac, makeRatioQuestion, ratioMistake, slips, type Level, type RatioQuestion, type RatioQuestionType } from "@/generators/ratio";
import { fa } from "@/tools/registry";
import { RATIO_ADAPTER as A } from "./adapter";
import { RATIO_PRACTICE as P } from "./practice";
import { isFracView, RATIO_TYPE_LABEL, ratioPrompt } from "./text";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(RATIO_TYPE_LABEL) as RatioQuestionType[];
const LEVELS: Level[] = [1, 2, 3];
const nums = (s: string): string[] => s.match(/[۰-۹]+/g) ?? [];

/** Numbers the child already sees: in the prompt, its fractions, and the parts of the shape. */
function shown(q: RatioQuestion) {
  const out = new Set<string>();
  for (const s of ratioPrompt(q)) {
    if (typeof s === "string") nums(s).forEach((x) => out.add(x));
    else if (isFracView(s)) [s.n, s.d].forEach((x) => out.add(fa(x)));
    else for (const p of s.eq) (typeof p === "string" ? nums(p) : [fa(p.n), fa(p.d)]).forEach((x) => out.add(x));
  }
  if (q.type === "shade") out.add(fa(q.parts));
  return out;
}

describe("ratio adapter", () => {
  it("agrees with practice.ts and the tool's own type labels", () => {
    expect(A.types).toEqual(P.types);
    expect(A.levels).toEqual(P.levels);
    expect(A.tags).toEqual(P.tags);
    expect(A.version).toBe("ratio@1");
    expect(P.types.map((t) => [t.key, t.label])).toEqual(Object.entries(RATIO_TYPE_LABEL));
    expect(P.tags.right).toBeTruthy();
    expect(P.tags.other).toBeTruthy();
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeRatioQuestion(type, level, seed);
          const tag = (r: unknown) => {
            const t = A.grade(type, level, seed, r);
            expect(P.tags[t], t).toBeTruthy();
            return t;
          };
          expect(tag(q.answer)).toBe("right");
          // JSON keeps a fraction as a plain object; an equal fraction is right too.
          expect(tag(JSON.parse(JSON.stringify(q.answer)))).toBe("right");
          if (isFrac(q.answer)) expect(tag({ n: 2 * q.answer.n, d: 2 * q.answer.d })).toBe("right");
          for (const [, v] of slips(q)) expect(tag(v)).toBe(ratioMistake(q, v));
          if (answerKind(q) === "choice") for (const i of [0, 1, 2]) expect(tag(i)).toBe(ratioMistake(q, i));
          expect(tag("1")).toBe("other");
          expect(tag({ n: 1, d: 0 })).toBe("other");
          expect(tag(null)).toBe("other");
        }
  }, 60_000);

  it("hints are three lines and give nothing away", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = A.hints(type, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // A number answer is never in a hint, unless the question itself shows
          // it. (Fractions and the compare choice are no single number to look for.)
          const q = makeRatioQuestion(type, level, seed);
          if (isFrac(q.answer) || answerKind(q) === "choice") continue;
          const ans = fa(q.answer);
          if (shown(q).has(ans)) continue;
          for (const line of h) expect(nums(line), `${type} ${level} ${seed}: ${line}`).not.toContain(ans);
        }
  }, 60_000);
});
