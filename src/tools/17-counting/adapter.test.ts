import { describe, expect, it } from "vitest";
import { countingMistake, makeCountingQuestion, slips, type CountingQuestionType, type Level } from "@/generators/counting";
import { fa } from "@/tools/registry";
import { COUNTING_ADAPTER } from "./adapter";
import { COUNTING_PRACTICE } from "./practice";
import { COUNTING_TYPE_LABEL } from "./text";
import { answerText } from "./text";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(COUNTING_TYPE_LABEL) as CountingQuestionType[];
const LEVELS = [1, 2, 3] as const;
const tokens = (t: string): string[] => t.match(/[0-9۰-۹]+(?:[٫.][0-9۰-۹]+)?/g) ?? [];
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe("counting adapter", () => {
  it("agrees with practice.ts and the panel", () => {
    expect(COUNTING_ADAPTER.tool).toBe(COUNTING_PRACTICE.tool);
    expect(COUNTING_ADAPTER.types).toEqual(COUNTING_PRACTICE.types);
    expect(COUNTING_ADAPTER.levels).toEqual(COUNTING_PRACTICE.levels);
    expect(COUNTING_ADAPTER.tags).toEqual(COUNTING_PRACTICE.tags);
    expect(COUNTING_PRACTICE.types).toEqual(TYPES.map((key) => ({ key, label: COUNTING_TYPE_LABEL[key] })));
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeCountingQuestion(type, level as Level, seed);
          expect(COUNTING_ADAPTER.grade(type, level, seed, json(q.answer))).toBe("right");
          for (const [, v] of slips(q)) {
            const tag = COUNTING_ADAPTER.grade(type, level, seed, json(v));
            expect(tag).toBe(countingMistake(q, v));
            expect(COUNTING_ADAPTER.tags[tag]).toBeTruthy();
          }
        }
    // A fraction that is not in simplest form is still right.
    const p = makeCountingQuestion("probability", 1, 1);
    if (typeof p.answer === "object") expect(COUNTING_ADAPTER.grade("probability", 1, 1, { n: p.answer.n * 3, d: p.answer.d * 3 })).toBe("right");
    expect(COUNTING_ADAPTER.grade("tree", 1, 1, "x")).toBe("other");
    expect(COUNTING_ADAPTER.grade("probability", 1, 1, { n: 1, d: 0 })).toBe("other");
  });

  it("hints: three lines, none prints a whole-number answer", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = COUNTING_ADAPTER.hints(type, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // A probability is a fraction; its parts are small counts that hints may name (six faces).
          const q = makeCountingQuestion(type, level as Level, seed);
          if (typeof q.answer === "number") for (const line of h) expect(tokens(line), `${type} ${level} ${seed}: ${line}`).not.toContain(fa(q.answer));
        }
  });

  it("solution: the real answer, in one to three short Persian sentences", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeCountingQuestion(type, level as Level, seed);
          // The answer the tool grades as right.
          expect(COUNTING_ADAPTER.grade(type, level, seed, json(q.answer))).toBe("right");
          const s = COUNTING_ADAPTER.solution!(type, level, seed);
          const at = `${type} ${level} ${seed}: ${s}`;
          expect(s.startsWith("جواب:"), at).toBe(true);
          expect(s.length, at).toBeGreaterThanOrEqual(10);
          expect(s.length, at).toBeLessThanOrEqual(300);
          expect(s, at).not.toMatch(/[0-9]/);
          expect(s, at).toBe(COUNTING_ADAPTER.solution!(type, level, seed));
          expect(s, at).toContain(answerText(q));
        }
  });
});
