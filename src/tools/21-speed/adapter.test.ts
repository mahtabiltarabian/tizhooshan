import { describe, expect, it } from "vitest";
import { countSlips, makeSpeedQuestion, relation, type Level, type SpeedQuestionType } from "@/generators/speed";
import { itemSlips, makeMentalQuestion } from "@/generators/mental";
import { SPEED_ADAPTER } from "./adapter";
import { SPEED_PRACTICE } from "./practice";

const TYPES: SpeedQuestionType[] = ["find", "count", "differ"];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);

describe("speed adapter", () => {
  it("agrees with its practice data", () => {
    expect(SPEED_ADAPTER.types).toEqual(SPEED_PRACTICE.types);
    expect(SPEED_ADAPTER.types.map((t) => t.key)).toEqual([...TYPES, "mental"]);
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

  it("grades a mental arithmetic card by its first known slip, and every tag has words", () => {
    for (const level of [1, 2, 3] as Level[])
      for (const seed of SEEDS) {
        const q = makeMentalQuestion(level, seed);
        const answers = q.items.map((it) => it.answer);
        expect(SPEED_ADAPTER.grade("mental", level, seed, answers)).toBe("right");
        q.items.forEach((it, i) => {
          for (const [tag, v] of itemSlips(it)) {
            const got = SPEED_ADAPTER.grade("mental", level, seed, answers.map((a, j) => (j === i ? v : a)));
            expect(got).toBe(tag);
            expect(SPEED_ADAPTER.tags[got]).toBeTruthy();
          }
        });
        expect(SPEED_ADAPTER.grade("mental", level, seed, answers.map((a, j) => (j === 0 ? a + 100 : a)))).toBe("other");
      }
  });

  it("mental hints never show an answer on the card", () => {
    const fa = (n: number) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
    for (const level of [1, 2, 3] as Level[])
      for (const seed of SEEDS) {
        const answers = makeMentalQuestion(level, seed).items.map((it) => fa(it.answer));
        const hints = SPEED_ADAPTER.hints("mental", level, seed);
        expect(hints).toHaveLength(3);
        for (const h of hints) for (const t of h.match(/[۰-۹]+/g) ?? []) expect(answers).not.toContain(t);
      }
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

describe("speed solution", () => {
  const SOL_SEEDS = Array.from({ length: 25 }, (_, i) => i * 53 + 3);
  const fa = (n: number) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  it.each([...TYPES, "mental"])("%s: names the generator's real answer, in Persian, within 300 characters", (type) => {
    for (const level of [1, 2, 3] as Level[])
      for (const seed of SOL_SEEDS) {
        const s = SPEED_ADAPTER.solution!(type, level, seed);
        expect(s.startsWith("جواب:")).toBe(true);
        expect(s.length).toBeGreaterThanOrEqual(10);
        expect(s.length).toBeLessThanOrEqual(300);
        expect(s).not.toMatch(/[0-9]/);
        if (type === "mental") {
          const answers = makeMentalQuestion(level, seed).items.map((it) => it.answer);
          expect(SPEED_ADAPTER.grade(type, level, seed, answers)).toBe("right");
          expect(s).toContain(`جواب: ${answers.map(fa).join("، ")} (`);
          continue;
        }
        const q = makeSpeedQuestion(type as SpeedQuestionType, level, seed);
        expect(SPEED_ADAPTER.grade(type, level, seed, q.answer)).toBe("right");
        if (q.type === "differ") {
          const at = q.answer as number;
          expect(s).toContain(`جواب: ردیف ${fa(Math.floor(at / q.cols) + 1)}، خانه ${fa((at % q.cols) + 1)} از راست.`);
        } else expect(s).toContain(`جواب: ${fa(q.type === "find" ? (q.answer as number[]).length : (q.answer as number))} شکل`);
      }
  });
});
