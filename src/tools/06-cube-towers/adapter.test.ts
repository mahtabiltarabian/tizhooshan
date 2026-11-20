// The practice adapter against the tool's own generators and slips. The 3D
// scenes are slow, so only the generators are used here.

import { describe, expect, it } from "vitest";
import { emptyTower, makeTowerQuestion, matchesViews, type TowerQuestionType } from "@/generators/cube-towers";
import { solidMistake } from "@/generators/solids";
import { ltr } from "@/practice/text";
import { fa } from "@/tools/registry";
import { CUBE_TOWERS_ADAPTER as A } from "./adapter";
import { CUBE_TOWERS_PRACTICE } from "./practice";
import { TOWER_TYPE_LABEL } from "./TowerTryPanel";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const LEVELS = [1, 2, 3] as const;
const TYPES = Object.keys(TOWER_TYPE_LABEL) as TowerQuestionType[];
const tokens = (s: string) => s.match(/[۰-۹]+/g) ?? [];

describe("cube towers adapter", () => {
  it("agrees with practice.ts and the try panel", () => {
    expect(A.types).toEqual(CUBE_TOWERS_PRACTICE.types);
    expect(A.levels).toEqual(CUBE_TOWERS_PRACTICE.levels);
    expect(A.tags).toEqual(CUBE_TOWERS_PRACTICE.tags);
    expect(A.version).toBe("cube-towers@1");
    expect(Object.fromEntries(A.types.map((t) => [t.key, t.label]))).toEqual(TOWER_TYPE_LABEL);
  });

  it("grades like the tool's own feedback, for the answer and every option", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeTowerQuestion(type, level, seed);
          if (q.type === "build") {
            expect(A.grade(type, level, seed, q.tower.h)).toBe("right");
            const empty = emptyTower(q.tower.w, q.tower.d).h;
            expect(A.grade(type, level, seed, empty)).toBe("notMatching");
            // A different tower with the same views is right too.
            const taller = q.tower.h.map((r) => r.map((h) => h));
            const y = taller.findIndex((r) => r.some((h) => h > 0));
            taller[y][taller[y].findIndex((h) => h > 0)] += 1;
            const tag = A.grade(type, level, seed, taller);
            expect(tag).toBe(matchesViews({ ...q.tower, h: taller }, q.views) ? "right" : "notMatching");
            expect(A.grade(type, level, seed, [[1]])).toBe("other");
            continue;
          }
          expect(A.grade(type, level, seed, q.answer)).toBe("right");
          q.options.forEach((_, i) => {
            const tag = A.grade(type, level, seed, i);
            const expected = q.type === "solid" ? solidMistake(q, q.options[i]) : i === q.answer ? "right" : (q.mistakes[i] ?? "other");
            expect(tag).toBe(expected);
            expect(A.tags[tag]).toBeTruthy();
          });
          expect(A.grade(type, level, seed, q.options.length)).toBe("other");
        }
    expect(A.grade("count", 1, 1, "x")).toBe("other");
  });

  it("gives three hints that never show a number answer", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = A.hints(type, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // Views and built towers are pictures, not one number: nothing to look for.
          const q = makeTowerQuestion(type, level, seed);
          if (q.type === "count" || q.type === "complete" || q.type === "paint" || q.type === "solid")
            for (const line of h) expect(tokens(line)).not.toContain(fa(q.options[q.answer]));
        }
  });
});

describe("cube-towers solution", () => {
  const SOL_SEEDS = Array.from({ length: 25 }, (_, i) => i * 53 + 3);
  it.each(TYPES)("%s: names the generator's real answer, in Persian, within 300 characters", (type) => {
    for (const level of LEVELS)
      for (const seed of SOL_SEEDS) {
        const s = A.solution!(type, level, seed);
        expect(s.startsWith("جواب:")).toBe(true);
        expect(s.length).toBeGreaterThanOrEqual(10);
        expect(s.length).toBeLessThanOrEqual(300);
        expect(s).not.toMatch(/[0-9]/);
        const q = makeTowerQuestion(type, level, seed);
        if (q.type === "build") {
          // The tower it describes is one the grader accepts.
          expect(A.grade(type, level, seed, q.tower.h)).toBe("right");
          for (const row of q.tower.h) expect(s).toContain(ltr(row.map(fa).join("، ")));
        } else {
          expect(A.grade(type, level, seed, q.answer)).toBe("right");
          if (q.type === "top" || q.type === "front" || q.type === "side") expect(s).toContain(`جواب: گزینه ${fa(q.answer + 1)}.`);
          else expect(s).toContain(`جواب: ${fa(q.options[q.answer] as number)} `);
        }
      }
  });
});
