// The practice adapter against the tool's own generators and slip functions.

import { describe, expect, it } from "vitest";
import { buildMistake, machineMistake, makeMachineQuestion, slips, type Level, type Machine, type MachineQuestionType } from "@/generators/number-machine";
import { isChoice, makeSortQuestion, sortMistake } from "@/generators/sorting";
import { fa } from "@/tools/registry";
import { NUMBER_MACHINE_ADAPTER as A } from "./adapter";
import { TRY_TYPE_LABEL } from "./MachineTryPanel";
import { NUMBER_MACHINE_PRACTICE } from "./practice";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const LEVELS = [1, 2, 3] as const;
const MACHINE_TYPES: MachineQuestionType[] = ["run", "reverse", "guess", "build", "operator"];
const tokens = (s: string) => s.match(/[۰-۹]+/g) ?? [];

describe("number machine adapter", () => {
  it("agrees with practice.ts and the try panel", () => {
    expect(A.types).toEqual(NUMBER_MACHINE_PRACTICE.types);
    expect(A.levels).toEqual(NUMBER_MACHINE_PRACTICE.levels);
    expect(A.tags).toEqual(NUMBER_MACHINE_PRACTICE.tags);
    expect(A.version).toBe("number-machine@1");
    expect(Object.fromEntries(A.types.map((t) => [t.key, t.label]))).toEqual(TRY_TYPE_LABEL);
  });

  it("grades machine questions like the tool, for the answer and every slip", () => {
    for (const type of MACHINE_TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeMachineQuestion(type, level, seed);
          if (q.type === "build") {
            expect(A.grade(type, level, seed, JSON.parse(JSON.stringify(q.answer)))).toBe("right");
            const tries: Machine[] = [];
            if (q.answer.kind === "machine") {
              tries.push({ kind: "machine", rule: [...q.answer.rule].reverse() }, { kind: "machine", rule: q.answer.rule.map((s) => ({ ...s, n: s.n + 1 })) });
            } else {
              const op = q.answer.op;
              tries.push({ kind: "op", op: { ...op, p: op.q, q: op.p } }, { kind: "op", op: { ...op, p: op.p + 1 } });
            }
            for (const m of tries) {
              const tag = A.grade(type, level, seed, m);
              expect(tag).toBe(buildMistake(q, m));
              expect(A.tags[tag]).toBeTruthy();
            }
            continue;
          }
          expect(A.grade(type, level, seed, q.answer)).toBe("right");
          for (const [, v] of slips(q)) {
            const tag = A.grade(type, level, seed, v);
            expect(tag).toBe(machineMistake(q, v));
            expect(A.tags[tag]).toBeTruthy();
          }
        }
    expect(A.grade("run", 1, 1, "x")).toBe("other");
    expect(A.grade("build", 1, 1, 5)).toBe("other");
    expect(A.grade("build", 1, 1, { kind: "machine", rule: [{ op: "^", n: 2 }] })).toBe("other");
  });

  it("grades sort questions like the tool", () => {
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const q = makeSortQuestion(level, seed);
        expect(A.grade("sort", level, seed, q.answer)).toBe("right");
        const wrong = isChoice(q) ? q.tags.map((_, i) => i) : q.slips.map(([, v]) => v);
        for (const v of wrong) {
          const tag = A.grade("sort", level, seed, v);
          expect(tag).toBe(sortMistake(q, v));
          expect(A.tags[tag]).toBeTruthy();
        }
      }
  });

  it("gives three hints that never show a number answer", () => {
    for (const { key } of A.types)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = A.hints(key, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // Built machines and chosen options are not one number: nothing to check.
          if (key === "build") continue;
          const q = key === "sort" ? makeSortQuestion(level as Level, seed) : makeMachineQuestion(key as MachineQuestionType, level as Level, seed);
          if (q.type === "sort" && isChoice(q)) continue;
          const answer = (q as { answer: number }).answer;
          for (const line of h) expect(tokens(line)).not.toContain(fa(Math.abs(answer)));
        }
  });
});
