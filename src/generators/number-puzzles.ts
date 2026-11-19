// Tool 10: number puzzles. Every puzzle is a set of cells, some given and
// some blank, tied together by lines. A line either adds up to the puzzle's
// common total (magic square, magic triangle) or its last cell is the sum of
// the others (a pyramid brick, a row or column total). "Number in shape" is
// the odd one out: the centre comes from the corners by a hidden rule, and
// two finished shapes give the rule away.
//
// The solver fills one cell at a time, always a cell with only one
// possibility. A puzzle is kept only if the solver finishes it, which also
// proves its answer is unique. The fully empty magic triangle is the one
// exception: it has several answers, so the tool accepts any valid one.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type PuzzleType = "magic" | "pyramid" | "grid" | "star" | "shape";
export const PUZZLE_TYPES: PuzzleType[] = ["magic", "pyramid", "grid", "star", "shape"];

export interface Cell {
  /** Centre of the cell in board units (x to the right, y down). */
  x: number;
  y: number;
  /** The solution. */
  value: number;
  given: boolean;
}

export type LineKind = "row" | "col" | "diag" | "side" | "brick";

export interface Line {
  cells: number[];
  kind: LineKind;
  /** e.g. "سطر بالا". */
  name: string;
  /** The last cell is the sum of the others; otherwise the cells add up to the puzzle's target. */
  total: boolean;
}

export interface NumberPuzzle {
  type: PuzzleType;
  level: Level;
  seed: number;
  /** Bigger numbers. */
  big: boolean;
  cells: Cell[];
  lines: Line[];
  /** Numbers to place, each exactly once; null when any whole number may go in. */
  set: number[] | null;
  /** What every target line adds up to. */
  target: number | null;
  /** The target is not told: the solver works it out first. */
  targetHidden: boolean;
  /** Several answers are right; any valid fill is accepted. */
  anyFill: boolean;
  /** Number in shape: index into SHAPE_RULES. */
  rule: number | null;
}

// ---------------------------------------------------------------------------
// Figures

/** Lo Shu, the 3×3 magic square of 1 … 9; every other one is a turn or mirror of it. */
export const LO_SHU = [2, 7, 6, 9, 5, 1, 4, 3, 8];
const turn = (g: number[]) => g.map((_, i) => g[(2 - (i % 3)) * 3 + Math.floor(i / 3)]);
const mirror = (g: number[]) => g.map((_, i) => g[Math.floor(i / 3) * 3 + 2 - (i % 3)]);

/** The 8 turns and mirrors of a 3×3 grid. */
export function squareImages(g: number[]): number[][] {
  const out: number[][] = [];
  let cur = g;
  for (let k = 0; k < 4; k++) {
    out.push(cur, mirror(cur));
    cur = turn(cur);
  }
  return out;
}

const blankCell = (x: number, y: number): Cell => ({ x, y, value: 0, given: false });

function magicFigure(): { cells: Cell[]; lines: Line[] } {
  const cells = Array.from({ length: 9 }, (_, i) => blankCell(i % 3, Math.floor(i / 3)));
  const rowNames = ["سطر بالا", "سطر وسط", "سطر پایین"];
  const colNames = ["ستون چپ", "ستون وسط", "ستون راست"];
  const lines: Line[] = [
    ...[0, 1, 2].map((r): Line => ({ cells: [3 * r, 3 * r + 1, 3 * r + 2], kind: "row", name: rowNames[r], total: false })),
    ...[0, 1, 2].map((c): Line => ({ cells: [c, c + 3, c + 6], kind: "col", name: colNames[c], total: false })),
    { cells: [0, 4, 8], kind: "diag", name: "قطر از بالا چپ", total: false },
    { cells: [2, 4, 6], kind: "diag", name: "قطر از بالا راست", total: false },
  ];
  return { cells, lines };
}

/** Pyramid with n bricks at the bottom; brick (r, i) is index r(r+1)/2 + i, top first. */
export const brickIndex = (r: number, i: number) => (r * (r + 1)) / 2 + i;

function pyramidFigure(n: number): { cells: Cell[]; lines: Line[] } {
  const cells: Cell[] = [];
  for (let r = 0; r < n; r++) for (let i = 0; i <= r; i++) cells.push(blankCell(i + (n - 1 - r) / 2, r));
  const lines: Line[] = [];
  for (let r = 0; r < n - 1; r++)
    for (let i = 0; i <= r; i++)
      lines.push({ cells: [brickIndex(r + 1, i), brickIndex(r + 1, i + 1), brickIndex(r, i)], kind: "brick", name: "آجر", total: true });
  return { cells, lines };
}

/**
 * A 3×3 table with row totals on the left and column totals below (the
 * Persian page starts on the right). Cell (r, c) is 4r + c; c = 3 is the row
 * total, r = 3 the column total, 15 the grand total.
 */
function gridFigure(): { cells: Cell[]; lines: Line[] } {
  const cells = Array.from({ length: 16 }, (_, i) => {
    const r = Math.floor(i / 4);
    const c = i % 4;
    return blankCell(c === 3 ? 0 : 3.25 - c, r === 3 ? 3.25 : r);
  });
  const lines: Line[] = [];
  for (let r = 0; r < 4; r++) lines.push({ cells: [4 * r, 4 * r + 1, 4 * r + 2, 4 * r + 3], kind: "row", name: r === 3 ? "سطر جمع‌ها" : `سطر ${"۱۲۳"[r]}`, total: true });
  for (let c = 0; c < 4; c++) lines.push({ cells: [c, c + 4, c + 8, c + 12], kind: "col", name: c === 3 ? "ستون جمع‌ها" : `ستون ${"۱۲۳"[c]}`, total: true });
  return { cells, lines };
}

/** Magic triangle: corners 0 (top), 1, 2 and the middles of the sides 3, 4, 5. */
function starFigure(): { cells: Cell[]; lines: Line[] } {
  const pos: [number, number][] = [
    [1.5, 0],
    [0, 2.6],
    [3, 2.6],
    [0.75, 1.3],
    [1.5, 2.6],
    [2.25, 1.3],
  ];
  return {
    cells: pos.map(([x, y]) => blankCell(x, y)),
    lines: [
      { cells: [0, 3, 1], kind: "side", name: "ضلع چپ", total: false },
      { cells: [1, 4, 2], kind: "side", name: "ضلع پایین", total: false },
      { cells: [2, 5, 0], kind: "side", name: "ضلع راست", total: false },
    ],
  };
}

/** Three triangles; the first (read first, on the right) is shape 0. Cell 4k + j: j = 0 top, 1 and 2 bottom, 3 centre. */
function shapeFigure(): { cells: Cell[]; lines: Line[] } {
  const cells: Cell[] = [];
  for (let k = 0; k < 3; k++) {
    const cx = (2 - k) * 3.7 + 1.25;
    cells.push(blankCell(cx, 0), blankCell(cx - 1.25, 2.2), blankCell(cx + 1.25, 2.2), blankCell(cx, 1.45));
  }
  return { cells, lines: [] };
}

const FIGURES: Record<PuzzleType, () => { cells: Cell[]; lines: Line[] }> = {
  magic: magicFigure,
  pyramid: () => pyramidFigure(4),
  grid: gridFigure,
  star: starFigure,
  shape: shapeFigure,
};

const arith = (a: number, d: number, n: number) => Array.from({ length: n }, (_, i) => a + i * d);
const total = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Empty frames for exploring: everything blank. */
export function magicFrame(set: number[]): NumberPuzzle {
  return { type: "magic", level: 1, seed: 0, big: false, ...magicFigure(), set, target: total(set) / 3, targetHidden: false, anyFill: true, rule: null };
}
export function starFrame(set: number[]): NumberPuzzle {
  return { type: "star", level: 1, seed: 0, big: false, ...starFigure(), set, target: null, targetHidden: false, anyFill: true, rule: null };
}
export function pyramidFrame(n = 4): NumberPuzzle {
  return { type: "pyramid", level: 1, seed: 0, big: false, ...pyramidFigure(n), set: null, target: null, targetHidden: false, anyFill: true, rule: null };
}

// ---------------------------------------------------------------------------
// Number in shape

export interface ShapeRule {
  f: (t: number, l: number, r: number) => number;
  /** The working with numbers, left to right. */
  expr: (t: string, l: string, r: string) => string;
  words: string;
}

/** Every rule is the same for the two bottom corners, so left and right never matter. */
export const SHAPE_RULES: ShapeRule[] = [
  { f: (t, l, r) => t + l + r, expr: (t, l, r) => `${t} + ${l} + ${r}`, words: "جمع سه گوشه" },
  { f: (t, l, r) => l + r - t, expr: (t, l, r) => `${l} + ${r} − ${t}`, words: "جمع دو گوشه پایین، منهای گوشه بالا" },
  { f: (t, l, r) => l * r + t, expr: (t, l, r) => `${l} × ${r} + ${t}`, words: "ضرب دو گوشه پایین، به‌علاوه گوشه بالا" },
  { f: (t, l, r) => l * r - t, expr: (t, l, r) => `${l} × ${r} − ${t}`, words: "ضرب دو گوشه پایین، منهای گوشه بالا" },
  { f: (t, l, r) => 2 * (t + l + r), expr: (t, l, r) => `۲ × (${t} + ${l} + ${r})`, words: "دو برابر جمع سه گوشه" },
  { f: (t, l, r) => t * (l + r), expr: (t, l, r) => `${t} × (${l} + ${r})`, words: "گوشه بالا ضرب در جمع دو گوشه پایین" },
  { f: (t, l, r) => t * l * r, expr: (t, l, r) => `${t} × ${l} × ${r}`, words: "ضرب سه گوشه" },
];

const RULE_POOL: Record<Level, number[]> = { 1: [0, 1], 2: [2, 3, 4], 3: [5, 6, 2, 3] };

/** Corners of shape k as [top, left, right]. */
export const cornersOf = (vals: readonly (number | null)[], k: number) => [vals[4 * k], vals[4 * k + 1], vals[4 * k + 2]] as [number, number, number];

/** Values of a blank corner that make rule `ri` give the centre. */
export function cornerCandidates(ri: number, vals: readonly number[], cell: number): number[] {
  const k = Math.floor(cell / 4);
  const out: number[] = [];
  for (let v = 1; v <= 999; v++) {
    const c = [...cornersOf(vals, k)];
    c[cell % 4] = v;
    if (SHAPE_RULES[ri].f(c[0], c[1], c[2]) === vals[4 * k + 3]) out.push(v);
  }
  return out;
}

/** Rules that fit every finished shape (shapes 0 and 1). */
export function fittingRules(vals: readonly number[]): number[] {
  return SHAPE_RULES.map((_, i) => i).filter((i) => [0, 1].every((k) => SHAPE_RULES[i].f(...cornersOf(vals, k)) === vals[4 * k + 3]));
}

// ---------------------------------------------------------------------------
// Generators

const between = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

function withBlanks(q: NumberPuzzle, blanks: number[]): NumberPuzzle {
  return { ...q, cells: q.cells.map((c, i) => ({ ...c, given: !blanks.includes(i) })) };
}

/** Hide `count` random cells until the solver can finish the puzzle. */
function hide(rng: Rng, q: NumberPuzzle, count: number, allowed = q.cells.map((_, i) => i)): NumberPuzzle {
  for (;;) {
    const p = withBlanks(q, shuffle(rng, allowed).slice(0, count));
    if (solveSteps(p)) return p;
  }
}

function base(type: PuzzleType, level: Level, seed: number, big: boolean): NumberPuzzle {
  return { type, level, seed, big, ...FIGURES[type](), set: null, target: null, targetHidden: false, anyFill: false, rule: null };
}

function magicPuzzle(rng: Rng, q: NumberPuzzle): NumberPuzzle {
  const { level, big } = q;
  const [a, d] = big
    ? level < 3
      ? [between(rng, 2, 10), pick(rng, [2, 3, 5])]
      : [between(rng, 3, 12), pick(rng, [2, 3, 4, 5])]
    : level < 3
      ? [1, 1]
      : [between(rng, 2, 6), pick(rng, [1, 1, 2])];
  const set = arith(a, d, 9);
  const square = pick(rng, squareImages(LO_SHU));
  const p: NumberPuzzle = { ...q, set, target: total(set) / 3, targetHidden: level === 3, cells: q.cells.map((c, i) => ({ ...c, value: a + (square[i] - 1) * d })) };
  return hide(rng, p, level === 1 ? 1 + randInt(rng, 2) : level === 2 ? 4 + randInt(rng, 2) : 7);
}

function pyramidPuzzle(rng: Rng, q: NumberPuzzle): NumberPuzzle {
  const { level, big } = q;
  const n = level === 1 ? 3 : 4;
  const fig = pyramidFigure(n);
  const [lo, hi] = big ? ([[10, 40], [5, 40], [5, 50]] as const)[level - 1] : ([[1, 9], [1, 12], [2, 15]] as const)[level - 1];
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals[brickIndex(n - 1, i)] = between(rng, lo, hi);
  for (let r = n - 2; r >= 0; r--) for (let i = 0; i <= r; i++) vals[brickIndex(r, i)] = vals[brickIndex(r + 1, i)] + vals[brickIndex(r + 1, i + 1)];
  const p: NumberPuzzle = { ...q, ...fig, cells: fig.cells.map((c, i) => ({ ...c, value: vals[i] })) };
  return hide(rng, p, level === 1 ? 1 + randInt(rng, 2) : level === 2 ? 5 : 6);
}

function gridPuzzle(rng: Rng, q: NumberPuzzle): NumberPuzzle {
  const { level, big } = q;
  const [lo, hi] = big ? [10, 60] : level < 3 ? [1, 9] : [2, 15];
  const v = Array.from({ length: 16 }, () => 0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) v[4 * r + c] = between(rng, lo, hi);
  for (let r = 0; r < 3; r++) v[4 * r + 3] = v[4 * r] + v[4 * r + 1] + v[4 * r + 2];
  for (let c = 0; c < 4; c++) v[12 + c] = v[c] + v[4 + c] + v[8 + c];
  const p: NumberPuzzle = { ...q, cells: q.cells.map((c, i) => ({ ...c, value: v[i] })) };
  // Nine numbers fix the table, so at most seven can be hidden.
  return hide(rng, p, level === 1 ? 1 + randInt(rng, 2) : level === 2 ? 4 + randInt(rng, 2) : 7);
}

/** Every magic triangle of 1 … 6 (as values on cells 0 … 5). */
export const MAGIC_TRIANGLES: number[][] = (() => {
  const out: number[][] = [];
  const walk = (cur: number[], left: number[]) => {
    if (!left.length) {
      const s = [cur[0] + cur[3] + cur[1], cur[1] + cur[4] + cur[2], cur[2] + cur[5] + cur[0]];
      if (s[0] === s[1] && s[1] === s[2]) out.push(cur);
      return;
    }
    for (const x of left) walk([...cur, x], left.filter((y) => y !== x));
  };
  walk([], [1, 2, 3, 4, 5, 6]);
  return out;
})();

function starPuzzle(rng: Rng, q: NumberPuzzle): NumberPuzzle {
  const { level, big } = q;
  const [a, d] = big ? [between(rng, 2, 10), pick(rng, [2, 3, 5])] : [1, 1];
  const set = arith(a, d, 6);
  const tri = pick(rng, MAGIC_TRIANGLES);
  const cells = q.cells.map((c, i) => ({ ...c, value: a + (tri[i] - 1) * d }));
  const p: NumberPuzzle = { ...q, cells, set, target: cells[0].value + cells[3].value + cells[1].value };
  if (level === 3) return { ...withBlanks(p, [0, 1, 2, 3, 4, 5]), anyFill: true };
  return hide(rng, p, level === 1 ? 1 + randInt(rng, 2) : 3);
}

function shapePuzzle(rng: Rng, q: NumberPuzzle): NumberPuzzle {
  const { level, big } = q;
  const [lo, hi] = big ? ([[5, 30], [3, 20], [2, 12]] as const)[level - 1] : [1, 9];
  for (;;) {
    const rule = pick(rng, RULE_POOL[level]);
    const vals: number[] = [];
    for (let k = 0; k < 3; k++) {
      const [t, l, r] = [between(rng, lo, hi), between(rng, lo, hi), between(rng, lo, hi)];
      vals.push(t, l, r, SHAPE_RULES[rule].f(t, l, r));
    }
    if (vals.some((v, i) => i % 4 === 3 && (v < 1 || v > 999))) continue;
    // The two finished shapes must point to this rule and no other.
    const fits = fittingRules(vals);
    if (fits.length !== 1) continue;
    const blank = level === 3 && rng() < 0.5 ? 8 + randInt(rng, 3) : 11;
    if (blank !== 11 && cornerCandidates(rule, vals, blank).length !== 1) continue;
    return { ...q, rule, cells: q.cells.map((c, i) => ({ ...c, value: vals[i], given: i !== blank })) };
  }
}

export function makeNumberPuzzle(type: PuzzleType, level: Level, seed: number, big = false): NumberPuzzle {
  const rng = mulberry32(seed * 7 + level * 101 + type.length * 13 + (big ? 50_021 : 0));
  const q = base(type, level, seed, big);
  switch (type) {
    case "magic":
      return magicPuzzle(rng, q);
    case "pyramid":
      return pyramidPuzzle(rng, q);
    case "grid":
      return gridPuzzle(rng, q);
    case "star":
      return starPuzzle(rng, q);
    case "shape":
      return shapePuzzle(rng, q);
  }
}

// ---------------------------------------------------------------------------
// Solver: one forced cell at a time

export type Step =
  /** The hidden magic total: all numbers fill three rows. */
  | { kind: "sum"; value: number }
  /** The centre of a 3×3 magic square is a third of the total. */
  | { kind: "centre"; cell: number; value: number }
  /** Magic triangle: corners count twice, so 3 × target = all numbers + corners. */
  | { kind: "cornerSum"; value: number }
  /** A free choice (any order works). */
  | { kind: "pick"; cells: number[]; values: number[] }
  /** A line with one blank left. */
  | { kind: "line"; cell: number; line: number; value: number }
  /** Of the numbers left, only one fits every line through this cell. */
  | { kind: "only"; cell: number; value: number; rest: number[] }
  /** Number in shape: the rule tried on finished shape k. */
  | { kind: "check"; shape: number; value: number }
  | { kind: "apply"; cell: number; value: number };

export const givenValues = (q: NumberPuzzle): (number | null)[] => q.cells.map((c) => (c.given ? c.value : null));
export const blankCells = (q: NumberPuzzle) => q.cells.flatMap((c, i) => (c.given ? [] : [i]));

/** Numbers of the set not yet placed. */
export function remaining(set: readonly number[], vals: readonly (number | null)[]): number[] {
  const left = [...set];
  for (const v of vals) {
    const i = v === null ? -1 : left.indexOf(v);
    if (i >= 0) left.splice(i, 1);
  }
  return left;
}

/** Can `k` different numbers of `pool` add up to `need`? */
function canMake(pool: readonly number[], k: number, need: number): boolean {
  if (k === 0) return need === 0;
  for (let i = 0; i < pool.length; i++) if (canMake(pool.slice(i + 1), k - 1, need - pool[i])) return true;
  return false;
}

/** Value the one blank of a line must take. */
function lineValue(q: NumberPuzzle, line: Line, vals: readonly (number | null)[], blank: number): number {
  const others = line.cells.filter((i) => i !== blank).reduce((s, i) => s + vals[i]!, 0);
  if (!line.total) return q.target! - others;
  const last = line.cells[line.cells.length - 1];
  return blank === last ? others : 2 * vals[last]! - others;
}

function lineStep(q: NumberPuzzle, vals: readonly (number | null)[], targetKnown: boolean): Step | null {
  for (let li = 0; li < q.lines.length; li++) {
    const line = q.lines[li];
    if (!line.total && !targetKnown) continue;
    const open = line.cells.filter((i) => vals[i] === null);
    if (open.length === 1) return { kind: "line", cell: open[0], line: li, value: lineValue(q, line, vals, open[0]) };
  }
  return null;
}

/** Numbers of the set that could still go in a cell, judged line by line. */
export function candidates(q: NumberPuzzle, vals: readonly (number | null)[], cell: number): number[] {
  const left = remaining(q.set!, vals);
  return left.filter((v) =>
    q.lines
      .filter((l) => l.cells.includes(cell))
      .every((l) => {
        const others = l.cells.filter((i) => i !== cell);
        const known = others.filter((i) => vals[i] !== null);
        const need = q.target! - v - known.reduce((s, i) => s + vals[i]!, 0);
        return canMake(
          left.filter((x) => x !== v),
          others.length - known.length,
          need,
        );
      }),
  );
}

function onlyStep(q: NumberPuzzle, vals: readonly (number | null)[]): Step | null {
  for (let c = 0; c < vals.length; c++) {
    if (vals[c] !== null) continue;
    const cands = candidates(q, vals, c);
    if (cands.length === 1) return { kind: "only", cell: c, value: cands[0], rest: remaining(q.set!, vals) };
  }
  return null;
}

function shapeSteps(q: NumberPuzzle): Step[] {
  const blank = blankCells(q)[0];
  return [
    { kind: "check", shape: 0, value: q.cells[3].value },
    { kind: "check", shape: 1, value: q.cells[7].value },
    { kind: "apply", cell: blank, value: q.cells[blank].value },
  ];
}

/** The solving steps, or null if the solver gets stuck. */
export function solveSteps(q: NumberPuzzle): Step[] | null {
  if (q.type === "shape") return shapeSteps(q);
  const vals = givenValues(q);
  const steps: Step[] = [];
  let targetKnown = !q.targetHidden;
  if (q.type === "magic" && q.targetHidden) {
    steps.push({ kind: "sum", value: q.target! });
    targetKnown = true;
    if (vals[4] === null) {
      vals[4] = q.target! / 3;
      steps.push({ kind: "centre", cell: 4, value: vals[4] });
    }
  }
  if (q.anyFill && q.type === "star") {
    const corners = [0, 1, 2];
    steps.push({ kind: "cornerSum", value: 3 * q.target! - total(q.set!) });
    const values = corners.map((c) => q.cells[c].value);
    corners.forEach((c, i) => (vals[c] = values[i]));
    steps.push({ kind: "pick", cells: corners, values });
  }
  while (vals.includes(null)) {
    const step = lineStep(q, vals, targetKnown) ?? (q.set && targetKnown ? onlyStep(q, vals) : null);
    if (!step || step.kind !== "line" && step.kind !== "only") return null;
    vals[step.cell] = step.value;
    steps.push(step);
  }
  return steps;
}

/** Cell values once the first k steps are done. */
export function valuesAfter(q: NumberPuzzle, steps: readonly Step[], k: number): (number | null)[] {
  const vals = givenValues(q);
  for (const s of steps.slice(0, k)) {
    if (s.kind === "pick") s.cells.forEach((c, i) => (vals[c] = s.values[i]));
    else if (s.kind === "centre" || s.kind === "line" || s.kind === "only" || s.kind === "apply") vals[s.cell] = s.value;
  }
  return vals;
}

// ---------------------------------------------------------------------------
// Checking an answer

/** Sum of a line, or null while it has a blank. */
export function lineSum(line: Line, vals: readonly (number | null)[]): number | null {
  const cells = line.total ? line.cells.slice(0, -1) : line.cells;
  if (cells.some((i) => vals[i] === null)) return null;
  return cells.reduce((s, i) => s + vals[i]!, 0);
}

/** Is a full line right? null while it has a blank. */
export function lineOk(q: NumberPuzzle, line: Line, vals: readonly (number | null)[]): boolean | null {
  const s = lineSum(line, vals);
  if (s === null) return null;
  if (line.total) {
    const last = vals[line.cells[line.cells.length - 1]];
    return last === null ? null : s === last;
  }
  return q.target === null ? null : s === q.target;
}

/** Full lines that are wrong. */
export const badLines = (q: NumberPuzzle, vals: readonly (number | null)[]) => q.lines.flatMap((l, i) => (lineOk(q, l, vals) === false ? [i] : []));

export type PuzzleTag = "right" | "anyValid" | "notInSet" | "repeat" | "addedDown" | "sumHabit" | "oneExample" | "diagonal" | "lines" | "other";

/** Wrong values for one cell with a known cause: [cell, tag, value]. */
export function cellSlips(q: NumberPuzzle): [number, PuzzleTag, number][] {
  const out: [number, PuzzleTag, number][] = [];
  const v = q.cells.map((c) => c.value);
  if (q.type === "pyramid" || q.type === "grid")
    for (const line of q.lines) {
      const last = line.cells[line.cells.length - 1];
      for (const c of line.cells.slice(0, -1))
        if (!q.cells[c].given) {
          // Added the brick above (or the total) instead of taking it away.
          const others = line.cells.slice(0, -1).filter((i) => i !== c);
          out.push([c, "addedDown", v[last] + total(others.map((i) => v[i]))]);
        }
    }
  if (q.type === "shape" && q.rule !== null) {
    const blank = blankCells(q)[0];
    if (blank % 4 === 3) {
      const query = cornersOf(v, 2);
      if (q.rule !== 0) out.push([blank, "sumHabit", total(query)]);
      SHAPE_RULES.forEach((r, i) => {
        if (i === q.rule) return;
        if (r.f(...cornersOf(v, 0)) === v[3] && r.f(...cornersOf(v, 1)) !== v[7]) out.push([blank, "oneExample", r.f(...query)]);
      });
    }
  }
  return out.filter(([c, , x]) => x !== q.cells[c].value);
}

/** What an answer is: right, a known slip, or which lines are wrong. */
export function puzzleMistake(q: NumberPuzzle, vals: readonly (number | null)[]): { tag: PuzzleTag; bad: number[]; value?: number } {
  const blanks = blankCells(q);
  if (blanks.every((i) => vals[i] === q.cells[i].value)) return { tag: "right", bad: [] };
  const bad = badLines(q, vals);
  if (q.set) {
    const off = blanks.find((i) => vals[i] !== null && !q.set!.includes(vals[i]!));
    if (off !== undefined) return { tag: "notInSet", bad, value: vals[off]! };
    const seen = new Set<number>();
    for (const x of vals) {
      if (x === null) continue;
      if (seen.has(x)) return { tag: "repeat", bad, value: x };
      seen.add(x);
    }
    if (q.anyFill && !bad.length && !vals.includes(null)) return { tag: "anyValid", bad };
  }
  for (const [c, tag, x] of cellSlips(q)) if (vals[c] === x) return { tag, bad, value: x };
  if (bad.length && q.type === "magic" && bad.every((i) => q.lines[i].kind === "diag")) return { tag: "diagonal", bad };
  if (bad.length) return { tag: "lines", bad };
  return { tag: "other", bad };
}
