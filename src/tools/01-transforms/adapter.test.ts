import { describe, expect, it } from "vitest";
import { makeTransformQuestion, paintMistake, type Level, type TransformQuestionType } from "@/generators/transforms";
import { fa } from "@/tools/registry";
import { TRANSFORMS_ADAPTER as A } from "./adapter";
import { TRANSFORMS_PRACTICE as P } from "./practice";
import { MOVE_NAME, vecText } from "./moveText";
import { TRANSFORM_TYPE_LABEL } from "./TransformTryPanel";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(TRANSFORM_TYPE_LABEL) as TransformQuestionType[];
const LEVELS: Level[] = [1, 2, 3];

describe("transforms adapter", () => {
  it("agrees with practice.ts and the tool's own type labels", () => {
    expect(A.types).toEqual(P.types);
    expect(A.levels).toEqual(P.levels);
    expect(A.tags).toEqual(P.tags);
    expect(A.version).toBe("transforms@1");
    expect(P.types.map((t) => [t.key, t.label])).toEqual(Object.entries(TRANSFORM_TYPE_LABEL));
    expect(P.tags.right).toBeTruthy();
    expect(P.tags.other).toBeTruthy();
  });

  it.each(TYPES)("%s: grades like the tool's own feedback, for the answer and every slip", (type) => {
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const q = makeTransformQuestion(type, level, seed);
        const tag = (r: unknown) => {
          const t = A.grade(type, level, seed, r);
          expect(P.tags[t], t).toBeTruthy();
          return t;
        };
        if (q.type === "draw" || (q.type === "shift" && q.form === "draw")) {
          expect(tag(q.answer)).toBe("right");
          expect(tag([...q.answer].reverse())).toBe("right");
          if (q.type === "shift") for (const s of q.slips) expect(tag(s.cells)).toBe(paintMistake(q, s.cells));
          expect(tag(q.answer.slice(1))).toBe("count");
          expect(tag(5)).toBe("other");
          continue;
        }
        expect(tag(q.answer)).toBe("right");
        q.options.forEach((_, i) => {
          if (i === q.answer) return;
          const t = tag(i);
          if (q.type === "which") expect(["otherReflection", "otherTurn", "turnForFlip", "flipForTurn"]).toContain(t);
          else expect(t).toBe(q.mistakes[i] ?? "other");
        });
        expect(tag(q.options.length)).toBe("other");
        expect(tag(["0,0"])).toBe("other");
      }
  }, 60_000);

  it.each(TYPES)("%s: hints are three lines and give nothing away", (type) => {
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const h = A.hints(type, level, seed);
        expect(h).toHaveLength(3);
        for (const line of h) {
          expect(line.trim().length).toBeGreaterThan(5);
          // Choice answers are option numbers: a hint never points at an option.
          expect(line).not.toContain("گزینه");
        }
        // "Which slide?": the slide itself is the answer. Other answers are
        // pictures or cells, where a token check means nothing.
        const q = makeTransformQuestion(type, level, seed);
        if (q.type === "shift" && q.form === "vector")
          for (const v of q.vec) if (v) for (const line of h) expect(line).not.toContain(`${fa(Math.abs(v))} خانه`);
      }
  }, 60_000);
  it.each(TYPES)("%s: the solution names the real answer, in Persian digits", (type) => {
    for (const level of LEVELS)
      for (const seed of SEEDS.slice(0, 30)) {
        const s = A.solution!(type, level, seed);
        expect(s).toBe(A.solution!(type, level, seed));
        expect(s.startsWith("جواب:")).toBe(true);
        expect(s.length).toBeGreaterThanOrEqual(10);
        expect(s.length).toBeLessThanOrEqual(300);
        expect(s).not.toMatch(/[0-9]/);
        const q = makeTransformQuestion(type, level, seed);
        expect(A.grade(type, level, seed, q.answer)).toBe("right");
        if (q.type === "which") expect(s).toContain(`جواب: ${MOVE_NAME[q.options[q.answer]]}.`);
        else if (q.type === "draw") expect(s).toContain(`${fa(q.answer.length)} خانه`);
        else if (q.type === "shift") {
          if (q.form === "vector") expect(s).toContain(`جواب: ${vecText(q.vec)}.`);
          else expect(s).toContain(vecText(q.vec, false));
          if (q.form === "draw") expect(s).toContain(`${fa(q.answer.length)} خانه رنگ`);
        } else expect(s).toContain(`جواب: گزینه ${fa(q.answer + 1)}.`);
      }
  }, 60_000);
});
