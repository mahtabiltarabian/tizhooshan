import { describe, expect, it } from "vitest";
import { countMistake, type VennCountQuestion } from "@/generators/venn-count";
import { defaultSize, gridSteps, liarSteps, liarsMistake, LOGIC_TYPES, makeLogicQuestion, type LogicQuestion, type LogicType, type Level } from "@/generators/logic";
import { LOGIC_GUIDE } from "./guide";

// The hand-picked scenes in the teacher guide, rebuilt the way LogicTool's hash
// reader builds them (#try=type&level&seed(&size&extra), #show=type&level&seed, #explore=area).
const examples = LOGIC_GUIDE.examples ?? [];

const build = (hash: string, key = "try"): LogicQuestion => {
  const p = new URLSearchParams(hash);
  const type = p.get(key) as LogicType;
  expect(LOGIC_TYPES).toContain(type);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  const sz = Number(p.get("size"));
  const size: 3 | 4 = sz === 3 || sz === 4 ? sz : defaultSize(level);
  return makeLogicQuestion(type, level, Number(p.get("seed")), { size, extra: p.get("extra") === "1" });
};
const byFor = (i: number) => {
  const hash = examples.find((ex) => ex.for === i)!.hash;
  return build(hash, new URLSearchParams(hash).has("show") ? "show" : "try");
};
const countTrap = (q: VennCountQuestion, tag: string) => {
  const hit = q.slips.find((s) => s.tag === tag);
  expect(hit, tag).toBeDefined();
  expect(countMistake(q, hit!.value)).toBe(tag);
};

describe("logic guide examples", () => {
  it("every link opens a real scene", () => {
    for (const ex of examples) {
      const p = new URLSearchParams(ex.hash);
      if (p.has("try")) expect(() => build(ex.hash)).not.toThrow();
      else if (p.has("show")) expect(() => build(ex.hash, "show")).not.toThrow();
      else expect(LOGIC_TYPES).toContain(p.get("explore"));
    }
  });

  it("negative clues: every clue is a «no», and none can be left out", () => {
    const q = byFor(0);
    if (q.type !== "grid") throw new Error("expected a grid question");
    expect(q.clues.every((c) => c.kind === "no")).toBe(true);
    expect(gridSteps(q.size, q.clues).solved).toBe(true);
    q.clues.forEach((_, k) => expect(gridSteps(q.size, q.clues.filter((__, j) => j !== k)).solved).toBe(false));
  });

  it("converse of «all» is an option", () => {
    const q = byFor(1);
    if (q.type !== "venn") throw new Error("expected a venn question");
    expect(q.tags).toContain("converse");
  });

  it("«some» read as «only some» is an option", () => {
    const q = byFor(2);
    if (q.type !== "venn") throw new Error("expected a venn question");
    expect(q.tags).toContain("someNotAll");
  });

  it("liars: believing the liar is a named slip, and show me reaches a contradiction", () => {
    const q = byFor(3);
    if (q.type !== "liars") throw new Error("expected a liars question");
    const liar = q.answer.findIndex((l, p) => l && q.says[p] !== null);
    expect(liar).toBeGreaterThanOrEqual(0);
    expect(liarsMistake(q, q.answer.map((l) => !l)).tag).toBe("trustedLiar");
    expect(liarSteps(q).some((s) => s.kind === "clash")).toBe(true);
  });

  it("Venn counts: adding without the overlap traps", () => {
    const q = byFor(4);
    if (q.type !== "vennNum") throw new Error("expected a vennNum question");
    countTrap(q, "addedNoOverlap");
  });

  it("Venn counts: a circle's total read as «only» traps", () => {
    const q = byFor(5);
    if (q.type !== "vennNum") throw new Error("expected a vennNum question");
    countTrap(q, "totalAsOnly");
  });

  it("Venn counts: asked for the outside, the inside traps", () => {
    const q = byFor(6);
    if (q.type !== "vennNum") throw new Error("expected a vennNum question");
    countTrap(q, "insideNotOutside");
  });

  it("if-then: affirming the consequent is an option", () => {
    const q = byFor(7);
    if (q.type !== "ifThen") throw new Error("expected an ifThen question");
    expect(q.tags).toContain("affirmConsequent");
  });

  it("if-then: denying the antecedent is an option", () => {
    const q = byFor(8);
    if (q.type !== "ifThen") throw new Error("expected an ifThen question");
    expect(q.tags).toContain("denyAntecedent");
  });

  it("if-then chains: an arrow read backwards is an option", () => {
    const q = byFor(9);
    if (q.type !== "ifThen") throw new Error("expected an ifThen question");
    expect(q.rules.length).toBeGreaterThanOrEqual(2);
    expect(q.tags).toContain("reversedChain");
  });
});
