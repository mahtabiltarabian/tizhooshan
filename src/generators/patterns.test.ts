import { describe, expect, it } from "vitest";
import { mulberry32 } from "./random";
import { cellTile, fillLayout, makePatternQuestion, makeRules, ruleText, tileKey, valuesText, type Level, type PatternQuestionType, type Tile } from "./patterns";

const TYPES: PatternQuestionType[] = ["matrix2", "matrix3", "sequence", "rotation", "combine", "sides", "missing", "odd"];
const LEVELS: Level[] = [1, 2, 3];

describe("pattern rules", () => {
  it("fills a 3×3 matrix so every row and column has each shape and fill once", () => {
    for (let s = 0; s < 200; s++) {
      const { rules, base } = makeRules(["shape", "fill"], "m3", mulberry32(s));
      const cells = fillLayout(base, rules, "m3");
      for (let i = 0; i < 3; i++) {
        const row = cells.slice(i * 3, i * 3 + 3);
        const col = [cells[i], cells[i + 3], cells[i + 6]];
        for (const run of [row, col]) {
          expect(new Set(run.map((t) => t.shape)).size).toBe(3);
          expect(new Set(run.map((t) => t.fill)).size).toBe(3);
        }
      }
    }
  });

  it("keeps counts between 1 and 5 and turns step evenly", () => {
    for (let s = 0; s < 500; s++)
      for (const layout of ["m2", "m3", "seq"] as const) {
        const { rules, base } = makeRules(["count", "turn"], layout, mulberry32(s));
        for (const t of fillLayout(base, rules, layout)) {
          expect(t.count).toBeGreaterThanOrEqual(1);
          expect(t.count).toBeLessThanOrEqual(5);
        }
      }
  });

  it("adds strokes, or keeps only the ones not shared", () => {
    const add = cellTile({}, [{ kind: "lines", op: "add", masks: [0b0011, 0b0110] }], 0, 2);
    const xor = cellTile({}, [{ kind: "lines", op: "xor", masks: [0b0011, 0b0110] }], 0, 2);
    expect(add.lines).toBe(0b0111);
    expect(xor.lines).toBe(0b0101);
  });
});

describe("pattern questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makePatternQuestion(t, l, 99)).toEqual(makePatternQuestion(t, l, 99));
  });

  it("has distinct options and exactly one right answer, for 10,000 seeds", () => {
    const want = (l: Level) => (l === 3 ? 6 : 4);
    const problems: string[] = [];
    for (const t of TYPES)
      for (const l of LEVELS)
        for (let s = 0; s < 10_000; s++) {
          const q = makePatternQuestion(t, l, s);
          const where = `${t} ${l} ${s}`;
          if (q.type === "odd") {
            if (new Set(q.tiles.map(tileKey)).size !== 5 || q.answer < 0 || q.answer > 4) problems.push(where);
            continue;
          }
          const keys = q.type === "missing" ? q.options.map((o) => o.map(tileKey).join("|")) : q.options.map(tileKey);
          if (q.options.length !== want(l) || new Set(keys).size !== keys.length) problems.push(`${where} options`);
          const right =
            q.type === "missing"
              ? [0, 1, 2, 3].map((k) => tileKey(q.cells[(q.hole[0] + (k >> 1)) * q.cols + q.hole[1] + (k & 1)])).join("|")
              : tileKey(q.cells[q.blank]);
          if (keys.filter((k) => k === right).length !== 1 || keys[q.answer] !== right) problems.push(`${where} answer`);
          if (q.tags.filter((g) => g === "right").length !== 1) problems.push(`${where} tags`);
        }
    expect(problems.slice(0, 10)).toEqual([]);
  }, 120_000);

  it("odd one out: one tile breaks what the other four share", () => {
    for (let s = 0; s < 2000; s++) {
      const q = makePatternQuestion("odd", 3, s);
      if (q.type !== "odd") continue;
      const ok = (t: Tile) => t.sides === t.dots;
      expect(q.tiles.filter(ok)).toHaveLength(4);
      expect(ok(q.tiles[q.answer])).toBe(false);
      const m = makePatternQuestion("odd", 2, s);
      if (m.type === "odd") expect(m.tiles.filter((t) => t.flip).length).toBe(1);
    }
  });

  it("calls fill «رنگ و نقش», the name on the explore card, never just «رنگ»", () => {
    const bare = /رنگ(?! و نقش)/;
    const fill = { kind: "fill", set: ["white", "black", "striped"], shift: 1 } as const;
    expect(ruleText({ ...fill, set: [...fill.set] }, "m3")).toMatch(/^رنگ و نقش:/);
    expect(ruleText({ ...fill, set: [...fill.set] }, "seq")).toMatch(/^رنگ و نقش:/);
    expect(valuesText([{ fill: "black" }, null], [{ ...fill, set: [...fill.set] }])).toMatch(/^رنگ و نقش سیاه، ؟$/);
    for (const t of TYPES)
      for (const l of LEVELS)
        for (let s = 0; s < 300; s++) {
          const q = makePatternQuestion(t, l, s);
          const text = JSON.stringify(q);
          expect(text, `${t} ${l} ${s}`).not.toMatch(bare);
        }
  });
});
