import { describe, expect, it } from "vitest";
import { askMistake, askSlips, makeArrangement, makeSeatingQuestion, SIZES, survivors, type Level, type SeatingQuestion, type SeatingType } from "@/generators/seating";
import { SEATING_GUIDE } from "./guide";
import { SEATING_TYPE_LABEL } from "./text";

// The hand-picked scenes in the teacher guide, rebuilt the way SeatingTool's
// hash reader builds them (#try=type&level&seed, #show=kind&n&c&seed,
// #show=family&level&seed, #explore=kind&n…).
const TYPES = Object.keys(SEATING_TYPE_LABEL) as SeatingType[];
const examples = SEATING_GUIDE.examples ?? [];

const build = (hash: string): SeatingQuestion => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as SeatingType;
  expect(TYPES).toContain(type);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makeSeatingQuestion(type, level, Number(p.get("seed")));
};
const hashFor = (i: number) => examples.find((ex) => ex.for === i)!.hash;

describe("seating guide examples", () => {
  it("every link opens a real scene", () => {
    for (const ex of examples) {
      const p = new URLSearchParams(ex.hash);
      if (p.has("try")) {
        expect(() => build(ex.hash)).not.toThrow();
        continue;
      }
      const kind = (p.get("show") ?? p.get("explore")) as SeatingType;
      expect(TYPES).toContain(kind);
      if (kind === "family") expect(() => makeSeatingQuestion("family", Number(p.get("level")) as Level, Number(p.get("seed")))).not.toThrow();
      else if (p.has("n")) expect(SIZES[kind]).toContain(Number(p.get("n")));
    }
  });

  it("right of someone facing us: the asked person sits at the top, and the mirror seat is a slip", () => {
    const q = build(hashFor(0));
    if (q.type === "family" || !q.ask) throw new Error("expected a seat question that asks for one person");
    expect(q.ask.rel === "right" || q.ask.rel === "left").toBe(true);
    if (q.ask.rel !== "right" && q.ask.rel !== "left") return;
    expect(q.solution[q.ask.of]).toBe(0);
    const flipped = askSlips(q).find(([t]) => t === "flipped");
    expect(flipped).toBeDefined();
    expect(askMistake(q, flipped![1])).toBe("flipped");
  });

  it("beside or right of: the show scene has both, and «beside» removes fewer cases", () => {
    const p = new URLSearchParams(hashFor(1));
    expect(p.get("show")).toBe("round");
    const q = makeArrangement("round", Number(p.get("n")), Number(p.get("seed")), Number(p.get("c")));
    const kinds = q.conds.map((c) => c.k);
    expect(kinds).toContain("adjacent");
    expect(kinds).toContain("right");
    const left = q.conds.map((_, k) => survivors(q, k + 1).length);
    const before = [survivors(q, 0).length, ...left];
    const cut = (k: number) => before[k] / before[k + 1];
    const right = kinds.indexOf("right");
    const beside = kinds.indexOf("adjacent");
    expect(cut(right)).toBeGreaterThan(cut(beside));
  });

  it("people between: «exactly 2 between» is a condition", () => {
    const q = build(hashFor(2));
    if (q.type === "family") throw new Error("expected a seat question");
    expect(q.conds.some((c) => c.k === "apart" && c.d === 3)).toBe(true);
  });

  it("family: the other side and the inverse word are both options", () => {
    const q = build(hashFor(3));
    if (q.type !== "family") throw new Error("expected a family question");
    const tags = q.options.map((o) => o.tag);
    expect(tags).toContain("side");
    expect(tags).toContain("inverse");
    expect(q.options[q.answer].tag).toBe("right");
  });
});
