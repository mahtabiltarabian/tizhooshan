import { describe, expect, it } from "vitest";
import { binaryMistake, wordMistake } from "@/generators/binary-code";
import { codeMistake, slips } from "@/generators/codes";
import { CODES_ADAPTER, codesAnswerToken, makeCodes } from "./adapter";
import { TRY_TYPE_LABEL, type TryType } from "./CodesTryPanel";
import { CODES_PRACTICE } from "./practice";
import { binFa } from "./binaryText";
import { answerFa } from "./text";
import { fa } from "@/tools/registry";
import { ALPHABET } from "@/generators/codes";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(TRY_TYPE_LABEL) as TryType[];
const LEVELS = [1, 2, 3] as const;
const words = (t: string) => t.split(/[\s«»،؛:.؟?()]+/).filter(Boolean);
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe("codes adapter", () => {
  it("agrees with practice.ts and the panel", () => {
    expect(CODES_ADAPTER.tool).toBe(CODES_PRACTICE.tool);
    expect(CODES_ADAPTER.types).toEqual(CODES_PRACTICE.types);
    expect(CODES_ADAPTER.levels).toEqual(CODES_PRACTICE.levels);
    expect(CODES_ADAPTER.tags).toEqual(CODES_PRACTICE.tags);
    expect(CODES_PRACTICE.types).toEqual(TYPES.map((key) => ({ key, label: TRY_TYPE_LABEL[key] })));
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeCodes(type, level, seed);
          const g = (r: unknown) => {
            const tag = CODES_ADAPTER.grade(type, level, seed, json(r));
            expect(CODES_ADAPTER.tags[tag], tag).toBeTruthy();
            return tag;
          };
          if (q.type === "binary") {
            if (q.kind === "word") {
              expect(g(q.word)).toBe("right");
              for (const [, v] of q.letterSlips) expect(g(v)).toBe(wordMistake(q, v));
            } else {
              expect(g(q.answer)).toBe("right");
              for (const [, v] of q.slips) expect(g(v)).toBe(binaryMistake(q, v));
            }
          } else {
            expect(g(q.answer)).toBe("right");
            for (const [, v] of slips(q)) expect(g(v)).toBe(codeMistake(q, v));
            // Some letters coded, the rest copied: the tool's "partial".
            const half = q.answer.map((a, i) => (i % 2 ? q.given[i] : a));
            expect(g(half)).toBe(codeMistake(q, half));
          }
        }
    expect(CODES_ADAPTER.grade("shift", 1, 1, "x")).toBe("other");
    expect(CODES_ADAPTER.grade("binary", 1, 1, [1, 2])).toBe("other");
  });

  it("hints: three lines, none prints the answer word or number", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = CODES_ADAPTER.hints(type, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // Codes into numbers or shapes and lamp answers have no single token to give away.
          const ans = codesAnswerToken(makeCodes(type, level, seed));
          // Whole words only: a sentence answer is matched as a run of words.
          if (ans) for (const line of h) expect(` ${words(line).join(" ")} `, `${type} ${level} ${seed}: ${line}`).not.toContain(` ${ans} `);
        }
  });

  it("solution: the real answer, in one to three short Persian sentences", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeCodes(type, level, seed);
          const s = CODES_ADAPTER.solution!(type, level, seed);
          const at = `${type} ${level} ${seed}: ${s}`;
          expect(s.startsWith("جواب:"), at).toBe(true);
          expect(s.length, at).toBeGreaterThanOrEqual(10);
          expect(s.length, at).toBeLessThanOrEqual(300);
          expect(s, at).not.toMatch(/[0-9]/);
          expect(s, at).toBe(CODES_ADAPTER.solution!(type, level, seed));
          if (q.type !== "binary") {
            expect(s, at).toContain(`«${answerFa(q)}»`);
            continue;
          }
          const token = q.kind === "word" ? `«${q.word.map((l) => ALPHABET[l]).join("")}»` : q.kind === "show" || q.kind === "next" ? binFa(q.answer) : fa(q.answer);
          expect(s.startsWith(`جواب: ${token}`) || s.startsWith(`جواب: کلمه ${token}`), at).toBe(true);
          // The lamps the tool grades as right.
          if (q.kind !== "word") expect(CODES_ADAPTER.grade(type, level, seed, q.answer)).toBe("right");
          else expect(CODES_ADAPTER.grade(type, level, seed, q.word)).toBe("right");
        }
  });
});
