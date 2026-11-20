// The practice adapter against the tool's own generators and slip functions.

import { describe, expect, it } from "vitest";
import { cycleMistake, cycleSlips, makeCycleQuestion } from "@/generators/cycle";
import { makeNthQuestion, nthMistake, nthSlips } from "@/generators/nth-term";
import { makeSequenceQuestion, sequenceMistake, slips, type SequenceQuestionType } from "@/generators/sequence";
import { fa } from "@/tools/registry";
import { SEQUENCE_ADAPTER as A } from "./adapter";
import { SEQUENCE_PRACTICE } from "./practice";
import { SEQ_TYPE_LABEL } from "./SequenceTryPanel";
import { symbolWord } from "./Cycle";
import { ruleParts } from "@/generators/nth-term";
import { letterAt } from "@/generators/sequence";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const LEVELS = [1, 2, 3] as const;
const SEQ_TYPES: SequenceQuestionType[] = ["mixed", "arithmetic", "geometric", "alternate", "second", "additive", "letters"];
const tokens = (s: string) => s.match(/[۰-۹]+/g) ?? [];

describe("sequence adapter", () => {
  it("agrees with practice.ts and the try panel", () => {
    expect(A.types).toEqual(SEQUENCE_PRACTICE.types);
    expect(A.levels).toEqual(SEQUENCE_PRACTICE.levels);
    expect(A.tags).toEqual(SEQUENCE_PRACTICE.tags);
    expect(A.version).toBe("sequence@1");
    expect(Object.fromEntries(A.types.map((t) => [t.key, t.label]))).toEqual(SEQ_TYPE_LABEL);
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    const check = (type: string, level: number, seed: number, v: number, expected: string) => {
      const tag = A.grade(type, level, seed, v);
      expect(tag).toBe(expected);
      expect(A.tags[tag]).toBeTruthy();
    };
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        for (const type of SEQ_TYPES) {
          const q = makeSequenceQuestion(type, level, seed);
          check(type, level, seed, q.answer, "right");
          for (const [, v] of slips(q)) check(type, level, seed, v, sequenceMistake(q, v));
          check(type, level, seed, q.answer + 1000, sequenceMistake(q, q.answer + 1000));
        }
        const c = makeCycleQuestion(level, seed);
        check("cycle", level, seed, c.answer, "right");
        for (const [, v] of cycleSlips(c)) check("cycle", level, seed, v, cycleMistake(c, v));
        const n = makeNthQuestion(level, seed);
        check("nth", level, seed, n.answer, "right");
        for (const [, v] of nthSlips(n)) check("nth", level, seed, v, nthMistake(n, v));
      }
    expect(A.grade("arithmetic", 1, 1, "x")).toBe("other");
  });

  it("gives three hints that never show a number answer", () => {
    for (const { key } of A.types)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = A.hints(key, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          let answer: number | null;
          if (key === "cycle") {
            const c = makeCycleQuestion(level, seed);
            // A symbol answer is an id, not a number the child sees.
            answer = c.variant === "count" ? c.answer : null;
          } else if (key === "nth") {
            const n = makeNthQuestion(level, seed);
            // A rule answer is two boxes, coded as one number: nothing to look for.
            answer = n.variant === "rule" ? null : n.answer;
          } else answer = makeSequenceQuestion(key as SequenceQuestionType, level, seed).answer;
          if (answer !== null) for (const line of h) expect(tokens(line)).not.toContain(fa(Math.abs(answer)));
        }
  });

  it("solution names the generator's answer, in short Persian with Persian digits", () => {
    for (const { key } of A.types)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const s = A.solution!(key, level, seed);
          expect(s.startsWith("جواب:")).toBe(true);
          expect(s.length).toBeGreaterThanOrEqual(10);
          expect(s.length).toBeLessThanOrEqual(300);
          expect(s).not.toMatch(/[0-9]/);
          const head = s.split(/\. /)[0];
          if (key === "cycle") {
            const c = makeCycleQuestion(level, seed);
            expect(head).toContain(c.variant === "count" ? fa(c.answer) : symbolWord(c.set, c.answer));
          } else if (key === "nth") {
            const n = makeNthQuestion(level, seed);
            if (n.variant === "rule") {
              const { coef, constant } = ruleParts(n.answer);
              expect(head).toContain(`${fa(coef)} × n + ${fa(constant)}`);
            } else expect(tokens(head)).toContain(fa(n.answer));
          } else {
            const q = makeSequenceQuestion(key as SequenceQuestionType, level, seed);
            if (q.letters) expect(head).toContain(`«${letterAt(q.answer)}»`);
            else expect(tokens(head)).toContain(fa(Math.abs(q.answer)));
          }
        }
    expect(A.solution!("nth", 3, 5)).toBe(A.solution!("nth", 3, 5));
  });
});
