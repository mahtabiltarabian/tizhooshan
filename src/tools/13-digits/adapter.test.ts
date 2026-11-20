import { describe, expect, it } from "vitest";
import { answerKey, answerKind, digitsMistake, makeDigitsQuestion, slips, type DigitsQuestionType, type Level } from "@/generators/digits";
import { fa } from "@/tools/registry";
import { DIGITS_ADAPTER as A } from "./adapter";
import { DIGITS_TYPE_LABEL, digitsPrompt } from "./DigitsTryPanel";
import { DIGITS_PRACTICE as P } from "./practice";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(DIGITS_TYPE_LABEL) as DigitsQuestionType[];
const LEVELS: Level[] = [1, 2, 3];
const nums = (s: string): string[] => s.match(/[۰-۹]+/g) ?? [];

describe("digits adapter", () => {
  it("agrees with practice.ts and the tool's own type labels", () => {
    expect(A.types).toEqual(P.types);
    expect(A.levels).toEqual(P.levels);
    expect(A.tags).toEqual(P.tags);
    expect(A.version).toBe("digits@1");
    expect(P.types.map((t) => [t.key, t.label])).toEqual(Object.entries(DIGITS_TYPE_LABEL));
    expect(P.tags.right).toBeTruthy();
    expect(P.tags.other).toBeTruthy();
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeDigitsQuestion(type, level, seed);
          const tag = (r: unknown) => {
            const t = A.grade(type, level, seed, r);
            expect(P.tags[t], t).toBeTruthy();
            return t;
          };
          const key = answerKey(q);
          expect(tag(key)).toBe("right");
          // Known number slips, and other wrong answers the panel can send.
          const tries = [...slips(q).map(([, v]) => String(v)), key.split("").reverse().join(""), String(Number(key) + 1), "0", "1", "2", "0123", "9".repeat(key.length)];
          if (q.type === "match") tries.push(q.start.join("."));
          if (q.type === "divisible") for (let d = 0; d < 10; d++) tries.push(String(d));
          for (const v of tries) expect(tag(v), `${type} ${level} ${seed} ${v}`).toBe(digitsMistake(q, v));
          expect(tag(Number(key))).toBe("other");
          expect(tag(null)).toBe("other");
        }
  }, 60_000);

  it("hints are three lines and give nothing away", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = A.hints(type, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // A number answer is never in this question's own step, unless the
          // question itself shows it. (The first two lines are the same for
          // every question of a type. Stick masks, letters, signs, factors and
          // yes/no or odd/even choices are no number to look for.)
          const q = makeDigitsQuestion(type, level, seed);
          const kind = answerKind(q);
          if (kind !== "number" && kind !== "cards") continue;
          if (q.type === "prime" && q.ask === "factor") continue;
          const ans = fa(answerKey(q));
          if (nums(digitsPrompt(q)).includes(ans)) continue;
          expect(nums(h[2]), `${type} ${level} ${seed}: ${h[2]}`).not.toContain(ans);
        }
  }, 60_000);
});
