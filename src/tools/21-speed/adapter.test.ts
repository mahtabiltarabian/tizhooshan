import { describe, expect, it } from "vitest";
import { countSlips, makeSpeedQuestion, relation, type Level, type SpeedQuestionType } from "@/generators/speed";
import { SPEED_ADAPTER } from "./adapter";
import { SPEED_PRACTICE } from "./practice";

const TYPES: SpeedQuestionType[] = ["find", "count", "differ"];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);

describe("speed adapter", () => {
  it("agrees with its practice data", () => {
    expect(SPEED_ADAPTER.types).toEqual(SPEED_PRACTICE.types);
    expect(SPEED_ADAPTER.types.map((t) => t.key)).toEqual(TYPES);
  });

  it("grades answers and slips, and every tag has words", () => {
    for (const type of TYPES)
      for (const level of [1, 2, 3] as Level[])
        for (const seed of SEEDS) {
          const q = makeSpeedQuestion(type, level, seed);
          expect(SPEED_ADAPTER.grade(type, level, seed, q.answer)).toBe("right");
          if (type === "count") for (const [tag, v] of countSlips(q)) expect(SPEED_ADAPTER.grade(type, level, seed, v)).toBe(tag);
          if (type === "find" && level === 3) {
            const mirror = q.grid.findIndex((g) => relation(g, q.target) === "mirror");
            expect(SPEED_ADAPTER.grade(type, level, seed, [...(q.answer as number[]), mirror])).toBe("mirror");
          }
          if (type === "differ") expect(SPEED_ADAPTER.grade(type, level, seed, ((q.answer as number) + 1) % q.grid.length)).toBe("other");
        }
    for (const tag of ["right", "mirror", "rotated", "missed", "careless", "offByOne", "other"]) expect(SPEED_ADAPTER.tags[tag]).toBeTruthy();
  });

  it("hints never give the count away", () => {
    for (const level of [1, 2, 3] as Level[])
      for (const seed of SEEDS) {
        const q = makeSpeedQuestion("count", level, seed);
        const hints = SPEED_ADAPTER.hints("count", level, seed);
        expect(hints).toHaveLength(3);
        const fa = (n: number) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
        for (const h of hints) expect(h.split(/\s/)).not.toContain(fa(q.answer as number));
      }
  });
});
