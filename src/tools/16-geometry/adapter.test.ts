import { describe, expect, it } from "vitest";
import { checkBuild, checkCut, geometryMistake, makeGeometryQuestion, slips, type GeometryQuestionType, type Level, type Pt } from "@/generators/geometry";
import { mulberry32 } from "@/generators/random";
import { GEOMETRY_ADAPTER, geometryAnswerFa } from "./adapter";
import { num } from "./frames";
import { choicesOf } from "./GeometryText";
import { measureUnit } from "./MeasureText";
import { GEOMETRY_TYPE_LABEL } from "./GeometryTryPanel";
import { GEOMETRY_PRACTICE } from "./practice";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(GEOMETRY_TYPE_LABEL) as GeometryQuestionType[];
const LEVELS = [1, 2, 3] as const;
const tokens = (t: string): string[] => t.match(/[0-9۰-۹]+(?:[٫.][0-9۰-۹]+)?/g) ?? [];
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe("geometry adapter", () => {
  it("agrees with practice.ts and the panel", () => {
    expect(GEOMETRY_ADAPTER.tool).toBe(GEOMETRY_PRACTICE.tool);
    expect(GEOMETRY_ADAPTER.types).toEqual(GEOMETRY_PRACTICE.types);
    expect(GEOMETRY_ADAPTER.levels).toEqual(GEOMETRY_PRACTICE.levels);
    expect(GEOMETRY_ADAPTER.tags).toEqual(GEOMETRY_PRACTICE.tags);
    expect(GEOMETRY_PRACTICE.types).toEqual(TYPES.map((key) => ({ key, label: GEOMETRY_TYPE_LABEL[key] })));
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeGeometryQuestion(type, level as Level, seed);
          const g = (r: unknown) => {
            const tag = GEOMETRY_ADAPTER.grade(type, level, seed, json(r));
            expect(GEOMETRY_ADAPTER.tags[tag], tag).toBeTruthy();
            return tag;
          };
          if (q.type === "build") {
            expect(g(q.example)).toBe("right");
            const rng = mulberry32(seed);
            for (let k = 0; k < 6; k++) {
              const poly = Array.from({ length: 3 + (k % 3) }, (): Pt => [Math.floor(rng() * q.n), Math.floor(rng() * q.n)]);
              expect(g(poly)).toBe(checkBuild(q, poly).tag);
            }
          } else if (q.type === "divide") {
            expect(g(q.example)).toBe("right");
            expect(g([q.example[0], q.example[0]])).toBe("few");
            const rng = mulberry32(seed);
            for (let k = 0; k < 6; k++) {
              const cut: [Pt, Pt] = [q.poly[k % q.poly.length], [Math.floor(rng() * q.n), Math.floor(rng() * q.n)]];
              expect(g(cut)).toBe(checkCut(q, ...cut).tag);
            }
          } else {
            expect(g(q.answer)).toBe("right");
            for (const [, v] of slips(q)) expect(g(v)).toBe(geometryMistake(q, v));
          }
        }
    expect(GEOMETRY_ADAPTER.grade("area", 1, 1, "x")).toBe("other");
    expect(GEOMETRY_ADAPTER.grade("build", 1, 1, 7)).toBe("other");
    expect(GEOMETRY_ADAPTER.grade("divide", 1, 1, [[0, 0]])).toBe("other");
  });

  it("hints: three lines, none prints a numeric answer", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = GEOMETRY_ADAPTER.hints(type, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // classify, build and divide have no single number to give away.
          const ans = geometryAnswerFa(makeGeometryQuestion(type, level as Level, seed));
          if (ans) for (const line of h) expect(tokens(line), `${type} ${level} ${seed}: ${line}`).not.toContain(ans);
        }
  });

  it("solution names the real answer with its unit, in Persian digits, short enough for the report card", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const s = GEOMETRY_ADAPTER.solution!(type, level, seed);
          const where = `${type} ${level} ${seed}: ${s}`;
          expect(s.startsWith("جواب:"), where).toBe(true);
          expect(s.length, where).toBeGreaterThanOrEqual(10);
          expect(s.length, where).toBeLessThanOrEqual(300);
          expect(s, where).not.toMatch(/[0-9]/);
          expect(GEOMETRY_ADAPTER.solution!(type, level, seed)).toBe(s);
          const q = makeGeometryQuestion(type, level as Level, seed);
          // What the first sentence must say, and that grade() takes that answer as right.
          const first = s.slice(0, s.indexOf("."));
          let token: string;
          if (q.type === "build") {
            expect(GEOMETRY_ADAPTER.grade(type, level, seed, json(q.example))).toBe("right");
            token = q.area !== null ? `${num(q.area)} واحد مربع` : `${num(q.perimeter!)} واحد`;
          } else if (q.type === "divide") {
            expect(GEOMETRY_ADAPTER.grade(type, level, seed, json(q.example))).toBe("right");
            token = "مساحت برابر";
          } else {
            expect(GEOMETRY_ADAPTER.grade(type, level, seed, q.answer)).toBe("right");
            if (q.type === "classify") token = `«${choicesOf(q.level)[q.answer]}»`;
            else if (q.type === "angle" || q.type === "parallel") token = `${num(q.answer)} درجه`;
            else if (q.type === "area") token = `${num(q.answer)} واحد مربع`;
            else if (q.type === "perimeter") token = `${num(q.answer)} واحد`;
            else token = `${num(q.answer)} ${measureUnit(q)}`;
          }
          expect(first, where).toContain(token);
        }
  });
});
