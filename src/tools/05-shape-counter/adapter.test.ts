import { describe, expect, it } from "vitest";
import { makeHiddenQuestion } from "@/generators/hidden-figure";
import { countSlip, countSlips, makeStrokeQuestion } from "@/generators/one-stroke";
import { countMistake, figureOf, listShapes, makeCountQuestion, type CountQuestionType, type Level, type ShapeQuestionType } from "@/generators/shape-count";
import { fa } from "@/tools/registry";
import { SHAPE_COUNTER_ADAPTER as A } from "./adapter";
import { COUNT_TYPE_LABEL } from "./CounterTryPanel";
import { SHAPE_COUNTER_PRACTICE as P } from "./practice";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(COUNT_TYPE_LABEL) as ShapeQuestionType[];
const COUNT_TYPES = TYPES.filter((t): t is CountQuestionType => t !== "hidden" && t !== "stroke");
const LEVELS: Level[] = [1, 2, 3];

/** Hint words, split the way a reader sees separate numbers. */
const tokens = (line: string) => line.split(/[\s،:.؛()«»؟]+/);

describe("shape-counter adapter", () => {
  it("agrees with practice.ts and the tool's own type labels", () => {
    expect(A.types).toEqual(P.types);
    expect(A.levels).toEqual(P.levels);
    expect(A.tags).toEqual(P.tags);
    expect(A.version).toBe("shape-counter@1");
    expect(P.types.map((t) => [t.key, t.label])).toEqual(Object.entries(COUNT_TYPE_LABEL));
  });

  const tagOf = (type: string, level: number, seed: number, r: unknown) => {
    const t = A.grade(type, level, seed, r);
    expect(P.tags[t], t).toBeTruthy();
    return t;
  };

  it.each(COUNT_TYPES)("counting, %s: grades like the tool's own feedback, for the answer and every slip", (type) => {
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const q = makeCountQuestion(type, level, seed);
        expect(tagOf(type, level, seed, q.answer)).toBe("right");
        const slips = [q.answer - 1, q.answer + 1, q.answer + 7, Math.max(0, q.answer - 9)];
        if (q.type === "growing") slips.push(q.counts[2] + (q.counts[2] - q.counts[1]) * (q.ask - 3));
        else {
          const fig = figureOf(q.spec);
          slips.push(listShapes(fig, q.kind).filter((s) => s.pieces === 1).length);
          if (q.kind === "rectangle") slips.push(q.answer - listShapes(fig, "square").length);
        }
        for (const v of slips) expect(tagOf(type, level, seed, v)).toBe(countMistake(q, v));
        expect(tagOf(type, level, seed, String(q.answer))).toBe("other");
      }
  }, 60_000);

  it("hidden figure and one stroke: grades like the tool's own feedback", () => {
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const h = makeHiddenQuestion(level, seed);
        h.options.forEach((_, i) => expect(tagOf("hidden", level, seed, i)).toBe(i === h.answer ? "right" : (h.mistakes[i] ?? "notHidden")));
        expect(tagOf("hidden", level, seed, 4)).toBe("other");

        const s = makeStrokeQuestion(level, seed);
        if (s.ask === "count") {
          expect(tagOf("stroke", level, seed, s.answer)).toBe("right");
          for (const [, v] of countSlips(s.fig)) if (v !== s.answer) expect(tagOf("stroke", level, seed, v)).toBe(countSlip(s, v) ?? "oddMiscount");
          continue;
        }
        const n = s.ask === "which" ? s.options.length : s.choices.length;
        for (let i = 0; i < n; i++) expect(tagOf("stroke", level, seed, i)).toBe(i === s.answer ? "right" : s.mistakes[i]);
        expect(tagOf("stroke", level, seed, n)).toBe("other");
      }
  }, 60_000);

  it.each(TYPES)("%s: hints are three lines and give nothing away", (type) => {
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const h = A.hints(type, level, seed);
        expect(h).toHaveLength(3);
        for (const line of h) {
          expect(line.trim().length).toBeGreaterThan(5);
          expect(line).not.toContain("گزینه");
        }
        // A count is the answer: never a word of a hint. Hidden figure and the
        // one-stroke choices answer with an option, where this means nothing.
        let answer: number | null = null;
        if (type !== "hidden" && type !== "stroke") answer = makeCountQuestion(type, level, seed).answer;
        if (type === "stroke") {
          const s = makeStrokeQuestion(level, seed);
          if (s.ask === "count") answer = s.answer;
        }
        if (answer !== null) for (const line of h) expect(tokens(line)).not.toContain(fa(answer));
      }
  }, 60_000);
});
