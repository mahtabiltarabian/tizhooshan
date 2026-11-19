import { describe, expect, it } from "vitest";
import {
  blankCells,
  candidates,
  cellSlips,
  cornerCandidates,
  crossingSlip,
  firstMove,
  fittingRules,
  givenValues,
  hexagramFigure,
  hexagramFills,
  LO_SHU,
  MAGIC_TRIANGLES,
  magicFrame,
  makeNumberPuzzle,
  PUZZLE_TYPES,
  puzzleMistake,
  RING_BLANKS,
  ringFrame,
  SHAPE_RULES,
  solveSteps,
  squareImages,
  valuesAfter,
  wheelFigure,
  wheelFills,
  type Level,
  type NumberPuzzle,
} from "./number-puzzles";

const LEVELS: Level[] = [1, 2, 3];
const solution = (q: NumberPuzzle) => q.cells.map((c) => c.value);

/** Lines a child could finish straight away: one blank, and a total that is known. */
const oneBlankLines = (q: NumberPuzzle) => q.lines.filter((l) => (l.total || !q.targetHidden) && l.cells.filter((i) => !q.cells[i].given).length === 1);

/** Every way to put the unused numbers of the set into the blanks so all lines hold (independent of the solver). */
function countSetFills(q: NumberPuzzle, limit = 50): number {
  const vals = givenValues(q);
  const blanks = blankCells(q);
  const left = [...q.set!];
  for (const v of vals) if (v !== null) left.splice(left.indexOf(v), 1);
  const target = q.type === "magic" ? q.set!.reduce((s, x) => s + x, 0) / 3 : q.target!;
  const ok = () => q.lines.every((l) => l.cells.some((i) => vals[i] === null) || l.cells.reduce((s, i) => s + vals[i]!, 0) === target);
  let n = 0;
  const walk = (k: number) => {
    if (n >= limit) return;
    if (k === blanks.length) {
      n++;
      return;
    }
    for (let j = 0; j < left.length; j++) {
      const v = left[j];
      if (Number.isNaN(v)) continue;
      vals[blanks[k]] = v;
      left[j] = NaN;
      if (ok()) walk(k + 1);
      left[j] = v;
      vals[blanks[k]] = null;
    }
  };
  walk(0);
  return n;
}

/** Rank of the blanks' columns in the line equations: equal to the number of blanks means one answer. */
function linearRank(q: NumberPuzzle): number {
  const blanks = blankCells(q);
  const rows = q.lines.map((l) => {
    const coef = blanks.map(() => 0);
    l.cells.forEach((c, i) => {
      const k = blanks.indexOf(c);
      if (k >= 0) coef[k] += l.total && i === l.cells.length - 1 ? -1 : 1;
    });
    return coef;
  });
  let rank = 0;
  for (let col = 0; col < blanks.length; col++) {
    const p = rows.findIndex((r, i) => i >= rank && Math.abs(r[col]) > 1e-9);
    if (p < 0) continue;
    [rows[rank], rows[p]] = [rows[p], rows[rank]];
    for (let i = 0; i < rows.length; i++) {
      if (i === rank) continue;
      const f = rows[i][col] / rows[rank][col];
      for (let j = 0; j < blanks.length; j++) rows[i][j] -= f * rows[rank][j];
    }
    rank++;
  }
  return rank;
}

describe("magic squares", () => {
  it("has exactly 8 magic squares of 1 … 9, the turns and mirrors of Lo Shu", () => {
    const images = squareImages(LO_SHU).map((g) => g.join());
    expect(new Set(images).size).toBe(8);
    const q = magicFrame([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(countSetFills(q, 1000)).toBe(8);
  });

  it("has magic triangles of 1 … 6 for totals 9 to 12 only", () => {
    const sums = new Set(MAGIC_TRIANGLES.map((t) => t[0] + t[3] + t[1]));
    expect([...sums].sort((a, b) => a - b)).toEqual([9, 10, 11, 12]);
    // Each total has one triangle up to turning and mirroring.
    expect(MAGIC_TRIANGLES.length).toBe(24);
  });
});

describe("number circle and star", () => {
  /** Every permutation of 1 … n, checked by brute force (independent of the generator's pruned search). */
  function bruteFills(fig: ReturnType<typeof wheelFigure>): string[] {
    const n = fig.cells.length;
    const out: string[] = [];
    const vals: number[] = [];
    const walk = (left: number[]) => {
      if (!left.length) {
        const sums = fig.lines.map((l) => l.cells.reduce((s, c) => s + vals[c], 0));
        if (sums.every((s) => s === sums[0])) out.push(vals.join());
        return;
      }
      for (const v of left) {
        vals.push(v);
        walk(left.filter((x) => x !== v));
        vals.pop();
      }
    };
    walk(Array.from({ length: n }, (_, i) => i + 1));
    return out.sort();
  }

  it("finds every number wheel of 1 … 7: centre 1, 4 or 7", () => {
    const fills = wheelFills();
    expect(fills.map((f) => f.join()).sort()).toEqual(bruteFills(wheelFigure()));
    expect(fills.length).toBe(144);
    expect([...new Set(fills.map((f) => f[0]))].sort()).toEqual([1, 4, 7]);
  });

  it("finds the 80 six-pointed stars of 1 … 12 (960 with turns and mirrors), every side 26", () => {
    const fig = hexagramFigure();
    // Each circle is on exactly two sides of four.
    for (let c = 0; c < 12; c++) expect(fig.lines.filter((l) => l.cells.includes(c))).toHaveLength(2);
    for (const l of fig.lines) expect(l.cells).toHaveLength(4);
    const fills = hexagramFills();
    expect(new Set(fills.map((f) => f.join())).size).toBe(960);
    for (const f of fills) {
      expect([...f].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
      for (const l of fig.lines) expect(l.cells.reduce((s, c) => s + f[c], 0)).toBe(26);
    }
    // Turning by a sixth and mirroring left to right: tip k, crossing 6 + k (between tips k and k + 1).
    const turn = (f: number[]) => f.map((_, i) => (i < 6 ? f[(i + 5) % 6] : f[6 + ((i - 6 + 5) % 6)]));
    const flip = (f: number[]) => f.map((_, i) => (i < 6 ? f[(6 - i) % 6] : f[6 + ((11 - (i - 6)) % 6)]));
    const canon = (f: number[]) => {
      const keys: string[] = [];
      let g = f;
      for (let k = 0; k < 6; k++) {
        keys.push(g.join(), flip(g).join());
        g = turn(g);
      }
      return keys.sort()[0];
    };
    // Turns and mirrors keep a star a star.
    const all = new Set(fills.map((f) => f.join()));
    for (const f of fills.slice(0, 50)) {
      expect(all.has(turn(f).join())).toBe(true);
      expect(all.has(flip(f).join())).toBe(true);
    }
    expect(new Set(fills.map(canon)).size).toBe(80);
  });

  it("explore frames: the star's total comes from its numbers; the wheel's depends on the centre", () => {
    expect(ringFrame(Array.from({ length: 12 }, (_, i) => i + 1)).target).toBe(26);
    expect(ringFrame([1, 2, 3, 4, 5, 6, 7]).target).toBeNull();
  });

  it("starts the hidden-total star with the total, and names a circle that fixes one line but breaks the other", () => {
    const q = makeNumberPuzzle("ring", 3, 4);
    expect(q.targetHidden).toBe(true);
    expect(solveSteps(q)![0]).toEqual({ kind: "sum", value: q.target });
    expect(firstMove(q)).toBe("sum");

    // Crossing: find a puzzle and a wrong number that finishes one of its two lines right.
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      const p = makeNumberPuzzle("ring", 2, seed);
      const sol = solution(p);
      for (const c of blankCells(p)) {
        for (const d of blankCells(p)) {
          if (c === d) continue;
          // Swap two blanks' numbers: no repeats, all numbers from the set.
          const vals = [...sol] as (number | null)[];
          [vals[c], vals[d]] = [vals[d], vals[c]];
          const m = puzzleMistake(p, vals);
          if (m.tag !== "crossing") continue;
          const [cell, good, bad] = m.cross!;
          expect(p.lines[good].cells).toContain(cell);
          expect(p.lines[bad].cells).toContain(cell);
          expect(m.bad).toContain(bad);
          expect(m.bad).not.toContain(good);
          found = true;
          break;
        }
        if (found) break;
      }
    }
    expect(found).toBe(true);
    // The right answer is never a crossing slip.
    const p = makeNumberPuzzle("ring", 2, 1);
    expect(crossingSlip(p, solution(p))).toBeNull();
  });
});

describe("solver", () => {
  it("solves a magic square from a line with one blank, then by elimination", () => {
    const q = makeNumberPuzzle("magic", 1, 3);
    const steps = solveSteps(q)!;
    expect(steps.every((s) => s.kind === "line")).toBe(true);
    expect(valuesAfter(q, steps, steps.length)).toEqual(solution(q));
  });

  it("starts a hidden-total magic square with the total and the centre", () => {
    const q = makeNumberPuzzle("magic", 3, 11);
    const steps = solveSteps(q)!;
    expect(steps[0]).toEqual({ kind: "sum", value: q.target });
    if (!q.cells[4].given) expect(steps[1]).toEqual({ kind: "centre", cell: 4, value: q.target! / 3 });
  });

  it("knows what fits in a cell", () => {
    const q = magicFrame([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const vals = [8, 1, null, null, 5, null, null, null, null];
    expect(candidates(q, vals, 2)).toEqual([6]);
    // Centre 5 and corner 2: the opposite corner can only be 8.
    expect(candidates(q, [2, null, null, null, 5, null, null, null, null], 8)).toEqual([8]);
    // Line by line, an empty square rules nothing out.
    expect(candidates(q, Array(9).fill(null), 0)).toHaveLength(9);
  });

  it("finds a missing corner by working backwards", () => {
    // l + r − t: 4 + 7 − t = 6 gives t = 5.
    const vals = [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 7, 6];
    expect(cornerCandidates(1, vals, 8)).toEqual([5]);
  });
});

describe("first-move hint", () => {
  it("fits the puzzle", () => {
    expect(firstMove(makeNumberPuzzle("shape", 1, 1))).toBe("rule");
    expect(firstMove(makeNumberPuzzle("magic", 3, 1))).toBe("sum");
    expect(firstMove(makeNumberPuzzle("star", 3, 1))).toBe("cornerSum");
    expect(firstMove(makeNumberPuzzle("ring", 3, 1))).toBe("sum");
    expect(firstMove(makeNumberPuzzle("pyramid", 2, 1))).toBe("line");
    // A magic square with one blank starts from its line.
    const one = makeNumberPuzzle("magic", 1, 1);
    expect(firstMove({ ...one, cells: one.cells.map((c, i) => ({ ...c, given: i !== 0 })) })).toBe("line");
    // Some level-2 squares have no line with one blank: the hint then says to eliminate.
    const elim = Array.from({ length: 500 }, (_, seed) => makeNumberPuzzle("magic", 2, seed)).find((q) => firstMove(q) === "only");
    expect(elim).toBeDefined();
    expect(oneBlankLines(elim!)).toEqual([]);
  });
});

describe("number puzzles", () => {
  it("is the same for the same seed", () => {
    for (const t of PUZZLE_TYPES) for (const l of LEVELS) expect(makeNumberPuzzle(t, l, 42)).toEqual(makeNumberPuzzle(t, l, 42));
  });

  it("gives a sound puzzle with one answer for 10,000 seeds of every type, level and size", () => {
    // Problems are collected and checked once: millions of expect() calls are slow.
    const problems: string[] = [];
    for (const type of PUZZLE_TYPES)
      for (const level of LEVELS)
        for (const big of [false, true])
          for (let seed = 0; seed < 10_000; seed++) {
            const q = makeNumberPuzzle(type, level, seed, big);
            const sol = solution(q);
            const blanks = blankCells(q);
            const n = blanks.length;
            const fail = (why: string) => problems.length < 20 && problems.push(`${type} ${level} ${big ? "big" : ""} ${seed}: ${why}`);
            if (!sol.every((v) => Number.isInteger(v) && v >= 1 && v <= 999)) fail("value out of range");

            // The stored answer is right and the solver reaches it.
            if (puzzleMistake(q, sol).tag !== "right") fail("answer not right");
            const steps = solveSteps(q);
            if (!steps) fail("solver stuck");
            else if (valuesAfter(q, steps, steps.length).join() !== sol.join()) fail("solver disagrees");

            // No slip may be the right answer.
            for (const [c, , v] of cellSlips(q)) if (v === sol[c]) fail("slip is the answer");

            // The "think first" hint is true for this puzzle.
            const move = firstMove(q);
            if ((move === "rule") !== (type === "shape")) fail(`hint ${move}`);
            if (move === "sum" && !((type === "magic" || type === "ring") && q.targetHidden)) fail("sum hint");
            if (move === "cornerSum" && !(type === "star" && q.anyFill && n === 6)) fail("corner hint");
            if (move === "line" && !oneBlankLines(q).length) fail("no line with one blank");
            if (move === "only" && (oneBlankLines(q).length || !blanks.some((c) => candidates(q, givenValues(q), c).length === 1))) fail("only hint");
            // The two puzzles the old one-blank hint misled on.
            if (level === 3 && (type === "magic" || type === "star" || type === "ring") && move === "line") fail("line hint on a level-3 magic puzzle");

            switch (type) {
              case "magic":
                if (q.set!.length !== 9 || q.targetHidden !== (level === 3)) fail("set or target");
                if (n < [1, 4, 7][level - 1] || n > [2, 5, 7][level - 1]) fail(`${n} blanks`);
                if (countSetFills(q) !== 1) fail("not one answer");
                break;
              case "star":
                if (q.set!.length !== 6) fail("set");
                if (level === 3) {
                  // Several answers: the tool says so and accepts each.
                  if (!q.anyFill || n !== 6 || countSetFills(q) < 2) fail("open triangle");
                } else {
                  if (q.anyFill || n < level || n > [2, 3][level - 1]) fail(`${n} blanks`);
                  if (countSetFills(q) !== 1) fail("not one answer");
                }
                break;
              case "ring": {
                // Level 1 is the wheel of 7 with the total told; levels 2 and 3 the star of 12, the total hidden at 3.
                if (q.set!.length !== (level === 1 ? 7 : 12) || q.cells.length !== q.set!.length) fail("set or figure");
                if (q.targetHidden !== (level === 3) || q.anyFill) fail("target");
                const [lo, hi] = RING_BLANKS[level];
                if (n < lo || n > hi) fail(`${n} blanks`);
                if (q.lines.some((l) => l.cells.reduce((s, c) => s + sol[c], 0) !== q.target)) fail("lines not equal");
                if (level > 1 && q.target !== q.set!.reduce((s, x) => s + x, 0) / 3) fail("star total");
                // Brute force over every way to place the unused numbers: exactly one works.
                if (countSetFills(q) !== 1) fail("not one answer");
                if (crossingSlip(q, sol)) fail("crossing on the answer");
                break;
              }
              case "pyramid":
                if (q.cells.length !== (level === 1 ? 6 : 10)) fail("size");
                if (n < [1, 5, 6][level - 1] || n > [2, 5, 6][level - 1]) fail(`${n} blanks`);
                if (linearRank(q) !== n) fail("not one answer");
                break;
              case "grid":
                if (n < [1, 4, 7][level - 1] || n > [2, 5, 7][level - 1]) fail(`${n} blanks`);
                if (linearRank(q) !== n) fail("not one answer");
                break;
              case "shape":
                if (n !== 1 || (level < 3 && blanks[0] !== 11)) fail("blank");
                // Only the puzzle's rule fits both finished shapes, and it gives one answer.
                if (fittingRules(sol).join() !== String(q.rule)) fail("rule not unique");
                if (blanks[0] !== 11 && cornerCandidates(q.rule!, sol, blanks[0]).join() !== String(sol[blanks[0]])) fail("corner not unique");
                break;
            }
          }
    expect(problems).toEqual([]);
  }, 300_000);

  it("names the usual slips", () => {
    // Pyramid: a missing bottom brick found by adding instead of subtracting.
    const pyr = makeNumberPuzzle("pyramid", 2, 5);
    const slip = cellSlips(pyr).find(([, t]) => t === "addedDown");
    if (slip) {
      const vals = solution(pyr) as (number | null)[];
      vals[slip[0]] = slip[2];
      expect(puzzleMistake(pyr, vals).tag).toBe("addedDown");
    }

    // Magic square: rows and columns right but the diagonals not (a turned Lo Shu row swap).
    const q = { ...magicFrame([1, 2, 3, 4, 5, 6, 7, 8, 9]), anyFill: false };
    const sq = { ...q, cells: q.cells.map((c, i) => ({ ...c, value: LO_SHU[i], given: i > 2 && i !== 4 })) };
    // Swap the first two columns: rows and columns still add to 15.
    const swapped = [7, 2, 6, 5, 9, 1, 3, 4, 8];
    expect(puzzleMistake(sq, swapped).tag).toBe("diagonal");
    expect(puzzleMistake(sq, [2, 7, 6, 9, 5, 1, 4, 3, 8]).tag).toBe("right");
    expect(puzzleMistake(sq, [2, 2, 6, 9, 5, 1, 4, 3, 8]).tag).toBe("repeat");
    expect(puzzleMistake(sq, [2, 12, 6, 9, 5, 1, 4, 3, 8]).tag).toBe("notInSet");
    expect(puzzleMistake(sq, [6, 7, 2, 9, 5, 1, 4, 3, 8]).bad.length).toBeGreaterThan(0);

    // Number in shape: the sum of the corners when the rule is something else.
    for (let seed = 0; seed < 50; seed++) {
      const s = makeNumberPuzzle("shape", 2, seed);
      const vals = solution(s) as (number | null)[];
      const sum = vals[8]! + vals[9]! + vals[10]!;
      if (sum === vals[11]) continue;
      vals[11] = sum;
      expect(puzzleMistake(s, vals).tag).toBe("sumHabit");
      break;
    }

    // Grid: a row total added in instead of taken away.
    for (let seed = 0; seed < 50; seed++) {
      const g = makeNumberPuzzle("grid", 1, seed);
      const inner = blankCells(g).find((c) => c % 4 !== 3 && c < 12);
      if (inner === undefined) continue;
      const vals = solution(g) as (number | null)[];
      const row = Math.floor(inner / 4);
      vals[inner] = vals[4 * row + 3]! + [0, 1, 2].filter((c) => 4 * row + c !== inner).reduce((s, c) => s + vals[4 * row + c]!, 0);
      expect(puzzleMistake(g, vals).tag).toBe("addedDown");
      break;
    }
  });

  it("accepts any valid fill of the open magic triangle", () => {
    const q = makeNumberPuzzle("star", 3, 9);
    const t = q.target!;
    const a = q.set![0];
    const d = q.set![1] - a;
    for (const tri of MAGIC_TRIANGLES) {
      const vals = tri.map((k) => a + (k - 1) * d);
      if (vals[0] + vals[3] + vals[1] !== t) continue;
      expect(["right", "anyValid"]).toContain(puzzleMistake(q, vals).tag);
    }
  });

  it("describes every rule with its own working", () => {
    for (const r of SHAPE_RULES) expect(r.expr("a", "b", "c")).toMatch(/a/);
  });
});
