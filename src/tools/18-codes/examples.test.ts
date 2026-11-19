import { describe, expect, it } from "vitest";
import { binaryMistake, makeBinaryQuestion, MAX, type BinaryQuestion } from "@/generators/binary-code";
import { ALPHABET, CODE_TYPES, codeMistake, makeCodeQuestion, slips, type CodeQuestion, type CodeQuestionType, type Level } from "@/generators/codes";
import { CODES_GUIDE } from "./guide";

// The hand-picked scenes in the teacher guide, rebuilt the way CodesTool's hash
// reader builds them (#try=type&level&seed&len&ex, #try=binary&level&seed,
// #show=… / #explore=… with n and w).
const RULE_KINDS = ["shift", "mirror", "number", "shape", "sub", "binary"];
const examples = CODES_GUIDE.examples ?? [];

const level = (p: URLSearchParams): Level => {
  const lv = Number(p.get("level"));
  return lv === 2 || lv === 3 ? lv : 1;
};
const buildCode = (hash: string): CodeQuestion => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as CodeQuestionType;
  expect(CODE_TYPES).toContain(type);
  const ln = Number(p.get("len"));
  return makeCodeQuestion(type, level(p), Number(p.get("seed")), { length: ln >= 3 && ln <= 6 ? ln : 0, examples: p.get("ex") === "3" ? 3 : 2 });
};
const buildBinary = (hash: string): BinaryQuestion => {
  const p = new URLSearchParams(hash);
  expect(p.get("try")).toBe("binary");
  return makeBinaryQuestion(level(p), Number(p.get("seed")));
};
const hashFor = (i: number) => examples.find((ex) => ex.for === i)!.hash;
/** The slip is offered and writing it gets that slip's feedback. */
const trap = (q: CodeQuestion, tag: string) => {
  const hit = slips(q).find(([t]) => t === tag);
  expect(hit, tag).toBeDefined();
  expect(codeMistake(q, hit![1])).toBe(tag);
};
const binTrap = (q: BinaryQuestion, tag: string) => {
  const hit = q.slips.find(([t]) => t === tag);
  expect(hit, tag).toBeDefined();
  expect(binaryMistake(q, hit![1])).toBe(tag);
};

describe("codes guide examples", () => {
  it("every link opens a real scene", () => {
    for (const ex of examples) {
      const p = new URLSearchParams(ex.hash);
      if (p.get("try") === "binary") expect(() => buildBinary(ex.hash)).not.toThrow();
      else if (p.has("try")) expect(() => buildCode(ex.hash)).not.toThrow();
      else {
        const kind = p.get("show") ?? p.get("explore");
        expect(RULE_KINDS).toContain(kind);
        const w = p.get("w");
        if (w) expect([...w].every((ch) => ch === " " || ALPHABET.includes(ch))).toBe(true);
        if (kind === "binary") expect(Number(p.get("n"))).toBeLessThanOrEqual(MAX);
      }
    }
  });

  it("Arabic alphabet: the word has letters after پ چ ژ گ, so the 28-letter count is a slip", () => {
    const q = buildCode(hashFor(0));
    expect(q.show).toBe("key");
    trap(q, "arabic");
  });

  it("direction and counting: a decode where the wrong way and off by one are both slips", () => {
    const q = buildCode(hashFor(1));
    expect(q.dir).toBe("decode");
    trap(q, "wrongWay");
    trap(q, "offByOne");
  });

  it("wrap: a letter goes past ی", () => {
    const q = buildCode(hashFor(2));
    trap(q, "wrap");
  });

  it("rule from examples: two examples, and writing the answer reversed is a slip", () => {
    const q = buildCode(hashFor(3));
    expect(q.show).toBe("examples");
    expect(q.examples).toHaveLength(2);
    trap(q, "reversed");
  });

  it("binary reading: right-to-left and card positions are both slips", () => {
    const q = buildBinary(hashFor(4));
    expect(q.kind).toBe("read");
    binTrap(q, "rtl");
    binTrap(q, "positions");
  });

  it("binary size: five lamps, where 32 and 99999 are slips", () => {
    const q = buildBinary(hashFor(5));
    expect(q.kind).toBe("largest");
    expect(q.cards).toBe(5);
    binTrap(q, "pow2");
    binTrap(q, "pow10");
  });
});
