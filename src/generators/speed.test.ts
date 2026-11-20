import { describe, expect, it } from "vitest";
import { countSlips, makeSpeedQuestion, relation, sameGlyph, speedMistake, type Level, type SpeedQuestionType } from "./speed";

const TYPES: SpeedQuestionType[] = ["find", "count", "differ"];
const LEVELS: Level[] = [1, 2, 3];
const SEEDS = Array.from({ length: 10_000 }, (_, i) => i);

describe("speed generator", () => {
  it("same seed, same question", () => {
    for (const type of TYPES) for (const level of LEVELS) expect(makeSpeedQuestion(type, level, 42)).toEqual(makeSpeedQuestion(type, level, 42));
  });

  it("every question has exactly one right answer (10,000 seeds)", () => {
    for (const level of LEVELS)
      for (const seed of SEEDS.slice(0, level === 1 ? 10_000 : 3_000)) {
        const find = makeSpeedQuestion("find", level, seed);
        const where = find.grid.flatMap((g, i) => (sameGlyph(g, find.target) ? [i] : []));
        expect(find.answer).toEqual(where);
        expect(where.length).toBeGreaterThanOrEqual(4);
        expect(find.grid).toHaveLength(find.cols * find.rows);

        const differ = makeSpeedQuestion("differ", level, seed);
        const odd = differ.grid.filter((g) => !sameGlyph(g, differ.target));
        expect(odd).toHaveLength(1);
        expect(sameGlyph(differ.grid[differ.answer as number], differ.target)).toBe(false);
      }
  }, 120_000);

  it("level 2 hides turned copies; level 3 always hides the mirror image", () => {
    for (const seed of SEEDS.slice(0, 500)) {
      const l2 = makeSpeedQuestion("find", 2, seed);
      const k2 = l2.grid.map((g) => relation(g, l2.target));
      expect(k2).toContain("rotated");
      expect(k2).not.toContain("mirror");
      const l3 = makeSpeedQuestion("count", 3, seed);
      expect(l3.grid.map((g) => relation(g, l3.target)).filter((k) => k === "mirror").length).toBeGreaterThanOrEqual(2);
      const d3 = makeSpeedQuestion("differ", 3, seed);
      expect(relation(d3.grid[d3.answer as number], d3.target)).toBe("mirror");
    }
  });

  it("grades taps by the look-alike tapped, or what was missed", () => {
    for (const seed of SEEDS.slice(0, 300)) {
      const q = makeSpeedQuestion("find", 3, seed);
      const want = q.answer as number[];
      expect(speedMistake(q, want)).toBe("right");
      expect(speedMistake(q, [...want].reverse())).toBe("right");
      expect(speedMistake(q, want.slice(1))).toBe("missed");
      const mirror = q.grid.findIndex((g) => relation(g, q.target) === "mirror");
      expect(speedMistake(q, [...want, mirror])).toBe("mirror");
      const turned = q.grid.findIndex((g) => relation(g, q.target) === "rotated");
      if (turned >= 0) expect(speedMistake(q, [...want, turned])).toBe("rotated");
    }
    const q1 = makeSpeedQuestion("find", 1, 5);
    const other = q1.grid.findIndex((g) => relation(g, q1.target) === "other");
    expect(speedMistake(q1, [...(q1.answer as number[]), other])).toBe("careless");
    expect(speedMistake(q1, "x")).toBe("other");
  });

  it("count slips: mirrors and turned copies counted too, or one off", () => {
    for (const seed of SEEDS.slice(0, 300)) {
      const q = makeSpeedQuestion("count", 3, seed);
      expect(speedMistake(q, q.answer)).toBe("right");
      for (const [tag, v] of countSlips(q)) expect(speedMistake(q, v)).toBe(tag);
      const mirrors = q.grid.filter((g) => relation(g, q.target) === "mirror").length;
      expect(speedMistake(q, (q.answer as number) + mirrors)).toBe("mirror");
    }
  });
});
