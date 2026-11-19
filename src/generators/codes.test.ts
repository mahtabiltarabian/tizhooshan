import { describe, expect, it } from "vitest";
import {
  ALPHABET,
  answerKind,
  arabicStep,
  CODE_TYPES,
  codeMistake,
  decode,
  encode,
  fits,
  LETTER_FAMILY,
  makeCodeQuestion,
  N,
  NUMBER_FAMILY,
  PHRASES,
  signedShift,
  slips,
  slotMarks,
  SPACE,
  textOf,
  toLetters,
  WORDS,
  type CodeQuestion,
  type Level,
  type Rule,
} from "./codes";
import { ALPHABET as SEQUENCE_ALPHABET } from "./sequence";

const LEVELS: Level[] = [1, 2, 3];
const L = (s: string) => toLetters(s);

describe("alphabet and words", () => {
  it("uses the same 32 letters as tool 9", () => {
    expect(ALPHABET).toEqual(SEQUENCE_ALPHABET);
    expect(new Set(ALPHABET).size).toBe(32);
  });

  it("has only alphabet letters in its words and sentences", () => {
    for (const w of WORDS) {
      const xs = L(w);
      expect(xs.every((x) => x >= 0 && x < N)).toBe(true);
      expect(xs.length >= 3 && xs.length <= 6).toBe(true);
    }
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const p of PHRASES) {
      const xs = L(p);
      expect(xs.every((x) => x === SPACE || (x >= 0 && x < N))).toBe(true);
      expect(xs.filter((x) => x !== SPACE).length).toBeLessThanOrEqual(12);
    }
    for (let len = 3; len <= 6; len++) expect(WORDS.filter((w) => L(w).length === len).length).toBeGreaterThanOrEqual(10);
  });
});

describe("ciphers", () => {
  it("shifts letters round the end of the alphabet", () => {
    expect(textOf(encode({ kind: "shift", n: 1 }, L("باد")))).toBe("پبذ");
    expect(textOf(encode({ kind: "shift", n: 3 }, L("ماهی")))).toBe("هتبپ");
    expect(textOf(encode({ kind: "shift", n: -2 }, L("ابر")))).toBe("هید");
    expect(textOf(decode({ kind: "shift", n: 3 }, L("هتبپ")))).toBe("ماهی");
    expect(signedShift(29)).toBe(-3);
    expect(signedShift(-2)).toBe(-2);
  });

  it("turns the alphabet round in the mirror code", () => {
    expect(textOf(encode({ kind: "mirror", n: 0 }, L("ابپ")))).toBe("یهو");
    // The mirror with no shift is its own key.
    for (let i = 0; i < N; i++) expect(encode({ kind: "mirror", n: 0 }, encode({ kind: "mirror", n: 0 }, [i]) as number[])[0]).toBe(i);
  });

  it("numbers letters from either end", () => {
    expect(encode({ kind: "number", start: 1, step: 1, rev: false }, L("باد"))).toEqual([2, 1, 10]);
    expect(encode({ kind: "number", start: 1, step: 1, rev: true }, L("ی"))).toEqual([1]);
    expect(encode({ kind: "number", start: 5, step: 2, rev: false }, L("ب"))).toEqual([7]);
  });

  it("is one-to-one for every family rule", () => {
    for (const r of [...LETTER_FAMILY, ...NUMBER_FAMILY]) {
      const all = encode(r, Array.from({ length: N }, (_, i) => i));
      expect(new Set(all).size).toBe(N);
      expect(decode(r, all as number[])).toEqual(Array.from({ length: N }, (_, i) => i));
    }
  });

  it("steps over پ چ ژ گ in the Arabic-alphabet slip", () => {
    expect(arabicStep(1, 1)).toBe(3); // ب → ت, not پ
    expect(arabicStep(5, 2)).toBe(8); // ج → ح → خ
    expect(arabicStep(3, -1)).toBe(1); // ت → ب
    expect(arabicStep(31, 1)).toBe(0); // ی → ا
  });
});

/** Is every slip that is not the answer recognised as that slip (or an earlier one)? */
function checkSlips(q: CodeQuestion) {
  for (const [, v] of slips(q)) {
    const tag = codeMistake(q, v);
    if (tag !== "right") expect(tag).not.toBe("other");
  }
}

describe("code questions", () => {
  it("is the same for the same seed, with or without the default options", () => {
    for (const t of CODE_TYPES)
      for (const l of LEVELS) {
        expect(makeCodeQuestion(t, l, 42)).toEqual(makeCodeQuestion(t, l, 42));
        expect(makeCodeQuestion(t, l, 42, { length: 0, examples: 2 })).toEqual(makeCodeQuestion(t, l, 42));
      }
  });

  it("gives a sound question for 10,000 seeds of every type and level", () => {
    for (const type of CODE_TYPES)
      for (const level of LEVELS)
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makeCodeQuestion(type, level, seed);
          if (q.type !== type || q.level !== level) throw new Error(`wrong type ${type} ${level} ${seed}`);
          const fail = (why: string) => {
            throw new Error(`${type} level ${level} seed ${seed}: ${why}`);
          };

          // The answer is the rule applied to the given text, and only that.
          if (codeMistake(q, q.answer) !== "right") fail("answer not right");
          if (q.answer.length !== q.given.length) fail("lengths differ");
          const coded = encode(q.rule, q.plain);
          if (coded.some((t) => t === null)) fail("a letter has no code");
          if (coded.join() !== q.coded.join()) fail("code is not the rule");
          if (decode(q.rule, q.coded).join() !== q.plain.join()) fail("code does not decode");
          if (q.dir === "encode" ? q.given !== q.plain : q.given !== q.coded) fail("given is not the right side");
          for (let i = 0; i < q.given.length; i++) if ((q.given[i] === SPACE) !== (q.answer[i] === SPACE)) fail("spaces move");
          if (answerKind(q) === "number" && q.answer.some((t) => t < 0 || t > 99)) fail("number does not fit two digits");
          if (q.plain.filter((x) => x !== SPACE).length < 3) fail("too short");

          // Each letter has its own code, so the answer is unique.
          if (q.rule.kind === "shape") {
            const shapes = q.rule.key.map(([, s]) => s);
            const letters = q.rule.key.map(([l]) => l);
            if (new Set(shapes).size !== shapes.length || new Set(letters).size !== letters.length) fail("shape table not one-to-one");
          }

          if (level === 1) {
            if (q.show !== "key") fail("level 1 shows a key");
            for (const x of q.plain) if (x !== SPACE && !q.key.includes(x)) fail("key misses a letter");
          }
          if (level === 2 && type !== "shape") {
            if (q.show !== "words") fail("level 2 says the rule");
            if (q.rule.kind === "shift" && (q.rule.n === 0 || Math.abs(q.rule.n) > 6)) fail("level 2 shift out of range");
          }
          if (level === 2 && type === "shape" && (q.key.length !== 10 || q.dir !== "decode")) fail("level 2 shape: 10-letter key, decode");
          if (level === 3) {
            if (q.show !== "examples" || q.examples.length !== 2) fail("level 3 has two examples");
            for (const e of q.examples) if (e.plain.join() === q.plain.join()) fail("question is an example");
            if (q.rule.kind === "shape") {
              // The examples hold every letter (and shape) of the question.
              const seen = new Set(q.examples.flatMap((e) => e.plain));
              for (const x of q.plain) if (!seen.has(x)) fail("letter not in the examples");
              for (const e of q.examples) if (encode(q.rule, e.plain).join() !== e.coded.join()) fail("example wrong");
            } else {
              // Exactly one rule of the family fits both examples.
              const family: Rule[] = q.rule.kind === "number" ? NUMBER_FAMILY : LETTER_FAMILY;
              const fitting = family.filter((r) => fits(r, q.examples));
              if (fitting.length !== 1) fail(`${fitting.length} rules fit`);
              if (encode(fitting[0], q.plain).join() !== q.coded.join()) fail("the fitting rule is not the rule");
            }
          }

          for (const [, v] of slips(q)) {
            const tag = codeMistake(q, v);
            if (tag !== "right" && tag === "other") fail("slip not named");
          }
          if (codeMistake(q, q.answer.map((x) => (x === SPACE ? SPACE : x + 100))) === "right") fail("wrong answer accepted");
        }
  }, 240_000);

  it("honours word length and number of examples", () => {
    for (const type of ["shift", "number", "shape"] as const)
      for (const length of [3, 4, 5, 6])
        for (let seed = 0; seed < 300; seed++) {
          const q = makeCodeQuestion(type, 2, seed, { length });
          expect(q.plain.length).toBe(length);
        }
    for (const type of CODE_TYPES)
      for (let seed = 0; seed < 500; seed++) {
        const q = makeCodeQuestion(type, 3, seed, { examples: 3 });
        if (type !== "shape") expect(q.examples.length).toBe(3);
        if (q.rule.kind !== "shape") expect((q.rule.kind === "number" ? NUMBER_FAMILY : LETTER_FAMILY).filter((r) => fits(r, q.examples)).length).toBe(1);
        checkSlips(q);
      }
  }, 60_000);
});

describe("slips", () => {
  const base = (rule: Rule, dir: "encode" | "decode", word: string): CodeQuestion => {
    const plain = L(word);
    const coded = encode(rule, plain) as number[];
    return { type: "shift", level: 2, seed: 0, rule, dir, plain, coded, given: dir === "encode" ? plain : coded, answer: dir === "encode" ? coded : plain, show: "words", key: [], examples: [] };
  };

  it("names shift slips", () => {
    // باغ with 2 on is تپق.
    const q = base({ kind: "shift", n: 2 }, "encode", "باغ");
    expect(textOf(q.answer)).toBe("تپق");
    expect(codeMistake(q, L("تپق"))).toBe("right");
    expect(codeMistake(q, encode({ kind: "shift", n: -2 }, L("باغ")))).toBe("wrongWay");
    expect(codeMistake(q, encode({ kind: "shift", n: 3 }, L("باغ")))).toBe("offByOne");
    expect(codeMistake(q, encode({ kind: "shift", n: 1 }, L("باغ")))).toBe("offByOne");
    // Skipping پ: ب → ت → ث, ا → ب → ت.
    expect(codeMistake(q, L("ثتق"))).toBe("arabic");
    // Only the first letter coded.
    expect(codeMistake(q, L("تاغ"))).toBe("partial");
    expect(codeMistake(q, [...L("تپق")].reverse())).toBe("reversed");
  });

  it("names a slip at the end of the alphabet", () => {
    // ماهی with 3 on: ه → ی → ا → ب and ی → ا → ب → پ go round the end.
    const q = base({ kind: "shift", n: 3 }, "encode", "ماهی");
    expect(textOf(q.answer)).toBe("هتبپ");
    expect(codeMistake(q, L("هتیی"))).toBe("wrap"); // stopped at ی
    expect(codeMistake(q, L("هتاب"))).toBe("wrap"); // one short round the end
  });

  it("names a decode slip the wrong way", () => {
    const q = base({ kind: "shift", n: 3 }, "decode", "کتاب");
    expect(codeMistake(q, encode({ kind: "shift", n: 3 }, q.coded))).toBe("wrongWay");
  });

  it("names number slips", () => {
    const q = { ...base({ kind: "number", start: 1, step: 1, rev: false }, "encode", "گل"), type: "number" as const };
    expect(q.answer).toEqual([26, 27]);
    expect(codeMistake(q, [25, 26])).toBe("offByOne"); // ا = ۰
    expect(codeMistake(q, [27, 26])).toBe("reversed");
    // Arabic places: ل is 23rd, گ keeps its own.
    expect(codeMistake(q, [26, 23])).toBe("arabic");
    const rev = { ...q, rule: { kind: "number", start: 1, step: 1, rev: true } as Rule };
    const r2 = { ...rev, coded: encode(rev.rule, rev.plain) as number[] };
    const r3 = { ...r2, answer: r2.coded };
    expect(codeMistake(r3, [26, 27])).toBe("wrongWay");
  });

  it("marks each slot", () => {
    const q = base({ kind: "shift", n: 1 }, "encode", "باد");
    expect(slotMarks(q, L("پبی"))).toEqual([true, true, false]);
  });

  it("names a rule that fits only one example", () => {
    // ب → ت fits «2 on» and «mirror, 5 on»; the second example rules the mirror out.
    const rule: Rule = { kind: "shift", n: 2 };
    const examples = [L("ب"), L("سیب")].map((p) => ({ plain: p, coded: encode(rule, p) as number[] }));
    const q: CodeQuestion = { ...base(rule, "encode", "کتاب"), level: 3, show: "examples", examples };
    expect(fits({ kind: "mirror", n: 5 }, examples.slice(0, 1))).toBe(true);
    expect(codeMistake(q, encode({ kind: "mirror", n: 5 }, q.plain) as number[])).toBe("oneExample");
  });
});
