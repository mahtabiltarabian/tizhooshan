import { describe, expect, it } from "vitest";
import { cellAt, gridCheck, liarsMistake, LOGIC_TYPES, makeLogicQuestion, type Level, type Mark } from "@/generators/logic";
import { mulberry32 } from "@/generators/random";
import { countMistake } from "@/generators/venn-count";
import { fa } from "@/tools/registry";
import { LOGIC_ADAPTER } from "./adapter";
import { LOGIC_TYPE_LABEL } from "./LogicTryPanel";
import { LOGIC_PRACTICE } from "./practice";
import { answerSentence } from "./countText";
import { ifOptionText } from "./ifText";
import { liarsAnswerFa, optionText } from "./text";
import { gridPairsFa } from "./adapter";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const LEVELS = [1, 2, 3] as const;
const tokens = (t: string): string[] => t.match(/[0-9۰-۹]+/g) ?? [];
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe("logic adapter", () => {
  it("agrees with practice.ts and the panel", () => {
    expect(LOGIC_ADAPTER.tool).toBe(LOGIC_PRACTICE.tool);
    expect(LOGIC_ADAPTER.types).toEqual(LOGIC_PRACTICE.types);
    expect(LOGIC_ADAPTER.levels).toEqual(LOGIC_PRACTICE.levels);
    expect(LOGIC_ADAPTER.tags).toEqual(LOGIC_PRACTICE.tags);
    expect(LOGIC_PRACTICE.types).toEqual(LOGIC_TYPES.map((key) => ({ key, label: LOGIC_TYPE_LABEL[key] })));
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of LOGIC_TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeLogicQuestion(type, level as Level, seed);
          const g = (r: unknown) => {
            const tag = LOGIC_ADAPTER.grade(type, level, seed, json(r));
            expect(LOGIC_ADAPTER.tags[tag], tag).toBeTruthy();
            return tag;
          };
          switch (q.type) {
            case "grid": {
              const n = q.size;
              const solved = Array.from({ length: n * n }, (_, c): Mark => (q.answer[Math.floor(c / n)] === c % n ? 1 : -1));
              expect(g(solved)).toBe("right");
              // Random grids, and the answer with one row shifted (a clash or a broken clue).
              const rng = mulberry32(seed);
              for (let k = 0; k < 5; k++) {
                const marks = Array.from({ length: n * n }, (): Mark => ([1, -1, 0] as const)[Math.floor(rng() * 3)]);
                expect(g(marks)).toBe(gridCheck(q, marks).tag);
              }
              const shifted = [...solved];
              shifted[cellAt(n, 0, q.answer[0])] = -1;
              shifted[cellAt(n, 0, (q.answer[0] + 1) % n)] = 1;
              expect(g(shifted)).toBe(gridCheck(q, shifted).tag);
              break;
            }
            case "liars":
              expect(g(q.answer)).toBe("right");
              q.answer.forEach((_, p) => {
                const flip = q.answer.map((l, i) => (i === p ? !l : l));
                expect(g(flip)).toBe(liarsMistake(q, flip).tag);
              });
              break;
            case "vennNum":
              expect(g(q.answer)).toBe("right");
              for (const s of q.slips) expect(g(s.value)).toBe(countMistake(q, s.value));
              break;
            default:
              expect(g(q.answer)).toBe("right");
              q.options.forEach((_, i) => expect(g(i)).toBe(q.tags[i]));
          }
        }
    expect(LOGIC_ADAPTER.grade("grid", 1, 1, [1])).toBe("other");
    expect(LOGIC_ADAPTER.grade("venn", 1, 1, 99)).toBe("other");
  });

  it("hints: three lines, none prints a number answer", () => {
    for (const type of LOGIC_TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = LOGIC_ADAPTER.hints(type, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // Grids, liars and options have no single number or word to give away.
          const q = makeLogicQuestion(type, level as Level, seed);
          if (q.type === "vennNum") for (const line of h) expect(tokens(line), `${type} ${level} ${seed}: ${line}`).not.toContain(fa(q.answer));
        }
  });

  it("solution: the real answer, in one to three short Persian sentences", () => {
    for (const type of LOGIC_TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeLogicQuestion(type, level as Level, seed);
          const s = LOGIC_ADAPTER.solution!(type, level, seed);
          const at = `${type} ${level} ${seed}: ${s}`;
          expect(s.startsWith("جواب:"), at).toBe(true);
          expect(s.length, at).toBeGreaterThanOrEqual(10);
          expect(s.length, at).toBeLessThanOrEqual(300);
          expect(s, at).not.toMatch(/[0-9]/);
          expect(s, at).toBe(LOGIC_ADAPTER.solution!(type, level, seed));
          if (q.type === "grid") {
            expect(s, at).toContain(gridPairsFa(q));
            // Those pairs, as marks, are what the grid grades as right.
            const marks = Array.from({ length: q.size * q.size }, (_, c) => (q.answer[Math.floor(c / q.size)] === c % q.size ? 1 : -1));
            expect(LOGIC_ADAPTER.grade(type, level, seed, marks)).toBe("right");
          }
          if (q.type === "liars") {
            expect(s, at).toContain(liarsAnswerFa(q));
            expect(LOGIC_ADAPTER.grade(type, level, seed, q.answer)).toBe("right");
          }
          if (q.type === "venn" || q.type === "ifThen") {
            const text = q.type === "venn" ? optionText(q, q.answer) : ifOptionText(q, q.answer);
            expect(s, at).toContain(`گزینه ${fa(q.answer + 1)}، «${text}»`);
            expect(LOGIC_ADAPTER.grade(type, level, seed, q.answer)).toBe("right");
          }
          if (q.type === "vennNum") {
            expect(s, at).toContain(answerSentence(q, fa(q.answer)));
            expect(LOGIC_ADAPTER.grade(type, level, seed, q.answer)).toBe("right");
          }
        }
  });
});
