import { describe, expect, it } from "vitest";
import { answerKey, digitsMistake, makeDigitsQuestion, type DigitsQuestionType, type Level } from "@/generators/digits";
import { isMoreType } from "@/generators/digits-more";
import { DIGITS_TYPE_LABEL } from "./DigitsTryPanel";
import { DIGITS_GUIDE } from "./guide";
import { pickedFor } from "@/toolkit/TeacherGuide";

// The hand-picked scenes of the teacher guide, rebuilt the way DigitsTool reads its link.
const examples = DIGITS_GUIDE.examples ?? [];

function tryQuestion(hash: string) {
  const p = new URLSearchParams(hash);
  return makeDigitsQuestion(p.get("try") as DigitsQuestionType, Number(p.get("level")) as Level, Number(p.get("seed")));
}

describe("digits: hand-picked examples", () => {
  it("every try link names a real type, level and seed and builds", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("try="))) {
      const p = new URLSearchParams(ex.hash);
      expect(Object.keys(DIGITS_TYPE_LABEL)).toContain(p.get("try"));
      expect([1, 2, 3]).toContain(Number(p.get("level")));
      expect(tryQuestion(ex.hash)).toBeTruthy();
    }
  });

  it("show and explore links parse", () => {
    for (const ex of examples.filter((e) => !e.hash.startsWith("try="))) {
      const p = new URLSearchParams(ex.hash);
      const [kind, ...rest] = (p.get("show") ?? p.get("explore"))!.split("-");
      if (kind === "sieve") expect(rest.map(Number)).toEqual([3, 91]);
      else {
        // A worked solution of a "more" type: level and seed, the same generator as try.
        expect(isMoreType(kind)).toBe(true);
        expect(makeDigitsQuestion(kind as DigitsQuestionType, Number(rest[0]) as Level, Number(rest[1]))).toBeTruthy();
      }
    }
  });

  it("each misconception scene holds its trap", () => {
    const cases: [string, number, string, string][] = [
      // [link, misconception, wrong answer as typed, its tag]
      ["try=extreme&level=2&seed=4", 0, "0147", "leadingZero"],
      ["try=count&level=1&seed=1", 1, "19", "numbersOnly"],
      ["try=condition&level=2&seed=1", 2, "7542", "noCondition"],
      ["try=divisible&level=2&seed=3", 3, "4", "only3"],
      ["try=lcm&level=3&seed=2", 4, "36", "forgotStart"],
      ["try=lcm&level=3&seed=2", 4, "936", "product"],
      ["try=crypt&level=2&seed=4", 5, "26", "noCarry"],
      ["try=signs&level=1&seed=30", 6, "13", "leftToRight"],
      ["try=units&level=2&seed=2", 8, "2", "cyclePos"],
      ["try=units&level=2&seed=2", 8, "4", "multipliedExp"],
      ["try=prime&level=2&seed=7", 10, "10", "rootTwice"],
      ["try=parity&level=3&seed=8", 11, "1", "handshakeOdd"],
    ];
    for (const [hash, i, value, tag] of cases) {
      expect(examples.find((e) => pickedFor(e).includes(i))?.hash).toBe(hash);
      expect(digitsMistake(tryQuestion(hash), value), `${hash} ${value}`).toBe(tag);
    }
    // 7 and 9 are show / explore scenes: pages 1 … 25 (41 digits) and 91 = 7 × 13 in the sieve.
    expect(examples.find((e) => e.for === 7)?.hash).toBe("show=pages-1-10");
    expect(answerKey(makeDigitsQuestion("pages", 1, 10))).toBe("41");
    expect(examples.find((e) => e.for === 9)?.hash).toBe("explore=sieve-3-91");
  });

  it("the answers the notes quote", () => {
    const answers: [string, string][] = [
      ["try=extreme&level=2&seed=4", "1047"],
      ["try=count&level=1&seed=1", "20"],
      ["try=condition&level=2&seed=1", "7524"],
      ["try=divisible&level=2&seed=3", "1"],
      ["try=prime&level=2&seed=7", "9"],
      ["try=units&level=2&seed=2", "6"],
      ["try=lcm&level=3&seed=2", "636"],
      ["try=crypt&level=2&seed=4", "16"],
      ["try=signs&level=1&seed=30", "31"],
    ];
    for (const [hash, a] of answers) expect(answerKey(tryQuestion(hash)), hash).toBe(a);
  });
});
