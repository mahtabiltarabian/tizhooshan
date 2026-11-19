import { describe, expect, it } from "vitest";
import { answerKey, answerKind, digitsMistake, makeDigitsQuestion, slips, type DigitsQuestion, type Level } from "./digits";
import {
  clockKey,
  clockMinutes,
  cryptPatternCount,
  cryptPool,
  LETTER,
  MORE_TYPES,
  pageDigits,
  powerUnit,
  rangeCount,
  signsValue,
  unitCycle,
  type CryptQuestion,
  type LcmQuestion,
  type MoreQuestion,
  type PagesQuestion,
  type SignsQuestion,
  type UnitsQuestion,
} from "./digits-more";

const LEVELS: Level[] = [1, 2, 3];
const TEN = BigInt(10);
const SEEDS = 10_000;

// Independent checks: plain loops and writing things out, not the generator's shortcuts.

function bruteLcm(xs: number[]) {
  for (let m = 1; ; m++) if (xs.every((x) => m % x === 0)) return m;
}
function bruteGcd(xs: number[]) {
  for (let d = Math.min(...xs); d >= 1; d--) if (xs.every((x) => x % d === 0)) return d;
  return 1;
}

/** Every assignment of digits to the letters (by counting 0 … 10^k − 1) that makes the sum true. */
function bruteCrypt(q: CryptQuestion) {
  const k = q.letters.length;
  const out: string[] = [];
  for (let n = 0; n < 10 ** k; n++) {
    const vals = String(n).padStart(k, "0").split("").map(Number);
    if (new Set(vals).size < k) continue;
    const word = (r: number[]) => r.map((c) => (c >= LETTER ? vals[c - LETTER] : c)).join("");
    const [t, b, s] = [word(q.top), word(q.bottom), word(q.sum)];
    if ([t, b, s].some((w) => w.length > 1 && w[0] === "0")) continue;
    if (Number(t) + Number(b) === Number(s)) out.push(vals.join(""));
  }
  return out;
}

/** The expression written out with JavaScript signs, brackets included. */
function exprOf(nums: number[], ops: number[], paren: [number, number] | null) {
  const sign = ["+", "-", "*", "/"];
  return nums.map((n, i) => `${paren?.[0] === i ? "(" : ""}${n}${paren?.[1] === i ? ")" : ""}${i < ops.length ? sign[ops[i]] : ""}`).join("");
}
/** A written expression's value: a small parser for numbers, + - * / and brackets. */
function evaluate(e: string): number {
  let i = 0;
  const atom = (): number => {
    if (e[i] === "(") {
      i++;
      const v = sum();
      i++;
      return v;
    }
    let j = i;
    while (j < e.length && /\d/.test(e[j])) j++;
    const v = Number(e.slice(i, j));
    i = j;
    return v;
  };
  const term = (): number => {
    let v = atom();
    while (e[i] === "*" || e[i] === "/") v = e[i++] === "*" ? v * atom() : v / atom();
    return v;
  };
  const sum = (): number => {
    let v = term();
    while (e[i] === "+" || e[i] === "-") v = e[i++] === "+" ? v + term() : v - term();
    return v;
  };
  return sum();
}

/** Every choice of k signs, counted in base 4. */
const choices = (k: number) => Array.from({ length: 4 ** k }, (_, n) => Array.from({ length: k }, (_, i) => Math.floor(n / 4 ** i) % 4));

const written = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i)).join("");
/** Length of "123…n" written out, for n up to 1200 (built once, page by page). */
const WRITTEN_LEN: number[] = [0];
for (let n = 1, s = ""; n <= 1200; n++) WRITTEN_LEN.push((s += String(n)).length);

function check(q: MoreQuestion) {
  switch (q.type) {
    case "lcm": {
      const L = bruteLcm(q.nums);
      const G = bruteGcd(q.nums);
      // Two numbers share a factor, so the LCM is not their product; three numbers have an LCM below theirs.
      if (q.nums.length === 2) expect(G).toBeGreaterThan(1);
      else expect(L).toBeLessThan(q.nums[0] * q.nums[1] * q.nums[2]);
      // No number divides another, so the LCM is never one of the numbers.
      for (const x of q.nums) for (const y of q.nums) if (x !== y) expect(y % x).not.toBe(0);
      if (q.ask === "lcm") expect(q.answer).toBe(L);
      if (q.ask === "gcd") expect(q.answer).toBe(G);
      if (q.ask === "pieces") expect(q.answer).toBe(q.nums.reduce((s, x) => s + x / G, 0));
      if (q.ask === "clock") {
        const end = q.start + L;
        expect(end).toBeLessThan(12 * 60);
        expect(q.answer).toBe(Math.floor(end / 60) * 100 + (end % 60));
        expect(clockMinutes(q.answer)).toBe(end);
      }
      if (q.nums.length === 3) for (let i = 0; i < 3; i++) expect(bruteLcm(q.nums.filter((_, j) => j !== i))).not.toBe(L);
      expect(q.nums.length).toBe(q.level === 3 && q.ask === "lcm" ? 3 : 2);
      break;
    }
    case "crypt": {
      expect(q.letters.length).toBe(q.level);
      expect(new Set(q.letters).size).toBe(q.level);
      const sols = bruteCrypt(q);
      expect(sols).toEqual([q.solution.join("")]);
      // Every letter is in the puzzle; written digits are no letter's digit.
      const cells = [...q.top, ...q.bottom, ...q.sum];
      for (let i = 0; i < q.level; i++) expect(cells).toContain(LETTER + i);
      for (const c of cells) if (c < LETTER) expect(q.solution).not.toContain(c);
      for (const r of [q.top, q.bottom]) expect(r[0] >= LETTER ? q.solution[r[0] - LETTER] : r[0]).not.toBe(0);
      if (q.level === 3) {
        const d = (c: number) => (c >= LETTER ? q.solution[c - LETTER] : c);
        expect(d(q.top[1]) + d(q.bottom[1])).toBeGreaterThanOrEqual(10);
      }
      break;
    }
    case "signs": {
      expect(q.nums.length).toBe(q.level === 1 ? 3 : 4);
      expect(q.paren !== null).toBe(q.level === 3);
      const right = choices(q.ops.length).filter((o) => Math.abs(evaluate(exprOf(q.nums, o, q.paren)) - q.target) < 1e-9);
      expect(right).toEqual([q.ops]);
      if (q.paren) expect(Math.abs(evaluate(exprOf(q.nums, q.ops, null)) - q.target)).toBeGreaterThan(1e-9);
      expect(signsValue(q.nums, q.ops, q.paren)).toEqual([q.target, 1]);
      break;
    }
    case "pages": {
      if (q.ask === "digits") expect(q.answer).toBe(written(1, q.to).length);
      if (q.ask === "pages") {
        expect(q.digits).toBe(written(1, q.to).length);
        // One book has exactly that many digits.
        const fits: number[] = [];
        for (let n = 1; n <= 1200; n++) if (WRITTEN_LEN[n] === q.digits) fits.push(n);
        expect(fits).toEqual([q.answer]);
      }
      if (q.ask === "ones") expect(q.answer).toBe(written(q.from, q.to).split("1").length - 1);
      break;
    }
    case "units": {
      if (q.kind === "product") expect(q.answer).toBe(Number(q.factors.reduce((p, f) => p * BigInt(f), BigInt(1)) % TEN));
      else {
        const [u1, u2] = q.powers.map(([b, n]) => BigInt(b) ** BigInt(n));
        const v = q.kind === "power" ? u1 : q.kind === "sum" ? u1 + u2 : u1 * u2;
        expect(q.answer).toBe(Number(v % TEN));
      }
      break;
    }
  }
}

describe("more digit helpers", () => {
  it("counts page digits and digit 1 like writing them out", () => {
    for (let a = 1; a <= 120; a += 7) for (let b = a; b <= 1100; b += 37) expect(pageDigits(a, b)).toBe(written(a, b).length);
    expect(pageDigits(1, 100)).toBe(192);
    expect(rangeCount(1, 1, 100)).toBe(21);
  });

  it("knows the units cycles", () => {
    expect(unitCycle(2)).toEqual([2, 4, 8, 6]);
    expect(unitCycle(7)).toEqual([7, 9, 3, 1]);
    expect(unitCycle(9)).toEqual([9, 1]);
    expect(unitCycle(5)).toEqual([5]);
    for (let b = 2; b <= 30; b++) for (let n = 1; n <= 40; n++) expect(powerUnit(b, n)).toBe(Number(BigInt(b) ** BigInt(n) % TEN));
  });

  it("writes times as digits", () => {
    expect(clockKey(8 * 60 + 12)).toBe(812);
    expect(clockMinutes(812)).toBe(492);
    expect(clockMinutes(875)).toBeNull();
  });

  it("has enough cryptarithms of every pattern", () => {
    for (const l of LEVELS) for (let p = 0; p < cryptPatternCount(l); p++) expect(cryptPool(l, p).length).toBeGreaterThanOrEqual(8);
  });
});

describe("more digit questions", () => {
  it("is the same for the same seed", () => {
    for (const t of MORE_TYPES) for (const l of LEVELS) expect(makeDigitsQuestion(t, l, 42)).toEqual(makeDigitsQuestion(t, l, 42));
  });

  it("gives a sound question with one answer for 10,000 seeds of every type and level", () => {
    for (const type of MORE_TYPES)
      for (const level of LEVELS)
        for (let seed = 0; seed < SEEDS; seed++) {
          const q = makeDigitsQuestion(type, level, seed) as MoreQuestion;
          expect(q.type).toBe(type);
          expect(digitsMistake(q, answerKey(q))).toBe("right");
          expect(answerKey(q)).toMatch(/^\d+$/);
          for (const [, v] of slips(q)) if (String(v) !== answerKey(q)) expect(digitsMistake(q, String(v))).not.toMatch(/^(other|right)$/);
          check(q);
        }
  }, 240_000);

  it("uses each kind of answer", () => {
    expect(answerKind(makeDigitsQuestion("crypt", 1, 1))).toBe("letters");
    expect(answerKind(makeDigitsQuestion("signs", 1, 1))).toBe("ops");
    for (const t of ["lcm", "pages", "units"] as const) expect(answerKind(makeDigitsQuestion(t, 2, 1))).toBe("number");
  });

  it("names the usual slips", () => {
    const base = { level: 2, seed: 0 } as const;
    const buses: LcmQuestion = { ...base, type: "lcm", ask: "lcm", story: 0, nums: [12, 18], start: 0, answer: 36 };
    expect(digitsMistake(buses, "216")).toBe("product");
    expect(digitsMistake(buses, "6")).toBe("swapped");
    expect(digitsMistake(buses, "72")).toBe("notLeast");
    const ribbon: LcmQuestion = { ...buses, ask: "gcd", answer: 6 };
    expect(digitsMistake(ribbon, "36")).toBe("swapped");
    expect(digitsMistake(ribbon, "3")).toBe("notGreatest");
    const pieces: LcmQuestion = { ...buses, ask: "pieces", answer: 5 };
    expect(digitsMistake(pieces, "6")).toBe("pieceLength");
    expect(digitsMistake(pieces, "3")).toBe("oneRibbon");
    const clock: LcmQuestion = { ...buses, level: 3, ask: "clock", start: 7 * 60, answer: 736 };
    expect(digitsMistake(clock, "36")).toBe("forgotStart");
    expect(digitsMistake(clock, "1036")).toBe("product");
    expect(digitsMistake(clock, "706")).toBe("swapped");
    expect(digitsMistake(clock, "812")).toBe("notLeast");
    expect(digitsMistake(clock, "790")).toBe("badTime");
    const three: LcmQuestion = { ...buses, level: 3, nums: [4, 6, 10], answer: 60 };
    expect(digitsMistake(three, "12")).toBe("pairOnly");
    expect(digitsMistake(three, "240")).toBe("product");

    // الف ب + ب الف = پ الف پ: 29 + 92 = 121.
    const crypt: CryptQuestion = { ...base, level: 3, type: "crypt", letters: ["الف", "ب", "پ"], top: [10, 11], bottom: [11, 10], sum: [12, 10, 12], solution: [2, 9, 1] };
    expect(digitsMistake(crypt, "291")).toBe("right");
    expect(digitsMistake(crypt, "221")).toBe("repeatedDigit");
    expect(digitsMistake(crypt, "290")).toBe("leadingZero");
    // 38 + 83 = 121 has the ones right (8 + 3 = 11) but the tens say 3, not 2.
    expect(digitsMistake(crypt, "381")).toBe("column");
    // 34 + 43 = 77, but the ones of پ الف پ say 5.
    expect(digitsMistake(crypt, "345")).toBe("notSum");
    // الف ۷ + ب ۶ = ۹۳ with 37 + 56. With 4 and 5 every column is right if the carry is forgotten: 7 + 6 → 3, 4 + 5 = 9.
    const carry: CryptQuestion = { ...base, type: "crypt", letters: ["الف", "ب"], top: [10, 7], bottom: [11, 6], sum: [9, 3], solution: [3, 5] };
    expect(digitsMistake(carry, "45")).toBe("noCarry");
    expect(digitsMistake(carry, "35")).toBe("right");

    // ۲ ؟ ۳ ؟ ۴ = ۲۰: (2 + 3) × 4 left to right, but 2 + 3 × 4 = 14.
    const signs: SignsQuestion = { ...base, level: 1, type: "signs", nums: [2, 3, 4], paren: null, target: 20, ops: [2, 2] };
    expect(digitsMistake(signs, "13")).toBe("leftToRight");
    expect(digitsMistake(signs, "11")).toBe("wrongValue");
    // ۶ ؟ (۲ ؟ ۴) ؟ ۱ = ۱۵ with 6 + (2 × 4) + 1. × + − gives 15 only without the brackets (6 × 2 + 4 − 1); with them, 35.
    const paren: SignsQuestion = { ...base, level: 3, type: "signs", nums: [6, 2, 4, 1], paren: [1, 2], target: 15, ops: [0, 2, 0] };
    expect(digitsMistake(paren, "312")).toBe("ignoreParens");

    const pages1: PagesQuestion = { ...base, level: 1, type: "pages", ask: "digits", from: 1, to: 50, digits: 0, answer: 91 };
    expect(digitsMistake(pages1, "82")).toBe("noOnes");
    expect(digitsMistake(pages1, "50")).toBe("tensAsOne");
    expect(digitsMistake(pages1, "100")).toBe("allSame");
    expect(digitsMistake(pages1, "89")).toBe("offByOne");
    // 192 digits → 100 pages.
    const pages2: PagesQuestion = { ...base, type: "pages", ask: "pages", from: 1, to: 100, digits: 192, answer: 100 };
    expect(digitsMistake(pages2, "103")).toBe("noOnes");
    expect(digitsMistake(pages2, "130")).toBe("tensAsOne");
    expect(digitsMistake(pages2, "64")).toBe("divideAll");
    expect(digitsMistake(pages2, "1")).toBe("rangeOnly");
    expect(digitsMistake(pages2, "101")).toBe("offByOne");
    const pages3: PagesQuestion = { ...base, level: 3, type: "pages", ask: "ones", from: 11, to: 120, digits: 0, answer: rangeCount(1, 11, 120) };
    expect(digitsMistake(pages3, String(rangeCount(1, 12, 120)))).toBe("offByOne");

    const prod: UnitsQuestion = { ...base, level: 1, type: "units", kind: "product", factors: [27, 34, 18], powers: [], answer: 4 };
    expect(digitsMistake(prod, "9")).toBe("addedUnits");
    expect(digitsMistake(prod, "8")).toBe("missedFactor");
    // 2^20: cycle 2, 4, 8, 6; 20 = 4 × 5, remainder 0 → the last, 6.
    const pow: UnitsQuestion = { ...base, type: "units", kind: "power", factors: [], powers: [[2, 20]], answer: 6 };
    expect(digitsMistake(pow, "0")).toBe("multipliedExp");
    expect(digitsMistake(pow, "2")).toBe("cyclePos");
    const sum: UnitsQuestion = { ...base, level: 3, type: "units", kind: "sum", factors: [], powers: [[2, 20], [3, 15]], answer: (6 + 7) % 10 };
    expect(digitsMistake(sum, String((6 * 7) % 10))).toBe("wrongOp");
  });
});

// Keep the question type narrowings honest.
export type _Check = DigitsQuestion extends { type: string } ? true : never;
