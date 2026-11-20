import { describe, expect, it } from "vitest";
import { holeCells, makePaperQuestion, perpendicular, unfoldPoints, type Level, type PaperQuestionType } from "@/generators/paper-folding";
import { fa } from "@/tools/registry";
import { PAPER_ADAPTER as A } from "./adapter";
import { orderNames } from "./orderText";
import { PAPER_TYPE_LABEL } from "./PaperTryPanel";
import { PAPER_PRACTICE as P } from "./practice";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(PAPER_TYPE_LABEL) as PaperQuestionType[];
const LEVELS: Level[] = [1, 2, 3];

describe("paper adapter", () => {
  it("agrees with practice.ts and the tool's own type labels", () => {
    expect(A.types).toEqual(P.types);
    expect(A.levels).toEqual(P.levels);
    expect(A.tags).toEqual(P.tags);
    expect(A.version).toBe("paper@1");
    expect(P.types.map((t) => [t.key, t.label])).toEqual(Object.entries(PAPER_TYPE_LABEL));
  });

  it.each(TYPES)("%s: grades like the tool's own feedback, for the answer and every slip", (type) => {
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const q = makePaperQuestion(type, level, seed);
        const tag = (r: unknown) => {
          const t = A.grade(type, level, seed, r);
          expect(P.tags[t], t).toBeTruthy();
          return t;
        };
        expect(tag("x")).toBe("other");
        if (q.type === "holes") {
          expect(tag(q.answer)).toBe("right");
          expect(tag([...q.answer].reverse())).toBe("right");
          // The slips the panel names: a fold left shut, a fold mirrored on the wrong line.
          const shut = holeCells(unfoldPoints(q.punches, q.folds.slice(1)));
          if (shut.join(";") !== q.answer.join(";")) expect(tag(shut)).toBe("missingFold");
          const wrong = holeCells(unfoldPoints(q.punches, q.folds.map((f, j) => (j === 0 ? { ...f, line: perpendicular(f.line, q.S) } : f))));
          if (![q.answer, shut].some((c) => c.join(";") === wrong.join(";"))) expect(tag(wrong)).toBe("wrongAxis");
          expect(tag([])).toBe("holeCount");
          continue;
        }
        if (q.type === "order") {
          const right = q.shown.map((_, step) => q.shown.indexOf(step));
          expect(tag(right)).toBe("right");
          expect(tag(q.shown.map((_, i) => i))).not.toBe("right");
          expect(tag(right.slice(1))).toBe("other");
          continue;
        }
        expect(tag(q.answer)).toBe("right");
        q.options.forEach((v, i) => {
          if (i === q.answer) return;
          const want = q.type === "pieces" && v === 2 ** q.folds.length ? "layers" : (q.mistakes[i] ?? "other");
          expect(tag(i)).toBe(want);
        });
        expect(tag(q.options.length)).toBe("other");
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
        // Only "pieces" has a number for an answer; the others are pictures, cells or an order.
        const q = makePaperQuestion(type, level, seed);
        if (q.type === "pieces") for (const line of h) expect(line.split(/[\s،:.؛()]+/)).not.toContain(fa(q.options[q.answer]));
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
        const q = makePaperQuestion(type, level, seed);
        if (q.type === "holes") {
          expect(A.grade(type, level, seed, q.answer)).toBe("right");
          expect(q.answer.length).toBe(q.punches.length * 2 ** q.folds.length);
          expect(s).toContain(`جواب: ${fa(q.answer.length)} سوراخ`);
          // Few holes are named one by one: row from the top, column from the right.
          if (q.answer.length <= 4)
            for (const c of q.answer) {
              const [i, j] = c.split(",").map(Number);
              expect(s).toContain(`سطر ${fa(q.S - j)} ستون ${fa(q.S - i)}`);
            }
        } else if (q.type === "order") {
          const right = q.shown.map((_, n) => q.shown.indexOf(n));
          expect(A.grade(type, level, seed, right)).toBe("right");
          expect(s).toContain(orderNames(q));
        } else {
          expect(A.grade(type, level, seed, q.answer)).toBe("right");
          if (q.type === "pieces") expect(s).toContain(`جواب: ${fa(q.options[q.answer])} تکه.`);
          else expect(s).toContain(`جواب: گزینه ${fa(q.answer + 1)}`);
          if (q.type === "foldedShape") expect(s).toMatch(/یک (مثلث|مربع|مستطیل) /);
        }
      }
  }, 60_000);
});
