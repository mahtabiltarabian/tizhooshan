import { describe, expect, it } from "vitest";
import { answerKey, answerKind, digitsMistake, makeDigitsQuestion, slips, type Level } from "./digits";
import { divisorCount, EVEN, NO, NUMBER_TYPES, ODD, primeFactors, seqTerms, smallestWith, YES, type NumberQuestion, type ParityQuestion, type PrimeQuestion } from "./digits-numbers";

const LEVELS: Level[] = [1, 2, 3];
const SEEDS = 10_000;

// Independent checks: plain loops, searches and constructions, not the generator's shortcuts.

const bruteDivisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const brutePrime = (n: number) => n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d !== 0);

/** Totals reachable by k odd numbers of at least 1 (repeats allowed), up to `max`. */
function oddTotals(k: number, max: number) {
  let now = new Set([0]);
  for (let i = 0; i < k; i++) {
    const next = new Set<number>();
    for (const s of now) for (let o = 1; s + o <= max; o += 2) next.add(s + o);
    now = next;
  }
  return now;
}

/** Ways to tile a rows × cols board with dominoes, some cells cut out (broken-profile counting). */
const tilings = new Map<string, number>();
function tileCount(rows: number, cols: number, cut: [number, number][]): number {
  const key = `${rows}x${cols}:${cut.join(";")}`;
  if (tilings.has(key)) return tilings.get(key)!;
  const blocked = (r: number, c: number) => cut.some(([a, b]) => a === r && b === c);
  // Column by column; a mask says which cells of the current column are already filled from the left.
  let ways = new Map<number, number>([[0, 1]]);
  for (let c = 0; c < cols; c++) {
    const next = new Map<number, number>();
    for (const [mask, w] of ways) {
      const fill = (r: number, cur: number, out: number) => {
        if (r === rows) {
          next.set(out, (next.get(out) ?? 0) + w);
          return;
        }
        const taken = (cur >> r) & 1 || blocked(r, c);
        if (taken) return fill(r + 1, cur, out);
        // Across into the next column.
        if (c + 1 < cols && !blocked(r, c + 1)) fill(r + 1, cur | (1 << r), out | (1 << r));
        // Down within the column.
        if (r + 1 < rows && !((cur >> (r + 1)) & 1) && !blocked(r + 1, c)) fill(r + 2, cur | (1 << r) | (1 << (r + 1)), out);
      };
      fill(0, mask, 0);
    }
    ways = next;
  }
  const n = ways.get(0) ?? 0;
  tilings.set(key, n);
  return n;
}

/** A simple graph where each of n people shakes k hands, built round a table; null if the build fails. */
function circleGraph(n: number, k: number) {
  const edges = new Set<string>();
  const add = (a: number, b: number) => edges.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  for (let i = 0; i < n; i++) for (let s = 1; s <= Math.floor(k / 2); s++) add(i, (i + s) % n);
  if (k % 2) for (let i = 0; i < n / 2; i++) add(i, i + n / 2);
  const deg = Array(n).fill(0);
  for (const e of edges) for (const v of e.split("-")) deg[Number(v)]++;
  return deg.every((d) => d === k) ? edges : null;
}

/** Fewest upright cups reachable when each move turns exactly two cups, by search over counts. */
function cupsReach(n: number, u: number) {
  const seen = new Set([u]);
  const todo = [u];
  while (todo.length) {
    const x = todo.pop()!;
    for (let up = 0; up <= 2; up++) {
      if (up > x || 2 - up > n - x) continue;
      const y = x - up + (2 - up);
      if (!seen.has(y)) {
        seen.add(y);
        todo.push(y);
      }
    }
  }
  return seen.has(0);
}

/** Can + and − before 2 … n make the target? Every choice written out and worked. */
function signsBrute(n: number, target: number) {
  for (let m = 0; m < 2 ** (n - 1); m++) {
    let e = "1";
    for (let i = 2; i <= n; i++) e += ((m >> (i - 2)) & 1 ? "-" : "+") + i;
    if (e.split(/(?=[+-])/).reduce((s, t) => s + Number(t), 0) === target) return true;
  }
  return false;
}

/** Small numbers of a parity, to test a rule given in words on real numbers. */
const SAMPLES = [
  [0, 2, 4, 6, 8, 12],
  [1, 3, 5, 7, 9, 11],
];
function ruleHolds(q: ParityQuestion) {
  const results = new Set<number>();
  const walk = (vals: number[]) => {
    if (vals.length === q.nums.length) {
      if (q.op === 1 && vals[0] < vals[1]) return;
      const v = q.op === 0 ? vals.reduce((s, x) => s + x, 0) : q.op === 1 ? vals[0] - vals[1] : vals.reduce((p, x) => p * x, 1);
      results.add(v % 2 === 0 ? EVEN : ODD);
      return;
    }
    for (const x of SAMPLES[q.nums[vals.length]]) walk([...vals, x]);
  };
  walk([]);
  return results;
}

function checkPrime(q: PrimeQuestion) {
  const ds = bruteDivisors(q.n);
  switch (q.ask) {
    case "isPrime":
      expect(q.answer).toBe(brutePrime(q.n) ? YES : NO);
      if (q.level > 1 && !brutePrime(q.n)) expect(q.n % 2).toBe(1);
      break;
    case "count":
      expect(q.answer).toBe(ds.length);
      expect(ds.length).toBeGreaterThanOrEqual(q.level === 1 ? 4 : q.level === 2 ? 5 : 8);
      break;
    case "sum":
      expect(q.answer).toBe(ds.reduce((s, d) => s + d, 0));
      break;
    case "smallest": {
      let m = 1;
      while (bruteDivisors(m).length !== q.k) m++;
      expect(q.answer).toBe(m);
      expect(q.n).toBe(m);
      break;
    }
    case "factor": {
      // Divide out by trial: the one way to write n as primes.
      const fs: number[] = [];
      let m = q.n;
      for (let d = 2; m > 1; d++)
        while (m % d === 0) {
          fs.push(d);
          m /= d;
        }
      expect(answerKey(q)).toBe(fs.join("."));
      expect(fs.every(brutePrime)).toBe(true);
      expect(fs.length).toBeGreaterThanOrEqual(3);
      expect(new Set(fs).size).toBeLessThan(fs.length);
      break;
    }
  }
}

function checkParity(q: ParityQuestion) {
  switch (q.ask) {
    case "expr": {
      const [a, b] = q.nums;
      const v = q.op === 0 ? a + b : q.op === 1 ? a - b : a * b;
      expect(v).toBeGreaterThan(0);
      expect(q.answer).toBe(v % 2 ? ODD : EVEN);
      break;
    }
    case "rule": {
      // The rule must hold for every choice of numbers, so the answer is one.
      expect([...ruleHolds(q)]).toEqual([q.answer]);
      break;
    }
    case "oddSum": {
      const [k] = q.nums;
      expect(q.answer).toBe(oddTotals(k, q.target).has(q.target) ? YES : NO);
      break;
    }
    case "mixed": {
      // a odd and b even numbers: try real ones.
      const [a, b] = q.nums;
      const total = Array.from({ length: a }, (_, i) => 2 * i + 1).reduce((s, x) => s + x, 0) + Array.from({ length: b }, (_, i) => 2 * i + 2).reduce((s, x) => s + x, 0);
      expect(q.answer).toBe(total % 2 ? ODD : EVEN);
      break;
    }
    case "seq": {
      const [a, b, st] = q.nums;
      let s = 0;
      for (let x = a; x <= b; x += st) s += x;
      expect(q.answer).toBe(s % 2 ? ODD : EVEN);
      expect(seqTerms(q).length).toBeLessThanOrEqual(40);
      break;
    }
    case "handshake": {
      const [n, k] = q.nums;
      expect(k).toBeLessThan(n);
      // Possible: a table round which it works. Not possible: the hands counted twice would be odd.
      if (q.answer === YES) expect(circleGraph(n, k)).not.toBeNull();
      else expect((n * k) % 2).toBe(1);
      break;
    }
    case "domino": {
      const [r, c] = q.nums;
      const cut: [number, number][] = q.variant === 0 ? [] : q.variant === 1 ? [[0, 0]] : [
        [0, 0],
        [r - 1, c - 1],
      ];
      expect(q.answer).toBe(tileCount(r, c, cut) > 0 ? YES : NO);
      break;
    }
    case "cups":
      expect(q.answer).toBe(cupsReach(q.nums[0], q.nums[1]) ? YES : NO);
      break;
    case "signs": {
      const [n] = q.nums;
      expect(q.answer).toBe(signsBrute(n, q.target) ? YES : NO);
      if (q.answer === YES) expect(q.witness.reduce((s, x, i) => s + (x ? -(i + 2) : i + 2), 1)).toBe(q.target);
      break;
    }
  }
}

describe("number helpers", () => {
  it("finds divisors, primes and factors like plain loops", () => {
    for (let n = 1; n <= 600; n++) {
      expect(divisorCount(n)).toBe(bruteDivisors(n).length);
      expect(primeFactors(n).reduce((p, x) => p * x, 1)).toBe(n);
    }
    expect(smallestWith(6)).toBe(12);
    expect(smallestWith(12)).toBe(60);
  });

  it("knows which boards can be tiled", () => {
    expect(tileCount(2, 2, [])).toBe(2);
    expect(tileCount(8, 8, [[0, 0], [7, 7]])).toBe(0);
    expect(tileCount(3, 3, [[0, 0]])).toBeGreaterThan(0);
  });
});

describe("prime and parity questions", () => {
  it("is the same for the same seed", () => {
    for (const t of NUMBER_TYPES) for (const l of LEVELS) expect(makeDigitsQuestion(t, l, 42)).toEqual(makeDigitsQuestion(t, l, 42));
  });

  it("gives a sound question with one answer for 10,000 seeds of every type and level", () => {
    const asks = new Map<string, Set<string>>();
    for (const type of NUMBER_TYPES)
      for (const level of LEVELS)
        for (let seed = 0; seed < SEEDS; seed++) {
          const q = makeDigitsQuestion(type, level, seed) as NumberQuestion;
          expect(q.type).toBe(type);
          const key = answerKey(q);
          expect(digitsMistake(q, key)).toBe("right");
          // Every other answer is not right: one correct answer.
          const kind = answerKind(q);
          if (kind === "choice") expect(digitsMistake(q, String(3 - Number(key)))).not.toBe("right");
          if (kind === "number") for (const d of [-2, -1, 1, 2]) if (Number(key) + d >= 0) expect(digitsMistake(q, String(Number(key) + d))).not.toBe("right");
          for (const [, v] of slips(q)) {
            expect(String(v)).not.toBe(key);
            expect(digitsMistake(q, String(v))).not.toMatch(/^(other|right)$/);
          }
          if (q.type === "prime") checkPrime(q);
          else checkParity(q);
          const k = `${type}-${level}`;
          if (!asks.has(k)) asks.set(k, new Set());
          asks.get(k)!.add(`${q.ask}:${q.answer === YES || q.answer === NO ? q.answer : "n"}`);
        }
    // Each level uses its kinds of question, both choices included.
    expect([...asks.get("prime-1")!].sort()).toEqual(["count:n", "isPrime:1", "isPrime:2"]);
    expect(asks.get("prime-3")!.has("factor:n")).toBe(true);
    expect(asks.get("prime-3")!.has("sum:n")).toBe(true);
    for (const a of ["oddSum", "handshake", "domino", "cups", "signs"]) {
      const lv = a === "oddSum" ? "parity-2" : "parity-3";
      expect(asks.get(lv)!.has(`${a}:1`) && asks.get(lv)!.has(`${a}:2`)).toBe(true);
    }
  }, 240_000);

  it("uses each kind of answer", () => {
    const of = (q: Partial<PrimeQuestion>) => ({ type: "prime", level: 1, seed: 0, n: 12, k: 0, answer: 6, ...q }) as PrimeQuestion;
    expect(answerKind(of({ ask: "isPrime", answer: NO }))).toBe("choice");
    expect(answerKind(of({ ask: "count" }))).toBe("number");
    expect(answerKind(of({ ask: "factor", answer: 12 }))).toBe("factors");
    expect(answerKind(makeDigitsQuestion("parity", 2, 1))).toBe("choice");
  });

  it("names the usual slips", () => {
    const p = (q: Partial<PrimeQuestion>) => ({ type: "prime", level: 2, seed: 0, k: 0, ...q }) as PrimeQuestion;
    expect(digitsMistake(p({ ask: "isPrime", n: 1, answer: NO }), String(YES))).toBe("oneIsPrime");
    expect(digitsMistake(p({ ask: "isPrime", n: 2, answer: YES }), String(NO))).toBe("twoEven");
    expect(digitsMistake(p({ ask: "isPrime", n: 91, answer: NO }), String(YES))).toBe("stoppedEarly");
    expect(digitsMistake(p({ ask: "isPrime", n: 51, answer: NO }), String(YES))).toBe("missedDivisor");
    expect(digitsMistake(p({ ask: "isPrime", n: 97, answer: YES }), String(NO))).toBe("primeNo");
    // 36: 1, 2, 3, 4, 6, 9, 12, 18, 36.
    const c36 = p({ ask: "count", n: 36, answer: 9 });
    expect(digitsMistake(c36, "10")).toBe("rootTwice");
    expect(digitsMistake(c36, "7")).toBe("noEnds");
    expect(digitsMistake(c36, "8")).toBe("oneEnd");
    expect(digitsMistake(c36, "5")).toBe("halfOnly");
    // 72 = 2³ × 3²: (3 + 1) × (2 + 1) = 12.
    const c72 = p({ level: 3, ask: "count", n: 72, answer: 12 });
    expect(digitsMistake(c72, "6")).toBe("expProduct");
    expect(digitsMistake(c72, "7")).toBe("expSum");
    // 1 + 2 + 3 + 4 + 6 + 12 = 28.
    const s12 = p({ level: 3, ask: "sum", n: 12, answer: 28 });
    expect(digitsMistake(s12, "16")).toBe("noSelf");
    expect(digitsMistake(s12, "27")).toBe("noOne");
    expect(digitsMistake(s12, "15")).toBe("noEnds");
    expect(digitsMistake(s12, "6")).toBe("countNotSum");
    expect(digitsMistake(p({ level: 3, ask: "sum", n: 16, answer: 31 }), "35")).toBe("rootTwice");
    const k6 = p({ ask: "smallest", n: 12, k: 6, answer: 12 });
    expect(digitsMistake(k6, "32")).toBe("primePower");
    expect(digitsMistake(k6, "18")).toBe("notSmallest");
    expect(digitsMistake(k6, "10")).toBe("countIs");
    const f84 = p({ level: 3, ask: "factor", n: 84, answer: 84 });
    expect(digitsMistake(f84, "2.2.3.7")).toBe("right");
    expect(digitsMistake(f84, "7.2.3.2")).toBe("right");
    expect(digitsMistake(f84, "1.2.2.3.7")).toBe("oneIsPrime");
    expect(digitsMistake(f84, "4.3.7")).toBe("notPrimeFactor");
    expect(digitsMistake(f84, "2.3.7")).toBe("productWrong");

    const q = (x: Partial<ParityQuestion>) => ({ type: "parity", level: 1, seed: 0, op: 0, target: 0, variant: 0, witness: [], ...x }) as ParityQuestion;
    expect(digitsMistake(q({ ask: "expr", nums: [37, 59], answer: EVEN }), String(ODD))).toBe("oddPlusOdd");
    expect(digitsMistake(q({ ask: "rule", nums: [1, 0], answer: ODD }), String(EVEN))).toBe("evenPlusOdd");
    expect(digitsMistake(q({ ask: "rule", nums: [1, 0], op: 2, answer: EVEN }), String(ODD))).toBe("timesEven");
    expect(digitsMistake(q({ ask: "rule", nums: [1, 1], op: 2, answer: ODD }), String(EVEN))).toBe("oddTimesOdd");
    expect(digitsMistake(q({ ask: "rule", nums: [1, 1, 1], answer: ODD }), String(EVEN))).toBe("ignoredCount");
    // Five odd numbers cannot make 20; four can.
    expect(digitsMistake(q({ level: 2, ask: "oddSum", nums: [5], target: 20, answer: NO }), String(YES))).toBe("ignoredCount");
    expect(digitsMistake(q({ level: 2, ask: "oddSum", nums: [4], target: 20, answer: YES }), String(NO))).toBe("oddSumOdd");
    // 1 + 2 + … + 10 = 55: odd, though 10 is even.
    expect(digitsMistake(q({ level: 2, ask: "seq", nums: [1, 10, 1], answer: ODD }), String(EVEN))).toBe("lastOnly");
    expect(digitsMistake(q({ level: 2, ask: "mixed", nums: [4, 3], answer: EVEN }), String(ODD))).toBe("countedAll");
    expect(digitsMistake(q({ level: 3, ask: "handshake", nums: [7, 3], answer: NO }), String(YES))).toBe("handshakeOdd");
    expect(digitsMistake(q({ level: 3, ask: "domino", nums: [4, 6], variant: 2, answer: NO }), String(YES))).toBe("sameColour");
    expect(digitsMistake(q({ level: 3, ask: "domino", nums: [5, 7], variant: 0, answer: NO }), String(YES))).toBe("dominoOdd");
    expect(digitsMistake(q({ level: 3, ask: "cups", nums: [8, 3], answer: NO }), String(YES))).toBe("cupsOdd");
    expect(digitsMistake(q({ level: 3, ask: "signs", nums: [5], target: 4, answer: NO }), String(YES))).toBe("signsParity");
    expect(digitsMistake(q({ level: 3, ask: "cups", nums: [8, 4], answer: YES }), String(NO))).toBe("notImpossible");
  });
});
