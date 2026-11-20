import { describe, expect, it } from "vitest";
import { answerKind, makeMotionQuestion, motionMistake, slips, type Level, type MotionQuestion, type MotionQuestionType } from "@/generators/motion";
import { fa } from "@/tools/registry";
import { MOTION_ADAPTER as A } from "./adapter";
import { MOTION_TYPE_LABEL, motionPrompt } from "./MotionTryPanel";
import { MOTION_PRACTICE as P } from "./practice";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(MOTION_TYPE_LABEL) as MotionQuestionType[];
const LEVELS: Level[] = [1, 2, 3];
const nums = (s: string): string[] => s.match(/[۰-۹]+/g) ?? [];

/** Numbers the child already sees: in the prompt, and on the roads of a map. */
function shown(q: MotionQuestion) {
  const out = new Set(nums(motionPrompt(q)));
  if (q.type === "map") for (const r of q.map.roads) out.add(fa(r.len));
  return out;
}

describe("motion adapter", () => {
  it("agrees with practice.ts and the tool's own type labels", () => {
    expect(A.types).toEqual(P.types);
    expect(A.levels).toEqual(P.levels);
    expect(A.tags).toEqual(P.tags);
    expect(A.version).toBe("motion@1");
    expect(P.types.map((t) => [t.key, t.label])).toEqual(Object.entries(MOTION_TYPE_LABEL));
    expect(P.tags.right).toBeTruthy();
    expect(P.tags.other).toBeTruthy();
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeMotionQuestion(type, level, seed);
          const tag = (r: unknown) => {
            const t = A.grade(type, level, seed, r);
            expect(P.tags[t], t).toBeTruthy();
            return t;
          };
          expect(tag(q.answer)).toBe("right");
          for (const [, v] of slips(q)) expect(tag(v)).toBe(motionMistake(q, v));
          // Choices: every option the panel offers grades as the tool does.
          const kind = answerKind(q);
          const options = kind === "rot" ? 2 : kind === "number" ? 0 : 4;
          for (let i = 0; i < options; i++) expect(tag(i)).toBe(motionMistake(q, i));
          expect(tag(String(q.answer))).toBe("other");
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
          // it. (Directions, points and roads are choices, no number to look for.)
          const q = makeMotionQuestion(type, level, seed);
          if (answerKind(q) !== "number") continue;
          const ans = fa(q.answer);
          if (shown(q).has(ans)) continue;
          for (const line of h) expect(nums(line), `${type} ${level} ${seed}: ${line}`).not.toContain(ans);
        }
  }, 60_000);
});
