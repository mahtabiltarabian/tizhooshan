import { describe, expect, it } from "vitest";
import { ALPHABET } from "./codes";
import { answerKindOf, binaryMistake, binaryString, BINARY_WORDS, greedySteps, makeBinaryQuestion, wordMistake, type BinaryKind, type BinaryQuestion, type Level } from "./binary-code";

const LEVELS: Level[] = [1, 2, 3];
const SEEDS = 10_000;

/** A row's value from its 0/1 string, read left to right (independent of the masks). */
const fromString = (s: string) => [...s].reduce((v, d) => v * 2 + Number(d), 0);

/** Every row of `cards` cards, by brute force. */
const allRows = (cards: number) => Array.from({ length: 2 ** cards }, (_, m) => m);

/** The answer worked out again from the question alone, by brute force. */
function solve(q: BinaryQuestion): number | number[] {
  switch (q.kind) {
    case "read":
      return fromString(binaryString(q.n));
    case "show": {
      const rows = allRows(5).filter((m) => fromString(binaryString(m)) === q.n);
      expect(rows).toHaveLength(1);
      return rows[0];
    }
    case "next": {
      const rows = allRows(5).filter((m) => fromString(binaryString(m)) === q.n + 1);
      expect(rows).toHaveLength(1);
      return rows[0];
    }
    case "howMany": {
      // Fewest cards such that every number 1 … N has a row.
      for (let k = 1; ; k++) {
        const shown = new Set(allRows(k).map((m) => fromString(binaryString(m, k))));
        if (Array.from({ length: q.n }, (_, i) => i + 1).every((x) => shown.has(x))) return k;
      }
    }
    case "largest":
      return Math.max(...allRows(q.n).map((m) => fromString(binaryString(m, q.n))));
    case "word":
      return q.word.map((l) => fromString(binaryString(l + 1)) - 1);
  }
}

describe("binary code questions", () => {
  it("cards are 16 8 4 2 1 and greedy builds every number 0 … 31", () => {
    expect(greedySteps(13).map((s) => s.value)).toEqual([16, 8, 4, 2, 1]);
    for (let n = 0; n <= 31; n++) {
      const steps = greedySteps(n);
      expect(steps.filter((s) => s.on).reduce((t, s) => t + s.value, 0)).toBe(n);
      expect(steps[steps.length - 1].after).toBe(0);
    }
    expect(binaryString(13)).toBe("01101");
  });

  it("words avoid ی and every letter fits five cards", () => {
    expect(BINARY_WORDS.length).toBeGreaterThan(40);
    for (const w of BINARY_WORDS) expect(w.includes("ی")).toBe(false);
  });

  it("10,000 seeds per level: valid, unique answer, slips distinct and recognised", () => {
    const kinds = new Set<BinaryKind>();
    for (const level of LEVELS)
      for (let seed = 0; seed < SEEDS; seed++) {
        const q = makeBinaryQuestion(level, seed);
        kinds.add(q.kind);
        expect(q).toEqual(makeBinaryQuestion(level, seed));
        if (level === 1) expect(q.kind).toBe("read");
        if (level === 2) expect(["show", "howMany"]).toContain(q.kind);
        if (level === 3) expect(["word", "next", "largest"]).toContain(q.kind);
        const kind = answerKindOf(q.kind);
        const solved = solve(q);

        if (kind === "letters") {
          expect(q.word.length).toBeGreaterThanOrEqual(3);
          expect(q.word.every((l) => l >= 0 && l < ALPHABET.length - 1)).toBe(true);
          expect(solved).toEqual(q.word);
          expect(wordMistake(q, q.word)).toBe("right");
          const seen = new Set<string>();
          for (const [tag, read] of q.letterSlips) {
            expect(read).not.toEqual(q.word);
            expect(read.every((l) => l >= 0 && l < ALPHABET.length)).toBe(true);
            expect(seen.has(read.join("."))).toBe(false);
            seen.add(read.join("."));
            expect(wordMistake(q, read)).toBe(tag);
          }
          continue;
        }

        expect(q.answer).toBe(solved);
        expect(binaryMistake(q, q.answer)).toBe("right");
        const values = q.slips.map(([, v]) => v);
        expect(new Set(values).size).toBe(values.length);
        for (const [tag, v] of q.slips) {
          expect(v).not.toBe(q.answer);
          expect(binaryMistake(q, v)).toBe(tag);
        }
        if (q.kind === "read") {
          expect(q.n).toBeGreaterThanOrEqual(5);
          expect(q.n).toBeLessThanOrEqual(31);
          expect(q.slips.map(([t]) => t)).toEqual(expect.arrayContaining(["rtl", "positions", "pow10"]));
          expect(q.slips.every(([, v]) => v <= 99999)).toBe(true);
        }
        if (kind === "lamps") {
          expect(q.answer).toBeGreaterThan(0);
          expect(q.answer).toBeLessThanOrEqual(31);
          // Exactly one row of five cards is right.
          expect(allRows(5).filter((m) => binaryMistake(q, m) === "right")).toEqual([q.answer]);
          expect(q.slips.some(([t]) => t === "rtl")).toBe(true);
        }
        if (q.kind === "next") expect(q.slips.some(([t]) => t === "noCarry")).toBe(true);
        if (q.kind === "largest") {
          expect(q.slips.find(([t]) => t === "pow2")?.[1]).toBe(q.answer + 1);
          expect(q.cards).toBe(q.n);
        }
        if (q.kind === "howMany" && (q.n & (q.n - 1)) === 0) expect(q.slips.find(([t]) => t === "pow2")?.[1]).toBe(q.answer - 1);
      }
    expect([...kinds].sort()).toEqual(["howMany", "largest", "next", "read", "show", "word"]);
  }, 240_000);

  it("names the slips on known examples", () => {
    // Find a read question showing 13 (01101) is not needed: build by hand from a generated one.
    const q = makeBinaryQuestion(1, 1);
    const n = q.n;
    const rev = fromString([...binaryString(n)].reverse().join(""));
    expect(binaryMistake(q, rev)).toBe("rtl");
    expect(binaryMistake(q, Number(binaryString(n)))).toBe("pow10");
    expect(binaryMistake(q, 999_999)).toBe("other");

    for (let seed = 0; seed < 200; seed++) {
      const s = makeBinaryQuestion(2, seed);
      if (s.kind !== "show") continue;
      // Cards whose positions (from the right: ۱ … ۵) add up to the number.
      const byPosition = allRows(5).filter((m) => m !== s.n && [...binaryString(m)].reverse().reduce((t, d, i) => t + (d === "1" ? i + 1 : 0), 0) === s.n);
      for (const m of byPosition) expect(["positions", "rtl"]).toContain(binaryMistake(s, m));
    }

    for (let seed = 0; seed < 200; seed++) {
      const w = makeBinaryQuestion(3, seed);
      if (w.kind !== "word") continue;
      // One letter misread, the rest right: still that slip.
      for (const [tag, read] of w.letterSlips) {
        const i = read.findIndex((l, k) => l !== w.word[k]);
        const mixed = w.word.map((l, k) => (k === i ? read[k] : l));
        const first = w.letterSlips.find(([, r]) => mixed.every((v, k) => v === w.word[k] || v === r[k]))![0];
        expect(wordMistake(w, mixed)).toBe(first);
        expect(first === tag || w.letterSlips.findIndex(([t]) => t === first) < w.letterSlips.findIndex(([t]) => t === tag)).toBe(true);
      }
      expect(
        wordMistake(
          w,
          w.word.map(() => null),
        ),
      ).toBe("other");
    }
  });
});
