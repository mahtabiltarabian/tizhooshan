import { describe, expect, it } from "vitest";
import {
  cellAt,
  clashes,
  clueHolds,
  follows,
  gridCheck,
  gridSteps,
  liarSolutions,
  liarsMistake,
  liarSteps,
  makeLogicQuestion,
  marksAfter,
  optionTag,
  saysTrue,
  vennSteps,
  type Clue,
  type GridQuestion,
  type Level,
  type LiarsQuestion,
  type LogicType,
  type Mark,
  type Statement,
  type VennQuestion,
} from "./logic";

const LEVELS: Level[] = [1, 2, 3];
const TYPES: LogicType[] = ["grid", "liars", "venn"];

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]));
}
const PERMS = { 3: permutations(3), 4: permutations(4) } as Record<number, number[][]>;

/** The grid with ✓ on the answer and ✗ elsewhere. */
const solvedMarks = (q: GridQuestion): Mark[] => Array.from({ length: q.size * q.size }, (_, c) => (q.answer[Math.floor(c / q.size)] === c % q.size ? 1 : -1));

/** A statement's truth in a model, region by region (independent of the generator's masks). */
function truthMask(s: Statement, k: number): (model: number) => boolean {
  let bad = 0;
  let need = 0;
  for (let r = 0; r < 1 << k; r++) {
    const a = (r >> s.a) & 1;
    const b = (r >> s.b) & 1;
    if (s.form === "all" && a && !b) bad |= 1 << r;
    if (s.form === "no" && a && b) bad |= 1 << r;
    if (s.form === "some" && a && b) need |= 1 << r;
    if (s.form === "someNot" && a && !b) need |= 1 << r;
  }
  return s.form === "all" || s.form === "no" ? (m) => (m & bad) === 0 : (m) => (m & need) !== 0;
}

/** Every model (set of regions with members) where all premises hold and every group has members. */
function models(premises: readonly Statement[], k: number): number[] {
  const tests = premises.map((s) => truthMask(s, k));
  const groups = Array.from({ length: k }, (_, t) => {
    let m = 0;
    for (let r = 0; r < 1 << k; r++) if ((r >> t) & 1) m |= 1 << r;
    return m;
  });
  const out: number[] = [];
  // Region 0 (outside every circle) does not matter: leave it empty.
  for (let model = 0; model < 1 << (1 << k); model += 2) {
    if (!groups.every((g) => model & g)) continue;
    if (tests.every((t) => t(model))) out.push(model);
  }
  return out;
}

const validByModels = (ms: readonly number[], s: Statement, k: number) => {
  const t = truthMask(s, k);
  return ms.every(t);
};

describe("logic grid solver", () => {
  // Sara (0) cat? Three people, items 0 cat, 1 dog, 2 fish. Answer: 0→2, 1→0, 2→1.
  const clues: Clue[] = [
    { kind: "no", p: 0, i: 0, owner: false },
    { kind: "no", p: 0, i: 1, owner: true },
    { kind: "no", p: 1, i: 1, owner: false },
  ];

  it("applies each clue, then crosses out and fills the last open cell", () => {
    const { steps, marks, solved } = gridSteps(3, clues);
    expect(solved).toBe(true);
    expect(marks.filter((m) => m === 1).length).toBe(3);
    expect(marks[cellAt(3, 0, 2)]).toBe(1);
    expect(marks[cellAt(3, 1, 0)]).toBe(1);
    expect(marks[cellAt(3, 2, 1)]).toBe(1);
    // Clue 2 leaves one open cell in Sara's row: a "row" step follows it.
    expect(steps[0].kind).toBe("clue");
    expect(steps[2]).toEqual({ kind: "row", cell: cellAt(3, 0, 2) });
    expect(steps[3].kind).toBe("cross");
    expect(marksAfter(3, steps, steps.length)).toEqual(marks);
    expect(marksAfter(3, steps, 1).filter((m) => m !== 0)).toEqual([-1]);
  });

  it("stops when the clues are not enough", () => {
    expect(gridSteps(3, clues.slice(0, 2)).solved).toBe(false);
  });

  it("turns 'or' and 'either' into crosses", () => {
    const { steps } = gridSteps(4, [
      { kind: "or", ps: [1, 2], i: 0 },
      { kind: "either", p: 3, is: [1, 2] },
    ]);
    expect(steps[0]).toEqual({ kind: "clue", clue: 0, no: [cellAt(4, 0, 0), cellAt(4, 3, 0)], yes: [] });
    expect(steps[1]).toEqual({ kind: "clue", clue: 1, no: [cellAt(4, 3, 3)], yes: [] });
  });
});

describe("logic grid check", () => {
  const q = { size: 3, answer: [2, 0, 1], clues: [{ kind: "no", p: 0, i: 0, owner: false }, { kind: "or", ps: [1, 2], i: 0 }, { kind: "yes", p: 2, i: 1 }] as Clue[] };
  const grid = (rows: string[]): Mark[] => rows.join("").split("").map((ch) => (ch === "v" ? 1 : ch === "x" ? -1 : 0));

  it("knows the right grid", () => {
    expect(gridCheck(q, grid(["xxv", "vxx", "xvx"])).tag).toBe("right");
    expect(gridCheck(q, grid(["..v", "v..", ".v."])).tag).toBe("right");
  });

  it("names a broken negative clue first", () => {
    const c = gridCheck(q, grid(["v..", "..v", ".v."]));
    expect(c.tag).toBe("ignoredNo");
    expect(c.clue).toBe(0);
    expect(c.cells).toContain(cellAt(3, 0, 0));
  });

  it("names a broken 'or' and 'yes'", () => {
    expect(gridCheck({ ...q, clues: [q.clues[1]] }, grid(["v..", "..v", ".v."])).tag).toBe("ignoredOr");
    expect(gridCheck({ ...q, clues: [q.clues[1]] }, grid(["...", "x..", "x.."])).tag).toBe("ignoredOr");
    expect(gridCheck({ ...q, clues: [q.clues[2]] }, grid(["..v", "v..", "..."])).tag).toBe("incomplete");
    expect(gridCheck({ ...q, clues: [q.clues[2]] }, grid(["...", "...", "v.."])).tag).toBe("ignoredYes");
  });

  it("hatches rows and columns with two ✓ or no room", () => {
    const c = gridCheck({ ...q, clues: [] }, grid(["vv.", "...", "xxx"]));
    expect(c.tag).toBe("clash");
    expect(c.rows).toEqual([0, 2]);
    expect(gridCheck({ ...q, clues: [] }, grid(["v..", "v..", "..."])).cols).toEqual([0]);
  });
});

describe("liars", () => {
  it("evaluates statements", () => {
    expect(saysTrue({ kind: "is", who: 1, liar: true }, [false, true])).toBe(true);
    expect(saysTrue({ kind: "some", a: 0, b: 1, liar: true }, [false, false])).toBe(false);
    expect(saysTrue({ kind: "count", n: 2 }, [true, false, true])).toBe(true);
  });

  it("solves 'A: B lies. B: we are the same kind.'", () => {
    // If B told the truth, A and B would be alike, so A tells the truth and B lies: impossible. So B lies, then A tells the truth.
    const says = [
      { kind: "is", who: 1, liar: true },
      { kind: "same", a: 0, b: 1 },
    ] as const;
    expect(liarSolutions([...says])).toEqual([[false, true]]);
    const steps = liarSteps({ says: [...says], people: ["الف", "ب"] });
    expect(steps.filter((s) => s.kind === "fits").map((s) => s.known)).toEqual([[false, true]]);
    expect(steps.some((s) => s.kind === "clash")).toBe(true);
    const q: LiarsQuestion = { type: "liars", level: 1, seed: 0, people: ["الف", "ب"], says: [...says], answer: [false, true] };
    expect(liarsMistake(q, [false, false]).tag).toBe("trustedLiar");
    expect(liarsMistake(q, [false, false]).clashes).toEqual([0]);
    expect(liarsMistake(q, [true, true]).tag).toBe("doubtedTruth");
    expect(liarsMistake(q, [false, true]).tag).toBe("right");
  });
});

describe("venn", () => {
  const all = (a: number, b: number): Statement => ({ form: "all", a, b });
  const some = (a: number, b: number): Statement => ({ form: "some", a, b });

  it("agrees with brute force for every pair of premises on three groups", () => {
    const forms = ["all", "some", "no", "someNot"] as const;
    const stmts = forms.flatMap((form) => [0, 1, 2].flatMap((a) => [0, 1, 2].filter((b) => b !== a).map((b) => ({ form, a, b }))));
    let bad = 0;
    for (const p of stmts)
      for (const q of stmts) {
        const ms = models([p, q], 3);
        for (const s of stmts) if (ms.length && follows([p, q], s, 3) !== validByModels(ms, s, 3)) bad++;
      }
    expect(bad).toBe(0);
  });

  it("names the usual slips", () => {
    expect(optionTag([all(0, 1)], all(1, 0), 2, true)).toBe("converse");
    expect(optionTag([some(0, 1)], { form: "someNot", a: 0, b: 1 }, 2, true)).toBe("someNotAll");
    expect(optionTag([some(0, 1)], all(0, 1), 2, true)).toBe("tooStrong");
    expect(optionTag([all(0, 1)], { form: "no", a: 0, b: 1 }, 2, true)).toBe("impossible");
    expect(optionTag([all(0, 1)], some(1, 0), 2, true)).toBe("right");
    // Some A are B, some B are C: nothing about A and C.
    expect(optionTag([some(0, 1), some(1, 2)], some(0, 2), 3, false)).toBe("notSure");
    expect(optionTag([all(0, 1), all(1, 2)], null, 3, true)).toBe("missedValid");
  });
});

describe("logic questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makeLogicQuestion(t, l, 42)).toEqual(makeLogicQuestion(t, l, 42));
    // The level's own size is no choice at all.
    expect(makeLogicQuestion("grid", 2, 9, { size: 4 })).toEqual(makeLogicQuestion("grid", 2, 9));
  });

  it("gives a sound logic grid for 10,000 seeds of every level", () => {
    const fails: string[] = [];
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeLogicQuestion("grid", level, seed) as GridQuestion;
        const n = q.size;
        const fail = (why: string) => fails.length < 20 && fails.push(`L${level} seed ${seed}: ${why}`);
        if (n !== (level === 1 ? 3 : 4)) fail("size");
        if (new Set(q.people).size !== n || new Set(q.answer).size !== n) fail("people");
        // Brute force: exactly one assignment keeps every clue, and it is the answer.
        const fits = PERMS[n].filter((a) => q.clues.every((c) => clueHolds(c, a)));
        if (fits.length !== 1 || fits[0].join() !== q.answer.join()) fail(`${fits.length} assignments fit`);
        const { solved, marks } = gridSteps(n, q.clues);
        if (!solved || q.answer.some((i, p) => marks[cellAt(n, p, i)] !== 1)) fail("solver");
        // Pruned: every clue is needed.
        for (let k = 0; k < q.clues.length; k++) if (gridSteps(n, q.clues.filter((_, j) => j !== k)).solved) fail(`clue ${k} not needed`);
        const kinds = q.clues.map((c) => c.kind);
        if (level === 1 && kinds.some((c) => c !== "no" && c !== "yes")) fail("level 1 kinds");
        if (level > 1 && kinds.includes("yes")) fail("yes past level 1");
        if (level === 3 && kinds.includes("no")) fail("plain no at level 3");
        if (gridCheck(q, solvedMarks(q)).tag !== "right") fail("check");
      }
    expect(fails).toEqual([]);
  }, 240_000);

  it("keeps grids sound with the knobs", () => {
    const fails: string[] = [];
    for (const level of LEVELS)
      for (const size of [3, 4] as const)
        for (const extra of [false, true])
          for (let seed = 0; seed < 600; seed++) {
            const q = makeLogicQuestion("grid", level, seed, { size, extra }) as GridQuestion;
            const fits = PERMS[size].filter((a) => q.clues.every((c) => clueHolds(c, a)));
            if (q.size !== size || fits.length !== 1 || fits[0].join() !== q.answer.join() || !gridSteps(size, q.clues).solved) fails.push(`L${level} ${size} ${extra} ${seed}`);
          }
    expect(fails.slice(0, 10)).toEqual([]);
  }, 240_000);

  it("gives sound liars for 10,000 seeds of every level", () => {
    const fails: string[] = [];
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeLogicQuestion("liars", level, seed) as LiarsQuestion;
        const n = q.people.length;
        const fail = (why: string) => fails.length < 20 && fails.push(`L${level} seed ${seed}: ${why}`);
        if (n !== (level === 1 ? 2 : 3)) fail("people");
        // Brute force: every truth assignment, independent of liarSolutions.
        let fitting = 0;
        for (let mask = 0; mask < 1 << n; mask++) {
          const liar = Array.from({ length: n }, (_, i) => !!(mask & (1 << i)));
          const ok = q.says.every((s, k) => !s || saysTrue(s, liar) === !liar[k]);
          if (ok) {
            fitting++;
            if (liar.join() !== q.answer.join()) fail("other answer");
          }
        }
        if (fitting !== 1) fail(`${fitting} fit`);
        if (!q.answer.some(Boolean)) fail("no liar");
        if (clashes(q.says, q.answer).length) fail("answer clashes");
        const steps = liarSteps(q);
        const ends = steps.filter((s) => s.kind === "fits");
        if (ends.length !== 1 || ends[0].known.join() !== q.answer.join()) fail("show me");
        if (liarsMistake(q, q.answer).tag !== "right") fail("mistake");
        for (let p = 0; p < n; p++) {
          const wrong = q.answer.map((l, i) => (i === p ? !l : l));
          if (liarsMistake(q, wrong).tag === "right" || liarsMistake(q, wrong).clashes.length === 0) fail("a wrong answer has no clash");
        }
      }
    expect(fails).toEqual([]);
  }, 240_000);

  it("gives sound Venn questions for 10,000 seeds of every level", () => {
    const fails: string[] = [];
    const tagCount: Record<string, number> = {};
    for (const level of LEVELS)
      for (let seed = 0; seed < 10_000; seed++) {
        const q = makeLogicQuestion("venn", level, seed) as VennQuestion;
        const k = q.terms.length;
        const fail = (why: string) => fails.length < 20 && fails.push(`L${level} seed ${seed}: ${why}`);
        if (k !== level + 1 || q.premises.length !== k - 1) fail("size");
        // Enumerate every model: exactly one option holds in all of them.
        const ms = models(q.premises, k);
        if (!ms.length) fail("premises impossible");
        const validOpts = q.options.map((s) => (s === null ? null : validByModels(ms, s, k)));
        const anyValid = validOpts.some((v) => v === true);
        const right = q.options.map((s, i) => (s === null ? !anyValid : validOpts[i]));
        if (right.filter(Boolean).length !== 1 || !right[q.answer]) fail("not exactly one right option");
        if (q.tags[q.answer] !== "right" || q.tags.filter((t) => t === "right").length !== 1) fail("tags");
        if (q.options.length !== 4) fail("options");
        if (level === 3) {
          if (!q.middle || !validByModels(ms, q.middle, k)) fail("middle");
          else if (!validByModels(models([q.middle, q.premises.find((p) => Math.min(p.a, p.b) === 2)!], k), q.options[q.answer]!, k)) fail("second step");
        }
        if (vennSteps(q).filter((s) => s.kind === "option").length !== 4) fail("steps");
        q.tags.forEach((t) => (tagCount[t] = (tagCount[t] ?? 0) + 1));
      }
    expect(fails).toEqual([]);
    // The named slips do turn up.
    for (const t of ["converse", "someNotAll", "tooStrong", "impossible", "missedValid"]) expect(tagCount[t]).toBeGreaterThan(100);
  }, 240_000);
});
