import { describe, expect, it } from "vitest";
import { countMistake, countsAfter, countSteps, makeVennCountQuestion, refMask, valueOf, type Level, type Ref, type VennCountQuestion } from "./venn-count";

const LEVELS: Level[] = [1, 2, 3];

/** Rank of 0/1 rows over the rationals (plain Gaussian elimination, independent of the step solver). */
function rank(rows: number[][]): number {
  const m = rows.map((r) => [...r]);
  let rk = 0;
  const cols = m[0]?.length ?? 0;
  for (let c = 0; c < cols && rk < m.length; c++) {
    const p = m.findIndex((r, i) => i >= rk && Math.abs(r[c]) > 1e-9);
    if (p < 0) continue;
    [m[rk], m[p]] = [m[p], m[rk]];
    for (let i = 0; i < m.length; i++) {
      if (i === rk) continue;
      const f = m[i][c] / m[rk][c];
      if (f) for (let j = c; j < cols; j++) m[i][j] -= f * m[rk][j];
    }
    rk++;
  }
  return rk;
}

/** A count as a row over regions, region by region from its meaning (not via refMask). */
function row(k: number, ref: Ref): number[] {
  return Array.from({ length: 1 << k }, (_, r) => {
    const has = (s: number) => (r >> s) & 1;
    switch (ref.kind) {
      case "set":
        return has(ref.s);
      case "only":
        return Number(r === 1 << ref.s);
      case "both":
        return Number(r === 3);
      case "pairOnly":
        return Number(has(ref.s) && has(ref.t) && r === ((1 << ref.s) | (1 << ref.t)));
      case "pair":
        return Number(has(ref.s) && has(ref.t));
      case "all3":
        return Number(r === 7);
      case "union":
        return Number(r > 0);
      case "neither":
        return Number(r === 0);
      case "total":
        return 1;
    }
  });
}

const dot = (a: number[], b: readonly number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

/**
 * Two circles, brute force: every way to fill the regions with 0 … 60 people
 * that fits the facts. The outside is not looped over: a class total or a
 * "neither" fixes it, and without either it is in no fact (any value fits).
 */
function bruteTwo(q: VennCountQuestion): Set<number> {
  const rows = q.facts.map((f) => row(2, f.ref));
  const askRow = row(2, q.ask);
  const total = q.facts.find((f) => f.ref.kind === "total")?.value;
  const neither = q.facts.find((f) => f.ref.kind === "neither")?.value;
  const answers = new Set<number>();
  for (let a = 0; a <= 60; a++)
    for (let b = 0; b <= 60; b++)
      for (let c = 0; c <= 60; c++) {
        const d = total !== undefined ? total - a - b - c : (neither ?? 0);
        if (d < 0) continue;
        const counts = [d, a, b, c];
        if (q.facts.every((f, i) => dot(rows[i], counts) === f.value)) answers.add(dot(askRow, counts));
      }
  return answers;
}

describe("venn counting", () => {
  it("adds up the regions of each count", () => {
    // 2 circles: outside 4, only A 10, only B 6, both 7.
    const c = [4, 10, 6, 7];
    expect(valueOf(2, c, { kind: "set", s: 0 })).toBe(17);
    expect(valueOf(2, c, { kind: "union" })).toBe(23);
    expect(valueOf(2, c, { kind: "total" })).toBe(27);
    expect(refMask(3, { kind: "pair", s: 0, t: 2 })).toBe((1 << 5) | (1 << 7));
    expect(refMask(3, { kind: "pairOnly", s: 1, t: 2 })).toBe(1 << 6);
  });

  it("fills the middle first, then the only parts, then the outside", () => {
    const q: VennCountQuestion = {
      type: "vennNum",
      level: 2,
      seed: 0,
      k: 2,
      theme: 0,
      items: [0, 1],
      counts: [4, 18, 11, 7],
      facts: [
        { ref: { kind: "total" }, value: 40 },
        { ref: { kind: "set", s: 0 }, value: 25 },
        { ref: { kind: "set", s: 1 }, value: 18 },
        { ref: { kind: "both" }, value: 7 },
      ],
      ask: { kind: "neither" },
      extreme: null,
      answer: 4,
      slips: [],
    };
    const { steps, solved } = countSteps(q);
    expect(solved).toBe(true);
    expect(steps.map((s) => s.kind)).toEqual(["given", "sub", "sub", "sub", "answer"]);
    expect(countsAfter(2, steps, 4)).toEqual([4, 18, 11, 7]);
    expect(steps.at(-1)).toMatchObject({ value: 4 });
  });
});

describe("venn counting questions", () => {
  it("is the same for the same seed", () => {
    for (const l of LEVELS) expect(makeVennCountQuestion(l, 42)).toEqual(makeVennCountQuestion(l, 42));
  });

  it("gives one right answer and named slips for 10,000 seeds of every level", () => {
    const fails: string[] = [];
    const tags: Record<string, number> = {};
    const kinds: Record<string, number> = {};
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeVennCountQuestion(level, seed);
        const fail = (why: string) => fails.length < 20 && fails.push(`L${level} seed ${seed}: ${why}`);
        const n = 1 << q.k;
        if (q.counts.length !== n || q.counts.some((v) => !Number.isInteger(v) || v < 0)) fail("counts");
        // Every fact is true of the hidden counts.
        for (const f of q.facts) if (dot(row(q.k, f.ref), q.counts) !== f.value) fail(`fact ${f.ref.kind}`);
        if (!Number.isInteger(q.answer) || q.answer < 0) fail("answer");
        if (q.answer > 99) fail("answer too big for the pad");
        if (q.facts.some((f) => f.value > 99)) fail("numbers too big");
        if (level < 3 && q.k !== 2) fail("circles");
        if (level === 1 && q.facts.some((f) => f.ref.kind === "total" || f.ref.kind === "neither")) fail("level 1 has a class");
        if (level === 2 && !q.facts.some((f) => f.ref.kind === "total")) fail("level 2 without a class");
        if (level === 3 && q.k === 2 && !q.extreme) fail("level 3 two circles without min / max");
        if (q.extreme) {
          // Brute force over every possible overlap.
          const [N, A, B] = q.facts.map((f) => f.value);
          const vals: number[] = [];
          for (let c = 0; c <= Math.min(A, B); c++) {
            const d = N - (A + B - c);
            if (d < 0) continue;
            vals.push(q.extreme === "maxNeither" ? d : c);
          }
          const best = q.extreme === "minBoth" ? Math.min(...vals) : Math.max(...vals);
          if (best !== q.answer) fail(`extreme ${best} ≠ ${q.answer}`);
          if (valueOf(q.k, q.counts, q.ask) !== q.answer) fail("example arrangement");
          // The other extreme differs, so the question is worth asking.
          const other = q.extreme === "minBoth" ? Math.max(...vals) : Math.min(...vals);
          if (other === q.answer) fail("min = max");
        } else {
          if (valueOf(q.k, q.counts, q.ask) !== q.answer) fail("answer ≠ counts");
          // The facts force the asked count: its row is in the span of theirs.
          const rows = q.facts.map((f) => row(q.k, f.ref));
          if (rank([...rows, row(q.k, q.ask)]) !== rank(rows)) fail("not forced");
          // Nothing is asked that the question already says.
          if (q.facts.some((f) => JSON.stringify(f.ref) === JSON.stringify(q.ask))) fail("asked is given");
          // Small sample: brute force over whole numbers too.
          if (q.k === 2 && seed < 150) {
            const all = bruteTwo(q);
            if (all.size !== 1 || !all.has(q.answer)) fail(`brute force: ${[...all].join(",")}`);
          }
        }
        // Show me reaches the answer, and every region it writes is the true one.
        const { steps, solved } = countSteps(q);
        if (!solved) fail("show me does not solve");
        const last = steps.at(-1);
        if (last?.kind !== "answer" || last.value !== q.answer) fail("show me answer");
        const filled = countsAfter(q.k, steps, steps.length);
        filled.forEach((v, r) => v !== null && v !== q.counts[r] && fail(`show me region ${r}`));
        // Middle first: no "only" region is written before the middle.
        const order = steps.map((s) => ("region" in s ? s.region : s.kind === "overlap" ? 3 : -1)).filter((r) => r >= 0);
        const mid = q.k === 2 ? 3 : 7;
        if (!q.extreme && order.indexOf(mid) > 0 && order.slice(0, order.indexOf(mid)).some((r) => r !== 0 && r !== mid && [1, 2, 4].includes(r))) fail("middle not first");
        // Slips: whole, ≥ 0, all different and never the answer.
        const vals = q.slips.map((s) => s.value);
        if (new Set(vals).size !== vals.length || vals.includes(q.answer) || vals.some((v) => v < 0)) fail("slips");
        if (countMistake(q, q.answer) !== "right") fail("right");
        for (const s of q.slips) if (countMistake(q, s.value) !== s.tag) fail("slip tag");
        if (!q.slips.length) fail("no slip");
        q.slips.forEach((s) => (tags[s.tag] = (tags[s.tag] ?? 0) + 1));
        const kind = `${level}:${q.k}:${q.extreme ?? q.ask.kind}`;
        kinds[kind] = (kinds[kind] ?? 0) + 1;
      }
    expect(fails).toEqual([]);
    // The four slips the topic is about turn up often.
    for (const t of ["addedNoOverlap", "totalAsOnly", "forgotOutside", "doubleSubtract"]) expect(tags[t]).toBeGreaterThan(500);
    // Every form turns up.
    for (const k of ["1:2:only", "1:2:both", "1:2:union", "2:2:neither", "2:2:both", "2:2:only", "3:3:neither", "3:3:only", "3:3:union", "3:2:minBoth", "3:2:maxBoth", "3:2:maxNeither"]) expect(kinds[k] ?? 0).toBeGreaterThan(300);
  }, 240_000);
});
