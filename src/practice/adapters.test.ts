// Every tool's adapter against its light practice data and its generator.

import { describe, expect, it } from "vitest";
import { ADAPTERS } from "./adapters";
import { CATALOG } from "./catalog";
import { CLOCK_ADAPTER } from "@/tools/08-clock/adapter";
import { clockMistake, makeClockQuestion, slips, type ClockQuestionType } from "@/generators/clock";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);

describe("adapters", () => {
  it("one adapter for every catalog entry, with the same data", () => {
    expect(ADAPTERS.map((a) => a.tool).sort()).toEqual(CATALOG.map((c) => c.tool).sort());
    for (const a of ADAPTERS) {
      const c = CATALOG.find((x) => x.tool === a.tool)!;
      expect(a.types).toEqual(c.types);
      expect(a.levels).toEqual(c.levels);
      expect(a.tags).toEqual(c.tags);
      expect(a.version).toMatch(new RegExp(`^${a.tool}@\\d+$`));
    }
  });

  it.each(ADAPTERS.map((a) => [a.tool, a] as const))("%s: hints are three non-empty lines, and every tag has words", (_, a) => {
    for (const t of a.types)
      for (const l of a.levels)
        for (const seed of SEEDS.slice(0, 10)) {
          const h = a.hints(t.key, l, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
        }
  });
});

describe("solutions for the report card", () => {
  it.each(ADAPTERS.map((a) => [a.tool, a] as const))("%s: every type and level has a short worked answer in Persian digits", (_, a) => {
    for (const t of a.types)
      for (const l of a.levels)
        for (const seed of SEEDS.slice(0, 8)) {
          const s = a.solution(t.key, l, seed);
          expect(s.startsWith("جواب:")).toBe(true);
          expect(s.length).toBeGreaterThan(9);
          expect(s.length).toBeLessThanOrEqual(300);
          expect(s).not.toMatch(/[0-9]/);
        }
  });
});

describe("clock adapter", () => {
  const types: ClockQuestionType[] = ["angle", "mirror", "elapsed", "drift", "weekday", "month"];
  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of types)
      for (const level of [1, 2, 3] as const)
        for (const seed of SEEDS) {
          const q = makeClockQuestion(type, level, seed);
          expect(CLOCK_ADAPTER.grade(type, level, seed, q.answer)).toBe("right");
          for (const [, v] of slips(q)) {
            const tag = CLOCK_ADAPTER.grade(type, level, seed, v);
            expect(tag).toBe(clockMistake(q, v));
            expect(CLOCK_ADAPTER.tags[tag]).toBeTruthy();
          }
        }
    expect(CLOCK_ADAPTER.grade("angle", 1, 1, "x")).toBe("other");
  });
});
