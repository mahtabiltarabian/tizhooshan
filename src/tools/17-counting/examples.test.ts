import { describe, expect, it } from "vitest";
import { countingMistake, makeCountingQuestion, slips, type CountingQuestion, type CountingQuestionType, type Level } from "@/generators/counting";
import { COUNTING_GUIDE } from "./guide";
import { COUNTING_TYPE_LABEL } from "./text";

// The hand-picked scenes in the teacher guide, rebuilt the way CountingTool's
// hash reader builds them (#try=type&level&seed, #show=type&level&seed, #explore=row|group|grid).
const TYPES = Object.keys(COUNTING_TYPE_LABEL) as CountingQuestionType[];
const examples = COUNTING_GUIDE.examples ?? [];

const build = (hash: string, key = "try"): CountingQuestion => {
  const p = new URLSearchParams(hash);
  const type = p.get(key) as CountingQuestionType;
  expect(TYPES).toContain(type);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makeCountingQuestion(type, level, Number(p.get("seed")));
};
const byFor = (i: number) => build(examples.find((ex) => ex.for === i)!.hash);
/** The slip is offered and typing its value gets that slip's feedback. */
const trap = (q: CountingQuestion, tag: string) => {
  const hit = slips(q).find(([t]) => t === tag);
  expect(hit, tag).toBeDefined();
  expect(countingMistake(q, hit![1])).toBe(tag);
};

describe("counting guide examples", () => {
  it("every link opens a real scene", () => {
    for (const ex of examples) {
      const p = new URLSearchParams(ex.hash);
      if (p.has("try")) expect(() => build(ex.hash)).not.toThrow();
      else if (p.has("show")) expect(() => build(ex.hash, "show")).not.toThrow();
      else expect(["row", "group", "grid"]).toContain(p.get("explore"));
    }
  });

  it("ordered or not: a group where counting orders is a named slip", () => {
    const q = byFor(0);
    expect(q.type).toBe("choose");
    trap(q, "ordered");
  });

  it("handshakes: double counting and shaking your own hand both trap", () => {
    const q = byFor(1);
    if (q.type !== "handshake") throw new Error("expected a handshake question");
    expect(q.variant).toBe("plain");
    trap(q, "doubleCounted");
    trap(q, "square");
  });

  it("add or multiply: one of each group, where adding is a named slip", () => {
    const q = byFor(2);
    if (q.type !== "tree") throw new Error("expected a tree question");
    expect(q.variant).toBe("product");
    trap(q, "added");
    // The guide also offers the "either" scene, where adding is right.
    const either = build("try=tree&level=1&seed=1");
    if (either.type !== "tree") throw new Error("expected a tree question");
    expect(either.variant).toBe("either");
    trap(either, "multiplied");
  });

  it("pigeonhole: the lucky case and the worst case without one more both trap", () => {
    const q = byFor(3);
    expect(q.type).toBe("pigeonhole");
    trap(q, "lucky");
    trap(q, "offByOne");
  });
});
