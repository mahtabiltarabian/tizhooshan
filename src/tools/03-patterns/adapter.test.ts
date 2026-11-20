import { describe, expect, it } from "vitest";
import { makePatternQuestion, type Level, type PatternQuestionType } from "@/generators/patterns";
import { fa } from "@/tools/registry";
import { PATTERNS_ADAPTER as A } from "./adapter";
import { tileWords } from "./tileText";
import { PATTERN_TYPE_LABEL } from "./PatternTryPanel";
import { PATTERNS_PRACTICE as P } from "./practice";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(PATTERN_TYPE_LABEL) as PatternQuestionType[];
const LEVELS: Level[] = [1, 2, 3];

describe("patterns adapter", () => {
  it("agrees with practice.ts and the tool's own type labels", () => {
    expect(A.types).toEqual(P.types);
    expect(A.levels).toEqual(P.levels);
    expect(A.tags).toEqual(P.tags);
    expect(A.version).toBe("patterns@1");
    expect(P.types.map((t) => [t.key, t.label])).toEqual(Object.entries(PATTERN_TYPE_LABEL));
  });

  it.each(TYPES)("%s: grades like the tool's own feedback, for the answer and every slip", (type) => {
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const q = makePatternQuestion(type, level, seed);
        const tag = (r: unknown) => {
          const t = A.grade(type, level, seed, r);
          expect(P.tags[t], t).toBeTruthy();
          return t;
        };
        expect(tag(q.answer)).toBe("right");
        const n = q.type === "odd" ? q.tiles.length : q.options.length;
        for (let i = 0; i < n; i++) if (i !== q.answer) expect(tag(i)).toBe(q.type === "odd" ? "notOdd" : q.tags[i]);
        expect(tag(n)).toBe("other");
        expect(tag("1")).toBe("other");
      }
  }, 60_000);

  it.each(TYPES)("%s: hints are three lines and give nothing away", (type) => {
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const h = A.hints(type, level, seed);
        expect(h).toHaveLength(3);
        // The answer is an option (or figure) number: a hint never names one.
        for (const line of h) {
          expect(line.trim().length).toBeGreaterThan(5);
          expect(line).not.toMatch(/گزینه|شکل [۰-۹]/);
        }
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
        const q = makePatternQuestion(type, level, seed);
        expect(A.grade(type, level, seed, q.answer)).toBe("right");
        if (q.type === "odd") {
          expect(s).toContain(`جواب: شکل ${fa(q.answer + 1)}.`);
          continue;
        }
        expect(s).toContain(`جواب: گزینه ${fa(q.answer + 1)}`);
        // Beyond the number, a rule sentence (or the answer in words) says why.
        expect(s.length).toBeGreaterThan(30);
        if (q.type === "missing") continue;
        const right = q.options[q.answer];
        if (tileWords(right)) expect(s).toContain(tileWords(right));
        if (q.type === "sides") expect(s).toContain(`${fa(right.sides!)} ضلع`);
      }
  }, 60_000);
});
