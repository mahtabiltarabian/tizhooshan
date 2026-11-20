// The report-card solution of tool 8, against the generator's own answers.

import { describe, expect, it } from "vitest";
import { makeClockQuestion, WEEKDAYS, type ClockQuestionType } from "@/generators/clock";
import { fa } from "@/tools/registry";
import { CLOCK_ADAPTER as A } from "./adapter";
import { timeFa } from "./Pictures";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);

describe("clock adapter: solution", () => {
  it("names the generator's answer, in short Persian with Persian digits", () => {
    for (const { key } of A.types)
      for (const level of A.levels)
        for (const seed of SEEDS) {
          const s = A.solution!(key, level, seed);
          expect(s.startsWith("جواب:")).toBe(true);
          expect(s.length).toBeGreaterThanOrEqual(10);
          expect(s.length).toBeLessThanOrEqual(300);
          expect(s).not.toMatch(/[0-9]/);
          const q = makeClockQuestion(key as ClockQuestionType, level as 1 | 2 | 3, seed);
          const token = q.type === "angle" ? `${fa(q.answer)} درجه` : q.type === "weekday" || q.type === "month" ? WEEKDAYS[q.answer] : timeFa(q.answer);
          expect(s.split(".")[0]).toContain(token);
        }
  });

  it("is the same every time", () => {
    expect(A.solution!("month", 3, 5)).toBe(A.solution!("month", 3, 5));
  });
});
