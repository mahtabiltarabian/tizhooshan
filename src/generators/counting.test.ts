import { describe, expect, it } from "vitest";
import {
  allRoutes,
  answerKind,
  cases,
  comb,
  countingMistake,
  gridValues,
  makeCountingQuestion,
  perm,
  pigeonBrute,
  routeNodes,
  routes,
  sameAnswer,
  slips,
  worstCase,
  type ArrangeQuestion,
  type ChooseQuestion,
  type CountingQuestion,
  type CountingQuestionType,
  type GridQuestion,
  type HandshakeQuestion,
  type Level,
  type PigeonholeQuestion,
  type ProbabilityQuestion,
  type TreeQuestion,
} from "./counting";

const TYPES: CountingQuestionType[] = ["tree", "arrange", "choose", "handshake", "grid", "pigeonhole", "probability"];
const LEVELS: Level[] = [1, 2, 3];

// ── Independent counts: recursion, no formulas ──

/** Rows of k different things out of n, by building them one place at a time. */
function rows(n: number, k: number, prefix: number[] = []): number[][] {
  if (prefix.length === k) return [prefix];
  const out: number[][] = [];
  for (let i = 0; i < n; i++) if (!prefix.includes(i)) out.push(...rows(n, k, [...prefix, i]));
  return out;
}

/** Groups of k out of n, each built in rising order. */
function groups(n: number, k: number, from = 0, prefix: number[] = []): number[][] {
  if (prefix.length === k) return [prefix];
  const out: number[][] = [];
  for (let i = from; i < n; i++) out.push(...groups(n, k, i + 1, [...prefix, i]));
  return out;
}

/** Walk the grid one step at a time. */
function walk(a: number, b: number, x = 0, y = 0, avoid?: [number, number], seen = false, via?: [number, number]): number {
  if (avoid && x === avoid[0] && y === avoid[1]) return 0;
  const hit = seen || (via !== undefined && x === via[0] && y === via[1]);
  if (x === a && y === b) return via ? (hit ? 1 : 0) : 1;
  return (x < a ? walk(a, b, x + 1, y, avoid, hit, via) : 0) + (y < b ? walk(a, b, x, y + 1, avoid, hit, via) : 0);
}

/** Count what a question asks, without its formula. */
function bruteCount(q: CountingQuestion): number {
  switch (q.type) {
    case "tree": {
      const s = q.sizes;
      if (q.variant === "either") return s[0] + s[1];
      if (q.variant === "roads") {
        let n = s[2];
        for (let i = 0; i < s[0]; i++) for (let j = 0; j < s[1]; j++) n++;
        return n;
      }
      let n = 0;
      const go = (g: number, t: number[]) => {
        if (g === s.length) {
          if (!(q.forbid && t[0] === q.forbid[0] && t[1] === q.forbid[1])) n++;
          return;
        }
        for (let i = 0; i < s[g]; i++) go(g + 1, [...t, i]);
      };
      go(0, []);
      return n;
    }
    case "arrange":
      return rows(q.n, q.k).filter((r) => {
        const near = Math.abs(r.indexOf(0) - r.indexOf(1)) === 1;
        switch (q.cond) {
          case "none":
            return true;
          case "together":
            return near;
          case "notAdjacent":
            return !near;
          case "atEnd":
            return r[0] === 0 || r[r.length - 1] === 0;
          case "noLeadingZero":
            return q.items[r[0]] !== 0;
          case "even":
            return q.items[r[r.length - 1]] % 2 === 0;
        }
      }).length;
    case "choose":
      return groups(q.n, q.k).filter((g) => (q.cond === "must" ? g.includes(0) : q.cond === "notBoth" ? !(g.includes(0) && g.includes(1)) : true)).length;
    case "handshake": {
      // Everyone counts their own handshakes; each handshake is counted twice.
      const n = q.variant === "inverse" ? 0 : q.n;
      if (q.variant === "inverse") {
        for (let m = 2; m < 40; m++) if (comb(m, 2) === q.shakes) return m;
        return -1;
      }
      let ends = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && !(q.variant === "twins" && i >> 1 === j >> 1)) ends++;
      return ends / 2;
    }
    case "grid":
      return q.cond === "block" ? walk(q.a, q.b, 0, 0, q.at!) : q.cond === "through" ? walk(q.a, q.b, 0, 0, undefined, false, q.at!) : walk(q.a, q.b);
    case "pigeonhole":
      return pigeonBrute(q);
    case "probability":
      return -1;
  }
}

describe("counting helpers", () => {
  it("counts rows, groups and routes", () => {
    expect(perm(4, 2)).toBe(12);
    expect(perm(4, 4)).toBe(24);
    expect(comb(5, 2)).toBe(10);
    expect(comb(6, 3)).toBe(20);
    expect(routes(3, 3)).toBe(20);
    for (let n = 1; n <= 6; n++)
      for (let k = 1; k <= n; k++) {
        expect(rows(n, k).length).toBe(perm(n, k));
        expect(groups(n, k).length).toBe(comb(n, k));
      }
    for (let a = 0; a <= 4; a++)
      for (let b = 0; b <= 4; b++) {
        expect(allRoutes(a, b).length).toBe(routes(a, b));
        expect(walk(a, b)).toBe(routes(a, b));
      }
  });

  it("walks a route node by node", () => {
    expect(routeNodes([0, 1, 1])).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
  });

  it("finds the pigeonhole answer by trying every draw", () => {
    const q = { type: "pigeonhole", level: 1, seed: 0, variant: "same", ctx: "socks", colours: [0, 1, 2], counts: [5, 5, 5], k: 2, target: 0, answer: 4 } as PigeonholeQuestion;
    expect(pigeonBrute(q)).toBe(4);
    expect(pigeonBrute({ ...q, k: 3 })).toBe(7);
    // Only 1 green: it can't help make three of a kind.
    expect(pigeonBrute({ ...q, k: 3, counts: [1, 5, 4] })).toBe(6);
    expect(pigeonBrute({ ...q, variant: "one", target: 1, counts: [4, 2, 3] })).toBe(8);
    expect(pigeonBrute({ ...q, variant: "all", counts: [4, 2, 3] })).toBe(8);
    expect(pigeonBrute({ ...q, variant: "different", counts: [4, 2, 3] })).toBe(5);
  });

  it("compares fractions by value", () => {
    expect(sameAnswer({ n: 2, d: 4 }, { n: 1, d: 2 })).toBe(true);
    expect(sameAnswer({ n: 3, d: 8 }, { n: 1, d: 2 })).toBe(false);
    expect(sameAnswer(3, { n: 3, d: 1 })).toBe(false);
  });
});

describe("counting questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makeCountingQuestion(t, l, 42)).toEqual(makeCountingQuestion(t, l, 42));
  });

  it("gives a sound question for 10,000 seeds of every type and level", () => {
    const bad: string[] = [];
    const fail = (q: CountingQuestion, why: string) => bad.length < 20 && bad.push(`${q.type} L${q.level} seed ${q.seed}: ${why}`);
    const kinds = new Map<string, Set<string>>();
    for (const type of TYPES)
      for (const level of LEVELS)
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makeCountingQuestion(type, level, seed);
          const key = `${type}-${level}`;
          if (!kinds.has(key)) kinds.set(key, new Set());
          if (countingMistake(q, q.answer) !== "right") fail(q, "answer is not right");
          // No slip may be the right answer and still count as a slip.
          for (const [, v] of slips(q)) if (countingMistake(q, v) !== "right" && countingMistake(q, v) === "other") fail(q, "slip not named");
          if (answerKind(type) === "number" && (typeof q.answer !== "number" || !Number.isInteger(q.answer) || q.answer < 1)) fail(q, "answer not a whole number");

          const all = cases(q);
          const ok = all.filter((c) => c.ok).length;
          if (q.type !== "pigeonhole" && q.type !== "probability") {
            // Formula = listing every case = counting without the formula.
            // Inverse handshakes: the cases are the handshakes, the answer is the people.
            const want = q.type === "handshake" && q.variant === "inverse" ? q.shakes : q.answer;
            if (ok !== want) fail(q, `cases ${ok} ≠ ${want}`);
            if (bruteCount(q) !== q.answer) fail(q, `brute ${bruteCount(q)} ≠ ${q.answer}`);
            if (new Set(all.map((c) => c.pick.join(","))).size !== all.length) fail(q, "a case twice");
            if (all.length > 36) fail(q, "too many cases to show");
          }

          switch (q.type) {
            case "tree": {
              const t = q as TreeQuestion;
              kinds.get(key)!.add(t.variant);
              if (level === 1 && all.length > 6) fail(q, "level 1 over 6 cases");
              if (level === 2 && all.length > 24) fail(q, "level 2 over 24 cases");
              if (level === 3 && t.variant !== "roads" && t.variant !== "forbid") fail(q, "level 3 needs a condition");
              if (t.variant === "forbid" && ok === all.length) fail(q, "forbid changes nothing");
              break;
            }
            case "arrange": {
              const a = q as ArrangeQuestion;
              kinds.get(key)!.add(a.cond);
              if (level === 1 && all.length > 6) fail(q, "level 1 over 6 cases");
              if (level === 2 && all.length > 24) fail(q, "level 2 over 24 cases");
              if (level === 3 && (a.cond === "none" || ok === all.length || all.length > 24)) fail(q, "level 3 condition");
              if (new Set(a.items).size !== a.n) fail(q, "items repeat");
              if (a.ctx === "digits" && a.items.some((d) => d < 0 || d > 9)) fail(q, "not a digit");
              break;
            }
            case "choose": {
              const c = q as ChooseQuestion;
              kinds.get(key)!.add(c.cond);
              if (level === 1 && all.length > 6) fail(q, "level 1 over 6 cases");
              if (level === 2 && all.length > 24) fail(q, "level 2 over 24 cases");
              if (level === 3 && (c.cond === "none" || ok === all.length)) fail(q, "level 3 condition");
              break;
            }
            case "handshake": {
              const h = q as HandshakeQuestion;
              kinds.get(key)!.add(h.variant);
              if (level === 1 && q.answer > 6) fail(q, "level 1 over 6");
              if (level === 2 && q.answer > 24) fail(q, "level 2 over 24");
              if (level === 3 && h.variant === "plain") fail(q, "level 3 plain");
              if (h.variant === "inverse" && comb(q.answer, 2) !== h.shakes) fail(q, "inverse");
              break;
            }
            case "grid": {
              const g = q as GridQuestion;
              kinds.get(key)!.add(g.cond);
              if (level === 1 && all.length > 6) fail(q, "level 1 over 6 routes");
              if (level >= 2 && (g.a > 3 || g.b > 3)) fail(q, "bigger than 3×3");
              if (level === 3 && (g.cond === "none" || ok === all.length || ok < 2)) fail(q, "level 3 condition");
              // Adding the two neighbours, node by node, lands on the answer too.
              if (gridValues(g)[g.b][g.a] !== q.answer) fail(q, "node sums");
              break;
            }
            case "pigeonhole": {
              const p = q as PigeonholeQuestion;
              kinds.get(key)!.add(p.variant);
              if (pigeonBrute(p) !== q.answer) fail(q, `brute ${pigeonBrute(p)} ≠ ${q.answer}`);
              // The worst case falls one short.
              const w = worstCase(p);
              if (w.reduce((s, x) => s + x, 0) + 1 !== q.answer) fail(q, "worst case");
              if (w.some((x, i) => x > p.counts[i])) fail(q, "worst case takes too many");
              if (q.answer > p.counts.reduce((s, x) => s + x, 0)) fail(q, "can't be sure even with all");
              if (level === 1 && q.answer > 6) fail(q, "level 1 over 6");
              if (new Set(p.colours).size !== p.colours.length) fail(q, "colours repeat");
              break;
            }
            case "probability": {
              const pq = q as ProbabilityQuestion;
              kinds.get(key)!.add(pq.variant);
              if (pq.answer.d !== all.length || pq.answer.n !== ok) fail(q, `cases ${ok}/${all.length} ≠ ${pq.answer.n}/${pq.answer.d}`);
              if (pq.answer.n < 1 || pq.answer.n >= pq.answer.d) fail(q, "certain or impossible");
              if (level === 1 && all.length > 6) fail(q, "level 1 over 6 cases");
              if (level === 2 && all.length > 24) fail(q, "level 2 over 24 cases");
              break;
            }
          }
        }
    expect(bad).toEqual([]);
    // Every kind turns up.
    expect([...kinds.get("tree-1")!].sort()).toEqual(["either", "product"]);
    expect([...kinds.get("tree-3")!].sort()).toEqual(["forbid", "roads"]);
    expect([...kinds.get("arrange-3")!].sort()).toEqual(["atEnd", "even", "noLeadingZero", "notAdjacent", "together"]);
    expect([...kinds.get("choose-3")!].sort()).toEqual(["must", "notBoth"]);
    expect([...kinds.get("handshake-3")!].sort()).toEqual(["inverse", "twins"]);
    expect([...kinds.get("grid-3")!].sort()).toEqual(["block", "through"]);
    expect([...kinds.get("pigeonhole-3")!].sort()).toEqual(["all", "different", "one", "same"]);
    expect([...kinds.get("probability-1")!].sort()).toEqual(["bag", "die"]);
    expect([...kinds.get("probability-2")!].sort()).toEqual(["coinDie", "coins2", "coins3"]);
  }, 240_000);

  it("names the usual slips", () => {
    const arrange = { type: "arrange", level: 2, seed: 0, ctx: "people", n: 4, k: 2, items: [0, 1, 2, 3], cond: "none", answer: 12 } as ArrangeQuestion;
    expect(countingMistake(arrange, 6)).toBe("unordered");
    expect(countingMistake(arrange, 7)).toBe("added");
    expect(countingMistake(arrange, 16)).toBe("repeated");
    expect(countingMistake(arrange, 11)).toBe("other");

    const apart = { ...arrange, level: 3, k: 4, cond: "notAdjacent", answer: 12 } as ArrangeQuestion;
    expect(countingMistake(apart, 24)).toBe("forgotCondition");

    const zero = { ...arrange, level: 3, ctx: "digits", n: 4, k: 3, items: [0, 2, 5, 7], cond: "noLeadingZero", answer: 18 } as ArrangeQuestion;
    expect(countingMistake(zero, 24)).toBe("forgotCondition");
    expect(countingMistake(zero, 6)).toBe("complement");

    const choose = { type: "choose", level: 2, seed: 0, ctx: "fruit", n: 5, k: 2, items: [0, 1, 2, 3, 4], cond: "none", answer: 10 } as ChooseQuestion;
    expect(countingMistake(choose, 20)).toBe("ordered");

    const hands = { type: "handshake", level: 2, seed: 0, variant: "plain", ctx: "people", n: 6, shakes: 15, answer: 15 } as HandshakeQuestion;
    expect(countingMistake(hands, 30)).toBe("doubleCounted");
    expect(countingMistake(hands, 36)).toBe("square");
    expect(countingMistake(hands, 5)).toBe("perPerson");
    const twins = { ...hands, level: 3, variant: "twins", n: 6, shakes: 12, answer: 12 } as HandshakeQuestion;
    expect(countingMistake(twins, 15)).toBe("forgotCondition");
    expect(countingMistake(twins, 24)).toBe("doubleCounted");

    const tree = { type: "tree", level: 1, seed: 0, variant: "either", ctx: "trip", sizes: [3, 2], forbid: null, answer: 5 } as TreeQuestion;
    expect(countingMistake(tree, 6)).toBe("multiplied");
    const roads = { ...tree, level: 3, variant: "roads", sizes: [3, 2, 2], answer: 8 } as TreeQuestion;
    expect(countingMistake(roads, 12)).toBe("multiplied");
    expect(countingMistake(roads, 7)).toBe("added");
    const outfit = { ...tree, level: 2, variant: "product", ctx: "outfit", sizes: [3, 4], answer: 12 } as TreeQuestion;
    expect(countingMistake(outfit, 7)).toBe("added");

    const grid = { type: "grid", level: 3, seed: 0, a: 3, b: 3, cond: "through", at: [1, 1], answer: 12 } as GridQuestion;
    expect(walk(3, 3, 0, 0, undefined, false, [1, 1])).toBe(12);
    expect(countingMistake(grid, 20)).toBe("forgotCondition");
    expect(countingMistake(grid, 8)).toBe("complement");
    expect(countingMistake(grid, 9)).toBe("multiplied");
    expect(countingMistake(grid, 7)).toBe("other");
    const plainGrid = { ...grid, level: 2, cond: "none", at: null, answer: 20 } as GridQuestion;
    expect(countingMistake(plainGrid, 9)).toBe("multiplied");
    expect(countingMistake(plainGrid, 6)).toBe("added");

    const socks = { type: "pigeonhole", level: 2, seed: 0, variant: "same", ctx: "socks", colours: [0, 1, 2], counts: [6, 6, 6], k: 3, target: 0, answer: 7 } as PigeonholeQuestion;
    expect(countingMistake(socks, 6)).toBe("offByOne");
    expect(countingMistake(socks, 3)).toBe("lucky");
    expect(countingMistake(socks, 9)).toBe("tooMany");
    const limited = { ...socks, level: 3, counts: [1, 5, 4], answer: 6 } as PigeonholeQuestion;
    expect(countingMistake(limited, 7)).toBe("forgotLimit");

    const dice = { type: "probability", level: 3, seed: 0, variant: "dice2", event: { kind: "sum", t: 7 }, colours: [], counts: [], answer: { n: 6, d: 36 } } as ProbabilityQuestion;
    expect(countingMistake(dice, { n: 1, d: 6 })).toBe("right");
    expect(countingMistake(dice, { n: 30, d: 36 })).toBe("complement");
    expect(countingMistake(dice, { n: 6, d: 30 })).toBe("odds");
    expect(countingMistake(dice, { n: 3, d: 21 })).toBe("unordered");
    const coins = { ...dice, level: 2, variant: "coins2", event: { kind: "mixed" }, answer: { n: 2, d: 4 } } as ProbabilityQuestion;
    expect(countingMistake(coins, { n: 1, d: 3 })).toBe("unordered");
  });
});
